/**
 * Dispensary search — Serves live dispensary data from Cloudflare KV.
 *
 * Data pipeline:
 *   GitHub Actions cron → Weedmaps API → strain matching → KV
 *   This service reads from KV via the /api/dispensaries Pages Function.
 *
 * Two modes:
 *   1. City mode: Select a pre-harvested city → instant results from KV
 *   2. Location mode: Enter zip/city → check KV regional cache → demo fallback
 */

const CACHE_PREFIX = 'dispensary_'
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes (local cache)

/* ------------------------------------------------------------------ */
/*  Region key helper — groups nearby zip codes                       */
/* ------------------------------------------------------------------ */
export function getRegionKey(location) {
  if (typeof location === 'string') {
    const zipMatch = location.match(/\b(\d{5})\b/)
    if (zipMatch) return zipMatch[1].slice(0, 3)
    return location.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30)
  }
  if (location?.lat != null && location?.lng != null) {
    return `geo-${Math.round(location.lat * 10)}-${Math.round(location.lng * 10)}`
  }
  return null
}

/* ------------------------------------------------------------------ */
/*  City-based search (primary — uses pre-harvested KV data)          */
/* ------------------------------------------------------------------ */
export async function fetchCities() {
  try {
    const res = await fetch('/api/dispensaries')
    if (!res.ok) return []
    const data = await res.json()
    return data.cities || []
  } catch {
    return []
  }
}

export async function searchByCity(citySlug) {
  try {
    const res = await fetch(`/api/dispensaries?city=${citySlug}`)
    if (!res.ok) return { available: false, dispensaries: [] }
    const data = await res.json()

    if (!data.available) return { available: false, dispensaries: [] }

    return {
      available: true,
      city: data.city,
      label: data.label,
      lat: data.lat,
      lng: data.lng,
      updatedAt: data.updatedAt,
      dispensaryCount: data.dispensaryCount,
      matchedStrainCount: data.matchedStrainCount,
      dispensaries: normalizeDispensaries(data.dispensaries || []),
    }
  } catch (err) {
    console.error('[DispensarySearch] City fetch failed:', err.message)
    return { available: false, dispensaries: [] }
  }
}

export async function fetchDispensaryMenu(citySlug, dispensaryId) {
  try {
    const res = await fetch(`/api/dispensaries?city=${citySlug}&dispensary=${dispensaryId}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.available) return null
    return data.dispensary || null
  } catch (err) {
    console.error('[DispensarySearch] Menu fetch failed:', err.message)
    return null
  }
}

/* ------------------------------------------------------------------ */
/*  Location-based search (fallback — zip/city/geolocation)           */
/* ------------------------------------------------------------------ */
async function checkRegionalCache(regionKey) {
  try {
    const params = new URLSearchParams({ action: 'check', region: regionKey })
    const res = await fetch(`/api/dispensary-cache?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.cached && data.dispensaries?.length > 0) {
      console.log(`[DispensaryCache] Regional HIT for "${regionKey}" (${data.hit_count} hits)`)
      return data.dispensaries
    }
    return null
  } catch {
    return null
  }
}

export async function searchDispensaries(location, strainNames, options = {}) {
  // Check localStorage cache first
  const cached = getCachedResults(location, strainNames)
  if (cached) return cached

  // Check KV regional cache
  const regionKey = getRegionKey(location)
  if (regionKey) {
    const regionalHit = await checkRegionalCache(regionKey)
    if (regionalHit) {
      const dispensaries = normalizeDispensaries(regionalHit)
      setCachedResults(location, strainNames, dispensaries)
      return dispensaries
    }
  }

  // Fallback: demo data
  console.log('[DispensarySearch] No cached data — returning demo dispensaries')
  const demo = buildDemoDispensaries(location, strainNames)
  setCachedResults(location, strainNames, demo)
  return demo
}

/* ------------------------------------------------------------------ */
/*  Normalize dispensary array                                        */
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
    matchedStrains: (d.matchedStrains || d.matched_strains || d.menuSummary?.topMatches || []).map(
      s => typeof s === 'string' ? { name: s, price: null, inStock: true, strainMenuUrl: null } : normalizeStrainEntry(s)
    ),
    alternativeStrains: (d.alternativeStrains || d.alternative_strains || []).map(normalizeStrainEntry),
    deals: d.deals || [],
    priceRange: d.priceRange || d.price_range || null,
    hours: d.hours || '',
    phone: d.phone || '',
    website: d.website || '',
    menuUrl: d.menuUrl || d.menu_url || d.wmUrl || '',
    wmUrl: d.wmUrl || '',
    matchType: (d.menuSummary?.matched > 0 || (d.matchedStrains || d.matched_strains || []).length > 0) ? 'exact' : 'alternative',
    menuSummary: d.menuSummary || null,
    batchIndex: d.batchIndex ?? null,
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
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => (parseFloat(a.distance) || 999) - (parseFloat(b.distance) || 999))
  }
  return map
}

/* ------------------------------------------------------------------ */
/*  Demo dispensary data — showcase when no live data available        */
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
      deliveryEta: '45-60 min',
      pickupReady: '20 min',
      matchedStrains: topStrains.slice(0, 3).map(n => ({ name: n, price: '$40/eighth', inStock: true, strainMenuUrl: null })),
      alternativeStrains: [],
      deals: ['BOGO 50% off edibles'],
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
      pickupReady: '10 min',
      matchedStrains: topStrains.slice(1, 3).map(n => ({ name: n, price: '$50/eighth', inStock: true, strainMenuUrl: null })),
      alternativeStrains: altStrains.map(n => ({ name: n, price: '$35/eighth', inStock: true, strainMenuUrl: null })),
      deals: ['Daily deal: $25 eighths on select strains'],
      priceRange: '$25-55/eighth',
      hours: '8am - 10pm',
      phone: '(555) 420-9012',
      website: 'https://weedmaps.com',
      menuUrl: 'https://weedmaps.com',
      matchType: 'exact',
    },
  ]
}

/* ------------------------------------------------------------------ */
/*  Local storage caching                                              */
/* ------------------------------------------------------------------ */
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
