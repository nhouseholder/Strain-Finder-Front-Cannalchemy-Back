import { useContext, useMemo, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { ResultsContext } from '../context/ResultsContext'
import { QuizContext } from '../context/QuizContext'
import { useAuth } from '../context/AuthContext'
import { useRatings } from '../hooks/useRatings'
import { useQuizHistory } from '../hooks/useQuizHistory'
import { useSearchHistory } from '../hooks/useSearchHistory'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { EFFECTS } from '../data/effects'
import usePageTitle from '../hooks/usePageTitle'
import {
  Search,
  GitCompareArrows,
  Star,
  Clock,
  TrendingUp,
  Heart,
  ArrowRight,
  BookOpen,
  RotateCcw,
  CreditCard,
  Crown,
  ExternalLink,
  Brain,
  Sparkles,
  Dna,
  Stethoscope,
  Database,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Trash2,
  FlaskConical,
} from 'lucide-react'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import SearchAutocomplete from '../components/shared/SearchAutocomplete'
import PreferenceProfileCard from '../components/ratings/PreferenceProfileCard'
import MyRatings from '../components/ratings/MyRatings'
import AiSuggestions from '../components/ratings/AiSuggestions'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const effectLabel = (id) => EFFECTS.find((e) => e.id === id)?.label || id

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function formatDateShort(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

/* ------------------------------------------------------------------ */
/*  Inline strain search bar (same as landing page)                   */
/* ------------------------------------------------------------------ */
function DashboardSearchBar() {
  const navigate = useNavigate()
  const { allStrains, dataLoaded } = useStrainSearch()

  return (
    <div className="w-full max-w-md mx-auto relative z-50">
      <SearchAutocomplete
        strains={allStrains}
        dataLoaded={dataLoaded}
        placeholder="Search any strain by name..."
        showSearchButton
        onSelect={(strain) => navigate(`/search?q=${encodeURIComponent(strain.name)}`)}
        onSearch={(q) => q && navigate(`/search?q=${encodeURIComponent(q)}`)}
        inputClassName="py-3.5 rounded-2xl pl-11 border-transparent dark:border-transparent bg-white/60 dark:bg-white/[0.05] backdrop-blur-md shadow-lg shadow-black/5 dark:shadow-black/20 focus:border-leaf-500/40"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Quiz History Card                                                 */
/* ------------------------------------------------------------------ */
function QuizHistoryEntry({ entry, onRerun, onDelete }) {
  const typeColor = {
    relaxation: 'text-purple-400', pain_relief: 'text-red-400', creativity: 'text-amber-400',
    energy: 'text-orange-400', sleep: 'text-indigo-400', anxiety_relief: 'text-blue-400',
    focus: 'text-green-400', euphoria: 'text-pink-400', social: 'text-yellow-400',
    appetite: 'text-rose-400',
  }

  return (
    <Card className="p-4 hover:border-leaf-500/20 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Effects pills */}
          <div className="flex flex-wrap gap-1 mb-2">
            {(entry.answers?.effects || []).slice(0, 4).map((eff) => (
              <span
                key={eff}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium bg-leaf-500/10 border border-leaf-500/20 ${typeColor[eff] || 'text-leaf-400'}`}
              >
                {effectLabel(eff)}
              </span>
            ))}
            {(entry.answers?.effects || []).length > 4 && (
              <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                +{entry.answers.effects.length - 4}
              </span>
            )}
          </div>

          {/* Top strains */}
          {entry.topStrains?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {entry.topStrains.slice(0, 3).map((s) => (
                <span key={s.name} className="text-[10px] text-gray-500 dark:text-[#8a9a8e]">
                  {s.name}{s.type ? ` (${s.type})` : ''}
                </span>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-[#5a6a5e]">
            <span>{formatDate(entry.date)}</span>
            {entry.resultCount > 0 && (
              <span>{entry.resultCount} matches</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onRerun(entry)}>
            <RotateCcw size={12} />
            Re-run
          </Button>
          <button
            onClick={() => onDelete(entry.id)}
            className="p-1.5 rounded-lg text-gray-400 dark:text-[#5a6a5e] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </Card>
  )
}

/* ================================================================== */
/*  DashboardPage                                                     */
/* ================================================================== */
export default function DashboardPage() {
  usePageTitle('Dashboard')
  const navigate = useNavigate()
  const { state: userState, dispatch: userDispatch, getJournalStats } = useContext(UserContext)
  const { dispatch: resultsDispatch, hasResults } = useContext(ResultsContext)
  const { dispatch: quizDispatch } = useContext(QuizContext)
  const { isPremium, profile, user } = useAuth()
  const { ratings, preferenceProfile, removeRating, syncing, totalRatings } = useRatings()
  const { quizHistory, deleteEntry: deleteQuiz, clearAll: clearQuizHistory } = useQuizHistory()
  const { searchHistory, deleteEntry: deleteSearch, clearAll: clearSearchHistory } = useSearchHistory()
  const [portalLoading, setPortalLoading] = useState(false)
  const [showAllRatings, setShowAllRatings] = useState(false)
  const [showQuizHistory, setShowQuizHistory] = useState(false)
  const [showSearchHistory, setShowSearchHistory] = useState(false)

  const { favorites } = userState
  const stats = useMemo(() => getJournalStats(), [getJournalStats])

  /* Re-run a quiz from history -------------------------------------- */
  const handleRerunQuiz = useCallback((entry) => {
    quizDispatch({ type: 'LOAD', payload: entry.answers })
    resultsDispatch({ type: 'RESET' })
    navigate('/quiz')
  }, [quizDispatch, resultsDispatch, navigate])

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <div className="w-full max-w-3xl mx-auto px-4 pt-6 pb-12 animate-fade-in">

      {/* ============================================================ */}
      {/*  Hero — Landing-page style with BG orbs                      */}
      {/* ============================================================ */}
      <section className="relative text-center mb-10">
        {/* Animated BG orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute w-[500px] h-[500px] rounded-full animate-float-a opacity-40" style={{ background: 'radial-gradient(circle, rgba(50,200,100,0.12) 0%, transparent 70%)', top: '-30%', left: '-20%' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full animate-float-b opacity-40" style={{ background: 'radial-gradient(circle, rgba(147,80,255,0.08) 0%, transparent 70%)', bottom: '-20%', right: '-15%' }} />
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            <Sparkles size={11} className="text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-400">AI-Powered</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
            <Stethoscope size={11} className="text-blue-400" />
            <span className="text-[10px] font-semibold text-blue-400">MD-Developed</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-leaf-500/10 border border-leaf-500/20">
            <Dna size={11} className="text-leaf-400" />
            <span className="text-[10px] font-semibold text-leaf-400">Receptor-Level Science</span>
          </div>
        </div>

        {/* Welcome heading */}
        <h1
          className="text-3xl sm:text-4xl font-extrabold mb-3 text-gray-900 dark:text-[#e8f0ea] leading-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {user?.displayName ? `Welcome back, ${user.displayName.split(' ')[0]}` : 'Your Dashboard'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e] mb-6 max-w-lg mx-auto leading-relaxed">
          Search strains, run a new quiz, or review your past results — all powered by molecular pharmacology and AI.
        </p>

        {/* Search bar */}
        <DashboardSearchBar />

        {/* Quick stats */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 mt-5 text-[11px] text-gray-400 dark:text-[#5a6a5e] flex-wrap">
          <span className="flex items-center gap-1.5"><Database size={12} /> 1,000+ Strains</span>
          <span className="flex items-center gap-1.5"><Brain size={12} /> 6 Receptor Pathways</span>
          <span className="flex items-center gap-1.5"><FlaskConical size={12} /> 51 Effects Predicted</span>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Quick Actions                                               */}
      {/* ============================================================ */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <button
          onClick={() => navigate('/search')}
          className="group relative flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl bg-gradient-to-br from-leaf-500/[0.08] to-leaf-500/[0.02] hover:from-leaf-500/[0.16] hover:to-leaf-500/[0.06] border border-leaf-500/15 hover:border-leaf-500/30 transition-all duration-300 cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-leaf-500/15 group-hover:bg-leaf-500/25 flex items-center justify-center transition-colors duration-300 group-hover:scale-105">
            <Search size={20} className="text-leaf-500" />
          </div>
          <span className="text-xs font-semibold text-gray-700 dark:text-[#c0d4c6] group-hover:text-leaf-500 dark:group-hover:text-leaf-400 transition-colors">
            Search Strains
          </span>
        </button>

        <button
          onClick={() => { resultsDispatch({ type: 'RESET' }); navigate('/quiz') }}
          className="group relative flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl bg-gradient-to-br from-purple-500/[0.08] to-purple-500/[0.02] hover:from-purple-500/[0.16] hover:to-purple-500/[0.06] border border-purple-500/15 hover:border-purple-500/30 transition-all duration-300 cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-purple-500/15 group-hover:bg-purple-500/25 flex items-center justify-center transition-colors duration-300 group-hover:scale-105">
            <ClipboardList size={20} className="text-purple-400" />
          </div>
          <span className="text-xs font-semibold text-gray-700 dark:text-[#c0d4c6] group-hover:text-purple-400 transition-colors">
            New Quiz
          </span>
        </button>

        <button
          onClick={() => navigate('/compare')}
          className="group relative flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl bg-gradient-to-br from-blue-500/[0.08] to-blue-500/[0.02] hover:from-blue-500/[0.16] hover:to-blue-500/[0.06] border border-blue-500/15 hover:border-blue-500/30 transition-all duration-300 cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-500/15 group-hover:bg-blue-500/25 flex items-center justify-center transition-colors duration-300 group-hover:scale-105">
            <GitCompareArrows size={20} className="text-blue-400" />
          </div>
          <span className="text-xs font-semibold text-gray-700 dark:text-[#c0d4c6] group-hover:text-blue-400 transition-colors">
            Compare
          </span>
        </button>
      </div>

      {/* View Results banner */}
      {hasResults && (
        <Card
          hoverable
          onClick={() => navigate('/results')}
          className="p-4 mb-6 border-leaf-500/20 bg-leaf-500/[0.04]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-leaf-500/15 flex items-center justify-center flex-shrink-0">
              <Star size={18} className="text-leaf-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea]">View My Results</p>
              <p className="text-[11px] text-gray-500 dark:text-[#6a7a6e]">Your latest strain matches are ready</p>
            </div>
            <ArrowRight size={16} className="text-leaf-500 flex-shrink-0" />
          </div>
        </Card>
      )}

      {/* ============================================================ */}
      {/*  Quiz History                                                */}
      {/* ============================================================ */}
      <div className="mb-6">
        <button
          onClick={() => setShowQuizHistory(!showQuizHistory)}
          className="w-full flex items-center justify-between mb-3 group"
        >
          <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4] flex items-center gap-2">
            <ClipboardList size={14} className="text-purple-400" />
            Previous Quizzes
            {quizHistory.length > 0 && (
              <span className="text-[10px] font-normal text-gray-400 dark:text-[#5a6a5e]">
                ({quizHistory.length})
              </span>
            )}
          </h2>
          {showQuizHistory ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>

        {showQuizHistory && (
          <>
            {quizHistory.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-gray-400 dark:text-[#5a6a5e]">
                  No quiz history yet. Complete a quiz to see your results here.
                </p>
                <Button size="sm" className="mt-3" onClick={() => navigate('/quiz')}>
                  <ClipboardList size={14} />
                  Take the Quiz
                </Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {quizHistory.slice(0, 10).map((entry) => (
                  <QuizHistoryEntry
                    key={entry.id}
                    entry={entry}
                    onRerun={handleRerunQuiz}
                    onDelete={deleteQuiz}
                  />
                ))}
                {quizHistory.length > 10 && (
                  <p className="text-center text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                    Showing 10 of {quizHistory.length} quizzes
                  </p>
                )}
                {quizHistory.length > 0 && (
                  <div className="text-right">
                    <button
                      onClick={clearQuizHistory}
                      className="text-[10px] text-gray-400 dark:text-[#5a6a5e] hover:text-red-400 transition-colors"
                    >
                      Clear All Quiz History
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Search History                                              */}
      {/* ============================================================ */}
      <div className="mb-6">
        <button
          onClick={() => setShowSearchHistory(!showSearchHistory)}
          className="w-full flex items-center justify-between mb-3 group"
        >
          <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4] flex items-center gap-2">
            <Clock size={14} className="text-blue-400" />
            Search History
            {searchHistory.length > 0 && (
              <span className="text-[10px] font-normal text-gray-400 dark:text-[#5a6a5e]">
                ({searchHistory.length})
              </span>
            )}
          </h2>
          {showSearchHistory ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>

        {showSearchHistory && (
          <>
            {searchHistory.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-gray-400 dark:text-[#5a6a5e]">
                  No search history yet. Search for strains to build your history.
                </p>
                <Button size="sm" className="mt-3" onClick={() => navigate('/search')}>
                  <Search size={14} />
                  Search Strains
                </Button>
              </Card>
            ) : (
              <div className="space-y-1.5">
                {searchHistory.slice(0, 20).map((entry) => {
                  const typeColor = entry.strainType === 'sativa' ? 'text-orange-400' : entry.strainType === 'indica' ? 'text-purple-400' : entry.strainType === 'hybrid' ? 'text-leaf-400' : ''
                  return (
                    <Card key={entry.id} className="p-3 hover:border-leaf-500/20 transition-all">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Search size={12} className="text-gray-400 dark:text-[#5a6a5e] flex-shrink-0" />
                          <span className="text-sm text-gray-900 dark:text-[#e8f0ea] truncate font-medium">
                            {entry.strainName || entry.query}
                          </span>
                          {entry.strainType && (
                            <span className={`text-[10px] font-medium uppercase ${typeColor}`}>
                              {entry.strainType}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] flex-shrink-0">
                            {formatDateShort(entry.date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/search?q=${encodeURIComponent(entry.strainName || entry.query)}`)}
                          >
                            <ArrowRight size={12} />
                          </Button>
                          <button
                            onClick={() => deleteSearch(entry.id)}
                            className="p-1.5 rounded-lg text-gray-400 dark:text-[#5a6a5e] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            aria-label="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
                {searchHistory.length > 0 && (
                  <div className="text-right">
                    <button
                      onClick={clearSearchHistory}
                      className="text-[10px] text-gray-400 dark:text-[#5a6a5e] hover:text-red-400 transition-colors"
                    >
                      Clear Search History
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Journal Stats                                               */}
      {/* ============================================================ */}
      {stats && stats.totalEntries >= 3 && (
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-leaf-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4]">
              Your Patterns
            </h2>
            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
              Based on {stats.totalEntries} journal entries
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] block mb-1">Avg Rating</span>
              <div className="flex items-center gap-1">
                <Star size={14} className="text-amber-400 fill-amber-400" />
                <span className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea]">{stats.avgRating.toFixed(1)}</span>
                <span className="text-xs text-gray-400 dark:text-[#5a6a5e]">/5</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] col-span-1 sm:col-span-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] block mb-1">Top Effects</span>
              <div className="flex flex-wrap gap-1">
                {stats.topEffects.slice(0, 4).map((e) => (
                  <span key={e.effect} className="px-2 py-0.5 rounded-md text-[10px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20">
                    {e.effect} ({e.count})
                  </span>
                ))}
              </div>
            </div>

            {stats.typeCounts && Object.keys(stats.typeCounts).length > 0 && (
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] col-span-2 sm:col-span-3">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] block mb-1">Type Preference</span>
                <div className="flex items-center gap-3">
                  {Object.entries(stats.typeCounts).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-1.5 text-xs">
                      <span className="capitalize text-gray-700 dark:text-[#b0c4b4] font-medium">{type}</span>
                      <span className="text-gray-400 dark:text-[#5a6a5e]">{count}x</span>
                      {stats.avgByType[type] != null && (
                        <span className="flex items-center gap-0.5 text-amber-400">
                          <Star size={10} className="fill-amber-400" />{stats.avgByType[type].toFixed(1)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ============================================================ */}
      {/*  Taste Profile                                               */}
      {/* ============================================================ */}
      {(totalRatings > 0 || preferenceProfile) && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4] flex items-center gap-2">
              <Brain size={14} className="text-leaf-500" />
              Your Taste Profile
              {syncing && (
                <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] italic">syncing...</span>
              )}
            </h2>
            {totalRatings > 0 && (
              <div className="flex items-center gap-2">
                <Link to="/preferences" className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors font-medium">
                  Full Profile →
                </Link>
                <button
                  onClick={() => setShowAllRatings(!showAllRatings)}
                  className="text-[10px] text-leaf-500 hover:text-leaf-400 transition-colors font-medium"
                >
                  {showAllRatings ? 'Hide Ratings' : `View All ${totalRatings} Ratings`}
                </button>
              </div>
            )}
          </div>
          <PreferenceProfileCard profile={preferenceProfile} />
          {showAllRatings && <div className="mt-4"><MyRatings ratings={ratings} onDelete={removeRating} /></div>}
          {totalRatings >= 2 && <div className="mt-4"><AiSuggestions ratings={ratings} preferenceProfile={preferenceProfile} /></div>}
        </div>
      )}

      {/* ============================================================ */}
      {/*  Saved Strains                                               */}
      {/* ============================================================ */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4] flex items-center gap-2">
            <Heart size={14} className="text-red-400" />
            Saved Strains
          </h2>
          {favorites.length > 0 && (
            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">{favorites.length} saved</span>
          )}
        </div>

        {favorites.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-gray-400 dark:text-[#5a6a5e]">
              No saved strains yet. Favorite strains from your results to see them here.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {favorites.map((name) => (
              <Card key={name} className="p-3 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-[#e8f0ea] truncate">{name}</span>
                <button
                  onClick={() => userDispatch({ type: 'TOGGLE_FAVORITE', payload: name })}
                  className="p-1 rounded-md hover:bg-red-500/10 text-gray-300 dark:text-[#6a7a6e] hover:text-red-400 transition-colors flex-shrink-0"
                  aria-label={`Remove ${name} from favorites`}
                >
                  <Heart size={14} className="fill-current" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Subscription Management                                     */}
      {/* ============================================================ */}
      {isPremium && profile?.stripe_customer_id && (
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown size={16} className="text-amber-400" />
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4]">Premium Member</h2>
                <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">Full access to all strain results</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={portalLoading}
              onClick={async () => {
                setPortalLoading(true)
                try {
                  const res = await fetch('/api/stripe-portal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      customerId: profile.stripe_customer_id,
                      returnUrl: window.location.href,
                    }),
                  })
                  const data = await res.json()
                  if (data.url) { window.location.href = data.url }
                  else { console.error('Portal error:', data.error) }
                } catch (err) {
                  console.error('Portal error:', err)
                } finally {
                  setPortalLoading(false)
                }
              }}
            >
              <CreditCard size={12} />
              {portalLoading ? 'Loading...' : 'Manage Subscription'}
              {!portalLoading && <ExternalLink size={10} />}
            </Button>
          </div>
        </Card>
      )}

      {/* ============================================================ */}
      {/*  Footer links                                                */}
      {/* ============================================================ */}
      <div className="text-center pb-4">
        <div className="flex items-center justify-center gap-4 text-sm">
          <Link
            to="/learn"
            className="inline-flex items-center gap-2 text-leaf-500 hover:text-leaf-400 transition-colors font-medium"
          >
            <BookOpen size={14} />
            Cannabis Education
          </Link>
          <Link
            to="/journal"
            className="inline-flex items-center gap-2 text-leaf-500 hover:text-leaf-400 transition-colors font-medium"
          >
            <TrendingUp size={14} />
            Journal
          </Link>
        </div>
      </div>
    </div>
  )
}
