/**
 * leafly.mjs — Leafly dispensary discovery + menu fetching (pure HTTP)
 *
 * No Playwright/browser required. Uses HTTP fetch + __NEXT_DATA__ SSR parsing.
 *
 * Discovery: Fetches the dispensary finder HTML page, extracts structured JSON
 *            from the embedded __NEXT_DATA__ script tag (~30 dispensaries/city).
 *
 * Menu:      Fetches each dispensary's info page HTML, extracts menu items from
 *            __NEXT_DATA__ SSR payload (~8 items per category, ~56 total).
 */

import { matchStrain } from '../lib/strain-matcher.mjs'
import { extractPrice } from '../lib/price-extractor.mjs'

/* ── Config ────────────────────────────────────────────────────────── */

const LEAFLY_BASE = 'https://www.leafly.com'
const FETCH_DELAY_MS = 500
const MAX_DISPENSARIES = 200
const MENU_FETCH_RETRIES = 2

const sleep = ms => new Promise(r => setTimeout(r, ms))

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

/* ── Extract __NEXT_DATA__ JSON from HTML ─────────────────────────── */

function extractNextData(html) {
  const marker = '<script id="__NEXT_DATA__" type="application/json">'
  const start = html.indexOf(marker)
  if (start === -1) return null

  const jsonStart = start + marker.length
  const jsonEnd = html.indexOf('</script>', jsonStart)
  if (jsonEnd === -1) return null

  try {
    return JSON.parse(html.slice(jsonStart, jsonEnd))
  } catch {
    return null
  }
}

/* ── Phase 1: Discover dispensaries via Leafly ─────────────────────── */

export async function discoverDispensaries(_browserUnused, city) {
  // Signature keeps `browser` param for backward compat but ignores it
  console.log(`  [Leafly] Discovering dispensaries near ${city.label}...`)

  const dispensaries = []

  try {
    const finderUrl = `${LEAFLY_BASE}/dispensaries/near-me?lat=${city.lat}&lng=${city.lng}&sort=distance`
    console.log(`    [Leafly] Fetching: ${finderUrl}`)

    const res = await fetch(finderUrl, { headers: HEADERS, redirect: 'follow' })
    if (!res.ok) {
      console.log(`    [Leafly] HTTP ${res.status} — skipping`)
      return dispensaries
    }

    const html = await res.text()
    const nextData = extractNextData(html)

    if (!nextData) {
      console.log(`    [Leafly] No __NEXT_DATA__ found in HTML`)
      return dispensaries
    }

    // Leafly embeds dispensaries in multiple possible paths
    const pageProps = nextData?.props?.pageProps || {}
    const stores =
      pageProps?.storeLocatorResults?.data?.organicStores ||
      pageProps?.storeLocatorResults?.data?.stores ||
      pageProps?.stores ||
      pageProps?.dispensaries ||
      []

    for (const s of stores) {
      if (dispensaries.length >= MAX_DISPENSARIES) break
      const parsed = parseLeaflyDispensary(s)
      if (parsed) dispensaries.push(parsed)
    }

    // Also check for sponsored/featured stores
    const sponsoredStores =
      pageProps?.storeLocatorResults?.data?.sponsoredStores ||
      pageProps?.storeLocatorResults?.data?.featuredStores ||
      []

    for (const s of sponsoredStores) {
      if (dispensaries.length >= MAX_DISPENSARIES) break
      const parsed = parseLeaflyDispensary(s)
      if (parsed && !dispensaries.find(d => d.leaflySlug === parsed.leaflySlug)) {
        dispensaries.push(parsed)
      }
    }
  } catch (err) {
    console.error(`    [Leafly] Discovery error: ${err.message}`)
  }

  console.log(`  [Leafly] Found ${dispensaries.length} dispensaries`)
  return dispensaries
}

/* ── Parse a single Leafly dispensary from SSR JSON ───────────────── */

function parseLeaflyDispensary(s) {
  if (!s || !s.name) return null

  const slug = s.slug || s.id || (s.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return {
    id: `leafly-${slug}`,
    name: s.name,
    slug: slug,
    type: s.type || s.dispensaryType || 'dispensary',
    address: [s.address1 || s.address || s.street, s.city, s.state].filter(Boolean).join(', '),
    lat: s.lat || s.latitude || null,
    lng: s.lon || s.lng || s.longitude || null,
    rating: s.reviewRating || s.rating || s.starRating || null,
    reviewCount: s.reviewCount || s.numReviews || 0,
    phone: s.phone || s.phoneNumber || null,
    website: s.website || s.websiteUrl || null,
    wmUrl: null,
    leaflyUrl: `${LEAFLY_BASE}/dispensary-info/${slug}`,
    leaflySlug: slug,
    hours: s.todayHours || s.hours?.today || null,
    openNow: s.openStatus === 'open' || s.isOpen || s.openNow || false,
    delivery: !!(s.configurations?.delivery || s.delivery),
    pickup: !!(s.configurations?.pickup || s.configurations?.preorder || s.pickup || s.orderAhead),
    storefront: s.storefront ?? s.hasStorefront ?? true,
    menuItemsCount: s.menuItemCount || s.numMenuItems || s.activeMenuDealsCount || 0,
    sources: ['leafly'],
  }
}

/* ── Phase 2: Fetch menu for a single dispensary via HTTP ──────────── */

const MAX_MENU_PAGES = 5  // 18 items/page × 5 = up to 90 flower items

async function fetchLeaflyMenu(dispensary) {
  const slug = dispensary.leaflySlug || dispensary.slug
  const menuItems = []
  const seenNames = new Set()

  const addItem = (item) => {
    const parsed = parseLeaflyMenuItem(item)
    if (parsed && !seenNames.has(parsed.name)) {
      seenNames.add(parsed.name)
      menuItems.push(parsed)
    }
  }

  // Strategy 1: Paginated /menu page (18 items/page, richest data)
  try {
    for (let page = 1; page <= MAX_MENU_PAGES; page++) {
      const category = dispensary._thca ? '' : 'Flower'
      const params = new URLSearchParams()
      if (category) params.set('product_category', category)
      if (page > 1) params.set('page', String(page))
      const qs = params.toString() ? `?${params.toString()}` : ''
      const menuUrl = `${LEAFLY_BASE}/dispensary-info/${slug}/menu${qs}`

      const res = await fetch(menuUrl, { headers: HEADERS, redirect: 'manual' })

      // Handle redirects — Leafly may redirect server-side requests
      if (res.status >= 300 && res.status < 400) break

      if (!res.ok) break

      const html = await res.text()
      const nextData = extractNextData(html)
      if (!nextData) break

      const pageProps = nextData?.props?.pageProps || {}

      // menuData.menuItems is the paginated menu (18 per page)
      const menuData = pageProps?.menuData || {}
      const items = menuData?.menuItems || []

      if (items.length === 0) break
      for (const item of items) addItem(item)

      // Check if we've gotten all items
      const totalItems = menuData?.totalItems || 0
      if (menuItems.length >= totalItems) break

      await sleep(FETCH_DELAY_MS)
    }
  } catch (err) {
    // Strategy 1 failed, try fallback
  }

  // Strategy 2: Detail page carousel (fallback — 8 items per category)
  if (menuItems.length === 0) {
    try {
      const detailUrl = `${LEAFLY_BASE}/dispensary-info/${slug}`
      const res = await fetch(detailUrl, { headers: HEADERS, redirect: 'manual' })

      if (res.ok) {
        const html = await res.text()
        const nextData = extractNextData(html)
        if (nextData) {
          const pageProps = nextData?.props?.pageProps || {}

          // productsForCategoryCarousels: [{name: "Flower", menuItems: [...]}]
          const carousels = pageProps?.productsForCategoryCarousels || []
          for (const carousel of carousels) {
            // For non-THC-A, only grab Flower category
            if (!dispensary._thca && carousel?.name && carousel.name !== 'Flower') continue
            const items = carousel?.menuItems || carousel?.items || []
            if (Array.isArray(items)) {
              for (const item of items) addItem(item)
            }
          }

          // Also check direct menu paths
          const directMenu = pageProps?.menuItems || pageProps?.menuData?.menuItems || []
          if (Array.isArray(directMenu)) {
            for (const item of directMenu) addItem(item)
          }
        }
      }
    } catch (err) {
      // Both strategies failed
    }
  }

  return menuItems
}

/* ── Parse a Leafly menu item from SSR JSON ──────────────────────── */

function parseLeaflyMenuItem(item) {
  if (!item || !item.name) return null

  // Use strainName if available (cleaner than product name which includes weight)
  const name = item.strainName || item.name

  const prices = []
  if (item.prices) {
    if (Array.isArray(item.prices)) {
      prices.push(...item.prices)
    } else if (typeof item.prices === 'object') {
      for (const [label, price] of Object.entries(item.prices)) {
        prices.push({ label, price })
      }
    }
  }

  // Pass through Leafly variants with fields needed for price extraction
  const variants = []
  if (Array.isArray(item.variants)) {
    for (const v of item.variants) {
      variants.push({
        label: v.displayQuantity || v.unit || '',
        price: v.price ?? null,
        quantity: v.quantity ?? null,
        unit: v.unit || '',
        cartQuantity: v.cartQuantity ?? null,
        cartUnit: v.cartUnit || '',
        displayQuantity: v.displayQuantity || '',
        normalizedQuantityLabel: v.normalizedQuantityLabel || '',
      })
    }
  }

  const price = item.price ?? item.sortPrice ?? item.defaultPrice ?? null

  return {
    name,
    prices,
    variants,
    price,
    image: item.imageUrl || item.formattedThumbnailUrl || item.thumbnailUrl || null,
    brand: item.brandName || (typeof item.brand === 'string' ? item.brand : item.brand?.name) || null,
  }
}

/* ── Harvest menus + match strains for Leafly dispensaries ──────────── */

export async function harvestMenus(_browserUnused, dispensaries, strainDB, { thca = false } = {}) {
  let totalMatched = 0
  const enriched = []

  for (let i = 0; i < dispensaries.length; i++) {
    const disp = { ...dispensaries[i], _thca: thca }
    process.stdout.write(`  [Leafly] [${i + 1}/${dispensaries.length}] ${disp.name}... `)

    let menuItems = []
    let fetchSuccess = false

    for (let attempt = 1; attempt <= MENU_FETCH_RETRIES; attempt++) {
      try {
        menuItems = await fetchLeaflyMenu(disp)
        fetchSuccess = true
        break
      } catch (err) {
        if (attempt < MENU_FETCH_RETRIES) {
          console.log(`retry ${attempt}/${MENU_FETCH_RETRIES}... `)
          await sleep(FETCH_DELAY_MS * attempt * 2)
        } else {
          console.log(`FAILED: ${err.message}`)
        }
      }
    }
    await sleep(FETCH_DELAY_MS)

    if (!fetchSuccess || menuItems.length === 0) {
      console.log(fetchSuccess ? `0 menu items` : `fetch failed`)
      enriched.push({
        ...disp,
        menuSummary: { total: 0, matched: 0, topMatches: [], hasMenu: false },
        matchedMenu: [],
        unmatchedCount: 0,
      })
      continue
    }

    const matchedMenu = []
    let unmatchedCount = 0

    for (const item of menuItems) {
      const match = matchStrain(item.name, strainDB)
      if (match) {
        const { display: price, eighthPrice } = extractPrice(item)
        matchedMenu.push({
          menuName: item.name,
          price,
          priceEighth: eighthPrice,
          brand: item.brand,
          strain: match,
        })
      } else {
        unmatchedCount++
      }
    }

    totalMatched += matchedMenu.length
    console.log(`${menuItems.length} items, ${matchedMenu.length} matched, ${unmatchedCount} unmatched`)

    enriched.push({
      ...disp,
      menuSummary: {
        total: menuItems.length,
        matched: matchedMenu.length,
        topMatches: matchedMenu.slice(0, 5).map(m => m.strain.name),
        hasMenu: true,
      },
      matchedMenu,
      unmatchedCount,
    })
  }

  return { enriched, totalMatched }
}
