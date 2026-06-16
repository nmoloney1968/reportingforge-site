#!/usr/bin/env node

/**
 * analyze-kv-cadence.mjs
 *
 * Analyzes the 72 group-stage match schedule and calculates
 * KV write estimates for various polling cadences.
 *
 * Outputs a table showing per-UTC-day activity and recommendations.
 *
 * Updated for group-stage polling window: kickoff +0 through kickoff +150.
 * Old model: kickoff -15 through kickoff +240.
 */

// 72 group-stage schedule (same as index.js)
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

// OLD model constants (for comparison)
const OLD_POLL_WINDOW_START_OFFSET_MIN = -15;
const OLD_POLL_WINDOW_END_OFFSET_MIN = 240;

// NEW model constants (0 through +150)
const POLL_WINDOW_START_OFFSET_MIN = 0;
const POLL_WINDOW_END_OFFSET_MIN = 150;
const POLLING_CUTOFF_UTC = '2026-06-28T08:00:00Z';
const CUTOFF_MS = Date.parse(POLLING_CUTOFF_UTC);
const CADENCES = [1, 2, 3, 4, 5]; // minutes
const WRITES_PER_REFRESH_OPTIONS = [1, 2, 3];

// Build active windows per match
function buildWindows(schedule, startOffset, endOffset) {
  return schedule.map(m => {
    const kickoffMs = Date.parse(m.kickoffUtc);
    return {
      match: m.match,
      startMs: kickoffMs + startOffset * 60 * 1000,
      endMs: Math.min(kickoffMs + endOffset * 60 * 1000, CUTOFF_MS),
      kickoffUtc: m.kickoffUtc
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
    matches: [sorted[0].match]
  }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (current.startMs <= last.endMs) {
      // Overlap - extend
      last.endMs = Math.max(last.endMs, current.endMs);
      last.matchCount++;
      last.matches.push(current.match);
    } else {
      merged.push({
        startMs: current.startMs,
        endMs: current.endMs,
        matchCount: 1,
        matches: [current.match]
      });
    }
  }
  return merged;
}

function dateKey(ms) {
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

function minutesInDay(ms) {
  return Math.floor(ms / 60000);
}

function computeDailyStats(schedule, startOffset, endOffset) {
  const windows = buildWindows(schedule, startOffset, endOffset);
  const merged = mergeWindows(windows);
  const DAY_BOUNDARY_MS = 24 * 60 * 60 * 1000;
  const firstDayMs = new Date('2026-06-11T00:00:00Z').getTime();
  const lastDayMs = new Date('2026-06-28T00:00:00Z').getTime();
  const daySummaries = [];

  for (let dayMs = firstDayMs; dayMs <= lastDayMs; dayMs += DAY_BOUNDARY_MS) {
    const dayEndMs = dayMs + DAY_BOUNDARY_MS;
    const dateStr = dateKey(dayMs);
    let activeMinutes = 0;
    for (const w of merged) {
      const overlapStart = Math.max(w.startMs, dayMs);
      const overlapEnd = Math.min(w.endMs, dayEndMs);
      if (overlapEnd > overlapStart) {
        activeMinutes += (overlapEnd - overlapStart) / 60000;
      }
    }

    const dayEntry = { date: dateStr, activeMinutes, maxWrites: {} };
    for (const cadence of CADENCES) {
      const refreshes = activeMinutes === 0 ? 0 : Math.ceil(activeMinutes / cadence);
      dayEntry[`refreshes_${cadence}m`] = refreshes;
    }
    daySummaries.push(dayEntry);
  }
  return daySummaries;
}

function main() {
  const newWindows = buildWindows(LOCAL_SCHEDULE, POLL_WINDOW_START_OFFSET_MIN, POLL_WINDOW_END_OFFSET_MIN);
  const newMerged = mergeWindows(newWindows);
  const oldWindows = buildWindows(LOCAL_SCHEDULE, OLD_POLL_WINDOW_START_OFFSET_MIN, OLD_POLL_WINDOW_END_OFFSET_MIN);
  const oldMerged = mergeWindows(oldWindows);
  const newDayStats = computeDailyStats(LOCAL_SCHEDULE, POLL_WINDOW_START_OFFSET_MIN, POLL_WINDOW_END_OFFSET_MIN);
  const oldDayStats = computeDailyStats(LOCAL_SCHEDULE, OLD_POLL_WINDOW_START_OFFSET_MIN, OLD_POLL_WINDOW_END_OFFSET_MIN);

  console.log('=== World Cup 2026 KV Write Budget Analysis ===\n');
  console.log(`Total group-stage matches: ${LOCAL_SCHEDULE.length}`);
  console.log(`Polling cutoff: ${POLLING_CUTOFF_UTC}\n`);

  console.log('=== OLD vs NEW Polling Window Comparison ===');
  console.log(`  Old model: kickoff ${OLD_POLL_WINDOW_START_OFFSET_MIN} through +${OLD_POLL_WINDOW_END_OFFSET_MIN} minutes`);
  console.log(`  New model: kickoff ${POLL_WINDOW_START_OFFSET_MIN} through +${POLL_WINDOW_END_OFFSET_MIN} minutes\n`);
  console.log('  Old merged active windows:', oldMerged.length);
  console.log('  New merged active windows:', newMerged.length, '\n');

  // Show each active window for new model
  console.log('=== Active Windows (new model, merged overlaps, grouped by UTC day) ===');
  for (const w of newMerged) {
    const start = new Date(w.startMs).toISOString();
    const end = new Date(w.endMs).toISOString();
    const durationMin = Math.round((w.endMs - w.startMs) / 60000);
    console.log(`  ${start} → ${end} (${durationMin} min, ${w.matchCount} matches)`);
  }
  console.log();

  // Per day analysis
  const DAY_BOUNDARY_MS = 24 * 60 * 60 * 1000;
  const firstDayMs = new Date('2026-06-11T00:00:00Z').getTime();
  const lastDayMs = new Date('2026-06-28T00:00:00Z').getTime();

  console.log('=== Daily Analysis (NEW model) ===');
  console.log('UTC Date       Active min   cadence  refreshes  writes@1  writes@2  writes@3');
  console.log('----------------------------------------------------------------------------');

  for (const d of newDayStats) {
    if (d.activeMinutes === 0) {
      console.log(`${d.date}    0           -        0          0        0        0`);
      continue;
    }
    for (const cadence of CADENCES) {
      const refreshes = d[`refreshes_${cadence}m`];
      const w1 = refreshes * 1;
      const w2 = refreshes * 2;
      const w3 = refreshes * 3;
      console.log(`${d.date}    ${String(Math.round(d.activeMinutes)).padStart(4)}      ${cadence}m    ${String(refreshes).padStart(5)}    ${String(w1).padStart(4)}    ${String(w2).padStart(4)}    ${String(w3).padStart(4)}`);
    }
  }

  console.log();

  // Summary by cadence: worst day
  console.log('=== Worst-Case Day by Cadence (NEW model) ===');
  console.log('Cadence   Max writes@1  writes@2  writes@3  Worst UTC day');
  console.log('--------------------------------------------------------');

  for (const cadence of CADENCES) {
    let worstDay = null;
    let worstMaxWrites = { 1: 0, 2: 0, 3: 0 };
    for (const d of newDayStats) {
      const refreshes = d[`refreshes_${cadence}m`] || 0;
      for (const w of WRITES_PER_REFRESH_OPTIONS) {
        if (refreshes * w > worstMaxWrites[w]) {
          worstMaxWrites[w] = refreshes * w;
          worstDay = d.date;
        }
      }
    }
    console.log(`  ${cadence}m        ${String(worstMaxWrites[1]).padStart(5)}    ${String(worstMaxWrites[2]).padStart(5)}    ${String(worstMaxWrites[3]).padStart(5)}   ${worstDay}`);
  }

  console.log();

  // Recommendations
  console.log('=== Recommendations ===');
  console.log('Budget target: ≤ 900 writes/day\n');
  for (const cadence of CADENCES) {
    let worst = 0;
    let worstDate = '';
    for (const d of newDayStats) {
      const refreshes = d[`refreshes_${cadence}m`] || 0;
      // Assume 2 writes/refresh after optimization (results + status)
      if (refreshes * 2 > worst) {
        worst = refreshes * 2;
        worstDate = d.date;
      }
    }
    const status = worst <= 900 ? 'PASS' : 'FAIL';
    console.log(`  ${cadence}m: max ${worst} writes/day (${worstDate}) - ${status} (target ≤ 900)`);
  }

  console.log();

  // Detailed breakdown for all cadences
  console.log('=== Per-Day Detail (2 writes/refresh, NEW model) ===');
  console.log('UTC Date       1m      2m      3m      4m      5m');
  console.log('-------------------------------------------------');
  for (const d of newDayStats) {
    if (d.activeMinutes === 0) continue;
    const parts = [d.date];
    for (const cadence of CADENCES) {
      const refreshes = d[`refreshes_${cadence}m`] || 0;
      parts.push(String(refreshes * 2).padStart(6));
    }
    console.log(`  ${parts.join('  ')}`);
  }

  // Show all-day active windows (continuous activity)
  console.log('\n=== Busiest UTC Days (3m cadence, NEW model) ===');
  const sortedDays = [...newDayStats].filter(d => d.activeMinutes > 0).sort((a, b) => b.activeMinutes - a.activeMinutes);
  for (const d of sortedDays.slice(0, 10)) {
    console.log(`  ${d.date}: ${Math.round(d.activeMinutes)} min active`);
  }

  // Current cadence: 3 minutes
  console.log('\n=== Current Cadence: 3 minutes (NEW model) ===');
  const worst3m = newDayStats.reduce((max, d) => {
    const r = d[`refreshes_3m`] || 0;
    return Math.max(max, r);
  }, 0);
  console.log(`  Max refreshes/day: ${worst3m}`);
  console.log(`  Max writes/day (1 write/refresh): ${worst3m * 1}`);
  console.log(`  Max writes/day (2 writes/refresh): ${worst3m * 2}`);
  console.log(`  Max writes/day (3 writes/refresh): ${worst3m * 3}`);
  console.log(`  Max writes/day (CURRENT: 2 writes/refresh after KV write optimization): ${worst3m * 2}`);

  // OLD MODEL comparison
  console.log('\n=== OLD Model (for comparison) ===');
  const oldWorst3m = oldDayStats.reduce((max, d) => {
    const r = d[`refreshes_3m`] || 0;
    return Math.max(max, r);
  }, 0);
  console.log(`  Worst-day refreshes at 3m: ${oldWorst3m}`);
  console.log(`  Worst-day writes@2: ${oldWorst3m * 2}\n`);
  console.log('=== ===');
  console.log('Summary Reduction:');
  console.log(`  Old model (-15 to +240):  ${oldWorst3m} refreshes/day worst case`);
  console.log(`  New model (+0 to +150):   ${worst3m} refreshes/day worst case`);
  console.log(`  Reduction: ${Math.round((1 - worst3m / oldWorst3m) * 100)}%`);
}

main();