import { useMemo } from 'react'
import { FlaskConical, CheckCircle2 } from 'lucide-react'
import { getEffectDisplayName } from '../../utils/effectDisplayName'

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

    // Combine all community effects (pros + cons) for comprehensive matching
    const allCommunity = [
      ...(forumData.pros || forumData.positiveEffects || []),
      ...(forumData.cons || forumData.negativeEffects || []),
    ]

    // Build matched pairs
    const matchedPairs = []
    let matches = 0

    // Multi-strategy normalization for robust matching
    const toStr = (v) => typeof v === 'string' ? v : (v?.name || v?.label || String(v ?? ''))
    const normalize = (s) => toStr(s).toLowerCase().replace(/[-_\s]+/g, ' ').trim()

    // Build lookup maps for fast community effect matching
    const communityMap = new Map()         // by display name
    const communityCanonicalMap = new Map() // by canonical name (raw effect name)
    for (const item of allCommunity) {
      const name = toStr(item.effect || item.name || item)
      communityMap.set(normalize(name), item)
      // Also index by canonical name if available
      if (item.canonical) {
        communityCanonicalMap.set(normalize(item.canonical), item)
      }
    }

    for (const pred of predictions.slice(0, 8)) {
      const displayName = getEffectDisplayName(pred.effect)

      // Try multiple matching strategies:
      // 1. Direct canonical name match (most reliable — same raw effect name)
      // 2. Normalized display name match
      // 3. Direct canonical against display name map
      // 4. Partial match (e.g., "pain" found in "Pain Relief")
      const normalizedPred = normalize(displayName)
      const normalizedCanonical = normalize(pred.effect)

      let report = communityCanonicalMap.get(normalizedCanonical)
        || communityMap.get(normalizedPred)
        || communityMap.get(normalizedCanonical)

      // Fallback: partial match (e.g., "pain" matches "Pain Relief")
      if (!report) {
        for (const [key, val] of communityMap) {
          if (key.includes(normalizedCanonical) || normalizedCanonical.includes(key)) {
            report = val
            break
          }
        }
      }

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
            Predicted vs Reported
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
      <div className="flex items-center gap-1 mb-2 px-1">
        <div className="flex-1 text-[8px] font-semibold text-purple-400 uppercase tracking-wider">
          Science
        </div>
        <div className="w-[72px] sm:w-24 text-center text-[8px] font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wider flex-shrink-0">
          Effect
        </div>
        <div className="flex-1 text-right text-[8px] font-semibold text-blue-400 uppercase tracking-wider">
          Community
        </div>
      </div>

      {/* Effect rows */}
      <div className="space-y-2">
        {pairs.map((pair) => (
          <div key={pair.effect} className="flex items-center gap-1">
            {/* Predicted bar (right-aligned) */}
            <div className="flex-1 flex items-center gap-1">
              <span className="text-[9px] text-gray-400 dark:text-[#6a7a6e] w-6 text-right font-mono flex-shrink-0">
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

            {/* Effect name (center) — responsive width */}
            <div className="w-[72px] sm:w-24 text-center flex-shrink-0 px-0.5">
              <span
                className={`text-[9px] sm:text-[10px] font-medium leading-tight block truncate ${
                  pair.matched
                    ? 'text-gray-700 dark:text-[#c0d4c6]'
                    : 'text-gray-400 dark:text-[#5a6a5e]'
                }`}
                title={pair.effect}
              >
                {pair.effect}
              </span>
            </div>

            {/* Reported bar (left-aligned) */}
            <div className="flex-1 flex items-center gap-1">
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
                    <span className="text-[7px] text-gray-300 dark:text-[#5a6a5e]">—</span>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-gray-400 dark:text-[#6a7a6e] w-6 text-left font-mono flex-shrink-0">
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
