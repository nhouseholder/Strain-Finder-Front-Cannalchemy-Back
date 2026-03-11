import { useEffect, useState, useCallback } from 'react'
import { PenLine, MessageSquare, Users } from 'lucide-react'
import clsx from 'clsx'
import usePageTitle from '../hooks/usePageTitle'
import { useReviews } from '../hooks/useReviews'
import { useAuth } from '../context/AuthContext'
import ReviewCard from '../components/community/ReviewCard'
import Leaderboard from '../components/community/Leaderboard'
import WriteReviewModal from '../components/community/WriteReviewModal'
import SearchAutocomplete from '../components/shared/SearchAutocomplete'
import LegalConsent from '../components/shared/LegalConsent'
import { strainSlug } from '../utils/strainSlug'

const SORT_OPTIONS = [
  { id: 'recent', label: 'Recent' },
  { id: 'helpful', label: 'Most Helpful' },
]

export default function CommunityPage() {
  usePageTitle('Community Reviews')
  const { user, isAdmin } = useAuth()
  const {
    reviews, leaderboard, loading, submitting, helpfulVotes,
    loadLatestReviews, submitReview, toggleHelpful, removeReview, loadLeaderboard,
  } = useReviews()

  const [sort, setSort] = useState('recent')
  const [showModal, setShowModal] = useState(false)
  const [selectedStrain, setSelectedStrain] = useState(null)
  const [visibleCount, setVisibleCount] = useState(15)

  useEffect(() => {
    loadLatestReviews({ limit: 50, sort })
  }, [sort, loadLatestReviews])

  const handleLoadLeaderboard = useCallback(() => {
    loadLeaderboard(15)
  }, [loadLeaderboard])

  const handleSubmit = async (data) => {
    if (!selectedStrain) return
    await submitReview(
      strainSlug(selectedStrain.name),
      selectedStrain.name,
      data
    )
    setSelectedStrain(null)
    // Reload feed
    loadLatestReviews({ limit: 50, sort })
  }

  const openReviewModal = () => {
    setSelectedStrain(null)
    setShowModal(true)
  }

  const displayed = reviews.slice(0, visibleCount)

  return (
    <LegalConsent>
      <div className="w-full max-w-5xl mx-auto px-4 pt-6 pb-24 sm:pb-8 animate-fade-in">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Users size={22} className="text-leaf-500" />
            <h1
              className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Community Reviews
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-[#8a9a8e] max-w-md mx-auto">
            Real experiences from real people. Share your reviews, help others find their perfect strain, and shape our recommendations.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main column — reviews feed */}
          <div className="flex-1 min-w-0">
            {/* Sort + Write CTA */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-white/[0.04] rounded-xl p-0.5">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setSort(opt.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[32px]',
                      sort === opt.id
                        ? 'bg-white dark:bg-white/[0.08] text-gray-800 dark:text-[#e0f0e4] shadow-sm'
                        : 'text-gray-400 dark:text-[#6a7a6e] hover:text-gray-600 dark:hover:text-[#a0b4a4]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                onClick={openReviewModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-leaf-500 text-white text-xs font-bold hover:bg-leaf-400 transition-colors shadow-md shadow-leaf-500/25 min-h-[40px]"
              >
                <PenLine size={14} />
                Write Review
              </button>
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin" />
              </div>
            )}

            {/* Empty state */}
            {!loading && reviews.length === 0 && (
              <div className="text-center py-12 rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08]">
                <MessageSquare size={32} className="mx-auto text-gray-300 dark:text-[#4a5a4e] mb-3" />
                <h3 className="text-base font-bold text-gray-700 dark:text-[#c0d4c4] mb-1">No reviews yet</h3>
                <p className="text-sm text-gray-400 dark:text-[#6a7a6e] mb-4">
                  Be the first to share your experience!
                </p>
                <button
                  onClick={openReviewModal}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-leaf-500 text-white text-sm font-semibold hover:bg-leaf-400 transition-colors shadow-md shadow-leaf-500/25 min-h-[44px]"
                >
                  <PenLine size={14} />
                  Write the First Review
                </button>
              </div>
            )}

            {/* Reviews feed */}
            {!loading && reviews.length > 0 && (
              <div className="space-y-3">
                {displayed.map(review => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    showStrain={true}
                    isVoted={helpfulVotes[review.id] || false}
                    onToggleHelpful={toggleHelpful}
                    onDelete={removeReview}
                    currentUserId={user?.uid}
                    isAdmin={isAdmin}
                  />
                ))}

                {reviews.length > visibleCount && (
                  <button
                    onClick={() => setVisibleCount(prev => prev + 15)}
                    className="w-full py-3 rounded-xl text-sm font-medium text-leaf-500 hover:bg-leaf-500/[0.06] transition-colors border border-leaf-500/20"
                  >
                    Load More Reviews
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sidebar — Leaderboard */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
            <Leaderboard
              leaderboard={leaderboard}
              onLoad={handleLoadLeaderboard}
              currentUserId={user?.uid}
            />

            {/* Quick review CTA card */}
            <div className="rounded-2xl border border-leaf-500/20 bg-leaf-500/[0.04] p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-[#8a9a8e] mb-3">
                Every review helps improve recommendations for the community.
              </p>
              <button
                onClick={openReviewModal}
                className="w-full py-2.5 rounded-xl bg-leaf-500/10 text-leaf-500 text-xs font-bold hover:bg-leaf-500/20 transition-colors min-h-[40px]"
              >
                Share Your Experience
              </button>
            </div>
          </div>
        </div>

        {/* Write review modal (with strain picker) */}
        {showModal && !selectedStrain && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-[#f4f7f5] dark:bg-[#0f1a12] border border-gray-200/80 dark:border-white/10 shadow-2xl p-5 animate-slide-up">
              <h2 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea] mb-3">
                Which strain are you reviewing?
              </h2>
              <SearchAutocomplete
                onSelect={(strain) => {
                  setSelectedStrain(strain)
                }}
                placeholder="Search for a strain..."
                className="mb-3"
              />
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2 rounded-xl text-xs font-medium text-gray-400 dark:text-[#6a7a6e] hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {selectedStrain && (
          <WriteReviewModal
            open={true}
            onClose={() => { setSelectedStrain(null); setShowModal(false) }}
            onSubmit={handleSubmit}
            strainName={selectedStrain.name}
            submitting={submitting}
          />
        )}

        {/* Mobile FAB */}
        <button
          onClick={openReviewModal}
          className="sm:hidden fixed right-4 z-30 w-14 h-14 rounded-full bg-leaf-500 text-white shadow-lg shadow-leaf-500/30 flex items-center justify-center hover:bg-leaf-400 active:scale-95 transition-all"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
          aria-label="Write a review"
        >
          <PenLine size={22} />
        </button>
      </div>
    </LegalConsent>
  )
}
