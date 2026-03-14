import { useState, useEffect, useContext } from 'react'
import { Brain, Loader2 } from 'lucide-react'
import { QuizContext } from '../../context/QuizContext'
import { callFreeAI } from '../../services/freeAi'
import { buildScienceExplanation } from '../../services/promptBuilder'

const CACHE_PREFIX = 'science2_'

function getCached(strainName) {
  if (!strainName) return null
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + strainName)
    if (!raw) return null
    const { text, ts } = JSON.parse(raw)
    // Expire after 24 hours
    if (Date.now() - ts > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CACHE_PREFIX + strainName)
      return null
    }
    return text
  } catch {
    return null
  }
}

function setCache(strainName, text) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + strainName,
      JSON.stringify({ text, ts: Date.now() })
    )
  } catch {
    /* localStorage full — ignore */
  }
}

export default function ScienceExplanation({ strain, isQuizResult, aiAnalysis }) {
  const quiz = useContext(QuizContext)
  const hasQuizData = isQuizResult && quiz?.state?.effects?.length > 0
  const [explanation, setExplanation] = useState(() => hasQuizData ? getCached(strain?.name) : null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Auto-fetch on mount if not cached AND user has taken the quiz
  useEffect(() => {
    if (!hasQuizData || explanation || !strain?.name) return
    let cancelled = false

    async function fetchAI() {
      setLoading(true)
      setError(null)
      try {
        const prompt = buildScienceExplanation(strain, quiz?.state)
        const result = await callFreeAI({ prompt, maxTokens: 220, retries: 2 })
        const cleaned = (result || '').trim()
        if (!cancelled && cleaned) {
          setExplanation(cleaned)
          setCache(strain.name, cleaned)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Science explanation failed:', err)
          if (err.name === 'RateLimitError') {
            setError(err.message)
          } else {
            setError('AI is temporarily unavailable.')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAI()
    return () => { cancelled = true }
  }, [strain?.name, hasQuizData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Don't render if no quiz data and no aiAnalysis, or nothing to show
  const hasContent = aiAnalysis || explanation || loading || error
  if (!hasQuizData || !hasContent) return null

  return (
    <div className="rounded-xl border border-teal-500/15 bg-gradient-to-br from-teal-500/[0.05] via-cyan-500/[0.03] to-teal-500/[0.05] p-4">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          {loading ? (
            <Loader2 size={14} className="text-teal-400 animate-spin" />
          ) : (
            <Brain size={14} className="text-teal-400" />
          )}
        </div>
        <div className="min-w-0 space-y-2.5">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-teal-400 mb-1.5">
            Why This Strain <span className="text-teal-400/50 normal-case font-normal">(AI Pharmacological Analysis)</span>
          </h4>

          {/* Top-level AI pharmacological analysis from quiz results */}
          {aiAnalysis && (
            <p className="text-xs leading-relaxed text-gray-600 dark:text-[#b0c4b4]">
              {aiAnalysis}
            </p>
          )}

          {/* Per-strain science explanation */}
          {loading ? (
            <p className="text-xs text-gray-400 dark:text-[#6a7a6e] italic">
              Analyzing molecular profile for {strain?.name}...
            </p>
          ) : error ? (
            <p className="text-[10px] text-red-400">{error}</p>
          ) : explanation ? (
            <p className="text-xs leading-relaxed text-gray-600 dark:text-[#b0c4b4]">
              {explanation}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
