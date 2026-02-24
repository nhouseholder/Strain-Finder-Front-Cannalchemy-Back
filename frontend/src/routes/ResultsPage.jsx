import { useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResultsContext } from '../context/ResultsContext'
import { useFavorites } from '../hooks/useFavorites'
import usePageTitle from '../hooks/usePageTitle'
import StrainCard from '../components/results/StrainCard'
import AiPicksSection from '../components/results/AiPicksSection'
import Button from '../components/shared/Button'
import { MapPin, RotateCcw, ArrowRight } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  ResultsPage                                                       */
/* ------------------------------------------------------------------ */
export default function ResultsPage() {
  usePageTitle('Your Recommendations')
  const navigate = useNavigate()
  const { state, dispatch, getSortedStrains } = useContext(ResultsContext)
  const { toggleFavorite, isFavorite } = useFavorites()
  const [expandedStrain, setExpandedStrain] = useState(null)
  const hasAutoExpanded = useRef(false)

  const sortedStrains = useMemo(() => getSortedStrains(), [getSortedStrains])

  // Auto-expand the first card so users see the full analysis
  useEffect(() => {
    if (!hasAutoExpanded.current && sortedStrains.length > 0) {
      setExpandedStrain(sortedStrains[0].name)
      hasAutoExpanded.current = true
    }
  }, [sortedStrains])

  const handleToggle = useCallback((strainName) => {
    setExpandedStrain((prev) => (prev === strainName ? null : strainName))
  }, [])

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

      {/* All strain results */}
      <div className="space-y-3 mb-8">
        {sortedStrains.map((strain) => (
          <StrainCard
            key={strain.name}
            strain={strain}
            expanded={expandedStrain === strain.name}
            onToggle={() => handleToggle(strain.name)}
            isFavorite={isFavorite(strain.name)}
            onFavorite={toggleFavorite}
          />
        ))}
      </div>

      {/* AI Hidden Gems */}
      <AiPicksSection />

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

      {/* Legal disclaimer */}
      <div className="max-w-xl mx-auto px-2 pb-6">
        <p className="text-[9px] text-gray-400 dark:text-[#3a4a3e] leading-relaxed text-center">
          <strong className="text-gray-500 dark:text-[#5a6a5e]">Disclaimer:</strong> These results are for informational and educational purposes only, based on community-reported data. They do not constitute medical advice. Individual experiences vary. Always consult a healthcare professional before using cannabis. Verify all product details with your licensed dispensary.
        </p>
      </div>
    </div>
  )
}
