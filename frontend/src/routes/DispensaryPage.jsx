import { useState, useEffect, useCallback, useContext, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResultsContext } from '../context/ResultsContext'
import { useGeolocation } from '../hooks/useGeolocation'
import { searchDispensaries } from '../services/dispensarySearch'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import {
  MapPin,
  Navigation,
  Search,
  Truck,
  Clock,
  Star,
  Phone,
  ExternalLink,
  Tag,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Filter,
  ArrowUpDown,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  LocationInput (inline)                                            */
/* ------------------------------------------------------------------ */
function LocationInput({ onSubmit, geoLoading, onAutoDetect }) {
  const [manualLocation, setManualLocation] = useState('')

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
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 focus:border-leaf-500/40 transition-all"
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
function DispensaryFilters({ sortBy, onSortChange, filters, onFilterChange }) {
  const sortOptions = [
    { value: 'closest', label: 'Closest' },
    { value: 'rating', label: 'Top Rated' },
    { value: 'deals', label: 'Best Deals' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'cheapest', label: 'Budget' },
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
/*  DispensaryCard (inline)                                           */
/* ------------------------------------------------------------------ */
function DispensaryCardItem({ dispensary }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] truncate">
            {dispensary.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#6a7a6e] mt-0.5">
            <MapPin size={12} />
            <span className="truncate">{dispensary.address}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {dispensary.distance && (
            <span className="text-xs font-medium text-gray-700 dark:text-[#b0c4b4]">
              {dispensary.distance}
            </span>
          )}
          {dispensary.rating && (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              {dispensary.rating}
              {dispensary.reviewCount && (
                <span className="text-gray-400 dark:text-[#5a6a5e]">
                  ({dispensary.reviewCount})
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Details row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-[#6a7a6e] mb-3">
        {dispensary.hours && (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {dispensary.hours}
          </span>
        )}
        {dispensary.delivery && (
          <span className="flex items-center gap-1 text-leaf-500">
            <Truck size={11} />
            Delivery
            {dispensary.deliveryEta && ` (${dispensary.deliveryEta})`}
          </span>
        )}
        {dispensary.priceRange ? (
          <span className="font-medium">{dispensary.priceRange}</span>
        ) : (
          <span className="text-gray-400 dark:text-[#5a6a5e] italic text-[10px]">Check menu for prices</span>
        )}
      </div>

      {/* Matched strains */}
      {dispensary.matchedStrains?.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] uppercase tracking-wider text-leaf-400 block mb-1">
            Your Strains In Stock
          </span>
          <div className="flex flex-wrap gap-1">
            {dispensary.matchedStrains.map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 rounded-md text-[10px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Alternative strains */}
      {dispensary.alternativeStrains?.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] uppercase tracking-wider text-blue-400 block mb-1">
            Similar Alternatives
          </span>
          <div className="flex flex-wrap gap-1">
            {dispensary.alternativeStrains.map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 rounded-md text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Deals */}
      {dispensary.deals?.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5">
            {dispensary.deals.map((deal, i) => (
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

      {/* Action row */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
        {dispensary.phone && (
          <a
            href={`tel:${dispensary.phone}`}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-[#8a9a8e] hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors"
          >
            <Phone size={12} />
            Call
          </a>
        )}
        {dispensary.website && (
          <a
            href={dispensary.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-[#8a9a8e] hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors"
          >
            <ExternalLink size={12} />
            Website
          </a>
        )}
        {dispensary.menuUrl && (
          <a
            href={dispensary.menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-leaf-500/10 text-leaf-400 hover:bg-leaf-500/20 transition-colors ml-auto"
          >
            View Menu
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  DispensaryPage                                                    */
/* ------------------------------------------------------------------ */
export default function DispensaryPage() {
  const navigate = useNavigate()
  const { state: resultsState } = useContext(ResultsContext)
  const { location: geoLocation, error: geoError, loading: geoLoading, requestLocation } = useGeolocation()

  const [dispensaries, setDispensaries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [locationUsed, setLocationUsed] = useState(null)
  const [sortBy, setSortBy] = useState('closest')

  const strainNames = useMemo(
    () => (resultsState.strains || []).map((s) => s.name),
    [resultsState.strains]
  )

  /* Search dispensaries ---------------------------------------------- */
  const doSearch = useCallback(
    async (loc) => {
      setLoading(true)
      setError(null)
      setLocationUsed(typeof loc === 'string' ? loc : 'Current location')
      try {
        const results = await searchDispensaries(loc, strainNames)
        setDispensaries(results)
      } catch (err) {
        console.error('Dispensary search error:', err)
        setError(err.message || 'Failed to find dispensaries. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    [strainNames]
  )

  /* Auto-detect callback -------------------------------------------- */
  const handleAutoDetect = useCallback(() => {
    requestLocation()
  }, [requestLocation])

  /* When geo location arrives --------------------------------------- */
  useEffect(() => {
    if (geoLocation && !loading && dispensaries.length === 0) {
      doSearch(geoLocation)
    }
  }, [geoLocation]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Sort dispensaries ------------------------------------------------ */
  const sortedDispensaries = useMemo(() => {
    const list = [...dispensaries]
    switch (sortBy) {
      case 'closest':
        return list.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
      case 'rating':
        return list.sort((a, b) => (b.rating || 0) - (a.rating || 0))
      case 'deals':
        return list.sort((a, b) => (b.deals?.length || 0) - (a.deals?.length || 0))
      case 'delivery':
        return list.sort((a, b) => (b.delivery ? 1 : 0) - (a.delivery ? 1 : 0))
      case 'cheapest':
        return list.sort((a, b) => (a.priceRange?.length || 2) - (b.priceRange?.length || 2))
      default:
        return list
    }
  }, [dispensaries, sortBy])

  /* No strains state ------------------------------------------------ */
  if (!resultsState.strains || resultsState.strains.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center mb-4">
          <MapPin size={28} className="text-gray-300 dark:text-[#3a4a3e]" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">
          Find Dispensaries
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e] text-center max-w-xs mb-6">
          Take the quiz first to get strain recommendations, then we'll help you find them nearby.
        </p>
        <Button onClick={() => navigate('/')}>
          Take the Quiz
        </Button>
      </div>
    )
  }

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
            Find your matched strains nearby
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/results')}>
          <ChevronLeft size={14} />
          Back to Strains
        </Button>
      </div>

      {/* Location input */}
      <Card className="p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4] mb-3 flex items-center gap-2">
          <Navigation size={14} />
          Your Location
        </h2>
        <LocationInput
          onSubmit={doSearch}
          geoLoading={geoLoading}
          onAutoDetect={handleAutoDetect}
        />
        {geoError && (
          <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} />
            {geoError}
          </p>
        )}
        {locationUsed && !loading && (
          <p className="mt-2 text-xs text-gray-400 dark:text-[#5a6a5e]">
            Showing results for: <strong className="text-gray-600 dark:text-[#8a9a8e]">{locationUsed}</strong>
          </p>
        )}
      </Card>

      {/* Searching strains note */}
      {strainNames.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] mb-1.5">
            Searching for {strainNames.length} strains
          </p>
          <div className="flex flex-wrap gap-1">
            {strainNames.slice(0, 7).map((name) => (
              <span
                key={name}
                className="px-2 py-0.5 rounded-md text-[10px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20"
              >
                {name}
              </span>
            ))}
            {strainNames.length > 7 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                +{strainNames.length - 7} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">
            Searching real dispensaries near you...
          </p>
          <p className="text-xs text-gray-400 dark:text-[#5a6a5e]">
            This may take 15-30 seconds
          </p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="p-6 text-center mb-6">
          <AlertCircle size={24} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-[#8a9a8e] mb-3">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => doSearch(locationUsed)}>
            Try Again
          </Button>
        </Card>
      )}

      {/* Results */}
      {!loading && dispensaries.length > 0 && (
        <>
          <DispensaryFilters
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          <div className="space-y-4 mb-8">
            {sortedDispensaries.map((d) => (
              <DispensaryCardItem key={d.id} dispensary={d} />
            ))}
          </div>
        </>
      )}

      {/* No results */}
      {!loading && !error && dispensaries.length === 0 && locationUsed && (
        <div className="text-center py-12 text-sm text-gray-400 dark:text-[#5a6a5e]">
          No dispensaries found in this area. Try a different location.
        </div>
      )}
    </div>
  )
}
