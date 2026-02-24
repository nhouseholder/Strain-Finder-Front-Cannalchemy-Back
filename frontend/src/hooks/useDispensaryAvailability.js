/**
 * Shared dispensary availability hook — module-level singleton.
 *
 * One search populates data for ALL components on the page.
 * Components subscribe via useState + useEffect (no Context needed).
 *
 * Usage:
 *   const { dispensaries, availability, loading, fetchIfNeeded } = useDispensaryAvailability()
 *   fetchIfNeeded('90210', ['Blue Dream', 'OG Kush'])
 *   const spots = availability['Blue Dream']  // [{ dispensaryName, distance, price }]
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { searchDispensaries, buildStrainAvailability, getRegionKey } from '../services/dispensarySearch'
import { RateLimitError } from '../services/anthropicApi'

/* ── Module-level singleton state ──────────────────────────────── */
let _dispensaries = []
let _availability = {}  // strain → [{ dispensaryName, distance, price, menuUrl, delivery }]
let _loading = false
let _error = null
let _locationUsed = null
let _listeners = new Set()

function _notify() {
  for (const fn of _listeners) fn({})
}

function _setState(patch) {
  if ('dispensaries' in patch) {
    _dispensaries = patch.dispensaries
    _availability = buildStrainAvailability(patch.dispensaries)
  }
  if ('loading' in patch) _loading = patch.loading
  if ('error' in patch) _error = patch.error
  if ('locationUsed' in patch) _locationUsed = patch.locationUsed
  _notify()
}

let _fetchPromise = null

async function _doFetch(location, strainNames, budgetDesc) {
  if (_loading) return _fetchPromise
  _setState({ loading: true, error: null, locationUsed: location })

  _fetchPromise = (async () => {
    try {
      const results = await searchDispensaries(location, strainNames, { budgetDesc })
      _setState({ dispensaries: results, loading: false })
    } catch (err) {
      if (err instanceof RateLimitError) {
        _setState({ loading: false, error: `Rate limited. Retry in ${err.retryAfter}s` })
      } else {
        _setState({ loading: false, error: err.message || 'Dispensary search failed' })
      }
    } finally {
      _fetchPromise = null
    }
  })()

  return _fetchPromise
}

/* ── React hook ──────────────────────────────────────────────── */
export function useDispensaryAvailability() {
  const [, setTick] = useState({}) // force re-render on _notify
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const listener = (v) => { if (mounted.current) setTick(v) }
    _listeners.add(listener)
    return () => {
      mounted.current = false
      _listeners.delete(listener)
    }
  }, [])

  /**
   * Trigger fetch only if we don't already have data for this region.
   * Safe to call on every render — it's a no-op if data exists.
   */
  const fetchIfNeeded = useCallback((location, strainNames, budgetDesc) => {
    if (!location || !strainNames?.length) return
    // Skip if already loaded for this region or currently loading
    const newRegion = getRegionKey(location)
    const currentRegion = _locationUsed ? getRegionKey(_locationUsed) : null
    if (_dispensaries.length > 0 && newRegion === currentRegion) return
    if (_loading) return
    _doFetch(location, strainNames, budgetDesc)
  }, [])

  /**
   * Force a fresh search regardless of cache.
   */
  const forceSearch = useCallback((location, strainNames, budgetDesc) => {
    if (!location || !strainNames?.length) return
    _doFetch(location, strainNames, budgetDesc)
  }, [])

  /**
   * Get availability info for a specific strain.
   */
  const getStrainAvailability = useCallback((strainName) => {
    return _availability[strainName] || []
  }, [])

  /**
   * Reset all state (e.g., when user starts new quiz).
   */
  const reset = useCallback(() => {
    _dispensaries = []
    _availability = {}
    _loading = false
    _error = null
    _locationUsed = null
    _notify()
  }, [])

  return {
    dispensaries: _dispensaries,
    availability: _availability,
    loading: _loading,
    error: _error,
    locationUsed: _locationUsed,
    fetchIfNeeded,
    forceSearch,
    getStrainAvailability,
    reset,
    hasData: _dispensaries.length > 0,
  }
}
