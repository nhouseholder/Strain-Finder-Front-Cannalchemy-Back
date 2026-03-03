import { isValidStrainName } from '../utils/validators'

export function parseStrainResponse(rawText) {
  // Strip markdown code fences
  let cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

  // Try to extract the JSON object by finding balanced braces
  const json = extractBalancedJSON(cleaned)
  if (!json) {
    throw new Error('Could not find valid JSON in response')
  }

  // Attempt to fix common LLM JSON issues before parsing
  const fixed = fixCommonJSONIssues(json)

  let parsed
  try {
    parsed = JSON.parse(fixed)
  } catch (e) {
    // Last resort: try to extract just the strains array
    const fallback = tryFallbackParse(cleaned)
    if (fallback) {
      parsed = fallback
    } else {
      console.error('JSON parse failed. Raw text (first 500 chars):', cleaned.slice(0, 500))
      throw new Error('Failed to parse strain data from API response')
    }
  }

  return normalizeResponse(parsed)
}

/**
 * Find the outermost balanced { ... } in the text.
 * Handles nested braces properly instead of using lastIndexOf.
 */
function extractBalancedJSON(text) {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (ch === '\\' && inString) {
      escape = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  // If braces never balanced, return from start to end (truncated response)
  // and try to fix it
  return text.slice(start)
}

/**
 * Fix common JSON issues from LLM output:
 * - Trailing commas before ] or }
 * - Unescaped newlines in strings
 * - Missing closing brackets at end (truncated response)
 */
function fixCommonJSONIssues(json) {
  let fixed = json

  // Remove trailing commas before } or ]
  fixed = fixed.replace(/,\s*([}\]])/g, '$1')

  // Count unmatched brackets and add closing ones
  let braces = 0
  let brackets = 0
  let inStr = false
  let esc = false

  for (let i = 0; i < fixed.length; i++) {
    const ch = fixed[i]
    if (esc) { esc = false; continue }
    if (ch === '\\' && inStr) { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{') braces++
    else if (ch === '}') braces--
    else if (ch === '[') brackets++
    else if (ch === ']') brackets--
  }

  // Close any unclosed brackets/braces (truncated response)
  while (brackets > 0) { fixed += ']'; brackets-- }
  while (braces > 0) { fixed += '}'; braces-- }

  return fixed
}

/**
 * Fallback: try to find and parse just the "strains" array
 */
function tryFallbackParse(text) {
  // Try to find "strains": [...] pattern
  const strainsMatch = text.match(/"strains"\s*:\s*\[/)
  if (!strainsMatch) return null

  const arrStart = text.indexOf('[', strainsMatch.index)
  if (arrStart === -1) return null

  // Find balanced array
  let depth = 0
  let inStr = false
  let esc = false

  for (let i = arrStart; i < text.length; i++) {
    const ch = text[i]
    if (esc) { esc = false; continue }
    if (ch === '\\' && inStr) { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        const arrStr = text.slice(arrStart, i + 1)
        try {
          const strains = JSON.parse(fixCommonJSONIssues(arrStr))
          return { strains, aiPicks: [] }
        } catch {
          return null
        }
      }
    }
  }

  // Try with auto-closed brackets
  let arrStr = text.slice(arrStart)
  arrStr = fixCommonJSONIssues(arrStr)
  try {
    const strains = JSON.parse(arrStr)
    return { strains, aiPicks: [] }
  } catch {
    return null
  }
}

function normalizeResponse(data) {
  const strains = (data.strains || [])
    .filter(s => isValidStrainName(s.name))
    .map(normalizeStrain)

  const aiPicks = (data.aiPicks || []).filter(p => isValidStrainName(p.name))

  return {
    strains,
    aiPicks,
    idealProfile: data.idealProfile || null,
  }
}

function normalizeStrain(s) {
  const type = (s.type || 'hybrid').toLowerCase()
  const validTypes = ['indica', 'sativa', 'hybrid']

  return {
    name: s.name?.trim() || 'Unknown',
    type: validTypes.includes(type) ? type : 'hybrid',
    matchPct: clamp(s.matchPct || 0, 0, 100),
    thc: clamp(s.thc || 0, 0, 40),
    cbd: clamp(s.cbd || 0, 0, 30),
    genetics: s.genetics || 'Unknown lineage',
    lineage: s.lineage || null,
    effects: Array.isArray(s.effects) ? s.effects.slice(0, 6) : [],
    terpenes: normalizeTerpenes(s.terpenes),
    cannabinoids: normalizeCannabinoids(s),
    sommelierNotes: s.sommelierNotes || null,
    sommelierScores: s.sommelierScores || null,
    whyMatch: s.whyMatch || '',
    forumAnalysis: normalizeForumAnalysis(s.forumAnalysis),
    sentimentScore: clamp(s.sentimentScore || s.forumAnalysis?.sentimentScore || 7.0, 3.5, 9.2),
    bestFor: Array.isArray(s.bestFor) ? s.bestFor : [],
    notIdealFor: Array.isArray(s.notIdealFor) ? s.notIdealFor : [],
    description: s.description || '',
  }
}

function normalizeTerpenes(terps) {
  if (!Array.isArray(terps)) return []
  return terps.map(t => ({
    name: t.name || 'Unknown',
    pct: t.pct || '0%',
  }))
}

function normalizeCannabinoids(s) {
  const defaults = [
    { name: 'THC', value: s.thc || 0, color: '#32c864' },
    { name: 'CBD', value: s.cbd || 0, color: '#3b82f6' },
    { name: 'CBN', value: 0, color: '#a855f7' },
    { name: 'CBG', value: 0, color: '#f59e0b' },
    { name: 'THCV', value: 0, color: '#ef4444' },
    { name: 'CBC', value: 0, color: '#22d3ee' },
  ]

  if (Array.isArray(s.cannabinoids)) {
    return defaults.map(d => {
      const found = s.cannabinoids.find(c => c.name?.toUpperCase() === d.name)
      return found ? { ...d, value: clamp(found.value || 0, 0, 40) } : d
    })
  }
  return defaults
}

function normalizeForumAnalysis(fa) {
  if (!fa) return null
  return {
    totalReviews: fa.totalReviews || 'N/A',
    sentimentScore: clamp(fa.sentimentScore || 7.0, 3.5, 9.2),
    pros: Array.isArray(fa.pros) ? fa.pros.map(p => ({
      effect: p.effect || '',
      pct: clamp(p.pct || 0, 0, 100),
      baseline: p.baseline || null,
    })) : [],
    cons: Array.isArray(fa.cons) ? fa.cons.map(c => ({
      effect: c.effect || '',
      pct: clamp(c.pct || 0, 0, 100),
      baseline: c.baseline || null,
    })) : [],
    sources: fa.sources || null,
  }
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, typeof val === 'number' ? val : parseFloat(val) || min))
}
