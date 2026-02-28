import { useState, useMemo, useContext } from 'react'
import usePageTitle from '../hooks/usePageTitle'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { ResultsContext } from '../context/ResultsContext'
import Card from '../components/shared/Card'
import Button from '../components/shared/Button'
import { TypeBadge, EffectBadge } from '../components/shared/Badge'
import { getTerpeneColor, getTypeColor } from '../utils/colors'
import { MAX_COMPARE_STRAINS } from '../utils/constants'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { X, Plus, Search, GitCompareArrows, Loader2 } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Color palette for compared strains                                */
/* ------------------------------------------------------------------ */
const COMPARE_COLORS = ['#32c864', '#9775fa', '#ff922b']

/* ------------------------------------------------------------------ */
/*  ComparePage                                                       */
/* ------------------------------------------------------------------ */
export default function ComparePage() {
  usePageTitle('Compare Strains')
  const { query, setQuery, results, getStrainByName, allStrains } = useStrainSearch()
  const strainsLoaded = allStrains.length > 0
  const { state: resultsState } = useContext(ResultsContext)

  const [selectedNames, setSelectedNames] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)

  /* Resolve selected strains to full objects ----------------------- */
  const selectedStrains = useMemo(() => {
    return selectedNames
      .map((name) => {
        // Try local DB first
        const local = getStrainByName(name)
        if (local) return local
        // Fallback to results context
        const fromResults = [...(resultsState.strains || []), ...(resultsState.aiPicks || [])].find(
          (s) => s.name.toLowerCase() === name.toLowerCase()
        )
        return fromResults || null
      })
      .filter(Boolean)
  }, [selectedNames, getStrainByName, resultsState.strains, resultsState.aiPicks])

  /* Add strain ---------------------------------------------------- */
  const addStrain = (name) => {
    if (selectedNames.length >= MAX_COMPARE_STRAINS) return
    if (selectedNames.some((n) => n.toLowerCase() === name.toLowerCase())) return
    setSelectedNames((prev) => [...prev, name])
    setQuery('')
    setShowDropdown(false)
  }

  /* Remove strain ------------------------------------------------- */
  const removeStrain = (name) => {
    setSelectedNames((prev) => prev.filter((n) => n !== name))
  }

  /* Build radar chart data ---------------------------------------- */
  const radarData = useMemo(() => {
    if (selectedStrains.length < 2) return []

    // Gather all unique terpene names
    const allTerps = new Set()
    selectedStrains.forEach((s) => {
      ;(s.terpenes || []).forEach((t) => allTerps.add(t.name || t))
    })

    return [...allTerps].slice(0, 8).map((terpName) => {
      const point = { terpene: terpName }
      selectedStrains.forEach((strain, i) => {
        const terp = (strain.terpenes || []).find(
          (t) => (t.name || t) === terpName
        )
        point[strain.name] = terp ? parseFloat(terp.pct) || 0.3 : 0
      })
      return point
    })
  }, [selectedStrains])

  /* Comparison rows for the table --------------------------------- */
  const getNumericValue = (strain, key) => {
    if (key === 'thc') return typeof strain.thc === 'object' ? strain.thc?.avg || strain.thc?.max || 0 : strain.thc || 0
    if (key === 'cbd') return typeof strain.cbd === 'object' ? strain.cbd?.avg || strain.cbd?.max || 0 : strain.cbd || 0
    return 0
  }

  const findHighest = (key) => {
    let maxVal = -1
    let maxIdx = -1
    selectedStrains.forEach((s, i) => {
      const val = getNumericValue(s, key)
      if (val > maxVal) {
        maxVal = val
        maxIdx = i
      }
    })
    return maxIdx
  }

  /* Strains from results for quick-add buttons -------------------- */
  const resultStrains = useMemo(() => {
    return [...(resultsState.strains || []), ...(resultsState.aiPicks || [])]
      .filter((s) => !selectedNames.some((n) => n.toLowerCase() === s.name.toLowerCase()))
      .slice(0, 5)
  }, [resultsState.strains, resultsState.aiPicks, selectedNames])

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pt-4 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea] flex items-center gap-2"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          <GitCompareArrows size={24} className="text-leaf-500" />
          Compare Strains
        </h1>
        <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-0.5">
          Select up to {MAX_COMPARE_STRAINS} strains to compare side by side
        </p>
      </div>

      {/* Strain selector */}
      <Card className="p-4 mb-6">
        {/* Search input */}
        <div className="relative mb-3">
          {strainsLoaded ? (
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5a6a5e]"
            />
          ) : (
            <Loader2
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-leaf-400 animate-spin"
            />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={strainsLoaded ? 'Search strains by name, type, or effect...' : 'Loading strain database...'}
            disabled={selectedNames.length >= MAX_COMPARE_STRAINS || !strainsLoaded}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all disabled:opacity-40"
          />

          {/* Dropdown */}
          {showDropdown && results.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl bg-white dark:bg-[#0f1a12] border border-gray-200 dark:border-white/10 shadow-xl">
              {results.map((strain) => {
                const already = selectedNames.some(
                  (n) => n.toLowerCase() === strain.name.toLowerCase()
                )
                return (
                  <button
                    key={strain.name}
                    onClick={() => !already && addStrain(strain.name)}
                    disabled={already}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors flex items-center justify-between ${
                      already ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <span className="text-gray-900 dark:text-[#e8f0ea]">{strain.name}</span>
                    <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] capitalize">
                      {strain.type}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedNames.map((name, i) => (
            <div
              key={name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border"
              style={{
                backgroundColor: `${COMPARE_COLORS[i]}15`,
                borderColor: `${COMPARE_COLORS[i]}40`,
                color: COMPARE_COLORS[i],
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPARE_COLORS[i] }} />
              {name}
              <button
                onClick={() => removeStrain(name)}
                className="ml-1 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                aria-label={`Remove ${name}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {selectedNames.length < MAX_COMPARE_STRAINS && (
            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-[#5a6a5e]">
              <Plus size={12} />
              {selectedNames.length === 0
                ? 'Search above to add strains'
                : `Add ${MAX_COMPARE_STRAINS - selectedNames.length} more`}
            </div>
          )}
        </div>

        {/* Quick add from results */}
        {resultStrains.length > 0 && selectedNames.length < MAX_COMPARE_STRAINS && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] block mb-1.5">
              Add from your results
            </span>
            <div className="flex flex-wrap gap-1.5">
              {resultStrains.map((s) => (
                <button
                  key={s.name}
                  onClick={() => addStrain(s.name)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-[#8a9a8e] border border-transparent hover:border-leaf-500/30 hover:text-leaf-400 transition-all"
                >
                  + {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Comparison content (2+ strains) */}
      {selectedStrains.length >= 2 && (
        <>
          {/* Radar chart */}
          {radarData.length > 0 && (
            <Card className="p-4 mb-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4] mb-3">
                Terpene Profile Comparison
              </h2>
              <div className="w-full" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="3 3"
                    />
                    <PolarAngleAxis
                      dataKey="terpene"
                      tick={{ fill: '#8a9a8e', fontSize: 11 }}
                    />
                    {selectedStrains.map((strain, i) => (
                      <Radar
                        key={strain.name}
                        name={strain.name}
                        dataKey={strain.name}
                        stroke={COMPARE_COLORS[i]}
                        fill={COMPARE_COLORS[i]}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: '#8a9a8e' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Comparison table */}
          <Card className="overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/[0.06]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-[#5a6a5e] uppercase tracking-wider w-28">
                      Attribute
                    </th>
                    {selectedStrains.map((s, i) => (
                      <th
                        key={s.name}
                        className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: COMPARE_COLORS[i] }}
                      >
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Name / Type */}
                  <tr className="border-b border-gray-50 dark:border-white/[0.03]">
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-[#5a6a5e] font-medium">
                      Type
                    </td>
                    {selectedStrains.map((s) => (
                      <td key={s.name} className="px-4 py-3">
                        <TypeBadge type={s.type} />
                      </td>
                    ))}
                  </tr>

                  {/* THC */}
                  <tr className="border-b border-gray-50 dark:border-white/[0.03]">
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-[#5a6a5e] font-medium">
                      THC %
                    </td>
                    {selectedStrains.map((s, i) => {
                      const val = getNumericValue(s, 'thc')
                      const isHighest = findHighest('thc') === i
                      return (
                        <td
                          key={s.name}
                          className={`px-4 py-3 text-sm font-semibold ${
                            isHighest
                              ? 'text-leaf-400 bg-leaf-500/[0.06]'
                              : 'text-gray-700 dark:text-[#b0c4b4]'
                          }`}
                        >
                          {val}%
                        </td>
                      )
                    })}
                  </tr>

                  {/* CBD */}
                  <tr className="border-b border-gray-50 dark:border-white/[0.03]">
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-[#5a6a5e] font-medium">
                      CBD %
                    </td>
                    {selectedStrains.map((s, i) => {
                      const val = getNumericValue(s, 'cbd')
                      const isHighest = findHighest('cbd') === i
                      return (
                        <td
                          key={s.name}
                          className={`px-4 py-3 text-sm font-semibold ${
                            isHighest
                              ? 'text-leaf-400 bg-leaf-500/[0.06]'
                              : 'text-gray-700 dark:text-[#b0c4b4]'
                          }`}
                        >
                          {val}%
                        </td>
                      )
                    })}
                  </tr>

                  {/* Top Terpenes */}
                  <tr className="border-b border-gray-50 dark:border-white/[0.03]">
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-[#5a6a5e] font-medium">
                      Top Terpenes
                    </td>
                    {selectedStrains.map((s) => (
                      <td key={s.name} className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(s.terpenes || []).slice(0, 3).map((t) => {
                            const name = t.name || t
                            return (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                                style={{
                                  backgroundColor: `${getTerpeneColor(name)}15`,
                                  color: getTerpeneColor(name),
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: getTerpeneColor(name) }}
                                />
                                {name}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Effects */}
                  <tr className="border-b border-gray-50 dark:border-white/[0.03]">
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-[#5a6a5e] font-medium">
                      Effects
                    </td>
                    {selectedStrains.map((s) => (
                      <td key={s.name} className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(s.effects || []).slice(0, 4).map((eff) => (
                            <EffectBadge key={eff} effect={eff} variant="positive" />
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Negatives */}
                  <tr className="border-b border-gray-50 dark:border-white/[0.03]">
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-[#5a6a5e] font-medium">
                      Negatives
                    </td>
                    {selectedStrains.map((s) => (
                      <td key={s.name} className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(s.negatives || s.notIdealFor || []).slice(0, 3).map((neg) => (
                            <EffectBadge key={neg} effect={neg} variant="negative" />
                          ))}
                          {(!s.negatives || s.negatives?.length === 0) && (!s.notIdealFor || s.notIdealFor?.length === 0) && (
                            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">--</span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Flavors */}
                  <tr className="border-b border-gray-50 dark:border-white/[0.03]">
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-[#5a6a5e] font-medium">
                      Flavors
                    </td>
                    {selectedStrains.map((s) => (
                      <td key={s.name} className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(s.flavors || []).slice(0, 3).map((f) => (
                            <span
                              key={f}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e]"
                            >
                              {f}
                            </span>
                          ))}
                          {(!s.flavors || s.flavors?.length === 0) && (
                            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">--</span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Price range */}
                  <tr>
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-[#5a6a5e] font-medium">
                      Price Range
                    </td>
                    {selectedStrains.map((s) => (
                      <td
                        key={s.name}
                        className="px-4 py-3 text-sm text-gray-700 dark:text-[#b0c4b4]"
                      >
                        {s.priceRange ? s.priceRange.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()) : '--'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Placeholder when less than 2 strains */}
      {selectedStrains.length < 2 && (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center mb-4">
            <GitCompareArrows size={28} className="text-gray-300 dark:text-[#5a6a5e]" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">
            {selectedStrains.length === 0
              ? 'Select Strains to Compare'
              : 'Add One More Strain'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#8a9a8e] max-w-xs">
            {selectedStrains.length === 0
              ? 'Search for strains above or add from your quiz results to start comparing.'
              : 'Add at least one more strain to see the comparison chart and table.'}
          </p>
        </div>
      )}
    </div>
  )
}
