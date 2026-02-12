import os
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable, Any, Optional, Tuple

import pandas as pd
import yfinance as yf
from fredapi import Fred


# ----------------------------
# Config
# ----------------------------
TEMPLATE_VERSION = "v4-dark-fred-fallback-dxy-wti-rficon-2026-02-13"

# FRED fallback chain for "real yields"
# First one that successfully fetches wins.
FRED_REAL_YIELD_SERIES = [
    ("DFII10", "10Y real yield (DFII10)"),
    ("DFII5", "5Y real yield (DFII5)"),
]

YF_TICKERS = {
    "GOLD": ("GC=F", "Gold (GC=F)"),
    "NEM": ("NEM", "NEM"),
    "GDX": ("GDX", "GDX"),
    "DXY": ("DX-Y.NYB", "DXY (DX-Y.NYB)"),
    "WTI": ("CL=F", "WTI (CL=F)"),
}

MA_FAST = 50
MA_SLOW = 200
LOOKBACK_DAYS = 365 * 2

# Sparkline window
SPARK_DAYS_CAL = 92
SPARK_POINTS_MAX = 80

# Panic flush detection
PANIC_2D_DROP_PCT = 0.08

# Retry behavior
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
        return yf.download(
            ticker,
            start=start.date().isoformat(),
            end=end.date().isoformat(),
            auto_adjust=True,
            progress=False,
            threads=False,
        )

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


def state_inverse_price_trend(df: pd.DataFrame) -> str:
    """
    For variables that are headwinds when rising (DXY, WTI):
    - Downtrend is supportive (Green)
    - Uptrend is headwind (Red)
    """
    latest = df.iloc[-1]
    v, m50, m200 = float(latest["value"]), float(latest["ma50"]), float(latest["ma200"])
    if v > m200 and m50 > m200:
        return "Red"
    if v > m200:
        return "Yellow"
    return "Green"


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


def spark_svg(s: pd.Series, width: int = 240, height: int = 44) -> str:
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
    return (
        f'<svg class="spark" width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
        f'role="img" aria-label="trend sparkline">'
        f'<polyline fill="none" stroke="currentColor" stroke-width="2" points="{points}"></polyline>'
        f"</svg>"
    )


def overall_state(states: list[str]) -> str:
    reds = sum(1 for s in states if s == "Red")
    yellows = sum(1 for s in states if s == "Yellow")
    if reds >= 2:
        return "Red"
    if reds == 1 or yellows >= 1:
        return "Yellow"
    return "Green"


def interpret(overall: str, bullets: list[str]) -> str:
    lead = {"Green": "Overall tailwinds.", "Yellow": "Overall mixed regime.", "Red": "Overall headwinds."}.get(
        overall, "Overall mixed regime."
    )
    return lead + " " + "; ".join(bullets) + "."


def fetch_first_working_fred_series(
    fred: Fred,
    series_options: list[Tuple[str, str]],
) -> Tuple[str, str, pd.Series, str]:
    last_err: Optional[Exception] = None

    for series_id, label in series_options:
        try:
            info = retry(lambda: fred.get_series_info(series_id), f"FRED get_series_info {series_id}")
            last_updated = "unknown"
            if isinstance(info, pd.DataFrame) and "last_updated" in info.index:
                last_updated = str(info.loc["last_updated"].values[0]).strip()
            elif isinstance(info, pd.Series) and "last_updated" in info.index:
                last_updated = str(info["last_updated"]).strip()

            series = retry(lambda: fred.get_series(series_id), f"FRED get_series {series_id}")
            series = series.dropna()
            series.index = pd.to_datetime(series.index)

            if series.empty:
                raise ValueError(f"{series_id} returned empty series")

            return series_id, label, series, last_updated
        except Exception as e:
            last_err = e
            print(f"[fred-fallback] {series_id} failed: {type(e).__name__}: {e}")

    raise last_err if last_err else RuntimeError("All FRED fallback series failed")


def html_page(payload: dict) -> str:
    built_utc = payload["built_utc"]
    fred_last_updated = payload["fred_last_updated"]
    fred_series_label = payload["fred_series_label"]
    overall = payload["overall"]
    interpretation = payload["interpretation"]
    panic = payload["panic"]
    tiles = payload["tiles"]
    rows = payload["rows"]
    favicon_q = payload.get("favicon_q", TEMPLATE_VERSION)

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

    if panic["on"]:
        panic_line = f"""
        <div class="card warn">
          <div class="card-title">Panic flush: ON</div>
          <div class="muted" style="margin-top:6px;">
            Triggered by {panic["trigger"]}. This highlights fast selloffs while gold regime is not Red.
          </div>
        </div>
        """
    else:
        panic_line = """
        <div class="card ok">
          <div class="card-title">Panic flush: OFF</div>
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
  <link rel="icon" type="image/svg+xml" href="../favicon.svg?v={favicon_q}">
  <link rel="apple-touch-icon" href="../favicon.svg?v={favicon_q}">
  <style>
    :root {{
      color-scheme: dark;
      --bg: #0b0f14;
      --panel: #121824;
      --panel2: #0f1520;
      --text: #e8eef7;
      --muted: rgba(232, 238, 247, 0.72);
      --border: rgba(232, 238, 247, 0.14);

      --greenBg: rgba(46, 204, 113, 0.12);
      --yellowBg: rgba(241, 196, 15, 0.12);
      --redBg: rgba(255, 107, 107, 0.12);

      --greenTx: #7dffb3;
      --yellowTx: #ffe08a;
      --redTx: #ff9b9b;
      --link: #7cc4ff;
    }}

    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }}

    .wrap {{
      max-width: 1160px;
      margin: 0 auto;
      padding: 18px 16px 36px 16px;
    }}

    .topbar {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }}

    .brand {{
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text);
      text-decoration: none;
    }}

    .brand:hover {{
      text-decoration: none;
      opacity: 0.95;
    }}

    .brand-icon {{
      width: 28px;
      height: 28px;
      border-radius: 6px;
    }}

    .brand-text {{
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 0.2px;
      line-height: 1;
    }}

    .topmeta {{
      display: flex;
      flex-direction: column;
      gap: 4px;
    }}

    @media (max-width: 719px) {{
      .brand-text {{ font-size: 24px; }}
      .brand-icon {{ width: 26px; height: 26px; }}
    }}

    .muted {{
      opacity: 1;
      color: var(--muted);
    }}

    .grid {{
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 12px;
      margin-top: 12px;
    }}

    .tile {{
      grid-column: span 12;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px;
      min-height: 150px;
    }}

    @media (min-width: 720px) {{
      .tile {{ grid-column: span 3; }}
      .card {{ grid-column: span 12; }}
      .tablewrap {{ grid-column: span 12; }}
    }}

    @media (max-width: 719px) {{
      .tile {{ grid-column: span 12; }}
    }}

    .tile-name {{
      font-size: 13px;
      color: var(--muted);
    }}

    .tile-state {{
      font-size: 20px;
      font-weight: 800;
      margin-top: 8px;
    }}

    .tile-value {{
      font-size: 18px;
      font-weight: 800;
      margin-top: 6px;
    }}

    .tile-delta {{
      font-size: 12px;
      margin-top: 8px;
      color: var(--muted);
    }}

    .tile-sub {{
      font-size: 12px;
      margin-top: 6px;
      color: var(--muted);
    }}

    .tile-spark {{
      margin-top: 10px;
      color: rgba(232, 238, 247, 0.55);
    }}

    .spark {{
      display: block;
      width: 100%;
      height: 46px;
    }}

    .green {{ background: linear-gradient(0deg, var(--greenBg), var(--greenBg)), var(--panel); }}
    .yellow {{ background: linear-gradient(0deg, var(--yellowBg), var(--yellowBg)), var(--panel); }}
    .red {{ background: linear-gradient(0deg, var(--redBg), var(--redBg)), var(--panel); }}

    .green .tile-state {{ color: var(--greenTx); }}
    .yellow .tile-state {{ color: var(--yellowTx); }}
    .red .tile-state {{ color: var(--redTx); }}

    .chip {{
      display: inline-block;
      padding: 4px 9px;
      border-radius: 999px;
      border: 1px solid var(--border);
      font-weight: 800;
      font-size: 12px;
      background: var(--panel2);
    }}

    .chip.green {{ color: var(--greenTx); }}
    .chip.yellow {{ color: var(--yellowTx); }}
    .chip.red {{ color: var(--redTx); }}

    .card {{
      grid-column: span 12;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px;
    }}

    .card-title {{
      font-weight: 900;
      font-size: 16px;
    }}

    .card.ok {{ background: linear-gradient(0deg, var(--greenBg), var(--greenBg)), var(--panel); }}
    .card.warn {{ background: linear-gradient(0deg, var(--yellowBg), var(--yellowBg)), var(--panel); }}

    .tablewrap {{
      grid-column: span 12;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 10px;
      overflow-x: auto;
    }}

    table {{
      border-collapse: collapse;
      width: 100%;
      min-width: 860px;
    }}

    th, td {{
      border-bottom: 1px solid var(--border);
      padding: 10px 10px;
      font-size: 13px;
    }}

    th {{
      text-align: left;
      color: var(--muted);
      font-weight: 800;
    }}

    td.num {{
      text-align: right;
      font-variant-numeric: tabular-nums;
    }}

    a {{
      color: var(--link);
      text-decoration: none;
    }}

    a:hover {{
      text-decoration: underline;
    }}

    code {{
      background: rgba(255,255,255,0.06);
      padding: 2px 6px;
      border-radius: 8px;
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <a class="brand" href="/" title="Reporting Forge">
        <img src="../favicon.svg?v={favicon_q}" alt="RF" class="brand-icon">
        <span class="brand-text">Monitor</span>
      </a>
      <div class="topmeta">
        <div class="muted">Built: <b>{built_utc}</b></div>
        <div class="muted">FRED last_updated ({fred_series_label}): <b>{fred_last_updated}</b></div>
      </div>
    </div>

    <div class="grid">
      <div class="card {chip_class(overall)}">
        <div class="card-title">Overall: {overall}</div>
        <div class="muted" style="margin-top:6px;">{interpretation}</div>
      </div>

      {panic_line}

      {tile_block}

      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>State</th>
              <th>Last date</th>
              <th class="num">Last value</th>
              <th class="num">MA50</th>
              <th class="num">MA200</th>
            </tr>
          </thead>
          <tbody>
            {row_html}
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="muted">
          Source: FRED (real yields) and Yahoo Finance via yfinance (GC=F, NEM, GDX, DX-Y.NYB, CL=F). No API keys are exposed to the browser.
        </div>
        <div class="muted" style="margin-top:8px;">
          Repo outputs: <code>monitor/index.html</code> and <code>monitor/monitor_signature.json</code>
        </div>
        <div style="margin-top:10px;">
          <a href="/">Back to Reporting Forge</a>
        </div>
      </div>
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

    # FRED with fallback series
    fred = Fred(api_key=api_key)
    fred_series_id, fred_series_label, s_yield, fred_last_updated = fetch_first_working_fred_series(
        fred, FRED_REAL_YIELD_SERIES
    )
    df_yield = add_mas(s_yield)

    # Yahoo
    end = datetime.utcnow()
    start = end - timedelta(days=LOOKBACK_DAYS)

    s_gold = yf_close(YF_TICKERS["GOLD"][0], start, end)
    s_nem = yf_close(YF_TICKERS["NEM"][0], start, end)
    s_gdx = yf_close(YF_TICKERS["GDX"][0], start, end)
    s_dxy = yf_close(YF_TICKERS["DXY"][0], start, end)
    s_wti = yf_close(YF_TICKERS["WTI"][0], start, end)

    # Ratios
    common = s_gold.index.intersection(s_nem.index).intersection(s_gdx.index)
    s_gold_c = s_gold.loc[common]
    s_nem_c = s_nem.loc[common]
    s_gdx_c = s_gdx.loc[common]
    s_nem_gold = (s_nem_c / s_gold_c).dropna()
    s_gdx_gold = (s_gdx_c / s_gold_c).dropna()

    df_gold = add_mas(s_gold)
    df_nem_gold = add_mas(s_nem_gold)
    df_gdx_gold = add_mas(s_gdx_gold)
    df_dxy = add_mas(s_dxy)
    df_wti = add_mas(s_wti)

    # States
    st_gold = state_price_trend(df_gold)
    st_yield = state_yield_trend(df_yield)
    st_nem_gold = state_ratio_trend(df_nem_gold)
    st_gdx_gold = state_ratio_trend(df_gdx_gold)
    st_dxy = state_inverse_price_trend(df_dxy)
    st_wti = state_inverse_price_trend(df_wti)

    overall = overall_state([st_gold, st_yield, st_nem_gold, st_gdx_gold, st_dxy, st_wti])

    bullets = []
    bullets.append("Gold trend supportive" if st_gold == "Green" else "Gold trend mixed" if st_gold == "Yellow" else "Gold trend deteriorating")
    bullets.append("real yields supportive" if st_yield == "Green" else "real yields mixed" if st_yield == "Yellow" else "real yields headwind")
    bullets.append("miners outperforming gold (NEM, GDX)" if (st_nem_gold == "Green" and st_gdx_gold == "Green") else "miners not uniformly outperforming gold")
    bullets.append("USD headwind easing" if st_dxy == "Green" else "USD mixed" if st_dxy == "Yellow" else "USD headwind strengthening")
    bullets.append("oil cost pressure easing" if st_wti == "Green" else "oil mixed" if st_wti == "Yellow" else "oil cost pressure rising")

    interpretation = interpret(overall, bullets)

    # Deltas
    gold_prev, gold_last = safe_last_two(s_gold)
    y_prev, y_last = safe_last_two(s_yield)
    nemg_prev, nemg_last = safe_last_two(s_nem_gold)
    gdxg_prev, gdxg_last = safe_last_two(s_gdx_gold)
    dxy_prev, dxy_last = safe_last_two(s_dxy)
    wti_prev, wti_last = safe_last_two(s_wti)

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

    # Panic flush
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

    # Sparklines
    cutoff = datetime.utcnow() - timedelta(days=SPARK_DAYS_CAL)

    def tail_since(s: pd.Series) -> pd.Series:
        s2 = s.dropna()
        return s2[s2.index >= pd.to_datetime(cutoff)]

    spark_gold = spark_svg(tail_since(s_gold))
    spark_yield = spark_svg(tail_since(s_yield))
    spark_nemg = spark_svg(tail_since(s_nem_gold))
    spark_gdxg = spark_svg(tail_since(s_gdx_gold))
    spark_dxy = spark_svg(tail_since(s_dxy))
    spark_wti = spark_svg(tail_since(s_wti))

    sig = {
        "template_version": TEMPLATE_VERSION,
        "built_at_utc": utc_now_str(),
        "fred": {
            "series_used": fred_series_id,
            "series_label": fred_series_label,
            "last_updated": fred_last_updated,
            "last_obs_date": str(df_yield.index[-1].date()),
            "last_obs_value": float(df_yield["value"].iloc[-1]),
        },
        "yahoo": {
            "gold_ticker": YF_TICKERS["GOLD"][0],
            "nem_ticker": YF_TICKERS["NEM"][0],
            "gdx_ticker": YF_TICKERS["GDX"][0],
            "dxy_ticker": YF_TICKERS["DXY"][0],
            "wti_ticker": YF_TICKERS["WTI"][0],
            "gold_last_date": str(df_gold.index[-1].date()),
            "gold_last_value": float(df_gold["value"].iloc[-1]),
            "dxy_last_date": str(df_dxy.index[-1].date()),
            "wti_last_date": str(df_wti.index[-1].date()),
        },
        "states": {
            "overall": overall,
            "gold": st_gold,
            "real_yield": st_yield,
            "nem_gold": st_nem_gold,
            "gdx_gold": st_gdx_gold,
            "dxy": st_dxy,
            "wti": st_wti,
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
        row(YF_TICKERS["GOLD"][1], st_gold, df_gold),
        row(fred_series_label, st_yield, df_yield, "%"),
        row("NEM/Gold ratio", st_nem_gold, df_nem_gold),
        row("GDX/Gold ratio", st_gdx_gold, df_gdx_gold),
        row(YF_TICKERS["DXY"][1], st_dxy, df_dxy),
        row(YF_TICKERS["WTI"][1], st_wti, df_wti),
    ]

    tiles = [
        {
            "name": "Gold trend",
            "state": st_gold,
            "value": fmt(float(df_gold["value"].iloc[-1])),
            "delta": f"1D: {pct_delta(gold_prev, gold_last)}" if gold_prev is not None else "",
            "delta2": "",
            "sub": f"{YF_TICKERS['GOLD'][0]} close, {df_gold.index[-1].date()}",
            "spark": spark_gold,
        },
        {
            "name": "Real yield trend",
            "state": st_yield,
            "value": fmt(float(df_yield["value"].iloc[-1])) + "%",
            "delta": f"chg: {bps_delta(y_prev, y_last)}" if y_prev is not None else "",
            "delta2": fred_series_id,
            "sub": f"{fred_series_label}, {df_yield.index[-1].date()}",
            "spark": spark_yield,
        },
        {
            "name": "NEM/Gold ratio",
            "state": st_nem_gold,
            "value": fmt(float(df_nem_gold["value"].iloc[-1])),
            "delta": f"1D: {pct_delta(nemg_prev, nemg_last)}" if nemg_prev is not None else "",
            "delta2": f"2D NEM: {nem_2d}" if nem_2ago is not None else "",
            "sub": f"{df_nem_gold.index[-1].date()}",
            "spark": spark_nemg,
        },
        {
            "name": "GDX/Gold ratio",
            "state": st_gdx_gold,
            "value": fmt(float(df_gdx_gold["value"].iloc[-1])),
            "delta": f"1D: {pct_delta(gdxg_prev, gdxg_last)}" if gdxg_prev is not None else "",
            "delta2": f"2D GDX: {gdx_2d}" if gdx_2ago is not None else "",
            "sub": f"{df_gdx_gold.index[-1].date()}",
            "spark": spark_gdxg,
        },
        {
            "name": "DXY (USD headwind)",
            "state": st_dxy,
            "value": fmt(float(df_dxy["value"].iloc[-1])),
            "delta": f"1D: {pct_delta(dxy_prev, dxy_last)}" if dxy_prev is not None else "",
            "delta2": "",
            "sub": f"{YF_TICKERS['DXY'][0]} close, {df_dxy.index[-1].date()}",
            "spark": spark_dxy,
        },
        {
            "name": "WTI (cost proxy)",
            "state": st_wti,
            "value": fmt(float(df_wti["value"].iloc[-1])),
            "delta": f"1D: {pct_delta(wti_prev, wti_last)}" if wti_prev is not None else "",
            "delta2": "",
            "sub": f"{YF_TICKERS['WTI'][0]} close, {df_wti.index[-1].date()}",
            "spark": spark_wti,
        },
    ]

    payload = {
        "built_utc": built_utc,
        "fred_last_updated": fred_last_updated,
        "fred_series_label": fred_series_label,
        "overall": overall,
        "interpretation": interpretation,
        "panic": panic,
        "tiles": tiles,
        "rows": rows,
        "favicon_q": TEMPLATE_VERSION,
    }

    OUT_HTML.write_text(html_page(payload), encoding="utf-8")
    write_json(OUT_SIG, sig)

    print(f"Wrote {OUT_HTML}")
    print(f"Wrote {OUT_SIG}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Monitor build failed: {type(e).__name__}: {e}")
        if OUT_HTML.exists():
            print("Keeping existing monitor/index.html unchanged.")
            raise SystemExit(0)
        raise
