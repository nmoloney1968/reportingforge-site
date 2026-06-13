# World Cup 2026 Results Worker - schedule-aware polling

This Worker serves dynamic results for:

```text
https://reportingforge.com/worldcup2026schedule/results.json
```

It uses the free `worldcup26.ir/get/games` endpoint. No football API key is required.

## What changed from the simple Worker

The cron runs every 5 minutes, but the Worker **does not call the source API every time**. It calls `worldcup26.ir/get/games` only when the current UTC time matches an approved polling slot based on the 72 group-stage fixtures.

Polling rules:

- Every group-stage match is checked every 5 minutes from kickoff through kickoff +120 minutes.
- Each match also gets post-match checks at kickoff +125, +135, +150 and +180 minutes.
- There is no separate Germany-game polling rule; all matches use the same 5-minute in-window cadence.
- One request to `https://worldcup26.ir/get/games` fetches the full World Cup feed and updates all visible matches.
- A daily usage counter is kept for visibility, but scheduled polling is no longer capped at 90 calls per UTC day.
- If the source fetch fails, the last successful result payload stays in KV and continues to be served to the page.
- Live matches include a cleaned `elapsed` field when `worldcup26.ir` provides useful `time_elapsed` data, such as `67'`, `45+2'`, or `HT`; finished and not-started timing values are omitted.

The cron still runs every 5 minutes, but source requests are made only inside match polling windows and post-match check slots. Scheduled source calls wait until +23 seconds after the 5-minute boundary before calling `https://worldcup26.ir/get/games`, which avoids the obvious high-traffic boundary.

## Files

```text
worldcup-results-worker/
  src/index.js
  package.json
  wrangler.toml
  README.md
```

## Setup

From this folder:

```powershell
Set-Location "G:\My Drive\SE Asia Trip\E-Book - SME Reporting\reportingforge-site\worldcup-results-worker"; npm install
```

Login if needed:

```powershell
Set-Location "G:\My Drive\SE Asia Trip\E-Book - SME Reporting\reportingforge-site\worldcup-results-worker"; npx wrangler login
```

The existing KV binding is `RESULTS`; keep the namespace ID from `wrangler.toml`.

Add the manual refresh secret. Do not commit this value.

```powershell
Set-Location "G:\My Drive\SE Asia Trip\E-Book - SME Reporting\reportingforge-site\worldcup-results-worker"; npx wrangler secret put ADMIN_TOKEN
```

Deploy:

```powershell
Set-Location "G:\My Drive\SE Asia Trip\E-Book - SME Reporting\reportingforge-site\worldcup-results-worker"; npx wrangler deploy
```

Then add this narrow route in Cloudflare if you did not deploy it through `wrangler.toml`:

```text
reportingforge.com/worldcup2026schedule/results.json*
```

## Endpoints

Public page data:

```text
https://reportingforge.com/worldcup2026schedule/results.json
```

Manual refresh:

```text
https://reportingforge.com/worldcup2026schedule/results.json/refresh?token=YOUR_ADMIN_TOKEN
```

Status/debug:

```text
https://reportingforge.com/worldcup2026schedule/results.json/status
```

## Notes

- No worldcup26.ir key is needed; `APISPORTS_KEY` is ignored.
- `ADMIN_TOKEN` is your private manual-refresh token.
- The route should stay narrow. Do not route the Worker to `reportingforge.com/worldcup2026schedule/*`.
- The static HTML page should remain in Cloudflare Pages and should continue fetching `./results.json`.

## FIFA live enrichment

The Worker keeps `worldcup26.ir/get/games` as the schedule and fallback source. For selected known match IDs, it also tries a short-timeout FIFA live fetch after the normal results object is built.

Current pilot mapping:

```js
const FIFA_MATCH_IDS = {
  'USA vs Paraguay': '400021458'
};
```

If FIFA returns valid team names, scores, and a clean `MatchTime`, the Worker enriches that match with `source: "fifa"` and an official-looking `elapsed` value. If FIFA fails or returns incomplete data, the existing `worldcup26.ir` result is left untouched and a warning is added to `warnings`.

## Group-stage polling shutdown

After group-stage matches are complete and final results verified, stop the scheduled cron:

```powershell
(Get-Content "C:\Users\nmolo\Documents\worldcup-results-worker-local\wrangler.toml") | Where-Object { $_ -notmatch 'crons\s*=' -and $_ -notmatch '^\[triggers\]$' } | Set-Content "C:\Users\nmolo\Documents\worldcup-results-worker-local\wrangler.toml"; Set-Location "C:\Users\nmolo\Documents\worldcup-results-worker-local"; npx wrangler deploy
```

This removes the `[triggers]` `crons` section and redeploys. The Worker still serves last cached results. Manual refresh via `ADMIN_TOKEN` continues to work for emergency backfill.
