import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X, Cannabis } from 'lucide-react'
import usePageTitle from '../hooks/usePageTitle'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { useFavorites } from '../hooks/useFavorites'
import StrainCard from '../components/results/StrainCard'
import LegalConsent from '../components/shared/LegalConsent'

const effectLabel = (e) => typeof e === 'string' ? e : (e?.name || e?.label || '')

export default function StrainSearchPage() {
  usePageTitle('Search Strains')
  const [searchParams] = useSearchParams()
  const { query, setQuery, results } = useStrainSearch()
  const { toggleFavorite, isFavorite } = useFavorites()
  const [expandedStrain, setExpandedStrain] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedStrain, setSelectedStrain] = useState(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  // Pre-fill from ?q= URL param (e.g. from landing page search)
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q.trim().length >= 2 && !query) setQuery(q.trim())
  }, [searchParams])  // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const hasQuery = query.trim().length >= 2
  const visibleResults = useMemo(
    () => (hasQuery ? results : []),
    [hasQuery, results]
  )

  // Dropdown shows top 8 quick matches
  const dropdownItems = useMemo(
    () => visibleResults.slice(0, 8),
    [visibleResults]
  )

  const handleToggle = useCallback((strainName) => {
    setExpandedStrain((prev) => (prev === strainName ? null : strainName))
  }, [])

  // When user picks a strain from dropdown, select it and show its full card
  const handleSelectStrain = useCallback((strain) => {
    setSelectedStrain(strain)
    setExpandedStrain(strain.name)
    setShowDropdown(false)
    setQuery(strain.name)
  }, [setQuery])

  const handleInputChange = (e) => {
    setQuery(e.target.value)
    setShowDropdown(true)
    setSelectedStrain(null)
  }

  // Which strains to show in main area
  const displayStrains = selectedStrain ? [selectedStrain] : visibleResults

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

        {/* Search input with dropdown */}
        <div className="relative mb-4">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#6a7a6e] pointer-events-none z-10"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search strains by name, type, effects, or flavors..."
            value={query}
            onChange={handleInputChange}
            onFocus={() => hasQuery && setShowDropdown(true)}
            className="w-full pl-10 pr-9 py-3 rounded-xl border border-gray-200/50 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-[#e8f0ea] placeholder-gray-500 dark:placeholder-[#6a7a6e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 focus:border-leaf-500/40 transition-all shadow-sm"
            aria-label="Search strains"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSelectedStrain(null); setShowDropdown(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#6a7a6e] hover:text-gray-600 dark:hover:text-[#b0c4b4] transition-colors z-10"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}

          {/* Dropdown autocomplete */}
          {showDropdown && hasQuery && dropdownItems.length > 0 && !selectedStrain && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-gray-200/50 dark:border-white/10 bg-white dark:bg-[#121a14] shadow-xl shadow-black/20 z-50 overflow-hidden max-h-80 overflow-y-auto"
            >
              {dropdownItems.map((strain, idx) => {
                const typeColor = strain.type === 'sativa' ? 'text-orange-400' : strain.type === 'indica' ? 'text-purple-400' : 'text-leaf-400'
                return (
                  <button
                    key={strain.id || strain.name}
                    type="button"
                    onClick={() => handleSelectStrain(strain)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-leaf-500/10 transition-colors ${idx > 0 ? 'border-t border-gray-100 dark:border-white/[0.04]' : ''}`}
                  >
                    <Cannabis size={14} className={typeColor} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea] truncate">
                          {strain.name}
                        </span>
                        <span className={`text-[10px] font-medium uppercase ${typeColor}`}>
                          {strain.type}
                        </span>
                        {strain.thc != null && (
                          <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
                            {strain.thc}% THC
                          </span>
                        )}
                      </div>
                      {strain.effects?.length > 0 && (
                        <p className="text-[10px] text-gray-400 dark:text-[#6a7a6e] truncate mt-0.5">
                          {strain.effects.slice(0, 4).map(effectLabel).filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    {strain.matchPct != null && (
                      <span className="text-[10px] font-bold text-leaf-400 flex-shrink-0">
                        {Math.round(strain.matchPct)}%
                      </span>
                    )}
                  </button>
                )
              })}
              {visibleResults.length > 8 && (
                <div
                  className="px-4 py-2 text-center text-[10px] text-gray-400 dark:text-[#6a7a6e] border-t border-gray-100 dark:border-white/[0.04] cursor-pointer hover:bg-leaf-500/5"
                  onClick={() => setShowDropdown(false)}
                >
                  + {visibleResults.length - 8} more — scroll down to see all
                </div>
              )}
            </div>
          )}
        </div>

        {!hasQuery && (
          <div className="text-center py-10 text-sm text-gray-400 dark:text-[#6a7a6e]">
            Start typing to find a strain.
          </div>
        )}

        {hasQuery && displayStrains.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-400 dark:text-[#6a7a6e]">
            No strains found for &ldquo;{query}&rdquo;.
          </div>
        )}

        <div className="space-y-3 pb-4">
          {displayStrains.map((strain) => (
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
