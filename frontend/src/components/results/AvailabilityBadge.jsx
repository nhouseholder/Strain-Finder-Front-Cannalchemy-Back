import { memo } from 'react'
import { MapPin, Store, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * Per-strain availability badge — shows where a strain is available.
 *
 * States:
 *  - No data, no loading: MapPin icon → navigates to /dispensaries
 *  - Loading: Subtle pulse "Checking..."
 *  - Available: Green "At [Dispensary] (1.2 mi)" → opens dispensary drawer
 *  - Not found: Gray "Check nearby" → navigates to /dispensaries
 */
function AvailabilityBadge({ strainName, availability, loading, onViewDispensary }) {
  const navigate = useNavigate()
  const spots = availability || []
  const topSpot = spots[0]

  // Loading state
  if (loading) {
    return (
      <button
        type="button"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] text-gray-400 dark:text-[#5a6a5e] bg-gray-50 dark:bg-white/[0.02] animate-pulse"
        disabled
      >
        <Loader2 size={12} className="animate-spin" />
        <span>Checking...</span>
      </button>
    )
  }

  // Available — show best dispensary
  if (topSpot) {
    const dispensaryCount = spots.length
    const label = dispensaryCount > 1
      ? `At ${dispensaryCount} shops`
      : `At ${topSpot.dispensaryName?.slice(0, 18) || 'nearby'}`
    const price = topSpot.price
    const distance = topSpot.distance

    return (
      <button
        type="button"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        onClick={(e) => {
          e.stopPropagation()
          if (onViewDispensary) {
            onViewDispensary(strainName, spots)
          } else {
            navigate('/dispensaries')
          }
        }}
        title={`Available at ${dispensaryCount} dispensar${dispensaryCount > 1 ? 'ies' : 'y'} nearby`}
      >
        <Store size={12} />
        <span className="truncate max-w-[120px]">{label}</span>
        {distance && (
          <span className="text-emerald-400/70 dark:text-emerald-500/70 font-normal">
            ({distance})
          </span>
        )}
        {price && (
          <span className="text-emerald-400/70 dark:text-emerald-500/70 font-normal">
            {price}
          </span>
        )}
      </button>
    )
  }

  // No data — show "Check nearby"
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] text-gray-400 dark:text-[#6a7a6e] hover:text-leaf-400 hover:bg-leaf-500/10 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500"
      onClick={(e) => {
        e.stopPropagation()
        navigate('/dispensaries')
      }}
      title="Find at nearby dispensaries"
    >
      <MapPin size={12} />
      <span>Check nearby</span>
    </button>
  )
}

export default memo(AvailabilityBadge)
