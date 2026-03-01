// Cloudflare Pages Function: Create Stripe Billing Portal Session
// POST /api/stripe-portal
// Lets premium users manage/cancel their subscription via Stripe's hosted portal.

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

  if (!STRIPE_SECRET_KEY) {
    return jsonResponse({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY.' }, 500)
  }

  try {
    const { customerId, returnUrl } = await request.json()

    if (!customerId) {
      return jsonResponse({ error: 'Missing customerId' }, 400)
    }

    // Derive return URL
    const origin = request.headers.get('origin')
      || request.headers.get('referer')?.replace(/\/[^/]*$/, '')
      || 'https://mystrainai.com'
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
      return jsonResponse({ error: session.error?.message || 'Stripe portal failed' }, 400)
    }

    return jsonResponse({ url: session.url })
  } catch (err) {
    console.error('Portal function error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
