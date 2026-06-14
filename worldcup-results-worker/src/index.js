import FIFA_MATCH_IDS from './fifa-match-ids.js';

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
const AUSTRALIA_ACTIVE_WINDOW_BEFORE_MS = 15 * 60 * 1000;
const AUSTRALIA_ACTIVE_WINDOW_AFTER_MS = 4 * 60 * 60 * 1000;
const SCHEDULED_SOURCE_FETCH_OFFSET_SECONDS = 23;
// Scheduled source calls are delayed to +23 seconds after the 5-minute boundary to avoid the obvious high-traffic boundary.
const GROUP_STAGE_POLLING_END_UTC = '2026-06-28T08:00:00Z';
const SLOT_CLAIM_TTL_SECONDS = 60 * 60 * 24 * 45;
const USAGE_TTL_SECONDS = 60 * 60 * 24 * 3;

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

// Build kickoff lookup after GROUP_STAGE_SCHEDULE is fully declared
for (const m of GROUP_STAGE_SCHEDULE) {
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

function isAustraliaMatchKey(key) {
  const pattern = /\b(australia|aus)\b/i;
  const [home, away] = key.split(' vs ');
  return pattern.test(home) || pattern.test(away);
}

function isInActiveWindow(kickoffUtc) {
  if (!kickoffUtc) return false;
  const kickoffMs = Date.parse(kickoffUtc);
  if (!Number.isFinite(kickoffMs)) return false;
  const nowMs = Date.now();
  const msSinceKickoff = nowMs - kickoffMs;
  return msSinceKickoff >= -AUSTRALIA_ACTIVE_WINDOW_BEFORE_MS && msSinceKickoff <= AUSTRALIA_ACTIVE_WINDOW_AFTER_MS;
}

function anyAustraliaMatchActive() {
  for (const match of GROUP_STAGE_SCHEDULE) {
    if (isAustraliaMatchKey(match.match) && isInActiveWindow(match.kickoffUtc)) {
      return true;
    }
  }
  return false;
}

async function runScheduledRefresh(env, now) {
  // Group-stage polling cutoff: after this UTC timestamp, stop all scheduled upstream calls.
  if (now.getTime() >= Date.parse(GROUP_STAGE_POLLING_END_UTC)) {
    return {
      skipped: true,
      reason: 'Group stage polling window ended',
      checkedAtUtc: now.toISOString()
    };
  }

  // Australia active window: refresh every minute regardless of slot
  const ausActive = anyAustraliaMatchActive();

  const slot = getCurrentPollingSlot(now);
  if (!slot && !ausActive) {
    return { skipped: true, reason: 'No approved polling slot', checkedAtUtc: now.toISOString() };
  }

  // When Australia is active, also refresh non-slot minutes by fabricating a minimal slot
  const effectiveSlot = slot || {
    slotId: now.toISOString().slice(0, 16) + 'Z',
    slotUtc: now.toISOString(),
    dueMatchCount: 0,
    dueMatches: [],
    australiaPriority: true
  };

  try {
    const sourceFetchAt = new Date(Date.parse(effectiveSlot.slotUtc) + SCHEDULED_SOURCE_FETCH_OFFSET_SECONDS * 1000);
    await waitUntilTime(sourceFetchAt);
    return await refreshResults(env, { mode: ausActive ? 'australia-priority' : 'scheduled', slot: effectiveSlot, now });
  } catch (error) {
    const failure = {
      error: String(error && error.message ? error.message : error),
      mode: ausActive ? 'australia-priority' : 'scheduled',
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

function getCurrentPollingSlot(now) {
  const slotMs = Math.floor(now.getTime() / SLOT_MS) * SLOT_MS;
  const dueMatches = [];

  for (const match of GROUP_STAGE_SCHEDULE) {
    const kickoffMs = Date.parse(match.kickoffUtc);
    for (const offset of getOffsetsForMatch(match)) {
      const targetMs = kickoffMs + offset * 60 * 1000;
      if (targetMs === slotMs) {
        dueMatches.push({ match: match.match, group: match.group, offsetMinutes: offset });
      }
    }
  }

  if (dueMatches.length === 0) return null;

  const slotDate = new Date(slotMs);
  return {
    slotId: slotDate.toISOString().slice(0, 16) + 'Z',
    slotUtc: slotDate.toISOString(),
    dueMatchCount: dueMatches.length,
    dueMatches
  };
}

function getOffsetsForMatch() {
  const offsets = new Set();

  // All group-stage games: every 3 minutes from kickoff through +240 minutes.
  for (let minute = 0; minute <= 240; minute += 3) offsets.add(minute);

  return Array.from(offsets).sort((a, b) => a - b);
}

let _lastStatusWriteHour = -1;
let _lastWarningsJson = '';

async function refreshResults(env, options = {}) {
  const now = options.now || new Date();

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

    matches[key] = {
      status,
      score: formatScore(home, away, homeGoals, awayGoals),
      note: formatGroup(readString(item, ['group', 'league.round', 'round'])),
      ...(elapsed ? { elapsed } : {})
    };
  }

  await enrichMatchesWithFifa(matches, warnings, options.slot);

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

function isRelevantForFifaEnrichment(key, dueMatchKeys, matchStatus, nowMs) {
  // Condition 1: match is in the current scheduled slot's dueMatches
  if (dueMatchKeys.has(key)) return true;

  // Condition 2: existing result has a live-ish status
  const liveStatuses = ['LIVE', 'HT', '1H', '2H', 'IN_PLAY'];
  if (liveStatuses.includes(matchStatus)) return true;

  // Condition 3 & 4: kickoff time window
  const kickoffUtc = MATCH_KICKOFF_MAP[key];
  if (!kickoffUtc) return false;

  const kickoffMs = Date.parse(kickoffUtc);
  if (!Number.isFinite(kickoffMs)) return false;

  const msSinceKickoff = nowMs - kickoffMs;
  const MIN_BEFORE_MS = 15 * 60 * 1000;    // 15 minutes before kickoff
  const MAX_AFTER_MS = 240 * 60 * 1000;    // 240 minutes after kickoff

  // From 15 min before to 240 min after kickoff
  return msSinceKickoff >= -MIN_BEFORE_MS && msSinceKickoff <= MAX_AFTER_MS;
}

async function enrichMatchesWithFifa(matches, warnings, slot) {
  const nowMs = Date.now();
  const dueMatchKeys = getDueMatchKeys(slot);

  // Build candidate list filtered by relevance
  const candidates = [];
  for (const [key, fifaId] of Object.entries(FIFA_MATCH_IDS)) {
    const matchStatus = matches[key]?.status || '';
    if (isRelevantForFifaEnrichment(key, dueMatchKeys, matchStatus, nowMs)) {
      candidates.push({ key, fifaId, matchStatus });
    }
  }

  // Sort by relevance: due slot first, live status second, closest to kickoff third
  candidates.sort((a, b) => {
    const aIsDue = dueMatchKeys.has(a.key) ? 1 : 0;
    const bIsDue = dueMatchKeys.has(b.key) ? 1 : 0;
    if (aIsDue !== bIsDue) return bIsDue - aIsDue;

    const liveStatuses = ['LIVE', 'HT', '1H', '2H', 'IN_PLAY'];
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

      matches[key] = {
        ...(matches[key] || {}),
        ...enrichment,
        note: matches[key]?.note || enrichment.note,
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

  return {
    status,
    score: `${home} ${homeScore}-${awayScore} ${away}`,
    ...(elapsed && status !== 'FT' && status !== 'HT' ? { elapsed } : {})
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

  const minute = raw.match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?\s*'?$/);
  if (!minute) return '';

  const base = Number.parseInt(minute[1], 10);
  if (!Number.isFinite(base) || base < 0 || base > 130) return '';
  return minute[2] ? `${base}+${Number.parseInt(minute[2], 10)}'` : `${base}'`;
}

function getFifaStatus(payload, elapsed, fallbackStatus) {
  // Period field is the most reliable indicator of match state from FIFA live endpoint:
  //   Period 0   = not started / scheduled
  //   Period 1-2 = first half / second half
  //   Period 3   = second half (in play)
  //   Period 4   = halftime
  //   Period 5-6 = extra time periods
  //   Period 7+  = penalties
  //   Period 10+ = finished (full time, extra time, penalties)
  //   Period null/undefined = unknown, fall through to other checks
  const period = payload?.Period;
  if (period !== null && period !== undefined && period !== '') {
    const p = Number(period);
    if (Number.isFinite(p)) {
      if (p >= 10) return 'FT';
      if (p === 4) return 'HT';
      if (p === 0) return fallbackStatus || 'NS';
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
  if (status === 'FT' || status === 'NS') return '';
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
  if (!Number.isFinite(base) || base < 0 || base > 130) return '';
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

function formatGroup(value) {
  const group = String(value || '').trim();
  if (!group) return '';
  if (/^group\b/i.test(group)) return group.replace(/^group\s*/i, 'Group ');
  if (/^[A-L]$/i.test(group)) return `Group ${group.toUpperCase()}`;
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
    .replace(/[̀-ͯ]/g, '')
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
