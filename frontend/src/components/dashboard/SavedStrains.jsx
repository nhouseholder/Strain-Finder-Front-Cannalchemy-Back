import { useMemo } from 'react'
import { X, Heart } from 'lucide-react'
import Card from '../shared/Card'
import { TypeBadge } from '../shared/Badge'
import { useStrainSearch } from '../../hooks/useStrainSearch'

export default function SavedStrains({ favorites = [], onRemove }) {
  const { getStrainByName } = useStrainSearch()

  const enriched = useMemo(
    () =>
      favorites.map((name) => {
        const strain = getStrainByName(name)
        return {
          name,
          type: strain?.type || null,
          thc: strain?.thc || strain?.thcMax || null,
        }
      }),
    [favorites, getStrainByName]
  )

  if (favorites.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Heart className="w-10 h-10 text-gray-300 dark:text-[#5a6a5e] mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">
          No saved strains yet. Favorite strains from your results to see them here.
        </p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {enriched.map(({ name, type, thc }) => (
        <Card key={name} className="p-4 relative group">
          {/* Remove button */}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(name)}
              className="absolute top-2 right-2 p-1 rounded-lg text-gray-400 dark:text-[#5a6a5e] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label={`Remove ${name} from favorites`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Strain info */}
          <div className="space-y-2 pr-4">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">
              {name}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {type && <TypeBadge type={type} />}
              {thc != null && (
                <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e] font-medium">
                  THC {typeof thc === 'number' ? `${thc}%` : thc}
                </span>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
