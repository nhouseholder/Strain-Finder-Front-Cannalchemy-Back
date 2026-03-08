/**
 * Shared helpers for all Playwright tests.
 * Handles age gate bypass, legal consent bypass, and common navigation patterns.
 */

/**
 * Bypass the age gate and legal consent by setting localStorage before page load.
 * Must be called BEFORE navigating to the page.
 */
export async function bypassAgeGate(page) {
  await page.addInitScript(() => {
    localStorage.setItem('sf_age_verified', 'true')
    localStorage.setItem('sf_legal_consent', 'true')
  })
}

/**
 * Wait for strain data to finish lazy-loading.
 * Many pages depend on the strains.json chunk being fully loaded.
 */
export async function waitForStrainData(page) {
  // Wait for any loading spinner to disappear (if present)
  const spinner = page.locator('.animate-spin-slow')
  if (await spinner.isVisible({ timeout: 1000 }).catch(() => false)) {
    await spinner.waitFor({ state: 'hidden', timeout: 20_000 })
  }
}

/**
 * Navigate to a page with age gate + legal consent bypassed and wait for load.
 */
export async function navigateTo(page, path) {
  await bypassAgeGate(page)
  await page.goto(path, { waitUntil: 'networkidle' })
}

/**
 * Assert no console errors (warnings are OK).
 * Returns an array of error messages collected during the test.
 */
export function collectConsoleErrors(page) {
  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // Ignore known non-issues
      if (text.includes('favicon') ||
          text.includes('getinfo') ||
          text.includes('analytics') ||
          text.includes('Failed to load resource') ||
          text.includes('net::ERR')) return
      errors.push(text)
    }
  })
  return errors
}
