import { Link } from 'react-router-dom'
import { ThumbsUp, Trash2, Star } from 'lucide-react'
import clsx from 'clsx'
import Card from '../shared/Card'
import ContributorBadge from './ContributorBadge'
import { strainSlug } from '../../utils/strainSlug'

function timeAgo(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString()
}

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={13}
          className={clsx(
            i <= rating
              ? 'text-amber-400 fill-amber-400'
              : 'text-gray-300 dark:text-gray-600'
          )}
        />
      ))}
    </div>
  )
}

export default function ReviewCard({
  review,
  showStrain = false,
  isVoted = false,
  onToggleHelpful,
  onDelete,
  currentUserId,
  isAdmin = false,
}) {
  const canDelete = currentUserId && (review.userId === currentUserId || isAdmin)

  return (
    <Card className="p-4">
      {/* Header: Author + rating + time */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Avatar initial */}
          <div className="w-7 h-7 rounded-full bg-leaf-500/15 flex items-center justify-center text-xs font-bold text-leaf-500 flex-shrink-0">
            {(review.displayName || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-gray-800 dark:text-[#d0e4d4] truncate">
                {review.displayName || 'Anonymous'}
              </span>
              <ContributorBadge rank={review.authorRank} points={review.authorPoints || 0} />
            </div>
            <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
              {timeAgo(review.createdAt)}
            </span>
          </div>
        </div>
        <StarRating rating={review.rating} />
      </div>

      {/* Strain name link (in community feed) */}
      {showStrain && review.strainName && (
        <Link
          to={`/strain/${strainSlug(review.strainName)}`}
          className="inline-block text-xs font-semibold text-leaf-500 hover:text-leaf-400 transition-colors mb-1.5"
        >
          {review.strainName}
        </Link>
      )}

      {/* Review text */}
      <p className="text-sm text-gray-700 dark:text-[#b0c4b4] leading-relaxed mb-2">
        {review.text}
      </p>

      {/* Effect tags */}
      {review.effectTags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {review.effectTags.map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-leaf-500/10 text-leaf-600 dark:text-leaf-400 text-[10px] font-medium"
            >
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
          {review.method && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 dark:text-purple-400 text-[10px] font-medium">
              {review.method}
            </span>
          )}
        </div>
      )}

      {/* Actions: Helpful + Delete */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/[0.05]">
        <button
          onClick={() => onToggleHelpful?.(review.id)}
          disabled={!currentUserId || review.userId === currentUserId}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px]',
            isVoted
              ? 'bg-leaf-500/15 text-leaf-500'
              : 'text-gray-400 dark:text-[#6a7a6e] hover:bg-gray-100 dark:hover:bg-white/[0.04]',
            (!currentUserId || review.userId === currentUserId) && 'opacity-50 cursor-not-allowed'
          )}
        >
          <ThumbsUp size={13} className={isVoted ? 'fill-current' : ''} />
          Helpful{review.helpfulCount > 0 ? ` (${review.helpfulCount})` : ''}
        </button>

        {canDelete && (
          <button
            onClick={() => onDelete?.(review.id)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors min-h-[36px]"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </Card>
  )
}

export { StarRating }
