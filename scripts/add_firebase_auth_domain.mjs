import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const SA_PATH = process.env.HOME + '/Downloads/mystrainai-firebase-adminsdk-fbsvc-828d11db4a.json'
const PROJECT_ID = 'mystrainai'
const DOMAINS_TO_ADD = ['mystrainai.com', 'www.mystrainai.com', 'mystrainai.pages.dev']

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function signJwtRS256({ privateKeyPem, payload }) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const unsigned = `${encodedHeader}.${encodedPayload}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const signature = signer.sign(privateKeyPem)
  return `${unsigned}.${base64url(signature)}`
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000)
  const jwt = signJwtRS256({
    privateKeyPem: sa.private_key,
    payload: {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    },
  })

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  }).toString()

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json()
  if (!json.access_token) throw new Error('No access_token: ' + JSON.stringify(json))
  return json.access_token
}

async function apiCall(token, url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`)
  return text ? JSON.parse(text) : null
}

async function main() {
  const sa = JSON.parse(await fs.readFile(SA_PATH, 'utf8'))
  const token = await getAccessToken(sa)
  console.log('Got access token')

  // Get current config
  const config = await apiCall(token, `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`)
  const current = config.authorizedDomains || []
  console.log('Current authorized domains:', current)

  const newDomains = [...current]
  for (const d of DOMAINS_TO_ADD) {
    if (!newDomains.includes(d)) {
      newDomains.push(d)
      console.log(`  Adding: ${d}`)
    }
  }

  if (newDomains.length === current.length) {
    console.log('All domains already authorized!')
    return
  }

  const result = await apiCall(
    token,
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains`,
    'PATCH',
    { authorizedDomains: newDomains }
  )
  console.log('Updated authorized domains:', result.authorizedDomains)
  console.log('Done!')
}

main().catch(err => { console.error(err); process.exit(1) })
