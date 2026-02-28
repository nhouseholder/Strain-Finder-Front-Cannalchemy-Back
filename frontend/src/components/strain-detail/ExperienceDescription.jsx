import { useState, useEffect, useMemo } from 'react'
import { Wind, Loader2 } from 'lucide-react'
import { callFreeAI } from '../../services/freeAi'
import { buildExperiencePrompt } from '../../services/promptBuilder'
import { generateExperienceDescription } from '../../utils/strainExperience'

const CACHE_PREFIX = 'exp_'

function getCached(strainName) {
  if (!strainName) return null
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + strainName)
    if (!raw) return null
    const { text, ts } = JSON.parse(raw)
    if (Date.now() - ts > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CACHE_PREFIX + strainName)
      return null
    }
    return text
  } catch { return null }
}

function setCache(strainName, text) {
  try {
    localStorage.setItem(CACHE_PREFIX + strainName, JSON.stringify({ text, ts: Date.now() }))
  } catch { /* localStorage full */ }
}

export default function ExperienceDescription({ strain }) {
  const [aiText, setAiText] = useState(() => getCached(strain?.name))
  const [loading, setLoading] = useState(false)
  const [usedAI, setUsedAI] = useState(!!getCached(strain?.name))

  // Fallback template description
  const fallback = useMemo(() => generateExperienceDescription(strain), [strain])

  // Auto-fetch AI description on mount if not cached
  useEffect(() => {
    if (aiText || !strain?.name) return
    let cancelled = false

    async function fetchAI() {
      setLoading(true)
      try {
        const prompt = buildExperiencePrompt(strain)
        const result = await callFreeAI({ prompt, maxTokens: 400, retries: 1 })
        const cleaned = (result || '').trim()
        if (!cancelled && cleaned) {
          setAiText(cleaned)
          setUsedAI(true)
          setCache(strain.name, cleaned)
        }
      } catch {
        // AI failed — fallback is already shown
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAI()
    return () => { cancelled = true }
  }, [strain?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const description = aiText || fallback
  if (!description && !loading) return null

  return (
    <div className="rounded-xl border border-purple-500/15 bg-purple-500/[0.04] p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {loading ? (
            <Loader2 size={16} className="text-purple-400 animate-spin" />
          ) : (
            <Wind size={16} className="text-purple-400" />
          )}
        </div>
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5">
            The Experience {usedAI && <span className="text-purple-400/50 normal-case font-normal">(AI)</span>}
          </h4>
          {loading && !description ? (
            <p className="text-xs text-gray-400 dark:text-[#6a7a6e] italic">
              Generating unique experience description...
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-gray-600 dark:text-[#b0c4b4] italic">
              {description}
            </p>
          )}
          <p className="text-[8px] text-gray-400 dark:text-[#5a6a5e] mt-2 not-italic">
            {usedAI ? 'AI-generated from strain data, terpene profile, and community reports.' : 'Based on community reports.'} Individual experiences vary. Not medical advice.
          </p>
        </div>
      </div>
    </div>
  )
}
