import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Loader2, Cannabis, Plus } from 'lucide-react'
import { strainSlug } from '../../utils/strainSlug'
import { requestStrain } from '../../services/api'

const effectLabel = (e) => typeof e === 'string' ? e : (e?.name || e?.label || '')

/**
 * Reusable search-with-autocomplete dropdown.
 *
 * Props:
 *  - strains: normalized strain array
 *  - dataLoaded: boolean
 *  - onSelect: (strain) => void   — called when user picks a dropdown item
 *  - onSearch: (query) => void     — called on form submit / enter
 *  - placeholder: string
 *  - initialQuery: string
 *  - className: string             — extra classes for the wrapper
 *  - inputClassName: string        — extra classes for the <input>
 *  - showSearchButton: boolean     — render a "Search" submit button inside the input
 */
function SearchAutocomplete({
  strains = [],
  dataLoaded = false,
  onSelect,
  onSearch,
  placeholder = 'Search strains by name, type, effects, or flavors...',
  initialQuery = '',
  className = '',
  inputClassName = '',
  showSearchButton = false,
  userRegionIndex = null,
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  const [focusIdx, setFocusIdx] = useState(-1)
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestError, setRequestError] = useState(null)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  // Track visual viewport height (shrinks when mobile keyboard opens).
  // Compute available space below the input so the dropdown fits above the keyboard.
  const [dropdownMaxH, setDropdownMaxH] = useState('40vh')
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const input = inputRef.current
      // Reserve space for mobile bottom nav (~64px) when keyboard is closed
      const mobileNav = window.innerWidth < 640 ? 64 : 0
      const keyboardOpen = vv.height < window.innerHeight * 0.75
      const bottomPad = keyboardOpen ? 8 : mobileNav + 8
      if (input) {
        const rect = input.getBoundingClientRect()
        const bottomOfInput = rect.bottom + 8 // 8px gap
        const available = vv.height - bottomOfInput - (keyboardOpen ? 0 : mobileNav)
        setDropdownMaxH(`${Math.max(available, 120)}px`)
      } else {
        setDropdownMaxH(`${Math.min(vv.height * 0.4, vv.height - 140 - bottomPad)}px`)
      }
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  // On mobile, scroll the input into view when focused so the dropdown
  // isn't hidden behind the virtual keyboard.
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const handleFocus = () => {
      setTimeout(() => {
        input.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
    input.addEventListener('focus', handleFocus)
    return () => input.removeEventListener('focus', handleFocus)
  }, [])

  // Sync initialQuery changes (e.g. from URL param)
  useEffect(() => {
    if (initialQuery && initialQuery !== query) setQuery(initialQuery)
  }, [initialQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Filter strains — boost locally-available strains when region is known
  const matches = useMemo(() => {
    if (!query || query.trim().length < 1 || strains.length === 0) return []
    const lower = query.toLowerCase().trim()
    const str = (v) => typeof v === 'string' ? v : String(v || '')
    const filtered = strains
      .filter(s => {
        try {
          return (
            str(s.name).toLowerCase().includes(lower) ||
            str(s.type).toLowerCase().includes(lower) ||
            (Array.isArray(s.effects) && s.effects.some(e => effectLabel(e).toLowerCase().includes(lower))) ||
            (Array.isArray(s.flavors) && s.flavors.some(f => str(f).toLowerCase().includes(lower)))
          )
        } catch { return false }
      })

    // Sort: exact name match → most common/popular → least common
    if (filtered.length > 1) {
      filtered.sort((a, b) => {
        // 1. Exact name starts-with match gets top priority
        const aExact = str(a.name).toLowerCase().startsWith(lower) ? 1 : 0
        const bExact = str(b.name).toLowerCase().startsWith(lower) ? 1 : 0
        if (aExact !== bExact) return bExact - aExact

        // 2. Higher availability = more common (5 > 2 > 1)
        const availA = a.availability || 1
        const availB = b.availability || 1
        if (availA !== availB) return availB - availA

        // 3. Regional availability boost (if user has location)
        if (userRegionIndex != null) {
          const regA = a.reg ? (a.reg[userRegionIndex] || 0) : 0
          const regB = b.reg ? (b.reg[userRegionIndex] || 0) : 0
          if (regA !== regB) return regB - regA
        }

        // 4. Higher sentiment = more popular/well-known
        const sentA = a.sentimentScore || 0
        const sentB = b.sentimentScore || 0
        return sentB - sentA
      })
    }

    return filtered.slice(0, 8)
  }, [query, strains, userRegionIndex])

  const handleChange = (e) => {
    setQuery(e.target.value)
    setOpen(true)
    setFocusIdx(-1)
  }

  const handleSelect = (strain) => {
    setQuery(strain.name)
    setOpen(false)
    setFocusIdx(-1)
    onSelect?.(strain)
    // Navigate to the dedicated strain detail page
    navigate(`/strain/${strainSlug(strain.name)}`)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (focusIdx >= 0 && matches[focusIdx]) {
      handleSelect(matches[focusIdx])
      return
    }
    if (query.trim().length >= 2) {
      setOpen(false)
      onSearch?.(query.trim())
    }
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
    }
  }

  const handleRequestStrain = useCallback(async () => {
    const name = query.trim()
    if (!name || requestLoading) return
    setRequestLoading(true)
    setRequestError(null)
    try {
      const result = await requestStrain(name)
      if (result.found && result.strain) {
        setOpen(false)
        navigate(`/strain/${strainSlug(result.strain.name || name)}`)
      }
    } catch (err) {
      setRequestError(err.message || 'Failed to request strain')
    } finally {
      setRequestLoading(false)
    }
  }, [query, requestLoading, navigate])

  const handleClear = () => {
    setQuery('')
    setOpen(false)
    setFocusIdx(-1)
    inputRef.current?.focus()
    onSearch?.('')
  }

  const showDropdown = open && query.trim().length >= 1

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        {/* Icon */}
        {!dataLoaded && query ? (
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
          onChange={handleChange}
          onFocus={() => query.trim().length >= 1 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pl-10 ${showSearchButton ? 'pr-24' : 'pr-9'} py-3 rounded-xl ${inputClassName?.includes('border') ? '' : 'border border-gray-200/50 dark:border-white/10'} bg-gray-50 dark:bg-white/[0.03] text-base text-gray-900 dark:text-[#e8f0ea] placeholder-gray-500 dark:placeholder-[#6a7a6e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 focus:border-leaf-500/40 transition-all shadow-sm ${inputClassName}`}
          aria-label="Search strains"
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown && matches.length > 0}
          aria-haspopup="listbox"
        />

        {/* Clear button */}
        {query && !showSearchButton && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#6a7a6e] hover:text-gray-600 dark:hover:text-[#b0c4b4] transition-colors z-10"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}

        {/* Search submit button (landing page style) */}
        {showSearchButton && (
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-leaf-500 text-leaf-900 text-xs font-semibold hover:bg-leaf-400 transition-colors shadow-md shadow-leaf-500/25 z-10"
          >
            Search
          </button>
        )}
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-gray-200/50 dark:border-white/10 bg-white dark:bg-[#121a14] shadow-2xl shadow-black/25 z-50 overflow-hidden overflow-y-auto"
          style={{ maxHeight: dropdownMaxH }}
          role="listbox"
        >
          {!dataLoaded ? (
            <div className="px-4 py-3 flex items-center gap-2 text-xs text-gray-400 dark:text-[#6a7a6e]">
              <Loader2 size={12} className="animate-spin" />
              Loading strain database...
            </div>
          ) : matches.length === 0 ? (
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-gray-400 dark:text-[#6a7a6e]">
                No strains match &ldquo;{query}&rdquo;
              </p>
              <button
                type="button"
                onClick={handleRequestStrain}
                disabled={requestLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-leaf-500 to-emerald-500 text-white text-xs font-semibold hover:from-leaf-400 hover:to-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requestLoading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Searching sources...
                  </>
                ) : (
                  <>
                    <Plus size={12} />
                    Request This Strain
                  </>
                )}
              </button>
              {requestError && (
                <p className="text-[10px] text-red-400">{requestError}</p>
              )}
            </div>
          ) : (
            matches.map((strain, idx) => {
              const typeColor = strain.type === 'sativa' ? 'text-orange-400' : strain.type === 'indica' ? 'text-purple-400' : 'text-leaf-400'
              const isFocused = idx === focusIdx
              return (
                <button
                  key={strain.id || strain.name}
                  type="button"
                  role="option"
                  aria-selected={isFocused}
                  onClick={() => handleSelect(strain)}
                  onMouseEnter={() => setFocusIdx(idx)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                    isFocused ? 'bg-leaf-500/10' : 'hover:bg-leaf-500/5'
                  } ${idx > 0 ? 'border-t border-gray-100 dark:border-white/[0.04]' : ''}`}
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
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default memo(SearchAutocomplete)
