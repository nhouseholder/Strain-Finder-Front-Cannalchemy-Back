import { useState, useMemo, useCallback, useEffect, useRef } from 'react'

// Lazy-loaded strain data — loaded on first use, not at bundle time.
// This keeps strains.json (~1.4MB) out of the initial chunk.
let _strainsCache = null
let _strainsPromise = null

function loadStrains() {
  if (_strainsCache) return Promise.resolve(_strainsCache)
  if (!_strainsPromise) {
    _strainsPromise = import('../data/strains.json').then((mod) => {
      _strainsCache = mod.default || mod
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
    return strainsData
      .filter(s =>
        s.name.toLowerCase().includes(lower) ||
        s.type.toLowerCase().includes(lower) ||
        s.effects?.some(e => e.toLowerCase().includes(lower)) ||
        s.flavors?.some(f => f.toLowerCase().includes(lower))
      )
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

  return { query, setQuery, results, getStrainByName, getStrainById, allStrains: strainsData }
}
