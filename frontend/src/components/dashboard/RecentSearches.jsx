import { Clock, RotateCcw } from 'lucide-react'
import Card from '../shared/Card'
import Button from '../shared/Button'
import { EffectBadge } from '../shared/Badge'
import { EFFECTS } from '../../data/effects'

function getEffectLabel(id) {
  return EFFECTS.find((e) => e.id === id)?.label || id
}

function formatTimestamp(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function RecentSearches({ searches = [], onRerun }) {
  if (searches.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Clock className="w-10 h-10 text-gray-300 dark:text-[#5a6a5e] mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">
          No recent searches. Complete a quiz to see your search history here.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {searches.map((search, i) => {
        const { effects = [], tolerance, budget, timestamp, resultCount } = search

        return (
          <Card key={`${timestamp}-${i}`} className="p-4 space-y-3">
            {/* Top row: time + result count */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 dark:text-[#6a7a6e]">
                {formatTimestamp(timestamp)}
              </span>
              {resultCount != null && (
                <span className="text-xs text-gray-500 dark:text-[#8a9a8e]">
                  {resultCount} result{resultCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Effect tags */}
            {effects.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {effects.map((eff) => (
                  <EffectBadge key={eff} effect={getEffectLabel(eff)} variant="neutral" />
                ))}
              </div>
            )}

            {/* Budget + Tolerance */}
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-[#8a9a8e]">
              {budget && <span>Budget: {budget}</span>}
              {tolerance && <span>Tolerance: {tolerance}</span>}
            </div>

            {/* Re-run button */}
            {onRerun && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRerun(search)}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Re-run Search
              </Button>
            )}
          </Card>
        )
      })}
    </div>
  )
}
