import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers.js'

test.describe('Quiz Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/quiz')
  })

  test('renders quiz with first question', async ({ page }) => {
    // Should show the quiz container with a question
    await expect(page.locator('text=/What|How|Which|Choose|Select|Tell|purpose/i').first()).toBeVisible({ timeout: 10_000 })
  })

  test('has clickable answer options', async ({ page }) => {
    // Wait for question to render
    await expect(page.locator('text=/What|How|Which|Choose|Select|Tell|purpose/i').first()).toBeVisible({ timeout: 10_000 })
    // Quiz answer options may be buttons, radio inputs, or clickable divs/labels
    const options = page.locator('button:not([disabled]), input[type="radio"], [role="option"], [role="radio"]').filter({ hasNot: page.locator('nav') })
    const count = await options.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('quiz page has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Quiz|MyStrainAI/)
  })
})
