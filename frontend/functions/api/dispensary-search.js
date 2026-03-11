/**
 * Cloudflare Pages Function — Real-time dispensary search by zip code.
 *
 * GET /api/dispensary-search?zip=85028
 * GET /api/dispensary-search?q=Portland,%20OR
 *
 * Flow:
 *   1. Geocode zip/query via Nominatim → lat/lng
 *   2. Check proximity to 5 pre-harvested cities (25mi radius)
 *      → If nearby: return redirect to city mode (full strain cross-referencing)
 *   3. Otherwise: call Weedmaps discovery API for real dispensary listings
 *   4. Cache results in KV (24h TTL) to avoid repeated API calls
 */

const TTL_SECONDS = 24 * 60 * 60 // 24 hours

const PRE_HARVESTED_CITIES = [
  { slug: 'san-diego',   label: 'San Diego, CA',  lat: 32.7157, lng: -117.1611 },
  { slug: 'phoenix',     label: 'Phoenix, AZ',    lat: 33.4484, lng: -112.0740 },
  { slug: 'los-angeles', label: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
  { slug: 'new-york',    label: 'New York, NY',    lat: 40.7128, lng: -74.0060  },
  { slug: 'denver',      label: 'Denver, CO',      lat: 39.7392, lng: -104.9903 },
]

const CITY_REDIRECT_RADIUS_MI = 25

/* ── Haversine distance (miles) ──────────────────────────────────────── */

function haversineDistance(lat1, lng1, lat2, lng2) {
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

/* ── Find nearest pre-harvested city within radius ───────────────────── */

function findNearbyCity(lat, lng) {
  let closest = null
  let closestDist = Infinity

  for (const city of PRE_HARVESTED_CITIES) {
    const dist = haversineDistance(lat, lng, city.lat, city.lng)
    if (dist < closestDist) {
      closestDist = dist
      closest = city
    }
  }

  if (closestDist <= CITY_REDIRECT_RADIUS_MI) {
    return { city: closest, distance: closestDist }
  }
  return null
}

/* ── Geocode via Nominatim ───────────────────────────────────────────── */

async function geocode(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'us',
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'MyStrainAI/1.0 (dispensary-search)' },
  })

  if (!res.ok) return null
  const data = await res.json()
  if (!data || data.length === 0) return null

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  }
}

/* ── Fetch dispensaries from Weedmaps discovery API ──────────────────── */

async function fetchWeedmapsListings(lat, lng) {
  const url =
    `https://api-g.weedmaps.com/discovery/v2/listings` +
    `?filter[any_retailer_services][]=storefront` +
    `&filter[bounding_radius]=15mi` +
    `&filter[bounding_latlng]=${lat},${lng}` +
    `&page_size=20` +
    `&page=1`

  const res = await fetch(url)
  if (!res.ok) {
    console.error(`[DispensarySearch] Weedmaps API returned ${res.status}`)
    return []
  }

  const data = await res.json()
  const listings = data?.data?.listings || []

  return listings
    .filter((L) => {
      const type = L.type || ''
      return type === 'dispensary' || type === 'delivery'
    })
    .map((L) => ({
      id: `wm-${L.slug}`,
      name: L.name || 'Unknown Dispensary',
      slug: L.slug,
      address: [L.address, L.city, L.state].filter(Boolean).join(', '),
      lat: L.latitude || null,
      lng: L.longitude || null,
      phone: L.phone_number || '',
      hours: L.todays_hours_str || '',
      rating: L.rating || null,
      reviewCount: L.reviews_count || 0,
      delivery: (L.retailer_services || []).includes('delivery'),
      pickup: (L.retailer_services || []).includes('pickup'),
      website: L.web_url || '',
      wmUrl: `https://weedmaps.com/dispensaries/${L.slug}`,
      menuUrl: `https://weedmaps.com/dispensaries/${L.slug}/menu`,
      matchType: 'none',
      matchedStrains: [],
      alternativeStrains: [],
      deals: [],
      priceRange: null,
      menuSummary: null,
    }))
}

/* ── Format hours from Weedmaps business_hours ───────────────────────── */

function formatDistance(lat1, lng1, lat2, lng2) {
  const dist = haversineDistance(lat1, lng1, lat2, lng2)
  return `${dist.toFixed(1)} mi`
}

/* ── Main handler ────────────────────────────────────────────────────── */

export async function onRequest(context) {
  const { request: req, env } = context
  const url = new URL(req.url)
  const zip = url.searchParams.get('zip')
  const query = url.searchParams.get('q')
  const searchTerm = zip || query

  if (!searchTerm) {
    return json({ error: 'Missing ?zip= or ?q= parameter' }, 400)
  }

  try {
    // Check KV cache first
    const cacheKey = `search:${searchTerm.toLowerCase().replace(/\s+/g, '-')}`
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheKey, 'json')
      if (cached) {
        console.log(`[DispensarySearch] Cache HIT for "${searchTerm}"`)
        return json({ ...cached, cached: true })
      }
    }

    // Geocode the search term
    const geocodeQuery = zip ? `${zip}, USA` : searchTerm
    const geo = await geocode(geocodeQuery)

    if (!geo) {
      return json({
        redirect: false,
        center: null,
        location: searchTerm,
        dispensaries: [],
        error: 'Could not find that location. Try a zip code or city name.',
      })
    }

    // Check proximity to pre-harvested cities
    const nearbyCity = findNearbyCity(geo.lat, geo.lng)
    if (nearbyCity) {
      const result = {
        redirect: true,
        citySlug: nearbyCity.city.slug,
        cityLabel: nearbyCity.city.label,
        lat: nearbyCity.city.lat,
        lng: nearbyCity.city.lng,
        distance: nearbyCity.distance.toFixed(1),
      }

      // Cache the redirect response too
      if (env.CACHE) {
        await env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: TTL_SECONDS })
      }

      return json(result)
    }

    // Not near a pre-harvested city — fetch real Weedmaps listings
    const dispensaries = await fetchWeedmapsListings(geo.lat, geo.lng)

    // Add distance from search center to each dispensary
    for (const d of dispensaries) {
      if (d.lat && d.lng) {
        d.distance = formatDistance(geo.lat, geo.lng, d.lat, d.lng)
      }
    }

    // Sort by distance
    dispensaries.sort((a, b) => {
      const distA = parseFloat(a.distance) || 999
      const distB = parseFloat(b.distance) || 999
      return distA - distB
    })

    const result = {
      redirect: false,
      center: { lat: geo.lat, lng: geo.lng },
      location: searchTerm,
      dispensaries,
    }

    // Cache in KV
    if (env.CACHE) {
      await env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: TTL_SECONDS })
    }

    return json(result)
  } catch (err) {
    console.error('[DispensarySearch] Error:', err)
    return json({ error: 'Search failed', message: err.message }, 500)
  }
}

/* ── Utilities ────────────────────────────────────────────────────────── */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
