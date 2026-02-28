import clsx from 'clsx'
import { getTypeColor } from '../../utils/colors'

export function TypeBadge({ type }) {
  const tc = getTypeColor(type)

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border'
      )}
      style={{
        backgroundColor: `${tc.hex}22`,
        borderColor: `${tc.hex}55`,
        color: tc.hex,
      }}
    >
      {tc.label}
    </span>
  )
}

export function EffectBadge({ effect, variant = 'positive' }) {
  const colors = {
    positive: 'bg-leaf-500/10 text-leaf-400 border-leaf-500/20',
    negative: 'bg-red-500/10 text-red-400 border-red-500/20',
    neutral: 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-[#8a9a8e] border-gray-200 dark:border-white/10',
  }

  // Normalize: handle both string effects and object effects {name, category, ...}
  const label = typeof effect === 'string' ? effect : (effect?.name || effect?.label || String(effect ?? ''))

  return (
    <span className={clsx('inline-flex px-2 py-0.5 rounded-lg text-[10px] border', colors[variant])}>
      {label}
    </span>
  )
}

export function SaleBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
      SALE
    </span>
  )
}

export function ConfidenceBadge({ reviewCount }) {
  const count = typeof reviewCount === 'number'
    ? reviewCount
    : parseInt(String(reviewCount).replace(/[^0-9]/g, ''), 10) || 0
  let level, color
  if (count < 50) {
    level = 'Limited Data'
    color = 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  } else if (count < 200) {
    level = 'Moderate'
    color = 'text-blue-400 bg-blue-500/10 border-blue-500/20'
  } else {
    level = 'High Confidence'
    color = 'text-leaf-400 bg-leaf-500/10 border-leaf-500/20'
  }

  return (
    <span className={clsx('inline-flex px-2 py-0.5 rounded-md text-[10px] border', color)}>
      {level}
    </span>
  )
}
