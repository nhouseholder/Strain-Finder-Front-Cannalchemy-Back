import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers.js'

test.describe('Learn Page', () => {
  test('index shows all topic cards', async ({ page }) => {
    await navigateTo(page, '/learn')
    const topics = ['Terpenes', 'Cannabinoids', 'Entourage Effect', 'About MyStrainAI', 'Strain Archetypes']
    for (const topic of topics) {
      await expect(page.locator(`text=${topic}`).first()).toBeVisible()
    }
  })

  test('topic cards link to detail pages', async ({ page }) => {
    await navigateTo(page, '/learn')
    await page.click('a[href="/learn/terpenes"]')
    await expect(page).toHaveURL('/learn/terpenes')
    await expect(page.locator('text=Myrcene')).toBeVisible()
    await expect(page.locator('text=Limonene')).toBeVisible()
  })

  test('terpenes topic shows all 8 terpene cards', async ({ page }) => {
    await navigateTo(page, '/learn/terpenes')
    const terpenes = ['Myrcene', 'Limonene', 'Linalool', 'Caryophyllene', 'Pinene', 'Humulene', 'Terpinolene', 'Ocimene']
    for (const t of terpenes) {
      await expect(page.locator(`text=${t}`).first()).toBeVisible()
    }
  })

  test('cannabinoids topic shows major cannabinoids', async ({ page }) => {
    await navigateTo(page, '/learn/cannabinoids')
    const cannabinoids = ['THC', 'CBD', 'CBN', 'CBG', 'THCV', 'CBC']
    for (const c of cannabinoids) {
      await expect(page.locator(`text=${c}`).first()).toBeVisible()
    }
  })

  test('entourage topic loads', async ({ page }) => {
    await navigateTo(page, '/learn/entourage')
    // The entourage effect page shows "Synergy > Isolation" as a fact title
    await expect(page.locator('text=Synergy').first()).toBeVisible()
  })

  test('about topic shows data and science info', async ({ page }) => {
    await navigateTo(page, '/learn/about')
    // About section shows "The Science-First Cannabis Platform"
    await expect(page.locator('text=Science-First').first()).toBeVisible()
  })

  test('archetypes topic loads', async ({ page }) => {
    await navigateTo(page, '/learn/archetypes')
    // Archetypes section should have content about strain classification
    await expect(page.locator('text=/Archetype|terpene|profile|classification/i').first()).toBeVisible()
  })
})
