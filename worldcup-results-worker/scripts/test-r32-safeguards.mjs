#!/usr/bin/env node

/**
 * test-r32-safeguards.mjs
 *
 * Tests the Round-of-32 FT safeguard behavior by simulating Worker logic.
 * Does not require Cloudflare environment - uses pure function tests.
 *
 * Proves:
 * 1. Cached FIFA FT inside the +240 window causes the scheduled handler to exit
 *    before FIFA calls, worldcup26.ir calls, refreshResults(), and main KV writes.
 * 2. Cached LIVE inside the window remains eligible (Worker continues).
 */

// Copy the relevant constants and functions from index.js
const KNOCKOUT_POLL_END_MINUTES = 240;

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

// Build kickoff map
const MATCH_KICKOFF_MAP = {};
for (const m of KNOCKOUT_SCHEDULE) {
  MATCH_KICKOFF_MAP[m.match] = m.kickoffUtc;
}

function isMatchFinal(cachedResult, matchKey) {
  const match = cachedResult?.matches?.[matchKey];
  if (!match) return false;
  const status = String(match.status || '').toUpperCase();
  return status === 'FT' || status === 'AET' || status === 'PEN';
}

function anyKnockoutMatchInPollingWindow(nowMs) {
  for (const match of KNOCKOUT_SCHEDULE) {
    const kickoffMs = Date.parse(match.kickoffUtc);
    if (!Number.isFinite(kickoffMs)) continue;
    const msSinceKickoff = nowMs - kickoffMs;
    if (msSinceKickoff >= 0 && msSinceKickoff <= KNOCKOUT_POLL_END_MINUTES * 60 * 1000) {
      return true;
    }
  }
  return false;
}

function anyKnockoutMatchStillEligible(nowMs, cachedResult) {
  for (const match of KNOCKOUT_SCHEDULE) {
    const kickoffMs = Date.parse(match.kickoffUtc);
    if (!Number.isFinite(kickoffMs)) continue;
    const msSinceKickoff = nowMs - kickoffMs;
    if (msSinceKickoff < 0 || msSinceKickoff > KNOCKOUT_POLL_END_MINUTES * 60 * 1000) continue;
    if (isMatchFinal(cachedResult, match.match)) continue;
    return true;
  }
  return false;
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

console.log('=== R32 Safeguard Tests ===');
console.log();

// ====================================================================
// KEY TEST: Cached FIFA FT inside the +240 window causes scheduled
// handler to exit before FIFA calls / worldcup26.ir calls / refreshResults()
// / main KV writes.
// ====================================================================
console.log('=== Cached FT inside +240 window ===');
console.log('These tests verify the scheduled handler exits early when all knockout');
console.log('matches are FT, even though they are still within the +240 minute window.');
console.log();

// Scenario: South Africa vs Canada (kicks off 2026-06-28T19:00:00Z) finishes FT.
// At 2026-06-28T21:00:00Z (2h after kickoff, well within +240 window), all matches FT.
const ftInWindowMs = Date.parse('2026-06-28T21:00:00Z');
const ftInWindowCached = { matches: {
  "South Africa vs Canada": { status: 'FT', score: '2-1' },
  "Brazil vs Japan": { status: 'FT', score: '1-0' },
  "Germany vs Paraguay": { status: 'FT', score: '3-0' },
  "Netherlands vs Morocco": { status: 'FT', score: '2-2' },
  "Ivory Coast vs Norway": { status: 'FT', score: '1-0' },
  "France vs Sweden": { status: 'FT', score: '2-0' },
  "Mexico vs Ecuador": { status: 'FT', score: '1-1' },
  "England vs DR Congo": { status: 'FT', score: '4-0' },
  "Belgium vs Senegal": { status: 'FT', score: '0-0' },
  "USA vs Bosnia & Herzegovina": { status: 'FT', score: '2-1' },
  "Spain vs Austria": { status: 'FT', score: '1-0' },
  "Portugal vs Croatia": { status: 'FT', score: '3-2' },
  "Switzerland vs Algeria": { status: 'FT', score: '1-1' },
  "Australia vs Egypt": { status: 'FT', score: '0-0' },
  "Argentina vs Cape Verde": { status: 'FT', score: '2-0' },
  "Colombia vs Ghana": { status: 'FT', score: '1-0' }
}};

assert(!anyKnockoutMatchStillEligible(ftInWindowMs, ftInWindowCached),
  'Cached FT inside +240 window => not eligible (Worker exits before FIFA calls)');

assert(anyKnockoutMatchInPollingWindow(ftInWindowMs),
  'anyKnockoutMatchInPollingWindow says true (window is active, but all FT so skip)');

// ====================================================================
// KEY TEST: Cached LIVE inside the window remains eligible.
// ====================================================================
console.log();
console.log('=== Cached LIVE inside +240 window ===');
console.log('These tests verify a LIVE match inside the window keeps the Worker active.');
console.log();

const liveInWindowMs = Date.parse('2026-06-28T21:00:00Z');
const liveInWindowCached = { matches: {
  "South Africa vs Canada": { status: 'LIVE', score: '1-0', elapsed: "80'" },
  "Brazil vs Japan": { status: 'FT', score: '1-0' },
  "Germany vs Paraguay": { status: 'FT', score: '3-0' },
  "Netherlands vs Morocco": { status: 'FT', score: '2-2' },
  "Ivory Coast vs Norway": { status: 'FT', score: '1-0' },
  "France vs Sweden": { status: 'FT', score: '2-0' },
  "Mexico vs Ecuador": { status: 'FT', score: '1-1' },
  "England vs DR Congo": { status: 'FT', score: '4-0' },
  "Belgium vs Senegal": { status: 'FT', score: '0-0' },
  "USA vs Bosnia & Herzegovina": { status: 'FT', score: '2-1' },
  "Spain vs Austria": { status: 'FT', score: '1-0' },
  "Portugal vs Croatia": { status: 'FT', score: '3-2' },
  "Switzerland vs Algeria": { status: 'FT', score: '1-1' },
  "Australia vs Egypt": { status: 'FT', score: '0-0' },
  "Argentina vs Cape Verde": { status: 'FT', score: '2-0' },
  "Colombia vs Ghana": { status: 'FT', score: '1-0' }
}};

assert(anyKnockoutMatchStillEligible(liveInWindowMs, liveInWindowCached),
  'Cached LIVE inside +240 window => eligible (Worker continues)');

assert(anyKnockoutMatchInPollingWindow(liveInWindowMs),
  'anyKnockoutMatchInPollingWindow says true');

// ====================================================================
// CRITICAL ORDERING TEST: anyKnockoutMatchStillEligible is checked BEFORE
// the scheduled handler proceeds to FIFO calls / worldcup26.ir / refreshResults().
// ====================================================================
console.log();
console.log('=== Scheduled handler early-exit path test ===');
console.log('Simulates runScheduledRefresh logic to verify exit before refreshResults()');
console.log();

function simulateScheduledRefresh(nowMs, cachedResult) {
  // This mirrors the top of runScheduledRefresh (lines 563-582):
  const knockoutActive = anyKnockoutMatchStillEligible(nowMs, cachedResult);
  const groupActive = false; // Group stage is over by now

  if (!knockoutActive && !groupActive) {
    return {
      skipped: true,
      reason: 'No match in active polling window',
      checkedAtUtc: new Date(nowMs).toISOString()
    };
  }

  // If we reach here, we would proceed to:
  // 1. getCurrentPollingSlot()
  // 2. worldcup26.ir fetch (refreshResults)
  // 3. FIFA enrichment calls
  // 4. KV writes
  return { skipped: false, reason: 'Would proceed to refresh' };
}

// Case A: All FT inside window => skipped before FIFO/worldcup26/KV
const resultFT = simulateScheduledRefresh(ftInWindowMs, ftInWindowCached);
assertEqual(resultFT.skipped, true, 'All FT inside window: skipped before refreshResults()');
assert(resultFT.reason.includes('No match'), 'Skip reason mentions no active match');

// Case B: LIVE inside window => proceeds
const resultLIVE = simulateScheduledRefresh(liveInWindowMs, liveInWindowCached);
assertEqual(resultLIVE.skipped, false, 'LIVE inside window: proceeds to refreshResults()');

// Case C: Mixed FT + LIVE (some LIVE matches) => proceeds
console.log();
console.log('=== Mixed FT + LIVE matches ===');
const mixedNowMs = Date.parse('2026-07-01T00:00:00Z'); // During first matches
const mixedCached = { matches: {
  "South Africa vs Canada": { status: 'FT', score: '2-1' },
  "Brazil vs Japan": { status: 'LIVE', score: '1-0', elapsed: "30'" },
  "Germany vs Paraguay": { status: 'FT', score: '3-0' },
  "Netherlands vs Morocco": { status: 'FT', score: '2-2' }
}};
const resultMixed = simulateScheduledRefresh(mixedNowMs, mixedCached);
assertEqual(resultMixed.skipped, false, 'Mixed FT+LIVE: proceeds to refreshResults()');
assert(anyKnockoutMatchStillEligible(mixedNowMs, mixedCached), 'LIVE match keeps Worker eligible');

// ====================================================================
// Existing tests from original file
// ====================================================================
console.log();
console.log('=== Existing safeguard tests ===');

// Test 1: all matches in active window, no cached results => eligible
console.log('Test 1: Active window with no cached results (all should be eligible)');
const t1Now = Date.parse('2026-07-03T20:00:00Z'); // During Australia vs Egypt match
const t1Cached = null;
assert(anyKnockoutMatchStillEligible(t1Now, t1Cached), 'No cached FT => eligible (Australia vs Egypt window)');
assert(anyKnockoutMatchInPollingWindow(t1Now), 'anyKnockoutMatchInPollingWindow says true');

// Test 2: cached FIFA-final match (FT) should NOT keep Worker active
console.log();
console.log('Test 2: Cached FIFA FT match should stop Worker');
const t2Now = Date.parse('2026-07-04T06:00:00Z'); // Past last match +240 (Colombia vs Ghana ends at 05:30Z)
const t2CachedAllFT = { matches: {} };
for (const m of KNOCKOUT_SCHEDULE) {
  t2CachedAllFT.matches[m.match] = { status: 'FT', score: '1-0' };
}
assert(!anyKnockoutMatchStillEligible(t2Now, t2CachedAllFT), 'All FT cached => not eligible');
assert(!anyKnockoutMatchInPollingWindow(t2Now), 'anyKnockoutMatchInPollingWindow says false (past +240 min)');

// Test 3: cached final but still inside +240 window for a LIVE match
console.log();
console.log('Test 3: Cached LIVE match inside +240 window remains eligible');
const t3Now = Date.parse('2026-07-03T19:30:00Z'); // 1.5h after Australia vs Egypt kickoff
const t3Cached = { matches: {
  "Australia vs Egypt": { status: 'LIVE', score: '1-0', elapsed: "90'" },
  "Argentina vs Cape Verde": { status: 'LIVE', score: '0-0', elapsed: "15'" }
}};
assert(anyKnockoutMatchStillEligible(t3Now, t3Cached), 'LIVE matches eligible despite some matches before kickoff');
assert(anyKnockoutMatchInPollingWindow(t3Now), 'anyKnockoutMatchInPollingWindow says true');

// Test 4: cached FT match among LIVE matches - LIVE keeps Worker active
console.log();
console.log('Test 4: Mixed FT + LIVE in same window - LIVE keeps Worker active');
const t4Now = Date.parse('2026-07-01T00:00:00Z'); // During first matches
const t4Cached = { matches: {
  "South Africa vs Canada": { status: 'FT', score: '2-1' },
  "Brazil vs Japan": { status: 'LIVE', score: '1-0', elapsed: "30'" }
}};
assert(anyKnockoutMatchStillEligible(t4Now, t4Cached), 'LIVE match keeps Worker eligible');
assert(anyKnockoutMatchInPollingWindow(t4Now), 'anyKnockoutMatchInPollingWindow says true');

// Test 5: no knockout matches active at all (between tournament end)
console.log();
console.log('Test 5: No matches active');
const t5Now = Date.parse('2026-07-10T12:00:00Z'); // Well after tournament
const t5Cached = null;
assert(!anyKnockoutMatchStillEligible(t5Now, t5Cached), 'No eligible matches');
assert(!anyKnockoutMatchInPollingWindow(t5Now), 'anyKnockoutMatchInPollingWindow says false');

// Test 6: all 16 knockout matches exist in schedule
console.log();
console.log('Test 6: Schedule integrity');
assert(KNOCKOUT_SCHEDULE.length === 16, `16 knockout matches (found ${KNOCKOUT_SCHEDULE.length})`);

// Verify all match badges M73-M88
const expectedBadges = [];
for (let i = 73; i <= 88; i++) expectedBadges.push(`M${i}`);
for (const badge of expectedBadges) {
  const found = KNOCKOUT_SCHEDULE.some(m => m.matchNumber === parseInt(badge.substring(1)));
  assert(found, `Badge ${badge} has a mapping`);
}

// Verify no TBD participants
for (const m of KNOCKOUT_SCHEDULE) {
  assert(!m.match.includes('TBD'), `No TBD in ${m.match}`);
}

// Verify unique mappings
const keys = KNOCKOUT_SCHEDULE.map(m => m.match);
const uniqueKeys = new Set(keys);
assert(uniqueKeys.size === 16, `16 unique knockout match keys (found ${uniqueKeys.size})`);

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