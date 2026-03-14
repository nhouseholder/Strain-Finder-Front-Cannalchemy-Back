/**
 * Cloudflare Pages Function — Strain Request & Enrichment
 *
 * When a user searches for a strain not in our database:
 * 1. Check our local strain-data.js first (exact + fuzzy)
 * 2. If not found, query external APIs (Otreeba, Cannlytics) from the edge
 * 3. Build a strain card from whatever data we find
 * 4. Return it immediately to the user
 *
 * POST /api/v1/strains/request
 * Body: { "name": "Blue Dream" }
 */
import strainData from '../../../_data/strain-data.js'

// ── CORS ─────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

// ── Name normalization ──────────────────────────────────────────────
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
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

function findLocalStrain(name) {
  const index = getStrainIndex()
  const normalized = normalizeName(name)

  // Exact match
  const exact = index.get(normalized)
  if (exact) return { strain: exact, message: '' }

  // Substring match
  for (const [norm, strain] of index) {
    if (norm.startsWith(normalized) || normalized.startsWith(norm)) {
      return { strain, message: `Showing results for '${strain.name}'` }
    }
  }

  // Fuzzy match
  let bestMatch = null
  let bestScore = 0
  for (const [norm, strain] of index) {
    if (Math.abs(norm.length - normalized.length) > Math.max(norm.length, normalized.length) * 0.4) continue
    const score = similarityScore(normalized, norm)
    if (score > bestScore) {
      bestScore = score
      bestMatch = strain
    }
  }
  if (bestMatch && bestScore >= 80) {
    return { strain: bestMatch, message: `Did you mean '${bestMatch.name}'?` }
  }

  return null
}

// ── External API fetchers ───────────────────────────────────────────

const TERPENE_NAME_MAP = {
  'alpha-pinene': 'pinene', 'beta-pinene': 'pinene', 'a-pinene': 'pinene',
  'beta-myrcene': 'myrcene', 'b-myrcene': 'myrcene',
  'beta-caryophyllene': 'caryophyllene', 'b-caryophyllene': 'caryophyllene',
  'd-limonene': 'limonene',
  'alpha-humulene': 'humulene', 'a-humulene': 'humulene',
  'trans-nerolidol': 'nerolidol',
  'alpha-bisabolol': 'bisabolol', 'a-bisabolol': 'bisabolol',
  'alpha-terpinolene': 'terpinolene',
  'beta-ocimene': 'ocimene',
  'trans-ocimene': 'ocimene',
}

function mapTerpName(name) {
  const lower = name.toLowerCase().trim()
  return TERPENE_NAME_MAP[lower] || lower
}

/**
 * Try to fetch strain data from the Otreeba open API.
 */
async function fetchOtreeba(name) {
  try {
    const url = `https://api.otreeba.com/v1/strains?name=${encodeURIComponent(name)}&limit=3`
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return null

    const data = await resp.json()
    const strains = data?.data || data?.strains || []
    if (!Array.isArray(strains) || strains.length === 0) return null

    // Find best match
    const normalized = normalizeName(name)
    let best = strains[0]
    for (const s of strains) {
      if (normalizeName(s.name || '') === normalized) {
        best = s
        break
      }
    }

    return {
      name: best.name || name,
      type: (best.strain_type || best.type || 'hybrid').toLowerCase().replace('sativa/indica', 'hybrid'),
      description: best.description || '',
      genetics: best.genetics || best.lineage || '',
      effects: parseEffectList(best.effects),
      flavors: parseStringList(best.flavors || best.flavor),
      thc: parseFloat(best.thc) || null,
      cbd: parseFloat(best.cbd) || null,
    }
  } catch {
    return null
  }
}

/**
 * Try to fetch terpene/cannabinoid data from Cannlytics API.
 */
async function fetchCannlytics(name) {
  try {
    const url = `https://cannlytics.com/api/data/strains?name=${encodeURIComponent(name)}&limit=1`
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return null

    const data = await resp.json()
    const results = data?.data || []
    if (!Array.isArray(results) || results.length === 0) return null

    const s = results[0]
    const terpenes = []
    const cannabinoids = []

    // Terpene fields
    const terpFields = [
      'alpha_pinene', 'beta_pinene', 'beta_myrcene', 'limonene', 'd_limonene',
      'beta_caryophyllene', 'linalool', 'alpha_humulene', 'alpha_bisabolol',
      'terpinolene', 'ocimene', 'trans_ocimene', 'nerolidol', 'trans_nerolidol',
      'guaiol', 'camphene', 'eucalyptol', 'geraniol', 'valencene',
      'alpha_terpinene', 'gamma_terpinene', 'sabinene',
    ]
    for (const field of terpFields) {
      const val = parseFloat(s[field])
      if (val > 0) {
        const canonical = mapTerpName(field.replace(/_/g, '-'))
        // Merge duplicates (e.g. alpha-pinene + beta-pinene → pinene)
        const existing = terpenes.find(t => t.name === canonical)
        if (existing) {
          const existingVal = parseFloat(existing.pct) || 0
          existing.pct = `${(existingVal + val).toFixed(3)}%`
        } else {
          terpenes.push({ name: canonical, pct: `${val.toFixed(3)}%` })
        }
      }
    }

    // Cannabinoid fields
    const cannFields = { thc: 'THC', cbd: 'CBD', cbn: 'CBN', cbg: 'CBG', thcv: 'THCV', cbc: 'CBC' }
    for (const [field, display] of Object.entries(cannFields)) {
      const val = parseFloat(s[field] || s[`total_${field}`])
      if (val > 0) {
        cannabinoids.push({ name: display, value: Math.round(val * 10) / 10, color: CANNABINOID_COLORS[field] || '#999' })
      }
    }

    if (terpenes.length === 0 && cannabinoids.length === 0) return null
    return { terpenes, cannabinoids }
  } catch {
    return null
  }
}

const CANNABINOID_COLORS = {
  thc: '#32c864', cbd: '#3b82f6', cbn: '#a855f7',
  cbg: '#f59e0b', thcv: '#ef4444', cbc: '#22d3ee',
}

// ── Helpers ─────────────────────────────────────────────────────────

function parseEffectList(raw) {
  if (!raw) return []
  if (typeof raw === 'string') {
    return raw.split(',').map(e => e.trim()).filter(Boolean).map(e => ({
      name: e.toLowerCase(),
      category: 'positive',
      reports: 50,
      confidence: 0.6,
    }))
  }
  if (Array.isArray(raw)) {
    return raw.map(e => {
      if (typeof e === 'string') return { name: e.toLowerCase(), category: 'positive', reports: 50, confidence: 0.6 }
      return { name: (e.name || '').toLowerCase(), category: e.category || 'positive', reports: e.reports || 50, confidence: e.confidence || 0.6 }
    })
  }
  return []
}

function parseStringList(raw) {
  if (!raw) return []
  if (typeof raw === 'string') return raw.split(',').map(f => f.trim()).filter(Boolean)
  if (Array.isArray(raw)) return raw.map(f => typeof f === 'string' ? f : String(f)).filter(Boolean)
  return []
}

// Infer basic effects from strain type when we have no effect data
function inferEffectsFromType(type) {
  const t = (type || 'hybrid').toLowerCase()
  if (t === 'sativa') {
    return [
      { name: 'energetic', category: 'positive', reports: 30, confidence: 0.5 },
      { name: 'uplifted', category: 'positive', reports: 28, confidence: 0.5 },
      { name: 'creative', category: 'positive', reports: 25, confidence: 0.5 },
      { name: 'focused', category: 'positive', reports: 22, confidence: 0.4 },
      { name: 'happy', category: 'positive', reports: 20, confidence: 0.4 },
    ]
  }
  if (t === 'indica') {
    return [
      { name: 'relaxed', category: 'positive', reports: 30, confidence: 0.5 },
      { name: 'sleepy', category: 'positive', reports: 28, confidence: 0.5 },
      { name: 'happy', category: 'positive', reports: 25, confidence: 0.5 },
      { name: 'hungry', category: 'positive', reports: 22, confidence: 0.4 },
      { name: 'calm', category: 'positive', reports: 20, confidence: 0.4 },
    ]
  }
  // hybrid
  return [
    { name: 'relaxed', category: 'positive', reports: 28, confidence: 0.5 },
    { name: 'happy', category: 'positive', reports: 26, confidence: 0.5 },
    { name: 'euphoric', category: 'positive', reports: 24, confidence: 0.4 },
    { name: 'uplifted', category: 'positive', reports: 22, confidence: 0.4 },
    { name: 'creative', category: 'positive', reports: 20, confidence: 0.4 },
  ]
}

// Infer best_for from effects
function inferBestFor(effects) {
  const names = new Set(effects.map(e => e.name?.toLowerCase()))
  const bestFor = []
  if (names.has('relaxed') || names.has('calm')) bestFor.push('Evening relaxation')
  if (names.has('sleepy')) bestFor.push('Nighttime use')
  if (names.has('creative') || names.has('focused')) bestFor.push('Creative projects')
  if (names.has('energetic') || names.has('uplifted')) bestFor.push('Daytime use')
  if (names.has('happy') || names.has('euphoric')) bestFor.push('Social gatherings')
  if (names.has('pain') || names.has('pain relief')) bestFor.push('Pain management')
  return bestFor.slice(0, 3)
}

// ── Main handler ────────────────────────────────────────────────────
export async function onRequestPost(context) {
  let body
  try {
    body = await context.request.json()
  } catch {
    return Response.json(
      { found: false, strain: null, enrichmentStatus: 'none', message: 'Invalid request body' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const name = (body.name || '').trim()
  if (!name || name.length < 2) {
    return Response.json(
      { found: false, strain: null, enrichmentStatus: 'none', message: 'Strain name must be at least 2 characters' },
      { status: 400, headers: corsHeaders() }
    )
  }

  // 1. Check local database first
  const local = findLocalStrain(name)
  if (local) {
    return Response.json(
      { found: true, strain: local.strain, enrichmentStatus: 'complete', message: local.message },
      { headers: corsHeaders() }
    )
  }

  // 2. Not found locally — query external APIs in parallel
  const [otreebaResult, cannlyticsResult] = await Promise.all([
    fetchOtreeba(name),
    fetchCannlytics(name),
  ])

  if (!otreebaResult && !cannlyticsResult) {
    // Nothing found externally either — build minimal placeholder
    const minimalStrain = {
      id: `req-${Date.now()}`,
      name: name,
      type: 'hybrid',
      description: '',
      effects: inferEffectsFromType('hybrid'),
      terpenes: [],
      cannabinoids: [],
      dataCompleteness: 'search-only',
      genetics: '',
      best_for: [],
      not_ideal_for: [],
      flavors: [],
      availability: 1,
    }

    return Response.json(
      {
        found: true,
        strain: minimalStrain,
        enrichmentStatus: 'pending',
        message: `'${name}' wasn't found in external databases. We've created a minimal profile — data may be enriched later.`,
      },
      { headers: corsHeaders() }
    )
  }

  // 3. Build enriched strain from external data
  const strainType = otreebaResult?.type || 'hybrid'
  const effects = (otreebaResult?.effects?.length > 0)
    ? otreebaResult.effects
    : inferEffectsFromType(strainType)

  const terpenes = cannlyticsResult?.terpenes || []
  const cannabinoids = cannlyticsResult?.cannabinoids || []

  // Add THC/CBD from Otreeba if Cannlytics didn't have them
  if (otreebaResult?.thc && !cannabinoids.find(c => c.name === 'THC')) {
    cannabinoids.push({ name: 'THC', value: otreebaResult.thc, color: CANNABINOID_COLORS.thc })
  }
  if (otreebaResult?.cbd && !cannabinoids.find(c => c.name === 'CBD')) {
    cannabinoids.push({ name: 'CBD', value: otreebaResult.cbd, color: CANNABINOID_COLORS.cbd })
  }

  const flavors = otreebaResult?.flavors || []
  const description = otreebaResult?.description || ''

  const enrichedStrain = {
    id: `req-${Date.now()}`,
    name: otreebaResult?.name || name,
    type: strainType,
    description: description.slice(0, 160),
    effects,
    terpenes: terpenes.slice(0, 6),
    cannabinoids,
    dataCompleteness: terpenes.length > 0 ? 'partial' : 'search-only',
    genetics: otreebaResult?.genetics || '',
    description_extended: description.slice(0, 160),
    best_for: inferBestFor(effects).slice(0, 3),
    not_ideal_for: [],
    flavors: flavors.slice(0, 5),
    availability: 2,
  }

  const sources = []
  if (otreebaResult) sources.push('Otreeba')
  if (cannlyticsResult) sources.push('Cannlytics')

  return Response.json(
    {
      found: true,
      strain: enrichedStrain,
      enrichmentStatus: terpenes.length > 0 ? 'complete' : 'partial',
      message: `Found '${enrichedStrain.name}' from ${sources.join(' + ')}. ${terpenes.length > 0 ? 'Lab data available.' : 'Limited data — profile may be enriched later.'}`,
    },
    { headers: corsHeaders() }
  )
}
