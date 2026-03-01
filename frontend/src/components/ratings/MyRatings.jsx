/**
 * MyRatings — a section component that displays all user ratings for a strain
 * or all strains, with sorting and filtering.
 */
import { useState, useMemo } from 'react'
import { Star, Trash2, ChevronDown, ChevronUp, Filter, ThumbsUp, ThumbsDown } from 'lucide-react'
import clsx from 'clsx'
import Card from '../shared/Card'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'highest', label: 'Highest Rated' },
  { value: 'lowest', label: 'Lowest Rated' },
  { value: 'name', label: 'Name A-Z' },
]

function RatingCard({ rating, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const name = rating.strain_name || rating.strainName
  const type = rating.strain_type || rating.strainType || ''
  const stars = rating.rating || 0
  const effects = rating.effects_felt || rating.effectsFelt || rating.effects || []
  const negatives = rating.negative_effects || rating.negativeEffects || []
  const wouldTryAgain = rating.would_try_again ?? rating.wouldTryAgain ?? true
  const notes = rating.notes || ''
  const date = rating.updated_at || rating.created_at || ''

  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea]">
              {name}
            </h3>
            {type && (
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] capitalize">
                {type}
              </span>
            )}
          </div>

          {/* Stars */}
          <div className="flex items-center gap-1.5 mb-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={13}
                  className={
                    s <= stars
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-200 dark:text-[#6a7a6e]'
                  }
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
              {formattedDate}
            </span>
          </div>

          {/* Effects preview */}
          {effects.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {effects.slice(0, expanded ? undefined : 3).map((eff) => (
                <span
                  key={eff}
                  className="px-1.5 py-0.5 rounded-md text-[10px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20"
                >
                  {eff}
                </span>
              ))}
              {!expanded && effects.length > 3 && (
                <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] self-center">
                  +{effects.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Would try again */}
          <div className="flex items-center gap-1">
            {wouldTryAgain ? (
              <ThumbsUp size={11} className="text-leaf-400" />
            ) : (
              <ThumbsDown size={11} className="text-red-400" />
            )}
            <span className={clsx('text-[10px]', wouldTryAgain ? 'text-leaf-400' : 'text-red-400')}>
              {wouldTryAgain ? 'Would try again' : "Wouldn't try again"}
            </span>
          </div>

          {/* Expanded notes */}
          {expanded && notes && (
            <p className="text-xs text-gray-500 dark:text-[#8a9a8e] mt-2 leading-relaxed">
              {notes}
            </p>
          )}

          {expanded && negatives.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {negatives.map((eff) => (
                <span
                  key={eff}
                  className="px-1.5 py-0.5 rounded-md text-[10px] bg-red-500/10 text-red-400 border border-red-500/20"
                >
                  {eff}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete?.(name)}
          className="p-1.5 rounded-lg text-gray-300 dark:text-[#5a6a5e] hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
          aria-label={`Delete ${name} rating`}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expand toggle */}
      {(notes || effects.length > 3 || negatives.length > 0) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-[#5a6a5e] hover:text-leaf-500 transition-colors mt-2"
        >
          {expanded ? (
            <>Show less <ChevronUp size={12} /></>
          ) : (
            <>Show more <ChevronDown size={12} /></>
          )}
        </button>
      )}
    </Card>
  )
}

export default function MyRatings({ ratings, onDelete }) {
  const [sort, setSort] = useState('recent')
  const [filterType, setFilterType] = useState('')

  const sorted = useMemo(() => {
    let list = [...ratings]

    // Filter
    if (filterType) {
      list = list.filter((r) => {
        const t = (r.strain_type || r.strainType || '').toLowerCase()
        return t === filterType
      })
    }

    // Sort
    switch (sort) {
      case 'highest':
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0))
        break
      case 'lowest':
        list.sort((a, b) => (a.rating || 0) - (b.rating || 0))
        break
      case 'name':
        list.sort((a, b) => {
          const na = (a.strain_name || a.strainName || '').toLowerCase()
          const nb = (b.strain_name || b.strainName || '').toLowerCase()
          return na.localeCompare(nb)
        })
        break
      default: // recent
        list.sort((a, b) => {
          const da = a.updated_at || a.created_at || ''
          const db = b.updated_at || b.created_at || ''
          return db.localeCompare(da)
        })
    }

    return list
  }, [ratings, sort, filterType])

  const types = useMemo(() => {
    const set = new Set()
    ratings.forEach((r) => {
      const t = (r.strain_type || r.strainType || '').toLowerCase()
      if (t) set.add(t)
    })
    return Array.from(set).sort()
  }, [ratings])

  if (ratings.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Star className="w-10 h-10 text-gray-300 dark:text-[#5a6a5e] mx-auto mb-3" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">
          No Ratings Yet
        </h3>
        <p className="text-xs text-gray-500 dark:text-[#8a9a8e] leading-relaxed">
          Rate strains from your results or journal to start building your taste profile.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-2.5 py-1.5 text-[11px] rounded-lg bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#b0c4b4] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 appearance-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {types.length > 1 && (
          <div className="flex items-center gap-1">
            <Filter size={11} className="text-gray-400 dark:text-[#6a7a6e]" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 text-[11px] rounded-lg bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#b0c4b4] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 appearance-none capitalize"
            >
              <option value="">All Types</option>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] ml-auto">
          {sorted.length} rating{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Rating cards */}
      {sorted.map((rating) => (
        <RatingCard
          key={rating.id || rating.strain_name || rating.strainName}
          rating={rating}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
