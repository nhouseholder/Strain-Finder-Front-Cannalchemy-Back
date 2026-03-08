import { test, expect } from '@playwright/test'
import { navigateTo, waitForStrainData } from './helpers.js'

test.describe('Strain Search Page', () => {
  test('search page renders with search input', async ({ page }) => {
    await navigateTo(page, '/search')
    // With legal consent bypassed, should show search UI
    // The search page uses SearchAutocomplete with input
    await expect(page.locator('input').first()).toBeVisible({ timeout: 10_000 })
  })

  test('search with query param populates results', async ({ page }) => {
    await navigateTo(page, '/search?q=Blue%20Dream')
    await waitForStrainData(page)
    // Should show Blue Dream strain card in results
    await expect(page.locator('text=Blue Dream').first()).toBeVisible({ timeout: 15_000 })
  })

  test('typing in search shows filtered results', async ({ page }) => {
    await navigateTo(page, '/search')
    await waitForStrainData(page)
    const input = page.locator('input').first()
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('OG Kush')
    await page.waitForTimeout(1_000)
    await expect(page.locator('text=OG Kush').first()).toBeVisible({ timeout: 10_000 })
  })

  test('clicking a search result expands strain details', async ({ page }) => {
    await navigateTo(page, '/search?q=Blue%20Dream')
    await waitForStrainData(page)
    const strainCard = page.locator('text=Blue Dream').first()
    await expect(strainCard).toBeVisible({ timeout: 15_000 })
    await strainCard.click()
    // Should show expanded details (effects, terpenes, etc.)
    await expect(page.locator('text=/Effects|Terpene|Experience|Flavor/i').first()).toBeVisible({ timeout: 10_000 })
  })
})
