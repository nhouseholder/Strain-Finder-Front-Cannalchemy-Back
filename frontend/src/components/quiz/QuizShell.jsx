import { useQuizState } from '../../hooks/useQuizState'
import { QUIZ_STEPS } from '../../utils/constants'
import EffectsStep from './EffectsStep'
import ToleranceStep from './ToleranceStep'
import OptionalPrefsStep from './OptionalPrefsStep'
import DispensaryStep from './DispensaryStep'

const stepComponents = {
  1: EffectsStep,
  2: ToleranceStep,
  3: OptionalPrefsStep,
  4: DispensaryStep,
}

export default function QuizShell({ onComplete }) {
  const { currentStep } = useQuizState()

  // Steps 0 (splash) and 5+ (loading/results) are handled externally
  if (currentStep < 1 || currentStep > 4) return null

  const StepComponent = stepComponents[currentStep]

  return (
    <div className="w-full max-w-2xl mx-auto px-4 animate-fade-in">
      {/* Step counter text */}
      <p className="text-center text-sm text-gray-500 dark:text-[#6a7a6e] mb-4 font-body">
        Step {currentStep} of {QUIZ_STEPS.length}
      </p>

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {QUIZ_STEPS.map((step, i) => {
            const stepNum = step.number
            const isCompleted = currentStep > stepNum
            const isCurrent = currentStep === stepNum
            const isFuture = currentStep < stepNum

            return (
              <div key={step.id} className="flex flex-col items-center gap-1.5">
                {/* Dot / segment */}
                <div
                  className={[
                    'rounded-full transition-all duration-300',
                    isCompleted && 'w-3 h-3 bg-leaf-500',
                    isCurrent && 'w-4 h-4 bg-leaf-500 ring-4 ring-leaf-500/20',
                    isFuture && 'w-3 h-3 bg-gray-300 dark:bg-gray-50/10',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
                {/* Label */}
                <span
                  className={[
                    'text-[10px] sm:text-xs font-medium transition-colors duration-300 whitespace-nowrap',
                    isCompleted && 'text-leaf-500',
                    isCurrent && 'text-leaf-400',
                    isFuture && 'text-gray-400 dark:text-[#5a6a5e]',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Connecting lines between dots */}
        <div className="flex items-center justify-center mt-[-26px] sm:mt-[-28px] mb-6 pointer-events-none">
          <div className="flex items-center gap-0" style={{ width: 'fit-content' }}>
            {QUIZ_STEPS.map((step, i) => {
              if (i === QUIZ_STEPS.length - 1) return null
              const filled = currentStep > step.number
              return (
                <div key={`line-${step.id}`} className="flex items-center">
                  <div className="w-3 sm:w-3" /> {/* spacer for dot */}
                  <div
                    className={[
                      'h-0.5 w-6 sm:w-8 transition-colors duration-300',
                      filled ? 'bg-leaf-500/40' : 'bg-gray-200 dark:bg-gray-50/5',
                    ].join(' ')}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Current step component */}
      <div className="animate-fade-in-fast">
        <StepComponent onComplete={onComplete} />
      </div>
    </div>
  )
}
