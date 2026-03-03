/**
 * MyStrainAI — Automated Instagram Posting Scheduler
 *
 * Runs as a persistent process with cron jobs that:
 *   1. Generate the next post image at midnight
 *   2. Post to Instagram at 11:00 AM ET (morning slot)
 *   3. Post to Instagram at 7:00 PM ET (evening slot)
 *
 * Usage:
 *   node scripts/scheduler.js           # Start the scheduler
 *   node scripts/scheduler.js --status  # Check scheduler status
 *
 * Keep alive with:
 *   pm2 start scripts/scheduler.js --name "ig-scheduler"
 *   # or
 *   nohup node scripts/scheduler.js &
 *   # or add as a launchd/systemd service
 */

import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CONTENT_CALENDAR, getNextPost, BRAND } from '../data/content-library.js';
import { postToInstagram } from './post-to-instagram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.resolve(__dirname, '..', 'scheduler.log');

// ── Configuration ───────────────────────────────────────────────
const TIMEZONE = process.env.TIMEZONE || 'America/New_York';

// Morning post: 11:00 AM ET
const MORNING_CRON = process.env.POST_1_CRON || '0 11 * * *';
// Evening post: 7:00 PM ET
const EVENING_CRON = process.env.POST_2_CRON || '0 19 * * *';
// Content generation: midnight ET
const GENERATE_CRON = '0 0 * * *';

// ── Logging ─────────────────────────────────────────────────────
function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Tasks ───────────────────────────────────────────────────────

async function morningPost() {
  log('🌅 Morning post triggered');
  try {
    const result = await postToInstagram({ slot: 'AM' });
    if (result?.postId) {
      log(`✅ Morning post published: ${result.post.title} (ID: ${result.postId})`);
    } else {
      log('⚠️  Morning post: no post ID returned');
    }
  } catch (err) {
    log(`❌ Morning post failed: ${err.message}`);
  }
}

async function eveningPost() {
  log('🌆 Evening post triggered');
  try {
    const result = await postToInstagram({ slot: 'PM' });
    if (result?.postId) {
      log(`✅ Evening post published: ${result.post.title} (ID: ${result.postId})`);
    } else {
      log('⚠️  Evening post: no post ID returned');
    }
  } catch (err) {
    log(`❌ Evening post failed: ${err.message}`);
  }
}

async function generateDailyContent() {
  log('🎨 Daily content generation triggered');
  try {
    // Dynamically import to avoid circular dependencies
    const { generatePosts } = await import('./generate-posts.js');
    const nextPost = getNextPost();
    await generatePosts({ days: nextPost.day });
    log(`✅ Content generated for Day ${nextPost.day}`);
  } catch (err) {
    log(`❌ Content generation failed: ${err.message}`);
  }
}

// ── Status Check ────────────────────────────────────────────────
function showStatus() {
  const stateFile = path.resolve(__dirname, '..', '.post-state.json');
  const state = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    : { postsPublished: 0, history: [] };

  console.log('\n📊 MyStrainAI Instagram Scheduler Status');
  console.log('─'.repeat(50));
  console.log(`   Total posts published: ${state.postsPublished}`);
  console.log(`   Last post: Day ${state.lastPostDay || '-'} ${state.lastPostSlot || '-'}`);
  console.log(`   Timezone: ${TIMEZONE}`);
  console.log(`   Morning schedule: ${MORNING_CRON}`);
  console.log(`   Evening schedule: ${EVENING_CRON}`);
  console.log(`   Content generation: ${GENERATE_CRON}`);

  if (state.history?.length > 0) {
    console.log('\n   Recent posts:');
    state.history.slice(-5).forEach((h) => {
      console.log(`   · ${h.timestamp.slice(0, 16)} — Day ${h.day} ${h.slot}: ${h.title}`);
    });
  }

  // Next scheduled post
  const nextPost = getNextPost();
  console.log(`\n   Next up: Day ${nextPost.day} ${nextPost.slot}: ${nextPost.title}`);
  console.log(`   Calendar entries: ${CONTENT_CALENDAR.length} posts (${CONTENT_CALENDAR.length / 2} days)`);
  console.log('─'.repeat(50));
}

// ── Main ────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--status')) {
  showStatus();
  process.exit(0);
}

log('🚀 MyStrainAI Instagram Scheduler starting...');
log(`   Timezone: ${TIMEZONE}`);
log(`   Morning post: ${MORNING_CRON}`);
log(`   Evening post: ${EVENING_CRON}`);
log(`   Content gen: ${GENERATE_CRON}`);

// Validate cron expressions
if (!cron.validate(MORNING_CRON) || !cron.validate(EVENING_CRON)) {
  log('❌ Invalid cron expression. Check POST_1_CRON and POST_2_CRON in .env');
  process.exit(1);
}

// Schedule tasks
cron.schedule(MORNING_CRON, morningPost, { timezone: TIMEZONE });
log(`   ✅ Morning post scheduled: ${MORNING_CRON} ${TIMEZONE}`);

cron.schedule(EVENING_CRON, eveningPost, { timezone: TIMEZONE });
log(`   ✅ Evening post scheduled: ${EVENING_CRON} ${TIMEZONE}`);

cron.schedule(GENERATE_CRON, generateDailyContent, { timezone: TIMEZONE });
log(`   ✅ Content generation scheduled: ${GENERATE_CRON} ${TIMEZONE}`);

// Weekly token check (every Monday at 9 AM)
cron.schedule('0 9 * * 1', async () => {
  const { checkTokenExpiry } = await import('./post-to-instagram.js');
  log('🔑 Weekly token check...');
  await checkTokenExpiry();
}, { timezone: TIMEZONE });

log('\n📅 Scheduler is running. Press Ctrl+C to stop.');
log(`   Next morning post: ${MORNING_CRON}`);
log(`   Next evening post: ${EVENING_CRON}`);
showStatus();

// Keep alive
process.on('SIGINT', () => {
  log('🛑 Scheduler stopped by user');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  log(`💥 Uncaught exception: ${err.message}`);
  log(err.stack);
});
