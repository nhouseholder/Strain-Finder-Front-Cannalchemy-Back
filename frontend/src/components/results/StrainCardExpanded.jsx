import WhyMatchTooltip from '../strain-detail/WhyMatchTooltip'
import ExperienceDescription from '../strain-detail/ExperienceDescription'
import WhatToExpect from '../strain-detail/WhatToExpect'
import CannabinoidProfile from '../strain-detail/CannabinoidProfile'
import TerpeneProfile from '../strain-detail/TerpeneProfile'
import TerpeneRadar from '../strain-detail/TerpeneRadar'
import ForumAnalysis from '../strain-detail/ForumAnalysis'
import SommelierReview from '../strain-detail/SommelierReview'
import DeepScience from '../strain-detail/DeepScience'

export default function StrainCardExpanded({ strain }) {
  // Build cannabinoids array from strain data
  const cannabinoids = strain.cannabinoids || [
    { name: 'THC', value: strain.thc || 0, color: '#32c864' },
    { name: 'CBD', value: strain.cbd || 0, color: '#3b82f6' },
    { name: 'CBN', value: strain.cbn || 0, color: '#a855f7' },
    { name: 'CBG', value: strain.cbg || 0, color: '#f59e0b' },
    { name: 'THCV', value: strain.thcv || 0, color: '#ef4444' },
    { name: 'CBC', value: strain.cbc || 0, color: '#22d3ee' },
  ]

  return (
    <div className="space-y-5 pt-4 border-t border-gray-200 dark:border-white/[0.06] overflow-hidden">

      {/* 1. Why This Matches You — plain-language explanation */}
      {strain.whyMatch && (
        <WhyMatchTooltip text={strain.whyMatch} />
      )}

      {/* 1b. The Experience — personal, empathetic strain description */}
      <ExperienceDescription strain={strain} />

      {/* 2. What's Inside — Cannabinoids */}
      <CannabinoidProfile cannabinoids={cannabinoids} />

      {/* 3. What People Say — community reviews */}
      {(strain.forumAnalysis || strain.sentimentScore != null) && (
        <ForumAnalysis
          data={strain.forumAnalysis}
          bestFor={[]}
          notIdealFor={[]}
          sentimentScore={strain.sentimentScore}
        />
      )}

      {/* 4. What's Inside — Terpenes */}
      {strain.terpenes?.length > 0 && (
        <TerpeneProfile terpenes={strain.terpenes} />
      )}

      {/* 5. Terpene Profile — radar visualization */}
      {strain.terpenes?.length >= 3 && (
        <TerpeneRadar terpenes={strain.terpenes} strainType={strain.type} />
      )}

      {/* 6. Taste & Experience — sommelier review */}
      {strain.sommelierScores && (
        <SommelierReview
          scores={strain.sommelierScores}
          notes={strain.sommelierNotes}
        />
      )}

      {/* 7. Community-Reported Effect Predictions */}
      <WhatToExpect
        bestFor={strain.bestFor}
        notIdealFor={strain.notIdealFor}
        effectPredictions={strain.effectPredictions}
        effects={strain.effects}
      />

      {/* 8. Deep Science — collapsible accordion */}
      <DeepScience strain={strain} />
    </div>
  )
}
