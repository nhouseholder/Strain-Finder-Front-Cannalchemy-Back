import { Lock, Sparkles } from 'lucide-react'
import WhyMatchTooltip from '../strain-detail/WhyMatchTooltip'
import WhatToExpect from '../strain-detail/WhatToExpect'
import CannabinoidProfile from '../strain-detail/CannabinoidProfile'
import TerpeneProfile from '../strain-detail/TerpeneProfile'
import TerpeneRadar from '../strain-detail/TerpeneRadar'
import ForumAnalysis from '../strain-detail/ForumAnalysis'
import SommelierReview from '../strain-detail/SommelierReview'
import DeepScience from '../strain-detail/DeepScience'

export default function StrainCardExpanded({ strain, isPremium }) {
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

      {/* === Premium-only sections below === */}
      {isPremium ? (
        <>
          {/* 7. Scientifically Predicted Effects */}
          <WhatToExpect
            bestFor={strain.bestFor}
            notIdealFor={strain.notIdealFor}
            effectPredictions={strain.effectPredictions}
            effects={strain.effects}
          />

          {/* 8. Deep Science — collapsible accordion */}
          <DeepScience strain={strain} />
        </>
      ) : (
        <div className="relative">
          {/* Blurred preview */}
          <div className="blur-sm pointer-events-none select-none opacity-50 space-y-5">
            <WhatToExpect
              bestFor={strain.bestFor}
              notIdealFor={strain.notIdealFor}
              effectPredictions={strain.effectPredictions}
              effects={strain.effects}
            />
            <DeepScience strain={strain} />
          </div>

          {/* Unlock overlay */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center px-6 py-6 rounded-2xl bg-white/80 dark:bg-[#0a0f0c]/80 backdrop-blur-sm border border-leaf-500/20 shadow-lg max-w-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                <Lock size={18} className="text-amber-500" />
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">
                Premium Science Data
              </p>
              <p className="text-[11px] text-gray-500 dark:text-[#8a9a8e] mb-3 leading-relaxed">
                Unlock predicted effects, receptor pathways, and deep molecular science.
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-leaf-500/10 text-leaf-500 text-[11px] font-semibold">
                <Sparkles size={12} />
                Upgrade for $9.99/mo
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
