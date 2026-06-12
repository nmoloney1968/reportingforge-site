const API_BASE = 'https://v3.football.api-sports.io';
const KV_KEY = 'worldcup2026-results';
const LEAGUE_ID = '1';
const SEASON = '2026';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

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
    ctx.waitUntil(refreshResults(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Manual refresh endpoint. Use this after a game if you do not want to wait for the cron.
    // Example: /worldcup2026schedule/results.json/refresh?token=YOUR_ADMIN_TOKEN
    if (url.pathname.endsWith('/refresh')) {
      const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('token');
      if (!env.ADMIN_TOKEN || supplied !== env.ADMIN_TOKEN) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const data = await refreshResults(env);
      return json(data, 200);
    }

    // This should be routed to reportingforge.com/worldcup2026schedule/results.json*
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

async function refreshResults(env) {
  if (!env.APISPORTS_KEY) throw new Error('Missing APISPORTS_KEY secret');

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
    // Group-stage only for this page. We can loosen this later for knockout pages.
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
    matchCount: Object.keys(matches).length,
    matches
  };

  await env.RESULTS.put(KV_KEY, JSON.stringify(data, null, 2));
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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
