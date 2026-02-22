import { useContext, useCallback } from 'react'
import { QuizContext } from '../context/QuizContext'

export function useQuizState() {
  const { state, dispatch, reset } = useContext(QuizContext)

  const setStep = useCallback((step) => dispatch({ type: 'SET_STEP', payload: step }), [dispatch])
  const toggleEffect = useCallback((id) => dispatch({ type: 'TOGGLE_EFFECT', payload: id }), [dispatch])
  const setEffectRanking = useCallback((ranking) => dispatch({ type: 'SET_EFFECT_RANKING', payload: ranking }), [dispatch])
  const setTolerance = useCallback((val) => dispatch({ type: 'SET_TOLERANCE', payload: val }), [dispatch])
  const toggleAvoid = useCallback((id) => dispatch({ type: 'TOGGLE_AVOID', payload: id }), [dispatch])
  const setConsumptionMethod = useCallback((val) => dispatch({ type: 'SET_CONSUMPTION_METHOD', payload: val }), [dispatch])
  const setBudget = useCallback((val) => dispatch({ type: 'SET_BUDGET', payload: val }), [dispatch])
  const setOpenToDeals = useCallback((val) => dispatch({ type: 'SET_OPEN_TO_DEALS', payload: val }), [dispatch])
  const setZipCode = useCallback((val) => dispatch({ type: 'SET_ZIP_CODE', payload: val }), [dispatch])
  const setSubtype = useCallback((val) => dispatch({ type: 'SET_SUBTYPE', payload: val }), [dispatch])
  const setThcPreference = useCallback((val) => dispatch({ type: 'SET_THC_PREFERENCE', payload: val }), [dispatch])
  const setCbdPreference = useCallback((val) => dispatch({ type: 'SET_CBD_PREFERENCE', payload: val }), [dispatch])
  const toggleFlavor = useCallback((id) => dispatch({ type: 'TOGGLE_FLAVOR', payload: id }), [dispatch])

  return {
    ...state,
    setStep,
    toggleEffect,
    setEffectRanking,
    setTolerance,
    toggleAvoid,
    setConsumptionMethod,
    setBudget,
    setOpenToDeals,
    setZipCode,
    setSubtype,
    setThcPreference,
    setCbdPreference,
    toggleFlavor,
    reset,
  }
}
