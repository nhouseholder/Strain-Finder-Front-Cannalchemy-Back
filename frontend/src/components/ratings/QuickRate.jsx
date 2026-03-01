/**
 * QuickRate — inline star-rating widget shown on strain cards.
 *
 * Lets users rate a strain 1-5 stars with a single click.
 * Shows the existing rating if one exists.
 * On click, opens an optional mini-form for effects/notes.
 */
import { useState, useCallback } from 'react'
import { Star, ChevronDown, ChevronUp, X, ThumbsUp, ThumbsDown } from 'lucide-react'
import clsx from 'clsx'

const QUICK_EFFECTS = [
  'Relaxed', 'Happy', 'Euphoric', 'Creative', 'Energetic',
  'Focused', 'Sleepy', 'Uplifted', 'Calm',
]

const QUICK_NEGATIVES = [
  'Anxious', 'Dry Mouth', 'Dizzy', 'Paranoid', 'Headache',
]

export default function QuickRate({
  strainName,
  strainType,
  existingRating,
  onRate,
  compact = false,
}) {
  const [hover, setHover] = useState(0)
  const [showDetails, setShowDetails] = useState(false)
  const [effectsFelt, setEffectsFelt] = useState(existingRating?.effects_felt || existingRating?.effectsFelt || [])
  const [negativeEffects, setNegativeEffects] = useState(existingRating?.negative_effects || existingRating?.negativeEffects || [])
  const [wouldTryAgain, setWouldTryAgain] = useState(existingRating?.would_try_again ?? existingRating?.wouldTryAgain ?? true)
  const [notes, setNotes] = useState(existingRating?.notes || '')

  const currentRating = existingRating?.rating || 0

  const handleRate = useCallback(
    (stars) => {
      onRate?.({
        strainName,
        strainType: strainType || '',
        rating: stars,
        effectsFelt,
        negativeEffects,
        wouldTryAgain,
        notes,
      })
    },
    [strainName, strainType, effectsFelt, negativeEffects, wouldTryAgain, notes, onRate]
  )

  const handleDetailedSubmit = useCallback(() => {
    if (currentRating > 0) {
      onRate?.({
        strainName,
        strainType: strainType || '',
        rating: currentRating,
        effectsFelt,
        negativeEffects,
        wouldTryAgain,
        notes,
      })
    }
    setShowDetails(false)
  }, [strainName, strainType, currentRating, effectsFelt, negativeEffects, wouldTryAgain, notes, onRate])

  const toggleEffect = (eff) => {
    setEffectsFelt((prev) =>
      prev.includes(eff) ? prev.filter((e) => e !== eff) : [...prev, eff]
    )
  }

  const toggleNegative = (eff) => {
    setNegativeEffects((prev) =>
      prev.includes(eff) ? prev.filter((e) => e !== eff) : [...prev, eff]
    )
  }

  if (compact) {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleRate(star)
            }}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-0 transition-transform hover:scale-125 focus-visible:outline-none"
            aria-label={`Rate ${strainName} ${star} stars`}
          >
            <Star
              size={14}
              className={clsx(
                'transition-colors',
                star <= (hover || currentRating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-300 dark:text-[#5a6a5e]'
              )}
            />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      className="space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Star row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#6a7a6e] font-semibold">
          Your Rating
        </span>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleRate(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 rounded"
              aria-label={`Rate ${star} stars`}
            >
              <Star
                size={18}
                className={clsx(
                  'transition-colors',
                  star <= (hover || currentRating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-gray-300 dark:text-[#5a6a5e]'
                )}
              />
            </button>
          ))}
        </div>
        {currentRating > 0 && (
          <span className="text-xs text-gray-500 dark:text-[#8a9a8e]">
            {currentRating}/5
          </span>
        )}
      </div>

      {/* Expand/collapse details */}
      {currentRating > 0 && (
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="inline-flex items-center gap-1 text-[10px] text-leaf-500 hover:text-leaf-400 transition-colors"
        >
          {showDetails ? (
            <>Less detail <ChevronUp size={12} /></>
          ) : (
            <>Add effects & notes <ChevronDown size={12} /></>
          )}
        </button>
      )}

      {/* Detailed form */}
      {showDetails && currentRating > 0 && (
        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-white/[0.06] animate-fade-in">
          {/* Effects felt */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#6a7a6e] font-semibold mb-1.5">
              Effects Felt
            </label>
            <div className="flex flex-wrap gap-1">
              {QUICK_EFFECTS.map((eff) => (
                <button
                  key={eff}
                  type="button"
                  onClick={() => toggleEffect(eff)}
                  className={clsx(
                    'px-2 py-0.5 rounded-md text-[10px] font-medium transition-all',
                    effectsFelt.includes(eff)
                      ? 'bg-leaf-500/15 text-leaf-400 border border-leaf-500/30'
                      : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border border-transparent hover:bg-gray-200 dark:hover:bg-white/[0.08]'
                  )}
                >
                  {eff}
                </button>
              ))}
            </div>
          </div>

          {/* Negatives */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#6a7a6e] font-semibold mb-1.5">
              Any Negatives?
            </label>
            <div className="flex flex-wrap gap-1">
              {QUICK_NEGATIVES.map((eff) => (
                <button
                  key={eff}
                  type="button"
                  onClick={() => toggleNegative(eff)}
                  className={clsx(
                    'px-2 py-0.5 rounded-md text-[10px] font-medium transition-all',
                    negativeEffects.includes(eff)
                      ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                      : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border border-transparent hover:bg-gray-200 dark:hover:bg-white/[0.08]'
                  )}
                >
                  {eff}
                </button>
              ))}
            </div>
          </div>

          {/* Would try again */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#6a7a6e] font-semibold">
              Try Again?
            </span>
            <button
              type="button"
              onClick={() => setWouldTryAgain(true)}
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all',
                wouldTryAgain
                  ? 'bg-leaf-500/15 text-leaf-400 border border-leaf-500/30'
                  : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border border-transparent'
              )}
            >
              <ThumbsUp size={10} /> Yes
            </button>
            <button
              type="button"
              onClick={() => setWouldTryAgain(false)}
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all',
                !wouldTryAgain
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                  : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border border-transparent'
              )}
            >
              <ThumbsDown size={10} /> No
            </button>
          </div>

          {/* Quick notes */}
          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Quick notes about this strain..."
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500 transition-all resize-none"
            />
          </div>

          {/* Save button */}
          <button
            type="button"
            onClick={handleDetailedSubmit}
            className="w-full py-2 px-4 rounded-lg text-xs font-semibold text-white bg-leaf-500 hover:bg-leaf-600 transition-colors"
          >
            Save Rating Details
          </button>
        </div>
      )}
    </div>
  )
}
