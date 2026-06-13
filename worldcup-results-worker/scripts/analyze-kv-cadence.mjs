#!/usr/bin/env node

/**
 * analyze-kv-cadence.mjs
 *
 * Analyzes the 72 group-stage match schedule and calculates
 * KV write estimates for various polling cadences.
 *
 * Outputs a table showing per-UTC-day activity and recommendations.
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

const POLL_WINDOW_START_OFFSET_MIN = -15;  // 15 min before kickoff
const POLL_WINDOW_END_OFFSET_MIN = 240;    // 240 min after kickoff
const POLLING_CUTOFF_UTC = '2026-06-28T08:00:00Z';
const CUTOFF_MS = Date.parse(POLLING_CUTOFF_UTC);
const CADENCES = [1, 2, 3, 4, 5]; // minutes
const WRITES_PER_REFRESH_OPTIONS = [1, 2, 3];

// Build active windows per match
function buildWindows(schedule) {
  return schedule.map(m => {
    const kickoffMs = Date.parse(m.kickoffUtc);
    return {
      match: m.match,
      startMs: kickoffMs + POLL_WINDOW_START_OFFSET_MIN * 60 * 1000,
      endMs: Math.min(kickoffMs + POLL_WINDOW_END_OFFSET_MIN * 60 * 1000, CUTOFF_MS),
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

function main() {
  const windows = buildWindows(LOCAL_SCHEDULE);
  const merged = mergeWindows(windows);

  console.log('=== World Cup 2026 KV Write Budget Analysis ===\n');
  console.log(`Total group-stage matches: ${LOCAL_SCHEDULE.length}`);
  console.log(`Polling window per match: ${POLL_WINDOW_START_OFFSET_MIN} to +${POLL_WINDOW_END_OFFSET_MIN} minutes`);
  console.log(`Polling cutoff: ${POLLING_CUTOFF_UTC}`);
  console.log(`Merged active windows: ${merged.length}\n`);

  // Show each active window
  console.log('=== Active Windows (merged overlaps, grouped by UTC day) ===');
  for (const w of merged) {
    const start = new Date(w.startMs).toISOString();
    const end = new Date(w.endMs).toISOString();
    const durationMin = Math.round((w.endMs - w.startMs) / 60000);
    console.log(`  ${start} → ${end} (${durationMin} min, ${w.matchCount} matches)`);
  }
  console.log();

  // Per day analysis
  const DAY_BOUNDARY_MS = 24 * 60 * 60 * 1000;

  // Find the first UTC day of activity
  const firstDayMs = new Date('2026-06-11T00:00:00Z').getTime();
  const lastDayMs = new Date('2026-06-28T00:00:00Z').getTime();

  console.log('=== Daily Analysis ===');
  console.log('UTC Date       Active min   cadence  refreshes  writes@1  writes@2  writes@3');
  console.log('----------------------------------------------------------------------------');

  const daySummaries = [];

  for (let dayMs = firstDayMs; dayMs <= lastDayMs; dayMs += DAY_BOUNDARY_MS) {
    const dayEndMs = dayMs + DAY_BOUNDARY_MS;
    const dateStr = dateKey(dayMs);

    // Calculate active minutes: sum of (overlapping) windows for this day
    let activeMinutes = 0;
    for (const w of merged) {
      const overlapStart = Math.max(w.startMs, dayMs);
      const overlapEnd = Math.min(w.endMs, dayEndMs);
      if (overlapEnd > overlapStart) {
        activeMinutes += (overlapEnd - overlapStart) / 60000;
      }
    }

    if (activeMinutes === 0) {
      console.log(`${dateStr}    0           -        0          0        0        0`);
      daySummaries.push({ date: dateStr, activeMinutes: 0, maxWrites: {} });
      continue;
    }

    const dayEntry = { date: dateStr, activeMinutes, maxWrites: {} };
    for (const cadence of CADENCES) {
      const refreshes = Math.ceil(activeMinutes / cadence);
      dayEntry[`refreshes_${cadence}m`] = refreshes;
      dayEntry.maxWrites[cadence] = {};
      for (const w of WRITES_PER_REFRESH_OPTIONS) {
        const writes = refreshes * w;
        dayEntry.maxWrites[cadence][w] = writes;
      }
    }
    daySummaries.push(dayEntry);

    // Output row for 5m cadence (current)
    for (const cadence of CADENCES) {
      const refreshes = dayEntry[`refreshes_${cadence}m`];
      const w1 = refreshes * 1;
      const w2 = refreshes * 2;
      const w3 = refreshes * 3;
      console.log(`${dateStr}    ${String(activeMinutes).padStart(4)}      ${cadence}m    ${String(refreshes).padStart(5)}    ${String(w1).padStart(4)}    ${String(w2).padStart(4)}    ${String(w3).padStart(4)}`);
    }
  }

  console.log();

  // Summary by cadence: worst day
  console.log('=== Worst-Case Day by Cadence ===');
  console.log('Cadence   Max writes@1  writes@2  writes@3  Worst UTC day');
  console.log('--------------------------------------------------------');

  for (const cadence of CADENCES) {
    let worstDay = null;
    let worstMaxWrites = { 1: 0, 2: 0, 3: 0 };
    for (const d of daySummaries) {
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
    for (const d of daySummaries) {
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

  // Detailed breakdown for recommended cadences
  console.log('=== Per-Day Detail (2 writes/refresh) ===');
  console.log('UTC Date       1m      2m      3m      4m      5m');
  console.log('-------------------------------------------------');
  for (const d of daySummaries) {
    if (d.activeMinutes === 0) continue;
    const parts = [d.date];
    for (const cadence of CADENCES) {
      const refreshes = d[`refreshes_${cadence}m`] || 0;
      parts.push(String(refreshes * 2).padStart(6));
    }
    console.log(`  ${parts.join('  ')}`);
  }

  // Show all-day active windows (continuous activity)
  console.log('\n=== Busiest UTC Days (5m cadence) ===');
  const sortedDays = [...daySummaries].filter(d => d.activeMinutes > 0).sort((a, b) => b.activeMinutes - a.activeMinutes);
  for (const d of sortedDays.slice(0, 10)) {
    console.log(`  ${d.date}: ${Math.round(d.activeMinutes)} min active`);
  }

  // If 5 minutes is safe, confirm
  console.log('\n=== Current Cadence: 5 minutes ===');
  const worst5m = daySummaries.reduce((max, d) => {
    const r = d[`refreshes_5m`] || 0;
    return Math.max(max, r);
  }, 0);
  console.log(`  Max refreshes/day: ${worst5m}`);
  console.log(`  Max writes/day (1 write/refresh after opt): ${worst5m * 1}`);
  console.log(`  Max writes/day (2 writes/refresh after opt): ${worst5m * 2}`);
  console.log(`  Max writes/day (3 writes/refresh after opt): ${worst5m * 3}`);
  console.log(`  Max writes/day (CURRENT: 4 writes/refresh):  ${worst5m * 4}`);
}

main();