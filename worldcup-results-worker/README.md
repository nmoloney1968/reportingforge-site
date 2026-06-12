# World Cup 2026 Results Worker - schedule-aware polling

This Worker serves dynamic results for:

```text
https://reportingforge.com/worldcup2026schedule/results.json
```

It uses the free `worldcup26.ir/get/games` endpoint. No football API key is required.

## What changed from the simple Worker

The cron runs every 5 minutes, but the Worker **does not call the source API every time**. It calls `worldcup26.ir/get/games` only when the current UTC time matches an approved polling slot based on the 72 group-stage fixtures.

Polling rules:

- All games: kickoff, then every 10 minutes through kickoff +120 minutes.
- All games: post-match checks at kickoff +130, +140 and +165 minutes.
- Germany games: additional 5-minute checks during live play, so Germany games are effectively checked every 5 minutes.
- One request to `https://worldcup26.ir/get/games` fetches the full World Cup feed and updates all visible matches.
- Automatic refreshes stop for the UTC day once usage reaches 90.
- The last successful result payload stays in KV if an API call fails.

Expected group-stage usage stays below the 90-call automatic daily cap because polling is tied to match windows instead of running on every cron tick.

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
