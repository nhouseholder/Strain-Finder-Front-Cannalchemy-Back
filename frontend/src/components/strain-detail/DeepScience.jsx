import { memo } from 'react'
import { FlaskConical } from 'lucide-react'
import EffectVerification from './EffectVerification'
import MolecularScience from './MolecularScience'
import LineageTree from './LineageTree'
import ReceptorMap from './ReceptorMap'
import ScienceExplanation from './ScienceExplanation'

/**
 * DeepScience — Always-visible section showcasing the 5 advanced science panels.
 *
 * Renders inline (not collapsible) so the molecular pathways,
 * genetics, and receptor data are always front-and-center.
 */
export default memo(function DeepScience({ strain }) {
  const hasEffectVerification = strain.effectPredictions?.length > 0 && strain.forumAnalysis
  const hasMolecularScience = strain.effectPredictions?.length > 0 || strain.pathways?.length > 0
  const hasLineage = !!strain.lineage
  const hasReceptorMap = strain.pathways?.length > 0
  const hasScienceExplanation = true // always shows the "generate" button

  if (!hasEffectVerification && !hasMolecularScience && !hasLineage && !hasReceptorMap) {
    return null
  }

  return (
    <div className="rounded-2xl border border-purple-500/15 bg-purple-500/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 p-4 pb-0">
        <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
          <FlaskConical size={14} className="text-purple-400" />
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
            Deep Science
          </h4>
          <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e]">
            Molecular pathways, genetics &amp; AI analysis
          </p>
        </div>
      </div>

      {/* Content — always visible */}
      <div className="px-4 pb-4 pt-4 space-y-5">
        {/* 1. Predicted vs Reported */}
        {hasEffectVerification && (
          <EffectVerification
            predictions={strain.effectPredictions}
            forumData={strain.forumAnalysis}
          />
        )}

        {/* 2. How It Works (effect probabilities + receptor cards) */}
        {hasMolecularScience && (
          <MolecularScience
            effectPredictions={strain.effectPredictions}
            pathways={strain.pathways}
          />
        )}

        {/* 3. Genetics & Lineage */}
        {hasLineage && (
          <LineageTree lineage={strain.lineage} />
        )}

        {/* 4. Molecular Pathways (flow graph) */}
        {hasReceptorMap && (
          <ReceptorMap
            pathways={strain.pathways}
            effectPredictions={strain.effectPredictions}
          />
        )}

        {/* 5. AI Analysis */}
        {hasScienceExplanation && (
          <ScienceExplanation strain={strain} />
        )}
      </div>
    </div>
  )
})
