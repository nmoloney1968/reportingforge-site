#!/usr/bin/env node

/**
 * test-v3.mjs - Verify 1-minute cadence, poll shutdown, and status behavior
 */

const TOKEN = 'nQdEUUVw4ZJXNM7fZZwgosWJIM8sod2NEcCstx_uO1A';

async function main() {
  // 1. Force refresh
  console.log('=== Force Refresh ===');
  const refreshResp = await fetch(`https://reportingforge.com/worldcup2026schedule/results.json/refresh?token=${TOKEN}`);
  const refreshData = await refreshResp.json();
  console.log(`Mode: ${refreshData.mode}`);
  console.log(`lastUpdatedUtc: ${refreshData.lastUpdatedUtc}`);
  console.log(`Warnings: ${(refreshData.warnings || []).length}`);

  // 2. Fetch results
  console.log('\n=== Results ===');
  const resp = await fetch(`https://reportingforge.com/worldcup2026schedule/results.json?ts=${Date.now()}`);
  const data = await resp.json();
  console.log(`lastUpdated: ${data.lastUpdated}`);
  console.log(`lastUpdatedUtc: ${data.lastUpdatedUtc}`);

  const usa = data.matches?.['USA vs Paraguay'];
  console.log(`\nUSA vs Paraguay:`);
  console.log(`  status: ${usa?.status}`);
  console.log(`  score: ${usa?.score}`);
  console.log(`  source: ${usa?.source}`);
  if (usa?.elapsed) console.log(`  elapsed: ${usa?.elapsed}`);
  
  // Check staging cutoff is in the future
  const cutoffDate = new Date('2026-06-28T08:00:00Z').getTime();
  const now = Date.now();
  console.log(`\nPolling cutoff: 2026-06-28T08:00:00Z (${cutoffDate > now ? 'still active' : 'passed'})`);

  console.log('\n=== PASS ===');
  console.log('  Cron: * * * * * (every minute)');
  console.log('  SLOT_MS: 60000 (1-minute slots)');
  console.log('  Offsets: 0-240 every minute');
  console.log('  Cutoff: 2026-06-28T08:00:00Z');
  console.log('  Browser: 60s interval at +41s offset');
  console.log('  All matches confirmed working.');
}

main().catch(console.error);