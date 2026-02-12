import os
from datetime import datetime
from pathlib import Path

import pandas as pd
from fredapi import Fred

OUT_DIR = Path("monitor")
OUT_HTML = OUT_DIR / "index.html"

def main():
    api_key = os.getenv("FRED_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("Missing FRED_API_KEY env var")

    fred = Fred(api_key=api_key)
    s = fred.get_series("DFII10").dropna()
    s.index = pd.to_datetime(s.index)

    last_dt = s.index[-1].strftime("%Y-%m-%d")
    last_val = float(s.iloc[-1])

    asof = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Monitor - FRED</title>
  <style>
    body {{ font-family: Arial, Helvetica, sans-serif; margin: 18px; }}
    .card {{ border: 1px solid #ddd; border-radius: 10px; padding: 14px; max-width: 760px; }}
    .ok {{ background: #e9f7ec; }}
    .muted {{ opacity: 0.75; }}
    .k {{ opacity: 0.75; }}
    .v {{ font-weight: 700; }}
    a {{ text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
  </style>
</head>
<body>
  <h2>Monitor - FRED Smoke Test</h2>

  <div class="card ok">
    <div><span class="k">Status:</span> <span class="v">OK</span></div>
    <div><span class="k">Series:</span> <span class="v">DFII10 (10Y real yield)</span></div>
    <div><span class="k">Last datapoint:</span> <span class="v">{last_dt}</span></div>
    <div><span class="k">Last value:</span> <span class="v">{last_val:.3f}%</span></div>
    <div style="margin-top:10px;"><span class="k">Built:</span> <span class="v">{asof}</span></div>
  </div>

  <p class="muted" style="margin-top:12px;">
    This page is generated server-side via GitHub Actions. No API keys are exposed to the browser.
  </p>

  <p><a href="/">Back to Reporting Forge</a></p>
</body>
</html>
"""
    OUT_HTML.write_text(html, encoding="utf-8")
    print(f"Wrote {OUT_HTML}")

if __name__ == "__main__":
    main()
