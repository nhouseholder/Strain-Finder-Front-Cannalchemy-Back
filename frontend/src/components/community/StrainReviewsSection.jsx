import { useEffect, useState } from 'react'
import { MessageSquare, Star, PenLine } from 'lucide-react'
import clsx from 'clsx'
import { useReviews } from '../../hooks/useReviews'
import { useAuth } from '../../context/AuthContext'
import ReviewCard from './ReviewCard'
import WriteReviewModal from './WriteReviewModal'

export default function StrainReviewsSection({ strainSlug, strainName }) {
  const { user, isAdmin } = useAuth()
  const {
    reviews, loading, submitting, hasReviewed, helpfulVotes,
    loadReviews, submitReview, toggleHelpful, removeReview,
  } = useReviews()

  const [showModal, setShowModal] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (strainSlug) loadReviews(strainSlug)
  }, [strainSlug, loadReviews])

  const displayedReviews = showAll ? reviews : reviews.slice(0, 5)

  // Compute average rating
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null

  const handleSubmit = async (data) => {
    await submitReview(strainSlug, strainName, data)
  }

  return (
    <div className="mt-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-leaf-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea]">
            Community Reviews
            {reviews.length > 0 && (
              <span className="text-sm font-normal text-gray-400 dark:text-[#6a7a6e] ml-1.5">
                ({reviews.length})
              </span>
            )}
          </h2>
          {avgRating && (
            <div className="flex items-center gap-1 ml-2">
              <Star size={13} className="text-amber-400 fill-amber-400" />
              <span className="text-sm font-semibold text-amber-500">{avgRating}</span>
            </div>
          )}
        </div>

        {!hasReviewed && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-leaf-500/10 text-leaf-500 text-xs font-semibold hover:bg-leaf-500/20 transition-colors min-h-[40px]"
          >
            <PenLine size={14} />
            Write Review
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin" />
        </div>
      )}

      {/* Reviews list */}
      {!loading && reviews.length === 0 && (
        <div className="text-center py-8 rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08]">
          <MessageSquare size={24} className="mx-auto text-gray-300 dark:text-[#4a5a4e] mb-2" />
          <p className="text-sm text-gray-400 dark:text-[#6a7a6e] mb-3">
            Be the first to review this strain!
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-leaf-500 text-white text-sm font-semibold hover:bg-leaf-400 transition-colors shadow-md shadow-leaf-500/25 min-h-[44px]"
          >
            <PenLine size={14} />
            Write a Review
          </button>
        </div>
      )}

      {!loading && reviews.length > 0 && (
        <div className="space-y-3">
          {displayedReviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              showStrain={false}
              isVoted={helpfulVotes[review.id] || false}
              onToggleHelpful={toggleHelpful}
              onDelete={removeReview}
              currentUserId={user?.uid}
              isAdmin={isAdmin}
            />
          ))}

          {reviews.length > 5 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-2.5 rounded-xl text-xs font-medium text-leaf-500 hover:bg-leaf-500/[0.06] transition-colors"
            >
              Show all {reviews.length} reviews
            </button>
          )}

          {hasReviewed && (
            <p className="text-[10px] text-gray-400 dark:text-[#6a7a6e] text-center pt-1">
              You've already reviewed this strain
            </p>
          )}
        </div>
      )}

      {/* Write review modal */}
      <WriteReviewModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        strainName={strainName}
        submitting={submitting}
      />
    </div>
  )
}
