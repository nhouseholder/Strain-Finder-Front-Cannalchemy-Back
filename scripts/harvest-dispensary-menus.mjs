#!/usr/bin/env node
/**
 * harvest-dispensary-menus.mjs — Daily cron job (GitHub Actions)
 *
 * Fetches dispensary listings + menus from Weedmaps for 5 cities,
 * matches menu items against our strain database, and writes results
 * to Cloudflare KV for instant frontend access.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx CLOUDFLARE_KV_NAMESPACE_ID=xxx \
 *     node scripts/harvest-dispensary-menus.mjs
 *
 * ENV vars:
 *   CLOUDFLARE_API_TOKEN        — Cloudflare API token with KV write access
 *   CLOUDFLARE_ACCOUNT_ID       — Cloudflare account ID
 *   CLOUDFLARE_KV_NAMESPACE_ID  — KV namespace ID (the CACHE binding)
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ── Config ────────────────────────────────────────────────────────── */

const CITIES = [
  { slug: 'san-diego',   label: 'San Diego, CA',  lat: 32.7157, lng: -117.1611, wmSlug: 'san-diego-california' },
  { slug: 'phoenix',     label: 'Phoenix, AZ',    lat: 33.4484, lng: -112.0740, wmSlug: 'phoenix-arizona' },
  { slug: 'los-angeles', label: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437, wmSlug: 'los-angeles-california' },
  { slug: 'new-york',    label: 'New York, NY',   lat: 40.7128, lng: -74.0060,  wmSlug: 'new-york-new-york' },
  { slug: 'denver',      label: 'Denver, CO',     lat: 39.7392, lng: -104.9903, wmSlug: 'denver-colorado' },
]

const WM_BASE = 'https://api-g.weedmaps.com/discovery/v2'
const WM_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
}

const DISPENSARIES_PER_BATCH = 10   // KV 25KB limit → ~10 dispensaries with menus per batch
const API_DELAY_MS = 600            // delay between API calls
const CITY_DELAY_MS = 2000          // delay between cities
const MAX_DISPENSARIES_PER_CITY = 100
const MAX_MENU_PAGES = 3            // max pages of menu items per dispensary

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

function matchStrain(menuItemName, strainDB) {
  const norm = normalizeName(menuItemName)
  if (!norm || norm.length < 3) return null

  // Tier 1: Exact match
  if (strainDB.exactMap.has(norm)) {
    return { ...strainDB.exactMap.get(norm), matchTier: 'exact' }
  }

  // Tier 2: Fuzzy match (Levenshtein distance ≤ 2)
  for (const { norm: dbNorm, summary } of strainDB.nameList) {
    if (Math.abs(norm.length - dbNorm.length) > 2) continue
    if (levenshtein(norm, dbNorm) <= 2) {
      return { ...summary, matchTier: 'fuzzy' }
    }
  }

  // Tier 3: Substring match (menu item contains strain name or vice versa)
  // Only match if the substring is substantial (≥ 5 chars)
  for (const { norm: dbNorm, summary } of strainDB.nameList) {
    if (dbNorm.length < 5) continue
    if (norm.includes(dbNorm) || dbNorm.includes(norm)) {
      return { ...summary, matchTier: 'substring' }
    }
  }

  return null
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  // Optimize: early exit if length diff > threshold
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

/* ── Weedmaps API ──────────────────────────────────────────────────── */

async function fetchJSON(url) {
  const res = await fetch(url, { headers: WM_HEADERS })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  return res.json()
}

async function fetchDispensaries(wmSlug) {
  const dispensaries = []
  let page = 1

  while (dispensaries.length < MAX_DISPENSARIES_PER_CITY) {
    const url = `${WM_BASE}/listings?filter[region_slug]=${wmSlug}&filter[any_retailer_services][]=storefront&filter[any_retailer_services][]=delivery&page_size=50&page=${page}`

    try {
      const data = await fetchJSON(url)
      const listings = data?.data?.listings || []

      if (listings.length === 0) break

      for (const l of listings) {
        dispensaries.push({
          id: l.slug || `wm-${l.id}`,
          wmId: l.id,
          name: l.name,
          slug: l.slug,
          address: [l.address, l.city, l.state].filter(Boolean).join(', '),
          lat: l.latitude,
          lng: l.longitude,
          rating: l.rating || null,
          reviewCount: l.reviews_count || 0,
          phone: l.phone_number || null,
          website: l.website || null,
          wmUrl: `https://weedmaps.com/dispensaries/${l.slug}`,
          hours: l.business_hours ? formatHours(l.business_hours) : null,
          delivery: !!(l.retailer_services || []).includes('delivery'),
          type: l.license_type || 'dispensary',
        })
      }

      // Check if more pages
      const meta = data?.meta?.pagination || {}
      if (page >= (meta.total_pages || 1)) break
      page++
      await sleep(API_DELAY_MS)
    } catch (err) {
      console.warn(`  [WARN] Failed to fetch dispensaries page ${page}: ${err.message}`)
      break
    }
  }

  return dispensaries.slice(0, MAX_DISPENSARIES_PER_CITY)
}

function formatHours(bh) {
  // bh is typically an object like { monday: { open: "09:00", close: "21:00" }, ... }
  // Just return today's hours for simplicity
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = days[new Date().getDay()]
  const todayHours = bh?.[today]
  if (!todayHours) return null
  if (todayHours.is_closed) return 'Closed today'
  return `${todayHours.open || '?'} - ${todayHours.close || '?'}`
}

async function fetchMenu(dispensarySlug) {
  const items = []
  let page = 1

  while (page <= MAX_MENU_PAGES) {
    const url = `${WM_BASE}/listings/${dispensarySlug}/menu_items?page_size=100&page=${page}&filter[category_slug]=flower`

    try {
      const data = await fetchJSON(url)
      const menuItems = data?.data?.menu_items || []

      if (menuItems.length === 0) break

      for (const m of menuItems) {
        items.push({
          name: m.name,
          price: extractPrice(m),
          category: m.category?.name || 'Flower',
          image: m.avatar_image?.small_url || null,
        })
      }

      const meta = data?.meta?.pagination || {}
      if (page >= (meta.total_pages || 1)) break
      page++
      await sleep(API_DELAY_MS)
    } catch (err) {
      console.warn(`  [WARN] Failed to fetch menu page ${page} for ${dispensarySlug}: ${err.message}`)
      break
    }
  }

  return items
}

function extractPrice(menuItem) {
  // Weedmaps menu items have various price structures
  const prices = menuItem.prices || []
  if (prices.length === 0) return null

  // Find eighth price (most common reference)
  const eighth = prices.find(p => p.label?.toLowerCase().includes('eighth') || p.label?.toLowerCase().includes('3.5'))
  if (eighth?.price) return `$${eighth.price}/eighth`

  // Find gram price
  const gram = prices.find(p => p.label?.toLowerCase().includes('gram') || p.label === '1g')
  if (gram?.price) return `$${gram.price}/g`

  // Fallback: first available price
  const first = prices.find(p => p.price)
  if (first?.price) return `$${first.price}/${first.label || 'unit'}`

  return null
}

/* ── Cloudflare KV Writes ──────────────────────────────────────────── */

const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}`

async function kvPut(key, value, ttlSeconds = 86400) {
  const url = `${KV_BASE}/values/${encodeURIComponent(key)}`
  const body = JSON.stringify(value)

  // Check size (25KB limit for KV values)
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

async function harvestCity(city, strainDB) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Harvesting: ${city.label} (${city.wmSlug})`)
  console.log(`${'═'.repeat(60)}`)

  // 1. Fetch dispensary listings
  console.log('  Fetching dispensary listings...')
  const dispensaries = await fetchDispensaries(city.wmSlug)
  console.log(`  Found ${dispensaries.length} dispensaries`)

  if (dispensaries.length === 0) {
    console.log('  No dispensaries found — skipping city')
    return { dispensaryCount: 0, matchedCount: 0 }
  }

  // 2. Fetch menus + match strains for each dispensary
  let totalMatched = 0
  const enrichedDispensaries = []

  for (let i = 0; i < dispensaries.length; i++) {
    const d = dispensaries[i]
    console.log(`  [${i + 1}/${dispensaries.length}] ${d.name}...`)

    try {
      const menuItems = await fetchMenu(d.slug)
      console.log(`    Menu: ${menuItems.length} flower items`)

      // Match each menu item against our DB
      const matchedMenu = []
      let unmatchedCount = 0

      for (const item of menuItems) {
        const match = matchStrain(item.name, strainDB)
        if (match) {
          matchedMenu.push({
            menuName: item.name,
            price: item.price,
            image: item.image,
            strain: match,
          })
        } else {
          unmatchedCount++
        }
      }

      totalMatched += matchedMenu.length
      console.log(`    Matched: ${matchedMenu.length}/${menuItems.length}`)

      // Build top matches for the summary (index key)
      const topMatches = matchedMenu
        .slice(0, 3)
        .map(m => m.strain.name)

      enrichedDispensaries.push({
        ...d,
        menuSummary: {
          total: menuItems.length,
          matched: matchedMenu.length,
          topMatches,
        },
        matchedMenu,
        unmatchedCount,
      })
    } catch (err) {
      console.warn(`    [ERROR] Menu fetch failed: ${err.message}`)
      enrichedDispensaries.push({
        ...d,
        menuSummary: { total: 0, matched: 0, topMatches: [] },
        matchedMenu: [],
        unmatchedCount: 0,
      })
    }

    await sleep(API_DELAY_MS)
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
        matchedMenu: d.matchedMenu,
        unmatchedCount: d.unmatchedCount,
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
  console.log('║  MyStrainAI — Dispensary Menu Harvest                   ║')
  console.log('║  Weedmaps → Strain Matching → Cloudflare KV            ║')
  console.log(`║  ${new Date().toISOString().padEnd(52)}║`)
  console.log('╚══════════════════════════════════════════════════════════╝')

  const strainDB = loadStrainDB()
  const results = {}
  let totalDisp = 0
  let totalMatched = 0

  for (const city of CITIES) {
    try {
      const r = await harvestCity(city, strainDB)
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
