/**
 * MyStrainAI — Instagram Graph API Poster
 *
 * Posts images to Instagram using the official Meta Graph API.
 * Requires:  Instagram Business/Creator account + Facebook Page + Meta App
 *
 * See SETUP.md for configuration instructions.
 *
 * Usage:
 *   node scripts/post-to-instagram.js              # Post next scheduled post
 *   node scripts/post-to-instagram.js --day=1 --slot=AM   # Post specific day/slot
 *   node scripts/post-to-instagram.js --dry-run     # Preview without posting
 *   node scripts/post-to-instagram.js --test        # Test API connectivity
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HASHTAG_SETS, CONTENT_CALENDAR, getNextPost, getRotatedHashtags } from '../data/content-library.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');
const STATE_FILE = path.resolve(__dirname, '..', '.post-state.json');

// ── Environment ─────────────────────────────────────────────────
const {
  INSTAGRAM_ACCESS_TOKEN,
  INSTAGRAM_BUSINESS_ACCOUNT_ID,
  APP_URL = 'https://mystrainai.com',
} = process.env;

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ── State Management ────────────────────────────────────────────
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return { lastPostDay: 0, lastPostSlot: null, postsPublished: 0, history: [] };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Instagram Graph API ─────────────────────────────────────────

/**
 * Step 1: Create a media container (upload image URL to Instagram)
 * Note: Instagram Graph API requires the image to be accessible via a public URL.
 * We'll need to either host images or use a temporary hosting service.
 */
async function createMediaContainer(imageUrl, caption) {
  const url = `${GRAPH_API_BASE}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption: caption,
      access_token: INSTAGRAM_ACCESS_TOKEN,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Media container error: ${data.error.message}`);
  }

  console.log(`   📦 Media container created: ${data.id}`);
  return data.id;
}

/**
 * Step 2: Publish the media container
 */
async function publishMedia(containerId) {
  const url = `${GRAPH_API_BASE}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: INSTAGRAM_ACCESS_TOKEN,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Publish error: ${data.error.message}`);
  }

  console.log(`   ✅ Published! Post ID: ${data.id}`);
  return data.id;
}

/**
 * Create a carousel post (multiple images)
 */
async function createCarouselPost(imageUrls, caption) {
  // Step 1: Create individual media containers for each image
  const childContainers = [];
  for (const imageUrl of imageUrls) {
    const url = `${GRAPH_API_BASE}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        is_carousel_item: true,
        access_token: INSTAGRAM_ACCESS_TOKEN,
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(`Carousel item error: ${data.error.message}`);
    childContainers.push(data.id);
  }

  // Step 2: Create carousel container
  const carouselUrl = `${GRAPH_API_BASE}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`;
  const carouselResponse = await fetch(carouselUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childContainers,
      caption: caption,
      access_token: INSTAGRAM_ACCESS_TOKEN,
    }),
  });
  const carouselData = await carouselResponse.json();
  if (carouselData.error) throw new Error(`Carousel error: ${carouselData.error.message}`);

  // Step 3: Publish
  return publishMedia(carouselData.id);
}

/**
 * Test API connectivity and token validity
 */
async function testConnection() {
  if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    console.error('❌ Missing environment variables:');
    if (!INSTAGRAM_ACCESS_TOKEN) console.error('   INSTAGRAM_ACCESS_TOKEN');
    if (!INSTAGRAM_BUSINESS_ACCOUNT_ID) console.error('   INSTAGRAM_BUSINESS_ACCOUNT_ID');
    console.error('\n   See SETUP.md for configuration instructions.');
    return false;
  }

  try {
    // Check account info
    const url = `${GRAPH_API_BASE}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}?fields=id,username,name,followers_count,media_count&access_token=${INSTAGRAM_ACCESS_TOKEN}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error(`❌ API Error: ${data.error.message}`);
      return false;
    }

    console.log('✅ Instagram Graph API connection successful!');
    console.log(`   Account: @${data.username || data.name}`);
    console.log(`   Followers: ${data.followers_count || 'N/A'}`);
    console.log(`   Posts: ${data.media_count || 'N/A'}`);
    console.log(`   ID: ${data.id}`);
    return true;
  } catch (err) {
    console.error(`❌ Connection failed: ${err.message}`);
    return false;
  }
}

/**
 * Check token expiration and provide refresh instructions
 */
async function checkTokenExpiry() {
  try {
    const url = `${GRAPH_API_BASE}/debug_token?input_token=${INSTAGRAM_ACCESS_TOKEN}&access_token=${INSTAGRAM_ACCESS_TOKEN}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.data?.expires_at) {
      const expiresAt = new Date(data.data.expires_at * 1000);
      const daysUntilExpiry = Math.floor((expiresAt - new Date()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 7) {
        console.warn(`⚠️  Token expires in ${daysUntilExpiry} days (${expiresAt.toISOString().slice(0, 10)})`);
        console.warn('   Run: node scripts/refresh-token.js');
      } else {
        console.log(`   Token valid for ${daysUntilExpiry} days`);
      }
    }
  } catch {
    // Non-critical
  }
}

// ── Image Hosting ───────────────────────────────────────────────
/**
 * The Instagram Graph API requires images to be hosted on a public URL.
 * Options:
 *   1. Host on your own domain (recommended for automation)
 *   2. Upload to Cloudflare R2
 *   3. Use imgbb or similar free hosting
 *
 * For now, this function uploads to a temporary hosting service.
 * Replace with your preferred hosting method.
 */
async function uploadImageForInstagram(localPath) {
  // Option 1: If you set up a Cloudflare R2 bucket or serve from your domain
  if (process.env.IMAGE_HOST_BASE_URL) {
    // Copy file to your hosting location and return URL
    const filename = path.basename(localPath);
    return `${process.env.IMAGE_HOST_BASE_URL}/${filename}`;
  }

  // Option 2: Upload to imgbb (free API, 32 MB limit)
  if (process.env.IMGBB_API_KEY) {
    const imageData = fs.readFileSync(localPath, { encoding: 'base64' });
    const form = new URLSearchParams();
    form.append('key', process.env.IMGBB_API_KEY);
    form.append('image', imageData);

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: form,
    });
    const data = await response.json();
    if (data.success) {
      return data.data.url;
    }
    throw new Error(`imgbb upload failed: ${JSON.stringify(data)}`);
  }

  // Fallback: return local path (won't work with IG API but useful for dry-run)
  console.warn('   ⚠️  No image hosting configured. Set IMAGE_HOST_BASE_URL or IMGBB_API_KEY in .env');
  return `file://${localPath}`;
}

// ── Main Post Flow ──────────────────────────────────────────────
async function postToInstagram(options = {}) {
  const { day, slot, dryRun = false } = options;

  // Load state
  const state = loadState();

  // Get post content
  let post;
  if (day && slot) {
    post = CONTENT_CALENDAR.find((p) => p.day === day && p.slot === slot);
    if (!post) {
      console.error(`❌ No post found for Day ${day} ${slot}`);
      return;
    }
  } else {
    post = getNextPost();
  }

  console.log(`\n📱 Instagram Post: Day ${post.day} ${post.slot}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Pillar: ${post.pillar}`);
  console.log(`   Type: ${post.contentType}`);

  // Build full caption with hashtags
  const hashtags = getRotatedHashtags(post.hashtagSet);
  const fullCaption = `${post.caption}\n\n·\n·\n·\n\n${hashtags}`;

  console.log(`\n   Caption preview (first 200 chars):`);
  console.log(`   "${fullCaption.slice(0, 200)}..."`);
  console.log(`\n   Hashtag set: ${post.hashtagSet}`);

  if (dryRun) {
    console.log('\n   🏃 DRY RUN — not posting. Full caption:');
    console.log('─'.repeat(60));
    console.log(fullCaption);
    console.log('─'.repeat(60));
    return { post, caption: fullCaption, dryRun: true };
  }

  // Check for generated image
  const manifest = path.join(OUTPUT_DIR, 'manifest.json');
  let imageFile;

  if (fs.existsSync(manifest)) {
    const posts = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    const match = posts.find((p) => p.day === post.day && p.slot === post.slot);
    if (match) imageFile = match.image;
  }

  if (!imageFile || !fs.existsSync(imageFile)) {
    console.error('   ❌ No generated image found. Run: npm run generate');
    return;
  }

  // Upload image to hosting
  console.log('   📤 Uploading image...');
  const imageUrl = await uploadImageForInstagram(imageFile);

  // Create and publish
  console.log('   📦 Creating media container...');
  const containerId = await createMediaContainer(imageUrl, fullCaption);

  // Wait for processing (Instagram needs ~10 seconds)
  console.log('   ⏳ Waiting for Instagram processing...');
  await new Promise((r) => setTimeout(r, 10000));

  console.log('   🚀 Publishing...');
  const postId = await publishMedia(containerId);

  // Update state
  state.lastPostDay = post.day;
  state.lastPostSlot = post.slot;
  state.postsPublished++;
  state.history.push({
    day: post.day,
    slot: post.slot,
    title: post.title,
    postId,
    timestamp: new Date().toISOString(),
  });
  saveState(state);

  console.log(`\n   ✅ Post published successfully!`);
  console.log(`   Post ID: ${postId}`);
  console.log(`   Total posts published: ${state.postsPublished}`);

  return { post, postId, caption: fullCaption };
}

// ── CLI ─────────────────────────────────────────────────────────
// Only run CLI when this file is the entry point (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    testConnection().then(() => checkTokenExpiry());
  } else {
    const dayArg = args.find((a) => a.startsWith('--day='));
    const slotArg = args.find((a) => a.startsWith('--slot='));
    const dryRun = args.includes('--dry-run');

    const opts = { dryRun };
    if (dayArg) opts.day = parseInt(dayArg.split('=')[1], 10);
    if (slotArg) opts.slot = slotArg.split('=')[1];

    postToInstagram(opts).catch(console.error);
  }
}

export { postToInstagram, testConnection, createMediaContainer, publishMedia };
