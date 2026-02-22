/**
 * Dispensary search using Claude web search for real-time pricing.
 *
 * Replaces the demo mock data with actual dispensary lookups via the
 * Anthropic API with web_search tool. Results are cached in localStorage
 * for 30 minutes to avoid repeated API calls.
 */
import { callAnthropic } from './anthropicApi'
import { buildDispensaryPrompt } from './promptBuilder'

const CACHE_PREFIX = 'dispensary_'
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export async function searchDispensaries(location, strainNames, options = {}) {
  // Check cache first
  const cached = getCachedResults(location, strainNames)
  if (cached) return cached

  try {
    const prompt = buildDispensaryPrompt(location, strainNames, options)
    const rawText = await callAnthropic({ prompt, maxTokens: 4000, retries: 2 })
    const parsed = parseDispensaryResponse(rawText)

    const dispensaries = (parsed.dispensaries || []).map((d, i) => ({
      id: `disp-${i}`,
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
      matchedStrains: d.matchedStrains || d.matched_strains || [],
      alternativeStrains: d.alternativeStrains || d.alternative_strains || [],
      deals: d.deals || [],
      priceRange: d.priceRange || d.price_range || '$$',
      hours: d.hours || '',
      phone: d.phone || '',
      website: d.website || '',
      menuUrl: d.menuUrl || d.menu_url || '',
      matchType: (d.matchedStrains || d.matched_strains || []).length > 0 ? 'exact' : 'alternative',
    }))

    // Cache the results
    setCachedResults(location, strainNames, dispensaries)

    return dispensaries
  } catch (err) {
    console.error('Dispensary search failed:', err)
    throw new Error(
      'Could not find dispensaries right now. Try searching directly on Weedmaps or Leafly, or try again in a moment.'
    )
  }
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
