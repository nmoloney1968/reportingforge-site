#!/usr/bin/env node

/**
 * analyze-kv-cadence.mjs
 *
 * Analyzes the combined 72 group-stage + 16 Round-of-32 match schedule
 * and calculates KV write estimates for one-minute knockout cadence.
 *
 * Outputs a table showing per-UTC-day activity and recommendations.
 */

// 72 group-stage schedule + 16 Round-of-32 schedule
const GROUP_SCHEDULE = [
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

const KNOCKOUT_SCHEDULE = [
  { match: "South Africa vs Canada", round: "Round of 32", kickoffUtc: "2026-06-28T19:00:00Z" },
  { match: "Brazil vs Japan", round: "Round of 32", kickoffUtc: "2026-06-29T17:00:00Z" },
  { match: "Germany vs Paraguay", round: "Round of 32", kickoffUtc: "2026-06-29T20:30:00Z" },
  { match: "Netherlands vs Morocco", round: "Round of 32", kickoffUtc: "2026-06-30T01:00:00Z" },
  { match: "Ivory Coast vs Norway", round: "Round of 32", kickoffUtc: "2026-06-30T17:00:00Z" },
  { match: "France vs Sweden", round: "Round of 32", kickoffUtc: "2026-06-30T21:00:00Z" },
  { match: "Mexico vs Ecuador", round: "Round of 32", kickoffUtc: "2026-07-01T01:00:00Z" },
  { match: "England vs DR Congo", round: "Round of 32", kickoffUtc: "2026-07-01T16:00:00Z" },
  { match: "Belgium vs Senegal", round: "Round of 32", kickoffUtc: "2026-07-01T20:00:00Z" },
  { match: "USA vs Bosnia & Herzegovina", round: "Round of 32", kickoffUtc: "2026-07-02T00:00:00Z" },
  { match: "Spain vs Austria", round: "Round of 32", kickoffUtc: "2026-07-02T19:00:00Z" },
  { match: "Portugal vs Croatia", round: "Round of 32", kickoffUtc: "2026-07-02T23:00:00Z" },
  { match: "Switzerland vs Algeria", round: "Round of 32", kickoffUtc: "2026-07-03T03:00:00Z" },
  { match: "Australia vs Egypt", round: "Round of 32", kickoffUtc: "2026-07-03T18:00:00Z" },
  { match: "Argentina vs Cape Verde", round: "Round of 32", kickoffUtc: "2026-07-03T22:00:00Z" },
  { match: "Colombia vs Ghana", round: "Round of 32", kickoffUtc: "2026-07-04T01:30:00Z" }
];

// Polling windows
const GROUP_POLL_END_MINUTES = 150;
const GROUP_EMERGENCY_POLL_END_MINUTES = 210;
const KNOCKOUT_POLL_END_MINUTES = 240;
const GROUP_CUTOFF_UTC = '2026-06-28T10:00:00Z'; // After last group match + buffer
const WRITES_PER_REFRESH_OPTIONS = [1, 1.3, 2];

// Build active windows per match
function buildWindows(schedule, startOffset, endOffset, isKnockout) {
  const cutoffMs = isKnockout ? Infinity : Date.parse(GROUP_CUTOFF_UTC);
  return schedule.map(m => {
    const kickoffMs = Date.parse(m.kickoffUtc);
    return {
      match: m.match,
      startMs: kickoffMs + startOffset * 60 * 1000,
      endMs: Math.min(kickoffMs + endOffset * 60 * 1000, cutoffMs),
      kickoffUtc: m.kickoffUtc,
      isKnockout
    };
  });
}

// Merge overlapping windows into continuous active periods
function mergeWindows(windows) {
  if (windows.length === 0) return [];
  const sorted = [...windows].sort((a, b) => a.startMs - b.startMs);
  const merged = [{
    startMs: sorted[0].startMs,
    endMs: sorted[0].endMs,
    matchCount: 1,
    matches: [sorted[0].match],
    knockoutCount: sorted[0].isKnockout ? 1 : 0
  }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (current.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, current.endMs);
      last.matchCount++;
      last.matches.push(current.match);
      if (current.isKnockout) last.knockoutCount++;
    } else {
      merged.push({
        startMs: current.startMs,
        endMs: current.endMs,
        matchCount: 1,
        matches: [current.match],
        knockoutCount: current.isKnockout ? 1 : 0
      });
    }
  }
  return merged;
}

function dateKey(ms) {
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

function main() {
  // Build group-stage windows (3-minute cadence: +0 to +150, emergency +210)
  const groupWindows = buildWindows(GROUP_SCHEDULE, 0, GROUP_EMERGENCY_POLL_END_MINUTES, false);

  // Build knockout windows (1-minute cadence: +0 to +240)
  const knockoutWindows = buildWindows(KNOCKOUT_SCHEDULE, 0, KNOCKOUT_POLL_END_MINUTES, true);

  // Combine all windows
  const allWindows = [...groupWindows, ...knockoutWindows];
  const merged = mergeWindows(allWindows);

  // Calculate per-UTC-day stats
  const DAY_BOUNDARY_MS = 24 * 60 * 60 * 1000;
  const firstDayMs = new Date('2026-06-11T00:00:00Z').getTime();
  const lastDayMs = new Date('2026-07-04T00:00:00Z').getTime();
  const daySummaries = [];

  for (let dayMs = firstDayMs; dayMs <= lastDayMs; dayMs += DAY_BOUNDARY_MS) {
    const dayEndMs = dayMs + DAY_BOUNDARY_MS;
    const dateStr = dateKey(dayMs);
    let activeMinutes = 0;
    let maxOverlap = 0;

    // Check each minute
    for (let m = 0; m < 1440; m++) {
      const minuteMs = dayMs + m * 60000;
      const minuteEndMs = minuteMs + 60000;
      let overlapping = 0;
      for (const w of merged) {
        const overlapStart = Math.max(w.startMs, minuteMs);
        const overlapEnd = Math.min(w.endMs, minuteEndMs);
        if (overlapEnd > overlapStart) {
          overlapping++;
          // Count partial minutes as active
          if (overlapEnd - overlapStart > 0) {
            activeMinutes += (overlapEnd - overlapStart) / 60000;
          }
        }
      }
      if (overlapping > maxOverlap) maxOverlap = overlapping;
    }

    const roundedMinutes = Math.round(activeMinutes);
    const refreshes = roundedMinutes; // 1-minute cadence
    const dayEntry = {
      date: dateStr,
      activeMinutes: roundedMinutes,
      maxOverlap,
      refreshes_1m: refreshes,
    };
    for (const w of WRITES_PER_REFRESH_OPTIONS) {
      dayEntry[`writes_${w}`] = Math.round(refreshes * w);
    }
    daySummaries.push(dayEntry);
  }

  console.log('=== World Cup 2026 KV Write Budget Analysis ===');
  console.log('Schedule: 72 group-stage + 16 Round-of-32 matches');
  console.log('Group polling: +0 to +150 min (emergency +210, 3-min cadence)');
  console.log('Knockout polling: +0 to +240 min (1-min cadence)');
  console.log('Active windows merged (simultaneous matches share refresh)\n');

  console.log('=== Merged Active Windows ===');
  for (const w of merged) {
    const start = new Date(w.startMs).toISOString();
    const end = new Date(w.endMs).toISOString();
    const durationMin = Math.round((w.endMs - w.startMs) / 60000);
    console.log(`  ${start} -> ${end} (${durationMin} min, ${w.matchCount} matches)`);
  }
  console.log();

  // Only show days with activity (June 28 onwards for knockout relevance)
  console.log('=== Daily Analysis (1-minute cadence) ===');
  console.log('UTC Date       Active min  Max overlap  Refreshes  writes@1  writes@1.3  writes@2');
  console.log('-------------------------------------------------------------------------------');

  let worstDay = null;
  let worstWrites = { 1: 0, 1.3: 0, 2: 0 };

  for (const d of daySummaries) {
    if (d.activeMinutes === 0) continue;
    const w13 = d['writes_1.3'];
    console.log(`${d.date}    ${String(d.activeMinutes).padStart(5)}     ${String(d.maxOverlap).padStart(4)}       ${String(d.refreshes_1m).padStart(5)}    ${String(d.writes_1).padStart(5)}    ${String(w13).padStart(5)}    ${String(d.writes_2).padStart(5)}`);

    for (const w of WRITES_PER_REFRESH_OPTIONS) {
      if (d[`writes_${w}`] > worstWrites[w]) {
        worstWrites[w] = d[`writes_${w}`];
        worstDay = d.date;
      }
    }
  }

  console.log();
  console.log('=== Worst-Case Day ===');
  console.log(`  Date: ${worstDay}`);
  console.log(`  Max refreshes: ${daySummaries.find(d => d.date === worstDay)?.refreshes_1m}`);
  for (const w of WRITES_PER_REFRESH_OPTIONS) {
    const status = worstWrites[w] <= 900 ? 'PASS' : 'FAIL';
    console.log(`  Max writes/day (${w}x writes/refresh): ${worstWrites[w]} - ${status} (target <= 900)`);
  }

  console.log();
  console.log('=== Expected Actual Writes (1 write/refresh for results, status hourly) ===');
  // Calculate with merged windows: 1 write per refresh to KV for results
  // Status writes are hourly = ~1/day
  const actualWorstWrites = worstWrites[1] + 24; // 1 results + up to 24 status writes
  console.log(`  Results writes: ${worstWrites[1]} (max)`);
  console.log(`  Status writes: up to 24 (hourly)`);
  console.log(`  Total worst-day writes: ~${actualWorstWrites}`);
  console.log(`  Budget status: ${actualWorstWrites <= 900 ? 'PASS (well within 900 limit)' : 'FAIL'}`);

  // ========== Remaining Round-of-32 Budget ==========
  console.log();
  console.log('=== Remaining Round-of-32 Budget ===');
  console.log('Model: 16 knockout fixtures, 1-minute cadence per match, +240 min windows');
  console.log('Assumes worst case: all overlapping windows are active on the same day\n');

  const r32ActiveDays = {};
  for (const m of KNOCKOUT_SCHEDULE) {
    const kickoffMs = Date.parse(m.kickoffUtc);
    const pollEndMs = kickoffMs + KNOCKOUT_POLL_END_MINUTES * 60 * 1000;
    // For each minute in the polling window, attribute to the UTC day
    for (let ms = kickoffMs; ms < pollEndMs; ms += 60000) {
      const day = dateKey(ms);
      if (!r32ActiveDays[day]) r32ActiveDays[day] = { activeMinutes: 0, matchCount: new Set() };
      r32ActiveDays[day].activeMinutes++;
      r32ActiveDays[day].matchCount.add(m.match);
    }
  }

  // Sort days chronologically
  const sortedDays = Object.entries(r32ActiveDays).sort((a, b) => a[0].localeCompare(b[0]));

  console.log('UTC Date       Active min  Match count  Res writes  Status writes  Total  Budget(900)');
  console.log('---------------------------------------------------------------------------------');

  let worstR32Day = null;
  let worstR32Total = 0;

  for (const [day, info] of sortedDays) {
    const resultsWrites = info.activeMinutes; // 1 per minute
    const statusWrites = 24; // up to 1 per hour
    const total = resultsWrites + statusWrites;
    const status = total <= 900 ? 'PASS' : 'FAIL';
    console.log(`${day}    ${String(info.activeMinutes).padStart(5)}    ${String(info.matchCount.size).padStart(4)}         ${String(resultsWrites).padStart(5)}      ${String(statusWrites).padStart(4)}    ${String(total).padStart(5)}  ${status}`);

    if (total > worstR32Total) {
      worstR32Total = total;
      worstR32Day = day;
    }
  }

  const worstResultsWrites = r32ActiveDays[worstR32Day] ? r32ActiveDays[worstR32Day].activeMinutes : 0;
  const worstStatusWrites = 24;
  const worstTotal = worstResultsWrites + worstStatusWrites;
  const worstPass = worstTotal <= 900 ? 'PASS' : 'FAIL';

  console.log();
  console.log('=== Worst Remaining R32 Day ===');
  console.log(`  Date: ${worstR32Day}`);
  console.log(`  Active minutes: ${worstResultsWrites}`);
  console.log(`  Results writes (1/min): ${worstResultsWrites}`);
  console.log(`  Status writes (max hourly): ${worstStatusWrites}`);
  console.log(`  Total conservative writes: ${worstTotal}`);
  console.log(`  Budget status: ${worstPass} (target <= 900)`);

  console.log();
  console.log('=== Inactive Minute Behavior ===');
  console.log('  When no knockout match is in its active polling window:');
  console.log('  - No FIFA upstream call');
  console.log('  - No worldcup26.ir upstream call');
  console.log('  - No KV results write');
  console.log('  - No KV status write');
  console.log('  - No usage counter write');
  console.log('  - Returns clean skipped result');
  console.log('  - Effective writes during inactive periods: 0');
}

main();