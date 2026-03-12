import clsx from 'clsx'

const SORT_OPTIONS = [
  { id: 'closest', label: 'Closest' },
  { id: 'best_deals', label: 'Best Deals' },
  { id: 'cheapest', label: 'Cheapest' },
  { id: 'highest_rated', label: 'Highest Rated' },
]

export default function DispensaryFilters({ sortBy, onSort, filters }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1 scrollbar-none">
      <div className="flex items-center gap-2 pb-1" role="radiogroup" aria-label="Sort dispensaries">
        {SORT_OPTIONS.map((option) => {
          const isActive = sortBy === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onSort?.(option.id)}
              className={clsx(
                'flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-leaf-900',
                isActive
                  ? 'bg-leaf-500 text-leaf-900 shadow-md shadow-leaf-500/25'
                  : 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-[#8a9a8e] border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
