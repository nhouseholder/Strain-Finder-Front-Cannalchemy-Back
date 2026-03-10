#!/usr/bin/env node
/**
 * Local test runner v2 — uses v2/listings API for ALL dispensaries,
 * writes to KV via wrangler CLI (OAuth auth).
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KV_NS = 'f7a280ca8f2347c8b5bcdb02b5ed6161'

const CITIES = [
  { slug: 'san-diego',   label: 'San Diego, CA',   lat: 32.7157, lng: -117.1611 },
  { slug: 'phoenix',     label: 'Phoenix, AZ',     lat: 33.4484, lng: -112.0740 },
  { slug: 'los-angeles', label: 'Los Angeles, CA',  lat: 34.0522, lng: -118.2437 },
  { slug: 'new-york',    label: 'New York, NY',     lat: 40.7128, lng: -74.0060  },
  { slug: 'denver',      label: 'Denver, CO',       lat: 39.7392, lng: -104.9903 },
]

const BOUNDING_RADIUS = '25mi'
const LISTING_PAGE_SIZE = 150
const DISPENSARIES_PER_BATCH = 5
const DISPENSARIES_PER_INDEX_PAGE = 100
const FETCH_DELAY_MS = 300
const MAX_MENU_ITEMS_PER_DISP = 200

const EXCLUDED = new Set([
  'sativa','indica','hybrid','strain','unknown','na','flower',
  'indoor','outdoor','greenhouse','premium','classic','gold',
  'cream','lemon','grape','orange','mango','cherry','lime',
  'gello','sunshine','diamond','fire','ice','thunder','sugar',
  'honey','butter','cake','candy','cookie','cookies',
])

function normalizeName(name) {
  return (name || '').toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]/g, '')
}

function loadStrainDB() {
  const raw = JSON.parse(readFileSync(resolve(__dirname, '../frontend/src/data/strains.json'), 'utf-8'))
  const exactMap = new Map(); const nameList = []
  for (const s of raw) {
    const norm = normalizeName(s.name)
    const summary = { name: s.name, slug: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), type: s.type,
      thc: s.cannabinoids?.find(c => c.name === 'thc')?.value ?? null, cbd: s.cannabinoids?.find(c => c.name === 'cbd')?.value ?? null,
      topEffects: (s.effects || []).slice(0, 3).map(e => e.name), topTerpenes: (s.terpenes || []).slice(0, 3).map(t => t.name) }
    exactMap.set(norm, summary); nameList.push({ norm, summary })
  }
  console.log(`Loaded ${exactMap.size} strains`); return { exactMap, nameList }
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3
  const matrix = []; for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) for (let j = 1; j <= a.length; j++) {
    const cost = b[i-1]===a[j-1]?0:1; matrix[i][j] = Math.min(matrix[i-1][j]+1, matrix[i][j-1]+1, matrix[i-1][j-1]+cost)
  }
  return matrix[b.length][a.length]
}

function matchStrain(menuItemName, strainDB) {
  const cleaned = (menuItemName || '').replace(/\s*[-–|]\s*\d+(\.\d+)?\s*g\b/gi, '').replace(/\s*\(\d+(\.\d+)?\s*g\)/gi, '')
    .replace(/\s*\[\d+(\.\d+)?\s*g\]/gi, '').replace(/\s*[-–|]\s*(indica|sativa|hybrid)\b/gi, '')
    .replace(/\s*[-–|]\s*(small|smalls|smallz|popcorn)\b/gi, '').replace(/\s*[-–|]\s*(indoor|outdoor|greenhouse)\b/gi, '')
    .replace(/\s*[-–|]\s*(flower|premium|gold cuts|classic cuts)\b/gi, '').replace(/\b(1\/2\s*oz|half\s*oz|quarter|eighth)\b/gi, '')
    .replace(/\s+/g, ' ').trim()
  const norm = normalizeName(cleaned)
  if (!norm || norm.length < 4) return null
  if (strainDB.exactMap.has(norm) && !EXCLUDED.has(norm)) return { ...strainDB.exactMap.get(norm), matchTier: 'exact' }
  for (const { norm: dbNorm, summary } of strainDB.nameList) {
    if (EXCLUDED.has(dbNorm) || Math.abs(norm.length - dbNorm.length) > 2) continue
    if (levenshtein(norm, dbNorm) <= 2) return { ...summary, matchTier: 'fuzzy' }
  }
  for (const { norm: dbNorm, summary } of strainDB.nameList) {
    if (EXCLUDED.has(dbNorm) || dbNorm.length < 7) continue
    if (norm.includes(dbNorm) && (dbNorm.length / norm.length) >= 0.4) return { ...summary, matchTier: 'substring' }
  }
  return null
}

function extractPrice(item) {
  if (item.price && typeof item.price === 'number') return `$${item.price}`
  if (item.price && typeof item.price === 'string' && item.price.includes('$')) return item.price
  const prices = Array.isArray(item.prices) ? item.prices : []
  if (prices.length === 0) return null
  const eighth = prices.find(p => (p.label||p.units||'').toLowerCase().includes('eighth') || (p.label||'').includes('3.5'))
  if (eighth?.price) return `$${eighth.price}/eighth`
  const gram = prices.find(p => (p.label||p.units||'').toLowerCase().includes('gram') || (p.label||'')==='1g')
  if (gram?.price) return `$${gram.price}/g`
  const first = prices.find(p => p.price)
  if (first?.price) return `$${first.price}/${first.label||first.units||'unit'}`
  return null
}

function kvPut(key, value) {
  const json = JSON.stringify(value)
  const sizeKB = Buffer.byteLength(json, 'utf-8') / 1024
  if (sizeKB > 24) console.warn(`  ⚠️  ${key} is ${sizeKB.toFixed(1)}KB!`)
  const tmpFile = `/tmp/kv-${key.replace(/[/:]/g, '_')}.json`
  writeFileSync(tmpFile, json, 'utf-8')
  execSync(`npx wrangler kv key put --namespace-id ${KV_NS} --remote "${key}" --path="${tmpFile}"`,
    { cwd: resolve(__dirname, '..'), stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 })
  unlinkSync(tmpFile)
  console.log(`  ✓ ${key} (${sizeKB.toFixed(1)}KB)`)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchAllListings(city) {
  console.log(`  Fetching all listings within ${BOUNDING_RADIUS}...`)
  const allListings = []; let page = 1
  while (true) {
    const url = `https://api-g.weedmaps.com/discovery/v2/listings?filter[bounding_radius]=${BOUNDING_RADIUS}&filter[bounding_latlng]=${city.lat},${city.lng}&page_size=${LISTING_PAGE_SIZE}&page=${page}`
    const res = await fetch(url)
    if (!res.ok) { console.warn(`  API ${res.status} on page ${page}`); break }
    const data = await res.json(); const listings = data?.data?.listings || []
    if (listings.length === 0) break
    for (const L of listings) {
      if (L.type !== 'dispensary' && L.type !== 'delivery') continue
      allListings.push({
        id: L.slug, name: L.name, slug: L.slug, type: L.license_type || L.type,
        address: [L.address, L.city, L.state].filter(Boolean).join(', '),
        lat: L.latitude, lng: L.longitude, rating: L.rating || null, reviewCount: L.reviews_count || 0,
        phone: L.phone_number || null, wmUrl: `https://weedmaps.com/dispensaries/${L.slug}`,
        hours: L.todays_hours_str || null, openNow: L.open_now || false,
        delivery: (L.retailer_services || []).includes('delivery'),
        pickup: (L.retailer_services || []).includes('pickup'),
        storefront: (L.retailer_services || []).includes('storefront'),
        menuItemsCount: L.menu_items_count || 0,
      })
    }
    const total = data?.meta?.total_listings || 0
    console.log(`    Page ${page}: ${listings.length} items (total: ${total})`)
    if (allListings.length >= total || listings.length < LISTING_PAGE_SIZE) break
    page++; await sleep(300)
  }
  console.log(`  Found ${allListings.length} dispensaries + delivery services`)
  return allListings
}

async function main() {
  console.log('=== Full Harvest v2 (All 5 Cities, 25mi radius) ===\n')
  const strainDB = loadStrainDB()

  console.log('\nLaunching browser...')
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const browserPage = await ctx.newPage()
  await browserPage.goto('https://weedmaps.com', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(2000)
  console.log('Session OK\n')

  const allResults = {}

  for (const city of CITIES) {
    console.log(`\n${'═'.repeat(50)}`)
    console.log(`  Harvesting: ${city.label}`)
    console.log(`${'═'.repeat(50)}`)

    try {
      const listings = await fetchAllListings(city)
      if (listings.length === 0) { allResults[city.slug] = { dispensaryCount: 0, matchedCount: 0 }; continue }

      listings.sort((a, b) => (b.menuItemsCount || 0) - (a.menuItemsCount || 0))
      let totalMatched = 0; const enriched = []

      for (let i = 0; i < listings.length; i++) {
        const disp = listings[i]
        process.stdout.write(`  [${i+1}/${listings.length}] ${disp.name}... `)

        if (disp.menuItemsCount === 0) {
          console.log('no menu')
          enriched.push({ ...disp, menuSummary: { total: 0, matched: 0, topMatches: [] }, matchedMenu: [], unmatchedCount: 0 })
          continue
        }

        try {
          const menuItems = await browserPage.evaluate(async ({ slug, maxItems }) => {
            const items = []; let pg = 1
            while (pg <= 3 && items.length < maxItems) {
              const r = await fetch(`https://api-g.weedmaps.com/discovery/v1/listings/dispensaries/${slug}/menu_items?filter[category]=flower&page_size=100&page=${pg}`)
              if (!r.ok) break; const d = await r.json(); const mi = d?.data?.menu_items||[]
              if (!mi.length) break
              for (const m of mi) items.push({ name: m.name, prices: m.prices||[], price: m.price, brand: m.brand?.name||null })
              if (pg >= (d?.meta?.total_pages||1)) break; pg++
            }
            return items.slice(0, maxItems)
          }, { slug: disp.slug, maxItems: MAX_MENU_ITEMS_PER_DISP })
          await sleep(FETCH_DELAY_MS)

          const matchedMenu = []; let unmatchedCount = 0
          for (const item of menuItems) {
            const match = matchStrain(item.name, strainDB)
            if (match) matchedMenu.push({ menuName: item.name, price: extractPrice(item), brand: item.brand, strain: match })
            else unmatchedCount++
          }
          totalMatched += matchedMenu.length
          console.log(`${menuItems.length} items, ${matchedMenu.length} matched`)
          enriched.push({ ...disp, menuSummary: { total: menuItems.length, matched: matchedMenu.length, topMatches: matchedMenu.slice(0,3).map(m=>m.strain.name) }, matchedMenu, unmatchedCount })
        } catch (err) {
          console.log(`ERROR: ${err.message}`)
          enriched.push({ ...disp, menuSummary: { total: 0, matched: 0, topMatches: [] }, matchedMenu: [], unmatchedCount: 0 })
        }
      }

      // Write to KV
      console.log(`\n  Writing to KV...`)
      for (let i = 0; i < enriched.length; i++) enriched[i].batchIndex = Math.floor(i / DISPENSARIES_PER_BATCH)

      const compactDisps = enriched.map(d => ({
        id: d.id, name: d.name, address: d.address, lat: d.lat, lng: d.lng,
        rating: d.rating, reviewCount: d.reviewCount, phone: d.phone, wmUrl: d.wmUrl,
        hours: d.hours, openNow: d.openNow, delivery: d.delivery, pickup: d.pickup,
        storefront: d.storefront, type: d.type, menuSummary: d.menuSummary, batchIndex: d.batchIndex,
      }))

      const indexPageCount = Math.ceil(compactDisps.length / DISPENSARIES_PER_INDEX_PAGE)
      kvPut(`city:${city.slug}:index`, {
        city: city.slug, label: city.label, lat: city.lat, lng: city.lng,
        updatedAt: new Date().toISOString(), dispensaryCount: enriched.length, matchedStrainCount: totalMatched,
        indexPages: indexPageCount, dispensaries: compactDisps.slice(0, DISPENSARIES_PER_INDEX_PAGE),
      })
      for (let p = 1; p < indexPageCount; p++) {
        kvPut(`city:${city.slug}:index:${p}`, { city: city.slug, page: p, dispensaries: compactDisps.slice(p * DISPENSARIES_PER_INDEX_PAGE, (p+1) * DISPENSARIES_PER_INDEX_PAGE) })
      }

      const batchCount = Math.ceil(enriched.length / DISPENSARIES_PER_BATCH)
      for (let b = 0; b < batchCount; b++) {
        const batch = enriched.slice(b * DISPENSARIES_PER_BATCH, (b+1) * DISPENSARIES_PER_BATCH)
        kvPut(`city:${city.slug}:batch:${b}`, {
          city: city.slug, batchIndex: b, updatedAt: new Date().toISOString(),
          dispensaries: batch.map(d => ({ id: d.id,
            matchedMenu: d.matchedMenu.slice(0, 15).map(m => ({ menuName: m.menuName, price: m.price, brand: m.brand,
              strain: { name: m.strain.name, slug: m.strain.slug, type: m.strain.type, thc: m.strain.thc, matchTier: m.strain.matchTier } })),
            unmatchedCount: d.unmatchedCount, totalMatched: d.matchedMenu.length })),
        })
      }

      console.log(`\n  ${city.label}: ${enriched.length} dispensaries, ${totalMatched} matched`)
      allResults[city.slug] = { dispensaryCount: enriched.length, matchedCount: totalMatched }
    } catch (err) {
      console.error(`  FAILED: ${err.message}`)
      allResults[city.slug] = { dispensaryCount: 0, matchedCount: 0 }
    }
    await sleep(2000)
  }

  await browser.close()

  kvPut('cities:index', {
    updatedAt: new Date().toISOString(),
    cities: CITIES.map(c => ({ slug: c.slug, label: c.label, lat: c.lat, lng: c.lng,
      dispensaryCount: allResults[c.slug]?.dispensaryCount || 0, matchedStrainCount: allResults[c.slug]?.matchedCount || 0,
    })).filter(c => c.dispensaryCount > 0),
  })

  const totalDisp = Object.values(allResults).reduce((s, r) => s + r.dispensaryCount, 0)
  const totalMatch = Object.values(allResults).reduce((s, r) => s + r.matchedCount, 0)
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`HARVEST COMPLETE: ${totalDisp} dispensaries, ${totalMatch} matched`)
  for (const c of CITIES) { const r = allResults[c.slug] || {}; console.log(`  ${c.label}: ${r.dispensaryCount||0} dispensaries, ${r.matchedCount||0} matched`) }
  console.log(`${'═'.repeat(50)}`)
}

main().catch(e => { console.error(e); process.exit(1) })
