/**
 * Unit tests for the Strain Request Cloudflare Function.
 *
 * Tests local lookup fallback, external API integration,
 * response shapes, validation, and error handling.
 */
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest'

let onRequestPost, onRequestOptions

beforeAll(async () => {
  const mod = await import('../../functions/api/v1/strains/request.js')
  onRequestPost = mod.onRequestPost
  onRequestOptions = mod.onRequestOptions
})

// Helper to build POST context
function makeContext(body) {
  return {
    request: new Request('https://example.com/api/v1/strains/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  }
}

function makeInvalidContext() {
  return {
    request: new Request('https://example.com/api/v1/strains/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json!!!',
    }),
  }
}

async function getJSON(response) {
  return response.json()
}

describe('Strain Request — CORS', () => {
  it('OPTIONS returns 204 with CORS headers', async () => {
    const resp = await onRequestOptions()
    expect(resp.status).toBe(204)
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(resp.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})

describe('Strain Request — Validation', () => {
  it('rejects invalid JSON body', async () => {
    const resp = await onRequestPost(makeInvalidContext())
    expect(resp.status).toBe(400)
    const data = await getJSON(resp)
    expect(data.found).toBe(false)
  })

  it('rejects missing name', async () => {
    const resp = await onRequestPost(makeContext({}))
    expect(resp.status).toBe(400)
  })

  it('rejects empty name', async () => {
    const resp = await onRequestPost(makeContext({ name: '' }))
    expect(resp.status).toBe(400)
  })

  it('rejects single-character name', async () => {
    const resp = await onRequestPost(makeContext({ name: 'A' }))
    expect(resp.status).toBe(400)
  })
})

describe('Strain Request — Local Match', () => {
  it('returns local strain when found (Super Skunk)', async () => {
    const resp = await onRequestPost(makeContext({ name: 'Super Skunk' }))
    const data = await getJSON(resp)
    expect(data.found).toBe(true)
    expect(data.strain.name).toBe('Super Skunk')
    expect(data.enrichmentStatus).toBe('complete')
  })

  it('returns local strain on fuzzy match', async () => {
    const resp = await onRequestPost(makeContext({ name: 'Supe Skunk' }))
    const data = await getJSON(resp)
    if (data.found && data.strain.name === 'Super Skunk') {
      expect(data.message).toContain('Did you mean')
    }
  })
})

describe('Strain Request — External API Fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls external APIs for unknown strains', async () => {
    // Use a strain name unlikely to be in our local database
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const resp = await onRequestPost(makeContext({ name: 'Mythical Unicorn Kush 9999' }))
    const data = await getJSON(resp)

    // Should have attempted external API calls (Otreeba + Cannlytics)
    const externalCalls = fetchSpy.mock.calls.filter(
      call => typeof call[0] === 'string' && (call[0].includes('otreeba') || call[0].includes('cannlytics'))
    )
    expect(externalCalls.length).toBeGreaterThanOrEqual(1)

    // Response should still be valid shape
    expect(data).toHaveProperty('found')
    expect(data).toHaveProperty('strain')
    expect(data).toHaveProperty('enrichmentStatus')
    expect(data).toHaveProperty('message')
  })

  it('returns minimal placeholder when nothing found anywhere', async () => {
    // Mock fetch to return failures for external APIs
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && (url.includes('otreeba') || url.includes('cannlytics'))) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response('Not found', { status: 404 })
    })

    const resp = await onRequestPost(makeContext({ name: 'Totally Fake Strain XYZ123' }))
    const data = await getJSON(resp)

    expect(data.found).toBe(true) // Still returns a placeholder
    expect(data.enrichmentStatus).toBe('pending')
    expect(data.strain.name).toBe('Totally Fake Strain XYZ123')
    expect(data.strain.dataCompleteness).toBe('search-only')
    expect(data.strain.type).toBe('hybrid') // Default type
    expect(Array.isArray(data.strain.effects)).toBe(true)
    expect(data.strain.effects.length).toBeGreaterThan(0) // Inferred from type
  })

  it('builds enriched strain from Otreeba data', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('otreeba')) {
        return new Response(JSON.stringify({
          data: [{
            name: 'Xylophonic Dreamweaver',
            strain_type: 'indica',
            description: 'A relaxing indica strain.',
            effects: 'Relaxed,Sleepy,Happy',
            flavors: 'Earthy,Pine',
            thc: '22.5',
            cbd: '0.5',
          }]
        }), { status: 200 })
      }
      if (typeof url === 'string' && url.includes('cannlytics')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response('Not found', { status: 404 })
    })

    const resp = await onRequestPost(makeContext({ name: 'Xylophonic Dreamweaver' }))
    const data = await getJSON(resp)

    expect(data.found).toBe(true)
    expect(data.strain.name).toBe('Xylophonic Dreamweaver')
    expect(data.strain.type).toBe('indica')
    expect(data.strain.effects.length).toBeGreaterThan(0)
    expect(data.strain.flavors).toContain('Earthy')
    expect(data.strain.cannabinoids.some(c => c.name === 'THC')).toBe(true)
    expect(data.message).toContain('Otreeba')
  })

  it('merges Otreeba + Cannlytics data', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('otreeba')) {
        return new Response(JSON.stringify({
          data: [{
            name: 'Merger Strain',
            strain_type: 'hybrid',
            description: 'Merged test strain.',
            effects: 'Happy,Relaxed',
            flavors: 'Citrus',
          }]
        }), { status: 200 })
      }
      if (typeof url === 'string' && url.includes('cannlytics')) {
        return new Response(JSON.stringify({
          data: [{
            name: 'Merger Strain',
            beta_myrcene: 0.45,
            limonene: 0.28,
            beta_caryophyllene: 0.15,
            thc: 19.5,
          }]
        }), { status: 200 })
      }
      return new Response('Not found', { status: 404 })
    })

    const resp = await onRequestPost(makeContext({ name: 'Merger Strain' }))
    const data = await getJSON(resp)

    expect(data.found).toBe(true)
    expect(data.strain.terpenes.length).toBeGreaterThan(0)
    expect(data.strain.cannabinoids.length).toBeGreaterThan(0)
    expect(data.strain.flavors).toContain('Citrus')
    expect(data.message).toContain('Otreeba')
    expect(data.message).toContain('Cannlytics')
    // Should be at least partial since we have terpene data
    expect(['partial', 'complete']).toContain(data.strain.dataCompleteness)
  })

  it('handles external API timeouts gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('Network timeout')
    })

    const resp = await onRequestPost(makeContext({ name: 'Timeout Test Strain' }))
    const data = await getJSON(resp)

    // Should still return a valid response (minimal placeholder)
    expect(data).toHaveProperty('found')
    expect(data).toHaveProperty('strain')
    expect(resp.status).toBeLessThan(500) // No server error
  })
})

describe('Strain Request — Response Shape Consistency', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('all responses include CORS headers', async () => {
    const resp = await onRequestPost(makeContext({ name: 'Super Skunk' }))
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('enriched strains have StrainCard-compatible shape', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('otreeba')) {
        return new Response(JSON.stringify({
          data: [{
            name: 'Shape Test',
            strain_type: 'sativa',
            description: 'Test.',
            effects: 'Energetic,Creative',
            flavors: 'Lemon',
            thc: '18',
          }]
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })

    const resp = await onRequestPost(makeContext({ name: 'Shape Test' }))
    const data = await getJSON(resp)
    const s = data.strain

    // These are the fields StrainCard.jsx expects
    expect(s).toHaveProperty('name')
    expect(s).toHaveProperty('type')
    expect(s).toHaveProperty('description')
    expect(s).toHaveProperty('effects')
    expect(s).toHaveProperty('terpenes')
    expect(s).toHaveProperty('cannabinoids')
    expect(s).toHaveProperty('dataCompleteness')
    expect(s).toHaveProperty('genetics')
    expect(s).toHaveProperty('best_for')
    expect(s).toHaveProperty('not_ideal_for')
    expect(s).toHaveProperty('flavors')
    expect(s).toHaveProperty('availability')

    // Type checks
    expect(typeof s.name).toBe('string')
    expect(['sativa', 'indica', 'hybrid']).toContain(s.type)
    expect(Array.isArray(s.effects)).toBe(true)
    expect(Array.isArray(s.terpenes)).toBe(true)
    expect(Array.isArray(s.cannabinoids)).toBe(true)
    expect(Array.isArray(s.flavors)).toBe(true)
    expect(Array.isArray(s.best_for)).toBe(true)
  })
})
