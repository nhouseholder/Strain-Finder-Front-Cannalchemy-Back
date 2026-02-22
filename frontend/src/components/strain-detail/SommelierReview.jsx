import { useState } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts'
import { ChevronDown, ChevronUp, Wine } from 'lucide-react'

const AXES = [
  { key: 'taste', label: 'Taste' },
  { key: 'aroma', label: 'Aroma' },
  { key: 'smoke', label: 'Smoke' },
  { key: 'throat', label: 'Throat Feel' },
  { key: 'burn', label: 'Burn Quality' },
]

export default function SommelierReview({ notes, scores }) {
  const [expandedNote, setExpandedNote] = useState(null)

  if (!scores) return null

  const chartData = AXES.map(({ key, label }) => ({
    axis: label,
    value: scores[key] || 0,
    fullMark: 10,
  }))

  const overall =
    AXES.reduce((sum, { key }) => sum + (scores[key] || 0), 0) / AXES.length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e] flex items-center gap-1.5">
          <Wine size={12} className="text-purple-400" />
          Sommelier Review
        </h4>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500 dark:text-[#6a7a6e]">Overall</span>
          <span className="text-sm font-bold text-leaf-400">
            {overall.toFixed(1)}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-[#6a7a6e]">/10</span>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="w-full h-52 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid
              stroke="rgba(120,120,120,0.2)"
              strokeDasharray="3 3"
            />
            <PolarAngleAxis
              dataKey="axis"
              tick={{
                fill: '#8a9a8e',
                fontSize: 10,
                fontWeight: 500,
              }}
            />
            <Radar
              name="Score"
              dataKey="value"
              stroke="#32c864"
              fill="#32c864"
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Expandable Notes */}
      {notes && (
        <div className="mt-3 space-y-1">
          {AXES.map(({ key, label }) => {
            const noteText = notes[key]
            if (!noteText) return null
            const isOpen = expandedNote === key

            return (
              <div
                key={key}
                className="rounded-lg border border-gray-200 dark:border-white/[0.06] overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                  onClick={() => setExpandedNote(isOpen ? null : key)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-[#b0c4b4]">
                      {label}
                    </span>
                    <span className="text-[10px] font-bold text-leaf-400">
                      {scores[key]}/10
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp size={14} className="text-gray-400 dark:text-[#6a7a6e]" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-400 dark:text-[#6a7a6e]" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-3 pb-2.5">
                    <p className="text-[11px] leading-relaxed text-gray-500 dark:text-[#8a9a8e]">
                      {noteText}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
