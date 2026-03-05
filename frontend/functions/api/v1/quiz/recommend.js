/**
 * Cloudflare Pages Function — Full quiz recommendation engine.
 *
 * Tri-pillar scoring engine (40% Science · 30% Community · 30% Commonness) with receptor-level scoring,
 * tolerance-aware THC safety, entourage synergy analysis, and
 * scaffold-driven molecular profile optimization.
 *
 * Includes KV-based result caching (1h TTL) — the engine is deterministic,
 * so identical quiz inputs always produce identical outputs.
 */
import strainData from '../../../_data/strain-data.js';
import {
  EFFECT_SCAFFOLD,
  EXPANDED_BINDINGS,
  TOLERANCE_THC_RANGES,
  TEMPLATE_TERPENE_PROFILES,
  SYNERGY_MATRIX,
} from '../../../_data/pharmacology-scaffold.js';

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
  giggles: ['giggly', 'happy', 'euphoric'],
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

// Build binding lookup from data + expanded pharmacology scaffold
function buildBindingLookup() {
  const lookup = {}; // molecule_name -> [{receptor, ki_nm, action_type, affinity_score}]

  // Base bindings from strain-data.js
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

  // Merge expanded bindings from pharmacology scaffold
  // (pinene/AChE, humulene/CB2, terpinolene, ocimene, bisabolol, nerolidol, etc.)
  for (const eb of EXPANDED_BINDINGS) {
    const molName = eb.molecule_name.toLowerCase();
    if (!lookup[molName]) lookup[molName] = [];
    // Avoid duplicate receptor entries
    const exists = lookup[molName].some(b => b.receptor === eb.receptor);
    if (exists) continue;
    const affinityScore = eb.ki_nm ? Math.min(1.0, 100 / eb.ki_nm) : 0.5;
    lookup[molName].push({
      receptor: eb.receptor,
      ki_nm: eb.ki_nm,
      action_type: eb.action_type || '',
      affinity_score: affinityScore,
      receptor_function: eb.receptor_function || '',
    });
  }

  return lookup;
}

const bindingLookup = buildBindingLookup();

// ============================================================
// Template Terpene Profile Detection (data quality)
// ============================================================
const TEMPLATE_SET = new Set(TEMPLATE_TERPENE_PROFILES);

function getTerpProfileKey(strain) {
  return (strain.terpenes || [])
    .map(t => `${t.name}:${t.pct}`)
    .join(',');
}

function hasTemplateTerpenes(strain) {
  return TEMPLATE_SET.has(getTerpProfileKey(strain));
}

// ============================================================
// Tolerance-Aware THC Safety Scoring
// ============================================================
function calcToleranceScore(strain, toleranceId) {
  const range = TOLERANCE_THC_RANGES[toleranceId] || TOLERANCE_THC_RANGES.intermediate;
  const thcVal = (strain.cannabinoids || []).find(c => c.name.toLowerCase() === 'thc')?.value || 0;

  // Perfect score if within optimal range
  if (thcVal >= range.optimal[0] && thcVal <= range.optimal[1]) return 100;

  // Inside safe range but outside optimal: minor penalty
  if (thcVal >= range.safe[0] && thcVal <= range.safe[1]) {
    const distFromOptimal = thcVal < range.optimal[0]
      ? range.optimal[0] - thcVal
      : thcVal - range.optimal[1];
    return Math.max(50, 100 - distFromOptimal * range.penalty_per_pct);
  }

  // Above safe range: harsh penalty (hard cap violation)
  if (thcVal > range.safe[1]) {
    const excess = thcVal - range.safe[1];
    return Math.max(0, 50 - excess * range.penalty_per_pct * 3);
  }

  return 80; // Below safe range minimum (rare edge case)
}

// ============================================================
// Scaffold-Driven Molecular Profile Score
// ============================================================
// For each desired effect, the scaffold defines an ideal molecular profile.
// This scorer measures how well a strain's actual chemistry matches that ideal.
function calcScaffoldScore(strain, desiredCanonicals) {
  if (!desiredCanonicals.length) return 50;

  const terpMap = {};
  for (const t of (strain.terpenes || [])) {
    terpMap[t.name.toLowerCase()] = parseFloat(t.pct) || 0;
  }
  const cannMap = {};
  for (const c of (strain.cannabinoids || [])) {
    cannMap[c.name.toLowerCase()] = c.value || 0;
  }
  const strainType = (strain.type || 'hybrid').toLowerCase();

  let totalScore = 0;
  let totalWeight = 0;

  for (let i = 0; i < desiredCanonicals.length; i++) {
    const priority = Math.max(1.0 - i * 0.15, 0.3);
    const scaffold = EFFECT_SCAFFOLD[desiredCanonicals[i]];
    if (!scaffold) continue;

    let effectScore = 0;
    let effectMaxWeight = 0;

    // Score each optimal molecule
    for (const [mol, spec] of Object.entries(scaffold.optimalMolecules)) {
      const actual = terpMap[mol] ?? cannMap[mol] ?? 0;
      const { min, ideal, weight } = spec;
      effectMaxWeight += weight;

      if (ideal === 0 && actual > 0) {
        // Contra-indicated molecule (e.g., humulene for appetite)
        effectScore -= weight * 0.5;
        continue;
      }

      if (actual >= ideal) {
        effectScore += weight * 1.0; // At or above ideal = full marks
      } else if (actual >= min) {
        // Scale linearly between min and ideal
        effectScore += weight * (0.4 + 0.6 * ((actual - min) / Math.max(ideal - min, 0.01)));
      } else if (actual > 0) {
        // Present but below minimum
        effectScore += weight * 0.2;
      }
      // absent = 0
    }

    // Subtype affinity bonus
    const subtypeBonus = scaffold.subtypeAffinity?.[strainType] || 1.0;

    const normalized = effectMaxWeight > 0
      ? (effectScore / effectMaxWeight) * 100 * subtypeBonus
      : 50;

    totalScore += normalized * priority;
    totalWeight += priority;
  }

  return totalWeight > 0 ? Math.max(0, Math.min(100, totalScore / totalWeight)) : 50;
}

// ============================================================
// Goal-Aware Synergy Score (uses SYNERGY_MATRIX)
// ============================================================
function calcGoalSynergyScore(strain, desiredCanonicals) {
  const terpNames = (strain.terpenes || []).map(t => t.name?.toLowerCase()).filter(Boolean);
  const cannNames = (strain.cannabinoids || []).filter(c => c.value > 1).map(c => c.name?.toLowerCase()).filter(Boolean);
  const allMols = [...terpNames, ...cannNames];
  if (allMols.length < 2) return 0;

  const desiredSet = new Set(desiredCanonicals);
  let synergy = 0;

  for (let i = 0; i < allMols.length; i++) {
    for (let j = i + 1; j < allMols.length; j++) {
      const key1 = `${allMols[i]}+${allMols[j]}`;
      const key2 = `${allMols[j]}+${allMols[i]}`;
      const entry = SYNERGY_MATRIX[key1] || SYNERGY_MATRIX[key2];
      if (!entry) continue;

      // Extra bonus if the synergy targets a desired effect
      const goalsMatch = entry.goals.some(g => desiredSet.has(g));
      synergy += entry.bonus * (goalsMatch ? 1.5 : 0.8);
    }
  }

  // Diversity bonus (more terpenes = richer entourage)
  synergy += Math.min(terpNames.length * 0.03, 0.15);

  return Math.min(synergy * 100, 100);
}

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

  // Weighted scoring: higher-reported desired effects score more
  let totalWeight = 0;
  let matchWeight = 0;
  for (let i = 0; i < desiredCanonicals.length; i++) {
    const priority = Math.max(1.0 - i * 0.15, 0.3); // first-ranked effects matter more
    totalWeight += priority;
    const reports = effectMap[desiredCanonicals[i]];
    if (reports !== undefined) {
      // Scale by report strength: a strain where this effect is dominant scores higher
      const reportStrength = Math.min((reports / maxReports), 1.0);
      matchWeight += priority * (0.5 + 0.5 * reportStrength); // 50% for presence, 50% for strength
    }
  }
  return totalWeight > 0 ? (matchWeight / totalWeight) * 100 : 50;
}

function calcAvoidScore(strain, avoidCanonicals) {
  if (!avoidCanonicals.length) return 100;
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

  // Weighted penalty: commonly-reported unwanted effects penalize more
  let penalty = 0;
  for (const e of avoidCanonicals) {
    const reports = effectMap[e];
    if (reports !== undefined) {
      const severity = 0.6 + 0.4 * Math.min(reports / maxReports, 1.0);
      penalty += severity;
    }
  }
  // Harsh penalty — even 1 strong avoided effect significantly drops score
  return Math.max(0, 100 - (penalty / avoidCanonicals.length) * 120);
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
function computeSentimentScore(effects, strain) {
  // Realistic community sentiment: no perfect 10s, most strains cluster 6.0-8.5
  const total = effects.reduce((s, e) => s + (e.reports || 0), 0);
  const positive = effects.filter(e => e.category === 'positive' || e.category === 'medical');
  const negative = effects.filter(e => e.category === 'negative');
  const posCount = positive.reduce((s, e) => s + (e.reports || 0), 0);
  const negCount = negative.reduce((s, e) => s + (e.reports || 0), 0);

  // Base: 7.0 (an average strain)
  let score = 7.0;

  // Positive/negative report balance: shifts ±1.5 points
  // A strain with 90% positive reports gets +1.0; 50% positive gets -1.0
  const posRatio = total > 0 ? posCount / total : 0.7;
  score += (posRatio - 0.7) * 5.0;

  // Negative effect diversity penalty: more distinct negative effects = lower score
  // -0.15 per distinct negative effect, capped at -1.0
  score -= Math.min(negative.length * 0.15, 1.0);

  // Volume confidence: more community reports = slightly higher (up to +0.3)
  score += Math.min(total / 2000, 0.3);

  // Natural variation per strain (±0.3) based on name hash for reproducibility
  const nameHash = md5Simple(strain.name || '');
  score += ((nameHash % 7) - 3) * 0.1;

  // Hard cap: 3.5 to 9.2 — no perfect scores, no impossibly low scores
  return Math.min(9.2, Math.max(3.5, Math.round(score * 10) / 10));
}

function deriveNegativeEffects(strain) {
  // All cannabis has common side effects — derive realistic baseline negatives
  // when the data doesn't include explicit negative-category effects
  const thc = (strain.cannabinoids || []).find(c => c.name?.toLowerCase() === 'thc')?.value || 15;
  const strainType = (strain.type || 'hybrid').toLowerCase();
  const cons = [];

  // Dry mouth affects virtually all cannabis users (25-40%)
  cons.push({ effect: 'Dry Mouth', pct: Math.round(25 + Math.min(thc * 0.5, 15)), baseline: 30 });
  // Dry eyes (15-25%)
  cons.push({ effect: 'Dry Eyes', pct: Math.round(15 + Math.min(thc * 0.3, 10)), baseline: 20 });

  // High THC strains: anxiety risk
  if (thc > 18) {
    cons.push({ effect: 'Anxiety', pct: Math.round(8 + Math.min((thc - 18) * 1.5, 15)), baseline: 15 });
  }
  // Very high THC: paranoia risk
  if (thc > 22) {
    cons.push({ effect: 'Paranoia', pct: Math.round(5 + Math.min((thc - 22) * 1.2, 10)), baseline: 10 });
  }
  // Indica: drowsiness
  if (strainType === 'indica') {
    cons.push({ effect: 'Drowsiness', pct: 20, baseline: 15 });
  }
  // Sativa: headache risk
  if (strainType === 'sativa' && thc > 20) {
    cons.push({ effect: 'Headache', pct: 10, baseline: 12 });
  }
  // Dizziness (universal, low rate)
  cons.push({ effect: 'Dizziness', pct: Math.round(6 + Math.min(thc * 0.2, 5)), baseline: 8 });

  return cons;
}

function buildForumAnalysis(strain) {
  const effects = strain.effects || [];
  if (!effects.length) {
    return {
      totalReviews: 'Limited data', sentimentScore: 6.0,
      pros: [{ effect: 'Community reported', pct: 50, baseline: 50 }],
      cons: deriveNegativeEffects(strain),
      sources: 'Strain Tracker community data',
    };
  }

  const total = effects.reduce((s, e) => s + (e.reports || 0), 0);
  const positive = effects.filter(e => e.category === 'positive' || e.category === 'medical');
  const negative = effects.filter(e => e.category === 'negative');

  // Use max-relative normalization so top effects show realistic 80-95%
  const maxReports = Math.max(...effects.map(e => e.reports || 0), 1);

  // Realistic sentiment score — no perfect 10s
  const sentiment = computeSentimentScore(effects, strain);

  const pros = positive.map(e => {
    // Max-relative: top effect ≈ 85-95%, others proportional
    const rawPct = Math.round((e.reports / maxReports) * 100);
    const pct = Math.min(Math.max(rawPct, 10), 95);
    return { effect: canonicalToDisplay(e.name), canonical: e.name?.toLowerCase(), pct, baseline: Math.max(pct - 15, 20) };
  });

  // Use real negative data when available, otherwise derive from strain profile
  let cons;
  if (negative.length > 0) {
    cons = negative.map(e => {
      // Negatives also max-relative but capped lower
      const rawPct = Math.round((e.reports / maxReports) * 100);
      const pct = Math.min(Math.max(rawPct, 5), 60);
      return { effect: canonicalToDisplay(e.name), canonical: e.name?.toLowerCase(), pct, baseline: Math.max(pct - 10, 10) };
    });
    // Always include dry mouth and dry eyes if not already present
    const consNames = new Set(cons.map(c => c.canonical));
    if (!consNames.has('dry-mouth') && !consNames.has('dry mouth') && !consNames.has('cottonmouth')) {
      cons.push({ effect: 'Dry Mouth', canonical: 'dry-mouth', pct: 28, baseline: 30 });
    }
    if (!consNames.has('dry-eyes') && !consNames.has('dry eyes')) {
      cons.push({ effect: 'Dry Eyes', canonical: 'dry-eyes', pct: 18, baseline: 20 });
    }
  } else {
    cons = deriveNegativeEffects(strain);
  }

  return {
    totalReviews: `~${total} community reports`,
    sentimentScore: sentiment,
    pros: pros.length ? pros : [{ effect: 'Positive effects reported', pct: 60, baseline: 50 }],
    cons,
    sources: 'Strain Tracker community data (24,853 strains)',
  };
}

function md5Simple(str) {
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

  // Build a set of receptor targets derived from the scaffold for the user's desired effects
  const scaffoldTargets = new Map(); // receptor → { weight, goalName }
  for (const effect of desiredCanonicals) {
    const scaffold = EFFECT_SCAFFOLD[effect];
    if (!scaffold) continue;
    for (const [receptor, spec] of Object.entries(scaffold.receptors || {})) {
      if (!scaffoldTargets.has(receptor) || scaffoldTargets.get(receptor).weight < spec.weight) {
        scaffoldTargets.set(receptor, { weight: spec.weight, goalName: effect, action: spec.action, note: spec.note });
      }
    }
  }

  const desiredReceptors = new Set(scaffoldTargets.keys());
  // Also include the old pathway lookup as fallback
  for (const e of desiredCanonicals) {
    for (const r of (EFFECT_RECEPTOR_PATHWAYS[e] || '').split(', ')) {
      if (r.trim()) desiredReceptors.add(r.trim());
    }
  }

  const parts = [];
  for (const mol of topMolecules) {
    const pathways = getMoleculePathways(mol.name);
    if (!pathways.length) continue;

    // Find the binding that targets a user-desired receptor
    const bestP = pathways.find(p => desiredReceptors.has(p.receptor)) || pathways[0];
    const receptor = bestP.receptor;
    const molInfo = FRIENDLY_MOLECULE[mol.name];
    const recInfo = FRIENDLY_RECEPTOR[receptor] || 'receptors in your body';

    // Check if scaffold has a specific note for this receptor target
    const scaffoldTarget = scaffoldTargets.get(receptor);
    const goalNote = scaffoldTarget
      ? ` — key for ${scaffoldTarget.goalName.replace(/-/g, ' ')}`
      : '';

    if (molInfo) {
      parts.push(`${mol.name.charAt(0).toUpperCase() + mol.name.slice(1)} (${mol.pct.toFixed(1)}%) is ${molInfo[0]} that activates your ${recInfo}${goalNote}, promoting ${molInfo[1]}.`);
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
    effectMap[e.name?.toLowerCase()] = e;
    totalReports += e.reports || 0;
  }

  const strainReceptors = new Set();
  for (const t of (strain.terpenes || [])) {
    for (const p of getMoleculePathways(t.name)) strainReceptors.add(p.receptor);
  }
  for (const c of (strain.cannabinoids || [])) {
    for (const p of getMoleculePathways(c.name)) strainReceptors.add(p.receptor);
  }

  function calcPrediction(effectName) {
    const eData = effectMap[effectName];
    const reportCount = eData?.reports || 0;
    const reportProb = reportCount > 0 ? Math.min((reportCount / Math.max(totalReports, 1)) * 5, 1.0) : 0.0;
    const pathwayStr = EFFECT_RECEPTOR_PATHWAYS[effectName] || '';
    const effectReceptors = new Set(pathwayStr.split(',').map(r => r.trim()).filter(Boolean));
    const overlap = effectReceptors.size ? [...effectReceptors].filter(r => strainReceptors.has(r)).length / effectReceptors.size : 0.3;
    const probability = Math.round((reportProb * 0.6 + overlap * 0.4) * 100) / 100;
    const confidence = Math.round(Math.min(probability * 0.9, 0.95) * 100) / 100;
    return { effect: effectName, probability, confidence, pathway: pathwayStr || 'multiple pathways' };
  }

  const included = new Set();
  const results = [];

  // 1. Include desired canonicals that actually exist in strain effects (real data)
  for (const canonical of desiredCanonicals) {
    if (effectMap[canonical]) {
      results.push(calcPrediction(canonical));
      included.add(canonical);
    }
  }

  // 2. Fill with strain's top positive/medical effects by report count
  const sortedEffects = (strain.effects || [])
    .filter(e => e.category === 'positive' || e.category === 'medical')
    .sort((a, b) => (b.reports || 0) - (a.reports || 0));

  for (const e of sortedEffects) {
    const name = e.name?.toLowerCase();
    if (!name || included.has(name)) continue;
    if (results.length >= 8) break;
    results.push(calcPrediction(name));
    included.add(name);
  }

  return results.sort((a, b) => b.probability - a.probability);
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

  // Pass full effect objects so EffectsBreakdown can display real stats
  const fullEffects = (strain.effects || [])
    .sort((a, b) => (b.reports || 0) - (a.reports || 0))
    .map(e => ({
      name: canonicalToDisplay(e.name),
      category: e.category || 'positive',
      reports: e.reports || 0,
      confidence: e.confidence || 0,
    }));

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
    effects: fullEffects,
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
    availability: strain.availability || 5,
    effectPredictions,
    pathways,
  };
}

// ============================================================
// Main Handler — Cloudflare Pages Function
// ============================================================
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' },
  });
}

export async function onRequestPost(context) {
  const { request: req, env } = context

  let quiz;
  try { quiz = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const effects = quiz.effects || [];
  if (!effects.length) {
    return new Response(JSON.stringify({ error: 'At least one effect must be selected' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // ── KV cache check (deterministic engine — same inputs = same outputs) ──
  // v5: pharmacological scaffold + tolerance safety + expanded bindings
  const quizCacheKey = `quiz:v5:${md5Simple(JSON.stringify({
    effects: (quiz.effects || []).slice().sort(),
    effectRanking: quiz.effectRanking || [],
    avoidEffects: (quiz.avoidEffects || []).slice().sort(),
    tolerance: quiz.tolerance || 'intermediate',
    thcPreference: quiz.thcPreference || 'no_preference',
    cbdPreference: quiz.cbdPreference || 'no_preference',
    subtype: quiz.subtype || 'no_preference',
    consumptionMethod: quiz.consumptionMethod || 'no_preference',
    budget: quiz.budget || 'no_preference',
  }))}`

  if (env?.CACHE) {
    try {
      const cached = await env.CACHE.get(quizCacheKey, 'json')
      if (cached) {
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'X-Cache': 'HIT' },
        })
      }
    } catch { /* cache miss, compute fresh */ }
  }

  const desiredCanonicals = mapQuizEffects(quiz.effectRanking?.length ? quiz.effectRanking : effects);
  const avoidCanonicals = mapAvoidEffects(quiz.avoidEffects || []);
  const desiredReceptors = buildReceptorProfile(desiredCanonicals);

  // ── Filter out breeder-specific, auto, product-name, and cross-only strains ──
  // Quiz results should be broadly applicable strains users can find at dispensaries.
  function isQuizEligible(strain) {
    // Exclude partial-data strains — they lack verified lab data
    if (strain.dataCompleteness === 'partial') return false

    const name = (strain.name || '').trim();
    const lower = name.toLowerCase();

    // Exclude explicit crosses: "Strain A x Strain B" or "Strain A × Strain B"
    if (/\s+x\s+/i.test(name) || name.includes('×')) return false;

    // Exclude breeder-tagged strains: "Cherry Crush - World Breeders"
    if (/\s+-\s+\w/.test(name)) return false;

    // Exclude AUTO/Auto prefix strains (autoflower breeder products)
    if (/^auto\s/i.test(name)) return false;

    // Exclude strains with seed/breeder product terms
    if (/\b(autoflower|seeds?\s+(female|regular|feminized)|reg\s+\d+pk|cannabis seeds)\b/i.test(name)) return false;

    // Exclude very long names (likely product descriptions, not strain names)
    if (name.length > 35) return false;

    // Exclude breeder mix/box/set products
    if (/\b(mix\s*\d|gift\s*set|box\s*set|best\s*sellers|beginner)/i.test(name)) return false;

    // Exclude strains with "Blimburn", "Extraction", "Fast Version", "F1", "Fast Flowering"
    if (/\b(blimburn|extraction|fast\s*version|fast\s*flowering)\b/i.test(name)) return false;

    // Exclude "Reg" pack suffixes
    if (/\breg\b/i.test(name) && /\d+pk/i.test(name)) return false;

    // Exclude numbered generation/pheno markers that indicate breeder-specific cuts
    // But allow common ones like "Gelato #33", "GG4", "AK-47"
    if (/\b(f\d+|s\d+|bx\d+)\b/i.test(name) && !/^(ak|gg|og)/i.test(name)) return false;

    // Exclude strains with "Club" prefix (seed bank product lines)
    if (/^club\s/i.test(name)) return false;

    // Exclude "Don " prefix (seed bank)
    if (/^don\s/i.test(name)) return false;

    // Exclude "Research " prefix
    if (/^research\s/i.test(name)) return false;

    // Must have at least some effect data to be useful in quiz
    if (!strain.effects || strain.effects.length === 0) return false;

    return true;
  }
  const eligibleStrains = strainData.strains.filter(isQuizEligible);

  // ═══════════════════════════════════════════════════════════════════
  // Tri-pillar scoring engine — 40% Science · 30% Community · 30% Commonness
  // ═══════════════════════════════════════════════════════════════════
  // Pillar 1 – SCIENCE (40%): receptor pharmacology, scaffold molecular
  //   profiles, tolerance safety, avoidance penalties, cannabinoid match,
  //   user preference alignment, entourage synergy (7 sub-layers).
  // Pillar 2 – COMMUNITY (30%): weighted community effect-report alignment
  //   — how strongly real users report the effects the quiz-taker wants.
  // Pillar 3 – COMMONNESS (30%): how well-known / dispensary-available
  //   the strain is, derived from total report volume + sentiment score.
  // ═══════════════════════════════════════════════════════════════════
  const toleranceId = quiz.tolerance || 'intermediate';
  const scored = eligibleStrains.map(strain => {
    // ── Compute individual layer scores (each 0-100) ──────────────
    const pathway    = calcPathwayScore(strain, desiredReceptors, desiredCanonicals);
    const effect     = calcEffectReportScore(strain, desiredCanonicals);
    const avoid      = calcAvoidScore(strain, avoidCanonicals);
    const cannabinoid = calcCannabinoidScore(strain, quiz.thcPreference || 'no_preference', quiz.cbdPreference || 'no_preference');
    const preference = calcPreferenceScore(strain, quiz);
    const synergy    = calcGoalSynergyScore(strain, desiredCanonicals);
    const scaffold   = calcScaffoldScore(strain, desiredCanonicals);
    const tolerance  = calcToleranceScore(strain, toleranceId);

    // ── Pillar 1: SCIENCE (7 pharmacology sub-layers) ─────────────
    // Template strains (synthetic terpene data) shift weight away from
    // terpene-dependent layers toward safety / avoidance / preferences.
    // Sub-weights always sum to 1.00 so the science pillar is 0-100.
    const isTemplate = hasTemplateTerpenes(strain);
    //                              Real   Template
    const pw = isTemplate ? 0.21 : 0.31;  // receptor pharmacology
    const sw = isTemplate ? 0.17 : 0.23;  // scaffold molecular profile
    const tw = isTemplate ? 0.19 : 0.15;  // tolerance safety
    const aw = isTemplate ? 0.17 : 0.13;  // avoidance penalty
    const cw = isTemplate ? 0.08 : 0.06;  // cannabinoid match
    const rw = isTemplate ? 0.09 : 0.06;  // user preference alignment
    const yw = isTemplate ? 0.09 : 0.06;  // entourage synergy
    const scienceScore = Math.max(0, Math.min(100,
      pathway   * pw +
      scaffold  * sw +
      tolerance * tw +
      avoid     * aw +
      cannabinoid * cw +
      preference * rw +
      synergy   * yw
    ));

    // ── Pillar 2: COMMUNITY (effect report alignment) ─────────────
    // Already 0-100 from calcEffectReportScore.
    const communityScore = effect;

    // ── Pillar 3: COMMONNESS (popularity + sentiment) ─────────────
    // totalReports range: ~261-561 (median 416), sentimentScore: 8.4-9.5
    const totalReports = (strain.effects || []).reduce((sum, e) => sum + (e.reports || 0), 0);
    const sentiment = strain.sentimentScore || 8.5;
    const reportNorm = Math.min(1, Math.max(0, (totalReports - 260) / 300));
    const sentNorm   = Math.min(1, Math.max(0, (sentiment - 8.4) / 1.1));
    // Commonness sub-blend: 70% report volume + 30% sentiment quality
    const commonnessRaw = reportNorm * 0.7 + sentNorm * 0.3;  // 0-1
    const commonnessScore = commonnessRaw * 100;               // 0-100

    // ── Final blended score: 40% science · 30% community · 30% commonness
    const score = Math.max(0, Math.min(100, Math.round(
      scienceScore    * 0.40 +
      communityScore  * 0.30 +
      commonnessScore * 0.30
    )));

    return { strain, score, scienceScore, communityScore, commonnessScore };
  });

  // Sort all results by the unified blended score
  scored.sort((a, b) => b.score - a.score || b.scienceScore - a.scienceScore);

  const finalRanked = scored;

  // Build top 5 results
  const mainResults = finalRanked.slice(0, 5).map(s => buildStrainResult(s.strain, s.score, desiredCanonicals));

  // AI picks: 2 from positions 6-15 with type diversity
  const mainTypes = new Set(mainResults.map(r => r.type));
  const aiPickCandidates = finalRanked.slice(5, 15);
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

  // Build ideal profile — scaffold-derived molecular targets + actual top-5 averages
  const topTerpTotals = {};
  let thcTotal = 0, cbdTotal = 0;
  for (const s of finalRanked.slice(0, 5)) {
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

  // Add scaffold-derived ideal rationale
  const scaffoldIdeal = {};
  for (const effect of desiredCanonicals.slice(0, 3)) {
    const scaffold = EFFECT_SCAFFOLD[effect];
    if (!scaffold) continue;
    for (const [mol, spec] of Object.entries(scaffold.optimalMolecules)) {
      if (!scaffoldIdeal[mol] || spec.ideal > scaffoldIdeal[mol].ideal) {
        scaffoldIdeal[mol] = { ideal: spec.ideal, role: spec.role.split(' — ')[0] };
      }
    }
  }
  const scaffoldTerps = Object.entries(scaffoldIdeal)
    .filter(([mol]) => !['thc', 'cbd', 'cbn', 'cbg', 'thcv', 'cbc'].includes(mol))
    .sort((a, b) => b[1].ideal - a[1].ideal)
    .slice(0, 5)
    .map(([name, info]) => ({ name, idealPct: `${info.ideal}%`, role: info.role }));

  const idealProfile = {
    terpenes: avgTerps,
    scaffoldTargets: scaffoldTerps,
    cannabinoids: { thc: `${Math.round(thcTotal / 5)}%`, cbd: `${(cbdTotal / 5).toFixed(1)}%` },
    subtype: quiz.subtype || 'hybrid',
  };

  const responseData = {
    strains: mainResults,
    aiPicks: aiPicks.slice(0, 2),
    idealProfile,
  }

  // ── Workers AI Analysis (free Llama 3.3 70B) ─────────────────────
  // Generate a personalized AI analysis explaining WHY these strains match
  // the user's quiz answers from a pharmacological perspective.
  if (env?.AI) {
    try {
      const desiredLabels = desiredCanonicals.map(e => canonicalToDisplay(e)).slice(0, 6);
      const avoidLabels = avoidCanonicals.map(e => canonicalToDisplay(e)).slice(0, 4);

      const topStrainSummaries = mainResults.slice(0, 3).map(s => {
        const terps = s.terpenes.slice(0, 3).map(t => `${t.name} (${t.pct})`).join(', ');
        const effects = s.effects.filter(e => e.category === 'positive' || e.category === 'medical').slice(0, 4).map(e => e.name).join(', ');
        return `${s.name} (${s.type}, ${s.matchPct}% match, THC ${s.thc}%, CBD ${s.cbd}%): terpenes [${terps}], effects [${effects}]`;
      }).join('\n');

      // Build scaffold context for the AI
      const scaffoldContext = desiredCanonicals.slice(0, 3).map(effect => {
        const s = EFFECT_SCAFFOLD[effect];
        if (!s) return null;
        const topMols = Object.entries(s.optimalMolecules)
          .sort((a, b) => b[1].weight - a[1].weight)
          .slice(0, 3)
          .map(([mol, spec]) => `${mol} (${spec.role.split(' — ')[0]})`)
          .join(', ');
        const topRecs = Object.entries(s.receptors)
          .sort((a, b) => b[1].weight - a[1].weight)
          .slice(0, 2)
          .map(([rec, spec]) => `${rec} (${spec.note})`)
          .join(', ');
        return `${effect}: needs ${topRecs}; best molecules: ${topMols}`;
      }).filter(Boolean).join('\n');

      const toleranceLabel = toleranceId === 'beginner' ? 'beginner (THC ≤18% recommended)'
        : toleranceId === 'intermediate' ? 'intermediate (THC 14-22% optimal)'
        : toleranceId === 'experienced' ? 'experienced (THC 18-26% suitable)'
        : 'high tolerance (any THC level appropriate)';

      const aiPrompt = `You are a cannabis pharmacology analyst for an AI recommendation app. A user took a quiz and our tri-pillar scoring engine ranked strains using three pillars: 40% Science (receptor binding, entourage synergy, terpene-to-effect pathways, tolerance safety), 30% Community (real user effect reports weighted by strength), and 30% Commonness (popularity and dispensary availability). Write a brief, personalized analysis (3-4 sentences max) explaining why the top match scored highest across all three pillars.

User's desired effects: ${desiredLabels.join(', ')}
${avoidLabels.length ? `Effects to avoid: ${avoidLabels.join(', ')}` : ''}
Experience level: ${toleranceLabel}
THC preference: ${quiz.thcPreference || 'no preference'}
CBD preference: ${quiz.cbdPreference || 'no preference'}
Type preference: ${quiz.subtype || 'no preference'}

PHARMACOLOGICAL FRAMEWORK (what our engine targeted):
${scaffoldContext}

Top matches from our algorithm:
${topStrainSummaries}

Write a concise analysis explaining WHY ${mainResults[0]?.name || 'the top strain'} is the best match for this user. Reference specific terpenes and their receptor targets (CB1, CB2, 5-HT1A, TRPV1, GABA-A), how the terpene-cannabinoid entourage effect creates the desired experience, and note that community reports and strain popularity reinforce the science. Be scientifically grounded but accessible. Do NOT make medical claims. Speak directly to the user using "you" and "your". Start directly with the analysis — no greeting or preamble.`;

      const aiResult = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role: 'system', content: 'You are a cannabis science expert. Be concise, scientific, and never make medical claims.' },
          { role: 'user', content: aiPrompt },
        ],
        max_tokens: 250,
      });

      if (aiResult?.response) {
        responseData.aiAnalysis = aiResult.response;
      }
    } catch (aiErr) {
      // AI is optional — algorithmic results still return fine
      console.error('Workers AI analysis error (non-fatal):', aiErr.message);
    }
  }

  // Store in KV cache (1h TTL — deterministic engine + AI analysis)
  if (env?.CACHE) {
    env.CACHE.put(quizCacheKey, JSON.stringify(responseData), { expirationTtl: 3600 })
      .catch(() => {}) // fire-and-forget
  }

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'X-Cache': 'MISS' },
  });
}
