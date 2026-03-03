/**
 * MyStrainAI — Post Preview
 * Generate a quick text preview of upcoming posts without generating images.
 *
 * Usage:
 *   node scripts/preview-posts.js           # Preview next 7 days
 *   node scripts/preview-posts.js --all     # Preview all posts
 *   node scripts/preview-posts.js --day=5   # Preview specific day
 */

import { CONTENT_CALENDAR, HASHTAG_SETS, CTAS, BRAND } from '../data/content-library.js';

const args = process.argv.slice(2);
const dayArg = args.find((a) => a.startsWith('--day='));
const showAll = args.includes('--all');

let posts = CONTENT_CALENDAR;

if (dayArg) {
  const day = parseInt(dayArg.split('=')[1], 10);
  posts = posts.filter((p) => p.day === day);
} else if (!showAll) {
  posts = posts.slice(0, 14); // 7 days = 14 posts
}

console.log(`\n📅 MyStrainAI Content Calendar — ${posts.length} posts\n`);
console.log('═'.repeat(70));

let currentDay = 0;
for (const post of posts) {
  if (post.day !== currentDay) {
    currentDay = post.day;
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  DAY ${post.day}`);
    console.log(`${'─'.repeat(70)}`);
  }

  const pillarEmoji = {
    terpene: '🧬', strain: '🔬', app: '🎯', myth: '💡', community: '👥', data: '📊',
  };

  console.log(`\n  ${post.slot === 'AM' ? '🌅' : '🌆'} ${post.slot} — ${pillarEmoji[post.pillar] || '📌'} ${post.pillar.toUpperCase()}`);
  console.log(`  Title: ${post.title}`);
  console.log(`  Type: ${post.contentType} | Gen: ${post.generationType} | Tags: Set ${post.hashtagSet}`);
  console.log(`  Caption (first 150): ${post.caption.slice(0, 150).replace(/\n/g, ' ')}...`);
}

console.log(`\n${'═'.repeat(70)}`);
console.log(`\n📊 Summary:`);
console.log(`   Total posts: ${CONTENT_CALENDAR.length}`);
console.log(`   Days covered: ${CONTENT_CALENDAR.length / 2}`);
console.log(`   Hashtag sets: ${Object.keys(HASHTAG_SETS).length} (${Object.keys(HASHTAG_SETS).join(', ')})`);
console.log(`   CTA variants: ${CTAS.length}`);

// Pillar distribution
const pillarCounts = {};
for (const p of CONTENT_CALENDAR) {
  pillarCounts[p.pillar] = (pillarCounts[p.pillar] || 0) + 1;
}
console.log(`\n   Content mix:`);
for (const [pillar, count] of Object.entries(pillarCounts).sort((a, b) => b[1] - a[1])) {
  const pct = ((count / CONTENT_CALENDAR.length) * 100).toFixed(0);
  console.log(`   · ${pillar}: ${count} posts (${pct}%)`);
}
