/**
 * Cloudflare Pages Function — AI Strain Chat (RAG)
 *
 * Accepts a user question, searches the strain database for relevant
 * strains, builds a grounded prompt with real data, and returns an
 * AI-generated response that cites only factual database information.
 *
 * Model: Llama 3.3 70B (Workers AI)
 */
import strainData from '../../_data/strain-data.js'

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

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

// ── Rate limiter (in-memory, per-isolate) ────────────────────────────
const rateLimitMap = new Map()
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 3600_000

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

// ── Build search index (once per isolate) ────────────────────────────
const strains = strainData.strains || []

// Pre-build a lowercase lookup map
const strainsByName = new Map()
for (const s of strains) {
  strainsByName.set(s.name.toLowerCase(), s)
}

/**
 * Search strains matching the user's query across many fields.
 * Returns the most relevant strains (max 8) for RAG context.
 */
function searchStrains(query) {
  const q = query.toLowerCase()
  const tokens = q.split(/[\s,]+/).filter(t => t.length > 2)

  // Direct name match first
  const exactMatch = strainsByName.get(q)
  if (exactMatch) return [exactMatch]

  // Partial name matches
  const nameMatches = strains.filter(s => s.name.toLowerCase().includes(q))
  if (nameMatches.length > 0 && nameMatches.length <= 5) return nameMatches.slice(0, 5)

  // Multi-field scoring
  const scored = strains.map(s => {
    let score = 0
    const nameLower = s.name.toLowerCase()
    const typeLower = (s.type || '').toLowerCase()
    const descLower = (s.description || '').toLowerCase()
    const descExtLower = (s.description_extended || '').toLowerCase()
    const geneticsLower = (s.genetics || '').toLowerCase()
    const effectNames = (s.effects || []).map(e => (e.name || '').toLowerCase())
    const terpNames = (s.terpenes || []).map(t => (t.name || '').toLowerCase())
    const cannNames = (s.cannabinoids || []).map(c => (c.name || '').toLowerCase())
    const bestFor = (s.best_for || []).map(b => b.toLowerCase())
    const notIdealFor = (s.not_ideal_for || []).map(n => n.toLowerCase())
    const flavors = (s.flavors || []).map(f => f.toLowerCase())

    for (const tok of tokens) {
      // Name matches (highest weight)
      if (nameLower.includes(tok)) score += 10
      // Type match
      if (typeLower === tok || typeLower.includes(tok)) score += 6
      // Effect matches
      for (const e of effectNames) { if (e.includes(tok)) score += 5 }
      // Terpene matches
      for (const t of terpNames) { if (t.includes(tok)) score += 5 }
      // Cannabinoid matches
      for (const c of cannNames) { if (c.includes(tok)) score += 5 }
      // Best-for matches
      for (const b of bestFor) { if (b.includes(tok)) score += 4 }
      // Flavor matches
      for (const f of flavors) { if (f.includes(tok)) score += 3 }
      // Not-ideal-for matches
      for (const n of notIdealFor) { if (n.includes(tok)) score += 2 }
      // Genetics
      if (geneticsLower.includes(tok)) score += 3
      // Description
      if (descLower.includes(tok)) score += 1
      if (descExtLower.includes(tok)) score += 1
    }

    return { strain: s, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const top = scored.filter(s => s.score > 0).slice(0, 8)
  return top.map(s => s.strain)
}

/**
 * Format a strain into a concise text block for the AI context window.
 */
function formatStrainContext(s) {
  const lines = []
  lines.push(`**${s.name}** (${s.type || 'unknown type'})`)
  if (s.genetics) lines.push(`  Genetics: ${s.genetics}`)
  if (s.description) lines.push(`  Description: ${s.description}`)
  if (s.description_extended) lines.push(`  Details: ${s.description_extended}`)

  if (s.effects?.length) {
    const effs = s.effects.map(e => `${e.name} (${e.category}, ${e.confidence}% confidence)`).join(', ')
    lines.push(`  Effects: ${effs}`)
  }

  if (s.terpenes?.length) {
    const terps = s.terpenes.map(t => `${t.name} ${t.pct}%`).join(', ')
    lines.push(`  Terpenes: ${terps}`)
  }

  if (s.cannabinoids?.length) {
    const canns = s.cannabinoids.map(c => `${c.name} ${c.value}%`).join(', ')
    lines.push(`  Cannabinoids: ${canns}`)
  }

  if (s.best_for?.length) lines.push(`  Best For: ${s.best_for.join(', ')}`)
  if (s.not_ideal_for?.length) lines.push(`  Not Ideal For: ${s.not_ideal_for.join(', ')}`)
  if (s.flavors?.length) lines.push(`  Flavors: ${s.flavors.join(', ')}`)

  if (s.consumption_suitability) {
    const cs = s.consumption_suitability
    const methods = Object.entries(cs).filter(([, v]) => v >= 4).map(([k]) => k)
    if (methods.length) lines.push(`  Best Consumption: ${methods.join(', ')}`)
  }

  if (s.lineage) {
    if (s.lineage.parents?.length) lines.push(`  Parents: ${s.lineage.parents.join(', ')}`)
  }

  if (s.price_range) lines.push(`  Price Range: ${s.price_range}`)
  if (s.sentimentScore) lines.push(`  Community Sentiment: ${s.sentimentScore}/10`)

  return lines.join('\n')
}

// ── System prompt ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are **MyStrainAI Chat**, the official AI assistant for the MyStrainAI cannabis strain database. You help users learn about cannabis strains by consulting the MyStrainAI database of 1,400+ strains.

## CRITICAL RULES
1. **ONLY use the strain data provided below** to answer questions. NEVER invent or hallucinate strain information.
2. If a strain or piece of data is not in the provided context, say "I don't have that information in our database" — do NOT guess.
3. Always cite the database: mention "According to our database" or "In the MyStrainAI database" when referencing data.
4. Be factual, concise, and helpful. Format your answers with clear structure.
5. When listing strains, include key details: type, notable effects, top terpenes, and cannabinoid highlights.
6. You may provide general cannabis education (terpene definitions, what cannabinoids are, etc.) but always ground specific strain claims in the provided data.
7. If a user asks something outside the scope of cannabis strains (medical advice, where to buy, etc.), politely redirect: "I'm here to help you explore strain information from our database."
8. **Medical Disclaimer**: Never make medical claims. Cannabis information is for educational purposes only. Always recommend consulting a healthcare professional.
9. Keep responses focused and under 400 words unless the user asks for detailed breakdowns.
10. When comparing strains, use a structured format with side-by-side data from the database.

## DATABASE CONTEXT
Total strains in database: ${strains.length}
`

// ── Main handler ─────────────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request: req, env } = context

  if (!env.AI) {
    return new Response(JSON.stringify({ error: 'AI binding not configured' }), {
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

  const message = body.message
  const history = body.history || [] // optional conversation history

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Missing required field: message' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }

  const userMessage = message.trim().slice(0, 500) // cap input length

  // ── Search the database ───────────────────────────────────────────
  const matchedStrains = searchStrains(userMessage)

  let dbContext = ''
  if (matchedStrains.length > 0) {
    dbContext = `\n## MATCHING STRAINS (from our database)\n\n${matchedStrains.map(formatStrainContext).join('\n\n---\n\n')}`
  } else {
    dbContext = `\n## NOTE: No exact strain matches found for this query. Answer general cannabis questions using your knowledge, but do NOT invent specific strain data. If the user is asking about a specific strain, tell them it may not be in our database yet.`
  }

  // ── Build messages array ──────────────────────────────────────────
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + dbContext },
  ]

  // Include recent conversation history (max 6 turns)
  const recentHistory = history.slice(-6)
  for (const h of recentHistory) {
    if (h.role === 'user' || h.role === 'assistant') {
      messages.push({ role: h.role, content: h.content })
    }
  }

  messages.push({ role: 'user', content: userMessage })

  try {
    const result = await env.AI.run(MODEL, {
      messages,
      max_tokens: 800,
    })

    const response = typeof result.response === 'string'
      ? result.response
      : result.response?.response || JSON.stringify(result.response) || ''

    return new Response(JSON.stringify({
      reply: response,
      strains_referenced: matchedStrains.map(s => s.name),
      strain_count: matchedStrains.length,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(rateCheck.remaining),
        ...corsHeaders(),
      },
    })
  } catch (error) {
    console.error('Workers AI chat error:', error)
    return new Response(JSON.stringify({ error: error.message || 'AI inference failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }
}
