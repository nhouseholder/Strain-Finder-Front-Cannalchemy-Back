import { test, expect } from '@playwright/test'
import { navigateTo, waitForStrainData } from './helpers.js'

test.describe('Accessibility Basics', () => {
  test('landing page has proper heading hierarchy', async ({ page }) => {
    await navigateTo(page, '/')
    // Should have at least one h1
    const h1 = page.locator('h1')
    const h1Count = await h1.count()
    expect(h1Count).toBeGreaterThanOrEqual(1)
  })

  test('all images have alt text or are decorative', async ({ page }) => {
    await navigateTo(page, '/')
    const images = page.locator('img')
    const count = await images.count()
    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      const role = await img.getAttribute('role')
      const ariaHidden = await img.getAttribute('aria-hidden')
      // Image should have alt text, or be marked as presentational
      const isDecorative = role === 'presentation' || ariaHidden === 'true' || alt === ''
      expect(alt !== null || isDecorative).toBe(true)
    }
  })

  test('form inputs have labels or aria-labels', async ({ page }) => {
    await navigateTo(page, '/login')
    const inputs = page.locator('input:not([type="hidden"])')
    const count = await inputs.count()
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i)
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledBy = await input.getAttribute('aria-labelledby')
      const id = await input.getAttribute('id')
      const placeholder = await input.getAttribute('placeholder')
      // Should have some form of labeling
      const hasLabel = ariaLabel || ariaLabelledBy || placeholder
      if (id) {
        const label = page.locator(`label[for="${id}"]`)
        const labelExists = await label.count() > 0
        expect(hasLabel || labelExists).toBeTruthy()
      } else {
        expect(hasLabel).toBeTruthy()
      }
    }
  })

  test('interactive elements are keyboard accessible', async ({ page }) => {
    await navigateTo(page, '/')
    // Tab should move focus to interactive elements
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focused)
  })

  test('links have visible text or aria-label', async ({ page }) => {
    await navigateTo(page, '/strains')
    await waitForStrainData(page)
    // Sample 10 links
    const links = page.locator('a')
    const count = Math.min(await links.count(), 10)
    for (let i = 0; i < count; i++) {
      const link = links.nth(i)
      const text = await link.textContent()
      const ariaLabel = await link.getAttribute('aria-label')
      const title = await link.getAttribute('title')
      expect(text.trim().length > 0 || ariaLabel || title).toBeTruthy()
    }
  })

  test('color contrast — text is readable (spot check)', async ({ page }) => {
    await navigateTo(page, '/strains')
    await waitForStrainData(page)
    await expect(page.locator('h1:has-text("All Cannabis Strains")')).toBeVisible()
    // Heading text should have non-transparent color
    const color = await page.locator('h1').first().evaluate(el => getComputedStyle(el).color)
    expect(color).not.toBe('rgba(0, 0, 0, 0)')
  })
})

test.describe('Theme Toggle', () => {
  test('page defaults to dark mode', async ({ page }) => {
    await navigateTo(page, '/')
    const htmlClass = await page.locator('html').getAttribute('class')
    expect(htmlClass).toContain('dark')
  })
})
