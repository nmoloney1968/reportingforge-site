# DNS Monthly Checklist

Use this checklist once per month and any time the zone, registrar, Worker routes, or mail/DNS settings are touched.

## 1. Run the automated checks first

On Windows:

```powershell
./scripts/check-domain-health.ps1
./scripts/check-worker-health.ps1
```

Expected result:

- Both scripts exit with code `0`
- A timestamped Markdown report is written under `reports/`

## 2. Verify registrar ownership and delegation

- Confirm `reportingforge.com` is still owned in the correct GoDaddy account
- Confirm the registrar contact, renewal, and recovery email details are current
- Confirm the registrar nameserver pair is exactly:
  - `kia.ns.cloudflare.com`
  - `roan.ns.cloudflare.com`
- Confirm there are no extra nameservers

## 3. Verify DNSSEC and DS hygiene

- In GoDaddy, inspect whether a DS record is present
- In Cloudflare, inspect DNSSEC state for the zone
- Confirm one of these is true:
  - DNSSEC is off in Cloudflare and no DS record exists at GoDaddy
  - DNSSEC is on in Cloudflare and the GoDaddy DS record exactly matches Cloudflare
- Record any mismatch as a failure because stale DS records can cause intermittent resolution issues

## 4. Verify the Cloudflare zone still exists

- Sign into the correct Cloudflare account
- Confirm the `reportingforge.com` zone is present
- Confirm the zone is active and authoritative
- Confirm the zone nameserver assignment still matches `kia` and `roan`

## 5. Verify Worker routing

- Confirm Worker `rf-webhooks` still exists
- Confirm custom domain `api.reportingforge.com` is attached to `rf-webhooks`
- Confirm the fallback hostname `rf-webhooks.nmoloney1968.workers.dev` still responds on `/health`
- Confirm `https://api.reportingforge.com/health` returns `{"ok":true}`

## 6. Verify account-level storage resources

- Confirm D1 database `rf_store` still exists
- Confirm R2 bucket `rf-books` still exists
- Confirm Worker bindings still point to:
  - D1 binding `DB -> rf_store`
  - R2 binding `rf_books -> rf-books`

## 7. Record the result

- Keep the generated report from `reports/`
- Add the manual verification date and initials to your ops notes
- If anything failed, log the exact mismatch before making any changes

## 8. Minimum failure conditions

Treat the monthly check as failed if any of the following are true:

- NS set is not exactly `kia.ns.cloudflare.com` and `roan.ns.cloudflare.com`
- `api.reportingforge.com` does not resolve
- `https://api.reportingforge.com/health` is not HTTP 200
- The health body does not contain `{"ok":true}`
- The custom domain is detached from `rf-webhooks`
- The zone is missing or DNSSEC DS state is stale
- D1 `rf_store` or R2 `rf-books` is missing
