import { useEffect } from 'react'
import { Trophy, Medal } from 'lucide-react'
import clsx from 'clsx'
import ContributorBadge from './ContributorBadge'

const PODIUM_STYLES = {
  0: 'text-amber-400',    // Gold
  1: 'text-gray-400',     // Silver
  2: 'text-amber-600',    // Bronze
}

export default function Leaderboard({ leaderboard = [], onLoad, currentUserId }) {
  useEffect(() => {
    onLoad?.()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (leaderboard.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/[0.06] bg-white/70 dark:bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-gray-800 dark:text-[#e0f0e4]">Top Contributors</h3>
        </div>
        <p className="text-xs text-gray-400 dark:text-[#6a7a6e] text-center py-4">
          Be the first to write a review and claim the top spot!
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/[0.06] bg-white/70 dark:bg-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={16} className="text-amber-400" />
        <h3 className="text-sm font-bold text-gray-800 dark:text-[#e0f0e4]">Top Contributors</h3>
      </div>

      <div className="space-y-1">
        {leaderboard.map((entry, i) => {
          const isCurrentUser = entry.uid === currentUserId
          return (
            <div
              key={entry.uid}
              className={clsx(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors',
                isCurrentUser && 'bg-leaf-500/[0.06] ring-1 ring-leaf-500/20',
                i < 3 && 'font-medium'
              )}
            >
              {/* Rank number */}
              <span className={clsx(
                'w-5 text-center text-xs font-bold flex-shrink-0',
                PODIUM_STYLES[i] || 'text-gray-400 dark:text-[#6a7a6e]'
              )}>
                {i < 3 ? (
                  <Medal size={14} className={PODIUM_STYLES[i]} />
                ) : (
                  `${i + 1}`
                )}
              </span>

              {/* Avatar */}
              <div className="w-6 h-6 rounded-full bg-leaf-500/15 flex items-center justify-center text-[10px] font-bold text-leaf-500 flex-shrink-0">
                {(entry.displayName || '?')[0].toUpperCase()}
              </div>

              {/* Name + badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-700 dark:text-[#c0d4c4] truncate">
                    {entry.displayName || 'Anonymous'}
                  </span>
                  <ContributorBadge rank={entry.rank} points={entry.points || 0} />
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-[#6a7a6e] flex-shrink-0">
                <span>{entry.reviewCount || 0} reviews</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
