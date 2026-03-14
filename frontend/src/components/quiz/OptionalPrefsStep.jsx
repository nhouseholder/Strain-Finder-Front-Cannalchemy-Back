import { useQuizState } from '../../hooks/useQuizState'
import { SUBTYPES, SUBTYPE_TOOLTIP } from '../../data/subtypes'
import { THC_PREFERENCES, CBD_PREFERENCES } from '../../data/cannabinoids'
import { FLAVORS } from '../../data/flavors'
import { Info, MapPin } from 'lucide-react'
import Button from '../shared/Button'

export default function OptionalPrefsStep({ onComplete }) {
  const {
    subtype,
    thcPreference,
    cbdPreference,
    flavors,
    zipCode,
    setSubtype,
    setThcPreference,
    setCbdPreference,
    toggleFlavor,
    setZipCode,
    setStep,
  } = useQuizState()

  const handleNext = () => {
    setStep(4) // Advance to dispensary step
  }

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-display text-gray-900 dark:text-[#e8f0ea] mb-2">
          Fine-tune your preferences
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">
          All fields are optional. Skip ahead or dial things in.
        </p>
      </div>

      {/* Section 1: Preferred Subtype */}
      <div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <h3 className="text-base font-display text-gray-900 dark:text-[#e8f0ea]">
            Preferred Subtype
          </h3>
        </div>

        {/* Always-visible info note replacing hover tooltip */}
        <div className="flex items-start gap-2 mx-auto max-w-lg mb-4 p-3 rounded-xl bg-leaf-500/[0.06] border border-leaf-500/15">
          <Info size={14} className="text-leaf-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-gray-500 dark:text-[#8a9a8e]">
            {SUBTYPE_TOOLTIP}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {SUBTYPES.map((st) => {
            const isSelected = subtype === st.id

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSubtype(st.id)}
                className={[
                  'px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 min-h-[44px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-leaf-900',
                  isSelected
                    ? 'text-white shadow-md'
                    : 'bg-gray-50 dark:bg-gray-50/[0.04] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8a9a8e] hover:bg-gray-50 dark:hover:bg-gray-50/[0.08]',
                ].join(' ')}
                style={isSelected ? { backgroundColor: st.color } : undefined}
                aria-pressed={isSelected}
                aria-label={`${st.label}: ${st.desc}`}
              >
                {st.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Section 2: THC & CBD Preferences */}
      <div className="space-y-5">
        <h3 className="text-base font-display text-gray-900 dark:text-[#e8f0ea] text-center">
          THC & CBD Preferences
        </h3>

        {/* THC row */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wider mb-2 text-center">
            THC Level
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {THC_PREFERENCES.map((pref) => {
              const isSelected = thcPreference === pref.id

              return (
                <button
                  key={pref.id}
                  type="button"
                  onClick={() => setThcPreference(pref.id)}
                  className={[
                    'px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 min-h-[44px]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-leaf-900',
                    isSelected
                      ? 'bg-sativa-500/15 border border-sativa-500/40 text-sativa-400'
                      : 'bg-gray-50 dark:bg-gray-50/[0.03] border border-gray-200 dark:border-white/8 text-gray-600 dark:text-[#8a9a8e] hover:bg-gray-50 dark:hover:bg-gray-50/[0.06]',
                  ].join(' ')}
                  aria-pressed={isSelected}
                  aria-label={`THC: ${pref.label} - ${pref.desc}`}
                >
                  <span className="block font-semibold">{pref.label}</span>
                  <span className="block text-[10px] opacity-70 mt-0.5">{pref.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* CBD row */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wider mb-2 text-center">
            CBD Level
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {CBD_PREFERENCES.map((pref) => {
              const isSelected = cbdPreference === pref.id

              return (
                <button
                  key={pref.id}
                  type="button"
                  onClick={() => setCbdPreference(pref.id)}
                  className={[
                    'px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 min-h-[44px]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-leaf-900',
                    isSelected
                      ? 'bg-indica-500/15 border border-indica-500/40 text-indica-400'
                      : 'bg-gray-50 dark:bg-gray-50/[0.03] border border-gray-200 dark:border-white/8 text-gray-600 dark:text-[#8a9a8e] hover:bg-gray-50 dark:hover:bg-gray-50/[0.06]',
                  ].join(' ')}
                  aria-pressed={isSelected}
                  aria-label={`CBD: ${pref.label} - ${pref.desc}`}
                >
                  <span className="block font-semibold">{pref.label}</span>
                  <span className="block text-[10px] opacity-70 mt-0.5">{pref.desc}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Section 3: Flavor Preferences */}
      <div>
        <h3 className="text-base font-display text-gray-900 dark:text-[#e8f0ea] text-center mb-3">
          Flavor Preferences
        </h3>

        <div className="flex flex-wrap justify-center gap-2">
          {FLAVORS.map((flavor) => {
            const isSelected =
              flavor.id === 'no_preference'
                ? flavors.length === 0
                : flavors.includes(flavor.id)

            return (
              <button
                key={flavor.id}
                type="button"
                onClick={() => toggleFlavor(flavor.id)}
                className={[
                  'inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 min-h-[44px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-leaf-900',
                  isSelected
                    ? 'border shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-50/[0.03] border border-gray-200 dark:border-white/8 text-gray-600 dark:text-[#8a9a8e] hover:bg-gray-50 dark:hover:bg-gray-50/[0.06]',
                ].join(' ')}
                style={
                  isSelected
                    ? {
                        backgroundColor: `${flavor.color}15`,
                        borderColor: `${flavor.color}50`,
                        color: flavor.color,
                      }
                    : undefined
                }
                aria-pressed={isSelected}
                aria-label={`Flavor: ${flavor.label}`}
              >
                <span aria-hidden="true">{flavor.emoji}</span>
                {flavor.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Section 4: Your Location (zip code) */}
      <div className="rounded-2xl border border-leaf-500/20 bg-leaf-500/[0.04] p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-leaf-500/15 flex items-center justify-center flex-shrink-0">
            <MapPin size={15} className="text-leaf-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea]">
              Your Location <span className="text-xs font-normal text-gray-400 dark:text-[#6a7a6e]">(Optional)</span>
            </p>
            <p className="text-[11px] text-gray-500 dark:text-[#6a7a6e] leading-snug">
              Enter your zip code so we can prioritize strains available in your area
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
          aria-label="Your zip code for finding local strains"
          className="w-full mt-1 px-4 py-2.5 text-base rounded-xl bg-gray-50 dark:bg-gray-50/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 focus:border-leaf-500/40 transition-all"
        />
        {zipCode.length > 0 && zipCode.length < 5 && (
          <p className="text-[10px] text-amber-500 mt-1 ml-1">Enter a 5-digit zip code</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="md" onClick={() => setStep(2)} aria-label="Go back to tolerance step">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Button>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="md" onClick={handleNext} aria-label="Skip fine-tuning">
            Skip
          </Button>
          <Button size="lg" onClick={handleNext} aria-label="Continue to next step">
            Next
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  )
}
