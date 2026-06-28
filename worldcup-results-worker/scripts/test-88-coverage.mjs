#!/usr/bin/env node

/**
 * test-88-coverage.mjs
 *
 * Tests that the Worker always produces exactly 88 matches in the results payload:
 * 72 group-stage + 16 knockout matches.
 *
 * Verifies ensureCompleteScheduleCoverage() fills missing future matches
 * with default NS entries while preserving cached FT results.
 */

// Copy the relevant schedules and functions from index.js
const GROUP_STAGE_SCHEDULE = [
  { "match": "Mexico vs South Africa", "group": "Group A", "kickoffUtc": "2026-06-11T19:00:00Z" },
  { "match": "South Korea vs Czech Republic", "group": "Group A", "kickoffUtc": "2026-06-12T02:00:00Z" },
  { "match": "Canada vs Bosnia & Herzegovina", "group": "Group B", "kickoffUtc": "2026-06-12T19:00:00Z" },
  { "match": "USA vs Paraguay", "group": "Group D", "kickoffUtc": "2026-06-13T01:00:00Z" },
  { "match": "Qatar vs Switzerland", "group": "Group B", "kickoffUtc": "2026-06-13T19:00:00Z" },
  { "match": "Brazil vs Morocco", "group": "Group C", "kickoffUtc": "2026-06-13T22:00:00Z" },
  { "match": "Haiti vs Scotland", "group": "Group C", "kickoffUtc": "2026-06-14T01:00:00Z" },
  { "match": "Australia vs Turkey", "group": "Group D", "kickoffUtc": "2026-06-14T04:00:00Z" },
  { "match": "Germany vs Curacao", "group": "Group E", "kickoffUtc": "2026-06-14T17:00:00Z" },
  { "match": "Netherlands vs Japan", "group": "Group F", "kickoffUtc": "2026-06-14T20:00:00Z" },
  { "match": "Ivory Coast vs Ecuador", "group": "Group E", "kickoffUtc": "2026-06-14T23:00:00Z" },
  { "match": "Sweden vs Tunisia", "group": "Group F", "kickoffUtc": "2026-06-15T02:00:00Z" },
  { "match": "Spain vs Cape Verde", "group": "Group H", "kickoffUtc": "2026-06-15T16:00:00Z" },
  { "match": "Belgium vs Egypt", "group": "Group G", "kickoffUtc": "2026-06-15T19:00:00Z" },
  { "match": "Saudi Arabia vs Uruguay", "group": "Group H", "kickoffUtc": "2026-06-15T22:00:00Z" },
  { "match": "Iran vs New Zealand", "group": "Group G", "kickoffUtc": "2026-06-16T01:00:00Z" },
  { "match": "France vs Senegal", "group": "Group I", "kickoffUtc": "2026-06-16T19:00:00Z" },
  { "match": "Iraq vs Norway", "group": "Group I", "kickoffUtc": "2026-06-16T22:00:00Z" },
  { "match": "Argentina vs Algeria", "group": "Group J", "kickoffUtc": "2026-06-17T01:00:00Z" },
  { "match": "Austria vs Jordan", "group": "Group J", "kickoffUtc": "2026-06-17T04:00:00Z" },
  { "match": "Portugal vs DR Congo", "group": "Group K", "kickoffUtc": "2026-06-17T17:00:00Z" },
  { "match": "England vs Croatia", "group": "Group L", "kickoffUtc": "2026-06-17T20:00:00Z" },
  { "match": "Ghana vs Panama", "group": "Group L", "kickoffUtc": "2026-06-17T23:00:00Z" },
  { "match": "Uzbekistan vs Colombia", "group": "Group K", "kickoffUtc": "2026-06-18T02:00:00Z" },
  { "match": "Czech Republic vs South Africa", "group": "Group A", "kickoffUtc": "2026-06-18T16:00:00Z" },
  { "match": "Switzerland vs Bosnia & Herzegovina", "group": "Group B", "kickoffUtc": "2026-06-18T19:00:00Z" },
  { "match": "Canada vs Qatar", "group": "Group B", "kickoffUtc": "2026-06-18T22:00:00Z" },
  { "match": "Mexico vs South Korea", "group": "Group A", "kickoffUtc": "2026-06-19T01:00:00Z" },
  { "match": "USA vs Australia", "group": "Group D", "kickoffUtc": "2026-06-19T19:00:00Z" },
  { "match": "Scotland vs Morocco", "group": "Group C", "kickoffUtc": "2026-06-19T22:00:00Z" },
  { "match": "Brazil vs Haiti", "group": "Group C", "kickoffUtc": "2026-06-20T00:30:00Z" },
  { "match": "Turkey vs Paraguay", "group": "Group D", "kickoffUtc": "2026-06-20T03:00:00Z" },
  { "match": "Netherlands vs Sweden", "group": "Group F", "kickoffUtc": "2026-06-20T17:00:00Z" },
  { "match": "Germany vs Ivory Coast", "group": "Group E", "kickoffUtc": "2026-06-20T20:00:00Z" },
  { "match": "Ecuador vs Curacao", "group": "Group E", "kickoffUtc": "2026-06-21T00:00:00Z" },
  { "match": "Tunisia vs Japan", "group": "Group F", "kickoffUtc": "2026-06-21T04:00:00Z" },
  { "match": "Spain vs Saudi Arabia", "group": "Group H", "kickoffUtc": "2026-06-21T16:00:00Z" },
  { "match": "Belgium vs Iran", "group": "Group G", "kickoffUtc": "2026-06-21T19:00:00Z" },
  { "match": "Uruguay vs Cape Verde", "group": "Group H", "kickoffUtc": "2026-06-21T22:00:00Z" },
  { "match": "New Zealand vs Egypt", "group": "Group G", "kickoffUtc": "2026-06-22T01:00:00Z" },
  { "match": "Argentina vs Austria", "group": "Group J", "kickoffUtc": "2026-06-22T17:00:00Z" },
  { "match": "France vs Iraq", "group": "Group I", "kickoffUtc": "2026-06-22T21:00:00Z" },
  { "match": "Norway vs Senegal", "group": "Group I", "kickoffUtc": "2026-06-23T00:00:00Z" },
  { "match": "Jordan vs Algeria", "group": "Group J", "kickoffUtc": "2026-06-23T03:00:00Z" },
  { "match": "Portugal vs Uzbekistan", "group": "Group K", "kickoffUtc": "2026-06-23T17:00:00Z" },
  { "match": "England vs Ghana", "group": "Group L", "kickoffUtc": "2026-06-23T20:00:00Z" },
  { "match": "Panama vs Croatia", "group": "Group L", "kickoffUtc": "2026-06-23T23:00:00Z" },
  { "match": "Colombia vs DR Congo", "group": "Group K", "kickoffUtc": "2026-06-24T02:00:00Z" },
  { "match": "Switzerland vs Canada", "group": "Group B", "kickoffUtc": "2026-06-24T19:00:00Z" },
  { "match": "Bosnia & Herzegovina vs Qatar", "group": "Group B", "kickoffUtc": "2026-06-24T19:00:00Z" },
  { "match": "Morocco vs Haiti", "group": "Group C", "kickoffUtc": "2026-06-24T22:00:00Z" },
  { "match": "Scotland vs Brazil", "group": "Group C", "kickoffUtc": "2026-06-24T22:00:00Z" },
  { "match": "South Africa vs South Korea", "group": "Group A", "kickoffUtc": "2026-06-25T01:00:00Z" },
  { "match": "Czech Republic vs Mexico", "group": "Group A", "kickoffUtc": "2026-06-25T01:00:00Z" },
  { "match": "Curacao vs Ivory Coast", "group": "Group E", "kickoffUtc": "2026-06-25T20:00:00Z" },
  { "match": "Ecuador vs Germany", "group": "Group E", "kickoffUtc": "2026-06-25T20:00:00Z" },
  { "match": "Tunisia vs Netherlands", "group": "Group F", "kickoffUtc": "2026-06-25T23:00:00Z" },
  { "match": "Japan vs Sweden", "group": "Group F", "kickoffUtc": "2026-06-25T23:00:00Z" },
  { "match": "Turkey vs USA", "group": "Group D", "kickoffUtc": "2026-06-26T02:00:00Z" },
  { "match": "Paraguay vs Australia", "group": "Group D", "kickoffUtc": "2026-06-26T02:00:00Z" },
  { "match": "Norway vs France", "group": "Group I", "kickoffUtc": "2026-06-26T19:00:00Z" },
  { "match": "Senegal vs Iraq", "group": "Group I", "kickoffUtc": "2026-06-26T19:00:00Z" },
  { "match": "Cape Verde vs Saudi Arabia", "group": "Group H", "kickoffUtc": "2026-06-27T00:00:00Z" },
  { "match": "Uruguay vs Spain", "group": "Group H", "kickoffUtc": "2026-06-27T00:00:00Z" },
  { "match": "New Zealand vs Belgium", "group": "Group G", "kickoffUtc": "2026-06-27T03:00:00Z" },
  { "match": "Egypt vs Iran", "group": "Group G", "kickoffUtc": "2026-06-27T03:00:00Z" },
  { "match": "Panama vs England", "group": "Group L", "kickoffUtc": "2026-06-27T21:00:00Z" },
  { "match": "Croatia vs Ghana", "group": "Group L", "kickoffUtc": "2026-06-27T21:00:00Z" },
  { "match": "Colombia vs Portugal", "group": "Group K", "kickoffUtc": "2026-06-27T23:30:00Z" },
  { "match": "DR Congo vs Uzbekistan", "group": "Group K", "kickoffUtc": "2026-06-27T23:30:00Z" },
  { "match": "Algeria vs Austria", "group": "Group J", "kickoffUtc": "2026-06-28T02:00:00Z" },
  { "match": "Jordan vs Argentina", "group": "Group J", "kickoffUtc": "2026-06-28T02:00:00Z" }
];

const KNOCKOUT_SCHEDULE = [
  { match: "South Africa vs Canada", round: "Round of 32", matchNumber: 73, kickoffUtc: "2026-06-28T19:00:00Z" },
  { match: "Brazil vs Japan", round: "Round of 32", matchNumber: 76, kickoffUtc: "2026-06-29T17:00:00Z" },
  { match: "Germany vs Paraguay", round: "Round of 32", matchNumber: 74, kickoffUtc: "2026-06-29T20:30:00Z" },
  { match: "Netherlands vs Morocco", round: "Round of 32", matchNumber: 75, kickoffUtc: "2026-06-30T01:00:00Z" },
  { match: "Ivory Coast vs Norway", round: "Round of 32", matchNumber: 78, kickoffUtc: "2026-06-30T17:00:00Z" },
  { match: "France vs Sweden", round: "Round of 32", matchNumber: 77, kickoffUtc: "2026-06-30T21:00:00Z" },
  { match: "Mexico vs Ecuador", round: "Round of 32", matchNumber: 79, kickoffUtc: "2026-07-01T01:00:00Z" },
  { match: "England vs DR Congo", round: "Round of 32", matchNumber: 80, kickoffUtc: "2026-07-01T16:00:00Z" },
  { match: "Belgium vs Senegal", round: "Round of 32", matchNumber: 82, kickoffUtc: "2026-07-01T20:00:00Z" },
  { match: "USA vs Bosnia & Herzegovina", round: "Round of 32", matchNumber: 81, kickoffUtc: "2026-07-02T00:00:00Z" },
  { match: "Spain vs Austria", round: "Round of 32", matchNumber: 84, kickoffUtc: "2026-07-02T19:00:00Z" },
  { match: "Portugal vs Croatia", round: "Round of 32", matchNumber: 83, kickoffUtc: "2026-07-02T23:00:00Z" },
  { match: "Switzerland vs Algeria", round: "Round of 32", matchNumber: 85, kickoffUtc: "2026-07-03T03:00:00Z" },
  { match: "Australia vs Egypt", round: "Round of 32", matchNumber: 88, kickoffUtc: "2026-07-03T18:00:00Z" },
  { match: "Argentina vs Cape Verde", round: "Round of 32", matchNumber: 86, kickoffUtc: "2026-07-03T22:00:00Z" },
  { match: "Colombia vs Ghana", round: "Round of 32", matchNumber: 87, kickoffUtc: "2026-07-04T01:30:00Z" }
];

function isMatchFinal(cachedResult, matchKey) {
  const match = cachedResult?.matches?.[matchKey];
  if (!match) return false;
  const status = String(match.status || '').toUpperCase();
  return status === 'FT' || status === 'AET' || status === 'PEN';
}

function formatRoundOrGroup(value) {
  const group = String(value || '').trim();
  if (!group) return '';
  if (/^group\b/i.test(group)) return group.replace(/^group\s*/i, 'Group ');
  if (/^[A-L]$/i.test(group)) return `Group ${group.toUpperCase()}`;
  if (/^round\b/i.test(group)) return group;
  return group;
}

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
          score: `${home} ${home}-${away} ${away}`,
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
          score: `${home} ${home}-${away} ${away}`,
          note: formatRoundOrGroup(m.round || 'R32')
        };
      }
    }
  }
}

// ========== Tests ==========
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    console.log(`  PASS: ${label} (${JSON.stringify(actual)})`);
    passed++;
  } else {
    console.log(`  FAIL: ${label} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

console.log('=== 88-Match Coverage Tests ===');
console.log();

// ====================================================================
// Test 1: Upstream returns only 8 knockout match results (the 8 that
// have kicked off so far). ensureCompleteScheduleCoverage fills the
// missing 8 future matches with NS defaults.
// ====================================================================
console.log('Test 1: Simulate upstream with 8 knockout results, verify 88 total');
console.log();

const upstreamMatches = {
  // 72 group-stage matches (all played by now)
  "Mexico vs South Africa": { status: 'FT', score: 'Mexico 2-1 South Africa', note: 'Group A' },
  "South Korea vs Czech Republic": { status: 'FT', score: 'South Korea 1-1 Czech Republic', note: 'Group A' },
  "Canada vs Bosnia & Herzegovina": { status: 'FT', score: 'Canada 0-0 Bosnia & Herzegovina', note: 'Group B' },
  "USA vs Paraguay": { status: 'FT', score: 'USA 3-0 Paraguay', note: 'Group D' },
  "Qatar vs Switzerland": { status: 'FT', score: 'Qatar 1-2 Switzerland', note: 'Group B' },
  "Brazil vs Morocco": { status: 'FT', score: 'Brazil 4-0 Morocco', note: 'Group C' },
  "Haiti vs Scotland": { status: 'FT', score: 'Haiti 0-2 Scotland', note: 'Group C' },
  "Australia vs Turkey": { status: 'FT', score: 'Australia 2-1 Turkey', note: 'Group D' },
  "Germany vs Curacao": { status: 'FT', score: 'Germany 5-0 Curacao', note: 'Group E' },
  "Netherlands vs Japan": { status: 'FT', score: 'Netherlands 2-0 Japan', note: 'Group F' },
  "Ivory Coast vs Ecuador": { status: 'FT', score: 'Ivory Coast 1-1 Ecuador', note: 'Group E' },
  "Sweden vs Tunisia": { status: 'FT', score: 'Sweden 2-1 Tunisia', note: 'Group F' },
  "Spain vs Cape Verde": { status: 'FT', score: 'Spain 3-0 Cape Verde', note: 'Group H' },
  "Belgium vs Egypt": { status: 'FT', score: 'Belgium 1-1 Egypt', note: 'Group G' },
  "Saudi Arabia vs Uruguay": { status: 'FT', score: 'Saudi Arabia 0-2 Uruguay', note: 'Group H' },
  "Iran vs New Zealand": { status: 'FT', score: 'Iran 1-0 New Zealand', note: 'Group G' },
  "France vs Senegal": { status: 'FT', score: 'France 3-1 Senegal', note: 'Group I' },
  "Iraq vs Norway": { status: 'FT', score: 'Iraq 0-3 Norway', note: 'Group I' },
  "Argentina vs Algeria": { status: 'FT', score: 'Argentina 2-0 Algeria', note: 'Group J' },
  "Austria vs Jordan": { status: 'FT', score: 'Austria 1-0 Jordan', note: 'Group J' },
  "Portugal vs DR Congo": { status: 'FT', score: 'Portugal 4-0 DR Congo', note: 'Group K' },
  "England vs Croatia": { status: 'FT', score: 'England 2-0 Croatia', note: 'Group L' },
  "Ghana vs Panama": { status: 'FT', score: 'Ghana 1-0 Panama', note: 'Group L' },
  "Uzbekistan vs Colombia": { status: 'FT', score: 'Uzbekistan 0-1 Colombia', note: 'Group K' },
  "Czech Republic vs South Africa": { status: 'FT', score: 'Czech Republic 2-1 South Africa', note: 'Group A' },
  "Switzerland vs Bosnia & Herzegovina": { status: 'FT', score: 'Switzerland 2-0 Bosnia & Herzegovina', note: 'Group B' },
  "Canada vs Qatar": { status: 'FT', score: 'Canada 1-0 Qatar', note: 'Group B' },
  "Mexico vs South Korea": { status: 'FT', score: 'Mexico 2-2 South Korea', note: 'Group A' },
  "USA vs Australia": { status: 'FT', score: 'USA 1-0 Australia', note: 'Group D' },
  "Scotland vs Morocco": { status: 'FT', score: 'Scotland 1-1 Morocco', note: 'Group C' },
  "Brazil vs Haiti": { status: 'FT', score: 'Brazil 5-0 Haiti', note: 'Group C' },
  "Turkey vs Paraguay": { status: 'FT', score: 'Turkey 0-0 Paraguay', note: 'Group D' },
  "Netherlands vs Sweden": { status: 'FT', score: 'Netherlands 1-0 Sweden', note: 'Group F' },
  "Germany vs Ivory Coast": { status: 'FT', score: 'Germany 3-0 Ivory Coast', note: 'Group E' },
  "Ecuador vs Curacao": { status: 'FT', score: 'Ecuador 2-0 Curacao', note: 'Group E' },
  "Tunisia vs Japan": { status: 'FT', score: 'Tunisia 0-0 Japan', note: 'Group F' },
  "Spain vs Saudi Arabia": { status: 'FT', score: 'Spain 4-0 Saudi Arabia', note: 'Group H' },
  "Belgium vs Iran": { status: 'FT', score: 'Belgium 2-0 Iran', note: 'Group G' },
  "Uruguay vs Cape Verde": { status: 'FT', score: 'Uruguay 3-0 Cape Verde', note: 'Group H' },
  "New Zealand vs Egypt": { status: 'FT', score: 'New Zealand 1-1 Egypt', note: 'Group G' },
  "Argentina vs Austria": { status: 'FT', score: 'Argentina 3-0 Austria', note: 'Group J' },
  "France vs Iraq": { status: 'FT', score: 'France 2-0 Iraq', note: 'Group I' },
  "Norway vs Senegal": { status: 'FT', score: 'Norway 1-0 Senegal', note: 'Group I' },
  "Jordan vs Algeria": { status: 'FT', score: 'Jordan 0-1 Algeria', note: 'Group J' },
  "Portugal vs Uzbekistan": { status: 'FT', score: 'Portugal 3-1 Uzbekistan', note: 'Group K' },
  "England vs Ghana": { status: 'FT', score: 'England 3-0 Ghana', note: 'Group L' },
  "Panama vs Croatia": { status: 'FT', score: 'Panama 0-2 Croatia', note: 'Group L' },
  "Colombia vs DR Congo": { status: 'FT', score: 'Colombia 1-0 DR Congo', note: 'Group K' },
  "Switzerland vs Canada": { status: 'FT', score: 'Switzerland 1-1 Canada', note: 'Group B' },
  "Bosnia & Herzegovina vs Qatar": { status: 'FT', score: 'Bosnia & Herzegovina 2-0 Qatar', note: 'Group B' },
  "Morocco vs Haiti": { status: 'FT', score: 'Morocco 3-0 Haiti', note: 'Group C' },
  "Scotland vs Brazil": { status: 'FT', score: 'Scotland 0-4 Brazil', note: 'Group C' },
  "South Africa vs South Korea": { status: 'FT', score: 'South Africa 1-2 South Korea', note: 'Group A' },
  "Czech Republic vs Mexico": { status: 'FT', score: 'Czech Republic 1-1 Mexico', note: 'Group A' },
  "Curacao vs Ivory Coast": { status: 'FT', score: 'Curacao 0-3 Ivory Coast', note: 'Group E' },
  "Ecuador vs Germany": { status: 'FT', score: 'Ecuador 1-1 Germany', note: 'Group E' },
  "Tunisia vs Netherlands": { status: 'FT', score: 'Tunisia 0-2 Netherlands', note: 'Group F' },
  "Japan vs Sweden": { status: 'FT', score: 'Japan 1-0 Sweden', note: 'Group F' },
  "Turkey vs USA": { status: 'FT', score: 'Turkey 1-2 USA', note: 'Group D' },
  "Paraguay vs Australia": { status: 'FT', score: 'Paraguay 0-1 Australia', note: 'Group D' },
  "Norway vs France": { status: 'FT', score: 'Norway 0-3 France', note: 'Group I' },
  "Senegal vs Iraq": { status: 'FT', score: 'Senegal 2-1 Iraq', note: 'Group I' },
  "Cape Verde vs Saudi Arabia": { status: 'FT', score: 'Cape Verde 1-1 Saudi Arabia', note: 'Group H' },
  "Uruguay vs Spain": { status: 'FT', score: 'Uruguay 0-2 Spain', note: 'Group H' },
  "New Zealand vs Belgium": { status: 'FT', score: 'New Zealand 0-3 Belgium', note: 'Group G' },
  "Egypt vs Iran": { status: 'FT', score: 'Egypt 2-1 Iran', note: 'Group G' },
  "Panama vs England": { status: 'FT', score: 'Panama 0-5 England', note: 'Group L' },
  "Croatia vs Ghana": { status: 'FT', score: 'Croatia 2-0 Ghana', note: 'Group L' },
  "Colombia vs Portugal": { status: 'FT', score: 'Colombia 1-1 Portugal', note: 'Group K' },
  "DR Congo vs Uzbekistan": { status: 'FT', score: 'DR Congo 0-0 Uzbekistan', note: 'Group K' },
  "Algeria vs Austria": { status: 'FT', score: 'Algeria 1-0 Austria', note: 'Group J' },
  "Jordan vs Argentina": { status: 'FT', score: 'Jordan 0-4 Argentina', note: 'Group J' },
  // Only 8 knockout matches returned by upstream (the 8 that have kicked off)
  "South Africa vs Canada": { status: 'FT', score: 'South Africa 1-0 Canada', note: 'R32' },
  "Brazil vs Japan": { status: 'FT', score: 'Brazil 3-1 Japan', note: 'R32' },
  "Germany vs Paraguay": { status: 'LIVE', score: 'Germany 1-0 Paraguay', elapsed: "30'", note: 'R32' },
  "Netherlands vs Morocco": { status: 'FT', score: 'Netherlands 2-1 Morocco', note: 'R32' },
  "Ivory Coast vs Norway": { status: 'FT', score: 'Ivory Coast 0-0 Norway', note: 'R32' },
  "France vs Sweden": { status: 'FT', score: 'France 2-1 Sweden', note: 'R32' },
  "Mexico vs Ecuador": { status: 'LIVE', score: 'Mexico 0-0 Ecuador', elapsed: "15'", note: 'R32' },
  "England vs DR Congo": { status: 'NS', score: 'England 0-0 DR Congo', note: 'R32' }
};

const matches = { ...upstreamMatches };

// Run the coverage function with no cached result
ensureCompleteScheduleCoverage(matches, null);

const matchKeys = Object.keys(matches);
const groupKeys = matchKeys.filter(k => GROUP_STAGE_SCHEDULE.some(m => m.match === k));
const koKeys = matchKeys.filter(k => KNOCKOUT_SCHEDULE.some(m => m.match === k));

assertEqual(matchKeys.length, 88, 'Total match count is 88');
assertEqual(groupKeys.length, 72, 'Group-stage match count is 72');
assertEqual(koKeys.length, 16, 'Knockout match count is 16');

// Verify all specific future matches exist as NS defaults
console.log();
console.log('=== Missing fixture verification ===');

assert(Boolean(matches['France vs Sweden']), 'France vs Sweden exists');
assertEqual(matches['France vs Sweden'].status, 'FT', 'France vs Sweden status is FT (from upstream)');

assert(Boolean(matches['Mexico vs Ecuador']), 'Mexico vs Ecuador exists');
assertEqual(matches['Mexico vs Ecuador'].status, 'LIVE', 'Mexico vs Ecuador status is LIVE (from upstream)');

assert(Boolean(matches['England vs DR Congo']), 'England vs DR Congo exists');
assertEqual(matches['England vs DR Congo'].status, 'NS', 'England vs DR Congo status is NS (from upstream)');

// These 8 future KO matches were NOT in upstream, should be NS defaults
assert(Boolean(matches['Belgium vs Senegal']), 'Belgium vs Senegal exists (filled by ensureCompleteScheduleCoverage)');
assertEqual(matches['Belgium vs Senegal'].status, 'NS', 'Belgium vs Senegal status is NS');

assert(Boolean(matches['Spain vs Austria']), 'Spain vs Austria exists (filled by ensureCompleteScheduleCoverage)');
assertEqual(matches['Spain vs Austria'].status, 'NS', 'Spain vs Austria status is NS');

assert(Boolean(matches['Portugal vs Croatia']), 'Portugal vs Croatia exists (filled by ensureCompleteScheduleCoverage)');
assertEqual(matches['Portugal vs Croatia'].status, 'NS', 'Portugal vs Croatia status is NS');

assert(Boolean(matches['Switzerland vs Algeria']), 'Switzerland vs Algeria exists (filled by ensureCompleteScheduleCoverage)');
assertEqual(matches['Switzerland vs Algeria'].status, 'NS', 'Switzerland vs Algeria status is NS');

assert(Boolean(matches['Australia vs Egypt']), 'Australia vs Egypt exists (filled by ensureCompleteScheduleCoverage)');
assertEqual(matches['Australia vs Egypt'].status, 'NS', 'Australia vs Egypt status is NS');

assert(Boolean(matches['Argentina vs Cape Verde']), 'Argentina vs Cape Verde exists (filled by ensureCompleteScheduleCoverage)');
assertEqual(matches['Argentina vs Cape Verde'].status, 'NS', 'Argentina vs Cape Verde status is NS');

assert(Boolean(matches['Colombia vs Ghana']), 'Colombia vs Ghana exists (filled by ensureCompleteScheduleCoverage)');
assertEqual(matches['Colombia vs Ghana'].status, 'NS', 'Colombia vs Ghana status is NS');

// Also USA vs Bosnia was not in upstream, should be filled
assert(Boolean(matches['USA vs Bosnia & Herzegovina']), 'USA vs Bosnia & Herzegovina exists (filled by ensureCompleteScheduleCoverage)');
assertEqual(matches['USA vs Bosnia & Herzegovina'].status, 'NS', 'USA vs Bosnia & Herzegovina status is NS');

// ====================================================================
// Test 2: Cached FT results are preserved (not overwritten by NS defaults)
// ====================================================================
console.log();
console.log('Test 2: Cached FT results preserved');
console.log();

const cachedResult = {
  matches: {
    "Australia vs Egypt": { status: 'FT', score: 'Australia 2-1 Egypt', note: 'R32' },
    "Argentina vs Cape Verde": { status: 'FT', score: 'Argentina 3-0 Cape Verde', note: 'R32' },
    "Colombia vs Ghana": { status: 'PEN', score: 'Colombia 0-0 Ghana', note: 'R32 PEN: 4-2' }
  }
};

// Simulate upsteam that has neither of these (they are future matches not yet returned)
const emptyMatches = {};
ensureCompleteScheduleCoverage(emptyMatches, cachedResult);

assertEqual(emptyMatches['Australia vs Egypt'].status, 'FT', 'Australia vs Egypt remains FT from cache');
assertEqual(emptyMatches['Argentina vs Cape Verde'].status, 'FT', 'Argentina vs Cape Verde remains FT from cache');
assertEqual(emptyMatches['Colombia vs Ghana'].status, 'PEN', 'Colombia vs Ghana remains PEN from cache');

// Non-cached future match should be NS default
assertEqual(emptyMatches['South Africa vs Canada'].status, 'NS', 'South Africa vs Canada is NS (no cached FT)');

const emptyMatchKeys = Object.keys(emptyMatches);
assertEqual(emptyMatchKeys.length, 88, 'Total still 88 after cached FT overlay');

// ====================================================================
// Test 3: All 16 knockout keys exist
// ====================================================================
console.log();
console.log('Test 3: All 16 knockout keys present');
console.log();

const allKoKeys = KNOCKOUT_SCHEDULE.map(m => m.match);
for (const key of allKoKeys) {
  assert(Boolean(matches[key]), `Knockout key exists: ${key}`);
}

// ========== Summary ==========
console.log();
console.log('=== Summary ===');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
console.log();

if (failed === 0) {
  console.log('All tests passed.');
} else {
  console.log('Some tests FAILED.');
  process.exit(1);
}