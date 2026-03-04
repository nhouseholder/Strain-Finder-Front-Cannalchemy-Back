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
 * Extract likely strain names from a user query.
 * Handles patterns like "tell me about Blue Dream", "what is Tahoe OG",
 * "compare OG Kush and Sour Diesel", etc.
 */
function extractStrainNames(query) {
  const q = query.toLowerCase()
  const names = []

  // Try matching known strain names (longest first for greedy match)
  const sortedNames = [...strainsByName.keys()].sort((a, b) => b.length - a.length)
  let remaining = q
  for (const name of sortedNames) {
    if (remaining.includes(name)) {
      names.push(name)
      remaining = remaining.replace(name, ' ')
    }
  }
  return names
}

/**
 * Search strains matching the user's query across many fields.
 * Returns the most relevant strains (max 8) for RAG context.
 *
 * Prioritization: exact name > extracted names > name-similarity > multi-field scoring
 */
function searchStrains(query) {
  const q = query.toLowerCase().trim()
  const tokens = q.split(/[\s,]+/).filter(t => t.length > 2)

  // 1. Direct exact name match
  const exactMatch = strainsByName.get(q)
  if (exactMatch) return [exactMatch]

  // 2. Extract known strain names from the query (handles "tell me about Tahoe OG")
  const extractedNames = extractStrainNames(q)
  if (extractedNames.length > 0) {
    const results = extractedNames
      .map(n => strainsByName.get(n))
      .filter(Boolean)
      .slice(0, 5)
    if (results.length > 0) return results
  }

  // 3. Name-similarity scoring for partial name queries (e.g., "tahoe")
  //    Prioritize shorter names (closer match) and exact-word matches
  const nameScored = strains
    .filter(s => s.name.toLowerCase().includes(q))
    .map(s => {
      const nameLower = s.name.toLowerCase()
      let nameScore = 100
      // Exact match bonus
      if (nameLower === q) nameScore += 500
      // Starts-with bonus
      if (nameLower.startsWith(q)) nameScore += 200
      // Word-boundary match bonus (e.g., "tahoe" in "Tahoe OG" but not "Pax 10G Tahoe Rose")
      const words = nameLower.split(/\s+/)
      if (words.some(w => w === q)) nameScore += 150
      if (words[0] === q) nameScore += 100
      // Shorter names preferred (closer match to query)
      nameScore -= nameLower.length * 2
      // Penalize names where query appears deep inside (e.g., "Pax 10G Tahoe Rose")
      const pos = nameLower.indexOf(q)
      nameScore -= pos * 5
      return { strain: s, nameScore }
    })
    .sort((a, b) => b.nameScore - a.nameScore)

  if (nameScored.length > 0 && nameScored.length <= 8) {
    return nameScored.map(s => s.strain)
  }
  if (nameScored.length > 8) {
    return nameScored.slice(0, 8).map(s => s.strain)
  }

  // 4. Multi-field scoring for general questions (effects, terpenes, etc.)
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
      // Name matches (highest weight) — with word-boundary bonus
      if (nameLower === tok) score += 50
      else if (nameLower.split(/\s+/).includes(tok)) score += 20
      else if (nameLower.includes(tok)) score += 10
      // Type match
      if (typeLower === tok) score += 8
      // Effect matches (exact word)
      for (const e of effectNames) { if (e === tok) score += 7; else if (e.includes(tok)) score += 4 }
      // Terpene matches
      for (const t of terpNames) { if (t === tok) score += 7; else if (t.includes(tok)) score += 4 }
      // Cannabinoid matches
      for (const c of cannNames) { if (c === tok) score += 7; else if (c.includes(tok)) score += 4 }
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
const SYSTEM_PROMPT = `You are **MyStrainAI Chat**, the official AI assistant for the MyStrainAI cannabis strain database. You help users learn about cannabis strains by consulting the MyStrainAI database of ${strains.length.toLocaleString()}+ strains.

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
11. **STRAIN NAME PRECISION**: When multiple strains match a user's query, identify the EXACT strain they're asking about. If a user asks about "Tahoe", respond about "Tahoe OG" (the canonical strain) rather than variants like "Pax 10G Tahoe Rose". Use the EXACT strain names from the database — never abbreviate or alter them.
12. When multiple strains are in the context, prioritize the one whose name most closely matches what the user asked for. If ambiguous, mention all matching strains and let the user clarify.
13. Use the **effects confidence scores** to give proportional weight — higher confidence effects should be mentioned first.

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
