import { useContext, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResultsContext } from '../context/ResultsContext'
import { UserContext } from '../context/UserContext'
import { useFavorites } from '../hooks/useFavorites'
import { TypeBadge, EffectBadge, ConfidenceBadge } from '../components/shared/Badge'
import ProgressBar from '../components/shared/ProgressBar'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import { getTerpeneColor, getTypeColor } from '../utils/colors'
import {
  Heart,
  MapPin,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Star,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ArrowRight,
} from 'lucide-react'
import { useState } from 'react'

/* ------------------------------------------------------------------ */
/*  SortControls (inline)                                             */
/* ------------------------------------------------------------------ */
function SortControls({ sortBy, filterType, onSort, onFilter }) {
  const sortOptions = [
    { value: 'match', label: 'Best Match' },
    { value: 'thc', label: 'Highest THC' },
    { value: 'cbd', label: 'Highest CBD' },
    { value: 'sentiment', label: 'Top Rated' },
  ]

  const filterOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'indica', label: 'Indica' },
    { value: 'sativa', label: 'Sativa' },
    { value: 'hybrid', label: 'Hybrid' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Sort */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {sortOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSort(opt.value)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 ${
              sortBy === opt.value
                ? 'bg-leaf-500/15 text-leaf-400 border border-leaf-500/30'
                : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border border-transparent hover:bg-gray-200 dark:hover:bg-white/[0.08]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-gray-200 dark:bg-white/10 hidden sm:block" />

      {/* Filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {filterOptions.map((opt) => {
          const tc = opt.value !== 'all' ? getTypeColor(opt.value) : null
          return (
            <button
              key={opt.value}
              onClick={() => onFilter(opt.value)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 ${
                filterType === opt.value
                  ? tc
                    ? `border`
                    : 'bg-leaf-500/15 text-leaf-400 border border-leaf-500/30'
                  : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border border-transparent hover:bg-gray-200 dark:hover:bg-white/[0.08]'
              }`}
              style={
                filterType === opt.value && tc
                  ? { backgroundColor: `${tc.hex}15`, borderColor: `${tc.hex}40`, color: tc.hex }
                  : undefined
              }
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  StrainCard (inline)                                               */
/* ------------------------------------------------------------------ */
function StrainCard({ strain, isFavorite, onToggleFavorite }) {
  const [expanded, setExpanded] = useState(false)
  const tc = getTypeColor(strain.type)

  return (
    <Card className="p-0 overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea] truncate">
                {strain.name}
              </h3>
              <TypeBadge type={strain.type} />
            </div>
            {strain.genetics && (
              <p className="text-xs text-gray-400 dark:text-[#5a6a5e] truncate">
                {strain.genetics}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Match badge */}
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl text-sm font-bold border"
              style={{
                backgroundColor: `${tc.hex}15`,
                borderColor: `${tc.hex}30`,
                color: tc.hex,
              }}
            >
              {strain.matchPct != null ? `${Math.round(strain.matchPct)}%` : '—'}
            </div>

            {/* Favorite */}
            <button
              onClick={() => onToggleFavorite(strain.name)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                size={18}
                className={
                  isFavorite
                    ? 'fill-red-500 text-red-500'
                    : 'text-gray-300 dark:text-[#4a5a4e]'
                }
              />
            </button>
          </div>
        </div>

        {/* Why match */}
        {strain.whyMatch && (
          <p className="text-sm text-gray-600 dark:text-[#8a9a8e] leading-relaxed mb-3">
            {strain.whyMatch}
          </p>
        )}

        {/* Quick stats row */}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-[#6a7a6e] mb-3">
          <span>
            THC <strong className="text-gray-700 dark:text-[#b0c4b4]">{strain.thc}%</strong>
          </span>
          <span>
            CBD <strong className="text-gray-700 dark:text-[#b0c4b4]">{strain.cbd}%</strong>
          </span>
          {Number(strain.sentimentScore) > 0 && (
            <span className="flex items-center gap-1">
              <Star size={12} className="text-amber-400" />
              <strong className="text-gray-700 dark:text-[#b0c4b4]">
                {Number(strain.sentimentScore).toFixed(1)}
              </strong>
            </span>
          )}
          {strain.forumAnalysis && (
            <ConfidenceBadge reviewCount={strain.forumAnalysis.totalReviews} />
          )}
        </div>

        {/* Effects */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {strain.effects?.slice(0, 5).map((eff) => (
            <EffectBadge key={eff} effect={eff} variant="positive" />
          ))}
        </div>

        {/* Terpenes bar */}
        <div className="space-y-1">
          {strain.terpenes?.slice(0, 3).map((t) => (
            <ProgressBar
              key={t.name}
              label={t.name}
              value={parseFloat(t.pct) || 0}
              max={2}
              color={getTerpeneColor(t.name)}
              height={4}
            />
          ))}
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-2.5 text-xs font-medium text-gray-400 dark:text-[#5a6a5e] hover:text-leaf-500 dark:hover:text-leaf-400 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/[0.04] transition-colors"
      >
        {expanded ? (
          <>
            Less <ChevronUp size={14} />
          </>
        ) : (
          <>
            Details <ChevronDown size={14} />
          </>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-white/[0.04] animate-fade-in-fast">
          {/* Cannabinoid profile */}
          {strain.cannabinoids && strain.cannabinoids.length > 0 && (
            <div className="pt-3">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wider mb-2">
                Cannabinoid Profile
              </h4>
              <div className="space-y-1">
                {strain.cannabinoids.map((c) => (
                  <ProgressBar
                    key={c.name}
                    label={c.name}
                    value={c.value}
                    max={c.name === 'THC' ? 35 : 15}
                    color={c.color}
                    height={4}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sommelier notes */}
          {strain.sommelierNotes && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wider mb-2">
                Sommelier Notes
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(strain.sommelierNotes).map(([key, val]) => (
                  <div
                    key={key}
                    className="p-2 rounded-lg bg-gray-50 dark:bg-white/[0.03]"
                  >
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] mb-0.5">
                      {key}
                    </span>
                    <span className="text-gray-700 dark:text-[#a0b4a6] leading-snug block">
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Forum analysis */}
          {strain.forumAnalysis && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wider mb-2 flex items-center gap-1">
                <MessageSquare size={12} /> Community Reports
              </h4>
              <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mb-2">
                Based on {strain.forumAnalysis.totalReviews} reviews ({strain.forumAnalysis.sources})
              </p>

              {/* Pros */}
              {strain.forumAnalysis.pros?.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-leaf-400 flex items-center gap-1 mb-1">
                    <ThumbsUp size={10} /> Positive Reports
                  </span>
                  <div className="space-y-1">
                    {strain.forumAnalysis.pros.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-24 text-gray-600 dark:text-[#8a9a8e] truncate">
                          {p.effect}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-leaf-500/60"
                            style={{ width: `${p.pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 dark:text-[#6a7a6e] w-8 text-right">
                          {p.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cons */}
              {strain.forumAnalysis.cons?.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-red-400 flex items-center gap-1 mb-1">
                    <ThumbsDown size={10} /> Negative Reports
                  </span>
                  <div className="space-y-1">
                    {strain.forumAnalysis.cons.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-24 text-gray-600 dark:text-[#8a9a8e] truncate">
                          {c.effect}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-red-500/50"
                            style={{ width: `${c.pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 dark:text-[#6a7a6e] w-8 text-right">
                          {c.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Best for / Not ideal for */}
          <div className="flex flex-wrap gap-4 text-xs">
            {strain.bestFor?.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-leaf-400 block mb-1">
                  Best For
                </span>
                <div className="flex flex-wrap gap-1">
                  {strain.bestFor.map((b) => (
                    <span
                      key={b}
                      className="px-2 py-0.5 rounded-md bg-leaf-500/10 text-leaf-400 border border-leaf-500/20"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {strain.notIdealFor?.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-400 block mb-1">
                  Not Ideal For
                </span>
                <div className="flex flex-wrap gap-1">
                  {strain.notIdealFor.map((n) => (
                    <span
                      key={n}
                      className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  AiPicksSection (inline)                                           */
/* ------------------------------------------------------------------ */
function AiPicksSection({ picks }) {
  if (!picks || picks.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-amber-400" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4] uppercase tracking-wider">
          Hidden Gems
        </h2>
        <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
          AI-curated surprises
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {picks.map((pick) => {
          const tc = getTypeColor(pick.type)
          return (
            <Card key={pick.name} className="p-4 relative overflow-hidden">
              {/* Accent bar */}
              <div
                className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: `linear-gradient(90deg, ${tc.hex}, ${tc.hex}66)` }}
              />

              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea]">
                      {pick.name}
                    </h3>
                    <TypeBadge type={pick.type} />
                  </div>
                  {pick.genetics && (
                    <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                      {pick.genetics}
                    </p>
                  )}
                </div>
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-xs font-bold border"
                  style={{
                    backgroundColor: `${tc.hex}15`,
                    borderColor: `${tc.hex}30`,
                    color: tc.hex,
                  }}
                >
                  {pick.matchPct}%
                </div>
              </div>

              {/* Reason */}
              {pick.reason && (
                <p className="text-xs text-gray-600 dark:text-[#8a9a8e] leading-relaxed mb-2 italic">
                  {pick.reason}
                </p>
              )}
              {pick.whyMatch && !pick.reason && (
                <p className="text-xs text-gray-600 dark:text-[#8a9a8e] leading-relaxed mb-2">
                  {pick.whyMatch}
                </p>
              )}

              {/* Quick stats */}
              <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                <span>THC {pick.thc}%</span>
                <span>CBD {pick.cbd}%</span>
                {Number(pick.sentimentScore) > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star size={10} className="text-amber-400" />
                    {Number(pick.sentimentScore).toFixed(1)}
                  </span>
                )}
              </div>

              {/* Effects */}
              {pick.effects?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {pick.effects.slice(0, 4).map((eff) => (
                    <EffectBadge key={eff} effect={eff} variant="neutral" />
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ResultsPage                                                       */
/* ------------------------------------------------------------------ */
export default function ResultsPage() {
  const navigate = useNavigate()
  const { state, dispatch, getSortedStrains } = useContext(ResultsContext)
  const { toggleFavorite, isFavorite } = useFavorites()

  const sortedStrains = useMemo(() => getSortedStrains(), [getSortedStrains])

  /* Empty state */
  if (!state.strains || state.strains.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center mb-4">
          <span className="text-3xl select-none">{'\u{1F50D}'}</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">
          No results yet
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e] text-center max-w-xs mb-6">
          Take the quiz to find your perfect strains, tailored to your needs.
        </p>
        <Button onClick={() => navigate('/')}>
          Take the Quiz
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Your Matches
          </h1>
          <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-0.5">
            {state.strains.length} strains matched &middot; {state.aiPicks?.length || 0} hidden gems
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            dispatch({ type: 'RESET' })
            navigate('/')
          }}
        >
          <RotateCcw size={14} />
          Start Over
        </Button>
      </div>

      {/* AI Picks */}
      <AiPicksSection picks={state.aiPicks} />

      {/* Section label */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-gray-200 dark:bg-white/[0.06]" />
        <span className="text-xs font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wider whitespace-nowrap">
          For You &mdash; Personalized Matches
        </span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-white/[0.06]" />
      </div>

      {/* Sort & Filter */}
      <SortControls
        sortBy={state.sortBy}
        filterType={state.filterType}
        onSort={(val) => dispatch({ type: 'SET_SORT', payload: val })}
        onFilter={(val) => dispatch({ type: 'SET_FILTER', payload: val })}
      />

      {/* Strain list */}
      <div className="space-y-4 mb-8">
        {sortedStrains.map((strain) => (
          <StrainCard
            key={strain.name}
            strain={strain}
            isFavorite={isFavorite(strain.name)}
            onToggleFavorite={toggleFavorite}
          />
        ))}
      </div>

      {sortedStrains.length === 0 && state.strains.length > 0 && (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-[#5a6a5e]">
          No strains match the current filter. Try a different type.
        </div>
      )}

      {/* Dispensary CTA */}
      <div className="text-center pb-4">
        <Button
          size="lg"
          className="shadow-lg shadow-leaf-500/20"
          onClick={() => navigate('/dispensaries')}
        >
          <MapPin size={16} />
          Find These Strains Nearby
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  )
}
