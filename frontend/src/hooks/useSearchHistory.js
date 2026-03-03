/**
 * useSearchHistory — persists strain search queries per user.
 *
 * Each entry stores what the user searched for and when, so the dashboard
 * can show a browsable history of strain lookups.
 *
 * Storage key: `sf-search-history-<uid>` (per-account)
 */
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const PREFIX = 'sf-search-history'
const MAX_ENTRIES = 30

function storageKey(uid) {
  return `${PREFIX}-${uid || 'anon'}`
}

function load(uid) {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useSearchHistory() {
  const { user } = useAuth()
  const uid = user?.uid || null
  const [entries, setEntries] = useState(() => load(uid))

  useEffect(() => {
    setEntries(load(uid))
  }, [uid])

  useEffect(() => {
    localStorage.setItem(storageKey(uid), JSON.stringify(entries))
  }, [entries, uid])

  /**
   * Record a strain search.
   * @param {string} query — the search text
   * @param {string} [strainName] — selected strain name (if autocomplete select)
   * @param {string} [strainType] — indica/sativa/hybrid
   */
  const recordSearch = useCallback((query, strainName, strainType) => {
    if (!query || query.trim().length < 2) return
    const entry = {
      id: `srch-${Date.now()}`,
      date: new Date().toISOString(),
      query: query.trim(),
      strainName: strainName || null,
      strainType: strainType || null,
    }
    setEntries(prev => {
      // Dedupe same query within last 60s
      const recent = prev[0]
      if (recent && recent.query === entry.query && Date.now() - new Date(recent.date).getTime() < 60000) {
        return prev
      }
      return [entry, ...prev].slice(0, MAX_ENTRIES)
    })
    return entry
  }, [])

  const deleteEntry = useCallback((id) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setEntries([])
  }, [])

  return { searchHistory: entries, recordSearch, deleteEntry, clearAll }
}
