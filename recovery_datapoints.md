Thought for 12s
# RECOVERY_NOTES_2026-04-12

## Purpose

This file records the recovered live Reporting Forge fulfillment/API configuration and supporting evidence as of 2026-04-12.

This is a recovery snapshot and preservation record, not a final architecture specification.

---

## Executive Summary

The critical Reporting Forge backend was recovered successfully from the live Cloudflare Worker and dashboard.

Recovered and verified:

- Worker: `rf-webhooks`
- Custom domain: `api.reportingforge.com`
- Workers.dev domain: `rf-webhooks.nmoloney1968.workers.dev`
- D1 binding: `DB -> rf_store`
- R2 binding: `rf_books -> rf-books`
- Cron trigger: `*/1 * * * *`
- Compatibility date: `2026-02-17`
- Health endpoint confirmed live: `GET /health` returned `{"ok":true}`

Conclusion:

- The system was not lost.
- The main risk was source-control drift and incomplete repo history.
- The live Cloudflare Worker contained the real fulfillment logic.
- D1 and R2 were still intact.
- The system appears lightly used, consistent with very low traction and no sales yet.

---

## Recovered Live Worker

### Worker name

- `rf-webhooks`

### Main live routes confirmed in recovered code

- `POST /fungies/webhook`
- `GET /dl`
- `GET /health`
- `POST /lead`
- `POST /admin/mint-link`
- `POST /admin/resend`

### Scheduled processing

- `scheduled()` processes fulfillment jobs every minute

### Core responsibilities of the Worker

1. Verify Fungies webhook signatures
2. Insert fulfillment jobs into D1
3. Process pending jobs on cron
4. Call the Render stamper service
5. Generate secure download links
6. Send delivery email via Mailgun
7. Capture leads and enqueue Chapter 0 personalized delivery

---

## Recovered Worker Source Summary

Recovered live file:

- `worker.js`

Important note:

- The old repo referenced `main = "src/index.ts"` under a Worker named `reporting-forge`
- The actual live operational Worker recovered from Cloudflare is `rf-webhooks` using `worker.js`
- The old `src/index.ts` path should be treated as stale, not canonical

---

## Current Recovered Wrangler Config

```toml
name = "rf-webhooks"
main = "worker.js"
compatibility_date = "2026-02-17"

[observability]
enabled = true

[[d1_databases]]
binding = "DB"
database_name = "rf_store"
database_id = "aa566fec-9105-4779-8abe-2a0ba8299dc6"

[[r2_buckets]]
binding = "rf_books"
bucket_name = "rf-books"

[triggers]
crons = ["*/1 * * * *"]

[vars]
MAIL_FROM = "hello@mg.reportingforge.com"
MAILGUN_API_BASE = "https://api.mailgun.net"
MAILGUN_DOMAIN = "mg.reportingforge.com"
PUBLIC_BASE_URL = "https://api.reportingforge.com"
REPLY_TO = "hello@reportingforge.com"
STAMPER_URL = "https://reportingforge-internal.onrender.com"

[secrets]
required = [
  "ADMIN_TOKEN",
  "DL_TOKEN_SECRET",
  "FNGS_WEBHOOK_SECRET",
  "MAILGUN_API_KEY",
  "STAMPER_TOKEN",
]
Old Wrangler File Found
name = "reporting-forge"
main = "src/index.ts"
compatibility_date = "2026-02-17"

[[d1_databases]]
binding = "DB"
database_name = "rf_store"
database_id = "aa566fec-9105-4779-8abe-2a0ba8299dc6"

Interpretation:

reporting-forge appears to have been an older or parallel Worker/project identity
src/index.ts was referenced in repo config but the live recovered Worker is rf-webhooks using worker.js
The D1 linkage to rf_store is consistent between old and live configurations
Known Plaintext Vars

Recovered plaintext vars:

MAIL_FROM = hello@mg.reportingforge.com
MAILGUN_API_BASE = https://api.mailgun.net
MAILGUN_DOMAIN = mg.reportingforge.com
PUBLIC_BASE_URL = https://api.reportingforge.com
REPLY_TO = hello@reportingforge.com
STAMPER_URL = https://reportingforge-internal.onrender.com
Known Secret Names

Recovered secret names only, not values:

ADMIN_TOKEN
DL_TOKEN_SECRET
FNGS_WEBHOOK_SECRET
MAILGUN_API_KEY
STAMPER_TOKEN
Bound Resources
D1

Binding:

DB

Database:

rf_store

Database ID:

aa566fec-9105-4779-8abe-2a0ba8299dc6
R2

Binding:

rf_books

Bucket:

rf-books
Live Worker Functional Notes

The recovered worker.js handles:

Fungies webhook signature verification using x-fngs-signature
D1 queue insertion into fulfillment_jobs
optional event insertion into fungies_events
Chapter 0 lead capture into leads
cron-driven processing of jobs
stamper calls to the Render service
generation of secure tokenized download links
Mailgun email delivery
admin link minting and resend operations
Product mapping in recovered Worker
const PRODUCT_TO_MASTER = {
  "RF-SMEAF-CH0": "masters/RF-SMEAF-CH0.pdf",
  "RF-SMEAF-EBK": "masters/RF-SMEAF-EBK.pdf",
  "RF-SMEAF-EBK-tmp": "masters/RF-SMEAF-EBK.pdf",
};
Important code-level observations
RF-SMEAF-EBK-tmp normalizes to RF-SMEAF-EBK
Chapter 0 lead jobs use generated order numbers like LEAD-...
Download links are signed with DL_TOKEN_SECRET
The default public base URL falls back to https://rf-webhooks.nmoloney1968.workers.dev if PUBLIC_BASE_URL is absent
Mailgun sending depends on:
MAILGUN_API_KEY
MAILGUN_DOMAIN
MAILGUN_API_BASE
MAIL_FROM
The Render stamper is called at:
https://reportingforge-internal.onrender.com/stamp
D1 Schema Snapshot

Schema captured from:

SELECT type, name, sql
FROM sqlite_master
WHERE name NOT LIKE 'sqlite_%'
ORDER BY type, name;
Indexes
CREATE INDEX idx_fulfillment_downloads_key ON fulfillment_downloads(output_key);
CREATE INDEX idx_fulfillment_downloads_order ON fulfillment_downloads(order_number);
CREATE INDEX idx_fulfillment_status_next ON fulfillment_jobs (status, next_attempt_at);
CREATE INDEX idx_fungies_events_created ON fungies_events(created_at_ms);
CREATE INDEX idx_fungies_events_order ON fungies_events(order_number);
CREATE INDEX idx_fungies_items_event ON fungies_items(event_id);
CREATE INDEX idx_fungies_items_offer ON fungies_items(offer_id);
CREATE INDEX idx_fungies_items_product ON fungies_items(product_id);
CREATE INDEX idx_webhook_events_order ON webhook_events(order_number);
CREATE INDEX leads_created_idx ON leads(created_at_utc);
CREATE UNIQUE INDEX leads_email_unique ON leads(email);
Tables
CREATE TABLE _cf_KV (
  key TEXT PRIMARY KEY,
  value BLOB
) WITHOUT ROWID;
CREATE TABLE fulfillment_downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT,
  output_key TEXT NOT NULL,
  token_ord TEXT,
  ip TEXT,
  user_agent TEXT,
  country TEXT,
  colo TEXT,
  ts_utc TEXT NOT NULL
);
CREATE TABLE fulfillment_jobs (
  idempotency_key TEXT PRIMARY KEY,
  event_id TEXT,
  order_id TEXT,
  order_number TEXT,
  product_internal_id TEXT,
  buyer_email TEXT,
  buyer_first_name TEXT,
  buyer_last_name TEXT,
  created_at_utc TEXT,
  master_key TEXT,
  output_key TEXT,
  status TEXT,
  attempt_count INTEGER DEFAULT 0,
  next_attempt_at INTEGER DEFAULT 0,
  last_error TEXT,
  stamped_sha256 TEXT,
  email_message_id TEXT,
  updated_at INTEGER,
  currency TEXT,
  currency_decimals INTEGER,
  value INTEGER,
  tax INTEGER,
  fee INTEGER,
  invoice_url TEXT,
  total_display TEXT,
  stamper_tag TEXT,
  stamped_at_utc TEXT,
  first_downloaded_at_utc TEXT,
  download_count INTEGER
);
CREATE TABLE fungies_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  test_mode INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  created_date TEXT NOT NULL,
  order_number TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  raw_json TEXT NOT NULL,
  received_at_ms INTEGER NOT NULL
);
CREATE TABLE fungies_items (
  event_id TEXT NOT NULL,
  item_id TEXT,
  product_id TEXT,
  offer_id TEXT,
  name TEXT,
  quantity INTEGER,
  value INTEGER,
  currency TEXT,
  raw_item_json TEXT NOT NULL,
  PRIMARY KEY (event_id, item_id),
  FOREIGN KEY (event_id) REFERENCES fungies_events(id)
);
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  last_ip_hash TEXT,
  user_agent TEXT,
  notes TEXT,
  first_name TEXT
);
CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  order_number TEXT,
  created_at_ms INTEGER,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  raw_json TEXT NOT NULL
);
Schema observations
fulfillment_jobs is the core queue/state table
fungies_events and fungies_items appear intended for webhook event storage and per-item detail
leads supports Chapter 0 lead capture
fulfillment_downloads tracks download activity
webhook_events appears to be an older or alternate webhook audit table
_cf_KV is internal Cloudflare state
D1 Row Counts Captured on 2026-04-12

Query used:

SELECT
  (SELECT COUNT(*) FROM fulfillment_jobs) AS fulfillment_jobs,
  (SELECT COUNT(*) FROM fungies_events) AS fungies_events,
  (SELECT COUNT(*) FROM fungies_items) AS fungies_items,
  (SELECT COUNT(*) FROM leads) AS leads,
  (SELECT COUNT(*) FROM fulfillment_downloads) AS fulfillment_downloads,
  (SELECT COUNT(*) FROM webhook_events) AS webhook_events;

Results:

fulfillment_jobs = 2
fungies_events = 0
fungies_items = 0
leads = 2
fulfillment_downloads = 0
webhook_events = 0

Interpretation:

The system has been lightly used
It appears that Chapter 0 lead flow was used or tested
There is no evidence yet of paid Fungies orders in this D1 database
This matches the business reality: almost no traction, very few leads, no sales
Operational Interpretation of the Data

What the live dataset suggests:

The backend is real and functioning
The Worker, D1, R2, and custom API domain are intact
The system was not heavily used, which reduces recovery risk
There are two leads and two fulfillment jobs, likely corresponding to Chapter 0 lead flow
There is no meaningful commercial history to reconstruct from paid orders

Important additional observation:

The recovered Worker code tries to insert optional Fungies event logging into a schema that may have drifted
Because those inserts are wrapped in silent try/catch blocks, fungies_events may remain zero even if the webhook route is exercised
Therefore zero rows in fungies_events does not necessarily mean the webhook route was never called, but in this case it aligns with the fact that nothing was sold
R2 Inventory Snapshot

Bucket:

rf-books

Observed top-level prefixes:

masters/
fulfillment/

Observed master files:

masters/RF-SMEAF-CH0.pdf
masters/RF-SMEAF-EBK.pdf

Observed fulfillment structure included:

fulfillment/RF-SMEAF-CH0/
fulfillment/RF-SMEAF-EBK/
fulfillment/test/

Observed CH0 output filenames were lead-style files, consistent with generated LEAD-... order numbers.

Interpretation:

The fulfillment pipeline has created output objects in R2
This aligns with the lead-driven Chapter 0 flow
The R2 bucket structure matches the recovered Worker code expectations
Confirmed Live Endpoints
Confirmed working
https://api.reportingforge.com/health -> {"ok":true}
https://rf-webhooks.nmoloney1968.workers.dev/health -> {"ok":true}
Additional observations from probing
https://api.reportingforge.com/ returned 404 Not Found
This is consistent with api.reportingforge.com being routed to the Worker for specific paths rather than serving a root page
Known Architecture Snapshot
Public side
reportingforge.com
www.reportingforge.com
api.reportingforge.com
Worker side
rf-webhooks
rf-webhooks.nmoloney1968.workers.dev
Database and storage
D1: rf_store
R2: rf-books
Email
Mailgun domain: mg.reportingforge.com
Reply-to: hello@reportingforge.com
From: hello@mg.reportingforge.com
Stamper
Render service:
https://reportingforge-internal.onrender.com
Recovery Branch Snapshot

Branch created and published:

recover-rf-webhooks-2026-04-12

Files preserved in recovery branch:

worker.js
wrangler.toml
wrangler.toml_old

Branch purpose:

known-good recovery snapshot
should not be merged into main until reconciliation is complete
Important Recovery Observations
The live Worker was recoverable from Cloudflare even though the repo was missing the true live source.
The old Worker config referencing reporting-forge and src/index.ts should be treated as historical or stale.
The actual live operational backend is rf-webhooks.
Backend resources are intact enough to preserve and rebuild from.
The system appears lightly used, which reduces historical-data recovery risk.
There may be code/schema drift in some logging or event-storage areas, but the core structure is intact.
This is a preservation and stabilization point, not a signal to casually redeploy or refactor production immediately.
Recommended Immediate Next-Step Guidance
Keep the recovery branch untouched as a reference point.
Maintain an external backup ZIP of:
worker.js
wrangler.toml
wrangler.toml_old
screenshots
this notes file
Do not deploy or merge until repo reconciliation is complete.
Consider moving rf-webhooks into its own dedicated repo, separate from the public site repo.
Later, run controlled end-to-end tests for:
/lead
/fungies/webhook
/dl
Recovery Status

Status as of 2026-04-12:

Worker recovered: yes
D1 confirmed: yes
R2 confirmed: yes
custom domain confirmed: yes
source saved to GitHub recovery branch: yes
production redeploy required immediately: no
commercial history loss risk: low
likely next phase: stabilize, document, separate repos, then test