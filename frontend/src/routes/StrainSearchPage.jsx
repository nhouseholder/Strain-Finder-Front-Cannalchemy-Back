import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { useFavorites } from '../hooks/useFavorites'
import { useSearchHistory } from '../hooks/useSearchHistory'
import { useUserRegion } from '../hooks/useUserRegion'
import StrainCard from '../components/results/StrainCard'
import SearchAutocomplete from '../components/shared/SearchAutocomplete'
import SortDropdown, { applySortComparator } from '../components/shared/SortDropdown'
import ChatWidget from '../components/chat/ChatWidget'
import LegalConsent from '../components/shared/LegalConsent'
import { requestStrain, lookupStrain } from '../services/api'

export default function StrainSearchPage() {
  usePageTitle('Search Strains')
  const [searchParams] = useSearchParams()
  const { allStrains, dataLoaded } = useStrainSearch()
  const { toggleFavorite, isFavorite } = useFavorites()
  const { recordSearch } = useSearchHistory()
  const { userRegionIndex, hasLocation } = useUserRegion()
  const [expandedStrain, setExpandedStrain] = useState(null)
  const [selectedStrain, setSelectedStrain] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [requestedStrain, setRequestedStrain] = useState(null)
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestError, setRequestError] = useState(null)
  const [enrichmentPolling, setEnrichmentPolling] = useState(false)

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
    recordSearch(strain.name, strain.name, strain.type)
  }, [recordSearch])

  const handleSearch = useCallback((q) => {
    setSearchQuery(q)
    setSelectedStrain(null)
    if (q) recordSearch(q)
  }, [recordSearch])

  // Filter strains for the main results list
  const displayStrains = useMemo(() => {
    if (selectedStrain) return [selectedStrain]
    if (!searchQuery || searchQuery.trim().length < 2 || allStrains.length === 0) return []
    const lower = searchQuery.toLowerCase().trim()
    const str = (v) => typeof v === 'string' ? v : String(v || '')
    const matched = allStrains
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
      .slice(0, 50)

    // Apply sort
    matched.sort(applySortComparator(sortBy, userRegionIndex))
    return matched
  }, [searchQuery, selectedStrain, allStrains, sortBy, userRegionIndex])

  // Handle "Request This Strain" — calls backend API
  const handleRequestStrain = useCallback(async () => {
    const name = searchQuery.trim()
    if (!name) return
    setRequestLoading(true)
    setRequestError(null)
    setRequestedStrain(null)
    try {
      const result = await requestStrain(name)
      if (result.found && result.strain) {
        setRequestedStrain(result)
        // If enrichment is pending, poll for updated data
        if (result.enrichmentStatus === 'pending') {
          setEnrichmentPolling(true)
          // Poll every 5 seconds for up to 30 seconds
          let attempts = 0
          const poll = setInterval(async () => {
            attempts++
            if (attempts > 6) {
              clearInterval(poll)
              setEnrichmentPolling(false)
              return
            }
            try {
              const updated = await lookupStrain(name)
              if (updated.found && updated.strain) {
                setRequestedStrain(updated)
                const quality = updated.strain.dataCompleteness
                if (quality === 'full' || quality === 'partial') {
                  clearInterval(poll)
                  setEnrichmentPolling(false)
                }
              }
            } catch { /* ignore poll errors */ }
          }, 5000)
        }
      }
    } catch (err) {
      setRequestError(err.message || 'Failed to request strain')
    } finally {
      setRequestLoading(false)
    }
  }, [searchQuery])

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
          userRegionIndex={userRegionIndex}
          className="mb-4"
        />

        {/* Sort control — visible when there are results */}
        {hasQuery && displayStrains.length > 1 && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-gray-500 dark:text-[#8a9a8e]">
              <span className="font-semibold text-leaf-400">{displayStrains.length}</span> result{displayStrains.length !== 1 ? 's' : ''}
            </p>
            <SortDropdown value={sortBy} onChange={setSortBy} hasLocation={hasLocation} />
          </div>
        )}

        {!hasQuery && (
          <div className="text-center py-10 text-sm text-gray-400 dark:text-[#6a7a6e]">
            {dataLoaded ? 'Start typing to find a strain.' : 'Loading strain database...'}
          </div>
        )}

        {hasQuery && displayStrains.length === 0 && !requestedStrain && (
          <div className="text-center py-10 space-y-4">
            <p className="text-sm text-gray-400 dark:text-[#6a7a6e]">
              No strains found for &ldquo;{searchQuery}&rdquo;.
            </p>
            <button
              onClick={handleRequestStrain}
              disabled={requestLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-leaf-500 to-emerald-500 text-white font-semibold text-sm hover:from-leaf-400 hover:to-emerald-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {requestLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Searching sources...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Request This Strain
                </>
              )}
            </button>
            <p className="text-[11px] text-gray-400 dark:text-[#5a6a5e]">
              We&apos;ll search external databases and build a profile for you.
            </p>
            {requestError && (
              <p className="text-xs text-red-400">{requestError}</p>
            )}
          </div>
        )}

        {/* Requested strain card (from API, not from local JSON) */}
        {requestedStrain?.strain && (
          <div className="space-y-3">
            {requestedStrain.message && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-leaf-500/10 border border-leaf-500/20">
                {enrichmentPolling && (
                  <svg className="animate-spin h-4 w-4 text-leaf-400 flex-shrink-0" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                <p className="text-xs text-leaf-500 dark:text-leaf-400">
                  {enrichmentPolling ? 'Enriching profile from external sources...' : requestedStrain.message}
                </p>
              </div>
            )}
            <StrainCard
              strain={requestedStrain.strain}
              expanded={true}
              onToggle={() => {}}
              isFavorite={isFavorite(requestedStrain.strain.name)}
              onFavorite={toggleFavorite}
              availability={[]}
              availabilityLoading={false}
              onViewDispensary={null}
              hideExpandButton
              userRegionIndex={userRegionIndex}
            />
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
              userRegionIndex={userRegionIndex}
            />
          ))}
        </div>

        {/* AI Chat — inline, always visible */}
        <div className="pb-6">
          <ChatWidget inline />
        </div>
      </div>
    </LegalConsent>
  )
}
