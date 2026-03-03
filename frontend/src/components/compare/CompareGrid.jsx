import { useMemo } from 'react'
import { Trophy } from 'lucide-react'
import clsx from 'clsx'
import { getTypeColor } from '../../utils/colors'
import sig2 from '../../utils/fmt'

/**
 * Helper: determines the "winner" index for a numeric row.
 * Returns the index of the strain with the highest value, or -1 if no valid values.
 */
function getWinnerIndex(values) {
  let best = -Infinity
  let bestIdx = -1
  values.forEach((v, i) => {
    const num = typeof v === 'number' ? v : parseFloat(v)
    if (!Number.isNaN(num) && num > best) {
      best = num
      bestIdx = i
    }
  })
  return bestIdx
}

/**
 * Formats an array field (effects, terpenes, etc.) for display.
 */
function formatList(items) {
  if (!items || items.length === 0) return '\u2014'
  if (typeof items[0] === 'string') return items.join(', ')
  if (items[0]?.name) return items.map((i) => i.name).join(', ')
  return String(items)
}

/**
 * Formats a numeric or missing value for display.
 */
function formatValue(val, suffix = '') {
  if (val == null) return '\u2014'
  if (typeof val === 'number') return `${sig2(val)}${suffix}`
  return String(val)
}

const ROW_DEFS = [
  {
    label: 'Name',
    key: 'name',
    format: (s) => s.name || '\u2014',
    isHeader: true,
  },
  {
    label: 'Type',
    key: 'type',
    format: (s) => s.type || '\u2014',
    renderCell: (s) => {
      const tc = getTypeColor(s.type)
      return (
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
          style={{
            backgroundColor: `${tc.hex}22`,
            borderColor: `${tc.hex}55`,
            color: tc.hex,
          }}
        >
          {tc.label}
        </span>
      )
    },
  },
  {
    label: 'THC',
    key: 'thc',
    format: (s) => formatValue(s.thc, '%'),
    numeric: true,
    getValue: (s) => s.thc,
  },
  {
    label: 'CBD',
    key: 'cbd',
    format: (s) => formatValue(s.cbd, '%'),
    numeric: true,
    getValue: (s) => s.cbd,
  },
  {
    label: 'CBN',
    key: 'cbn',
    format: (s) => formatValue(s.cbn, '%'),
    numeric: true,
    getValue: (s) => s.cbn,
  },
  {
    label: 'CBG',
    key: 'cbg',
    format: (s) => formatValue(s.cbg, '%'),
    numeric: true,
    getValue: (s) => s.cbg,
  },
  {
    label: 'THCV',
    key: 'thcv',
    format: (s) => formatValue(s.thcv, '%'),
    numeric: true,
    getValue: (s) => s.thcv,
  },
  {
    label: 'CBC',
    key: 'cbc',
    format: (s) => formatValue(s.cbc, '%'),
    numeric: true,
    getValue: (s) => s.cbc,
  },
  {
    label: 'Top Effects',
    key: 'effects',
    format: (s) => formatList((s.effects || []).slice(0, 5)),
  },
  {
    label: 'Top Terpenes',
    key: 'terpenes',
    format: (s) => formatList((s.terpenes || []).slice(0, 5)),
  },
  {
    label: 'Genetics',
    key: 'genetics',
    format: (s) => s.genetics || '\u2014',
  },
  {
    label: 'Match %',
    key: 'matchPct',
    format: (s) => formatValue(s.matchPct != null ? Math.round(s.matchPct) : null, '%'),
    numeric: true,
    getValue: (s) => s.matchPct,
  },
  {
    label: 'Sentiment',
    key: 'sentimentScore',
    format: (s) =>
      s.sentimentScore != null
        ? typeof s.sentimentScore === 'number'
          ? sig2(s.sentimentScore)
          : String(s.sentimentScore)
        : '\u2014',
    numeric: true,
    getValue: (s) => s.sentimentScore,
  },
  {
    label: 'Best For',
    key: 'bestFor',
    format: (s) => formatList(s.bestFor),
  },
  {
    label: 'Not Ideal For',
    key: 'notIdealFor',
    format: (s) => formatList(s.notIdealFor),
  },
  {
    label: 'Price Range',
    key: 'priceRange',
    format: (s) => s.priceRange || '\u2014',
  },
]

export function CompareGrid({ strains = [] }) {
  const winnerMap = useMemo(() => {
    const map = {}
    ROW_DEFS.forEach((row) => {
      if (row.numeric && row.getValue) {
        const values = strains.map((s) => row.getValue(s))
        map[row.key] = getWinnerIndex(values)
      }
    })
    return map
  }, [strains])

  if (strains.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400 dark:text-[#6a7a6e]">
        Select strains to compare
      </div>
    )
  }

  return (
    <div
      className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-surface-border"
      role="region"
      aria-label="Strain comparison table"
      tabIndex={0}
    >
      <table className="w-full min-w-[480px] text-sm" role="table">
        <thead>
          <tr className="bg-gray-50 dark:bg-white/[0.03]">
            <th
              className="sticky left-0 z-10 bg-gray-50 dark:bg-leaf-900 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e] border-b border-gray-200 dark:border-surface-border min-w-[120px]"
              scope="col"
            >
              Property
            </th>
            {strains.map((strain) => {
              const tc = getTypeColor(strain.type)
              return (
                <th
                  key={strain.name}
                  className="px-4 py-3 text-center border-b border-gray-200 dark:border-surface-border"
                  scope="col"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="text-sm font-bold text-gray-900 dark:text-white"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {strain.name}
                    </span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border"
                      style={{
                        backgroundColor: `${tc.hex}22`,
                        borderColor: `${tc.hex}55`,
                        color: tc.hex,
                      }}
                    >
                      {tc.label}
                    </span>
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {ROW_DEFS.filter((r) => !r.isHeader).map((row, rowIdx) => {
            const winnerIdx = winnerMap[row.key] ?? -1

            return (
              <tr
                key={row.key}
                className={clsx(
                  'border-b border-gray-100 dark:border-white/[0.04] transition-colors',
                  rowIdx % 2 === 0
                    ? 'bg-white dark:bg-transparent'
                    : 'bg-gray-50/50 dark:bg-white/[0.015]'
                )}
              >
                {/* Row label */}
                <td className="sticky left-0 z-10 bg-inherit px-4 py-3 text-xs font-semibold text-gray-500 dark:text-[#8a9a8e] whitespace-nowrap">
                  {row.label}
                </td>

                {/* Strain cells */}
                {strains.map((strain, colIdx) => {
                  const isWinner = row.numeric && winnerIdx === colIdx && strains.length > 1
                  const cellContent = row.renderCell
                    ? row.renderCell(strain)
                    : row.format(strain)

                  return (
                    <td
                      key={strain.name}
                      className={clsx(
                        'px-4 py-3 text-center text-sm',
                        isWinner
                          ? 'bg-leaf-500/[0.08] dark:bg-leaf-500/[0.12] text-leaf-700 dark:text-leaf-300 font-semibold'
                          : 'text-gray-700 dark:text-[#b0c4b4]'
                      )}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {isWinner && (
                          <Trophy
                            size={12}
                            className="text-leaf-500 flex-shrink-0"
                            aria-label="Best value"
                          />
                        )}
                        <span>{cellContent}</span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
