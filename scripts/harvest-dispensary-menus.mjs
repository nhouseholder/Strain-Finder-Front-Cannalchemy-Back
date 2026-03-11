#!/usr/bin/env node
/**
 * harvest-dispensary-menus.mjs — Daily cron job (GitHub Actions)
 *
 * Multi-source dispensary harvester:
 *   1. Weedmaps — v2/listings API discovery + Playwright menu fetch
 *   2. Leafly   — Playwright-based discovery + menu scraping
 *
 * For each city:
 *   Phase 1: Discover dispensaries from all sources
 *   Phase 2: Deduplicate across sources
 *   Phase 3: Fetch menus + 3-tier strain matching
 *   Phase 4: Write results to Cloudflare KV
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

import { chromium } from 'playwright'
import { loadStrainDB } from './lib/strain-matcher.mjs'
import { writeCityToKV, writeCitiesIndex } from './lib/kv-writer.mjs'
import { deduplicateDispensaries } from './lib/dedup.mjs'
import { discoverDispensaries as discoverWM, harvestMenus as harvestWM } from './sources/weedmaps.mjs'
import { discoverDispensaries as discoverLeafly, harvestMenus as harvestLeafly } from './sources/leafly.mjs'

/* ── Config ────────────────────────────────────────────────────────── */

const CITIES = [
  { slug: 'san-diego',   label: 'San Diego, CA',   lat: 32.7157, lng: -117.1611 },
  { slug: 'phoenix',     label: 'Phoenix, AZ',     lat: 33.4484, lng: -112.0740 },
  { slug: 'los-angeles', label: 'Los Angeles, CA',  lat: 34.0522, lng: -118.2437 },
  { slug: 'new-york',    label: 'New York, NY',     lat: 40.7128, lng: -74.0060  },
  { slug: 'denver',      label: 'Denver, CO',       lat: 39.7392, lng: -104.9903 },
]

const CITY_DELAY_MS = 2000

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID } = process.env

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
  console.error('Missing required env vars: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID')
  process.exit(1)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

/* ── Harvest a single city ─────────────────────────────────────────── */

async function harvestCity(browser, wmPage, city, strainDB) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Harvesting: ${city.label}`)
  console.log(`${'═'.repeat(60)}`)

  // Phase 1: Discover dispensaries from all sources
  const sourceLists = []

  // Weedmaps discovery (no browser needed for listings API)
  try {
    const wmDisps = await discoverWM(city)
    if (wmDisps.length > 0) {
      sourceLists.push({ source: 'weedmaps', dispensaries: wmDisps })
    }
  } catch (err) {
    console.error(`  [WM] Discovery failed: ${err.message}`)
  }

  // Leafly discovery (needs browser)
  try {
    const leaflyDisps = await discoverLeafly(browser, city)
    if (leaflyDisps.length > 0) {
      sourceLists.push({ source: 'leafly', dispensaries: leaflyDisps })
    }
  } catch (err) {
    console.error(`  [Leafly] Discovery failed: ${err.message}`)
  }

  if (sourceLists.length === 0 || sourceLists.every(s => s.dispensaries.length === 0)) {
    console.log('  No dispensaries found from any source — skipping city')
    return { dispensaryCount: 0, matchedCount: 0 }
  }

  // Phase 2: Deduplicate across sources
  const allDispensaries = deduplicateDispensaries(sourceLists)

  // Phase 3: Fetch menus + match strains
  // Split dispensaries by source for menu fetching
  const wmOnly = allDispensaries.filter(d => d.sources?.includes('weedmaps') && d.slug)
  const leaflyOnly = allDispensaries.filter(d =>
    d.sources?.includes('leafly') &&
    !d.sources?.includes('weedmaps') &&
    d.leaflySlug
  )

  // Harvest Weedmaps menus (uses shared browser page with WM session)
  let totalMatched = 0
  const enrichedMap = new Map()

  if (wmOnly.length > 0) {
    console.log(`\n  Fetching Weedmaps menus for ${wmOnly.length} dispensaries...`)
    const { enriched: wmEnriched, totalMatched: wmMatched } = await harvestWM(wmPage, wmOnly, strainDB)
    totalMatched += wmMatched
    for (const d of wmEnriched) enrichedMap.set(d.id, d)
  }

  // Harvest Leafly menus (opens new contexts per dispensary)
  if (leaflyOnly.length > 0) {
    console.log(`\n  Fetching Leafly menus for ${leaflyOnly.length} Leafly-only dispensaries...`)
    const { enriched: leaflyEnriched, totalMatched: leaflyMatched } = await harvestLeafly(browser, leaflyOnly, strainDB)
    totalMatched += leaflyMatched
    for (const d of leaflyEnriched) enrichedMap.set(d.id, d)
  }

  // Add dispensaries that had menus from both sources already in dedup
  for (const d of allDispensaries) {
    if (!enrichedMap.has(d.id)) {
      enrichedMap.set(d.id, {
        ...d,
        menuSummary: d.menuSummary || { total: 0, matched: 0, topMatches: [], hasMenu: false },
        matchedMenu: d.matchedMenu || [],
        unmatchedCount: d.unmatchedCount || 0,
      })
    }
  }

  const enriched = [...enrichedMap.values()]

  // Phase 4: Write to KV
  await writeCityToKV(city, enriched, totalMatched)

  const sourceBreakdown = {
    weedmaps: wmOnly.length,
    leafly: leaflyOnly.length,
    both: allDispensaries.filter(d => d.sources?.length > 1).length,
  }
  console.log(`  Sources: WM=${sourceBreakdown.weedmaps}, Leafly=${sourceBreakdown.leafly}, Both=${sourceBreakdown.both}`)

  return { dispensaryCount: enriched.length, matchedCount: totalMatched, sourceBreakdown }
}

/* ── Main ──────────────────────────────────────────────────────────── */

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  MyStrainAI — Multi-Source Dispensary Harvest v4        ║')
  console.log('║  Weedmaps + Leafly → Dedup → Strain Match → KV        ║')
  console.log(`║  ${new Date().toISOString().padEnd(52)}║`)
  console.log('╚══════════════════════════════════════════════════════════╝')

  const strainDB = loadStrainDB()

  // Launch headless browser
  console.log('\nLaunching browser...')
  const browser = await chromium.launch({ headless: true })
  const wmContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  })
  const wmPage = await wmContext.newPage()

  // Establish Weedmaps session for menu API calls
  console.log('Establishing Weedmaps browser session...')
  await wmPage.goto('https://weedmaps.com', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(2000)
  console.log('Session established ✓\n')

  const results = {}
  let totalDisp = 0
  let totalMatched = 0

  for (const city of CITIES) {
    try {
      const r = await harvestCity(browser, wmPage, city, strainDB)
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
  await writeCitiesIndex(CITIES, results)

  await browser.close()
  console.log('\nBrowser closed.')

  console.log('\n' + '═'.repeat(60))
  console.log(`  HARVEST COMPLETE`)
  console.log(`  ${totalDisp} dispensaries across ${Object.values(results).filter(r => r.dispensaryCount > 0).length} cities`)
  console.log(`  ${totalMatched} total matched menu items`)
  for (const c of CITIES) {
    const r = results[c.slug] || {}
    const sb = r.sourceBreakdown || {}
    console.log(`    ${c.label}: ${r.dispensaryCount || 0} dispensaries (WM: ${sb.weedmaps || 0}, Leafly: ${sb.leafly || 0}), ${r.matchedCount || 0} matched`)
  }
  console.log('═'.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
