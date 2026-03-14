import { useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResultsContext } from '../context/ResultsContext'
import { useFavorites } from '../hooks/useFavorites'
// import { useDispensaryAvailability } from '../hooks/useDispensaryAvailability' // Silenced — feature not ready
import usePageTitle from '../hooks/usePageTitle'
import StrainCard from '../components/results/StrainCard'
import AiPicksSection from '../components/results/AiPicksSection'
// import DispensaryDrawer from '../components/dispensary/DispensaryDrawer' // Silenced — feature not ready
import LegalConsent from '../components/shared/LegalConsent'
import Button from '../components/shared/Button'
import { RotateCcw, Store, MapPin } from 'lucide-react'

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
    <LegalConsent>
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

      {/* Dispensary banner */}
      {state.selectedDispensary && (() => {
        const disp = state.selectedDispensary;
        const status = disp.menuStatus || 'notFound';
        const menuCount = Object.keys(disp.menuMatches || {}).length;
        const isMenuFound = status === 'found';
        const bannerBg = isMenuFound
          ? 'bg-leaf-500/[0.08] border-leaf-500/20'
          : 'bg-amber-500/[0.06] border-amber-500/20';
        const iconColor = isMenuFound ? 'text-leaf-400' : 'text-amber-400';

        return (
          <div className={`flex items-center gap-2.5 p-3 mb-4 rounded-xl border ${bannerBg}`}>
            <Store size={16} className={`${iconColor} flex-shrink-0`} />
            <div className="min-w-0 flex-1">
              {isMenuFound ? (
                <>
                  <p className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea] truncate">
                    Results from {disp.name} menu
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-[#6a7a6e] flex items-center gap-1">
                    <MapPin size={9} />
                    {disp.cityLabel}
                    {menuCount > 0 && (
                      <> &middot; {menuCount} of your matches on menu</>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea] truncate">
                    Menu not available for {disp.name}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-[#6a7a6e] flex items-center gap-1">
                    <MapPin size={9} />
                    {disp.cityLabel}
                    <> &middot; Showing best matches for your area</>
                  </p>
                </>
              )}
            </div>
          </div>
        );
      })()}

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
            isQuizResult
            aiAnalysis={state.aiAnalysis}
            userRegionIndex={state.userRegionIndex}
            dispensaryMatch={state.selectedDispensary?.menuMatches?.[strain.name] || null}
            dispensaryName={state.selectedDispensary?.menuStatus === 'found' ? state.selectedDispensary.name : null}
          />
        ))}
      </div>

      {/* AI Hidden Gems */}
      <AiPicksSection />

      {/* Legal disclaimer */}
      <div className="max-w-xl mx-auto px-2 pb-6">
        <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e] leading-relaxed text-center">
          <strong className="text-gray-500 dark:text-[#5a6a5e]">Disclaimer:</strong> These AI-generated suggestions are for informational and educational purposes only, based on community-reported data and publicly available information. They may contain inaccuracies. They do not constitute medical, legal, or professional advice. MyStrainAI does not sell or distribute cannabis. Individual experiences vary widely. Always consult a healthcare professional before using cannabis. Do not use cannabis if pregnant or nursing. Verify all product details with your licensed dispensary.
        </p>
      </div>

    </div>
    </LegalConsent>
  )
}
