/**
 * AiSuggestions — Uses the user's rating history + preference profile
 * to get AI-powered strain suggestions via Workers AI.
 */
import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Star, Leaf, ChevronRight, Loader2, RefreshCw, Brain } from 'lucide-react'
import Card from '../shared/Card'
import clsx from 'clsx'

const TYPE_COLORS = {
  indica: 'bg-purple-500/10 text-purple-400',
  sativa: 'bg-amber-500/10 text-amber-500',
  hybrid: 'bg-leaf-500/10 text-leaf-400',
}

function SuggestionCard({ suggestion }) {
  const typeStyle = TYPE_COLORS[suggestion.type] || TYPE_COLORS.hybrid

  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] truncate">
            {suggestion.name}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${typeStyle}`}>
              {suggestion.type}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
              THC {suggestion.thc}% · CBD {suggestion.cbd}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs font-bold text-leaf-500">{suggestion.matchScore}%</span>
          <span className="text-[8px] text-gray-400 dark:text-[#5a6a5e]">match</span>
        </div>
      </div>

      {/* Effects */}
      {suggestion.effects?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {suggestion.effects.map(e => (
            <span key={e} className="px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-leaf-500/[0.06] text-leaf-500 dark:text-leaf-400">
              {e}
            </span>
          ))}
        </div>
      )}

      {/* Terpenes */}
      {suggestion.terpenes?.length > 0 && (
        <div className="flex items-center gap-2">
          <Leaf size={10} className="text-purple-400 flex-shrink-0" />
          <span className="text-[10px] text-gray-500 dark:text-[#8a9a8e]">
            {suggestion.terpenes.map(t => `${t.name} ${t.pct}`).join(' · ')}
          </span>
        </div>
      )}

      {/* Best For */}
      {suggestion.bestFor?.length > 0 && (
        <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e] mt-1.5 italic">
          Best for: {suggestion.bestFor.slice(0, 3).join(', ')}
        </p>
      )}
    </Card>
  )
}

export default function AiSuggestions({ ratings, preferenceProfile }) {
  const [suggestions, setSuggestions] = useState(null)
  const [aiExplanation, setAiExplanation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchSuggestions = useCallback(async () => {
    if (!ratings?.length) return
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/v1/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratings,
          profile: preferenceProfile,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to get suggestions')
      }

      const data = await response.json()
      setSuggestions(data.suggestions || [])
      setAiExplanation(data.aiExplanation || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [ratings, preferenceProfile])

  // Not enough ratings
  if (!ratings?.length || ratings.length < 2) {
    return (
      <Card className="p-5 text-center">
        <Sparkles size={24} className="text-gray-300 dark:text-[#4a5a4e] mx-auto mb-2" />
        <p className="text-xs text-gray-500 dark:text-[#8a9a8e] mb-1 font-medium">
          AI Suggestions unlock after 2 ratings
        </p>
        <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
          Rate strains you've tried and our AI will find your next favorites
        </p>
      </Card>
    )
  }

  // Haven't fetched yet
  if (!suggestions && !loading) {
    return (
      <Card className="p-5 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/10 to-leaf-500/10 flex items-center justify-center mx-auto mb-3">
          <Brain size={22} className="text-purple-400" />
        </div>
        <p className="text-xs text-gray-600 dark:text-[#b0c4b4] font-medium mb-1">
          Ready to discover your next favorite strain?
        </p>
        <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mb-4">
          Our AI analyzes your {ratings.length} rating{ratings.length === 1 ? '' : 's'} to find personalized matches
        </p>
        <button
          onClick={fetchSuggestions}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-leaf-500 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Sparkles size={14} />
          Get AI Suggestions
        </button>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Loading */}
      {loading && (
        <Card className="p-5 text-center">
          <Loader2 size={20} className="text-purple-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500 dark:text-[#8a9a8e]">
            Analyzing your preferences...
          </p>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="p-4 border-red-500/20">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={fetchSuggestions}
            className="text-[10px] text-leaf-500 hover:text-leaf-400 mt-1"
          >
            Try again
          </button>
        </Card>
      )}

      {/* Results */}
      {suggestions && !loading && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Brain size={13} className="text-purple-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                AI Suggestions · Based on {ratings.length} Ratings
              </span>
            </div>
            <button
              onClick={fetchSuggestions}
              disabled={loading}
              className="text-[10px] text-gray-400 hover:text-leaf-400 transition-colors flex items-center gap-1"
            >
              <RefreshCw size={10} />
              Refresh
            </button>
          </div>

          {/* AI Explanation */}
          {aiExplanation && (
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-purple-500/[0.05] via-transparent to-leaf-500/[0.05] border border-purple-500/10 dark:border-purple-500/[0.06]">
              <p className="text-xs text-gray-600 dark:text-[#b0c4b4] leading-relaxed">
                {aiExplanation}
              </p>
            </div>
          )}

          {/* Suggestion Cards */}
          <div className="grid grid-cols-1 gap-2.5">
            {suggestions.map(s => (
              <SuggestionCard key={s.name} suggestion={s} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
