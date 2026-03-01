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

  // ── Normalize cannabinoids: add colors, extract top-level THC/CBD ──
  if (Array.isArray(s.cannabinoids)) {
    s.cannabinoids = s.cannabinoids.map(c => ({
      ...c,
      name: (c.name || '').toUpperCase(),
      color: c.color || CANNABINOID_COLORS[(c.name || '').toLowerCase()] || '#6b7280',
    }))
    if (s.thc == null) {
      const thcEntry = s.cannabinoids.find(c => c.name === 'THC')
      if (thcEntry) s.thc = thcEntry.value
    }
    if (s.cbd == null) {
      const cbdEntry = s.cannabinoids.find(c => c.name === 'CBD')
      if (cbdEntry) s.cbd = cbdEntry.value
    }
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

  // Derive forumAnalysis from effects categories
  // NOTE: `reports` in strains.json is a raw count (14-110), NOT a percentage.
  // We normalize to a 0-100 scale relative to the highest-reported effect.
  if (!s.forumAnalysis && effects.length > 0) {
    const maxReports = Math.max(...effects.map(e => e.reports || 0), 1)
    const toPct = (r) => Math.round(((r || 0) / maxReports) * 100)

    const positive = effects
      .filter(e => e.category === 'positive')
      .map(e => ({ effect: effectStr(e), canonical: effectStr(e).toLowerCase(), pct: toPct(e.reports), baseline: null }))
    const negative = effects
      .filter(e => e.category === 'negative')
      .map(e => ({ effect: effectStr(e), canonical: effectStr(e).toLowerCase(), pct: toPct(e.reports), baseline: null }))
    const medical = effects
      .filter(e => e.category === 'medical')
      .map(e => ({ effect: effectStr(e), canonical: effectStr(e).toLowerCase(), pct: toPct(e.reports), baseline: null }))

    const totalReports = effects.reduce((sum, e) => sum + (e.reports || 0), 0)
    const posCount = effects.filter(e => e.category === 'positive' || e.category === 'medical').length
    const totalCount = effects.length

    s.forumAnalysis = {
      pros: [...positive, ...medical],
      cons: negative,
      totalReviews: totalReports,
      sourceCount: totalCount,
    }

    // Derive sentiment score (1-10 scale based on positive/total effect ratio)
    if (s.sentimentScore == null && totalCount > 0) {
      const ratio = posCount / totalCount
      s.sentimentScore = Math.round(ratio * 10 * 10) / 10 // e.g. 8.3
    }

    // Derive review count
    if (s.reviewCount == null) {
      s.reviewCount = totalReports
    }
  }

  // Derive effectPredictions from effects — use normalized report counts as probability
  // (confidence is always 0.9-1.0, making bars useless; reports vary 14-110)
  if (!s.effectPredictions && effects.length > 0) {
    const maxRep = Math.max(...effects.map(e => e.reports || 0), 1)
    s.effectPredictions = effects
      .filter(e => e.reports != null)
      .sort((a, b) => (b.reports || 0) - (a.reports || 0))
      .slice(0, 8)
      .map(e => ({
        effect: effectStr(e),
        probability: (e.reports || 0) / maxRep,  // 0-1 scale, normalized to max
        pathway: e.category === 'medical' ? 'Therapeutic' : e.category === 'positive' ? 'Recreational' : 'Side effect',
      }))
  }

  return s
}
