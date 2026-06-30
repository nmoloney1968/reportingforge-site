import FIFA_MATCH_IDS from './fifa-match-ids.js';
import KNOCKOUT_MATCH_IDS from './fifa-knockout-match-ids.js';

const API_URL = 'https://worldcup26.ir/get/games';
const SOURCE_LABEL = 'worldcup26.ir/get/games';
const FIFA_LIVE_BASE_URL = 'https://api.fifa.com/api/v3/live/football';
const FIFA_LIVE_TIMEOUT_MS = 7000;
const FIFA_MAX_ENRICHMENT_CALLS = 12;

let MATCH_KICKOFF_MAP = {};
const KV_KEY = 'worldcup2026-results';
const STATUS_KEY = 'worldcup2026-poller-status';
const LAST_ERROR_KEY = 'worldcup2026-last-error';
const SLOT_MS = 3 * 60 * 1000;
const GROUP_STAGE_POLL_START_MINUTES = 0;
const GROUP_STAGE_POLL_END_MINUTES = 150;
const GROUP_STAGE_EMERGENCY_POLL_END_MINUTES = 210;
const KNOCKOUT_POLL_END_MINUTES = 240;
const SCHEDULED_SOURCE_FETCH_OFFSET_SECONDS = 5;
const SLOT_CLAIM_TTL_SECONDS = 60 * 60 * 24 * 45;
const USAGE_TTL_SECONDS = 60 * 60 * 24 * 3;

// Merge FIFA match IDs for enrichment: group stage + knockout
const ALL_FIFA_MATCH_IDS = { ...FIFA_MATCH_IDS, ...KNOCKOUT_MATCH_IDS };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Group-stage schedule only, based on the Hanoi-time page. Stored in UTC for polling.
const GROUP_STAGE_SCHEDULE = [
  {
    "match": "Mexico vs South Africa",
    "group": "Group A",
    "kickoffUtc": "2026-06-11T19:00:00Z"
  },
  {
    "match": "South Korea vs Czech Republic",
    "group": "Group A",
    "kickoffUtc": "2026-06-12T02:00:00Z"
  },
  {
    "match": "Canada vs Bosnia & Herzegovina",
    "group": "Group B",
    "kickoffUtc": "2026-06-12T19:00:00Z"
  },
  {
    "match": "USA vs Paraguay",
    "group": "Group D",
    "kickoffUtc": "2026-06-13T01:00:00Z"
  },
  {
    "match": "Qatar vs Switzerland",
    "group": "Group B",
    "kickoffUtc": "2026-06-13T19:00:00Z"
  },
  {
    "match": "Brazil vs Morocco",
    "group": "Group C",
    "kickoffUtc": "2026-06-13T22:00:00Z"
  },
  {
    "match": "Haiti vs Scotland",
    "group": "Group C",
    "kickoffUtc": "2026-06-14T01:00:00Z"
  },
  {
    "match": "Australia vs Turkey",
    "group": "Group D",
    "kickoffUtc": "2026-06-14T04:00:00Z"
  },
  {
    "match": "Germany vs Curacao",
    "group": "Group E",
    "kickoffUtc": "2026-06-14T17:00:00Z"
  },
  {
    "match": "Netherlands vs Japan",
    "group": "Group F",
    "kickoffUtc": "2026-06-14T20:00:00Z"
  },
  {
    "match": "Ivory Coast vs Ecuador",
    "group": "Group E",
    "kickoffUtc": "2026-06-14T23:00:00Z"
  },
  {
    "match": "Sweden vs Tunisia",
    "group": "Group F",
    "kickoffUtc": "2026-06-15T02:00:00Z"
  },
  {
    "match": "Spain vs Cape Verde",
    "group": "Group H",
    "kickoffUtc": "2026-06-15T16:00:00Z"
  },
  {
    "match": "Belgium vs Egypt",
    "group": "Group G",
    "kickoffUtc": "2026-06-15T19:00:00Z"
  },
  {
    "match": "Saudi Arabia vs Uruguay",
    "group": "Group H",
    "kickoffUtc": "2026-06-15T22:00:00Z"
  },
  {
    "match": "Iran vs New Zealand",
    "group": "Group G",
    "kickoffUtc": "2026-06-16T01:00:00Z"
  },
  {
    "match": "France vs Senegal",
    "group": "Group I",
    "kickoffUtc": "2026-06-16T19:00:00Z"
  },
  {
    "match": "Iraq vs Norway",
    "group": "Group I",
    "kickoffUtc": "2026-06-16T22:00:00Z"
  },
  {
    "match": "Argentina vs Algeria",
    "group": "Group J",
    "kickoffUtc": "2026-06-17T01:00:00Z"
  },
  {
    "match": "Austria vs Jordan",
    "group": "Group J",
    "kickoffUtc": "2026-06-17T04:00:00Z"
  },
  {
    "match": "Portugal vs DR Congo",
    "group": "Group K",
    "kickoffUtc": "2026-06-17T17:00:00Z"
  },
  {
    "match": "England vs Croatia",
    "group": "Group L",
    "kickoffUtc": "2026-06-17T20:00:00Z"
  },
  {
    "match": "Ghana vs Panama",
    "group": "Group L",
    "kickoffUtc": "2026-06-17T23:00:00Z"
  },
  {
    "match": "Uzbekistan vs Colombia",
    "group": "Group K",
    "kickoffUtc": "2026-06-18T02:00:00Z"
  },
  {
    "match": "Czech Republic vs South Africa",
    "group": "Group A",
    "kickoffUtc": "2026-06-18T16:00:00Z"
  },
  {
    "match": "Switzerland vs Bosnia & Herzegovina",
    "group": "Group B",
    "kickoffUtc": "2026-06-18T19:00:00Z"
  },
  {
    "match": "Canada vs Qatar",
    "group": "Group B",
    "kickoffUtc": "2026-06-18T22:00:00Z"
  },
  {
    "match": "Mexico vs South Korea",
    "group": "Group A",
    "kickoffUtc": "2026-06-19T01:00:00Z"
  },
  {
    "match": "USA vs Australia",
    "group": "Group D",
    "kickoffUtc": "2026-06-19T19:00:00Z"
  },
  {
    "match": "Scotland vs Morocco",
    "group": "Group C",
    "kickoffUtc": "2026-06-19T22:00:00Z"
  },
  {
    "match": "Brazil vs Haiti",
    "group": "Group C",
    "kickoffUtc": "2026-06-20T00:30:00Z"
  },
  {
    "match": "Turkey vs Paraguay",
    "group": "Group D",
    "kickoffUtc": "2026-06-20T03:00:00Z"
  },
  {
    "match": "Netherlands vs Sweden",
    "group": "Group F",
    "kickoffUtc": "2026-06-20T17:00:00Z"
  },
  {
    "match": "Germany vs Ivory Coast",
    "group": "Group E",
    "kickoffUtc": "2026-06-20T20:00:00Z"
  },
  {
    "match": "Ecuador vs Curacao",
    "group": "Group E",
    "kickoffUtc": "2026-06-21T00:00:00Z"
  },
  {
    "match": "Tunisia vs Japan",
    "group": "Group F",
    "kickoffUtc": "2026-06-21T04:00:00Z"
  },
  {
    "match": "Spain vs Saudi Arabia",
    "group": "Group H",
    "kickoffUtc": "2026-06-21T16:00:00Z"
  },
  {
    "match": "Belgium vs Iran",
    "group": "Group G",
    "kickoffUtc": "2026-06-21T19:00:00Z"
  },
  {
    "match": "Uruguay vs Cape Verde",
    "group": "Group H",
    "kickoffUtc": "2026-06-21T22:00:00Z"
  },
  {
    "match": "New Zealand vs Egypt",
    "group": "Group G",
    "kickoffUtc": "2026-06-22T01:00:00Z"
  },
  {
    "match": "Argentina vs Austria",
    "group": "Group J",
    "kickoffUtc": "2026-06-22T17:00:00Z"
  },
  {
    "match": "France vs Iraq",
    "group": "Group I",
    "kickoffUtc": "2026-06-22T21:00:00Z"
  },
  {
    "match": "Norway vs Senegal",
    "group": "Group I",
    "kickoffUtc": "2026-06-23T00:00:00Z"
  },
  {
    "match": "Jordan vs Algeria",
    "group": "Group J",
    "kickoffUtc": "2026-06-23T03:00:00Z"
  },
  {
    "match": "Portugal vs Uzbekistan",
    "group": "Group K",
    "kickoffUtc": "2026-06-23T17:00:00Z"
  },
  {
    "match": "England vs Ghana",
    "group": "Group L",
    "kickoffUtc": "2026-06-23T20:00:00Z"
  },
  {
    "match": "Panama vs Croatia",
    "group": "Group L",
    "kickoffUtc": "2026-06-23T23:00:00Z"
  },
  {
    "match": "Colombia vs DR Congo",
    "group": "Group K",
    "kickoffUtc": "2026-06-24T02:00:00Z"
  },
  {
    "match": "Switzerland vs Canada",
    "group": "Group B",
    "kickoffUtc": "2026-06-24T19:00:00Z"
  },
  {
    "match": "Bosnia & Herzegovina vs Qatar",
    "group": "Group B",
    "kickoffUtc": "2026-06-24T19:00:00Z"
  },
  {
    "match": "Morocco vs Haiti",
    "group": "Group C",
    "kickoffUtc": "2026-06-24T22:00:00Z"
  },
  {
    "match": "Scotland vs Brazil",
    "group": "Group C",
    "kickoffUtc": "2026-06-24T22:00:00Z"
  },
  {
    "match": "South Africa vs South Korea",
    "group": "Group A",
    "kickoffUtc": "2026-06-25T01:00:00Z"
  },
  {
    "match": "Czech Republic vs Mexico",
    "group": "Group A",
    "kickoffUtc": "2026-06-25T01:00:00Z"
  },
  {
    "match": "Curacao vs Ivory Coast",
    "group": "Group E",
    "kickoffUtc": "2026-06-25T20:00:00Z"
  },
  {
    "match": "Ecuador vs Germany",
    "group": "Group E",
    "kickoffUtc": "2026-06-25T20:00:00Z"
  },
  {
    "match": "Tunisia vs Netherlands",
    "group": "Group F",
    "kickoffUtc": "2026-06-25T23:00:00Z"
  },
  {
    "match": "Japan vs Sweden",
    "group": "Group F",
    "kickoffUtc": "2026-06-25T23:00:00Z"
  },
  {
    "match": "Turkey vs USA",
    "group": "Group D",
    "kickoffUtc": "2026-06-26T02:00:00Z"
  },
  {
    "match": "Paraguay vs Australia",
    "group": "Group D",
    "kickoffUtc": "2026-06-26T02:00:00Z"
  },
  {
    "match": "Norway vs France",
    "group": "Group I",
    "kickoffUtc": "2026-06-26T19:00:00Z"
  },
  {
    "match": "Senegal vs Iraq",
    "group": "Group I",
    "kickoffUtc": "2026-06-26T19:00:00Z"
  },
  {
    "match": "Cape Verde vs Saudi Arabia",
    "group": "Group H",
    "kickoffUtc": "2026-06-27T00:00:00Z"
  },
  {
    "match": "Uruguay vs Spain",
    "group": "Group H",
    "kickoffUtc": "2026-06-27T00:00:00Z"
  },
  {
    "match": "New Zealand vs Belgium",
    "group": "Group G",
    "kickoffUtc": "2026-06-27T03:00:00Z"
  },
  {
    "match": "Egypt vs Iran",
    "group": "Group G",
    "kickoffUtc": "2026-06-27T03:00:00Z"
  },
  {
    "match": "Panama vs England",
    "group": "Group L",
    "kickoffUtc": "2026-06-27T21:00:00Z"
  },
  {
    "match": "Croatia vs Ghana",
    "group": "Group L",
    "kickoffUtc": "2026-06-27T21:00:00Z"
  },
  {
    "match": "Colombia vs Portugal",
    "group": "Group K",
    "kickoffUtc": "2026-06-27T23:30:00Z"
  },
  {
    "match": "DR Congo vs Uzbekistan",
    "group": "Group K",
    "kickoffUtc": "2026-06-27T23:30:00Z"
  },
  {
    "match": "Algeria vs Austria",
    "group": "Group J",
    "kickoffUtc": "2026-06-28T02:00:00Z"
  },
  {
    "match": "Jordan vs Argentina",
    "group": "Group J",
    "kickoffUtc": "2026-06-28T02:00:00Z"
  }
];

// Knockout stage schedule: Round of 32, 16 matches, in chronological Hanoi (ICT) order
const KNOCKOUT_SCHEDULE = [
  // M73
  { "match": "South Africa vs Canada", "round": "Round of 32", "matchNumber": 73, "kickoffUtc": "2026-06-28T19:00:00Z" },
  // M76
  { "match": "Brazil vs Japan", "round": "Round of 32", "matchNumber": 76, "kickoffUtc": "2026-06-29T17:00:00Z" },
  // M74
  { "match": "Germany vs Paraguay", "round": "Round of 32", "matchNumber": 74, "kickoffUtc": "2026-06-29T20:30:00Z" },
  // M75
  { "match": "Netherlands vs Morocco", "round": "Round of 32", "matchNumber": 75, "kickoffUtc": "2026-06-30T01:00:00Z" },
  // M78
  { "match": "Ivory Coast vs Norway", "round": "Round of 32", "matchNumber": 78, "kickoffUtc": "2026-06-30T17:00:00Z" },
  // M77
  { "match": "France vs Sweden", "round": "Round of 32", "matchNumber": 77, "kickoffUtc": "2026-06-30T21:00:00Z" },
  // M79
  { "match": "Mexico vs Ecuador", "round": "Round of 32", "matchNumber": 79, "kickoffUtc": "2026-07-01T01:00:00Z" },
  // M80
  { "match": "England vs DR Congo", "round": "Round of 32", "matchNumber": 80, "kickoffUtc": "2026-07-01T16:00:00Z" },
  // M82
  { "match": "Belgium vs Senegal", "round": "Round of 32", "matchNumber": 82, "kickoffUtc": "2026-07-01T20:00:00Z" },
  // M81
  { "match": "USA vs Bosnia & Herzegovina", "round": "Round of 32", "matchNumber": 81, "kickoffUtc": "2026-07-02T00:00:00Z" },
  // M84
  { "match": "Spain vs Austria", "round": "Round of 32", "matchNumber": 84, "kickoffUtc": "2026-07-02T19:00:00Z" },
  // M83
  { "match": "Portugal vs Croatia", "round": "Round of 32", "matchNumber": 83, "kickoffUtc": "2026-07-02T23:00:00Z" },
  // M85
  { "match": "Switzerland vs Algeria", "round": "Round of 32", "matchNumber": 85, "kickoffUtc": "2026-07-03T03:00:00Z" },
  // M88
  { "match": "Australia vs Egypt", "round": "Round of 32", "matchNumber": 88, "kickoffUtc": "2026-07-03T18:00:00Z" },
  // M86
  { "match": "Argentina vs Cape Verde", "round": "Round of 32", "matchNumber": 86, "kickoffUtc": "2026-07-03T22:00:00Z" },
  // M87
  { "match": "Colombia vs Ghana", "round": "Round of 32", "matchNumber": 87, "kickoffUtc": "2026-07-04T01:30:00Z" }
];

// Source/FIFA naming can differ from the page naming. Canonicalize here so the static HTML can match reliably.
const TEAM_ALIASES = new Map([
  ['bosnia and herzegovina', 'Bosnia & Herzegovina'],
  ['bosnia herzgovina', 'Bosnia & Herzegovina'],
  ['bosnia herzegovina', 'Bosnia & Herzegovina'],
  ['bosnia-herzegovina', 'Bosnia & Herzegovina'],
  ['cabo verde', 'Cape Verde'],
  ['cape verde', 'Cape Verde'],
  ['congo dr', 'DR Congo'],
  ['congo d r', 'DR Congo'],
  ['dr congo', 'DR Congo'],
  ['democratic republic of the congo', 'DR Congo'],
  ['cote divoire', 'Ivory Coast'],
  ['cote d ivoire', 'Ivory Coast'],
  ["cote d'ivoire", 'Ivory Coast'],
  ['côte divoire', 'Ivory Coast'],
  ["côte d'ivoire", 'Ivory Coast'],
  ['ivory coast', 'Ivory Coast'],
  ['curacao', 'Curacao'],
  ['curaçao', 'Curacao'],
  ['czechia', 'Czech Republic'],
  ['czech republic', 'Czech Republic'],
  ['iran', 'Iran'],
  ['ir iran', 'Iran'],
  ['korea republic', 'South Korea'],
  ['south korea', 'South Korea'],
  ['turkiye', 'Turkey'],
  ['türkiye', 'Turkey'],
  ['turkey', 'Turkey'],
  ['united states', 'USA'],
  ['united states of america', 'USA'],
  ['usa', 'USA']
]);

// Build kickoff lookup: merge group stage and knockout schedules
for (const m of GROUP_STAGE_SCHEDULE) {
  MATCH_KICKOFF_MAP[m.match] = m.kickoffUtc;
}
for (const m of KNOCKOUT_SCHEDULE) {
  MATCH_KICKOFF_MAP[m.match] = m.kickoffUtc;
}

export default {
  async scheduled(event, env, ctx) {
    const scheduledAt = new Date(event.scheduledTime || Date.now());
    ctx.waitUntil(runScheduledRefresh(env, scheduledAt));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname.endsWith('/refresh')) {
      return handleManualRefresh(request, env, url);
    }

    if (url.pathname.endsWith('/status')) {
      return handleStatus(env);
    }

    const existing = await env.RESULTS.get(KV_KEY);
    if (existing) {
      return new Response(existing, {
        headers: {
          ...CORS_HEADERS,
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, max-age=60'
        }
      });
    }

    return json({ lastUpdated: 'No automated results available yet', matches: {} }, 200);
  }
};

function isKnockoutMatchKey(key) {
  return KNOCKOUT_SCHEDULE.some(m => m.match === key);
}

function anyKnockoutMatchInPollingWindow(nowMs) {
  for (const match of KNOCKOUT_SCHEDULE) {
    const kickoffMs = Date.parse(match.kickoffUtc);
    if (!Number.isFinite(kickoffMs)) continue;
    const msSinceKickoff = nowMs - kickoffMs;
    // Knockout polling window: kickoff +0 to +240 minutes
    if (msSinceKickoff >= 0 && msSinceKickoff <= KNOCKOUT_POLL_END_MINUTES * 60 * 1000) {
      return true;
    }
  }
  return false;
}

/**
 * Check if any non-finalized knockout match is still in its eligible polling window.
 * A match is "finalized" if the cached results show FT/AET/PEN status.
 * A cached FIFA-final match that is finalized will NOT keep the Worker active.
 */
function anyKnockoutMatchStillEligible(nowMs, cachedResult) {
  for (const match of KNOCKOUT_SCHEDULE) {
    const kickoffMs = Date.parse(match.kickoffUtc);
    if (!Number.isFinite(kickoffMs)) continue;
    const msSinceKickoff = nowMs - kickoffMs;
    // Must be within +240 minute window
    if (msSinceKickoff < 0 || msSinceKickoff > KNOCKOUT_POLL_END_MINUTES * 60 * 1000) continue;
    // Must not be a finalized match in cached results
    if (isMatchFinal(cachedResult, match.match)) continue;
    // Non-final match inside eligible window: active
    return true;
  }
  return false;
}

function anyGroupMatchInPollingWindow(nowMs) {
  // Group stage: from first kickoff to roughly the end of the last match
  const cutoffMs = Date.parse('2026-06-28T10:00:00Z'); // last group match ended ~02:00 UTC + 3h buffer
  if (nowMs > cutoffMs) return false;

  for (const match of GROUP_STAGE_SCHEDULE) {
    const kickoffMs = Date.parse(match.kickoffUtc);
    if (!Number.isFinite(kickoffMs)) continue;
    const msSinceKickoff = nowMs - kickoffMs;
    if (msSinceKickoff >= 0 && msSinceKickoff <= GROUP_STAGE_EMERGENCY_POLL_END_MINUTES * 60 * 1000) {
      return true;
    }
  }
  return false;
}

async function runScheduledRefresh(env, now) {
  const nowMs = now.getTime();

  // Load cached results to check for finalized matches
  const cachedResult = await loadCachedResults(env);

  // Determine if any match (group or knockout) is in its active polling window
  // For knockout, only consider non-finalized matches (cached FT/AET/PEN does not keep Worker active)
  const knockoutActive = anyKnockoutMatchStillEligible(nowMs, cachedResult);
  const groupActive = anyGroupMatchInPollingWindow(nowMs);

  // If no match is active, skip entirely
  // This prevents 1,440 KV writes per day
  if (!knockoutActive && !groupActive) {
    return {
      skipped: true,
      reason: 'No match in active polling window',
      checkedAtUtc: now.toISOString()
    };
  }

  const slot = await getCurrentPollingSlot(env, now);
  if (!slot && !knockoutActive) {
    return { skipped: true, reason: 'No approved polling slot', checkedAtUtc: now.toISOString() };
  }

  // When knockout is active, also refresh non-slot minutes
  const effectiveSlot = slot || {
    slotId: now.toISOString().slice(0, 16) + 'Z',
    slotUtc: now.toISOString(),
    dueMatchCount: 0,
    dueMatches: []
  };

  try {
    const sourceFetchAt = new Date(Date.parse(effectiveSlot.slotUtc) + SCHEDULED_SOURCE_FETCH_OFFSET_SECONDS * 1000);
    await waitUntilTime(sourceFetchAt);
    return await refreshResults(env, { mode: knockoutActive ? 'knockout' : 'scheduled', slot: effectiveSlot, now });
  } catch (error) {
    const failure = {
      error: String(error && error.message ? error.message : error),
      mode: knockoutActive ? 'knockout' : 'scheduled',
      slot: effectiveSlot,
      checkedAtUtc: now.toISOString()
    };
    // Only write error/status keys on error
    await putJson(env, LAST_ERROR_KEY, failure, USAGE_TTL_SECONDS);
    await putJson(env, STATUS_KEY, { ...failure, lastSuccessfulPayloadKept: true }, USAGE_TTL_SECONDS);
    return failure;
  }
}

function waitUntilTime(target) {
  const delayMs = target.getTime() - Date.now();
  if (delayMs <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function handleManualRefresh(request, env, url) {
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('token');
  if (!env.ADMIN_TOKEN || supplied !== env.ADMIN_TOKEN) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const now = new Date();
    const data = await refreshResults(env, { mode: 'manual', now });
    return json(data, 200);
  } catch (error) {
    return json({ error: String(error && error.message ? error.message : error) }, 500);
  }
}

async function handleStatus(env) {
  const status = await getJson(env, STATUS_KEY) || { status: 'No poller status yet' };
  const lastError = await getJson(env, LAST_ERROR_KEY);
  return json({ status, lastError }, 200);
}

function getDueMatchKeys(slot) {
  return new Set((slot?.dueMatches || []).map(d => d.match));
}

async function loadCachedResults(env) {
  const raw = await env.RESULTS.get(KV_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function parseScore(scoreStr) {
  if (!scoreStr) return null;
  const match = scoreStr.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  const homeScore = parseInt(match[1], 10);
  const awayScore = parseInt(match[2], 10);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  return { homeScore, awayScore };
}

function isMatchFinal(cachedResult, matchKey) {
  const match = cachedResult?.matches?.[matchKey];
  if (!match) return false;
  const status = String(match.status || '').toUpperCase();

  // PEN and AET are always final
  if (status === 'PEN' || status === 'AET') return true;

  // FT handling depends on match type and score
  if (status !== 'FT') return false;

  // Group stage: FT is always final
  if (!isKnockoutMatchKey(matchKey)) return true;

  // Knockout: FT is only final if the score is unequal.
  // A tied knockout score with FT status must NOT be treated as final,
  // so the match can resume polling for extra time detection.
  const parsed = parseScore(match.score);
  if (!parsed) {
    // Cannot parse score - be conservative for knockout matches:
    // treat as not final to avoid freezing a tied match that needs extra time
    return false;
  }

  // FT is final for knockout only when score is unequal
  return parsed.homeScore !== parsed.awayScore;
}

/**
 * WC26-R32-ET-012: Check if a cached FIFA entry is in a sticky knockout
 * shootout phase that must be preserved against worldcup26.ir fallback.
 *
 * Sticky statuses: PEN WAIT (pre-shootout interval), P (active shootout).
 * These are non-final phases that FIFA enrichment can advance forward
 * (PEN WAIT -> P -> PEN), but a fallback source must never regress.
 *
 * Does NOT include FT/AET/PEN (covered by isMatchFinal).
 * Does NOT include ET or ET HT (those are not part of the shootout phase).
 */
function isStickyFifaKnockoutState(entry) {
  const status = String(entry.status || '').toUpperCase();
  return status === 'PEN WAIT' || status === 'P';
}

/**
 * Determine if a match key should be considered for due-match polling.
 * Excludes FIFA final matches entirely.
 * Group stage: kickoff +0 to +150 (emergency +210 for LIVE/HT).
 * Knockout: kickoff +0 to +240 (every minute).
 */
function isMatchEligibleForPolling(cachedResult, matchKey, nowMs) {
  const kickoffUtc = MATCH_KICKOFF_MAP[matchKey];
  if (!kickoffUtc) return false;
  const kickoffMs = Date.parse(kickoffUtc);
  if (!Number.isFinite(kickoffMs)) return false;

  // Exclude final matches entirely
  if (isMatchFinal(cachedResult, matchKey)) return false;

  const msSinceKickoff = nowMs - kickoffMs;

  // Not yet at kickoff: exclude (no pre-kickoff polling)
  if (msSinceKickoff < 0) return false;

  if (isKnockoutMatchKey(matchKey)) {
    // Knockout: polling window kickoff +0 to +240 minutes
    const knockoutEndMs = KNOCKOUT_POLL_END_MINUTES * 60 * 1000;
    if (msSinceKickoff <= knockoutEndMs) return true;
    // Beyond +240: check if still LIVE (extra time, penalties could go long)
    if (msSinceKickoff <= knockoutEndMs + 30 * 60 * 1000) {
      const cachedMatch = cachedResult?.matches?.[matchKey];
      if (cachedMatch && !isMatchFinal(cachedResult, matchKey) && cachedMatch.status !== 'NS') {
        return true;
      }
    }
    return false;
  }

  // Group stage logic
  const normalEndMs = GROUP_STAGE_POLL_END_MINUTES * 60 * 1000;
  const emergencyEndMs = GROUP_STAGE_EMERGENCY_POLL_END_MINUTES * 60 * 1000;

  // Inside normal window (0 to +150)
  if (msSinceKickoff <= normalEndMs) return true;

  // Emergency extension: beyond +150 but still LIVE/HT, continue until +210
  if (msSinceKickoff <= emergencyEndMs) {
    const cachedMatch = cachedResult?.matches?.[matchKey];
    if (cachedMatch && (cachedMatch.status === 'LIVE' || cachedMatch.status === 'HT')) {
      return true;
    }
  }

  return false;
}

async function getCurrentPollingSlot(env, now) {
  const nowMs = now.getTime();
  const cachedResult = await loadCachedResults(env);
  const dueMatches = [];

  // Check group stage matches (3-minute cadence)
  for (const match of GROUP_STAGE_SCHEDULE) {
    if (!isMatchEligibleForPolling(cachedResult, match.match, nowMs)) continue;

    const kickoffMs = Date.parse(match.kickoffUtc);
    for (const offset of getOffsetsForMatch(match)) {
      const targetMs = kickoffMs + offset * 60 * 1000;
      const diff = Math.abs(targetMs - nowMs);
      if (diff < 90 * 1000) { // within 90 seconds
        dueMatches.push({ match: match.match, group: match.group || 'Group', offsetMinutes: offset });
      }
    }
  }

  // Check knockout matches (1-minute cadence, aligned to wall clock)
  for (const match of KNOCKOUT_SCHEDULE) {
    if (!isMatchEligibleForPolling(cachedResult, match.match, nowMs)) continue;

    const kickoffMs = Date.parse(match.kickoffUtc);
    const msSinceKickoff = nowMs - kickoffMs;
    const minuteSinceKickoff = Math.floor(msSinceKickoff / 60000);
    if (minuteSinceKickoff >= 0 && minuteSinceKickoff <= KNOCKOUT_POLL_END_MINUTES) {
      dueMatches.push({ match: match.match, group: match.round || 'Round of 32', offsetMinutes: minuteSinceKickoff });
    }
  }

  if (dueMatches.length === 0) return null;

  const slotDate = new Date(nowMs);
  return {
    slotId: slotDate.toISOString().slice(0, 16) + 'Z',
    slotUtc: slotDate.toISOString(),
    dueMatchCount: dueMatches.length,
    dueMatches
  };
}

function getOffsetsForMatch(match) {
  if (isKnockoutMatchKey(match.match)) {
    // Knockout: every minute from kickoff through +240 minutes
    const offsets = [];
    for (let minute = 0; minute <= KNOCKOUT_POLL_END_MINUTES; minute++) offsets.push(minute);
    return offsets;
  }

  // Group-stage games: every 3 minutes from kickoff through +150 minutes
  const offsets = [];
  for (let minute = GROUP_STAGE_POLL_START_MINUTES; minute <= GROUP_STAGE_POLL_END_MINUTES; minute += 3) offsets.push(minute);

  return offsets;
}

let _lastStatusWriteHour = -1;
let _lastWarningsJson = '';

function ensureCompleteScheduleCoverage(matches, cachedResult) {
  // Build default NS entries for all group-stage matches
  for (const m of GROUP_STAGE_SCHEDULE) {
    const key = m.match;
    if (!matches[key]) {
      // If cached has a final result, preserve it instead of creating default NS
      if (cachedResult && isMatchFinal(cachedResult, key)) {
        matches[key] = { ...cachedResult.matches[key] };
      } else {
        const [home, away] = key.split(' vs ');
        matches[key] = {
          status: 'NS',
          score: `${home} 0-0 ${away}`,
          note: formatRoundOrGroup(m.group)
        };
      }
    }
  }

  // Build default NS entries for all knockout matches
  for (const m of KNOCKOUT_SCHEDULE) {
    const key = m.match;
    if (!matches[key]) {
      // If cached has a final result, preserve it instead of creating default NS
      if (cachedResult && isMatchFinal(cachedResult, key)) {
        matches[key] = { ...cachedResult.matches[key] };
      } else {
        const [home, away] = key.split(' vs ');
        matches[key] = {
          status: 'NS',
          score: `${home} 0-0 ${away}`,
          note: formatRoundOrGroup(m.round || 'R32')
        };
      }
    }
  }
}

async function refreshResults(env, options = {}) {
  const now = options.now || new Date();

  // Step 1: Load cached result for FT preservation during coverage
  const cachedResult = await loadCachedResults(env);

  // Step 2: Fetch worldcup26.ir results
  const response = await fetch(API_URL, {
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`worldcup26.ir error ${response.status}: ${text.slice(0, 250)}`);
  }

  const api = await response.json();
  const games = extractGames(api);
  const matches = {};
  const warnings = [];

  // Step 3: Overlay worldcup26.ir results onto matches
  for (const item of games) {
    const home = canonicalTeamName(readString(item, [
      'home_team_name_en',
      'homeTeamNameEn',
      'home_team',
      'homeTeam',
      'home.name',
      'teams.home.name'
    ]));
    const away = canonicalTeamName(readString(item, [
      'away_team_name_en',
      'awayTeamNameEn',
      'away_team',
      'awayTeam',
      'away.name',
      'teams.away.name'
    ]));

    if (!home || !away) continue;

    const homeGoals = normalizeScore(readValue(item, ['home_score', 'homeScore', 'home_goals', 'homeGoals', 'goals.home']));
    const awayGoals = normalizeScore(readValue(item, ['away_score', 'awayScore', 'away_goals', 'awayGoals', 'goals.away']));
    const key = `${home} vs ${away}`;
    const status = getGameStatus(item);
    const elapsed = getElapsedDisplay(item, status);

    // WC26-R32-ET-012: Preserve authoritative FIFA knockout states.
    // A lower-priority source (worldcup26.ir/worldcup26.ir/get/games) must never
    // downgrade a cached FIFA result that is either:
    //   1. final under isMatchFinal(), or
    //   2. in a sticky shootout phase (PEN WAIT, P, AET).
    // This prevents a fallback FT result from regressing a match out of
    // extra time or penalties once FIFA has established those phases.
    // FIFA enrichment (Step 5) may still advance: PEN WAIT -> P -> PEN.
    const cachedEntry = cachedResult?.matches?.[key];
    if (cachedEntry?.source === 'fifa' && (isMatchFinal(cachedResult, key) || isStickyFifaKnockoutState(cachedEntry))) {
      matches[key] = { ...cachedEntry };
      continue;
    }

    matches[key] = {
      status,
      score: formatScore(home, away, homeGoals, awayGoals),
      note: formatRoundOrGroup(readString(item, ['group', 'league.round', 'round'])),
      ...(elapsed ? { elapsed } : {})
    };
  }

  // Step 4: Ensure all 88 scheduled matches are present
  // Default NS entries added for missing matches; cached FT results preserved
  ensureCompleteScheduleCoverage(matches, cachedResult);

  // Step 5: FIFA enrichment (highest priority)
  await enrichMatchesWithFifa(env, matches, warnings, options.slot);

  const warningsJson = JSON.stringify(warnings);
  const nowHour = now.getUTCHours();
  const data = {
    lastUpdated: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false }) + ' ICT',
    lastUpdatedUtc: new Date().toISOString(),
    source: SOURCE_LABEL,
    mode: options.mode || 'unknown',
    slot: options.slot || null,
    matchCount: Object.keys(matches).length,
    matches,
    warnings
  };

  // Write main results key every refresh (needed for live scoring)
  await env.RESULTS.put(KV_KEY, JSON.stringify(data, null, 2));

  // Write status key at most once per UTC hour, or when warnings change
  if (options.mode !== 'scheduled' || nowHour !== _lastStatusWriteHour || warningsJson !== _lastWarningsJson) {
    _lastStatusWriteHour = nowHour;
    _lastWarningsJson = warningsJson;
    await putJson(env, STATUS_KEY, {
      lastRefreshUtc: data.lastUpdatedUtc,
      mode: data.mode,
      slot: data.slot,
      matchCount: data.matchCount,
      warningCount: warnings.length
    }, USAGE_TTL_SECONDS);
  }

  return data;
}

function isRelevantForFifaEnrichment(key, dueMatchKeys, matchStatus, nowMs, cachedResult) {
  // Never enrich a final match (already confirmed)
  if (isMatchFinal(cachedResult, key)) return false;

  // Condition 1: match is in the current scheduled slot's dueMatches
  if (dueMatchKeys.has(key)) return true;

  // Condition 2: existing result has a live-ish status
  const liveStatuses = ['LIVE', 'HT', '1H', '2H', 'IN_PLAY', 'ET', 'ET HT', 'P', 'PEN WAIT'];
  if (liveStatuses.includes(matchStatus)) {
    const kickoffUtc = MATCH_KICKOFF_MAP[key];
    if (!kickoffUtc) return false;
    const kickoffMs = Date.parse(kickoffUtc);
    if (!Number.isFinite(kickoffMs)) return false;

    const msSinceKickoff = nowMs - kickoffMs;
    if (msSinceKickoff < 0) return false;

    const maxEndMs = isKnockoutMatchKey(key)
      ? (KNOCKOUT_POLL_END_MINUTES + 30) * 60 * 1000
      : GROUP_STAGE_EMERGENCY_POLL_END_MINUTES * 60 * 1000;

    return msSinceKickoff <= maxEndMs;
  }

  // Condition 3 & 4: kickoff time window
  const kickoffUtc = MATCH_KICKOFF_MAP[key];
  if (!kickoffUtc) return false;

  const kickoffMs = Date.parse(kickoffUtc);
  if (!Number.isFinite(kickoffMs)) return false;

  const msSinceKickoff = nowMs - kickoffMs;
  const maxEndMs = isKnockoutMatchKey(key)
    ? KNOCKOUT_POLL_END_MINUTES * 60 * 1000
    : GROUP_STAGE_POLL_END_MINUTES * 60 * 1000;

  return msSinceKickoff >= 0 && msSinceKickoff <= maxEndMs;
}

async function enrichMatchesWithFifa(env, matches, warnings, slot) {
  const nowMs = Date.now();
  const dueMatchKeys = getDueMatchKeys(slot);
  const cachedResult = await loadCachedResults(env);

  // Build candidate list from ALL FIFA match IDs (group + knockout)
  const candidates = [];
  for (const [key, fifaId] of Object.entries(ALL_FIFA_MATCH_IDS)) {
    const matchStatus = matches[key]?.status || '';
    if (isRelevantForFifaEnrichment(key, dueMatchKeys, matchStatus, nowMs, cachedResult)) {
      candidates.push({ key, fifaId, matchStatus });
    }
  }

  // Sort by relevance: due slot first, live status second, closest to kickoff third
  candidates.sort((a, b) => {
    const aIsDue = dueMatchKeys.has(a.key) ? 1 : 0;
    const bIsDue = dueMatchKeys.has(b.key) ? 1 : 0;
    if (aIsDue !== bIsDue) return bIsDue - aIsDue;

    const liveStatuses = ['LIVE', 'HT', '1H', '2H', 'IN_PLAY', 'ET', 'ET HT', 'P', 'PEN WAIT'];
    const aIsLive = liveStatuses.includes(a.matchStatus) ? 1 : 0;
    const bIsLive = liveStatuses.includes(b.matchStatus) ? 1 : 0;
    if (aIsLive !== bIsLive) return bIsLive - aIsLive;

    const aKickoff = Date.parse(MATCH_KICKOFF_MAP[a.key] || 0);
    const bKickoff = Date.parse(MATCH_KICKOFF_MAP[b.key] || 0);
    return Math.abs(aKickoff - nowMs) - Math.abs(bKickoff - nowMs);
  });

  // Cap at FIFA_MAX_ENRICHMENT_CALLS
  const toEnrich = candidates.slice(0, FIFA_MAX_ENRICHMENT_CALLS);
  if (candidates.length > FIFA_MAX_ENRICHMENT_CALLS) {
    const skippedCount = candidates.length - FIFA_MAX_ENRICHMENT_CALLS;
    warnings.push(`FIFA enrichment limited to ${FIFA_MAX_ENRICHMENT_CALLS} matches (${skippedCount} candidate(s) skipped out of ${candidates.length})`);
  }

  for (const { key, fifaId } of toEnrich) {
    try {
      const fifa = await fetchFifaLiveMatch(fifaId);
      const enrichment = parseFifaLiveMatch(fifa, key, matches[key]);
      if (!enrichment) {
        warnings.push(`FIFA enrichment skipped for ${key}: invalid live payload`);
        continue;
      }

      // Merge the schedule note (e.g. "R32") with the FIFA enrichment note
      // (e.g. "Pens 3-4" or "AET") using " · " as separator.
      // Ensure no duplication of the same content.
      const scheduleNote = matches[key]?.note || '';
      const fifaNote = enrichment.note || '';
      let mergedNote;
      if (scheduleNote && fifaNote) {
        // Check if the notes already contain each other to avoid duplication
        if (scheduleNote.includes(fifaNote) || fifaNote.includes(scheduleNote)) {
          mergedNote = scheduleNote.length >= fifaNote.length ? scheduleNote : fifaNote;
        } else {
          mergedNote = `${scheduleNote} · ${fifaNote}`;
        }
      } else {
        mergedNote = scheduleNote || fifaNote;
      }

      matches[key] = {
        ...(matches[key] || {}),
        ...enrichment,
        note: mergedNote,
        source: 'fifa'
      };
    } catch (error) {
      warnings.push(`FIFA enrichment failed for ${key}: ${String(error && error.message ? error.message : error).slice(0, 180)}`);
    }
  }
}

async function fetchFifaLiveMatch(fifaId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), FIFA_LIVE_TIMEOUT_MS);
  try {
    const response = await fetch(`${FIFA_LIVE_BASE_URL}/${encodeURIComponent(fifaId)}?language=en`, {
      headers: { accept: 'application/json' },
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`FIFA live error ${response.status}: ${text.slice(0, 120)}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function parseFifaLiveMatch(payload, key, existing) {
  const fifaHome = canonicalTeamName(readString(payload, ['HomeTeam.TeamName.0.Description', 'HomeTeam.Abbreviation']));
  const fifaAway = canonicalTeamName(readString(payload, ['AwayTeam.TeamName.0.Description', 'AwayTeam.Abbreviation']));
  const homeScore = normalizeFifaScore(readValue(payload, ['HomeTeam.Score']));
  const awayScore = normalizeFifaScore(readValue(payload, ['AwayTeam.Score']));

  if (!fifaHome || !fifaAway || homeScore === '' || awayScore === '') return null;

  const [fallbackHome, fallbackAway] = key.split(' vs ');
  const home = canonicalTeamName(fallbackHome || fifaHome);
  const away = canonicalTeamName(fallbackAway || fifaAway);
  const elapsed = normalizeFifaMatchTime(readValue(payload, ['MatchTime']));
  const status = getFifaStatus(payload, elapsed, existing?.status);

  // Capture extra time and penalty scores if available
  const penScores = readFifaPenaltyScores(payload);
  const homePen = penScores.home !== null ? String(penScores.home) : '';
  const awayPen = penScores.away !== null ? String(penScores.away) : '';
  const homeET = normalizeFifaScore(readValue(payload, ['HomeTeam.ExtraTimeScore']));
  const awayET = normalizeFifaScore(readValue(payload, ['AwayTeam.ExtraTimeScore']));

  // Build enriched score display
  // The ordinary match score is always separate from the penalty tally.
  // e.g. score: "Germany 1-1 Paraguay", note: "Pens 3-2"
  let score = `${home} ${homeScore}-${awayScore} ${away}`;
  const notes = [];

  // If penalty scores are populated (both non-null and numeric), show the shootout tally.
  // Supports both active (P) and completed (PEN) penalty shootouts.
  // A zero is a valid penalty score (e.g. 0-0 after the first kick when no one scores).
  const homePenNum = homePen !== '' ? Number(homePen) : null;
  const awayPenNum = awayPen !== '' ? Number(awayPen) : null;
  if ((status === 'P' || status === 'PEN') && homePenNum !== null && awayPenNum !== null) {
    notes.push(`Pens ${homePenNum}-${awayPenNum}`);
  }

  // If after extra time, note it
  if (status === 'AET') {
    notes.push('AET');
  }

  return {
    status,
    score,
    ...(notes.length ? { note: notes.join(' ') } : {}),
    ...(elapsed && status !== 'PEN' && status !== 'FT' && status !== 'HT' && status !== 'AET' ? { elapsed } : {})
  };
}

function normalizeFifaScore(value) {
  if (value === null || value === undefined || value === '') return '';
  const score = Number(value);
  return Number.isFinite(score) ? String(score) : '';
}

function normalizeFifaMatchTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^ht$/i.test(raw)) return 'HT';

  // FIFA supplies MatchTime values such as "105'+3'" (apostrophe before +).
  // Also handles "45'+4'", "90'+6'", "105'+3'", "120'+2'", "90+6'", "45'" etc.
  const minute = raw.match(/^(\d{1,3})(?:'?\s*\+\s*(\d{1,2}))?\s*'?$/);
  if (!minute) return '';

  const base = Number.parseInt(minute[1], 10);
  if (!Number.isFinite(base) || base < 0 || base > 150) return '';
  // Preserve the exact FIFA format including the apostrophe before + and final apostrophe
  // e.g. "105'+3'" stays as "105'+3'", "45'" stays as "45'"
  if (minute[2]) {
    return `${base}'+${Number.parseInt(minute[2], 10)}'`;
  }
  return `${base}'`;
}

/**
 * Read penalty scores from a FIFA payload.
 * Observed fields: top-level HomeTeamPenaltyScore / AwayTeamPenaltyScore
 * (e.g. Germany vs Paraguay had HomeTeamPenaltyScore: 2, AwayTeamPenaltyScore: 3
 *  while HomeTeam.PenaltyScore was null).
 * Falls back to nested HomeTeam.PenaltyScore / AwayTeam.PenaltyScore for
 * compatibility with payload variants.
 */
function readFifaPenaltyScores(payload) {
  if (!payload) return { home: null, away: null };
  // Try top-level fields first (observed during live shootout)
  const homeRaw = payload.HomeTeamPenaltyScore !== null && payload.HomeTeamPenaltyScore !== undefined
    ? payload.HomeTeamPenaltyScore : undefined;
  const awayRaw = payload.AwayTeamPenaltyScore !== null && payload.AwayTeamPenaltyScore !== undefined
    ? payload.AwayTeamPenaltyScore : undefined;
  // Fallback to nested fields
  const homeNested = homeRaw !== undefined ? homeRaw : readValue(payload, ['HomeTeam.PenaltyScore']);
  const awayNested = awayRaw !== undefined ? awayRaw : readValue(payload, ['AwayTeam.PenaltyScore']);
  const home = homeNested !== null && homeNested !== undefined ? Number(homeNested) : null;
  const away = awayNested !== null && awayNested !== undefined ? Number(awayNested) : null;
  return { home, away };
}

function getFifaStatus(payload, elapsed, fallbackStatus) {
  // Period field is a useful but not definitive indicator. The observed FIFA payload
  // for Germany vs Paraguay (tied 1-1, in extra time) showed Period=7, MatchTime='97',
  // MatchStatus=3, with no penalty scores. This proves Period 7 can represent extra
  // time, not penalties. We use the full payload context for correct interpretation.
  const period = payload?.Period;
  const homeScore = normalizeFifaScore(readValue(payload, ['HomeTeam.Score']));
  const awayScore = normalizeFifaScore(readValue(payload, ['AwayTeam.Score']));
  const penScores = readFifaPenaltyScores(payload);
  const homePen = penScores.home;
  const awayPen = penScores.away;
  const homeET = payload?.HomeTeam?.ExtraTimeScore;
  const awayET = payload?.AwayTeam?.ExtraTimeScore;
  const matchStatus = payload?.MatchStatus;
  const matchTime = payload?.MatchTime;
  const isKnockout = false; // will be set based on key context if available

    if (period !== null && period !== undefined && period !== '') {
    const p = Number(period);
    if (Number.isFinite(p)) {
      // Period mapping:
      // 0   = not started
      // 1-3 = first / second half of regulation
      // 4   = halftime
      // 5-8 = extra time periods
      // 7   = ET first half (or penalties depending on payload context)
      // 8   = ET HT (extra-time half-time)
      // 9   = ET second half
      // 16  = pre-shootout interval (observed: Period 16, MatchStatus 3, tied, no penalties)

      if (p >= 10) {
        // Match is at Period >= 10. Determine terminal or live state.
        // MatchStatus 3 has been observed as a live indicator (Germany v Paraguay
        // during ET and pre-shootout interval). Do not return a terminal status
        // while MatchStatus is 3 and the score is tied.

        const penHome = homePen !== null && homePen !== undefined ? Number(homePen) : null;
        const penAway = awayPen !== null && awayPen !== undefined ? Number(awayPen) : null;
        const hasPenalties = penHome !== null && penAway !== null &&
                             (penHome > 0 || penAway > 0);

        // MatchStatus 3 observed as live. For a tied knockout match with
        // MatchStatus 3, the match is still live regardless of Period value.
        const isLiveMatchStatus = matchStatus === 3 || matchStatus === '3';
        const homeScoreNum = homeScore !== '' ? Number(homeScore) : null;
        const awayScoreNum = awayScore !== '' ? Number(awayScore) : null;
        const isTied = homeScoreNum !== null && awayScoreNum !== null &&
                       homeScoreNum === awayScoreNum;

        if (hasPenalties) {
          // Penalty score fields are populated. Determine terminal or live.

          // MatchStatus 0 has been observed as the terminal/finished state
          // (Germany vs Paraguay: Period 10, MatchStatus 0, HomeTeamPenaltyScore 3,
          //  AwayTeamPenaltyScore 4, score 1-1).
          const isTerminalMatchStatus = matchStatus === 0 || matchStatus === '0';

          if (isTerminalMatchStatus) return 'PEN';

          // If still live (MatchStatus 3), the shootout is in progress.
          if (isLiveMatchStatus) return 'P';

          // Check for explicit terminal evidence in text fields.
          const statusText = [
            readString(payload, ['Status']),
            readString(payload, ['MatchStatus']),
            readString(payload, ['MatchStatusName.0.Description']),
            readString(payload, ['PeriodName.0.Description'])
          ].join(' ').toLowerCase();

          const hasTerminalEvidence = /\b(finished|full[ -]?time|final|ft|ended|complete)\b/.test(statusText);

          if (hasTerminalEvidence) return 'PEN';

          // No explicit terminal evidence. Stay at P and continue polling.
          return 'P';
        }

        // No penalty scores populated. Check if still live (MatchStatus 3).
        if (isLiveMatchStatus && isTied) {
          // Period 16 has been observed as the pre-shootout interval
          // (Germany vs Paraguay: Period 16, MatchStatus 3, tied 1-1,
          // no penalty scores, blank MatchTime).
          if (p === 16) return 'PEN WAIT';

          // Period 11 has been observed as the active penalty shootout
          // (Germany vs Paraguay: Period 11, MatchStatus 3, tied 1-1,
          // blank penalty fields, blank MatchTime).
          // Return P (non-final, continues polling, no Pens note yet).
          return 'P';
        }

        // Check for after extra time: detect if ET was played.
        const etHome = homeET !== null && homeET !== undefined ? Number(homeET) : null;
        const etAway = awayET !== null && awayET !== undefined ? Number(awayET) : null;
        const hasExtraTimeScores = (etHome !== null && etHome > 0) || (etAway !== null && etAway > 0);

        if (hasExtraTimeScores) return 'AET';

        // If matchTime base minute > 90, extra time was played.
        const mtRaw = matchTime !== null && matchTime !== undefined ? String(matchTime).trim() : '';
        const mtMatch = mtRaw.match(/^(\d{1,3})/);
        const mtBase = mtMatch ? Number.parseInt(mtMatch[1], 10) : 0;
        if (Number.isFinite(mtBase) && mtBase > 90) return 'AET';

        // Period 10+ without any ET or penalty evidence: assume regulation finish
        return 'FT';
      }

      // Live state periods:
      // Period 8 is extra-time half-time (ET HT).
      // Observed in Germany vs Paraguay: Period 8, MatchStatus 3, score 1-1,
      // no penalty scores, MatchTime blank. Must not be interpreted as ET or HT.
      if (p === 8) {
        return 'ET HT';
      }

      // Periods 7, 8, and 9: treat as ET unless there is explicit penalty evidence.
      // Period 5 is the ordinary second half of regulation play (Period 3 is 1H,
      // Period 5 is 2H) and must NOT be treated as ET.
      // Period 6 is excluded until a captured FIFA payload proves its meaning.
      if (p === 7 || p === 8 || p === 9) {
        // Check if penalties are actually happening by examining penalty score fields.
        // During an active shootout, at least one penalty score will be populated (0 or more).
        // During ET, penalty scores remain null.
        const penHomeLive = homePen !== null && homePen !== undefined;
        const penAwayLive = awayPen !== null && awayPen !== undefined;

        // If both penalty score fields are populated (even if 0), a shootout is in progress
        if (penHomeLive && penAwayLive) return 'P';

        // No penalty evidence: this is extra time
        return 'ET';
      }

      if (p === 4) return 'HT';
      if (p === 0) return fallbackStatus || 'NS';
      // Periods 1-3 are normal play: fall through to elapsed/text checks
    }
  }

  // Fallback: check status text fields
  const statusText = [
    readString(payload, ['Status']),
    readString(payload, ['MatchStatus']),
    readString(payload, ['MatchStatusName.0.Description']),
    readString(payload, ['PeriodName.0.Description'])
  ].join(' ').toLowerCase();

  if (/\b(finished|full[ -]?time|final|ft|ended|complete)\b/.test(statusText)) return 'FT';
  if (/\b(after extra( |-)?time|aet)\b/.test(statusText)) return 'AET';
  if (/\b(after penalties|pen(alty)? shootout|won on pens)\b/.test(statusText)) return 'PEN';
  if (/\b(extra( |-)?time|extra time)\b/.test(statusText)) return 'ET';
  if (/\b(penalties|penalty shootout)\b/.test(statusText)) return 'P';
  if (/\b(not[ _-]?started|scheduled|timed|cancelled|postponed)\b/.test(statusText)) return fallbackStatus || 'NS';
  if (elapsed === 'HT') return 'HT';
  if (elapsed) return 'LIVE';
  return fallbackStatus || 'NS';
}

function extractGames(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.games)) return payload.games;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.games)) return payload.data.games;
  throw new Error('Unexpected worldcup26.ir response shape');
}

function getGameStatus(item) {
  const finished = readValue(item, ['finished']);
  if (finished === true || String(finished).toUpperCase() === 'TRUE') return 'FT';

  const rawElapsed = readValue(item, ['time_elapsed', 'timeElapsed', 'elapsed', 'minute', 'status']);
  const normalizedElapsed = normalizeElapsedTime(rawElapsed);
  if (normalizedElapsed === 'HT') return 'HT';

  const elapsedKey = normalizeElapsedToken(rawElapsed);
  if (isFinishedElapsed(elapsedKey)) return 'FT';
  if (normalizedElapsed) return 'LIVE';
  if (elapsedKey && !isNotStartedElapsed(elapsedKey)) return 'LIVE';

  return 'NS';
}

function getElapsedDisplay(item, status) {
  if (status === 'FT' || status === 'NS' || status === 'AET' || status === 'PEN') return '';
  return normalizeElapsedTime(readValue(item, ['time_elapsed', 'timeElapsed', 'elapsed', 'minute', 'status']));
}

function normalizeElapsedTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const key = normalizeElapsedToken(raw);
  if (isNotStartedElapsed(key) || isFinishedElapsed(key)) return '';
  if (isHalftimeElapsed(key)) return 'HT';

  const minute = raw.match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?\s*(?:'|min|mins|minute|minutes)?$/i);
  if (!minute) return '';

  const base = Number.parseInt(minute[1], 10);
  if (!Number.isFinite(base) || base < 0 || base > 150) return '';
  return minute[2] ? `${base}+${Number.parseInt(minute[2], 10)}'` : `${base}'`;
}

function normalizeElapsedToken(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNotStartedElapsed(value) {
  return !value || ['null', 'undefined', 'notstarted', 'not started', 'not started yet', 'not played', 'scheduled', 'tbd', 'ns'].includes(value);
}

function isFinishedElapsed(value) {
  return ['finished', 'finish', 'fulltime', 'full time', 'ft', 'ended', 'complete', 'completed'].includes(value);
}

function isHalftimeElapsed(value) {
  return ['ht', 'half time', 'halftime', 'half'].includes(value);
}

function formatScore(home, away, homeGoals, awayGoals) {
  if (homeGoals !== '' && awayGoals !== '') {
    return `${home} ${homeGoals}-${awayGoals} ${away}`;
  }
  return `${home} vs ${away}`;
}

function formatRoundOrGroup(value) {
  const group = String(value || '').trim();
  if (!group) return '';
  if (/^group\b/i.test(group)) return group.replace(/^group\s*/i, 'Group ');
  if (/^[A-L]$/i.test(group)) return `Group ${group.toUpperCase()}`;
  if (/^round\b/i.test(group)) return group;
  return group;
}

function normalizeScore(value) {
  if (value === null || value === undefined) return '';
  const score = String(value).trim();
  if (!score || score.toLowerCase() === 'null') return '';
  return score;
}

function readString(item, paths) {
  const value = readValue(item, paths);
  return value === null || value === undefined ? '' : String(value).trim();
}

function readValue(item, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((current, part) => current?.[part], item);
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return undefined;
}

function canonicalTeamName(name) {
  if (!name) return '';
  const key = normalize(name);
  return TEAM_ALIASES.get(key) || name;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function usageKeyDate(date) {
  return date.toISOString().slice(0, 10);
}

async function getUsageCount(env, date) {
  const raw = await env.RESULTS.get(`usage:${usageKeyDate(date)}`);
  const value = Number.parseInt(raw || '0', 10);
  return Number.isFinite(value) ? value : 0;
}

async function incrementUsage(env, date) {
  const key = `usage:${usageKeyDate(date)}`;
  const current = await getUsageCount(env, date);
  const next = current + 1;
  await env.RESULTS.put(key, String(next), { expirationTtl: USAGE_TTL_SECONDS });
  return next;
}

async function getJson(env, key) {
  const raw = await env.RESULTS.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function putJson(env, key, value, expirationTtl) {
  await env.RESULTS.put(key, JSON.stringify(value, null, 2), { expirationTtl });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}