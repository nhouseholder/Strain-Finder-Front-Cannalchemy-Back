// Netlify serverless function: Create Stripe Checkout Session
// POST /.netlify/functions/stripe-checkout

const SITE_URL = 'https://strain-finder.netlify.app'

export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders() }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, ...json({ error: 'Method not allowed' }) }
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    return {
      statusCode: 500,
      ...json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.' }),
    }
  }

  try {
    const { email, userId, returnUrl } = JSON.parse(event.body || '{}')

    if (!email || !userId) {
      return { statusCode: 400, ...json({ error: 'Missing email or userId' }) }
    }

    // Check if user already has an active subscription in Supabase
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (SUPABASE_URL && SERVICE_ROLE_KEY) {
      try {
        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=subscription_status`,
          {
            headers: {
              'apikey': SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            },
          }
        )
        const profiles = await profileRes.json()
        if (profiles?.[0]?.subscription_status === 'active') {
          return { statusCode: 400, ...json({ error: 'You already have an active subscription! Refresh the page to see your premium features.' }) }
        }
      } catch (e) {
        console.warn('Could not check existing subscription:', e.message)
        // Continue to checkout anyway
      }
    }

    // Derive origin from request, fallback to configured site URL
    const origin = event.headers.origin || event.headers.referer?.replace(/\/[^/]*$/, '') || SITE_URL
    const successUrl = `${returnUrl || origin + '/checkout-success'}?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${origin}/results`

    // Create Stripe Checkout Session via REST API
    const params = new URLSearchParams({
      'mode': 'subscription',
      'success_url': successUrl,
      'cancel_url': cancelUrl,
      'customer_email': email,
      'line_items[0][price]': STRIPE_PRICE_ID,
      'line_items[0][quantity]': '1',
      'metadata[supabase_user_id]': userId,
      'subscription_data[metadata][supabase_user_id]': userId,
    })

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const session = await response.json()

    if (!response.ok) {
      console.error('Stripe error:', session)
      return { statusCode: 400, ...json({ error: session.error?.message || 'Stripe checkout failed' }) }
    }

    return { statusCode: 200, ...json({ url: session.url, sessionId: session.id }) }
  } catch (err) {
    console.error('Checkout function error:', err)
    return { statusCode: 500, ...json({ error: 'Internal server error' }) }
  }
}

function corsHeaders() {
  return {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  }
}

function json(data) {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(data),
  }
}
