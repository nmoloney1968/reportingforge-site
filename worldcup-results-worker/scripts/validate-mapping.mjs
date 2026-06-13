#!/usr/bin/env node

/**
 * validate-mapping.mjs
 *
 * Validates the FIFA match ID mapping by:
 * 1. Loading fifa-match-ids.json
 * 2. Testing the FIFA live endpoint for USA vs Paraguay
 * 3. Testing the FIFA live endpoint for a few other matches
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

async function testLiveEndpoint(fifaId, label) {
  try {
    const resp = await fetch(`https://api.fifa.com/api/v3/live/football/${fifaId}?language=en`, {
      headers: { 'accept': 'application/json', 'user-agent': 'WorldCup2026-Validation/1.0' }
    });
    if (!resp.ok) {
      console.log(`  [${label}] FAILED: HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    const homeName = data.HomeTeam?.TeamName?.[0]?.Description || '';
    const awayName = data.AwayTeam?.TeamName?.[0]?.Description || '';
    console.log(`  [${label}] OK: ${homeName} vs ${awayName} | Date: ${data.Date} | Period: ${data.Period} | Score: ${data.HomeTeam?.Score || '-'}-${data.AwayTeam?.Score || '-'}`);
    return data;
  } catch (err) {
    console.log(`  [${label}] ERROR: ${err.message}`);
    return null;
  }
}

async function main() {
  const mappingPath = join(REPO_ROOT, 'src', 'fifa-match-ids.json');
  const mapping = JSON.parse(readFileSync(mappingPath, 'utf-8'));
  const keys = Object.keys(mapping);

  console.log('=== Validation Report ===\n');
  console.log(`Mapping file: ${mappingPath}`);
  console.log(`Total entries: ${keys.length}`);
  console.log('\n--- Sample entries ---');
  const sampleKeys = keys.slice(0, 3);
  for (const key of sampleKeys) {
    const entry = mapping[key];
    console.log(`  ${key}: fifaId=${entry.fifaId}, kickoff=${entry.kickoffUtc}, group=${entry.group}`);
  }
  console.log('  ...');
  const lastKeys = keys.slice(-3);
  for (const key of lastKeys) {
    const entry = mapping[key];
    console.log(`  ${key}: fifaId=${entry.fifaId}, kickoff=${entry.kickoffUtc}, group=${entry.group}`);
  }

  // Check USA vs Paraguay specifically
  const up = mapping['USA vs Paraguay'];
  if (up) {
    console.log('\n--- USA vs Paraguay entry ---');
    console.log(JSON.stringify(up, null, 2));

    if (up.fifaId === '400021458' && up.kickoffUtc === '2026-06-13T01:00:00Z') {
      console.log('  PASS: fifaId and kickoffUtc match expected values.');
    } else {
      console.log('  WARNING: Values differ from expected!');
    }
  } else {
    console.log('\n  ERROR: USA vs Paraguay not found in mapping!');
  }

  // Test FIFA live endpoints
  console.log('\n--- Testing FIFA live endpoints ---');
  const testMatches = [
    { fifaId: '400021458', label: 'USA vs Paraguay' },
    { fifaId: '400021443', label: 'Mexico vs South Africa' },
    { fifaId: '400021449', label: 'Canada vs Bosnia' },
    { fifaId: '400021476', label: 'Iran vs New Zealand' },
  ];

  for (const tm of testMatches) {
    await testLiveEndpoint(tm.fifaId, tm.label);
  }

  // Check if any entries use non-200K IDs (knockout range)
  const allIds = Object.values(mapping).map(e => parseInt(e.fifaId, 10));
  const minId = Math.min(...allIds);
  const maxId = Math.max(...allIds);
  console.log(`\n--- ID range ---`);
  console.log(`  Min IdMatch: ${minId}`);
  console.log(`  Max IdMatch: ${maxId}`);
  // Check for gaps: group stage IDs should be sequential
  const sortedIds = [...allIds].sort((a, b) => a - b);
  console.log(`  First 10 IDs: ${sortedIds.slice(0, 10).join(', ')}`);
  console.log(`  Last 10 IDs:  ${sortedIds.slice(-10).join(', ')}`);

  console.log('\n=== Validation complete ===');
}

main().catch(console.error);