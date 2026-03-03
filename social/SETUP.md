# MyStrainAI Instagram Automation — Setup Guide

## Overview

This automation system posts 2 branded images per day to @mystrainai on Instagram using the **official Meta Instagram Graph API**. No unofficial bots, no risk of account bans.

---

## Step 1: Switch to Instagram Business Account

1. Open Instagram → **Settings** → **Account** → **Switch to Professional Account**
2. Choose **Business** (not Creator)
3. Select category: **"Science & Technology"** or **"App"**
   - ⚠️ Do NOT choose "Cannabis" — it triggers extra content scrutiny
4. Follow prompts to connect to a Facebook Page (create one if needed)

### Create a Facebook Page (if you don't have one)

1. Go to [facebook.com/pages/create](https://facebook.com/pages/create)
2. Name: **MyStrainAI**
3. Category: **App** or **Science & Technology**
4. Skip all optional setup — this page only needs to exist
5. Go back to Instagram and link this Page in **Settings → Account → Linked Accounts → Facebook**

---

## Step 2: Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **"My Apps"** → **"Create App"**
3. App type: **Business**
4. App name: **MyStrainAI Social**
5. Business portfolio: Select your portfolio (or create one)

### Add Instagram Product

1. In your app dashboard, click **"Add Product"**
2. Find **"Instagram"** → click **"Set Up"**
3. On the Instagram settings page, click **"Add Instagram Account"**
4. Log in to @mystrainai and authorize

### Add Required Permissions

In the app dashboard, go to **App Review** → **Permissions and Features** and request:

| Permission | Why |
|-----------|-----|
| `instagram_basic` | Read account info |
| `instagram_content_publish` | Publish posts |
| `pages_show_list` | List connected pages |
| `pages_read_engagement` | Read page data |

For development/testing, these permissions are available in **Development Mode** without app review (you can post to your own account).

---

## Step 3: Generate an Access Token

### Short-Lived Token (1 hour — for testing)

1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app from the dropdown
3. Click **"Generate Access Token"**
4. Select permissions: `instagram_basic`, `instagram_content_publish`, `pages_show_list`
5. Copy the token

### Long-Lived Token (60 days — for automation)

Exchange the short-lived token for a long-lived one:

```bash
curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id=YOUR_APP_ID&\
client_secret=YOUR_APP_SECRET&\
fb_exchange_token=YOUR_SHORT_LIVED_TOKEN"
```

This returns a token valid for **60 days**. Save it.

### Get Your Instagram Business Account ID

```bash
curl "https://graph.facebook.com/v21.0/me/accounts?\
fields=instagram_business_account&\
access_token=YOUR_LONG_LIVED_TOKEN"
```

The `instagram_business_account.id` value is your `INSTAGRAM_BUSINESS_ACCOUNT_ID`.

---

## Step 4: Set Up Image Hosting

The Instagram Graph API requires images to be hosted on a **public URL** (it can't upload local files directly).

### Option A: Host on your domain (Recommended)

If you have Cloudflare R2 or any file hosting:
- Upload generated images to `https://mystrainai.com/social/posts/`
- Set `IMAGE_HOST_BASE_URL=https://mystrainai.com/social/posts` in `.env`

### Option B: Use imgbb (Free, no account needed)

1. Get a free API key at [api.imgbb.com](https://api.imgbb.com/)
2. Set `IMGBB_API_KEY=your_key_here` in `.env`
3. Images are uploaded automatically before each post

### Option C: Cloudflare R2 Bucket

```bash
# Create R2 bucket
npx wrangler r2 bucket create mystrainai-social

# Upload images
npx wrangler r2 object put mystrainai-social/posts/image.png --file=output/image.png
```

---

## Step 5: Configure Environment

```bash
cd social
cp .env.example .env
```

Edit `.env` with your values:

```env
META_APP_ID=123456789
META_APP_SECRET=abc123def456
INSTAGRAM_ACCESS_TOKEN=EAAG...your_long_lived_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=17841400000000000
FACEBOOK_PAGE_ID=100000000000000

# Image hosting (choose one)
IMAGE_HOST_BASE_URL=https://mystrainai.com/social/posts
# or
IMGBB_API_KEY=your_imgbb_api_key

APP_URL=https://mystrainai.com
```

---

## Step 6: Test the Connection

```bash
cd social
npm install
node scripts/post-to-instagram.js --test
```

Expected output:
```
✅ Instagram Graph API connection successful!
   Account: @mystrainai
   Followers: 0
   Posts: 0
   ID: 17841400000000000
   Token valid for 58 days
```

---

## Step 7: Generate Content

```bash
# Generate all 28 days of posts (images)
npm run generate

# Or generate a specific day
node scripts/generate-posts.js --day=1
```

This creates branded images in `output/` and a `manifest.json` mapping posts to images.

---

## Step 8: Test Posting

```bash
# Dry run — preview caption without posting
node scripts/post-to-instagram.js --day=1 --slot=AM --dry-run

# Post a specific day/slot
node scripts/post-to-instagram.js --day=1 --slot=AM
```

---

## Step 9: Start the Scheduler

```bash
# Simple (runs in foreground)
npm run schedule

# With PM2 (recommended for production)
npm install -g pm2
pm2 start scripts/scheduler.js --name "ig-scheduler" --cron-restart="0 0 * * *"
pm2 save

# Check status
pm2 status
pm2 logs ig-scheduler

# Or as a macOS Launch Agent (auto-starts on boot)
# See below
```

### macOS Launch Agent (auto-start on boot)

Create `~/Library/LaunchAgents/com.mystrainai.ig-scheduler.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mystrainai.ig-scheduler</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/social/scripts/scheduler.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/path/to/social</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/path/to/social/scheduler-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/path/to/social/scheduler-stderr.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
```

Then:
```bash
launchctl load ~/Library/LaunchAgents/com.mystrainai.ig-scheduler.plist
```

---

## Step 10: Token Refresh

Long-lived tokens expire after **60 days**. The scheduler checks weekly and warns you when it's close to expiry.

To refresh manually:

```bash
curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id=YOUR_APP_ID&\
client_secret=YOUR_APP_SECRET&\
fb_exchange_token=YOUR_CURRENT_TOKEN"
```

Update the new token in `.env`.

For fully automatic token refresh, consider implementing a server-side token refresh endpoint.

---

## Daily Operations

| Time (ET) | What Happens |
|-----------|-------------|
| 12:00 AM | Content generated for the day |
| 11:00 AM | Morning post published |
| 7:00 PM | Evening post published |
| Monday 9 AM | Token expiry check |

### Check Status
```bash
node scripts/scheduler.js --status
```

### View Logs
```bash
tail -50 social/scheduler.log
```

### Manual Post
```bash
node scripts/post-to-instagram.js --day=5 --slot=AM
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Token expired` | Refresh token (Step 10) |
| `Image URL not accessible` | Check image hosting setup (Step 4) |
| `Permission denied` | Re-authorize app permissions (Step 2) |
| `No generated images` | Run `npm run generate` |
| `Rate limited` | Instagram allows 25 posts/day. We only do 2. |
| `Content policy violation` | Review safe language guide in strategy doc |

---

## Architecture

```
social/
├── .env                  # API keys & config (git-ignored)
├── .env.example          # Template
├── .post-state.json      # Scheduler state (auto-generated)
├── package.json
├── SETUP.md              # This file
├── data/
│   └── content-library.js   # Captions, hashtags, content calendar
├── scripts/
│   ├── capture-screenshots.js  # Puppeteer screenshot capture
│   ├── generate-posts.js       # Branded image generation
│   ├── post-to-instagram.js    # Instagram Graph API client
│   └── scheduler.js            # Cron-based 2x daily scheduling
├── screenshots/          # Raw app screenshots (auto-generated)
└── output/               # Ready-to-post images (auto-generated)
```
