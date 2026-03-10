import { MapPin, Store, Clock } from 'lucide-react'

/**
 * CitySelector — horizontal scrollable row of city cards.
 *
 * Props:
 *   cities — array of { slug, label, dispensaryCount, matchedStrainCount }
 *   activeCity — currently selected city slug (or null)
 *   onSelect — (citySlug) => void
 *   loading — boolean
 *   updatedAt — ISO timestamp string (from the cities index)
 */
export default function CitySelector({ cities = [], activeCity, onSelect, loading, updatedAt }) {
  if (cities.length === 0 && !loading) return null

  const formatUpdated = (iso) => {
    if (!iso) return null
    try {
      const d = new Date(iso)
      const now = new Date()
      const hoursAgo = Math.round((now - d) / (1000 * 60 * 60))
      if (hoursAgo < 1) return 'Updated just now'
      if (hoursAgo < 24) return `Updated ${hoursAgo}h ago`
      return `Updated ${d.toLocaleDateString()}`
    } catch {
      return null
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4] flex items-center gap-2">
          <MapPin size={14} />
          Browse Cities
        </h2>
        {updatedAt && (
          <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] flex items-center gap-1">
            <Clock size={10} />
            {formatUpdated(updatedAt)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex-shrink-0 w-36 h-20 rounded-xl bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory">
          {cities.map((city) => {
            const isActive = activeCity === city.slug
            return (
              <button
                key={city.slug}
                onClick={() => onSelect(city.slug)}
                className={`flex-shrink-0 w-36 p-3 rounded-xl border text-left transition-all duration-200 snap-start ${
                  isActive
                    ? 'bg-leaf-500/15 border-leaf-500/30 shadow-md shadow-leaf-500/10'
                    : 'bg-white dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.08] hover:border-leaf-500/20 hover:bg-leaf-500/5'
                }`}
              >
                <p className={`text-sm font-bold truncate ${
                  isActive ? 'text-leaf-400' : 'text-gray-800 dark:text-[#e8f0ea]'
                }`}>
                  {city.label}
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <Store size={10} className={isActive ? 'text-leaf-400/60' : 'text-gray-400 dark:text-[#5a6a5e]'} />
                  <span className={`text-[10px] font-medium ${
                    isActive ? 'text-leaf-400/80' : 'text-gray-500 dark:text-[#6a7a6e]'
                  }`}>
                    {city.dispensaryCount} dispensaries
                  </span>
                </div>
                {city.matchedStrainCount > 0 && (
                  <span className={`text-[9px] mt-0.5 block ${
                    isActive ? 'text-leaf-400/60' : 'text-gray-400 dark:text-[#5a6a5e]'
                  }`}>
                    {city.matchedStrainCount} matched strains
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
