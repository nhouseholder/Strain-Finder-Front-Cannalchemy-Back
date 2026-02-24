import { useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResultsContext } from '../context/ResultsContext'
import { useFavorites } from '../hooks/useFavorites'
import { useSubscription } from '../hooks/useSubscription'
import usePageTitle from '../hooks/usePageTitle'
import StrainCard from '../components/results/StrainCard'
import AiPicksSection from '../components/results/AiPicksSection'
import Button from '../components/shared/Button'
import { MapPin, RotateCcw, ArrowRight, Lock, Sparkles, UserPlus } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  ResultsPage                                                       */
/* ------------------------------------------------------------------ */
export default function ResultsPage() {
  usePageTitle('Your Recommendations')
  const navigate = useNavigate()
  const { state, dispatch, getSortedStrains } = useContext(ResultsContext)
  const { toggleFavorite, isFavorite } = useFavorites()
  const { canViewResult, isPremium, isGuest, FREE_LIMIT } = useSubscription()
  const [expandedStrain, setExpandedStrain] = useState(null)
  const hasAutoExpanded = useRef(false)

  const sortedStrains = useMemo(() => getSortedStrains(), [getSortedStrains])

  // Auto-expand the first card for free/guest users so they see the full analysis
  useEffect(() => {
    if (!hasAutoExpanded.current && !isPremium && sortedStrains.length > 0) {
      setExpandedStrain(sortedStrains[0].name)
      hasAutoExpanded.current = true
    }
  }, [isPremium, sortedStrains])

  const handleToggle = useCallback((strainName, index) => {
    // Don't allow expanding paywalled cards
    if (!canViewResult(index)) return
    setExpandedStrain((prev) => (prev === strainName ? null : strainName))
  }, [canViewResult])

  /* No results — redirect to quiz */
  useEffect(() => {
    if (!state.strains || state.strains.length === 0) {
      navigate('/quiz', { replace: true })
    }
  }, [state.strains, navigate])

  if (!state.strains || state.strains.length === 0) {
    return null
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
            {!isPremium && sortedStrains.length > FREE_LIMIT && (
              <span className="ml-1 text-amber-500">&middot; Upgrade for all {sortedStrains.length} results</span>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            dispatch({ type: 'RESET' })
            navigate('/quiz')
          }}
        >
          <RotateCcw size={14} />
          Start Over
        </Button>
      </div>

      {/* Section label — Best Matches */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-gray-200 dark:bg-white/[0.06]" />
        <span className="text-xs font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wider whitespace-nowrap">
          Best Matches &mdash; Personalized For You
        </span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-white/[0.06]" />
      </div>

      {/* Free strain results */}
      <div className="space-y-3 mb-4">
        {sortedStrains.slice(0, FREE_LIMIT).map((strain, index) => (
          <StrainCard
            key={strain.name}
            strain={strain}
            expanded={expandedStrain === strain.name}
            onToggle={() => handleToggle(strain.name, index)}
            isFavorite={isFavorite(strain.name)}
            onFavorite={toggleFavorite}
          />
        ))}
      </div>

      {/* Upgrade banner — shown between free and locked results */}
      {!isPremium && sortedStrains.length > FREE_LIMIT && (
        <div className="relative mb-4 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.06] to-leaf-500/[0.06] p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Lock size={16} className="text-amber-500" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea]">
              {sortedStrains.length - FREE_LIMIT} more matches waiting
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-[#8a9a8e] mb-4 max-w-sm mx-auto">
            {isGuest
              ? 'Create a free account or go premium to unlock all your personalized strain recommendations.'
              : 'Upgrade to Premium to unlock all matches, full science data, journal, and more.'}
          </p>
          {isGuest ? (
            <div className="flex items-center justify-center gap-3">
              <Button size="sm" onClick={() => navigate('/signup', { state: { from: { pathname: '/results' } } })}>
                <UserPlus size={14} />
                Sign Up Free
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login', { state: { from: { pathname: '/results' } } })}>
                Log In
              </Button>
            </div>
          ) : (
            <Button size="sm" className="shadow-lg shadow-leaf-500/25" onClick={() => navigate('/#pricing')}>
              <Sparkles size={14} />
              Upgrade for $9.99/mo
            </Button>
          )}
        </div>
      )}

      {/* Locked strain results — blurred preview */}
      {!isPremium && sortedStrains.length > FREE_LIMIT && (
        <div className="space-y-3 mb-8 relative">
          {sortedStrains.slice(FREE_LIMIT, FREE_LIMIT + 3).map((strain, i) => (
            <div key={strain.name} className="blur-sm pointer-events-none select-none opacity-50">
              <StrainCard
                strain={strain}
                expanded={false}
                onToggle={() => {}}
                isFavorite={false}
                onFavorite={() => {}}
              />
            </div>
          ))}
          {sortedStrains.length > FREE_LIMIT + 3 && (
            <p className="text-center text-xs text-gray-400 dark:text-[#5a6a5e] py-2">
              + {sortedStrains.length - FREE_LIMIT - 3} more locked results
            </p>
          )}
        </div>
      )}

      {/* Premium users see all results */}
      {isPremium && sortedStrains.length > FREE_LIMIT && (
        <div className="space-y-3 mb-8">
          {sortedStrains.slice(FREE_LIMIT).map((strain, i) => (
            <StrainCard
              key={strain.name}
              strain={strain}
              expanded={expandedStrain === strain.name}
              onToggle={() => handleToggle(strain.name, i + FREE_LIMIT)}
              isFavorite={isFavorite(strain.name)}
              onFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}

      {/* AI Hidden Gems — only for premium */}
      {isPremium && <AiPicksSection />}

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
