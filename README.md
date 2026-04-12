# Reporting Forge Site

## Monthly domain health checks

Use the read-only scripts in `scripts/` once per month, or after any DNS, registrar, Worker, or zone change.

PowerShell on Windows:

```powershell
./scripts/check-domain-health.ps1
./scripts/check-worker-health.ps1
```

Bash on macOS/Linux:

```bash
./scripts/check-domain-health.sh
./scripts/check-worker-health.sh
```

Each script writes a timestamped Markdown report into `reports/` and exits nonzero if a required check fails. The expected state is documented in:

- `docs/EXPECTED_DOMAIN_STATE.md`
- `docs/DNS_MONTHLY_CHECKLIST.md`
