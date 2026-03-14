/**
 * Cloudflare Pages Function — Strain Lookup by Name
 *
 * Searches the pre-exported strain database with exact + fuzzy matching.
 * Returns full strain data if found.
 *
 * GET /api/v1/strains/lookup/:name
 */
import strainData from '../../../../_data/strain-data.js'

// ── CORS ─────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

// ── Name normalization (mirrors cannalchemy/data/normalize.py) ──────
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Simple fuzzy matching ───────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  // Use single-row optimization for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let curr = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[n]
}

function similarityScore(a, b) {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 100
  return ((maxLen - levenshtein(a, b)) / maxLen) * 100
}

// ── Build lookup index ──────────────────────────────────────────────
let strainIndex = null
function getStrainIndex() {
  if (strainIndex) return strainIndex
  strainIndex = new Map()
  for (const strain of strainData.strains) {
    const norm = normalizeName(strain.name)
    strainIndex.set(norm, strain)
  }
  return strainIndex
}

// ── Handler ─────────────────────────────────────────────────────────
export async function onRequestGet(context) {
  const { params } = context
  const name = decodeURIComponent(params.name || '').trim()

  if (!name || name.length < 2) {
    return Response.json(
      { found: false, strain: null, enrichmentStatus: 'none', message: 'Name must be at least 2 characters' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const index = getStrainIndex()
  const normalized = normalizeName(name)

  // 1. Exact match
  const exact = index.get(normalized)
  if (exact) {
    return Response.json(
      { found: true, strain: exact, enrichmentStatus: 'complete', message: '' },
      { headers: corsHeaders() }
    )
  }

  // 2. Substring / startsWith match
  let substringMatch = null
  for (const [norm, strain] of index) {
    if (norm.startsWith(normalized) || normalized.startsWith(norm)) {
      substringMatch = strain
      break
    }
  }
  if (substringMatch) {
    return Response.json(
      { found: true, strain: substringMatch, enrichmentStatus: 'complete', message: `Showing results for '${substringMatch.name}'` },
      { headers: corsHeaders() }
    )
  }

  // 3. Fuzzy match (Levenshtein with 80% threshold)
  let bestMatch = null
  let bestScore = 0
  for (const [norm, strain] of index) {
    // Skip very different lengths (optimization)
    if (Math.abs(norm.length - normalized.length) > Math.max(norm.length, normalized.length) * 0.4) continue
    const score = similarityScore(normalized, norm)
    if (score > bestScore) {
      bestScore = score
      bestMatch = strain
    }
  }

  if (bestMatch && bestScore >= 80) {
    return Response.json(
      { found: true, strain: bestMatch, enrichmentStatus: 'complete', message: `Showing results for '${bestMatch.name}'` },
      { headers: corsHeaders() }
    )
  }

  return Response.json(
    { found: false, strain: null, enrichmentStatus: 'none', message: `Strain '${name}' not found in our database.` },
    { headers: corsHeaders() }
  )
}
