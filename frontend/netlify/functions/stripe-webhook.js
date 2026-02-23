// Netlify serverless function: Handle Stripe Webhook Events
// POST /.netlify/functions/stripe-webhook

import crypto from 'crypto'

function constructEvent(payload, sigHeader, secret) {
  const elements = sigHeader.split(',')
  const timestamp = elements.find(e => e.startsWith('t='))?.split('=')[1]
  const signature = elements.find(e => e.startsWith('v1='))?.split('=')[1]

  if (!timestamp || !signature) throw new Error('Invalid signature header')

  const signedPayload = `${timestamp}.${payload}`
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')

  if (signature !== expectedSig) throw new Error('Signature mismatch')

  return JSON.parse(payload)
}

async function updateProfile(userId, updates) {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Supabase not configured for webhook')
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(updates),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Profile update failed: ${res.status} ${body}`)
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    return { statusCode: 500, body: 'Webhook secret not configured' }
  }

  try {
    const sig = event.headers['stripe-signature']
    const stripeEvent = constructEvent(event.body, sig, WEBHOOK_SECRET)

    console.log(`Stripe webhook: ${stripeEvent.type}`)

    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object
        const userId = session.metadata?.supabase_user_id
        const customerId = session.customer

        if (userId) {
          await updateProfile(userId, {
            subscription_status: 'active',
            stripe_customer_id: customerId,
          })
          console.log(`Activated premium for user ${userId}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = stripeEvent.data.object
        const userId = sub.metadata?.supabase_user_id
        if (userId) {
          const status = sub.status === 'active' ? 'active' : 'canceled'
          const endDate = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null

          await updateProfile(userId, {
            subscription_status: status,
            subscription_end: endDate,
          })
          console.log(`Updated subscription for user ${userId}: ${status}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object
        const userId = sub.metadata?.supabase_user_id
        if (userId) {
          await updateProfile(userId, {
            subscription_status: 'canceled',
            subscription_end: new Date().toISOString(),
          })
          console.log(`Canceled subscription for user ${userId}`)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`)
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) }
  } catch (err) {
    console.error('Webhook error:', err)
    return { statusCode: 400, body: `Webhook Error: ${err.message}` }
  }
}
