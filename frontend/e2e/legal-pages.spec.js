import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers.js'

test.describe('Legal Pages', () => {
  test('terms page renders with content', async ({ page }) => {
    await navigateTo(page, '/terms')
    await expect(page.locator('h1, h2').filter({ hasText: /Terms/i }).first()).toBeVisible()
    // Should have substantial text content
    const bodyText = await page.locator('main, article, [class*="content"], .prose').first().textContent().catch(() => '')
    expect(bodyText.length).toBeGreaterThan(100)
  })

  test('privacy page renders with content', async ({ page }) => {
    await navigateTo(page, '/privacy')
    await expect(page.locator('h1, h2').filter({ hasText: /Privacy/i }).first()).toBeVisible()
    const bodyText = await page.locator('main, article, [class*="content"], .prose').first().textContent().catch(() => '')
    expect(bodyText.length).toBeGreaterThan(100)
  })
})

test.describe('Auth Pages Render', () => {
  test('login page has email and password fields', async ({ page }) => {
    await navigateTo(page, '/login')
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    // Should have a submit button
    await expect(page.locator('button[type="submit"], button:has-text("Log In"), button:has-text("Sign In")').first()).toBeVisible()
  })

  test('login page links to signup', async ({ page }) => {
    await navigateTo(page, '/login')
    const signupLink = page.locator('a[href="/signup"], a:has-text("Sign Up"), a:has-text("Create")').first()
    await expect(signupLink).toBeVisible({ timeout: 10_000 })
  })

  test('signup page has registration fields', async ({ page }) => {
    await navigateTo(page, '/signup')
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('forgot password page renders', async ({ page }) => {
    await navigateTo(page, '/forgot-password')
    await expect(page.locator('text=/Forgot|Reset|Password/i').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible()
  })

  test('login page links to forgot password', async ({ page }) => {
    await navigateTo(page, '/login')
    const forgotLink = page.locator('a[href="/forgot-password"], a:has-text("Forgot")').first()
    await expect(forgotLink).toBeVisible({ timeout: 10_000 })
  })
})
