/**
 * strain-matcher.mjs — Shared strain matching logic
 *
 * Loads the strain database and provides 3-tier matching:
 *   Tier 1: Exact normalized name match
 *   Tier 2: Fuzzy match (Levenshtein ≤ 2)
 *   Tier 3: Substring match (≥7 chars, ≥40% ratio)
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ── Load strain database ──────────────────────────────────────────── */

export function loadStrainDB() {
  const jsonPath = resolve(__dirname, '../../frontend/src/data/strains.json')
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'))

  const exactMap = new Map()
  const nameList = []

  for (const s of raw) {
    const norm = normalizeName(s.name)
    const summary = {
      name: s.name,
      slug: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      type: s.type,
      thc: s.cannabinoids?.find(c => c.name === 'thc')?.value ?? null,
      cbd: s.cannabinoids?.find(c => c.name === 'cbd')?.value ?? null,
      topEffects: (s.effects || []).slice(0, 3).map(e => e.name),
      topTerpenes: (s.terpenes || []).slice(0, 3).map(t => t.name),
    }
    exactMap.set(norm, summary)
    nameList.push({ norm, summary })
  }

  console.log(`[StrainDB] Loaded ${exactMap.size} strains for matching`)
  return { exactMap, nameList }
}

/* ── Normalize strain name ─────────────────────────────────────────── */

export function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/* ── Excluded words (too generic to match) ─────────────────────────── */

export const EXCLUDED = new Set([
  'sativa', 'indica', 'hybrid', 'strain', 'unknown', 'na', 'flower',
  'indoor', 'outdoor', 'greenhouse', 'premium', 'classic', 'gold',
  'cream', 'lemon', 'grape', 'orange', 'mango', 'cherry', 'lime',
  'gello', 'sunshine', 'diamond', 'fire', 'ice', 'thunder', 'sugar',
  'honey', 'butter', 'cake', 'candy', 'cookie', 'cookies',
])

/* ── Clean menu item name (strip brands, weights, etc.) ────────────── */

export function cleanMenuItemName(menuItemName) {
  return (menuItemName || '')
    // Weight / measurement patterns
    .replace(/\s*[-–|]\s*\d+(\.\d+)?\s*g\b/gi, '')
    .replace(/\s*\(\d+(\.\d+)?\s*g\)/gi, '')
    .replace(/\s*\[\d+(\.\d+)?\s*g\]/gi, '')
    .replace(/\b\d+(\.\d+)?\s*g(ram)?s?\b/gi, '')
    .replace(/\b(1\/2\s*oz|half\s*oz|quarter|eighth|oz|ounce)\b/gi, '')
    // Type / quality indicators
    .replace(/\s*[-–|]\s*(indica|sativa|hybrid)\b/gi, '')
    .replace(/\s*[-–|]\s*(small|smalls|smallz|popcorn|shake|trim|minis)\b/gi, '')
    .replace(/\s*[-–|]\s*(indoor|outdoor|greenhouse|light dep)\b/gi, '')
    .replace(/\s*[-–|]\s*(flower|premium|gold cuts|classic cuts|top shelf|reserve|exclusive)\b/gi, '')
    .replace(/\b(pre-?roll|pre-?packed|infused|enhanced|live\s*resin)\b/gi, '')
    // Brand patterns (pipe/dash separated brand prefixes)
    .replace(/\bdime\s*bag\s*[-|]\s*/gi, '')
    .replace(/\bmr\.?\s*zips?\s*[-|]\s*/gi, '')
    .replace(/\bcam\s*[-|]\s*/gi, '')
    .replace(/\b3\s*bros\s*[-|]\s*/gi, '')
    .replace(/\bslugg?ers\s*[-|]\s*(jarred\s*)?flower\s*[-|]\s*\d+g\s*[-|]\s*/gi, '')
    .replace(/\bconnected\s*(cannabis)?\s*[-|]\s*/gi, '')
    .replace(/\balien\s*labs?\s*[-|]\s*/gi, '')
    .replace(/\bjungle\s*boys?\s*[-|]\s*/gi, '')
    .replace(/\bcookies?\s*(fam)?\s*[-|]\s*/gi, '')
    .replace(/\bstiiizy\s*[-|]\s*/gi, '')
    .replace(/\braw\s*garden\s*[-|]\s*/gi, '')
    .replace(/\bfig\s*farms?\s*[-|]\s*/gi, '')
    .replace(/\bpackwoods?\s*[-|]\s*/gi, '')
    .replace(/\bjeeter\s*[-|]\s*/gi, '')
    .replace(/\bglass\s*house\s*[-|]\s*/gi, '')
    .replace(/\bcresco\s*[-|]\s*/gi, '')
    .replace(/\bcuraleaf\s*[-|]\s*/gi, '')
    .replace(/\bselect\s*[-|]\s*/gi, '')
    .replace(/\bverano\s*[-|]\s*/gi, '')
    .replace(/\bgti\s*[-|]\s*/gi, '')
    .replace(/\btrulieve\s*[-|]\s*/gi, '')
    .replace(/\bcolumbia\s*care\s*[-|]\s*/gi, '')
    .replace(/\bholistic\s*industries?\s*[-|]\s*/gi, '')
    .replace(/\baeyr\s*wellness\s*[-|]\s*/gi, '')
    .replace(/\bflowery?\s*[-|]\s*/gi, '')
    .replace(/\bitem\s*nine\s*[-|]\s*/gi, '')
    .replace(/\bgrow\s*sciences?\s*[-|]\s*/gi, '')
    .replace(/\bpotent\s*planet\s*[-|]\s*/gi, '')
    .replace(/\babsolute\s*xtracts?\s*[-|]\s*/gi, '')
    .replace(/\btru\s*infusion\s*[-|]\s*/gi, '')
    .replace(/\bmint\s*[-|]\s*/gi, '')
    .replace(/\bcanamo\s*[-|]\s*/gi, '')
    // Generic brand prefix pattern: "Brand Name | " or "Brand Name - "
    .replace(/^[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?\s*[-|]\s+/, '')
    // Misc cleanup
    .replace(/\s+/g, ' ')
    .trim()
}

/* ── 3-Tier Strain Matching ────────────────────────────────────────── */

export function matchStrain(menuItemName, strainDB) {
  const cleaned = cleanMenuItemName(menuItemName)
  const norm = normalizeName(cleaned)
  if (!norm || norm.length < 4) return null

  // Tier 1: Exact match
  if (strainDB.exactMap.has(norm) && !EXCLUDED.has(norm)) {
    return { ...strainDB.exactMap.get(norm), matchTier: 'exact' }
  }

  // Tier 2: Fuzzy match (Levenshtein ≤ 2)
  for (const { norm: dbNorm, summary } of strainDB.nameList) {
    if (EXCLUDED.has(dbNorm)) continue
    if (Math.abs(norm.length - dbNorm.length) > 2) continue
    if (levenshtein(norm, dbNorm) <= 2) {
      return { ...summary, matchTier: 'fuzzy' }
    }
  }

  // Tier 3: Substring (≥7 chars, ≥40% ratio)
  for (const { norm: dbNorm, summary } of strainDB.nameList) {
    if (EXCLUDED.has(dbNorm)) continue
    if (dbNorm.length < 7) continue
    if (norm.includes(dbNorm) && (dbNorm.length / norm.length) >= 0.4) {
      return { ...summary, matchTier: 'substring' }
    }
  }

  return null
}

/* ── Levenshtein Distance ──────────────────────────────────────────── */

export function levenshtein(a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  if (Math.abs(a.length - b.length) > 2) return 3
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  return matrix[b.length][a.length]
}
