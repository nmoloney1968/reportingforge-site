#!/usr/bin/env node

/**
 * test-deploy.mjs
 *
 * Tests the deployed Worker by:
 * 1. Force refresh
 * 2. Fetching results for multiple matches
 */

const REFRESH_URL = 'https://reportingforge.com/worldcup2026schedule/results.json/refresh?token=nQdEUUVw4ZJXNM7fZZwgosWJIM8sod2NEcCstx_uO1A';
const RESULTS_URL = 'https://reportingforge.com/worldcup2026schedule/results.json?ts=' + Date.now();

async function main() {
  // 1. Force refresh
  console.log('=== Force Refresh ===');
  try {
    const refreshResp = await fetch(REFRESH_URL);
    const refreshData = await refreshResp.json();
    console.log(`Status: ${refreshResp.status}`);
    console.log(`Skipped: ${refreshData.skipped}`);
    console.log(`Reason: ${refreshData.reason || 'none'}`);
    console.log(`Mode: ${refreshData.mode}`);
    if (refreshData.warnings) {
      console.log(`Warnings (${refreshData.warnings.length}):`);
      for (const w of refreshData.warnings) console.log(`  ${w.slice(0, 200)}`);
    }
  } catch (err) {
    console.log(`Refresh error: ${err.message}`);
  }

  // 2. Fetch results
  console.log('\n=== Results ===');
  try {
    const resp = await fetch(RESULTS_URL);
    const data = await resp.json();
    console.log(`Match count: ${data.matchCount}`);
    console.log(`Source: ${data.source}`);
    console.log(`Warnings: ${(data.warnings || []).length}`);

    // Show a few specific matches
    const testKeys = [
      'USA vs Paraguay',
      'Mexico vs South Africa',
      'Canada vs Bosnia & Herzegovina',
      'Qatar vs Switzerland'
    ];
    for (const key of testKeys) {
      const m = data.matches?.[key];
      if (m) {
        console.log(`\n${key}:`);
        console.log(`  Status: ${m.status}`);
        console.log(`  Score: ${m.score}`);
        console.log(`  Elapsed: ${m.elapsed || 'N/A'}`);
        console.log(`  Source: ${m.source}`);
      } else {
        console.log(`\n${key}: NOT FOUND`);
      }
    }
  } catch (err) {
    console.log(`Results error: ${err.message}`);
  }
}

main().catch(console.error);