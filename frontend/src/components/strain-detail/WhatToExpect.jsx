import { memo } from 'react'
import { Zap, ThumbsUp, ThumbsDown } from 'lucide-react'
import { EffectBadge } from '../shared/Badge'

function ProbabilityBar({ label, probability, pathway }) {
  const pct = Math.round((probability ?? 0) * 100)
  const barWidth = Math.max(pct, 8) // minimum visible width
  const strength = pct > 60 ? 'Strong' : pct > 35 ? 'Moderate' : 'Mild'
  const strengthColor = pct > 60
    ? 'text-leaf-400'
    : pct > 35
      ? 'text-amber-400'
      : 'text-gray-400 dark:text-[#6a7a6e]'
  const barGradient = pct > 60
    ? 'from-leaf-500 to-leaf-400'
    : pct > 35
      ? 'from-amber-500 to-amber-400'
      : 'from-gray-400 to-gray-300 dark:from-[#4a5a4e] dark:to-[#3a4a3e]'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-gray-700 dark:text-[#c0d4c6] truncate flex-1">
          {label}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] font-semibold ${strengthColor}`}>
            {strength}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e] font-mono w-8 text-right">
            {pct}%
          </span>
        </div>
      </div>
      <div className="relative w-full h-2 rounded-full bg-gray-100 dark:bg-white/[0.05] overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-1000 ease-out`}
          style={{ width: `${barWidth}%`, opacity: 0.85 }}
        />
      </div>
      {pathway && (
        <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e] pl-0.5 truncate">
          via {pathway}
        </p>
      )}
    </div>
  )
}

export default memo(function WhatToExpect({ bestFor, notIdealFor, effectPredictions, effects }) {
  // Fallback: if bestFor is empty, derive from top effects
  const displayBestFor = bestFor?.length > 0
    ? bestFor
    : (effects || []).slice(0, 3)

  const topPredictions = (effectPredictions || []).slice(0, 5)

  if (!displayBestFor.length && !topPredictions.length) return null

  return (
    <div className="rounded-xl border border-leaf-500/15 bg-leaf-500/[0.03] p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-leaf-500/10 flex items-center justify-center">
          <Zap size={13} className="text-leaf-400" />
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-leaf-400">
            Predicted Effects
          </h4>
          <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e]">
            Based on molecular profile &amp; receptor activity
          </p>
        </div>
      </div>

      {/* Top predicted effects with probability bars */}
      {topPredictions.length > 0 && (
        <div className="space-y-2.5 mb-4">
          {topPredictions.map(pred => {
            const displayName = (pred.effect || '')
              .replace(/-/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase())
            return (
              <ProbabilityBar
                key={pred.effect}
                label={displayName}
                probability={pred.probability}
                pathway={pred.pathway}
              />
            )
          })}
        </div>
      )}

      {/* Best For / Not Ideal For tags */}
      {(displayBestFor.length > 0 || notIdealFor?.length > 0) && (
        <div className="space-y-2 pt-3 border-t border-leaf-500/10">
          {displayBestFor.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <ThumbsUp size={10} className="text-leaf-400 flex-shrink-0" />
              <span className="text-[9px] font-semibold text-leaf-500/70 dark:text-leaf-400/60 uppercase tracking-wider mr-0.5">
                Best for
              </span>
              {displayBestFor.map(tag => (
                <EffectBadge key={tag} effect={tag} variant="positive" />
              ))}
            </div>
          )}
          {notIdealFor?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <ThumbsDown size={10} className="text-red-400/70 flex-shrink-0" />
              <span className="text-[9px] font-semibold text-red-400/50 uppercase tracking-wider mr-0.5">
                Not ideal for
              </span>
              {notIdealFor.map(tag => (
                <EffectBadge key={tag} effect={tag} variant="negative" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
