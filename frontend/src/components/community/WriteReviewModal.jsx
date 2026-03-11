import { useState, useMemo } from 'react'
import { Star } from 'lucide-react'
import clsx from 'clsx'
import Modal from '../shared/Modal'
import { EFFECTS } from '../../data/effects'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'

const METHODS = [
  { id: 'flower', label: 'Flower' },
  { id: 'edible', label: 'Edible' },
  { id: 'vape', label: 'Vape' },
  { id: 'concentrate', label: 'Concentrate' },
]

export default function WriteReviewModal({ open, onClose, onSubmit, strainName, submitting = false }) {
  const { user } = useAuth()

  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [text, setText] = useState('')
  const [effectTags, setEffectTags] = useState([])
  const [method, setMethod] = useState('')
  const [localError, setLocalError] = useState('')

  const charCount = text.length
  const isValid = rating >= 1 && text.length >= 20

  const toggleEffect = (id) => {
    setEffectTags(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    if (!isValid) return
    setLocalError('')
    try {
      await onSubmit({ rating, text, effectTags, method })
      // Reset form
      setRating(0)
      setText('')
      setEffectTags([])
      setMethod('')
      onClose()
    } catch (err) {
      setLocalError(err.message)
    }
  }

  const displayRating = hoverRating || rating

  return (
    <Modal open={open} onClose={onClose} title={`Review ${strainName || 'Strain'}`}>
      {/* Auth gate */}
      {!user ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 dark:text-[#8a9a8e] mb-4">
            Sign in to share your experience with the community.
          </p>
          <Link
            to="/login"
            className="inline-flex px-5 py-2.5 rounded-xl bg-leaf-500 text-white text-sm font-semibold hover:bg-leaf-400 transition-colors"
          >
            Sign In
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Star rating */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wide mb-2">
              Rating *
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setHoverRating(i)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(i)}
                  className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    size={28}
                    className={clsx(
                      'transition-colors',
                      i <= displayRating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-300 dark:text-gray-600'
                    )}
                  />
                </button>
              ))}
              {displayRating > 0 && (
                <span className="ml-2 text-sm text-gray-500 dark:text-[#8a9a8e]">
                  {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][displayRating]}
                </span>
              )}
            </div>
          </div>

          {/* Review text */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wide mb-2">
              Your Review *
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Share your experience — effects, flavor, occasion..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-sm text-gray-800 dark:text-[#d0e4d4] placeholder-gray-400 dark:placeholder-[#6a7a6e] focus:outline-none focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500/50 resize-none text-base"
            />
            <div className="flex justify-between mt-1">
              <span className={clsx('text-[10px]', charCount < 20 ? 'text-red-400' : 'text-gray-400 dark:text-[#6a7a6e]')}>
                {charCount < 20 ? `${20 - charCount} more characters needed` : ''}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
                {charCount}/500
              </span>
            </div>
          </div>

          {/* Effect tags */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wide mb-2">
              Effects Felt
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EFFECTS.map(eff => (
                <button
                  key={eff.id}
                  type="button"
                  onClick={() => toggleEffect(eff.id)}
                  className={clsx(
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px]',
                    effectTags.includes(eff.id)
                      ? 'bg-leaf-500/20 text-leaf-500 dark:text-leaf-400 ring-1 ring-leaf-500/30'
                      : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#8a9a8e] hover:bg-gray-200 dark:hover:bg-white/[0.08]'
                  )}
                >
                  {eff.emoji} {eff.label}
                </button>
              ))}
            </div>
          </div>

          {/* Consumption method */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wide mb-2">
              Method <span className="font-normal">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(prev => prev === m.id ? '' : m.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px]',
                    method === m.id
                      ? 'bg-purple-500/20 text-purple-500 dark:text-purple-400 ring-1 ring-purple-500/30'
                      : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#8a9a8e] hover:bg-gray-200 dark:hover:bg-white/[0.08]'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {localError && (
            <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
              {localError}
            </p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className={clsx(
              'w-full py-3 rounded-xl text-sm font-bold transition-all min-h-[48px]',
              isValid && !submitting
                ? 'bg-leaf-500 text-white hover:bg-leaf-400 shadow-md shadow-leaf-500/25'
                : 'bg-gray-200 dark:bg-white/[0.06] text-gray-400 dark:text-[#6a7a6e] cursor-not-allowed'
            )}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Submitting...
              </span>
            ) : (
              'Submit Review'
            )}
          </button>
        </div>
      )}
    </Modal>
  )
}
