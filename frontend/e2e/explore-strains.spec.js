import { test, expect } from '@playwright/test'
import { navigateTo, waitForStrainData } from './helpers.js'

test.describe('Explore Strains Page', () => {
  test('renders category selection or content', async ({ page }) => {
    await navigateTo(page, '/explore-strains')
    // The explore page shows category cards or a list of effects to browse
    // With legal consent bypassed, it should show the actual explore content
    await expect(page.locator('text=/Explore|Discover|Pain|Sleep|Anxiety|Creativity|Energy|Relaxation/i').first()).toBeVisible({ timeout: 15_000 })
  })

  test('selecting a category shows strains', async ({ page }) => {
    await navigateTo(page, '/explore-strains')
    // Click on a category link
    const categoryLink = page.locator('a[href*="/explore-strains/"]').first()
    if (await categoryLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await categoryLink.click()
      await waitForStrainData(page)
    }
  })

  test('category page has content', async ({ page }) => {
    await navigateTo(page, '/explore-strains/sleep')
    await waitForStrainData(page)
    // Should show some content about the category
    const body = await page.locator('body').textContent()
    expect(body.length).toBeGreaterThan(100)
  })

  test('back navigation from category works', async ({ page }) => {
    // Navigate to parent first so goBack() has history
    await navigateTo(page, '/explore-strains')
    await expect(page.locator('text=/Explore|Discover|Pain|Sleep|Anxiety|Creativity|Energy|Relaxation/i').first()).toBeVisible({ timeout: 15_000 })
    await page.goto('http://localhost:4173/explore-strains/creativity')
    await waitForStrainData(page)
    await page.goBack()
    await expect(page).toHaveURL(/\/explore-strains\/?$/)
  })
})
