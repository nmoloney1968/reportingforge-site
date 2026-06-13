#!/usr/bin/env node

/**
 * test-v2.mjs - Test the deployed v2 Worker with FIFA call limiting and FT fix
 */

const TOKEN = 'nQdEUUVw4ZJXNM7fZZwgosWJIM8sod2NEcCstx_uO1A';

async function main() {
  // 1. Force refresh
  console.log('=== Force Refresh ===');
  const refreshResp = await fetch(`https://reportingforge.com/worldcup2026schedule/results.json/refresh?token=${TOKEN}`);
  const refreshData = await refreshResp.json();
  console.log(`Mode: ${refreshData.mode}`);
  console.log(`Warnings (${(refreshData.warnings || []).length}):`);
  for (const w of (refreshData.warnings || []).slice(0, 5)) {
    console.log(`  ${w.slice(0, 150)}`);
  }
  if ((refreshData.warnings || []).length > 5) {
    console.log(`  ... and ${refreshData.warnings.length - 5} more`);
  }

  // 2. Fetch results
  console.log('\n=== Results ===');
  const resp = await fetch(`https://reportingforge.com/worldcup2026schedule/results.json?ts=${Date.now()}`);
  const data = await resp.json();
  console.log(`Match count: ${data.matchCount}`);

  const testKeys = [
    'Mexico vs South Africa',
    'South Korea vs Czech Republic',
    'Canada vs Bosnia & Herzegovina',
    'USA vs Paraguay',
    'Qatar vs Switzerland'
  ];

  for (const key of testKeys) {
    const m = data.matches?.[key] || {};
    const parts = [`status=${m.status}`, `score=${m.score}`, `source=${m.source}`];
    if (m.elapsed) parts.push(`elapsed=${m.elapsed}`);
    console.log(`  ${key}: ${parts.join(', ')}`);
  }

  console.log('\n=== PASS/FAIL ===');
  const mexico = data.matches?.['Mexico vs South Africa'];
  if (mexico?.status === 'FT' && !mexico.elapsed && mexico.source === 'fifa') {
    console.log('  PASS: Mexico vs South Africa = FT, no elapsed, source=fifa');
  } else {
    console.log(`  FAIL: Mexico = status=${mexico?.status} elapsed=${mexico?.elapsed} source=${mexico?.source}`);
  }

  const canada = data.matches?.['Canada vs Bosnia & Herzegovina'];
  if (canada?.status === 'FT' && !canada.elapsed && canada.source === 'fifa') {
    console.log('  PASS: Canada vs Bosnia = FT, no elapsed, source=fifa');
  } else {
    console.log(`  FAIL: Canada = status=${canada?.status} elapsed=${canada?.elapsed} source=${canada?.source}`);
  }

  const usa = data.matches?.['USA vs Paraguay'];
  if (usa?.source === 'fifa' && (usa?.status === 'LIVE' || usa?.status === 'FT')) {
    console.log(`  PASS: USA vs Paraguay = ${usa.status}, source=fifa`);
  } else {
    console.log(`  INFO: USA = status=${usa?.status} source=${usa?.source}`);
  }

  const qatar = data.matches?.['Qatar vs Switzerland'];
  if (qatar?.source === 'worldcup26.ir' || qatar?.status === 'NS') {
    console.log('  PASS: Qatar vs Switzerland = worldcup26.ir fallback preserved');
  } else {
    console.log(`  INFO: Qatar = source=${qatar?.source} status=${qatar?.status}`);
  }

  // Check no subrequest-limit warnings
  const hasLimitFailure = (refreshData.warnings || []).some(w => /subrequest|Too many/i.test(w));
  if (!hasLimitFailure) {
    console.log('  PASS: No subrequest-limit failures in warnings');
  } else {
    console.log('  FAIL: Subrequest-limit failures detected!');
  }
}

main().catch(console.error);