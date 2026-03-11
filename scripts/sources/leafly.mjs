/**
 * leafly.mjs — Leafly dispensary discovery + menu scraping
 *
 * Uses Playwright to discover dispensaries on Leafly and scrape their
 * flower menus. Primary strategy: intercept API requests made by the
 * Leafly SPA to capture structured JSON data.
 *
 * Fallback strategy: parse rendered DOM if API interception fails.
 */

import { matchStrain } from '../lib/strain-matcher.mjs'
import { extractPrice } from '../lib/price-extractor.mjs'

/* ── Config ────────────────────────────────────────────────────────── */

const LEAFLY_BASE = 'https://www.leafly.com'
const FETCH_DELAY_MS = 500
const MAX_DISPENSARIES = 200    // max dispensaries per city
const MAX_MENU_PAGES = 3        // max menu pages per dispensary
const MENU_FETCH_RETRIES = 2

const sleep = ms => new Promise(r => setTimeout(r, ms))

/* ── Build Leafly dispensary finder URL ─────────────────────────────── */

function buildFinderUrl(city) {
  // Leafly uses /dispensaries/near-me?lat=XX&lng=XX or /dispensaries/{state}/{city}
  // The lat/lng approach gives broadest coverage
  return `${LEAFLY_BASE}/dispensaries/near-me?lat=${city.lat}&lng=${city.lng}&sort=distance`
}

/* ── Phase 1: Discover dispensaries via Leafly ─────────────────────── */

export async function discoverDispensaries(browser, city) {
  console.log(`  [Leafly] Discovering dispensaries near ${city.label}...`)

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const dispensaries = []
  const interceptedData = []

  // Intercept API calls to capture dispensary data
  page.on('response', async (response) => {
    const url = response.url()
    try {
      if (url.includes('/api/dispensary') || url.includes('/api/finder') || url.includes('dispensaries')) {
        if (response.headers()['content-type']?.includes('json')) {
          const json = await response.json().catch(() => null)
          if (json) interceptedData.push({ url, data: json })
        }
      }
    } catch { /* ignore response parsing errors */ }
  })

  try {
    const finderUrl = buildFinderUrl(city)
    console.log(`    [Leafly] Navigating to finder: ${finderUrl}`)
    await page.goto(finderUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await sleep(2000)

    // Try to extract from intercepted API data first
    for (const { data } of interceptedData) {
      const stores = data?.stores || data?.dispensaries || data?.data?.stores || data?.data || []
      if (Array.isArray(stores)) {
        for (const s of stores) {
          if (dispensaries.length >= MAX_DISPENSARIES) break
          const parsed = parseLeaflyDispensary(s)
          if (parsed) dispensaries.push(parsed)
        }
      }
    }

    // If API interception didn't yield results, parse the DOM
    if (dispensaries.length === 0) {
      console.log(`    [Leafly] No API data intercepted, parsing DOM...`)
      const domDisps = await parseDispensaryDOM(page)
      dispensaries.push(...domDisps.slice(0, MAX_DISPENSARIES))
    }

    // Load more results by scrolling (up to 3 scroll loads)
    if (dispensaries.length > 0 && dispensaries.length < MAX_DISPENSARIES) {
      for (let scroll = 0; scroll < 3; scroll++) {
        const prevCount = dispensaries.length
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await sleep(1500)

        // Check for "Load More" button
        const loadMore = await page.$('button:has-text("Load More"), button:has-text("Show More"), [data-testid="load-more"]')
        if (loadMore) {
          await loadMore.click().catch(() => {})
          await sleep(2000)
        }

        // Parse any new intercepted data
        for (const { data } of interceptedData) {
          const stores = data?.stores || data?.dispensaries || data?.data?.stores || data?.data || []
          if (Array.isArray(stores)) {
            for (const s of stores) {
              const parsed = parseLeaflyDispensary(s)
              if (parsed && !dispensaries.find(d => d.leaflySlug === parsed.leaflySlug)) {
                dispensaries.push(parsed)
              }
            }
          }
        }

        if (dispensaries.length === prevCount) break // no new results
        if (dispensaries.length >= MAX_DISPENSARIES) break
      }
    }
  } catch (err) {
    console.error(`    [Leafly] Discovery error: ${err.message}`)
  } finally {
    await context.close()
  }

  console.log(`  [Leafly] Found ${dispensaries.length} dispensaries`)
  return dispensaries
}

/* ── Parse a single Leafly dispensary from API JSON ────────────────── */

function parseLeaflyDispensary(s) {
  if (!s || !s.name) return null

  const slug = s.slug || s.id || (s.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return {
    id: `leafly-${slug}`,
    name: s.name,
    slug: slug,
    type: s.type || s.dispensaryType || 'dispensary',
    address: [s.address || s.street, s.city, s.state].filter(Boolean).join(', '),
    lat: s.latitude || s.lat || null,
    lng: s.longitude || s.lng || s.lon || null,
    rating: s.rating || s.starRating || null,
    reviewCount: s.reviewCount || s.numReviews || 0,
    phone: s.phone || s.phoneNumber || null,
    website: s.website || s.websiteUrl || null,
    wmUrl: null,
    leaflyUrl: `${LEAFLY_BASE}/dispensary-info/${slug}`,
    leaflySlug: slug,
    hours: s.todayHours || s.hours?.today || null,
    openNow: s.isOpen ?? s.openNow ?? false,
    delivery: s.delivery ?? false,
    pickup: s.pickup ?? s.orderAhead ?? false,
    storefront: s.storefront ?? s.hasStorefront ?? true,
    menuItemsCount: s.menuItemCount || s.numMenuItems || 0,
    sources: ['leafly'],
  }
}

/* ── Parse dispensaries from rendered DOM ───────────────────────────── */

async function parseDispensaryDOM(page) {
  return page.evaluate((leaflyBase) => {
    const cards = document.querySelectorAll('[data-testid="dispensary-card"], .dispensary-card, article[class*="dispensary"], a[href*="/dispensary-info/"]')
    const results = []

    for (const card of cards) {
      try {
        const nameEl = card.querySelector('h2, h3, [class*="name"], [data-testid="dispensary-name"]')
        const name = nameEl?.textContent?.trim()
        if (!name) continue

        const link = card.querySelector('a[href*="/dispensary-info/"]') || card.closest('a[href*="/dispensary-info/"]')
        const href = link?.getAttribute('href') || ''
        const slug = href.split('/dispensary-info/')[1]?.split('?')[0]?.split('/')[0] || ''

        const addressEl = card.querySelector('[class*="address"], [data-testid="address"]')
        const address = addressEl?.textContent?.trim() || ''

        const ratingEl = card.querySelector('[class*="rating"], [data-testid="star-rating"]')
        const ratingText = ratingEl?.textContent?.trim() || ''
        const rating = parseFloat(ratingText) || null

        results.push({
          id: `leafly-${slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          name,
          slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          type: 'dispensary',
          address,
          lat: null,
          lng: null,
          rating,
          reviewCount: 0,
          phone: null,
          website: null,
          wmUrl: null,
          leaflyUrl: slug ? `${leaflyBase}/dispensary-info/${slug}` : null,
          leaflySlug: slug || null,
          hours: null,
          openNow: false,
          delivery: false,
          pickup: false,
          storefront: true,
          menuItemsCount: 0,
          sources: ['leafly'],
        })
      } catch { /* skip malformed card */ }
    }

    return results
  }, LEAFLY_BASE)
}

/* ── Phase 2: Fetch menu for a single dispensary ───────────────────── */

async function fetchLeaflyMenu(browser, dispensary) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const menuItems = []
  const interceptedMenuData = []

  // Intercept menu API calls
  page.on('response', async (response) => {
    const url = response.url()
    try {
      if ((url.includes('menu') || url.includes('product')) && response.headers()['content-type']?.includes('json')) {
        const json = await response.json().catch(() => null)
        if (json) interceptedMenuData.push({ url, data: json })
      }
    } catch { /* ignore */ }
  })

  try {
    const slug = dispensary.leaflySlug || dispensary.slug
    // THC-A shops may not categorize as "flower" — try general menu first for them
    const menuPath = dispensary._thca ? 'menu' : 'menu/flower'
    const menuUrl = `${LEAFLY_BASE}/dispensary-info/${slug}/${menuPath}`
    await page.goto(menuUrl, { waitUntil: 'networkidle', timeout: 20000 })
    await sleep(1500)

    // Try intercepted API data first
    for (const { data } of interceptedMenuData) {
      const items = data?.menuItems || data?.products || data?.data?.menuItems || data?.data || []
      if (Array.isArray(items)) {
        for (const item of items) {
          const parsed = parseLeaflyMenuItem(item)
          if (parsed) menuItems.push(parsed)
        }
      }
    }

    // If no API data, parse DOM
    if (menuItems.length === 0) {
      const domItems = await parseMenuDOM(page)
      menuItems.push(...domItems)
    }

    // Scroll for more items
    if (menuItems.length > 0) {
      for (let scroll = 0; scroll < MAX_MENU_PAGES - 1; scroll++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await sleep(1000)

        const loadMore = await page.$('button:has-text("Load More"), button:has-text("Show More")')
        if (loadMore) {
          await loadMore.click().catch(() => {})
          await sleep(1500)
        } else {
          break
        }
      }
    }
  } catch (err) {
    console.log(`menu error: ${err.message}`)
  } finally {
    await context.close()
  }

  return menuItems
}

/* ── Parse a Leafly menu item from API JSON ────────────────────────── */

function parseLeaflyMenuItem(item) {
  if (!item || !item.name) return null

  // Leafly uses various price formats
  const prices = []
  if (item.prices) {
    if (Array.isArray(item.prices)) {
      prices.push(...item.prices)
    } else if (typeof item.prices === 'object') {
      // Leafly sometimes uses { "1g": 10, "3.5g": 35, "7g": 60 } format
      for (const [label, price] of Object.entries(item.prices)) {
        prices.push({ label, price })
      }
    }
  }

  return {
    name: item.name,
    prices,
    variants: item.variants || [],
    price: item.price ?? item.defaultPrice ?? null,
    image: item.image || item.imageUrl || item.photoUrl || null,
    brand: item.brand || item.brandName || null,
  }
}

/* ── Parse menu items from rendered DOM ────────────────────────────── */

async function parseMenuDOM(page) {
  return page.evaluate(() => {
    const cards = document.querySelectorAll('[data-testid="menu-item"], .menu-item, [class*="ProductCard"], [class*="menu-product"]')
    const results = []

    for (const card of cards) {
      try {
        const nameEl = card.querySelector('h3, h4, [class*="name"], [data-testid="product-name"]')
        const name = nameEl?.textContent?.trim()
        if (!name) continue

        const priceEl = card.querySelector('[class*="price"], [data-testid="price"]')
        const priceText = priceEl?.textContent?.trim() || ''
        const priceMatch = priceText.match(/\$?([\d.]+)/)
        const price = priceMatch ? parseFloat(priceMatch[1]) : null

        const brandEl = card.querySelector('[class*="brand"], [data-testid="brand"]')
        const brand = brandEl?.textContent?.trim() || null

        results.push({
          name,
          prices: [],
          variants: [],
          price,
          image: null,
          brand,
        })
      } catch { /* skip malformed card */ }
    }

    return results
  })
}

/* ── Harvest menus + match strains for Leafly dispensaries ──────────── */

export async function harvestMenus(browser, dispensaries, strainDB, { thca = false } = {}) {
  let totalMatched = 0
  const enriched = []

  for (let i = 0; i < dispensaries.length; i++) {
    const disp = { ...dispensaries[i], _thca: thca }
    process.stdout.write(`  [Leafly] [${i + 1}/${dispensaries.length}] ${disp.name}... `)

    let menuItems = []
    let fetchSuccess = false

    for (let attempt = 1; attempt <= MENU_FETCH_RETRIES; attempt++) {
      try {
        menuItems = await fetchLeaflyMenu(browser, disp)
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
