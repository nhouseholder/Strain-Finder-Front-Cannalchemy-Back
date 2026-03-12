/**
 * dedup.mjs — Cross-source dispensary deduplication
 *
 * Merges dispensary lists from multiple sources (Weedmaps, Leafly, etc.)
 * into a single deduplicated list. Uses 3-tier matching:
 *   Tier 1: Exact normalized name + geo proximity (< 0.1 mi)
 *   Tier 2: Fuzzy name match + geo proximity (< 0.3 mi)
 *   Tier 3: Phone number match
 *
 * When duplicates are found, data is merged (menus combined, metadata enriched).
 */

/* ── Haversine distance (miles) ────────────────────────────────────── */

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3959 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/* ── Normalize name for comparison ─────────────────────────────────── */

function normalizeForDedup(name) {
  return (name || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\b(dispensary|cannabis|marijuana|weed|shop|store|boutique|collective|co-op|coop|inc|llc|ltd)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/* ── Find matching dispensary in existing list ─────────────────────── */

function findMatch(newDisp, existingList) {
  const newNorm = normalizeForDedup(newDisp.name)
  const newPhone = (newDisp.phone || '').replace(/\D/g, '')

  for (let i = 0; i < existingList.length; i++) {
    const existing = existingList[i]
    const existNorm = normalizeForDedup(existing.name)

    // Tier 1: Exact name + close proximity
    if (newNorm === existNorm && newDisp.lat && existing.lat) {
      const dist = haversineDistance(newDisp.lat, newDisp.lng, existing.lat, existing.lng)
      if (dist < 0.1) return i
    }

    // Tier 2: Fuzzy name + proximity
    if (newDisp.lat && existing.lat) {
      const dist = haversineDistance(newDisp.lat, newDisp.lng, existing.lat, existing.lng)
      if (dist < 0.3) {
        // Check if one name contains the other (after normalization)
        if (newNorm.includes(existNorm) || existNorm.includes(newNorm)) {
          return i
        }
        // Check Levenshtein similarity for short names
        if (newNorm.length > 5 && existNorm.length > 5) {
          const maxLen = Math.max(newNorm.length, existNorm.length)
          const similarity = 1 - (simpleLevenshtein(newNorm, existNorm) / maxLen)
          if (similarity >= 0.8) return i
        }
      }
    }

    // Tier 3: Phone number match
    if (newPhone && newPhone.length >= 10) {
      const existPhone = (existing.phone || '').replace(/\D/g, '')
      if (existPhone && existPhone === newPhone) return i
    }
  }

  return -1
}

/* ── Simple Levenshtein (for dedup, not strain matching) ───────────── */

function simpleLevenshtein(a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  return matrix[b.length][a.length]
}

/* ── Merge dispensary data (new source into existing) ──────────────── */

function mergeDispensary(existing, newDisp) {
  // Add source to sources array
  const sources = new Set(existing.sources || ['weedmaps'])
  for (const s of (newDisp.sources || [])) sources.add(s)
  existing.sources = [...sources]

  // Merge Leafly-specific fields
  if (newDisp.leaflyUrl) existing.leaflyUrl = newDisp.leaflyUrl
  if (newDisp.leaflySlug) existing.leaflySlug = newDisp.leaflySlug

  // Merge website if missing
  if (!existing.website && newDisp.website) existing.website = newDisp.website

  // Merge rating (keep highest)
  if (newDisp.rating && (!existing.rating || newDisp.rating > existing.rating)) {
    existing.rating = newDisp.rating
  }

  // Merge review count (sum)
  if (newDisp.reviewCount) {
    existing.reviewCount = (existing.reviewCount || 0) + newDisp.reviewCount
  }

  // Merge phone if missing
  if (!existing.phone && newDisp.phone) existing.phone = newDisp.phone

  // Merge lat/lng if missing (critical for map markers)
  if ((!existing.lat || !existing.lng) && newDisp.lat && newDisp.lng) {
    existing.lat = newDisp.lat
    existing.lng = newDisp.lng
  }

  // Merge menu data — combine matched menus, avoid duplicates by strain name
  if (newDisp.matchedMenu && newDisp.matchedMenu.length > 0) {
    const existingStrains = new Set(
      (existing.matchedMenu || []).map(m => m.strain?.slug || m.strain?.name)
    )
    for (const item of newDisp.matchedMenu) {
      const key = item.strain?.slug || item.strain?.name
      if (key && !existingStrains.has(key)) {
        existing.matchedMenu = existing.matchedMenu || []
        existing.matchedMenu.push(item)
        existingStrains.add(key)
      }
    }
  }

  // Update menuSummary
  if (existing.matchedMenu) {
    const matched = existing.matchedMenu.length
    existing.menuSummary = {
      ...existing.menuSummary,
      matched,
      hasMenu: matched > 0 || existing.menuSummary?.hasMenu,
      topMatches: existing.matchedMenu.slice(0, 5).map(m => m.strain?.name),
    }
  }

  return existing
}

/* ── Deduplicate dispensary lists from multiple sources ─────────────── */

export function deduplicateDispensaries(sourceLists) {
  const merged = []
  let dupeCount = 0

  for (const { source, dispensaries } of sourceLists) {
    for (const disp of dispensaries) {
      // Tag with source
      disp.sources = disp.sources || [source]

      const matchIdx = findMatch(disp, merged)
      if (matchIdx >= 0) {
        mergeDispensary(merged[matchIdx], disp)
        dupeCount++
      } else {
        merged.push({ ...disp })
      }
    }
  }

  console.log(`[Dedup] ${merged.length} unique dispensaries (${dupeCount} duplicates merged)`)
  return merged
}
