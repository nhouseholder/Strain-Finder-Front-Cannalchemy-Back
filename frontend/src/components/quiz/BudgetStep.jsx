import { useQuizState } from '../../hooks/useQuizState'
import { BUDGETS } from '../../data/budgets'
import Card from '../shared/Card'
import Button from '../shared/Button'
import { MapPin } from 'lucide-react'

export default function BudgetStep() {
  const { budget, openToDeals, zipCode, setBudget, setOpenToDeals, setZipCode, setStep } = useQuizState()

  const canContinue = true // budget is optional

  return (
    <div className="space-y-8">
      {/* Zip code — find deals near you */}
      <div className="rounded-2xl border border-leaf-500/20 bg-leaf-500/[0.04] p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-leaf-500/15 flex items-center justify-center flex-shrink-0">
            <MapPin size={15} className="text-leaf-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea]">
              Find cannabis deals near you <span className="text-xs font-normal text-gray-400 dark:text-[#6a7a6e]">(Optional)</span>
            </p>
            <p className="text-[11px] text-gray-500 dark:text-[#6a7a6e] leading-snug">
              Enter your zip code so we can find real prices and nearby dispensaries
            </p>
          </div>
        </div>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          value={zipCode}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 5)
            setZipCode(val)
          }}
          placeholder="e.g. 90210"
          aria-label="Your zip code for finding local deals"
          className="w-full mt-1 px-4 py-2.5 text-base rounded-xl bg-gray-50 dark:bg-gray-50/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 focus:border-leaf-500/40 transition-all"
        />
        {zipCode.length > 0 && zipCode.length < 5 && (
          <p className="text-[10px] text-amber-500 mt-1 ml-1">Enter a 5-digit zip code</p>
        )}
      </div>

      {/* Heading */}
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-display text-gray-900 dark:text-[#e8f0ea] mb-2">
          What's your budget? <span className="text-lg font-normal text-gray-400 dark:text-[#6a7a6e]">(Optional)</span>
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">
          Price per eighth (3.5g). This helps us match quality and value. Skip if you prefer.
        </p>
      </div>

      {/* Budget tier grid - 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {BUDGETS.map((tier) => {
          const isSelected = budget === tier.id

          return (
            <Card
              key={tier.id}
              hoverable
              active={isSelected}
              onClick={() => setBudget(tier.id)}
              className="p-5 text-center"
              aria-pressed={isSelected}
              aria-label={`${tier.label} budget: ${tier.desc}`}
            >
              <p
                className={[
                  'text-3xl font-bold mb-1 transition-colors duration-200',
                  isSelected
                    ? 'text-leaf-500'
                    : 'text-gray-700 dark:text-[#e8f0ea]',
                ].join(' ')}
              >
                {tier.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-[#6a7a6e]">{tier.desc}</p>
            </Card>
          )
        })}
      </div>

      {/* Open to deals toggle */}
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 dark:border-surface-border bg-gray-50 dark:bg-surface p-4">
        <div className="min-w-0 pr-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea]">
            Open to deals outside your tier?
          </p>
          <p className="text-xs text-gray-500 dark:text-[#6a7a6e] mt-0.5">
            We may show great value options slightly outside your range.
          </p>
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={openToDeals}
          aria-label="Open to deals outside your preferred tier"
          onClick={() => setOpenToDeals(!openToDeals)}
          className={[
            'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-leaf-900',
            openToDeals ? 'bg-leaf-500' : 'bg-gray-300 dark:bg-gray-50/10',
          ].join(' ')}
        >
          <span
            className={[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-gray-50 shadow-lg ring-0 transition-transform duration-200',
              openToDeals ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="md" onClick={() => setStep(3)} aria-label="Go back to consumption step">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Button>

        <Button size="lg" disabled={!canContinue} onClick={() => setStep(5)} aria-label="Continue to optional preferences step">
          Continue
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
