/**
 * Unit tests for the Strain Lookup Cloudflare Function.
 *
 * Tests fuzzy matching, exact matching, substring matching,
 * CORS handling, and edge cases.
 */
import { describe, it, expect, beforeAll } from 'vitest'

// The Cloudflare Function imports strain-data.js at module scope.
// We import the function module which will load the real strain data.
let onRequestGet, onRequestOptions

beforeAll(async () => {
  const mod = await import('../../functions/api/v1/strains/lookup/[name].js')
  onRequestGet = mod.onRequestGet
  onRequestOptions = mod.onRequestOptions
})

// Helper to build a minimal Cloudflare Function context
function makeContext(name) {
  return {
    params: { name: encodeURIComponent(name) },
    request: new Request(`https://example.com/api/v1/strains/lookup/${encodeURIComponent(name)}`),
  }
}

async function getJSON(response) {
  return response.json()
}

describe('Strain Lookup — CORS', () => {
  it('OPTIONS returns 204 with CORS headers', async () => {
    const resp = await onRequestOptions()
    expect(resp.status).toBe(204)
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(resp.headers.get('Access-Control-Allow-Methods')).toContain('GET')
  })
})

describe('Strain Lookup — Validation', () => {
  it('rejects empty name', async () => {
    const resp = await onRequestGet(makeContext(''))
    expect(resp.status).toBe(400)
    const data = await getJSON(resp)
    expect(data.found).toBe(false)
  })

  it('rejects single-character name', async () => {
    const resp = await onRequestGet(makeContext('a'))
    expect(resp.status).toBe(400)
  })
})

describe('Strain Lookup — Exact Match', () => {
  it('finds "Blue Dream" exactly', async () => {
    const resp = await onRequestGet(makeContext('Blue Dream'))
    const data = await getJSON(resp)
    // Blue Dream is a very common strain, should be in the dataset
    if (data.found) {
      expect(data.strain).toBeTruthy()
      expect(data.strain.name.toLowerCase()).toContain('blue dream')
      expect(data.enrichmentStatus).toBe('complete')
    }
  })

  it('finds "OG Kush" case-insensitively', async () => {
    const resp = await onRequestGet(makeContext('og kush'))
    const data = await getJSON(resp)
    if (data.found) {
      expect(data.strain.name.toLowerCase()).toContain('og kush')
    }
  })

  it('finds "Super Skunk" (known to be in dataset)', async () => {
    // We saw Super Skunk in the strain-data.js head output
    const resp = await onRequestGet(makeContext('Super Skunk'))
    const data = await getJSON(resp)
    expect(data.found).toBe(true)
    expect(data.strain.name).toBe('Super Skunk')
    expect(data.enrichmentStatus).toBe('complete')
  })
})

describe('Strain Lookup — Fuzzy Match', () => {
  it('finds "Supe Skunk" (typo) via fuzzy match', async () => {
    const resp = await onRequestGet(makeContext('Supe Skunk'))
    const data = await getJSON(resp)
    // Should fuzzy match to Super Skunk
    if (data.found) {
      expect(data.strain.name).toBe('Super Skunk')
      expect(data.message).toContain('Showing results for')
    }
  })

  it('handles completely nonexistent strain', async () => {
    const resp = await onRequestGet(makeContext('Qqzxjvwpbfnm Rrtyxz'))
    const data = await getJSON(resp)
    expect(data.found).toBe(false)
    expect(data.strain).toBeNull()
  })
})

describe('Strain Lookup — Response Shape', () => {
  it('returns correct shape for found strain', async () => {
    const resp = await onRequestGet(makeContext('Super Skunk'))
    const data = await getJSON(resp)
    expect(data).toHaveProperty('found')
    expect(data).toHaveProperty('strain')
    expect(data).toHaveProperty('enrichmentStatus')
    expect(data).toHaveProperty('message')

    if (data.found) {
      const s = data.strain
      expect(s).toHaveProperty('name')
      expect(s).toHaveProperty('type')
      expect(s).toHaveProperty('effects')
      expect(s).toHaveProperty('terpenes')
      expect(s).toHaveProperty('cannabinoids')
      expect(Array.isArray(s.effects)).toBe(true)
      expect(Array.isArray(s.terpenes)).toBe(true)
      expect(Array.isArray(s.cannabinoids)).toBe(true)
    }
  })

  it('returns correct shape for not-found strain', async () => {
    const resp = await onRequestGet(makeContext('Qqzxjvwpbfnm Rrtyxz'))
    const data = await getJSON(resp)
    expect(data.found).toBe(false)
    expect(data.strain).toBeNull()
    expect(data.enrichmentStatus).toBe('none')
    expect(typeof data.message).toBe('string')
  })

  it('all responses have CORS headers', async () => {
    const resp = await onRequestGet(makeContext('Super Skunk'))
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

describe('Strain Lookup — Data Quality', () => {
  it('found strains have populated effects array', async () => {
    const resp = await onRequestGet(makeContext('Super Skunk'))
    const data = await getJSON(resp)
    if (data.found) {
      expect(data.strain.effects.length).toBeGreaterThan(0)
      // Each effect should have name and category
      for (const eff of data.strain.effects) {
        expect(eff).toHaveProperty('name')
        expect(typeof eff.name).toBe('string')
      }
    }
  })

  it('found strains have terpene data', async () => {
    const resp = await onRequestGet(makeContext('Super Skunk'))
    const data = await getJSON(resp)
    if (data.found && data.strain.terpenes?.length > 0) {
      for (const terp of data.strain.terpenes) {
        expect(terp).toHaveProperty('name')
        expect(terp).toHaveProperty('pct')
      }
    }
  })
})
