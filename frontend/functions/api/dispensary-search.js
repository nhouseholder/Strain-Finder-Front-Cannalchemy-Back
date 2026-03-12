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
  // Full-legal cannabis markets
  { slug: 'san-diego',   label: 'San Diego, CA',    lat: 32.7157, lng: -117.1611 },
  { slug: 'phoenix',     label: 'Phoenix, AZ',      lat: 33.4484, lng: -112.0740 },
  { slug: 'los-angeles', label: 'Los Angeles, CA',   lat: 34.0522, lng: -118.2437 },
  { slug: 'new-york',    label: 'New York, NY',      lat: 40.7128, lng: -74.0060  },
  { slug: 'denver',      label: 'Denver, CO',        lat: 39.7392, lng: -104.9903 },
  { slug: 'las-vegas',   label: 'Las Vegas, NV',     lat: 36.1699, lng: -115.1398 },
  { slug: 'detroit',     label: 'Detroit, MI',       lat: 42.3314, lng: -83.0458  },
  { slug: 'chicago',     label: 'Chicago, IL',       lat: 41.8781, lng: -87.6298  },
  // THC-A legal markets
  { slug: 'nashville',   label: 'Nashville, TN',     lat: 36.1627, lng: -86.7816  },
  { slug: 'lubbock',     label: 'Lubbock, TX',       lat: 33.5779, lng: -101.8552 },
]

const CITY_REDIRECT_RADIUS_MI = 35

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
    `?filter[bounding_radius]=15mi` +
    `&filter[bounding_latlng]=${lat},${lng}` +
    `&page_size=30` +
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
      storefront: (L.retailer_services || []).includes('storefront'),
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
  const directLat = url.searchParams.get('lat')
  const directLng = url.searchParams.get('lng')
  const searchTerm = zip || query

  // Accept either text search (zip/q) or direct lat/lng coords
  if (!searchTerm && !(directLat && directLng)) {
    return json({ error: 'Missing ?zip=, ?q=, or ?lat=&lng= parameter' }, 400)
  }

  try {
    // Build a cache key from whatever params we got
    const cacheLabel = searchTerm
      ? searchTerm.toLowerCase().replace(/\s+/g, '-')
      : `geo-${parseFloat(directLat).toFixed(3)}-${parseFloat(directLng).toFixed(3)}`
    const cacheKey = `search:${cacheLabel}`
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheKey, 'json')
      if (cached) {
        console.log(`[DispensarySearch] Cache HIT for "${cacheLabel}"`)
        return json({ ...cached, cached: true })
      }
    }

    // If direct lat/lng provided, skip geocoding
    let geo
    if (directLat && directLng) {
      geo = {
        lat: parseFloat(directLat),
        lng: parseFloat(directLng),
        displayName: 'Your location',
      }
    } else {
      const geocodeQuery = zip ? `${zip}, USA` : searchTerm
      geo = await geocode(geocodeQuery)
    }

    if (!geo || isNaN(geo.lat) || isNaN(geo.lng)) {
      return json({
        redirect: false,
        center: null,
        location: searchTerm || 'Your location',
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
