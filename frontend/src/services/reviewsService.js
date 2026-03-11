/**
 * reviewsService — Firestore CRUD for community strain reviews.
 *
 * Collections:
 *   reviews        – one doc per review (1 review per strain per user)
 *   reviewHelpful  – doc id = `${reviewId}_${oduserId}` prevents double-vote
 *   userStats      – doc id = firebase uid, tracks rank & points
 */
import { db } from './firebase'
import {
  collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit as fbLimit, increment, serverTimestamp,
} from 'firebase/firestore'

// ── Rank tiers ─────────────────────────────────────────────────────
const RANK_TIERS = [
  { min: 0,    rank: 'Seedling',       color: 'green' },
  { min: 50,   rank: 'Explorer',       color: 'blue' },
  { min: 150,  rank: 'Connoisseur',    color: 'purple' },
  { min: 500,  rank: 'Sommelier',      color: 'amber' },
  { min: 1000, rank: 'Master Grower',  color: 'red' },
]

export function getRankForPoints(points = 0) {
  let tier = RANK_TIERS[0]
  for (const t of RANK_TIERS) {
    if (points >= t.min) tier = t
  }
  return tier
}

export { RANK_TIERS }

// ── Helpers ────────────────────────────────────────────────────────
function reviewsRef() { return collection(db, 'reviews') }
function helpfulRef() { return collection(db, 'reviewHelpful') }
function statsDoc(uid) { return doc(db, 'userStats', uid) }

async function ensureStats(uid, displayName) {
  const ref = statsDoc(uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: displayName || 'Anonymous',
      reviewCount: 0,
      helpfulReceived: 0,
      rank: 'Seedling',
      points: 0,
      joinedAt: serverTimestamp(),
      lastReviewAt: null,
    })
  }
  return ref
}

async function recalcRank(uid) {
  const snap = await getDoc(statsDoc(uid))
  if (!snap.exists()) return
  const d = snap.data()
  const points = (d.reviewCount || 0) * 10 + (d.helpfulReceived || 0) * 2
  const { rank } = getRankForPoints(points)
  await updateDoc(statsDoc(uid), { points, rank })
}

// ── Submit review ──────────────────────────────────────────────────
export async function submitReview(userId, displayName, strainSlug, strainName, { rating, text, effectTags, method }) {
  if (!db) throw new Error('Firebase not configured')

  // Enforce 1 review per strain per user
  const existing = await getUserReviewForStrain(strainSlug, userId)
  if (existing) throw new Error('You have already reviewed this strain')

  const docRef = await addDoc(reviewsRef(), {
    strainSlug,
    strainName,
    userId,
    displayName: displayName || 'Anonymous',
    rating,
    text,
    effectTags: effectTags || [],
    method: method || '',
    helpfulCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // Update user stats
  await ensureStats(userId, displayName)
  await updateDoc(statsDoc(userId), {
    reviewCount: increment(1),
    lastReviewAt: serverTimestamp(),
    displayName: displayName || 'Anonymous',
  })
  await recalcRank(userId)

  return docRef.id
}

// ── Fetch reviews for a strain ─────────────────────────────────────
export async function fetchReviewsForStrain(strainSlug, { limit: max = 20, sort = 'recent' } = {}) {
  if (!db) return []
  const order = sort === 'helpful' ? orderBy('helpfulCount', 'desc') : orderBy('createdAt', 'desc')
  const q = query(reviewsRef(), where('strainSlug', '==', strainSlug), order, fbLimit(max))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── Fetch latest reviews (all strains) ─────────────────────────────
export async function fetchLatestReviews({ limit: max = 20, sort = 'recent' } = {}) {
  if (!db) return []
  const order = sort === 'helpful' ? orderBy('helpfulCount', 'desc') : orderBy('createdAt', 'desc')
  const q = query(reviewsRef(), order, fbLimit(max))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── Check if user already reviewed this strain ─────────────────────
export async function getUserReviewForStrain(strainSlug, userId) {
  if (!db || !userId) return null
  const q = query(reviewsRef(), where('strainSlug', '==', strainSlug), where('userId', '==', userId), fbLimit(1))
  const snap = await getDocs(q)
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}

// ── Toggle helpful vote ────────────────────────────────────────────
export async function toggleHelpful(reviewId, voterId) {
  if (!db) return false
  const helpfulDocId = `${reviewId}_${voterId}`
  const helpfulDoc = doc(db, 'reviewHelpful', helpfulDocId)
  const snap = await getDoc(helpfulDoc)

  const reviewDoc = doc(db, 'reviews', reviewId)
  const reviewSnap = await getDoc(reviewDoc)
  if (!reviewSnap.exists()) return false
  const authorId = reviewSnap.data().userId

  if (snap.exists()) {
    // Remove vote
    await deleteDoc(helpfulDoc)
    await updateDoc(reviewDoc, { helpfulCount: increment(-1) })
    if (authorId) {
      await updateDoc(statsDoc(authorId), { helpfulReceived: increment(-1) }).catch(() => {})
      await recalcRank(authorId).catch(() => {})
    }
    return false // no longer voted
  } else {
    // Add vote
    await setDoc(helpfulDoc, { reviewId, userId: voterId, createdAt: serverTimestamp() })
    await updateDoc(reviewDoc, { helpfulCount: increment(1) })
    if (authorId) {
      await ensureStats(authorId, null)
      await updateDoc(statsDoc(authorId), { helpfulReceived: increment(1) })
      await recalcRank(authorId)
    }
    return true // voted
  }
}

// ── Check if user voted helpful on a review ────────────────────────
export async function hasVotedHelpful(reviewId, userId) {
  if (!db || !userId) return false
  const helpfulDoc = doc(db, 'reviewHelpful', `${reviewId}_${userId}`)
  const snap = await getDoc(helpfulDoc)
  return snap.exists()
}

// ── Delete review ──────────────────────────────────────────────────
export async function deleteReview(reviewId, userId) {
  if (!db) return
  const reviewDoc = doc(db, 'reviews', reviewId)
  const snap = await getDoc(reviewDoc)
  if (!snap.exists()) return
  const data = snap.data()
  if (data.userId !== userId) throw new Error('Not authorized')

  await deleteDoc(reviewDoc)
  // Decrement author stats
  await updateDoc(statsDoc(data.userId), { reviewCount: increment(-1) }).catch(() => {})
  await recalcRank(data.userId).catch(() => {})
}

// ── Leaderboard ────────────────────────────────────────────────────
export async function fetchLeaderboard(max = 15) {
  if (!db) return []
  const q = query(collection(db, 'userStats'), orderBy('points', 'desc'), fbLimit(max))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
}

// ── Get single user stats ──────────────────────────────────────────
export async function getUserStats(uid) {
  if (!db || !uid) return null
  const snap = await getDoc(statsDoc(uid))
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null
}
