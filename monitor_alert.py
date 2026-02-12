import os
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Tuple, Optional
from urllib import request
from urllib.error import HTTPError, URLError


OUT_DIR = Path("monitor")
SIG_PATH = OUT_DIR / "monitor_signature.json"
STATE_PATH = OUT_DIR / "alert_state.json"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}


def write_json(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True), encoding="utf-8")


def build_alert(sig: dict) -> Tuple[str, Optional[str], Optional[str]]:
    """
    Returns:
      alert_key: one of {"panic_on","overall_red","clear","unknown"}
      subject: email subject or None
      body: email body or None
    """
    states = (sig or {}).get("states", {})
    overall = states.get("overall")
    gold_state = states.get("gold")
    panic = states.get("panic_flush", {}) or {}
    panic_on = bool(panic.get("on"))
    panic_trigger = panic.get("trigger", "")

    built_at = (sig or {}).get("built_at_utc", "unknown time")
    fred = (sig or {}).get("fred", {})
    fred_series = fred.get("series_used", "unknown")
    fred_last_updated = fred.get("last_updated", "unknown")

    if panic_on and gold_state != "Red":
        subject = "RF Monitor: Panic flush ON"
        body = "\n".join(
            [
                f"Built: {built_at}",
                f"Overall: {overall}",
                f"Gold state: {gold_state}",
                f"Panic flush: ON ({panic_trigger})",
                "",
                "Action: Review adding exposure into the flush (per your plan).",
                "Link: https://reportingforge.com/monitor/",
                "",
                f"FRED: {fred_series} (last_updated: {fred_last_updated})",
            ]
        )
        return "panic_on", subject, body

    if overall == "Red":
        subject = "RF Monitor: Overall RED regime"
        body = "\n".join(
            [
                f"Built: {built_at}",
                f"Overall: {overall}",
                f"Gold state: {gold_state}",
                f"Panic flush: {'ON' if panic_on else 'OFF'} {('(' + panic_trigger + ')') if panic_trigger else ''}".strip(),
                "",
                "Action: Review risk management (hedge, trim, or tighten plan).",
                "Link: https://reportingforge.com/monitor/",
                "",
                f"FRED: {fred_series} (last_updated: {fred_last_updated})",
            ]
        )
        return "overall_red", subject, body

    if overall in ("Green", "Yellow"):
        return "clear", None, None

    return "unknown", None, None


def send_sendgrid_email(api_key: str, from_email: str, to_email: str, subject: str, body: str) -> None:
    url = "https://api.sendgrid.com/v3/mail/send"
    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email},
        "subject": subject,
        "content": [{"type": "text/plain", "value": body}],
    }

    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")

    try:
        with request.urlopen(req, timeout=30) as resp:
            status = resp.getcode()
            print(f"SendGrid response HTTP {status}")
            if status not in (200, 202):
                raise RuntimeError(f"SendGrid returned HTTP {status}")
    except HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else str(e)
        raise RuntimeError(f"SendGrid HTTPError {e.code}: {detail}") from e
    except URLError as e:
        raise RuntimeError(f"SendGrid URLError: {e}") from e


def main() -> None:
    sig = read_json(SIG_PATH)
    if not sig:
        print("No signature found. Skipping alerts.")
        return

    force = os.getenv("FORCE_ALERT", "").strip() == "1"

    # Normal alert logic
    alert_key, subject, body = build_alert(sig)

    # Forced test mode (manual runs)
    if force:
        alert_key = "test"
        subject = "RF Monitor: Test alert"
        body = "\n".join(
            [
                f"UTC: {utc_now_iso()}",
                "This is a forced test alert from GitHub Actions.",
                "Link: https://reportingforge.com/monitor/",
            ]
        )

    print(f"Computed alert_key={alert_key} subject={subject!r} force={force}")

    # Dedupe
    state = read_json(STATE_PATH)
    last_key = state.get("last_alert_key", "none")

    if alert_key in ("clear", "unknown"):
        if last_key != alert_key:
            state["last_alert_key"] = alert_key
            state["last_alert_sent_at"] = utc_now_iso()
            write_json(STATE_PATH, state)
            print(f"Alert state updated to {alert_key}. No email sent.")
        else:
            print("No alert. No change.")
        return

    if last_key == alert_key and not force:
        print(f"Alert already sent for key '{alert_key}'. Suppressing repeat.")
        return

    # Send email
    sg_key = os.getenv("SENDGRID_API_KEY", "").strip()
    from_email = os.getenv("ALERT_FROM_EMAIL", "").strip()
    to_email = os.getenv("ALERT_TO_EMAIL", "").strip()

    if not sg_key or not from_email or not to_email:
        raise SystemExit("Missing SENDGRID_API_KEY or ALERT_FROM_EMAIL or ALERT_TO_EMAIL secrets/env vars")

    print(f"Sending email from={from_email} to={to_email}")
    send_sendgrid_email(sg_key, from_email, to_email, subject or "RF Monitor Alert", body or "")

    # Update state
    state["last_alert_key"] = alert_key
    state["last_alert_sent_at"] = utc_now_iso()
    state["last_subject"] = subject
    write_json(STATE_PATH, state)

    print(f"Alert sent: {alert_key}")


if __name__ == "__main__":
    main()
