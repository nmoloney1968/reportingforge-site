const API_URL = 'https://worldcup26.ir/get/games';
const SOURCE_LABEL = 'worldcup26.ir/get/games';
const KV_KEY = 'worldcup2026-results';
const STATUS_KEY = 'worldcup2026-poller-status';
const LAST_ERROR_KEY = 'worldcup2026-last-error';
const SLOT_MS = 5 * 60 * 1000;
const SCHEDULED_SOURCE_FETCH_OFFSET_SECONDS = 23;
// Scheduled source calls are delayed to +23 seconds after the 5-minute boundary to avoid the obvious high-traffic boundary.
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

async function runScheduledRefresh(env, now) {
  const slot = getCurrentPollingSlot(now);
  if (!slot) {
    return { skipped: true, reason: 'No approved polling slot', checkedAtUtc: now.toISOString() };
  }

  const claimKey = `poll-slot:${slot.slotId}`;
  const alreadyClaimed = await env.RESULTS.get(claimKey);
  if (alreadyClaimed) {
    return { skipped: true, reason: 'Polling slot already claimed', slot, checkedAtUtc: now.toISOString() };
  }

  await env.RESULTS.put(claimKey, JSON.stringify({ claimedAtUtc: now.toISOString(), slot }), { expirationTtl: SLOT_CLAIM_TTL_SECONDS });

  try {
    const sourceFetchAt = new Date(Date.parse(slot.slotUtc) + SCHEDULED_SOURCE_FETCH_OFFSET_SECONDS * 1000);
    await waitUntilTime(sourceFetchAt);
    return await refreshResults(env, { mode: 'scheduled', slot, now });
  } catch (error) {
    const failure = {
      error: String(error && error.message ? error.message : error),
      mode: 'scheduled',
      slot,
      checkedAtUtc: now.toISOString()
    };
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

  // All group-stage games: kickoff, then every 5 minutes through kickoff +120 minutes.
  for (let minute = 0; minute <= 120; minute += 5) offsets.add(minute);

  // Post-match checks after the two-hour live window.
  offsets.add(125);
  offsets.add(135);
  offsets.add(150);
  offsets.add(180);

  return Array.from(offsets).sort((a, b) => a - b);
}

async function refreshResults(env, options = {}) {
  const now = options.now || new Date();
  const usageAfterIncrement = await incrementUsage(env, now);

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

    matches[key] = {
      status: getGameStatus(item),
      score: formatScore(home, away, homeGoals, awayGoals),
      note: formatGroup(readString(item, ['group', 'league.round', 'round']))
    };
  }

  const data = {
    lastUpdated: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false }) + ' ICT',
    lastUpdatedUtc: new Date().toISOString(),
    source: SOURCE_LABEL,
    mode: options.mode || 'unknown',
    slot: options.slot || null,
    apiUsageUtcDate: usageKeyDate(now),
    apiUsageAfterThisCall: usageAfterIncrement,
    matchCount: Object.keys(matches).length,
    matches
  };

  await env.RESULTS.put(KV_KEY, JSON.stringify(data, null, 2));
  await putJson(env, STATUS_KEY, {
    lastRefreshUtc: data.lastUpdatedUtc,
    mode: data.mode,
    slot: data.slot,
    apiUsageUtcDate: data.apiUsageUtcDate,
    apiUsageAfterThisCall: data.apiUsageAfterThisCall,
    matchCount: data.matchCount
  }, USAGE_TTL_SECONDS);

  return data;
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

  const timeElapsed = String(readValue(item, ['time_elapsed', 'timeElapsed']) || '').toLowerCase();
  if (timeElapsed && timeElapsed !== 'notstarted') return 'LIVE';

  return 'NS';
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
