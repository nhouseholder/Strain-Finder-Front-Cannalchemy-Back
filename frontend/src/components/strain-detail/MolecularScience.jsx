import { memo } from 'react'
import { Atom, Brain, Shield, Flame, Heart, Bone, Activity } from 'lucide-react'
import { RECEPTOR_COLORS } from '../../utils/colors'

/**
 * Friendly receptor descriptions for non-scientists
 */
const RECEPTOR_INFO = {
  CB1: { icon: Brain, label: 'Brain & Mood', desc: 'Involved in mood, appetite, and memory signaling', color: RECEPTOR_COLORS.CB1 },
  CB2: { icon: Shield, label: 'Immune System', desc: 'Involved in immune response and recovery signaling', color: RECEPTOR_COLORS.CB2 },
  TRPV1: { icon: Flame, label: 'Sensory Receptors', desc: 'Same receptors activated by chili peppers and heat', color: RECEPTOR_COLORS.TRPV1 },
  '5-HT1A': { icon: Heart, label: 'Serotonin Pathway', desc: 'Involved in mood and emotional balance signaling', color: RECEPTOR_COLORS['5-HT1A'] },
  PPARgamma: { icon: Shield, label: 'Metabolic Pathway', desc: 'Involved in metabolic and immune signaling', color: RECEPTOR_COLORS.PPARgamma },
  GPR55: { icon: Bone, label: 'Bone & Vascular', desc: 'Involved in bone and cardiovascular signaling', color: RECEPTOR_COLORS.GPR55 },
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
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium max-w-full"
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

export default memo(function MolecularScience({ effectPredictions, pathways }) {
  if (!pathways?.length) return null

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
})
