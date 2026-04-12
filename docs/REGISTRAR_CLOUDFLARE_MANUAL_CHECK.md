# Registrar And Cloudflare Manual Check

This runbook is the human companion to the automated DNS and Worker health scripts.

Use it when:

- the monthly checks fail
- the zone has been recreated
- nameservers were changed recently
- DNSSEC was toggled
- the Worker custom domain was reattached

## Scope

The purpose is verification only.

Do not change production resources while you are only collecting evidence.

## Registrar checks in GoDaddy

- Confirm `reportingforge.com` is present in the correct GoDaddy account
- Confirm the domain has not expired and auto-renew settings are intentional
- Confirm the account recovery email and MFA are current
- Confirm the nameserver set is exactly:
  - `kia.ns.cloudflare.com`
  - `roan.ns.cloudflare.com`
- Confirm there are no additional nameservers
- Inspect DNSSEC at the registrar:
  - if Cloudflare DNSSEC is off, no DS record should be present
  - if Cloudflare DNSSEC is on, the DS record must exactly match the values Cloudflare publishes

## Cloudflare checks

- Confirm the `reportingforge.com` zone exists in the correct Cloudflare account
- Confirm zone status is active
- Confirm the assigned nameservers are still:
  - `kia.ns.cloudflare.com`
  - `roan.ns.cloudflare.com`
- Confirm Worker `rf-webhooks` exists
- Confirm `api.reportingforge.com` is attached as a custom domain to `rf-webhooks`
- Confirm fallback hostname `rf-webhooks.nmoloney1968.workers.dev` still serves `/health`
- Confirm D1 database `rf_store` exists
- Confirm R2 bucket `rf-books` exists

## Evidence to capture

For each monthly check or incident review, capture:

- Registrar screenshot or notes showing the exact nameserver pair
- DNSSEC state in both GoDaddy and Cloudflare
- Worker custom-domain attachment for `api.reportingforge.com`
- D1 database list showing `rf_store`
- R2 bucket list showing `rf-books`
- The generated report from `reports/`

## Failure triage hints

- NS mismatch usually means registrar drift or wrong Cloudflare account/zone
- `api.reportingforge.com` health failure with working `workers.dev` usually means custom-domain attachment or zone routing drift
- failures on both custom-domain and `workers.dev` usually mean Worker outage, deletion, or runtime breakage
- intermittent failures from some networks can indicate stale DS records or DNSSEC mismatch
