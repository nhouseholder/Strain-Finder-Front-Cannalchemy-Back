/**
 * Netlify Edge Function — Regional dispensary cache using Netlify Blobs.
 *
 * GET  /api/dispensary-cache?action=check&region=902&strains=Blue+Dream,OG+Kush
 *   → returns cached dispensaries if fresh (<24h), else { cached: false }
 *
 * POST /api/dispensary-cache?action=store
 *   → stores new dispensary data for a region
 *
 * Uses Netlify Blobs as a zero-config key-value store shared across all users.
 * No database setup required — works immediately on deploy.
 */

import { getStore } from '@netlify/blobs'

const STORE_NAME = 'dispensary-cache'
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export default async (req) => {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (!action || !['check', 'store'].includes(action)) {
    return new Response(JSON.stringify({ error: 'Invalid action. Use ?action=check or ?action=store' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const store = getStore(STORE_NAME)

  try {
    if (action === 'check') {
      return await handleCheck(req, url, store)
    } else {
      return await handleStore(req, store)
    }
  } catch (err) {
    console.error('Dispensary cache error:', err)
    return new Response(JSON.stringify({ error: 'Cache error', message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Check if there's a fresh cache entry for a region.
 * Returns { cached: true, dispensaries: [...], region_key, hit_count, age_hours }
 * or { cached: false } if no fresh entry.
 */
async function handleCheck(req, url, store) {
  const region = url.searchParams.get('region')
  if (!region) {
    return new Response(JSON.stringify({ error: 'Missing region parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const key = `region:${region}`
  const entry = await store.get(key, { type: 'json' }).catch(() => null)

  if (!entry) {
    return new Response(JSON.stringify({ cached: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Check TTL
  const age = Date.now() - (entry.updated_at || 0)
  if (age > TTL_MS) {
    // Expired — delete and return cache miss
    await store.delete(key).catch(() => {})
    return new Response(JSON.stringify({ cached: false, reason: 'expired' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Cache hit — increment hit count (fire-and-forget)
  const updated = { ...entry, hit_count: (entry.hit_count || 1) + 1 }
  store.setJSON(key, updated).catch(() => {})

  return new Response(JSON.stringify({
    cached: true,
    dispensaries: entry.dispensaries,
    strain_names: entry.strain_names,
    region_key: region,
    hit_count: updated.hit_count,
    age_hours: Math.round(age / (60 * 60 * 1000) * 10) / 10,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Store dispensary data for a region.
 * Body: { region_key, dispensaries, strain_names, location_query }
 */
async function handleStore(req, store) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required for store action' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { region_key, dispensaries, strain_names, location_query } = body

  if (!region_key || !dispensaries) {
    return new Response(JSON.stringify({ error: 'Missing required fields: region_key, dispensaries' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const key = `region:${region_key}`

  // Check if there's an existing entry to preserve hit_count
  const existing = await store.get(key, { type: 'json' }).catch(() => null)
  const hit_count = existing ? (existing.hit_count || 1) : 1

  const entry = {
    region_key,
    dispensaries,
    strain_names: strain_names || [],
    location_query: location_query || '',
    created_at: existing?.created_at || Date.now(),
    updated_at: Date.now(),
    hit_count,
  }

  await store.setJSON(key, entry)

  return new Response(JSON.stringify({ stored: true, region_key, hit_count }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config = {
  path: '/api/dispensary-cache',
}
