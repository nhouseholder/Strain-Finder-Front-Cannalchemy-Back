import { useContext, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { ResultsContext } from '../context/ResultsContext'
import { useAuth } from '../context/AuthContext'
import { useRatings } from '../hooks/useRatings'
import { EFFECTS } from '../data/effects'
import usePageTitle from '../hooks/usePageTitle'
import {
  Search,
  GitCompareArrows,
  Star,
  Clock,
  TrendingUp,
  Heart,
  Plus,
  ArrowRight,
  BookOpen,
  RotateCcw,
  CreditCard,
  Crown,
  ExternalLink,
  Brain,
} from 'lucide-react'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import PreferenceProfileCard from '../components/ratings/PreferenceProfileCard'
import MyRatings from '../components/ratings/MyRatings'
import AiSuggestions from '../components/ratings/AiSuggestions'

/* ------------------------------------------------------------------ */
/*  DashboardPage                                                     */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  usePageTitle('Dashboard')
  const navigate = useNavigate()
  const { state: userState, dispatch: userDispatch, getJournalStats } = useContext(UserContext)
  const { dispatch: resultsDispatch, hasResults } = useContext(ResultsContext)
  const { isPremium, profile } = useAuth()
  const { ratings, preferenceProfile, removeRating, syncing, totalRatings } = useRatings()
  const [portalLoading, setPortalLoading] = useState(false)
  const [showAllRatings, setShowAllRatings] = useState(false)

  const { favorites, journal, recentSearches } = userState
  const stats = useMemo(() => getJournalStats(), [getJournalStats])

  const isFirstVisit =
    favorites.length === 0 && journal.length === 0 && recentSearches.length === 0 && totalRatings === 0

  /* Format effect IDs to labels ------------------------------------ */
  const effectLabel = (id) => EFFECTS.find((e) => e.id === id)?.label || id

  /* Format date ----------------------------------------------------- */
  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return ''
    }
  }

  /* Re-run a recent search ------------------------------------------ */
  const handleRerun = (search) => {
    // We just navigate to quiz; the search is stored for reference
    navigate('/quiz')
  }

  /* ================================================================ */
  /*  First-visit welcome state                                       */
  /* ================================================================ */
  if (isFirstVisit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 animate-fade-in">
        {/* Hero */}
        <div className="relative mb-8">
          <div className="absolute -inset-8 rounded-full bg-leaf-500/10 blur-2xl animate-pulse" />
          <span className="relative text-6xl select-none">{'\u{1F33F}'}</span>
        </div>

        <h1
          className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-[#e8f0ea] text-center mb-3"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Welcome to MyStrainAI
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e] text-center max-w-md mb-8 leading-relaxed">
          Your personalized cannabis dashboard. Take the quiz to get started with AI-powered
          recommendations, then save favorites, log your experiences, and track what works best for you.
        </p>

        {hasResults ? (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              size="lg"
              className="shadow-xl shadow-leaf-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
              onClick={() => navigate('/results')}
            >
              <Star size={18} />
              View My Results
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => { resultsDispatch({ type: 'RESET' }); navigate('/quiz') }}
            >
              <RotateCcw size={16} />
              New Search
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            className="shadow-xl shadow-leaf-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
            onClick={() => navigate('/quiz')}
          >
            <Search size={18} />
            Find My Strain
          </Button>
        )}

        <div className="flex items-center gap-4 mt-6 text-xs text-gray-400 dark:text-[#6a7a6e]">
          <Link
            to="/learn"
            className="hover:text-leaf-500 transition-colors flex items-center gap-1"
          >
            <BookOpen size={12} />
            Learn About Cannabis
          </Link>
          <Link
            to="/compare"
            className="hover:text-leaf-500 transition-colors flex items-center gap-1"
          >
            <GitCompareArrows size={12} />
            Compare Strains
          </Link>
        </div>
      </div>
    )
  }

  /* ================================================================ */
  /*  Returning user dashboard                                        */
  /* ================================================================ */
  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-4 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea]"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Dashboard
        </h1>
        <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-0.5">
          Your cannabis journey at a glance
        </p>
      </div>

      {/* View Results banner — shown when user has existing results */}
      {hasResults && (
        <Card
          hoverable
          onClick={() => navigate('/results')}
          className="p-4 mb-4 border-leaf-500/20 bg-leaf-500/[0.04]"
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

      {/* Quick Actions ------------------------------------------------ */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Card
          hoverable
          onClick={() => { resultsDispatch({ type: 'RESET' }); navigate('/quiz') }}
          className="p-4 text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-leaf-500/10 flex items-center justify-center mx-auto mb-2">
            <Search size={18} className="text-leaf-500" />
          </div>
          <span className="text-xs font-medium text-gray-700 dark:text-[#b0c4b4]">
            New Search
          </span>
        </Card>

        <Card
          hoverable
          onClick={() => navigate('/journal')}
          className="p-4 text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-2">
            <Plus size={18} className="text-purple-400" />
          </div>
          <span className="text-xs font-medium text-gray-700 dark:text-[#b0c4b4]">
            Journal Entry
          </span>
        </Card>

        <Card
          hoverable
          onClick={() => navigate('/compare')}
          className="p-4 text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
            <GitCompareArrows size={18} className="text-blue-400" />
          </div>
          <span className="text-xs font-medium text-gray-700 dark:text-[#b0c4b4]">
            Compare
          </span>
        </Card>
      </div>

      {/* Journal Stats (if 3+ entries) -------------------------------- */}
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
            {/* Avg rating */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] block mb-1">
                Avg Rating
              </span>
              <div className="flex items-center gap-1">
                <Star size={14} className="text-amber-400 fill-amber-400" />
                <span className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea]">
                  {stats.avgRating.toFixed(1)}
                </span>
                <span className="text-xs text-gray-400 dark:text-[#5a6a5e]">/5</span>
              </div>
            </div>

            {/* Top effects */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] col-span-1 sm:col-span-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] block mb-1">
                Top Effects
              </span>
              <div className="flex flex-wrap gap-1">
                {stats.topEffects.slice(0, 4).map((e) => (
                  <span
                    key={e.effect}
                    className="px-2 py-0.5 rounded-md text-[10px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20"
                  >
                    {e.effect} ({e.count})
                  </span>
                ))}
              </div>
            </div>

            {/* Preferred type */}
            {stats.typeCounts && Object.keys(stats.typeCounts).length > 0 && (
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] col-span-2 sm:col-span-3">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] block mb-1">
                  Type Preference
                </span>
                <div className="flex items-center gap-3">
                  {Object.entries(stats.typeCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center gap-1.5 text-xs">
                        <span className="capitalize text-gray-700 dark:text-[#b0c4b4] font-medium">
                          {type}
                        </span>
                        <span className="text-gray-400 dark:text-[#5a6a5e]">
                          {count}x
                        </span>
                        {stats.avgByType[type] != null && (
                          <span className="flex items-center gap-0.5 text-amber-400">
                            <Star size={10} className="fill-amber-400" />
                            {stats.avgByType[type].toFixed(1)}
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

      {/* Taste Profile ------------------------------------------------ */}
      {(totalRatings > 0 || preferenceProfile) && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4] flex items-center gap-2">
              <Brain size={14} className="text-leaf-500" />
              Your Taste Profile
              {syncing && (
                <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] italic">
                  syncing...
                </span>
              )}
            </h2>
            {totalRatings > 0 && (
              <div className="flex items-center gap-2">
                <Link
                  to="/preferences"
                  className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors font-medium"
                >
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

          {showAllRatings && (
            <div className="mt-4">
              <MyRatings ratings={ratings} onDelete={removeRating} />
            </div>
          )}

          {totalRatings >= 2 && (
            <div className="mt-4">
              <AiSuggestions ratings={ratings} preferenceProfile={preferenceProfile} />
            </div>
          )}
        </div>
      )}

      {/* Saved Strains ------------------------------------------------ */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4] flex items-center gap-2">
            <Heart size={14} className="text-red-400" />
            Saved Strains
          </h2>
          {favorites.length > 0 && (
            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
              {favorites.length} saved
            </span>
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
                <span className="text-sm font-medium text-gray-900 dark:text-[#e8f0ea] truncate">
                  {name}
                </span>
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

      {/* Recent Searches ---------------------------------------------- */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4] flex items-center gap-2">
            <Clock size={14} className="text-blue-400" />
            Recent Searches
          </h2>
          {recentSearches.length > 0 && (
            <button
              onClick={() => userDispatch({ type: 'CLEAR_RECENT' })}
              className="text-[10px] text-gray-400 dark:text-[#5a6a5e] hover:text-red-400 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        {recentSearches.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-gray-400 dark:text-[#5a6a5e]">
              No recent searches. Take the quiz to start finding your perfect strains.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentSearches.slice(0, 5).map((search) => (
              <Card key={search.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {(search.effects || []).slice(0, 3).map((eff) => (
                        <span
                          key={eff}
                          className="px-1.5 py-0.5 rounded-md text-[10px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20"
                        >
                          {effectLabel(eff)}
                        </span>
                      ))}
                      {(search.effects || []).length > 3 && (
                        <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                          +{search.effects.length - 3}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                      <span>{formatDate(search.date)}</span>
                      {search.resultCount > 0 && (
                        <span>{search.resultCount} matches</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRerun(search)}
                  >
                    <RotateCcw size={12} />
                    Re-run
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Subscription Management --------------------------------------- */}
      {isPremium && profile?.stripe_customer_id && (
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown size={16} className="text-amber-400" />
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4]">
                  Premium Member
                </h2>
                <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                  Full access to all strain results
                </p>
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
                  if (data.url) {
                    window.location.href = data.url
                  } else {
                    console.error('Portal error:', data.error)
                  }
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

      {/* Browse link -------------------------------------------------- */}
      <div className="text-center pb-4">
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 text-sm text-leaf-500 hover:text-leaf-400 transition-colors font-medium"
        >
          <BookOpen size={14} />
          Browse Cannabis Education
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
