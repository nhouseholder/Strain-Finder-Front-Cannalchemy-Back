/**
 * useRatings – hybrid hook that stores ratings in localStorage AND
 * syncs to the backend when the user is authenticated.
 *
 * Provides:
 *   ratings[]           – all ratings for the current user
 *   preferenceProfile   – learned preference profile (from server or computed locally)
 *   rateStrain(...)     – submit / update a rating
 *   getRating(name)     – get existing rating for a strain
 *   deleteRating(name)  – remove a rating
 *   syncing             – true while a server sync is in flight
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  submitRating as apiSubmitRating,
  syncRatings as apiSyncRatings,
  getUserRatings as apiGetUserRatings,
  deleteRating as apiDeleteRating,
} from '../services/api'

const LS_KEY = 'sf-user-ratings'
const LS_PROFILE_KEY = 'sf-preference-profile'

function loadJSON(key, fallback) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

export function useRatings() {
  const { user } = useAuth()
  const userId = user?.uid || null

  // Local state — always available, even offline
  const [ratings, setRatings] = useState(() => loadJSON(LS_KEY, []))
  const [preferenceProfile, setPreferenceProfile] = useState(() => loadJSON(LS_PROFILE_KEY, null))
  const [syncing, setSyncing] = useState(false)
  const syncedRef = useRef(false)

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(ratings))
  }, [ratings])

  useEffect(() => {
    if (preferenceProfile) {
      localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(preferenceProfile))
    }
  }, [preferenceProfile])

  // ── Server sync on login ─────────────────────────────────────────
  useEffect(() => {
    if (!userId || syncedRef.current) return
    syncedRef.current = true

    const doSync = async () => {
      setSyncing(true)
      try {
        if (ratings.length > 0) {
          // Push local ratings to server, get back merged + profile
          const serverRatings = ratings.map((r) => ({
            strain_name: r.strainName || r.strain_name,
            strain_type: r.strainType || r.strain_type || '',
            rating: r.rating,
            effects_felt: r.effectsFelt || r.effects_felt || r.effects || [],
            negative_effects: r.negativeEffects || r.negative_effects || [],
            method: r.method || '',
            would_try_again: r.wouldTryAgain ?? r.would_try_again ?? true,
            notes: r.notes || '',
          }))
          const data = await apiSyncRatings(userId, serverRatings)
          setRatings(data.ratings || [])
          setPreferenceProfile(data.profile || null)
        } else {
          // Just fetch from server
          const data = await apiGetUserRatings(userId)
          if (data.ratings?.length > 0) {
            setRatings(data.ratings)
          }
          if (data.profile) {
            setPreferenceProfile(data.profile)
          }
        }
      } catch (err) {
        console.warn('Rating sync failed (offline mode):', err.message)
      } finally {
        setSyncing(false)
      }
    }

    doSync()
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset sync flag when user changes
  useEffect(() => {
    syncedRef.current = false
  }, [userId])

  // ── Rate a strain ────────────────────────────────────────────────
  const rateStrain = useCallback(
    async ({ strainName, strainType, rating, effectsFelt, negativeEffects, method, wouldTryAgain, notes }) => {
      const entry = {
        strain_name: strainName,
        strain_type: strainType || '',
        rating,
        effects_felt: effectsFelt || [],
        negative_effects: negativeEffects || [],
        method: method || '',
        would_try_again: wouldTryAgain ?? true,
        notes: notes || '',
        updated_at: new Date().toISOString(),
      }

      // Optimistic update locally
      setRatings((prev) => {
        const idx = prev.findIndex(
          (r) => (r.strain_name || r.strainName || '').toLowerCase() === strainName.toLowerCase()
        )
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...prev[idx], ...entry }
          return updated
        }
        return [{ ...entry, id: `local-${Date.now()}`, created_at: entry.updated_at }, ...prev]
      })

      // Push to server if authenticated
      if (userId) {
        try {
          const stored = await apiSubmitRating(userId, entry)
          // Replace the optimistic entry with the server version
          setRatings((prev) =>
            prev.map((r) =>
              (r.strain_name || r.strainName || '').toLowerCase() === strainName.toLowerCase()
                ? stored
                : r
            )
          )
          // Refresh profile
          const data = await apiGetUserRatings(userId)
          if (data.profile) setPreferenceProfile(data.profile)
        } catch (err) {
          console.warn('Rating submit failed (saved locally):', err.message)
        }
      } else {
        // Compute a lightweight local profile
        _computeLocalProfile(ratings)
      }
    },
    [userId, ratings]
  )

  // ── Get rating for a specific strain ─────────────────────────────
  const getRating = useCallback(
    (strainName) => {
      if (!strainName) return null
      const lower = strainName.toLowerCase()
      return ratings.find(
        (r) => (r.strain_name || r.strainName || '').toLowerCase() === lower
      ) || null
    },
    [ratings]
  )

  // ── Delete a rating ──────────────────────────────────────────────
  const removeRating = useCallback(
    async (strainName) => {
      setRatings((prev) =>
        prev.filter(
          (r) => (r.strain_name || r.strainName || '').toLowerCase() !== strainName.toLowerCase()
        )
      )
      if (userId) {
        try {
          await apiDeleteRating(userId, strainName)
          const data = await apiGetUserRatings(userId)
          if (data.profile) setPreferenceProfile(data.profile)
        } catch (err) {
          console.warn('Rating delete failed:', err.message)
        }
      }
    },
    [userId]
  )

  // ── Lightweight local profile (when not authenticated) ───────────
  const _computeLocalProfile = useCallback((allRatings) => {
    if (allRatings.length === 0) {
      setPreferenceProfile(null)
      return
    }
    const total = allRatings.length
    const avgRating = allRatings.reduce((s, r) => s + (r.rating || 0), 0) / total

    const typeCounts = {}
    const typeRatings = {}
    allRatings.forEach((r) => {
      const t = r.strain_type || r.strainType || ''
      if (t) {
        typeCounts[t] = (typeCounts[t] || 0) + 1
        typeRatings[t] = typeRatings[t] || []
        typeRatings[t].push(r.rating || 0)
      }
    })
    const typeScores = {}
    Object.entries(typeRatings).forEach(([t, arr]) => {
      typeScores[t] = arr.reduce((s, v) => s + v, 0) / arr.length
    })
    const preferredType = Object.entries(typeScores).sort(([, a], [, b]) => b - a)[0]?.[0] || ''

    const effectCounts = {}
    allRatings.forEach((r) => {
      const effs = r.effects_felt || r.effectsFelt || r.effects || []
      const weight = ((r.rating || 3) - 3) / 2
      effs.forEach((eff) => {
        effectCounts[eff] = effectCounts[eff] || { total: 0, count: 0 }
        effectCounts[eff].total += weight
        effectCounts[eff].count += 1
      })
    })
    const effectPreferences = Object.entries(effectCounts)
      .map(([effect, { total, count }]) => ({
        effect,
        score: Math.round((total / count) * 1000) / 1000,
        count,
      }))
      .sort((a, b) => b.score - a.score)

    const topStrains = [...allRatings]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5)
      .map((r) => r.strain_name || r.strainName)

    setPreferenceProfile({
      user_id: 'local',
      total_ratings: total,
      avg_rating: Math.round(avgRating * 100) / 100,
      preferred_type: preferredType,
      type_scores: typeScores,
      type_counts: typeCounts,
      effect_preferences: effectPreferences,
      negative_effect_sensitivity: [],
      terpene_preferences: [],
      cannabinoid_preferences: [],
      preferred_method: '',
      would_try_again_rate: 0,
      top_strains: topStrains,
      avoid_strains: [],
      confidence: Math.min(total / 20, 1),
      insights: total < 3
        ? [`You've rated ${total} strain${total !== 1 ? 's' : ''}. Rate more to unlock preference insights!`]
        : [`Based on ${total} ratings. Sign in to get deeper analysis with terpene and cannabinoid preferences.`],
    })
  }, [])

  // Recompute local profile when ratings change and user is not auth'd
  useEffect(() => {
    if (!userId) {
      _computeLocalProfile(ratings)
    }
  }, [ratings, userId, _computeLocalProfile])

  return useMemo(
    () => ({
      ratings,
      preferenceProfile,
      rateStrain,
      getRating,
      removeRating,
      syncing,
      totalRatings: ratings.length,
    }),
    [ratings, preferenceProfile, rateStrain, getRating, removeRating, syncing]
  )
}
