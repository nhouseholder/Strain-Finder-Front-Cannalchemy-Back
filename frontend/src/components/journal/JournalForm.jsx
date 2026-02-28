import { useState, useEffect, useMemo, useRef } from 'react'
import { Star, ChevronDown, X } from 'lucide-react'
import clsx from 'clsx'
import Button from '../shared/Button'
import Card from '../shared/Card'
import { EFFECTS, AVOID_EFFECTS } from '../../data/effects'
import { CONSUMPTION_METHODS } from '../../data/consumptionMethods'

// Use the same hook the rest of the app uses for strain data access
import { useStrainSearch } from '../../hooks/useStrainSearch'

const DOSAGE_PLACEHOLDERS = {
  flower: 'e.g., 0.5g, 1 bowl',
  vape: 'e.g., 3 puffs, 1 cart',
  edibles: 'e.g., 10mg, 1 gummy',
  concentrates: 'e.g., 1 dab, 0.1g',
  tinctures: 'e.g., 0.5ml, 15 drops',
  topicals: 'e.g., liberal application',
  no_preference: 'e.g., amount consumed',
}

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function JournalForm({ onSubmit, onCancel, initialData }) {
  const { allStrains, getStrainByName } = useStrainSearch()

  const [strainName, setStrainName] = useState(initialData?.strainName || '')
  const [strainType, setStrainType] = useState(initialData?.strainType || '')
  const [date, setDate] = useState(initialData?.date || today())
  const [rating, setRating] = useState(initialData?.rating || 0)
  const [hoverRating, setHoverRating] = useState(0)
  const [method, setMethod] = useState(initialData?.method || '')
  const [dosage, setDosage] = useState(initialData?.dosage || '')
  const [context, setContext] = useState(initialData?.context || '')
  const [effects, setEffects] = useState(initialData?.effects || [])
  const [negativeEffects, setNegativeEffects] = useState(initialData?.negativeEffects || [])
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [wouldTryAgain, setWouldTryAgain] = useState(initialData?.wouldTryAgain ?? true)

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)

  const suggestions = useMemo(() => {
    if (!strainName || strainName.length < 2 || !allStrains?.length) return []
    const lower = strainName.toLowerCase()
    return allStrains
      .filter((s) => s.name.toLowerCase().includes(lower))
      .slice(0, 8)
  }, [strainName, allStrains])

  // Auto-populate strain type when name matches a known strain
  useEffect(() => {
    const match = getStrainByName(strainName)
    if (match) {
      setStrainType(match.type || '')
    }
  }, [strainName, getStrainByName])

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggleEffect = (id) => {
    setEffects((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  const toggleNegativeEffect = (id) => {
    setNegativeEffects((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!strainName.trim() || rating === 0) return

    onSubmit?.({
      ...(initialData?.id ? { id: initialData.id } : {}),
      strainName: strainName.trim(),
      strainType,
      date,
      rating,
      method,
      dosage: dosage.trim(),
      context: context.trim(),
      effects,
      negativeEffects,
      notes: notes.trim(),
      wouldTryAgain,
    })
  }

  const selectSuggestion = (strain) => {
    setStrainName(strain.name)
    setStrainType(strain.type || '')
    setShowSuggestions(false)
  }

  const inputClasses =
    'w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500 focus:border-transparent transition-all duration-200'

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Strain Name with Autocomplete */}
        <div className="relative">
          <label className="block text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-2">
            Strain Name *
          </label>
          <input
            ref={inputRef}
            type="text"
            value={strainName}
            onChange={(e) => {
              setStrainName(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Start typing a strain name..."
            className={inputClasses}
            required
          />

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-20 w-full mt-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a2a1e] shadow-lg max-h-48 overflow-y-auto"
            >
              {suggestions.map((strain) => (
                <button
                  key={strain.name}
                  type="button"
                  onClick={() => selectSuggestion(strain)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors flex items-center justify-between"
                >
                  <span>{strain.name}</span>
                  {strain.type && (
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#6a7a6e]">
                      {strain.type}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-2">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClasses}
          />
        </div>

        {/* Rating */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-2">
            Rating *
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = star <= (hoverRating || rating)
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 rounded"
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    className={clsx(
                      'w-7 h-7 transition-colors',
                      isFilled
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-300 dark:text-[#5a6a5e]'
                    )}
                  />
                </button>
              )
            })}
            {rating > 0 && (
              <span className="ml-2 text-sm text-gray-500 dark:text-[#8a9a8e]">
                {rating}/5
              </span>
            )}
          </div>
        </div>

        {/* Consumption Method */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-2">
            Consumption Method
          </label>
          <div className="relative">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={clsx(inputClasses, 'appearance-none pr-10')}
            >
              <option value="">Select method...</option>
              {CONSUMPTION_METHODS.filter((m) => m.id !== 'no_preference').map(
                (m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                )
              )}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#6a7a6e] pointer-events-none" />
          </div>
        </div>

        {/* Dosage */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-2">
            Dosage
          </label>
          <input
            type="text"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder={DOSAGE_PLACEHOLDERS[method] || 'e.g., amount consumed'}
            className={inputClasses}
          />
        </div>

        {/* Context / Setting */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-2">
            Context / Setting
          </label>
          <input
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Evening relaxation, social gathering, creative session..."
            className={inputClasses}
          />
        </div>

        {/* Experienced Effects */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-2">
            Experienced Effects
          </label>
          <div className="flex flex-wrap gap-2">
            {EFFECTS.map((effect) => {
              const isSelected = effects.includes(effect.id)
              return (
                <button
                  key={effect.id}
                  type="button"
                  onClick={() => toggleEffect(effect.id)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500',
                    isSelected
                      ? 'bg-leaf-500/15 text-leaf-400 border border-leaf-500/30'
                      : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#8a9a8e] border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/[0.08]'
                  )}
                >
                  <span aria-hidden="true">{effect.emoji}</span>
                  {effect.label}
                  {isSelected && <X className="w-3 h-3" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Negative Effects */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-2">
            Negative Effects
          </label>
          <div className="flex flex-wrap gap-2">
            {AVOID_EFFECTS.map((effect) => {
              const isSelected = negativeEffects.includes(effect.id)
              return (
                <button
                  key={effect.id}
                  type="button"
                  onClick={() => toggleNegativeEffect(effect.id)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500',
                    isSelected
                      ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                      : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#8a9a8e] border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/[0.08]'
                  )}
                >
                  <span aria-hidden="true">{effect.emoji}</span>
                  {effect.label}
                  {isSelected && <X className="w-3 h-3" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-2">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How was the overall experience? Any notable observations..."
            rows={3}
            className={clsx(inputClasses, 'resize-none')}
          />
        </div>

        {/* Would Try Again toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-[#b0c4b4]">
            Would try again?
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={wouldTryAgain}
            onClick={() => setWouldTryAgain(!wouldTryAgain)}
            className={clsx(
              'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-leaf-900',
              wouldTryAgain
                ? 'bg-leaf-500'
                : 'bg-gray-300 dark:bg-white/10'
            )}
          >
            <span
              className={clsx(
                'inline-block w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                wouldTryAgain ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            size="full"
            disabled={!strainName.trim() || rating === 0}
          >
            {initialData ? 'Update Entry' : 'Save Entry'}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}
