// In production, calls go to the Netlify edge function at /api/anthropic
// which proxies to the Anthropic API with the key server-side.
// In dev, Vite proxy forwards /api/anthropic/v1/messages to the Anthropic API.
const API_URL = '/api/anthropic'

/** Custom error for 429 rate-limit responses */
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

export async function callAnthropic({ prompt, maxTokens = 8000, retries = 2 }) {
  let lastError = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (import.meta.env.DEV) {
        return await callAnthropicDirect({ prompt, maxTokens })
      }
      return await callAnthropicViaFunction({ prompt, maxTokens })
    } catch (err) {
      // Never retry on rate limits — bubble up immediately
      if (err instanceof RateLimitError) throw err

      lastError = err
      console.error(`API attempt ${attempt + 1} failed:`, err)
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
      }
    }
  }

  throw lastError
}

// Production: call Netlify edge function which returns plain JSON
async function callAnthropicViaFunction({ prompt, maxTokens }) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    // Handle 429 rate limit with Retry-After header
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After'), 10) || 60
      throw new RateLimitError(retryAfter)
    }

    const errBody = await response.text().catch(() => '')
    let msg = `API error ${response.status}`
    try {
      const errJson = JSON.parse(errBody)
      msg = errJson.error || msg
    } catch { /* use default */ }

    if (msg.includes('credit balance') || msg.includes('billing')) {
      throw new Error('Insufficient API credits. Please add credits at console.anthropic.com/settings/billing')
    }
    throw new Error(msg)
  }

  const data = await response.json()

  // Handle function-level errors
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
  }

  return extractTextFromBlocks(data.content || [])
}

// Dev: direct non-streaming call via Vite proxy
async function callAnthropicDirect({ prompt, maxTokens }) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey || apiKey.trim().length < 10) {
    throw new Error('API_KEY_MISSING')
  }

  const response = await fetch('/api/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`API error ${response.status}: ${errBody.slice(0, 300)}`)
  }

  const data = await response.json()
  return extractTextFromBlocks(data.content || [])
}

function extractTextFromBlocks(blocks) {
  // Collect all text blocks — with web_search, there are multiple text blocks
  // interspersed with server_tool_use and web_search_tool_result blocks.
  // The LAST text block that contains JSON is the final answer.
  const textBlocks = []
  for (const block of blocks) {
    if (block.type === 'text' && block.text?.trim()) {
      textBlocks.push(block.text)
    }
  }

  if (textBlocks.length === 0) {
    throw new Error('No text content in API response')
  }

  for (let i = textBlocks.length - 1; i >= 0; i--) {
    if (textBlocks[i].includes('{') && textBlocks[i].includes('}')) {
      return textBlocks[i]
    }
  }

  return textBlocks.join('\n')
}
