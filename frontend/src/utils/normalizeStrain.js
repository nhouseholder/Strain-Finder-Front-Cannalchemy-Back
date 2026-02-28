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
  const effects = Array.isArray(s.effects) ? s.effects : []
  const effectStr = (e) => typeof e === 'string' ? e : (e?.name || '')

  // Derive forumAnalysis from effects categories
  if (!s.forumAnalysis && effects.length > 0) {
    const positive = effects
      .filter(e => e.category === 'positive')
      .map(e => ({ effect: effectStr(e), pct: e.reports || 0, baseline: null }))
    const negative = effects
      .filter(e => e.category === 'negative')
      .map(e => ({ effect: effectStr(e), pct: e.reports || 0, baseline: null }))
    const medical = effects
      .filter(e => e.category === 'medical')
      .map(e => ({ effect: effectStr(e), pct: e.reports || 0, baseline: null }))

    const totalReports = effects.reduce((sum, e) => sum + (e.reports || 0), 0)
    const posReports = positive.reduce((sum, e) => sum + (e.pct || 0), 0)

    s.forumAnalysis = {
      pros: [...positive, ...medical],
      cons: negative,
      totalReviews: totalReports,
      sourceCount: effects.length,
    }

    // Derive sentiment score (1-10 scale based on positive/total ratio)
    if (s.sentimentScore == null && totalReports > 0) {
      const ratio = posReports / totalReports
      s.sentimentScore = Math.round(ratio * 10 * 10) / 10 // e.g. 8.3
    }

    // Derive review count
    if (s.reviewCount == null) {
      s.reviewCount = totalReports
    }
  }

  // Derive effectPredictions from effects with confidence
  if (!s.effectPredictions && effects.length > 0) {
    s.effectPredictions = effects
      .filter(e => e.confidence != null)
      .slice(0, 8)
      .map(e => ({
        effect: effectStr(e),
        probability: e.confidence || 0,
        pathway: e.category === 'medical' ? 'Therapeutic' : e.category === 'positive' ? 'Recreational' : 'Side effect',
      }))
  }

  return s
}
