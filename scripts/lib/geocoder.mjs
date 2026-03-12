/**
 * geocoder.mjs — Geocode dispensary addresses missing lat/lng
 *
 * Uses Nominatim (OpenStreetMap) to fill in coordinates for dispensaries
 * that were discovered without lat/lng (common for Leafly CBD/hemp stores).
 *
 * Rate-limited to 1 request/second per Nominatim usage policy.
 */

const NOMINATIM_DELAY_MS = 1100 // Nominatim requires ≤1 req/sec
const GEOCODE_TIMEOUT_MS = 5000

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * Geocode a single address string via Nominatim.
 * Returns { lat, lng } or null.
 */
async function geocodeAddress(address) {
  if (!address || address.length < 5) return null

  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      countrycodes: 'us',
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS)

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'MyStrainAI/1.0 (dispensary-harvest-geocoder)' },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.length === 0) return null

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    }
  } catch {
    return null
  }
}

/**
 * Fill in missing lat/lng for dispensaries using their address field.
 * Mutates the dispensary objects in place.
 *
 * @param {Array} dispensaries - Array of dispensary objects
 * @param {Object} cityCenter  - { lat, lng } city center as fallback
 * @returns {Object} - { geocoded, failed, skipped }
 */
export async function geocodeMissingCoords(dispensaries, cityCenter) {
  const needGeocode = dispensaries.filter(d => !d.lat || !d.lng)

  if (needGeocode.length === 0) {
    console.log('  [Geocoder] All dispensaries have coordinates ✓')
    return { geocoded: 0, failed: 0, skipped: 0 }
  }

  console.log(`  [Geocoder] ${needGeocode.length}/${dispensaries.length} dispensaries missing coordinates — geocoding...`)

  let geocoded = 0
  let failed = 0

  for (const disp of needGeocode) {
    const coords = await geocodeAddress(disp.address)

    if (coords && !isNaN(coords.lat) && !isNaN(coords.lng)) {
      disp.lat = coords.lat
      disp.lng = coords.lng
      geocoded++
    } else {
      // Fallback: use city center (dispensary will show on map, just at city center)
      if (cityCenter?.lat && cityCenter?.lng) {
        disp.lat = cityCenter.lat
        disp.lng = cityCenter.lng
        failed++ // Still count as "failed" geocode but it won't be invisible
      } else {
        failed++
      }
    }

    await sleep(NOMINATIM_DELAY_MS)
  }

  console.log(`  [Geocoder] Done: ${geocoded} geocoded, ${failed} used city center fallback`)
  return { geocoded, failed, skipped: dispensaries.length - needGeocode.length }
}
