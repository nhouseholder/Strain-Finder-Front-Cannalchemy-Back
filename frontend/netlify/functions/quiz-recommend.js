/**
 * Netlify Edge Function — Full quiz recommendation engine.
 *
 * Ports the Python backend's 5-layer matching engine to JavaScript,
 * with all 77 strains + receptor pharmacology embedded.
 * No external database needed — runs entirely on Netlify's edge.
 */
import strainData from './strain-data.js';

// ============================================================
// Effect Mapper (from effect_mapper.py)
// ============================================================
const SF_TO_CANONICAL = {
  relaxation: ['relaxed', 'calm', 'body-high'],
  pain_relief: ['pain', 'inflammation', 'arthritis', 'fibromyalgia'],
  creativity: ['creative', 'head-high'],
  energy: ['energetic', 'motivated', 'uplifted'],
  sleep: ['sleepy', 'insomnia'],
  anxiety_relief: ['calm', 'anxiety', 'stress'],
  focus: ['focused'],
  euphoria: ['euphoric', 'happy', 'giggly'],
  social: ['talkative', 'giggly', 'uplifted'],
  appetite: ['hungry', 'appetite-loss'],
};

const SF_AVOID_TO_CANONICAL = {
  anxiety: ['anxious', 'paranoid'],
  couch_lock: ['couch-lock'],
  dry_mouth: ['dry-mouth'],
  munchies: ['hungry'],
  racing_heart: ['rapid-heartbeat'],
  dizziness: ['dizzy'],
  brain_fog: ['disoriented', 'spacey'],
  headache: ['headache'],
};

const CANONICAL_TO_DISPLAY = {
  relaxed: 'Relaxed', calm: 'Calm', 'body-high': 'Body High',
  euphoric: 'Euphoric', happy: 'Happy', creative: 'Creative',
  energetic: 'Energetic', focused: 'Focused', uplifted: 'Uplifted',
  giggly: 'Giggly', talkative: 'Talkative', tingly: 'Tingly',
  aroused: 'Aroused', hungry: 'Hungry', sleepy: 'Sleepy',
  motivated: 'Motivated', meditative: 'Meditative',
  'head-high': 'Head High', spacey: 'Spacey',
  'dry-mouth': 'Dry Mouth', 'dry-eyes': 'Dry Eyes', dizzy: 'Dizzy',
  paranoid: 'Paranoid', anxious: 'Anxious', headache: 'Headache',
  nauseous: 'Nauseous', 'rapid-heartbeat': 'Rapid Heartbeat',
  'couch-lock': 'Couch Lock', disoriented: 'Disoriented',
  pain: 'Pain Relief', stress: 'Stress Relief', anxiety: 'Anxiety Relief',
  depression: 'Depression Relief', insomnia: 'Sleep Aid',
  inflammation: 'Anti-Inflammatory', 'appetite-loss': 'Appetite Stimulant',
  arthritis: 'Arthritis Relief', fibromyalgia: 'Fibromyalgia Relief',
};

const EFFECT_RECEPTOR_PATHWAYS = {
  relaxed: 'CB1, GABA-A', euphoric: 'CB1, dopamine D2',
  happy: 'CB1, 5-HT1A', creative: 'CB1, dopamine D2',
  energetic: 'CB1, TRPV1, norepinephrine', focused: 'CB1, dopamine D1, AChE',
  uplifted: 'CB1, 5-HT1A, dopamine', sleepy: 'CB1, GABA-A, adenosine',
  calm: 'CB1, 5-HT1A, GABA-A', hungry: 'CB1, ghrelin, hypothalamic',
  motivated: 'CB1, dopamine D1, D2', talkative: 'CB1, dopamine, GABA-A',
  giggly: 'CB1, dopamine D2', 'body-high': 'CB1, CB2, TRPV1',
  'head-high': 'CB1, dopamine, serotonin',
  pain: 'CB1, CB2, TRPV1, mu-opioid', stress: 'CB1, 5-HT1A, HPA axis',
  anxiety: 'CB1, 5-HT1A, GABA-A', inflammation: 'CB2, PPARgamma, NF-kB',
  insomnia: 'CB1, GABA-A, adenosine', arthritis: 'CB1, CB2, TRPV1, PPARgamma',
  fibromyalgia: 'CB1, CB2, 5-HT1A, TRPV1', 'appetite-loss': 'CB1, ghrelin, hypothalamic',
};

const CANNABINOID_COLORS = {
  thc: '#ff8c32', cbd: '#9775fa', cbn: '#ffd43b',
  cbg: '#51cf66', thcv: '#22b8cf', cbc: '#f06595',
};

const THC_RANGES = {
  low: [0, 15], medium: [15, 22], high: [22, 28],
  very_high: [28, 40], no_preference: [0, 40],
};
const CBD_RANGES = {
  none: [0, 1], some: [1, 5], high: [5, 15],
  cbd_dominant: [15, 30], no_preference: [0, 30],
};
const BUDGET_ORDER = ['budget', 'mid', 'premium', 'top_shelf'];

const FRIENDLY_MOLECULE = {
  myrcene: ['a calming terpene found in mangoes and hops', 'relaxation and physical comfort'],
  limonene: ['an uplifting terpene found in citrus peels', 'mood elevation and stress relief'],
  caryophyllene: ['a spicy terpene found in black pepper', 'anti-inflammatory effects and calm focus'],
  linalool: ['a soothing terpene found in lavender', 'relaxation and anxiety relief'],
  pinene: ['a refreshing terpene found in pine needles', 'mental clarity and alertness'],
  terpinolene: ['a floral terpene found in lilacs and tea tree', 'a balanced uplifting-yet-calming effect'],
  humulene: ['an earthy terpene found in hops', 'appetite control and subtle relaxation'],
  ocimene: ['a sweet terpene found in basil and orchids', 'energizing and uplifting effects'],
  bisabolol: ['a gentle terpene found in chamomile', 'soothing effects and anti-irritation'],
  thc: ['the primary active compound in cannabis', 'euphoria, relaxation, and pain relief'],
  cbd: ['a non-intoxicating cannabinoid', 'calming effects without the high'],
  cbg: ["a minor cannabinoid sometimes called the 'parent molecule'", 'focus and gentle relaxation'],
  cbn: ['a cannabinoid associated with aged cannabis', 'drowsiness and deep relaxation'],
};

const FRIENDLY_RECEPTOR = {
  CB1: 'brain receptors that regulate mood, pain, and appetite',
  CB2: 'immune system receptors that help reduce inflammation',
  TRPV1: 'pain-sensing receptors (the same ones activated by chili peppers)',
  '5-HT1A': 'serotonin receptors linked to mood and anxiety',
  PPARgamma: 'receptors involved in reducing inflammation',
  GPR55: 'receptors that help regulate bone health and blood pressure',
};

// ============================================================
// Helpers
// ============================================================
function mapQuizEffects(ids) {
  const canonical = [];
  for (const id of ids) {
    canonical.push(...(SF_TO_CANONICAL[id] || []));
  }
  return [...new Set(canonical)];
}

function mapAvoidEffects(ids) {
  const canonical = [];
  for (const id of ids) {
    canonical.push(...(SF_AVOID_TO_CANONICAL[id] || []));
  }
  return [...new Set(canonical)];
}

function canonicalToDisplay(name) {
  return CANONICAL_TO_DISPLAY[name] || name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Build binding lookup from data
function buildBindingLookup() {
  const lookup = {}; // molecule_name -> [{receptor, ki_nm, action_type, affinity_score}]
  for (const b of strainData.bindings) {
    const molName = strainData.molecules.find(m => m.id === b.molecule_id)?.name?.toLowerCase();
    const recName = strainData.receptors.find(r => r.id === b.receptor_id)?.name;
    if (!molName || !recName) continue;
    if (!lookup[molName]) lookup[molName] = [];
    const affinityScore = b.ki_nm ? Math.min(1.0, 100 / b.ki_nm) : 0.5;
    lookup[molName].push({
      receptor: recName,
      ki_nm: b.ki_nm,
      action_type: b.action_type || '',
      affinity_score: affinityScore,
      receptor_function: b.receptor_function || '',
    });
  }
  return lookup;
}

const bindingLookup = buildBindingLookup();

function getMoleculePathways(molName) {
  return bindingLookup[molName.toLowerCase()] || [];
}

// ============================================================
// 5-Layer Matching Engine (from matching_engine.py)
// ============================================================
function buildReceptorProfile(rankedEffects) {
  const weights = {};
  rankedEffects.forEach((effect, i) => {
    const weight = Math.max(1.0 - i * 0.2, 0.2);
    const pathway = EFFECT_RECEPTOR_PATHWAYS[effect] || '';
    for (const r of pathway.split(', ')) {
      const receptor = r.trim();
      if (receptor) weights[receptor] = Math.max(weights[receptor] || 0, weight);
    }
  });
  return weights;
}

function calcPathwayScore(strain, desiredReceptors, desiredEffects) {
  if (!Object.keys(desiredReceptors).length) return 50;
  let totalScore = 0;
  const maxPossible = Object.values(desiredReceptors).reduce((a, b) => a + b, 0);

  for (const t of strain.terpenes || []) {
    const pct = parseFloat(t.pct) || 0;
    const pctWeight = Math.min(pct / 0.5, 1.0);
    for (const p of getMoleculePathways(t.name)) {
      if (desiredReceptors[p.receptor]) {
        totalScore += pctWeight * p.affinity_score * desiredReceptors[p.receptor];
      }
    }
  }
  for (const c of strain.cannabinoids || []) {
    const pctWeight = Math.min((c.value || 0) / 20.0, 1.0);
    for (const p of getMoleculePathways(c.name)) {
      if (desiredReceptors[p.receptor]) {
        totalScore += pctWeight * p.affinity_score * desiredReceptors[p.receptor];
      }
    }
  }

  return maxPossible > 0 ? Math.min((totalScore / maxPossible) * 100, 100) : 50;
}

function calcEffectReportScore(strain, desiredCanonicals) {
  if (!desiredCanonicals.length) return 50;
  const effectSet = new Set((strain.effects || []).map(e => e.name?.toLowerCase()));
  let matched = 0;
  for (const e of desiredCanonicals) {
    if (effectSet.has(e)) matched++;
  }
  return (matched / desiredCanonicals.length) * 100;
}

function calcAvoidScore(strain, avoidCanonicals) {
  if (!avoidCanonicals.length) return 100;
  const effectSet = new Set((strain.effects || []).map(e => e.name?.toLowerCase()));
  let penalties = 0;
  for (const e of avoidCanonicals) {
    if (effectSet.has(e)) penalties++;
  }
  return (1 - penalties / avoidCanonicals.length) * 100;
}

function calcCannabinoidScore(strain, thcPref, cbdPref) {
  const thcVal = (strain.cannabinoids || []).find(c => c.name.toLowerCase() === 'thc')?.value || 0;
  const cbdVal = (strain.cannabinoids || []).find(c => c.name.toLowerCase() === 'cbd')?.value || 0;
  let score = 50;

  const thcRange = THC_RANGES[thcPref] || THC_RANGES.no_preference;
  if (thcVal >= thcRange[0] && thcVal <= thcRange[1]) score += 25;
  else {
    const dist = Math.min(Math.abs(thcVal - thcRange[0]), Math.abs(thcVal - thcRange[1]));
    score += Math.max(0, 25 - dist * 3);
  }

  const cbdRange = CBD_RANGES[cbdPref] || CBD_RANGES.no_preference;
  if (cbdVal >= cbdRange[0] && cbdVal <= cbdRange[1]) score += 25;
  else {
    const dist = Math.min(Math.abs(cbdVal - cbdRange[0]), Math.abs(cbdVal - cbdRange[1]));
    score += Math.max(0, 25 - dist * 5);
  }

  return score;
}

function calcPreferenceScore(strain, quiz) {
  const strainType = strain.type || 'hybrid';
  const subtypePref = quiz.subtype || 'no_preference';
  const subtypeScore = (!subtypePref || subtypePref === 'no_preference') ? 100
    : strainType === subtypePref ? 100 : 40;

  const consumption = strain.consumption_suitability || {};
  const method = quiz.consumptionMethod || 'no_preference';
  let consumptionScore = 100;
  if (method && method !== 'no_preference') {
    consumptionScore = consumption[method] ? (consumption[method] / 5) * 100 : 60;
  }

  const budget = quiz.budget || 'no_preference';
  let budgetScore = 100;
  if (budget && budget !== 'no_preference') {
    const si = BUDGET_ORDER.indexOf(strain.price_range || 'mid');
    const ui = BUDGET_ORDER.indexOf(budget);
    if (si >= 0 && ui >= 0) budgetScore = Math.max(0, 100 - Math.abs(si - ui) * 35);
    else budgetScore = 60;
  }

  return subtypeScore * 0.5 + consumptionScore * 0.25 + budgetScore * 0.25;
}

// ============================================================
// Response Builders (from quiz.py)
// ============================================================
function buildForumAnalysis(strain) {
  const effects = strain.effects || [];
  if (!effects.length) {
    return {
      totalReviews: 'Limited data', sentimentScore: 5.0,
      pros: [{ effect: 'Community reported', pct: 50, baseline: 50 }],
      cons: [{ effect: 'Limited reviews', pct: 10, baseline: 15 }],
      sources: 'Strain Tracker community data',
    };
  }

  const total = effects.reduce((s, e) => s + (e.reports || 0), 0);
  const positive = effects.filter(e => e.category === 'positive' || e.category === 'medical');
  const negative = effects.filter(e => e.category === 'negative');
  const posCount = positive.reduce((s, e) => s + (e.reports || 0), 0);
  const sentiment = total > 0 ? Math.round((posCount / total) * 100) / 10 : 5.0;

  // Include ALL positive effects so EffectVerification can match user's desired effects
  const pros = positive.map(e => {
    const pct = Math.min(Math.round((e.reports / Math.max(total, 1)) * 100), 95);
    return { effect: canonicalToDisplay(e.name), pct, baseline: Math.max(pct - 15, 20) };
  });
  const cons = negative.map(e => {
    const pct = Math.min(Math.round((e.reports / Math.max(total, 1)) * 100), 80);
    return { effect: canonicalToDisplay(e.name), pct, baseline: Math.max(pct - 10, 10) };
  });

  return {
    totalReviews: `~${total} community reports`,
    sentimentScore: sentiment,
    pros: pros.length ? pros : [{ effect: 'Positive effects reported', pct: 60, baseline: 50 }],
    cons: cons.length ? cons : [{ effect: 'Minimal negatives reported', pct: 10, baseline: 15 }],
    sources: 'Strain Tracker community data (24,853 strains)',
  };
}

function md5Simple(str) {
  // Simple hash for deterministic variation (not cryptographic)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function computeSommelierScores(strain, forum) {
  const terps = (strain.terpenes || []).map(t => ({ name: t.name.toLowerCase(), pct: parseFloat(t.pct) || 0 }));
  const totalTerp = terps.reduce((s, t) => s + t.pct, 0);
  const dominant = terps[0]?.name || '';
  const dominantPct = terps[0]?.pct || 0;
  const nTerps = terps.length;
  const thc = (strain.cannabinoids || []).find(c => c.name.toLowerCase() === 'thc')?.value || 0;
  const cbd = (strain.cannabinoids || []).find(c => c.name.toLowerCase() === 'cbd')?.value || 0;
  const nFlavors = (strain.flavors || []).length;
  const sentiment = forum?.sentimentScore || 7.0;
  const strainType = strain.type || 'hybrid';

  const h = md5Simple(`${terps.map(t => t.name).join(',')}:${thc.toFixed(1)}:${cbd.toFixed(1)}:${strainType}`);
  const offsets = Array.from({ length: 5 }, (_, i) => ((h >> (i * 5)) & 0x1F) / 31.0 * 1.6 - 0.8);

  const tasteTerpMap = { limonene: 1.5, linalool: 1.2, terpinolene: 1.3, ocimene: 1.0, myrcene: 0.5, caryophyllene: 0.8, pinene: 0.7, humulene: 0.6, bisabolol: 0.9 };
  let taste = 5.5 + (tasteTerpMap[dominant] || 0.4) + Math.min(nFlavors * 0.6, 1.8) + Math.min(dominantPct * 1.2, 1.0) + offsets[0];

  const aromatic = new Set(['limonene', 'linalool', 'terpinolene', 'ocimene', 'bisabolol']);
  let aroma = 5 + terps.filter(t => aromatic.has(t.name)).length * 1.2 + Math.min(totalTerp * 0.8, 1.5) + (aromatic.has(dominant) ? 0.8 : 0) + offsets[1];

  const smooth = new Set(['myrcene', 'linalool', 'bisabolol']);
  let smoke = 5 + terps.filter(t => smooth.has(t.name)).length * 0.9 + Math.min(cbd * 0.5, 1.5) + (dominant === 'myrcene' ? 0.7 : 0) + Math.min(totalTerp * 0.4, 0.8) + offsets[2];

  let throat = 7 - Math.min(Math.max(thc - 18, 0) * 0.15, 2.5) + (terps.some(t => t.name === 'linalool') ? 1.0 : 0) + (terps.some(t => t.name === 'myrcene') ? 0.5 : 0) + Math.min(cbd * 0.3, 1.0) + offsets[3];

  let burn = 4 + Math.min(sentiment * 0.45, 3.5) + Math.min(nTerps * 0.3, 1.0) + Math.min(totalTerp * 0.3, 0.5) + offsets[4];

  if (strainType === 'indica') { smoke += 0.4; throat += 0.3; }
  else if (strainType === 'sativa') { aroma += 0.5; taste += 0.3; }

  const clamp = v => Math.max(3, Math.min(10, Math.round(v)));
  return { taste: clamp(taste), aroma: clamp(aroma), smoke: clamp(smoke), throat: clamp(throat), burn: clamp(burn) };
}

function buildSommelierNotes(strain) {
  const flavors = strain.flavors || [];
  const strainType = strain.type || 'hybrid';
  if (!flavors.length) {
    const typeNotes = {
      indica: { taste: 'Rich, earthy with deep undertones', aroma: 'Pungent, skunky with herbal notes', smoke: 'Smooth, full-bodied', burn: 'Even, slow burn' },
      sativa: { taste: 'Bright, citrusy with floral hints', aroma: 'Sweet, tropical with pine accents', smoke: 'Light, airy draw', burn: 'Clean, white ash' },
      hybrid: { taste: 'Balanced blend of sweet and earthy', aroma: 'Complex, layered terpene profile', smoke: 'Medium body, smooth finish', burn: 'Even, consistent burn' },
    };
    return typeNotes[strainType] || typeNotes.hybrid;
  }
  const flavorStr = flavors.slice(0, 3).join(', ').toLowerCase();
  return { taste: `Notes of ${flavorStr}`, aroma: `Aromatic with ${flavorStr} undertones`, smoke: 'Smooth, well-balanced draw', burn: 'Even, clean burn' };
}

function buildWhyMatch(strain, desiredCanonicals) {
  const topMolecules = [...(strain.terpenes || []).map(t => ({ name: t.name.toLowerCase(), pct: parseFloat(t.pct) || 0, type: 'terpene' })),
    ...(strain.cannabinoids || []).filter(c => c.value > 0.5).map(c => ({ name: c.name.toLowerCase(), pct: c.value, type: 'cannabinoid' }))
  ].sort((a, b) => b.pct - a.pct).slice(0, 3);

  if (!topMolecules.length) {
    return `${strain.name} is a great match based on what other users report. Community data shows this strain aligns well with your desired effects.`;
  }

  const desiredReceptors = new Set();
  for (const e of desiredCanonicals) {
    for (const r of (EFFECT_RECEPTOR_PATHWAYS[e] || '').split(', ')) {
      if (r.trim()) desiredReceptors.add(r.trim());
    }
  }

  const parts = [];
  for (const mol of topMolecules) {
    const pathways = getMoleculePathways(mol.name);
    if (!pathways.length) continue;
    const bestP = pathways.find(p => desiredReceptors.has(p.receptor)) || pathways[0];
    const receptor = bestP.receptor;
    const molInfo = FRIENDLY_MOLECULE[mol.name];
    const recInfo = FRIENDLY_RECEPTOR[receptor] || 'receptors in your body';

    // Find matched effect
    let matchedEffect = null;
    for (const e of desiredCanonicals) {
      if ((EFFECT_RECEPTOR_PATHWAYS[e] || '').includes(receptor)) {
        matchedEffect = e.replace(/-/g, ' ');
        break;
      }
    }

    if (molInfo) {
      const effectStr = matchedEffect ? ` — especially for ${matchedEffect}` : '';
      parts.push(`${mol.name.charAt(0).toUpperCase() + mol.name.slice(1)} (${mol.pct.toFixed(1)}%) is ${molInfo[0]} that works with your ${recInfo}, promoting ${molInfo[1]}${effectStr}.`);
    }
  }

  if (!parts.length) {
    return `${strain.name} is a great match based on what other users report. Community data shows this strain aligns well with your desired effects.`;
  }

  return `${strain.name} works with your body's natural chemistry. ${parts.join(' ')}`;
}

function buildEffectPredictions(strain, desiredCanonicals) {
  const effectMap = {};
  let totalReports = 0;
  for (const e of (strain.effects || [])) {
    effectMap[e.name?.toLowerCase()] = e.reports || 0;
    totalReports += e.reports || 0;
  }

  const strainReceptors = new Set();
  for (const t of (strain.terpenes || [])) {
    for (const p of getMoleculePathways(t.name)) strainReceptors.add(p.receptor);
  }
  for (const c of (strain.cannabinoids || [])) {
    for (const p of getMoleculePathways(c.name)) strainReceptors.add(p.receptor);
  }

  return desiredCanonicals.map(canonical => {
    const reportCount = effectMap[canonical] || 0;
    const reportProb = reportCount > 0 ? Math.min((reportCount / Math.max(totalReports, 1)) * 5, 1.0) : 0.0;
    const pathwayStr = EFFECT_RECEPTOR_PATHWAYS[canonical] || '';
    const effectReceptors = new Set(pathwayStr.split(',').map(r => r.trim()).filter(Boolean));
    const overlap = effectReceptors.size ? [...effectReceptors].filter(r => strainReceptors.has(r)).length / effectReceptors.size : 0.3;
    const probability = Math.round((reportProb * 0.6 + overlap * 0.4) * 100) / 100;
    const confidence = Math.round(Math.min(probability * 0.9, 0.95) * 100) / 100;
    return { effect: canonical, probability, confidence, pathway: pathwayStr || 'multiple pathways' };
  }).sort((a, b) => b.probability - a.probability).slice(0, 6);
}

function buildPathways(strain) {
  const pathways = [];
  const seen = new Set();
  const allMols = [
    ...(strain.terpenes || []).map(t => t.name),
    ...(strain.cannabinoids || []).filter(c => c.value > 0).map(c => c.name),
  ];
  for (const molName of allMols) {
    for (const p of getMoleculePathways(molName)) {
      const key = `${molName}-${p.receptor}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pathways.push({
        molecule: molName, receptor: p.receptor,
        ki_nm: p.ki_nm, action_type: p.action_type,
        effect_contribution: p.receptor_function, confidence: p.affinity_score,
      });
    }
  }
  return pathways.slice(0, 10);
}

function buildStrainResult(strain, matchPct, desiredCanonicals) {
  const forum = buildForumAnalysis(strain);
  const sommelierScores = computeSommelierScores(strain, forum);
  const sommelierNotes = buildSommelierNotes(strain);
  const whyMatch = buildWhyMatch(strain, desiredCanonicals);
  const effectPredictions = buildEffectPredictions(strain, desiredCanonicals);
  const pathways = buildPathways(strain);

  const thcVal = (strain.cannabinoids || []).find(c => c.name.toLowerCase() === 'thc')?.value || 0;
  const cbdVal = (strain.cannabinoids || []).find(c => c.name.toLowerCase() === 'cbd')?.value || 0;

  const displayEffects = (strain.effects || [])
    .filter(e => e.category === 'positive' || e.category === 'medical')
    .sort((a, b) => (b.reports || 0) - (a.reports || 0))
    .slice(0, 6)
    .map(e => canonicalToDisplay(e.name));

  const cannabinoids = ['thc', 'cbd', 'cbn', 'cbg', 'thcv', 'cbc'].map(name => {
    const found = (strain.cannabinoids || []).find(c => c.name.toLowerCase() === name);
    return { name: name.toUpperCase(), value: found?.value || 0, color: CANNABINOID_COLORS[name] || '#999' };
  });

  const terpenes = (strain.terpenes || []).slice(0, 5).map(t => ({
    name: t.name.charAt(0).toUpperCase() + t.name.slice(1),
    pct: t.pct,
  }));

  return {
    name: strain.name,
    type: strain.type || 'hybrid',
    matchPct,
    thc: Math.round(thcVal * 10) / 10,
    cbd: Math.round(cbdVal * 10) / 10,
    genetics: strain.genetics || '',
    lineage: strain.lineage || { self: strain.name },
    effects: displayEffects,
    terpenes,
    cannabinoids,
    whyMatch,
    forumAnalysis: forum,
    sentimentScore: forum.sentimentScore,
    sommelierNotes,
    sommelierScores,
    bestFor: strain.best_for || [],
    notIdealFor: strain.not_ideal_for || [],
    description: strain.description || '',
    effectPredictions,
    pathways,
  };
}

// ============================================================
// Main Handler
// ============================================================
export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  let quiz;
  try { quiz = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const effects = quiz.effects || [];
  if (!effects.length) {
    return new Response(JSON.stringify({ error: 'At least one effect must be selected' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const desiredCanonicals = mapQuizEffects(quiz.effectRanking?.length ? quiz.effectRanking : effects);
  const avoidCanonicals = mapAvoidEffects(quiz.avoidEffects || []);
  const desiredReceptors = buildReceptorProfile(desiredCanonicals);

  // Score all strains
  const scored = strainData.strains.map(strain => {
    const pathway = calcPathwayScore(strain, desiredReceptors, desiredCanonicals);
    const effect = calcEffectReportScore(strain, desiredCanonicals);
    const avoid = calcAvoidScore(strain, avoidCanonicals);
    const cannabinoid = calcCannabinoidScore(strain, quiz.thcPreference || 'no_preference', quiz.cbdPreference || 'no_preference');
    const preference = calcPreferenceScore(strain, quiz);

    const total = Math.max(0, Math.min(100, Math.round(
      pathway * 0.40 + effect * 0.25 + avoid * 0.15 + cannabinoid * 0.10 + preference * 0.10
    )));

    return { strain, score: total };
  });

  scored.sort((a, b) => b.score - a.score);

  // Build top 5 results
  const mainResults = scored.slice(0, 5).map(s => buildStrainResult(s.strain, s.score, desiredCanonicals));

  // AI picks: 2 from positions 6-15 with type diversity
  const mainTypes = new Set(mainResults.map(r => r.type));
  const aiPickCandidates = scored.slice(5, 15);
  const aiPicks = [];

  const diffType = aiPickCandidates.find(c => !mainTypes.has(c.strain.type));
  if (diffType) {
    const result = buildStrainResult(diffType.strain, diffType.score, desiredCanonicals);
    result.reason = `A ${diffType.strain.type} option that brings a different terpene profile to explore.`;
    aiPicks.push(result);
  } else if (aiPickCandidates.length) {
    const result = buildStrainResult(aiPickCandidates[0].strain, aiPickCandidates[0].score, desiredCanonicals);
    result.reason = 'A hidden gem with a unique molecular profile worth exploring.';
    aiPicks.push(result);
  }

  const remaining = aiPickCandidates.filter(c => c.strain.name !== (aiPicks[0]?.name || ''));
  if (remaining.length) {
    const result = buildStrainResult(remaining[0].strain, remaining[0].score, desiredCanonicals);
    result.reason = 'An unexpected match with complementary receptor activity.';
    aiPicks.push(result);
  }

  // Build ideal profile
  const topTerpTotals = {};
  let thcTotal = 0, cbdTotal = 0;
  for (const s of scored.slice(0, 5)) {
    for (const t of (s.strain.terpenes || [])) {
      const pct = parseFloat(t.pct) || 0;
      topTerpTotals[t.name] = (topTerpTotals[t.name] || 0) + pct;
    }
    thcTotal += (s.strain.cannabinoids || []).find(c => c.name.toLowerCase() === 'thc')?.value || 0;
    cbdTotal += (s.strain.cannabinoids || []).find(c => c.name.toLowerCase() === 'cbd')?.value || 0;
  }
  const avgTerps = Object.entries(topTerpTotals)
    .map(([name, total]) => ({ name, ratio: `${(total / 5).toFixed(2)}%` }))
    .sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))
    .slice(0, 5);

  const idealProfile = {
    terpenes: avgTerps,
    cannabinoids: { thc: `${Math.round(thcTotal / 5)}%`, cbd: `${(cbdTotal / 5).toFixed(1)}%` },
    subtype: quiz.subtype || 'hybrid',
  };

  return new Response(JSON.stringify({
    strains: mainResults,
    aiPicks: aiPicks.slice(0, 2),
    idealProfile,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};

export const config = {
  path: '/api/v1/quiz/recommend',
};
