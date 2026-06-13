#!/usr/bin/env node

/**
 * build-fifa-match-map.mjs
 *
 * Discovers FIFA IdMatch values for the 72 group-stage World Cup 2026 matches
 * by querying FIFA's calendar endpoint and matching by kickoff UTC, team names, and group.
 *
 * Outputs:
 *   src/fifa-match-ids.json  – mapping from "Home vs Away" to FIFA match details
 *   stdout report            – matching statistics
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const OUTPUT_PATH = join(REPO_ROOT, 'src', 'fifa-match-ids.json');

// ──────────────────────────────────────────────
// 1. Local schedule (72 group-stage matches, from index.js)
// ──────────────────────────────────────────────

const LOCAL_SCHEDULE = [
  { match: "Mexico vs South Africa", group: "Group A", kickoffUtc: "2026-06-11T19:00:00Z" },
  { match: "South Korea vs Czech Republic", group: "Group A", kickoffUtc: "2026-06-12T02:00:00Z" },
  { match: "Canada vs Bosnia & Herzegovina", group: "Group B", kickoffUtc: "2026-06-12T19:00:00Z" },
  { match: "USA vs Paraguay", group: "Group D", kickoffUtc: "2026-06-13T01:00:00Z" },
  { match: "Qatar vs Switzerland", group: "Group B", kickoffUtc: "2026-06-13T19:00:00Z" },
  { match: "Brazil vs Morocco", group: "Group C", kickoffUtc: "2026-06-13T22:00:00Z" },
  { match: "Haiti vs Scotland", group: "Group C", kickoffUtc: "2026-06-14T01:00:00Z" },
  { match: "Australia vs Turkey", group: "Group D", kickoffUtc: "2026-06-14T04:00:00Z" },
  { match: "Germany vs Curacao", group: "Group E", kickoffUtc: "2026-06-14T17:00:00Z" },
  { match: "Netherlands vs Japan", group: "Group F", kickoffUtc: "2026-06-14T20:00:00Z" },
  { match: "Ivory Coast vs Ecuador", group: "Group E", kickoffUtc: "2026-06-14T23:00:00Z" },
  { match: "Sweden vs Tunisia", group: "Group F", kickoffUtc: "2026-06-15T02:00:00Z" },
  { match: "Spain vs Cape Verde", group: "Group H", kickoffUtc: "2026-06-15T16:00:00Z" },
  { match: "Belgium vs Egypt", group: "Group G", kickoffUtc: "2026-06-15T19:00:00Z" },
  { match: "Saudi Arabia vs Uruguay", group: "Group H", kickoffUtc: "2026-06-15T22:00:00Z" },
  { match: "Iran vs New Zealand", group: "Group G", kickoffUtc: "2026-06-16T01:00:00Z" },
  { match: "France vs Senegal", group: "Group I", kickoffUtc: "2026-06-16T19:00:00Z" },
  { match: "Iraq vs Norway", group: "Group I", kickoffUtc: "2026-06-16T22:00:00Z" },
  { match: "Argentina vs Algeria", group: "Group J", kickoffUtc: "2026-06-17T01:00:00Z" },
  { match: "Austria vs Jordan", group: "Group J", kickoffUtc: "2026-06-17T04:00:00Z" },
  { match: "Portugal vs DR Congo", group: "Group K", kickoffUtc: "2026-06-17T17:00:00Z" },
  { match: "England vs Croatia", group: "Group L", kickoffUtc: "2026-06-17T20:00:00Z" },
  { match: "Ghana vs Panama", group: "Group L", kickoffUtc: "2026-06-17T23:00:00Z" },
  { match: "Uzbekistan vs Colombia", group: "Group K", kickoffUtc: "2026-06-18T02:00:00Z" },
  { match: "Czech Republic vs South Africa", group: "Group A", kickoffUtc: "2026-06-18T16:00:00Z" },
  { match: "Switzerland vs Bosnia & Herzegovina", group: "Group B", kickoffUtc: "2026-06-18T19:00:00Z" },
  { match: "Canada vs Qatar", group: "Group B", kickoffUtc: "2026-06-18T22:00:00Z" },
  { match: "Mexico vs South Korea", group: "Group A", kickoffUtc: "2026-06-19T01:00:00Z" },
  { match: "USA vs Australia", group: "Group D", kickoffUtc: "2026-06-19T19:00:00Z" },
  { match: "Scotland vs Morocco", group: "Group C", kickoffUtc: "2026-06-19T22:00:00Z" },
  { match: "Brazil vs Haiti", group: "Group C", kickoffUtc: "2026-06-20T00:30:00Z" },
  { match: "Turkey vs Paraguay", group: "Group D", kickoffUtc: "2026-06-20T03:00:00Z" },
  { match: "Netherlands vs Sweden", group: "Group F", kickoffUtc: "2026-06-20T17:00:00Z" },
  { match: "Germany vs Ivory Coast", group: "Group E", kickoffUtc: "2026-06-20T20:00:00Z" },
  { match: "Ecuador vs Curacao", group: "Group E", kickoffUtc: "2026-06-21T00:00:00Z" },
  { match: "Tunisia vs Japan", group: "Group F", kickoffUtc: "2026-06-21T04:00:00Z" },
  { match: "Spain vs Saudi Arabia", group: "Group H", kickoffUtc: "2026-06-21T16:00:00Z" },
  { match: "Belgium vs Iran", group: "Group G", kickoffUtc: "2026-06-21T19:00:00Z" },
  { match: "Uruguay vs Cape Verde", group: "Group H", kickoffUtc: "2026-06-21T22:00:00Z" },
  { match: "New Zealand vs Egypt", group: "Group G", kickoffUtc: "2026-06-22T01:00:00Z" },
  { match: "Argentina vs Austria", group: "Group J", kickoffUtc: "2026-06-22T17:00:00Z" },
  { match: "France vs Iraq", group: "Group I", kickoffUtc: "2026-06-22T21:00:00Z" },
  { match: "Norway vs Senegal", group: "Group I", kickoffUtc: "2026-06-23T00:00:00Z" },
  { match: "Jordan vs Algeria", group: "Group J", kickoffUtc: "2026-06-23T03:00:00Z" },
  { match: "Portugal vs Uzbekistan", group: "Group K", kickoffUtc: "2026-06-23T17:00:00Z" },
  { match: "England vs Ghana", group: "Group L", kickoffUtc: "2026-06-23T20:00:00Z" },
  { match: "Panama vs Croatia", group: "Group L", kickoffUtc: "2026-06-23T23:00:00Z" },
  { match: "Colombia vs DR Congo", group: "Group K", kickoffUtc: "2026-06-24T02:00:00Z" },
  { match: "Switzerland vs Canada", group: "Group B", kickoffUtc: "2026-06-24T19:00:00Z" },
  { match: "Bosnia & Herzegovina vs Qatar", group: "Group B", kickoffUtc: "2026-06-24T19:00:00Z" },
  { match: "Morocco vs Haiti", group: "Group C", kickoffUtc: "2026-06-24T22:00:00Z" },
  { match: "Scotland vs Brazil", group: "Group C", kickoffUtc: "2026-06-24T22:00:00Z" },
  { match: "South Africa vs South Korea", group: "Group A", kickoffUtc: "2026-06-25T01:00:00Z" },
  { match: "Czech Republic vs Mexico", group: "Group A", kickoffUtc: "2026-06-25T01:00:00Z" },
  { match: "Curacao vs Ivory Coast", group: "Group E", kickoffUtc: "2026-06-25T20:00:00Z" },
  { match: "Ecuador vs Germany", group: "Group E", kickoffUtc: "2026-06-25T20:00:00Z" },
  { match: "Tunisia vs Netherlands", group: "Group F", kickoffUtc: "2026-06-25T23:00:00Z" },
  { match: "Japan vs Sweden", group: "Group F", kickoffUtc: "2026-06-25T23:00:00Z" },
  { match: "Turkey vs USA", group: "Group D", kickoffUtc: "2026-06-26T02:00:00Z" },
  { match: "Paraguay vs Australia", group: "Group D", kickoffUtc: "2026-06-26T02:00:00Z" },
  { match: "Norway vs France", group: "Group I", kickoffUtc: "2026-06-26T19:00:00Z" },
  { match: "Senegal vs Iraq", group: "Group I", kickoffUtc: "2026-06-26T19:00:00Z" },
  { match: "Cape Verde vs Saudi Arabia", group: "Group H", kickoffUtc: "2026-06-27T00:00:00Z" },
  { match: "Uruguay vs Spain", group: "Group H", kickoffUtc: "2026-06-27T00:00:00Z" },
  { match: "New Zealand vs Belgium", group: "Group G", kickoffUtc: "2026-06-27T03:00:00Z" },
  { match: "Egypt vs Iran", group: "Group G", kickoffUtc: "2026-06-27T03:00:00Z" },
  { match: "Panama vs England", group: "Group L", kickoffUtc: "2026-06-27T21:00:00Z" },
  { match: "Croatia vs Ghana", group: "Group L", kickoffUtc: "2026-06-27T21:00:00Z" },
  { match: "Colombia vs Portugal", group: "Group K", kickoffUtc: "2026-06-27T23:30:00Z" },
  { match: "DR Congo vs Uzbekistan", group: "Group K", kickoffUtc: "2026-06-27T23:30:00Z" },
  { match: "Algeria vs Austria", group: "Group J", kickoffUtc: "2026-06-28T02:00:00Z" },
  { match: "Jordan vs Argentina", group: "Group J", kickoffUtc: "2026-06-28T02:00:00Z" }
];

// ──────────────────────────────────────────────
// 2. Team name aliases
// ──────────────────────────────────────────────

const BASE_ALIASES = {
  'united states': 'USA',
  'usa': 'USA',
  'korea republic': 'South Korea',
  'south korea': 'South Korea',
  'czechia': 'Czech Republic',
  'czech republic': 'Czech Republic',
  'bosnia-herzegovina': 'Bosnia & Herzegovina',
  'bosnia and herzegovina': 'Bosnia & Herzegovina',
  'bosnia & herzegovina': 'Bosnia & Herzegovina',
  "côte d'ivoire": 'Ivory Coast',
  "cote d'ivoire": 'Ivory Coast',
  'côte divoire': 'Ivory Coast',
  'cote divoire': 'Ivory Coast',
  'ivory coast': 'Ivory Coast',
  'türkiye': 'Turkey',
  'turkiye': 'Turkey',
  'turkey': 'Turkey',
  'dr congo': 'DR Congo',
  'congo dr': 'DR Congo',
  'cape verde': 'Cape Verde',
  'cabo verde': 'Cape Verde',
  'curacao': 'Curacao',
  'curaçao': 'Curacao',
  'ir iran': 'Iran',
  'iran': 'Iran',
};

const EXTRA_ALIASES_REPORTED = {};

function addAlias(raw, canonical) {
  const key = raw.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!BASE_ALIASES[key]) {
    BASE_ALIASES[key] = canonical;
    EXTRA_ALIASES_REPORTED[raw] = canonical;
  }
}

function normalizeTeam(name) {
  if (!name) return '';
  let n = String(name).trim();
  n = n.replace(/\s+\d+$/, '');
  const key = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return BASE_ALIASES[key] || n;
}

function matchKey(home, away) {
  return `${normalizeTeam(home)} vs ${normalizeTeam(away)}`;
}

// ──────────────────────────────────────────────
// 3. FIFA API endpoint
// ──────────────────────────────────────────────

// From live endpoint USA vs Paraguay (IdMatch 400021458):
//   IdCompetition: 17  (FIFA World Cup)
//   IdSeason: 285023   (World Cup 2026)
//   StageId 289273     (First Stage = group)
const FIFA_CALENDAR_URL =
  'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&language=en&count=200';

// ──────────────────────────────────────────────
// 4. Helpers
// ──────────────────────────────────────────────

function extractTeamNameFromFifaRecord(match, side) {
  // Calendar endpoint uses m.Home / m.Away with TeamName[0].Description
  const sideObj = match[side];
  if (!sideObj) return '';
  // TeamName is array of locale objects
  const tn = sideObj.TeamName;
  if (Array.isArray(tn) && tn.length > 0) {
    const first = tn[0];
    if (typeof first === 'string') return first;
    if (first?.Description) return first.Description;
  }
  // Fallback to ShortClubName
  if (sideObj.ShortClubName) return sideObj.ShortClubName;
  if (sideObj.Abbreviation) return sideObj.Abbreviation;
  return '';
}

function extractGroupName(match) {
  // GroupName[0].Description
  const gn = match.GroupName;
  if (Array.isArray(gn) && gn.length > 0) {
    return gn[0]?.Description || '';
  }
  return '';
}

function isGroupStage(match) {
  // StageId 289273 = First Stage (group stage)
  const stageId = String(match.IdStage || '');
  if (stageId === '289273') return true;
  // Also check StageName contains "First Stage"
  const sn = match.StageName;
  if (Array.isArray(sn) && sn.length > 0) {
    const desc = sn[0]?.Description || '';
    if (/Group|First Stage/i.test(desc)) return true;
  }
  // Fallback: has a group name
  if (extractGroupName(match)) return true;
  return false;
}

// ──────────────────────────────────────────────
// 5. Main
// ──────────────────────────────────────────────

async function main() {
  console.log('=== FIFA IdMatch Discovery for World Cup 2026 ===\n');
  console.log(`Local schedule: ${LOCAL_SCHEDULE.length} group-stage matches\n`);

  // 5a. Fetch from FIFA
  console.log('Fetching FIFA calendar...');
  const resp = await fetch(FIFA_CALENDAR_URL, {
    headers: { 'accept': 'application/json', 'user-agent': 'WorldCup2026-Mapping/1.0' }
  });
  if (!resp.ok) throw new Error(`FIFA calendar returned ${resp.status}`);
  const data = await resp.json();
  const allFifaMatches = data.Results || [];
  console.log(`Total FIFA matches returned: ${allFifaMatches.length}\n`);

  // 5b. Parse FIFA group-stage records
  const fifaGroupRecords = [];
  const fifaKnockoutRecords = [];

  for (const m of allFifaMatches) {
    const idMatch = String(m.IdMatch || '').trim();
    const homeName = extractTeamNameFromFifaRecord(m, 'Home');
    const awayName = extractTeamNameFromFifaRecord(m, 'Away');
    const kickoff = m.Date || m.MatchDate || '';
    const group = extractGroupName(m);

    if (!idMatch || !homeName || !awayName) {
      console.log(`  SKIP ${idMatch}: missing data (home="${homeName}", away="${awayName}")`);
      continue;
    }

    const rec = {
      fifaId: idMatch,
      kickoffUtc: kickoff,
      home: normalizeTeam(homeName),
      away: normalizeTeam(awayName),
      group: group ? `Group ${group.replace(/^Group\s*/i, '')}` : '',
      _rawHome: homeName,
      _rawAway: awayName,
    };

    if (isGroupStage(m)) {
      fifaGroupRecords.push(rec);
    } else {
      fifaKnockoutRecords.push(rec);
    }
  }

  console.log(`FIFA group-stage matches: ${fifaGroupRecords.length}`);
  console.log(`FIFA knockout matches:    ${fifaKnockoutRecords.length}\n`);

  // 5c. Match each local match against FIFA records
  const matched = {};
  const unmatchedLocal = [];
  const ambiguousMatches = [];
  const fifaUnmatched = [...fifaGroupRecords];

  const TOLERANCE_SECONDS = 120; // 2 min tolerance

  for (const local of LOCAL_SCHEDULE) {
    const [localHome, localAway] = local.match.split(' vs ');
    const localKey = matchKey(localHome, localAway);
    const localKickoffMs = new Date(local.kickoffUtc).getTime();

    const candidates = fifaGroupRecords.filter(fifa => {
      if (!fifa.kickoffUtc) return false;
      const fifaMs = new Date(fifa.kickoffUtc).getTime();
      const diff = Math.abs(fifaMs - localKickoffMs);
      const homeMatch = fifa.home === normalizeTeam(localHome);
      const awayMatch = fifa.away === normalizeTeam(localAway);
      return homeMatch && awayMatch && diff <= TOLERANCE_SECONDS * 1000;
    });

    if (candidates.length === 0) {
      // Check reversed
      const reversed = fifaGroupRecords.filter(fifa => {
        if (!fifa.kickoffUtc) return false;
        const diff = Math.abs(new Date(fifa.kickoffUtc).getTime() - localKickoffMs);
        return fifa.home === normalizeTeam(localAway) && fifa.away === normalizeTeam(localHome) && diff <= TOLERANCE_SECONDS * 1000;
      });
      if (reversed.length > 0) {
        ambiguousMatches.push({
          local: local.match,
          fifa: reversed.map(r => `${r.home} vs ${r.away} (${r.fifaId})`),
          reason: 'home/away reversed'
        });
      }
      unmatchedLocal.push(local.match);
    } else if (candidates.length === 1) {
      const fifa = candidates[0];
      matched[localKey] = {
        fifaId: fifa.fifaId,
        kickoffUtc: fifa.kickoffUtc,
        home: fifa.home,
        away: fifa.away,
        group: local.group,
        source: 'fifa'
      };
      const idx = fifaUnmatched.indexOf(fifa);
      if (idx >= 0) fifaUnmatched.splice(idx, 1);
    } else {
      ambiguousMatches.push({
        local: local.match,
        fifa: candidates.map(r => `${r.home} vs ${r.away} (${r.fifaId})`),
        reason: 'multiple candidates'
      });
      unmatchedLocal.push(local.match);
    }
  }

  // 5d. Report aliases
  if (Object.keys(EXTRA_ALIASES_REPORTED).length > 0) {
    console.log('Extra aliases discovered:');
    for (const [raw, canonical] of Object.entries(EXTRA_ALIASES_REPORTED)) {
      console.log(`  "${raw}" -> "${canonical}"`);
    }
    console.log();
  }

  // 5e. Report
  console.log('=== MATCHING REPORT ===\n');
  console.log(`Endpoint: calendar/matches (idCompetition=17, idSeason=285023)`);
  console.log();
  console.log(`Local matches found:     ${LOCAL_SCHEDULE.length}`);
  console.log(`FIFA matches found:      ${allFifaMatches.length}`);
  console.log(`FIFA group-stage only:   ${fifaGroupRecords.length}`);
  console.log(`Confidently matched:     ${Object.keys(matched).length}`);
  console.log(`Unmatched local:         ${unmatchedLocal.length}`);
  console.log(`Unmatched FIFA group:    ${fifaUnmatched.length}`);
  console.log(`Ambiguous:               ${ambiguousMatches.length}`);

  if (unmatchedLocal.length > 0) {
    console.log('\n--- Unmatched local schedule rows ---');
    for (const m of unmatchedLocal) console.log(`  ${m}`);
  }

  if (fifaUnmatched.length > 0) {
    console.log('\n--- Unmatched FIFA group matches ---');
    for (const r of fifaUnmatched) {
      console.log(`  ${r.fifaId}: ${r.home} vs ${r.away} @ ${r.kickoffUtc} [${r.group}]`);
    }
  }

  if (ambiguousMatches.length > 0) {
    console.log('\n--- Ambiguous matches ---');
    for (const a of ambiguousMatches) {
      console.log(`  Local: ${a.local} (${a.reason})`);
      for (const f of a.fifa) console.log(`    FIFA: ${f}`);
    }
  }

  // 5f. Write sorted output
  const output = {};
  const sortedKeys = Object.keys(matched).sort((a, b) =>
    matched[a].kickoffUtc.localeCompare(matched[b].kickoffUtc)
  );
  for (const key of sortedKeys) {
    output[key] = matched[key];
  }

  mkdirSync(join(REPO_ROOT, 'src'), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`\nWrote ${Object.keys(output).length} entries to ${OUTPUT_PATH}`);

  // 5g. USA vs Paraguay
  const usaParaguay = output['USA vs Paraguay'];
  if (usaParaguay) {
    console.log('\n=== USA vs Paraguay ===');
    console.log(JSON.stringify(usaParaguay, null, 2));
  }

  // 5h. Verify with line count
  const matchedCount = Object.keys(matched).length;
  if (matchedCount >= 72) {
    console.log('\nRESULT: All 72 group-stage matches matched.');
  } else if (matchedCount >= 48) {
    console.log(`\nRESULT: ${matchedCount}/72 matched. Partial success.`);
  } else {
    console.log(`\nRESULT: Only ${matchedCount}/72 matched. Review needed.`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});