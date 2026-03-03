/**
 * MyStrainAI — Setup Check
 * Validates that all required configuration is in place.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

console.log('🔍 MyStrainAI Instagram Automation — Setup Check\n');

let issues = 0;

// Check .env
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists');

  const env = fs.readFileSync(envPath, 'utf8');
  const required = [
    'INSTAGRAM_ACCESS_TOKEN',
    'INSTAGRAM_BUSINESS_ACCOUNT_ID',
  ];
  const recommended = [
    'META_APP_ID',
    'META_APP_SECRET',
    'IMGBB_API_KEY',
  ];

  for (const key of required) {
    if (env.includes(`${key}=`) && !env.includes(`${key}=\n`) && !env.includes(`${key}= `)) {
      console.log(`   ✅ ${key} is set`);
    } else {
      console.log(`   ❌ ${key} is MISSING — required for posting`);
      issues++;
    }
  }

  for (const key of recommended) {
    if (env.includes(`${key}=`) && !env.includes(`${key}=\n`)) {
      console.log(`   ✅ ${key} is set`);
    } else {
      console.log(`   ⚠️  ${key} is not set (recommended)`);
    }
  }
} else {
  console.log('❌ .env file not found — copy .env.example to .env and fill in values');
  issues++;
}

// Check directories
const dirs = ['output', 'screenshots'];
for (const dir of dirs) {
  const dirPath = path.join(root, dir);
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath).length;
    console.log(`✅ ${dir}/ exists (${files} files)`);
  } else {
    console.log(`⚠️  ${dir}/ doesn't exist (will be created on first run)`);
  }
}

// Check content library
try {
  const { CONTENT_CALENDAR, HASHTAG_SETS } = await import('../data/content-library.js');
  console.log(`✅ Content library loaded: ${CONTENT_CALENDAR.length} posts, ${Object.keys(HASHTAG_SETS).length} hashtag sets`);
} catch (err) {
  console.log(`❌ Content library error: ${err.message}`);
  issues++;
}

// Check dependencies
const deps = ['sharp', 'puppeteer', 'node-cron'];
for (const dep of deps) {
  try {
    await import(dep);
    console.log(`✅ ${dep} installed`);
  } catch {
    console.log(`❌ ${dep} not installed — run: npm install`);
    issues++;
  }
}

// Summary
console.log('\n' + '─'.repeat(50));
if (issues === 0) {
  console.log('🎉 All checks passed! You\'re ready to go.');
  console.log('\nNext steps:');
  console.log('   1. npm run generate    — Generate post images');
  console.log('   2. npm run post -- --dry-run  — Preview a post');
  console.log('   3. npm run schedule    — Start the scheduler');
} else {
  console.log(`⚠️  ${issues} issue(s) found. See SETUP.md for configuration instructions.`);
}
