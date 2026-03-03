/**
 * MyStrainAI — Branded Post Image Generator
 *
 * Generates Instagram-ready images (1080x1350, 4:5 portrait) using
 * Sharp to render complete SVG documents as PNG.
 *
 * Usage:  node scripts/generate-posts.js [--day=1] [--all] [--preview]
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  BRAND,
  TERPENES,
  FEATURED_STRAINS,
  MYTHS,
  DATA_POSTS,
  FEATURES,
  CONTENT_CALENDAR,
} from '../data/content-library.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');

// ── Image dimensions (Instagram 4:5 portrait) ──────────────────
const W = 1080;
const H = 1350;
const PAD = 60;

// ── Brand colors ────────────────────────────────────────────────
const C = BRAND.colors;

// ── Helpers ─────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Remove emojis — SVG/librsvg cannot render them
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '');
}

/** Word-wrap text into lines that fit a given character width */
function wrapText(text, charsPerLine) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > charsPerLine) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

/** Build tspan elements for wrapped text */
function tspans(text, { x = PAD, fontSize = 36, lineHeight = 1.4, maxLines = 12 } = {}) {
  const cpl = Math.floor((W - PAD * 2) / (fontSize * 0.52));
  const lines = wrapText(text, cpl).slice(0, maxLines);
  const dy = fontSize * lineHeight;
  return lines
    .map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : dy}">${esc(l)}</tspan>`)
    .join('');
}

/** Calculate how many pixels a block of wrapped text will consume */
function textHeight(text, fontSize, lineHeight = 1.4) {
  const cpl = Math.floor((W - PAD * 2) / (fontSize * 0.52));
  const numLines = wrapText(text, cpl).length;
  return numLines * fontSize * lineHeight;
}

// ── Section Renderers ───────────────────────────────────────────
// Each returns { svg: string, height: number }

function renderTitle(text, subtitle, y) {
  const parts = [];
  const h1 = textHeight(text, 52);
  parts.push(`<text x="${PAD}" y="${y}" font-family="sans-serif" font-size="52" font-weight="800" fill="#FFFFFF">${tspans(text, { fontSize: 52 })}</text>`);
  let totalH = h1 + 15;
  if (subtitle) {
    const subY = y + h1 + 10;
    const h2 = textHeight(subtitle, 38);
    parts.push(`<text x="${PAD}" y="${subY}" font-family="sans-serif" font-size="38" font-weight="600" fill="${C.green}">${tspans(subtitle, { fontSize: 38 })}</text>`);
    totalH += h2 + 10;
  }
  return { svg: parts.join('\n'), height: totalH };
}

function renderLabel(label, y) {
  return {
    svg: `<text x="${PAD}" y="${y}" font-family="sans-serif" font-size="18" font-weight="700" fill="${C.green}"><tspan>${esc(label.toUpperCase())}</tspan></text>`,
    height: 30,
  };
}

function renderBody(text, y) {
  const h = textHeight(text, 32);
  return {
    svg: `<text x="${PAD}" y="${y}" font-family="sans-serif" font-size="32" font-weight="400" fill="#FFFFFFCC">${tspans(text, { fontSize: 32 })}</text>`,
    height: h + 15,
  };
}

function renderHighlight(text, y) {
  const h = textHeight(text, 28) + 30;
  return {
    svg: `<rect x="${PAD - 10}" y="${y - 10}" width="${W - PAD * 2 + 20}" height="${h}" rx="16" fill="${C.green}" opacity="0.12"/>
<rect x="${PAD - 10}" y="${y - 10}" width="4" height="${h}" fill="${C.green}" rx="2"/>
<text x="${PAD + 10}" y="${y + 18}" font-family="sans-serif" font-size="28" font-weight="500" fill="#FFFFFFEE">${tspans(text, { x: PAD + 10, fontSize: 28 })}</text>`,
    height: h + 20,
  };
}

function renderStat(text, y) {
  const h = textHeight(text, 36);
  return {
    svg: `<rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="2" fill="${C.green}" opacity="0.3"/>
<text x="${PAD}" y="${y + 35}" font-family="sans-serif" font-size="36" font-weight="700" fill="${C.green}">${tspans(text, { fontSize: 36 })}</text>`,
    height: h + 45,
  };
}

function renderCTA() {
  const y = H - 140;
  return `<rect x="0" y="${y}" width="${W}" height="140" fill="${C.green}" opacity="0.08"/>
<text x="${W / 2}" y="${y + 50}" font-family="sans-serif" font-size="30" font-weight="700" fill="${C.green}" text-anchor="middle"><tspan>Take the free quiz - link in bio</tspan></text>
<text x="${W / 2}" y="${y + 100}" font-family="sans-serif" font-size="20" font-weight="400" fill="#FFFFFF50" text-anchor="middle"><tspan>${esc(BRAND.handle)} - ${esc(BRAND.url)}</tspan></text>`;
}

function renderHeader() {
  return `<rect x="${PAD}" y="40" width="120" height="4" fill="${C.green}" rx="2"/>
<text x="${W - PAD}" y="52" font-family="sans-serif" font-size="22" font-weight="500" fill="#FFFFFF40" text-anchor="end"><tspan>${esc(BRAND.handle)}</tspan></text>`;
}

// ── Content Builders ────────────────────────────────────────────

function buildSections(post) {
  const sections = [];

  if (post.terpeneKey && TERPENES[post.terpeneKey]) {
    const t = TERPENES[post.terpeneKey];
    sections.push({ type: 'title', text: 'Know Your Terpene', subtitle: t.name });
    sections.push({ type: 'label', text: 'FOUND IN' });
    sections.push({ type: 'body', text: t.alsoFoundIn });
    sections.push({ type: 'label', text: 'AROMA' });
    sections.push({ type: 'body', text: t.aroma });
    sections.push({ type: 'label', text: 'EFFECTS' });
    sections.push({ type: 'body', text: t.effects.join(' - ') });
    sections.push({ type: 'label', text: 'RECEPTORS' });
    sections.push({ type: 'body', text: t.receptors.join(' - ') });
    sections.push({ type: 'highlight', text: t.scienceFact });
    sections.push({ type: 'stat', text: `Found in ${t.prevalence} of strains` });
  } else if (post.strainIndex !== undefined && FEATURED_STRAINS[post.strainIndex]) {
    const s = FEATURED_STRAINS[post.strainIndex];
    sections.push({ type: 'title', text: s.name, subtitle: `${s.type} - ${s.thc} THC` });
    sections.push({ type: 'label', text: 'DOMINANT TERPENES' });
    sections.push({ type: 'body', text: s.dominantTerps.map((t) => TERPENES[t]?.name || t).join(' - ') });
    sections.push({ type: 'label', text: 'EFFECTS' });
    sections.push({ type: 'body', text: s.effects.join(' - ') });
    sections.push({ type: 'highlight', text: s.scienceHook });
  } else if (post.mythIndex !== undefined && MYTHS[post.mythIndex]) {
    const m = MYTHS[post.mythIndex];
    sections.push({ type: 'title', text: 'MYTH', subtitle: m.myth });
    sections.push({ type: 'highlight', text: `TRUTH: ${m.truth}` });
    sections.push({ type: 'label', text: 'EVIDENCE' });
    sections.push({ type: 'body', text: m.evidence });
  } else if (post.dataIndex !== undefined && DATA_POSTS[post.dataIndex]) {
    const d = DATA_POSTS[post.dataIndex];
    sections.push({ type: 'title', text: d.hook });
    sections.push({ type: 'stat', text: d.stat });
    sections.push({ type: 'highlight', text: d.insight });
  } else {
    // Generic post with just title
    sections.push({ type: 'title', text: post.title });
    if (post.caption) {
      const snippet = post.caption.replace(/\n/g, ' ').slice(0, 200);
      sections.push({ type: 'body', text: snippet });
    }
  }

  return sections;
}

// ── Main Image Generator ────────────────────────────────────────

async function generatePostImage(post, index) {
  const sections = buildSections(post);

  const svgParts = [];

  // Background
  svgParts.push(`<rect width="${W}" height="${H}" fill="#0A0F0C"/>`);

  // Subtle gradient overlay
  svgParts.push(`<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0D1710" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#0A0A1A" stop-opacity="0.3"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>`);

  // Header
  svgParts.push(renderHeader());

  // Render sections
  let y = 100;
  for (const section of sections) {
    if (y > H - 200) break;

    let result;
    switch (section.type) {
      case 'title':
        result = renderTitle(section.text, section.subtitle, y);
        break;
      case 'label':
        result = renderLabel(section.text, y);
        break;
      case 'body':
        result = renderBody(section.text, y);
        break;
      case 'highlight':
        result = renderHighlight(section.text, y);
        break;
      case 'stat':
        result = renderStat(section.text, y);
        break;
      default:
        continue;
    }
    svgParts.push(result.svg);
    y += result.height;
  }

  // CTA footer
  svgParts.push(renderCTA());

  // Compose full SVG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
${svgParts.join('\n')}
</svg>`;

  // Generate filename
  const safeName = post.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 40);
  const filename = `day${post.day}-${post.slot}-${safeName}.png`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  return outputPath;
}

// ── Screenshot-based Post ───────────────────────────────────────

async function generateScreenshotPost(post, index) {
  const screenshotName = (post.screenshotPages?.[0] || '/').replace(/^\//, '') || 'landing';
  const date = new Date().toISOString().slice(0, 10);
  const screenshotPath = path.join(SCREENSHOT_DIR, `${screenshotName}-mobile-${date}.png`);

  if (fs.existsSync(screenshotPath)) {
    const screenshotW = W - PAD * 2;
    const screenshotH = H - 300;

    const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#0A0F0C"/>
  ${renderHeader()}
  <text x="${PAD}" y="100" font-family="sans-serif" font-size="44" font-weight="800" fill="${C.green}"><tspan>${esc(post.title)}</tspan></text>
  ${renderCTA()}
</svg>`;

    const overlay = await sharp(Buffer.from(overlaySvg)).png().toBuffer();
    const screenshot = await sharp(screenshotPath)
      .resize(screenshotW, screenshotH, { fit: 'cover', position: 'top' })
      .png()
      .toBuffer();

    const safeName = post.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 40);
    const filename = `day${post.day}-${post.slot}-${safeName}.png`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    await sharp(overlay)
      .composite([{ input: screenshot, top: 150, left: PAD }])
      .png()
      .toFile(outputPath);

    return outputPath;
  }

  // No screenshot — fall back to branded graphic
  return generatePostImage(post, index);
}

// ── Main ────────────────────────────────────────────────────────
async function generatePosts(options = {}) {
  const { days, all = false } = options;

  ensureDir(OUTPUT_DIR);

  let postsToGenerate = CONTENT_CALENDAR;
  if (days && !all) {
    const dayList = Array.isArray(days) ? days : [days];
    postsToGenerate = CONTENT_CALENDAR.filter((p) => dayList.includes(p.day));
  }

  console.log(`\n🎨 Generating ${postsToGenerate.length} posts...\n`);

  const results = [];

  for (const post of postsToGenerate) {
    const idx = CONTENT_CALENDAR.indexOf(post);
    process.stdout.write(`  Day ${post.day} ${post.slot}: ${post.title}... `);

    try {
      let outputPath;
      if (post.generationType === 'screenshot') {
        outputPath = await generateScreenshotPost(post, idx);
      } else {
        outputPath = await generatePostImage(post, idx);
      }

      const size = (fs.statSync(outputPath).size / 1024).toFixed(0);
      console.log(`OK (${size} KB)`);
      results.push({
        day: post.day,
        slot: post.slot,
        title: post.title,
        image: outputPath,
        caption: post.caption,
        pillar: post.pillar,
        hashtagSet: post.hashtagSet,
      });
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
    }
  }

  // Write manifest
  const manifest = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify(results, null, 2));
  console.log(`\n📋 Manifest: ${manifest}`);
  console.log(`✅ ${results.length}/${postsToGenerate.length} posts generated\n`);

  return results;
}

// ── CLI ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dayArg = args.find((a) => a.startsWith('--day='));
const allFlag = args.includes('--all');

const opts = { all: allFlag || !dayArg };
if (dayArg) {
  opts.days = parseInt(dayArg.split('=')[1], 10);
  opts.all = false;
}

generatePosts(opts).catch(console.error);

export { generatePosts, generatePostImage, generateScreenshotPost };
