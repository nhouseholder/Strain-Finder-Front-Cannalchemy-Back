import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers.js'

test.describe('SEO Meta Tags', () => {
  test('landing page has required meta tags', async ({ page }) => {
    await navigateTo(page, '/')
    // Title
    await expect(page).toHaveTitle(/MyStrainAI/)
    // Description
    const desc = await page.locator('meta[name="description"]').getAttribute('content')
    expect(desc).toBeTruthy()
    expect(desc.length).toBeGreaterThan(50)
    // OG tags
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
    expect(ogTitle).toBeTruthy()
    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content')
    expect(ogDesc).toBeTruthy()
    // Canonical
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical).toContain('mystrainai.com')
  })

  test('landing page has JSON-LD structured data', async ({ page }) => {
    await navigateTo(page, '/')
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent()
    const data = JSON.parse(jsonLd)
    expect(data['@context']).toBe('https://schema.org')
    expect(data.name).toBe('MyStrainAI')
  })

  test('strain page injects dynamic meta tags', async ({ page }) => {
    await navigateTo(page, '/strains/afgoo')
    await expect(page.locator('h1:has-text("Afgoo")')).toBeVisible({ timeout: 15_000 })
    // Dynamic meta description should mention strain
    const desc = await page.locator('meta[name="description"]').getAttribute('content')
    expect(desc).toContain('Afgoo')
    // OG URL should be correct
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content')
    expect(ogUrl).toContain('/strains/afgoo')
  })
})

test.describe('Robots.txt', () => {
  test('robots.txt allows strains pages', async ({ page }) => {
    const response = await page.goto('/robots.txt')
    const text = await response.text()
    expect(text).toContain('Allow: /strains')
    expect(text).toContain('Allow: /learn')
    expect(text).toContain('Sitemap:')
    // Should not block strains
    expect(text).not.toContain('Disallow: /strains')
  })

  test('robots.txt blocks private pages', async ({ page }) => {
    const response = await page.goto('/robots.txt')
    const text = await response.text()
    expect(text).toContain('Disallow: /admin')
    expect(text).toContain('Disallow: /journal')
    expect(text).toContain('Disallow: /dashboard')
  })
})

test.describe('Analytics', () => {
  test('Umami tracking script is present in HTML', async ({ page }) => {
    await navigateTo(page, '/')
    const umamiScript = page.locator('script[data-website-id]')
    await expect(umamiScript).toHaveCount(1)
    const websiteId = await umamiScript.getAttribute('data-website-id')
    expect(websiteId).toBeTruthy()
    expect(websiteId.length).toBeGreaterThan(10)
  })

  test('Plausible script is NOT present', async ({ page }) => {
    await navigateTo(page, '/')
    const plausibleScript = page.locator('script[data-domain="mystrainai.com"]')
    await expect(plausibleScript).toHaveCount(0)
  })
})
