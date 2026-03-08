import { test, expect } from '@playwright/test'
import { navigateTo, waitForStrainData } from './helpers.js'

test.describe('Mobile Viewport (375x812)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('landing page is usable on mobile', async ({ page }) => {
    await navigateTo(page, '/')
    // Hero text visible
    await expect(page.locator('text=Cannabis science,')).toBeVisible()
    // Search bar should be visible and usable
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible()
    // No horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('strain directory is usable on mobile', async ({ page }) => {
    await navigateTo(page, '/strains')
    await waitForStrainData(page)
    await expect(page.locator('h1:has-text("All Cannabis Strains")')).toBeVisible()
    // Search input visible
    await expect(page.locator('input[placeholder="Search strains..."]')).toBeVisible({ timeout: 15_000 })
    // Strain cards visible
    const cards = page.locator('a[href^="/strains/"]')
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })
  })

  test('strain detail page is usable on mobile', async ({ page }) => {
    await navigateTo(page, '/strains/blue-dream')
    await waitForStrainData(page)
    await expect(page.locator('h1:has-text("Blue Dream")')).toBeVisible({ timeout: 15_000 })
    // No horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('quiz page is usable on mobile', async ({ page }) => {
    await navigateTo(page, '/quiz')
    await expect(page.locator('text=/What|How|Which|Choose|purpose/i').first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Tablet Viewport (768x1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test('landing page renders correctly', async ({ page }) => {
    await navigateTo(page, '/')
    await expect(page.locator('text=Cannabis science,')).toBeVisible()
  })

  test('strain directory grid renders', async ({ page }) => {
    await navigateTo(page, '/strains')
    await waitForStrainData(page)
    await expect(page.locator('a[href^="/strains/"]').first()).toBeVisible({ timeout: 15_000 })
    const grid = page.locator('.grid').first()
    await expect(grid).toBeVisible()
  })
})

test.describe('Desktop Viewport (1440x900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('landing page shows full nav and hero', async ({ page }) => {
    await navigateTo(page, '/')
    await expect(page.locator('text=Cannabis science,')).toBeVisible()
    // Desktop nav should show links
    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible()
  })

  test('strain directory is well-spaced on desktop', async ({ page }) => {
    await navigateTo(page, '/strains')
    await waitForStrainData(page)
    await expect(page.locator('a[href^="/strains/"]').first()).toBeVisible({ timeout: 15_000 })
    // Content should be centered with max-width
    const container = page.locator('.max-w-3xl, .max-w-2xl, .max-w-xl').first()
    await expect(container).toBeVisible()
  })
})
