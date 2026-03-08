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

// Pre-build array of lowercase names for fuzzy search
const allNamesLower = [...strainsByName.keys()]

/**
 * Levenshtein edit-distance between two strings.
 * Used for fuzzy strain name matching (typo tolerance).
 */
function editDistance(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  // Use two-row DP for memory efficiency
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

/**
 * Find the best fuzzy match for a candidate string among all strain names.
 * Returns { name, distance } or null if no match is close enough.
 * Threshold: max 2 edits for short names (≤8 chars), max 3 for longer names.
 */
function fuzzyMatchName(candidate) {
  const c = candidate.toLowerCase().trim()
  if (c.length < 3) return null
  const maxDist = c.length <= 8 ? 2 : 3
  let best = null
  for (const name of allNamesLower) {
    // Quick length filter — edit distance can't be smaller than length diff
    if (Math.abs(name.length - c.length) > maxDist) continue
    const d = editDistance(c, name)
    if (d === 0) return { name, distance: 0 } // exact match, stop early
    if (d <= maxDist && (!best || d < best.distance)) {
      best = { name, distance: d }
    }
  }
  return best
}

/**
 * Fuzzy-match strain names from user query.
 * Splits query into word n-grams (2-4 words) and single words,
 * then checks each against the strain name list for close matches.
 * Returns array of { name, distance } sorted by distance (best first).
 */
function fuzzyExtractStrainNames(query) {
  const words = query.toLowerCase().split(/[\s,]+/).filter(w => w.length > 0)
  const candidates = new Set()
  // Generate n-grams (longest first to match multi-word strain names)
  for (let n = Math.min(words.length, 5); n >= 1; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      candidates.add(words.slice(i, i + n).join(' '))
    }
  }
  const matches = new Map() // name → distance (keep best)
  for (const c of candidates) {
    const m = fuzzyMatchName(c)
    if (m && m.distance > 0) { // distance 0 = exact, handled by extractStrainNames
      const existing = matches.get(m.name)
      if (!existing || m.distance < existing) {
        matches.set(m.name, m.distance)
      }
    }
  }
  return [...matches.entries()]
    .map(([name, distance]) => ({ name, distance }))
    .sort((a, b) => a.distance - b.distance)
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
function searchStrains(query, conversationContext = '') {
  const q = query.toLowerCase().trim()
  const tokens = q.split(/[\s,]+/).filter(t => t.length > 2)

  // 1. Direct exact name match
  const exactMatch = strainsByName.get(q)
  if (exactMatch) return [exactMatch]

  // 2. Extract known strain names from current query + conversation context
  //    This ensures follow-up questions still find strains mentioned earlier
  const combinedText = conversationContext
    ? `${q} ${conversationContext.toLowerCase()}`
    : q
  const extractedNames = extractStrainNames(combinedText)
  // De-dup and prioritize names from the current query
  const currentNames = new Set(extractStrainNames(q))
  const sortedNames = [...new Set(extractedNames)].sort((a, b) => {
    const aInCurrent = currentNames.has(a) ? 1 : 0
    const bInCurrent = currentNames.has(b) ? 1 : 0
    return bInCurrent - aInCurrent
  })
  if (sortedNames.length > 0) {
    const results = sortedNames
      .map(n => strainsByName.get(n))
      .filter(Boolean)
      .slice(0, 5)
    if (results.length > 0) return results
  }

  // 2b. Fuzzy match — catches misspellings like "Grandaddy Purpel", "Gelatto", "Bleu Dream"
  const fuzzyMatches = fuzzyExtractStrainNames(q)
  if (fuzzyMatches.length > 0) {
    const fuzzyResults = fuzzyMatches
      .map(m => strainsByName.get(m.name))
      .filter(Boolean)
      .slice(0, 5)
    if (fuzzyResults.length > 0) return fuzzyResults
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

// ── Effect-based recommendation engine ──────────────────────────────
//
// When a user asks "I want a sativa that's energizing and focusing but
// won't give me anxiety", the name-based search fails. This engine
// detects recommendation intent, parses desired/avoided effects from
// natural language, and analytically scores every strain.

/**
 * Maps user-facing effect categories to:
 *  nl  – natural-language phrases the user might type
 *  db  – canonical effect names stored in strain.effects[].name
 */
const DESIRED_EFFECTS = {
  energetic:     { nl: ['energizing', 'energetic', 'energy', 'stimulating', 'alert', 'awake', 'invigorating', 'lively', 'active', 'boost energy'], db: ['energetic', 'motivated', 'uplifted'] },
  focused:       { nl: ['focusing', 'focused', 'focus', 'concentration', 'mental clarity', 'clarity', 'attentive', 'productive', 'clear-headed', 'clear headed', 'study', 'studying'], db: ['focused'] },
  relaxed:       { nl: ['relaxing', 'relaxed', 'relaxation', 'calm', 'calming', 'chill', 'mellow', 'unwind', 'wind down', 'destress', 'de-stress', 'soothing', 'tranquil'], db: ['relaxed', 'calm', 'body-high'] },
  creative:      { nl: ['creative', 'creativity', 'artistic', 'inspired', 'imaginative', 'inventive'], db: ['creative', 'head-high'] },
  happy:         { nl: ['happy', 'happiness', 'joyful', 'cheerful', 'mood boost', 'mood-boosting', 'mood lifting', 'feel good', 'feel-good'], db: ['happy', 'euphoric', 'giggly'] },
  euphoric:      { nl: ['euphoric', 'euphoria', 'blissful', 'elated', 'ecstatic'], db: ['euphoric', 'happy'] },
  sleepy:        { nl: ['sleepy', 'sleep', 'drowsy', 'sedating', 'sedative', 'knockout', 'bedtime', 'nighttime'], db: ['sleepy'] },
  uplifted:      { nl: ['uplifting', 'uplifted', 'uplift', 'elevated', 'mood elevation', 'bright'], db: ['uplifted', 'happy', 'energetic'] },
  social:        { nl: ['social', 'sociable', 'chatty', 'outgoing', 'talkative', 'conversation', 'party', 'hanging out'], db: ['talkative', 'giggly', 'uplifted'] },
  hungry:        { nl: ['appetite', 'appetite boost', 'appetite stimulant', 'hunger'], db: ['hungry'] },
  tingly:        { nl: ['tingly', 'tingling', 'body buzz', 'buzzy'], db: ['tingly'] },
  aroused:       { nl: ['aroused', 'arousal', 'sensual', 'aphrodisiac', 'intimate'], db: ['aroused'] },
  motivated:     { nl: ['motivated', 'motivation', 'driven', 'ambitious', 'get things done'], db: ['motivated', 'energetic'] },
  pain:          { nl: ['pain relief', 'pain', 'analgesic', 'body pain', 'chronic pain', 'sore', 'aches', 'body comfort'], db: ['pain', 'inflammation', 'body-high'] },
  stress:        { nl: ['stress relief', 'stress', 'tension relief', 'tension', 'pressure'], db: ['stress', 'anxiety', 'relaxed'] },
  anxietyRelief: { nl: ['anxiety relief', 'for anxiety', 'help with anxiety', 'manage anxiety', 'anti-anxiety', 'anxiolytic', 'ease anxiety'], db: ['anxiety', 'stress', 'calm'] },
  depression:    { nl: ['for depression', 'antidepressant', 'depression', 'seasonal depression', 'lift mood'], db: ['depression', 'happy', 'uplifted'] },
  insomnia:      { nl: ['insomnia', 'sleep aid', 'sleep disorder', "can't sleep", 'trouble sleeping'], db: ['insomnia', 'sleepy'] },
  inflammation:  { nl: ['anti-inflammatory', 'inflammation', 'swelling', 'joint pain'], db: ['inflammation', 'pain'] },
}

/**
 * Maps natural-language "avoid" terms to canonical DB negative-effect names.
 */
const AVOID_EFFECTS = {
  anxious:      { nl: ['anxiety', 'anxious', 'paranoia', 'paranoid', 'nervous', 'worried', 'panic', 'panicky', 'racing thoughts', 'overthinking', 'uneasy', 'on edge'], db: ['anxious', 'paranoid'] },
  dizzy:        { nl: ['dizzy', 'dizziness', 'lightheaded', 'vertigo', 'head rush'], db: ['dizzy'] },
  dryMouth:     { nl: ['dry mouth', 'cottonmouth', 'cotton mouth'], db: ['dry-mouth'] },
  dryEyes:      { nl: ['dry eyes'], db: ['dry-eyes'] },
  headache:     { nl: ['headache', 'head pain', 'migraine'], db: ['headache'] },
  couchLock:    { nl: ['couch lock', 'couch-lock', 'too sedating', 'too heavy', 'body lock', 'glued to couch', 'immobilized', 'too sleepy', 'too tired'], db: ['couch-lock'] },
  racingHeart:  { nl: ['racing heart', 'rapid heartbeat', 'heart racing', 'fast heartbeat', 'heart pounding', 'tachycardia'], db: ['rapid-heartbeat'] },
  munchies:     { nl: ['munchies', 'too hungry', 'overeating', 'binge eating'], db: ['hungry'] },
  nauseous:     { nl: ['nauseous', 'nausea', 'queasy', 'sick to stomach'], db: ['nauseous'] },
  spacey:       { nl: ['spacey', 'spaced out', 'brain fog', 'foggy', 'disoriented', 'confused', 'zoned out', 'out of it'], db: ['spacey', 'disoriented'] },
}

/**
 * Detect whether the user is asking for a strain recommendation
 * (vs. asking about a specific named strain).
 */
function isRecommendationQuery(query) {
  const q = query.toLowerCase()
  const patterns = [
    /\b(i want|i need|i'm looking for|looking for|find me|suggest|recommend)\b/,
    /\b(what.{0,15}(?:good|best|great|top|strongest|right))\b/,
    /\b(what|which)\s+(?:strain|sativa|indica|hybrid)\b/,
    /\b(best|good|great|top|strongest|ideal|perfect)\b.{0,25}\b(strain|sativa|indica|hybrid|weed|cannabis|bud)\b/,
    /\b(strain|sativa|indica|hybrid)\b.{0,25}\b(for|that|to help|that helps)\b/,
    /\b(something (?:for|that|to|with))\b/,
    /\b(help me (?:find|choose|pick|select))\b/,
    /\b(any (?:strains?|recommendations?|suggestions?))\b/,
    /\b(strains? (?:for|to|that))\b/,
  ]
  return patterns.some(p => p.test(q))
}

/**
 * Parse a natural-language recommendation query into structured intent.
 * Returns { desiredEffects: string[], avoidEffects: string[], typePreference: string|null }
 */
function parseEffectQuery(query) {
  const q = query.toLowerCase()

  // ── Type preference ──
  let typePreference = null
  if (/\bsativa\b/.test(q)) typePreference = 'sativa'
  else if (/\bindica\b/.test(q)) typePreference = 'indica'
  else if (/\bhybrid\b/.test(q)) typePreference = 'hybrid'

  // ── Split into "want" vs "avoid" sections ──
  // Look for negation signals: "but not", "without", "won't", "avoid", etc.
  const splitIdx = q.search(
    /\b(but (?:not|won't|won't|don't|no)|without|won't give|won't cause|don't want|doesn't cause|not cause|avoid(?:ing)?|no\b(?=.*\b(?:anxiety|paranoi|dizz|headache|couch|racing|dry|nause|brain fog|spacey)))/
  )
  const wantSection = splitIdx >= 0 ? q.slice(0, splitIdx) : q
  const avoidSection = splitIdx >= 0 ? q.slice(splitIdx) : ''

  // ── Match desired effects (from want section only) ──
  const desiredEffects = []
  for (const [key, { nl }] of Object.entries(DESIRED_EFFECTS)) {
    // Sort synonyms longest-first for greedy matching
    const sorted = [...nl].sort((a, b) => b.length - a.length)
    for (const phrase of sorted) {
      if (wantSection.includes(phrase)) {
        desiredEffects.push(key)
        break
      }
    }
  }

  // ── Match avoided effects (from avoid section) ──
  const avoidEffects = []
  for (const [key, { nl }] of Object.entries(AVOID_EFFECTS)) {
    const sorted = [...nl].sort((a, b) => b.length - a.length)
    for (const phrase of sorted) {
      if (avoidSection.includes(phrase)) {
        avoidEffects.push(key)
        break
      }
    }
  }

  return { desiredEffects, avoidEffects, typePreference }
}

/**
 * Score and rank all strains by how well they match parsed intent.
 * Returns array of { strain, score, matchNotes } sorted best-first.
 */
function recommendationSearch(parsed, userRegionIndex = -1) {
  const { desiredEffects, avoidEffects, typePreference } = parsed
  if (desiredEffects.length === 0 && !typePreference) return []

  const results = []

  for (const s of strains) {
    let score = 0
    const matchNotes = []

    // Build effect lookup: name → { ...effect, pct }
    const effectMap = new Map()
    const maxReports = Math.max(...(s.effects || []).map(e => e.reports || 0), 1)
    for (const e of (s.effects || [])) {
      effectMap.set(e.name.toLowerCase(), {
        ...e,
        pct: Math.round(((e.reports || 0) / maxReports) * 100),
      })
    }

    // ── Type match (strong signal) ──
    if (typePreference) {
      const t = (s.type || '').toLowerCase()
      if (t === typePreference)     { score += 25; matchNotes.push(`✓ ${typePreference}`) }
      else if (t === 'hybrid')      { score += 8  }
      else                          { score -= 20 }
    }

    // ── Desired effects ──
    for (const key of desiredEffects) {
      const { db } = DESIRED_EFFECTS[key]
      // Pick the DB effect with the highest report pct
      let bestMatch = null
      for (const dbName of db) {
        const eff = effectMap.get(dbName)
        if (eff && (!bestMatch || eff.pct > bestMatch.pct)) bestMatch = eff
      }
      if (bestMatch) {
        const weight = bestMatch.pct >= 75 ? 30 : bestMatch.pct >= 50 ? 22 : bestMatch.pct >= 25 ? 14 : 6
        score += weight
        matchNotes.push(`${bestMatch.name}: ${bestMatch.pct}%`)
      } else {
        // Check best_for for broader matches
        let foundBestFor = false
        for (const bf of (s.best_for || [])) {
          const bfLow = bf.toLowerCase()
          if (DESIRED_EFFECTS[key].nl.some(syn => bfLow.includes(syn))) {
            score += 10
            matchNotes.push(`best for: ${bf}`)
            foundBestFor = true
            break
          }
        }
        if (!foundBestFor) score -= 5 // missing a desired effect
      }
    }

    // ── Avoid effects (strong penalty) ──
    for (const key of avoidEffects) {
      const { db } = AVOID_EFFECTS[key]
      for (const dbName of db) {
        const eff = effectMap.get(dbName)
        if (eff) {
          const penalty = eff.pct >= 50 ? 35 : eff.pct >= 25 ? 20 : eff.pct >= 10 ? 10 : 3
          score -= penalty
          if (eff.pct >= 15) matchNotes.push(`⚠ ${eff.name}: ${eff.pct}%`)
          break
        }
      }
      // Also check not_ideal_for text
      for (const nif of (s.not_ideal_for || [])) {
        const nifLow = nif.toLowerCase()
        if (AVOID_EFFECTS[key].nl.some(syn => nifLow.includes(syn))) {
          score -= 12
          matchNotes.push(`⚠ not ideal: ${nif}`)
          break
        }
      }
    }

    // ── Bonus: data quality & report volume ──
    if (s.dataCompleteness === 'full') score += 4
    const totalReports = (s.effects || []).reduce((sum, e) => sum + (e.reports || 0), 0)
    score += Math.min(totalReports / 80, 5) // cap +5 for well-reported strains

    // ── Regional boost (if user provided zip) ──
    if (userRegionIndex >= 0 && s.reg) {
      const regScore = s.reg[userRegionIndex] || 0
      score += regScore >= 70 ? 5 : regScore >= 40 ? 2 : 0
    }

    if (score > 10) results.push({ strain: s, score: Math.round(score), matchNotes })
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, 6)
}

// ── Region data for location-aware responses ────────────────────────
const regionOrder = strainData.regionOrder || ['PAC', 'MTN', 'MWE', 'GLK', 'SOU', 'NEN', 'MAT']
const regionMap = strainData.regionMap || {}
const REGION_LABELS = {
  PAC: 'Pacific (CA, OR, WA)',
  MTN: 'Mountain (CO, NV, AZ)',
  MWE: 'Midwest (IL, MI, MO, OH)',
  GLK: 'Great Lakes (NY-upstate, PA)',
  SOU: 'South (FL, GA, TX, NC)',
  NEN: 'New England (MA, CT, ME)',
  MAT: 'Mid-Atlantic (NY-metro, NJ, DE)',
}

/**
 * Format a strain into a clearly-structured text block for the AI context window.
 * Each section is explicitly labeled with the strain name to prevent cross-contamination.
 * If userRegionIndex >= 0, includes regional availability info.
 */
function formatStrainContext(s, userRegionIndex = -1, userRegion = '') {
  const lines = []
  const isPartial = s.dataCompleteness === 'partial'
  lines.push(`### ${s.name} (${s.type || 'unknown type'})${isPartial ? ' ⚠️ PARTIAL DATA' : ''}`)
  if (isPartial) {
    lines.push(`  ⚠️ NOTE: This strain has limited community-reported data and has NOT been extensively lab tested. Information shown is based on available community reports.`)
  }
  if (s.genetics && s.genetics !== 'NULL') lines.push(`  Genetics: ${s.genetics}`)
  if (s.description && s.description !== 'NULL') lines.push(`  Description: ${s.description}`)

  if (s.effects?.length) {
    // Use relative report frequency (same formula as EffectsBreakdown UI)
    const maxReports = Math.max(...s.effects.map(e => e.reports || 0), 1)
    lines.push(`  ${s.name} Effects:`)
    for (const e of s.effects) {
      const pct = maxReports > 0 ? Math.round(((e.reports || 0) / maxReports) * 100) : 0
      const label = pct >= 85 ? 'Very High' : pct >= 65 ? 'High' : pct >= 45 ? 'Moderate' : pct >= 25 ? 'Low' : (e.reports || 0) > 0 ? 'Rare' : 'Unknown'
      lines.push(`    - ${e.name} (${e.category}, ${e.reports || 0} reports, ${pct}% — ${label})`)
    }
  }

  if (s.terpenes?.length) {
    const terps = s.terpenes.map(t => {
      const pct = String(t.pct || '').replace(/%$/, '')
      return `${t.name} ${pct}%`
    }).join(', ')
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

  // Regional availability (when user provided zip code)
  if (userRegionIndex >= 0 && s.reg) {
    const score = s.reg[userRegionIndex] || 0
    const label = score >= 70 ? 'Common in your area' : score >= 40 ? 'Available nearby' : 'Less common nearby'
    lines.push(`  Regional Availability (${userRegion}): ${score}/100 — ${label}`)
  }

  return lines.join('\n')
}

// ── System prompt ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are **MyStrainAI Chat**, the official AI assistant for the MyStrainAI cannabis strain database. You help users learn about cannabis strains by consulting the MyStrainAI database of ${strains.length.toLocaleString()}+ strains.

## CRITICAL RULES
1. **ONLY use the strain data provided in the MATCHING STRAINS section below.** NEVER invent or hallucinate strain information.
2. If a strain is listed in MATCHING STRAINS below, its data IS in our database. Read the data carefully before responding.
3. If a strain or piece of data is NOT in the MATCHING STRAINS section, say "I don't have that information in our database" — do NOT guess.
4. Always cite the database: mention "According to our database" or "In the MyStrainAI database" when referencing data.
5. Be factual, concise, and helpful.
6. You may provide general cannabis education (terpene definitions, what cannabinoids are, etc.) but always ground specific strain claims in the provided data.
7. If a user asks something outside the scope of cannabis strains (medical advice, where to buy, etc.), politely redirect: "I'm here to help you explore strain information from our database."
8. **Medical Disclaimer**: Never make medical claims. Cannabis information is for educational purposes only. Always recommend consulting a healthcare professional.
9. **STRAIN NAME PRECISION**: When multiple strains match a user's query, identify the EXACT strain they're asking about. Use the EXACT strain names from the database — never abbreviate or alter them.
10. When multiple strains are in the context, prioritize the one whose name most closely matches what the user asked for. If ambiguous, mention all matching strains and let the user clarify.

## RESPONSE STYLE
11. **BLUF — Bottom Line Up Front.** Always open with a single, direct sentence that answers the user's question. Then spend the remaining 1-2 paragraphs backing up that answer with data from our database (effects, terpenes, cannabinoids, report frequencies, etc.).
12. **Maximum 3 short paragraphs.** Many answers need only 1-2. Keep it tight and conversational — no padding, no filler.
13. **NEVER use bullet points or numbered lists.** Write in flowing prose paragraphs only.
14. Use **bold** to emphasize strain names, key effects, and important data points within sentences.
15. When mentioning effects, reference their report-frequency tier (Very High, High, Moderate, Low, Rare) and percentage naturally in prose — e.g. "**Energetic** is its top-reported effect (Very High, 100%)" — NEVER list them as bullets.
16. Effects are ranked by community report frequency relative to each strain's most-reported effect. The percentage and tier label in the data reflect how often an effect is reported compared to the top effect for that strain. Use these numbers accurately — do NOT say 100% for everything.
17. When comparing strains, weave the comparison into paragraphs — do NOT use tables or side-by-side lists.

## STRAIN RECOMMENDATIONS
18. When a **RECOMMENDATION ANALYSIS** section is provided, you are acting as a personalized strain advisor. The strains were pre-selected and ranked by our matching algorithm. Lead with your top 2-3 picks and explain WHY each fits using their effect data (report percentages, terpene profiles). If the user wants to avoid certain effects, proactively address how your picks minimize those. Be analytical and specific — cite the data, not vague claims. Think "knowledgeable budtender."
19. For recommendations, you may use up to 4 short paragraphs to cover multiple picks. Still BLUF — open with your #1 pick and why.

## DATABASE CONTEXT
Total strains in database: ${strains.length}
Some strains are marked "⚠️ PARTIAL DATA" — these have limited community-reported data and have NOT been extensively lab tested. When discussing partial-data strains, always include the disclaimer: "Note: This strain has limited data in our database and has not been extensively lab tested. The information shown is based on available community reports."
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
  const zipCode = (body.zipCode || '').replace(/\D/g, '').slice(0, 5)

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Missing required field: message' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }

  const userMessage = message.trim().slice(0, 500) // cap input length

  // ── Resolve user's region from zip code ────────────────────────────
  const userZipPrefix = zipCode.length >= 3 ? zipCode.slice(0, 3) : ''
  const userRegion = userZipPrefix ? regionMap[userZipPrefix] || '' : ''
  const userRegionIndex = userRegion ? regionOrder.indexOf(userRegion) : -1

  // ── Build conversation context for broader search ─────────────────
  // Pool strain names from recent user messages so follow-ups still find strains
  const conversationContext = (history || [])
    .filter(h => h.role === 'user')
    .map(h => h.content || '')
    .join(' ')
    .slice(0, 500)

  // ── Search the database (recommendation-aware) ─────────────────────
  let matchedStrains = []
  let recommendationAnalysis = ''

  // Try effect-based recommendation search first
  if (isRecommendationQuery(userMessage)) {
    const parsed = parseEffectQuery(userMessage)
    if (parsed.desiredEffects.length > 0 || parsed.typePreference) {
      const scored = recommendationSearch(parsed, userRegionIndex)
      if (scored.length > 0) {
        matchedStrains = scored.map(r => r.strain)
        // Build analysis block so the AI knows WHY these strains were chosen
        const lines = [`\n## RECOMMENDATION ANALYSIS`]
        lines.push(`User is seeking: ${parsed.desiredEffects.length ? parsed.desiredEffects.join(', ') : 'general recommendation'}`)
        if (parsed.avoidEffects.length) lines.push(`User wants to AVOID: ${parsed.avoidEffects.join(', ')}`)
        if (parsed.typePreference) lines.push(`Type preference: ${parsed.typePreference}`)
        lines.push(`\nThese ${scored.length} strains were selected and ranked by our matching algorithm:`)
        for (const r of scored) {
          lines.push(`  ${r.strain.name} (score: ${r.score}) — ${r.matchNotes.join(', ')}`)
        }
        lines.push(`\nPresent the top 2-3 strains as recommendations. Explain WHY each fits using the effect data above. If any strain has a ⚠ warning, acknowledge it honestly.`)
        recommendationAnalysis = lines.join('\n')
      }
    }
  }

  // Fall back to name-based search if recommendation search didn't find results
  if (matchedStrains.length === 0) {
    matchedStrains = searchStrains(userMessage, conversationContext)
  }

  let dbContext = ''
  if (matchedStrains.length > 0) {
    const strainBlocks = matchedStrains.map(s => formatStrainContext(s, userRegionIndex, userRegion)).join('\n\n---\n\n')
    const regionNote = userRegion
      ? `\n\n## USER LOCATION\nThe user is in the **${REGION_LABELS[userRegion] || userRegion}** region (zip: ${zipCode}). Each strain's "Regional Availability" score indicates how commonly it's found in their area. When relevant, briefly mention availability — e.g., "This strain is common in your area" or "This one may be harder to find near you." Don't force it into every answer — only mention when the user is asking about finding or choosing strains.`
      : ''
    dbContext = `\n## MATCHING STRAINS (from our database)\nThe following ${matchedStrains.length} strain(s) were found in the MyStrainAI database. All data below is verified and must be used when answering. Strains marked "⚠️ PARTIAL DATA" have limited data — always include the partial data disclaimer when discussing them.\n\n${strainBlocks}\n\n---\n**REMINDER: Use the effects, terpenes, and cannabinoids shown above when answering the user's question. For any strain marked PARTIAL DATA, include the disclaimer about limited data.**${regionNote}${recommendationAnalysis}`
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
