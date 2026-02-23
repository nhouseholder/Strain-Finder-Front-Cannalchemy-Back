import { Users, ThumbsUp, ThumbsDown } from 'lucide-react'
import { ConfidenceBadge, EffectBadge } from '../shared/Badge'

function EffectBar({ label, pct, baseline, variant = 'positive' }) {
  const bgColor = variant === 'positive' ? 'bg-leaf-500' : 'bg-red-500'

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-gray-700 dark:text-[#b0c4b4] truncate flex-1 min-w-0">{label}</span>
        <span className="text-[11px] text-gray-500 dark:text-[#8a9a8e] flex-shrink-0 whitespace-nowrap">
          {pct}%
          {baseline != null && (
            <span className="ml-1 text-[9px] text-gray-400 dark:text-[#6a7a6e]">
              (avg {baseline}%)
            </span>
          )}
        </span>
      </div>
      <div className="relative w-full h-1.5 rounded-full bg-gray-200 dark:bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${bgColor}`}
          style={{ width: `${Math.min(pct, 100)}%`, opacity: 0.7 }}
        />
        {baseline != null && (
          <div
            className="absolute top-0 h-full w-px bg-gray-400 dark:bg-white/30"
            style={{ left: `${Math.min(baseline, 100)}%` }}
            title={`Baseline: ${baseline}%`}
          />
        )}
      </div>
    </div>
  )
}

export default function ForumAnalysis({ data, bestFor, notIdealFor, sentimentScore }) {
  if (!data && !bestFor?.length && sentimentScore == null) return null

  // Backend sends pros/cons with {effect, pct, baseline} — normalize to {name, pct, baseline}
  // Show top 5 positive and top 4 negative in the UI (full data available for matching)
  const positiveEffects = (data?.pros || data?.positiveEffects || []).slice(0, 5).map(p => ({
    name: p.effect || p.name || p.label || '',
    pct: p.pct || 0,
    baseline: p.baseline,
  }))
  const negativeEffects = (data?.cons || data?.negativeEffects || []).slice(0, 4).map(c => ({
    name: c.effect || c.name || c.label || '',
    pct: c.pct || 0,
    baseline: c.baseline,
  }))
  const sourceCount = typeof data?.totalReviews === 'string'
    ? parseInt(data.totalReviews.replace(/[^0-9]/g, ''), 10) || 0
    : data?.sourceCount || data?.reviewCount || 0

  const sentimentColor =
    sentimentScore >= 8
      ? 'text-leaf-400'
      : sentimentScore >= 6
        ? 'text-amber-400'
        : 'text-red-400'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e] flex items-center gap-1.5">
            <Users size={12} className="text-blue-400" />
            Community Reviews
          </h4>
          <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e] mt-0.5 ml-[18px]">
            What real users report about this strain
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sourceCount > 0 && (
            <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
              {sourceCount} sources
            </span>
          )}
          <ConfidenceBadge reviewCount={sourceCount} />
        </div>
      </div>

      {/* Sentiment Score */}
      {sentimentScore != null && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
          <div className="text-center">
            <div className={`text-2xl font-bold ${sentimentColor}`}>
              {typeof sentimentScore === 'number' ? sentimentScore.toFixed(1) : sentimentScore}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e]">
              /10
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-[#8a9a8e]">
            Community Sentiment Score
          </div>
        </div>
      )}

      {/* Best For / Not Ideal For */}
      {(bestFor?.length > 0 || notIdealFor?.length > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {bestFor?.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <ThumbsUp size={10} className="text-leaf-400" />
                <span className="text-[10px] font-semibold text-leaf-400">Best For</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {bestFor.map((tag) => (
                  <EffectBadge key={tag} effect={tag} variant="positive" />
                ))}
              </div>
            </div>
          )}
          {notIdealFor?.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <ThumbsDown size={10} className="text-red-400" />
                <span className="text-[10px] font-semibold text-red-400">Not Ideal For</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {notIdealFor.map((tag) => (
                  <EffectBadge key={tag} effect={tag} variant="negative" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Positive Effects */}
      {positiveEffects.length > 0 && (
        <div className="mb-3">
          <h5 className="text-[10px] font-semibold text-leaf-400 mb-2">Reported Positive Effects</h5>
          <div className="space-y-2">
            {positiveEffects.map((eff, idx) => (
              <EffectBar
                key={eff.name || `pos-${idx}`}
                label={eff.name || 'Unknown'}
                pct={eff.pct}
                baseline={eff.baseline}
                variant="positive"
              />
            ))}
          </div>
        </div>
      )}

      {/* Negative Effects */}
      {negativeEffects.length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold text-red-400 mb-2">Reported Negative Effects</h5>
          <div className="space-y-2">
            {negativeEffects.map((eff, idx) => (
              <EffectBar
                key={eff.name || `neg-${idx}`}
                label={eff.name || 'Unknown'}
                pct={eff.pct}
                baseline={eff.baseline}
                variant="negative"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
