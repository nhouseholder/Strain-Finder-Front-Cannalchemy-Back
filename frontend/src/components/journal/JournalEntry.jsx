import { useState } from 'react'
import { Star, Pencil, Trash2, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'
import Card from '../shared/Card'
import { EffectBadge, TypeBadge } from '../shared/Badge'
import { EFFECTS, AVOID_EFFECTS } from '../../data/effects'
import { CONSUMPTION_METHODS } from '../../data/consumptionMethods'

function getEffectLabel(id, list) {
  return list.find((e) => e.id === id)?.label || id
}

function getMethodLabel(id) {
  return CONSUMPTION_METHODS.find((m) => m.id === id)?.label || id
}

export default function JournalEntry({ entry, onEdit, onDelete }) {
  const [showFullNotes, setShowFullNotes] = useState(false)

  const {
    id,
    strainName,
    strainType,
    date,
    rating = 0,
    method,
    dosage,
    effects = [],
    negativeEffects = [],
    notes,
    wouldTryAgain,
  } = entry

  const formattedDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  const hasLongNotes = notes && notes.length > 120
  const displayNotes = hasLongNotes && !showFullNotes
    ? notes.slice(0, 120) + '...'
    : notes

  return (
    <Card className="p-5 space-y-3 animate-fade-in-fast">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {strainName}
            </h3>
            {strainType && <TypeBadge type={strainType} />}
          </div>
          {formattedDate && (
            <p className="text-xs text-gray-400 dark:text-[#6a7a6e] mt-0.5">
              {formattedDate}
            </p>
          )}
        </div>

        {/* Edit / Delete */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(entry)}
              className="p-1.5 rounded-lg text-gray-400 dark:text-[#6a7a6e] hover:text-gray-600 dark:hover:text-[#b0c4b4] hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              aria-label={`Edit ${strainName} entry`}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(id)}
              className="p-1.5 rounded-lg text-gray-400 dark:text-[#6a7a6e] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              aria-label={`Delete ${strainName} entry`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Star rating */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={clsx(
              'w-4 h-4',
              star <= rating
                ? 'text-amber-400 fill-amber-400'
                : 'text-gray-300 dark:text-[#5a6a5e]'
            )}
          />
        ))}
      </div>

      {/* Method + Dosage */}
      {(method || dosage) && (
        <div className="flex items-center gap-2 flex-wrap">
          {method && (
            <span className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-[#8a9a8e] border border-gray-200 dark:border-white/10">
              {getMethodLabel(method)}
            </span>
          )}
          {dosage && (
            <span className="text-xs text-gray-500 dark:text-[#8a9a8e]">
              {dosage}
            </span>
          )}
        </div>
      )}

      {/* Positive effects */}
      {effects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {effects.map((eff) => (
            <EffectBadge
              key={eff}
              effect={getEffectLabel(eff, EFFECTS)}
              variant="positive"
            />
          ))}
        </div>
      )}

      {/* Negative effects */}
      {negativeEffects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {negativeEffects.map((eff) => (
            <EffectBadge
              key={eff}
              effect={getEffectLabel(eff, AVOID_EFFECTS)}
              variant="negative"
            />
          ))}
        </div>
      )}

      {/* Would try again */}
      {wouldTryAgain !== undefined && (
        <div className="flex items-center gap-1.5">
          {wouldTryAgain ? (
            <ThumbsUp className="w-4 h-4 text-leaf-400" />
          ) : (
            <ThumbsDown className="w-4 h-4 text-red-400" />
          )}
          <span className={clsx(
            'text-xs font-medium',
            wouldTryAgain ? 'text-leaf-400' : 'text-red-400'
          )}>
            {wouldTryAgain ? 'Would try again' : 'Would not try again'}
          </span>
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div>
          <p className="text-sm text-gray-600 dark:text-[#b0c4b4] leading-relaxed">
            {displayNotes}
          </p>
          {hasLongNotes && (
            <button
              type="button"
              onClick={() => setShowFullNotes(!showFullNotes)}
              className="inline-flex items-center gap-1 mt-1 text-xs text-leaf-400 hover:text-leaf-300 transition-colors"
            >
              {showFullNotes ? (
                <>Show less <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>Show more <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
