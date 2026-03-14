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

  // Search via real dispensary search API (geocode + Weedmaps)
  console.log('[DispensarySearch] Calling dispensary search API...')
  const result = await fetchNearbyDispensaries(location)

  // If the search returned a city redirect, pass it through
  if (result._cityRedirect) {
    return result
  }

  const dispensaries = result.dispensaries || []
  if (dispensaries.length > 0) {
    setCachedResults(location, strainNames, { dispensaries, center: result.center })
  }
  return { dispensaries, center: result.center }
}

/* ------------------------------------------------------------------ */
/*  Fetch real dispensaries from the search API                       */
/* ------------------------------------------------------------------ */
async function fetchNearbyDispensaries(location) {
  try {
    let param
    if (typeof location === 'object' && location?.lat != null && location?.lng != null) {
      // Geolocation object — pass lat/lng directly to skip geocoding
      param = `lat=${encodeURIComponent(location.lat)}&lng=${encodeURIComponent(location.lng)}`
    } else {
      const locStr = typeof location === 'string' ? location : ''
      const isZip = /^\d{5}$/.test(locStr.trim())
      param = isZip ? `zip=${encodeURIComponent(locStr.trim())}` : `q=${encodeURIComponent(locStr.trim())}`
    }
    const res = await fetch(`/api/dispensary-search?${param}`)

    if (!res.ok) {
      console.warn('[DispensarySearch] API returned', res.status)
      return { dispensaries: [], center: null }
    }

    const data = await res.json()

    // City redirect — nearby pre-harvested city found
    if (data.redirect) {
      return {
        _cityRedirect: true,
        citySlug: data.citySlug,
        cityLabel: data.cityLabel,
        lat: data.lat,
        lng: data.lng,
      }
    }

    // Direct results from Weedmaps
    return {
      dispensaries: normalizeDispensaries(data.dispensaries || []),
      center: data.center || null,
    }
  } catch (err) {
    console.error('[DispensarySearch] Nearby search failed:', err.message)
    return { dispensaries: [], center: null }
  }
}

/* ------------------------------------------------------------------ */
/*  Fetch Weedmaps menu items via our proxy API                       */
/* ------------------------------------------------------------------ */
export async function fetchWeedmapsMenuItems(slug) {
  try {
    const res = await fetch(`/api/dispensary-menu?slug=${encodeURIComponent(slug)}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.menuItems || []
  } catch {
    return []
  }
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

function coerceAddress(addr) {
  if (!addr) return ''
  if (typeof addr === 'string') return addr
  // Handle object addresses from APIs (e.g., {street, city, state} or {formatted})
  if (typeof addr === 'object') {
    if (addr.formatted) return addr.formatted
    if (addr.full) return addr.full
    const parts = [addr.street || addr.address1 || addr.address, addr.city, addr.state].filter(Boolean)
    if (parts.length > 0) return parts.join(', ')
  }
  return String(addr)
}

function normalizeDispensaries(rawList) {
  return (rawList || []).map((d, i) => ({
    id: d.id || `disp-${i}`,
    name: d.name || 'Unknown Dispensary',
    address: coerceAddress(d.address),
    lat: d.lat || null,
    lng: d.lng || null,
    distance: d.distance || '',
    rating: d.rating || null,
    reviewCount: d.reviewCount || d.review_count || 0,
    delivery: !!d.delivery,
    storefront: d.storefront !== false, // default true if not explicitly false
    pickup: !!d.pickup,
    deliveryFee: d.deliveryFee || d.delivery_fee || null,
    deliveryMin: d.deliveryMin || d.delivery_min || null,
    deliveryEta: d.deliveryEta || d.delivery_eta || null,
    pickupReady: d.pickupReady || d.pickup_ready || null,
    serviceType: (() => {
      const isDel = !!d.delivery
      const isSf = d.storefront !== false
      if (isDel && !isSf) return 'delivery_only'
      if (isDel && isSf) return 'both'
      return 'storefront'
    })(),
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
    matchType: (() => {
      const hasMatches = (d.menuSummary?.matched > 0 || (d.matchedStrains || d.matched_strains || []).length > 0)
      if (hasMatches) return 'exact'
      // Check if dispensary has menu data at all
      const hasMenu = d.hasMenu === true || d.menuSummary?.hasMenu === true || (d.menuSummary?.total > 0)
      if (!hasMenu && d.menuSummary != null) return 'noMenu'
      if ((d.alternativeStrains || d.alternative_strains || []).length > 0) return 'alternative'
      return 'none'
    })(),
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
/*  Strain availability — checks batch data for a specific strain      */
/* ------------------------------------------------------------------ */
export async function fetchStrainAvailabilityForCity(citySlug, strainName, dispensaryCount) {
  if (!citySlug || !strainName || !dispensaryCount) return {}

  const batchCount = Math.ceil(dispensaryCount / 5) // DISPENSARIES_PER_BATCH = 5
  const lowerStrain = strainName.toLowerCase()

  // Fetch all batches in parallel
  const batchPromises = []
  for (let b = 0; b < batchCount; b++) {
    batchPromises.push(
      fetch(`/api/dispensaries?city=${citySlug}&batch=${b}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    )
  }

  const batches = await Promise.all(batchPromises)

  // Build map: dispensaryId → { inStock, price, menuName }
  const availability = {}
  for (const batch of batches) {
    if (!batch?.dispensaries) continue
    for (const d of batch.dispensaries) {
      const match = (d.matchedMenu || []).find(
        m => (m.strain?.name || m.menuName || '').toLowerCase() === lowerStrain
      )
      if (match) {
        availability[d.id] = {
          inStock: true,
          price: match.price || null,
          menuName: match.menuName || match.strain?.name || strainName,
        }
      }
    }
  }

  return availability
}

/* ------------------------------------------------------------------ */
/*  Fetch all dispensaries across all cities (for quiz autocomplete)    */
/* ------------------------------------------------------------------ */
let _allDispensaryIndexCache = null
let _allDispensaryIndexPromise = null

export async function fetchAllDispensaryIndex() {
  // Return cache only if it has actual data
  if (_allDispensaryIndexCache && _allDispensaryIndexCache.length > 0) return _allDispensaryIndexCache
  if (_allDispensaryIndexPromise) return _allDispensaryIndexPromise

  _allDispensaryIndexPromise = (async () => {
    try {
      const cities = await fetchCities()
      console.log('[DispensaryIndex] Cities found:', cities.length, cities.map(c => c.slug))
      if (!cities.length) return []

      const cityResults = await Promise.all(
        cities.map(async (city) => {
          try {
            const data = await searchByCity(city.slug)
            if (!data.available || !data.dispensaries?.length) {
              console.log(`[DispensaryIndex] ${city.slug}: no dispensaries`)
              return []
            }
            console.log(`[DispensaryIndex] ${city.slug}: ${data.dispensaries.length} dispensaries`)
            return data.dispensaries.map(d => ({
              id: d.id || '',
              name: d.name || 'Unknown',
              address: d.address || '',
              citySlug: city.slug,
              cityLabel: city.label,
              rating: d.rating || null,
              delivery: !!d.delivery,
              storefront: d.storefront !== false,
              matchedStrainCount: d.menuSummary?.matched || d.matchedStrains?.length || 0,
              totalMenuItems: d.menuSummary?.total || 0,
            }))
          } catch (err) {
            console.error(`[DispensaryIndex] ${city.slug} fetch failed:`, err.message)
            return []
          }
        })
      )

      const index = cityResults.flat()
      console.log('[DispensaryIndex] Total dispensaries indexed:', index.length)
      // Only cache non-empty results
      if (index.length > 0) {
        _allDispensaryIndexCache = index
      }
      return index
    } catch (err) {
      console.error('[DispensaryIndex] Fatal error:', err.message)
      return []
    } finally {
      _allDispensaryIndexPromise = null
    }
  })()

  return _allDispensaryIndexPromise
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
