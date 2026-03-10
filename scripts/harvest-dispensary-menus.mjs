#!/usr/bin/env node
/**
 * harvest-dispensary-menus.mjs — Daily cron job (GitHub Actions)
 *
 * Uses Playwright to bypass Weedmaps bot detection, then fetches dispensary
 * listings + menus via the browser context API, matches menu items against
 * our strain database, and writes results to Cloudflare KV.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx CLOUDFLARE_KV_NAMESPACE_ID=xxx \
 *     node scripts/harvest-dispensary-menus.mjs
 *
 * Dependencies: playwright (install via `npm install playwright`)
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
  { slug: 'san-diego',   label: 'San Diego, CA',  lat: 32.7157, lng: -117.1611, wmPath: 'california/san-diego' },
  { slug: 'phoenix',     label: 'Phoenix, AZ',    lat: 33.4484, lng: -112.0740, wmPath: 'arizona/phoenix' },
  { slug: 'los-angeles', label: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437, wmPath: 'california/los-angeles' },
  { slug: 'new-york',    label: 'New York, NY',   lat: 40.7128, lng: -74.0060,  wmPath: 'new-york/new-york' },
  { slug: 'denver',      label: 'Denver, CO',     lat: 39.7392, lng: -104.9903, wmPath: 'colorado/denver' },
]

const DISPENSARIES_PER_BATCH = 5    // KV 25KB limit → ~5 dispensaries with trimmed menus per batch
const FETCH_DELAY_MS = 400          // delay between API calls within the browser
const CITY_DELAY_MS = 2000          // delay between cities
const MAX_DISPENSARIES_PER_CITY = 60
const MAX_MENU_ITEMS_PER_DISP = 200 // max flower items to process per dispensary

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID } = process.env

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
  console.error('Missing required env vars: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID')
  process.exit(1)
}

/* ── Load strain database ──────────────────────────────────────────── */

function loadStrainDB() {
  const jsonPath = resolve(__dirname, '../frontend/src/data/strains.json')
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'))

  // Build lookup maps for 3-tier matching
  const exactMap = new Map()     // normalized name → strain summary
  const nameList = []            // for fuzzy + substring matching

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

// Generic terms that are NOT real strain names — skip these in matching
const EXCLUDED_STRAIN_NAMES = new Set([
  'sativa', 'indica', 'hybrid', 'strain', 'unknown', 'na', 'flower',
  'indoor', 'outdoor', 'greenhouse', 'premium', 'classic', 'gold',
  'cream', 'lemon', 'grape', 'orange', 'mango', 'cherry', 'lime',
  'gello', 'sunshine', 'diamond', 'fire', 'ice', 'thunder', 'sugar',
  'honey', 'butter', 'cake', 'candy', 'cookie', 'cookies',
])

function matchStrain(menuItemName, strainDB) {
  // Clean menu item name — remove weight/size suffixes, brand prefixes, type labels
  const cleaned = (menuItemName || '')
    .replace(/\s*[-–|]\s*\d+(\.\d+)?\s*g\b/gi, '')      // "- 3.5g", "| 14g"
    .replace(/\s*\(\d+(\.\d+)?\s*g\)/gi, '')             // "(3.5g)"
    .replace(/\s*\[\d+(\.\d+)?\s*g\]/gi, '')             // "[3.5g]"
    .replace(/\s*[-–|]\s*(indica|sativa|hybrid)\b/gi, '') // "- Sativa"
    .replace(/\s*[-–|]\s*(small|smalls|smallz|popcorn)\b/gi, '')
    .replace(/\s*[-–|]\s*(indoor|outdoor|greenhouse)\b/gi, '')
    .replace(/\s*[-–|]\s*(flower|premium|gold cuts|classic cuts)\b/gi, '')
    .replace(/\b(1\/2\s*oz|half\s*oz|quarter|eighth)\b/gi, '')
    .replace(/\bdime\s*bag\s*\|\s*/gi, '')                // brand prefix
    .replace(/\bmr\.\s*zips\s*\|\s*/gi, '')               // brand prefix
    .replace(/\bcam\s*\|\s*/gi, '')                        // brand prefix
    .replace(/\b3\s*bros\s*\|\s*/gi, '')                   // brand prefix
    .replace(/\bslugg?ers\s*[-|]\s*(jarred\s*)?flower\s*[-|]\s*\d+g\s*[-|]\s*/gi, '') // "Sluggers - Jarred Flower - 5g -"
    .replace(/\s+/g, ' ')
    .trim()

  const norm = normalizeName(cleaned)
  if (!norm || norm.length < 4) return null

  // Tier 1: Exact match (skip excluded generic names)
  if (strainDB.exactMap.has(norm) && !EXCLUDED_STRAIN_NAMES.has(norm)) {
    return { ...strainDB.exactMap.get(norm), matchTier: 'exact' }
  }

  // Tier 2: Fuzzy match (Levenshtein distance ≤ 2)
  for (const { norm: dbNorm, summary } of strainDB.nameList) {
    if (EXCLUDED_STRAIN_NAMES.has(dbNorm)) continue
    if (Math.abs(norm.length - dbNorm.length) > 2) continue
    if (levenshtein(norm, dbNorm) <= 2) {
      return { ...summary, matchTier: 'fuzzy' }
    }
  }

  // Tier 3: Substring match — requires more specificity
  // Strain name must be ≥ 7 chars AND represent ≥ 40% of the menu item name
  for (const { norm: dbNorm, summary } of strainDB.nameList) {
    if (EXCLUDED_STRAIN_NAMES.has(dbNorm)) continue
    if (dbNorm.length < 7) continue
    if (norm.includes(dbNorm)) {
      // Strain name must be a substantial portion of the menu item
      const ratio = dbNorm.length / norm.length
      if (ratio >= 0.4) {
        return { ...summary, matchTier: 'substring' }
      }
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

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[b.length][a.length]
}

/* ── Playwright Browser Automation ───────────────────────────────── */

let browserPage = null  // reuse one page for all API fetches

/**
 * Fetch dispensary slugs by loading the Weedmaps city page and extracting links.
 */
async function fetchDispensarySlugs(page, wmPath) {
  const url = `https://weedmaps.com/dispensaries/in/united-states/${wmPath}`
  console.log(`  Loading ${url}`)

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

  // Wait for dispensary links to render
  try {
    await page.waitForSelector('a[href^="/dispensaries/"]', { timeout: 15000 })
  } catch {
    console.warn('  [WARN] Dispensary links did not appear in 15s — page may be empty')
    return []
  }

  // Let lazy content load
  await sleep(2000)

  // Scroll to load more dispensaries
  for (let i = 0; i < 5; i++) {
    await page.evaluate('window.scrollBy(0, 1000)')
    await sleep(800)
  }

  // Scroll back to top
  await page.evaluate('window.scrollTo(0, 0)')

  // Extract unique dispensary slugs from anchor hrefs
  const slugs = await page.evaluate(`(() => {
    const anchors = document.querySelectorAll('a');
    const seen = new Set();
    const results = [];
    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/^\\/dispensaries\\/([\\w-]+)$/);
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        results.push(m[1]);
      }
    }
    return results;
  })()`)

  return slugs.slice(0, MAX_DISPENSARIES_PER_CITY)
}

/**
 * Fetch dispensary detail via API from within the browser context.
 * This bypasses bot detection since cookies/session are established.
 */
async function fetchDispensaryDetail(page, slug) {
  return page.evaluate(async (s) => {
    try {
      const r = await fetch(
        `https://api-g.weedmaps.com/discovery/v1/listings/dispensaries/${s}`
      )
      if (!r.ok) return { error: r.status }
      const d = await r.json()
      const L = d?.data?.listing || {}
      return {
        name: L.name,
        slug: L.slug || s,
        address: [L.address, L.city, L.state].filter(Boolean).join(', '),
        city: L.city,
        state: L.state,
        zip: L.zip_code,
        lat: L.latitude,
        lng: L.longitude,
        rating: L.rating || null,
        reviewCount: L.reviews_count || 0,
        phone: L.phone_number || null,
        website: L.website || null,
        wmUrl: `https://weedmaps.com/dispensaries/${L.slug || s}`,
        hours: L.business_hours || null,
        delivery: L.has_delivery || false,
        pickup: L.has_curbside_pickup || false,
        type: L.license_type || L.type || 'dispensary',
      }
    } catch (e) {
      return { error: e.message }
    }
  }, slug)
}

/**
 * Fetch flower menu items via API from within the browser context.
 */
async function fetchMenuItems(page, slug, maxItems) {
  return page.evaluate(async ({ slug, maxItems }) => {
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
            category: m.category?.name || 'Flower',
            image: m.avatar_image?.small_url || null,
            brand: m.brand?.name || null,
          })
        }

        const totalPages = d?.meta?.total_pages || 1
        if (pageNum >= totalPages) break
        pageNum++
      } catch {
        break
      }
    }

    return items.slice(0, maxItems)
  }, { slug, maxItems })
}

function formatHours(bh) {
  if (!bh) return null
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = days[new Date().getDay()]
  const todayHours = bh?.[today]
  if (!todayHours) return null
  if (todayHours.is_closed) return 'Closed today'
  return `${todayHours.open || '?'} - ${todayHours.close || '?'}`
}

function extractPrice(menuItem) {
  // Handle various price formats from Weedmaps API
  if (menuItem.price && typeof menuItem.price === 'number') return `$${menuItem.price}`
  if (menuItem.price && typeof menuItem.price === 'string' && menuItem.price.includes('$')) return menuItem.price

  const prices = Array.isArray(menuItem.prices) ? menuItem.prices : []
  if (prices.length === 0) return null

  // Find eighth price
  const eighth = prices.find(p =>
    (p.label || p.units || '').toLowerCase().includes('eighth') ||
    (p.label || '').toLowerCase().includes('3.5')
  )
  if (eighth?.price) return `$${eighth.price}/eighth`

  // Find gram price
  const gram = prices.find(p =>
    (p.label || p.units || '').toLowerCase().includes('gram') ||
    (p.label || '') === '1g'
  )
  if (gram?.price) return `$${gram.price}/g`

  // Fallback: first available price
  const first = prices.find(p => p.price)
  if (first?.price) return `$${first.price}/${first.label || first.units || 'unit'}`

  return null
}

/* ── Cloudflare KV Writes ──────────────────────────────────────────── */

const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}`

async function kvPut(key, value, ttlSeconds = 86400) {
  const url = `${KV_BASE}/values/${encodeURIComponent(key)}`
  const body = JSON.stringify(value)

  const sizeKB = Buffer.byteLength(body, 'utf-8') / 1024
  if (sizeKB > 24) {
    console.warn(`  [WARN] KV value for "${key}" is ${sizeKB.toFixed(1)}KB — may exceed limit`)
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
}

/* ── Main Harvest Logic ────────────────────────────────────────────── */

async function harvestCity(page, city, strainDB) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Harvesting: ${city.label}`)
  console.log(`${'═'.repeat(60)}`)

  // 1. Get dispensary slugs from the city listing page
  console.log('  Fetching dispensary slugs from listing page...')
  const slugs = await fetchDispensarySlugs(page, city.wmPath)
  console.log(`  Found ${slugs.length} dispensary slugs`)

  if (slugs.length === 0) {
    console.log('  No dispensaries found — skipping city')
    return { dispensaryCount: 0, matchedCount: 0 }
  }

  // 2. For each dispensary, fetch detail + menu via browser API
  let totalMatched = 0
  const enrichedDispensaries = []

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]
    console.log(`  [${i + 1}/${slugs.length}] ${slug}...`)

    try {
      // Fetch dispensary detail
      const detail = await fetchDispensaryDetail(page, slug)
      if (detail.error) {
        console.warn(`    [WARN] Detail fetch failed: ${detail.error}`)
        continue
      }

      await sleep(FETCH_DELAY_MS)

      // Fetch flower menu items
      const menuItems = await fetchMenuItems(page, slug, MAX_MENU_ITEMS_PER_DISP)
      console.log(`    ${detail.name}: ${menuItems.length} flower items`)

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
            image: item.image,
            brand: item.brand,
            strain: match,
          })
        } else {
          unmatchedCount++
        }
      }

      totalMatched += matchedMenu.length
      console.log(`    Matched: ${matchedMenu.length}/${menuItems.length}`)

      const topMatches = matchedMenu.slice(0, 3).map(m => m.strain.name)

      enrichedDispensaries.push({
        id: detail.slug || slug,
        name: detail.name,
        address: detail.address,
        lat: detail.lat,
        lng: detail.lng,
        rating: detail.rating,
        reviewCount: detail.reviewCount,
        phone: detail.phone,
        website: detail.website,
        wmUrl: detail.wmUrl,
        hours: formatHours(detail.hours),
        delivery: detail.delivery,
        pickup: detail.pickup,
        type: detail.type,
        menuSummary: {
          total: menuItems.length,
          matched: matchedMenu.length,
          topMatches,
        },
        matchedMenu,
        unmatchedCount,
      })
    } catch (err) {
      console.warn(`    [ERROR] ${slug}: ${err.message}`)
    }
  }

  // 3. Write to KV — city index + batches
  console.log(`\n  Writing to KV...`)

  // Assign batch indices
  for (let i = 0; i < enrichedDispensaries.length; i++) {
    enrichedDispensaries[i].batchIndex = Math.floor(i / DISPENSARIES_PER_BATCH)
  }

  // City index — lightweight summary for the frontend list view
  const cityIndex = {
    city: city.slug,
    label: city.label,
    lat: city.lat,
    lng: city.lng,
    updatedAt: new Date().toISOString(),
    dispensaryCount: enrichedDispensaries.length,
    matchedStrainCount: totalMatched,
    dispensaries: enrichedDispensaries.map(d => ({
      id: d.id,
      name: d.name,
      address: d.address,
      lat: d.lat,
      lng: d.lng,
      rating: d.rating,
      reviewCount: d.reviewCount,
      phone: d.phone,
      website: d.website,
      wmUrl: d.wmUrl,
      hours: d.hours,
      delivery: d.delivery,
      pickup: d.pickup,
      type: d.type,
      menuSummary: d.menuSummary,
      batchIndex: d.batchIndex,
    })),
  }

  await kvPut(`city:${city.slug}:index`, cityIndex)
  console.log(`  ✓ city:${city.slug}:index (${enrichedDispensaries.length} dispensaries)`)

  // Batches — full menu data for dispensary detail views
  const batchCount = Math.ceil(enrichedDispensaries.length / DISPENSARIES_PER_BATCH)
  for (let b = 0; b < batchCount; b++) {
    const batchStart = b * DISPENSARIES_PER_BATCH
    const batchEnd = batchStart + DISPENSARIES_PER_BATCH
    const batchDisps = enrichedDispensaries.slice(batchStart, batchEnd)

    const batchData = {
      city: city.slug,
      batchIndex: b,
      updatedAt: new Date().toISOString(),
      dispensaries: batchDisps.map(d => ({
        id: d.id,
        // Trim to top 15 matches with compact strain data to fit 25KB KV limit
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
    }

    await kvPut(`city:${city.slug}:batch:${b}`, batchData)
    console.log(`  ✓ city:${city.slug}:batch:${b} (${batchDisps.length} dispensaries)`)
  }

  console.log(`  Done: ${enrichedDispensaries.length} dispensaries, ${totalMatched} matched menu items`)
  return { dispensaryCount: enrichedDispensaries.length, matchedCount: totalMatched }
}

/* ── Cities index (list of available cities for frontend) ──────────── */

async function writeCitiesIndex(results) {
  const index = {
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

  await kvPut('cities:index', index)
  console.log(`\n✓ cities:index written (${index.cities.length} cities with data)`)
}

/* ── Utilities ─────────────────────────────────────────────────────── */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/* ── Main ──────────────────────────────────────────────────────────── */

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  MyStrainAI — Dispensary Menu Harvest (Playwright)      ║')
  console.log('║  Weedmaps → Strain Matching → Cloudflare KV            ║')
  console.log(`║  ${new Date().toISOString().padEnd(52)}║`)
  console.log('╚══════════════════════════════════════════════════════════╝')

  const strainDB = loadStrainDB()

  // Launch headless browser
  console.log('\nLaunching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  // Establish session by visiting Weedmaps homepage
  console.log('Establishing session...')
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

  // Write the master cities index
  await writeCitiesIndex(results)

  // Cleanup
  await browser.close()
  console.log('\nBrowser closed.')

  console.log('\n' + '═'.repeat(60))
  console.log(`  HARVEST COMPLETE`)
  console.log(`  ${totalDisp} dispensaries across ${Object.values(results).filter(r => r.dispensaryCount > 0).length} cities`)
  console.log(`  ${totalMatched} total matched menu items`)
  console.log('═'.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
