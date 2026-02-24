// Netlify serverless function: Create Stripe Billing Portal Session
// POST /.netlify/functions/stripe-portal
// Lets premium users manage/cancel their subscription via Stripe's hosted portal.

export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders() }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, ...json({ error: 'Method not allowed' }) }
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

  if (!STRIPE_SECRET_KEY) {
    return {
      statusCode: 500,
      ...json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY.' }),
    }
  }

  try {
    const { customerId, returnUrl } = JSON.parse(event.body || '{}')

    if (!customerId) {
      return { statusCode: 400, ...json({ error: 'Missing customerId' }) }
    }

    // Derive return URL
    const origin = event.headers.origin || event.headers.referer?.replace(/\/[^/]*$/, '') || 'https://mystrainplus.netlify.app'
    const finalReturnUrl = returnUrl || `${origin}/dashboard`

    // Create Stripe Billing Portal Session via REST API
    const params = new URLSearchParams({
      'customer': customerId,
      'return_url': finalReturnUrl,
    })

    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const session = await response.json()

    if (!response.ok) {
      console.error('Stripe portal error:', session)
      return { statusCode: 400, ...json({ error: session.error?.message || 'Stripe portal failed' }) }
    }

    return { statusCode: 200, ...json({ url: session.url }) }
  } catch (err) {
    console.error('Portal function error:', err)
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
