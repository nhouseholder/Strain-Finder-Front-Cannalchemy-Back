/**
 * StrainPage — Individual strain detail page for SEO.
 * URL: /strains/:slug (e.g. /strains/blue-dream)
 *
 * Renders full strain profile with:
 * - SEO meta tags (title, description, canonical, OG)
 * - JSON-LD structured data (Product schema)
 * - All existing strain-detail components
 * - Internal links to related strains and quiz CTA
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { fromSlug, toSlug } from '../utils/strainSlug'
import { normalizeStrain } from '../utils/normalizeStrain'
import usePageTitle from '../hooks/usePageTitle'
import ExperienceDescription from '../components/strain-detail/ExperienceDescription'
import ScienceExplanation from '../components/strain-detail/ScienceExplanation'
import EffectsBreakdown from '../components/strain-detail/EffectsBreakdown'
import WhatToExpect from '../components/strain-detail/WhatToExpect'
import FlavorProfile from '../components/strain-detail/FlavorProfile'
import CannabinoidProfile from '../components/strain-detail/CannabinoidProfile'
import TerpeneProfile from '../components/strain-detail/TerpeneProfile'
import TerpeneRadar from '../components/strain-detail/TerpeneRadar'
import ConsumptionSuitability from '../components/strain-detail/ConsumptionSuitability'
import EffectVerification from '../components/strain-detail/EffectVerification'
import LineageTree from '../components/strain-detail/LineageTree'
import Card from '../components/shared/Card'

function StrainSEOHead({ strain }) {
  const slug = toSlug(strain.name)
  const url = `https://mystrainai.com/strains/${slug}`
  const title = `${strain.name} Strain — Effects, Terpenes & Review | MyStrainAI`
  const terpNames = (strain.terpenes || []).slice(0, 3).map(t => t.name).join(', ')
  const effectNames = (strain.effects || []).filter(e => e.category === 'positive').slice(0, 3).map(e => typeof e === 'string' ? e : e.name).join(', ')
  const description = `${strain.name} is a ${strain.type || 'hybrid'} strain${terpNames ? ` rich in ${terpNames}` : ''}${effectNames ? `, known for ${effectNames} effects` : ''}. Full terpene profile, cannabinoid data, and community reviews on MyStrainAI.`

  useEffect(() => {
    // Set meta tags
    const setMeta = (name, content, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    setMeta('description', description)
    setMeta('og:title', title, 'property')
    setMeta('og:description', description, 'property')
    setMeta('og:url', url, 'property')
    setMeta('og:type', 'article', 'property')
    setMeta('twitter:title', title, 'name')
    setMeta('twitter:description', description, 'name')

    // Canonical link
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', url)

    // JSON-LD
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      'name': `${strain.name} Cannabis Strain`,
      'description': description,
      'url': url,
      'brand': { '@type': 'Brand', 'name': 'MyStrainAI' },
      'category': `Cannabis Strain — ${(strain.type || 'Hybrid').charAt(0).toUpperCase() + (strain.type || 'hybrid').slice(1)}`,
    }

    // Add aggregate rating if we have sentiment data
    if (strain.sentimentScore && strain.reviewCount) {
      jsonLd.aggregateRating = {
        '@type': 'AggregateRating',
        'ratingValue': Math.min(strain.sentimentScore / 2, 5).toFixed(1),
        'bestRating': '5',
        'ratingCount': strain.reviewCount,
      }
    }

    let script = document.getElementById('strain-jsonld')
    if (!script) {
      script = document.createElement('script')
      script.id = 'strain-jsonld'
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(jsonLd)

    return () => {
      // Clean up on unmount
      const s = document.getElementById('strain-jsonld')
      if (s) s.remove()
    }
  }, [strain.name, slug])

  return null
}

function RelatedStrains({ strain, allStrains }) {
  const related = useMemo(() => {
    if (!allStrains.length) return []
    const sameType = allStrains.filter(s =>
      s.name !== strain.name &&
      s.dataCompleteness === 'full' &&
      (s.type || '').toLowerCase() === (strain.type || '').toLowerCase()
    )
    // Pick 4 deterministic related strains based on name hash
    const hash = strain.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const shuffled = [...sameType].sort((a, b) => {
      const ha = (hash * 31 + a.name.charCodeAt(0)) % 1000
      const hb = (hash * 31 + b.name.charCodeAt(0)) % 1000
      return ha - hb
    })
    return shuffled.slice(0, 4)
  }, [strain.name, strain.type, allStrains])

  if (related.length === 0) return null

  return (
    <Card className="p-5">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
        Similar {(strain.type || 'Hybrid').charAt(0).toUpperCase() + (strain.type || 'hybrid').slice(1)} Strains
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {related.map(s => (
          <Link
            key={s.name}
            to={`/strains/${toSlug(s.name)}`}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] hover:border-leaf-500/30 transition-colors group"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.type === 'indica' ? 'bg-purple-500' : s.type === 'sativa' ? 'bg-amber-500' : 'bg-leaf-500'}`} />
            <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300 group-hover:text-leaf-400 truncate">
              {s.name}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  )
}

function QuizCTA() {
  return (
    <Card className="p-5 border-leaf-500/20 bg-gradient-to-br from-leaf-500/[0.04] to-transparent">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
        Not sure this strain is right for you?
      </h2>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        Take our 2-minute quiz to find strains matched to your unique preferences and biochemistry.
      </p>
      <Link
        to="/quiz"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-leaf-500 hover:bg-leaf-600 text-white text-[12px] font-semibold transition-colors"
      >
        Find Your Strain
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </Link>
    </Card>
  )
}

export default function StrainPage() {
  const { slug } = useParams()
  const { allStrains, dataLoaded } = useStrainSearch()
  const [notFound, setNotFound] = useState(false)

  const strain = useMemo(() => {
    if (!dataLoaded || !slug) return null
    const searchName = fromSlug(slug)
    // Try exact slug match first, then fuzzy name match
    const found = allStrains.find(s => toSlug(s.name) === slug) ||
                  allStrains.find(s => s.name.toLowerCase() === searchName)
    if (!found && dataLoaded) setNotFound(true)
    return found ? normalizeStrain(found) : null
  }, [slug, allStrains, dataLoaded])

  usePageTitle(strain ? `${strain.name} Strain` : 'Strain Not Found')

  if (!dataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin-slow" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Strain Not Found</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          We couldn't find a strain matching "{fromSlug(slug)}". It may be spelled differently in our database.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/strains" className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/[0.06] text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.1] transition-colors">
            Browse All Strains
          </Link>
          <Link to="/search" className="px-4 py-2 rounded-lg bg-leaf-500 text-sm font-medium text-white hover:bg-leaf-600 transition-colors">
            Search Strains
          </Link>
        </div>
      </div>
    )
  }

  if (!strain) return null

  const cannabinoids = strain.cannabinoids || []
  const priceLabel = { low: '$', mid: '$$', high: '$$$' }[strain.priceRange] || null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
        <Link to="/" className="hover:text-leaf-400 transition-colors">Home</Link>
        <span>/</span>
        <Link to="/strains" className="hover:text-leaf-400 transition-colors">Strains</Link>
        <span>/</span>
        <span className="text-gray-600 dark:text-gray-300 capitalize">{(strain.type || 'hybrid')}</span>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-200 font-medium">{strain.name}</span>
      </nav>

      {/* SEO head tags */}
      <StrainSEOHead strain={strain} />

      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
            ${strain.type === 'indica' ? 'bg-purple-500/15 text-purple-400' :
              strain.type === 'sativa' ? 'bg-amber-500/15 text-amber-400' :
              'bg-leaf-500/15 text-leaf-400'}`}>
            {strain.type || 'Hybrid'}
          </span>
          {priceLabel && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{priceLabel}</span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{strain.name}</h1>
        {strain.genetics && (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
            Genetics: {strain.genetics}
          </p>
        )}
        {strain.description && (
          <p className="text-[13px] text-gray-600 dark:text-[#a0b4a6] leading-relaxed mt-3">
            {strain.descriptionExtended && strain.descriptionExtended !== 'NULL'
              ? strain.descriptionExtended
              : strain.description}
          </p>
        )}
      </header>

      {/* Strain detail sections — same components as StrainCardExpanded */}
      <ExperienceDescription strain={strain} />
      <ScienceExplanation strain={strain} />
      <EffectsBreakdown effects={strain.effects} />
      <WhatToExpect
        bestFor={strain.bestFor}
        notIdealFor={strain.notIdealFor}
        effectPredictions={strain.effectPredictions}
        effects={strain.effects}
      />
      <FlavorProfile flavors={strain.flavors} />
      <CannabinoidProfile cannabinoids={cannabinoids} />

      {strain.terpenes?.length > 0 && (
        <TerpeneProfile terpenes={strain.terpenes} />
      )}
      {strain.terpenes?.length >= 3 && (
        <TerpeneRadar terpenes={strain.terpenes} strainType={strain.type} />
      )}

      <ConsumptionSuitability data={strain.consumptionSuitability} />

      {strain.effectPredictions?.length > 0 && strain.forumAnalysis && (
        <EffectVerification
          predictions={strain.effectPredictions}
          forumData={strain.forumAnalysis}
        />
      )}

      {strain.lineage && <LineageTree lineage={strain.lineage} />}

      {/* Related strains + Quiz CTA */}
      <RelatedStrains strain={strain} allStrains={allStrains} />
      <QuizCTA />

      {/* Browse link */}
      <div className="text-center pt-2 pb-8">
        <Link to="/strains" className="text-[12px] text-leaf-500 hover:text-leaf-400 transition-colors">
          Browse all strains &rarr;
        </Link>
      </div>
    </div>
  )
}
