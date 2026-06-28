#!/usr/bin/env node

/**
 * check-prod-matches.mjs
 * Fetches the production endpoint and reports match count and sample keys.
 */

async function main() {
  const urls = [
    'https://reportingforge.com/worldcup2026schedule/results.json',
    'https://reportingforge.com/worldcup2026schedule/results.json?ts=' + Date.now()
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        console.log(`HTTP ${res.status} from ${url}`);
        continue;
      }
      const data = await res.json();
      const matchKeys = Object.keys(data.matches || {});
      const total = data.matchCount;
      const groupKeys = matchKeys.filter(k => k.includes(' vs ')).length;
      const nsKeys = matchKeys.filter(k => data.matches[k]?.status === 'NS');
      const ftKeys = matchKeys.filter(k => data.matches[k]?.status === 'FT');

      console.log(`URL: ${url.split('?')[0]}`);
      console.log(`  matchCount: ${total}`);
      console.log(`  total keys: ${matchKeys.length}`);
      console.log(`  FT: ${ftKeys.length}, NS: ${nsKeys.length}`);
      console.log(`  warnings: ${JSON.stringify(data.warnings || [])}`);
      console.log();

      // Check specific expected keys
      const expected = [
        'Australia vs Egypt',
        'France vs Sweden',
        'Spain vs Austria',
        'Switzerland vs Algeria',
        'Colombia vs Ghana',
        'Belgium vs Senegal',
        'Portugal vs Croatia',
        'USA vs Bosnia & Herzegovina'
      ];
      for (const key of expected) {
        const match = data.matches?.[key];
        const status = match ? match.status : 'MISSING';
        console.log(`  ${key}: ${status}`);
      }
      console.log();
    } catch (err) {
      console.log(`Error fetching ${url}: ${err.message}`);
    }
  }
}

main();