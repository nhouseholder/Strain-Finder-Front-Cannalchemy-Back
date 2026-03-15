import { createContext, useReducer, useEffect, useCallback, useMemo } from 'react'

const STORAGE_KEY = 'sf-quiz'

const initialState = {
  currentStep: 1, // Start directly at effects step (skip splash)
  effects: [],
  effectRanking: [],
  tolerance: null,
  avoidEffects: [],
  consumptionMethod: null,
  budget: null,
  openToDeals: true,
  zipCode: '',
  subtype: 'no_preference',
  thcPreference: 'no_preference',
  cbdPreference: 'no_preference',
  flavors: [],
  selectedDispensary: null, // { id, name, citySlug, cityLabel }
}

function quizReducer(state, action) {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload }
    case 'TOGGLE_EFFECT': {
      const id = action.payload
      const effects = state.effects.includes(id)
        ? state.effects.filter(e => e !== id)
        : state.effects.length < 5 ? [...state.effects, id] : state.effects
      const effectRanking = state.effectRanking.filter(e => effects.includes(e))
      return { ...state, effects, effectRanking }
    }
    case 'SET_EFFECT_RANKING':
      return { ...state, effectRanking: action.payload }
    case 'SET_TOLERANCE':
      return { ...state, tolerance: action.payload }
    case 'TOGGLE_AVOID': {
      const id = action.payload
      const avoidEffects = state.avoidEffects.includes(id)
        ? state.avoidEffects.filter(e => e !== id)
        : [...state.avoidEffects, id]
      return { ...state, avoidEffects }
    }
    case 'SET_CONSUMPTION_METHOD':
      return { ...state, consumptionMethod: action.payload }
    case 'SET_BUDGET':
      return { ...state, budget: action.payload }
    case 'SET_OPEN_TO_DEALS':
      return { ...state, openToDeals: action.payload }
    case 'SET_ZIP_CODE':
      return { ...state, zipCode: action.payload }
    case 'SET_SUBTYPE':
      return { ...state, subtype: action.payload }
    case 'SET_THC_PREFERENCE':
      return { ...state, thcPreference: action.payload }
    case 'SET_CBD_PREFERENCE':
      return { ...state, cbdPreference: action.payload }
    case 'SET_SELECTED_DISPENSARY':
      return { ...state, selectedDispensary: action.payload }
    case 'TOGGLE_FLAVOR': {
      const id = action.payload
      if (id === 'no_preference') return { ...state, flavors: [] }
      const flavors = state.flavors.includes(id)
        ? state.flavors.filter(f => f !== id)
        : [...state.flavors.filter(f => f !== 'no_preference'), id]
      return { ...state, flavors }
    }
    case 'RESET':
      return { ...initialState }
    case 'LOAD':
      return { ...initialState, ...action.payload }
    default:
      return state
  }
}

export const QuizContext = createContext(null)

export function QuizProvider({ children }) {
  const [state, dispatch] = useReducer(quizReducer, initialState, () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Never restore the loading step — it's transient
        if (parsed.currentStep >= 5 || parsed.currentStep === 0) parsed.currentStep = 1
        return { ...initialState, ...parsed }
      }
    } catch {}
    return initialState
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const value = useMemo(() => ({ state, dispatch, reset }), [state, reset])

  return (
    <QuizContext.Provider value={value}>
      {children}
    </QuizContext.Provider>
  )
}
