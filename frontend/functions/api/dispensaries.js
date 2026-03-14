/**
 * Cloudflare Pages Function — Serves live dispensary data from KV cache.
 *
 * Endpoints:
 *   GET /api/dispensaries                                → list of available cities
 *   GET /api/dispensaries?city=san-diego                 → city index (full dispensary list)
 *   GET /api/dispensaries?city=san-diego&batch=0         → batch with full matched menus
 *   GET /api/dispensaries?city=san-diego&dispensary=slug  → single dispensary's menu
 *
 * The city index may be paginated across multiple KV keys (100 dispensaries per page).
 * This function transparently concatenates all pages for the frontend.
 *
 * Data is populated by the daily harvest cron (scripts/harvest-dispensary-menus.mjs).
 */

export async function onRequest(context) {
  const { request: req, env } = context
  const url = new URL(req.url)

  if (!env.CACHE) {
    return json({ error: 'KV cache not configured' }, 500)
  }

  const city = url.searchParams.get('city')
  const batch = url.searchParams.get('batch')
  const dispensaryId = url.searchParams.get('dispensary')

  try {
    // No city param → return cities index
    if (!city) {
      return await handleCitiesList(env)
    }

    // City + dispensary → find that dispensary's batch and return its menu
    if (dispensaryId) {
      return await handleDispensaryDetail(env, city, dispensaryId)
    }

    // City + batch → return specific batch (full menus)
    if (batch != null) {
      return await handleBatch(env, city, batch)
    }

    // City only → return city index (full dispensary list with summaries)
    return await handleCityIndex(env, city)
  } catch (err) {
    console.error('Dispensary API error:', err)
    return json({ error: 'Server error', message: err.message }, 500)
  }
}

/* ── Handlers ──────────────────────────────────────────────────────── */

async function handleCitiesList(env) {
  const data = await env.CACHE.get('cities:index', 'json')

  if (!data) {
    return json({
      available: false,
      message: 'Dispensary data is being updated. Check back soon.',
      cities: [],
    })
  }

  return json({
    available: true,
    updatedAt: data.updatedAt,
    cities: data.cities,
  })
}

async function handleCityIndex(env, city) {
  const key = `city:${city}:index`
  const data = await env.CACHE.get(key, 'json')

  if (!data) {
    return json({
      available: false,
      message: `No data available for "${city}". Data updates daily at 6 AM PT.`,
      dispensaries: [],
    })
  }

  // If the index is paginated, fetch additional pages and concatenate.
  // Pages beyond 0 are stored as city:{slug}:index:{page}.
  // If a page is missing from KV, we skip it but log for debugging.
  let allDispensaries = data.dispensaries || []

  if (data.indexPages && data.indexPages > 1) {
    const pagePromises = []
    for (let p = 1; p < data.indexPages; p++) {
      pagePromises.push(
        env.CACHE.get(`city:${city}:index:${p}`, 'json')
          .catch(err => {
            console.error(`[Dispensaries] Failed to read index page ${p} for ${city}:`, err.message)
            return null
          })
      )
    }
    const pages = await Promise.all(pagePromises)
    let pagesLoaded = 0
    for (const page of pages) {
      if (page?.dispensaries) {
        allDispensaries = allDispensaries.concat(page.dispensaries)
        pagesLoaded++
      }
    }
    console.log(`[Dispensaries] ${city}: base=${(data.dispensaries||[]).length}, pages loaded=${pagesLoaded}/${data.indexPages - 1}, total=${allDispensaries.length}`)
  }

  return json({
    available: true,
    city: data.city,
    label: data.label,
    lat: data.lat,
    lng: data.lng,
    updatedAt: data.updatedAt,
    dispensaryCount: data.dispensaryCount,
    matchedStrainCount: data.matchedStrainCount,
    dispensaries: allDispensaries,
  })
}

async function handleBatch(env, city, batchIndex) {
  const key = `city:${city}:batch:${batchIndex}`
  const data = await env.CACHE.get(key, 'json')

  if (!data) {
    return json({
      available: false,
      message: `Batch ${batchIndex} not found for "${city}".`,
      dispensaries: [],
    })
  }

  return json({ available: true, ...data })
}

async function handleDispensaryDetail(env, city, dispensaryId) {
  // First, get the city index to find which batch this dispensary is in
  // Check base index first, then additional pages if needed
  const index = await env.CACHE.get(`city:${city}:index`, 'json')

  if (!index) {
    return json({ available: false, message: `No data for "${city}".` })
  }

  // Search base index page
  let dispensary = index.dispensaries?.find(d => d.id === dispensaryId)

  // If not found and there are more pages, search them
  if (!dispensary && index.indexPages > 1) {
    for (let p = 1; p < index.indexPages; p++) {
      const page = await env.CACHE.get(`city:${city}:index:${p}`, 'json')
      if (page?.dispensaries) {
        dispensary = page.dispensaries.find(d => d.id === dispensaryId)
        if (dispensary) break
      }
    }
  }

  if (!dispensary) {
    return json({ available: false, message: `Dispensary "${dispensaryId}" not found in ${city}.` })
  }

  // Fetch the batch that contains this dispensary
  const batchKey = `city:${city}:batch:${dispensary.batchIndex}`
  const batch = await env.CACHE.get(batchKey, 'json')

  if (!batch) {
    return json({
      available: true,
      dispensary: { ...dispensary, matchedMenu: [], unmatchedCount: 0 },
    })
  }

  // Find this dispensary's menu data in the batch
  const menuData = batch.dispensaries?.find(d => d.id === dispensaryId)

  return json({
    available: true,
    dispensary: {
      ...dispensary,
      matchedMenu: menuData?.matchedMenu || [],
      unmatchedCount: menuData?.unmatchedCount || 0,
    },
  })
}

/* ── Utilities ─────────────────────────────────────────────────────── */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300', // 5 min CDN cache
    },
  })
}
