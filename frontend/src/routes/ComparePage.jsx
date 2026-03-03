import { useState, useMemo, useContext, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { X, Plus, Search, GitCompareArrows, Loader2, Trophy, Star, Leaf, Beaker, Heart, ShieldAlert, Utensils, DollarSign, Dna, Activity, Sparkles, TrendingUp } from 'lucide-react'
import ChemTooltip from '../components/shared/ChemTooltip'

/* ------------------------------------------------------------------ */
/*  Color palette for compared strains                                */
/* ------------------------------------------------------------------ */
const COMPARE_COLORS = ['#32c864', '#9775fa', '#ff922b']

/* ------------------------------------------------------------------ */
/*  Reusable compare table row components                             */
/* ------------------------------------------------------------------ */
function CompareRow({ label, icon, chemName, children }) {
  return (
    <tr className="border-b border-gray-50 dark:border-white/[0.03]">
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-[#5a6a5e] font-medium">
        <div className="flex items-center gap-1.5">
          {icon}
          {chemName ? <ChemTooltip name={chemName}>{label}</ChemTooltip> : label}
        </div>
      </td>
      {children}
    </tr>
  )
}

function CompareNumericRow({ label, icon, strains, getValue, format, chemName }) {
  const values = strains.map(getValue)
  const maxVal = Math.max(...values)
  return (
    <tr className="border-b border-gray-50 dark:border-white/[0.03]">
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-[#5a6a5e] font-medium">
        <div className="flex items-center gap-1.5">
          {icon}
          {chemName ? <ChemTooltip name={chemName}>{label}</ChemTooltip> : label}
        </div>
      </td>
      {strains.map((s, i) => {
        const val = values[i]
        const isHighest = val === maxVal && val > 0 && values.filter(v => v === maxVal).length === 1
        return (
          <td
            key={s.name}
            className={`px-4 py-3 text-sm font-semibold ${
              isHighest
                ? 'text-leaf-400 bg-leaf-500/[0.06]'
                : 'text-gray-700 dark:text-[#b0c4b4]'
            }`}
          >
            {format(val)}
          </td>
        )
      })}
    </tr>
  )
}

/* ------------------------------------------------------------------ */
/*  ComparePage                                                       */
/* ------------------------------------------------------------------ */
export default function ComparePage() {
  usePageTitle('Compare Strains')
  const [searchParams, setSearchParams] = useSearchParams()
  const { query, setQuery, results, getStrainByName, allStrains } = useStrainSearch()
  const strainsLoaded = allStrains.length > 0
  const { state: resultsState } = useContext(ResultsContext)

  const [selectedNames, setSelectedNames] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)

  /* Auto-add strain from URL ?add= param on mount ----------------- */
  useEffect(() => {
    const addParam = searchParams.get('add')
    if (addParam) {
      setSelectedNames((prev) => {
        if (prev.length >= MAX_COMPARE_STRAINS) return prev
        if (prev.some((n) => n.toLowerCase() === addParam.toLowerCase())) return prev
        return [...prev, addParam]
      })
      // Clean up the URL param
      searchParams.delete('add')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

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

    // Collect raw values first
    const rawPoints = [...allTerps].slice(0, 8).map((terpName) => {
      const point = { terpene: terpName }
      selectedStrains.forEach((strain) => {
        const terp = (strain.terpenes || []).find(
          (t) => (t.name || t) === terpName
        )
        point[strain.name] = terp ? parseFloat(terp.pct) || 0 : 0
      })
      return point
    })

    // Find global max across all strains/terpenes to normalize to 0-100
    let globalMax = 0
    rawPoints.forEach((point) => {
      selectedStrains.forEach((strain) => {
        const val = point[strain.name] || 0
        if (val > globalMax) globalMax = val
      })
    })
    if (globalMax === 0) globalMax = 1

    // Normalize to 0-100 scale
    return rawPoints.map((point) => {
      const normalized = { terpene: point.terpene }
      selectedStrains.forEach((strain) => {
        normalized[strain.name] = Math.round(((point[strain.name] || 0) / globalMax) * 100)
      })
      return normalized
    })
  }, [selectedStrains])

  /* Sorted unique terpene names across all selected strains ------- */
  const allTerpNames = useMemo(() => {
    const terpMap = new Map()
    selectedStrains.forEach(s => {
      ;(s.terpenes || []).forEach(t => {
        const name = (t.name || '').toLowerCase()
        if (!name) return
        const pct = parseFloat(String(t.pct || 0).replace('%', '')) || 0
        const existing = terpMap.get(name) || 0
        if (pct > existing) terpMap.set(name, pct)
      })
    })
    return [...terpMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 8)
  }, [selectedStrains])

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
              <div className="w-full" style={{ height: 380 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="80%">
                    <PolarGrid
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="3 3"
                    />
                    <PolarAngleAxis
                      dataKey="terpene"
                      tick={{ fill: '#b0c4b4', fontSize: 12, fontWeight: 500 }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    {selectedStrains.map((strain, i) => (
                      <Radar
                        key={strain.name}
                        name={strain.name}
                        dataKey={strain.name}
                        stroke={COMPARE_COLORS[i]}
                        fill={COMPARE_COLORS[i]}
                        fillOpacity={0.2}
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: COMPARE_COLORS[i], strokeWidth: 0 }}
                      />
                    ))}
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15,26,18,0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: 11,
                        color: '#b0c4b4',
                      }}
                      formatter={(value, name) => [`${value}%`, name]}
                      labelStyle={{ color: '#e8f0ea', fontSize: 12, fontWeight: 600 }}
                    />
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-[#5a6a5e] uppercase tracking-wider w-36">
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
                  {/* Type */}
                  <CompareRow label="Type" icon={<Leaf size={12} className="text-leaf-400" />}>
                    {selectedStrains.map((s) => (
                      <td key={s.name} className="px-4 py-3">
                        <TypeBadge type={s.type} />
                      </td>
                    ))}
                  </CompareRow>

                  {/* ── Cannabinoid Profile ──────────────── */}
                  <tr className="border-b border-gray-50 dark:border-white/[0.03]">
                    <td colSpan={selectedStrains.length + 1} className="px-4 pt-5 pb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-400/70 flex items-center gap-1.5">
                        <Beaker size={10} /> Cannabinoid Profile
                      </span>
                    </td>
                  </tr>

                  {/* THC */}
                  <CompareNumericRow
                    label="THC %"
                    chemName="THC"
                    icon={<Activity size={12} className="text-green-400" />}
                    strains={selectedStrains}
                    getValue={(s) => {
                      const c = (s.cannabinoids || []).find(c => c.name === 'THC')
                      return c?.value ?? (typeof s.thc === 'object' ? s.thc?.avg || 0 : s.thc || 0)
                    }}
                    format={(v) => `${v}%`}
                  />

                  {/* CBD */}
                  <CompareNumericRow
                    label="CBD %"
                    chemName="CBD"
                    icon={<Heart size={12} className="text-blue-400" />}
                    strains={selectedStrains}
                    getValue={(s) => {
                      const c = (s.cannabinoids || []).find(c => c.name === 'CBD')
                      return c?.value ?? (typeof s.cbd === 'object' ? s.cbd?.avg || 0 : s.cbd || 0)
                    }}
                    format={(v) => `${v}%`}
                  />

                  {/* CBN */}
                  <CompareNumericRow
                    label="CBN %"
                    chemName="CBN"
                    icon={<Beaker size={12} className="text-purple-400" />}
                    strains={selectedStrains}
                    getValue={(s) => (s.cannabinoids || []).find(c => c.name === 'CBN')?.value || 0}
                    format={(v) => `${v}%`}
                  />

                  {/* CBG */}
                  <CompareNumericRow
                    label="CBG %"
                    chemName="CBG"
                    icon={<Beaker size={12} className="text-amber-400" />}
                    strains={selectedStrains}
                    getValue={(s) => (s.cannabinoids || []).find(c => c.name === 'CBG')?.value || 0}
                    format={(v) => `${v}%`}
                  />

                  {/* ── Terpene Profile ───────────────────── */}
                  {allTerpNames.length > 0 && (
                    <tr className="border-b border-gray-50 dark:border-white/[0.03]">
                      <td colSpan={selectedStrains.length + 1} className="px-4 pt-5 pb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400/70 flex items-center gap-1.5">
                          <Sparkles size={10} /> Terpene Profile
                        </span>
                      </td>
                    </tr>
                  )}

                  {allTerpNames.map(terpName => {
                    const displayName = terpName.charAt(0).toUpperCase() + terpName.slice(1)
                    return (
                      <CompareNumericRow
                        key={terpName}
                        label={displayName}
                        chemName={terpName}
                        icon={
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getTerpeneColor(terpName) }}
                          />
                        }
                        strains={selectedStrains}
                        getValue={(s) => {
                          const t = (s.terpenes || []).find(
                            t => (t.name || '').toLowerCase() === terpName
                          )
                          return t ? parseFloat(String(t.pct || 0).replace('%', '')) || 0 : 0
                        }}
                        format={(v) => v > 0 ? `${v}%` : '\u2014'}
                      />
                    )
                  })}

                  {/* Effects (positive) */}
                  <CompareRow label="Effects" icon={<TrendingUp size={12} className="text-leaf-400" />}>
                    {selectedStrains.map((s) => (
                      <td key={s.name} className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(s.effects || [])
                            .filter(e => (e.category || 'positive') !== 'negative')
                            .slice(0, 5)
                            .map((eff) => {
                              const name = typeof eff === 'string' ? eff : eff.name || ''
                              return <EffectBadge key={name} effect={name} variant="positive" />
                            })}
                        </div>
                      </td>
                    ))}
                  </CompareRow>

                  {/* Negatives */}
                  <CompareRow label="Negatives" icon={<ShieldAlert size={12} className="text-red-400" />}>
                    {selectedStrains.map((s) => {
                      const negEffects = (s.effects || []).filter(e => e.category === 'negative')
                      const notIdeal = s.notIdealFor || s.not_ideal_for || []
                      const items = negEffects.length > 0
                        ? negEffects.slice(0, 3).map(e => typeof e === 'string' ? e : e.name || '')
                        : notIdeal.slice(0, 3)
                      return (
                        <td key={s.name} className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {items.length > 0 ? items.map((neg) => (
                              <EffectBadge key={neg} effect={neg} variant="negative" />
                            )) : (
                              <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">None reported</span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </CompareRow>

                  {/* Sentiment Score */}
                  <CompareNumericRow
                    label="Sentiment"
                    icon={<Star size={12} className="text-yellow-400" />}
                    strains={selectedStrains}
                    getValue={(s) => s.sentimentScore || s.forumAnalysis?.sentimentScore || 0}
                    format={(v) => v > 0 ? `${v}/10` : '--'}
                  />

                  {/* Community Reports */}
                  <CompareNumericRow
                    label="Reports"
                    icon={<Activity size={12} className="text-cyan-400" />}
                    strains={selectedStrains}
                    getValue={(s) => s.reviewCount || s.forumAnalysis?.totalReviews || 0}
                    format={(v) => v > 0 ? v.toLocaleString() : '--'}
                  />

                  {/* Flavors */}
                  <CompareRow label="Flavors" icon={<Utensils size={12} className="text-pink-400" />}>
                    {selectedStrains.map((s) => (
                      <td key={s.name} className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(s.flavors || []).slice(0, 4).map((f) => (
                            <span
                              key={f}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e]"
                            >
                              {f}
                            </span>
                          ))}
                          {(!s.flavors || s.flavors.length === 0) && (
                            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">--</span>
                          )}
                        </div>
                      </td>
                    ))}
                  </CompareRow>

                  {/* Genetics / Lineage */}
                  <CompareRow label="Lineage" icon={<Dna size={12} className="text-indigo-400" />}>
                    {selectedStrains.map((s) => {
                      const lineage = s.lineage || {}
                      const parents = lineage.parents || []
                      const genetics = s.genetics || ''
                      return (
                        <td key={s.name} className="px-4 py-3">
                          {parents.length > 0 ? (
                            <div className="space-y-0.5">
                              <span className="text-xs text-gray-700 dark:text-[#b0c4b4] font-medium">
                                {parents.join(' × ')}
                              </span>
                            </div>
                          ) : genetics ? (
                            <span className="text-xs text-gray-500 dark:text-[#8a9a8e]">{genetics}</span>
                          ) : (
                            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">Unknown</span>
                          )}
                        </td>
                      )
                    })}
                  </CompareRow>

                  {/* Best For */}
                  <CompareRow label="Best For" icon={<Trophy size={12} className="text-amber-400" />}>
                    {selectedStrains.map((s) => {
                      const items = s.bestFor || s.best_for || []
                      return (
                        <td key={s.name} className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {items.length > 0 ? items.slice(0, 3).map((b) => (
                              <span
                                key={b}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20"
                              >
                                {b}
                              </span>
                            )) : (
                              <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">--</span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </CompareRow>

                  {/* Consumption Suitability */}
                  <CompareRow label="Best Method" icon={<Leaf size={12} className="text-emerald-400" />}>
                    {selectedStrains.map((s) => {
                      const cs = s.consumptionSuitability || s.consumption_suitability || {}
                      const sorted = Object.entries(cs)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 3)
                      return (
                        <td key={s.name} className="px-4 py-3">
                          {sorted.length > 0 ? (
                            <div className="space-y-1">
                              {sorted.map(([method, score]) => (
                                <div key={method} className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-gray-500 dark:text-[#8a9a8e] capitalize w-16">{method}</span>
                                  <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden max-w-16">
                                    <div
                                      className="h-full rounded-full bg-leaf-500/70"
                                      style={{ width: `${(score / 10) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-[9px] text-gray-400 dark:text-[#5a6a5e] w-4 text-right">{score}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">--</span>
                          )}
                        </td>
                      )
                    })}
                  </CompareRow>

                  {/* Availability */}
                  <CompareNumericRow
                    label="Availability"
                    icon={<Search size={12} className="text-teal-400" />}
                    strains={selectedStrains}
                    getValue={(s) => s.availability || 5}
                    format={(v) => {
                      const label = v >= 9 ? 'Very Common' : v >= 7 ? 'Common' : v >= 5 ? 'Moderate' : v >= 3 ? 'Uncommon' : 'Rare'
                      return `${v}/10 · ${label}`
                    }}
                  />

                  {/* Price range */}
                  <CompareRow label="Price" icon={<DollarSign size={12} className="text-green-400" />}>
                    {selectedStrains.map((s) => (
                      <td
                        key={s.name}
                        className="px-4 py-3 text-sm text-gray-700 dark:text-[#b0c4b4]"
                      >
                        {s.priceRange ? s.priceRange.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()) : '--'}
                      </td>
                    ))}
                  </CompareRow>

                  {/* Match % (if from quiz results) */}
                  {selectedStrains.some(s => s.matchPct > 0) && (
                    <CompareNumericRow
                      label="Match %"
                      icon={<Sparkles size={12} className="text-purple-400" />}
                      strains={selectedStrains}
                      getValue={(s) => s.matchPct || 0}
                      format={(v) => v > 0 ? `${v}%` : '--'}
                    />
                  )}
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
