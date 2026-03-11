import { useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Store, MapPin, ArrowRight } from 'lucide-react'
import usePageTitle from '../hooks/usePageTitle'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { useFavorites } from '../hooks/useFavorites'
import { useUserRegion } from '../hooks/useUserRegion'
import { strainSlug } from '../utils/strainSlug'
import StrainCard from '../components/results/StrainCard'
import ChatWidget from '../components/chat/ChatWidget'
import StrainReviewsSection from '../components/community/StrainReviewsSection'
import LegalConsent from '../components/shared/LegalConsent'

export default function StrainDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { allStrains, dataLoaded } = useStrainSearch()
  const { toggleFavorite, isFavorite } = useFavorites()
  const { userRegionIndex } = useUserRegion()

  const strain = useMemo(() => {
    if (!slug || allStrains.length === 0) return null
    return allStrains.find(s => strainSlug(s.name) === slug)
  }, [slug, allStrains])

  usePageTitle(strain ? `${strain.name} — Strain Details` : 'Strain Not Found')

  // Loading state
  if (!dataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin-slow" />
      </div>
    )
  }

  // Strain not found
  if (!strain) {
    const prettyName = (slug || '').replace(/-/g, ' ')
    return (
      <LegalConsent>
        <div className="w-full max-w-2xl mx-auto px-4 pt-8 animate-fade-in">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-[#6a7a6e] hover:text-leaf-500 dark:hover:text-leaf-400 transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <div className="text-center py-10">
            <h1
              className="text-2xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-2"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Strain Not Found
            </h1>
            <p className="text-sm text-gray-500 dark:text-[#8a9a8e] mb-6">
              We couldn't find a strain matching &ldquo;{prettyName}&rdquo;.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                to="/search"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-leaf-500 text-white text-sm font-semibold hover:bg-leaf-400 transition-colors shadow-md shadow-leaf-500/25"
              >
                <Search size={16} />
                Search Strains
              </Link>
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-[#8a9a8e] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <ArrowLeft size={16} />
                Go Back
              </button>
            </div>
          </div>
        </div>
      </LegalConsent>
    )
  }

  return (
    <LegalConsent>
      <div className="w-full max-w-2xl mx-auto px-4 pt-4 pb-8 animate-fade-in">
        {/* Back navigation */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-[#6a7a6e] hover:text-leaf-500 dark:hover:text-leaf-400 transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        {/* Strain card — always expanded */}
        <StrainCard
          strain={strain}
          expanded={true}
          onToggle={() => {}}
          isFavorite={isFavorite(strain.name)}
          onFavorite={toggleFavorite}
          availability={[]}
          availabilityLoading={false}
          onViewDispensary={null}
          hideExpandButton={true}
          userRegionIndex={userRegionIndex}
        />

        {/* Find at Dispensaries CTA — connects strain → dispensary flow */}
        <Link
          to={`/dispensaries?highlight=${encodeURIComponent(strain.name)}`}
          className="block mt-6 group"
        >
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-leaf-500/[0.06] to-emerald-500/[0.04] border border-leaf-500/15 hover:border-leaf-500/30 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-leaf-500/15 flex items-center justify-center flex-shrink-0">
              <Store size={20} className="text-leaf-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-[#e8f0ea]">
                Find {strain.name} at Dispensaries
              </p>
              <p className="text-[11px] text-gray-500 dark:text-[#6a7a6e] mt-0.5 flex items-center gap-1">
                <MapPin size={10} />
                Check real menus near you
              </p>
            </div>
            <ArrowRight size={16} className="text-leaf-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
          </div>
        </Link>

        {/* Community Reviews */}
        <StrainReviewsSection strainSlug={slug} strainName={strain.name} />

        {/* AI Chat — inline, for follow-up questions about this strain */}
        <div className="pt-6 pb-2">
          <ChatWidget inline />
        </div>
      </div>
    </LegalConsent>
  )
}
