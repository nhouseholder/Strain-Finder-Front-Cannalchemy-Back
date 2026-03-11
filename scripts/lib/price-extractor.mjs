/**
 * price-extractor.mjs — Shared price extraction logic
 *
 * Handles 3 price strategies from Weedmaps and other sources:
 *   Strategy 1: v1 "prices" array — label matching for 3.5g/eighth
 *   Strategy 2: "variants" array — weight-based 3.5g detection
 *   Strategy 3: top-level price fallback
 *
 * Returns { display, eighthPrice } where display is "$XX" and
 * eighthPrice is the numeric value.
 */

/* ── Resolve numeric value from various formats ────────────────────── */

export function resolveNum(v) {
  if (v == null) return null
  if (typeof v === 'number') return v > 0 ? v : null
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[$,]/g, ''))
    return n > 0 ? n : null
  }
  if (typeof v === 'object' && v.amount != null) {
    const n = parseFloat(String(v.amount).replace(/[$,]/g, ''))
    return n > 0 ? n : null
  }
  return null
}

/* ── Extract price from a menu item ────────────────────────────────── */

export function extractPrice(menuItem) {
  const prices = Array.isArray(menuItem.prices) ? menuItem.prices : []
  const variants = Array.isArray(menuItem.variants) ? menuItem.variants : []

  let eighthPrice = null
  let display = null

  // Strategy 1: v1 "prices" array
  if (prices.length > 0) {
    for (const p of prices) {
      const label = (p.label || p.units || p.name || '').toLowerCase()
      const val = resolveNum(p.price ?? p.amount ?? p.value)
      if (val && (label.includes('eighth') || label.includes('1/8') || label.includes('3.5') || label.includes('⅛'))) {
        eighthPrice = val; break
      }
    }
    if (eighthPrice == null) {
      for (const p of prices) {
        const val = resolveNum(p.price ?? p.amount ?? p.value)
        if (val) { eighthPrice = val; break }
      }
    }
  }

  // Strategy 2: "variants" array
  if (eighthPrice == null && variants.length > 0) {
    for (const v of variants) {
      const w = v.weight || v.size || {}
      const wVal = parseFloat(w.value || w.amount || 0)
      const wUnit = (w.unit || '').toLowerCase()
      const amt = resolveNum(v.price ?? v.amount)
      if (amt && wVal >= 3.4 && wVal <= 3.6 && wUnit.startsWith('g')) { eighthPrice = amt; break }
    }
    if (eighthPrice == null) {
      for (const v of variants) {
        const amt = resolveNum(v.price ?? v.amount)
        if (amt) { eighthPrice = amt; break }
      }
    }
  }

  // Strategy 3: top-level price
  if (eighthPrice == null) {
    const topPrice = resolveNum(menuItem.price)
    if (topPrice) eighthPrice = topPrice
  }

  if (eighthPrice != null) display = `$${eighthPrice}`

  return { display, eighthPrice }
}
