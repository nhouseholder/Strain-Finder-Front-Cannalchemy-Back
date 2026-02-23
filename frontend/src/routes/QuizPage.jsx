import { useState, useCallback, useContext, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizState } from '../hooks/useQuizState'
import usePageTitle from '../hooks/usePageTitle'
import { ResultsContext } from '../context/ResultsContext'
import { UserContext } from '../context/UserContext'
import { getRecommendations } from '../services/api'
import QuizShell from '../components/quiz/QuizShell'
import Button from '../components/shared/Button'

/* ------------------------------------------------------------------ */
/*  Loading-phase messages                                            */
/* ------------------------------------------------------------------ */
const LOADING_PHASES = [
  'Analyzing your preferences...',
  'Calculating terpene ratios...',
  'Scoring strain matches...',
  'Compiling recommendations...',
]

/* ------------------------------------------------------------------ */
/*  LoadingAnalysis (inline)                                          */
/* ------------------------------------------------------------------ */
function LoadingAnalysis({ phase, message, timedOut }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-8 animate-fade-in px-4">
      {/* Spinner */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-[3px] border-leaf-500/20" />
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-leaf-500 animate-spin" />
        <div className="absolute inset-2 rounded-full border-[2px] border-transparent border-b-leaf-400/60 animate-spin-slow" />
        <span className="absolute inset-0 flex items-center justify-center text-2xl select-none">
          {'\u{1F33F}'}
        </span>
      </div>

      {/* Phase message */}
      <div className="text-center space-y-3 max-w-sm">
        <p
          key={message}
          className="text-base font-medium text-gray-700 dark:text-[#c0d4c6] animate-fade-in-fast"
        >
          {message}
        </p>
        <div className="flex justify-center gap-1.5">
          {LOADING_PHASES.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                i <= phase
                  ? 'bg-leaf-500 scale-100'
                  : 'bg-gray-300 dark:bg-white/10 scale-75'
              }`}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-[#5a6a5e]">
        {timedOut
          ? 'Still working — almost there...'
          : 'This may take 30-60 seconds'}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  QuizPage                                                          */
/* ------------------------------------------------------------------ */
export default function QuizPage() {
  usePageTitle('Find My Strain')
  const navigate = useNavigate()
  const quizState = useQuizState()
  const { currentStep, setStep, reset } = quizState
  const { dispatch: resultsDispatch } = useContext(ResultsContext)
  const { state: userState, dispatch: userDispatch } = useContext(UserContext)

  const [loadingPhase, setLoadingPhase] = useState(0)
  const [loadingMsg, setLoadingMsg] = useState(LOADING_PHASES[0])
  const [error, setError] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const phaseInterval = useRef(null)
  const timeoutRef = useRef(null)

  /* Advance loading messages ---------------------------------------- */
  useEffect(() => {
    if (currentStep !== 6 || !isRunning) return

    phaseInterval.current = setInterval(() => {
      setLoadingPhase((prev) => {
        const next = Math.min(prev + 1, LOADING_PHASES.length - 1)
        setLoadingMsg(LOADING_PHASES[next])
        return next
      })
    }, 3500)

    return () => clearInterval(phaseInterval.current)
  }, [currentStep, isRunning])

  /* Run analysis ---------------------------------------------------- */
  const runAnalysis = useCallback(async () => {
    setIsRunning(true)
    setError(null)
    setTimedOut(false)
    setLoadingPhase(0)
    setLoadingMsg(LOADING_PHASES[0])
    setStep(6)
    resultsDispatch({ type: 'SET_LOADING' })

    // Timeout: show "still working" after 45s
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setTimedOut(true), 45000)

    try {
      // Call Cannalchemy backend — scores 24,853 strains with receptor science
      const parsed = await getRecommendations(quizState)

      // Dispatch results
      resultsDispatch({ type: 'SET_RESULTS', payload: parsed })

      // 7. Save recent search
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

      // 8. Navigate
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
    setStep(0)
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
          <button
            onClick={() => navigate('/dashboard')}
            className="hover:text-leaf-500 transition-colors underline decoration-dotted underline-offset-4"
          >
            My Dashboard
          </button>
          <span className="text-gray-300 dark:text-[#2a352c]">&middot;</span>
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
          <LoadingAnalysis phase={loadingPhase} message={loadingMsg} timedOut={timedOut} />
        )}
      </div>
    )
  }

  /* ================================================================ */
  /*  Steps 1-5 — Quiz Shell                                          */
  /* ================================================================ */
  return <QuizShell onComplete={handleQuizComplete} />
}
