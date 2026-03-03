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
  const thc = (strain.cannabinoids || []).find(c => (c.name || '').toLowerCase() === 'thc')?.value || 15
  const sType = (strain.type || 'hybrid').toLowerCase()
  const cons = []
  cons.push({ effect: 'Dry Mouth', canonical: 'dry-mouth', pct: Math.round(25 + Math.min(thc * 0.5, 15)), baseline: null })
  cons.push({ effect: 'Dry Eyes', canonical: 'dry-eyes', pct: Math.round(15 + Math.min(thc * 0.3, 10)), baseline: null })
  if (thc > 18) cons.push({ effect: 'Anxiety', canonical: 'anxiety', pct: Math.round(8 + Math.min((thc - 18) * 1.5, 15)), baseline: null })
  if (sType === 'indica') cons.push({ effect: 'Drowsiness', canonical: 'drowsiness', pct: 20, baseline: null })
  cons.push({ effect: 'Dizziness', canonical: 'dizziness', pct: Math.round(6 + Math.min(thc * 0.2, 5)), baseline: null })
  return cons
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

    // Preserve any metadata from existing forumAnalysis (sources, etc.)
    const existingSources = s.forumAnalysis?.sources || 'Strain Tracker community data'
    s.forumAnalysis = {
      pros: [...positive, ...medical],
      cons: negative.length > 0 ? negative : deriveFallbackNegatives(s),
      totalReviews: totalReports,
      sourceCount: totalCount,
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

  // ALWAYS recompute effectPredictions from raw reports for consistency
  if (effects.length > 0 && effects.some(e => (e.reports || 0) > 0)) {
    const maxRep = Math.max(...effects.map(e => e.reports || 0), 1)
    s.effectPredictions = effects
      .filter(e => e.reports != null)
      .sort((a, b) => (b.reports || 0) - (a.reports || 0))
      .slice(0, 8)
      .map(e => ({
        effect: effectStr(e),
        probability: (e.reports || 0) / maxRep,
        pathway: e.category === 'medical' ? 'Therapeutic' : e.category === 'positive' ? 'Recreational' : 'Side effect',
      }))
  } else if (!s.effectPredictions && effects.length > 0) {
    s.effectPredictions = effects.slice(0, 8).map(e => ({
      effect: effectStr(e),
      probability: 0.5,
      pathway: 'Recreational',
    }))
  }

  return s
}
