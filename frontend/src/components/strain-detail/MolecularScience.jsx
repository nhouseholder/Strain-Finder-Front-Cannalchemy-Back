import { Atom, Zap } from 'lucide-react'
import { RECEPTOR_COLORS } from '../../utils/colors'

function EffectPredictionBar({ prediction }) {
  const pct = Math.round((prediction.probability || 0) * 100)
  const displayName = prediction.effect.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-700 dark:text-[#b0c4b4]">
          {displayName}
        </span>
        <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
          {pct}%
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct > 70
              ? 'linear-gradient(90deg, #32c864, #28a854)'
              : pct > 40
                ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                : 'linear-gradient(90deg, #9ca3af, #6b7280)',
          }}
        />
      </div>
      {prediction.pathway && (
        <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e] italic">
          via {prediction.pathway}
        </p>
      )}
    </div>
  )
}

function PathwayChip({ pathway }) {
  const color = RECEPTOR_COLORS[pathway.receptor] || '#6b7280'
  const actionLabel = pathway.action_type || 'modulator'

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border"
      style={{
        backgroundColor: `${color}12`,
        borderColor: `${color}30`,
        color: color,
      }}
    >
      <span className="font-semibold">{pathway.molecule}</span>
      <span className="text-gray-400 dark:text-[#6a7a6e]">&rarr;</span>
      <span>{pathway.receptor}</span>
      {pathway.ki_nm && (
        <span className="text-gray-400 dark:text-[#5a6a5e]">
          ({actionLabel})
        </span>
      )}
    </div>
  )
}

export default function MolecularScience({ effectPredictions, pathways }) {
  if (!effectPredictions?.length && !pathways?.length) return null

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
          <Atom size={14} className="text-purple-400" />
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-[#8a9a8e]">
          Molecular Science
        </h4>
      </div>

      {/* Effect Predictions */}
      {effectPredictions?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Zap size={11} className="text-leaf-400" />
            <span className="text-[10px] font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider">
              Effect Probability
            </span>
          </div>
          <div className="space-y-2 pl-1">
            {effectPredictions.slice(0, 5).map((pred) => (
              <EffectPredictionBar key={pred.effect} prediction={pred} />
            ))}
          </div>
        </div>
      )}

      {/* Receptor Pathways */}
      {pathways?.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider">
            Receptor Pathways
          </span>
          <div className="flex flex-wrap gap-1.5">
            {pathways.slice(0, 8).map((p, i) => (
              <PathwayChip key={`${p.molecule}-${p.receptor}-${i}`} pathway={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
