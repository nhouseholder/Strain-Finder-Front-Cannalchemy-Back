import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronDown, Award, FlaskConical, Users, Globe, Beaker, ArrowLeft, Crown } from 'lucide-react'
import clsx from 'clsx'
import usePageTitle from '../hooks/usePageTitle'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { useFavorites } from '../hooks/useFavorites'
import StrainCard from '../components/results/StrainCard'
import LegalConsent from '../components/shared/LegalConsent'
import topStrainsData from '../data/top-strains-for.json'

/* ─── Category metadata (order matches generate script) ───── */
const CATEGORIES = [
  { id: 'pain-relief',   emoji: '🩹', color: 'text-red-400',    bg: 'bg-red-500/10' },
  { id: 'sleep',         emoji: '🌙', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { id: 'anxiety-safe',  emoji: '🫧', color: 'text-sky-400',    bg: 'bg-sky-500/10' },
  { id: 'giggles',       emoji: '😂', color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  { id: 'creativity',    emoji: '🎨', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { id: 'energy-focus',  emoji: '⚡', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { id: 'appetite',      emoji: '🍽️', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { id: 'relaxation',    emoji: '🧘', color: 'text-emerald-400',bg: 'bg-emerald-500/10' },
  { id: 'social',        emoji: '💬', color: 'text-pink-400',   bg: 'bg-pink-500/10' },
  { id: 'euphoria',      emoji: '✨', color: 'text-leaf-400',   bg: 'bg-leaf-500/10' },
]

const categoryMeta = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))

/* ─── Pillar bar component ─────────────────────────────────── */
function PillarBar({ label, icon: Icon, value, color }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Icon size={12} className={color} />
      <span className="text-gray-400 dark:text-[#6a7a6e] w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-200/50 dark:bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: 'linear-gradient(90deg, #32c864, #22b854)' }} />
      </div>
      <span className="text-gray-500 dark:text-[#8a9a8e] w-8 text-right font-mono">{value}</span>
    </div>
  )
}

/* ─── Rank badge ───────────────────────────────────────────── */
function RankBadge({ rank }) {
  const isTop3 = rank <= 3
  return (
    <div className={clsx(
      'flex items-center justify-center rounded-lg font-bold text-xs min-w-[32px] h-8 shrink-0 transition-colors',
      isTop3
        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/20'
        : 'bg-gray-100/80 dark:bg-white/[0.06] text-gray-500 dark:text-[#8a9a8e]'
    )}>
      {isTop3 && <Crown size={10} className="mr-0.5" />}
      #{rank}
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════ */
export default function TopStrainsPage() {
  const { category: categorySlug } = useParams()
  const navigate = useNavigate()
  const { allStrains, dataLoaded } = useStrainSearch()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [expandedStrain, setExpandedStrain] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showScience, setShowScience] = useState(false)
  const dropdownRef = useRef(null)

  // Resolve active category
  const activeCategory = categorySlug && topStrainsData[categorySlug] ? categorySlug : null
  const catData = activeCategory ? topStrainsData[activeCategory] : null
  const catMeta = activeCategory ? categoryMeta[activeCategory] : null

  usePageTitle(catData ? `Top Strains for ${catData.label}` : 'Top Strains For...')

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  // Close dropdown on route change
  useEffect(() => { setDropdownOpen(false) }, [categorySlug])

  // Build strain lookup by id
  const strainById = useMemo(() => {
    const map = {}
    for (const s of allStrains) map[s.id] = s
    return map
  }, [allStrains])

  // Resolve ranked strains for the active category
  const rankedStrains = useMemo(() => {
    if (!catData || !dataLoaded) return []
    return catData.strains
      .map((entry, i) => {
        const strain = strainById[entry.id]
        if (!strain) return null
        return { ...entry, strain, rank: i + 1 }
      })
      .filter(Boolean)
  }, [catData, strainById, dataLoaded])

  const handleToggle = useCallback((name) => {
    setExpandedStrain(prev => prev === name ? null : name)
  }, [])

  /* ─── INDEX VIEW — show all category cards ──────────────── */
  if (!activeCategory) {
    return (
      <LegalConsent feature="top-strains">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Award size={20} className="text-leaf-400" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea]">Top Strains For...</h1>
            </div>
            <p className="text-xs text-gray-400 dark:text-[#5a6a5e]">
              Curated top-20 lists scored by our tri-pillar engine: 40% pharmacological science, 30% community reports, 30% popularity.
            </p>
          </div>

          {/* Category grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CATEGORIES.map(cat => {
              const data = topStrainsData[cat.id]
              if (!data) return null
              return (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/top-strains/${cat.id}`)}
                  className="text-left rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white/50 dark:bg-[#0e1a10]/50 p-4 hover:border-leaf-500/30 hover:bg-leaf-500/[0.03] transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0', cat.bg)}>
                      {cat.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] group-hover:text-leaf-400 transition-colors">
                        {data.label}
                      </h3>
                      <p className="text-[11px] text-gray-400 dark:text-[#6a7a6e] mt-0.5 line-clamp-2">
                        {data.description}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-leaf-400 font-medium">
                        <span>View Top 20</span>
                        <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Methodology note */}
          <div className="mt-6 rounded-xl border border-leaf-500/10 bg-leaf-500/[0.02] p-4">
            <h3 className="text-xs font-bold text-leaf-400 mb-1.5 flex items-center gap-1.5">
              <Beaker size={12} />
              Scoring Methodology
            </h3>
            <p className="text-[11px] text-gray-400 dark:text-[#6a7a6e] leading-relaxed">
              Each strain is scored using the same tri-pillar engine that powers our quiz recommendations. <strong className="text-gray-500 dark:text-[#8a9a8e]">Science (40%)</strong> evaluates terpene-to-receptor pathway alignment with the pharmacological scaffold for each goal. <strong className="text-gray-500 dark:text-[#8a9a8e]">Community (30%)</strong> measures how strongly real users report the desired effects. <strong className="text-gray-500 dark:text-[#8a9a8e]">Commonness (30%)</strong> factors in dispensary availability and review sentiment. This is not medical advice.
            </p>
          </div>
        </div>
      </LegalConsent>
    )
  }

  /* ─── CATEGORY VIEW — show top-20 for a specific category ─ */
  return (
    <LegalConsent feature="top-strains">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Back + Header */}
        <button
          onClick={() => navigate('/top-strains')}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-[#6a7a6e] hover:text-leaf-400 transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          All Categories
        </button>

        <div className="flex items-start gap-3 mb-2">
          <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0', catMeta?.bg)}>
            {catData.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea]">
              Top 20 Strains for {catData.label}
            </h1>
            <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-0.5">
              {catData.description}
            </p>
          </div>
        </div>

        {/* Science explanation toggle */}
        <button
          onClick={() => setShowScience(v => !v)}
          className="flex items-center gap-1.5 text-[11px] text-leaf-400/80 hover:text-leaf-400 transition-colors mb-4"
        >
          <FlaskConical size={12} />
          {showScience ? 'Hide' : 'Show'} pharmacological basis
        </button>
        {showScience && (
          <div className="rounded-xl border border-leaf-500/10 bg-leaf-500/[0.02] p-3 mb-4 text-[11px] text-gray-400 dark:text-[#6a7a6e] leading-relaxed">
            {catData.science}
          </div>
        )}

        {/* Category selector dropdown */}
        <div className="relative mb-5" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200/60 dark:border-white/[0.08] bg-white/50 dark:bg-[#0e1a10]/50 hover:border-leaf-500/30 transition-colors text-sm w-full sm:w-auto"
          >
            <span className="text-gray-400 dark:text-[#6a7a6e]">Top strains for:</span>
            <span className="font-semibold text-gray-900 dark:text-[#e8f0ea]">{catData.emoji} {catData.label}</span>
            <ChevronDown size={14} className={clsx('text-gray-400 transition-transform ml-auto', dropdownOpen && 'rotate-180')} />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-full sm:w-72 max-h-80 overflow-y-auto rounded-xl border border-gray-200/60 dark:border-white/[0.10] bg-white dark:bg-[#141f16] shadow-2xl z-50 py-1 animate-fade-in">
              {CATEGORIES.map(cat => {
                const d = topStrainsData[cat.id]
                if (!d) return null
                const isActive = cat.id === activeCategory
                return (
                  <button
                    key={cat.id}
                    onClick={() => { navigate(`/top-strains/${cat.id}`); setDropdownOpen(false) }}
                    className={clsx(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-leaf-500/[0.06] transition-colors text-sm',
                      isActive && 'bg-leaf-500/10'
                    )}
                  >
                    <span className="text-base">{cat.emoji}</span>
                    <span className={clsx('font-medium', isActive ? 'text-leaf-400' : 'text-gray-700 dark:text-[#c8dccb]')}>
                      {d.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Strain list */}
        {!dataLoaded ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {rankedStrains.map(({ strain, rank, score, science, community, commonness }) => (
              <div key={strain.id || strain.name}>
                {/* Rank + Pillar scores header */}
                <div className="flex items-center gap-3 mb-1.5">
                  <RankBadge rank={rank} />
                  <div className="flex-1 grid grid-cols-3 gap-1.5">
                    <PillarBar label="Science" icon={FlaskConical} value={science} color="text-purple-400" />
                    <PillarBar label="Community" icon={Users} value={community} color="text-blue-400" />
                    <PillarBar label="Popularity" icon={Globe} value={commonness} color="text-leaf-400" />
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-leaf-400">{score}</div>
                    <div className="text-[9px] text-gray-400 dark:text-[#5a6a5e]">score</div>
                  </div>
                </div>

                {/* Strain card */}
                <StrainCard
                  strain={strain}
                  expanded={expandedStrain === strain.name}
                  onToggle={() => handleToggle(strain.name)}
                  isFavorite={isFavorite(strain.name)}
                  onFavorite={toggleFavorite}
                  availability={[]}
                  availabilityLoading={false}
                  onViewDispensary={null}
                />
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-6 text-center text-[10px] text-gray-400 dark:text-[#5a6a5e] leading-relaxed">
          Rankings generated by the MyStrainAI tri-pillar scoring engine (40% science / 30% community / 30% commonness).
          <br />This is informational only — not medical advice. Individual experiences may vary.
        </div>
      </div>
    </LegalConsent>
  )
}
