import WhyMatchTooltip from '../strain-detail/WhyMatchTooltip'
import ScienceExplanation from '../strain-detail/ScienceExplanation'
import CannabinoidProfile from '../strain-detail/CannabinoidProfile'
import TerpeneProfile from '../strain-detail/TerpeneProfile'
import TerpeneRadar from '../strain-detail/TerpeneRadar'
import MolecularScience from '../strain-detail/MolecularScience'
import ReceptorMap from '../strain-detail/ReceptorMap'
import EffectVerification from '../strain-detail/EffectVerification'
import SommelierReview from '../strain-detail/SommelierReview'
import ForumAnalysis from '../strain-detail/ForumAnalysis'
import LineageTree from '../strain-detail/LineageTree'

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
      {/* ── BASIC INFO ─────────────────────────────────────── */}

      {/* 1. Why This Match — plain-language explanation */}
      {strain.whyMatch && (
        <WhyMatchTooltip text={strain.whyMatch} />
      )}

      {/* 2. Forum / Community Analysis — crowd-sourced data */}
      {(strain.forumAnalysis || strain.bestFor?.length > 0 || strain.sentimentScore != null) && (
        <ForumAnalysis
          data={strain.forumAnalysis}
          bestFor={strain.bestFor}
          notIdealFor={strain.notIdealFor}
          sentimentScore={strain.sentimentScore}
        />
      )}

      {/* 3. Cannabinoid Profile — THC/CBD/CBN bars */}
      <CannabinoidProfile cannabinoids={cannabinoids} />

      {/* 4. Terpene Profile (bars) */}
      {strain.terpenes?.length > 0 && (
        <TerpeneProfile terpenes={strain.terpenes} />
      )}

      {/* 5. Terpene Radar Pentagon */}
      {strain.terpenes?.length >= 3 && (
        <TerpeneRadar terpenes={strain.terpenes} strainType={strain.type} />
      )}

      {/* 6. Sommelier Review — expert-style scoring */}
      {strain.sommelierScores && (
        <SommelierReview
          scores={strain.sommelierScores}
          notes={strain.sommelierNotes}
        />
      )}

      {/* ── SCIENCE ────────────────────────────────────────── */}

      {/* 7. Effect Verification (predicted vs community) */}
      {strain.effectPredictions?.length > 0 && strain.forumAnalysis && (
        <EffectVerification
          predictions={strain.effectPredictions}
          forumData={strain.forumAnalysis}
        />
      )}

      {/* 8. Lineage Tree — genetics & heritage */}
      {strain.lineage && (
        <LineageTree lineage={strain.lineage} />
      )}

      {/* 9. Molecular Science (effect probabilities + pathway chips) */}
      {(strain.effectPredictions?.length > 0 || strain.pathways?.length > 0) && (
        <MolecularScience
          effectPredictions={strain.effectPredictions}
          pathways={strain.pathways}
        />
      )}

      {/* 10. Receptor Pathway Map (molecule → receptor → effect flow) */}
      {strain.pathways?.length > 0 && (
        <ReceptorMap
          pathways={strain.pathways}
          effectPredictions={strain.effectPredictions}
        />
      )}

      {/* 11. AI Science Explanation (deep dive, lazy-loaded) */}
      <ScienceExplanation strain={strain} />
    </div>
  )
}
