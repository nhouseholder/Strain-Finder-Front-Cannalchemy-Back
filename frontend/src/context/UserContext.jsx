import { createContext, useReducer, useEffect, useCallback } from 'react'

const KEYS = {
  FAVORITES: 'ca-user-favorites',
  JOURNAL: 'ca-user-journal',
  RECENT: 'ca-user-recent',
  DISMISSED: 'ca-user-dismissed',
}

function loadJSON(key, fallback) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

const initialState = {
  favorites: [],
  dismissed: [],
  journal: [],
  recentSearches: [],
}

function userReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_FAVORITE': {
      const name = action.payload
      const favorites = state.favorites.includes(name)
        ? state.favorites.filter(f => f !== name)
        : [...state.favorites, name]
      return { ...state, favorites }
    }
    case 'DISMISS_STRAIN': {
      const dismissed = [...new Set([...state.dismissed, action.payload])]
      return { ...state, dismissed }
    }
    case 'ADD_JOURNAL_ENTRY':
      return { ...state, journal: [action.payload, ...state.journal] }
    case 'UPDATE_JOURNAL_ENTRY':
      return {
        ...state,
        journal: state.journal.map(e => e.id === action.payload.id ? action.payload : e),
      }
    case 'DELETE_JOURNAL_ENTRY':
      return { ...state, journal: state.journal.filter(e => e.id !== action.payload) }
    case 'ADD_RECENT_SEARCH': {
      const recentSearches = [action.payload, ...state.recentSearches].slice(0, 5)
      return { ...state, recentSearches }
    }
    case 'CLEAR_RECENT':
      return { ...state, recentSearches: [] }
    default:
      return state
  }
}

export const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, initialState, () => ({
    favorites: loadJSON(KEYS.FAVORITES, []),
    dismissed: loadJSON(KEYS.DISMISSED, []),
    journal: loadJSON(KEYS.JOURNAL, []),
    recentSearches: loadJSON(KEYS.RECENT, []),
  }))

  useEffect(() => {
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(state.favorites))
  }, [state.favorites])

  useEffect(() => {
    localStorage.setItem(KEYS.DISMISSED, JSON.stringify(state.dismissed))
  }, [state.dismissed])

  useEffect(() => {
    localStorage.setItem(KEYS.JOURNAL, JSON.stringify(state.journal))
  }, [state.journal])

  useEffect(() => {
    localStorage.setItem(KEYS.RECENT, JSON.stringify(state.recentSearches))
  }, [state.recentSearches])

  const isFavorite = useCallback((name) => state.favorites.includes(name), [state.favorites])

  const getJournalForStrain = useCallback(
    (name) => state.journal.filter(e => e.strainName?.toLowerCase() === name?.toLowerCase()),
    [state.journal]
  )

  const getJournalStats = useCallback(() => {
    if (state.journal.length === 0) return null
    const entries = state.journal
    const avgRating = entries.reduce((sum, e) => sum + (e.rating || 0), 0) / entries.length
    const effectCounts = {}
    entries.forEach(e => {
      (e.effects || []).forEach(eff => {
        effectCounts[eff] = (effectCounts[eff] || 0) + 1
      })
    })
    const topEffects = Object.entries(effectCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([effect, count]) => ({ effect, count }))

    const typeCounts = {}
    const typeRatings = {}
    entries.forEach(e => {
      if (e.strainType) {
        typeCounts[e.strainType] = (typeCounts[e.strainType] || 0) + 1
        typeRatings[e.strainType] = (typeRatings[e.strainType] || [])
        typeRatings[e.strainType].push(e.rating || 0)
      }
    })
    const avgByType = Object.fromEntries(
      Object.entries(typeRatings).map(([type, ratings]) => [
        type,
        ratings.reduce((s, r) => s + r, 0) / ratings.length,
      ])
    )

    return { avgRating, topEffects, typeCounts, avgByType, totalEntries: entries.length }
  }, [state.journal])

  return (
    <UserContext.Provider value={{ state, dispatch, isFavorite, getJournalForStrain, getJournalStats }}>
      {children}
    </UserContext.Provider>
  )
}
