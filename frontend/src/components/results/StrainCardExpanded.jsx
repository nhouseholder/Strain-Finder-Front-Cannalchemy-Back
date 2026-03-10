import { useMemo } from 'react'
import { normalizeStrain } from '../../utils/normalizeStrain'
import { Link } from 'react-router-dom'
import { strainSlug } from '../../utils/strainSlug'
import ExperienceDescription from '../strain-detail/ExperienceDescription'
import ScienceExplanation from '../strain-detail/ScienceExplanation'
import EffectsBreakdown from '../strain-detail/EffectsBreakdown'
import WhatToExpect from '../strain-detail/WhatToExpect'
import FlavorProfile from '../strain-detail/FlavorProfile'
import CannabinoidProfile from '../strain-detail/CannabinoidProfile'
import TerpeneProfile from '../strain-detail/TerpeneProfile'
import TerpeneRadar from '../strain-detail/TerpeneRadar'
import ConsumptionSuitability from '../strain-detail/ConsumptionSuitability'
import EffectVerification from '../strain-detail/EffectVerification'
// ForumAnalysis removed — duplicate of EffectsBreakdown
import LineageTree from '../strain-detail/LineageTree'
import QuickRate from '../ratings/QuickRate'
import { useRatings } from '../../hooks/useRatings'
import { useStrainSearch } from '../../hooks/useStrainSearch'
import Card from '../shared/Card'

export default function StrainCardExpanded({ strain: rawStrain, isQuizResult }) {
  // Normalize snake_case → camelCase and derive computed fields
  const strain = useMemo(() => normalizeStrain(rawStrain), [rawStrain])
  const { getRating, rateStrain } = useRatings()
  const { fullStrains } = useStrainSearch()
  const existingRating = getRating(strain.name)

  const cannabinoids = strain.cannabinoids || []

  // Price badge
  const priceLabel = { low: '$', mid: '$$', high: '$$$' }[strain.priceRange] || null

  // Find a similar full-data strain (same type) to suggest for incomplete profiles
  const suggestedStrain = useMemo(() => {
    if (strain.dataCompleteness === 'full') return null
    const sameType = fullStrains.filter(s =>
      s.name !== strain.name &&
      (s.type || '').toLowerCase() === (strain.type || '').toLowerCase()
    )
    if (sameType.length === 0) return fullStrains.length > 0 ? fullStrains[0] : null
    // Deterministic pick based on strain name hash
    const hash = strain.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return sameType[hash % sameType.length]
  }, [strain.name, strain.type, strain.dataCompleteness, fullStrains])

  return (
    <div className="space-y-5 pt-4 border-t border-gray-200 dark:border-white/[0.06]">
      {/* Search-Only Data Disclaimer Banner */}
      {strain.dataCompleteness === 'search-only' && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/20 border border-gray-200 dark:border-gray-700/30">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
              Incomplete Profile — Data Not Yet Available
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
              We don't have detailed terpene, cannabinoid, or effect data for this strain yet. This strain is recognized in our database but hasn't been lab-tested or community-reviewed in our system.
              Try asking our <button onClick={() => window.dispatchEvent(new Event('open-chat'))} className="text-leaf-500 dark:text-leaf-400 underline underline-offset-2 hover:text-leaf-400 transition-colors">AI chat</button> about this strain for more info.
            </p>
            {suggestedStrain && (
              <Link
                to={`/strain/${strainSlug(suggestedStrain.name)}`}
                className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-leaf-500/10 border border-leaf-500/20 hover:bg-leaf-500/20 transition-colors group"
              >
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Try instead:</span>
                <span className="text-[11px] font-bold text-leaf-500 dark:text-leaf-400 group-hover:text-leaf-400">{suggestedStrain.name}</span>
                <span className="text-[9px] text-gray-400 dark:text-gray-500">— a {strain.type || 'hybrid'} with a full profile →</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Partial Data Disclaimer Banner */}
      {strain.dataCompleteness === 'partial' && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700/30">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              {strain.source === 'archetype' ? 'Estimated Profile — Not Lab Tested' : 'Limited Data Available'}
            </p>
            <p className="text-[10px] text-amber-600 dark:text-amber-500/80 mt-0.5 leading-relaxed">
              {strain.source === 'archetype'
                ? 'This strain has not been lab tested yet. The chemical profile shown is estimated based on its genetic lineage and archetype classification. We are still compiling verified data for this strain.'
                : 'This strain has not been extensively lab tested. The information shown is based on limited community reports and may not reflect the full chemical profile. Data shown should be considered approximate.'}
              {' '}
              <Link to="/learn/archetypes" className="text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:text-amber-500 transition-colors">
                Learn about our archetype system →
              </Link>
            </p>
            {suggestedStrain && (
              <Link
                to={`/strain/${strainSlug(suggestedStrain.name)}`}
                className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors group"
              >
                <span className="text-[10px] text-amber-600 dark:text-amber-500">Try instead:</span>
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 group-hover:text-amber-300">{suggestedStrain.name}</span>
                <span className="text-[9px] text-amber-500 dark:text-amber-600">— a {strain.type || 'hybrid'} with a full profile →</span>
              </Link>
            )}
          </div>
        </div>
      )}
      {/* 0. Extended description + Price range */}
      {(strain.descriptionExtended && strain.descriptionExtended !== 'NULL') || priceLabel ? (
        <div className="space-y-2">
          {strain.descriptionExtended && strain.descriptionExtended !== 'NULL' && (
            <p className="text-[12px] text-gray-600 dark:text-[#a0b4a6] leading-relaxed">
              {strain.descriptionExtended}
            </p>
          )}
          {priceLabel && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wider">Price Range</span>
              <span className="text-[12px] font-bold text-leaf-400">{priceLabel}</span>
              <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] capitalize">({strain.priceRange})</span>
            </div>
          )}
        </div>
      ) : null}

      {/* 1. The Experience — AI-generated strain description */}
      <ExperienceDescription strain={strain} />

      {/* 2. AI Science Explanation (lazy-loaded on click) */}
      <ScienceExplanation strain={strain} isQuizResult={isQuizResult} />

      {/* 3. Full Effects Breakdown — positive, medical, negative with reports & confidence */}
      <EffectsBreakdown effects={strain.effects} />

      {/* 4. Predicted Effects + Best For / Not Ideal For */}
      <WhatToExpect
        bestFor={strain.bestFor}
        notIdealFor={strain.notIdealFor}
        effectPredictions={strain.effectPredictions}
        effects={strain.effects}
      />

      {/* 5. Flavor Profile */}
      <FlavorProfile flavors={strain.flavors} />

      {/* 6. Cannabinoid Profile */}
      <CannabinoidProfile cannabinoids={cannabinoids} />

      {/* 7. Terpene Profile (bars) */}
      {strain.terpenes?.length > 0 && (
        <TerpeneProfile terpenes={strain.terpenes} />
      )}

      {/* 7b. Terpene Radar Pentagon */}
      {strain.terpenes?.length >= 3 && (
        <TerpeneRadar terpenes={strain.terpenes} strainType={strain.type} />
      )}

      {/* 8. Consumption Suitability — flower, vape, edibles, concentrates, tinctures, topicals */}
      <ConsumptionSuitability data={strain.consumptionSuitability} />

      {/* 9. Effect Verification (predicted vs community) */}
      {strain.effectPredictions?.length > 0 && strain.forumAnalysis && (
        <EffectVerification
          predictions={strain.effectPredictions}
          forumData={strain.forumAnalysis}
        />
      )}

      {/* 10. Community Reviews — REMOVED: duplicate of Full Effects Breakdown (section 3) */}

      {/* 11. Lineage Tree */}
      {strain.lineage && (
        <LineageTree lineage={strain.lineage} />
      )}

      {/* 12. Rate This Strain — inline quick-rate widget */}
      <Card className="p-4 border-leaf-500/20 bg-leaf-500/[0.02]">
        <QuickRate
          strainName={strain.name}
          strainType={strain.type}
          existingRating={existingRating}
          onRate={rateStrain}
        />
      </Card>
    </div>
  )
}
