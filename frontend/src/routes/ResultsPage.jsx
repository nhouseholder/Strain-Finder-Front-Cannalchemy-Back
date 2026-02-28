import { useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResultsContext } from '../context/ResultsContext'
import { QuizContext } from '../context/QuizContext'
import { useFavorites } from '../hooks/useFavorites'
import { useDispensaryAvailability } from '../hooks/useDispensaryAvailability'
import usePageTitle from '../hooks/usePageTitle'
import StrainCard from '../components/results/StrainCard'
import AiPicksSection from '../components/results/AiPicksSection'
import DispensaryDrawer from '../components/dispensary/DispensaryDrawer'
import LegalConsent from '../components/shared/LegalConsent'
import Button from '../components/shared/Button'
import { MapPin, RotateCcw, ArrowRight, Store, Loader2 } from 'lucide-react'
import { BUDGETS } from '../data/budgets'

/* ------------------------------------------------------------------ */
/*  ResultsPage                                                       */
/* ------------------------------------------------------------------ */
export default function ResultsPage() {
  usePageTitle('Your Recommendations')
  const navigate = useNavigate()
  const { state, dispatch, getSortedStrains } = useContext(ResultsContext)
  const quizCtx = useContext(QuizContext)
  const quizZipCode = quizCtx?.state?.zipCode || ''
  const quizBudget = quizCtx?.state?.budget || null
  const budgetDesc = BUDGETS.find((b) => b.id === quizBudget)?.desc || null

  const { toggleFavorite, isFavorite } = useFavorites()
  const {
    dispensaries,
    availability,
    loading: availLoading,
    hasData: hasAvailability,
    fetchIfNeeded,
    getStrainAvailability,
  } = useDispensaryAvailability()

  const [expandedStrain, setExpandedStrain] = useState(null)
  const hasAutoExpanded = useRef(false)

  // Dispensary drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerDispensary, setDrawerDispensary] = useState(null)
  const [drawerHighlightStrain, setDrawerHighlightStrain] = useState(null)

  const sortedStrains = useMemo(() => getSortedStrains(), [getSortedStrains])
  const strainNames = useMemo(
    () => sortedStrains.map((s) => s.name),
    [sortedStrains]
  )

  // Auto-expand the first card so users see the full analysis
  useEffect(() => {
    if (!hasAutoExpanded.current && sortedStrains.length > 0) {
      setExpandedStrain(sortedStrains[0].name)
      hasAutoExpanded.current = true
    }
  }, [sortedStrains])

  // Auto-fetch availability when zip + strains exist
  useEffect(() => {
    if (quizZipCode && strainNames.length > 0) {
      fetchIfNeeded(quizZipCode, strainNames, budgetDesc)
    }
  }, [quizZipCode, strainNames, budgetDesc, fetchIfNeeded])

  const handleToggle = useCallback((strainName) => {
    setExpandedStrain((prev) => (prev === strainName ? null : strainName))
  }, [])

  // Open dispensary drawer for a strain
  const handleViewDispensary = useCallback((strainName, spots) => {
    if (!spots?.length) return
    const bestSpot = spots[0]
    const fullDispensary = dispensaries.find((d) => d.id === bestSpot.dispensaryId || d.name === bestSpot.dispensaryName)
    if (fullDispensary) {
      setDrawerDispensary(fullDispensary)
      setDrawerHighlightStrain(strainName)
      setDrawerOpen(true)
    }
  }, [dispensaries])

  // Count strains available nearby
  const availableCount = useMemo(() => {
    if (!hasAvailability) return 0
    return strainNames.filter((name) => (availability[name] || []).length > 0).length
  }, [strainNames, availability, hasAvailability])

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

      {/* Availability summary bar */}
      {quizZipCode && (
        <div className="mb-4 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/[0.06] to-leaf-500/[0.06] border border-emerald-500/15 dark:border-emerald-500/10">
          {availLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#6a7a6e]">
              <Loader2 size={13} className="animate-spin text-emerald-500" />
              <span>Checking dispensaries near <strong className="text-gray-600 dark:text-[#8a9a8e]">{quizZipCode}</strong>...</span>
            </div>
          ) : hasAvailability ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <Store size={13} className="text-emerald-500" />
                <span className="text-gray-600 dark:text-[#8a9a8e]">
                  <strong className="text-emerald-500">{availableCount} of {strainNames.length}</strong> strains found at dispensaries near <strong className="text-gray-700 dark:text-[#b0c4b4]">{quizZipCode}</strong>
                </span>
              </div>
              <button
                onClick={() => navigate('/dispensaries')}
                className="text-[10px] font-semibold text-leaf-500 hover:text-leaf-400 transition-colors whitespace-nowrap"
              >
                View All →
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#6a7a6e]">
              <MapPin size={13} className="text-gray-400" />
              <span>Enter your zip code in the quiz to check local availability</span>
            </div>
          )}
        </div>
      )}

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
            availability={getStrainAvailability(strain.name)}
            availabilityLoading={availLoading}
            onViewDispensary={handleViewDispensary}
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
          {hasAvailability
            ? `${availableCount} Strains Available Nearby — View Dispensaries`
            : 'Find These Strains Nearby'}
          <ArrowRight size={16} />
        </Button>
      </div>

      {/* Legal disclaimer */}
      <div className="max-w-xl mx-auto px-2 pb-6">
        <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e] leading-relaxed text-center">
          <strong className="text-gray-500 dark:text-[#5a6a5e]">Disclaimer:</strong> These AI-generated suggestions are for informational and educational purposes only, based on community-reported data and publicly available information. They may contain inaccuracies. They do not constitute medical, legal, or professional advice. MyStrainAI does not sell or distribute cannabis. Individual experiences vary widely. Always consult a healthcare professional before using cannabis. Do not use cannabis if pregnant or nursing. Verify all product details with your licensed dispensary.
        </p>
      </div>

      {/* Dispensary Drawer */}
      <DispensaryDrawer
        dispensary={drawerDispensary}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setDrawerDispensary(null) }}
        highlightStrain={drawerHighlightStrain}
      />
    </div>
    </LegalConsent>
  )
}
