/**
 * MyStrainAI — Screenshot Capture Pipeline
 *
 * Uses Puppeteer to capture high-quality screenshots of
 * app pages for Instagram post generation.
 *
 * Usage:  node scripts/capture-screenshots.js [--page /quiz] [--mobile]
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'screenshots');

// ── Configuration ───────────────────────────────────────────────
const APP_URL = process.env.APP_URL || 'https://mystrainai.com';

// Instagram optimal: 1080×1350 (4:5 portrait) for maximum feed space
const VIEWPORT_MOBILE = { width: 430, height: 932, deviceScaleFactor: 3 };
// Desktop captures at higher res for cropping
const VIEWPORT_DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 2 };

// Pages to capture with specific instructions
const PAGES = [
  {
    path: '/',
    name: 'landing',
    description: 'Landing page hero section',
    waitFor: '.hero, main, [class*="hero"], [class*="landing"]',
    scroll: false,
  },
  {
    path: '/quiz',
    name: 'quiz',
    description: 'Quiz page — first question',
    waitFor: '[class*="quiz"], main, form',
    scroll: false,
  },
  {
    path: '/explore',
    name: 'explorer',
    description: 'Strain Explorer with strain cards',
    waitFor: '[class*="strain"], [class*="card"], main',
    scroll: false,
  },
  {
    path: '/learn',
    name: 'learn',
    description: 'Learn page — terpene education',
    waitFor: 'main',
    scroll: false,
  },
  {
    path: '/compare',
    name: 'compare',
    description: 'Strain comparison tool',
    waitFor: 'main',
    scroll: false,
  },
];

// ── Helpers ──────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().slice(0, 10);
}

// ── Main ────────────────────────────────────────────────────────
async function captureScreenshots(options = {}) {
  const { pages = PAGES, mobile = true, desktop = false } = options;

  ensureDir(OUTPUT_DIR);

  console.log(`📸 Capturing ${pages.length} pages from ${APP_URL}`);
  console.log(`   Mobile: ${mobile}, Desktop: ${desktop}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];

  for (const page of pages) {
    const url = `${APP_URL}${page.path}`;
    console.log(`\n→ Capturing: ${page.name} (${url})`);

    // ── Mobile capture ──
    if (mobile) {
      const tab = await browser.newPage();
      await tab.setViewport(VIEWPORT_MOBILE);

      // Set mobile user agent
      await tab.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      );

      try {
        await tab.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for content to render
        if (page.waitFor) {
          try {
            await tab.waitForSelector(page.waitFor, { timeout: 5000 });
          } catch {
            console.log(`   ⚠ Selector ${page.waitFor} not found, continuing...`);
          }
        }

        // Allow animations to settle
        await new Promise((r) => setTimeout(r, 2000));

        // Optional scroll to capture below-fold content
        if (page.scroll) {
          await tab.evaluate(() => window.scrollTo(0, 600));
          await new Promise((r) => setTimeout(r, 1000));
        }

        const filename = `${page.name}-mobile-${timestamp()}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);
        await tab.screenshot({
          path: filepath,
          type: 'png',
          // Clip to Instagram 4:5 ratio (1080×1350 at 3x = 1290×2796 → clip)
          clip: {
            x: 0,
            y: 0,
            width: VIEWPORT_MOBILE.width,
            height: Math.floor(VIEWPORT_MOBILE.width * (5 / 4)), // 4:5 ratio
          },
        });

        console.log(`   ✅ ${filename} (${VIEWPORT_MOBILE.width}×${Math.floor(VIEWPORT_MOBILE.width * 5/4)} @${VIEWPORT_MOBILE.deviceScaleFactor}x)`);
        results.push({ page: page.name, type: 'mobile', path: filepath });
      } catch (err) {
        console.error(`   ❌ Failed: ${err.message}`);
      } finally {
        await tab.close();
      }
    }

    // ── Desktop capture ──
    if (desktop) {
      const tab = await browser.newPage();
      await tab.setViewport(VIEWPORT_DESKTOP);

      try {
        await tab.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        if (page.waitFor) {
          try {
            await tab.waitForSelector(page.waitFor, { timeout: 5000 });
          } catch {
            /* continue */
          }
        }

        await new Promise((r) => setTimeout(r, 2000));

        const filename = `${page.name}-desktop-${timestamp()}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);
        await tab.screenshot({ path: filepath, type: 'png', fullPage: false });

        console.log(`   ✅ ${filename}`);
        results.push({ page: page.name, type: 'desktop', path: filepath });
      } catch (err) {
        console.error(`   ❌ Failed: ${err.message}`);
      } finally {
        await tab.close();
      }
    }
  }

  await browser.close();

  console.log(`\n📸 Done! ${results.length} screenshots saved to ${OUTPUT_DIR}`);
  return results;
}

// ── CLI ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const pageArg = args.find((a) => a.startsWith('--page='));
const isMobile = !args.includes('--desktop-only');
const isDesktop = args.includes('--desktop') || args.includes('--desktop-only');

let selectedPages = PAGES;
if (pageArg) {
  const pagePath = pageArg.split('=')[1];
  selectedPages = PAGES.filter((p) => p.path === pagePath);
  if (selectedPages.length === 0) {
    console.error(`Page not found: ${pagePath}`);
    console.log('Available:', PAGES.map((p) => p.path).join(', '));
    process.exit(1);
  }
}

captureScreenshots({
  pages: selectedPages,
  mobile: isMobile,
  desktop: isDesktop,
}).catch(console.error);

export { captureScreenshots, PAGES, OUTPUT_DIR };
