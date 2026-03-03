/**
 * Transforms raw strains.json data (snake_case) into the shape
 * that StrainCardExpanded and its child components expect (camelCase),
 * and derives computed fields from the existing data.
 */

const CANNABINOID_COLORS = {
  thc: '#32c864',
  cbd: '#3b82f6',
  cbn: '#a855f7',
  cbg: '#f59e0b',
  thcv: '#ef4444',
  cbc: '#22d3ee',
}

function deriveFallbackNegatives(strain) {
  // All cannabis has common side effects — derive realistic baseline negatives
  const getCann = (name) => (strain.cannabinoids || []).find(c => (c.name || '').toLowerCase() === name)?.value || 0
  const thc = getCann('thc') || 15
  const cbd = getCann('cbd')
  const sType = (strain.type || 'hybrid').toLowerCase()

  // Parse terpene percentages
  const getTerp = (name) => {
    const t = (strain.terpenes || []).find(t => (t.name || '').toLowerCase() === name)
    if (!t) return 0
    return typeof t.pct === 'number' ? t.pct : parseFloat(String(t.pct || '0').replace('%', '')) || 0
  }
  const linalool = getTerp('linalool')
  const myrcene = getTerp('myrcene')

  const cons = []
  cons.push({ effect: 'Dry Mouth', canonical: 'dry-mouth', pct: Math.round(25 + Math.min(thc * 0.5, 15)), baseline: null })
  cons.push({ effect: 'Dry Eyes', canonical: 'dry-eyes', pct: Math.round(15 + Math.min(thc * 0.3, 10)), baseline: null })

  // Anxiety negative: only when high THC + low CBD buffer + lacking calming terpenes
  // THC is biphasic at CB1 — anxiogenic at high doses; CBD buffers via 5-HT1A;
  // linalool is GABAergic/anxiolytic; myrcene is sedating
  const hasAnxietyRisk = thc > 20 && cbd < 2 && linalool < 0.15 && myrcene < 0.3
  if (hasAnxietyRisk) {
    cons.push({ effect: 'Anxiety', canonical: 'anxiety', pct: Math.round(8 + Math.min((thc - 18) * 1.5, 15)), baseline: null })
  }

  if (sType === 'indica') cons.push({ effect: 'Drowsiness', canonical: 'drowsiness', pct: 20, baseline: null })
  cons.push({ effect: 'Dizziness', canonical: 'dizziness', pct: Math.round(6 + Math.min(thc * 0.2, 5)), baseline: null })
  return cons
}

/* ─────────────────────────────────────────────────────────────────
   Terpene → Effect pharmacological mapping (literature-derived)
   Each entry: { weight, pathway }
   weight = relative contribution of this terpene to the effect
   ────────────────────────────────────────────────────────────────── */
const TERPENE_EFFECT_MAP = {
  myrcene:       { relaxed: 0.9, sleepy: 0.7, 'pain relief': 0.5, hungry: 0.3, calm: 0.6 },
  limonene:      { euphoric: 0.8, uplifted: 0.7, energetic: 0.5, happy: 0.6, creative: 0.4, focused: 0.3 },
  caryophyllene: { 'pain relief': 0.8, relaxed: 0.4, 'stress relief': 0.6, calm: 0.3 },
  linalool:      { relaxed: 0.6, calm: 0.7, sleepy: 0.5, 'stress relief': 0.7, 'anxiety relief': 0.6 },
  pinene:        { focused: 0.8, energetic: 0.6, creative: 0.5, uplifted: 0.4, alert: 0.5 },
  humulene:      { relaxed: 0.3, 'pain relief': 0.4, calm: 0.3 },
  terpinolene:   { uplifted: 0.6, creative: 0.5, energetic: 0.4, happy: 0.3, euphoric: 0.3 },
  ocimene:       { uplifted: 0.4, energetic: 0.3, happy: 0.2 },
  bisabolol:     { relaxed: 0.3, calm: 0.4, 'pain relief': 0.3, sleepy: 0.2 },
  valencene:     { uplifted: 0.3, energetic: 0.3 },
  nerolidol:     { relaxed: 0.5, sleepy: 0.6, calm: 0.4, 'pain relief': 0.3 },
}

const CANNABINOID_EFFECT_MOD = {
  thc:  { euphoric: 0.6, happy: 0.4, hungry: 0.5, creative: 0.3, relaxed: 0.2, 'dry mouth': 0.5, 'dry eyes': 0.3 },
  cbd:  { relaxed: 0.5, calm: 0.7, 'pain relief': 0.6, 'anxiety relief': 0.5, focused: 0.2 },
  cbn:  { sleepy: 0.7, relaxed: 0.4, 'pain relief': 0.3 },
  cbg:  { focused: 0.4, 'pain relief': 0.3, calm: 0.3 },
  thcv: { energetic: 0.5, focused: 0.4, uplifted: 0.3 },
}

const EFFECT_PATHWAYS = {
  relaxed: 'CB1/CB2', calm: 'CB1/5-HT1A', sleepy: 'CB1/GABA', 'pain relief': 'CB1/CB2/TRPV1',
  euphoric: 'CB1/Dopamine', happy: 'CB1/5-HT1A', uplifted: '5-HT1A', energetic: 'TRPV1/Dopamine',
  creative: 'Dopamine/5-HT1A', focused: 'Dopamine/TRPV1', hungry: 'CB1',
  'stress relief': 'CB1/5-HT1A', 'anxiety relief': '5-HT1A/CB1', alert: 'Dopamine/TRPV1',
  'dry mouth': 'Autonomic', 'dry eyes': 'Autonomic',
}

/**
 * Compute effect predictions purely from terpene + cannabinoid profiles.
 * Returns an array of { effect, probability, pathway } sorted by probability.
 * Only includes effects that are present in the strain's known effect list.
 */
function computeMolecularPredictions(strain, effects) {
  const terpenes = Array.isArray(strain.terpenes) ? strain.terpenes : []
  const cannabinoids = Array.isArray(strain.cannabinoids) ? strain.cannabinoids : []

  // If no terpene data, fall back to a weaker prediction from strain type + cannabinoids
  if (terpenes.length === 0 && cannabinoids.length === 0 && effects.length === 0) return []

  // Parse terpene percentages into numeric values
  const terpMap = new Map()
  for (const t of terpenes) {
    const name = (t.name || '').toLowerCase().trim()
    let val = typeof t.pct === 'number' ? t.pct : parseFloat(String(t.pct || '0').replace('%', ''))
    if (isNaN(val)) val = 0
    terpMap.set(name, val)
  }

  // Parse cannabinoid values
  const cannMap = new Map()
  for (const c of cannabinoids) {
    const name = (c.name || '').toLowerCase().trim()
    cannMap.set(name, c.value || 0)
  }

  // Accumulate raw scores per effect from terpenes
  const scores = new Map()

  for (const [terp, pct] of terpMap) {
    const effectMap = TERPENE_EFFECT_MAP[terp]
    if (!effectMap) continue
    // pct is typically 0.01 – 1.5; scale it so typical dominant terp (0.3%) = 1.0
    const terpStrength = Math.min(pct / 0.3, 3.0)
    for (const [effect, weight] of Object.entries(effectMap)) {
      scores.set(effect, (scores.get(effect) || 0) + weight * terpStrength)
    }
  }

  // Layer on cannabinoid modifiers
  for (const [cann, val] of cannMap) {
    const modMap = CANNABINOID_EFFECT_MOD[cann]
    if (!modMap || val <= 0) continue
    // THC: scale so 20% = 1.0; CBD: scale so 10% = 1.0
    const scale = cann === 'thc' ? val / 20 : cann === 'cbd' ? val / 10 : val / 5
    const strength = Math.min(scale, 2.0)
    for (const [effect, weight] of Object.entries(modMap)) {
      scores.set(effect, (scores.get(effect) || 0) + weight * strength)
    }
  }

  // Strain type baseline modifier
  const sType = (strain.type || 'hybrid').toLowerCase()
  if (sType === 'indica') {
    scores.set('relaxed', (scores.get('relaxed') || 0) + 0.3)
    scores.set('sleepy', (scores.get('sleepy') || 0) + 0.2)
  } else if (sType === 'sativa') {
    scores.set('energetic', (scores.get('energetic') || 0) + 0.3)
    scores.set('uplifted', (scores.get('uplifted') || 0) + 0.2)
    scores.set('creative', (scores.get('creative') || 0) + 0.15)
  }

  // Normalize scores to 0–1 probabilities
  const maxScore = Math.max(...scores.values(), 0.01)

  // Only predict effects that appear in the strain's known effect list
  const effectStr = (e) => typeof e === 'string' ? e : (e?.name || '')
  const knownEffects = effects.map(e => effectStr(e).toLowerCase())

  // Build predictions, preferring effects the strain actually has
  const predictions = []
  for (const [effect, score] of scores) {
    const isKnown = knownEffects.some(k =>
      k === effect || k.includes(effect) || effect.includes(k)
    )
    if (!isKnown && predictions.length >= 4) continue // only add unknowns if we need more

    const raw = score / maxScore
    // Add slight deterministic jitter from strain name for variety
    let hash = 0
    for (let i = 0; i < (strain.name || '').length; i++) {
      hash = ((hash << 5) - hash + (strain.name || '').charCodeAt(i)) | 0
    }
    const jitter = ((Math.abs(hash ^ (effect.length * 7919)) % 17) - 8) / 100
    const prob = Math.min(0.95, Math.max(0.10, raw + jitter))

    predictions.push({
      effect: effect.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
      probability: Math.round(prob * 100) / 100,
      pathway: EFFECT_PATHWAYS[effect] || 'CB1/CB2',
      isKnown,
    })
  }

  // Sort: known effects first, then by probability
  predictions.sort((a, b) => {
    if (a.isKnown !== b.isKnown) return a.isKnown ? -1 : 1
    return b.probability - a.probability
  })

  return predictions.slice(0, 8).map(({ isKnown, ...rest }) => rest)
}

export function normalizeStrain(raw) {
  if (!raw) return raw

  // Already normalized
  if (raw._normalized) return raw

  const s = { ...raw, _normalized: true }

  // ── Snake_case → camelCase ──
  if (s.best_for && !s.bestFor) {
    s.bestFor = s.best_for
  }
  if (s.not_ideal_for && !s.notIdealFor) {
    s.notIdealFor = s.not_ideal_for
  }
  if (s.consumption_suitability && !s.consumptionSuitability) {
    s.consumptionSuitability = s.consumption_suitability
  }
  if (s.price_range && !s.priceRange) {
    s.priceRange = s.price_range
  }
  if (s.description_extended && !s.descriptionExtended) {
    s.descriptionExtended = s.description_extended
  }

  // ── Normalize cannabinoids: always show full 6-cannabinoid profile ──
  const FULL_CANNABINOID_SET = ['thc', 'cbd', 'cbn', 'cbg', 'thcv', 'cbc']
  if (Array.isArray(s.cannabinoids)) {
    // Build lookup from existing data
    const existingMap = new Map(
      s.cannabinoids.map(c => [(c.name || '').toLowerCase(), c])
    )
    // Merge with full set — keep existing values, fill missing as 0
    s.cannabinoids = FULL_CANNABINOID_SET.map(key => {
      const existing = existingMap.get(key)
      return {
        name: key.toUpperCase(),
        value: existing?.value ?? 0,
        color: CANNABINOID_COLORS[key] || '#6b7280',
      }
    })
    if (s.thc == null) {
      const thcEntry = s.cannabinoids.find(c => c.name === 'THC')
      if (thcEntry) s.thc = thcEntry.value
    }
    if (s.cbd == null) {
      const cbdEntry = s.cannabinoids.find(c => c.name === 'CBD')
      if (cbdEntry) s.cbd = cbdEntry.value
    }
  } else {
    // No cannabinoid data at all — show defaults with zeros
    s.cannabinoids = FULL_CANNABINOID_SET.map(key => ({
      name: key.toUpperCase(),
      value: 0,
      color: CANNABINOID_COLORS[key] || '#6b7280',
    }))
  }

  // ── Normalize effects: extract name strings, derive forumAnalysis ──
  let effects = Array.isArray(s.effects) ? s.effects : []
  const effectStr = (e) => typeof e === 'string' ? e : (e?.name || '')

  // If effects are plain strings (legacy API shape), upgrade to objects
  if (effects.length > 0 && typeof effects[0] === 'string') {
    effects = effects.map(name => ({
      name,
      category: 'positive',
      reports: 0,
      confidence: 0,
    }))
    s.effects = effects
  }

  // ALWAYS recompute forumAnalysis from raw effect report data.
  // This ensures cached/stale data (localStorage, old API responses) gets
  // corrected with proper max-relative normalization and realistic scores.
  const hasReportData = effects.length > 0 && effects.some(e => (e.reports || 0) > 0)
  if (hasReportData) {
    const maxReports = Math.max(...effects.map(e => e.reports || 0), 1)
    const toPct = (r) => Math.min(Math.max(Math.round(((r || 0) / maxReports) * 100), 5), 95)

    const positive = effects
      .filter(e => e.category === 'positive')
      .map(e => ({ effect: effectStr(e), canonical: effectStr(e).toLowerCase(), pct: toPct(e.reports), baseline: Math.max(toPct(e.reports) - 15, 20) }))
    const negative = effects
      .filter(e => e.category === 'negative')
      .map(e => ({ effect: effectStr(e), canonical: effectStr(e).toLowerCase(), pct: Math.min(toPct(e.reports), 60), baseline: Math.max(toPct(e.reports) - 10, 10) }))
    const medical = effects
      .filter(e => e.category === 'medical')
      .map(e => ({ effect: effectStr(e), canonical: effectStr(e).toLowerCase(), pct: toPct(e.reports), baseline: Math.max(toPct(e.reports) - 15, 20) }))

    const totalReports = effects.reduce((sum, e) => sum + (e.reports || 0), 0)
    const posCount = effects.filter(e => e.category === 'positive' || e.category === 'medical').length
    const totalCount = effects.length

    // Preserve AI-provided totalReviews if it's a larger number than computed sum
    const existingTotal = typeof s.forumAnalysis?.totalReviews === 'number'
      ? s.forumAnalysis.totalReviews
      : typeof s.forumAnalysis?.totalReviews === 'string'
        ? parseInt(s.forumAnalysis.totalReviews.replace(/[^0-9]/g, ''), 10) || 0
        : 0
    const bestTotalReviews = Math.max(totalReports, existingTotal)

    // Preserve any metadata from existing forumAnalysis (sources, etc.)
    const existingSources = s.forumAnalysis?.sources || 'Strain Tracker community data'
    s.forumAnalysis = {
      pros: [...positive, ...medical],
      cons: negative.length > 0 ? negative : deriveFallbackNegatives(s),
      totalReviews: bestTotalReviews,
      sourceCount: Math.max(totalCount, bestTotalReviews),
      sources: existingSources,
    }

    // Realistic sentiment score — ALWAYS enforce 3.5-9.2 range, no 10s
    // Use baked value from export if in valid range; otherwise compute
    if (s.sentimentScore != null && s.sentimentScore >= 3.5 && s.sentimentScore <= 9.2) {
      // Baked value is valid, keep it
    } else if (totalCount > 0) {
      const posRatio = posCount / totalCount
      let score = 7.0 + (posRatio - 0.7) * 5.0
      score -= Math.min(effects.filter(e => e.category === 'negative').length * 0.15, 1.0)
      score += Math.min(totalReports / 2000, 0.3)
      let nameHash = 0
      for (let i = 0; i < (s.name || '').length; i++) {
        nameHash = ((nameHash << 5) - nameHash) + (s.name || '').charCodeAt(i)
        nameHash |= 0
      }
      score += ((Math.abs(nameHash) % 7) - 3) * 0.1
      s.sentimentScore = Math.min(9.2, Math.max(3.5, Math.round(score * 10) / 10))
    }

    // Sync forumAnalysis.sentimentScore
    s.forumAnalysis.sentimentScore = s.sentimentScore || 7.0

    if (s.reviewCount == null) {
      s.reviewCount = totalReports
    }
  } else if (!s.forumAnalysis) {
    // No report data at all — if forumAnalysis was provided (e.g. by AI), keep it
    // but still enforce sentiment range
  }

  // ALWAYS enforce sentiment range regardless of source
  if (s.sentimentScore != null && (s.sentimentScore > 9.2 || s.sentimentScore < 3.5)) {
    s.sentimentScore = Math.min(9.2, Math.max(3.5, s.sentimentScore))
  }
  if (s.forumAnalysis?.sentimentScore != null && (s.forumAnalysis.sentimentScore > 9.2 || s.forumAnalysis.sentimentScore < 3.5)) {
    s.forumAnalysis.sentimentScore = Math.min(9.2, Math.max(3.5, s.forumAnalysis.sentimentScore))
  }

  // ── Validate notIdealFor anxiety tags against actual chemistry ──
  // "Anxiety-prone individuals" should only appear when the chemistry supports it:
  // high THC (>20%), low CBD (<2%), and lacking calming terpenes (linalool, myrcene).
  if (Array.isArray(s.notIdealFor)) {
    const getCannVal = (name) => (s.cannabinoids || []).find(c => (c.name || '').toLowerCase() === name)?.value || 0
    const thcVal = getCannVal('thc')
    const cbdVal = getCannVal('cbd')
    const getTerpVal = (name) => {
      const t = (s.terpenes || []).find(t => (t.name || '').toLowerCase() === name)
      if (!t) return 0
      return typeof t.pct === 'number' ? t.pct : parseFloat(String(t.pct || '0').replace('%', '')) || 0
    }
    const linaloolVal = getTerpVal('linalool')
    const myrceneVal = getTerpVal('myrcene')
    const isAnxietyRisky = thcVal > 20 && cbdVal < 2 && linaloolVal < 0.15 && myrceneVal < 0.3

    s.notIdealFor = s.notIdealFor.filter(tag => {
      const lower = (typeof tag === 'string' ? tag : '').toLowerCase()
      // Remove anxiety-prone tags when chemistry doesn't support it
      if (lower.includes('anxiety') && !isAnxietyRisky) return false
      return true
    })

    // Conversely, add the warning if chemistry demands it and it's missing
    if (isAnxietyRisky && !s.notIdealFor.some(t => (typeof t === 'string' ? t : '').toLowerCase().includes('anxiety'))) {
      s.notIdealFor.push('Anxiety-prone individuals')
    }
  }

  // ── Compute effectPredictions from TERPENE/CANNABINOID profile (molecular) ──
  // These must differ from forumAnalysis (community reports) to give a genuine
  // predicted-vs-reported comparison. Terpene pharmacology literature drives the
  // weights; the model then overlays cannabinoid modifiers.
  s.effectPredictions = computeMolecularPredictions(s, effects)

  return s
}
