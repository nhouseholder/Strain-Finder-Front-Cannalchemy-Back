// Calls the free Cloudflare Workers AI endpoint (Llama 3.3 70B)
// Used for strain experience descriptions and "Why This Strain?" explanations.
// No API key required.

const API_URL = '/api/ai'

export class RateLimitError extends Error {
  constructor(retryAfterSec) {
    const waitMsg = retryAfterSec
      ? `Please wait ${Math.ceil(retryAfterSec / 60)} minute${retryAfterSec > 60 ? 's' : ''} and try again.`
      : 'Please wait a few minutes and try again.'
    super(`You've hit the rate limit. ${waitMsg}`)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfterSec || 60
  }
}

export async function callFreeAI({ prompt, maxTokens = 500, retries = 2 }) {
  let lastError = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: maxTokens }),
      })

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After'), 10) || 60
          throw new RateLimitError(retryAfter)
        }
        const errBody = await response.text().catch(() => '')
        let msg = `AI error ${response.status}`
        try {
          const errJson = JSON.parse(errBody)
          msg = errJson.error || msg
        } catch { /* use default */ }
        throw new Error(msg)
      }

      const data = await response.json()
      if (data.error) throw new Error(data.error)
      return (data.text || '').trim()
    } catch (err) {
      if (err instanceof RateLimitError) throw err
      lastError = err
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
      }
    }
  }

  throw lastError
}
