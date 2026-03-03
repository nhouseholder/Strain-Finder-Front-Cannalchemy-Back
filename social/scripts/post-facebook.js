/**
 * MyStrainAI — Facebook Page Poster
 *
 * Posts images + captions to your Facebook Page using the Meta Graph API.
 * Uses the SAME token as Instagram (Page Access Token).
 *
 * Usage:
 *   node scripts/post-facebook.js --test
 *   node scripts/post-facebook.js --day=1 --slot=AM
 *   node scripts/post-facebook.js --dry-run --day=1 --slot=AM
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CONTENT_CALENDAR,
  HASHTAG_SETS,
  getNextPost,
  getRotatedHashtags,
  BRAND,
} from '../data/content-library.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

const {
  FACEBOOK_PAGE_ID,
  FACEBOOK_PAGE_ACCESS_TOKEN,
  INSTAGRAM_ACCESS_TOKEN,
  APP_URL = 'https://mystrainai.com',
  IMGBB_API_KEY,
  IMAGE_HOST_BASE_URL,
} = process.env;

// Facebook can use the same token as Instagram (it's a Page token)
const PAGE_TOKEN = FACEBOOK_PAGE_ACCESS_TOKEN || INSTAGRAM_ACCESS_TOKEN;
const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ── Image Upload ────────────────────────────────────────────────
async function getPublicImageUrl(localPath) {
  if (IMAGE_HOST_BASE_URL) {
    return `${IMAGE_HOST_BASE_URL}/${path.basename(localPath)}`;
  }

  if (IMGBB_API_KEY) {
    const imageData = fs.readFileSync(localPath, { encoding: 'base64' });
    const form = new URLSearchParams();
    form.append('key', IMGBB_API_KEY);
    form.append('image', imageData);
    const response = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
    const data = await response.json();
    if (data.success) return data.data.url;
    throw new Error(`imgbb upload failed: ${JSON.stringify(data)}`);
  }

  return null;
}

// ── Facebook Graph API ──────────────────────────────────────────

/**
 * Post a photo to a Facebook Page
 */
async function postPhotoToPage(imageUrl, caption) {
  const url = `${GRAPH_API_BASE}/${FACEBOOK_PAGE_ID}/photos`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: imageUrl,
      message: caption,
      access_token: PAGE_TOKEN,
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(`Facebook post error: ${data.error.message}`);
  return data;
}

/**
 * Post a link to a Facebook Page (no image)
 */
async function postLinkToPage(caption, link) {
  const url = `${GRAPH_API_BASE}/${FACEBOOK_PAGE_ID}/feed`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: caption,
      link: link,
      access_token: PAGE_TOKEN,
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(`Facebook post error: ${data.error.message}`);
  return data;
}

/**
 * Test the Facebook Page connection
 */
async function testConnection() {
  if (!PAGE_TOKEN || !FACEBOOK_PAGE_ID) {
    console.error('❌ Missing environment variables:');
    if (!PAGE_TOKEN) console.error('   FACEBOOK_PAGE_ACCESS_TOKEN (or INSTAGRAM_ACCESS_TOKEN)');
    if (!FACEBOOK_PAGE_ID) console.error('   FACEBOOK_PAGE_ID');
    return false;
  }

  try {
    const url = `${GRAPH_API_BASE}/${FACEBOOK_PAGE_ID}?fields=name,fan_count,link&access_token=${PAGE_TOKEN}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error(`❌ Facebook API Error: ${data.error.message}`);
      return false;
    }

    console.log('✅ Facebook Page API connection successful!');
    console.log(`   Page: ${data.name}`);
    console.log(`   Fans: ${data.fan_count || 'N/A'}`);
    console.log(`   URL: ${data.link || 'N/A'}`);
    console.log(`   ID: ${FACEBOOK_PAGE_ID}`);
    return true;
  } catch (err) {
    console.error(`❌ Facebook connection failed: ${err.message}`);
    return false;
  }
}

// ── Main Post Flow ──────────────────────────────────────────────
async function postToFacebook(options = {}) {
  const { day, slot, dryRun = false } = options;

  let post;
  if (day && slot) {
    post = CONTENT_CALENDAR.find((p) => p.day === day && p.slot === slot);
    if (!post) {
      console.error(`❌ No post found for Day ${day} ${slot}`);
      return null;
    }
  } else {
    post = getNextPost();
  }

  // Facebook captions: shorter, with link. No hashtag overload.
  const fbHashtags = getRotatedHashtags(post.hashtagSet)
    .split(' ')
    .slice(0, 5)
    .join(' ');

  const fbCaption = `${post.caption}\n\n${APP_URL}\n\n${fbHashtags}`;

  console.log(`\n📘 Facebook Post: Day ${post.day} ${post.slot}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Caption preview: "${fbCaption.slice(0, 150)}..."`);

  if (dryRun) {
    console.log('\n   🏃 DRY RUN — not posting.');
    console.log('─'.repeat(60));
    console.log(fbCaption);
    console.log('─'.repeat(60));
    return { post, caption: fbCaption, platform: 'facebook', dryRun: true };
  }

  // Find generated image
  const manifest = path.join(OUTPUT_DIR, 'manifest.json');
  let imageFile;
  if (fs.existsSync(manifest)) {
    const posts = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    const match = posts.find((p) => p.day === post.day && p.slot === post.slot);
    if (match) imageFile = match.image;
  }

  let result;
  if (imageFile && fs.existsSync(imageFile)) {
    console.log('   📤 Uploading image...');
    const imageUrl = await getPublicImageUrl(imageFile);
    if (imageUrl) {
      console.log('   🚀 Posting photo to Facebook Page...');
      result = await postPhotoToPage(imageUrl, fbCaption);
    } else {
      console.log('   ⚠️  No image hosting configured, posting as link instead');
      result = await postLinkToPage(fbCaption, APP_URL);
    }
  } else {
    console.log('   ⚠️  No image found, posting as link');
    result = await postLinkToPage(fbCaption, APP_URL);
  }

  console.log(`   ✅ Facebook post published! ID: ${result.id || result.post_id}`);
  return { post, postId: result.id || result.post_id, caption: fbCaption, platform: 'facebook' };
}

// ── CLI ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--test')) {
  testConnection();
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const dayArg = args.find((a) => a.startsWith('--day='));
  const slotArg = args.find((a) => a.startsWith('--slot='));
  const dryRun = args.includes('--dry-run');

  const opts = { dryRun };
  if (dayArg) opts.day = parseInt(dayArg.split('=')[1], 10);
  if (slotArg) opts.slot = slotArg.split('=')[1];

  postToFacebook(opts).catch(console.error);
}

export { postToFacebook, testConnection as testFacebookConnection };
