/**
 * MyPreferencesPage — dedicated page for viewing the user's taste profile,
 * all their strain ratings, and learned preference insights.
 */
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'
import { useRatings } from '../hooks/useRatings'
import PreferenceProfileCard from '../components/ratings/PreferenceProfileCard'
import MyRatings from '../components/ratings/MyRatings'
import AiSuggestions from '../components/ratings/AiSuggestions'
import Button from '../components/shared/Button'
import { Brain, Star, ArrowLeft, Sparkles, Wand2 } from 'lucide-react'

export default function MyPreferencesPage() {
  usePageTitle('My Taste Profile')
  const { ratings, preferenceProfile, removeRating, syncing, totalRatings } = useRatings()
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-4 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-[#5a6a5e] hover:text-leaf-500 transition-colors mb-3"
        >
          <ArrowLeft size={12} />
          Dashboard
        </Link>
        <h1
          className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea] flex items-center gap-2"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          <Brain size={24} className="text-leaf-500" />
          My Taste Profile
        </h1>
        <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-0.5">
          {totalRatings > 0
            ? `Learned from ${totalRatings} strain rating${totalRatings !== 1 ? 's' : ''}`
            : 'Rate strains to build your personal preference profile'}
          {syncing && ' — syncing...'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 dark:bg-white/[0.04] rounded-xl p-1">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'profile'
              ? 'bg-white dark:bg-white/[0.08] text-gray-900 dark:text-[#e8f0ea] shadow-sm'
              : 'text-gray-500 dark:text-[#6a7a6e] hover:text-gray-700 dark:hover:text-[#b0c4b4]'
          }`}
        >
          <Sparkles size={13} />
          Preferences
        </button>
        <button
          onClick={() => setActiveTab('ratings')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'ratings'
              ? 'bg-white dark:bg-white/[0.08] text-gray-900 dark:text-[#e8f0ea] shadow-sm'
              : 'text-gray-500 dark:text-[#6a7a6e] hover:text-gray-700 dark:hover:text-[#b0c4b4]'
          }`}
        >
          <Star size={13} />
          Ratings ({totalRatings})
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'suggestions'
              ? 'bg-white dark:bg-white/[0.08] text-gray-900 dark:text-[#e8f0ea] shadow-sm'
              : 'text-gray-500 dark:text-[#6a7a6e] hover:text-gray-700 dark:hover:text-[#b0c4b4]'
          }`}
        >
          <Wand2 size={13} />
          AI Picks
        </button>
      </div>

      {/* Content */}
      {activeTab === 'profile' && (
        <PreferenceProfileCard profile={preferenceProfile} />
      )}
      {activeTab === 'ratings' && (
        <MyRatings ratings={ratings} onDelete={removeRating} />
      )}
      {activeTab === 'suggestions' && (
        <AiSuggestions ratings={ratings} preferenceProfile={preferenceProfile} />
      )}

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  )
}
