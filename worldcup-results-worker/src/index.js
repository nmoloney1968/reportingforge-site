const API_BASE = 'https://v3.football.api-sports.io';
const KV_KEY = 'worldcup2026-results';
const STATUS_KEY = 'worldcup2026-poller-status';
const LAST_ERROR_KEY = 'worldcup2026-last-error';
const LEAGUE_ID = '1';
const SEASON = '2026';

const SLOT_MS = 5 * 60 * 1000;
const SLOT_CLAIM_TTL_SECONDS = 60 * 60 * 24 * 45;
const USAGE_TTL_SECONDS = 60 * 60 * 24 * 3;
const AUTO_DAILY_LIMIT = 90;

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
    "kickoffUtc": "2026-06-11T19:00:00Z",
    "germany": false
  },
  {
    "match": "South Korea vs Czech Republic",
    "group": "Group A",
    "kickoffUtc": "2026-06-12T02:00:00Z",
    "germany": false
  },
  {
    "match": "Canada vs Bosnia & Herzegovina",
    "group": "Group B",
    "kickoffUtc": "2026-06-12T19:00:00Z",
    "germany": false
  },
  {
    "match": "USA vs Paraguay",
    "group": "Group D",
    "kickoffUtc": "2026-06-13T01:00:00Z",
    "germany": false
  },
  {
    "match": "Qatar vs Switzerland",
    "group": "Group B",
    "kickoffUtc": "2026-06-13T19:00:00Z",
    "germany": false
  },
  {
    "match": "Brazil vs Morocco",
    "group": "Group C",
    "kickoffUtc": "2026-06-13T22:00:00Z",
    "germany": false
  },
  {
    "match": "Haiti vs Scotland",
    "group": "Group C",
    "kickoffUtc": "2026-06-14T01:00:00Z",
    "germany": false
  },
  {
    "match": "Australia vs Turkey",
    "group": "Group D",
    "kickoffUtc": "2026-06-14T04:00:00Z",
    "germany": false
  },
  {
    "match": "Germany vs Curacao",
    "group": "Group E",
    "kickoffUtc": "2026-06-14T17:00:00Z",
    "germany": true
  },
  {
    "match": "Netherlands vs Japan",
    "group": "Group F",
    "kickoffUtc": "2026-06-14T20:00:00Z",
    "germany": false
  },
  {
    "match": "Ivory Coast vs Ecuador",
    "group": "Group E",
    "kickoffUtc": "2026-06-14T23:00:00Z",
    "germany": false
  },
  {
    "match": "Sweden vs Tunisia",
    "group": "Group F",
    "kickoffUtc": "2026-06-15T02:00:00Z",
    "germany": false
  },
  {
    "match": "Spain vs Cape Verde",
    "group": "Group H",
    "kickoffUtc": "2026-06-15T16:00:00Z",
    "germany": false
  },
  {
    "match": "Belgium vs Egypt",
    "group": "Group G",
    "kickoffUtc": "2026-06-15T19:00:00Z",
    "germany": false
  },
  {
    "match": "Saudi Arabia vs Uruguay",
    "group": "Group H",
    "kickoffUtc": "2026-06-15T22:00:00Z",
    "germany": false
  },
  {
    "match": "Iran vs New Zealand",
    "group": "Group G",
    "kickoffUtc": "2026-06-16T01:00:00Z",
    "germany": false
  },
  {
    "match": "France vs Senegal",
    "group": "Group I",
    "kickoffUtc": "2026-06-16T19:00:00Z",
    "germany": false
  },
  {
    "match": "Iraq vs Norway",
    "group": "Group I",
    "kickoffUtc": "2026-06-16T22:00:00Z",
    "germany": false
  },
  {
    "match": "Argentina vs Algeria",
    "group": "Group J",
    "kickoffUtc": "2026-06-17T01:00:00Z",
    "germany": false
  },
  {
    "match": "Austria vs Jordan",
    "group": "Group J",
    "kickoffUtc": "2026-06-17T04:00:00Z",
    "germany": false
  },
  {
    "match": "Portugal vs DR Congo",
    "group": "Group K",
    "kickoffUtc": "2026-06-17T17:00:00Z",
    "germany": false
  },
  {
    "match": "England vs Croatia",
    "group": "Group L",
    "kickoffUtc": "2026-06-17T20:00:00Z",
    "germany": false
  },
  {
    "match": "Ghana vs Panama",
    "group": "Group L",
    "kickoffUtc": "2026-06-17T23:00:00Z",
    "germany": false
  },
  {
    "match": "Uzbekistan vs Colombia",
    "group": "Group K",
    "kickoffUtc": "2026-06-18T02:00:00Z",
    "germany": false
  },
  {
    "match": "Czech Republic vs South Africa",
    "group": "Group A",
    "kickoffUtc": "2026-06-18T16:00:00Z",
    "germany": false
  },
  {
    "match": "Switzerland vs Bosnia & Herzegovina",
    "group": "Group B",
    "kickoffUtc": "2026-06-18T19:00:00Z",
    "germany": false
  },
  {
    "match": "Canada vs Qatar",
    "group": "Group B",
    "kickoffUtc": "2026-06-18T22:00:00Z",
    "germany": false
  },
  {
    "match": "Mexico vs South Korea",
    "group": "Group A",
    "kickoffUtc": "2026-06-19T01:00:00Z",
    "germany": false
  },
  {
    "match": "USA vs Australia",
    "group": "Group D",
    "kickoffUtc": "2026-06-19T19:00:00Z",
    "germany": false
  },
  {
    "match": "Scotland vs Morocco",
    "group": "Group C",
    "kickoffUtc": "2026-06-19T22:00:00Z",
    "germany": false
  },
  {
    "match": "Brazil vs Haiti",
    "group": "Group C",
    "kickoffUtc": "2026-06-20T00:30:00Z",
    "germany": false
  },
  {
    "match": "Turkey vs Paraguay",
    "group": "Group D",
    "kickoffUtc": "2026-06-20T03:00:00Z",
    "germany": false
  },
  {
    "match": "Netherlands vs Sweden",
    "group": "Group F",
    "kickoffUtc": "2026-06-20T17:00:00Z",
    "germany": false
  },
  {
    "match": "Germany vs Ivory Coast",
    "group": "Group E",
    "kickoffUtc": "2026-06-20T20:00:00Z",
    "germany": true
  },
  {
    "match": "Ecuador vs Curacao",
    "group": "Group E",
    "kickoffUtc": "2026-06-21T00:00:00Z",
    "germany": false
  },
  {
    "match": "Tunisia vs Japan",
    "group": "Group F",
    "kickoffUtc": "2026-06-21T04:00:00Z",
    "germany": false
  },
  {
    "match": "Spain vs Saudi Arabia",
    "group": "Group H",
    "kickoffUtc": "2026-06-21T16:00:00Z",
    "germany": false
  },
  {
    "match": "Belgium vs Iran",
    "group": "Group G",
    "kickoffUtc": "2026-06-21T19:00:00Z",
    "germany": false
  },
  {
    "match": "Uruguay vs Cape Verde",
    "group": "Group H",
    "kickoffUtc": "2026-06-21T22:00:00Z",
    "germany": false
  },
  {
    "match": "New Zealand vs Egypt",
    "group": "Group G",
    "kickoffUtc": "2026-06-22T01:00:00Z",
    "germany": false
  },
  {
    "match": "Argentina vs Austria",
    "group": "Group J",
    "kickoffUtc": "2026-06-22T17:00:00Z",
    "germany": false
  },
  {
    "match": "France vs Iraq",
    "group": "Group I",
    "kickoffUtc": "2026-06-22T21:00:00Z",
    "germany": false
  },
  {
    "match": "Norway vs Senegal",
    "group": "Group I",
    "kickoffUtc": "2026-06-23T00:00:00Z",
    "germany": false
  },
  {
    "match": "Jordan vs Algeria",
    "group": "Group J",
    "kickoffUtc": "2026-06-23T03:00:00Z",
    "germany": false
  },
  {
    "match": "Portugal vs Uzbekistan",
    "group": "Group K",
    "kickoffUtc": "2026-06-23T17:00:00Z",
    "germany": false
  },
  {
    "match": "England vs Ghana",
    "group": "Group L",
    "kickoffUtc": "2026-06-23T20:00:00Z",
    "germany": false
  },
  {
    "match": "Panama vs Croatia",
    "group": "Group L",
    "kickoffUtc": "2026-06-23T23:00:00Z",
    "germany": false
  },
  {
    "match": "Colombia vs DR Congo",
    "group": "Group K",
    "kickoffUtc": "2026-06-24T02:00:00Z",
    "germany": false
  },
  {
    "match": "Switzerland vs Canada",
    "group": "Group B",
    "kickoffUtc": "2026-06-24T19:00:00Z",
    "germany": false
  },
  {
    "match": "Bosnia & Herzegovina vs Qatar",
    "group": "Group B",
    "kickoffUtc": "2026-06-24T19:00:00Z",
    "germany": false
  },
  {
    "match": "Morocco vs Haiti",
    "group": "Group C",
    "kickoffUtc": "2026-06-24T22:00:00Z",
    "germany": false
  },
  {
    "match": "Scotland vs Brazil",
    "group": "Group C",
    "kickoffUtc": "2026-06-24T22:00:00Z",
    "germany": false
  },
  {
    "match": "South Africa vs South Korea",
    "group": "Group A",
    "kickoffUtc": "2026-06-25T01:00:00Z",
    "germany": false
  },
  {
    "match": "Czech Republic vs Mexico",
    "group": "Group A",
    "kickoffUtc": "2026-06-25T01:00:00Z",
    "germany": false
  },
  {
    "match": "Curacao vs Ivory Coast",
    "group": "Group E",
    "kickoffUtc": "2026-06-25T20:00:00Z",
    "germany": false
  },
  {
    "match": "Ecuador vs Germany",
    "group": "Group E",
    "kickoffUtc": "2026-06-25T20:00:00Z",
    "germany": true
  },
  {
    "match": "Tunisia vs Netherlands",
    "group": "Group F",
    "kickoffUtc": "2026-06-25T23:00:00Z",
    "germany": false
  },
  {
    "match": "Japan vs Sweden",
    "group": "Group F",
    "kickoffUtc": "2026-06-25T23:00:00Z",
    "germany": false
  },
  {
    "match": "Turkey vs USA",
    "group": "Group D",
    "kickoffUtc": "2026-06-26T02:00:00Z",
    "germany": false
  },
  {
    "match": "Paraguay vs Australia",
    "group": "Group D",
    "kickoffUtc": "2026-06-26T02:00:00Z",
    "germany": false
  },
  {
    "match": "Norway vs France",
    "group": "Group I",
    "kickoffUtc": "2026-06-26T19:00:00Z",
    "germany": false
  },
  {
    "match": "Senegal vs Iraq",
    "group": "Group I",
    "kickoffUtc": "2026-06-26T19:00:00Z",
    "germany": false
  },
  {
    "match": "Cape Verde vs Saudi Arabia",
    "group": "Group H",
    "kickoffUtc": "2026-06-27T00:00:00Z",
    "germany": false
  },
  {
    "match": "Uruguay vs Spain",
    "group": "Group H",
    "kickoffUtc": "2026-06-27T00:00:00Z",
    "germany": false
  },
  {
    "match": "New Zealand vs Belgium",
    "group": "Group G",
    "kickoffUtc": "2026-06-27T03:00:00Z",
    "germany": false
  },
  {
    "match": "Egypt vs Iran",
    "group": "Group G",
    "kickoffUtc": "2026-06-27T03:00:00Z",
    "germany": false
  },
  {
    "match": "Panama vs England",
    "group": "Group L",
    "kickoffUtc": "2026-06-27T21:00:00Z",
    "germany": false
  },
  {
    "match": "Croatia vs Ghana",
    "group": "Group L",
    "kickoffUtc": "2026-06-27T21:00:00Z",
    "germany": false
  },
  {
    "match": "Colombia vs Portugal",
    "group": "Group K",
    "kickoffUtc": "2026-06-27T23:30:00Z",
    "germany": false
  },
  {
    "match": "DR Congo vs Uzbekistan",
    "group": "Group K",
    "kickoffUtc": "2026-06-27T23:30:00Z",
    "germany": false
  },
  {
    "match": "Algeria vs Austria",
    "group": "Group J",
    "kickoffUtc": "2026-06-28T02:00:00Z",
    "germany": false
  },
  {
    "match": "Jordan vs Argentina",
    "group": "Group J",
    "kickoffUtc": "2026-06-28T02:00:00Z",
    "germany": false
  }
];

// API-Football/FIFA naming can differ from the page naming. Canonicalize here so the static HTML can match reliably.
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

  const usageBefore = await getUsageCount(env, now);
  if (usageBefore >= AUTO_DAILY_LIMIT) {
    const status = {
      skipped: true,
      reason: `Automatic daily API cap reached: ${usageBefore}/${AUTO_DAILY_LIMIT}`,
      mode: 'auto',
      slot,
      checkedAtUtc: now.toISOString()
    };
    await putJson(env, STATUS_KEY, status, USAGE_TTL_SECONDS);
    return status;
  }

  const claimKey = `poll-slot:${slot.slotId}`;
  const alreadyClaimed = await env.RESULTS.get(claimKey);
  if (alreadyClaimed) {
    return { skipped: true, reason: 'Polling slot already claimed', slot, checkedAtUtc: now.toISOString() };
  }

  await env.RESULTS.put(claimKey, JSON.stringify({ claimedAtUtc: now.toISOString(), slot }), { expirationTtl: SLOT_CLAIM_TTL_SECONDS });

  try {
    return await refreshResults(env, { mode: 'auto', slot, now });
  } catch (error) {
    const failure = {
      error: String(error && error.message ? error.message : error),
      mode: 'auto',
      slot,
      checkedAtUtc: now.toISOString()
    };
    await putJson(env, LAST_ERROR_KEY, failure, USAGE_TTL_SECONDS);
    await putJson(env, STATUS_KEY, { ...failure, lastSuccessfulPayloadKept: true }, USAGE_TTL_SECONDS);
    return failure;
  }
}

async function handleManualRefresh(request, env, url) {
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('token');
  if (!env.ADMIN_TOKEN || supplied !== env.ADMIN_TOKEN) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const now = new Date();
    const usageBefore = await getUsageCount(env, now);
    const data = await refreshResults(env, { mode: 'manual', now });
    const warnings = [];
    if (usageBefore >= AUTO_DAILY_LIMIT) {
      warnings.push(`Manual refresh performed after automatic cap threshold: usage before refresh was ${usageBefore}/${AUTO_DAILY_LIMIT}.`);
    } else if (usageBefore >= 80) {
      warnings.push(`Daily API usage is getting high: usage before refresh was ${usageBefore}/${AUTO_DAILY_LIMIT} automatic-cap threshold.`);
    }
    return json({ ...data, warnings }, 200);
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
        dueMatches.push({ match: match.match, group: match.group, germany: match.germany, offsetMinutes: offset });
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

function getOffsetsForMatch(match) {
  const offsets = new Set();

  // All games: kickoff, then every 10 minutes through kickoff +120 minutes.
  for (let minute = 0; minute <= 120; minute += 10) offsets.add(minute);

  // All games: post-match checks at roughly +10, +20 and +45 after a two-hour match window.
  offsets.add(130);
  offsets.add(140);
  offsets.add(165);

  // Germany games: effectively every 5 minutes during live play.
  if (match.germany) {
    for (let minute = 5; minute <= 120; minute += 10) offsets.add(minute);
  }

  return Array.from(offsets).sort((a, b) => a - b);
}

async function refreshResults(env, options = {}) {
  if (!env.APISPORTS_KEY) throw new Error('Missing APISPORTS_KEY secret');

  const now = options.now || new Date();
  const usageAfterIncrement = await incrementUsage(env, now);

  const url = `${API_BASE}/fixtures?league=${LEAGUE_ID}&season=${SEASON}`;
  const response = await fetch(url, {
    headers: { 'x-apisports-key': env.APISPORTS_KEY }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API-Football error ${response.status}: ${text.slice(0, 250)}`);
  }

  const api = await response.json();
  const matches = {};

  for (const item of api.response || []) {
    const round = item.league?.round || '';
    if (!/group/i.test(round)) continue;

    const status = item.fixture?.status?.short || '';
    if (status === 'NS' || status === 'TBD') continue;

    const apiHome = item.teams?.home?.name || '';
    const apiAway = item.teams?.away?.name || '';
    const home = canonicalTeamName(apiHome);
    const away = canonicalTeamName(apiAway);
    const homeGoals = item.goals?.home;
    const awayGoals = item.goals?.away;

    if (!home || !away || homeGoals === null || awayGoals === null || homeGoals === undefined || awayGoals === undefined) continue;

    const key = `${home} vs ${away}`;
    const score = `${home} ${homeGoals}-${awayGoals} ${away}`;

    matches[key] = {
      status,
      score,
      home,
      away,
      apiHome,
      apiAway,
      homeGoals,
      awayGoals,
      fixtureId: item.fixture?.id,
      note: round,
      venue: item.fixture?.venue?.name || '',
      city: item.fixture?.venue?.city || '',
      kickoffUtc: item.fixture?.date || ''
    };
  }

  const data = {
    lastUpdated: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false }) + ' ICT',
    lastUpdatedUtc: new Date().toISOString(),
    source: 'API-FOOTBALL fixtures?league=1&season=2026',
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
