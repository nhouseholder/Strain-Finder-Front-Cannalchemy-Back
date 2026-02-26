import fs from 'node:fs/promises'
import crypto from 'node:crypto'

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
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

async function getAccessToken(serviceAccount, scopes) {
  const now = Math.floor(Date.now() / 1000)
  const assertion = signJwtRS256({
    privateKeyPem: serviceAccount.private_key,
    payload: {
      iss: serviceAccount.client_email,
      scope: scopes.join(' '),
      aud: serviceAccount.token_uri,
      iat: now,
      exp: now + 3600,
    },
  })

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }).toString()

  const res = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to fetch access token (${res.status}). ${text}`.trim())
  }
  const json = await res.json()
  if (!json.access_token) throw new Error('No access_token in token response')
  return json.access_token
}

async function api(token, url, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* ignore */ }
  if (!res.ok) {
    throw new Error(`Service Usage API failed (${res.status}) ${url}\n${text}`.slice(0, 2000))
  }
  return json
}

async function poll(token, opName) {
  for (let i = 0; i < 60; i++) {
    const op = await api(token, `https://serviceusage.googleapis.com/v1/${opName}`, { method: 'GET' })
    if (op?.done) return op
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`Timed out waiting for operation: ${opName}`)
}

async function main() {
  const [serviceAccountPath, serviceName] = process.argv.slice(2)
  if (!serviceAccountPath || !serviceName) {
    console.error('Usage: node scripts/enable_gcp_service.mjs /absolute/path/serviceAccount.json firestore.googleapis.com')
    process.exit(2)
  }

  const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'))
  const projectId = serviceAccount.project_id
  if (!projectId) throw new Error('service account JSON missing project_id')

  const token = await getAccessToken(serviceAccount, [
    'https://www.googleapis.com/auth/cloud-platform',
  ])

  const name = `projects/${projectId}/services/${serviceName}`
  const op = await api(token, `https://serviceusage.googleapis.com/v1/${name}:enable`, {
    method: 'POST',
    body: JSON.stringify({}),
  })

  const done = await poll(token, op.name)
  if (done?.error) throw new Error(JSON.stringify(done.error))
  console.log(`✅ Enabled service: ${serviceName}`)
}

main().catch((err) => {
  console.error(err?.stack || String(err))
  process.exit(1)
})

