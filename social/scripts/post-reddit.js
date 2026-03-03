/**
 * MyStrainAI — Reddit Auto-Poster
 *
 * Posts educational cannabis content to relevant subreddits using
 * the official Reddit API (OAuth2 "script" app type).
 *
 * Usage:
 *   node scripts/post-reddit.js --test
 *   node scripts/post-reddit.js --day=1 --slot=AM
 *   node scripts/post-reddit.js --dry-run --day=1 --slot=AM
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  BRAND,
  CONTENT_CALENDAR,
  getNextPost,
  getRotatedHashtags,
} from '../data/content-library.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

const {
  REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET,
  REDDIT_USERNAME,
  REDDIT_PASSWORD,
  APP_URL = 'https://mystrainai.com',
  IMGBB_API_KEY,
  IMAGE_HOST_BASE_URL,
} = process.env;

const USER_AGENT = `nodejs:mystrainai-social:v1.0.0 (by /u/${REDDIT_USERNAME || 'mystrainai'})`;

// ── Subreddit Strategy ──────────────────────────────────────────
// Map content pillars to subreddits that welcome that type of content.
// IMPORTANT: Always follow each subreddit's rules. Educational/science
// content is generally welcome; blatant ads get banned instantly.
const SUBREDDIT_MAP = {
  terpene: [
    { sub: 'cannabisscience', flair: null },
    { sub: 'terpenes', flair: null },
  ],
  strain: [
    { sub: 'trees', flair: null },
    { sub: 'cannabis', flair: null },
  ],
  myth: [
    { sub: 'cannabisscience', flair: null },
    { sub: 'trees', flair: null },
  ],
  data: [
    { sub: 'cannabisscience', flair: null },
    { sub: 'dataisbeautiful', flair: null },
  ],
  app: [
    { sub: 'trees', flair: null },
  ],
  community: [
    { sub: 'trees', flair: null },
    { sub: 'cannabis', flair: null },
  ],
};

// Only post to ONE subreddit per post (avoid spam flags)
function getSubredditForPost(post) {
  const subs = SUBREDDIT_MAP[post.pillar] || SUBREDDIT_MAP.community;
  // Rotate based on day number
  return subs[post.day % subs.length];
}

// ── Reddit OAuth2 ───────────────────────────────────────────────
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: REDDIT_USERNAME,
      password: REDDIT_PASSWORD,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Reddit OAuth error: ${data.error} — ${data.message || ''}`);
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// ── Reddit API Calls ────────────────────────────────────────────

async function redditApi(endpoint, options = {}) {
  const token = await getAccessToken();
  const url = endpoint.startsWith('http') ? endpoint : `https://oauth.reddit.com${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...options.headers,
    },
  });

  return response.json();
}

/**
 * Submit a text post (self post) to a subreddit
 */
async function submitTextPost(subreddit, title, body) {
  return redditApi('/api/submit', {
    method: 'POST',
    body: new URLSearchParams({
      sr: subreddit,
      kind: 'self',
      title: title,
      text: body,
      resubmit: 'true',
      send_replies: 'true',
    }),
  });
}

/**
 * Submit a link post to a subreddit
 */
async function submitLinkPost(subreddit, title, url) {
  return redditApi('/api/submit', {
    method: 'POST',
    body: new URLSearchParams({
      sr: subreddit,
      kind: 'link',
      title: title,
      url: url,
      resubmit: 'true',
      send_replies: 'true',
    }),
  });
}

/**
 * Submit an image post to a subreddit
 */
async function submitImagePost(subreddit, title, imageUrl) {
  // Reddit doesn't accept image URLs directly in API — image posts require
  // special upload flow. For simplicity, we post as a link to the image
  // or as a text post with the image embedded in markdown.
  return submitLinkPost(subreddit, title, imageUrl);
}

/**
 * Test Reddit API connection
 */
async function testConnection() {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
    console.error('❌ Missing Reddit environment variables:');
    if (!REDDIT_CLIENT_ID) console.error('   REDDIT_CLIENT_ID');
    if (!REDDIT_CLIENT_SECRET) console.error('   REDDIT_CLIENT_SECRET');
    if (!REDDIT_USERNAME) console.error('   REDDIT_USERNAME');
    if (!REDDIT_PASSWORD) console.error('   REDDIT_PASSWORD');
    return false;
  }

  try {
    const data = await redditApi('/api/v1/me');

    if (data.error) {
      console.error(`❌ Reddit API Error: ${data.error}`);
      return false;
    }

    console.log('✅ Reddit API connection successful!');
    console.log(`   Username: /u/${data.name}`);
    console.log(`   Karma: ${data.link_karma} link / ${data.comment_karma} comment`);
    console.log(`   Account age: ${Math.floor((Date.now() / 1000 - data.created_utc) / 86400)} days`);
    return true;
  } catch (err) {
    console.error(`❌ Reddit connection failed: ${err.message}`);
    return false;
  }
}

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
  }
  return null;
}

// ── Reddit Caption Formatter ────────────────────────────────────
// Reddit uses markdown and prefers longer, educational content.
// Remove Instagram-style CTAs and emojis; add value-first framing.
function formatForReddit(post) {
  let body = post.caption
    // Remove Instagram CTAs
    .replace(/.*link in bio.*/gi, '')
    .replace(/.*→.*/g, '')
    .replace(/Swipe.*👉/g, '')
    .replace(/Drop your.*below.*👇/g, '')
    .replace(/Tag them below.*/g, '')
    // Remove excessive emojis but keep a few
    .replace(/[🎯🔬🧬💚📊🎉🧘😴😊⚡🎨🧠🌶️🥭🍋💜🌲🍎🍺🌿]/g, '')
    // Clean up empty lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Add a subtle, non-spammy mention
  body += `\n\n---\n*Data from [MyStrainAI](${APP_URL}) — a free molecular strain matching tool analyzing ${BRAND.stats.strains} strains across ${BRAND.stats.bindings} receptor bindings.*`;

  return body;
}

function formatTitleForReddit(post) {
  // Reddit titles should be informational, not clickbaity
  const pillarPrefix = {
    terpene: '[Science]',
    strain: '[Strain Review]',
    myth: '[Mythbusting]',
    data: '[Data]',
    app: '[Tool]',
    community: '[Discussion]',
  };
  return `${pillarPrefix[post.pillar] || ''} ${post.title}`.trim();
}

// ── Main Post Flow ──────────────────────────────────────────────
async function postToReddit(options = {}) {
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

  // Only post to Reddit once per day (AM slot only) to avoid spam
  if (slot === 'PM' || post.slot === 'PM') {
    console.log('   ⏭️  Reddit: Skipping PM slot (1 post/day to avoid spam flags)');
    return { post, platform: 'reddit', skipped: true };
  }

  const target = getSubredditForPost(post);
  const title = formatTitleForReddit(post);
  const body = formatForReddit(post);

  console.log(`\n🟠 Reddit Post: Day ${post.day} ${post.slot}`);
  console.log(`   Subreddit: r/${target.sub}`);
  console.log(`   Title: ${title}`);
  console.log(`   Body preview: "${body.slice(0, 150)}..."`);

  if (dryRun) {
    console.log('\n   🏃 DRY RUN — not posting.');
    console.log('─'.repeat(60));
    console.log(`r/${target.sub}\n`);
    console.log(`Title: ${title}\n`);
    console.log(body);
    console.log('─'.repeat(60));
    return { post, platform: 'reddit', dryRun: true };
  }

  // Try to post with image, fall back to text post
  const manifest = path.join(OUTPUT_DIR, 'manifest.json');
  let imageUrl = null;

  if (fs.existsSync(manifest)) {
    const posts = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    const match = posts.find((p) => p.day === post.day && p.slot === post.slot);
    if (match?.image && fs.existsSync(match.image)) {
      imageUrl = await getPublicImageUrl(match.image);
    }
  }

  let result;
  if (imageUrl) {
    console.log('   🚀 Submitting image post to Reddit...');
    result = await submitLinkPost(target.sub, title, imageUrl);
  } else {
    console.log('   🚀 Submitting text post to Reddit...');
    result = await submitTextPost(target.sub, title, body);
  }

  if (result.json?.errors?.length > 0) {
    const errors = result.json.errors.map((e) => e.join(': ')).join(', ');
    console.error(`   ❌ Reddit post failed: ${errors}`);
    return { post, platform: 'reddit', error: errors };
  }

  const postUrl = result.json?.data?.url || 'unknown';
  console.log(`   ✅ Reddit post published! ${postUrl}`);
  return { post, platform: 'reddit', url: postUrl };
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

  postToReddit(opts).catch(console.error);
}

export { postToReddit, testConnection as testRedditConnection };
