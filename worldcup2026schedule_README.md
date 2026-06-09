# World Cup 2026 Hanoi schedule page

This package is ready to publish at:

`https://reportingforge.com/worldcup2026schedule`

## Files

- `worldcup2026schedule/index.html` - public phone-friendly page
- `worldcup2026schedule/world-cup-2026-group-stage-hanoi.ics` - Google Calendar import file with 4-hour reminders
- `worldcup2026schedule/world-cup-2026-group-stage-hanoi.csv` - CSV backup/audit file

## Deployment

Copy the `worldcup2026schedule` folder into the root of the Reporting Forge static site repository, commit, and push. Cloudflare Pages should serve the clean URL automatically if the repo is deployed as a static site.

PowerShell one-liner pattern after extracting the zip:

```powershell
$repo="C:\path\to\reportingforge-site"; Copy-Item -Recurse -Force ".\worldcup2026schedule" "$repo\worldcup2026schedule"; Set-Location $repo; git add worldcup2026schedule; git commit -m "Add World Cup 2026 Hanoi schedule page"; git push
```

If Cloudflare Pages is not serving extensionless folder routes, the same page should still work at:

`https://reportingforge.com/worldcup2026schedule/`

