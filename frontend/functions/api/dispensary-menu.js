/**
 * Cloudflare Pages Function — Proxy for Weedmaps menu items API.
 *
 * GET /api/dispensary-menu?slug=dispensary-slug
 *
 * Attempts to fetch the flower menu for a specific dispensary from Weedmaps.
 * Returns raw menu items (name, prices, brand, image) for client-side
 * cross-referencing with our strain database.
 *
 * Falls back to empty array if the API blocks the request (406).
 * Results cached in KV for 24 hours.
 */

const TTL_SECONDS = 24 * 60 * 60 // 24 hours
const MAX_PAGES = 3
const MAX_ITEMS = 200

/* ── Main handler ────────────────────────────────────────────────────── */

export async function onRequest(context) {
  const { request: req, env } = context
  const url = new URL(req.url)
  const slug = url.searchParams.get('slug')

  if (!slug) {
    return json({ error: 'Missing ?slug= parameter' }, 400)
  }

  try {
    // Check KV cache first
    const cacheKey = `menu:${slug}`
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheKey, 'json')
      if (cached) {
        console.log(`[DispensaryMenu] Cache HIT for "${slug}"`)
        return json({ ...cached, cached: true })
      }
    }

    // Try fetching menu from Weedmaps v1 API
    const menuItems = await fetchWeedmapsMenu(slug)

    const result = {
      slug,
      menuItems,
      totalItems: menuItems.length,
    }

    // Cache in KV (even empty results to avoid repeated failed requests)
    if (env.CACHE) {
      await env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: TTL_SECONDS })
    }

    return json(result)
  } catch (err) {
    console.error('[DispensaryMenu] Error:', err)
    return json({ slug, menuItems: [], totalItems: 0, error: err.message })
  }
}

/* ── Fetch menu items from Weedmaps v1 menu_items API ────────────────── */

async function fetchWeedmapsMenu(slug) {
  const allItems = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const apiUrl =
      `https://api-g.weedmaps.com/discovery/v1/listings/dispensaries/${slug}/menu_items` +
      `?filter[category]=flower&page_size=100&page=${page}`

    try {
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://weedmaps.com/',
          'Origin': 'https://weedmaps.com',
        },
      })

      if (!res.ok) {
        console.warn(`[DispensaryMenu] Weedmaps menu API returned ${res.status} for ${slug}`)
        break
      }

      const data = await res.json()
      const items = data?.data?.menu_items || []

      if (items.length === 0) break

      for (const m of items) {
        allItems.push({
          name: m.name || '',
          prices: m.prices || [],
          variants: m.variants || [],
          price: m.price ?? null,
          priceUnit: m.price_unit ?? null,
          image: m.avatar_image?.small_url || null,
          brand: m.brand?.name || null,
        })
      }

      const totalPages = data?.meta?.total_pages || 1
      if (page >= totalPages) break
      if (allItems.length >= MAX_ITEMS) break
    } catch (err) {
      console.warn(`[DispensaryMenu] Fetch failed for ${slug} page ${page}:`, err.message)
      break
    }
  }

  return allItems
}

/* ── Utilities ────────────────────────────────────────────────────────── */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
