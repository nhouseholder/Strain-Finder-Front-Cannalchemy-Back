/**
 * weedmaps.mjs — Weedmaps dispensary discovery + menu fetching (pure HTTP)
 *
 * No Playwright/browser required. All API calls use standard fetch().
 *
 * Phase 1: Uses v2/listings API to discover dispensaries.
 * Phase 2: Uses v1/menu_items API with browser-like headers to fetch menus.
 */

import { matchStrain } from '../lib/strain-matcher.mjs'
import { extractPrice } from '../lib/price-extractor.mjs'

/* ── Config ────────────────────────────────────────────────────────── */

const BOUNDING_RADIUS = '25mi'
const LISTING_PAGE_SIZE = 150
const FETCH_DELAY_MS = 300
const MAX_MENU_ITEMS_PER_DISP = 300
const MENU_FETCH_RETRIES = 3
const MAX_MENU_PAGES = 3

const sleep = ms => new Promise(r => setTimeout(r, ms))

const API_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://weedmaps.com/',
  'Origin': 'https://weedmaps.com',
}

/* ── Phase 1: Discover dispensaries via v2/listings API ─────────────── */

export async function discoverDispensaries(city, { thca = false } = {}) {
  console.log(`  [WM] Fetching listings within ${BOUNDING_RADIUS} of ${city.label}${thca ? ' (THC-A market)' : ''}...`)

  const allListings = []
  let page = 1

  while (true) {
    const url = `https://api-g.weedmaps.com/discovery/v2/listings` +
      `?filter[bounding_radius]=${BOUNDING_RADIUS}` +
      `&filter[bounding_latlng]=${city.lat},${city.lng}` +
      `&page_size=${LISTING_PAGE_SIZE}` +
      `&page=${page}`

    const res = await fetch(url, { headers: API_HEADERS })
    if (!res.ok) {
      console.warn(`  [WM][WARN] Listing API returned ${res.status} on page ${page}`)
      break
    }

    const data = await res.json()
    const listings = data?.data?.listings || []
    if (listings.length === 0) break

    for (const L of listings) {
      const type = L.type || ''
      if (type !== 'dispensary' && type !== 'delivery') continue

      allListings.push({
        id: L.slug,
        name: L.name,
        slug: L.slug,
        type: L.license_type || type,
        address: [L.address, L.city, L.state].filter(Boolean).join(', '),
        lat: L.latitude,
        lng: L.longitude,
        rating: L.rating || null,
        reviewCount: L.reviews_count || 0,
        phone: L.phone_number || null,
        website: L.web_url || null,
        wmUrl: `https://weedmaps.com/dispensaries/${L.slug}`,
        hours: L.todays_hours_str || null,
        openNow: L.open_now || false,
        delivery: (L.retailer_services || []).includes('delivery'),
        pickup: (L.retailer_services || []).includes('pickup'),
        storefront: (L.retailer_services || []).includes('storefront'),
        menuItemsCount: L.menu_items_count || 0,
        sources: ['weedmaps'],
      })
    }

    const totalFromMeta = data?.meta?.total_listings || 0
    console.log(`    [WM] Page ${page}: ${listings.length} items (total: ${totalFromMeta})`)

    if (allListings.length >= totalFromMeta || listings.length < LISTING_PAGE_SIZE) break
    page++
    await sleep(300)
  }

  console.log(`  [WM] Found ${allListings.length} dispensaries + delivery services`)
  return allListings
}

/* ── Phase 2: Fetch menu items via v1/menu_items API (pure HTTP) ──── */

async function fetchMenuItems(slug, maxItems, { categories = ['flower'] } = {}) {
  const items = []

  for (const category of categories) {
    let pageNum = 1

    while (pageNum <= MAX_MENU_PAGES && items.length < maxItems) {
      try {
        const apiUrl =
          `https://api-g.weedmaps.com/discovery/v1/listings/dispensaries/${slug}/menu_items` +
          `?filter[category]=${category}&page_size=100&page=${pageNum}`

        const res = await fetch(apiUrl, { headers: API_HEADERS })
        if (!res.ok) break

        const d = await res.json()
        const menuItems = d?.data?.menu_items || []
        if (menuItems.length === 0) break

        for (const m of menuItems) {
          items.push({
            name: m.name,
            prices: m.prices || [],
            variants: m.variants || [],
            price: m.price ?? null,
            image: m.avatar_image?.small_url || null,
            brand: m.brand?.name || null,
          })
        }

        const totalPages = d?.meta?.total_pages || 1
        if (pageNum >= totalPages) break
        pageNum++
        await sleep(FETCH_DELAY_MS)
      } catch { break }
    }
  }

  return items.slice(0, maxItems)
}

/* ── Process a single dispensary's menu ─────────────────────────────── */

async function processOneDispensary(disp, strainDB, menuCategories) {
  let menuItems = []
  let fetchSuccess = false

  for (let attempt = 1; attempt <= MENU_FETCH_RETRIES; attempt++) {
    try {
      menuItems = await fetchMenuItems(disp.slug, MAX_MENU_ITEMS_PER_DISP, { categories: menuCategories })
      fetchSuccess = true
      break
    } catch {
      if (attempt < MENU_FETCH_RETRIES) {
        await sleep(FETCH_DELAY_MS * attempt * 2)
      }
    }
  }

  if (!fetchSuccess || menuItems.length === 0) {
    return {
      ...disp,
      menuSummary: { total: 0, matched: 0, topMatches: [], hasMenu: false },
      matchedMenu: [],
      unmatchedCount: 0,
      _matched: 0,
    }
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

  return {
    ...disp,
    menuSummary: {
      total: menuItems.length,
      matched: matchedMenu.length,
      topMatches: matchedMenu.slice(0, 5).map(m => m.strain.name),
      hasMenu: true,
    },
    matchedMenu,
    unmatchedCount,
    _matched: matchedMenu.length,
  }
}

/* ── Harvest menus + match strains (concurrent, 5 at a time) ─────── */

const CONCURRENCY = 5

export async function harvestMenus(_unused, dispensaries, strainDB, { thca = false } = {}) {
  let totalMatched = 0
  const enriched = []

  const menuCategories = thca ? ['flower', 'pre-rolls', 'concentrates'] : ['flower']

  // Sort by menu_items_count descending — process richest menus first
  dispensaries.sort((a, b) => (b.menuItemsCount || 0) - (a.menuItemsCount || 0))

  // Process in batches of CONCURRENCY
  for (let i = 0; i < dispensaries.length; i += CONCURRENCY) {
    const batch = dispensaries.slice(i, i + CONCURRENCY)
    const batchNum = Math.floor(i / CONCURRENCY) + 1
    const totalBatches = Math.ceil(dispensaries.length / CONCURRENCY)
    process.stdout.write(`  [WM] Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + CONCURRENCY, dispensaries.length)}/${dispensaries.length})... `)

    const results = await Promise.all(
      batch.map(disp => processOneDispensary(disp, strainDB, menuCategories))
    )

    let batchMatched = 0
    let batchItems = 0
    for (const r of results) {
      batchMatched += r._matched || 0
      batchItems += r.menuSummary.total
      totalMatched += r._matched || 0
      delete r._matched
      enriched.push(r)
    }

    console.log(`${batchItems} items, ${batchMatched} matched`)
    await sleep(FETCH_DELAY_MS)
  }

  return { enriched, totalMatched }
}
