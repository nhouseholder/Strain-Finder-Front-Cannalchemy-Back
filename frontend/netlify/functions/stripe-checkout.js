// Netlify serverless function: Create Stripe Checkout Session
// POST /.netlify/functions/stripe-checkout

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.' }),
    }
  }

  try {
    const { email, userId, returnUrl } = JSON.parse(event.body || '{}')

    if (!email || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing email or userId' }),
      }
    }

    const successUrl = `${returnUrl || 'https://cannalchemy.app/results'}?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = returnUrl || 'https://cannalchemy.app/results'

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
      return {
        statusCode: 400,
        body: JSON.stringify({ error: session.error?.message || 'Stripe checkout failed' }),
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url, sessionId: session.id }),
    }
  } catch (err) {
    console.error('Checkout function error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}
