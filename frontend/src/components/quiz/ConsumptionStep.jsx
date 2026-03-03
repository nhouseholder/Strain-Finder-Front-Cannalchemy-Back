import { useQuizState } from '../../hooks/useQuizState'
import { CONSUMPTION_METHODS } from '../../data/consumptionMethods'
import Card from '../shared/Card'
import Button from '../shared/Button'

export default function ConsumptionStep() {
  const { consumptionMethod, setConsumptionMethod, setStep } = useQuizState()

  const canContinue = consumptionMethod !== null

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-display text-gray-900 dark:text-[#e8f0ea] mb-2">
          How do you consume?
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">
          Different methods affect onset time and overall experience.
        </p>
      </div>

      {/* Methods list */}
      <div className="space-y-3">
        {CONSUMPTION_METHODS.map((method) => {
          const isSelected = consumptionMethod === method.id

          return (
            <Card
              key={method.id}
              hoverable
              active={isSelected}
              onClick={() => setConsumptionMethod(method.id)}
              className="p-4"
              aria-pressed={isSelected}
              aria-label={`${method.label}: ${method.desc}`}
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

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea] leading-tight">
                      {method.label}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-[#6a7a6e] mt-0.5">
                    {method.desc}
                  </p>

                  {/* Onset & Duration info */}
                  {method.onset && method.duration && (
                    <div className="flex items-center gap-3 mt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-[#5a6a5e] bg-gray-100 dark:bg-gray-50/[0.04] px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Onset: {method.onset}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-[#5a6a5e] bg-gray-100 dark:bg-gray-50/[0.04] px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Duration: {method.duration}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="md" onClick={() => setStep(2)} aria-label="Go back to tolerance step">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Button>

        <Button size="lg" disabled={!canContinue} onClick={() => setStep(4)} aria-label="Continue to fine-tune step">
          Continue
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
