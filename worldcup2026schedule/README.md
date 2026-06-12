# World Cup 2026 Hanoi schedule - automated results

This package keeps the World Cup schedule as a static Cloudflare Pages route at:

https://reportingforge.com/worldcup2026schedule

The schedule page loads `/worldcup2026schedule/results.json` in the browser. A Cloudflare Worker should intercept that `results.json*` path, call API-FOOTBALL, store the latest results in Workers KV, and return JSON to the page.

## Folder contents

```text
worldcup2026schedule/
  index.html                                  # static page with SVG flags and dynamic result loading
  results.json                                # static fallback only; Worker overrides this route when live
  results.example.json                        # example manual result format
  world-cup-2026-group-stage-hanoi.ics         # Google Calendar import file
  world-cup-2026-group-stage-hanoi.csv         # audit/source schedule

worldcup-results-worker/
  src/index.js                                # Worker code
  wrangler.toml                               # Worker config
  package.json                                # Wrangler dependency
```

## 1. Deploy the updated static page

Copy `worldcup2026schedule` into the root of the Reporting Forge site repo, commit, and push.

PowerShell one-liner:

```powershell
$repo="C:\path\to\reportingforge-site"; $src="C:\path\to\worldcup2026_automation_flags_package\worldcup2026schedule"; Copy-Item -Recurse -Force $src "$repo\worldcup2026schedule"; Set-Location $repo; git add worldcup2026schedule; git commit -m "Add automated World Cup results support"; git push
```

## 2. Create an API-FOOTBALL key

Create an API-FOOTBALL/API-SPORTS account and get the API key. The Worker expects it as the secret `APISPORTS_KEY`.

The Worker calls:

```text
https://v3.football.api-sports.io/fixtures?league=1&season=2026
```

## 3. Create and deploy the Cloudflare Worker

From the Worker folder:

```powershell
Set-Location "C:\path\to\worldcup2026_automation_flags_package\worldcup-results-worker"; npm install
```

Create the KV namespace:

```powershell
Set-Location "C:\path\to\worldcup2026_automation_flags_package\worldcup-results-worker"; npx wrangler kv namespace create RESULTS
```

Copy the returned KV namespace ID into `wrangler.toml` here:

```toml
[[kv_namespaces]]
binding = "RESULTS"
id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"
```

Add the API key secret:

```powershell
Set-Location "C:\path\to\worldcup2026_automation_flags_package\worldcup-results-worker"; npx wrangler secret put APISPORTS_KEY
```

Add a private admin token for manual refreshes:

```powershell
Set-Location "C:\path\to\worldcup2026_automation_flags_package\worldcup-results-worker"; npx wrangler secret put ADMIN_TOKEN
```

Deploy the Worker:

```powershell
Set-Location "C:\path\to\worldcup2026_automation_flags_package\worldcup-results-worker"; npx wrangler deploy
```

## 4. Attach the Worker route

Configure this route in Cloudflare:

```text
reportingforge.com/worldcup2026schedule/results.json*
```

Attach it to the `worldcup-results` Worker.

This lets the page keep using a simple relative fetch to `results.json`, while the Worker returns the dynamic results.

## 5. Manual refresh endpoint

After a match, force a refresh without waiting for the 15-minute cron:

```text
https://reportingforge.com/worldcup2026schedule/results.json/refresh?token=YOUR_ADMIN_TOKEN
```

## 6. Test

Open:

```text
https://reportingforge.com/worldcup2026schedule/results.json
```

Expected before any matches finish:

```json
{
  "lastUpdated": "... ICT",
  "matches": {}
}
```

Expected after matches are live or complete:

```json
{
  "matches": {
    "Germany vs Curacao": {
      "status": "FT",
      "score": "Germany 2-0 Curacao"
    }
  }
}
```

The page will automatically add result cards below matching fixtures.

## Notes

- The HTML uses real SVG flag images, not emoji flags, so it works on Windows and mobile.
- The Worker canonicalizes country names where API naming may differ from the page, such as `Korea Republic` to `South Korea`, `Côte d'Ivoire` to `Ivory Coast`, `Congo DR` to `DR Congo`, `Czechia` to `Czech Republic`, and `United States` to `USA`.
- The Worker currently keeps group-stage fixtures only. After the group stage, regenerate the page or loosen the Worker filter for knockout pages.
