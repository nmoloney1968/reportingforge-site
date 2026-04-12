# Expected Domain State

This file is the machine-readable human reference for the Reporting Forge domain checks.

## Hostnames

- Apex site domain: `reportingforge.com`
- Worker API custom domain: `api.reportingforge.com`
- Worker fallback hostname: `rf-webhooks.nmoloney1968.workers.dev`

## Authoritative nameservers

The authoritative nameserver set for `reportingforge.com` must be exactly:

- `kia.ns.cloudflare.com`
- `roan.ns.cloudflare.com`

No extra nameservers should be present at the registrar or in public delegation.

## Health endpoints

The Worker health endpoint must respond successfully at:

- `https://api.reportingforge.com/health`

Expected response:

- HTTP status: `200`
- JSON body contains: `{"ok":true}`

Optional fallback verification:

- `https://rf-webhooks.nmoloney1968.workers.dev/health`

Expected response:

- HTTP status: `200`
- JSON body contains: `{"ok":true}`

## Cloudflare resources to verify manually

- Zone exists for `reportingforge.com`
- Custom domain `api.reportingforge.com` is still attached to Worker `rf-webhooks`
- D1 database `rf_store` still exists
- R2 bucket `rf-books` still exists

## Registrar and DNSSEC expectations

- Registrar remains GoDaddy
- Registrar ownership is current and recoverable
- Registrar nameserver set exactly matches the Cloudflare pair above
- No stale or duplicate nameservers are present
- DNSSEC DS records are either:
  - absent when DNSSEC is off in Cloudflare, or
  - an exact match for the DS values Cloudflare currently publishes
