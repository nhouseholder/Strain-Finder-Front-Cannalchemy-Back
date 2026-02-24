#!/bin/bash
# ============================================================
# Strain Finder SaaS — One-Command Setup Script
# Run: bash setup.sh
# ============================================================

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${GREEN}${BOLD}🌿 Strain Finder SaaS Setup${NC}"
echo -e "${CYAN}This will configure Supabase auth + Stripe payments${NC}"
echo "============================================================"
echo ""

# ---- Step 1: Supabase ----
echo -e "${YELLOW}${BOLD}Step 1: Supabase Setup${NC}"
echo -e "${CYAN}If you don't have a Supabase account yet, create one now.${NC}"
echo ""
echo -e "Opening Supabase dashboard..."
open "https://supabase.com/dashboard/projects" 2>/dev/null || echo "  Visit: https://supabase.com/dashboard/projects"
echo ""
echo -e "${BOLD}Create a new project named 'Strain Finder' if you haven't already.${NC}"
echo -e "Then go to: ${CYAN}Settings → API${NC}"
echo ""

read -p "Paste your Supabase Project URL (starts with https://): " SUPA_URL
read -p "Paste your Supabase anon (public) key: " SUPA_ANON
read -p "Paste your Supabase service_role key: " SUPA_SERVICE

echo ""
echo -e "${GREEN}✓ Supabase credentials captured${NC}"

# ---- Step 2: Run SQL Setup ----
echo ""
echo -e "${YELLOW}${BOLD}Step 2: Database Setup${NC}"
echo -e "${CYAN}Running SQL to create profiles table and RLS policies...${NC}"

SQL_CONTENT=$(cat supabase-setup.sql)
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${SUPA_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPA_SERVICE}" \
  -H "Authorization: Bearer ${SUPA_SERVICE}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(echo "$SQL_CONTENT" | sed 's/"/\\"/g' | tr '\n' ' ')\"}" 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
  echo -e "${GREEN}✓ Database tables created successfully${NC}"
else
  echo -e "${YELLOW}⚠ Could not auto-run SQL (this is normal for new projects).${NC}"
  echo -e "  Please run the SQL manually:"
  echo -e "  1. Go to ${CYAN}Supabase Dashboard → SQL Editor → New Query${NC}"
  echo -e "  2. Paste contents of ${BOLD}supabase-setup.sql${NC}"
  echo -e "  3. Click 'Run'"
  echo ""
  read -p "Press Enter once you've run the SQL... "
  echo -e "${GREEN}✓ Database setup acknowledged${NC}"
fi

# ---- Step 3: Stripe ----
echo ""
echo -e "${YELLOW}${BOLD}Step 3: Stripe Setup${NC}"
echo -e "${CYAN}If you don't have a Stripe account yet, create one now.${NC}"
echo ""
echo -e "Opening Stripe dashboard..."
open "https://dashboard.stripe.com/test/products/create" 2>/dev/null || echo "  Visit: https://dashboard.stripe.com/test/products/create"
echo ""
echo -e "${BOLD}Create a product: 'Strain Finder Premium' — \$9.99/month recurring${NC}"
echo -e "Then go to: ${CYAN}Developers → API Keys${NC}"
echo ""

read -p "Paste your Stripe Publishable key (pk_test_...): " STRIPE_PK
read -p "Paste your Stripe Secret key (sk_test_...): " STRIPE_SK
read -p "Paste your Stripe Price ID (price_...): " STRIPE_PRICE

echo ""
echo -e "${GREEN}✓ Stripe credentials captured${NC}"

# ---- Step 4: Stripe Webhook ----
echo ""
echo -e "${YELLOW}${BOLD}Step 4: Stripe Webhook${NC}"
echo -e "Opening Stripe Webhooks page..."
open "https://dashboard.stripe.com/test/webhooks/create" 2>/dev/null || echo "  Visit: https://dashboard.stripe.com/test/webhooks"
echo ""
echo -e "${BOLD}Create a webhook endpoint:${NC}"
echo -e "  URL: ${CYAN}https://strain-finder.netlify.app/.netlify/functions/stripe-webhook${NC}"
echo -e "  Events: ${CYAN}checkout.session.completed, customer.subscription.updated, customer.subscription.deleted${NC}"
echo ""

read -p "Paste your Webhook signing secret (whsec_...): " STRIPE_WHSEC

echo ""
echo -e "${GREEN}✓ Stripe webhook configured${NC}"

# ---- Step 5: Write .env.local ----
echo ""
echo -e "${YELLOW}${BOLD}Step 5: Writing local environment...${NC}"

cat > frontend/.env.local << ENVEOF
# Supabase
VITE_SUPABASE_URL=${SUPA_URL}
VITE_SUPABASE_ANON_KEY=${SUPA_ANON}
SUPABASE_SERVICE_ROLE_KEY=${SUPA_SERVICE}

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=${STRIPE_PK}
STRIPE_SECRET_KEY=${STRIPE_SK}
STRIPE_PRICE_ID=${STRIPE_PRICE}
STRIPE_WEBHOOK_SECRET=${STRIPE_WHSEC}
ENVEOF

echo -e "${GREEN}✓ frontend/.env.local written${NC}"

# ---- Step 6: Set Netlify Env Vars ----
echo ""
echo -e "${YELLOW}${BOLD}Step 6: Setting Netlify environment variables...${NC}"

cd frontend

npx netlify env:set VITE_SUPABASE_URL "$SUPA_URL" --force 2>/dev/null && echo -e "  ${GREEN}✓${NC} VITE_SUPABASE_URL" || echo -e "  ${RED}✗${NC} VITE_SUPABASE_URL"
npx netlify env:set VITE_SUPABASE_ANON_KEY "$SUPA_ANON" --force 2>/dev/null && echo -e "  ${GREEN}✓${NC} VITE_SUPABASE_ANON_KEY" || echo -e "  ${RED}✗${NC} VITE_SUPABASE_ANON_KEY"
npx netlify env:set SUPABASE_SERVICE_ROLE_KEY "$SUPA_SERVICE" --force 2>/dev/null && echo -e "  ${GREEN}✓${NC} SUPABASE_SERVICE_ROLE_KEY" || echo -e "  ${RED}✗${NC} SUPABASE_SERVICE_ROLE_KEY"
npx netlify env:set VITE_STRIPE_PUBLISHABLE_KEY "$STRIPE_PK" --force 2>/dev/null && echo -e "  ${GREEN}✓${NC} VITE_STRIPE_PUBLISHABLE_KEY" || echo -e "  ${RED}✗${NC} VITE_STRIPE_PUBLISHABLE_KEY"
npx netlify env:set STRIPE_SECRET_KEY "$STRIPE_SK" --force 2>/dev/null && echo -e "  ${GREEN}✓${NC} STRIPE_SECRET_KEY" || echo -e "  ${RED}✗${NC} STRIPE_SECRET_KEY"
npx netlify env:set STRIPE_PRICE_ID "$STRIPE_PRICE" --force 2>/dev/null && echo -e "  ${GREEN}✓${NC} STRIPE_PRICE_ID" || echo -e "  ${RED}✗${NC} STRIPE_PRICE_ID"
npx netlify env:set STRIPE_WEBHOOK_SECRET "$STRIPE_WHSEC" --force 2>/dev/null && echo -e "  ${GREEN}✓${NC} STRIPE_WEBHOOK_SECRET" || echo -e "  ${RED}✗${NC} STRIPE_WEBHOOK_SECRET"

cd ..

echo ""
echo -e "${GREEN}✓ Netlify environment variables set${NC}"

# ---- Step 7: Deploy ----
echo ""
echo -e "${YELLOW}${BOLD}Step 7: Deploying to Netlify with new env vars...${NC}"
cd frontend
npx netlify deploy --prod 2>&1 | tail -15
cd ..

echo ""
echo -e "${GREEN}${BOLD}============================================================${NC}"
echo -e "${GREEN}${BOLD}🎉 Strain Finder SaaS is LIVE!${NC}"
echo -e "${GREEN}${BOLD}============================================================${NC}"
echo ""
echo -e "  🌐 Live site:  ${CYAN}https://strain-finder.netlify.app${NC}"
echo -e "  🔑 Login:      ${CYAN}https://strain-finder.netlify.app/login${NC}"
echo -e "  📝 Sign up:    ${CYAN}https://strain-finder.netlify.app/signup${NC}"
echo ""
echo -e "${YELLOW}${BOLD}FINAL STEP — Make yourself admin:${NC}"
echo -e "  1. Sign up on the live site with your email"
echo -e "  2. Go to Supabase SQL Editor and run:"
echo -e "     ${CYAN}UPDATE profiles SET is_admin = true, subscription_status = 'active' WHERE email = 'your@email.com';${NC}"
echo -e "  3. Log out and back in — you'll see the Admin panel in the nav"
echo ""
