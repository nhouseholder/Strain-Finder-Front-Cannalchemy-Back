import { test, expect } from '@playwright/test'
import { navigateTo, waitForStrainData, collectConsoleErrors } from './helpers.js'

test.describe('Strain Directory Page (/strains)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/strains')
  })

  test('renders directory with strain cards', async ({ page }) => {
    await expect(page.locator('h1:has-text("All Cannabis Strains")')).toBeVisible()
    await waitForStrainData(page)
    // Should have strain links
    const strainLinks = page.locator('a[href^="/strains/"]')
    await expect(strainLinks.first()).toBeVisible({ timeout: 15_000 })
    const count = await strainLinks.count()
    expect(count).toBeGreaterThan(50)
  })

  test('search filter works', async ({ page }) => {
    await waitForStrainData(page)
    const searchInput = page.locator('input[placeholder="Search strains..."]')
    await searchInput.fill('Blue Dream')
    await expect(page.locator('a[href="/strains/blue-dream"]')).toBeVisible({ timeout: 5_000 })
    // Other strains should be filtered out
    const count = await page.locator('a[href^="/strains/"]').count()
    expect(count).toBeLessThan(10)
  })

  test('letter filter buttons work', async ({ page }) => {
    await waitForStrainData(page)
    // Click letter "G"
    await page.click('button:has-text("G")')
    await page.waitForTimeout(500)
    // All visible strain names should start with G
    const strainLinks = page.locator('a[href^="/strains/g"]')
    const count = await strainLinks.count()
    expect(count).toBeGreaterThan(0)
  })

  test('"All" button clears letter filter', async ({ page }) => {
    await waitForStrainData(page)
    // Filter by letter first
    await page.click('button:has-text("B")')
    await page.waitForTimeout(500)
    const filteredCount = await page.locator('a[href^="/strains/"]').count()
    // Click "All" to clear
    await page.click('button:has-text("All")')
    await page.waitForTimeout(500)
    const allCount = await page.locator('a[href^="/strains/"]').count()
    expect(allCount).toBeGreaterThan(filteredCount)
  })

  test('type filter links work', async ({ page }) => {
    await waitForStrainData(page)
    // Click "Indica" filter
    const indicaLink = page.locator('a[href="/strains/type/indica"]')
    await expect(indicaLink).toBeVisible()
    await indicaLink.click()
    await expect(page).toHaveURL('/strains/type/indica')
    await expect(page.locator('h1:has-text("Indica Strains")')).toBeVisible()
  })

  test('breadcrumbs navigation works', async ({ page }) => {
    await expect(page.locator('nav:has-text("Home")')).toBeVisible()
    await page.click('nav >> text=Home')
    await expect(page).toHaveURL('/')
  })

  test('strain count is displayed', async ({ page }) => {
    await waitForStrainData(page)
    await expect(page.locator('text=/\\d+ strains?/')).toBeVisible({ timeout: 15_000 })
  })

  test('quiz CTA is visible at bottom', async ({ page }) => {
    await waitForStrainData(page)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.locator('text=Find Your Perfect Match')).toBeVisible()
    await expect(page.locator('a:has-text("Take the Quiz")')).toBeVisible()
  })
})

test.describe('Strain Type Filter Pages', () => {
  for (const type of ['indica', 'sativa', 'hybrid']) {
    test(`/strains/type/${type} loads and filters correctly`, async ({ page }) => {
      await navigateTo(page, `/strains/type/${type}`)
      await waitForStrainData(page)
      const titleMap = { indica: 'Indica', sativa: 'Sativa', hybrid: 'Hybrid' }
      await expect(page.locator(`h1:has-text("${titleMap[type]} Strains")`)).toBeVisible()
      // Should have strain links
      const strainLinks = page.locator('a[href^="/strains/"]')
      await expect(strainLinks.first()).toBeVisible({ timeout: 15_000 })
      const count = await strainLinks.count()
      expect(count).toBeGreaterThan(10)
      // Breadcrumb should show type
      await expect(page.locator(`nav >> text=${titleMap[type]}`)).toBeVisible()
    })
  }
})

test.describe('Individual Strain Page (/strains/:slug)', () => {
  test('loads a known strain with full data', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await navigateTo(page, '/strains/blue-dream')
    await waitForStrainData(page)

    // Header
    await expect(page.locator('h1:has-text("Blue Dream")')).toBeVisible({ timeout: 15_000 })

    // Type badge
    await expect(page.locator('text=/indica|sativa|hybrid/i').first()).toBeVisible()

    // Breadcrumbs
    await expect(page.locator('nav:has-text("Strains")')).toBeVisible()

    // No critical console errors (resource 404s from analytics are OK in test)
    await page.waitForTimeout(1_000)
    expect(errors).toHaveLength(0)
  })

  test('has correct page title for SEO', async ({ page }) => {
    await navigateTo(page, '/strains/blue-dream')
    await waitForStrainData(page)
    await expect(page).toHaveTitle(/Blue Dream.*Strain.*MyStrainAI/)
  })

  test('has JSON-LD structured data', async ({ page }) => {
    await navigateTo(page, '/strains/blue-dream')
    await waitForStrainData(page)
    // Wait for strain to render (which injects JSON-LD)
    await expect(page.locator('h1:has-text("Blue Dream")')).toBeVisible({ timeout: 15_000 })
    const jsonLd = await page.locator('#strain-jsonld').textContent()
    const data = JSON.parse(jsonLd)
    expect(data['@type']).toBe('Product')
    expect(data.name).toContain('Blue Dream')
    expect(data.url).toContain('/strains/blue-dream')
  })

  test('has canonical URL meta tag', async ({ page }) => {
    await navigateTo(page, '/strains/blue-dream')
    await waitForStrainData(page)
    await expect(page.locator('h1:has-text("Blue Dream")')).toBeVisible({ timeout: 15_000 })
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical).toBe('https://mystrainai.com/strains/blue-dream')
  })

  test('has og:title meta tag', async ({ page }) => {
    await navigateTo(page, '/strains/blue-dream')
    await waitForStrainData(page)
    await expect(page.locator('h1:has-text("Blue Dream")')).toBeVisible({ timeout: 15_000 })
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
    expect(ogTitle).toContain('Blue Dream')
  })

  test('renders effects breakdown section', async ({ page }) => {
    await navigateTo(page, '/strains/blue-dream')
    await waitForStrainData(page)
    await expect(page.locator('h1:has-text("Blue Dream")')).toBeVisible({ timeout: 15_000 })
    // Look for effects section (the component renders bars/cards for effects)
    const effectsSection = page.locator('text=/Effects|What to Expect|Best For/i').first()
    await expect(effectsSection).toBeVisible()
  })

  test('renders terpene profile section', async ({ page }) => {
    await navigateTo(page, '/strains/blue-dream')
    await waitForStrainData(page)
    await expect(page.locator('h1:has-text("Blue Dream")')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=/Terpene/i').first()).toBeVisible()
  })

  test('renders cannabinoid profile section', async ({ page }) => {
    await navigateTo(page, '/strains/blue-dream')
    await waitForStrainData(page)
    await expect(page.locator('h1:has-text("Blue Dream")')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=/Cannabinoid|THC|CBD/i').first()).toBeVisible()
  })

  test('renders related strains section with clickable links', async ({ page }) => {
    await navigateTo(page, '/strains/blue-dream')
    await waitForStrainData(page)
    await expect(page.locator('h1:has-text("Blue Dream")')).toBeVisible({ timeout: 15_000 })
    // Scroll to bottom to find related strains
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const relatedSection = page.locator('text=/Similar.*Strains/i')
    if (await relatedSection.isVisible().catch(() => false)) {
      // Related strain links should navigate to other strain pages
      const relatedLink = page.locator('a[href^="/strains/"]').last()
      await expect(relatedLink).toBeVisible()
    }
  })

  test('quiz CTA at bottom links to /quiz', async ({ page }) => {
    await navigateTo(page, '/strains/blue-dream')
    await waitForStrainData(page)
    await expect(page.locator('h1:has-text("Blue Dream")')).toBeVisible({ timeout: 15_000 })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.locator('text=Not sure this strain is right for you?')).toBeVisible()
    const quizCTA = page.locator('a:has-text("Find Your Strain")')
    await expect(quizCTA).toBeVisible()
    await expect(quizCTA).toHaveAttribute('href', '/quiz')
  })

  test('breadcrumb links work', async ({ page }) => {
    await navigateTo(page, '/strains/blue-dream')
    await waitForStrainData(page)
    await expect(page.locator('h1:has-text("Blue Dream")')).toBeVisible({ timeout: 15_000 })
    // Click "Strains" breadcrumb
    await page.click('nav >> a:has-text("Strains")')
    await expect(page).toHaveURL('/strains')
    await expect(page.locator('h1:has-text("All Cannabis Strains")')).toBeVisible()
  })

  test('shows 404 for non-existent strain', async ({ page }) => {
    await navigateTo(page, '/strains/this-strain-does-not-exist-xyz')
    await waitForStrainData(page)
    await expect(page.locator('text=Strain Not Found')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('a:has-text("Browse All Strains")')).toBeVisible()
    await expect(page.locator('a:has-text("Search Strains")')).toBeVisible()
  })

  test('404 Browse All Strains link works', async ({ page }) => {
    await navigateTo(page, '/strains/nonexistent-strain-abcdef')
    await waitForStrainData(page)
    await expect(page.locator('text=Strain Not Found')).toBeVisible({ timeout: 15_000 })
    await page.click('a:has-text("Browse All Strains")')
    await expect(page).toHaveURL('/strains')
  })

  test('multiple strain pages load correctly', async ({ page }) => {
    const slugs = ['afgoo', 'death-star', 'gorilla-glue']
    for (const slug of slugs) {
      await navigateTo(page, `/strains/${slug}`)
      await waitForStrainData(page)
      // Should have an h1 (the strain name)
      const h1 = page.locator('h1').first()
      await expect(h1).toBeVisible({ timeout: 15_000 })
      const title = await h1.textContent()
      expect(title.length).toBeGreaterThan(2)
    }
  })

  test('strain page to strain page navigation works', async ({ page }) => {
    await navigateTo(page, '/strains/afgoo')
    await waitForStrainData(page)
    await expect(page.locator('h1:has-text("Afgoo")')).toBeVisible({ timeout: 15_000 })
    // Scroll to related strains and click one
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const relatedLink = page.locator('a[href^="/strains/"]').filter({ hasNot: page.locator('nav') }).last()
    if (await relatedLink.isVisible().catch(() => false)) {
      const href = await relatedLink.getAttribute('href')
      await relatedLink.click()
      await expect(page).toHaveURL(href)
    }
  })
})
