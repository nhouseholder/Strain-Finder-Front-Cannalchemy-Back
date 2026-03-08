import { useContext, useMemo } from 'react'
import { QuizContext } from '../context/QuizContext'
import { ResultsContext } from '../context/ResultsContext'
import { REGION_ORDER, REGION_MAP, REGION_LABELS } from '../data/regionMap'

/**
 * Shared hook for resolving the user's regional location.
 *
 * Priority:
 *   1. QuizContext zipCode → resolve via REGION_MAP (primary, user-entered)
 *   2. ResultsContext userRegionIndex (fallback, from quiz results API)
 *
 * Returns:
 *   { userRegion, userRegionIndex, regionLabel, hasLocation }
 */
export function useUserRegion() {
  const quizCtx = useContext(QuizContext)
  const resultsCtx = useContext(ResultsContext)

  return useMemo(() => {
    const zipCode = quizCtx?.state?.zipCode || ''

    // Primary: resolve from zip code
    if (zipCode.length >= 3) {
      const prefix = zipCode.slice(0, 3)
      const region = REGION_MAP[prefix]
      if (region) {
        const idx = REGION_ORDER.indexOf(region)
        return {
          userRegion: region,
          userRegionIndex: idx >= 0 ? idx : null,
          regionLabel: REGION_LABELS[region] || region,
          hasLocation: true,
        }
      }
    }

    // Fallback: use stored results from quiz recommendation API
    const resultsRegion = resultsCtx?.state?.userRegion
    const resultsIdx = resultsCtx?.state?.userRegionIndex
    if (resultsIdx != null && resultsIdx >= 0) {
      return {
        userRegion: resultsRegion || REGION_ORDER[resultsIdx] || null,
        userRegionIndex: resultsIdx,
        regionLabel: REGION_LABELS[resultsRegion] || resultsRegion || '',
        hasLocation: true,
      }
    }

    // No location available
    return {
      userRegion: null,
      userRegionIndex: null,
      regionLabel: '',
      hasLocation: false,
    }
  }, [quizCtx?.state?.zipCode, resultsCtx?.state?.userRegion, resultsCtx?.state?.userRegionIndex])
}
