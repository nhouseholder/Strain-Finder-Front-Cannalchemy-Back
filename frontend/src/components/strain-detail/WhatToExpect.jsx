import { memo } from 'react'
import { Zap, ThumbsUp, ThumbsDown } from 'lucide-react'
import { EffectBadge } from '../shared/Badge'
import { getEffectDisplayName } from '../../utils/effectDisplayName'

/* ── Per-effect color palette ──────────────────────────────── */
const EFFECT_COLORS = {
  // Positive / uplifting
  happy:        { bar: '#32c864', bg: '#32c86420', text: '#32c864' },
  euphoric:     { bar: '#a855f7', bg: '#a855f720', text: '#a855f7' },
  euphoria:     { bar: '#a855f7', bg: '#a855f720', text: '#a855f7' },
  giggly:       { bar: '#f59e0b', bg: '#f59e0b20', text: '#f59e0b' },
  uplifted:     { bar: '#fb923c', bg: '#fb923c20', text: '#fb923c' },
  creative:     { bar: '#ec4899', bg: '#ec489920', text: '#ec4899' },
  creativity:   { bar: '#ec4899', bg: '#ec489920', text: '#ec4899' },
  energetic:    { bar: '#eab308', bg: '#eab30820', text: '#eab308' },
  energy:       { bar: '#eab308', bg: '#eab30820', text: '#eab308' },
  focused:      { bar: '#06b6d4', bg: '#06b6d420', text: '#06b6d4' },
  focus:        { bar: '#06b6d4', bg: '#06b6d420', text: '#06b6d4' },
  talkative:    { bar: '#8b5cf6', bg: '#8b5cf620', text: '#8b5cf6' },
  social:       { bar: '#8b5cf6', bg: '#8b5cf620', text: '#8b5cf6' },
  aroused:      { bar: '#f43f5e', bg: '#f43f5e20', text: '#f43f5e' },
  hungry:       { bar: '#f97316', bg: '#f9731620', text: '#f97316' },
  appetite:     { bar: '#f97316', bg: '#f9731620', text: '#f97316' },
  tingly:       { bar: '#14b8a6', bg: '#14b8a620', text: '#14b8a6' },

  // Calming / relaxing
  relaxed:      { bar: '#3b82f6', bg: '#3b82f620', text: '#3b82f6' },
  relaxation:   { bar: '#3b82f6', bg: '#3b82f620', text: '#3b82f6' },
  calm:         { bar: '#6366f1', bg: '#6366f120', text: '#6366f1' },
  sleepy:       { bar: '#818cf8', bg: '#818cf820', text: '#818cf8' },
  sleep:        { bar: '#818cf8', bg: '#818cf820', text: '#818cf8' },
  sedated:      { bar: '#7c3aed', bg: '#7c3aed20', text: '#7c3aed' },

  // Comfort / wellness
  pain:         { bar: '#10b981', bg: '#10b98120', text: '#10b981' },
  'body comfort':{ bar: '#10b981', bg: '#10b98120', text: '#10b981' },
  stress:       { bar: '#0ea5e9', bg: '#0ea5e920', text: '#0ea5e9' },
  'stress ease': { bar: '#0ea5e9', bg: '#0ea5e920', text: '#0ea5e9' },
  anxiety:      { bar: '#22d3ee', bg: '#22d3ee20', text: '#22d3ee' },
  'calm & ease': { bar: '#22d3ee', bg: '#22d3ee20', text: '#22d3ee' },
}

// Rotating fallback palette for effects not in the map
const FALLBACK_COLORS = [
  { bar: '#32c864', bg: '#32c86420', text: '#32c864' },
  { bar: '#3b82f6', bg: '#3b82f620', text: '#3b82f6' },
  { bar: '#a855f7', bg: '#a855f720', text: '#a855f7' },
  { bar: '#f59e0b', bg: '#f59e0b20', text: '#f59e0b' },
  { bar: '#ec4899', bg: '#ec489920', text: '#ec4899' },
]

function getEffectColor(label, index) {
  const key = (typeof label === 'string' ? label : (label?.name || '')).toLowerCase()
  return EFFECT_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

function ProbabilityBar({ label, probability, pathway, colorIndex }) {
  const pct = Math.round((probability ?? 0) * 100)
  const barWidth = Math.max(pct, 8) // minimum visible width
  const strength = pct > 60 ? 'Strong' : pct > 35 ? 'Moderate' : 'Mild'
  const color = getEffectColor(label, colorIndex)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-gray-700 dark:text-[#c0d4c6] truncate flex-1">
          {label}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-[10px] font-semibold"
            style={{ color: color.text }}
          >
            {strength}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e] font-mono w-8 text-right">
            {pct}%
          </span>
        </div>
      </div>
      <div className="relative w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: color.bg }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${barWidth}%`,
            background: `linear-gradient(90deg, ${color.bar}cc, ${color.bar})`,
            boxShadow: `0 0 8px ${color.bar}40`,
          }}
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
  const normalizeEffect = (e) => typeof e === 'string' ? e : (e?.name || e?.label || '')
  const displayBestFor = bestFor?.length > 0
    ? bestFor.map(normalizeEffect)
    : (effects || []).slice(0, 3).map(normalizeEffect).filter(Boolean)

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
            Community-Reported Effect Predictions
          </h4>
          <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e]">
            Based on community data &amp; publicly available research &mdash; not medical advice
          </p>
        </div>
      </div>

      {/* Top predicted effects with probability bars */}
      {topPredictions.length > 0 && (
        <div className="space-y-2.5 mb-4">
          {topPredictions.map((pred, idx) => {
            const displayName = getEffectDisplayName(pred.effect)
            return (
              <ProbabilityBar
                key={pred.effect}
                label={displayName}
                probability={pred.probability}
                pathway={pred.pathway}
                colorIndex={idx}
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
              {notIdealFor.map((tag, idx) => {
                const lbl = normalizeEffect(tag)
                return <EffectBadge key={lbl || idx} effect={lbl} variant="negative" />
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
