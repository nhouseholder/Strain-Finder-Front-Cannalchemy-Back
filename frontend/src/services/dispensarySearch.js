/**
 * Dispensary search — uses Claude web search when API key is available,
 * falls back to realistic demo data for showcasing the UI.
 */
import { callAnthropic, RateLimitError } from './anthropicApi'
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

    setCachedResults(location, strainNames, dispensaries)
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
      matchedStrains: topStrains.slice(0, 2),
      alternativeStrains: altStrains.slice(0, 1),
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
      matchedStrains: topStrains.slice(0, 3),
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
      matchedStrains: topStrains.slice(1, 3),
      alternativeStrains: altStrains,
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
      matchedStrains: topStrains.slice(0, 1),
      alternativeStrains: altStrains.slice(0, 2),
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
      matchedStrains: [],
      alternativeStrains: topStrains.slice(0, 2),
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
