import strainData from '../frontend/functions/_data/strain-data.js';
const strains = strainData.strains;
console.log('Total strains:', strains.length);

const defaultProfile = strains.filter(s => {
  const terps = (s.terpenes || []);
  if (terps.length !== 6) return false;
  const t = terps.map(t => t.name + ':' + t.pct).join(',');
  return t === 'caryophyllene:0.25%,myrcene:0.18%,limonene:0.12%,humulene:0.08%,linalool:0.06%,pinene:0.04%';
});
console.log('Strains with DEFAULT terpene profile:', defaultProfile.length);

const profiles = new Set(strains.map(s => (s.terpenes||[]).map(t=>t.name+':'+t.pct).join(',')));
console.log('Unique terpene profiles:', profiles.size);

const twoEffects = strains.filter(s => (s.effects||[]).length === 2);
console.log('Strains with exactly 2 effects:', twoEffects.length);

const moreEffects = strains.filter(s => (s.effects||[]).length > 3);
console.log('Strains with >3 effects:', moreEffects.length);

const noGenetics = strains.filter(s => !s.genetics || s.genetics === '');
console.log('Strains with no genetics:', noGenetics.length);

console.log('Bindings:', strainData.bindings.length);
console.log('Molecules:', strainData.molecules.length);
console.log('Receptors:', strainData.receptors.length);
console.log('Canonical effects:', strainData.canonicalEffects.length);

// Show distribution of unique profiles
const profileCounts = {};
for (const s of strains) {
  const key = (s.terpenes||[]).map(t=>t.name+':'+t.pct).join(',');
  profileCounts[key] = (profileCounts[key] || 0) + 1;
}
const sorted = Object.entries(profileCounts).sort((a,b) => b[1]-a[1]);
console.log('\nTop 10 most common terpene profiles:');
for (const [profile, count] of sorted.slice(0, 10)) {
  console.log(`  ${count}x: ${profile.slice(0, 80)}...`);
}

// Check effect distribution
const effectCounts = {};
for (const s of strains) {
  for (const e of (s.effects || [])) {
    effectCounts[e.name] = (effectCounts[e.name] || 0) + 1;
  }
}
const sortedEffects = Object.entries(effectCounts).sort((a,b) => b[1]-a[1]);
console.log('\nEffect frequency:');
for (const [name, count] of sortedEffects) {
  console.log(`  ${name}: ${count}`);
}
