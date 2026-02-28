import { useState, useContext } from 'react'
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
  const [explanation, setExplanation] = useState(() => getCached(strain?.name))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchExplanation = async () => {
    setLoading(true)
    setError(null)
    try {
      const prompt = buildScienceExplanation(strain, quiz?.state)
      const result = await callFreeAI({ prompt, maxTokens: 500, retries: 2 })
      const cleaned = (result || '').trim()
      setExplanation(cleaned)
      if (strain?.name) setCache(strain.name, cleaned)
    } catch (err) {
      console.error('Science explanation failed:', err)
      if (err.message === 'API_KEY_MISSING') {
        setError('AI service is being configured. This feature will be available shortly.')
      } else if (err.message?.includes('API key not configured')) {
        setError('AI service is being configured. This feature will be available shortly.')
      } else if (err.name === 'RateLimitError') {
        setError(err.message)
      } else {
        setError('AI is temporarily unavailable. Please try again in a moment.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (explanation) {
    return (
      <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-4">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles size={14} className="text-purple-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5">
              AI Analysis
            </h4>
            <p className="text-xs leading-relaxed text-gray-600 dark:text-[#b0c4b4]">
              {explanation}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={fetchExplanation}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-purple-500/20 bg-purple-500/[0.04] text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Sparkles size={14} />
        )}
        <span className="text-xs font-medium">
          {loading ? 'Analyzing molecular profile...' : 'Why This Strain? (AI)'}
        </span>
      </button>
      {error && (
        <p className="text-[10px] text-red-400 text-center">{error}</p>
      )}
    </div>
  )
}
