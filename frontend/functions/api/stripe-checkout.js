// Cloudflare Pages Function: Create Stripe Checkout Session
// POST /api/stripe-checkout

const SITE_URL = 'https://mystrainai.com'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export async function onRequestPost(context) {
  const { request, env } = context

  const STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY
  const STRIPE_PRICE_ID = env.STRIPE_PRICE_ID

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    return jsonResponse({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.' }, 500)
  }

  try {
    const { email, userId, returnUrl } = await request.json()

    if (!email || !userId) {
      return jsonResponse({ error: 'Missing email or userId' }, 400)
    }

    // Check if user already has an active subscription in Supabase
    const SUPABASE_URL = env.VITE_SUPABASE_URL
    const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
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
          return jsonResponse({ error: 'You already have an active subscription! Refresh the page to see your premium features.' }, 400)
        }
      } catch (e) {
        console.warn('Could not check existing subscription:', e.message)
        // Continue to checkout anyway
      }
    }

    // Derive origin from request, fallback to configured site URL
    const origin = request.headers.get('origin')
      || request.headers.get('referer')?.replace(/\/[^/]*$/, '')
      || SITE_URL
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
      return jsonResponse({ error: session.error?.message || 'Stripe checkout failed' }, 400)
    }

    return jsonResponse({ url: session.url, sessionId: session.id })
  } catch (err) {
    console.error('Checkout function error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
