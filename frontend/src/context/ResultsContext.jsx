import { createContext, useReducer, useCallback, useMemo, useEffect } from 'react'

const STORAGE_KEY = 'sf-results-v2'

const emptyState = {
  strains: [],
  aiPicks: [],
  idealProfile: null,
  aiAnalysis: null,
  userRegion: null,
  userRegionIndex: null,
  isLoading: false,
  error: null,
}

// Load persisted results from localStorage on init
function getInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.strains?.length > 0) {
        return {
          ...emptyState,
          strains: parsed.strains,
          aiPicks: parsed.aiPicks || [],
          idealProfile: parsed.idealProfile || null,
          aiAnalysis: parsed.aiAnalysis || null,
          userRegion: parsed.userRegion || null,
          userRegionIndex: parsed.userRegionIndex ?? null,
        }
      }
    }
  } catch { /* ignore */ }
  return emptyState
}

function resultsReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: true, error: null }
    case 'SET_RESULTS':
      return {
        ...state,
        strains: action.payload.strains || [],
        aiPicks: action.payload.aiPicks || [],
        idealProfile: action.payload.idealProfile || null,
        aiAnalysis: action.payload.aiAnalysis || null,
        userRegion: action.payload.userRegion || null,
        userRegionIndex: action.payload.userRegionIndex ?? null,
        isLoading: false,
        error: null,
      }
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.payload }
    case 'DISMISS_STRAIN':
      return { ...state, strains: state.strains.filter(s => s.name !== action.payload) }
    case 'RESET':
      return emptyState
    default:
      return state
  }
}

export const ResultsContext = createContext(null)

export function ResultsProvider({ children }) {
  const [state, dispatch] = useReducer(resultsReducer, null, getInitialState)

  // Persist results to localStorage whenever they change
  useEffect(() => {
    if (state.strains.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          strains: state.strains,
          aiPicks: state.aiPicks,
          idealProfile: state.idealProfile,
          aiAnalysis: state.aiAnalysis,
          userRegion: state.userRegion,
          userRegionIndex: state.userRegionIndex,
        }))
      } catch { /* storage full or unavailable */ }
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [state.strains, state.aiPicks, state.idealProfile])

  const getSortedStrains = useCallback(() => {
    return [...state.strains].sort((a, b) => (b.matchPct || 0) - (a.matchPct || 0))
  }, [state.strains])

  const hasResults = state.strains.length > 0

  const value = useMemo(() => ({ state, dispatch, getSortedStrains, hasResults }), [state, getSortedStrains, hasResults])

  return (
    <ResultsContext.Provider value={value}>
      {children}
    </ResultsContext.Provider>
  )
}
