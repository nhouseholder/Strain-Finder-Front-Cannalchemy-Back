/**
 * PreferenceProfile — displays the user's learned preference profile
 * derived from their strain ratings. Shows type affinity, top effects,
 * terpene patterns, insights, and confidence level.
 */
import { Star, TrendingUp, Brain, Leaf, Beaker, Sparkles, Target } from 'lucide-react'
import clsx from 'clsx'
import Card from '../shared/Card'

function ConfidenceMeter({ confidence }) {
  const pct = Math.round(confidence * 100)
  const label =
    pct < 25 ? 'Getting Started' :
    pct < 50 ? 'Learning' :
    pct < 75 ? 'Good Understanding' :
    'Deep Profile'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="uppercase tracking-wider text-gray-400 dark:text-[#6a7a6e] font-semibold">
          Profile Confidence
        </span>
        <span className="text-gray-500 dark:text-[#8a9a8e] font-medium">
          {label} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-leaf-500 to-emerald-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function TypeAffinityBar({ type, score, count, maxScore }) {
  const widthPct = Math.max((score / 5) * 100, 6)
  const typeColors = {
    indica: 'from-indica-500 to-indica-400',
    sativa: 'from-sativa-500 to-sativa-400',
    hybrid: 'from-hybrid-500 to-hybrid-400',
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-700 dark:text-[#b0c4b4] font-medium capitalize">
          {type}
        </span>
        <span className="text-gray-400 dark:text-[#6a7a6e]">
          {score.toFixed(1)}/5 ({count}x)
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
}

export default function PreferenceProfileCard({ profile, className }) {
  if (!profile || profile.total_ratings === 0) {
    return (
      <Card className={clsx('p-6 text-center', className)}>
        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
          <Brain className="w-6 h-6 text-gray-300 dark:text-[#5a6a5e]" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">
          No Preferences Yet
        </h3>
        <p className="text-xs text-gray-500 dark:text-[#8a9a8e] leading-relaxed">
          Rate strains you've tried to build your personal preference profile.
          The more you rate, the smarter your recommendations become.
        </p>
      </Card>
    )
  }

  const {
    total_ratings,
    avg_rating,
    preferred_type,
    type_scores = {},
    type_counts = {},
    effect_preferences = [],
    negative_effect_sensitivity = [],
    terpene_preferences = [],
    cannabinoid_preferences = [],
    top_strains = [],
    confidence = 0,
    insights = [],
  } = profile

  const topEffects = effect_preferences.filter((e) => e.score > 0).slice(0, 5)
  const avoidEffects = effect_preferences.filter((e) => e.score < -0.1).slice(-3).reverse()

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-leaf-500/20 to-purple-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-leaf-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea]">
              Your Taste Profile
            </h3>
            <p className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
              Learned from {total_ratings} rating{total_ratings !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <span className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea]">
                {avg_rating.toFixed(1)}
              </span>
            </div>
            <span className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] font-semibold">
              Avg Rating
            </span>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] text-center">
            <span className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea] capitalize">
              {preferred_type || '—'}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] font-semibold block">
              Preferred
            </span>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] text-center">
            <span className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea]">
              {total_ratings}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] font-semibold block">
              Rated
            </span>
          </div>
        </div>

        <ConfidenceMeter confidence={confidence} />
      </Card>

      {/* Type Affinity */}
      {Object.keys(type_scores).length > 0 && (
        <Card className="p-5">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Target size={12} />
            Type Affinity
          </h4>
          <div className="space-y-2.5">
            {Object.entries(type_scores)
              .sort(([, a], [, b]) => b - a)
              .map(([type, score]) => (
                <TypeAffinityBar
                  key={type}
                  type={type}
                  score={score}
                  count={type_counts[type] || 0}
                  maxScore={5}
                />
              ))}
          </div>
        </Card>
      )}

      {/* Effect Preferences */}
      {topEffects.length > 0 && (
        <Card className="p-5">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles size={12} />
            Effects You Love
          </h4>
          <div className="space-y-2">
            {topEffects.map(({ effect, score, count }) => {
              const widthPct = Math.max(((score + 1) / 2) * 100, 8) // -1..+1 → 0..100
              return (
                <div key={effect} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 dark:text-[#b0c4b4] font-medium">
                      {effect}
                    </span>
                    <span className="text-gray-400 dark:text-[#6a7a6e]">
                      {score > 0 ? '+' : ''}{score.toFixed(2)} ({count}x)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-leaf-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Effects to avoid */}
          {avoidEffects.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
              <h5 className="text-[10px] font-semibold text-gray-400 dark:text-[#6a7a6e] uppercase tracking-wider mb-2">
                Tends to Lower Your Rating
              </h5>
              <div className="flex flex-wrap gap-1">
                {avoidEffects.map(({ effect, score }) => (
                  <span
                    key={effect}
                    className="px-2 py-0.5 rounded-md text-[10px] bg-red-500/10 text-red-400 border border-red-500/20"
                  >
                    {effect} ({score.toFixed(2)})
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Terpene Preferences */}
      {terpene_preferences.length > 0 && (
        <Card className="p-5">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Leaf size={12} />
            Your Terpene Pattern
          </h4>
          <div className="space-y-2">
            {terpene_preferences.slice(0, 6).map(({ name, avg_rating, count }) => {
              const widthPct = Math.max((avg_rating / 5) * 100, 6)
              return (
                <div key={name} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 dark:text-[#b0c4b4] font-medium">
                      {name}
                    </span>
                    <span className="text-gray-400 dark:text-[#6a7a6e]">
                      {avg_rating.toFixed(1)}/5 ({count}x)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-500"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Cannabinoid Preferences */}
      {cannabinoid_preferences.length > 0 && (
        <Card className="p-5">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Beaker size={12} />
            Your Cannabinoid Sweet Spot
          </h4>
          <div className="space-y-3">
            {cannabinoid_preferences.slice(0, 4).map(({ name, preferred_range_low, preferred_range_high, avg_rating, count }) => (
              <div key={name} className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-[#b0c4b4]">
                    {name}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e] ml-2">
                    {preferred_range_low.toFixed(1)}% – {preferred_range_high.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star size={10} className="fill-amber-400 text-amber-400" />
                  <span className="text-xs text-gray-500 dark:text-[#8a9a8e]">
                    {avg_rating.toFixed(1)} ({count}x)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top Strains */}
      {top_strains.length > 0 && (
        <Card className="p-5">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Star size={12} />
            Your Favorites
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {top_strains.map((name, idx) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"
              >
                <span className="text-[10px] text-amber-400/60">#{idx + 1}</span>
                {name}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <Card className="p-5">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp size={12} />
            Personalized Insights
          </h4>
          <div className="space-y-2.5">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 text-xs text-gray-600 dark:text-[#b0c4b4] leading-relaxed"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-leaf-500/10 flex items-center justify-center mt-0.5">
                  <TrendingUp size={10} className="text-leaf-400" />
                </span>
                <p>{insight}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
