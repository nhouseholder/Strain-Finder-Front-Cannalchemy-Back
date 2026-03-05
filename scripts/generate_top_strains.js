#!/usr/bin/env node
/**
 * Generate "Top Featured Strains For…" curated lists using the same
 * tri-pillar scoring engine as the quiz: 35 % Science · 20 % Community · 45 % Commonness.
 * Outputs top 100 per category; the frontend shows 10 weekly-rotating picks from ranks 50-100.
 *
 * Reads  → frontend/src/data/strains.json
 * Writes → frontend/src/data/top-strains-for.json
 *
 * Run:  node scripts/generate_top_strains.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/* ═══════════════════════════════════════════════════════════════
   CATEGORY DEFINITIONS — pharmacologically grounded
   ═══════════════════════════════════════════════════════════════ */
const CATEGORIES = [
  {
    id: 'pain-relief',
    label: 'Pain Relief',
    emoji: '🩹',
    description: 'Strains targeting CB1, CB2, and TRPV1 pain receptors with anti-inflammatory terpene profiles.',
    science: 'Caryophyllene (CB2 agonist), myrcene (GABA-A potentiator), and THC (CB1/mu-opioid) work synergistically to modulate pain signaling. CBD adds allosteric CB1 modulation. (Russo 2011, Ferber et al. 2020)',
    canonicalEffects: ['pain', 'inflammation', 'body-high', 'relaxed', 'calm'],
    avoidEffects: [],
    idealTerpenes: { caryophyllene: 0.35, myrcene: 0.35, linalool: 0.15, humulene: 0.15 },
    subtypeBoost: { indica: 1.15, hybrid: 1.0, sativa: 0.85 },
  },
  {
    id: 'sleep',
    label: 'Sleep & Insomnia',
    emoji: '🌙',
    description: 'Sedating strains rich in myrcene and CBN, targeting GABA-A and adenosine pathways.',
    science: 'Myrcene potentiates GABA-A receptors and enhances blood-brain barrier permeability. Linalool adds independent GABAergic sedation. CBN is the strongest sleep-specific cannabinoid. (Surendran et al. 2021)',
    canonicalEffects: ['sleepy', 'insomnia', 'relaxed', 'calm'],
    avoidEffects: ['energetic', 'focused'],
    idealTerpenes: { myrcene: 0.50, linalool: 0.25, caryophyllene: 0.15 },
    subtypeBoost: { indica: 1.25, hybrid: 0.9, sativa: 0.5 },
  },
  {
    id: 'anxiety-safe',
    label: 'Anxiety-Safe',
    emoji: '🫧',
    description: 'Low-anxiety strains with linalool and CBD — gentle on 5-HT1A serotonin receptors.',
    science: 'Linalool directly activates 5-HT1A serotonin receptors and potentiates GABA-A. CBD is a potent 5-HT1A agonist (Ki≈16nM). Low THC avoids biphasic anxiogenesis. (Blessing et al. 2015, Linck et al. 2010)',
    canonicalEffects: ['calm', 'anxiety', 'stress', 'relaxed'],
    avoidEffects: ['anxious', 'paranoid'],
    idealTerpenes: { linalool: 0.25, myrcene: 0.30, caryophyllene: 0.20, limonene: 0.15 },
    subtypeBoost: { indica: 1.1, hybrid: 1.0, sativa: 0.8 },
    thcPenalty: true, // penalize strains with very high THC
  },
  {
    id: 'giggles',
    label: 'Laughter & Giggles',
    emoji: '😂',
    description: 'Dopamine-boosting strains with limonene and terpinolene for euphoric, giggly highs.',
    science: 'Limonene and THC stimulate dopamine D2 receptor release, producing euphoria and spontaneous laughter. Terpinolene adds an uplifting, cerebral dimension. (Komiya et al. 2006)',
    canonicalEffects: ['giggly', 'happy', 'euphoric', 'uplifted'],
    avoidEffects: [],
    idealTerpenes: { limonene: 0.40, terpinolene: 0.30, pinene: 0.15 },
    subtypeBoost: { indica: 0.7, hybrid: 1.0, sativa: 1.2 },
  },
  {
    id: 'creativity',
    label: 'Creative Flow',
    emoji: '🎨',
    description: 'Strains activating dopamine and serotonin pathways for divergent thinking.',
    science: 'Pinene inhibits acetylcholinesterase (preserving acetylcholine for working memory). Limonene boosts dopamine. Moderate THC increases divergent thinking via frontal lobe disinhibition. (Schafer et al. 2012)',
    canonicalEffects: ['creative', 'head-high', 'focused', 'uplifted', 'euphoric'],
    avoidEffects: ['sleepy', 'couch-lock'],
    idealTerpenes: { limonene: 0.35, pinene: 0.25, terpinolene: 0.20, ocimene: 0.10 },
    subtypeBoost: { indica: 0.6, hybrid: 1.0, sativa: 1.3 },
  },
  {
    id: 'energy-focus',
    label: 'Energy & Focus',
    emoji: '⚡',
    description: 'Stimulating strains rich in pinene and limonene for alertness, motivation, and sustained focus via norepinephrine, TRPV1, and AChE pathways.',
    science: 'Pinene inhibits acetylcholinesterase, preserving acetylcholine for sustained attention and working memory. Limonene modulates norepinephrine release for motivation. THCV provides short-acting stimulation without sedative tail. Combined D1 receptor activation supports cognitive performance. (Russo 2011, Perry et al. 2000)',
    canonicalEffects: ['energetic', 'focused', 'motivated', 'uplifted', 'creative'],
    avoidEffects: ['sleepy', 'couch-lock', 'spacey', 'disoriented'],
    idealTerpenes: { pinene: 0.30, limonene: 0.35, terpinolene: 0.20, caryophyllene: 0.10 },
    subtypeBoost: { indica: 0.5, hybrid: 0.9, sativa: 1.3 },
  },
  {
    id: 'appetite',
    label: 'Appetite Stimulation',
    emoji: '🍽️',
    description: 'Strains activating CB1 and ghrelin receptors to boost appetite.',
    science: 'THC directly activates hypothalamic CB1 receptors, increasing ghrelin release and enhancing food palatability. Myrcene adds comfort. Higher THC produces stronger appetite stimulation. (Kirkham et al. 2002)',
    canonicalEffects: ['hungry', 'appetite-loss', 'relaxed', 'happy'],
    avoidEffects: [],
    idealTerpenes: { myrcene: 0.35, limonene: 0.20, caryophyllene: 0.20 },
    subtypeBoost: { indica: 1.1, hybrid: 1.0, sativa: 0.9 },
  },
  {
    id: 'relaxation',
    label: 'Deep Relaxation',
    emoji: '🧘',
    description: 'Myrcene-rich strains for CB1 and GABA-A mediated full-body relaxation.',
    science: 'Myrcene potentiates GABAergic transmission and increases blood-brain barrier permeability for faster cannabinoid onset. Caryophyllene activates CB2 for peripheral relaxation without cognitive impairment. (Russo 2011)',
    canonicalEffects: ['relaxed', 'calm', 'body-high'],
    avoidEffects: [],
    idealTerpenes: { myrcene: 0.45, linalool: 0.20, caryophyllene: 0.20 },
    subtypeBoost: { indica: 1.2, hybrid: 1.0, sativa: 0.7 },
  },
  {
    id: 'social',
    label: 'Social & Conversation',
    emoji: '💬',
    description: 'Strains boosting dopamine and GABA for talkative, social highs.',
    science: 'Limonene elevates mood via serotonin receptor modulation. Moderate THC reduces social inhibition through amygdala suppression. Terpinolene adds gentle euphoria without sedation. (de Almeida et al. 2012)',
    canonicalEffects: ['talkative', 'giggly', 'uplifted', 'happy', 'euphoric'],
    avoidEffects: ['anxious', 'paranoid', 'sleepy'],
    idealTerpenes: { limonene: 0.35, terpinolene: 0.25, pinene: 0.15 },
    subtypeBoost: { indica: 0.6, hybrid: 1.0, sativa: 1.2 },
  },
  {
    id: 'euphoria',
    label: 'Euphoria & Mood Lift',
    emoji: '✨',
    description: 'THC and limonene-rich strains targeting CB1 and dopamine D2 for mood elevation.',
    science: 'THC activates mesolimbic dopamine release via CB1 receptors in the ventral tegmental area. Limonene provides independent serotonergic mood elevation. Higher THC generally produces stronger euphoria. (Covey et al. 2015)',
    canonicalEffects: ['euphoric', 'happy', 'uplifted', 'giggly'],
    avoidEffects: [],
    idealTerpenes: { limonene: 0.40, terpinolene: 0.20, pinene: 0.15 },
    subtypeBoost: { indica: 0.8, hybrid: 1.0, sativa: 1.15 },
  },
];

/* ═══════════════════════════════════════════════════════════════
   PHARMACOLOGICAL SCORING FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Pillar 1 — SCIENCE (35 %)
 *
 * Sub-scores:
 *  A. Terpene profile alignment (how close to the ideal terpene blend)
 *  B. Subtype affinity (indica/sativa/hybrid match)
 *  C. Avoidance chemical check (penalize for anxiety risk etc.)
 */
function calcScienceScore(strain, category) {
  // --- A. Terpene profile alignment (0-100) ---
  const terpMap = {};
  for (const t of (strain.terpenes || [])) {
    terpMap[t.name.toLowerCase()] = parseFloat(String(t.pct)) || 0;
  }

  let terpScore = 0;
  let terpMaxWeight = 0;
  for (const [mol, idealPct] of Object.entries(category.idealTerpenes)) {
    const actual = terpMap[mol] || 0;
    const weight = idealPct; // higher ideal = more important
    terpMaxWeight += weight;
    if (actual >= idealPct) {
      terpScore += weight * 1.0;
    } else if (actual > 0) {
      terpScore += weight * (actual / idealPct);
    }
    // else: 0 contribution
  }
  const terpNorm = terpMaxWeight > 0 ? (terpScore / terpMaxWeight) * 100 : 50;

  // --- B. Subtype affinity ---
  const strainType = (strain.type || 'hybrid').toLowerCase();
  const subtypeMultiplier = category.subtypeBoost?.[strainType] || 1.0;

  // --- C. Anxiety-safe THC penalty ---
  let thcPenalty = 0;
  if (category.thcPenalty) {
    const thcVal = (strain.cannabinoids || []).find(c => c.name.toLowerCase() === 'thc')?.value || 0;
    const cbdVal = (strain.cannabinoids || []).find(c => c.name.toLowerCase() === 'cbd')?.value || 0;
    // Penalize high THC + low CBD for anxiety-safe category
    if (thcVal > 22 && cbdVal < 2) thcPenalty = 25;
    else if (thcVal > 18 && cbdVal < 1) thcPenalty = 15;
    else if (thcVal > 25) thcPenalty = 10;
  }

  // --- D. Avoidance effects chemical check ---
  let avoidPenalty = 0;
  if (category.avoidEffects.length > 0) {
    const effectMap = {};
    let maxReports = 1;
    for (const e of (strain.effects || [])) {
      const name = e.name?.toLowerCase();
      if (name) {
        effectMap[name] = e.reports || 0;
        if (e.reports > maxReports) maxReports = e.reports;
      }
    }
    for (const avoidName of category.avoidEffects) {
      const reports = effectMap[avoidName];
      if (reports !== undefined) {
        const severity = 0.6 + 0.4 * Math.min(reports / maxReports, 1.0);
        avoidPenalty += severity * 15; // penalty per avoided effect
      }
    }
  }

  return Math.max(0, Math.min(100, terpNorm * subtypeMultiplier - thcPenalty - avoidPenalty));
}

/**
 * Pillar 2 — COMMUNITY (30 %)
 * How strongly real users report the desired effects.
 */
function calcCommunityScore(strain, category) {
  const effects = strain.effects || [];
  const effectMap = {};
  let maxReports = 1;
  for (const e of effects) {
    const name = e.name?.toLowerCase();
    if (name) {
      effectMap[name] = e.reports || 0;
      if (e.reports > maxReports) maxReports = e.reports;
    }
  }

  let totalWeight = 0;
  let matchWeight = 0;
  for (let i = 0; i < category.canonicalEffects.length; i++) {
    const priority = Math.max(1.0 - i * 0.15, 0.3);
    totalWeight += priority;
    const reports = effectMap[category.canonicalEffects[i]];
    if (reports !== undefined) {
      const reportStrength = Math.min(reports / maxReports, 1.0);
      matchWeight += priority * (0.5 + 0.5 * reportStrength);
    }
  }

  // Penalize strains that are strongly reported for effects to avoid
  let avoidDeduct = 0;
  if (category.avoidEffects.length > 0) {
    for (const avoidName of category.avoidEffects) {
      const reports = effectMap[avoidName];
      if (reports !== undefined) {
        avoidDeduct += Math.min(reports / maxReports, 1.0) * 10;
      }
    }
  }

  const raw = totalWeight > 0 ? (matchWeight / totalWeight) * 100 : 50;
  return Math.max(0, Math.min(100, raw - avoidDeduct));
}

/**
 * Pillar 3 — COMMONNESS (30 %)
 * How well-known / dispensary-available the strain is.
 * Same formula as recommend.js.
 */
function calcCommonnessScore(strain) {
  const totalReports = (strain.effects || []).reduce((sum, e) => sum + (e.reports || 0), 0);
  const sentiment = strain.sentimentScore || 8.5;
  const reportNorm = Math.min(1, Math.max(0, (totalReports - 260) / 300));
  const sentNorm = Math.min(1, Math.max(0, (sentiment - 8.4) / 1.1));
  return (reportNorm * 0.7 + sentNorm * 0.3) * 100;
}

/* ═══════════════════════════════════════════════════════════════
   ELIGIBILITY FILTER — same as recommend.js
   ═══════════════════════════════════════════════════════════════ */
function isEligible(strain) {
  if (strain.dataCompleteness === 'partial') return false;
  if (!strain.effects || strain.effects.length === 0) return false;
  const name = strain.name || '';
  if (name.length > 45) return false;
  if (/\b(auto|autoflower|seed|seeds|feminized|regular|f[1-5]|bx\d)\b/i.test(name)) return false;
  if (/\b(pre-?roll|cartridge|oil|wax|shatter|resin|rosin|vape|edible)\b/i.test(name)) return false;
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN — Generate & Write
   ═══════════════════════════════════════════════════════════════ */
const strainsPath = join(ROOT, 'frontend/src/data/strains.json');
const rawStrains = JSON.parse(readFileSync(strainsPath, 'utf-8'));
const eligible = rawStrains.filter(isEligible);

console.log(`Loaded ${rawStrains.length} strains, ${eligible.length} eligible`);

const output = {};

for (const cat of CATEGORIES) {
  const scored = eligible.map(strain => {
    const science = calcScienceScore(strain, cat);
    const community = calcCommunityScore(strain, cat);
    const commonness = calcCommonnessScore(strain);

    // Tri-pillar: 35 % science · 20 % community · 45 % commonness
    const score = Math.round(science * 0.35 + community * 0.20 + commonness * 0.45);

    return {
      id: strain.id,
      name: strain.name,
      type: strain.type,
      score: Math.max(0, Math.min(100, score)),
      science: Math.round(science),
      community: Math.round(community),
      commonness: Math.round(commonness),
    };
  });

  scored.sort((a, b) => b.score - a.score || b.science - a.science);
  const top100 = scored.slice(0, 100);

  output[cat.id] = {
    label: cat.label,
    emoji: cat.emoji,
    description: cat.description,
    science: cat.science,
    strains: top100,
  };

  console.log(`  ${cat.emoji} ${cat.label}: #1=${top100[0]?.name} (${top100[0]?.score}), #50=${top100[49]?.name} (${top100[49]?.score}), #100=${top100[99]?.name} (${top100[99]?.score})`);
}

const outPath = join(ROOT, 'frontend/src/data/top-strains-for.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nWrote ${outPath} (${(readFileSync(outPath).length / 1024).toFixed(1)} KB)`);
