import { useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'
import { ResultsContext } from '../context/ResultsContext'
import { QuizContext } from '../context/QuizContext'
import { useGeolocation } from '../hooks/useGeolocation'
import { fetchCities, searchByCity, fetchDispensaryMenu, searchDispensaries, fetchStrainAvailabilityForCity, KNOWN_CITIES } from '../services/dispensarySearch'
import CitySelector from '../components/dispensary/CitySelector'
import DispensaryDrawer from '../components/dispensary/DispensaryDrawer'
import DispensaryMap from '../components/dispensary/DispensaryMap'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import {
  MapPin,
  Navigation,
  Search,
  Truck,
  Clock,
  Star,
  ExternalLink,
  Tag,
  ChevronLeft,
  Loader2,
  AlertCircle,
  ArrowUpDown,
  ShoppingBag,
  Store,
  Leaf,
  Sparkles,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  LocationInput (inline)                                            */
/* ------------------------------------------------------------------ */
function LocationInput({ onSubmit, geoLoading, onAutoDetect, initialZip }) {
  const [manualLocation, setManualLocation] = useState(initialZip || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (manualLocation.trim()) {
      onSubmit(manualLocation.trim())
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5a6a5e]" />
          <input
            type="text"
            value={manualLocation}
            onChange={(e) => setManualLocation(e.target.value)}
            placeholder="Enter zip code or city..."
            className="w-full pl-9 pr-4 py-2.5 text-base rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 focus:border-leaf-500/40 transition-all"
          />
        </div>
        <Button type="submit" size="md" disabled={!manualLocation.trim()}>
          Search
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200 dark:bg-white/[0.06]" />
        <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] uppercase tracking-wider">or</span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-white/[0.06]" />
      </div>

      <Button
        variant="secondary"
        size="full"
        onClick={onAutoDetect}
        disabled={geoLoading}
      >
        {geoLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Navigation size={16} />
        )}
        {geoLoading ? 'Detecting location...' : 'Use My Current Location'}
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  DispensaryFilters (inline)                                        */
/* ------------------------------------------------------------------ */
function DispensaryFilters({ sortBy, onSortChange }) {
  const sortOptions = [
    { value: 'matches', label: 'Most Matches' },
    { value: 'rating', label: 'Top Rated' },
    { value: 'delivery', label: 'Delivery' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <ArrowUpDown size={12} className="text-gray-400 dark:text-[#5a6a5e]" />
      {sortOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSortChange(opt.value)}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 ${
            sortBy === opt.value
              ? 'bg-leaf-500/15 text-leaf-400 border border-leaf-500/30'
              : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border border-transparent hover:bg-gray-200 dark:hover:bg-white/[0.08]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  DispensaryCard (inline — clickable to open drawer)                */
/* ------------------------------------------------------------------ */
function DispensaryCardItem({ dispensary, onClick, onViewPage, highlightStrain, strainAvailability = {}, isLocationMode }) {
  const d = dispensary
  const stockInfo = highlightStrain ? strainAvailability[d.id] : null
  const hasStrain = !!stockInfo?.inStock
  const hasAvailabilityData = highlightStrain && Object.keys(strainAvailability).length > 0

  return (
    <Card
      className={`p-4 cursor-pointer hover:border-leaf-500/20 transition-all duration-200 ${
        hasStrain ? 'ring-1 ring-leaf-500/30 border-leaf-500/20' : ''
      } ${hasAvailabilityData && !hasStrain ? 'opacity-60' : ''}`}
      onClick={() => onClick?.(d)}
    >
      {/* Strain availability badge */}
      {hasAvailabilityData && (
        <div className={`flex items-center gap-2 mb-3 px-2.5 py-2 rounded-lg ${
          hasStrain
            ? 'bg-leaf-500/[0.08] border border-leaf-500/20'
            : 'bg-gray-500/[0.04] border border-gray-500/10'
        }`}>
          {hasStrain ? (
            <>
              <Sparkles size={13} className="text-leaf-400 flex-shrink-0" />
              <span className="text-[11px] font-bold text-leaf-400">
                {highlightStrain} is in stock
                {stockInfo.price && <span className="font-normal text-[#8a9a8e]"> · {stockInfo.price}</span>}
              </span>
            </>
          ) : (
            <>
              <AlertCircle size={13} className="text-gray-400 dark:text-[#5a6a5e] flex-shrink-0" />
              <span className="text-[11px] text-gray-400 dark:text-[#5a6a5e]">
                {highlightStrain} not found on menu
              </span>
            </>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3
            className="text-base font-bold text-leaf-500 hover:text-leaf-400 truncate transition-colors cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onViewPage?.(d) }}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onViewPage?.(d) } }}
          >
            {d.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#6a7a6e] mt-0.5">
            <MapPin size={12} />
            <span className="truncate">{d.address}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {d.distance && (
            <span className="text-xs font-medium text-gray-700 dark:text-[#b0c4b4]">
              {d.distance}
            </span>
          )}
          {d.rating && (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              {d.rating}
              {d.reviewCount > 0 && (
                <span className="text-gray-400 dark:text-[#5a6a5e]">
                  ({d.reviewCount})
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Details row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-[#6a7a6e] mb-3">
        {d.hours && (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {d.hours}
          </span>
        )}
        {d.delivery && (
          <span className="flex items-center gap-1 text-leaf-500">
            <Truck size={11} />
            Delivery
            {d.deliveryEta && ` · ${d.deliveryEta}`}
            {d.deliveryFee && ` · ${d.deliveryFee}`}
          </span>
        )}
        {d.deliveryMin && d.delivery && (
          <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
            Min: {d.deliveryMin}
          </span>
        )}
        {d.pickupReady && (
          <span className="flex items-center gap-1 text-blue-400">
            <ShoppingBag size={11} />
            Pickup {d.pickupReady}
          </span>
        )}
      </div>

      {/* No menu available indicator */}
      {d.matchType === 'noMenu' && (
        <div className="flex items-center gap-2 mb-3 px-2.5 py-2 rounded-lg bg-red-500/[0.06] border border-red-500/15">
          <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
          <span className="text-[11px] text-red-400 font-medium">
            No menu available for this dispensary
          </span>
        </div>
      )}

      {/* Menu match summary (for city-mode) */}
      {d.menuSummary && d.menuSummary.matched > 0 && (
        <div className="mb-3">
          <span className="text-[10px] uppercase tracking-wider text-leaf-400 block mb-1">
            {d.menuSummary.matched} of {d.menuSummary.total} strains in our database
          </span>
          <div className="flex flex-wrap gap-1">
            {d.menuSummary.topMatches?.map((name, idx) => (
              <span
                key={`${name}-${idx}`}
                className="px-2 py-0.5 rounded-md text-[10px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20"
              >
                {name}
              </span>
            ))}
            {d.menuSummary.matched > 3 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                +{d.menuSummary.matched - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Legacy matched strains (for location-mode / demo data) */}
      {!d.menuSummary && d.matchedStrains?.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] uppercase tracking-wider text-leaf-400 block mb-1">
            Your Strains In Stock
          </span>
          <div className="flex flex-wrap gap-1">
            {d.matchedStrains.map((s, idx) => {
              const name = typeof s === 'string' ? s : s.name
              const price = typeof s === 'object' ? s.price : null
              return (
                <span
                  key={`${name}-${idx}`}
                  className="px-2 py-0.5 rounded-md text-[10px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20"
                >
                  {name}{price ? ` · ${price}` : ''}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Deals */}
      {d.deals?.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5">
            {d.deals.map((deal, i) => (
              <span
                key={i}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20"
              >
                <Tag size={10} />
                {deal}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Source links */}
      {(d.wmUrl || d.leaflyUrl) && (
        <div className="flex items-center gap-2 mb-2">
          {d.wmUrl && (
            <a
              href={d.wmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-leaf-400/60 hover:text-leaf-400 transition-colors flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={10} />
              Weedmaps
            </a>
          )}
          {d.leaflyUrl && (
            <a
              href={d.leaflyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-leaf-400/60 hover:text-leaf-400 transition-colors flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={10} />
              Leafly
            </a>
          )}
          {d.sources?.length > 1 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-leaf-500/10 text-leaf-400 border border-leaf-500/20 font-medium">
              {d.sources.length} sources
            </span>
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/[0.04]">
        <span className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-[#5a6a5e]">
          {d.serviceType === 'delivery_only'
            ? <Truck size={11} className="text-blue-400/60" />
            : <Store size={11} className="text-leaf-400/60" />
          }
          Tap for quick view
        </span>
        {onViewPage && d.matchType !== 'noMenu' && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewPage(d) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-leaf-500/15 text-leaf-400 border border-leaf-500/25 hover:bg-leaf-500/25 transition-all min-h-[44px]"
          >
            <Leaf size={12} />
            View Menu
          </button>
        )}
        {d.matchType === 'noMenu' && (d.wmUrl || d.leaflyUrl) && (
          <a
            href={d.wmUrl || d.leaflyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border border-gray-200 dark:border-white/[0.08] hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-all min-h-[44px]"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
            {d.wmUrl ? 'Weedmaps' : 'Leafly'}
          </a>
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Enhanced Menu Drawer — shows matched strains with our data        */
/* ------------------------------------------------------------------ */
function EnhancedMenuDrawer({ dispensary, menuData, open, onClose, loading, detailUrl }) {
  if (!dispensary) return null

  const d = dispensary
  const matched = menuData?.matchedMenu || []
  const unmatchedCount = menuData?.unmatchedCount || 0

  return (
    <DispensaryDrawer
      dispensary={{
        ...d,
        matchedStrains: matched.length > 0
          ? matched.map(m => ({
              name: m.strain?.name || m.menuName,
              price: m.price,
              inStock: true,
              strainMenuUrl: null,
            }))
          : d.matchedStrains || [],
        alternativeStrains: d.alternativeStrains || [],
      }}
      open={open}
      onClose={onClose}
      detailUrl={detailUrl}
    >
      {/* Enhanced strain details section */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-3">
          <Loader2 size={16} className="animate-spin text-leaf-400" />
          <span className="text-sm text-gray-500 dark:text-[#8a9a8e]">Loading enhanced menu...</span>
        </div>
      )}

      {!loading && matched.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[10px] uppercase tracking-wider text-leaf-400 font-bold mb-3 flex items-center gap-1.5">
            <Sparkles size={11} />
            Enhanced Menu — {matched.length} Strains Matched
          </h3>
          <div className="space-y-2">
            {matched.map((item, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-leaf-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-[#e8f0ea] truncate">
                      {item.strain?.name || item.menuName}
                    </span>
                    {item.strain?.matchTier === 'fuzzy' && (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        ~match
                      </span>
                    )}
                  </div>
                  {item.price && (
                    <span className="text-xs font-bold text-leaf-500 flex-shrink-0">
                      {item.price}
                    </span>
                  )}
                </div>

                {/* Strain detail chips */}
                <div className="flex flex-wrap gap-1.5">
                  {item.strain?.type && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/15">
                      {item.strain.type}
                    </span>
                  )}
                  {item.strain?.thc != null && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-500/10 text-green-400 border border-green-500/15">
                      THC {item.strain.thc}%
                    </span>
                  )}
                  {item.strain?.cbd != null && item.strain.cbd > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/15">
                      CBD {item.strain.cbd}%
                    </span>
                  )}
                  {item.strain?.topTerpenes?.map((t, j) => (
                    <span key={j} className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/5 text-amber-400/80 border border-amber-500/10">
                      {t}
                    </span>
                  ))}
                </div>

                {/* Effects */}
                {item.strain?.topEffects?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.strain.topEffects.map((e, j) => (
                      <span key={j} className="text-[9px] text-gray-500 dark:text-[#6a7a6e]">
                        {e}{j < item.strain.topEffects.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Link to our strain detail page */}
                {item.strain?.slug && (
                  <Link
                    to={`/strain/${item.strain.slug}`}
                    className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-leaf-400/70 hover:text-leaf-400 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Leaf size={10} />
                    View full strain profile
                  </Link>
                )}
              </div>
            ))}
          </div>

          {unmatchedCount > 0 && (
            <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mt-3 text-center">
              + {unmatchedCount} additional items not in our database
            </p>
          )}
        </div>
      )}
    </DispensaryDrawer>
  )
}

/* ------------------------------------------------------------------ */
/*  DispensaryPage — Main component                                   */
/* ------------------------------------------------------------------ */
export default function DispensaryPage() {
  usePageTitle('Dispensaries')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightStrain = searchParams.get('highlight') || null
  const autoSearch = searchParams.get('autoSearch') === '1'
  const urlZip = searchParams.get('zip') || ''
  const { state: resultsState } = useContext(ResultsContext)
  const quizCtx = useContext(QuizContext)
  const quizZipCode = urlZip || quizCtx?.state?.zipCode || ''
  const { location: geoLocation, error: geoError, loading: geoLoading, requestLocation } = useGeolocation()

  // City-based state (primary mode)
  const [cities, setCities] = useState([])
  const [citiesLoading, setCitiesLoading] = useState(true)
  const [citiesUpdatedAt, setCitiesUpdatedAt] = useState(null)
  const [activeCity, setActiveCity] = useState(null)
  const [cityData, setCityData] = useState(null)
  const [cityLoading, setCityLoading] = useState(false)

  // Location-based state (fallback mode)
  const [locationDispensaries, setLocationDispensaries] = useState([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationUsed, setLocationUsed] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [locationCenter, setLocationCenter] = useState(null)
  const [cityRedirectNotice, setCityRedirectNotice] = useState(null)

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerDispensary, setDrawerDispensary] = useState(null)
  const [drawerMenuData, setDrawerMenuData] = useState(null)
  const [drawerMenuLoading, setDrawerMenuLoading] = useState(false)

  // Sorting + service tab
  const [sortBy, setSortBy] = useState('matches')
  const [serviceTab, setServiceTab] = useState('dispensaries') // 'dispensaries' | 'delivery'

  // Strain availability (when highlightStrain is set)
  const [strainAvailability, setStrainAvailability] = useState({}) // { dispensaryId: { inStock, price, menuName } }
  const [availabilityLoading, setAvailabilityLoading] = useState(false)

  // Determine mode
  const mode = activeCity ? 'city' : locationUsed ? 'location' : null
  const allDispensaries = mode === 'city' ? (cityData?.dispensaries || []) : locationDispensaries

  // Filter by service tab
  const dispensaries = useMemo(() => {
    if (serviceTab === 'delivery') {
      return allDispensaries.filter(d => d.delivery)
    }
    // 'dispensaries' tab — show storefronts (includes those with both storefront + delivery)
    return allDispensaries.filter(d => d.storefront !== false)
  }, [allDispensaries, serviceTab])

  // Count for tab badges
  const deliveryCount = useMemo(() => allDispensaries.filter(d => d.delivery).length, [allDispensaries])
  const storefrontCount = useMemo(() => allDispensaries.filter(d => d.storefront !== false).length, [allDispensaries])
  const error = locationError

  const strainNames = useMemo(
    () => (resultsState.strains || []).map(s => s.name),
    [resultsState.strains]
  )

  /* Load available cities on mount */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        let data = await fetchCities()
        // Fallback to hardcoded list when KV cities:index is empty
        if (!data.length) data = KNOWN_CITIES
        if (!cancelled) {
          setCities(data)
          setCitiesUpdatedAt(data[0]?.updatedAt || null)
        }
      } catch {
        // Cities unavailable — use hardcoded fallback
        if (!cancelled) setCities(KNOWN_CITIES)
      } finally {
        if (!cancelled) setCitiesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  /* Fetch strain availability when highlightStrain + city data are ready */
  useEffect(() => {
    if (!highlightStrain || !activeCity || !cityData?.dispensaryCount) return
    let cancelled = false
    setAvailabilityLoading(true)
    fetchStrainAvailabilityForCity(activeCity, highlightStrain, cityData.dispensaryCount)
      .then(avail => {
        if (!cancelled) setStrainAvailability(avail)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAvailabilityLoading(false) })
    return () => { cancelled = true }
  }, [highlightStrain, activeCity, cityData?.dispensaryCount])

  /* Auto-search when arriving from "Find Near Me" button with autoSearch=1 */
  const hasAutoSearched = useRef(false)
  useEffect(() => {
    if (!autoSearch || hasAutoSearched.current || citiesLoading) return
    hasAutoSearched.current = true

    if (quizZipCode) {
      // Use zip code to search — handleLocationSearch will be available after first render
      handleLocationSearch(quizZipCode)
    } else {
      // No zip — request browser geolocation
      requestLocation()
    }
  }, [autoSearch, citiesLoading, quizZipCode]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Select city */
  const handleCitySelect = useCallback(async (citySlug) => {
    if (citySlug === activeCity) return
    setActiveCity(citySlug)
    setCityLoading(true)
    setLocationUsed(null)
    setLocationDispensaries([])

    try {
      const data = await searchByCity(citySlug)
      setCityData(data)
    } catch (err) {
      console.error('City fetch error:', err)
      setCityData({ available: false, dispensaries: [] })
    } finally {
      setCityLoading(false)
    }
  }, [activeCity])

  /* Location-based search */
  const handleLocationSearch = useCallback(async (loc) => {
    setActiveCity(null)
    setCityData(null)
    setLocationError(null)
    setLocationCenter(null)
    setCityRedirectNotice(null)
    setLocationUsed(typeof loc === 'string' ? loc : 'Your location')
    setLocationLoading(true)

    try {
      const results = await searchDispensaries(loc, strainNames)

      // Handle city redirect — nearby pre-harvested city found
      if (results._cityRedirect) {
        setCityRedirectNotice(`Found nearby city: ${results.cityLabel} — showing full strain availability!`)
        setLocationUsed(null)
        setLocationLoading(false)
        handleCitySelect(results.citySlug)
        return
      }

      // Direct results with center coordinates
      setLocationDispensaries(results.dispensaries || results)
      if (results.center) {
        setLocationCenter(results.center)
      }
    } catch (err) {
      setLocationError(err.message || 'Search failed')
    } finally {
      setLocationLoading(false)
    }
  }, [strainNames, handleCitySelect])

  /* Auto-detect location */
  const handleAutoDetect = useCallback(() => {
    requestLocation()
  }, [requestLocation])

  useEffect(() => {
    if (geoLocation && !locationLoading) {
      handleLocationSearch(geoLocation)
    }
  }, [geoLocation]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Navigate to full dispensary menu page (from map popup "View Menu" or card name click) */
  const handleViewMenu = useCallback((dispensary) => {
    if (activeCity) {
      // City mode — internal cross-referenced menu page (pass state for instant rendering)
      navigate(`/dispensary/${activeCity}/${dispensary.id}`, { state: { dispensary } })
    } else {
      // Location mode — internal menu page (fetches + cross-refs Weedmaps menu)
      navigate(`/dispensary/nearby/${dispensary.id}`, { state: { dispensary } })
    }
  }, [activeCity, navigate])

  /* Open dispensary drawer — load full menu if in city mode */
  const handleCardClick = useCallback(async (dispensary) => {
    setDrawerDispensary(dispensary)
    setDrawerOpen(true)
    setDrawerMenuData(null)

    if (activeCity && dispensary.id) {
      setDrawerMenuLoading(true)
      try {
        const detail = await fetchDispensaryMenu(activeCity, dispensary.id)
        setDrawerMenuData(detail)
      } catch {
        // Menu unavailable — drawer still shows basic info
      } finally {
        setDrawerMenuLoading(false)
      }
    }
  }, [activeCity])

  /* Sort dispensaries — when highlightStrain is set, prioritize dispensaries that have it in stock */
  const sortedDispensaries = useMemo(() => {
    const list = [...dispensaries]

    // When highlightStrain is active with availability data, sort in-stock to the top
    if (highlightStrain && Object.keys(strainAvailability).length > 0) {
      list.sort((a, b) => {
        const aInStock = strainAvailability[a.id]?.inStock ? 1 : 0
        const bInStock = strainAvailability[b.id]?.inStock ? 1 : 0
        if (aInStock !== bInStock) return bInStock - aInStock
        // Secondary sort within each group
        return (b.menuSummary?.matched || 0) - (a.menuSummary?.matched || 0)
      })
      return list
    }

    switch (sortBy) {
      case 'matches':
        return list.sort((a, b) => (b.menuSummary?.matched || b.matchedStrains?.length || 0) - (a.menuSummary?.matched || a.matchedStrains?.length || 0))
      case 'rating':
        return list.sort((a, b) => (b.rating || 0) - (a.rating || 0))
      case 'delivery':
        return list.sort((a, b) => (b.delivery ? 1 : 0) - (a.delivery ? 1 : 0))
      default:
        return list
    }
  }, [dispensaries, sortBy, highlightStrain, strainAvailability])

  /* Map center — city coords → location center → geolocation → compute from dispensary positions */
  const mapCenter = useMemo(() => {
    if (mode === 'city' && cityData?.lat && cityData?.lng) {
      return { lat: cityData.lat, lng: cityData.lng }
    }
    if (locationCenter?.lat && locationCenter?.lng) {
      return locationCenter
    }
    if (geoLocation?.lat && geoLocation?.lng) {
      return geoLocation
    }
    // Compute center from dispensary coordinates as fallback (location-mode)
    const located = allDispensaries.filter(d => d.lat && d.lng)
    if (located.length > 0) {
      const avgLat = located.reduce((sum, d) => sum + d.lat, 0) / located.length
      const avgLng = located.reduce((sum, d) => sum + d.lng, 0) / located.length
      return { lat: avgLat, lng: avgLng }
    }
    return null
  }, [mode, cityData, locationCenter, geoLocation, allDispensaries])

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Dispensaries
          </h1>
          <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-0.5">
            Real menus, matched with our strain data
          </p>
        </div>
        {resultsState.strains?.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => navigate('/results')}>
            <ChevronLeft size={14} />
            My Strains
          </Button>
        )}
      </div>

      {/* Highlight banner when arriving from strain detail page */}
      {highlightStrain && (() => {
        const inStockCount = Object.keys(strainAvailability).length
        const hasAvailability = inStockCount > 0 && !availabilityLoading
        return (
          <div className={`flex items-center gap-3 p-3 mb-4 rounded-xl border animate-fade-in ${
            hasAvailability
              ? 'bg-leaf-500/[0.08] border-leaf-500/20'
              : 'bg-leaf-500/[0.06] border-leaf-500/15'
          }`}>
            <Leaf size={16} className="text-leaf-500 flex-shrink-0" />
            <p className="text-xs text-gray-700 dark:text-[#b0c4b4]">
              {(locationLoading || cityLoading)
                ? <>Searching for <strong className="text-leaf-500">{highlightStrain}</strong> near you...</>
                : availabilityLoading
                  ? <>Checking menus for <strong className="text-leaf-500">{highlightStrain}</strong>...</>
                  : hasAvailability
                    ? <><strong className="text-leaf-500">{inStockCount} {inStockCount === 1 ? 'dispensary has' : 'dispensaries have'}</strong> <strong>{highlightStrain}</strong> in stock right now</>
                    : mode
                      ? <><strong className="text-leaf-500">{highlightStrain}</strong> was not found on any dispensary menu in this area</>
                      : <>Looking for <strong className="text-leaf-500">{highlightStrain}</strong> — select a city or search a location to find dispensaries carrying this strain</>
              }
            </p>
          </div>
        )
      })()}

      {/* City Selector — primary way to browse */}
      <CitySelector
        cities={cities}
        activeCity={activeCity}
        onSelect={handleCitySelect}
        loading={citiesLoading}
        updatedAt={citiesUpdatedAt}
      />

      {/* THC-A city banner */}
      {activeCity && cities.find(c => c.slug === activeCity)?.thca && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 mb-4 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 animate-fade-in">
          <Leaf size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-amber-400 mb-0.5">THC-A Market</p>
            <p className="text-[10px] text-gray-500 dark:text-[#8a9a8e] leading-relaxed">
              This area sells legal hemp-derived THC-A flower. Products may differ from traditional dispensaries — same strains, federally legal under the 2018 Farm Bill.
            </p>
          </div>
        </div>
      )}

      {/* City redirect notice — shown when zip search auto-redirected to a pre-harvested city */}
      {cityRedirectNotice && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 mb-4 rounded-xl bg-leaf-500/[0.08] border border-leaf-500/20 animate-fade-in">
          <Sparkles size={14} className="text-leaf-400 flex-shrink-0" />
          <p className="text-[11px] text-leaf-400 font-medium">{cityRedirectNotice}</p>
        </div>
      )}

      {/* Location Input — alternative / fallback */}
      <Card className="p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4] mb-3 flex items-center gap-2">
          <Navigation size={14} />
          Search by Location
        </h2>
        <LocationInput
          onSubmit={handleLocationSearch}
          geoLoading={geoLoading}
          onAutoDetect={handleAutoDetect}
          initialZip={quizZipCode}
        />
        {geoError && (
          <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} />
            {geoError}
          </p>
        )}
      </Card>

      {/* Active context indicator */}
      {mode && !cityLoading && !locationLoading && (
        <div className="mb-4 text-xs text-gray-400 dark:text-[#5a6a5e]">
          {mode === 'city' && cityData?.available && (
            <span>
              Showing <strong className="text-gray-600 dark:text-[#8a9a8e]">{cityData.dispensaryCount}</strong> {cityData.thca ? 'shops' : 'dispensaries'} in{' '}
              <strong className="text-gray-600 dark:text-[#8a9a8e]">{cityData.label}</strong>
              {cityData.thca && <> &middot; <strong className="text-amber-400">THC-A</strong></>}
              {cityData.matchedStrainCount > 0 && (
                <> &middot; <strong className="text-leaf-400">{cityData.matchedStrainCount}</strong> strains matched</>
              )}
            </span>
          )}
          {mode === 'location' && locationUsed && (
            <span>
              Showing results for: <strong className="text-gray-600 dark:text-[#8a9a8e]">{locationUsed}</strong>
            </span>
          )}
        </div>
      )}

      {/* Map — only render when we have a center or dispensaries with coordinates */}
      {allDispensaries.length > 0 && !cityLoading && !locationLoading && (mapCenter || allDispensaries.some(d => d.lat && d.lng)) && (
        <div className="mb-6">
          <DispensaryMap
            dispensaries={dispensaries}
            center={mapCenter}
            zoom={mode === 'city' ? 11 : 12}
            onViewMenu={handleViewMenu}
            serviceTab={serviceTab}
          />
        </div>
      )}

      {/* Loading */}
      {(cityLoading || locationLoading) && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">
            {cityLoading ? 'Loading dispensaries...' : 'Searching nearby...'}
          </p>
        </div>
      )}

      {/* Error */}
      {error && !locationLoading && (
        <Card className="p-6 mb-6">
          <div className="text-center">
            <AlertCircle size={24} className="text-red-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-[#8a9a8e] mb-3">{error}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="secondary" size="sm" onClick={() => handleLocationSearch(locationUsed)}>
                Try Again
              </Button>
              <a
                href={`https://weedmaps.com/dispensaries/near?q=${encodeURIComponent(locationUsed || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-[#8a9a8e] hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors"
              >
                <ExternalLink size={12} />
                Try Weedmaps
              </a>
            </div>
          </div>
        </Card>
      )}

      {/* City not available yet */}
      {mode === 'city' && cityData && !cityData.available && !cityLoading && (
        <Card className="p-6 mb-6">
          <div className="text-center">
            <Clock size={24} className="text-amber-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-gray-800 dark:text-[#e8f0ea] mb-2">
              Data Updating
            </h3>
            <p className="text-xs text-gray-500 dark:text-[#8a9a8e] max-w-xs mx-auto">
              Dispensary data for this city is being refreshed. Menu data updates daily at 6 AM PT.
            </p>
          </div>
        </Card>
      )}

      {/* Service type toggle — Dispensaries / Delivery */}
      {!cityLoading && !locationLoading && allDispensaries.length > 0 && (
        <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] mb-4">
          <button
            onClick={() => setServiceTab('dispensaries')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 min-h-[44px] ${
              serviceTab === 'dispensaries'
                ? 'bg-white dark:bg-white/[0.1] text-gray-900 dark:text-[#e8f0ea] shadow-sm'
                : 'text-gray-500 dark:text-[#6a7a6e] hover:text-gray-700 dark:hover:text-[#8a9a8e]'
            }`}
          >
            <Store size={14} />
            Dispensaries
            {storefrontCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                serviceTab === 'dispensaries' ? 'bg-leaf-500/15 text-leaf-500' : 'bg-gray-200 dark:bg-white/[0.06] text-gray-400 dark:text-[#5a6a5e]'
              }`}>{storefrontCount}</span>
            )}
          </button>
          <button
            onClick={() => setServiceTab('delivery')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 min-h-[44px] ${
              serviceTab === 'delivery'
                ? 'bg-white dark:bg-white/[0.1] text-gray-900 dark:text-[#e8f0ea] shadow-sm'
                : 'text-gray-500 dark:text-[#6a7a6e] hover:text-gray-700 dark:hover:text-[#8a9a8e]'
            }`}
          >
            <Truck size={14} />
            Delivery
            {deliveryCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                serviceTab === 'delivery' ? 'bg-leaf-500/15 text-leaf-500' : 'bg-gray-200 dark:bg-white/[0.06] text-gray-400 dark:text-[#5a6a5e]'
              }`}>{deliveryCount}</span>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {!cityLoading && !locationLoading && dispensaries.length > 0 && (
        <>
          <DispensaryFilters sortBy={sortBy} onSortChange={setSortBy} />

          <div className="space-y-4 mb-8">
            {sortedDispensaries.map((d) => (
              <DispensaryCardItem
                key={d.id}
                dispensary={d}
                onClick={handleCardClick}
                onViewPage={handleViewMenu}
                highlightStrain={highlightStrain}
                strainAvailability={strainAvailability}
                isLocationMode={mode === 'location'}
              />
            ))}
          </div>
        </>
      )}

      {/* No results */}
      {!cityLoading && !locationLoading && !error && dispensaries.length === 0 && mode && (
        <div className="text-center py-12 text-sm text-gray-400 dark:text-[#5a6a5e]">
          {serviceTab === 'delivery' && allDispensaries.length > 0
            ? 'No delivery services found in this area. Try the Dispensaries tab.'
            : 'No dispensaries found. Try selecting a different city or location.'}
        </div>
      )}

      {/* Welcome state — no mode selected yet */}
      {!mode && !citiesLoading && (
        <div className="text-center py-12 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-leaf-500/10 flex items-center justify-center mx-auto mb-4">
            <Store size={28} className="text-leaf-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">
            Find Real Dispensaries
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#8a9a8e] max-w-xs mx-auto mb-2">
            Browse dispensaries in our featured cities, or search by your location.
            Menu data is updated daily.
          </p>
          <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
            Powered by real dispensary menus matched with our strain database
          </p>
        </div>
      )}

      {/* Dispensary Drawer (enhanced with menu data in city mode) */}
      {activeCity ? (
        <EnhancedMenuDrawer
          dispensary={drawerDispensary}
          menuData={drawerMenuData}
          open={drawerOpen}
          onClose={() => { setDrawerOpen(false); setDrawerDispensary(null); setDrawerMenuData(null) }}
          loading={drawerMenuLoading}
          detailUrl={drawerDispensary ? `/dispensary/${activeCity}/${drawerDispensary.id}` : null}
        />
      ) : (
        <DispensaryDrawer
          dispensary={drawerDispensary}
          open={drawerOpen}
          onClose={() => { setDrawerOpen(false); setDrawerDispensary(null) }}
          detailUrl={drawerDispensary ? `/dispensary/nearby/${drawerDispensary.id}` : null}
        />
      )}
    </div>
  )
}
