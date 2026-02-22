import { useMemo } from 'react'
import { FlaskConical, CheckCircle2 } from 'lucide-react'

/**
 * EffectVerification — Side-by-side predicted vs actual effect comparison
 *
 * Left: Molecular pathway predictions (from effectPredictions)
 * Right: Community reports (from forumAnalysis.pros)
 * Shows correlation score between science and community data.
 */
export default function EffectVerification({ predictions, forumData }) {
  const { pairs, correlation } = useMemo(() => {
    if (!predictions?.length || !forumData) return { pairs: [], correlation: 0 }

    const pros = forumData.pros || forumData.positiveEffects || []

    // Build matched pairs
    const matchedPairs = []
    let matches = 0

    const normalize = (s) => (s || '').toLowerCase().replace(/[-_]/g, ' ').trim()

    for (const pred of predictions.slice(0, 5)) {
      const displayName = pred.effect
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

      // Find matching community report (normalized comparison)
      const report = pros.find(
        (r) => normalize(r.effect || r.name) === normalize(displayName)
      )

      matchedPairs.push({
        effect: displayName,
        predicted: Math.round((pred.probability || 0) * 100),
        reported: report ? report.pct : null,
        matched: !!report,
        pathway: pred.pathway || '',
      })

      if (report && report.pct > 0) matches++
    }

    const corr = Math.round((matches / Math.max(matchedPairs.length, 1)) * 100)
    return { pairs: matchedPairs, correlation: corr }
  }, [predictions, forumData])

  if (!pairs.length) return null

  const corrColor =
    correlation >= 70
      ? 'text-leaf-400 bg-leaf-500/10 border-leaf-500/30'
      : correlation >= 40
        ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
        : 'text-gray-400 bg-gray-500/10 border-gray-500/30'

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
      {/* Header with correlation badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
            <FlaskConical size={14} className="text-amber-400" />
          </div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#8a9a8e]">
            Science vs Community
          </h4>
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${corrColor}`}
        >
          <CheckCircle2 size={10} />
          {correlation}% match
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="flex-1 text-[9px] font-semibold text-purple-400 uppercase tracking-wider">
          Molecular Prediction
        </div>
        <div className="w-24 text-center text-[9px] font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wider">
          Effect
        </div>
        <div className="flex-1 text-right text-[9px] font-semibold text-blue-400 uppercase tracking-wider">
          Community Reports
        </div>
      </div>

      {/* Effect rows */}
      <div className="space-y-2">
        {pairs.map((pair) => (
          <div key={pair.effect} className="flex items-center gap-2">
            {/* Predicted bar (right-aligned) */}
            <div className="flex-1 flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e] w-7 text-right font-mono">
                {pair.predicted}%
              </span>
              <div className="flex-1 h-2 bg-gray-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pair.predicted}%`,
                    background: 'linear-gradient(90deg, #a855f7, #7c3aed)',
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>

            {/* Effect name (center) */}
            <div className="w-24 text-center">
              <span
                className={`text-[10px] font-medium ${
                  pair.matched
                    ? 'text-gray-700 dark:text-[#c0d4c6]'
                    : 'text-gray-400 dark:text-[#5a6a5e]'
                }`}
              >
                {pair.effect}
              </span>
            </div>

            {/* Reported bar (left-aligned) */}
            <div className="flex-1 flex items-center gap-1.5">
              <div className="flex-1 h-2 bg-gray-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
                {pair.reported != null ? (
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(pair.reported, 100)}%`,
                      background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                      opacity: 0.7,
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-[7px] text-gray-300 dark:text-[#3a4a3e]">
                      no data
                    </span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e] w-7 text-left font-mono">
                {pair.reported != null ? `${pair.reported}%` : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-[9px] text-gray-400 dark:text-[#5a6a5e]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          Receptor Science
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          User Reviews
        </div>
      </div>
    </div>
  )
}
