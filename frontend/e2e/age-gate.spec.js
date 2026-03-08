import { test, expect } from '@playwright/test'

test.describe('Age Gate', () => {
  test('shows age gate on first visit', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Please enter your date of birth')).toBeVisible()
    await expect(page.locator('select[aria-label="Birth month"]')).toBeVisible()
    await expect(page.locator('select[aria-label="Birth year"]')).toBeVisible()
    await expect(page.locator('text=Verify & Enter')).toBeVisible()
  })

  test('shows error when no date selected', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Verify & Enter')
    await expect(page.locator('text=Please select your birth month and year')).toBeVisible()
  })

  test('rejects underage users', async ({ page }) => {
    await page.goto('/')
    await page.selectOption('select[aria-label="Birth month"]', '6')
    await page.selectOption('select[aria-label="Birth year"]', '2010')
    await page.click('text=Verify & Enter')
    await expect(page.locator('text=Sorry, you must be 21 or older')).toBeVisible()
  })

  test('accepts valid age and shows landing page', async ({ page }) => {
    await page.goto('/')
    await page.selectOption('select[aria-label="Birth month"]', '1')
    await page.selectOption('select[aria-label="Birth year"]', '1990')
    await page.click('text=Verify & Enter')
    // Landing page hero: "Cannabis science, personalized by AI."
    await expect(page.locator('text=Cannabis science,')).toBeVisible({ timeout: 10_000 })
  })

  test('remembers verification across page loads', async ({ page }) => {
    // First visit — verify
    await page.goto('/')
    await page.selectOption('select[aria-label="Birth month"]', '3')
    await page.selectOption('select[aria-label="Birth year"]', '1985')
    await page.click('text=Verify & Enter')
    await expect(page.locator('text=Cannabis science,')).toBeVisible({ timeout: 10_000 })

    // Second visit — should skip age gate
    await page.goto('/')
    await expect(page.locator('text=Please enter your date of birth')).not.toBeVisible({ timeout: 3_000 })
    await expect(page.locator('text=Cannabis science,')).toBeVisible({ timeout: 10_000 })
  })

  test('underage Go Back button returns to age form', async ({ page }) => {
    await page.goto('/')
    await page.selectOption('select[aria-label="Birth month"]', '6')
    await page.selectOption('select[aria-label="Birth year"]', '2015')
    await page.click('text=Verify & Enter')
    await expect(page.locator('text=Sorry, you must be 21 or older')).toBeVisible()
    await page.click('text=Go Back')
    await expect(page.locator('text=Please enter your date of birth')).toBeVisible()
  })

  test('legal disclaimers are visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=By entering, you agree that:')).toBeVisible()
    await expect(page.locator('text=21 years of age or older')).toBeVisible()
    await expect(page.locator('text=for informational purposes only')).toBeVisible()
    await expect(page.locator('text=recommendations, not prescriptions')).toBeVisible()
  })
})
