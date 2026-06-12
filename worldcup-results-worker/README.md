# World Cup 2026 Results Worker - budget-aware polling

This Worker serves dynamic results for:

```text
https://reportingforge.com/worldcup2026schedule/results.json
```

It is designed for the API-FOOTBALL/API-SPORTS free tier where the practical daily budget is 100 API calls.

## What changed from the simple Worker

The cron now runs every 5 minutes, but the Worker **does not call the football API every time**. It calls the API only when the current UTC time matches an approved polling slot based on the 72 group-stage fixtures.

Polling rules:

- All games: kickoff, then every 10 minutes through kickoff +120 minutes.
- All games: post-match checks at kickoff +130, +140 and +165 minutes.
- Germany games: additional 5-minute checks during live play, so Germany games are effectively checked every 5 minutes.
- One API request fetches the full World Cup feed and updates all visible matches.
- Automatic refreshes stop for the UTC day once usage reaches 90, leaving room for manual checks.
- The last successful result payload stays in KV if an API call fails.

Expected group-stage usage:

- Roughly 996 total calls across the group stage.
- Estimated busiest quota day is below 90 automatic calls.
- Avoid full 5-minute polling for every match, because that can exceed 100 calls/day.

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

Create KV namespace:

```powershell
Set-Location "G:\My Drive\SE Asia Trip\E-Book - SME Reporting\reportingforge-site\worldcup-results-worker"; npx wrangler kv namespace create RESULTS
```

Copy the returned namespace ID into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RESULTS"
id = "PASTE_RETURNED_ID_HERE"
```

Add secrets. Do not commit these values.

```powershell
Set-Location "G:\My Drive\SE Asia Trip\E-Book - SME Reporting\reportingforge-site\worldcup-results-worker"; npx wrangler secret put APISPORTS_KEY
```

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

- `APISPORTS_KEY` is the API-FOOTBALL/API-SPORTS key.
- `ADMIN_TOKEN` is your private manual-refresh token.
- The route should stay narrow. Do not route the Worker to `reportingforge.com/worldcup2026schedule/*`.
- The static HTML page should remain in Cloudflare Pages and should continue fetching `./results.json`.
