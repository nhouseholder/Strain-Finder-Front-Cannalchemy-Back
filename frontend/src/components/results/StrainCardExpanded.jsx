import { useMemo } from 'react'
import { normalizeStrain } from '../../utils/normalizeStrain'
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
import Card from '../shared/Card'

export default function StrainCardExpanded({ strain: rawStrain }) {
  // Normalize snake_case → camelCase and derive computed fields
  const strain = useMemo(() => normalizeStrain(rawStrain), [rawStrain])
  const { getRating, rateStrain } = useRatings()
  const existingRating = getRating(strain.name)

  const cannabinoids = strain.cannabinoids || []

  // Price badge
  const priceLabel = { low: '$', mid: '$$', high: '$$$' }[strain.priceRange] || null

  return (
    <div className="space-y-5 pt-4 border-t border-gray-200 dark:border-white/[0.06]">
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
      <ScienceExplanation strain={strain} />

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
