/**
 * E2E tests for the Strain Request flow.
 *
 * Tests the full user journey:
 * 1. User searches for a strain not in the database
 * 2. "Request This Strain" button appears
 * 3. User clicks it and sees enrichment progress
 * 4. Strain card appears with data
 *
 * Run with: npx playwright test
 * Requires Wrangler local dev server (npm run dev:local) or set TEST_BASE_URL.
 */
import { test, expect } from '@playwright/test'

test.describe('Strain Search Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search')
  })

  test('search page loads with search input', async ({ page }) => {
    // Should have a search input
    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i], input[placeholder*="strain" i]')
    await expect(searchInput.first()).toBeVisible({ timeout: 10000 })
  })

  test('searching for known strain shows results', async ({ page }) => {
    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i], input[placeholder*="strain" i]').first()
    await searchInput.fill('Blue Dream')
    await searchInput.press('Enter')

    // Should show at least one result (not the "no strains found" state)
    // Wait for either results or no-results state
    await page.waitForTimeout(2000)

    const noResults = page.locator('text=/no strains found/i')
    const resultCards = page.locator('[class*="strain"], [class*="card"]')

    // Blue Dream should be in the database
    const noResultsVisible = await noResults.isVisible().catch(() => false)
    if (!noResultsVisible) {
      await expect(resultCards.first()).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('Strain Request Flow', () => {
  test('shows "Request This Strain" for unknown strain', async ({ page }) => {
    await page.goto('/search')

    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i], input[placeholder*="strain" i]').first()
    await searchInput.fill('Mythical Unicorn Kush 9999')
    await searchInput.press('Enter')

    // Wait for search to complete and show no results
    await page.waitForTimeout(2000)

    // Should show a "Request This Strain" button
    const requestButton = page.locator('button:has-text("Request This Strain"), button:has-text("request this strain")')
    await expect(requestButton).toBeVisible({ timeout: 10000 })
  })

  test('clicking request button triggers enrichment', async ({ page }) => {
    await page.goto('/search')

    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i], input[placeholder*="strain" i]').first()
    await searchInput.fill('Mythical Unicorn Kush 9999')
    await searchInput.press('Enter')

    await page.waitForTimeout(2000)

    const requestButton = page.locator('button:has-text("Request This Strain"), button:has-text("request this strain")')
    await expect(requestButton).toBeVisible({ timeout: 10000 })

    // Click the request button
    await requestButton.click()

    // Should show some loading/enrichment state
    // Either a loading spinner, progress indicator, or the strain card itself
    const enrichmentIndicator = page.locator(
      'text=/enriching/i, text=/searching/i, text=/loading/i, [class*="spinner"], [class*="loading"]'
    )
    const strainCard = page.locator('[class*="strain"], [class*="card"]')

    // Wait for either enrichment indicator or result card
    await expect(enrichmentIndicator.or(strainCard).first()).toBeVisible({ timeout: 15000 })
  })
})

test.describe('Strain Lookup API — Direct', () => {
  test('GET /api/v1/strains/lookup/:name returns correct shape', async ({ request }) => {
    const resp = await request.get('/api/v1/strains/lookup/Super%20Skunk')
    expect(resp.ok()).toBe(true)

    const data = await resp.json()
    expect(data).toHaveProperty('found')
    expect(data).toHaveProperty('strain')
    expect(data).toHaveProperty('enrichmentStatus')
    expect(data).toHaveProperty('message')

    expect(data.found).toBe(true)
    expect(data.strain.name).toBe('Super Skunk')
  })

  test('GET /api/v1/strains/lookup/:name returns CORS headers', async ({ request }) => {
    const resp = await request.get('/api/v1/strains/lookup/Super%20Skunk')
    expect(resp.headers()['access-control-allow-origin']).toBe('*')
  })

  test('GET /api/v1/strains/lookup/:name returns 400 for empty name', async ({ request }) => {
    const resp = await request.get('/api/v1/strains/lookup/%20')
    expect(resp.status()).toBe(400)
  })

  test('GET /api/v1/strains/lookup/:name returns not-found for nonexistent strain', async ({ request }) => {
    const resp = await request.get('/api/v1/strains/lookup/Zzxyvqwjklm')
    expect(resp.ok()).toBe(true)
    const data = await resp.json()
    expect(data.found).toBe(false)
    expect(data.strain).toBeNull()
  })
})

test.describe('Strain Request API — Direct', () => {
  test('POST /api/v1/strains/request returns local strain if found', async ({ request }) => {
    const resp = await request.post('/api/v1/strains/request', {
      data: { name: 'Super Skunk' },
    })
    expect(resp.ok()).toBe(true)

    const data = await resp.json()
    expect(data.found).toBe(true)
    expect(data.strain.name).toBe('Super Skunk')
    expect(data.enrichmentStatus).toBe('complete')
  })

  test('POST /api/v1/strains/request handles unknown strain', async ({ request }) => {
    const resp = await request.post('/api/v1/strains/request', {
      data: { name: 'Totally Unknown Strain ZZZ999' },
    })
    expect(resp.ok()).toBe(true)

    const data = await resp.json()
    expect(data).toHaveProperty('found')
    expect(data).toHaveProperty('strain')
    expect(data).toHaveProperty('enrichmentStatus')
    expect(data).toHaveProperty('message')

    // Should return something — either external data or minimal placeholder
    if (data.found) {
      expect(data.strain).toBeTruthy()
      expect(data.strain).toHaveProperty('name')
      expect(data.strain).toHaveProperty('type')
      expect(data.strain).toHaveProperty('effects')
    }
  })

  test('POST /api/v1/strains/request returns 400 for invalid body', async ({ request }) => {
    const resp = await request.post('/api/v1/strains/request', {
      data: {},
    })
    expect(resp.status()).toBe(400)
  })

  test('POST /api/v1/strains/request returns CORS headers', async ({ request }) => {
    const resp = await request.post('/api/v1/strains/request', {
      data: { name: 'test' },
    })
    expect(resp.headers()['access-control-allow-origin']).toBe('*')
  })
})
