import { useState, useEffect, useContext, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'
import { ResultsContext } from '../context/ResultsContext'
import { AuthContext } from '../context/AuthContext'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { fetchDispensaryMenu, searchByCity, fetchWeedmapsMenuItems } from '../services/dispensarySearch'
import { strainSlug as toSlug } from '../utils/strainSlug'
import StrainCardExpanded from '../components/results/StrainCardExpanded'
import Card from '../components/shared/Card'
import Button from '../components/shared/Button'
import {
  ChevronLeft,
  MapPin,
  Star,
  Clock,
  Truck,
  Phone,
  Navigation,
  ExternalLink,
  Tag,
  ShoppingBag,
  Leaf,
  Sparkles,
  Loader2,
  AlertCircle,
  Plus,
  BookOpen,
  MessageSquare,
  Store,
  ChevronDown,
  ChevronUp,
  Beaker,
} from 'lucide-react'

/* ================================================================== */
/*  Menu matching utilities — cross-reference Weedmaps menu with DB   */
/* ================================================================== */

/** Clean a raw Weedmaps menu item name for strain matching */
function cleanMenuItemName(rawName) {
  return rawName
    // Remove gram measurements: "- 3.5g", "(1.5g)", "3.5 grams"
    .replace(/[-–]\s*\d+(\.\d+)?\s*(g|gr|gram)s?(\s|$)/gi, ' ')
    .replace(/\(\d+(\.\d+)?\s*(g|gr|gram)s?\)/gi, '')
    // Remove type indicators
    .replace(/\b(indica|sativa|hybrid)\b/gi, '')
    // Remove size/quality markers
    .replace(/\b(small|smallz|popcorn|shake|trim|minis?|smalls)\b/gi, '')
    // Remove growing method
    .replace(/\b(indoor|outdoor|greenhouse)\b/gi, '')
    // Remove product types (non-flower)
    .replace(/\b(pre-?roll|joint|blunt|cartridge|cart|vape|edible|gummy|concentrate|wax|shatter|rosin|resin|distillate|tincture|topical|infused)\b/gi, '')
    // Remove weight labels
    .replace(/\b(\d+(\.\d+)?\s*(oz|ounce|quarter|eighth|half|gram)s?)\b/gi, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/** Levenshtein distance for fuzzy matching */
function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  if (Math.abs(m - n) > 2) return 3 // early exit
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1)
    row[0] = i
    return row
  })
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/** Extract display price from a Weedmaps menu item */
function extractPrice(item) {
  if (item.price && typeof item.price === 'number') {
    return `$${item.price}`
  }
  if (item.prices?.length > 0) {
    const eighth = item.prices.find((p) =>
      /eighth|3\.5/i.test(p.label || p.units || ''),
    )
    if (eighth?.price) return `$${eighth.price}/eighth`

    const gram = item.prices.find((p) =>
      /\b(gram|1g)\b/i.test(p.label || p.units || ''),
    )
    if (gram?.price) return `$${gram.price}/g`

    const first = item.prices[0]
    if (first?.price) return `$${first.price}${first.label ? `/${first.label}` : ''}`
  }
  return null
}

/** Cross-reference raw Weedmaps menu items with our strain database */
function matchMenuToStrains(menuItems, strainDatabase) {
  // Build lookup map
  const strainMap = new Map()
  for (const s of strainDatabase) {
    if (s.name) strainMap.set(s.name.toLowerCase(), s)
  }

  const matched = []
  const seen = new Set() // avoid duplicate strain matches
  let unmatched = 0

  for (const item of menuItems) {
    const cleaned = cleanMenuItemName(item.name)
    if (!cleaned || cleaned.length < 2) { unmatched++; continue }
    const cleanedLower = cleaned.toLowerCase()

    let dbStrain = null
    let matchTier = 'exact'

    // Tier 1: Exact match
    dbStrain = strainMap.get(cleanedLower)

    // Tier 2: Fuzzy (Levenshtein ≤ 2)
    if (!dbStrain) {
      for (const [key, strain] of strainMap) {
        if (Math.abs(key.length - cleanedLower.length) > 2) continue
        if (levenshtein(cleanedLower, key) <= 2) {
          dbStrain = strain
          matchTier = 'fuzzy'
          break
        }
      }
    }

    // Tier 3: Substring match (minimum 4 chars to avoid false positives)
    if (!dbStrain) {
      for (const [key, strain] of strainMap) {
        if (key.length >= 4 && cleanedLower.length >= 4) {
          if (cleanedLower.includes(key) || key.includes(cleanedLower)) {
            dbStrain = strain
            matchTier = 'substring'
            break
          }
        }
      }
    }

    const price = extractPrice(item)

    if (dbStrain && !seen.has(dbStrain.name.toLowerCase())) {
      seen.add(dbStrain.name.toLowerCase())
      const effects = Array.isArray(dbStrain.effects) ? dbStrain.effects : []
      matched.push({
        menuName: item.name,
        price,
        image: item.image,
        brand: item.brand,
        strain: {
          name: dbStrain.name,
          slug: toSlug(dbStrain.name),
          type: dbStrain.type,
          thc: dbStrain.thc,
          cbd: dbStrain.cbd,
          topEffects: effects
            .filter((e) => e.category === 'positive' || e.category === 'medical')
            .sort((a, b) => (b.reports || 0) - (a.reports || 0))
            .slice(0, 3)
            .map((e) => (typeof e === 'string' ? e : e.name)),
          topTerpenes: (dbStrain.terpenes || [])
            .slice(0, 3)
            .map((t) => t.name),
          matchTier,
        },
      })
    } else {
      unmatched++
    }
  }

  return { matchedMenu: matched, unmatchedCount: unmatched }
}

/* ================================================================== */
/*  DispensaryMenuPage — Main Component                               */
/* ================================================================== */

/**
 * DispensaryMenuPage — Dedicated full-page view for a dispensary's menu.
 *
 * Connects the dispensary experience to the rest of the app:
 *   • Strain Detail pages (/strain/:slug)
 *   • Compare tool (/compare)
 *   • Journal (/journal)
 *   • Community reviews (/community)
 *   • Quiz results (highlighted "Your Match" badges)
 *
 * Reached via:
 *   /dispensary/:citySlug/:dispensaryId  (city mode — fetches from KV API)
 *   /dispensary/nearby/:dispensaryId     (location mode — fetches live from Weedmaps)
 */
export default function DispensaryMenuPage() {
  const { citySlug, dispensaryId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { state: resultsState } = useContext(ResultsContext)
  const { user } = useContext(AuthContext)
  const { allStrains, getStrainByName, dataLoaded } = useStrainSearch()

  const passedDispensary = location.state?.dispensary || null
  const isLocationMode = citySlug === 'nearby'

  const [dispensary, setDispensary] = useState(passedDispensary)
  const [menuData, setMenuData] = useState(null)
  // If we already have dispensary data (passed via state), skip initial loading
  const [loading, setLoading] = useState(!passedDispensary)
  const [menuLoading, setMenuLoading] = useState(false)
  const [error, setError] = useState(null)

  usePageTitle(dispensary ? `${dispensary.name} — Menu` : 'Dispensary Menu')

  /* Quiz strain names for highlighting matches */
  const quizStrainNames = useMemo(
    () => new Set((resultsState.strains || []).map((s) => s.name?.toLowerCase())),
    [resultsState.strains],
  )

  /* Quiz strain slug map for linking */
  const quizStrainSlugs = useMemo(() => {
    const map = {}
    for (const s of resultsState.strains || []) {
      if (s.name && s.slug) map[s.name.toLowerCase()] = s.slug
    }
    return map
  }, [resultsState.strains])

  /* Load dispensary + menu data on mount (CITY MODE) */
  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        if (citySlug && !isLocationMode) {
          // City mode — fetch from KV API
          const detail = await fetchDispensaryMenu(citySlug, dispensaryId)
          if (cancelled) return

          if (detail) {
            setMenuData(detail)
            // Also get basic dispensary info from city data if we don't have it
            if (!dispensary) {
              const cityData = await searchByCity(citySlug)
              if (cancelled) return
              const found = cityData?.dispensaries?.find((d) => d.id === dispensaryId)
              if (found) setDispensary(found)
            }
          } else {
            setError('Dispensary not found or menu unavailable')
          }
        } else if (!dispensary) {
          setError('Dispensary data not available. Please go back and try again.')
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load dispensary data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [citySlug, dispensaryId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* LOCATION MODE: fetch Weedmaps menu + cross-reference with strain DB */
  useEffect(() => {
    if (!isLocationMode || !dispensary || !dataLoaded) return

    let cancelled = false

    async function fetchAndMatchMenu() {
      setMenuLoading(true)

      try {
        // Extract Weedmaps slug from dispensary id (format: "wm-{slug}")
        const wmSlug = dispensary.id?.startsWith('wm-')
          ? dispensary.id.slice(3)
          : null

        if (!wmSlug) {
          setMenuLoading(false)
          return
        }

        console.log(`[DispensaryMenu] Fetching menu for ${wmSlug}...`)
        const rawMenu = await fetchWeedmapsMenuItems(wmSlug)
        if (cancelled) return

        if (rawMenu.length > 0) {
          console.log(`[DispensaryMenu] Got ${rawMenu.length} menu items, matching against ${allStrains.length} strains...`)
          const result = matchMenuToStrains(rawMenu, allStrains)
          console.log(`[DispensaryMenu] Matched ${result.matchedMenu.length} strains, ${result.unmatchedCount} unmatched`)
          setMenuData(result)
        } else {
          console.log(`[DispensaryMenu] No menu items returned for ${wmSlug}`)
        }
      } catch (err) {
        console.error('[DispensaryMenu] Failed to fetch/match menu:', err)
      } finally {
        if (!cancelled) setMenuLoading(false)
      }
    }

    fetchAndMatchMenu()
    return () => { cancelled = true }
  }, [isLocationMode, dispensary, dataLoaded, allStrains])

  const d = dispensary
  const matched = menuData?.matchedMenu || []
  const unmatchedCount = menuData?.unmatchedCount || 0
  const matchedStrains = d?.matchedStrains || []
  const altStrains = d?.alternativeStrains || []

  const isQuizMatch = (name) => quizStrainNames.has(name?.toLowerCase())
  const getStrainSlug = (name) =>
    quizStrainSlugs[name?.toLowerCase()] || toSlug(name)

  /* ---------- Loading state ---------- */
  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 pt-4 animate-fade-in">
        <BackButton />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-[#8a9a8e]">Loading dispensary menu…</p>
        </div>
      </div>
    )
  }

  /* ---------- Error state ---------- */
  if (error || !d) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 pt-4 animate-fade-in">
        <BackButton />
        <Card className="p-6 text-center">
          <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-[#8a9a8e] mb-4">
            {error || 'Dispensary not found'}
          </p>
          <Button variant="secondary" onClick={() => navigate('/dispensaries')}>
            Browse Dispensaries
          </Button>
        </Card>
      </div>
    )
  }

  /* ---------- Main render ---------- */
  return (
    <div
      className="w-full max-w-2xl mx-auto px-4 pt-4 pb-8 animate-fade-in"
      style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}
    >
      <BackButton />

      {/* ── Dispensary Hero Card ── */}
      <Card className="p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h1
              className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {d.name}
            </h1>
            {d.address && (
              <p className="text-xs text-gray-500 dark:text-[#8a9a8e] mt-1 flex items-start gap-1.5">
                <MapPin size={12} className="flex-shrink-0 mt-0.5" />
                {d.address}
              </p>
            )}
          </div>
          {d.rating && (
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <span className="flex items-center gap-1 text-amber-500">
                <Star size={16} className="fill-amber-400 text-amber-400" />
                <strong className="text-lg">{d.rating}</strong>
              </span>
              {d.reviewCount > 0 && (
                <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                  {d.reviewCount} reviews
                </span>
              )}
            </div>
          )}
        </div>

        {/* Info badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {d.hours && (
            <InfoBadge icon={<Clock size={12} />} text={d.hours} />
          )}
          {d.delivery && (
            <InfoBadge
              icon={<Truck size={12} />}
              text={`Delivery${d.deliveryEta ? ` (${d.deliveryEta})` : ''}`}
              variant="leaf"
            />
          )}
          {d.pickupReady && (
            <InfoBadge
              icon={<ShoppingBag size={12} />}
              text={`Pickup ${d.pickupReady}`}
              variant="blue"
            />
          )}
          {d.priceRange && <InfoBadge text={d.priceRange} />}
          {d.distance && <InfoBadge icon={<MapPin size={12} />} text={d.distance} />}
        </div>

        {/* Quick-action buttons */}
        <div className="flex flex-wrap gap-2">
          {d.address && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-leaf-500 text-leaf-900 hover:bg-leaf-400 transition-colors shadow-md shadow-leaf-500/20 min-h-[44px]"
            >
              <Navigation size={14} />
              Directions
            </a>
          )}
          {d.phone && (
            <a
              href={`tel:${d.phone}`}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-[#8a9a8e] border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors min-h-[44px]"
            >
              <Phone size={14} />
              Call
            </a>
          )}
          {(d.menuUrl || d.wmUrl) && (
            <a
              href={d.menuUrl || d.wmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-[#8a9a8e] border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors min-h-[44px]"
            >
              <ExternalLink size={14} />
              Weedmaps
            </a>
          )}
        </div>
      </Card>

      {/* ── Deals ── */}
      {d.deals?.length > 0 && (
        <Card className="p-4 mb-6">
          <h2 className="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-3 flex items-center gap-1.5">
            <Tag size={12} />
            Current Deals
          </h2>
          <div className="space-y-2">
            {d.deals.map((deal, i) => (
              <div
                key={i}
                className="px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-sm text-amber-600 dark:text-amber-400 font-medium"
              >
                {deal}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Menu loading state (location mode) ── */}
      {menuLoading && (
        <Card className="p-6 mb-6">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-[#b0c4b4]">
                Fetching live menu...
              </p>
              <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mt-1">
                Cross-referencing with our strain database
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Enhanced Menu (strains matched with our database) ── */}
      {matched.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-1 flex items-center gap-2">
            <Sparkles size={16} className="text-leaf-400" />
            Menu · {matched.length} Strains Matched
          </h2>
          <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mb-3 ml-6">
            Tap any strain to view full details
          </p>
          <div className="space-y-3">
            {matched.map((item, i) => (
              <StrainMenuCard
                key={i}
                item={item}
                isQuizMatch={isQuizMatch}
                getStrainSlug={getStrainSlug}
                showAuthActions={!!user}
                getStrainByName={getStrainByName}
              />
            ))}
          </div>
          {unmatchedCount > 0 && (
            <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-3 text-center">
              + {unmatchedCount} additional items not in our database
            </p>
          )}
        </section>
      )}

      {/* ── Matched Strains (fallback when no enhanced menu) ── */}
      {matched.length === 0 && !menuLoading && matchedStrains.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-3 flex items-center gap-2">
            <Store size={16} className="text-leaf-400" />
            Your Strains Here
          </h2>
          <div className="space-y-2">
            {matchedStrains.map((s, i) => {
              const name = typeof s === 'string' ? s : s.name
              const price = typeof s === 'object' ? s.price : null
              const url = typeof s === 'object' ? s.strainMenuUrl : null
              const slug = getStrainSlug(name)
              const match = isQuizMatch(name)

              return (
                <Card
                  key={`m-${i}`}
                  className={`p-3 transition-all ${match ? 'ring-1 ring-leaf-500/30 bg-leaf-500/[0.03]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-leaf-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-800 dark:text-[#e8f0ea] truncate">
                        {name}
                      </span>
                      {match && <QuizMatchBadge />}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {price && <span className="text-xs font-bold text-leaf-500">{price}</span>}
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-leaf-400 hover:text-leaf-300 transition-colors"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                  <StrainActions slug={slug} name={name} showAuth={!!user} />
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Alternative Strains ── */}
      {altStrains.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-blue-400" />
            Similar Strains Available
          </h2>
          <div className="space-y-2">
            {altStrains.map((s, i) => {
              const name = typeof s === 'string' ? s : s.name
              const price = typeof s === 'object' ? s.price : null
              const slug = getStrainSlug(name)

              return (
                <Card key={`a-${i}`} className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700 dark:text-[#b0c4b4] truncate">
                        {name}
                      </span>
                    </div>
                    {price && (
                      <span className="text-xs font-medium text-blue-400 flex-shrink-0">
                        {price}
                      </span>
                    )}
                  </div>
                  <StrainActions slug={slug} name={name} showAuth={!!user} />
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Empty state: no menu data found (location mode) ── */}
      {isLocationMode && !menuLoading && matched.length === 0 && matchedStrains.length === 0 && (
        <Card className="p-6 mb-6 text-center">
          <Leaf size={28} className="text-gray-300 dark:text-[#4a5a4e] mx-auto mb-3" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-[#b0c4b4] mb-2">
            Menu Not Available
          </h3>
          <p className="text-xs text-gray-500 dark:text-[#8a9a8e] max-w-xs mx-auto mb-4">
            We couldn't load the menu for this dispensary. You can view their full menu on Weedmaps.
          </p>
          {(d.menuUrl || d.wmUrl) && (
            <a
              href={d.menuUrl || d.wmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-leaf-500 text-leaf-900 hover:bg-leaf-400 transition-colors shadow-md shadow-leaf-500/20 min-h-[44px]"
            >
              <ExternalLink size={14} />
              View Menu on Weedmaps
            </a>
          )}
        </Card>
      )}

      {/* ── CTA: View Full External Menu ── */}
      {(d.menuUrl || d.wmUrl) && (
        <Card className="p-4 mb-6 text-center">
          <a
            href={d.menuUrl || d.wmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-leaf-500 text-leaf-900 hover:bg-leaf-400 transition-colors shadow-md shadow-leaf-500/20 min-h-[44px]"
          >
            <ExternalLink size={14} />
            View Full Menu on Weedmaps
          </a>
          <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mt-3">
            See the complete live menu with real-time pricing and availability
          </p>
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-[9px] text-gray-300 dark:text-[#6a7a6e] text-center px-4">
        Menu data is updated daily and may not reflect real-time inventory. Always verify with the dispensary.
      </p>
    </div>
  )
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function BackButton() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(-1)}
      className="flex items-center gap-1 text-sm text-gray-500 dark:text-[#8a9a8e] hover:text-leaf-400 transition-colors mb-4 min-h-[44px]"
    >
      <ChevronLeft size={16} />
      Back to Dispensaries
    </button>
  )
}

function InfoBadge({ icon, text, variant }) {
  const colors =
    variant === 'leaf'
      ? 'bg-leaf-500/10 text-leaf-500 border-leaf-500/20 font-semibold'
      : variant === 'blue'
        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 font-semibold'
        : 'bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-[#8a9a8e] border-gray-200 dark:border-white/10 font-medium'

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] border ${colors}`}>
      {icon}
      {text}
    </span>
  )
}

function QuizMatchBadge() {
  return (
    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-leaf-500/15 text-leaf-500 border border-leaf-500/25 flex-shrink-0">
      Your Match
    </span>
  )
}

/** Action links that connect to other app features */
function StrainActions({ slug, name, showAuth }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
      <Link
        to={`/strain/${slug}`}
        className="flex items-center gap-1 text-[11px] font-semibold text-leaf-400 hover:text-leaf-300 transition-colors min-h-[44px]"
      >
        <Leaf size={12} />
        Strain Details
      </Link>
      <Link
        to={`/compare?add=${encodeURIComponent(name)}`}
        className="flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors min-h-[44px]"
      >
        <Plus size={12} />
        Compare
      </Link>
      {showAuth && (
        <Link
          to={`/journal?strain=${encodeURIComponent(name)}`}
          className="flex items-center gap-1 text-[11px] font-medium text-purple-400 hover:text-purple-300 transition-colors min-h-[44px]"
        >
          <BookOpen size={12} />
          Journal
        </Link>
      )}
      <Link
        to={`/community?strain=${encodeURIComponent(name)}`}
        className="flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors min-h-[44px]"
      >
        <MessageSquare size={12} />
        Reviews
      </Link>
    </div>
  )
}

/** Rich strain card for enhanced menu data — expandable with FULL strain details */
function StrainMenuCard({ item, isQuizMatch, getStrainSlug, showAuthActions, getStrainByName }) {
  const [expanded, setExpanded] = useState(false)
  const name = item.strain?.name || item.menuName
  const slug = item.strain?.slug || getStrainSlug(name)
  const match = isQuizMatch(name)

  // Look up full strain data from our database when expanded
  const fullStrain = useMemo(() => {
    if (!expanded || !getStrainByName) return null
    return getStrainByName(name)
  }, [expanded, getStrainByName, name])

  return (
    <Card className={`transition-all ${match ? 'ring-1 ring-leaf-500/30 bg-leaf-500/[0.03]' : ''} ${expanded ? 'border-leaf-500/20' : ''}`}>
      {/* Clickable header — always visible */}
      <div
        className="flex items-center justify-between gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } }}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${match ? 'bg-leaf-500' : 'bg-gray-300 dark:bg-[#3a4a3e]'}`} />
            <span className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] truncate">
              {name}
            </span>
            {match && <QuizMatchBadge />}
            {item.strain?.matchTier === 'fuzzy' && (
              <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
                ~match
              </span>
            )}
          </div>
          {/* Quick info chips — always visible */}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {item.strain?.type && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/15">
                {item.strain.type}
              </span>
            )}
            {item.strain?.thc != null && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/15">
                THC {item.strain.thc}%
              </span>
            )}
            {item.strain?.cbd != null && item.strain.cbd > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/15">
                CBD {item.strain.cbd}%
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.price && (
            <span className="text-sm font-bold text-leaf-500">{item.price}</span>
          )}
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400 dark:text-[#6a7a6e]" />
          ) : (
            <ChevronDown size={16} className="text-gray-400 dark:text-[#6a7a6e]" />
          )}
        </div>
      </div>

      {/* Expand/collapse toggle label when collapsed */}
      {!expanded && (
        <div
          className="px-4 pb-3 -mt-1 cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-leaf-400 hover:text-leaf-300 transition-colors">
            <Beaker size={10} />
            View Full Details
          </span>
        </div>
      )}

      {/* Expanded details — FULL strain profile from our database */}
      {expanded && (
        <div className="px-4 pb-4 animate-fade-in">
          {fullStrain ? (
            <>
              {/* Full strain details from our database — same as Strain Detail page */}
              <StrainCardExpanded strain={fullStrain} />

              {/* Connected feature links */}
              <div className="mt-4">
                <StrainActions slug={slug} name={name} showAuth={showAuthActions} />
              </div>
            </>
          ) : (
            <>
              {/* Fallback: limited details from harvest/search data */}
              {item.strain?.topTerpenes?.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-[9px] uppercase tracking-wider text-amber-400 font-bold mb-1.5">Terpenes</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {item.strain.topTerpenes.map((t, j) => (
                      <span
                        key={j}
                        className="px-2 py-1 rounded-lg text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/15 font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {item.strain?.topEffects?.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-[9px] uppercase tracking-wider text-leaf-400 font-bold mb-1.5">Effects</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {item.strain.topEffects.map((e, j) => (
                      <span
                        key={j}
                        className="px-2 py-1 rounded-lg text-[10px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/15 font-medium"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(item.strain?.thc != null || (item.strain?.cbd != null && item.strain.cbd > 0)) && (
                <div className="mb-3">
                  <h4 className="text-[9px] uppercase tracking-wider text-green-400 font-bold mb-1.5">Cannabinoids</h4>
                  <div className="space-y-1.5">
                    {item.strain?.thc != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-[#8a9a8e] w-8">THC</span>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-500/70"
                            style={{ width: `${Math.min(100, (item.strain.thc / 35) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-green-400 w-10 text-right">{item.strain.thc}%</span>
                      </div>
                    )}
                    {item.strain?.cbd != null && item.strain.cbd > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-[#8a9a8e] w-8">CBD</span>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500/70"
                            style={{ width: `${Math.min(100, (item.strain.cbd / 20) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-blue-400 w-10 text-right">{item.strain.cbd}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* View full strain profile — fallback CTA */}
              <Link
                to={`/strain/${slug}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-leaf-500/15 text-leaf-400 border border-leaf-500/25 hover:bg-leaf-500/25 transition-all min-h-[44px] mb-3"
                onClick={(e) => e.stopPropagation()}
              >
                <Leaf size={14} />
                View Full Strain Profile
              </Link>

              <StrainActions slug={slug} name={name} showAuth={showAuthActions} />
            </>
          )}
        </div>
      )}
    </Card>
  )
}
