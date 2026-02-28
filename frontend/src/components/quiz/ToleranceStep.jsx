import { useQuizState } from '../../hooks/useQuizState'
import { TOLERANCES } from '../../data/tolerances'
import { AVOID_EFFECTS } from '../../data/effects'
import Card from '../shared/Card'
import Button from '../shared/Button'

export default function ToleranceStep() {
  const { tolerance, avoidEffects, setTolerance, toggleAvoid, setStep } = useQuizState()

  const canContinue = tolerance !== null

  return (
    <div className="space-y-8">
      {/* Section 1: Experience Level */}
      <div>
        <div className="text-center mb-5">
          <h2 className="text-2xl sm:text-3xl font-display text-gray-900 dark:text-[#e8f0ea] mb-2">
            How experienced are you?
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">
            This helps us recommend the right potency for you.
          </p>
        </div>

        <div className="space-y-3">
          {TOLERANCES.map((t) => {
            const isSelected = tolerance === t.id

            return (
              <Card
                key={t.id}
                hoverable
                active={isSelected}
                onClick={() => setTolerance(t.id)}
                className="p-4"
                aria-pressed={isSelected}
                aria-label={`${t.label}: ${t.desc}`}
              >
                <div className="flex items-center gap-4">
                  {/* Selection radio indicator */}
                  <div
                    className={[
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200',
                      isSelected
                        ? 'border-leaf-500 bg-leaf-500'
                        : 'border-gray-300 dark:border-white/20',
                    ].join(' ')}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-leaf-900" />}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea] leading-tight">
                      {t.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-[#6a7a6e] mt-0.5">{t.desc}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Section 2: Effects to Avoid */}
      <div>
        <div className="text-center mb-5">
          <h3 className="text-lg font-display text-gray-900 dark:text-[#e8f0ea] mb-1">
            Any effects you want to avoid?
          </h3>
          <p className="text-xs text-gray-500 dark:text-[#8a9a8e]">
            Optional. Select any negative effects you'd like to minimize.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {AVOID_EFFECTS.map((effect) => {
            const isSelected = avoidEffects.includes(effect.id)

            return (
              <button
                key={effect.id}
                type="button"
                onClick={() => toggleAvoid(effect.id)}
                className={[
                  'flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-leaf-900',
                  isSelected
                    ? 'bg-red-500/10 dark:bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400'
                    : 'bg-gray-50 dark:bg-gray-50/[0.03] border border-gray-200 dark:border-white/8 text-gray-600 dark:text-[#8a9a8e] hover:bg-gray-50 dark:hover:bg-gray-50/[0.06]',
                ].join(' ')}
                aria-pressed={isSelected}
                aria-label={`Avoid ${effect.label}`}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {effect.emoji}
                </span>
                <span className="text-sm font-medium">{effect.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="md" onClick={() => setStep(1)} aria-label="Go back to effects step">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Button>

        <Button size="lg" disabled={!canContinue} onClick={() => setStep(3)} aria-label="Continue to consumption step">
          Continue
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
