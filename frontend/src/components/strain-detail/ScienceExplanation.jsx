import { useState, useEffect, useContext } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { QuizContext } from '../../context/QuizContext'
import { callFreeAI } from '../../services/freeAi'
import { buildScienceExplanation } from '../../services/promptBuilder'

const CACHE_PREFIX = 'science_'

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

export default function ScienceExplanation({ strain }) {
  const quiz = useContext(QuizContext)
  const hasQuizData = quiz?.state?.effects?.length > 0
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
        const result = await callFreeAI({ prompt, maxTokens: 400, retries: 2 })
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

  // Don't render if no quiz data, or nothing to show
  if (!hasQuizData || (!explanation && !loading && !error)) return null

  return (
    <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-4">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          {loading ? (
            <Loader2 size={14} className="text-purple-400 animate-spin" />
          ) : (
            <Sparkles size={14} className="text-purple-400" />
          )}
        </div>
        <div className="min-w-0">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5">
            Why This Strain <span className="text-purple-400/50 normal-case font-normal">(AI)</span>
          </h4>
          {loading ? (
            <p className="text-xs text-gray-400 dark:text-[#6a7a6e] italic">
              Analyzing molecular profile...
            </p>
          ) : error ? (
            <p className="text-[10px] text-red-400">{error}</p>
          ) : (
            <p className="text-xs leading-relaxed text-gray-600 dark:text-[#b0c4b4]">
              {explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
