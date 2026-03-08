import { useState, useContext } from 'react'
import { Sparkles } from 'lucide-react'
import { ResultsContext } from '../../context/ResultsContext'
import { useFavorites } from '../../hooks/useFavorites'
import sig2 from '../../utils/fmt'
import { TypeBadge } from '../shared/Badge'
import StrainCard from './StrainCard'

function MiniPickCard({ pick }) {
  return (
    <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="text-sm font-bold text-gray-900 dark:text-white"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {pick.name}
        </span>
        {pick.type && <TypeBadge type={pick.type} />}
      </div>
      {pick.reason && (
        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-[#8a9a8e]">
          {pick.reason}
        </p>
      )}
      {/* Key stats if available */}
      {(pick.thc != null || pick.matchPct != null) && (
        <div className="flex items-center gap-3 mt-2">
          {pick.matchPct != null && (
            <span className="text-[10px] font-semibold text-leaf-400">
              {Math.round(pick.matchPct)}% match
            </span>
          )}
          {pick.thc != null && (
            <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
              THC {sig2(pick.thc)}%
            </span>
          )}
          {pick.cbd != null && pick.cbd > 0 && (
            <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
              CBD {sig2(pick.cbd)}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function AiPicksSection() {
  const { state } = useContext(ResultsContext)
  const { isFavorite, toggleFavorite } = useFavorites()
  const [expandedPick, setExpandedPick] = useState(null)

  const aiPicks = state.aiPicks || []

  if (aiPicks.length === 0) return null

  // Determine if picks have full strain data (terpenes, effects, etc.) or just name+reason
  const hasFullData = aiPicks.some(
    (pick) => pick.effects?.length > 0 || pick.terpenes?.length > 0 || pick.thc != null
  )

  return (
    <section className="mt-8">
      {/* Gradient-bordered wrapper */}
      <div className="relative rounded-2xl p-px bg-gradient-to-br from-leaf-500/40 via-emerald-500/20 to-teal-500/40">
        <div className="rounded-2xl bg-white dark:bg-surface p-5">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-leaf-400" />
            <h2
              className="text-lg font-bold text-gray-900 dark:text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Hidden Gems the AI Found
            </h2>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-[#6a7a6e] mb-4">
            Unexpected strains that align with your preferences in surprising ways
          </p>

          {/* Picks list */}
          {hasFullData ? (
            <div className="space-y-3">
              {aiPicks.map((pick) => (
                <StrainCard
                  key={pick.name}
                  strain={pick}
                  expanded={expandedPick === pick.name}
                  onToggle={() =>
                    setExpandedPick((prev) =>
                      prev === pick.name ? null : pick.name
                    )
                  }
                  isFavorite={isFavorite(pick.name)}
                  onFavorite={toggleFavorite}
                  isQuizResult
                  userRegionIndex={state.userRegionIndex}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {aiPicks.map((pick) => (
                <MiniPickCard key={pick.name} pick={pick} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
