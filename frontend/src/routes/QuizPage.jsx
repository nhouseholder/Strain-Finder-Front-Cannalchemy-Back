import { useState, useCallback, useContext, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizState } from '../hooks/useQuizState'
import usePageTitle from '../hooks/usePageTitle'
import { ResultsContext } from '../context/ResultsContext'
import { UserContext } from '../context/UserContext'
import { getRecommendations } from '../services/api'
import { useAuth } from '../context/AuthContext'
import QuizShell from '../components/quiz/QuizShell'
import Button from '../components/shared/Button'

/* ------------------------------------------------------------------ */
/*  Loading-phase messages                                            */
/* ------------------------------------------------------------------ */
const LOADING_PHASES = [
  { text: 'Analyzing your preferences...', icon: '\u{1F9EC}', detail: 'Mapping desired effects to receptor pathways' },
  { text: 'Calculating terpene ratios...', icon: '\u{1F33F}', detail: 'Scoring 24,853 strains against your profile' },
  { text: 'Scoring molecular matches...', icon: '\u{1F52C}', detail: 'CB1, CB2, 5-HT1A & TRPV1 receptor analysis' },
  { text: 'Compiling your results...', icon: '\u2728', detail: 'Finding your top personalized matches' },
]

const MIN_DISPLAY_MS = 4200 // show animation for at least 4.2s

/* ------------------------------------------------------------------ */
/*  LoadingAnalysis (inline)                                          */
/* ------------------------------------------------------------------ */
function LoadingAnalysis({ phase, message, detail, timedOut, progress }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-in px-4">
      {/* Animated orb */}
      <div className="relative w-28 h-28">
        {/* Outer glow ring */}
        <div className="absolute -inset-4 rounded-full bg-leaf-500/8 blur-2xl animate-pulse" />
        {/* Rotating outer ring */}
        <div className="absolute inset-0 rounded-full border-[3px] border-leaf-500/15" />
        <div
          className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-leaf-500 border-r-leaf-400/40"
          style={{ animation: 'spin 1.4s linear infinite' }}
        />
        {/* Counter-rotating inner ring */}
        <div
          className="absolute inset-3 rounded-full border-[2px] border-transparent border-b-purple-400/50 border-l-purple-400/20"
          style={{ animation: 'spin 2.2s linear infinite reverse' }}
        />
        {/* Inner glow */}
        <div className="absolute inset-5 rounded-full bg-gradient-to-br from-leaf-500/10 to-purple-500/10" />
        {/* Phase icon (crossfade) */}
        <span
          key={phase}
          className="absolute inset-0 flex items-center justify-center text-3xl select-none"
          style={{ animation: 'fadeInUp 0.5s ease-out' }}
        >
          {LOADING_PHASES[phase]?.icon || '\u{1F33F}'}
        </span>
      </div>

      {/* Phase message with crossfade */}
      <div className="text-center space-y-2 max-w-sm min-h-[72px] flex flex-col items-center justify-center">
        <p
          key={`msg-${phase}`}
          className="text-lg font-semibold text-gray-800 dark:text-[#e0ece4]"
          style={{ animation: 'fadeInUp 0.45s ease-out' }}
        >
          {message}
        </p>
        <p
          key={`detail-${phase}`}
          className="text-xs text-gray-400 dark:text-[#6a7a6e]"
          style={{ animation: 'fadeInUp 0.5s ease-out 0.1s both' }}
        >
          {detail}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-56 sm:w-64">
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #32c864, #9350ff)',
            }}
          />
        </div>
        {/* Step indicators below bar */}
        <div className="flex justify-between mt-2">
          {LOADING_PHASES.map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  i <= phase
                    ? 'bg-leaf-500 scale-110 shadow-sm shadow-leaf-500/50'
                    : 'bg-gray-300 dark:bg-white/10 scale-75'
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-gray-400 dark:text-[#5a6a5e] mt-2">
        {timedOut
          ? 'Still working — almost there...'
          : 'Powered by receptor pharmacology'}
      </p>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  QuizPage                                                          */
/* ------------------------------------------------------------------ */
export default function QuizPage() {
  usePageTitle('Find My Strain')
  const navigate = useNavigate()
  const { user } = useAuth()
  const quizState = useQuizState()
  const { currentStep, setStep, reset } = quizState
  const { dispatch: resultsDispatch } = useContext(ResultsContext)
  const { state: userState, dispatch: userDispatch } = useContext(UserContext)

  const [loadingPhase, setLoadingPhase] = useState(0)
  const [loadingMsg, setLoadingMsg] = useState(LOADING_PHASES[0].text)
  const [loadingDetail, setLoadingDetail] = useState(LOADING_PHASES[0].detail)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const phaseInterval = useRef(null)
  const timeoutRef = useRef(null)
  const pendingResult = useRef(null)
  const startTimeRef = useRef(null)

  /* Advance loading messages ---------------------------------------- */
  useEffect(() => {
    if (currentStep !== 6 || !isRunning) return

    // Immediately show first phase
    setLoadingProgress(8)

    const PHASE_INTERVAL = 1000 // 1s per phase for snappy feel
    phaseInterval.current = setInterval(() => {
      setLoadingPhase((prev) => {
        const next = Math.min(prev + 1, LOADING_PHASES.length - 1)
        setLoadingMsg(LOADING_PHASES[next].text)
        setLoadingDetail(LOADING_PHASES[next].detail)
        // Progress: 8% → 30% → 55% → 80% (last 20% on navigate)
        setLoadingProgress([8, 30, 55, 80][next] || 80)
        return next
      })
    }, PHASE_INTERVAL)

    return () => clearInterval(phaseInterval.current)
  }, [currentStep, isRunning])

  /* Run analysis ---------------------------------------------------- */
  const runAnalysis = useCallback(async () => {
    setIsRunning(true)
    setError(null)
    setTimedOut(false)
    setLoadingPhase(0)
    setLoadingMsg(LOADING_PHASES[0].text)
    setLoadingDetail(LOADING_PHASES[0].detail)
    setLoadingProgress(0)
    setStep(6)
    resultsDispatch({ type: 'SET_LOADING' })
    startTimeRef.current = Date.now()
    pendingResult.current = null

    // Timeout: show "still working" after 45s
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setTimedOut(true), 45000)

    try {
      // Call MyStrainAI backend — scores 24,853 strains with receptor science
      const parsed = await getRecommendations(quizState)

      // Dispatch results immediately (stored in state)
      resultsDispatch({ type: 'SET_RESULTS', payload: parsed })

      // Save recent search
      userDispatch({
        type: 'ADD_RECENT_SEARCH',
        payload: {
          id: `search-${Date.now()}`,
          effects: quizState.effects,
          tolerance: quizState.tolerance,
          consumptionMethod: quizState.consumptionMethod,
          budget: quizState.budget,
          date: new Date().toISOString(),
          resultCount: (parsed.strains || []).length,
        },
      })

      // Enforce minimum display time so animation plays through
      const elapsed = Date.now() - startTimeRef.current
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)

      if (remaining > 0) {
        // Fill progress to 100% then navigate
        setLoadingPhase(LOADING_PHASES.length - 1)
        setLoadingMsg(LOADING_PHASES[LOADING_PHASES.length - 1].text)
        setLoadingDetail(LOADING_PHASES[LOADING_PHASES.length - 1].detail)
        setLoadingProgress(95)
        await new Promise((r) => setTimeout(r, remaining))
      }

      setLoadingProgress(100)
      // Brief pause at 100% before navigating
      await new Promise((r) => setTimeout(r, 300))
      navigate('/results')
    } catch (err) {
      console.error('Analysis failed:', err)
      setError(err.message || 'Something went wrong. Please try again.')
      clearInterval(phaseInterval.current)
    } finally {
      setIsRunning(false)
      clearTimeout(timeoutRef.current)
      setTimedOut(false)
    }
  }, [quizState, resultsDispatch, userDispatch, navigate, setStep])

  /* Quiz completion handler ----------------------------------------- */
  const handleQuizComplete = useCallback(() => {
    runAnalysis()
  }, [runAnalysis])

  /* Retry ----------------------------------------------------------- */
  const handleRetry = useCallback(() => {
    setError(null)
    runAnalysis()
  }, [runAnalysis])

  /* Start over ------------------------------------------------------ */
  const handleStartOver = useCallback(() => {
    reset()
    resultsDispatch({ type: 'RESET' })
    setError(null)
    setStep(1) // Go directly to effects step (skip splash)
  }, [reset, resultsDispatch, setStep])

  /* ================================================================ */
  /*  Step 0 — Splash                                                 */
  /* ================================================================ */
  if (currentStep === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] px-6 animate-fade-in">
        {/* Hero leaf */}
        <div className="relative mb-8">
          <div className="absolute -inset-8 rounded-full bg-leaf-500/10 blur-2xl animate-pulse" />
          <span className="relative text-7xl sm:text-8xl select-none drop-shadow-lg block">
            {'\u{1F33F}'}
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-display font-bold text-center mb-4 leading-tight"
          style={{
            fontFamily: "'Playfair Display', serif",
            background: 'linear-gradient(135deg, #32c864 0%, #9350ff 50%, #32c864 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            backgroundSize: '200% 200%',
            animation: 'gradientShift 4s ease infinite',
          }}
        >
          Find My Strain
        </h1>

        {/* Tagline */}
        <p className="text-base sm:text-lg text-gray-500 dark:text-[#8a9a8e] text-center max-w-md mb-2 font-body leading-relaxed">
          AI-powered cannabis recommendations tailored to your unique needs, preferences, and wellness goals.
        </p>
        <p className="text-xs text-gray-400 dark:text-[#5a6a5e] text-center max-w-sm mb-10 font-body">
          Backed by terpene science, community data, and real user reviews.
        </p>

        {/* CTA */}
        <Button
          size="lg"
          className="text-base px-8 py-4 shadow-xl shadow-leaf-500/25 hover:shadow-leaf-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          onClick={() => setStep(1)}
        >
          Let's Find Your Perfect Strain &rarr;
        </Button>

        {/* Sub-links */}
        <div className="flex items-center gap-4 mt-8 text-xs text-gray-400 dark:text-[#6a7a6e]">
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="hover:text-leaf-500 transition-colors underline decoration-dotted underline-offset-4"
            >
              My Dashboard
            </button>
          ) : (
            <button
              onClick={() => navigate('/signup')}
              className="hover:text-leaf-500 transition-colors underline decoration-dotted underline-offset-4"
            >
              Create Account
            </button>
          )}
          <span className="text-gray-300 dark:text-[#6a7a6e]">&middot;</span>
          <button
            onClick={() => navigate('/learn')}
            className="hover:text-leaf-500 transition-colors underline decoration-dotted underline-offset-4"
          >
            Learn
          </button>
        </div>

        {/* Gradient keyframe (inline style tag) */}
        <style>{`
          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
        `}</style>
      </div>
    )
  }

  /* ================================================================ */
  /*  Step 6 — Loading / Error                                        */
  /* ================================================================ */
  if (currentStep === 6) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4">
        {error ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <span className="text-3xl select-none">{'\u{26A0}'}</span>
            </div>
            <div className="text-center space-y-2 max-w-md">
              <h2 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea]">
                Analysis Failed
              </h2>
              <p className="text-sm text-gray-500 dark:text-[#8a9a8e] leading-relaxed">
                {error}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={handleStartOver}>
                Start Over
              </Button>
              <Button onClick={handleRetry}>
                Try Again
              </Button>
            </div>
          </div>
        ) : (
          <LoadingAnalysis phase={loadingPhase} message={loadingMsg} detail={loadingDetail} timedOut={timedOut} progress={loadingProgress} />
        )}
      </div>
    )
  }

  /* ================================================================ */
  /*  Steps 1-5 — Quiz Shell                                          */
  /* ================================================================ */
  return <QuizShell onComplete={handleQuizComplete} />
}
