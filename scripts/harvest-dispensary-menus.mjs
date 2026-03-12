#!/usr/bin/env node
/**
 * harvest-dispensary-menus.mjs — Daily cron job (GitHub Actions)
 *
 * Multi-source dispensary harvester (pure HTTP — no browser required):
 *   1. Weedmaps — v2/listings API discovery + v1/menu_items API
 *   2. Leafly   — HTTP fetch + __NEXT_DATA__ SSR parsing
 *
 * For each city:
 *   Phase 1: Discover dispensaries from all sources (parallel)
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

import { loadStrainDB } from './lib/strain-matcher.mjs'
import { writeCityToKV, writeCitiesIndex } from './lib/kv-writer.mjs'
import { deduplicateDispensaries } from './lib/dedup.mjs'
import { discoverDispensaries as discoverWM, harvestMenus as harvestWM } from './sources/weedmaps.mjs'
import { discoverDispensaries as discoverLeafly, harvestMenus as harvestLeafly } from './sources/leafly.mjs'

/* ── Config ────────────────────────────────────────────────────────── */

const CITIES = [
  // Full-legal cannabis markets
  { slug: 'san-diego',   label: 'San Diego, CA',    lat: 32.7157, lng: -117.1611 },
  { slug: 'phoenix',     label: 'Phoenix, AZ',      lat: 33.4484, lng: -112.0740 },
  { slug: 'los-angeles', label: 'Los Angeles, CA',   lat: 34.0522, lng: -118.2437 },
  { slug: 'new-york',    label: 'New York, NY',      lat: 40.7128, lng: -74.0060  },
  { slug: 'denver',      label: 'Denver, CO',        lat: 39.7392, lng: -104.9903 },
  { slug: 'las-vegas',   label: 'Las Vegas, NV',     lat: 36.1699, lng: -115.1398 },
  { slug: 'detroit',     label: 'Detroit, MI',       lat: 42.3314, lng: -83.0458  },
  { slug: 'chicago',     label: 'Chicago, IL',       lat: 41.8781, lng: -87.6298  },
  // THC-A legal markets (hemp-derived, not rec/medical cannabis)
  { slug: 'nashville',   label: 'Nashville, TN',     lat: 36.1627, lng: -86.7816, thca: true },
  { slug: 'lubbock',     label: 'Lubbock, TX',       lat: 33.5779, lng: -101.8552, thca: true },
]

const CITY_DELAY_MS = 1000

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID } = process.env

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
  console.error('Missing required env vars: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID')
  process.exit(1)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

/* ── Harvest a single city ─────────────────────────────────────────── */

async function harvestCity(city, strainDB) {
  const isThca = city.thca || false
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Harvesting: ${city.label}${isThca ? ' [THC-A Market]' : ''}`)
  console.log(`${'═'.repeat(60)}`)

  // Phase 1: Discover dispensaries from all sources (parallel)
  const sourceLists = []

  const [wmResult, leaflyResult] = await Promise.allSettled([
    discoverWM(city, { thca: isThca }),
    discoverLeafly(null, city),
  ])

  if (wmResult.status === 'fulfilled' && wmResult.value.length > 0) {
    sourceLists.push({ source: 'weedmaps', dispensaries: wmResult.value })
  } else if (wmResult.status === 'rejected') {
    console.error(`  [WM] Discovery failed: ${wmResult.reason?.message}`)
  }

  if (leaflyResult.status === 'fulfilled' && leaflyResult.value.length > 0) {
    sourceLists.push({ source: 'leafly', dispensaries: leaflyResult.value })
  } else if (leaflyResult.status === 'rejected') {
    console.error(`  [Leafly] Discovery failed: ${leaflyResult.reason?.message}`)
  }

  if (sourceLists.length === 0 || sourceLists.every(s => s.dispensaries.length === 0)) {
    console.log('  No dispensaries found from any source — skipping city')
    return { dispensaryCount: 0, matchedCount: 0 }
  }

  // Phase 2: Deduplicate across sources
  const allDispensaries = deduplicateDispensaries(sourceLists)

  // Phase 3: Fetch menus + match strains
  const wmOnly = allDispensaries.filter(d => d.sources?.includes('weedmaps') && d.slug)
  const leaflyOnly = allDispensaries.filter(d =>
    d.sources?.includes('leafly') &&
    !d.sources?.includes('weedmaps') &&
    d.leaflySlug
  )

  let totalMatched = 0
  const enrichedMap = new Map()

  // Step 1: Fetch WM menus
  let wmEnriched = []
  if (wmOnly.length > 0) {
    console.log(`\n  Fetching Weedmaps menus for ${wmOnly.length} dispensaries...`)
    const wmResult = await harvestWM(null, wmOnly, strainDB, { thca: isThca })
    wmEnriched = wmResult.enriched
    totalMatched += wmResult.totalMatched
    for (const d of wmEnriched) enrichedMap.set(d.id, d)
  }

  // Step 2: Leafly fallback for WM dispensaries with 0 menu items
  const wmNoMenu = wmEnriched.filter(d => d.menuSummary?.total === 0 && d.leaflySlug)
  if (wmNoMenu.length > 0) {
    console.log(`\n  Leafly fallback for ${wmNoMenu.length} WM dispensaries with empty menus...`)
    const { enriched: fallbackEnriched, totalMatched: fallbackMatched } = await harvestLeafly(null, wmNoMenu, strainDB, { thca: isThca })
    totalMatched += fallbackMatched
    for (const d of fallbackEnriched) {
      if (d.menuSummary?.total > 0) {
        enrichedMap.set(d.id, d) // replace empty-menu version
      }
    }
  }

  // Step 3: Fetch Leafly menus for Leafly-only dispensaries
  if (leaflyOnly.length > 0) {
    console.log(`\n  Fetching Leafly menus for ${leaflyOnly.length} Leafly-only dispensaries...`)
    const { enriched: leaflyEnriched, totalMatched: leaflyMatched } = await harvestLeafly(null, leaflyOnly, strainDB, { thca: isThca })
    totalMatched += leaflyMatched
    for (const d of leaflyEnriched) enrichedMap.set(d.id, d)
  }

  // Add dispensaries that weren't processed for menus
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
  console.log('║  MyStrainAI — Multi-Source Dispensary Harvest v6        ║')
  console.log('║  Pure HTTP · WM + Leafly → Dedup → Match → KV         ║')
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

  // Write master cities index
  await writeCitiesIndex(CITIES, results)

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
