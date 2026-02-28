// Cloudflare Pages Function — FREE Workers AI (Llama 3.3 70B)
// Used for strain experience descriptions and "Why This Strain?" explanations.
// No API key required — runs on Cloudflare's edge AI infrastructure.

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

// ── Rate limiter (in-memory, per-instance) ──────────────────────────
const rateLimitMap = new Map()
const RATE_LIMIT = 20       // max calls per window
const RATE_WINDOW_MS = 3600_000  // 1 hour

function checkRateLimit(ip) {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

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

// ── Main handler ────────────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request: req, env } = context

  if (!env.AI) {
    return new Response(JSON.stringify({ error: 'AI binding not configured. Add [ai] binding in wrangler.toml.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }

  // Rate limit
  const clientIP = req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
  const rateCheck = checkRateLimit(clientIP)

  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({
      error: `Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.`,
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rateCheck.retryAfter),
        ...corsHeaders(),
      },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }

  const prompt = body.prompt
  const maxTokens = body.max_tokens || 500

  if (!prompt || typeof prompt !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing required field: prompt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }

  // ── KV cache check ────────────────────────────────────────────────
  const cacheKey = `ai:${simpleHash(prompt)}`
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey)
      if (cached) {
        return new Response(JSON.stringify({ text: cached }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders() },
        })
      }
    } catch { /* miss */ }
  }

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'You are a knowledgeable cannabis science expert and sommelier. Be factually accurate, concise, and engaging. Never make medical claims.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
    })

    const text = result.response || ''

    // Cache for 24 hours
    if (env.CACHE && text) {
      env.CACHE.put(cacheKey, text, { expirationTtl: 86400 }).catch(() => {})
    }

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'X-RateLimit-Remaining': String(rateCheck.remaining),
        ...corsHeaders(),
      },
    })
  } catch (error) {
    console.error('Workers AI error:', error)
    return new Response(JSON.stringify({ error: error.message || 'AI inference failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }
}

function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}
