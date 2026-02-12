import os
from datetime import datetime
from pathlib import Path

import pandas as pd
from fredapi import Fred


SERIES_ID = "DFII10"

OUT_DIR = Path("monitor")
OUT_HTML = OUT_DIR / "index.html"
OUT_LAST = OUT_DIR / "fred_last_updated.txt"


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


def main():
    api_key = os.getenv("FRED_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("Missing FRED_API_KEY env var")

    fred = Fred(api_key=api_key)

    # Get series metadata, including last_updated
    info = fred.get_series_info(SERIES_ID)
    # fredapi returns a DataFrame; normalize to string
    last_updated = ""
    if isinstance(info, pd.DataFrame) and "last_updated" in info.index:
        last_updated = str(info.loc["last_updated"].values[0]).strip()
    elif isinstance(info, pd.Series) and "last_updated" in info.index:
        last_updated = str(info["last_updated"]).strip()

    if not last_updated:
        # Fallback, still proceed but do not do change-detection
        last_updated = "unknown"

    prev_last_updated = _read_text(OUT_LAST)

    # Always pull the series so we can show the latest datapoint
    s = fred.get_series(SERIES_ID).dropna()
    s.index = pd.to_datetime(s.index)

    last_dt = s.index[-1].strftime("%Y-%m-%d")
    last_val = float(s.iloc[-1])

    built_utc = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # If FRED has not updated since last run, do not rewrite HTML
    # This prevents unnecessary commits and makes "last build" meaningful.
    if prev_last_updated and last_updated != "unknown" and prev_last_updated == last_updated:
        print(f"No new FRED update for {SERIES_ID}. last_updated unchanged: {last_updated}")
        return

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Monitor - FRED</title>
  <style>
    body {{ font-family: Arial, Helvetica, sans-serif; margin: 18px; }}
    .card {{ border: 1px solid #ddd; border-radius: 10px; padding: 14px; max-width: 860px; }}
    .ok {{ background: #e9f7ec; }}
    .muted {{ opacity: 0.75; }}
    .k {{ opacity: 0.75; }}
    .v {{ font-weight: 700; }}
    a {{ text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    code {{ background: #f5f5f5; padding: 2px 6px; border-radius: 6px; }}
  </style>
</head>
<body>
  <h2>Monitor - FRED Smoke Test</h2>

  <div class="card ok">
    <div><span class="k">Status:</span> <span class="v">OK</span></div>
    <div><span class="k">Series:</span> <span class="v">{SERIES_ID} (10Y real yield)</span></div>
    <div><span class="k">Last datapoint:</span> <span class="v">{last_dt}</span></div>
    <div><span class="k">Last value:</span> <span class="v">{last_val:.3f}%</span></div>
    <div><span class="k">FRED last_updated:</span> <span class="v">{last_updated}</span></div>
    <div style="margin-top:10px;"><span class="k">Built:</span> <span class="v">{built_utc}</span></div>
  </div>

  <p class="muted" style="margin-top:12px;">
    This page is generated server-side via GitHub Actions. No API keys are exposed to the browser.
  </p>

  <p class="muted">
    Change detection file: <code>{OUT_LAST.as_posix()}</code>
  </p>

  <p><a href="/">Back to Reporting Forge</a></p>
</body>
</html>
"""
    OUT_HTML.write_text(html, encoding="utf-8")
    OUT_LAST.write_text(last_updated, encoding="utf-8")

    print(f"Wrote {OUT_HTML}")
    print(f"Wrote {OUT_LAST}: {last_updated}")


if __name__ == "__main__":
    main()
