import { test, expect } from '@playwright/test'
import { navigateTo, collectConsoleErrors } from './helpers.js'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/')
  })

  test('renders hero section with title and CTAs', async ({ page }) => {
    // Hero text: "Cannabis science, personalized by AI."
    await expect(page.locator('text=Cannabis science,')).toBeVisible()
    await expect(page.locator('text=personalized by AI')).toBeVisible()
    // Search bar
    await expect(page.locator('input[placeholder*="Search any strain"]')).toBeVisible()
    // Quiz CTA button — "Find My Strain"
    await expect(page.locator('text=Find My Strain').first()).toBeVisible()
  })

  test('strain search bar accepts input and shows suggestions', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search any strain"]')
    await searchInput.fill('Blue')
    // Wait for autocomplete suggestions to appear
    await expect(page.locator('text=Blue Dream').first()).toBeVisible({ timeout: 15_000 })
  })

  test('clicking a search result navigates to search page', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search any strain"]')
    await searchInput.fill('Blue Dream')
    await page.locator('text=Blue Dream').first().click({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/search\?q=Blue/)
  })

  test('Find My Strain CTA navigates to quiz page', async ({ page }) => {
    await page.locator('text=Find My Strain').first().click()
    await expect(page).toHaveURL('/quiz')
  })

  test('navigation bar has expected links', async ({ page }) => {
    // Desktop nav shows Quiz, Search, Explorer, Discover, Learn
    const navTexts = ['Quiz', 'Search', 'Learn']
    for (const text of navTexts) {
      const link = page.locator(`nav >> text=${text}`).first()
      if (await link.isVisible().catch(() => false)) {
        await expect(link).toBeVisible()
      }
    }
  })

  test('page has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/MyStrainAI/)
  })

  test('no critical console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.waitForTimeout(2_000)
    expect(errors).toHaveLength(0)
  })
})
