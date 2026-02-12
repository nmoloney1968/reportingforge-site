import os
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable, Any

import pandas as pd
import yfinance as yf
from fredapi import Fred


# ----------------------------
# Config
# ----------------------------
FRED_SERIES_ID = "DFII10"

YF_TICKERS = {
    "GOLD": "GC=F",
    "NEM": "NEM",
    "GDX": "GDX",
}

MA_FAST = 50
MA_SLOW = 200
LOOKBACK_DAYS = 365 * 2  # pull 2 years for stable MAs

# Sparkline window
SPARK_DAYS_CAL = 92      # about 3 months calendar
SPARK_POINTS_MAX = 70    # keep SVG light

# Panic flush detection
PANIC_2D_DROP_PCT = 0.08  # 8% drop over 2 trading days

# Retry behavior (handles transient 502/503, network blips)
MAX_RETRIES = 6
BACKOFF_SECONDS = 2.0
BACKOFF_MULTIPLIER = 1.8

OUT_DIR = Path("monitor")
OUT_HTML = OUT_DIR / "index.html"
OUT_SIG = OUT_DIR / "monitor_signature.json"


# ----------------------------
# Helpers
# ----------------------------
def utc_now_str() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}


def write_json(path: Path, obj: dict) -> None:
    path.write_text(json.dumps(obj, indent=2, sort_keys=True), encoding="utf-8")


def retry(fn: Callable[[], Any], label: str) -> Any:
    delay = BACKOFF_SECONDS
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fn()
        except Exception as e:
            last_err = e
            msg = f"{type(e).__name__}: {e}"
            print(f"[retry] {label} failed attempt {attempt}/{MAX_RETRIES}: {msg}")
            if attempt < MAX_RETRIES:
                time.sleep(delay)
                delay *= BACKOFF_MULTIPLIER
    raise last_err


def yf_close(ticker: str, start: datetime, end: datetime) -> pd.Series:
    def _download():
        df = yf.download(
            ticker,
            start=start.date().isoformat(),
            end=end.date().isoformat(),
            auto_adjust=True,
            progress=False,
            threads=False,
        )
        return df

    df = retry(_download, f"yfinance download {ticker}")

    if df is None or df.empty:
        raise ValueError(f"No data returned for {ticker}")

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] for c in df.columns]

    s = df["Close"].dropna()
    s.index = pd.to_datetime(s.index)
    s.name = ticker
    return s


def add_mas(s: pd.Series) -> pd.DataFrame:
    df = pd.DataFrame({"value": s})
    df["ma50"] = df["value"].rolling(MA_FAST).mean()
    df["ma200"] = df["value"].rolling(MA_SLOW).mean()
    return df.dropna()


def state_price_trend(df: pd.DataFrame) -> str:
    latest = df.iloc[-1]
    v, m50, m200 = float(latest["value"]), float(latest["ma50"]), float(latest["ma200"])
    if v > m200 and m50 > m200:
        return "Green"
    if v > m200:
        return "Yellow"
    return "Red"


def state_yield_trend(df: pd.DataFrame) -> str:
    latest = df.iloc[-1]
    v, m50, m200 = float(latest["value"]), float(latest["ma50"]), float(latest["ma200"])
    # Lower real yields tend to be supportive; treat downtrend as Green.
    if m50 < m200 or v < m50:
        return "Green"
    if m50 > m200 and v > m50:
        return "Red"
    return "Yellow"


def state_ratio_trend(df: pd.DataFrame, band: float = 0.01) -> str:
    latest = df.iloc[-1]
    m50, m200 = float(latest["ma50"]), float(latest["ma200"])
    if m50 > m200 * (1 + band):
        return "Green"
    if m50 < m200 * (1 - band):
        return "Red"
    return "Yellow"


def chip_class(state: str) -> str:
    s = (state or "").lower()
    if s in ("green", "yellow", "red"):
        return s
    return "yellow"


def fmt(x: float, decimals: int = 3) -> str:
    return f"{x:,.{decimals}f}"


def pct(x: float, decimals: int = 2) -> str:
    return f"{x * 100:.{decimals}f}%"


def bps(x: float, decimals: int = 0) -> str:
    return f"{x * 100:.{decimals}f} bps"


def safe_last_two(s: pd.Series):
    s2 = s.dropna()
    if len(s2) < 2:
        return None, None
    return float(s2.iloc[-2]), float(s2.iloc[-1])


def safe_last_three(s: pd.Series):
    s2 = s.dropna()
    if len(s2) < 3:
        return None, None, None
    return float(s2.iloc[-3]), float(s2.iloc[-2]), float(s2.iloc[-1])


def spark_svg(s: pd.Series, width: int = 220, height: int = 38) -> str:
    s2 = s.dropna()
    if s2.empty:
        return ""

    if len(s2) > SPARK_POINTS_MAX:
        s2 = s2.iloc[:: max(1, len(s2) // SPARK_POINTS_MAX)]

    vals = s2.values.astype(float)
    vmin = float(vals.min())
    vmax = float(vals.max())
    if vmax == vmin:
        vmax = vmin + 1e-9

    n = len(vals)
    pts = []
    for i, v in enumerate(vals):
        x = (i / (n - 1)) * (width - 2) + 1 if n > 1 else width / 2
        y = (1 - (v - vmin) / (vmax - vmin)) * (height - 2) + 1
        pts.append(f"{x:.1f},{y:.1f}")

    points = " ".join(pts)
    return f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="trend sparkline"><polyline fill="none" stroke="#666" stroke-width="2" points="{points}"></polyline></svg>'


def overall_state(states: list[str]) -> str:
    reds = sum(1 for s in states if s == "Red")
    yellows = sum(1 for s in states if s == "Yellow")
    if reds >= 2:
        return "Red"
    if reds == 1 or yellows >= 1:
        return "Yellow"
    return "Green"


def interpret(overall: str, st_gold: str, st_yield: str, st_nem_gold: str, st_gdx_gold: str) -> str:
    parts = []
    parts.append("Gold trend supportive" if st_gold == "Green" else "Gold trend mixed" if st_gold == "Yellow" else "Gold trend deteriorating")
    parts.append("real yields supportive" if st_yield == "Green" else "real yields mixed" if st_yield == "Yellow" else "real yields headwind")

    outperf = []
    if st_nem_gold == "Green":
        outperf.append("NEM")
    if st_gdx_gold == "Green":
        outperf.append("GDX")
    parts.append("miners outperforming gold (" + ", ".join(outperf) + ")" if outperf else "miners not clearly outperforming gold")

    lead = {"Green": "Overall tailwinds.", "Yellow": "Overall mixed regime.", "Red": "Overall headwinds."}.get(overall, "Overall mixed regime.")
    return lead + " " + "; ".join(parts) + "."


def html_page(payload: dict) -> str:
    built_utc = payload["built_utc"]
    fred_last_updated = payload["fred_last_updated"]
    overall = payload["overall"]
    interpretation = payload["interpretation"]
    panic = payload["panic"]
    tiles = payload["tiles"]
    rows = payload["rows"]

    def tile_html(t):
        spark = t.get("spark", "")
        delta = t.get("delta", "")
        delta2 = t.get("delta2", "")
        extra = ""
        if delta or delta2:
            extra = f'<div class="tile-delta">{delta} {delta2}</div>'
        return f"""
        <div class="tile {chip_class(t["state"])}">
          <div class="tile-name">{t["name"]}</div>
          <div class="tile-state">{t["state"]}</div>
          <div class="tile-value">{t["value"]}</div>
          {extra}
          <div class="tile-sub">{t["sub"]}</div>
          <div class="tile-spark">{spark}</div>
        </div>
        """

    tile_block = "\n".join(tile_html(t) for t in tiles)

    row_html = ""
    for r in rows:
        row_html += f"""
        <tr>
          <td>{r["metric"]}</td>
          <td><span class="chip {chip_class(r["state"])}">{r["state"]}</span></td>
          <td>{r["last_date"]}</td>
          <td class="num">{r["last_value"]}</td>
          <td class="num">{r["ma50"]}</td>
          <td class="num">{r["ma200"]}</td>
        </tr>
        """

    panic_line = ""
    if panic["on"]:
        panic_line = f"""
        <div class="card warn">
          <div style="font-weight:800;">Panic flush: ON</div>
          <div class="muted" style="margin-top:6px;">
            Triggered by {panic["trigger"]}. This highlights fast selloffs while gold regime is not Red.
          </div>
        </div>
        """
    else:
        panic_line = """
        <div class="card ok">
          <div style="font-weight:800;">Panic flush: OFF</div>
          <div class="muted" style="margin-top:6px;">
            No fast selloff trigger detected.
          </div>
        </div>
        """

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Monitor</title>
  <style>
    body {{ font-family: Arial, Helvetica, sans-serif; margin: 18px; }}
    .muted {{ opacity: 0.75; }}
    .top {{ margin-bottom: 12px; max-width: 1160px; }}
    .grid {{ display: flex; gap: 12px; flex-wrap: wrap; }}
    .tile {{
      width: 260px;
      border: 1px solid #ddd;
      border-radius: 10px;
      padding: 12px;
    }}
    .tile-name {{ font-size: 13px; opacity: 0.8; }}
    .tile-state {{ font-size: 18px; font-weight: 800; margin-top: 6px; }}
    .tile-value {{ font-size: 16px; margin-top: 4px; font-weight: 700; }}
    .tile-delta {{ font-size: 12px; margin-top: 6px; opacity: 0.85; }}
    .tile-sub {{ font-size: 12px; opacity: 0.75; margin-top: 4px; }}
    .tile-spark {{ margin-top: 10px; }}

    .green {{ background: #e9f7ec; }}
    .yellow {{ background: #fff7df; }}
    .red {{ background: #fdeaea; }}

    .chip {{
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid #ddd;
      font-weight: 700;
      font-size: 12px;
    }}

    .card {{
      border: 1px solid #ddd;
      border-radius: 10px;
      padding: 12px;
      max-width: 1160px;
      margin-top: 12px;
    }}
    .card.ok {{ background: #e9f7ec; }}
    .card.warn {{ background: #fff7df; }}

    table {{
      border-collapse: collapse;
      width: 100%;
      max-width: 1160px;
      margin-top: 14px;
    }}
    th, td {{
      border: 1px solid #ddd;
      padding: 8px 10px;
      font-size: 13px;
    }}
    th {{ background: #f6f6f6; text-align: left; }}
    td.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
    a {{ text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    code {{ background: #f5f5f5; padding: 2px 6px; border-radius: 6px; }}
  </style>
</head>
<body>
  <div class="top">
    <h2 style="margin:0;">Monitor</h2>
    <div class="muted">Built: <b>{built_utc}</b></div>
    <div class="muted">FRED last_updated (DFII10): <b>{fred_last_updated}</b></div>
  </div>

  <div class="card {chip_class(overall)}">
    <div style="font-weight:800; font-size:16px;">Overall: {overall}</div>
    <div class="muted" style="margin-top:6px;">{interpretation}</div>
  </div>

  {panic_line}

  <div class="grid">
    {tile_block}
  </div>

  <table>
    <thead>
      <tr>
        <th>Metric</th>
        <th>State</th>
        <th>Last date</th>
        <th>Last value</th>
        <th>MA50</th>
        <th>MA200</th>
      </tr>
    </thead>
    <tbody>
      {row_html}
    </tbody>
  </table>

  <div class="card">
    <div class="muted">
      Source: FRED (DFII10) and Yahoo Finance via yfinance (GC=F, NEM, GDX). No API keys are exposed to the browser.
    </div>
    <div class="muted" style="margin-top:8px;">
      Repo outputs: <code>monitor/index.html</code> and <code>monitor/monitor_signature.json</code>
    </div>
    <div style="margin-top:10px;">
      <a href="/">Back to Reporting Forge</a>
    </div>
  </div>
</body>
</html>
"""


def main():
    api_key = os.getenv("FRED_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("Missing FRED_API_KEY env var")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Pull FRED with retries
    fred = Fred(api_key=api_key)

    def _series_info():
        return fred.get_series_info(FRED_SERIES_ID)

    info = retry(_series_info, "FRED get_series_info")

    fred_last_updated = ""
    if isinstance(info, pd.DataFrame) and "last_updated" in info.index:
        fred_last_updated = str(info.loc["last_updated"].values[0]).strip()
    elif isinstance(info, pd.Series) and "last_updated" in info.index:
        fred_last_updated = str(info["last_updated"]).strip()
    if not fred_last_updated:
        fred_last_updated = "unknown"

    def _get_series():
        return fred.get_series(FRED_SERIES_ID)

    s_yield = retry(_get_series, "FRED get_series").dropna()
    s_yield.index = pd.to_datetime(s_yield.index)
    df_yield = add_mas(s_yield)

    # Pull Yahoo series
    end = datetime.utcnow()
    start = end - timedelta(days=LOOKBACK_DAYS)

    s_gold = yf_close(YF_TICKERS["GOLD"], start, end)
    s_nem = yf_close(YF_TICKERS["NEM"], start, end)
    s_gdx = yf_close(YF_TICKERS["GDX"], start, end)

    # Align on common dates for ratios
    common = s_gold.index.intersection(s_nem.index).intersection(s_gdx.index)
    s_gold_c = s_gold.loc[common]
    s_nem_c = s_nem.loc[common]
    s_gdx_c = s_gdx.loc[common]

    s_nem_gold = (s_nem_c / s_gold_c).dropna()
    s_gdx_gold = (s_gdx_c / s_gold_c).dropna()

    df_gold = add_mas(s_gold)
    df_nem_gold = add_mas(s_nem_gold)
    df_gdx_gold = add_mas(s_gdx_gold)

    # States
    st_gold = state_price_trend(df_gold)
    st_yield = state_yield_trend(df_yield)
    st_nem_gold = state_ratio_trend(df_nem_gold)
    st_gdx_gold = state_ratio_trend(df_gdx_gold)

    overall = overall_state([st_gold, st_yield, st_nem_gold, st_gdx_gold])
    interpretation = interpret(overall, st_gold, st_yield, st_nem_gold, st_gdx_gold)

    # Deltas
    gold_prev, gold_last = safe_last_two(s_gold)
    y_prev, y_last = safe_last_two(s_yield)
    nemg_prev, nemg_last = safe_last_two(s_nem_gold)
    gdxg_prev, gdxg_last = safe_last_two(s_gdx_gold)

    nem_2ago, _, nem_now = safe_last_three(s_nem)
    gdx_2ago, _, gdx_now = safe_last_three(s_gdx)

    def pct_delta(prev, last):
        if prev is None or last is None or prev == 0:
            return ""
        return pct((last / prev) - 1.0, 2)

    def bps_delta(prev, last):
        if prev is None or last is None:
            return ""
        return bps(last - prev, 0)

    def pct_2d(two_ago, now):
        if two_ago is None or now is None or two_ago == 0:
            return ""
        return pct((now / two_ago) - 1.0, 2)

    nem_2d = pct_2d(nem_2ago, nem_now)
    gdx_2d = pct_2d(gdx_2ago, gdx_now)

    # Panic flush detector
    panic_on = False
    panic_trigger = ""

    def is_big_drop(two_ago, now, thresh):
        if two_ago is None or now is None or two_ago == 0:
            return False
        return (now / two_ago) <= (1.0 - thresh)

    if st_gold != "Red":
        if is_big_drop(nem_2ago, nem_now, PANIC_2D_DROP_PCT):
            panic_on = True
            panic_trigger = f"NEM 2D drop {nem_2d}"
        elif is_big_drop(gdx_2ago, gdx_now, PANIC_2D_DROP_PCT):
            panic_on = True
            panic_trigger = f"GDX 2D drop {gdx_2d}"

    panic = {"on": panic_on, "trigger": panic_trigger}

    # Sparkline series (last 3 months)
    cutoff = datetime.utcnow() - timedelta(days=SPARK_DAYS_CAL)

    def tail_since(s: pd.Series) -> pd.Series:
        s2 = s.dropna()
        return s2[s2.index >= pd.to_datetime(cutoff)]

    spark_gold = spark_svg(tail_since(s_gold))
    spark_yield = spark_svg(tail_since(s_yield))
    spark_nemg = spark_svg(tail_since(s_nem_gold))
    spark_gdxg = spark_svg(tail_since(s_gdx_gold))

    # Signature (exclude built time from comparison)
    sig = {
        "built_at_utc": utc_now_str(),
        "fred": {
            "series": FRED_SERIES_ID,
            "last_updated": fred_last_updated,
            "last_obs_date": str(df_yield.index[-1].date()),
            "last_obs_value": float(df_yield["value"].iloc[-1]),
        },
        "yahoo": {
            "gold_ticker": YF_TICKERS["GOLD"],
            "nem_ticker": YF_TICKERS["NEM"],
            "gdx_ticker": YF_TICKERS["GDX"],
            "gold_last_date": str(df_gold.index[-1].date()),
            "gold_last_value": float(df_gold["value"].iloc[-1]),
            "nem_last_date": str(s_nem.index[-1].date()),
            "nem_last_value": float(s_nem.iloc[-1]),
            "gdx_last_date": str(s_gdx.index[-1].date()),
            "gdx_last_value": float(s_gdx.iloc[-1]),
        },
        "states": {
            "overall": overall,
            "gold": st_gold,
            "dfii10": st_yield,
            "nem_gold": st_nem_gold,
            "gdx_gold": st_gdx_gold,
            "panic_flush": panic,
        },
    }

    prev_sig = read_json(OUT_SIG)

    def stable_sig(d: dict) -> dict:
        x = dict(d) if isinstance(d, dict) else {}
        x.pop("built_at_utc", None)
        return x

    if OUT_HTML.exists() and prev_sig and stable_sig(prev_sig) == stable_sig(sig):
        print("No meaningful change detected. Skipping HTML write.")
        return

    built_utc = utc_now_str()

    def row(metric: str, state: str, df: pd.DataFrame, unit: str = "") -> dict:
        latest = df.iloc[-1]
        return {
            "metric": metric,
            "state": state,
            "last_date": str(df.index[-1].date()),
            "last_value": fmt(float(latest["value"])) + unit,
            "ma50": fmt(float(latest["ma50"])) + unit,
            "ma200": fmt(float(latest["ma200"])) + unit,
        }

    rows = [
        row("Gold (GC=F)", st_gold, df_gold),
        row("10Y real yield (DFII10)", st_yield, df_yield, "%"),
        row("NEM/Gold ratio", st_nem_gold, df_nem_gold),
        row("GDX/Gold ratio", st_gdx_gold, df_gdx_gold),
    ]

    tiles = [
        {
            "name": "Gold trend",
            "state": st_gold,
            "value": fmt(float(df_gold["value"].iloc[-1])),
            "delta": f"1D: {pct_delta(gold_prev, gold_last)}" if gold_prev is not None else "",
            "delta2": "",
            "sub": f'GC=F close, {df_gold.index[-1].date()}',
            "spark": spark_gold,
        },
        {
            "name": "Real yield trend",
            "state": st_yield,
            "value": fmt(float(df_yield["value"].iloc[-1])) + "%",
            "delta": f"chg: {bps_delta(y_prev, y_last)}" if y_prev is not None else "",
            "delta2": "",
            "sub": f"DFII10, {df_yield.index[-1].date()}",
            "spark": spark_yield,
        },
        {
            "name": "NEM/Gold ratio",
            "state": st_nem_gold,
            "value": fmt(float(df_nem_gold["value"].iloc[-1])),
            "delta": f"1D: {pct_delta(nemg_prev, nemg_last)}" if nemg_prev is not None else "",
            "delta2": f"2D NEM: {pct_2d(nem_2ago, nem_now)}" if nem_2ago is not None else "",
            "sub": f"{df_nem_gold.index[-1].date()}",
            "spark": spark_nemg,
        },
        {
            "name": "GDX/Gold ratio",
            "state": st_gdx_gold,
            "value": fmt(float(df_gdx_gold["value"].iloc[-1])),
            "delta": f"1D: {pct_delta(gdxg_prev, gdxg_last)}" if gdxg_prev is not None else "",
            "delta2": f"2D GDX: {pct_2d(gdx_2ago, gdx_now)}" if gdx_2ago is not None else "",
            "sub": f"{df_gdx_gold.index[-1].date()}",
            "spark": spark_gdxg,
        },
    ]

    payload = {
        "built_utc": built_utc,
        "fred_last_updated": fred_last_updated,
        "overall": overall,
        "interpretation": interpretation,
        "panic": panic,
        "tiles": tiles,
        "rows": rows,
    }

    OUT_HTML.write_text(html_page(payload), encoding="utf-8")
    write_json(OUT_SIG, sig)

    print(f"Wrote {OUT_HTML}")
    print(f"Wrote {OUT_SIG}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # If something still goes wrong, do not delete/overwrite the existing monitor page.
        print(f"Monitor build failed: {type(e).__name__}: {e}")
        if OUT_HTML.exists():
            print("Keeping existing monitor/index.html unchanged.")
            raise SystemExit(0)
        raise
