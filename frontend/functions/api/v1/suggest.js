/**
 * Cloudflare Pages Function — AI-Powered Strain Suggestions
 * 
 * Analyzes a user's rating history and preference profile,
 * then uses the 6-layer matching engine + Workers AI (Llama 3.3 70B)
 * to find new strains the user will love.
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

// ── Helpers ──────────────────────────────────────────────────────────
function buildEffectMap() {
  const map = {}
  for (const strain of strainData.strains) {
    map[strain.name.toLowerCase()] = strain
  }
  return map
}

const strainLookup = buildEffectMap()

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
}

/**
 * Score a candidate strain against a user's preference profile.
 * Uses type affinity, effect alignment, terpene pattern matching,
 * and cannabinoid sweet-spot proximity.
 */
function scoreCandidate(strain, profile) {
  let score = 50 // neutral baseline

  // 1. Type affinity (30 points max)
  const typeAffinity = profile.type_affinity || {}
  const typeScore = typeAffinity[strain.type] || 0
  score += typeScore * 30

  // 2. Effect alignment (30 points max)
  const effectAffinity = profile.effect_affinity || []
  const strainEffects = new Set((strain.effects || []).map(e => e.name?.toLowerCase()))
  let effectScore = 0
  let effectWeight = 0
  for (const pref of effectAffinity) {
    const weight = Math.abs(pref.score || 0)
    effectWeight += weight
    if (strainEffects.has(pref.effect?.toLowerCase())) {
      effectScore += pref.score > 0 ? weight : -weight * 1.5 // penalize disliked effects harder
    }
  }
  if (effectWeight > 0) score += (effectScore / effectWeight) * 30

  // 3. Terpene pattern match (20 points max)
  const terpPrefs = profile.terpene_preferences || []
  const strainTerps = new Map((strain.terpenes || []).map(t => [t.name?.toLowerCase(), parseFloat(t.pct) || 0]))
  let terpScore = 0
  for (const tp of terpPrefs) {
    if (strainTerps.has(tp.terpene?.toLowerCase())) {
      terpScore += (tp.avg_pct || 0.1) * (tp.frequency || 0.5)
    }
  }
  score += Math.min(terpScore * 40, 20)

  // 4. Cannabinoid sweet-spot (20 points max)
  const cannPrefs = profile.cannabinoid_preferences || []
  for (const cp of cannPrefs) {
    const strainVal = (strain.cannabinoids || []).find(c => c.name?.toLowerCase() === cp.cannabinoid?.toLowerCase())?.value || 0
    const sweetSpot = cp.sweet_spot || 0
    const distance = Math.abs(strainVal - sweetSpot)
    score += Math.max(0, 10 - distance * 0.8) // up to 10 per cannabinoid
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

// ── Main Handler ────────────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request: req, env } = context

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }

  const { ratings, profile } = body
  if (!ratings?.length) {
    return new Response(JSON.stringify({ error: 'No ratings provided' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }

  // Build set of already-rated strains to exclude
  const ratedNames = new Set(ratings.map(r => (r.strain_name || r.strainName || '').toLowerCase()))

  // Score all unrated strains against the preference profile
  const candidates = strainData.strains
    .filter(s => !ratedNames.has(s.name.toLowerCase()))
    .map(strain => {
      const baseScore = profile ? scoreCandidate(strain, profile) : 50
      // Availability boost: common strains get a gentle nudge up
      const avail = strain.availability || 5
      const availBoost = ((avail - 5) / 5) * 4 // ±4 point swing
      const score = Math.max(0, Math.min(100, Math.round(baseScore + availBoost)))
      return { strain, score }
    })
    .sort((a, b) => b.score - a.score)

  // Top 6 algorithmic suggestions
  const topCandidates = candidates.slice(0, 6)

  // Build suggestions with rich data
  const suggestions = topCandidates.map(({ strain, score }) => {
    const effects = (strain.effects || [])
      .filter(e => e.category === 'positive' || e.category === 'medical')
      .sort((a, b) => (b.reports || 0) - (a.reports || 0))
      .slice(0, 4)
      .map(e => capitalize(e.name))
    const terpenes = (strain.terpenes || []).slice(0, 3).map(t => ({
      name: capitalize(t.name), pct: t.pct,
    }))
    const thc = (strain.cannabinoids || []).find(c => c.name?.toLowerCase() === 'thc')?.value || 0
    const cbd = (strain.cannabinoids || []).find(c => c.name?.toLowerCase() === 'cbd')?.value || 0

    return {
      name: strain.name,
      type: strain.type || 'hybrid',
      matchScore: score,
      thc: Math.round(thc * 10) / 10,
      cbd: Math.round(cbd * 10) / 10,
      effects,
      terpenes,
      description: strain.description || '',
      bestFor: strain.best_for || [],
    }
  })

  // ── Workers AI: Generate personalized explanation ──────────────────
  let aiExplanation = null
  if (env?.AI && profile) {
    try {
      // Build a concise summary of the user's taste profile
      const topRated = ratings
        .filter(r => (r.rating || 0) >= 4)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 5)
        .map(r => `${r.strain_name || r.strainName} (${r.rating}★)`)
        .join(', ')

      const lovedEffects = (profile.effect_affinity || [])
        .filter(e => e.score > 0.3)
        .slice(0, 5)
        .map(e => capitalize(e.effect))
        .join(', ')

      const avoidedEffects = (profile.effect_affinity || [])
        .filter(e => e.score < -0.3)
        .slice(0, 3)
        .map(e => capitalize(e.effect))
        .join(', ')

      const favTerps = (profile.terpene_preferences || [])
        .slice(0, 3)
        .map(t => capitalize(t.terpene))
        .join(', ')

      const suggestionNames = suggestions.slice(0, 3).map(s => `${s.name} (${s.type})`).join(', ')

      const prompt = `You are a cannabis preference analyst for an AI recommendation app called MyStrainAI. A user has been rating strains and we've built a preference profile. Based on their profile, our algorithm has found new strain suggestions. Write a brief, personalized explanation (3-4 sentences) of WHY these suggestions match their taste.

User's Profile Summary:
- Top-rated strains: ${topRated || 'Still building preferences'}
- Effects they love: ${lovedEffects || 'Various'}
- Effects they avoid: ${avoidedEffects || 'None noted'}
- Preferred terpenes: ${favTerps || 'Still learning'}
- Type preference: ${JSON.stringify(profile.type_affinity || {})}
- Total ratings: ${ratings.length}

Our top suggestions for them: ${suggestionNames}

Write a warm, personalized explanation addressing the user directly. Reference their specific preferences and explain the terpene/effect science behind why these suggestions fit. Be concise and scientific but accessible. Do NOT make medical claims. Start directly — no greeting.`

      const result = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: 'You are a cannabis science expert and personal taste analyst. Be warm, personalized, and scientifically grounded. Never make medical claims.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
      })

      if (result?.response) {
        aiExplanation = result.response
      }
    } catch (err) {
      console.error('Workers AI suggestion error (non-fatal):', err.message)
    }
  }

  return new Response(JSON.stringify({
    suggestions,
    aiExplanation,
    basedOn: `${ratings.length} rating${ratings.length === 1 ? '' : 's'}`,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
