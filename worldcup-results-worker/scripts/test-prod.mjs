// Quick production test
const url = 'https://reportingforge.com/worldcup2026schedule/results.json?ts=' + Date.now();
const resp = await fetch(url);
const data = await resp.json();
console.log('lastUpdated:', data.lastUpdated);
console.log('lastUpdatedUtc:', data.lastUpdatedUtc);
console.log('mode:', data.mode);
console.log('slot:', JSON.stringify(data.slot, null, 2));
console.log('matchCount:', Object.keys(data.matches || {}).length);
console.log('warnings:', data.warnings);

// Check if any matches have source:fifa
const matches = data.matches || {};
for (const [key, val] of Object.entries(matches)) {
  if (val.source === 'fifa' && val.status === 'FT') {
    console.log(`FIFA FT: ${key}`);
  }
}
console.log('Browser-only: endpoint is /worldcup2026schedule/results.json');