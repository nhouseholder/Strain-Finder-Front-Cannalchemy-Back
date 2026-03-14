import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuizState } from '../../hooks/useQuizState'
import { fetchAllDispensaryIndex } from '../../services/dispensarySearch'
import { Search, X, Store, Truck, Star, Loader2, MapPin } from 'lucide-react'
import Button from '../shared/Button'

export default function DispensaryStep({ onComplete }) {
  const {
    selectedDispensary,
    setSelectedDispensary,
    setStep,
  } = useQuizState()

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [focusIdx, setFocusIdx] = useState(-1)
  const [allDispensaries, setAllDispensaries] = useState([])
  const [loading, setLoading] = useState(true)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  // Fetch dispensary index on mount
  useEffect(() => {
    let cancelled = false
    fetchAllDispensaryIndex().then(index => {
      if (!cancelled) {
        setAllDispensaries(index)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Filter dispensaries by query
  const matches = useMemo(() => {
    if (!query || query.trim().length < 1 || allDispensaries.length === 0) return []
    const lower = query.toLowerCase().trim()

    const filtered = allDispensaries.filter(d =>
      d.name.toLowerCase().includes(lower) ||
      d.cityLabel.toLowerCase().includes(lower) ||
      d.address.toLowerCase().includes(lower)
    )

    // Sort: starts-with → rating → matched strains
    filtered.sort((a, b) => {
      const aExact = a.name.toLowerCase().startsWith(lower) ? 1 : 0
      const bExact = b.name.toLowerCase().startsWith(lower) ? 1 : 0
      if (aExact !== bExact) return bExact - aExact

      const ratingA = a.rating || 0
      const ratingB = b.rating || 0
      if (ratingA !== ratingB) return ratingB - ratingA

      return (b.matchedStrainCount || 0) - (a.matchedStrainCount || 0)
    })

    return filtered.slice(0, 8)
  }, [query, allDispensaries])

  const handleSelect = (disp) => {
    setSelectedDispensary({
      id: disp.id,
      name: disp.name,
      citySlug: disp.citySlug,
      cityLabel: disp.cityLabel,
    })
    setQuery('')
    setOpen(false)
    setFocusIdx(-1)
  }

  const handleClear = () => {
    setSelectedDispensary(null)
  }

  const handleKeyDown = (e) => {
    if (!open || matches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx(prev => (prev + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx(prev => (prev <= 0 ? matches.length - 1 : prev - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setFocusIdx(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (focusIdx >= 0 && matches[focusIdx]) {
        handleSelect(matches[focusIdx])
      }
    }
  }

  const handleFinish = () => {
    if (onComplete) onComplete()
  }

  const showDropdown = open && query.trim().length >= 1

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-display text-gray-900 dark:text-[#e8f0ea] mb-2">
          Shop a specific menu
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">
          Search for your dispensary or delivery service and we'll prioritize strains from their menu.
        </p>
        <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-1">
          This is optional — skip ahead anytime.
        </p>
      </div>

      {/* Search input with autocomplete */}
      <div className="rounded-2xl border border-leaf-500/20 bg-leaf-500/[0.04] p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-leaf-500/15 flex items-center justify-center flex-shrink-0">
            <Store size={15} className="text-leaf-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea]">
              Your Dispensary <span className="text-xs font-normal text-gray-400 dark:text-[#6a7a6e]">(Optional)</span>
            </p>
            <p className="text-[11px] text-gray-500 dark:text-[#6a7a6e] leading-snug">
              Includes dispensaries & delivery services across 10 cities
            </p>
          </div>
        </div>

        {/* Selected dispensary card */}
        {selectedDispensary ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-leaf-500/10 border border-leaf-500/25">
            <div className="flex items-center gap-2.5 min-w-0">
              <Store size={16} className="text-leaf-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea] truncate">
                  {selectedDispensary.name}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-[#6a7a6e] flex items-center gap-1">
                  <MapPin size={10} />
                  {selectedDispensary.cityLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-leaf-500 hover:text-leaf-400 font-medium flex-shrink-0 min-h-[44px] px-3 flex items-center"
              aria-label="Change dispensary"
            >
              Change
            </button>
          </div>
        ) : (
          <div ref={wrapperRef} className="relative">
            <div className="relative">
              {loading ? (
                <Loader2
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#6a7a6e] pointer-events-none z-10 animate-spin"
                />
              ) : (
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#6a7a6e] pointer-events-none z-10"
                />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setOpen(true)
                  setFocusIdx(-1)
                }}
                onFocus={() => query.trim().length >= 1 && setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={loading ? 'Loading dispensaries...' : 'Type dispensary name...'}
                disabled={loading}
                className="w-full pl-10 pr-9 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-base text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 focus:border-leaf-500/40 transition-all disabled:opacity-50"
                aria-label="Search dispensaries"
                autoComplete="off"
                role="combobox"
                aria-expanded={showDropdown && matches.length > 0}
                aria-haspopup="listbox"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setOpen(false); setFocusIdx(-1); inputRef.current?.focus() }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-[#b0c4b4] transition-colors z-10"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div
                className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-gray-200/50 dark:border-white/10 bg-white dark:bg-[#121a14] shadow-2xl shadow-black/25 z-50 overflow-hidden max-h-[40vh] overflow-y-auto"
                role="listbox"
              >
                {matches.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-gray-400 dark:text-[#6a7a6e]">
                    No dispensaries match "{query}"
                  </div>
                ) : (
                  matches.map((disp, idx) => {
                    const isFocused = idx === focusIdx
                    return (
                      <button
                        key={`${disp.id}-${disp.citySlug}`}
                        type="button"
                        role="option"
                        aria-selected={isFocused}
                        onClick={() => handleSelect(disp)}
                        onMouseEnter={() => setFocusIdx(idx)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors min-h-[44px] ${
                          isFocused ? 'bg-leaf-500/10' : 'hover:bg-leaf-500/5'
                        } ${idx > 0 ? 'border-t border-gray-100 dark:border-white/[0.04]' : ''}`}
                      >
                        <Store size={14} className="text-gray-400 dark:text-[#6a7a6e] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea] truncate">
                              {disp.name}
                            </span>
                            {disp.delivery && (
                              <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <Truck size={8} />
                                Delivery
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-gray-400 dark:text-[#6a7a6e] flex items-center gap-0.5">
                              <MapPin size={9} />
                              {disp.cityLabel}
                            </span>
                            {disp.rating && (
                              <span className="text-[11px] text-gray-400 dark:text-[#6a7a6e] flex items-center gap-0.5">
                                <Star size={9} className="fill-amber-400 text-amber-400" />
                                {disp.rating}
                              </span>
                            )}
                            {disp.matchedStrainCount > 0 && (
                              <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                                {disp.matchedStrainCount} strains matched
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="md" onClick={() => setStep(4)} aria-label="Go back to fine-tune step">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Button>

        <div className="flex items-center gap-3">
          {!selectedDispensary && (
            <Button variant="secondary" size="md" onClick={handleFinish} aria-label="Skip dispensary selection">
              Skip
            </Button>
          )}
          <Button size="lg" onClick={handleFinish} aria-label="Find my matches">
            Find My Matches
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  )
}
