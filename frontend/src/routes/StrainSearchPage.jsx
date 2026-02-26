import { useMemo, useState, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import usePageTitle from '../hooks/usePageTitle'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { useFavorites } from '../hooks/useFavorites'
import StrainCard from '../components/results/StrainCard'
import LegalConsent from '../components/shared/LegalConsent'

export default function StrainSearchPage() {
  usePageTitle('Search Strains')
  const { query, setQuery, results } = useStrainSearch()
  const { toggleFavorite, isFavorite } = useFavorites()
  const [expandedStrain, setExpandedStrain] = useState(null)

  const hasQuery = query.trim().length >= 2
  const visibleResults = useMemo(
    () => (hasQuery ? results : []),
    [hasQuery, results]
  )

  const handleToggle = useCallback((strainName) => {
    setExpandedStrain((prev) => (prev === strainName ? null : strainName))
  }, [])

  return (
    <LegalConsent>
      <div className="w-full max-w-2xl mx-auto px-4 pt-4 animate-fade-in">
        <div className="mb-5">
          <h1
            className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Search Strains
          </h1>
          <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-0.5">
            Skip the quiz and jump straight to any strain.
          </p>
        </div>

        <div className="relative mb-4">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#6a7a6e] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search strains by name, type, effects, or flavors..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-sm text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#6a7a6e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40"
            aria-label="Search strains"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#6a7a6e] hover:text-gray-600 dark:hover:text-[#b0c4b4] transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {!hasQuery && (
          <div className="text-center py-10 text-sm text-gray-400 dark:text-[#6a7a6e]">
            Start typing to find a strain.
          </div>
        )}

        {hasQuery && visibleResults.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-400 dark:text-[#6a7a6e]">
            No strains found for &ldquo;{query}&rdquo;.
          </div>
        )}

        <div className="space-y-3 pb-4">
          {visibleResults.map((strain) => (
            <StrainCard
              key={strain.id || strain.name}
              strain={strain}
              expanded={expandedStrain === strain.name}
              onToggle={() => handleToggle(strain.name)}
              isFavorite={isFavorite(strain.name)}
              onFavorite={toggleFavorite}
              availability={[]}
              availabilityLoading={false}
              onViewDispensary={null}
            />
          ))}
        </div>
      </div>
    </LegalConsent>
  )
}
