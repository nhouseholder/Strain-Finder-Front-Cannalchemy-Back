/**
 * StrainsDirectoryPage — Browsable directory of all strains for SEO.
 * URL: /strains (all) or /strains/type/:type (filtered by indica/sativa/hybrid)
 *
 * Provides internal links to every individual strain page,
 * creating a crawlable site structure for search engines.
 */
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { toSlug } from '../utils/strainSlug'
import usePageTitle from '../hooks/usePageTitle'
import Card from '../components/shared/Card'

const TYPE_META = {
  indica: { label: 'Indica', color: 'bg-purple-500', textColor: 'text-purple-400', description: 'Indica strains are known for relaxing, body-heavy effects. Best for evening use, sleep, and pain relief.' },
  sativa: { label: 'Sativa', color: 'bg-amber-500', textColor: 'text-amber-400', description: 'Sativa strains provide uplifting, cerebral effects. Best for daytime use, creativity, and social activities.' },
  hybrid: { label: 'Hybrid', color: 'bg-leaf-500', textColor: 'text-leaf-400', description: 'Hybrid strains combine indica and sativa genetics, offering balanced effects tailored to their specific lineage.' },
}

export default function StrainsDirectoryPage() {
  const { type } = useParams()
  const { allStrains, dataLoaded } = useStrainSearch()
  const [search, setSearch] = useState('')
  const [letter, setLetter] = useState('')

  const validType = type && TYPE_META[type.toLowerCase()] ? type.toLowerCase() : null

  const title = validType
    ? `${TYPE_META[validType].label} Strains`
    : 'All Cannabis Strains'

  usePageTitle(title)

  const filtered = useMemo(() => {
    let strains = allStrains.filter(s => s.dataCompleteness === 'full')
    if (validType) {
      strains = strains.filter(s => (s.type || '').toLowerCase() === validType)
    }
    if (search.length >= 2) {
      const q = search.toLowerCase()
      strains = strains.filter(s => s.name.toLowerCase().includes(q))
    }
    if (letter) {
      strains = strains.filter(s => s.name[0]?.toUpperCase() === letter)
    }
    return strains.sort((a, b) => a.name.localeCompare(b.name))
  }, [allStrains, validType, search, letter])

  const letters = useMemo(() => {
    const set = new Set()
    const strains = validType
      ? allStrains.filter(s => s.dataCompleteness === 'full' && (s.type || '').toLowerCase() === validType)
      : allStrains.filter(s => s.dataCompleteness === 'full')
    strains.forEach(s => { if (s.name[0]) set.add(s.name[0].toUpperCase()) })
    return [...set].sort()
  }, [allStrains, validType])

  if (!dataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin-slow" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
        <Link to="/" className="hover:text-leaf-400 transition-colors">Home</Link>
        <span>/</span>
        {validType ? (
          <>
            <Link to="/strains" className="hover:text-leaf-400 transition-colors">Strains</Link>
            <span>/</span>
            <span className="text-gray-700 dark:text-gray-200 font-medium capitalize">{validType}</span>
          </>
        ) : (
          <span className="text-gray-700 dark:text-gray-200 font-medium">Strains</span>
        )}
      </nav>

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
          {validType
            ? TYPE_META[validType].description
            : `Browse ${allStrains.filter(s => s.dataCompleteness === 'full').length}+ cannabis strains with detailed terpene profiles, effects, and cannabinoid data.`}
        </p>
      </header>

      {/* Type filter pills */}
      {!validType && (
        <div className="flex gap-2">
          {Object.entries(TYPE_META).map(([key, meta]) => (
            <Link
              key={key}
              to={`/strains/type/${key}`}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold ${meta.textColor} bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] transition-colors`}
            >
              {meta.label}
            </Link>
          ))}
        </div>
      )}

      {/* Search + letter filter */}
      <div className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Search strains..."
          value={search}
          onChange={e => { setSearch(e.target.value); setLetter('') }}
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-leaf-500/50"
        />
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setLetter('')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${!letter ? 'bg-leaf-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            All
          </button>
          {letters.map(l => (
            <button
              key={l}
              onClick={() => { setLetter(l === letter ? '' : l); setSearch('') }}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${letter === l ? 'bg-leaf-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-[11px] text-gray-400">
        {filtered.length} strain{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Strain grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map(strain => {
          const topEffects = (strain.effects || [])
            .filter(e => e.category === 'positive')
            .slice(0, 2)
            .map(e => typeof e === 'string' ? e : e.name)

          return (
            <Link
              key={strain.name}
              to={`/strains/${toSlug(strain.name)}`}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] hover:border-leaf-500/30 transition-colors group"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${strain.type === 'indica' ? 'bg-purple-500' : strain.type === 'sativa' ? 'bg-amber-500' : 'bg-leaf-500'}`} />
              <div className="min-w-0">
                <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200 group-hover:text-leaf-400 transition-colors">
                  {strain.name}
                </span>
                {topEffects.length > 0 && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    {topEffects.join(' · ')}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-gray-500">No strains found matching your search.</p>
        </Card>
      )}

      {/* Quiz CTA */}
      <Card className="p-5 border-leaf-500/20 bg-gradient-to-br from-leaf-500/[0.04] to-transparent text-center">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
          Find Your Perfect Match
        </h2>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
          Our AI quiz matches you to strains based on your unique preferences and biochemistry.
        </p>
        <Link
          to="/quiz"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-leaf-500 hover:bg-leaf-600 text-white text-[12px] font-semibold transition-colors"
        >
          Take the Quiz
        </Link>
      </Card>
    </div>
  )
}
