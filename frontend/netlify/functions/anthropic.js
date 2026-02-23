// Netlify edge function — proxies Anthropic API calls.
// Keeps the API key server-side. Handles the pause_turn loop
// for web search tool use, assembling all content blocks.
// Edge functions have a 50ms CPU limit but I/O wait (fetch) is free,
// so long API calls are fine.
//
// Includes in-memory rate limiting (per IP) and response caching
// to protect API costs.

// ── In-memory rate limiter ──────────────────────────────────────────────
// Edge function instances are ephemeral but can handle bursts within a
// single instance lifetime. This prevents any single IP from hammering
// the API during a session.
const rateLimitMap = new Map()
const RATE_LIMIT = 10       // max calls per window
const RATE_WINDOW_MS = 3600_000  // 1 hour

function checkRateLimit(ip) {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  // Clean stale entries periodically (keep map small)
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap) {
      if (now - val.windowStart > RATE_WINDOW_MS) rateLimitMap.delete(key)
    }
  }

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 })
    return { allowed: true, remaining: RATE_LIMIT - 1 }
  }

  if (entry.count >= RATE_LIMIT) {
    const retryAfter = Math.ceil((entry.windowStart + RATE_WINDOW_MS - now) / 1000)
    return { allowed: false, remaining: 0, retryAfter }
  }

  entry.count++
  return { allowed: true, remaining: RATE_LIMIT - entry.count }
}

// ── Simple in-memory response cache ─────────────────────────────────────
// Cache keyed by a hash of the prompt content. Short TTL prevents stale
// data but catches duplicate requests (e.g., user refreshes page).
const responseCache = new Map()
const CACHE_TTL_MS = 30 * 60_000  // 30 minutes
const MAX_CACHE_SIZE = 50

function getCacheKey(body) {
  // Simple hash of the user message content
  const msg = body.messages?.[0]?.content || ''
  const prompt = typeof msg === 'string' ? msg : JSON.stringify(msg)
  // Simple string hash
  let hash = 0
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit int
  }
  return `${body.model}:${hash}`
}

function getCached(key) {
  const entry = responseCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key, data) {
  // Evict oldest if over max
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const firstKey = responseCache.keys().next().value
    responseCache.delete(firstKey)
  }
  responseCache.set(key, { data, timestamp: Date.now() })
}

// ── Main handler ────────────────────────────────────────────────────────

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate limit check
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  const rateCheck = checkRateLimit(clientIP)

  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({
      error: `Rate limit exceeded. Please try again in ${rateCheck.retryAfter} seconds. Limit: ${RATE_LIMIT} requests per hour.`,
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rateCheck.retryAfter),
        'X-RateLimit-Remaining': '0',
      },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.messages || !body.model) {
    return new Response(JSON.stringify({ error: 'Missing required fields: model, messages' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Check cache
  const cacheKey = getCacheKey(body)
  const cached = getCached(cacheKey)
  if (cached) {
    return new Response(JSON.stringify(cached), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
        'X-RateLimit-Remaining': String(rateCheck.remaining),
      },
    })
  }

  try {
    // Call the Anthropic API, handling the pause_turn loop for web search
    let messages = [...body.messages]
    let allContent = []
    const maxTurns = 10

    for (let turn = 0; turn < maxTurns; turn++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: body.model,
          max_tokens: body.max_tokens || 8000,
          tools: body.tools || [],
          messages,
        }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        let errorMessage = `Anthropic API error ${response.status}`
        try {
          const errJson = JSON.parse(errText)
          if (errJson.error?.message) errorMessage = errJson.error.message
        } catch { /* use default */ }

        return new Response(JSON.stringify({ error: errorMessage }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const data = await response.json()
      allContent = allContent.concat(data.content || [])

      // If pause_turn, the model needs another turn (web search loop)
      if (data.stop_reason === 'pause_turn') {
        messages = [...messages, { role: 'assistant', content: data.content }]
        continue
      }

      // Done — assemble, cache, and return
      const result = {
        id: data.id,
        type: data.type,
        role: data.role,
        model: data.model,
        content: allContent,
        stop_reason: data.stop_reason,
        usage: data.usage,
      }

      // Cache the response
      setCache(cacheKey, result)

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'MISS',
          'X-RateLimit-Remaining': String(rateCheck.remaining),
        },
      })
    }

    return new Response(JSON.stringify({ error: 'Max API turns exceeded' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Anthropic proxy error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = {
  path: '/api/anthropic',
}
