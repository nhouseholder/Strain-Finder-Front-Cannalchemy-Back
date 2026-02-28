import { memo } from 'react'
import { Sparkles, AlertTriangle, HeartPulse } from 'lucide-react'

const CATEGORY_META = {
  positive: { label: 'Positive Effects', icon: Sparkles, color: '#32c864', barColor: 'bg-leaf-500' },
  medical:  { label: 'Medical Benefits', icon: HeartPulse, color: '#3b82f6', barColor: 'bg-blue-500' },
  negative: { label: 'Potential Side Effects', icon: AlertTriangle, color: '#ef4444', barColor: 'bg-red-500' },
}

function EffectRow({ effect, maxReports, barColor }) {
  const name = typeof effect === 'string' ? effect : (effect?.name || '')
  const reports = effect?.reports || 0
  const confidence = effect?.confidence || 0
  // Normalize raw report count to 0-100 scale relative to the highest-reported effect
  const pct = maxReports > 0 ? Math.round((reports / maxReports) * 100) : 0
  const widthPct = Math.max(pct, 4)
  const confLabel = confidence >= 0.9 ? 'High' : confidence >= 0.6 ? 'Med' : 'Low'

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-gray-700 dark:text-[#b0c4b4] capitalize truncate flex-1">
          {name}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[9px] text-gray-400 dark:text-[#6a7a6e]">
            {confLabel} conf.
          </span>
          <span className="text-[10px] text-gray-500 dark:text-[#8a9a8e] font-mono w-10 text-right">
            {pct}%
          </span>
        </div>
      </div>
      <div className="relative w-full h-1.5 rounded-full bg-gray-200 dark:bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${widthPct}%`, opacity: 0.7 }}
        />
      </div>
    </div>
  )
}

export default memo(function EffectsBreakdown({ effects }) {
  if (!Array.isArray(effects) || effects.length === 0) return null

  const grouped = { positive: [], medical: [], negative: [] }
  for (const e of effects) {
    const cat = e?.category || 'positive'
    if (grouped[cat]) grouped[cat].push(e)
    else grouped.positive.push(e)
  }

  const maxReports = Math.max(...effects.map(e => e?.reports || 0), 1)

  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e] mb-1">
        Full Effects Breakdown
      </h4>
      <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e] mb-3">
        Community-reported effects with confidence levels
      </p>

      <div className="space-y-4">
        {['positive', 'medical', 'negative'].map(cat => {
          const items = grouped[cat]
          if (!items.length) return null
          const meta = CATEGORY_META[cat]
          const Icon = meta.icon

          return (
            <div key={cat}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon size={11} style={{ color: meta.color }} />
                <span className="text-[10px] font-semibold" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                <span className="text-[9px] text-gray-400 dark:text-[#6a7a6e]">
                  ({items.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {items.map((e, idx) => (
                  <EffectRow
                    key={e?.name || idx}
                    effect={e}
                    maxReports={maxReports}
                    barColor={meta.barColor}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
