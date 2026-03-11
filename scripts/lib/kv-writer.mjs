/**
 * kv-writer.mjs — Cloudflare KV write logic
 *
 * Handles writing harvested dispensary + menu data to Cloudflare KV
 * in the paginated format expected by the frontend.
 *
 * KV Structure:
 *   cities:index              → list of available cities + counts
 *   city:{slug}:index         → meta + first 100 dispensaries
 *   city:{slug}:index:{page}  → additional dispensary pages (100 each)
 *   city:{slug}:batch:{n}     → menu data for 5 dispensaries
 */

/* ── Constants ─────────────────────────────────────────────────────── */

export const DISPENSARIES_PER_BATCH = 5
export const DISPENSARIES_PER_INDEX_PAGE = 100
export const MAX_MATCHED_PER_DISP = 50

/* ── KV API ────────────────────────────────────────────────────────── */

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID } = process.env
const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}`

export async function kvPut(key, value) {
  const url = `${KV_BASE}/values/${encodeURIComponent(key)}`
  const body = JSON.stringify(value)
  const sizeKB = Buffer.byteLength(body, 'utf-8') / 1024

  if (sizeKB > 200) {
    console.warn(`  ⚠️  KV "${key}" is ${sizeKB.toFixed(1)}KB — large value!`)
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

/* ── Write city data to KV ─────────────────────────────────────────── */

export async function writeCityToKV(city, enriched, totalMatched) {
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
    hasMenu: d.menuSummary?.hasMenu ?? (d.menuSummary?.total > 0),
    batchIndex: d.batchIndex,
    // Multi-source fields
    sources: d.sources || ['weedmaps'],
    leaflyUrl: d.leaflyUrl || null,
    leaflySlug: d.leaflySlug || null,
    website: d.website || null,
  }))

  // Paginate city index (100 dispensaries per page to stay under 25KB)
  const indexPageCount = Math.ceil(compactDisps.length / DISPENSARIES_PER_INDEX_PAGE)

  // First index page includes meta + first 100 dispensaries
  const indexBase = {
    city: city.slug,
    label: city.label,
    lat: city.lat,
    lng: city.lng,
    thca: city.thca || false,
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

  // Menu batches (5 dispensaries per batch, up to MAX_MATCHED_PER_DISP matches each)
  const batchCount = Math.ceil(enriched.length / DISPENSARIES_PER_BATCH)
  for (let b = 0; b < batchCount; b++) {
    const batchDisps = enriched.slice(b * DISPENSARIES_PER_BATCH, (b + 1) * DISPENSARIES_PER_BATCH)
    await kvPut(`city:${city.slug}:batch:${b}`, {
      city: city.slug,
      batchIndex: b,
      updatedAt: new Date().toISOString(),
      dispensaries: batchDisps.map(d => ({
        id: d.id,
        matchedMenu: d.matchedMenu.slice(0, MAX_MATCHED_PER_DISP).map(m => ({
          menuName: m.menuName,
          price: m.price,
          priceEighth: m.priceEighth ?? null,
          brand: m.brand,
          strain: {
            name: m.strain.name,
            slug: m.strain.slug,
            type: m.strain.type,
            thc: m.strain.thc,
            cbd: m.strain.cbd,
            topEffects: m.strain.topEffects,
            topTerpenes: m.strain.topTerpenes,
            matchTier: m.strain.matchTier,
          },
        })),
        unmatchedCount: d.unmatchedCount,
        totalMatched: d.matchedMenu.length,
        hasMenu: d.menuSummary?.hasMenu ?? (d.menuSummary?.total > 0),
      })),
    })
  }

  console.log(`  Done: ${enriched.length} dispensaries, ${totalMatched} matched menu items`)
}

/* ── Write master cities index ─────────────────────────────────────── */

export async function writeCitiesIndex(cities, results) {
  const citiesIndex = {
    updatedAt: new Date().toISOString(),
    cities: cities.map(c => ({
      slug: c.slug,
      label: c.label,
      lat: c.lat,
      lng: c.lng,
      thca: c.thca || false,
      dispensaryCount: results[c.slug]?.dispensaryCount || 0,
      matchedStrainCount: results[c.slug]?.matchedCount || 0,
      sourceBreakdown: results[c.slug]?.sourceBreakdown || null,
    })).filter(c => c.dispensaryCount > 0),
  }
  await kvPut('cities:index', citiesIndex)
}
