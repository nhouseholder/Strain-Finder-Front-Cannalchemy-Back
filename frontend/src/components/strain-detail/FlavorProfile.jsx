import { memo } from 'react'
import { Cherry } from 'lucide-react'

const FLAVOR_COLORS = {
  citrus: '#f59e0b', lemon: '#eab308', orange: '#fb923c', lime: '#84cc16',
  berry: '#a855f7', blueberry: '#6366f1', strawberry: '#f43f5e', grape: '#7c3aed',
  earthy: '#78716c', woody: '#92400e', pine: '#22c55e', herbal: '#16a34a',
  sweet: '#ec4899', vanilla: '#f5d0fe', honey: '#fbbf24', chocolate: '#92400e',
  spicy: '#ef4444', pepper: '#dc2626', peppery: '#dc2626',
  diesel: '#6b7280', skunky: '#a3a3a3', cheese: '#fbbf24',
  tropical: '#06b6d4', mango: '#fb923c', pineapple: '#eab308',
  floral: '#d946ef', lavender: '#a78bfa', rose: '#fb7185',
  mint: '#34d399', coffee: '#78350f', nutty: '#b45309',
  fruity: '#f97316', apple: '#22c55e', peach: '#fdba74', pear: '#a3e635',
  butter: '#fde047', cream: '#fef3c7',
}

function getFlavorColor(flavor) {
  const key = (typeof flavor === 'string' ? flavor : '').toLowerCase().trim()
  return FLAVOR_COLORS[key] || '#32c864'
}

export default memo(function FlavorProfile({ flavors }) {
  if (!flavors?.length) return null
  const items = flavors
    .map(f => typeof f === 'string' ? f : (f?.name || f?.label || ''))
    .filter(Boolean)
  if (items.length === 0) return null

  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e] mb-1 flex items-center gap-1.5">
        <Cherry size={12} className="text-pink-400" />
        Flavor Profile
      </h4>
      <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e] mb-3">
        Dominant taste notes reported by the community
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((flavor) => {
          const color = getFlavorColor(flavor)
          return (
            <div
              key={flavor}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors"
              style={{
                backgroundColor: `${color}12`,
                borderColor: `${color}30`,
              }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] font-medium" style={{ color }}>
                {flavor}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
})
