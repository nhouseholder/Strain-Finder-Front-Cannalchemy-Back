/**
 * weedmaps.mjs — Weedmaps dispensary discovery + menu fetching
 *
 * Phase 1: Uses v2/listings API to discover dispensaries (no browser needed).
 * Phase 2: Uses Playwright browser context to fetch flower menus
 *          (menu API returns 406 without browser session).
 */

import { matchStrain } from '../lib/strain-matcher.mjs'
import { extractPrice } from '../lib/price-extractor.mjs'

/* ── Config ────────────────────────────────────────────────────────── */

const BOUNDING_RADIUS = '25mi'
const LISTING_PAGE_SIZE = 150
const FETCH_DELAY_MS = 300
const MAX_MENU_ITEMS_PER_DISP = 300
const MENU_FETCH_RETRIES = 3

const sleep = ms => new Promise(r => setTimeout(r, ms))

/* ── Phase 1: Discover dispensaries via v2/listings API ─────────────── */

export async function discoverDispensaries(city) {
  console.log(`  [WM] Fetching listings within ${BOUNDING_RADIUS} of ${city.label}...`)

  const allListings = []
  let page = 1

  while (true) {
    const url = `https://api-g.weedmaps.com/discovery/v2/listings` +
      `?filter[bounding_radius]=${BOUNDING_RADIUS}` +
      `&filter[bounding_latlng]=${city.lat},${city.lng}` +
      `&page_size=${LISTING_PAGE_SIZE}` +
      `&page=${page}`

    const res = await fetch(url)
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

/* ── Phase 2: Fetch flower menu via browser context ────────────────── */

async function fetchMenuItems(browserPage, slug, maxItems) {
  return browserPage.evaluate(async ({ slug, maxItems }) => {
    const items = []
    let pageNum = 1
    const maxPages = 3

    while (pageNum <= maxPages && items.length < maxItems) {
      try {
        const r = await fetch(
          `https://api-g.weedmaps.com/discovery/v1/listings/dispensaries/${slug}/menu_items?filter[category]=flower&page_size=100&page=${pageNum}`
        )
        if (!r.ok) break
        const d = await r.json()
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
      } catch { break }
    }

    return items.slice(0, maxItems)
  }, { slug, maxItems })
}

/* ── Harvest menus + match strains for all dispensaries ─────────────── */

export async function harvestMenus(browserPage, dispensaries, strainDB) {
  let totalMatched = 0
  const enriched = []

  // Sort by menu_items_count descending — process richest menus first
  dispensaries.sort((a, b) => (b.menuItemsCount || 0) - (a.menuItemsCount || 0))

  for (let i = 0; i < dispensaries.length; i++) {
    const disp = dispensaries[i]
    process.stdout.write(`  [WM] [${i + 1}/${dispensaries.length}] ${disp.name}... `)

    let menuItems = []
    let fetchSuccess = false

    for (let attempt = 1; attempt <= MENU_FETCH_RETRIES; attempt++) {
      try {
        menuItems = await fetchMenuItems(browserPage, disp.slug, MAX_MENU_ITEMS_PER_DISP)
        fetchSuccess = true
        break
      } catch (err) {
        if (attempt < MENU_FETCH_RETRIES) {
          console.log(`retry ${attempt}/${MENU_FETCH_RETRIES}... `)
          await sleep(FETCH_DELAY_MS * attempt * 2)
        } else {
          console.log(`FAILED after ${MENU_FETCH_RETRIES} attempts: ${err.message}`)
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

    // Match each menu item against our strain DB
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
