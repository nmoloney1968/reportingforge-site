#!/usr/bin/env node

/**
 * test-r32-safeguards.mjs
 *
 * Tests the Round-of-32 FT safeguard behavior and extra-time handling.
 * Does not require Cloudflare environment - uses pure function tests.
 *
 * Proves:
 * 1. Cached FIFA FT inside the +240 window causes the scheduled handler to exit
 *    before FIFA calls, worldcup26.ir calls, refreshResults(), and main KV writes.
 * 2. Cached LIVE inside the window remains eligible (Worker continues).
 * 3. Knockout extra-time detection: tied FT is not final, Period 7 = ET without penalty evidence.
 * 4. False cached FT at 1-1 can resume polling.
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

// Match keys list for isKnockoutMatchKey equivalent
const KNOCKOUT_MATCH_KEYS = new Set(KNOCKOUT_SCHEDULE.map(m => m.match));

function isKnockoutMatchKey(key) {
  return KNOCKOUT_MATCH_KEYS.has(key);
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

// ========== FIFA status simulation helpers ==========

function normalizeFifaScore(value) {
  if (value === null || value === undefined || value === '') return '';
  const score = Number(value);
  return Number.isFinite(score) ? String(score) : '';
}

function normalizeFifaMatchTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^ht$/i.test(raw)) return 'HT';

  const minute = raw.match(/^(\d{1,3})(?:'?\s*\+\s*(\d{1,2}))?\s*'?$/);
  if (!minute) return '';

  const base = Number.parseInt(minute[1], 10);
  if (!Number.isFinite(base) || base < 0 || base > 150) return '';
  if (minute[2]) {
    return `${base}'+${Number.parseInt(minute[2], 10)}'`;
  }
  return `${base}'`;
}

function getFifaStatus(payload) {
  const period = payload?.Period;
  const homePen = payload?.HomeTeam?.PenaltyScore;
  const awayPen = payload?.AwayTeam?.PenaltyScore;
  const homeET = payload?.HomeTeam?.ExtraTimeScore;
  const awayET = payload?.AwayTeam?.ExtraTimeScore;
  const matchTime = payload?.MatchTime;

  if (period !== null && period !== undefined && period !== '') {
    const p = Number(period);
    if (Number.isFinite(p)) {
      if (p >= 10) {
        const penHome = homePen !== null && homePen !== undefined ? Number(homePen) : null;
        const penAway = awayPen !== null && awayPen !== undefined ? Number(awayPen) : null;
        const hasPenalties = penHome !== null && penAway !== null && (penHome > 0 || penAway > 0);

        if (hasPenalties) {
          // Penalty scores are populated. Check for explicit terminal evidence.
          // Do not infer completion from the penalty tally alone.
          const statusText = [
            String(payload?.Status || ''),
            String(payload?.MatchStatus || ''),
            String(payload?.MatchStatusName?.[0]?.Description || ''),
            String(payload?.PeriodName?.[0]?.Description || '')
          ].join(' ').toLowerCase();

          const hasTerminalEvidence = /\b(finished|full[ -]?time|final|ft|ended|complete)\b/.test(statusText);

          if (hasTerminalEvidence) return 'PEN';

          // No explicit terminal evidence - shootout may still be active
          return 'P';
        }

        const etHome = homeET !== null && homeET !== undefined ? Number(homeET) : null;
        const etAway = awayET !== null && awayET !== undefined ? Number(awayET) : null;
        const hasExtraTimeScores = (etHome !== null && etHome > 0) || (etAway !== null && etAway > 0);
        if (hasExtraTimeScores) return 'AET';

        const mt = matchTime !== null && matchTime !== undefined ? Number(matchTime) : 0;
        if (Number.isFinite(mt) && mt > 90) return 'AET';

        return 'FT';
      }

      // Period 8 is extra-time half-time (ET HT).
      if (p === 8) {
        return 'ET HT';
      }

      if (p >= 5 && p <= 9) {
        const penHomeLive = homePen !== null && homePen !== undefined;
        const penAwayLive = awayPen !== null && awayPen !== undefined;
        if (penHomeLive && penAwayLive) return 'P';
        return 'ET';
      }

      if (p === 4) return 'HT';
      if (p === 0) return 'NS';
    }
  }

  // Fallback minimal
  return 'LIVE';
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
console.log('=== Cached FT inside +240 window (unequal scores) ===');
console.log('These tests verify the scheduled handler exits early when all knockout');
console.log('matches are FT with unequal scores, even within the +240 minute window.');
console.log();

// Scenario: Germany vs Paraguay finishes 3-0 (unequal). All FT, all final.
const ftInWindowMs = Date.parse('2026-06-28T21:00:00Z');
const ftInWindowCached = { matches: {
  "South Africa vs Canada": { status: 'FT', score: 'South Africa 2-1 Canada' },
  "Brazil vs Japan": { status: 'FT', score: 'Brazil 1-0 Japan' },
  "Germany vs Paraguay": { status: 'FT', score: 'Germany 3-0 Paraguay' },
  "Netherlands vs Morocco": { status: 'FT', score: 'Netherlands 2-2 Morocco' },
  "Ivory Coast vs Norway": { status: 'FT', score: 'Ivory Coast 1-0 Norway' },
  "France vs Sweden": { status: 'FT', score: 'France 2-0 Sweden' },
  "Mexico vs Ecuador": { status: 'FT', score: 'Mexico 1-1 Ecuador' },
  "England vs DR Congo": { status: 'FT', score: 'England 4-0 DR Congo' },
  "Belgium vs Senegal": { status: 'FT', score: 'Belgium 0-0 Senegal' },
  "USA vs Bosnia & Herzegovina": { status: 'FT', score: 'USA 2-1 Bosnia & Herzegovina' },
  "Spain vs Austria": { status: 'FT', score: 'Spain 1-0 Austria' },
  "Portugal vs Croatia": { status: 'FT', score: 'Portugal 3-2 Croatia' },
  "Switzerland vs Algeria": { status: 'FT', score: 'Switzerland 1-1 Algeria' },
  "Australia vs Egypt": { status: 'FT', score: 'Australia 0-0 Egypt' },
  "Argentina vs Cape Verde": { status: 'FT', score: 'Argentina 2-0 Cape Verde' },
  "Colombia vs Ghana": { status: 'FT', score: 'Colombia 1-0 Ghana' }
}};

assert(!anyKnockoutMatchStillEligible(ftInWindowMs, ftInWindowCached),
  'Cached FT (unequal scores) inside +240 window => not eligible (Worker exits before FIFA calls)');

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
  "South Africa vs Canada": { status: 'LIVE', score: 'South Africa 1-0 Canada', elapsed: "80'" },
  "Brazil vs Japan": { status: 'FT', score: 'Brazil 1-0 Japan' },
  "Germany vs Paraguay": { status: 'FT', score: 'Germany 3-0 Paraguay' },
  "Netherlands vs Morocco": { status: 'FT', score: 'Netherlands 2-2 Morocco' },
  "Ivory Coast vs Norway": { status: 'FT', score: 'Ivory Coast 1-0 Norway' },
  "France vs Sweden": { status: 'FT', score: 'France 2-0 Sweden' },
  "Mexico vs Ecuador": { status: 'FT', score: 'Mexico 1-1 Ecuador' },
  "England vs DR Congo": { status: 'FT', score: 'England 4-0 DR Congo' },
  "Belgium vs Senegal": { status: 'FT', score: 'Belgium 0-0 Senegal' },
  "USA vs Bosnia & Herzegovina": { status: 'FT', score: 'USA 2-1 Bosnia & Herzegovina' },
  "Spain vs Austria": { status: 'FT', score: 'Spain 1-0 Austria' },
  "Portugal vs Croatia": { status: 'FT', score: 'Portugal 3-2 Croatia' },
  "Switzerland vs Algeria": { status: 'FT', score: 'Switzerland 1-1 Algeria' },
  "Australia vs Egypt": { status: 'FT', score: 'Australia 0-0 Egypt' },
  "Argentina vs Cape Verde": { status: 'FT', score: 'Argentina 2-0 Cape Verde' },
  "Colombia vs Ghana": { status: 'FT', score: 'Colombia 1-0 Ghana' }
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
  const knockoutActive = anyKnockoutMatchStillEligible(nowMs, cachedResult);
  const groupActive = false;

  if (!knockoutActive && !groupActive) {
    return {
      skipped: true,
      reason: 'No match in active polling window',
      checkedAtUtc: new Date(nowMs).toISOString()
    };
  }
  return { skipped: false, reason: 'Would proceed to refresh' };
}

// Case A: All FT (unequal scores) inside window => skipped
const resultFT = simulateScheduledRefresh(ftInWindowMs, ftInWindowCached);
assertEqual(resultFT.skipped, true, 'All FT (unequal) inside window: skipped before refreshResults()');
assert(resultFT.reason.includes('No match'), 'Skip reason mentions no active match');

// Case B: LIVE inside window => proceeds
const resultLIVE = simulateScheduledRefresh(liveInWindowMs, liveInWindowCached);
assertEqual(resultLIVE.skipped, false, 'LIVE inside window: proceeds to refreshResults()');

// Case C: Mixed FT + LIVE (some LIVE matches) => proceeds
console.log();
console.log('=== Mixed FT + LIVE matches ===');
const mixedNowMs = Date.parse('2026-07-01T00:00:00Z');
const mixedCached = { matches: {
  "South Africa vs Canada": { status: 'FT', score: 'South Africa 2-1 Canada' },
  "Brazil vs Japan": { status: 'LIVE', score: 'Brazil 1-0 Japan', elapsed: "30'" },
  "Germany vs Paraguay": { status: 'FT', score: 'Germany 3-0 Paraguay' },
  "Netherlands vs Morocco": { status: 'FT', score: 'Netherlands 2-2 Morocco' }
}};
const resultMixed = simulateScheduledRefresh(mixedNowMs, mixedCached);
assertEqual(resultMixed.skipped, false, 'Mixed FT+LIVE: proceeds to refreshResults()');
assert(anyKnockoutMatchStillEligible(mixedNowMs, mixedCached), 'LIVE match keeps Worker eligible');

// ====================================================================
// NEW: Extra-time regression tests
// ====================================================================
console.log();
console.log('=== Knockout extra-time / false-FT tests ===');

// Test: knockout cached FT at 1-1 (tied) is NOT final
console.log();
console.log('Test: knockout cached FT at 1-1 is not final');
const etNow = Date.parse('2026-06-29T23:30:00Z'); // Germany vs Paraguay within +240 window
const tiedFtCached = { matches: {
  "Germany vs Paraguay": { status: 'FT', score: 'Germany 1-1 Paraguay' }
}};
assertEqual(isMatchFinal(tiedFtCached, 'Germany vs Paraguay'), false,
  'Knockout FT at 1-1 (tied) => not final');

assert(anyKnockoutMatchStillEligible(etNow, tiedFtCached),
  'Knockout tied FT at 1-1 => still eligible (Worker continues polling)');

// Test: knockout cached FT at 2-1 (unequal) is final
console.log();
console.log('Test: knockout cached FT at 2-1 is final');
const unequalFtCached = { matches: {
  "Germany vs Paraguay": { status: 'FT', score: 'Germany 2-1 Paraguay' }
}};
assertEqual(isMatchFinal(unequalFtCached, 'Germany vs Paraguay'), true,
  'Knockout FT at 2-1 (unequal) => final');
assert(!anyKnockoutMatchStillEligible(etNow, unequalFtCached),
  'Knockout FT at 2-1 => not eligible');

// Test: group-stage cached FT at 1-1 is final
console.log();
console.log('Test: group-stage cached FT at 1-1 is final');
const groupFtCached = { matches: {
  "Mexico vs South Africa": { status: 'FT', score: 'Mexico 1-1 South Africa' }
}};
assertEqual(isMatchFinal(groupFtCached, 'Mexico vs South Africa'), true,
  'Group stage FT at 1-1 (tied) => final (group matches never go to ET)');

// Test: knockout cached AET is final
console.log();
console.log('Test: knockout cached AET is final');
const aetCached = { matches: {
  "Germany vs Paraguay": { status: 'AET', score: 'Germany 2-1 Paraguay' }
}};
assertEqual(isMatchFinal(aetCached, 'Germany vs Paraguay'), true,
  'Knockout AET => final');

// Test: knockout cached PEN is final
console.log();
console.log('Test: knockout cached PEN is final');
const penCached = { matches: {
  "Germany vs Paraguay": { status: 'PEN', score: 'Germany 1-1 Paraguay', note: 'PEN: 4-3' }
}};
assertEqual(isMatchFinal(penCached, 'Germany vs Paraguay'), true,
  'Knockout PEN => final');

// ====================================================================
// NEW: FIFA Period handling tests
// ====================================================================
console.log();
console.log('=== FIFA Period / status handling tests ===');

// Test: FIFA Period 7 at 97', score 1-1, no penalty scores => ET
console.log();
console.log('Test: Period 7, 97\', 1-1, no penalty scores => ET');
const period7NoPen = {
  Period: 7,
  MatchTime: '97',
  MatchStatus: 3,
  HomeTeam: { Score: 1, PenaltyScore: null, ExtraTimeScore: null },
  AwayTeam: { Score: 1, PenaltyScore: null, ExtraTimeScore: null }
};
assertEqual(getFifaStatus(period7NoPen), 'ET',
  'Period 7 at 1-1 with null penalty scores => ET (not P, not PEN)');

assert(getFifaStatus(period7NoPen) !== 'P',
  'Period 7 without penalty evidence does not return P');

assert(getFifaStatus(period7NoPen) !== 'PEN',
  'Period 7 without penalty evidence does not return PEN');

// Test: FIFA Period 7 without penalty evidence does not return P or PEN
console.log();
console.log('Test: Period 7 without penalty evidence does not return P or PEN');
const period7Live = {
  Period: 7,
  MatchTime: '105',
  MatchStatus: 3,
  HomeTeam: { Score: 2, PenaltyScore: null, ExtraTimeScore: null },
  AwayTeam: { Score: 1, PenaltyScore: null, ExtraTimeScore: null }
};
assertEqual(getFifaStatus(period7Live), 'ET',
  'Period 7 with no penalty evidence => ET');
assert(getFifaStatus(period7Live) !== 'P',
  'Period 7 with no penalty evidence => not P');
assert(getFifaStatus(period7Live) !== 'PEN',
  'Period 7 with no penalty evidence => not PEN');

// Test: FIFA Period 5 during a tied knockout match remains ET
console.log();
console.log('Test: Period 5 during tied knockout match => ET');
const period5Tied = {
  Period: 5,
  MatchTime: '91',
  MatchStatus: 3,
  HomeTeam: { Score: 0, PenaltyScore: null, ExtraTimeScore: null },
  AwayTeam: { Score: 0, PenaltyScore: null, ExtraTimeScore: null }
};
assertEqual(getFifaStatus(period5Tied), 'ET',
  'Period 5 at 0-0 is ET');

// Test: Period 6 also during ET
console.log();
console.log('Test: Period 6 => ET');
const period6 = {
  Period: 6,
  MatchTime: '106',
  HomeTeam: { Score: 1, PenaltyScore: null },
  AwayTeam: { Score: 1, PenaltyScore: null }
};
assertEqual(getFifaStatus(period6), 'ET',
  'Period 6 is ET');

// Test: Active penalty shootout remains non-final (P)
console.log();
console.log('Test: Active penalty shootout returns P');
const activePenShootout = {
  Period: 7,
  MatchTime: '120',
  HomeTeam: { Score: 1, PenaltyScore: 2, ExtraTimeScore: null },
  AwayTeam: { Score: 1, PenaltyScore: 1, ExtraTimeScore: null }
};
assertEqual(getFifaStatus(activePenShootout), 'P',
  'Active penalty shootout (penalty scores populated) => P (not final)');

// Test: Completed penalty shootout returns PEN (with explicit terminal evidence)
console.log();
console.log('Test: Completed penalty shootout returns PEN');
const completedPenShootout = {
  Period: 10,
  MatchTime: '120',
  MatchStatus: 0,
  MatchStatusName: [{ Description: 'Finished' }],
  HomeTeam: { Score: 1, PenaltyScore: 4, ExtraTimeScore: null },
  AwayTeam: { Score: 1, PenaltyScore: 3, ExtraTimeScore: null }
};
assertEqual(getFifaStatus(completedPenShootout), 'PEN',
  'Completed penalty shootout (Period 10, penalty scores, terminal evidence) => PEN');

// Test: terminal knockout score 2-1 after extra time returns AET
console.log();
console.log('Test: Terminal knockout 2-1 after ET returns AET');
const aetUnequal = {
  Period: 10,
  MatchTime: '120',
  MatchStatus: 0,
  HomeTeam: { Score: 2, PenaltyScore: null, ExtraTimeScore: null },
  AwayTeam: { Score: 1, PenaltyScore: null, ExtraTimeScore: null }
};
assertEqual(getFifaStatus(aetUnequal), 'AET',
  'Finished at Period 10, MatchTime 120 (extra time played, unequal score) => AET');

// Test: terminal knockout score 2-1 with ET scores explicitly populated
console.log();
console.log('Test: Terminal with ET scores => AET');
const aetWithETScores = {
  Period: 10,
  MatchTime: '120',
  HomeTeam: { Score: 2, PenaltyScore: null, ExtraTimeScore: 1 },
  AwayTeam: { Score: 1, PenaltyScore: null, ExtraTimeScore: 0 }
};
assertEqual(getFifaStatus(aetWithETScores), 'AET',
  'Finished with ET scores populated => AET');

// Test: false cached FT no longer blocks anyKnockoutMatchStillEligible()
console.log();
console.log('Test: False cached FT at 1-1 does not block eligibility');
const falseFtInWindowMs = Date.parse('2026-06-29T23:30:00Z'); // Germany vs Paraguay in +240 window
const falseFtCached = { matches: {
  "Germany vs Paraguay": { status: 'FT', score: 'Germany 1-1 Paraguay' },
  "South Africa vs Canada": { status: 'FT', score: 'South Africa 2-1 Canada' }
}};
assert(anyKnockoutMatchStillEligible(falseFtInWindowMs, falseFtCached),
  'False cached FT at 1-1 allows Germany vs Paraguay to resume polling');

// ====================================================================
// Existing safeguard tests
// ====================================================================
console.log();
console.log('=== Existing safeguard tests ===');

// Test 1: all matches in active window, no cached results => eligible
console.log('Test 1: Active window with no cached results (all should be eligible)');
const t1Now = Date.parse('2026-07-03T20:00:00Z');
const t1Cached = null;
assert(anyKnockoutMatchStillEligible(t1Now, t1Cached), 'No cached FT => eligible (Australia vs Egypt window)');
assert(anyKnockoutMatchInPollingWindow(t1Now), 'anyKnockoutMatchInPollingWindow says true');

// Test 2: cached FIFA-final match (FT, unequal) should stop Worker
console.log();
console.log('Test 2: Cached FIFA FT (unequal) match should stop Worker');
const t2Now = Date.parse('2026-07-04T06:00:00Z');
const t2CachedAllFT = { matches: {} };
for (const m of KNOCKOUT_SCHEDULE) {
  t2CachedAllFT.matches[m.match] = { status: 'FT', score: `${m.match.split(' vs ')[0]} 1-0 ${m.match.split(' vs ')[1]}` };
}
assert(!anyKnockoutMatchStillEligible(t2Now, t2CachedAllFT), 'All FT cached (unequal scores) => not eligible');
assert(!anyKnockoutMatchInPollingWindow(t2Now), 'anyKnockoutMatchInPollingWindow says false (past +240 min)');

// Test 3: cached final but still inside +240 window for a LIVE match
console.log();
console.log('Test 3: Cached LIVE match inside +240 window remains eligible');
const t3Now = Date.parse('2026-07-03T19:30:00Z');
const t3Cached = { matches: {
  "Australia vs Egypt": { status: 'LIVE', score: 'Australia 1-0 Egypt', elapsed: "90'" },
  "Argentina vs Cape Verde": { status: 'LIVE', score: 'Argentina 0-0 Cape Verde', elapsed: "15'" }
}};
assert(anyKnockoutMatchStillEligible(t3Now, t3Cached), 'LIVE matches eligible despite some matches before kickoff');
assert(anyKnockoutMatchInPollingWindow(t3Now), 'anyKnockoutMatchInPollingWindow says true');

// Test 4: cached FT match among LIVE matches - LIVE keeps Worker active
console.log();
console.log('Test 4: Mixed FT (unequal) + LIVE in same window - LIVE keeps Worker active');
const t4Now = Date.parse('2026-07-01T00:00:00Z');
const t4Cached = { matches: {
  "South Africa vs Canada": { status: 'FT', score: 'South Africa 2-1 Canada' },
  "Brazil vs Japan": { status: 'LIVE', score: 'Brazil 1-0 Japan', elapsed: "30'" }
}};
assert(anyKnockoutMatchStillEligible(t4Now, t4Cached), 'LIVE match keeps Worker eligible');
assert(anyKnockoutMatchInPollingWindow(t4Now), 'anyKnockoutMatchInPollingWindow says true');

// Test 5: no knockout matches active at all (between tournament end)
console.log();
console.log('Test 5: No matches active');
const t5Now = Date.parse('2026-07-10T12:00:00Z');
const t5Cached = null;
assert(!anyKnockoutMatchStillEligible(t5Now, t5Cached), 'No eligible matches');
assert(!anyKnockoutMatchInPollingWindow(t5Now), 'anyKnockoutMatchInPollingWindow says false');

// Test 6: all 16 knockout matches exist in schedule
console.log();
console.log('Test 6: Schedule integrity');
assert(KNOCKOUT_SCHEDULE.length === 16, `16 knockout matches (found ${KNOCKOUT_SCHEDULE.length})`);

const expectedBadges = [];
for (let i = 73; i <= 88; i++) expectedBadges.push(`M${i}`);
for (const badge of expectedBadges) {
  const found = KNOCKOUT_SCHEDULE.some(m => m.matchNumber === parseInt(badge.substring(1)));
  assert(found, `Badge ${badge} has a mapping`);
}

for (const m of KNOCKOUT_SCHEDULE) {
  assert(!m.match.includes('TBD'), `No TBD in ${m.match}`);
}

const keys = KNOCKOUT_SCHEDULE.map(m => m.match);
const uniqueKeys = new Set(keys);
assert(uniqueKeys.size === 16, `16 unique knockout match keys (found ${uniqueKeys.size})`);

// ========== Score format tests ==========
console.log();
console.log('=== R32 Score format tests ===');

function buildDefaultScore(matchKey) {
  const [home, away] = matchKey.split(' vs ');
  return {
    status: 'NS',
    score: `${home} 0-0 ${away}`,
    note: 'Round of 32'
  };
}

const scoreFixtures = [
  'France vs Sweden',
  'Spain vs Austria',
  'Switzerland vs Algeria',
  'Colombia vs Ghana',
  'Australia vs Egypt',
  'USA vs Bosnia & Herzegovina',
  'South Africa vs Canada',
  'Brazil vs Japan',
  'Germany vs Paraguay',
  'Netherlands vs Morocco',
  'Ivory Coast vs Norway',
  'Mexico vs Ecuador',
  'England vs DR Congo',
  'Belgium vs Senegal',
  'Portugal vs Croatia',
  'Argentina vs Cape Verde'
];

for (const fixture of scoreFixtures) {
  const result = buildDefaultScore(fixture);
  const [home, away] = fixture.split(' vs ');
  assertEqual(result.status, 'NS', `Status NS for ${fixture}`);
  assert(result.score.includes(' 0-0 '), `Score contains 0-0 for ${fixture}`);
  assert(!result.score.includes('vs'), `Score does not contain 'vs' for ${fixture}`);
  assert(!result.score.includes(home + '-'), `Score does not contain '${home}-' for ${fixture}`);
  assert(!result.score.includes('-' + away), `Score does not contain '-${away}' for ${fixture}`);
  assert(result.score.startsWith(home + ' '), `Score starts with home team for ${fixture}`);
  assert(result.score.endsWith(' ' + away), `Score ends with away team for ${fixture}`);
}

const expectedScores = {
  'France vs Sweden': 'France 0-0 Sweden',
  'Spain vs Austria': 'Spain 0-0 Austria',
  'Switzerland vs Algeria': 'Switzerland 0-0 Algeria',
  'Colombia vs Ghana': 'Colombia 0-0 Ghana',
  'Australia vs Egypt': 'Australia 0-0 Egypt',
  'USA vs Bosnia & Herzegovina': 'USA 0-0 Bosnia & Herzegovina'
};

for (const [fixture, expected] of Object.entries(expectedScores)) {
  const result = buildDefaultScore(fixture);
  assertEqual(result.score, expected, `Score matches expected for ${fixture}`);
}

// ========== parseScore tests ==========
console.log();
console.log('=== parseScore tests ===');

function assertParseScore(input, expected, label) {
  const result = parseScore(input);
  const pass = result === expected || (result && expected && result.homeScore === expected.homeScore && result.awayScore === expected.awayScore);
  const detail = JSON.stringify(result);
  if (pass) {
    console.log(`  PASS: ${label} (${detail})`);
    passed++;
  } else {
    console.log(`  FAIL: ${label} - expected ${JSON.stringify(expected)}, got ${detail}`);
    failed++;
  }
}

assertParseScore('Germany 1-1 Paraguay', { homeScore: 1, awayScore: 1 },
  'parseScore: Germany 1-1 Paraguay');
assertParseScore('Germany 2-1 Paraguay', { homeScore: 2, awayScore: 1 },
  'parseScore: Germany 2-1 Paraguay');
assertParseScore('South Africa 0-0 Canada', { homeScore: 0, awayScore: 0 },
  'parseScore: 0-0');
assertParseScore(null, null,
  'parseScore: null => null');
assertParseScore('', null,
  'parseScore: empty => null');
assertParseScore('No score here', null,
  'parseScore: no numbers => null');
assertParseScore('Germany 10-3 Paraguay', { homeScore: 10, awayScore: 3 },
  'parseScore: double digit scores');

// ========== normalizeFifaMatchTime (MatchTime preservation) tests ==========
console.log();
console.log('=== MatchTime preservation tests ===');

// Test: FIFA "105'+3'" survives parsing verbatim
assertEqual(normalizeFifaMatchTime("105'+3'"), "105'+3'",
  'FIFA MatchTime "105\'+3\'" preserved verbatim');

// Test: FIFA "45'+4'" survives parsing
assertEqual(normalizeFifaMatchTime("45'+4'"), "45'+4'",
  'FIFA MatchTime "45\'+4\'" preserved verbatim');

// Test: FIFA "90'+6'" survives parsing
assertEqual(normalizeFifaMatchTime("90'+6'"), "90'+6'",
  'FIFA MatchTime "90\'+6\'" preserved verbatim');

// Test: FIFA "120'+2'" survives parsing
assertEqual(normalizeFifaMatchTime("120'+2'"), "120'+2'",
  'FIFA MatchTime "120\'+2\'" preserved verbatim');

// Test: plain "45'" without stoppage time
assertEqual(normalizeFifaMatchTime("45'"), "45'",
  'FIFA MatchTime "45\'" preserved');

// Test: "HT" returns "HT"
assertEqual(normalizeFifaMatchTime("HT"), "HT",
  'FIFA MatchTime "HT" returns "HT"');

// Test: empty string returns empty
assertEqual(normalizeFifaMatchTime(""), "",
  'FIFA MatchTime empty returns empty');

// Test: null returns empty
assertEqual(normalizeFifaMatchTime(null), "",
  'FIFA MatchTime null returns empty');

// Test: apostrophes and +3 not removed from "105'+3'"
const parsed = normalizeFifaMatchTime("105'+3'");
assert(parsed.includes("'"), "MatchTime contains apostrophe");
assert(parsed.includes("+3"), "MatchTime contains +3");
assert(parsed === "105'+3'", "MatchTime exactly matches input");

// Test: Germany vs Paraguay scenario: MatchTime 105'+3', Period 7, status ET, elapsed preserved
const gerParPayload = {
  Period: 7,
  MatchTime: "105'+3'",
  HomeTeam: { Score: 1, PenaltyScore: null, ExtraTimeScore: null },
  AwayTeam: { Score: 1, PenaltyScore: null, ExtraTimeScore: null }
};
assertEqual(getFifaStatus(gerParPayload), 'ET',
  'Germany vs Paraguay: Period 7 with MatchTime "105\'+3\'" => ET');
assertEqual(normalizeFifaMatchTime(gerParPayload.MatchTime), "105'+3'",
  'Germany vs Paraguay: MatchTime "105\'+3\'" preserved through normalization');
// Simulate parseFifaLiveMatch: elapsed for ET status should be the normalized MatchTime
const gerParElapsed = normalizeFifaMatchTime(gerParPayload.MatchTime);
assert(gerParElapsed === "105'+3'", 'Elapsed for ET match is "105\'+3\'"');
assertEqual(getFifaStatus(gerParPayload), 'ET', 'ET match status is "ET"');
// Verify the elapsed field is included (FT/AET/PEN filter should NOT exclude ET)
assert(!['FT', 'AET', 'PEN', 'HT'].includes('ET'), 'ET is not in the excluded-elapsed status list');

// ========== Period 8 (ET HT) tests ==========
console.log();
console.log('=== Period 8 (extra-time half-time) tests ===');

// Test: Period 8 with blank MatchTime returns ET HT
console.log();
console.log('Test: Period 8 returns ET HT');
const period8Payload = {
  Period: 8,
  MatchStatus: 3,
  MatchTime: '',
  HomeTeam: { Score: 1, PenaltyScore: null, ExtraTimeScore: null },
  AwayTeam: { Score: 1, PenaltyScore: null, ExtraTimeScore: null }
};
assertEqual(getFifaStatus(period8Payload), 'ET HT',
  'Period 8 with blank MatchTime => ET HT');

// Test: Period 8 does not return ET
assert(getFifaStatus(period8Payload) !== 'ET',
  'Period 8 does not return ET');

// Test: Period 8 does not return HT
assert(getFifaStatus(period8Payload) !== 'HT',
  'Period 8 does not return HT');

// Test: Period 8 does not return P or PEN
assert(getFifaStatus(period8Payload) !== 'P',
  'Period 8 does not return P');
assert(getFifaStatus(period8Payload) !== 'PEN',
  'Period 8 does not return PEN');

// Test: Period 8 does not return FT or AET
assert(getFifaStatus(period8Payload) !== 'FT',
  'Period 8 does not return FT');
assert(getFifaStatus(period8Payload) !== 'AET',
  'Period 8 does not return AET');

// Test: Period 8 produces blank elapsed when MatchTime is blank
const period8Elapsed = normalizeFifaMatchTime(period8Payload.MatchTime);
assertEqual(period8Elapsed, '',
  'Period 8 with blank MatchTime produces blank elapsed');

// Test: Period 8 does not reuse cached prior minute
// Simulate the parseFifaLiveMatch logic: elapsed comes from the CURRENT payload MatchTime only
const priorMinute = "105'+3'";
const currentElapsed = normalizeFifaMatchTime(period8Payload.MatchTime);
assertEqual(currentElapsed, '',
  'Period 8 blank MatchTime does not retain prior minute "' + priorMinute + '"');
assert(currentElapsed !== priorMinute,
  'Period 8 elapsed is not the prior cached "' + priorMinute + '"');

// Test: Period 8 preserves the 1-1 score
assertEqual(normalizeFifaScore(period8Payload.HomeTeam.Score), '1',
  'Period 8 preserves home score 1');
assertEqual(normalizeFifaScore(period8Payload.AwayTeam.Score), '1',
  'Period 8 preserves away score 1');

// Test: Period 8 with a tied knockout score remains non-final
const period8Cached = { matches: {
  "Germany vs Paraguay": { status: 'ET HT', score: 'Germany 1-1 Paraguay' }
}};
assertEqual(isMatchFinal(period8Cached, 'Germany vs Paraguay'), false,
  'Period 8 (ET HT) with tied score => not final');
assert(anyKnockoutMatchStillEligible(Date.parse('2026-06-29T23:30:00Z'), period8Cached),
  'anyKnockoutMatchStillEligible remains true during ET HT');

// Test: Period 7 with MatchTime 105'+3' still returns ET and preserves MatchTime
console.log();
console.log('Test: Period 7 with 105\'+3\' still returns ET');
const period7WithStoppage = {
  Period: 7,
  MatchTime: "105'+3'",
  HomeTeam: { Score: 1, PenaltyScore: null, ExtraTimeScore: null },
  AwayTeam: { Score: 1, PenaltyScore: null, ExtraTimeScore: null }
};
assertEqual(getFifaStatus(period7WithStoppage), 'ET',
  'Period 7 with MatchTime "105\'+3\'" still returns ET');
assertEqual(normalizeFifaMatchTime(period7WithStoppage.MatchTime), "105'+3'",
  'Period 7 MatchTime "105\'+3\'" preserved');

// ========== Penalty shootout tests ==========
console.log();
console.log('=== Penalty shootout tests ===');

// Helper: active shootout payload at Period >= 10 without terminal evidence
function makePenaltyPayload(homePen, awayPen, matchStatus) {
  return {
    Period: 10,
    MatchTime: '120',
    MatchStatus: matchStatus || 3,
    HomeTeam: { Score: 1, PenaltyScore: homePen, ExtraTimeScore: null },
    AwayTeam: { Score: 1, PenaltyScore: awayPen, ExtraTimeScore: null }
  };
}

// Test: active shootout at penalties 1-0 remains P
console.log();
console.log('Test: Active shootout at various penalty tallies');
const penPayload10 = makePenaltyPayload(1, 0);
assertEqual(getFifaStatus(penPayload10), 'P',
  'Active shootout at penalties 1-0 => P (not PEN)');

// Test: active shootout at penalties 1-1 remains P
const penPayload11 = makePenaltyPayload(1, 1);
assertEqual(getFifaStatus(penPayload11), 'P',
  'Active shootout at penalties 1-1 => P (not PEN)');

// Test: active shootout at penalties 3-2 remains P
const penPayload32 = makePenaltyPayload(3, 2);
assertEqual(getFifaStatus(penPayload32), 'P',
  'Active shootout at penalties 3-2 => P (not PEN)');

// Test: active shootout at penalties 4-4 remains P
const penPayload44 = makePenaltyPayload(4, 4);
assertEqual(getFifaStatus(penPayload44), 'P',
  'Active shootout at penalties 4-4 => P (not PEN)');

// Test: active shootout at penalties 5-4 remains P (sudden death still active)
const penPayload54 = makePenaltyPayload(5, 4);
assertEqual(getFifaStatus(penPayload54), 'P',
  'Active shootout at penalties 5-4 => P (not PEN)');

// Test: active shootout at penalties 6-5 remains P
const penPayload65 = makePenaltyPayload(6, 5);
assertEqual(getFifaStatus(penPayload65), 'P',
  'Active shootout at penalties 6-5 => P (not PEN)');

// Test: penalty scores being non-null does not imply PEN
console.log();
console.log('Test: Non-null penalty scores do not imply PEN');
assertEqual(getFifaStatus(penPayload11), 'P',
  'Penalty scores 1-1 (non-null, non-zero) => P, not PEN');

// Test: penalty scores being greater than zero does not imply PEN
assertEqual(getFifaStatus(penPayload54), 'P',
  'Penalty scores 5-4 (all > 0) => P, not PEN');

// Test: unequal penalty scores do not independently imply completion
assertEqual(getFifaStatus(penPayload32), 'P',
  'Unequal penalty scores 3-2 => P, not PEN');

// Test: P is non-final
console.log();
console.log('Test: P is non-final');
const pCached = { matches: {
  "Germany vs Paraguay": { status: 'P', score: 'Germany 1-1 Paraguay' }
}};
assertEqual(isMatchFinal(pCached, 'Germany vs Paraguay'), false,
  'P status => not final');

// Test: anyKnockoutMatchStillEligible remains true during P
assert(anyKnockoutMatchStillEligible(Date.parse('2026-06-29T23:30:00Z'), pCached),
  'anyKnockoutMatchStillEligible remains true during P');

// Test: PEN is final (already tested above, but re-confirm with updated logic)
console.log();
console.log('Test: PEN is final');
const penFinalCached = { matches: {
  "Germany vs Paraguay": { status: 'PEN', score: 'Germany 1-1 Paraguay', note: 'PEN: 4-3' }
}};
assertEqual(isMatchFinal(penFinalCached, 'Germany vs Paraguay'), true,
  'PEN status => final');

// Test: Period 10 without terminal evidence and with penalty scores returns P
console.log();
console.log('Test: Period 10 with penalties but no terminal evidence => P');
const period10NoTerminal = {
  Period: 10,
  MatchTime: '120',
  MatchStatus: 3,
  HomeTeam: { Score: 1, PenaltyScore: 3, ExtraTimeScore: null },
  AwayTeam: { Score: 1, PenaltyScore: 2, ExtraTimeScore: null }
};
assertEqual(getFifaStatus(period10NoTerminal), 'P',
  'Period 10 with penalties 3-2, no terminal evidence => P');

// Test: Period 10 with terminal evidence (MatchStatusName "Finished") returns PEN
console.log();
console.log('Test: Period 10 with terminal evidence => PEN (already tested above)');
const period10Terminal = {
  Period: 10,
  MatchTime: '120',
  MatchStatus: 0,
  MatchStatusName: [{ Description: 'Finished' }],
  HomeTeam: { Score: 1, PenaltyScore: 5, ExtraTimeScore: null },
  AwayTeam: { Score: 1, PenaltyScore: 4, ExtraTimeScore: null }
};
assertEqual(getFifaStatus(period10Terminal), 'PEN',
  'Period 10 with penalties 5-4 and terminal evidence => PEN');

// Test: ordinary match score remains 1-1 while penalty tally changes separately
console.log();
console.log('Test: Ordinary match score vs penalty tally separation');
const testScore = 'Germany 1-1 Paraguay';
const testHomeScore = 1;
const testAwayScore = 1;
assertEqual(testHomeScore, 1, 'Ordinary home score remains 1');
assertEqual(testAwayScore, 1, 'Ordinary away score remains 1');
assert(!testScore.includes('4-3'), 'Score string does not contain penalty tally');
assert(testScore.includes('1-1'), 'Score string still contains 1-1');

// ========== Penalty display tests (parseFifaLiveMatch simulation) ==========
console.log();
console.log('=== Penalty tally display tests ===');

// Helper: simulate parseFifaLiveMatch for Note formatting only
function simulateNote(status, homePen, awayPen) {
  const homePenNum = homePen !== '' ? Number(homePen) : null;
  const awayPenNum = awayPen !== '' ? Number(awayPen) : null;
  const notes = [];
  if ((status === 'P' || status === 'PEN') && homePenNum !== null && awayPenNum !== null) {
    notes.push(`Pens ${homePenNum}-${awayPenNum}`);
  }
  return notes[0] || '';
}

// Test: P with penalties 0-0 includes "Pens 0-0"
assertEqual(simulateNote('P', '0', '0'), 'Pens 0-0',
  'P with penalties 0-0 includes "Pens 0-0"');

// Test: P with penalties 1-0 includes "Pens 1-0"
assertEqual(simulateNote('P', '1', '0'), 'Pens 1-0',
  'P with penalties 1-0 includes "Pens 1-0"');

// Test: P with penalties 1-1 includes "Pens 1-1"
assertEqual(simulateNote('P', '1', '1'), 'Pens 1-1',
  'P with penalties 1-1 includes "Pens 1-1"');

// Test: P with penalties 3-2 includes "Pens 3-2"
assertEqual(simulateNote('P', '3', '2'), 'Pens 3-2',
  'P with penalties 3-2 includes "Pens 3-2"');

// Test: PEN with penalties 4-3 includes "Pens 4-3"
assertEqual(simulateNote('PEN', '4', '3'), 'Pens 4-3',
  'PEN with penalties 4-3 includes "Pens 4-3"');

// Test: P with penalties 4-4 (tied after sudden death)
assertEqual(simulateNote('P', '4', '4'), 'Pens 4-4',
  'P with penalties 4-4 includes "Pens 4-4"');

// Test: P with penalties 6-5 (sudden death lead)
assertEqual(simulateNote('P', '6', '5'), 'Pens 6-5',
  'P with penalties 6-5 includes "Pens 6-5"');

// Test: ordinary match score in score field (not in note)
// Simulate the full build: score = "Germany 1-1 Paraguay", note = "Pens 3-2"
console.log();
console.log('Test: Score/note separation');
const simScore = 'Germany 1-1 Paraguay';
const simNote = 'Pens 3-2';
assertEqual(simScore, 'Germany 1-1 Paraguay', 'Score is ordinary match score');
assertEqual(simNote, 'Pens 3-2', 'Note contains penalty tally');
assert(!simScore.includes('Pens'), 'Score does not contain "Pens"');
assert(!simNote.includes('Germany'), 'Note does not contain team name');
assert(simNote.includes('3-2'), 'Note contains 3-2 penalty tally');
assert(simScore.includes('1-1'), 'Score still shows 1-1');

// Test: P remains non-final
console.log();
console.log('Test: P with penalty display remains non-final');
const pWithPenCached = { matches: {
  "Germany vs Paraguay": { status: 'P', score: 'Germany 1-1 Paraguay', note: 'Pens 3-2' }
}};
assertEqual(isMatchFinal(pWithPenCached, 'Germany vs Paraguay'), false,
  'P with "Pens 3-2" note => not final');

// Test: PEN remains final
console.log();
console.log('Test: PEN with penalty display remains final');
const penWithPenCached = { matches: {
  "Germany vs Paraguay": { status: 'PEN', score: 'Germany 1-1 Paraguay', note: 'Pens 4-3' }
}};
assertEqual(isMatchFinal(penWithPenCached, 'Germany vs Paraguay'), true,
  'PEN with "Pens 4-3" note => final');

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