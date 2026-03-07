/**
 * ExploreStrainsPage — Educational strain exploration by desired effect.
 *
 * Learning-focused replacement for TopStrainsPage.
 * - No rankings or numbered positions
 * - Strains displayed in no particular order
 * - Educational context for each effect category
 * - ~50 strains per category, shuffled weekly
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronDown, Compass, FlaskConical, ArrowLeft, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import usePageTitle from '../hooks/usePageTitle'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { useFavorites } from '../hooks/useFavorites'
import StrainCard from '../components/results/StrainCard'
import LegalConsent from '../components/shared/LegalConsent'
import topStrainsData from '../data/top-strains-for.json'

/* ─── Deterministic weekly shuffle ─────────────────────────── */
function mulberry32(seed) {
  return function() {
    let t = (seed += 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function weeklyShuffle(arr, categorySeed = 0) {
  const pool = [...arr];
  const seed = isoWeek() * 1000 + categorySeed;
  const rng = mulberry32(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/* ─── Category metadata ────────────────────────────────────── */
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

/* ═════════════════════════════════════════════════════════════ */
export default function ExploreStrainsPage() {
  const { category: categorySlug } = useParams()
  const navigate = useNavigate()
  const { fullStrains, dataLoaded } = useStrainSearch()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [expandedStrain, setExpandedStrain] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showScience, setShowScience] = useState(false)
  const dropdownRef = useRef(null)

  const activeCategory = categorySlug && topStrainsData[categorySlug] ? categorySlug : null
  const catData = activeCategory ? topStrainsData[activeCategory] : null
  const catMeta = activeCategory ? categoryMeta[activeCategory] : null

  usePageTitle(catData ? `Discover: ${catData.label}` : 'Discover Strains')

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  useEffect(() => { setDropdownOpen(false) }, [categorySlug])

  const strainById = useMemo(() => {
    const map = {}
    for (const s of fullStrains) map[s.id] = s
    return map
  }, [fullStrains])

  /* Pick ~50 strains, shuffled weekly, no order */
  const catIndex = activeCategory ? CATEGORIES.findIndex(c => c.id === activeCategory) : 0
  const displayStrains = useMemo(() => {
    if (!catData || !dataLoaded) return []
    const shuffled = weeklyShuffle(catData.strains.slice(0, 50), catIndex)
    return shuffled
      .map((entry) => {
        const strain = strainById[entry.id]
        if (!strain) return null
        return { ...entry, strain }
      })
      .filter(Boolean)
  }, [catData, strainById, dataLoaded, catIndex])

  const handleToggle = useCallback((name) => {
    setExpandedStrain(prev => prev === name ? null : name)
  }, [])

  /* ─── INDEX VIEW — show all effect categories ──────────── */
  if (!activeCategory) {
    return (
      <LegalConsent feature="explore-strains">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Compass size={20} className="text-leaf-400" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea]">Discover Strains</h1>
            </div>
            <p className="text-xs text-gray-400 dark:text-[#5a6a5e]">
              Discover strains associated with specific effects. Browse by desired experience — no rankings, just options to explore and learn about.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CATEGORIES.map(cat => {
              const data = topStrainsData[cat.id]
              if (!data) return null
              return (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/explore-strains/${cat.id}`)}
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
                        <span>Explore These Strains</span>
                        <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Educational note */}
          <div className="mt-6 rounded-xl border border-leaf-500/10 bg-leaf-500/[0.02] p-4">
            <h3 className="text-xs font-bold text-leaf-400 mb-1.5 flex items-center gap-1.5">
              <BookOpen size={12} />
              About This Page
            </h3>
            <p className="text-[11px] text-gray-400 dark:text-[#6a7a6e] leading-relaxed">
              These strains are grouped by commonly reported effects from our database of community reports and available research.
              Strains are presented <strong className="text-gray-500 dark:text-[#8a9a8e]">in no particular order</strong> — this is
              not a ranking. Every person responds differently to cannabis. Use this as a starting point for your own research, and
              always check lab results from your dispensary.{' '}
              <Link to="/learn" className="text-leaf-500 hover:text-leaf-400 underline underline-offset-2">
                Learn more about cannabis science →
              </Link>
            </p>
          </div>
        </div>
      </LegalConsent>
    )
  }

  /* ─── CATEGORY VIEW — explore strains for a specific effect ─ */
  return (
    <LegalConsent feature="explore-strains">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate('/explore-strains')}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-[#6a7a6e] hover:text-leaf-400 transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          All Effects
        </button>

        <div className="flex items-start gap-3 mb-2">
          <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0', catMeta?.bg)}>
            {catData.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea]">
              Discover: {catData.label}
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
            <span className="text-gray-400 dark:text-[#6a7a6e]">Exploring:</span>
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
                    onClick={() => { navigate(`/explore-strains/${cat.id}`); setDropdownOpen(false) }}
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

        {/* No-ranking notice */}
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-leaf-500/[0.04] border border-leaf-500/10">
          <Compass size={14} className="text-leaf-400 flex-shrink-0" />
          <p className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
            Strains shown in <strong className="text-gray-500 dark:text-[#8a9a8e]">no particular order</strong>. Explore and learn about each one — this is not a ranking.
          </p>
        </div>

        {/* Strain list — no ranks, no scores */}
        {!dataLoaded ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {displayStrains.map(({ strain }) => (
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
        )}

        {/* Disclaimer */}
        <div className="mt-6 text-center text-[10px] text-gray-400 dark:text-[#5a6a5e] leading-relaxed">
          Strains grouped by commonly reported effects. This is informational only — not medical advice.
          <br />Individual experiences may vary. Always check dispensary lab results.
        </div>
      </div>
    </LegalConsent>
  )
}
