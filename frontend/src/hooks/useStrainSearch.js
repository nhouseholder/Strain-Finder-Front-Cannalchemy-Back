import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { normalizeStrain } from '../utils/normalizeStrain'

/**
 * Client-side safety net: filter out strain entries that shouldn't appear
 * in search results (crosses, breeder products, auto tags, etc.).
 * The export script already filters these, but this catches any stragglers.
 */
function isSearchEligible(name) {
  if (!name || name.length < 2) return false
  // Crosses: "A x B" or "A × B"
  if (/\s+x\s+/i.test(name) || name.includes('×')) return false
  // Breeder-tagged: "Strain - Company"
  if (/\s+-\s+\w/.test(name)) return false
  // AUTO prefix or suffix
  if (/^auto\s/i.test(name) || /\bAUTO$/i.test(name)) return false
  // Seed/breeder product terms
  if (/\b(autoflower|seeds?\s+(female|regular|feminized)|reg\s+\d+pk|cannabis seeds)\b/i.test(name)) return false
  // Very long names
  if (name.length > 35) return false
  // Product bundles
  if (/\b(mix\s*\d|gift\s*set|box\s*set|best\s*sellers|beginner|bundle|collection)\b/i.test(name)) return false
  // Breeder brands
  if (/\b(blimburn|extraction|fast\s*version|fast\s*flowering)\b/i.test(name)) return false
  // Generation markers (F1, S1, BX2) except AK-47, GG4, OG
  if (/\b(f\d+|s\d+|bx\d+)\b/i.test(name) && !/^(ak|gg|og)/i.test(name)) return false
  // Club/Don/Research prefixes
  if (/^(club|don|research)\s/i.test(name)) return false
  // Lineage notation in parens
  if (/\(.*\b(LINE|REG|FEM)\b.*\)/i.test(name)) return false
  return true
}

// Lazy-loaded strain data — loaded on first use, not at bundle time.
// This keeps strains.json (~1.4MB) out of the initial chunk.
let _strainsCache = null
let _strainsPromise = null

function loadStrains() {
  if (_strainsCache) return Promise.resolve(_strainsCache)
  if (!_strainsPromise) {
    _strainsPromise = import('../data/strains.json').then((mod) => {
      const raw = mod.default || mod
      _strainsCache = raw.filter(s => isSearchEligible(s.name)).map(normalizeStrain)
      return _strainsCache
    })
  }
  return _strainsPromise
}

export function useStrainSearch() {
  const [query, setQuery] = useState('')
  const [strainsData, setStrainsData] = useState(_strainsCache || [])
  const loaded = useRef(!!_strainsCache)

  useEffect(() => {
    if (loaded.current) return
    loadStrains().then((data) => {
      setStrainsData(data)
      loaded.current = true
    })
  }, [])

  const results = useMemo(() => {
    if (!query || query.length < 2 || strainsData.length === 0) return []
    const lower = query.toLowerCase()
    const str = (v) => (typeof v === 'string' ? v : String(v || ''))
    return strainsData
      .filter(s => {
        try {
          return (
            str(s.name).toLowerCase().includes(lower) ||
            str(s.type).toLowerCase().includes(lower) ||
            (Array.isArray(s.effects) && s.effects.some(e => str(typeof e === 'string' ? e : e?.name || '').toLowerCase().includes(lower))) ||
            (Array.isArray(s.flavors) && s.flavors.some(f => str(f).toLowerCase().includes(lower)))
          )
        } catch { return false }
      })
      .slice(0, 20)
  }, [query, strainsData])

  const getStrainByName = useCallback((name) => {
    const data = _strainsCache || strainsData
    return data.find(s => s.name.toLowerCase() === name?.toLowerCase())
  }, [strainsData])

  const getStrainById = useCallback((id) => {
    const data = _strainsCache || strainsData
    return data.find(s => s.id === id)
  }, [strainsData])

  const dataLoaded = strainsData.length > 0

  return { query, setQuery, results, getStrainByName, getStrainById, allStrains: strainsData, dataLoaded }
}
