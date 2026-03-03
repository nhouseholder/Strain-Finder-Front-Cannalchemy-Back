/**
 * Pharmacological Scaffold — v1.0
 *
 * A science-driven framework that maps user goals to molecular requirements
 * through receptor pharmacology. This knowledge graph drives the matching
 * engine's scoring, ensuring recommendations are grounded in actual
 * cannabis pharmacology rather than keyword co-occurrence.
 *
 * Each effect goal maps to:
 *   1. Primary receptor targets (what needs to be activated/modulated)
 *   2. Optimal molecular profile (which terpenes & cannabinoids deliver that)
 *   3. Synergy pairs (terpene combinations that amplify the effect)
 *   4. Contraindications (what to avoid for this goal)
 *   5. Dosage sensitivity (how tolerance level modifies recommendations)
 *
 * Literature sources: Russo (2011) entourage effect, Ferber et al. (2020)
 * terpene pharmacology, Laprairie et al. (2015) CBD allosteric modulation,
 * Blessing et al. (2015) CBD anxiolytic, Pamplona et al. (2012) terpene-
 * cannabinoid synergy.
 */

// ============================================================
// EFFECT → RECEPTOR → MOLECULE FRAMEWORK
// ============================================================
export const EFFECT_SCAFFOLD = {
  // ── Relaxation / Sedation Cluster ──────────────────────────
  relaxed: {
    receptors: {
      CB1:     { weight: 0.3, action: 'agonism', note: 'Central amygdala inhibition' },
      'GABA-A':{ weight: 0.3, action: 'potentiation', note: 'Anxiolytic/sedative' },
      '5-HT1A':{ weight: 0.2, action: 'agonism', note: 'Serotonergic calming' },
      CB2:     { weight: 0.1, action: 'agonism', note: 'Peripheral anti-inflammatory' },
      TRPV1:   { weight: 0.1, action: 'desensitization', note: 'Pain gate closure' },
    },
    optimalMolecules: {
      myrcene:       { min: 0.25, ideal: 0.40, weight: 0.30, role: 'Primary sedative terpene — potentiates GABA-A, enhances BBB permeability' },
      linalool:      { min: 0.08, ideal: 0.20, weight: 0.25, role: 'GABAergic anxiolytic — acts synergistically with myrcene' },
      caryophyllene: { min: 0.10, ideal: 0.25, weight: 0.20, role: 'CB2 selective agonist — anti-inflammatory without psychoactive load' },
      thc:           { min: 10,   ideal: 18,   weight: 0.15, role: 'CB1 partial agonist — low-moderate dose for relaxation without anxiety' },
      cbd:           { min: 0,    ideal: 5,    weight: 0.10, role: 'CB1 negative allosteric modulator — smooths THC curve' },
    },
    synergies: ['myrcene+linalool', 'myrcene+caryophyllene', 'linalool+caryophyllene'],
    contraindicated: { pinene: 'May counteract sedation via AChE inhibition', terpinolene: 'Variable — can be stimulating in some chemotypes' },
    subtypeAffinity: { indica: 1.2, hybrid: 1.0, sativa: 0.7 },
  },

  sleepy: {
    receptors: {
      'GABA-A':  { weight: 0.35, action: 'potentiation', note: 'Sleep onset — slow-wave promotion' },
      CB1:       { weight: 0.25, action: 'agonism', note: 'Adenosine signaling enhancement' },
      adenosine: { weight: 0.20, action: 'accumulation', note: 'Sleep pressure increase' },
      '5-HT1A':  { weight: 0.10, action: 'agonism', note: 'REM regulation' },
      TRPV1:     { weight: 0.10, action: 'desensitization', note: 'Pain-free sleep onset' },
    },
    optimalMolecules: {
      myrcene:  { min: 0.30, ideal: 0.50, weight: 0.30, role: 'Strongest sedative terpene — GABA-A potentiation + increased BBB permeability' },
      linalool: { min: 0.10, ideal: 0.25, weight: 0.25, role: 'Anxiolytic sedation — reduces latency to sleep onset' },
      cbn:      { min: 0,    ideal: 2.0,  weight: 0.20, role: 'Mild CB1/CB2 agonist — strongest sleep-specific cannabinoid' },
      thc:      { min: 10,   ideal: 20,   weight: 0.15, role: 'Reduces REM sleep latency at moderate doses' },
      cbd:      { min: 0,    ideal: 5,    weight: 0.10, role: 'Reduces anxiety that prevents sleep onset' },
    },
    synergies: ['myrcene+linalool', 'myrcene+caryophyllene'],
    contraindicated: { pinene: 'Alertness promotion counteracts sedation', limonene: 'Mood elevation may delay sleep', terpinolene: 'Stimulating in many profiles' },
    subtypeAffinity: { indica: 1.3, hybrid: 0.9, sativa: 0.5 },
  },

  // ── Anxiety Relief / Calm ─────────────────────────────────
  calm: {
    receptors: {
      '5-HT1A':  { weight: 0.35, action: 'agonism', note: 'Primary anxiolytic receptor' },
      'GABA-A':  { weight: 0.25, action: 'potentiation', note: 'Reduces neural excitability' },
      CB1:       { weight: 0.20, action: 'low-dose agonism', note: 'Biphasic — anxiolytic at low dose' },
      CB2:       { weight: 0.10, action: 'agonism', note: 'Anti-neuroinflammatory' },
      PPARgamma: { weight: 0.10, action: 'agonism', note: 'Neuroprotective calming' },
    },
    optimalMolecules: {
      linalool:      { min: 0.10, ideal: 0.25, weight: 0.30, role: 'Direct GABA-A/5-HT1A anxiolytic — strongest anxiolytic terpene' },
      cbd:           { min: 3,    ideal: 10,   weight: 0.25, role: '5-HT1A agonist at Ki=16nM — powerful anxiolytic without psychoactivity' },
      myrcene:       { min: 0.15, ideal: 0.35, weight: 0.20, role: 'Sedative buffer — reduces hyperarousal' },
      caryophyllene: { min: 0.10, ideal: 0.25, weight: 0.15, role: 'CB2 agonist — anti-inflammatory anxiety reduction' },
      thc:           { min: 0,    ideal: 12,   weight: 0.10, role: 'LOW dose only — biphasic, anxiogenic above ~15mg' },
    },
    synergies: ['linalool+limonene', 'linalool+myrcene', 'cbd+linalool'],
    contraindicated: {},
    subtypeAffinity: { indica: 1.1, hybrid: 1.0, sativa: 0.8 },
    thcCaution: true, // Flag: high THC is counterproductive for this goal
  },

  // ── Energy / Stimulation Cluster ──────────────────────────
  energetic: {
    receptors: {
      TRPV1:         { weight: 0.25, action: 'agonism', note: 'Peripheral stimulation' },
      CB1:           { weight: 0.20, action: 'moderate agonism', note: 'Cortical activation' },
      norepinephrine:{ weight: 0.25, action: 'release', note: 'Arousal and alertness' },
      dopamine:      { weight: 0.20, action: 'release', note: 'Motivation and drive' },
      AChE:          { weight: 0.10, action: 'inhibition', note: 'Acetylcholine preservation' },
    },
    optimalMolecules: {
      limonene:    { min: 0.15, ideal: 0.40, weight: 0.30, role: 'Mood elevation + norepinephrine modulation — primary energizing terpene' },
      pinene:      { min: 0.10, ideal: 0.25, weight: 0.25, role: 'AChE inhibitor — alertness and memory preservation, counteracts THC fog' },
      terpinolene: { min: 0.05, ideal: 0.15, weight: 0.20, role: 'Uplifting anxiolytic — bridges energy and calm' },
      thcv:        { min: 0,    ideal: 2.0,  weight: 0.15, role: 'CB1 antagonist at low dose — clear-headed, appetite suppression' },
      thc:         { min: 12,   ideal: 20,   weight: 0.10, role: 'Moderate THC for activation without sedation' },
    },
    synergies: ['pinene+limonene', 'terpinolene+ocimene', 'limonene+caryophyllene'],
    contraindicated: { myrcene: 'Heavy sedation at high concentrations', linalool: 'May counteract energizing effects' },
    subtypeAffinity: { indica: 0.5, hybrid: 0.9, sativa: 1.3 },
  },

  // ── Creativity / Divergent Thinking ───────────────────────
  creative: {
    receptors: {
      dopamine:  { weight: 0.30, action: 'D2 release', note: 'Divergent thinking via mesolimbic pathway' },
      CB1:       { weight: 0.25, action: 'moderate agonism', note: 'Frontal lobe disinhibition' },
      '5-HT1A':  { weight: 0.20, action: 'agonism', note: 'Default mode network modulation' },
      AChE:      { weight: 0.15, action: 'inhibition', note: 'Memory preservation during creative flow' },
      TRPV1:     { weight: 0.10, action: 'agonism', note: 'Sensory enhancement' },
    },
    optimalMolecules: {
      limonene:    { min: 0.10, ideal: 0.35, weight: 0.25, role: 'Serotonergic mood elevation — opens creative flow' },
      pinene:      { min: 0.08, ideal: 0.20, weight: 0.25, role: 'AChE inhibition — preserves working memory during ideation' },
      terpinolene: { min: 0.05, ideal: 0.15, weight: 0.20, role: 'Unique uplifting-yet-calming balance for creative states' },
      thc:         { min: 12,   ideal: 18,   weight: 0.20, role: 'Moderate THC for associative loosening without confusion' },
      cbd:         { min: 0,    ideal: 3,    weight: 0.10, role: 'Anxiety buffer — prevents creative block from THC anxiety' },
    },
    synergies: ['limonene+pinene', 'terpinolene+limonene', 'pinene+caryophyllene'],
    contraindicated: { myrcene: 'Excessive sedation dulls creative energy at high doses' },
    subtypeAffinity: { indica: 0.6, hybrid: 1.0, sativa: 1.3 },
  },

  // ── Focus / Concentration ─────────────────────────────────
  focused: {
    receptors: {
      dopamine: { weight: 0.30, action: 'D1 release', note: 'Prefrontal executive function' },
      AChE:     { weight: 0.25, action: 'inhibition', note: 'Acetylcholine preservation — sustained attention' },
      CB1:      { weight: 0.20, action: 'low agonism', note: 'Subtle cognitive enhancement' },
      TRPV1:    { weight: 0.15, action: 'agonism', note: 'Alertness maintenance' },
      '5-HT1A': { weight: 0.10, action: 'agonism', note: 'Anxiety reduction enabling focus' },
    },
    optimalMolecules: {
      pinene:      { min: 0.12, ideal: 0.25, weight: 0.35, role: 'PRIMARY focus terpene — AChE inhibitor preserves acetylcholine for attention' },
      limonene:    { min: 0.08, ideal: 0.20, weight: 0.20, role: 'Mood stabilizer — prevents distraction from negative affect' },
      thcv:        { min: 0,    ideal: 2.0,  weight: 0.20, role: 'Low-dose CB1 antagonist — clear-headed focus without fog' },
      thc:         { min: 8,    ideal: 15,   weight: 0.15, role: 'Low-moderate THC — enough activation, not enough to impair' },
      caryophyllene:{ min: 0.08, ideal: 0.20, weight: 0.10, role: 'Anti-inflammatory — reduces neuroinflammation that impairs cognition' },
    },
    synergies: ['pinene+limonene', 'pinene+caryophyllene'],
    contraindicated: { myrcene: 'Sedation impairs sustained attention', linalool: 'Relaxation may reduce drive' },
    subtypeAffinity: { indica: 0.4, hybrid: 0.9, sativa: 1.3 },
    thcCaution: true,
  },

  // ── Euphoria / Mood Elevation ─────────────────────────────
  euphoric: {
    receptors: {
      CB1:      { weight: 0.30, action: 'agonism', note: 'Mesolimbic dopamine release' },
      dopamine: { weight: 0.30, action: 'D2 release', note: 'Nucleus accumbens pleasure pathway' },
      '5-HT1A': { weight: 0.20, action: 'agonism', note: 'Serotonergic mood elevation' },
      TRPV1:    { weight: 0.10, action: 'agonism', note: 'Sensory pleasure amplification' },
      CB2:      { weight: 0.10, action: 'agonism', note: 'Peripheral comfort' },
    },
    optimalMolecules: {
      limonene:      { min: 0.10, ideal: 0.35, weight: 0.25, role: 'Mood elevation via 5-HT1A — enhances CB1-mediated euphoria' },
      thc:           { min: 15,   ideal: 22,   weight: 0.25, role: 'Primary euphoric driver via CB1 → dopamine release' },
      terpinolene:   { min: 0.05, ideal: 0.15, weight: 0.20, role: 'Complex uplifting profile — bridges euphoria and creativity' },
      caryophyllene: { min: 0.08, ideal: 0.20, weight: 0.15, role: 'CB2 agonist — baseline comfort that supports euphoria' },
      ocimene:       { min: 0,    ideal: 0.10, weight: 0.15, role: 'Sweet, uplifting terpene — energizing euphoria' },
    },
    synergies: ['limonene+terpinolene', 'limonene+caryophyllene', 'terpinolene+ocimene'],
    contraindicated: {},
    subtypeAffinity: { indica: 0.8, hybrid: 1.0, sativa: 1.2 },
  },

  // ── Pain Relief ───────────────────────────────────────────
  pain: {
    receptors: {
      CB1:       { weight: 0.25, action: 'agonism', note: 'Central pain modulation' },
      CB2:       { weight: 0.25, action: 'agonism', note: 'Peripheral anti-inflammatory analgesia' },
      TRPV1:     { weight: 0.20, action: 'desensitization', note: 'Pain gate closure via vanilloid channel' },
      'mu-opioid':{ weight: 0.15, action: 'modulation', note: 'Endogenous opioid enhancement' },
      PPARgamma: { weight: 0.15, action: 'agonism', note: 'NF-kB inhibition — reduces pain sensitization' },
    },
    optimalMolecules: {
      caryophyllene: { min: 0.15, ideal: 0.35, weight: 0.30, role: 'STAR molecule for pain — selective CB2 agonist (Ki=155nM) without psychoactivity' },
      myrcene:       { min: 0.15, ideal: 0.35, weight: 0.25, role: 'Analgesic via TRPV1 + opioidergic enhancement + BBB permeability' },
      thc:           { min: 15,   ideal: 22,   weight: 0.20, role: 'CB1/CB2 dual agonist — central + peripheral pain modulation' },
      cbd:           { min: 2,    ideal: 10,   weight: 0.15, role: 'TRPV1 agonist + PPARgamma — anti-inflammatory analgesia' },
      linalool:      { min: 0.05, ideal: 0.15, weight: 0.10, role: 'GABAergic — reduces pain perception through anxiolysis' },
    },
    synergies: ['caryophyllene+myrcene', 'caryophyllene+humulene', 'myrcene+linalool'],
    contraindicated: {},
    subtypeAffinity: { indica: 1.2, hybrid: 1.0, sativa: 0.7 },
  },

  // ── Social / Talkative ────────────────────────────────────
  social: {
    receptors: {
      dopamine: { weight: 0.30, action: 'release', note: 'Social reward and verbal fluency' },
      CB1:      { weight: 0.25, action: 'moderate agonism', note: 'Amygdala suppression — reduces social anxiety' },
      '5-HT1A': { weight: 0.20, action: 'agonism', note: 'Serotonergic confidence boost' },
      'GABA-A': { weight: 0.15, action: 'potentiation', note: 'Social disinhibition' },
      TRPV1:    { weight: 0.10, action: 'agonism', note: 'Sensory engagement' },
    },
    optimalMolecules: {
      limonene:    { min: 0.10, ideal: 0.30, weight: 0.30, role: 'Mood elevation + anxiety reduction = social confidence' },
      terpinolene: { min: 0.05, ideal: 0.15, weight: 0.20, role: 'Unique uplifting quality — promotes talkativeness' },
      pinene:      { min: 0.05, ideal: 0.15, weight: 0.20, role: 'Mental clarity — keeps conversation coherent' },
      thc:         { min: 12,   ideal: 18,   weight: 0.20, role: 'Moderate dose — social lubrication without paranoia' },
      caryophyllene:{ min: 0.05, ideal: 0.15, weight: 0.10, role: 'Anti-anxiety baseline via CB2' },
    },
    synergies: ['limonene+terpinolene', 'pinene+limonene', 'limonene+caryophyllene'],
    contraindicated: { myrcene: 'Excessive sedation kills social energy at high doses' },
    subtypeAffinity: { indica: 0.5, hybrid: 1.0, sativa: 1.3 },
    thcCaution: true, // Too much THC → paranoia in social settings
  },

  // ── Appetite Stimulation ──────────────────────────────────
  hungry: {
    receptors: {
      CB1:          { weight: 0.40, action: 'agonism', note: 'Hypothalamic appetite center activation' },
      ghrelin:      { weight: 0.25, action: 'release', note: 'Hunger hormone stimulation' },
      hypothalamic: { weight: 0.20, action: 'activation', note: 'Feeding circuit promotion' },
      dopamine:     { weight: 0.15, action: 'release', note: 'Food reward amplification' },
    },
    optimalMolecules: {
      thc:      { min: 15, ideal: 22, weight: 0.35, role: 'PRIMARY appetite driver — CB1 agonism in hypothalamic feeding circuits' },
      myrcene:  { min: 0.15, ideal: 0.30, weight: 0.25, role: 'Enhances THC absorption → amplifies CB1 appetite effects' },
      limonene: { min: 0.05, ideal: 0.15, weight: 0.15, role: 'Mood-based appetite enhancement' },
      humulene: { min: 0, ideal: 0, weight: 0.05, role: 'AVOID — appetite suppressant (anorectic)' },
      cbg:      { min: 0, ideal: 1.0, weight: 0.20, role: 'Emerging research suggests appetite stimulation via CB1/CB2' },
    },
    synergies: ['myrcene+limonene'],
    contraindicated: { humulene: 'Appetite suppressant — directly counterproductive', thcv: 'Appetite suppressant at low doses' },
    subtypeAffinity: { indica: 1.2, hybrid: 1.0, sativa: 0.8 },
  },

  // ── Stress Relief ─────────────────────────────────────────
  stress: {
    receptors: {
      '5-HT1A':  { weight: 0.30, action: 'agonism', note: 'HPA axis suppression' },
      CB1:       { weight: 0.25, action: 'agonism', note: 'Amygdala fear response dampening' },
      'GABA-A':  { weight: 0.20, action: 'potentiation', note: 'Neural calm' },
      CB2:       { weight: 0.15, action: 'agonism', note: 'Anti-neuroinflammatory stress resilience' },
      PPARgamma: { weight: 0.10, action: 'agonism', note: 'Cortisol modulation' },
    },
    optimalMolecules: {
      linalool:      { min: 0.08, ideal: 0.20, weight: 0.25, role: 'Direct 5-HT1A modulation + GABAergic calming' },
      limonene:      { min: 0.08, ideal: 0.25, weight: 0.25, role: '5-HT1A agonist — mood elevation that counteracts stress' },
      caryophyllene: { min: 0.10, ideal: 0.25, weight: 0.20, role: 'CB2 agonist — anti-inflammatory stress buffer' },
      cbd:           { min: 2, ideal: 8, weight: 0.15, role: '5-HT1A agonist at Ki=16nM — potent anxiolytic' },
      myrcene:       { min: 0.10, ideal: 0.25, weight: 0.15, role: 'Sedative support — physical tension release' },
    },
    synergies: ['limonene+linalool', 'caryophyllene+humulene', 'linalool+myrcene'],
    contraindicated: {},
    subtypeAffinity: { indica: 1.1, hybrid: 1.0, sativa: 0.9 },
  },

  // ── Inflammation / Anti-inflammatory ──────────────────────
  inflammation: {
    receptors: {
      CB2:       { weight: 0.35, action: 'agonism', note: 'Immune cell modulation, cytokine suppression' },
      PPARgamma: { weight: 0.25, action: 'agonism', note: 'NF-kB pathway inhibition' },
      TRPV1:     { weight: 0.20, action: 'desensitization', note: 'Peripheral anti-inflammatory' },
      CB1:       { weight: 0.10, action: 'agonism', note: 'Central anti-inflammatory' },
      GPR55:     { weight: 0.10, action: 'antagonism', note: 'Anti-inflammatory by reducing pro-inflammatory signaling' },
    },
    optimalMolecules: {
      caryophyllene: { min: 0.15, ideal: 0.40, weight: 0.35, role: 'ONLY terpene with proven CB2 selectivity (Ki=155nM) — gold standard for inflammation' },
      humulene:      { min: 0.05, ideal: 0.15, weight: 0.20, role: 'Synergistic with caryophyllene — complementary anti-inflammatory' },
      cbd:           { min: 5, ideal: 15, weight: 0.25, role: 'PPARgamma agonist + TRPV1 → broad anti-inflammatory' },
      thc:           { min: 5, ideal: 15, weight: 0.10, role: 'CB1/CB2 dual agonist — additive anti-inflammatory' },
      myrcene:       { min: 0.10, ideal: 0.25, weight: 0.10, role: 'Mild analgesic/anti-inflammatory via TRPV1' },
    },
    synergies: ['caryophyllene+humulene', 'caryophyllene+myrcene', 'cbd+caryophyllene'],
    contraindicated: {},
    subtypeAffinity: { indica: 1.1, hybrid: 1.0, sativa: 0.8 },
  },
};

// ============================================================
// EXPANDED RECEPTOR BINDING DATA
// ============================================================
// Literature-derived Ki values and pharmacological actions for
// terpenes and cannabinoids not in the base dataset.
// Sources: PubChem, Russo 2011, Ferber et al 2020, Gertsch 2008
export const EXPANDED_BINDINGS = [
  // ── Pinene ──
  { molecule_name: 'pinene', receptor: 'AChE',    ki_nm: 5000,  action_type: 'inhibitor',  receptor_function: 'Memory preservation via acetylcholine retention' },
  { molecule_name: 'pinene', receptor: 'TRPV1',   ki_nm: 12000, action_type: 'modulator',  receptor_function: 'Mild bronchodilation and alertness' },
  { molecule_name: 'pinene', receptor: 'CB2',     ki_nm: 25000, action_type: 'weak agonist', receptor_function: 'Mild anti-inflammatory' },

  // ── Humulene ──
  { molecule_name: 'humulene', receptor: 'CB2',     ki_nm: 500,   action_type: 'partial agonist', receptor_function: 'Anti-inflammatory synergy with caryophyllene' },
  { molecule_name: 'humulene', receptor: 'PPARgamma', ki_nm: 8000, action_type: 'modulator',  receptor_function: 'Appetite suppression and anti-inflammatory' },

  // ── Terpinolene ──
  { molecule_name: 'terpinolene', receptor: '5-HT1A', ki_nm: 18000, action_type: 'modulator', receptor_function: 'Mild anxiolytic mood elevation' },
  { molecule_name: 'terpinolene', receptor: 'TRPV1',  ki_nm: 20000, action_type: 'weak agonist', receptor_function: 'Subtle energizing stimulation' },

  // ── Ocimene ──
  { molecule_name: 'ocimene', receptor: 'CB2',    ki_nm: 30000, action_type: 'weak modulator', receptor_function: 'Mild anti-inflammatory' },
  { molecule_name: 'ocimene', receptor: 'TRPV1',  ki_nm: 25000, action_type: 'weak agonist', receptor_function: 'Subtle energizing' },

  // ── Bisabolol ──
  { molecule_name: 'bisabolol', receptor: 'TRPV1', ki_nm: 10000, action_type: 'desensitizer', receptor_function: 'Anti-irritation and gentle pain relief' },
  { molecule_name: 'bisabolol', receptor: '5-HT1A', ki_nm: 15000, action_type: 'modulator', receptor_function: 'Mild anxiolytic' },

  // ── Nerolidol ──
  { molecule_name: 'nerolidol', receptor: 'GABA-A', ki_nm: 8000, action_type: 'potentiator', receptor_function: 'Sedative — skin permeation enhancer increases bioavailability' },
  { molecule_name: 'nerolidol', receptor: 'CB1',   ki_nm: 20000, action_type: 'weak modulator', receptor_function: 'Mild psychoactive modulation' },

  // ── Valencene ──
  { molecule_name: 'valencene', receptor: 'CB2',   ki_nm: 15000, action_type: 'weak agonist', receptor_function: 'Mild anti-inflammatory and anti-allergic' },

  // ── Geraniol ──
  { molecule_name: 'geraniol', receptor: 'TRPV1',  ki_nm: 800,   action_type: 'agonist', receptor_function: 'Nociceptive modulation — peripheral analgesia' },
  { molecule_name: 'geraniol', receptor: '5-HT1A', ki_nm: 10000, action_type: 'modulator', receptor_function: 'Neuroprotective antioxidant' },

  // ── CBC (Cannabichromene) ──
  { molecule_name: 'cbc', receptor: 'TRPV1', ki_nm: 900,  action_type: 'agonist', receptor_function: 'Pain modulation via vanilloid channel' },
  { molecule_name: 'cbc', receptor: 'CB2',   ki_nm: 2800, action_type: 'weak agonist', receptor_function: 'Mild anti-inflammatory' },

  // ── THCV ──
  { molecule_name: 'thcv', receptor: 'CB1',  ki_nm: 75,   action_type: 'antagonist (low dose) / agonist (high dose)', receptor_function: 'Dose-dependent — focus at low dose, intoxication at high' },
  { molecule_name: 'thcv', receptor: 'CB2',  ki_nm: 63,   action_type: 'partial agonist', receptor_function: 'Anti-inflammatory' },
  { molecule_name: 'thcv', receptor: 'GPR55', ki_nm: 110, action_type: 'agonist', receptor_function: 'Metabolic regulation' },
];

// ============================================================
// TOLERANCE-BASED THC SAFETY RANGES
// ============================================================
// Maps experience level to safe/optimal THC operating range.
// The engine will penalize strains outside these ranges.
export const TOLERANCE_THC_RANGES = {
  beginner:     { safe: [0, 18],  optimal: [8, 15],  penalty_per_pct: 5.0, hard_cap: 20  },
  intermediate: { safe: [0, 25],  optimal: [14, 22], penalty_per_pct: 2.5, hard_cap: 28  },
  experienced:  { safe: [0, 30],  optimal: [18, 26], penalty_per_pct: 1.0, hard_cap: 35  },
  high:         { safe: [0, 40],  optimal: [22, 35], penalty_per_pct: 0.0, hard_cap: 40  },
};

// ============================================================
// TERPENE DATA QUALITY DETECTION
// ============================================================
// Template profiles that indicate the strain lacks real terpene analysis.
// Strains with these profiles get a data-quality penalty in pathway scoring.
export const TEMPLATE_TERPENE_PROFILES = [
  'caryophyllene:0.25%,myrcene:0.18%,limonene:0.12%,humulene:0.08%,linalool:0.06%,pinene:0.04%',
  'caryophyllene:0.3%,myrcene:0.2%,limonene:0.15%,humulene:0.08%,linalool:0.06%,pinene:0.04%',
  'myrcene:0.4%,linalool:0.2%,caryophyllene:0.15%,limonene:0.1%,humulene:0.06%,pinene:0.03%',
  'limonene:0.35%,pinene:0.25%,terpinolene:0.15%,caryophyllene:0.15%,myrcene:0.11%,linalool:0.05%',
];

// ============================================================
// ENTOURAGE SYNERGY MATRIX (expanded)
// ============================================================
export const SYNERGY_MATRIX = {
  // Sedation synergies
  'myrcene+linalool':       { bonus: 0.18, mechanism: 'Dual GABAergic — profound sedation', goals: ['sleepy', 'relaxed', 'pain'] },
  'myrcene+caryophyllene':  { bonus: 0.15, mechanism: 'CB2 anti-inflammatory + sedation', goals: ['pain', 'relaxed', 'inflammation'] },

  // Anxiolytic synergies
  'linalool+limonene':      { bonus: 0.18, mechanism: 'GABA + 5-HT1A dual anxiolysis', goals: ['calm', 'stress', 'social'] },
  'linalool+cbd':           { bonus: 0.15, mechanism: '5-HT1A convergence — potent anxiolytic', goals: ['calm', 'stress'] },

  // Focus/alertness synergies
  'pinene+limonene':        { bonus: 0.15, mechanism: 'AChE inhibition + mood elevation = productive focus', goals: ['focused', 'creative', 'energetic'] },
  'pinene+caryophyllene':   { bonus: 0.10, mechanism: 'Clarity + anti-inflammatory = sustained cognition', goals: ['focused', 'creative'] },

  // Energy synergies
  'terpinolene+ocimene':    { bonus: 0.12, mechanism: 'Complementary uplifting pathways', goals: ['energetic', 'euphoric', 'social'] },
  'limonene+terpinolene':   { bonus: 0.12, mechanism: 'Serotonergic lift + complex uplift', goals: ['euphoric', 'creative', 'social'] },

  // Anti-inflammatory synergies
  'caryophyllene+humulene': { bonus: 0.15, mechanism: 'CB2 + PPARgamma dual anti-inflammatory', goals: ['inflammation', 'pain'] },

  // Pain synergies
  'caryophyllene+cbd':      { bonus: 0.12, mechanism: 'CB2 + PPARgamma/TRPV1 broad analgesia', goals: ['pain', 'inflammation'] },
  'myrcene+cbd':            { bonus: 0.10, mechanism: 'TRPV1 + enhanced bioavailability', goals: ['pain', 'relaxed'] },

  // Stress relief synergies
  'limonene+caryophyllene': { bonus: 0.12, mechanism: '5-HT1A mood + CB2 anti-inflammatory resilience', goals: ['stress', 'calm'] },
};

export default {
  EFFECT_SCAFFOLD,
  EXPANDED_BINDINGS,
  TOLERANCE_THC_RANGES,
  TEMPLATE_TERPENE_PROFILES,
  SYNERGY_MATRIX,
};
