import { useMemo, useCallback } from 'react'
import { useQuizState } from '../../hooks/useQuizState'
import { EFFECTS } from '../../data/effects'
import { MAX_EFFECTS_SELECT, MAX_EFFECTS_RANK } from '../../utils/constants'
import Card from '../shared/Card'
import Button from '../shared/Button'

export default function EffectsStep() {
  const { effects, effectRanking, toggleEffect, setEffectRanking, setStep } = useQuizState()

  const canContinue = effects.length > 0
  const showRanking = effects.length >= 3

  // Get the effect objects for selected effects (for the ranking section)
  const selectedEffects = useMemo(
    () => EFFECTS.filter((e) => effects.includes(e.id)),
    [effects]
  )

  // Handle tap-to-rank: tap first = #1, second = #2, third = #3
  const handleRankTap = useCallback(
    (id) => {
      if (effectRanking.includes(id)) {
        // Remove this and all after it (re-rank)
        const idx = effectRanking.indexOf(id)
        setEffectRanking(effectRanking.slice(0, idx))
      } else if (effectRanking.length < MAX_EFFECTS_RANK) {
        setEffectRanking([...effectRanking, id])
      }
    },
    [effectRanking, setEffectRanking]
  )

  const getRankNumber = (id) => {
    const idx = effectRanking.indexOf(id)
    return idx >= 0 ? idx + 1 : null
  }

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-display text-gray-900 dark:text-[#e8f0ea] mb-2">
          What effects are you looking for?
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">
          Select up to {MAX_EFFECTS_SELECT} effects that matter most to you.
        </p>
      </div>

      {/* Effects grid */}
      <div className="grid grid-cols-2 gap-3">
        {EFFECTS.map((effect) => {
          const isSelected = effects.includes(effect.id)
          const isMaxed = effects.length >= MAX_EFFECTS_SELECT && !isSelected

          return (
            <Card
              key={effect.id}
              hoverable
              active={isSelected}
              onClick={() => !isMaxed && toggleEffect(effect.id)}
              className={[
                'p-4 relative',
                isMaxed && 'opacity-40 cursor-not-allowed',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={isSelected}
              aria-label={`${effect.label}: ${effect.desc}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none" aria-hidden="true">
                  {effect.emoji}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea] leading-tight">
                    {effect.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#6a7a6e] mt-0.5">
                    {effect.desc}
                  </p>
                </div>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-leaf-500 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-leaf-900"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Selection count */}
      <p className="text-center text-xs text-gray-400 dark:text-[#5a6a5e]">
        {effects.length} of {MAX_EFFECTS_SELECT} selected
      </p>

      {/* Rank Top 3 section */}
      {showRanking && (
        <div className="animate-fade-in-fast">
          <div className="text-center mb-4">
            <h3 className="text-lg font-display text-gray-900 dark:text-[#e8f0ea] mb-1">
              Rank Your Top 3
            </h3>
            <p className="text-xs text-gray-500 dark:text-[#8a9a8e]">
              Tap effects in order of importance. Tap first for #1, second for #2, third for #3.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {selectedEffects.map((effect) => {
              const rank = getRankNumber(effect.id)
              const isRanked = rank !== null

              return (
                <button
                  key={effect.id}
                  type="button"
                  onClick={() => handleRankTap(effect.id)}
                  className={[
                    'relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-leaf-900',
                    isRanked
                      ? 'bg-leaf-500/15 border border-leaf-500/40 text-leaf-400'
                      : 'bg-gray-50/[0.03] dark:bg-gray-50/[0.03] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8a9a8e] hover:bg-gray-50 dark:hover:bg-gray-50/[0.06]',
                    effectRanking.length >= MAX_EFFECTS_RANK && !isRanked && 'opacity-40 cursor-not-allowed',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={effectRanking.length >= MAX_EFFECTS_RANK && !isRanked}
                  aria-label={`${effect.label}${isRanked ? `, ranked #${rank}` : ', not ranked'}`}
                >
                  {/* Rank badge */}
                  {isRanked && (
                    <span className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-leaf-500 text-leaf-900 text-[10px] font-bold flex items-center justify-center">
                      {rank}
                    </span>
                  )}
                  <span aria-hidden="true">{effect.emoji}</span>
                  {effect.label}
                </button>
              )
            })}
          </div>

          {effectRanking.length < MAX_EFFECTS_RANK && (
            <p className="text-center text-xs text-gray-400 dark:text-[#5a6a5e] mt-2">
              {MAX_EFFECTS_RANK - effectRanking.length} more to rank
            </p>
          )}
        </div>
      )}

      {/* Continue button */}
      <div className="flex justify-end pt-2">
        <Button
          size="lg"
          disabled={!canContinue}
          onClick={() => setStep(2)}
          aria-label="Continue to tolerance step"
        >
          Continue
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
