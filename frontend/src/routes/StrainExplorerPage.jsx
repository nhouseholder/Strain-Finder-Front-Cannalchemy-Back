import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp, FlaskConical, Leaf, Search, Globe } from 'lucide-react'
import usePageTitle from '../hooks/usePageTitle'
import sig2 from '../utils/fmt'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { useFavorites } from '../hooks/useFavorites'
import StrainCard from '../components/results/StrainCard'
import SortDropdown, { applySortComparator } from '../components/shared/SortDropdown'
import LegalConsent from '../components/shared/LegalConsent'

/* ─────────────────────────────────────────────────────────────
   Slider configs — ranges match our 967-strain dataset
   Each slider is proportionally scaled: equal-length min → max
   ────────────────────────────────────────────────────────────── */
const TERPENE_SLIDERS = [
  { key: 'myrcene',       label: 'Myrcene',       min: 0, max: 0.7,  step: 0.01, unit: '%', color: '#32c864', desc: 'Sedating, earthy' },
  { key: 'linalool',      label: 'Linalool',      min: 0, max: 0.3,  step: 0.01, unit: '%', color: '#a855f7', desc: 'Calming, floral' },
  { key: 'caryophyllene', label: 'Caryophyllene',  min: 0, max: 0.5,  step: 0.01, unit: '%', color: '#f59e0b', desc: 'Spicy, anti-inflammatory' },
  { key: 'limonene',      label: 'Limonene',      min: 0, max: 0.6,  step: 0.01, unit: '%', color: '#eab308', desc: 'Citrus, uplifting' },
  { key: 'pinene',        label: 'Pinene',        min: 0, max: 0.45, step: 0.01, unit: '%', color: '#22d3ee', desc: 'Pine, alertness' },
  { key: 'humulene',      label: 'Humulene',      min: 0, max: 0.25, step: 0.01, unit: '%', color: '#6366f1', desc: 'Woody, appetite suppressant' },
  { key: 'terpinolene',   label: 'Terpinolene',   min: 0, max: 0.56, step: 0.01, unit: '%', color: '#ec4899', desc: 'Fruity, herbaceous' },
]

const CANNABINOID_SLIDERS = [
  { key: 'thc', label: 'THC', min: 0, max: 39, step: 0.5, unit: '%', color: '#32c864', desc: 'Psychoactive potency' },
  { key: 'cbd', label: 'CBD', min: 0, max: 30, step: 0.5, unit: '%', color: '#3b82f6', desc: 'Non-psychoactive, therapeutic' },
]

/* ─── Commonness scale (maps to availability 1-10) ───────── */
const COMMONNESS_MIN = 1
const COMMONNESS_MAX = 10
const COMMONNESS_LABELS = [
  { min: 1, max: 3, label: 'Rare / Boutique', color: '#a855f7' },
  { min: 4, max: 5, label: 'Moderate', color: '#f59e0b' },
  { min: 6, max: 7, label: 'Popular', color: '#3b82f6' },
  { min: 8, max: 10, label: 'Widely Available', color: '#32c864' },
]

function getInitialFilters() {
  return {
    // Terpenes: [minThreshold, maxThreshold] — default: full range (no filtering)
    ...Object.fromEntries(TERPENE_SLIDERS.map(s => [s.key, [s.min, s.max]])),
    // Cannabinoids
    ...Object.fromEntries(CANNABINOID_SLIDERS.map(s => [s.key, [s.min, s.max]])),
    // Strain type filter
    type: 'all', // all | indica | sativa | hybrid
    // Commonness range
    commonness: [COMMONNESS_MIN, COMMONNESS_MAX],
    // Sort
    sort: 'name',
  }
}

/* ─── Dual-range slider ──────────────────────────────────── */
function DualRangeSlider({ label, desc, min, max, step, unit, color, value, onChange }) {
  const [lo, hi] = value
  const trackRef = useRef(null)
  const activeThumb = useRef(null)

  // Helpers
  const pct = (v) => ((v - min) / (max - min)) * 100
  const clamp = (v) => Math.round(Math.min(max, Math.max(min, v)) / step) * step

  const handlePointerDown = (thumb) => (e) => {
    e.preventDefault()
    activeThumb.current = thumb
    const move = (ev) => {
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const x = (ev.clientX || ev.touches?.[0]?.clientX || 0) - rect.left
      const ratio = Math.min(1, Math.max(0, x / rect.width))
      const raw = min + ratio * (max - min)
      const snapped = clamp(raw)
      if (thumb === 'lo') onChange([Math.min(snapped, hi), hi])
      else onChange([lo, Math.max(snapped, lo)])
    }
    const up = () => {
      activeThumb.current = null
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  const isActive = lo > min || hi < max

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[11px] font-semibold text-gray-700 dark:text-[#c0d4c6]">
            {label}
          </span>
          <span className="text-[9px] text-gray-400 dark:text-[#5a6a5e] hidden sm:inline">
            {desc}
          </span>
        </div>
        <span className={`text-[10px] font-mono tabular-nums ${isActive ? 'text-leaf-400 font-semibold' : 'text-gray-400 dark:text-[#6a7a6e]'}`}>
          {sig2(lo)}{unit} – {sig2(hi)}{unit}
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-2 rounded-full bg-gray-200 dark:bg-white/[0.06] cursor-pointer select-none touch-none"
      >
        {/* Active range fill */}
        <div
          className="absolute h-full rounded-full transition-colors"
          style={{
            left: `${pct(lo)}%`,
            width: `${pct(hi) - pct(lo)}%`,
            backgroundColor: isActive ? color : `${color}40`,
          }}
        />

        {/* Low thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white dark:border-[#1a2e1e] shadow-md cursor-grab active:cursor-grabbing transition-transform hover:scale-125 z-10"
          style={{ left: `${pct(lo)}%`, backgroundColor: color }}
          onPointerDown={handlePointerDown('lo')}
        />

        {/* High thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white dark:border-[#1a2e1e] shadow-md cursor-grab active:cursor-grabbing transition-transform hover:scale-125 z-10"
          style={{ left: `${pct(hi)}%`, backgroundColor: color }}
          onPointerDown={handlePointerDown('hi')}
        />
      </div>
    </div>
  )
}

/* ─── Commonness slider with tier labels ─────────────────── */
function CommonnessSlider({ value, onChange }) {
  const [lo, hi] = value
  const trackRef = useRef(null)
  const min = COMMONNESS_MIN
  const max = COMMONNESS_MAX
  const step = 1
  const pct = (v) => ((v - min) / (max - min)) * 100
  const clamp = (v) => Math.round(Math.min(max, Math.max(min, v)))

  const handlePointerDown = (thumb) => (e) => {
    e.preventDefault()
    const move = (ev) => {
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const x = (ev.clientX || ev.touches?.[0]?.clientX || 0) - rect.left
      const ratio = Math.min(1, Math.max(0, x / rect.width))
      const raw = min + ratio * (max - min)
      const snapped = clamp(raw)
      if (thumb === 'lo') onChange([Math.min(snapped, hi), hi])
      else onChange([lo, Math.max(snapped, lo)])
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  const isActive = lo > min || hi < max

  // Get the current tier label for the selected range
  const currentLabel = useMemo(() => {
    const matching = COMMONNESS_LABELS.filter(t => t.min <= hi && t.max >= lo)
    if (matching.length === COMMONNESS_LABELS.length) return 'All strains'
    return matching.map(t => t.label).join(' – ')
  }, [lo, hi])

  // Color for the active range — blend from the tier covering the midpoint
  const midpoint = (lo + hi) / 2
  const midTier = COMMONNESS_LABELS.find(t => midpoint >= t.min && midpoint <= t.max) || COMMONNESS_LABELS[1]

  return (
    <div className="space-y-2">
      {/* Current range + label */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium ${isActive ? 'text-leaf-400' : 'text-gray-400 dark:text-[#6a7a6e]'}`}>
          {currentLabel}
        </span>
        <span className={`text-[10px] font-mono tabular-nums ${isActive ? 'text-leaf-400 font-semibold' : 'text-gray-400 dark:text-[#6a7a6e]'}`}>
          {lo} – {hi}
        </span>
      </div>

      {/* Track with tier-colored segments */}
      <div
        ref={trackRef}
        className="relative h-2.5 rounded-full bg-gray-200 dark:bg-white/[0.06] cursor-pointer select-none touch-none"
      >
        {/* Tier background segments */}
        {COMMONNESS_LABELS.map((tier) => (
          <div
            key={tier.label}
            className="absolute h-full first:rounded-l-full last:rounded-r-full"
            style={{
              left: `${pct(tier.min)}%`,
              width: `${pct(tier.max + 1) - pct(tier.min)}%`,
              backgroundColor: `${tier.color}15`,
            }}
          />
        ))}

        {/* Active range fill */}
        <div
          className="absolute h-full rounded-full transition-colors z-[1]"
          style={{
            left: `${pct(lo)}%`,
            width: `${Math.max(pct(hi) - pct(lo), 2)}%`,
            backgroundColor: isActive ? midTier.color : `${midTier.color}40`,
          }}
        />

        {/* Low thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4.5 h-4.5 rounded-full border-2 border-white dark:border-[#1a2e1e] shadow-md cursor-grab active:cursor-grabbing transition-transform hover:scale-125 z-10"
          style={{ left: `${pct(lo)}%`, backgroundColor: midTier.color }}
          onPointerDown={handlePointerDown('lo')}
        />

        {/* High thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4.5 h-4.5 rounded-full border-2 border-white dark:border-[#1a2e1e] shadow-md cursor-grab active:cursor-grabbing transition-transform hover:scale-125 z-10"
          style={{ left: `${pct(hi)}%`, backgroundColor: midTier.color }}
          onPointerDown={handlePointerDown('hi')}
        />
      </div>

      {/* Tier legend */}
      <div className="flex justify-between gap-1">
        {COMMONNESS_LABELS.map((tier) => (
          <div key={tier.label} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tier.color }} />
            <span className="text-[8px] text-gray-400 dark:text-[#5a6a5e] whitespace-nowrap">
              {tier.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Type toggle pill ───────────────────────────────────── */
const TYPE_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'indica', label: 'Indica' },
  { id: 'sativa', label: 'Sativa' },
  { id: 'hybrid', label: 'Hybrid' },
]

function TypeToggle({ value, onChange }) {
  return (
    <div className="flex gap-1 p-0.5 rounded-lg bg-gray-100 dark:bg-white/[0.04]">
      {TYPE_OPTIONS.map(opt => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
            value === opt.id
              ? 'bg-white dark:bg-leaf-500/20 text-leaf-600 dark:text-leaf-400 shadow-sm'
              : 'text-gray-500 dark:text-[#6a7a6e] hover:text-gray-700 dark:hover:text-[#8a9a8e]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/* ─── Sort options — now handled by SortDropdown component ─ */

/* ─── Main page ──────────────────────────────────────────── */
export default function StrainExplorerPage() {
  usePageTitle('Strain Explorer')
  const { allStrains, dataLoaded } = useStrainSearch()
  const { toggleFavorite, isFavorite } = useFavorites()
  const [filters, setFilters] = useState(getInitialFilters)
  const [expandedStrain, setExpandedStrain] = useState(null)
  const [showTerps, setShowTerps] = useState(true)
  const [showCanns, setShowCanns] = useState(true)
  const [displayCount, setDisplayCount] = useState(24)

  const handleToggle = useCallback((name) => {
    setExpandedStrain(prev => prev === name ? null : name)
  }, [])

  const updateFilter = useCallback((key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }))
    setDisplayCount(24) // reset pagination when filter changes
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(getInitialFilters())
    setDisplayCount(24)
  }, [])

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    const init = getInitialFilters()
    return Object.keys(init).some(k => {
      if (k === 'sort') return false
      if (Array.isArray(init[k])) return filters[k][0] !== init[k][0] || filters[k][1] !== init[k][1]
      return filters[k] !== init[k]
    })
  }, [filters])

  // ── Filter + sort strains ──
  const filteredStrains = useMemo(() => {
    if (!dataLoaded || allStrains.length === 0) return []

    const parseTerpPct = (strain, terpName) => {
      const t = (strain.terpenes || []).find(t => (t.name || '').toLowerCase() === terpName)
      if (!t) return null // strain doesn't have this terpene data
      return typeof t.pct === 'number' ? t.pct : parseFloat(String(t.pct || '0').replace('%', '')) || 0
    }
    const getCannVal = (strain, cannName) => {
      const c = (strain.cannabinoids || []).find(c => (c.name || '').toLowerCase() === cannName)
      return c?.value ?? null
    }

    let result = allStrains.filter(s => {
      // Type filter
      if (filters.type !== 'all' && (s.type || '').toLowerCase() !== filters.type) return false

      // Terpene filters
      for (const slider of TERPENE_SLIDERS) {
        const [lo, hi] = filters[slider.key]
        if (lo <= slider.min && hi >= slider.max) continue // full range = no filter
        const val = parseTerpPct(s, slider.key)
        if (val === null) return false // strain missing this terpene → exclude when filtering
        if (val < lo || val > hi) return false
      }

      // Cannabinoid filters
      for (const slider of CANNABINOID_SLIDERS) {
        const [lo, hi] = filters[slider.key]
        if (lo <= slider.min && hi >= slider.max) continue
        const val = getCannVal(s, slider.key)
        if (val === null) return false
        if (val < lo || val > hi) return false
      }

      // Commonness filter (availability field)
      const [cLo, cHi] = filters.commonness
      if (cLo > COMMONNESS_MIN || cHi < COMMONNESS_MAX) {
        const avail = s.availability ?? 5
        if (avail < cLo || avail > cHi) return false
      }

      return true
    })

    // Sort using the shared comparator
    result.sort(applySortComparator(filters.sort))

    return result
  }, [allStrains, dataLoaded, filters])

  // Infinite scroll
  const loaderRef = useRef(null)
  useEffect(() => {
    if (!loaderRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && displayCount < filteredStrains.length) {
          setDisplayCount(prev => Math.min(prev + 24, filteredStrains.length))
        }
      },
      { rootMargin: '400px' }
    )
    observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [displayCount, filteredStrains.length])

  const displayStrains = filteredStrains.slice(0, displayCount)

  return (
    <LegalConsent>
      <div className="w-full max-w-4xl mx-auto px-4 pt-4 pb-24 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea] flex items-center gap-2"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              <SlidersHorizontal size={24} className="text-leaf-400" />
              Strain Explorer
            </h1>
            <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-0.5">
              Filter {allStrains.length.toLocaleString()} strains by terpene &amp; cannabinoid levels
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-all"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>

        {/* ── Filter panel ── */}
        <div className="rounded-xl border border-leaf-500/15 bg-leaf-500/[0.02] dark:bg-leaf-500/[0.03] p-4 mb-5 space-y-4">
          {/* Type + Sort row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TypeToggle value={filters.type} onChange={(v) => updateFilter('type', v)} />
            <SortDropdown
              value={filters.sort}
              onChange={(v) => updateFilter('sort', v)}
            />
          </div>

          {/* ── Commonness section ── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe size={14} className="text-leaf-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-leaf-400 flex-1">
                Commonness
              </span>
            </div>
            <CommonnessSlider
              value={filters.commonness}
              onChange={(v) => updateFilter('commonness', v)}
            />
          </div>

          {/* ── Cannabinoids section ── */}
          <div>
            <button
              onClick={() => setShowCanns(v => !v)}
              className="flex items-center gap-2 w-full text-left mb-2"
            >
              <FlaskConical size={14} className="text-leaf-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-leaf-400 flex-1">
                Cannabinoids
              </span>
              {showCanns ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            {showCanns && (
              <div className="space-y-3 pl-1">
                {CANNABINOID_SLIDERS.map(slider => (
                  <DualRangeSlider
                    key={slider.key}
                    {...slider}
                    value={filters[slider.key]}
                    onChange={(v) => updateFilter(slider.key, v)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Terpenes section ── */}
          <div>
            <button
              onClick={() => setShowTerps(v => !v)}
              className="flex items-center gap-2 w-full text-left mb-2"
            >
              <Leaf size={14} className="text-leaf-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-leaf-400 flex-1">
                Terpenes
              </span>
              {showTerps ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            {showTerps && (
              <div className="space-y-3 pl-1">
                {TERPENE_SLIDERS.map(slider => (
                  <DualRangeSlider
                    key={slider.key}
                    {...slider}
                    value={filters[slider.key]}
                    onChange={(v) => updateFilter(slider.key, v)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Results bar ── */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500 dark:text-[#8a9a8e]">
            {!dataLoaded ? (
              'Loading strain database...'
            ) : (
              <>
                <span className="font-semibold text-leaf-400">{filteredStrains.length.toLocaleString()}</span>
                {' '}strain{filteredStrains.length !== 1 ? 's' : ''} match{filteredStrains.length === 1 ? 'es' : ''}
                {hasActiveFilters && (
                  <span className="text-gray-400 dark:text-[#5a6a5e]"> your filters</span>
                )}
              </>
            )}
          </p>
          {filteredStrains.length > displayCount && (
            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
              Showing {displayCount} of {filteredStrains.length}
            </span>
          )}
        </div>

        {/* ── Strain cards ── */}
        {dataLoaded && filteredStrains.length === 0 && (
          <div className="text-center py-16">
            <Search size={32} className="mx-auto text-gray-300 dark:text-[#3a4a3e] mb-3" />
            <p className="text-sm text-gray-400 dark:text-[#6a7a6e] mb-2">No strains match these filters.</p>
            <button
              onClick={resetFilters}
              className="text-[11px] text-leaf-400 hover:text-leaf-300 underline underline-offset-2"
            >
              Reset all filters
            </button>
          </div>
        )}

        <div className="space-y-3">
          {displayStrains.map(strain => (
            <StrainCard
              key={strain.id || strain.name}
              strain={strain}
              expanded={expandedStrain === strain.name}
              onToggle={() => handleToggle(strain.name)}
              isFavorite={isFavorite(strain.name)}
              onFavorite={toggleFavorite}
              availability={[]}
              availabilityLoading={false}
              onViewDispensary={null}
            />
          ))}
        </div>

        {/* Infinite scroll sentinel */}
        {displayCount < filteredStrains.length && (
          <div ref={loaderRef} className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin" />
          </div>
        )}
      </div>
    </LegalConsent>
  )
}
