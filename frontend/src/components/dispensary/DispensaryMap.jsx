import { useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, ExternalLink, Phone, Clock, Star, Navigation } from 'lucide-react'

// Dynamically load Leaflet CSS only when this component mounts
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
let leafletCssLoaded = false
function useLeafletCSS() {
  useEffect(() => {
    if (leafletCssLoaded) return
    if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) { leafletCssLoaded = true; return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = LEAFLET_CSS
    document.head.appendChild(link)
    leafletCssLoaded = true
  }, [])
}

const MATCH_COLORS = {
  exact: '#32c864',
  alternative: '#facc15',
  none: '#9ca3af',
}

function createColoredIcon(matchType) {
  const color = MATCH_COLORS[matchType] || MATCH_COLORS.none
  return L.divIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
    html: `
      <div style="
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      "></div>
    `,
  })
}

/** Extract display name from a strain entry (could be string or object) */
function strainName(s) {
  return typeof s === 'string' ? s : s?.name || 'Unknown'
}

export default function DispensaryMap({
  dispensaries = [],
  center,
  zoom = 12,
  onViewMenu,
}) {
  useLeafletCSS()
  const hasValidCenter = center?.lat && center?.lng
  const hasLocatedDispensaries = dispensaries.some((d) => d.lat && d.lng)

  const icons = useMemo(() => ({
    exact: createColoredIcon('exact'),
    alternative: createColoredIcon('alternative'),
    none: createColoredIcon('none'),
  }), [])

  if (!hasValidCenter && !hasLocatedDispensaries) {
    return (
      <div className="flex flex-col items-center justify-center h-[250px] md:h-[350px] rounded-2xl border border-gray-200 dark:border-surface-border bg-gray-50 dark:bg-surface text-center px-6">
        <MapPin className="w-10 h-10 text-gray-300 dark:text-[#6a7a6e] mb-3" />
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">
          Select a city or search by location to see dispensaries on the map
        </p>
      </div>
    )
  }

  const mapCenter = hasValidCenter
    ? [center.lat, center.lng]
    : (() => {
        const located = dispensaries.find((d) => d.lat && d.lng)
        return located ? [located.lat, located.lng] : [39.8283, -98.5795]
      })()

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-surface-border h-[250px] md:h-[350px]">
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom={false}
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {dispensaries
          .filter((d) => d.lat && d.lng)
          .map((dispensary) => (
            <Marker
              key={dispensary.id}
              position={[dispensary.lat, dispensary.lng]}
              icon={icons[dispensary.matchType] || icons.none}
            >
              <Popup>
                <div className="text-xs space-y-1.5 min-w-[220px]">
                  <p className="font-bold text-sm text-gray-900 leading-tight">
                    {dispensary.name}
                  </p>

                  {/* Rating + distance row */}
                  <div className="flex items-center gap-2 text-gray-500">
                    {dispensary.rating && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Star size={11} className="fill-amber-400 text-amber-400" />
                        {dispensary.rating}
                        {dispensary.reviewCount > 0 && (
                          <span className="text-gray-400 text-[10px]">({dispensary.reviewCount})</span>
                        )}
                      </span>
                    )}
                    {dispensary.distance && (
                      <span>{dispensary.distance} away</span>
                    )}
                  </div>

                  {/* Address */}
                  {dispensary.address && (
                    <div className="flex items-start gap-1 text-gray-600">
                      <MapPin size={11} className="flex-shrink-0 mt-0.5" />
                      <span className="leading-tight">{dispensary.address}</span>
                    </div>
                  )}

                  {/* Phone */}
                  {dispensary.phone && (
                    <div className="flex items-center gap-1">
                      <Phone size={11} className="text-gray-400" />
                      <a href={`tel:${dispensary.phone}`} className="text-blue-600 hover:text-blue-500" onClick={(e) => e.stopPropagation()}>
                        {dispensary.phone}
                      </a>
                    </div>
                  )}

                  {/* Hours */}
                  {dispensary.hours && (
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock size={11} className="flex-shrink-0" />
                      <span>{dispensary.hours}</span>
                    </div>
                  )}

                  {/* Strain matches (city mode) */}
                  {dispensary.matchedStrains?.length > 0 && (
                    <div className="pt-1 border-t border-gray-100">
                      <span className="font-semibold text-green-600">Has: </span>
                      {dispensary.matchedStrains.map(strainName).join(', ')}
                    </div>
                  )}

                  {dispensary.alternativeStrains?.length > 0 && (
                    <div>
                      <span className="font-semibold text-yellow-600">Similar: </span>
                      {dispensary.alternativeStrains.map(strainName).join(', ')}
                    </div>
                  )}

                  {dispensary.deals?.length > 0 && (
                    <div className="text-amber-600 font-medium">{dispensary.deals[0]}</div>
                  )}

                  {/* Action links */}
                  <div className="flex items-center gap-3 pt-1.5 border-t border-gray-100">
                    {onViewMenu && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onViewMenu(dispensary) }}
                        className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-500 transition-colors"
                      >
                        <ExternalLink size={11} />
                        {dispensary.matchType !== 'none' ? 'Strain Matches' : 'View Menu'}
                      </button>
                    )}
                    {dispensary.lat && dispensary.lng && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${dispensary.lat},${dispensary.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-500 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Navigation size={11} />
                        Directions
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  )
}
