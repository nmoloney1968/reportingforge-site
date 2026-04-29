// worker.js
// Cloudflare Worker for:
// 1) /fungies/webhook: verify Fungies signature, insert job into fulfillment_jobs (with receipt fields)
// 2) scheduled(): every minute, process jobs (stamp if needed, then email via Mailgun)
// 3) /dl?token=...: secure download from R2
// 4) /admin/mint-link: mint a download link for a known R2 key (ADMIN_TOKEN protected)
// 5) /admin/resend: requeue a job by orderNumber to resend the email (ADMIN_TOKEN protected)
// 6) /lead: single opt-in lead capture -> D1 leads, then enqueue CH0 personalized delivery job
//
// REQUIRED SECRETS:
// - FNGS_WEBHOOK_SECRET
// - STAMPER_TOKEN
// - DL_TOKEN_SECRET
// - MAILGUN_API_KEY
// - ADMIN_TOKEN
//
// REQUIRED PLAINTEXT VARS:
// - STAMPER_URL (https://reportingforge-internal.onrender.com)
// - PUBLIC_BASE_URL (https://api.reportingforge.com recommended)
// - MAIL_FROM (can be just an email address)
// - REPLY_TO (optional, example: hello@reportingforge.com)
// - MAILGUN_DOMAIN (mg.reportingforge.com)
// - MAILGUN_API_BASE (https://api.mailgun.net)
//
// REQUIRED BINDINGS:
// - D1 binding name: DB
// - R2 binding name: rf_books (points to bucket rf-books)
//
// REQUIRED TABLES (D1):
// - fulfillment_jobs
// - fungies_events (optional; insert is ignored if missing)
// - leads (for /lead, must include first_name column)
//
// Notes:
// - Preserves the last known good Fungies signature verification: "sha256_<hex>"
// - Lead delivery is idempotent per email using idempotency_key = "lead:<sha256(email)>"

const PRODUCT_TO_MASTER = {
  "RF-SMEAF-CH0": "masters/RF-SMEAF-CH0.pdf",
  "RF-SMEAF-EBK": "masters/RF-SMEAF-EBK.pdf",
  "RF-SMEAF-EBK-tmp": "masters/RF-SMEAF-EBK.pdf",
};

function normalizeProductId(productInternalId) {
  if (productInternalId === "RF-SMEAF-EBK-tmp") return "RF-SMEAF-EBK";
  return productInternalId;
}

function jsonResponse(obj, status = 200, extraHeaders = null) {
  const headers = { "content-type": "application/json" };
  if (extraHeaders && typeof extraHeaders === "object") {
    for (const [k, v] of Object.entries(extraHeaders)) headers[k] = v;
  }
  return new Response(JSON.stringify(obj), { status, headers });
}

function timingSafeEqual(aBytes, bBytes) {
  if (aBytes.byteLength !== bBytes.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.byteLength; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

async function hmacSha256Hex(secret, messageBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, messageBytes);
  const sigBytes = new Uint8Array(sig);
  return [...sigBytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyFungiesSignature(env, rawBodyBytes, signatureHeader) {
  if (!signatureHeader || typeof signatureHeader !== "string") return false;
  const parts = signatureHeader.split("_");
  if (parts.length !== 2 || parts[0] !== "sha256") return false;

  const providedHex = parts[1].trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(providedHex)) return false;

  const expectedHex = await hmacSha256Hex(env.FNGS_WEBHOOK_SECRET, rawBodyBytes);
  const a = new TextEncoder().encode(providedHex);
  const b = new TextEncoder().encode(expectedHex);
  return timingSafeEqual(a, b);
}

// -------------------- Admin auth --------------------

function getBearerToken(request) {
  const h = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function requireAdmin(request, env) {
  const tok = getBearerToken(request);
  if (!tok || !env.ADMIN_TOKEN) return false;
  return tok === env.ADMIN_TOKEN;
}

// -------------------- /lead CORS + validation --------------------

const ALLOWED_ORIGINS = new Set([
  "https://reportingforge.com",
  "https://www.reportingforge.com",
]);

function corsHeadersFor(request) {
  const origin = request.headers.get("Origin") || "";
  if (!origin) return {};
  if (!ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function isValidEmail(email) {
  if (!email) return false;
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeFirstName(s) {
  const v = String(s || "").trim();
  if (!v) return "";
  return v.slice(0, 40);
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function makeLeadOrderNumber() {
  const s = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  return `LEAD-${s}`;
}

async function enqueueLeadCh0Job(env, buyerEmail, firstName) {
  const email = String(buyerEmail || "").trim().toLowerCase();
  const fn = normalizeFirstName(firstName);

  const productId = "RF-SMEAF-CH0";
  const masterKey = PRODUCT_TO_MASTER[productId];

  const emailHash = await sha256Hex(email);
  const idempotencyKey = `lead:${emailHash}`;

  const orderNumber = makeLeadOrderNumber();
  const outputKey = `fulfillment/${productId}/${orderNumber}.pdf`;
  const createdAtUtc = new Date().toISOString();
  const nowMs = Date.now();

  await env.DB.prepare(
    `INSERT OR IGNORE INTO fulfillment_jobs
     (idempotency_key, event_id, order_id, order_number, product_internal_id,
      buyer_email, buyer_first_name, buyer_last_name, created_at_utc,
      master_key, output_key, status, attempt_count, next_attempt_at, last_error, updated_at,
      currency, currency_decimals, value, tax, fee, invoice_url, total_display)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_STAMP', 0, ?, NULL, ?,
             NULL, NULL, NULL, NULL, NULL, NULL, NULL)`
  ).bind(
    idempotencyKey,
    null,
    null,
    orderNumber,
    productId,
    email,
    fn,
    "",
    createdAtUtc,
    masterKey,
    outputKey,
    nowMs,
    nowMs
  ).run();

  await env.DB.prepare(
    `UPDATE fulfillment_jobs
     SET buyer_first_name = COALESCE(NULLIF(?, ''), buyer_first_name),
         status = CASE
           WHEN status IN ('EMAILED') THEN 'STAMPED'
           WHEN status IN ('STAMPED') THEN 'STAMPED'
           ELSE 'PENDING_STAMP'
         END,
         next_attempt_at = ?,
         last_error = NULL,
         updated_at = ?
     WHERE idempotency_key = ?`
  ).bind(fn, nowMs, nowMs, idempotencyKey).run();
}

async function handleLead(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeadersFor(request) });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, corsHeadersFor(request));
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400, corsHeadersFor(request));
  }

  const email = String(payload?.email || "").trim().toLowerCase();
  const source = String(payload?.source || "unknown").trim().slice(0, 80);
  const firstName = normalizeFirstName(payload?.firstName);

  if (!isValidEmail(email)) {
    return jsonResponse({ ok: false, error: "invalid_email" }, 400, corsHeadersFor(request));
  }

  const nowIso = new Date().toISOString();
  const id = crypto.randomUUID();

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ipHash = ip ? await sha256Hex(ip) : null;
  const ua = (request.headers.get("User-Agent") || "").slice(0, 200);

  try {
    await env.DB.prepare(
      `
      INSERT INTO leads (id, email, first_name, source, status, created_at_utc, updated_at_utc, last_ip_hash, user_agent)
      VALUES (?, ?, ?, ?, 'new', ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        first_name = COALESCE(NULLIF(excluded.first_name, ''), leads.first_name),
        source = excluded.source,
        updated_at_utc = excluded.updated_at_utc,
        last_ip_hash = excluded.last_ip_hash,
        user_agent = excluded.user_agent
      `
    )
      .bind(id, email, firstName, source, nowIso, nowIso, ipHash, ua)
      .run();
  } catch (err) {
    return jsonResponse(
      { ok: false, error: "db_error", detail: String(err && err.message ? err.message : err) },
      500,
      corsHeadersFor(request)
    );
  }

  try {
    await enqueueLeadCh0Job(env, email, firstName);
  } catch {
    return jsonResponse(
      { ok: true, queued: false, note: "lead_saved_but_delivery_queue_failed" },
      200,
      corsHeadersFor(request)
    );
  }

  return jsonResponse({ ok: true, queued: true }, 200, corsHeadersFor(request));
}

// -------------------- Download token helpers --------------------

function base64UrlEncode(bytes) {
  const bin = String.fromCharCode(...bytes);
  const b64 = btoa(bin);
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecodeToBytes(b64url) {
  const b64 = b64url.replaceAll("-", "+").replaceAll("_", "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function signDownloadToken(env, payloadObj) {
  const payloadJson = JSON.stringify(payloadObj);
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payloadJson));
  const macHex = await hmacSha256Hex(env.DL_TOKEN_SECRET, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${macHex}`;
}

async function verifyDownloadToken(env, token) {
  if (!token || typeof token !== "string") return { ok: false, reason: "missing_token" };
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "bad_format" };

  const payloadB64 = parts[0];
  const macHex = parts[1].toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(macHex)) return { ok: false, reason: "bad_mac" };

  const expectedHex = await hmacSha256Hex(env.DL_TOKEN_SECRET, new TextEncoder().encode(payloadB64));
  const a = new TextEncoder().encode(macHex);
  const b = new TextEncoder().encode(expectedHex);
  if (!timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecodeToBytes(payloadB64)));
  } catch {
    return { ok: false, reason: "bad_payload" };
  }

  const now = Date.now();
  if (typeof payload.exp !== "number" || payload.exp < now) return { ok: false, reason: "expired" };
  if (!payload.key || typeof payload.key !== "string") return { ok: false, reason: "missing_key" };

  return { ok: true, payload };
}

async function mintDownloadLink(env, key, orderNumber, minutes) {
  const exp = Date.now() + (minutes * 60 * 1000);
  const token = await signDownloadToken(env, { key, ord: orderNumber || "", exp });

  const base = env.PUBLIC_BASE_URL || "https://rf-webhooks.nmoloney1968.workers.dev";
  const u = new URL(base);
  u.pathname = "/dl";
  u.searchParams.set("token", token);
  return u.toString();
}

// -------------------- Receipt formatting helpers --------------------

function formatMoney(minorUnits, currency, decimals) {
  if (minorUnits === null || minorUnits === undefined) return null;
  const d = Number.isInteger(decimals) ? decimals : 2;
  const c = currency || "";
  const n = Number(minorUnits);

  if (!Number.isFinite(n)) return null;

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  const pow = 10 ** d;
  const major = Math.floor(abs / pow);
  const frac = (abs % pow).toString().padStart(d, "0");

  if (d === 0) return `${sign}${c} ${major}`;
  return `${sign}${c} ${major}.${frac}`;
}

function computeTotal(value, tax, fee) {
  const v = Number.isFinite(Number(value)) ? Number(value) : 0;
  const t = Number.isFinite(Number(tax)) ? Number(tax) : 0;
  const f = Number.isFinite(Number(fee)) ? Number(fee) : 0;
  return v + t + f;
}

// -------------------- Mailgun email --------------------

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailSubject(productId, orderNumber) {
  const base =
    productId === "RF-SMEAF-CH0"
      ? "Your Reporting Forge teaser is ready"
      : "Your personalized Reporting Forge book is ready";
  return orderNumber ? `${base} (Order ${orderNumber})` : base;
}

function buildFungiesPlaceholderNote(productId) {
  // Applies to purchases (full book). CH0 is lead-driven and does not use Fungies delivery.
  if (productId === "RF-SMEAF-CH0") return null;

  return {
    text:
      "Note: You may also receive a separate email from Fungies with a download link.\n" +
      "That download is only a placeholder (delivery instructions). Use the secure link in THIS email for your personalized PDF.\n",
    html:
      `<div style="margin:14px 0 12px 0;padding:10px 12px;border-radius:8px;border:1px solid #b45309;background:#fff7ed;color:#7c2d12;">
         <strong>Important</strong><br>
         You may also receive a separate email from Fungies with a download link.
         That download is only a placeholder (delivery instructions).
         Use the secure link in <strong>this email</strong> for your personalized PDF.
       </div>`,
  };
}

function buildEmailBodies({
  firstName,
  lastName,
  orderNumber,
  downloadUrl,
  productId,
  supportEmail,
  totalDisplay,
  invoiceUrl,
}) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || "there";
  const expiresText = "This link expires in 7 days.";

  const productName =
    productId === "RF-SMEAF-CH0"
      ? "The SME Automation Lab - Teaser (Chapter 0)"
      : "The SME Automation Lab (Full Book)";

  const support = supportEmail || "hello@reportingforge.com";

  const invoiceLineText = invoiceUrl ? `Invoice: ${invoiceUrl}\n\n` : "";
  const totalLineText = totalDisplay ? `Total: ${totalDisplay}\n` : "";

  const fungiesNote = buildFungiesPlaceholderNote(productId);
  const fungiesTextNote = fungiesNote ? `\n${fungiesNote.text}\n` : "\n";

  const text =
`Hi ${name},

This is your personalized copy from Reporting Forge.

Item: ${productName}
Reference: ${orderNumber}
${totalLineText}${invoiceLineText}Download:
${downloadUrl}
${fungiesTextNote}${expiresText}

If the link does not open, copy and paste it into your browser.
If you need help, reply to this email or contact ${support}.

Reporting Forge`;

  const invoiceRowHtml = invoiceUrl
    ? `<tr>
         <td style="padding:4px 10px 4px 0;color:#555;">Invoice</td>
         <td style="padding:4px 0;"><a href="${escapeHtml(invoiceUrl)}">View invoice</a></td>
       </tr>`
    : "";

  const totalRowHtml = totalDisplay
    ? `<tr>
         <td style="padding:4px 10px 4px 0;color:#555;">Total</td>
         <td style="padding:4px 0;"><strong>${escapeHtml(totalDisplay)}</strong></td>
       </tr>`
    : "";

  const fungiesHtmlNote = fungiesNote ? fungiesNote.html : "";

  const html =
`<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#111;">
  <p>Hi ${escapeHtml(name)},</p>

  <p><strong>This is your personalized copy</strong> from <strong>Reporting Forge</strong>.</p>

  <table style="border-collapse:collapse;margin:12px 0;">
    <tr>
      <td style="padding:4px 10px 4px 0;color:#555;">Item</td>
      <td style="padding:4px 0;"><strong>${escapeHtml(productName)}</strong></td>
    </tr>
    <tr>
      <td style="padding:4px 10px 4px 0;color:#555;">Reference</td>
      <td style="padding:4px 0;"><strong>${escapeHtml(orderNumber)}</strong></td>
    </tr>
    ${totalRowHtml}
    ${invoiceRowHtml}
  </table>

  ${fungiesHtmlNote}

  <p style="margin:16px 0 10px 0;"><strong>Download your personalized PDF</strong></p>

  <p style="margin:0 0 14px 0;">
    <a href="${escapeHtml(downloadUrl)}"
       style="display:inline-block;padding:10px 14px;border-radius:6px;background:#0b5fff;color:#fff;text-decoration:none;">
      Download now
    </a>
  </p>

  <p style="color:#555;margin:0 0 12px 0;">${escapeHtml(expiresText)}</p>

  <p style="margin:0 0 8px 0;color:#555;">
    If the button does not work:
    <a href="${escapeHtml(downloadUrl)}">Copy download link</a>
  </p>

  <p style="margin:14px 0 0 0;color:#555;">
    Need help? Reply to this email or contact
    <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a>.
  </p>

  <p style="margin:18px 0 0 0;color:#777;font-size:12px;">
    You are receiving this email because a request was made using this address.
  </p>
</div>`;

  return { text, html };
}

function basicAuthHeader(user, pass) {
  const token = btoa(`${user}:${pass}`);
  return `Basic ${token}`;
}

async function sendEmailMailgun(env, { to, subject, textBody, htmlBody }) {
  if (!env.MAILGUN_API_KEY) throw new Error("missing_mailgun_api_key");
  if (!env.MAILGUN_DOMAIN) throw new Error("missing_mailgun_domain");
  if (!env.MAILGUN_API_BASE) throw new Error("missing_mailgun_api_base");
  if (!env.MAIL_FROM) throw new Error("missing_mail_from");

  const endpoint = `${env.MAILGUN_API_BASE.replace(/\/$/, "")}/v3/${env.MAILGUN_DOMAIN}/messages`;

  const form = new URLSearchParams();
  form.set("from", env.MAIL_FROM);
  form.set("to", to);
  form.set("subject", subject);
  form.set("text", textBody);
  form.set("html", htmlBody);
  if (env.REPLY_TO) form.set("h:Reply-To", env.REPLY_TO);

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: basicAuthHeader("api", env.MAILGUN_API_KEY),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const text = await resp.text();
  if (!resp.ok) throw new Error(`mailgun_failed: http_${resp.status} ${text}`);

  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { messageId: data?.id || null };
}

// -------------------- Job enqueue (paid flow via Fungies) --------------------

async function enqueueFulfillmentJob(env, parsedPayload) {
  if (parsedPayload?.type !== "payment_success") return;

  const idempotencyKey = parsedPayload?.idempotencyKey || parsedPayload?.id;

  const order = parsedPayload?.data?.order || {};
  const payment = parsedPayload?.data?.payment || {};

  const orderNumber = order?.number || payment?.orderNumber || parsedPayload?.data?.orderNumber;
  const orderId = order?.id || payment?.orderId;
  const createdAtMs = order?.createdAt || payment?.createdAt;

  const currency = order?.currency || payment?.currency || null;
  const currencyDecimals = Number.isInteger(order?.currencyDecimals)
    ? order.currencyDecimals
    : Number.isInteger(payment?.currencyDecimals)
      ? payment.currencyDecimals
      : 2;

  const value = Number.isFinite(Number(order?.value)) ? Number(order.value) : null;
  const tax = Number.isFinite(Number(order?.tax)) ? Number(order.tax) : null;
  const fee = Number.isFinite(Number(order?.fee)) ? Number(order.fee) : null;

  const invoiceUrl = payment?.invoiceUrl || null;

  const total = computeTotal(value, tax, fee);
  const totalDisplay = currency ? formatMoney(total, currency, currencyDecimals) : null;

  const customer = parsedPayload?.data?.customer || parsedPayload?.data?.user;
  const buyerEmail = customer?.email;
  const firstName = customer?.details?.firstName || "";
  const lastName = customer?.details?.lastName || "";

  const productInternalIdRaw = parsedPayload?.data?.items?.[0]?.product?.internalId;
  const productInternalId = normalizeProductId(productInternalIdRaw);
  const masterKey = PRODUCT_TO_MASTER[productInternalIdRaw] || PRODUCT_TO_MASTER[productInternalId];

  const createdAtUtc =
    typeof createdAtMs === "number" ? new Date(createdAtMs).toISOString() : new Date().toISOString();

  if (!idempotencyKey || !orderNumber || !buyerEmail || !productInternalId || !masterKey) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO fulfillment_jobs
       (idempotency_key, event_id, order_id, order_number, product_internal_id,
        buyer_email, buyer_first_name, buyer_last_name, created_at_utc,
        master_key, output_key, status, attempt_count, next_attempt_at, last_error, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FAILED', 0, ?, ?, ?)`
    ).bind(
      idempotencyKey || crypto.randomUUID(),
      parsedPayload?.id || null,
      orderId || null,
      orderNumber || null,
      productInternalIdRaw || null,
      buyerEmail || null,
      firstName || null,
      lastName || null,
      createdAtUtc,
      masterKey || null,
      null,
      Date.now(),
      "missing_required_fields",
      Date.now()
    ).run();
    return;
  }

  const outputKey = `fulfillment/${productInternalId}/${orderNumber}.pdf`;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO fulfillment_jobs
     (idempotency_key, event_id, order_id, order_number, product_internal_id,
      buyer_email, buyer_first_name, buyer_last_name, created_at_utc,
      master_key, output_key, status, attempt_count, next_attempt_at, last_error, updated_at,
      currency, currency_decimals, value, tax, fee, invoice_url, total_display)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_STAMP', 0, ?, NULL, ?,
             ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    idempotencyKey,
    parsedPayload?.id || null,
    orderId,
    orderNumber,
    productInternalId,
    buyerEmail,
    firstName,
    lastName,
    createdAtUtc,
    masterKey,
    outputKey,
    Date.now(),
    Date.now(),
    currency,
    currencyDecimals,
    value,
    tax,
    fee,
    invoiceUrl,
    totalDisplay
  ).run();
}

// Optional event storage (ignored if table not present)
async function insertFungiesEvent(env, rawJsonText, parsedPayload) {
  try {
    await env.DB.prepare(
      `INSERT INTO fungies_events (event_id, event_type, test_mode, created_at, payload_json)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      parsedPayload?.id || null,
      parsedPayload?.type || null,
      parsedPayload?.testMode ? 1 : 0,
      Date.now(),
      rawJsonText
    ).run();
  } catch {}
}

// -------------------- Cron processing --------------------

function computeBackoffMs(attemptCount) {
  const scheduleSec = [30, 60, 120, 300, 300, 300, 300, 300, 300, 300];
  const idx = Math.min(Math.max(attemptCount - 1, 0), scheduleSec.length - 1);
  return scheduleSec[idx] * 1000;
}

async function claimJobs(env, limit = 5) {
  const now = Date.now();
  const rs = await env.DB.prepare(
    `SELECT idempotency_key, order_number, product_internal_id,
            buyer_email, buyer_first_name, buyer_last_name, created_at_utc,
            master_key, output_key, status, attempt_count,
            total_display, invoice_url
     FROM fulfillment_jobs
     WHERE status IN ('PENDING_STAMP','FAILED','STAMPED','STAMPING')
       AND next_attempt_at <= ?
       AND attempt_count < 10
     ORDER BY next_attempt_at ASC
     LIMIT ?`
  ).bind(now, limit).all();

  const jobs = rs.results || [];
  const claimed = [];

  for (const job of jobs) {
    const upd = await env.DB.prepare(
      `UPDATE fulfillment_jobs
       SET status = CASE
         WHEN status='STAMPED' THEN 'STAMPED'
         ELSE 'STAMPING'
       END,
       updated_at=?
       WHERE idempotency_key=?
         AND status IN ('PENDING_STAMP','FAILED','STAMPED')
         AND next_attempt_at <= ?`
    ).bind(Date.now(), job.idempotency_key, now).run();

    if (upd.success && upd.meta && upd.meta.changes === 1) claimed.push(job);
  }

  return claimed;
}

async function callStamper(env, job) {
  const url = `${env.STAMPER_URL}/stamp`;
  const payload = {
    masterKey: job.master_key,
    outputKey: job.output_key,
    firstName: job.buyer_first_name || "",
    lastName: job.buyer_last_name || "",
    email: job.buyer_email,
    orderNumber: job.order_number,
    createdAtUtc: job.created_at_utc,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STAMPER_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}

  if (!resp.ok || !data?.ok) {
    const detail = data?.detail || data?.error || text || `http_${resp.status}`;
    throw new Error(`stamper_failed: ${detail}`);
  }

  return data;
}

async function processFulfillmentJobs(env) {
  const claimed = await claimJobs(env, 5);
  if (!claimed.length) return;

  for (const job of claimed) {
    try {
      if (job.status !== "STAMPED") {
        const stamped = await callStamper(env, job);

        await env.DB.prepare(
          `UPDATE fulfillment_jobs
           SET status='STAMPED',
               stamped_sha256=?,
               stamper_tag=?,
               stamped_at_utc=?,
               last_error=NULL,
               updated_at=?
           WHERE idempotency_key=?`
        ).bind(
          stamped.sha256 || null,
          stamped.tag || null,
          new Date().toISOString(),
          Date.now(),
          job.idempotency_key
        ).run();
      }

      const downloadUrl = await mintDownloadLink(env, job.output_key, job.order_number, 10080);
      const subject = buildEmailSubject(job.product_internal_id, job.order_number);

      const bodies = buildEmailBodies({
        firstName: job.buyer_first_name,
        lastName: job.buyer_last_name,
        orderNumber: job.order_number,
        downloadUrl,
        productId: job.product_internal_id,
        supportEmail: env.REPLY_TO || "hello@reportingforge.com",
        totalDisplay: job.total_display || null,
        invoiceUrl: job.invoice_url || null,
      });

      const sent = await sendEmailMailgun(env, {
        to: job.buyer_email,
        subject,
        textBody: bodies.text,
        htmlBody: bodies.html,
      });

      await env.DB.prepare(
        `UPDATE fulfillment_jobs
         SET status='EMAILED',
             email_message_id=?,
             last_error=NULL,
             updated_at=?
         WHERE idempotency_key=?`
      ).bind(sent.messageId, Date.now(), job.idempotency_key).run();
    } catch (err) {
      const attemptCount = (job.attempt_count || 0) + 1;
      const nextAttemptAt = Date.now() + computeBackoffMs(attemptCount);

      await env.DB.prepare(
        `UPDATE fulfillment_jobs
         SET status='FAILED',
             attempt_count=?,
             next_attempt_at=?,
             last_error=?,
             updated_at=?
         WHERE idempotency_key=?`
      ).bind(
        attemptCount,
        nextAttemptAt,
        String(err && err.message ? err.message : err),
        Date.now(),
        job.idempotency_key
      ).run();
    }
  }
}

// -------------------- /dl handler --------------------

async function handleDownload(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const ver = await verifyDownloadToken(env, token);
  if (!ver.ok) return new Response(`Invalid link: ${ver.reason}`, { status: 403 });

  const key = ver.payload.key;

  const obj = await env.rf_books.get(key);
  if (!obj) {
    return new Response(
      "Your personalized PDF is still being prepared. Please try again in 1 to 2 minutes.",
      { status: 404 }
    );
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("content-type", "application/pdf");
  headers.set("cache-control", "no-store");
  return new Response(obj.body, { headers });
}

// -------------------- /admin handlers --------------------

async function readJson(request) {
  const text = await request.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function handleAdminMintLink(request, env) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  if (request.method !== "POST") return new Response("Not found", { status: 404 });

  const body = await readJson(request);
  const key = body?.key;
  const orderNumber = body?.orderNumber || "";
  const minutes = Number.isFinite(Number(body?.minutes)) ? Number(body.minutes) : 10080;

  if (!key || typeof key !== "string") return jsonResponse({ ok: false, error: "missing_key" }, 400);

  const url = await mintDownloadLink(env, key, orderNumber, minutes);
  return jsonResponse({ ok: true, url });
}

async function handleAdminResend(request, env) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  if (request.method !== "POST") return new Response("Not found", { status: 404 });

  const body = await readJson(request);
  const orderNumber = body?.orderNumber;

  if (!orderNumber || typeof orderNumber !== "string") {
    return jsonResponse({ ok: false, error: "missing_orderNumber" }, 400);
  }

  const rs = await env.DB.prepare(
    `SELECT idempotency_key, status, output_key
     FROM fulfillment_jobs
     WHERE order_number = ?
     ORDER BY updated_at DESC
     LIMIT 1`
  ).bind(orderNumber).all();

  const job = rs.results?.[0];
  if (!job) return jsonResponse({ ok: false, error: "order_not_found" }, 404);

  const nowMs = Date.now();

  const desiredStatus =
    job.status === "PENDING_STAMP" || job.status === "STAMPING"
      ? "PENDING_STAMP"
      : (job.status === "FAILED" ? "PENDING_STAMP" : "STAMPED");

  await env.DB.prepare(
    `UPDATE fulfillment_jobs
     SET status=?,
         next_attempt_at=?,
         last_error=NULL,
         updated_at=?
     WHERE idempotency_key=?`
  ).bind(desiredStatus, nowMs, nowMs, job.idempotency_key).run();

  return jsonResponse({ ok: true, orderNumber, queued_as: desiredStatus });
}

// -------------------- Worker entrypoints --------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") return jsonResponse({ ok: true });

    if (url.pathname === "/dl") return handleDownload(request, env);

    if (url.pathname === "/admin/mint-link") return handleAdminMintLink(request, env);

    if (url.pathname === "/admin/resend") return handleAdminResend(request, env);

    if (url.pathname === "/lead") return handleLead(request, env);

    if (url.pathname === "/fungies/webhook" && request.method === "POST") {
      const rawBody = await request.arrayBuffer();
      const rawBytes = new Uint8Array(rawBody);
      const sig = request.headers.get("x-fngs-signature");

      const okSig = await verifyFungiesSignature(env, rawBytes, sig);
      if (!okSig) return jsonResponse({ ok: false, error: "bad_signature" }, 401);

      const rawText = new TextDecoder().decode(rawBytes);
      let payload;
      try { payload = JSON.parse(rawText); }
      catch { return jsonResponse({ ok: false, error: "bad_json" }, 400); }

      ctx.waitUntil(insertFungiesEvent(env, rawText, payload));
      ctx.waitUntil(enqueueFulfillmentJob(env, payload));

      return jsonResponse({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(processFulfillmentJobs(env));
  },
};
