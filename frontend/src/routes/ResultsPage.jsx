import { useContext, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResultsContext } from '../context/ResultsContext'
import { useFavorites } from '../hooks/useFavorites'
import { useSubscription } from '../hooks/useSubscription'
import StrainCard from '../components/results/StrainCard'
import AiPicksSection from '../components/results/AiPicksSection'
import PaywallOverlay from '../components/shared/PaywallOverlay'
import Button from '../components/shared/Button'
import { MapPin, RotateCcw, ArrowRight } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  ResultsPage                                                       */
/* ------------------------------------------------------------------ */
export default function ResultsPage() {
  const navigate = useNavigate()
  const { state, dispatch, getSortedStrains } = useContext(ResultsContext)
  const { toggleFavorite, isFavorite } = useFavorites()
  const { canViewResult, isPremium } = useSubscription()
  const [expandedStrain, setExpandedStrain] = useState(null)

  const sortedStrains = useMemo(() => getSortedStrains(), [getSortedStrains])

  const handleToggle = useCallback((strainName, index) => {
    // Don't allow expanding paywalled cards
    if (!canViewResult(index)) return
    setExpandedStrain((prev) => (prev === strainName ? null : strainName))
  }, [canViewResult])

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
        <Button onClick={() => navigate('/quiz')}>
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
            {!isPremium && sortedStrains.length > 2 && (
              <span className="ml-1 text-amber-500">&middot; Upgrade for all results</span>
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

      {/* Strain list — uses full StrainCard → StrainCardExpanded */}
      <div className="space-y-3 mb-8">
        {sortedStrains.map((strain, index) => {
          const locked = !canViewResult(index)

          return (
            <div key={strain.name} className="relative">
              {/* Card — blurred if locked */}
              <div className={locked ? 'blur-sm pointer-events-none select-none' : ''}>
                <StrainCard
                  strain={strain}
                  expanded={!locked && expandedStrain === strain.name}
                  onToggle={() => handleToggle(strain.name, index)}
                  isFavorite={isFavorite(strain.name)}
                  onFavorite={toggleFavorite}
                />
              </div>

              {/* Paywall overlay on locked cards */}
              {locked && <PaywallOverlay />}
            </div>
          )
        })}
      </div>

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
