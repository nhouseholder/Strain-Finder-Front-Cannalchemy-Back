/**
 * Dispensary search — Two-layer cache:
 *   1. localStorage (30 min, per-device)
 *   2. Netlify Blobs regional cache (24 hours, shared across ALL users)
 * Falls back to demo data when API is unavailable.
 */
import { callAnthropic, RateLimitError } from './anthropicApi'
import { buildDispensaryPrompt } from './promptBuilder'

const CACHE_PREFIX = 'dispensary_'
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes (local cache)

/* ------------------------------------------------------------------ */
/*  Region key helper — groups nearby zip codes                       */
/* ------------------------------------------------------------------ */
export function getRegionKey(location) {
  if (typeof location === 'string') {
    // If it's a 5-digit zip, use first 3 digits
    const zipMatch = location.match(/\b(\d{5})\b/)
    if (zipMatch) return zipMatch[1].slice(0, 3)
    // For city names, create a normalized key
    return location.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30)
  }
  if (location?.lat != null && location?.lng != null) {
    // Round to ~10km grid
    return `geo-${Math.round(location.lat * 10)}-${Math.round(location.lng * 10)}`
  }
  return null
}

/* ------------------------------------------------------------------ */
/*  Regional cache (Netlify Blobs via edge function)                  */
/* ------------------------------------------------------------------ */
async function checkRegionalCache(regionKey, strainNames) {
  try {
    const params = new URLSearchParams({
      action: 'check',
      region: regionKey,
      strains: (strainNames || []).slice(0, 10).join(','),
    })
    const res = await fetch(`/api/dispensary-cache?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.cached && data.dispensaries?.length > 0) {
      console.log(`[DispensaryCache] Regional HIT for "${regionKey}" (${data.hit_count} hits, ${data.age_hours}h old)`)
      return data.dispensaries
    }
    return null
  } catch (err) {
    console.warn('[DispensaryCache] Regional cache check failed:', err.message)
    return null
  }
}

async function storeRegionalCache(regionKey, dispensaries, strainNames, location) {
  try {
    await fetch('/api/dispensary-cache?action=store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        region_key: regionKey,
        dispensaries,
        strain_names: strainNames || [],
        location_query: typeof location === 'string' ? location : 'geolocation',
      }),
    })
    console.log(`[DispensaryCache] Stored regional cache for "${regionKey}"`)
  } catch (err) {
    console.warn('[DispensaryCache] Regional cache store failed:', err.message)
  }
}

/* ------------------------------------------------------------------ */
/*  Normalize enriched strain objects                                  */
/* ------------------------------------------------------------------ */
function normalizeStrainEntry(s) {
  if (typeof s === 'string') return { name: s, price: null, inStock: true, strainMenuUrl: null }
  return {
    name: s.name || 'Unknown',
    price: s.price || null,
    inStock: s.inStock !== false,
    strainMenuUrl: s.strainMenuUrl || s.strain_menu_url || s.url || null,
  }
}

/* ------------------------------------------------------------------ */
/*  Main search function                                               */
/* ------------------------------------------------------------------ */
export async function searchDispensaries(location, strainNames, options = {}) {
  // Layer 1: Check localStorage cache
  const cached = getCachedResults(location, strainNames)
  if (cached) return cached

  // Layer 2: Check regional cache (Netlify Blobs — shared across users)
  const regionKey = getRegionKey(location)
  if (regionKey) {
    const regionalHit = await checkRegionalCache(regionKey, strainNames)
    if (regionalHit) {
      const dispensaries = normalizeDispensaries(regionalHit)
      setCachedResults(location, strainNames, dispensaries)
      return dispensaries
    }
  }

  // Layer 3: Call Anthropic API
  try {
    const prompt = buildDispensaryPrompt(location, strainNames, options)
    const rawText = await callAnthropic({ prompt, maxTokens: 4000, retries: 2 })
    const parsed = parseDispensaryResponse(rawText)
    const dispensaries = normalizeDispensaries(parsed.dispensaries || [])

    // Store in both caches
    setCachedResults(location, strainNames, dispensaries)
    if (regionKey) {
      storeRegionalCache(regionKey, dispensaries, strainNames, location) // fire-and-forget
    }

    return dispensaries
  } catch (err) {
    // Rate limit errors should surface to the UI — don't silently fall back
    if (err instanceof RateLimitError) {
      throw err
    }

    console.error('Dispensary search — falling back to demo data:', err.message)

    // Return demo dispensary data so the UI always has something to show
    const demo = buildDemoDispensaries(location, strainNames)
    setCachedResults(location, strainNames, demo)
    return demo
  }
}

/* ------------------------------------------------------------------ */
/*  Normalize dispensary array (handles both legacy + enriched format) */
/* ------------------------------------------------------------------ */
function normalizeDispensaries(rawList) {
  return (rawList || []).map((d, i) => ({
    id: d.id || `disp-${i}`,
    name: d.name || 'Unknown Dispensary',
    address: d.address || '',
    lat: d.lat || null,
    lng: d.lng || null,
    distance: d.distance || '',
    rating: d.rating || null,
    reviewCount: d.reviewCount || d.review_count || 0,
    delivery: !!d.delivery,
    deliveryFee: d.deliveryFee || d.delivery_fee || null,
    deliveryMin: d.deliveryMin || d.delivery_min || null,
    deliveryEta: d.deliveryEta || d.delivery_eta || null,
    pickupReady: d.pickupReady || d.pickup_ready || null,
    matchedStrains: (d.matchedStrains || d.matched_strains || []).map(normalizeStrainEntry),
    alternativeStrains: (d.alternativeStrains || d.alternative_strains || []).map(normalizeStrainEntry),
    deals: d.deals || [],
    priceRange: d.priceRange || d.price_range || null,
    hours: d.hours || '',
    phone: d.phone || '',
    website: d.website || '',
    menuUrl: d.menuUrl || d.menu_url || '',
    matchType: (d.matchedStrains || d.matched_strains || []).length > 0 ? 'exact' : 'alternative',
  }))
}

/* ------------------------------------------------------------------ */
/*  Build strain→dispensaries availability map (inverted index)       */
/* ------------------------------------------------------------------ */
export function buildStrainAvailability(dispensaries) {
  const map = {}
  for (const d of (dispensaries || [])) {
    const addEntry = (strainObj, type) => {
      const name = typeof strainObj === 'string' ? strainObj : strainObj?.name
      if (!name) return
      if (!map[name]) map[name] = []
      map[name].push({
        dispensaryName: d.name,
        dispensaryId: d.id,
        distance: d.distance,
        price: typeof strainObj === 'object' ? strainObj.price : null,
        menuUrl: typeof strainObj === 'object' ? strainObj.strainMenuUrl : null,
        delivery: d.delivery,
        rating: d.rating,
        matchType: type,
      })
    }
    for (const s of (d.matchedStrains || [])) addEntry(s, 'exact')
    for (const s of (d.alternativeStrains || [])) addEntry(s, 'alternative')
  }
  // Sort each strain's dispensaries by distance
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => (parseFloat(a.distance) || 999) - (parseFloat(b.distance) || 999))
  }
  return map
}

/* ------------------------------------------------------------------ */
/*  Demo dispensary data — realistic showcase when no API key          */
/* ------------------------------------------------------------------ */
function buildDemoDispensaries(location, strainNames) {
  const locStr = typeof location === 'string' ? location : 'your area'
  const topStrains = (strainNames || []).slice(0, 3)
  const altStrains = (strainNames || []).slice(3, 5)

  return [
    {
      id: 'demo-0',
      name: 'Green Leaf Wellness',
      address: `1240 Main St, ${locStr}`,
      distance: '0.8 mi',
      rating: 4.8,
      reviewCount: 312,
      delivery: true,
      deliveryFee: null,
      deliveryMin: null,
      deliveryEta: '30-45 min',
      pickupReady: '15 min',
      matchedStrains: topStrains.slice(0, 2).map(n => ({ name: n, price: '$45/eighth', inStock: true, strainMenuUrl: null })),
      alternativeStrains: altStrains.slice(0, 1).map(n => ({ name: n, price: '$38/eighth', inStock: true, strainMenuUrl: null })),
      deals: ['20% off first-time patients', 'Happy Hour 4-6pm: 15% off flower'],
      priceRange: '$35-50/eighth',
      hours: '9am - 9pm',
      phone: '(555) 420-1234',
      website: 'https://weedmaps.com',
      menuUrl: 'https://weedmaps.com',
      matchType: 'exact',
    },
    {
      id: 'demo-1',
      name: 'The Herbal Connection',
      address: `850 Oak Ave, ${locStr}`,
      distance: '1.4 mi',
      rating: 4.6,
      reviewCount: 189,
      delivery: true,
      deliveryFee: null,
      deliveryMin: null,
      deliveryEta: '45-60 min',
      pickupReady: '20 min',
      matchedStrains: topStrains.slice(0, 3).map(n => ({ name: n, price: '$40/eighth', inStock: true, strainMenuUrl: null })),
      alternativeStrains: [],
      deals: ['BOGO 50% off edibles', 'Loyalty points: $1 = 1 point'],
      priceRange: '$30-45/eighth',
      hours: '10am - 10pm',
      phone: '(555) 420-5678',
      website: 'https://leafly.com',
      menuUrl: 'https://leafly.com',
      matchType: 'exact',
    },
    {
      id: 'demo-2',
      name: 'Elevated Dispensary',
      address: `2100 Cannabis Blvd, ${locStr}`,
      distance: '2.1 mi',
      rating: 4.9,
      reviewCount: 427,
      delivery: false,
      deliveryFee: null,
      deliveryMin: null,
      deliveryEta: null,
      pickupReady: '10 min',
      matchedStrains: topStrains.slice(1, 3).map(n => ({ name: n, price: '$50/eighth', inStock: true, strainMenuUrl: null })),
      alternativeStrains: altStrains.map(n => ({ name: n, price: '$35/eighth', inStock: true, strainMenuUrl: null })),
      deals: ['Daily deal: $25 eighths on select strains', 'Veterans 20% off'],
      priceRange: '$25-55/eighth',
      hours: '8am - 10pm',
      phone: '(555) 420-9012',
      website: 'https://weedmaps.com',
      menuUrl: 'https://weedmaps.com',
      matchType: 'exact',
    },
    {
      id: 'demo-3',
      name: 'Zen Cannabis Co.',
      address: `445 Elm St, ${locStr}`,
      distance: '3.2 mi',
      rating: 4.5,
      reviewCount: 156,
      delivery: true,
      deliveryFee: null,
      deliveryMin: null,
      deliveryEta: '60-90 min',
      pickupReady: '25 min',
      matchedStrains: topStrains.slice(0, 1).map(n => ({ name: n, price: '$42/eighth', inStock: true, strainMenuUrl: null })),
      alternativeStrains: altStrains.slice(0, 2).map(n => ({ name: n, price: '$36/eighth', inStock: true, strainMenuUrl: null })),
      deals: ['First-time patient: free pre-roll with purchase'],
      priceRange: '$40-60/eighth',
      hours: '9am - 8pm',
      phone: '(555) 420-3456',
      website: 'https://leafly.com',
      menuUrl: 'https://leafly.com',
      matchType: 'exact',
    },
    {
      id: 'demo-4',
      name: 'Nature\'s Remedy',
      address: `780 Birch Dr, ${locStr}`,
      distance: '4.5 mi',
      rating: 4.7,
      reviewCount: 203,
      delivery: false,
      deliveryFee: null,
      deliveryMin: null,
      deliveryEta: null,
      pickupReady: '20 min',
      matchedStrains: [],
      alternativeStrains: topStrains.slice(0, 2).map(n => ({ name: n, price: '$39/eighth', inStock: true, strainMenuUrl: null })),
      deals: ['Terpene Tuesday: 10% off all flower', 'Senior discount 15%'],
      priceRange: '$30-50/eighth',
      hours: '10am - 9pm',
      phone: '(555) 420-7890',
      website: 'https://weedmaps.com',
      menuUrl: 'https://weedmaps.com',
      matchType: 'alternative',
    },
  ]
}

function sanitizeLLMJson(str) {
  return str
    .replace(/,\s*([\]}])/g, '$1')    // trailing commas before } or ]
    .replace(/\n/g, ' ')              // remove newlines inside JSON
}

function parseDispensaryResponse(rawText) {
  if (!rawText) throw new Error('Empty response')

  // Strip markdown code fences if present
  let cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

  // Find the outermost JSON object
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) {
    // Try to find an array instead
    const arrStart = cleaned.indexOf('[')
    const arrEnd = cleaned.lastIndexOf(']')
    if (arrStart !== -1 && arrEnd !== -1) {
      try {
        const arr = JSON.parse(sanitizeLLMJson(cleaned.slice(arrStart, arrEnd + 1)))
        return { dispensaries: arr }
      } catch {
        throw new Error('Could not parse dispensary array response')
      }
    }
    throw new Error('No JSON found in dispensary response')
  }

  const json = sanitizeLLMJson(cleaned.slice(start, end + 1))
  let parsed
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Dispensary response contained malformed JSON')
  }

  // Handle various response shapes
  if (Array.isArray(parsed)) return { dispensaries: parsed }
  if (parsed.dispensaries) return parsed
  if (parsed.results) return { dispensaries: parsed.results }

  // If it's a single object with dispensary-like fields, wrap it
  if (parsed.name && parsed.address) return { dispensaries: [parsed] }

  // Unrecognized shape — return empty to avoid silent failure
  return { dispensaries: [] }
}

function buildCacheKey(location, strainNames) {
  const locStr = typeof location === 'string'
    ? location
    : location?.lat != null && location?.lng != null
      ? `${Number(location.lat).toFixed(2)},${Number(location.lng).toFixed(2)}`
      : 'unknown'
  const strainsKey = (strainNames || []).sort().join(',').slice(0, 100)
  return `${CACHE_PREFIX}${locStr}_${strainsKey}`
}

function getCachedResults(location, strainNames) {
  try {
    const key = buildCacheKey(location, strainNames)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key)
      return null
    }
    return data
  } catch {
    return null
  }
}

function setCachedResults(location, strainNames, data) {
  try {
    const key = buildCacheKey(location, strainNames)
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    /* localStorage full or unavailable */
  }
}
