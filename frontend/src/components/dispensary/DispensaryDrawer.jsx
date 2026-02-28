import { memo } from 'react'
import Modal from '../shared/Modal'
import {
  MapPin,
  Star,
  Clock,
  Truck,
  Phone,
  ExternalLink,
  Tag,
  Navigation,
  ShoppingBag,
  Store,
} from 'lucide-react'

/**
 * DispensaryDrawer — bottom-sheet modal with dispensary details.
 *
 * Props:
 *   dispensary — full dispensary object
 *   open — boolean
 *   onClose — callback
 *   highlightStrain — optional strain name to highlight in the menu
 */
function DispensaryDrawer({ dispensary, open, onClose, highlightStrain }) {
  if (!dispensary) return null

  const d = dispensary
  const matchedStrains = d.matchedStrains || []
  const altStrains = d.alternativeStrains || []

  return (
    <Modal open={open} onClose={onClose} title={d.name}>
      {/* Header info */}
      <div className="space-y-3 mb-5">
        {/* Rating + Distance row */}
        <div className="flex items-center flex-wrap gap-3 text-xs text-gray-500 dark:text-[#6a7a6e]">
          {d.rating && (
            <span className="flex items-center gap-1 text-amber-500">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <strong>{d.rating}</strong>
              {d.reviewCount > 0 && (
                <span className="text-gray-400 dark:text-[#5a6a5e]">
                  ({d.reviewCount})
                </span>
              )}
            </span>
          )}
          {d.distance && (
            <span className="flex items-center gap-1">
              <MapPin size={11} />
              {d.distance}
            </span>
          )}
          {d.hours && (
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {d.hours}
            </span>
          )}
        </div>

        {/* Address */}
        {d.address && (
          <p className="text-xs text-gray-500 dark:text-[#8a9a8e] flex items-start gap-1.5">
            <MapPin size={12} className="flex-shrink-0 mt-0.5" />
            {d.address}
          </p>
        )}

        {/* Delivery + Pickup */}
        <div className="flex flex-wrap gap-2">
          {d.delivery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-leaf-500/10 text-leaf-500 border border-leaf-500/20">
              <Truck size={11} />
              Delivery {d.deliveryEta && `(${d.deliveryEta})`}
            </span>
          )}
          {d.pickupReady && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ShoppingBag size={11} />
              Pickup ready in {d.pickupReady}
            </span>
          )}
          {d.priceRange && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-[#8a9a8e] border border-gray-200 dark:border-white/10">
              {d.priceRange}
            </span>
          )}
        </div>
      </div>

      {/* Your Strains section */}
      {matchedStrains.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[10px] uppercase tracking-wider text-leaf-400 font-bold mb-2 flex items-center gap-1.5">
            <Store size={11} />
            Your Strains Here
          </h3>
          <div className="space-y-1.5">
            {matchedStrains.map((s, i) => {
              const name = typeof s === 'string' ? s : s.name
              const price = typeof s === 'object' ? s.price : null
              const url = typeof s === 'object' ? s.strainMenuUrl : null
              const isHighlighted = highlightStrain && name === highlightStrain

              return (
                <div
                  key={`m-${i}`}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    isHighlighted
                      ? 'bg-leaf-500/15 border-leaf-500/30'
                      : 'bg-white/[0.02] border-gray-100 dark:border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-leaf-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-800 dark:text-[#e8f0ea] truncate">
                      {name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {price && (
                      <span className="text-[11px] font-semibold text-leaf-500">
                        {price}
                      </span>
                    )}
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-leaf-400 hover:text-leaf-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Similar Strains section */}
      {altStrains.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-2">
            Similar Strains Available
          </h3>
          <div className="space-y-1.5">
            {altStrains.map((s, i) => {
              const name = typeof s === 'string' ? s : s.name
              const price = typeof s === 'object' ? s.price : null
              const url = typeof s === 'object' ? s.strainMenuUrl : null

              return (
                <div
                  key={`a-${i}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-700 dark:text-[#b0c4b4] truncate">
                      {name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {price && (
                      <span className="text-[11px] font-medium text-blue-400">
                        {price}
                      </span>
                    )}
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Deals */}
      {d.deals?.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-2 flex items-center gap-1.5">
            <Tag size={11} />
            Current Deals
          </h3>
          <div className="space-y-1">
            {d.deals.map((deal, i) => (
              <div
                key={i}
                className="px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-amber-500 dark:text-amber-400"
              >
                {deal}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
        {/* Primary CTA: Open Full Menu */}
        {d.menuUrl && (
          <a
            href={d.menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-leaf-500 text-leaf-900 hover:bg-leaf-400 transition-colors shadow-md shadow-leaf-500/20"
          >
            <ExternalLink size={14} />
            Open Full Menu
          </a>
        )}

        {/* Get Directions */}
        {d.address && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-[#8a9a8e] border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors"
          >
            <Navigation size={14} />
            Directions
          </a>
        )}

        {/* Call Now */}
        {d.phone && (
          <a
            href={`tel:${d.phone}`}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-[#8a9a8e] border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors"
          >
            <Phone size={14} />
            Call
          </a>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-[8px] text-gray-300 dark:text-[#6a7a6e] text-center mt-4 px-2">
        Menu data is community-sourced and may not reflect real-time inventory. Always verify with the dispensary.
      </p>
    </Modal>
  )
}

export default memo(DispensaryDrawer)
