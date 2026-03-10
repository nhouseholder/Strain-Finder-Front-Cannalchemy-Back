#!/usr/bin/env node
/**
 * harvest-dispensary-menus.mjs — Daily cron job (GitHub Actions)
 *
 * Phase 1: Uses Weedmaps v2/listings API to discover ALL dispensaries
 *          within a 25mi radius of each city center (no Playwright needed).
 * Phase 2: Uses Playwright browser context to fetch flower menus for each
 *          dispensary (menu API requires browser session to bypass 406).
 * Phase 3: 3-tier strain matching against our 21K strain database.
 * Phase 4: Writes results to Cloudflare KV in paginated format.
 *
 * KV Structure:
 *   cities:index              → list of available cities + counts
 *   city:{slug}:index         → meta + first 100 dispensaries
 *   city:{slug}:index:{page}  → additional dispensary pages (100 each)
 *   city:{slug}:batch:{n}     → menu data for 5 dispensaries
 *
 * ENV vars:
 *   CLOUDFLARE_API_TOKEN        — Cloudflare API token with KV write access
 *   CLOUDFLARE_ACCOUNT_ID       — Cloudflare account ID
 *   CLOUDFLARE_KV_NAMESPACE_ID  — KV namespace ID (the CACHE binding)
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ── Config ────────────────────────────────────────────────────────── */

const CITIES = [
  { slug: 'san-diego',   label: 'San Diego, CA',   lat: 32.7157, lng: -117.1611 },
  { slug: 'phoenix',     label: 'Phoenix, AZ',     lat: 33.4484, lng: -112.0740 },
  { slug: 'los-angeles', label: 'Los Angeles, CA',  lat: 34.0522, lng: -118.2437 },
  { slug: 'new-york',    label: 'New York, NY',     lat: 40.7128, lng: -74.0060  },
  { slug: 'denver',      label: 'Denver, CO',       lat: 39.7392, lng: -104.9903 },
]

const BOUNDING_RADIUS = '25mi'         // covers full metro area
const LISTING_PAGE_SIZE = 150          // max allowed by Weedmaps API
const DISPENSARIES_PER_BATCH = 5       // menu batch size for KV (25KB limit)
const DISPENSARIES_PER_INDEX_PAGE = 100 // index page size for KV (25KB limit)
const FETCH_DELAY_MS = 300             // delay between menu API calls
const CITY_DELAY_MS = 2000             // delay between cities
const MAX_MENU_ITEMS_PER_DISP = 200    // max flower items per dispensary

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID } = process.env

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
  console.error('Missing required env vars: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID')
  process.exit(1)
}

/* ── Load strain database ──────────────────────────────────────────── */

function loadStrainDB() {
  const jsonPath = resolve(__dirname, '../frontend/src/data/strains.json')
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'))

  const exactMap = new Map()
  const nameList = []

  for (const s of raw) {
    const norm = normalizeName(s.name)
    const summary = {
      name: s.name,
      slug: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      type: s.type,
      thc: s.cannabinoids?.find(c => c.name === 'thc')?.value ?? null,
      cbd: s.cannabinoids?.find(c => c.name === 'cbd')?.value ?? null,
      topEffects: (s.effects || []).slice(0, 3).map(e => e.name),
      topTerpenes: (s.terpenes || []).slice(0, 3).map(t => t.name),
    }
    exactMap.set(norm, summary)
    nameList.push({ norm, summary })
  }

  console.log(`[StrainDB] Loaded ${exactMap.size} strains for matching`)
  return { exactMap, nameList }
}

function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/* ── 3-Tier Strain Matching ────────────────────────────────────────── */

const EXCLUDED = new Set([
  'sativa', 'indica', 'hybrid', 'strain', 'unknown', 'na', 'flower',
  'indoor', 'outdoor', 'greenhouse', 'premium', 'classic', 'gold',
  'cream', 'lemon', 'grape', 'orange', 'mango', 'cherry', 'lime',
  'gello', 'sunshine', 'diamond', 'fire', 'ice', 'thunder', 'sugar',
  'honey', 'butter', 'cake', 'candy', 'cookie', 'cookies',
])

function matchStrain(menuItemName, strainDB) {
  const cleaned = (menuItemName || '')
    .replace(/\s*[-–|]\s*\d+(\.\d+)?\s*g\b/gi, '')
    .replace(/\s*\(\d+(\.\d+)?\s*g\)/gi, '')
    .replace(/\s*\[\d+(\.\d+)?\s*g\]/gi, '')
    .replace(/\s*[-–|]\s*(indica|sativa|hybrid)\b/gi, '')
    .replace(/\s*[-–|]\s*(small|smalls|smallz|popcorn)\b/gi, '')
    .replace(/\s*[-–|]\s*(indoor|outdoor|greenhouse)\b/gi, '')
    .replace(/\s*[-–|]\s*(flower|premium|gold cuts|classic cuts)\b/gi, '')
    .replace(/\b(1\/2\s*oz|half\s*oz|quarter|eighth)\b/gi, '')
    .replace(/\bdime\s*bag\s*\|\s*/gi, '')
    .replace(/\bmr\.\s*zips\s*\|\s*/gi, '')
    .replace(/\bcam\s*\|\s*/gi, '')
    .replace(/\b3\s*bros\s*\|\s*/gi, '')
    .replace(/\bslugg?ers\s*[-|]\s*(jarred\s*)?flower\s*[-|]\s*\d+g\s*[-|]\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  const norm = normalizeName(cleaned)
  if (!norm || norm.length < 4) return null

  // Tier 1: Exact match
  if (strainDB.exactMap.has(norm) && !EXCLUDED.has(norm)) {
    return { ...strainDB.exactMap.get(norm), matchTier: 'exact' }
  }

  // Tier 2: Fuzzy match (Levenshtein ≤ 2)
  for (const { norm: dbNorm, summary } of strainDB.nameList) {
    if (EXCLUDED.has(dbNorm)) continue
    if (Math.abs(norm.length - dbNorm.length) > 2) continue
    if (levenshtein(norm, dbNorm) <= 2) {
      return { ...summary, matchTier: 'fuzzy' }
    }
  }

  // Tier 3: Substring (≥7 chars, ≥40% ratio)
  for (const { norm: dbNorm, summary } of strainDB.nameList) {
    if (EXCLUDED.has(dbNorm)) continue
    if (dbNorm.length < 7) continue
    if (norm.includes(dbNorm) && (dbNorm.length / norm.length) >= 0.4) {
      return { ...summary, matchTier: 'substring' }
    }
  }

  return null
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  if (Math.abs(a.length - b.length) > 2) return 3
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  return matrix[b.length][a.length]
}

/* ── Phase 1: Discover ALL dispensaries via v2/listings API ─────────── */

async function fetchAllListings(city) {
  console.log(`  Fetching all listings within ${BOUNDING_RADIUS} of ${city.label}...`)

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
      console.warn(`  [WARN] Listing API returned ${res.status} on page ${page}`)
      break
    }

    const data = await res.json()
    const listings = data?.data?.listings || []
    if (listings.length === 0) break

    for (const L of listings) {
      // Include dispensaries and delivery services (skip doctors, stores)
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
      })
    }

    const totalFromMeta = data?.meta?.total_listings || 0
    console.log(`    Page ${page}: ${listings.length} items (total: ${totalFromMeta})`)

    if (allListings.length >= totalFromMeta || listings.length < LISTING_PAGE_SIZE) break
    page++
    await sleep(300) // small delay between listing pages
  }

  console.log(`  Found ${allListings.length} dispensaries + delivery services`)
  return allListings
}

/* ── Phase 2: Fetch flower menus via browser context ───────────────── */

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
            price: m.price,
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

function extractPrice(menuItem) {
  if (menuItem.price && typeof menuItem.price === 'number') return `$${menuItem.price}`
  if (menuItem.price && typeof menuItem.price === 'string' && menuItem.price.includes('$')) return menuItem.price

  const prices = Array.isArray(menuItem.prices) ? menuItem.prices : []
  if (prices.length === 0) return null

  const eighth = prices.find(p =>
    (p.label || p.units || '').toLowerCase().includes('eighth') ||
    (p.label || '').toLowerCase().includes('3.5')
  )
  if (eighth?.price) return `$${eighth.price}/eighth`

  const gram = prices.find(p =>
    (p.label || p.units || '').toLowerCase().includes('gram') ||
    (p.label || '') === '1g'
  )
  if (gram?.price) return `$${gram.price}/g`

  const first = prices.find(p => p.price)
  if (first?.price) return `$${first.price}/${first.label || first.units || 'unit'}`

  return null
}

/* ── Cloudflare KV Writes ──────────────────────────────────────────── */

const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}`

async function kvPut(key, value) {
  const url = `${KV_BASE}/values/${encodeURIComponent(key)}`
  const body = JSON.stringify(value)
  const sizeKB = Buffer.byteLength(body, 'utf-8') / 1024

  if (sizeKB > 24) {
    console.warn(`  ⚠️  KV "${key}" is ${sizeKB.toFixed(1)}KB — may exceed 25KB limit!`)
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`KV PUT failed for "${key}": ${res.status} — ${text}`)
  }
  console.log(`  ✓ ${key} (${sizeKB.toFixed(1)}KB)`)
}

/* ── Main Harvest Logic ────────────────────────────────────────────── */

async function harvestCity(browserPage, city, strainDB) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Harvesting: ${city.label}`)
  console.log(`${'═'.repeat(60)}`)

  // Phase 1: Discover ALL dispensaries via public API (no browser needed)
  const listings = await fetchAllListings(city)
  if (listings.length === 0) {
    console.log('  No dispensaries found — skipping city')
    return { dispensaryCount: 0, matchedCount: 0 }
  }

  // Phase 2 + 3: Fetch menus and match strains (needs browser)
  let totalMatched = 0
  const enriched = []

  // Sort by menu_items_count descending — process richest menus first
  listings.sort((a, b) => (b.menuItemsCount || 0) - (a.menuItemsCount || 0))

  for (let i = 0; i < listings.length; i++) {
    const disp = listings[i]
    process.stdout.write(`  [${i + 1}/${listings.length}] ${disp.name}... `)

    // Skip dispensaries with no menu items at all
    if (disp.menuItemsCount === 0) {
      console.log(`no menu`)
      enriched.push({
        ...disp,
        menuSummary: { total: 0, matched: 0, topMatches: [] },
        matchedMenu: [],
        unmatchedCount: 0,
      })
      continue
    }

    try {
      const menuItems = await fetchMenuItems(browserPage, disp.slug, MAX_MENU_ITEMS_PER_DISP)
      await sleep(FETCH_DELAY_MS)

      // Match each menu item against our strain DB
      const matchedMenu = []
      let unmatchedCount = 0

      for (const item of menuItems) {
        const match = matchStrain(item.name, strainDB)
        if (match) {
          matchedMenu.push({
            menuName: item.name,
            price: extractPrice(item),
            brand: item.brand,
            strain: match,
          })
        } else {
          unmatchedCount++
        }
      }

      totalMatched += matchedMenu.length
      console.log(`${menuItems.length} items, ${matchedMenu.length} matched`)

      enriched.push({
        ...disp,
        menuSummary: {
          total: menuItems.length,
          matched: matchedMenu.length,
          topMatches: matchedMenu.slice(0, 3).map(m => m.strain.name),
        },
        matchedMenu,
        unmatchedCount,
      })
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
      enriched.push({
        ...disp,
        menuSummary: { total: 0, matched: 0, topMatches: [] },
        matchedMenu: [],
        unmatchedCount: 0,
      })
    }
  }

  // Phase 4: Write to KV
  console.log(`\n  Writing to KV...`)

  // Assign batch indices
  for (let i = 0; i < enriched.length; i++) {
    enriched[i].batchIndex = Math.floor(i / DISPENSARIES_PER_BATCH)
  }

  // Build compact dispensary entries for index (strip heavy fields)
  const compactDisps = enriched.map(d => ({
    id: d.id,
    name: d.name,
    address: d.address,
    lat: d.lat,
    lng: d.lng,
    rating: d.rating,
    reviewCount: d.reviewCount,
    phone: d.phone,
    wmUrl: d.wmUrl,
    hours: d.hours,
    openNow: d.openNow,
    delivery: d.delivery,
    pickup: d.pickup,
    storefront: d.storefront,
    type: d.type,
    menuSummary: d.menuSummary,
    batchIndex: d.batchIndex,
  }))

  // Paginate city index (100 dispensaries per page to stay under 25KB)
  const indexPageCount = Math.ceil(compactDisps.length / DISPENSARIES_PER_INDEX_PAGE)

  // First index page includes meta + first 100 dispensaries
  const indexBase = {
    city: city.slug,
    label: city.label,
    lat: city.lat,
    lng: city.lng,
    updatedAt: new Date().toISOString(),
    dispensaryCount: enriched.length,
    matchedStrainCount: totalMatched,
    indexPages: indexPageCount,
    dispensaries: compactDisps.slice(0, DISPENSARIES_PER_INDEX_PAGE),
  }
  await kvPut(`city:${city.slug}:index`, indexBase)

  // Additional index pages
  for (let p = 1; p < indexPageCount; p++) {
    const start = p * DISPENSARIES_PER_INDEX_PAGE
    const end = start + DISPENSARIES_PER_INDEX_PAGE
    await kvPut(`city:${city.slug}:index:${p}`, {
      city: city.slug,
      page: p,
      dispensaries: compactDisps.slice(start, end),
    })
  }

  // Menu batches (5 dispensaries per batch, top 15 matches each)
  const batchCount = Math.ceil(enriched.length / DISPENSARIES_PER_BATCH)
  for (let b = 0; b < batchCount; b++) {
    const batchDisps = enriched.slice(b * DISPENSARIES_PER_BATCH, (b + 1) * DISPENSARIES_PER_BATCH)
    await kvPut(`city:${city.slug}:batch:${b}`, {
      city: city.slug,
      batchIndex: b,
      updatedAt: new Date().toISOString(),
      dispensaries: batchDisps.map(d => ({
        id: d.id,
        matchedMenu: d.matchedMenu.slice(0, 15).map(m => ({
          menuName: m.menuName,
          price: m.price,
          brand: m.brand,
          strain: {
            name: m.strain.name,
            slug: m.strain.slug,
            type: m.strain.type,
            thc: m.strain.thc,
            matchTier: m.strain.matchTier,
          },
        })),
        unmatchedCount: d.unmatchedCount,
        totalMatched: d.matchedMenu.length,
      })),
    })
  }

  console.log(`  Done: ${enriched.length} dispensaries, ${totalMatched} matched menu items`)
  return { dispensaryCount: enriched.length, matchedCount: totalMatched }
}

/* ── Main ──────────────────────────────────────────────────────────── */

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  MyStrainAI — Full Dispensary Harvest v2                ║')
  console.log('║  Weedmaps v2/listings API → Strain Matching → KV       ║')
  console.log(`║  ${new Date().toISOString().padEnd(52)}║`)
  console.log('╚══════════════════════════════════════════════════════════╝')

  const strainDB = loadStrainDB()

  // Launch headless browser (needed for menu API calls which block server-side requests)
  console.log('\nLaunching browser for menu fetches...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  // Establish session for menu API calls
  console.log('Establishing browser session...')
  await page.goto('https://weedmaps.com', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(2000)
  console.log('Session established ✓\n')

  const results = {}
  let totalDisp = 0
  let totalMatched = 0

  for (const city of CITIES) {
    try {
      const r = await harvestCity(page, city, strainDB)
      results[city.slug] = r
      totalDisp += r.dispensaryCount
      totalMatched += r.matchedCount
    } catch (err) {
      console.error(`\n  ✗ FAILED: ${city.label} — ${err.message}`)
      results[city.slug] = { dispensaryCount: 0, matchedCount: 0 }
    }
    await sleep(CITY_DELAY_MS)
  }

  // Write master cities index
  const citiesIndex = {
    updatedAt: new Date().toISOString(),
    cities: CITIES.map(c => ({
      slug: c.slug,
      label: c.label,
      lat: c.lat,
      lng: c.lng,
      dispensaryCount: results[c.slug]?.dispensaryCount || 0,
      matchedStrainCount: results[c.slug]?.matchedCount || 0,
    })).filter(c => c.dispensaryCount > 0),
  }
  await kvPut('cities:index', citiesIndex)

  await browser.close()
  console.log('\nBrowser closed.')

  console.log('\n' + '═'.repeat(60))
  console.log(`  HARVEST COMPLETE`)
  console.log(`  ${totalDisp} dispensaries across ${Object.values(results).filter(r => r.dispensaryCount > 0).length} cities`)
  console.log(`  ${totalMatched} total matched menu items`)
  for (const c of CITIES) {
    const r = results[c.slug] || {}
    console.log(`    ${c.label}: ${r.dispensaryCount || 0} dispensaries, ${r.matchedCount || 0} matched`)
  }
  console.log('═'.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
