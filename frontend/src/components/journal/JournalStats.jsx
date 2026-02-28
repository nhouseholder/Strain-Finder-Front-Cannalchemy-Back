import { Star, TrendingUp, BarChart3 } from 'lucide-react'
import clsx from 'clsx'
import Card from '../shared/Card'
import { EFFECTS } from '../../data/effects'

function getEffectLabel(id) {
  return EFFECTS.find((e) => e.id === id)?.label || id
}

function getEffectEmoji(id) {
  return EFFECTS.find((e) => e.id === id)?.emoji || ''
}

function typeDisplayName(type) {
  if (!type) return type
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function deriveInsight(avgByType) {
  if (!avgByType || Object.keys(avgByType).length < 2) return null

  const entries = Object.entries(avgByType).sort(([, a], [, b]) => b - a)
  const [bestType, bestRating] = entries[0]
  const [worstType, worstRating] = entries[entries.length - 1]

  if (bestRating === worstRating) return null

  const diff = (bestRating - worstRating).toFixed(1)
  return `You tend to rate ${typeDisplayName(bestType)} strains ${diff} points higher than ${typeDisplayName(worstType)}.`
}

export default function JournalStats({ stats }) {
  if (!stats) {
    return (
      <Card className="p-6 text-center">
        <BarChart3 className="w-10 h-10 text-gray-300 dark:text-[#5a6a5e] mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">
          No journal data yet. Add entries to see your patterns.
        </p>
      </Card>
    )
  }

  const { avgRating, topEffects, avgByType, totalEntries } = stats
  const maxEffectCount = topEffects?.[0]?.count || 1
  const insight = deriveInsight(avgByType)

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total entries */}
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {totalEntries}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#6a7a6e] mt-1 font-semibold">
            Total Entries
          </p>
        </Card>

        {/* Average rating */}
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {avgRating.toFixed(1)}
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#6a7a6e] mt-1 font-semibold">
            Avg Rating
          </p>
        </Card>
      </div>

      {/* Most common effects - horizontal bar chart */}
      {topEffects && topEffects.length > 0 && (
        <Card className="p-5">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-4">
            Most Common Effects
          </h4>
          <div className="space-y-3">
            {topEffects.map(({ effect, count }) => {
              const widthPct = Math.max((count / maxEffectCount) * 100, 8)
              return (
                <div key={effect} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 dark:text-[#b0c4b4] font-medium">
                      {getEffectEmoji(effect)} {getEffectLabel(effect)}
                    </span>
                    <span className="text-gray-400 dark:text-[#6a7a6e]">
                      {count}x
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-leaf-500 to-leaf-400 transition-all duration-500"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Average rating by type */}
      {avgByType && Object.keys(avgByType).length > 0 && (
        <Card className="p-5">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-4">
            Avg Rating by Type
          </h4>
          <div className="space-y-3">
            {Object.entries(avgByType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, avg]) => {
                const widthPct = Math.max((avg / 5) * 100, 8)
                const typeColors = {
                  indica: 'from-indica-500 to-indica-400',
                  sativa: 'from-sativa-500 to-sativa-400',
                  hybrid: 'from-hybrid-500 to-hybrid-400',
                }
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-700 dark:text-[#b0c4b4] font-medium capitalize">
                        {type}
                      </span>
                      <span className="text-gray-400 dark:text-[#6a7a6e]">
                        {avg.toFixed(1)} / 5
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full bg-gradient-to-r transition-all duration-500',
                          typeColors[type.toLowerCase()] || 'from-leaf-500 to-leaf-400'
                        )}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </Card>
      )}

      {/* Insight */}
      {insight && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-leaf-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-leaf-400" />
            </div>
            <p className="text-sm text-gray-600 dark:text-[#b0c4b4] leading-relaxed">
              {insight}
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
