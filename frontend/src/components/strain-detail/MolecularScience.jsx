import { Atom, Zap, ArrowRight, Brain, Shield, Flame, Heart, Bone, Activity } from 'lucide-react'
import { RECEPTOR_COLORS } from '../../utils/colors'

/**
 * Friendly receptor descriptions for non-scientists
 */
const RECEPTOR_INFO = {
  CB1: { icon: Brain, label: 'Brain & Mood', desc: 'Regulates mood, appetite, pain, and memory', color: RECEPTOR_COLORS.CB1 },
  CB2: { icon: Shield, label: 'Immune System', desc: 'Reduces inflammation and supports recovery', color: RECEPTOR_COLORS.CB2 },
  TRPV1: { icon: Flame, label: 'Pain Sensors', desc: 'Same receptors activated by chili peppers', color: RECEPTOR_COLORS.TRPV1 },
  '5-HT1A': { icon: Heart, label: 'Serotonin (Mood)', desc: 'Linked to anxiety relief and emotional balance', color: RECEPTOR_COLORS['5-HT1A'] },
  PPARgamma: { icon: Shield, label: 'Anti-Inflammatory', desc: 'Reduces chronic inflammation', color: RECEPTOR_COLORS.PPARgamma },
  GPR55: { icon: Bone, label: 'Bone & Blood Pressure', desc: 'Helps regulate bone density and circulation', color: RECEPTOR_COLORS.GPR55 },
}

function PredictedEffectCard({ prediction }) {
  const pct = Math.round((prediction.probability || 0) * 100)
  const displayName = prediction.effect.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const barColor = pct > 70
    ? 'linear-gradient(90deg, #32c864, #28a854)'
    : pct > 40
      ? 'linear-gradient(90deg, #f59e0b, #d97706)'
      : 'linear-gradient(90deg, #9ca3af, #6b7280)'

  const strengthLabel = pct > 70 ? 'Strong' : pct > 40 ? 'Moderate' : 'Mild'
  const strengthColor = pct > 70 ? 'text-leaf-400' : pct > 40 ? 'text-amber-400' : 'text-gray-400'

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-24 flex-shrink-0">
        <span className="text-[11px] font-semibold text-gray-700 dark:text-[#c0d4c6]">
          {displayName}
        </span>
      </div>
      <div className="flex-1">
        <div className="h-2 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>
      </div>
      <div className="w-16 text-right flex-shrink-0">
        <span className={`text-[10px] font-bold ${strengthColor}`}>{strengthLabel}</span>
        <span className="text-[9px] text-gray-400 dark:text-[#6a7a6e] ml-1">{pct}%</span>
      </div>
    </div>
  )
}

function ReceptorCard({ receptor, molecules, isActive }) {
  const info = RECEPTOR_INFO[receptor] || {
    icon: Activity, label: receptor, desc: 'Biological receptor',
    color: '#6b7280',
  }
  const Icon = info.icon

  return (
    <div
      className="rounded-xl border p-3 transition-all duration-200"
      style={{
        borderColor: isActive ? `${info.color}60` : 'transparent',
        backgroundColor: isActive ? `${info.color}08` : 'transparent',
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: `${info.color}18` }}
        >
          <Icon size={14} style={{ color: info.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold" style={{ color: info.color }}>
              {info.label}
            </span>
            <span className="text-[9px] text-gray-400 dark:text-[#5a6a5e] font-mono">
              {receptor}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-[#8a9a8e] mt-0.5">
            {info.desc}
          </p>
          {/* Which molecules activate this receptor */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {molecules.map((m) => (
              <span
                key={m.name}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium"
                style={{
                  backgroundColor: `${info.color}12`,
                  color: info.color,
                }}
              >
                {m.name}
                {m.action && (
                  <span className="opacity-60 text-[8px]">({m.action})</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MolecularScience({ effectPredictions, pathways }) {
  if (!effectPredictions?.length && !pathways?.length) return null

  // Group pathways by receptor
  const receptorGroups = {}
  if (pathways?.length) {
    pathways.forEach((p) => {
      if (!receptorGroups[p.receptor]) {
        receptorGroups[p.receptor] = []
      }
      const existing = receptorGroups[p.receptor].find((m) => m.name === p.molecule)
      if (!existing) {
        receptorGroups[p.receptor].push({
          name: p.molecule,
          action: (p.action_type || '').replace('partial ', '').replace('negative allosteric ', 'allosteric '),
          ki: p.ki_nm,
        })
      }
    })
  }

  // Which receptors are relevant to user's desired effects
  const activeReceptors = new Set()
  effectPredictions?.forEach((ep) => {
    if (ep.pathway) {
      ep.pathway.split(',').forEach((r) => {
        const trimmed = r.trim()
        if (receptorGroups[trimmed]) activeReceptors.add(trimmed)
      })
    }
  })

  return (
    <div className="space-y-4">
      {/* Predicted Effects */}
      {effectPredictions?.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-leaf-500/10 flex items-center justify-center">
              <Zap size={14} className="text-leaf-400" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#8a9a8e]">
                Predicted Effects
              </h4>
              <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e]">
                Based on molecular pathways + community data
              </p>
            </div>
          </div>

          <div className="space-y-0.5">
            {effectPredictions.slice(0, 6).map((pred) => (
              <PredictedEffectCard key={pred.effect} prediction={pred} />
            ))}
          </div>
        </div>
      )}

      {/* Receptors Activated */}
      {Object.keys(receptorGroups).length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
              <Atom size={14} className="text-purple-400" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#8a9a8e]">
                How It Works In Your Body
              </h4>
              <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e]">
                Receptors activated by this strain's compounds
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {Object.entries(receptorGroups).map(([receptor, mols]) => (
              <ReceptorCard
                key={receptor}
                receptor={receptor}
                molecules={mols}
                isActive={activeReceptors.has(receptor)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
