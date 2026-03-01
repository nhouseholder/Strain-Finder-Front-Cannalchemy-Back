import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { useFavorites } from '../hooks/useFavorites'
import StrainCard from '../components/results/StrainCard'
import SearchAutocomplete from '../components/shared/SearchAutocomplete'
import LegalConsent from '../components/shared/LegalConsent'

export default function StrainSearchPage() {
  usePageTitle('Search Strains')
  const [searchParams] = useSearchParams()
  const { allStrains, dataLoaded } = useStrainSearch()
  const { toggleFavorite, isFavorite } = useFavorites()
  const [expandedStrain, setExpandedStrain] = useState(null)
  const [selectedStrain, setSelectedStrain] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Pre-fill from ?q= URL param (e.g. from landing page search)
  const urlQ = searchParams.get('q') || ''
  useEffect(() => {
    if (urlQ.trim().length >= 2) {
      setSearchQuery(urlQ.trim())
    }
  }, [urlQ])

  const handleToggle = useCallback((strainName) => {
    setExpandedStrain((prev) => (prev === strainName ? null : strainName))
  }, [])

  const handleSelect = useCallback((strain) => {
    setSelectedStrain(strain)
    setExpandedStrain(strain.name)
    setSearchQuery(strain.name)
  }, [])

  const handleSearch = useCallback((q) => {
    setSearchQuery(q)
    setSelectedStrain(null)
  }, [])

  // Filter strains for the main results list
  const displayStrains = useMemo(() => {
    if (selectedStrain) return [selectedStrain]
    if (!searchQuery || searchQuery.trim().length < 2 || allStrains.length === 0) return []
    const lower = searchQuery.toLowerCase().trim()
    const str = (v) => typeof v === 'string' ? v : String(v || '')
    return allStrains
      .filter(s => {
        try {
          return (
            str(s.name).toLowerCase().includes(lower) ||
            str(s.type).toLowerCase().includes(lower) ||
            (Array.isArray(s.effects) && s.effects.some(e => str(typeof e === 'string' ? e : e?.name || '').toLowerCase().includes(lower))) ||
            (Array.isArray(s.flavors) && s.flavors.some(f => str(f).toLowerCase().includes(lower)))
          )
        } catch { return false }
      })
      .slice(0, 20)
  }, [searchQuery, selectedStrain, allStrains])

  const hasQuery = searchQuery.trim().length >= 2

  // Auto-expand when there is exactly one result (direct search or autocomplete select)
  const hasAutoExpanded = useRef(false)
  useEffect(() => {
    if (displayStrains.length === 1 && !hasAutoExpanded.current) {
      setExpandedStrain(displayStrains[0].name)
      hasAutoExpanded.current = true
    }
    if (displayStrains.length !== 1) {
      hasAutoExpanded.current = false
    }
  }, [displayStrains])

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

        {/* Search input with autocomplete dropdown */}
        <SearchAutocomplete
          strains={allStrains}
          dataLoaded={dataLoaded}
          initialQuery={urlQ.trim()}
          onSelect={handleSelect}
          onSearch={handleSearch}
          className="mb-4"
        />

        {!hasQuery && (
          <div className="text-center py-10 text-sm text-gray-400 dark:text-[#6a7a6e]">
            {dataLoaded ? 'Start typing to find a strain.' : 'Loading strain database...'}
          </div>
        )}

        {hasQuery && displayStrains.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-400 dark:text-[#6a7a6e]">
            No strains found for &ldquo;{searchQuery}&rdquo;.
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
              hideExpandButton={displayStrains.length === 1}
            />
          ))}
        </div>
      </div>
    </LegalConsent>
  )
}
