import { memo } from 'react'
import { Flame, Wind, Cookie, Droplets, FlaskConical, Hand } from 'lucide-react'

const METHOD_META = {
  flower:       { label: 'Flower',       icon: Flame,       color: '#32c864' },
  vape:         { label: 'Vape',         icon: Wind,        color: '#3b82f6' },
  edibles:      { label: 'Edibles',      icon: Cookie,      color: '#f59e0b' },
  concentrates: { label: 'Concentrates', icon: FlaskConical, color: '#a855f7' },
  tinctures:    { label: 'Tinctures',    icon: Droplets,    color: '#22d3ee' },
  topicals:     { label: 'Topicals',     icon: Hand,        color: '#ec4899' },
}

function RatingBar({ method, score }) {
  const meta = METHOD_META[method] || { label: method, icon: Flame, color: '#6b7280' }
  const Icon = meta.icon
  const pct = Math.max(Math.min((score / 10) * 100, 100), 5)
  const strength = score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : score >= 4 ? 'Fair' : 'Low'

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${meta.color}15` }}>
        <Icon size={11} style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px] font-medium text-gray-700 dark:text-[#b0c4b4]">{meta.label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold" style={{ color: meta.color }}>{strength}</span>
            <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e] font-mono w-6 text-right">{score}/10</span>
          </div>
        </div>
        <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-white/[0.06]">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, backgroundColor: meta.color, opacity: 0.7 }}
          />
        </div>
      </div>
    </div>
  )
}

export default memo(function ConsumptionSuitability({ data }) {
  if (!data || typeof data !== 'object') return null
  const entries = Object.entries(data).filter(([, v]) => typeof v === 'number' && v > 0)
  if (entries.length === 0) return null

  // Sort by score descending
  entries.sort((a, b) => b[1] - a[1])

  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e] mb-1">
        Consumption Methods
      </h4>
      <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e] mb-3">
        How well this strain suits each consumption method
      </p>
      <div className="space-y-2.5">
        {entries.map(([method, score]) => (
          <RatingBar key={method} method={method} score={score} />
        ))}
      </div>
    </div>
  )
})
