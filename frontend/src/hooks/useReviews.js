/**
 * useReviews — React hook for community strain reviews.
 *
 * Wraps reviewsService with local state, loading flags, and
 * optimistic UI updates. Also bridges to useRatings() so every
 * review feeds the matching-engine algorithm (Layer 2).
 */
import { useState, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRatings } from './useRatings'
import {
  submitReview as svcSubmit,
  fetchReviewsForStrain as svcForStrain,
  fetchLatestReviews as svcLatest,
  toggleHelpful as svcToggle,
  hasVotedHelpful as svcHasVoted,
  getUserReviewForStrain as svcUserReview,
  deleteReview as svcDelete,
  fetchLeaderboard as svcLeaderboard,
} from '../services/reviewsService'

export function useReviews() {
  const { user, profile } = useAuth()
  const { rateStrain } = useRatings()

  const [reviews, setReviews] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [hasReviewed, setHasReviewed] = useState(false)
  const [helpfulVotes, setHelpfulVotes] = useState({}) // { reviewId: true/false }

  // ── Load reviews for a specific strain ────────────────────────────
  const loadReviews = useCallback(async (strainSlug, opts) => {
    setLoading(true)
    setError(null)
    try {
      const data = await svcForStrain(strainSlug, opts)
      setReviews(data)

      // Check if current user already reviewed
      if (user?.uid) {
        const existing = await svcUserReview(strainSlug, user.uid)
        setHasReviewed(!!existing)

        // Pre-load helpful votes for this batch
        const votes = {}
        for (const r of data) {
          votes[r.id] = await svcHasVoted(r.id, user.uid)
        }
        setHelpfulVotes(votes)
      } else {
        setHasReviewed(false)
        setHelpfulVotes({})
      }
    } catch (err) {
      console.error('Failed to load reviews:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  // ── Load latest reviews (community feed) ──────────────────────────
  const loadLatestReviews = useCallback(async (opts) => {
    setLoading(true)
    setError(null)
    try {
      const data = await svcLatest(opts)
      setReviews(data)

      if (user?.uid) {
        const votes = {}
        for (const r of data) {
          votes[r.id] = await svcHasVoted(r.id, user.uid)
        }
        setHelpfulVotes(votes)
      }
    } catch (err) {
      console.error('Failed to load latest reviews:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  // ── Submit a review ───────────────────────────────────────────────
  const submitReview = useCallback(async (strainSlug, strainName, data) => {
    if (!user?.uid) throw new Error('Must be logged in to review')
    setSubmitting(true)
    setError(null)
    try {
      const displayName = profile?.display_name || user.email?.split('@')[0] || 'Anonymous'
      await svcSubmit(user.uid, displayName, strainSlug, strainName, data)
      setHasReviewed(true)

      // 🔑 Algorithm learning loop — feed rating + effects to backend
      try {
        await rateStrain({
          strainName,
          strainType: '',
          rating: data.rating,
          effectsFelt: data.effectTags || [],
          negativeEffects: [],
          method: data.method || '',
          wouldTryAgain: data.rating >= 3,
          notes: data.text || '',
        })
      } catch (syncErr) {
        console.warn('Review saved but algorithm sync failed:', syncErr.message)
      }

      // Reload reviews for this strain
      await loadReviews(strainSlug)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setSubmitting(false)
    }
  }, [user, profile, rateStrain, loadReviews])

  // ── Toggle helpful (optimistic) ───────────────────────────────────
  const toggleHelpful = useCallback(async (reviewId) => {
    if (!user?.uid) return
    const wasVoted = helpfulVotes[reviewId] || false

    // Optimistic update
    setHelpfulVotes(prev => ({ ...prev, [reviewId]: !wasVoted }))
    setReviews(prev => prev.map(r =>
      r.id === reviewId
        ? { ...r, helpfulCount: (r.helpfulCount || 0) + (wasVoted ? -1 : 1) }
        : r
    ))

    try {
      await svcToggle(reviewId, user.uid)
    } catch (err) {
      // Revert on failure
      setHelpfulVotes(prev => ({ ...prev, [reviewId]: wasVoted }))
      setReviews(prev => prev.map(r =>
        r.id === reviewId
          ? { ...r, helpfulCount: (r.helpfulCount || 0) + (wasVoted ? 1 : -1) }
          : r
      ))
      console.error('Helpful toggle failed:', err)
    }
  }, [user?.uid, helpfulVotes])

  // ── Delete a review ───────────────────────────────────────────────
  const removeReview = useCallback(async (reviewId) => {
    if (!user?.uid) return
    try {
      await svcDelete(reviewId, user.uid)
      setReviews(prev => prev.filter(r => r.id !== reviewId))
      setHasReviewed(false)
    } catch (err) {
      console.error('Delete review failed:', err)
      setError(err.message)
    }
  }, [user?.uid])

  // ── Leaderboard ───────────────────────────────────────────────────
  const loadLeaderboard = useCallback(async (max) => {
    try {
      const data = await svcLeaderboard(max)
      setLeaderboard(data)
    } catch (err) {
      console.error('Leaderboard failed:', err)
    }
  }, [])

  return useMemo(() => ({
    reviews,
    leaderboard,
    loading,
    submitting,
    error,
    hasReviewed,
    helpfulVotes,
    loadReviews,
    loadLatestReviews,
    submitReview,
    toggleHelpful,
    removeReview,
    loadLeaderboard,
  }), [reviews, leaderboard, loading, submitting, error, hasReviewed, helpfulVotes,
       loadReviews, loadLatestReviews, submitReview, toggleHelpful, removeReview, loadLeaderboard])
}
