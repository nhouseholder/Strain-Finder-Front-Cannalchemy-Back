/**
 * MyStrainAI — Unified Cross-Platform Poster
 *
 * Posts to Instagram, Facebook, and Reddit in one call.
 * Used by GitHub Actions scheduled workflow.
 *
 * Usage:
 *   node scripts/post-all.js --slot=AM                    # Post to all platforms
 *   node scripts/post-all.js --slot=AM --day=1            # Specific day
 *   node scripts/post-all.js --slot=AM --platform=instagram  # One platform only
 *   node scripts/post-all.js --slot=AM --dry-run          # Preview only
 */

import 'dotenv/config';
import { postToInstagram } from './post-to-instagram.js';
import { postToFacebook } from './post-facebook.js';
import { postToReddit } from './post-reddit.js';
import { CONTENT_CALENDAR, getNextPost } from '../data/content-library.js';

// ── Parse CLI args ──────────────────────────────────────────────
const args = process.argv.slice(2);
const dayArg = args.find((a) => a.startsWith('--day='));
const slotArg = args.find((a) => a.startsWith('--slot='));
const platformArg = args.find((a) => a.startsWith('--platform='));
const dryRun = args.includes('--dry-run');

const day = dayArg ? parseInt(dayArg.split('=')[1], 10) : null;
const slot = slotArg ? slotArg.split('=')[1] : null;
const platformFilter = platformArg ? platformArg.split('=')[1] : 'all';

// ── Determine what to post ──────────────────────────────────────
function resolvePost() {
  if (day && slot) {
    const post = CONTENT_CALENDAR.find((p) => p.day === day && p.slot === slot);
    if (!post) {
      // If specific day requested, try just the day with auto slot
      const dayPosts = CONTENT_CALENDAR.filter((p) => p.day === day);
      if (dayPosts.length > 0) {
        const currentHour = new Date().getHours();
        const preferSlot = currentHour < 15 ? 'AM' : 'PM';
        return dayPosts.find((p) => p.slot === preferSlot) || dayPosts[0];
      }
      console.error(`❌ No post found for Day ${day} ${slot}`);
      process.exit(1);
    }
    return post;
  }

  if (day) {
    const currentHour = new Date().getHours();
    const preferSlot = slot || (currentHour < 15 ? 'AM' : 'PM');
    const post = CONTENT_CALENDAR.find((p) => p.day === day && p.slot === preferSlot);
    return post || CONTENT_CALENDAR.find((p) => p.day === day);
  }

  return getNextPost();
}

// ── Platform checks ─────────────────────────────────────────────
function hasInstagramConfig() {
  return process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
}

function hasFacebookConfig() {
  return process.env.FACEBOOK_PAGE_ID && (process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN);
}

function hasRedditConfig() {
  return process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET &&
    process.env.REDDIT_USERNAME && process.env.REDDIT_PASSWORD;
}

// ── Main ────────────────────────────────────────────────────────
async function postToAll() {
  const post = resolvePost();
  const postSlot = slot || post.slot;

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        MyStrainAI — Cross-Platform Social Poster        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n📅 Day ${post.day} | ${postSlot} | ${post.pillar.toUpperCase()}`);
  console.log(`📝 ${post.title}`);
  if (dryRun) console.log('🏃 DRY RUN MODE — nothing will be posted\n');
  else console.log('');

  const results = {};
  const opts = { day: post.day, slot: postSlot, dryRun };

  // ── Instagram ──
  if ((platformFilter === 'all' || platformFilter === 'instagram') && hasInstagramConfig()) {
    console.log('─── Instagram ───────────────────────────────────────────');
    try {
      results.instagram = await postToInstagram(opts);
      console.log('');
    } catch (err) {
      console.error(`   ❌ Instagram failed: ${err.message}\n`);
      results.instagram = { error: err.message };
    }
  } else if (platformFilter === 'all' || platformFilter === 'instagram') {
    console.log('─── Instagram ───────────────────────────────────────────');
    console.log('   ⏭️  Skipped — INSTAGRAM_ACCESS_TOKEN not configured\n');
  }

  // ── Facebook ──
  if ((platformFilter === 'all' || platformFilter === 'facebook') && hasFacebookConfig()) {
    console.log('─── Facebook ────────────────────────────────────────────');
    try {
      results.facebook = await postToFacebook(opts);
      console.log('');
    } catch (err) {
      console.error(`   ❌ Facebook failed: ${err.message}\n`);
      results.facebook = { error: err.message };
    }
  } else if (platformFilter === 'all' || platformFilter === 'facebook') {
    console.log('─── Facebook ────────────────────────────────────────────');
    console.log('   ⏭️  Skipped — FACEBOOK_PAGE_ID not configured\n');
  }

  // ── Reddit ──
  if ((platformFilter === 'all' || platformFilter === 'reddit') && hasRedditConfig()) {
    console.log('─── Reddit ──────────────────────────────────────────────');
    try {
      results.reddit = await postToReddit(opts);
      console.log('');
    } catch (err) {
      console.error(`   ❌ Reddit failed: ${err.message}\n`);
      results.reddit = { error: err.message };
    }
  } else if (platformFilter === 'all' || platformFilter === 'reddit') {
    console.log('─── Reddit ──────────────────────────────────────────────');
    console.log('   ⏭️  Skipped — REDDIT_CLIENT_ID not configured\n');
  }

  // ── Summary ──
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Summary:');
  for (const [platform, result] of Object.entries(results)) {
    if (result?.error) {
      console.log(`   ❌ ${platform}: FAILED — ${result.error}`);
    } else if (result?.dryRun) {
      console.log(`   🏃 ${platform}: dry run (preview only)`);
    } else if (result?.skipped) {
      console.log(`   ⏭️  ${platform}: skipped (PM slot)`);
    } else {
      console.log(`   ✅ ${platform}: posted`);
    }
  }
  console.log('═══════════════════════════════════════════════════════════');

  return results;
}

postToAll().catch((err) => {
  console.error(`\n💥 Fatal error: ${err.message}`);
  process.exit(1);
});
