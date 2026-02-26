import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'

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

async function firebaseApi(token, url, init) {
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
    throw new Error(
      `Firebase API failed (${res.status}) ${url}\n${text}`.slice(0, 2000)
    )
  }
  return json
}

async function pollOperation(token, name) {
  for (let i = 0; i < 30; i++) {
    const op = await firebaseApi(token, `https://firebase.googleapis.com/v1beta1/${name}`)
    if (op?.done) return op
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(`Timed out waiting for operation ${name}`)
}

function toEnv(config) {
  // The Firebase Management API returns apiKey, authDomain, etc.
  // Cloudflare Pages needs VITE_* vars for build-time injection.
  const lines = [
    `VITE_FIREBASE_API_KEY=${config.apiKey || ''}`,
    `VITE_FIREBASE_AUTH_DOMAIN=${config.authDomain || ''}`,
    `VITE_FIREBASE_PROJECT_ID=${config.projectId || ''}`,
    `VITE_FIREBASE_STORAGE_BUCKET=${config.storageBucket || `${config.projectId}.appspot.com`}`,
    `VITE_FIREBASE_MESSAGING_SENDER_ID=${config.messagingSenderId || config.projectNumber || ''}`,
    `VITE_FIREBASE_APP_ID=${config.appId || ''}`,
  ]
  return lines.join('\n') + '\n'
}

async function main() {
  const serviceAccountPath = process.argv[2]
  if (!serviceAccountPath) {
    console.error('Usage: node scripts/firebase_pages_env.mjs /absolute/path/to/serviceAccount.json')
    process.exit(2)
  }

  const raw = await fs.readFile(serviceAccountPath, 'utf8')
  const serviceAccount = JSON.parse(raw)
  const projectId = serviceAccount.project_id
  if (!projectId) throw new Error('service account JSON missing project_id')

  const token = await getAccessToken(serviceAccount, [
    'https://www.googleapis.com/auth/firebase',
    'https://www.googleapis.com/auth/cloud-platform',
  ])

  // Ensure a Web App exists (create one if none).
  const list = await firebaseApi(
    token,
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`
  )
  const existing = (list?.apps || []).find((a) => a.state !== 'DELETED')

  let webApp = existing
  if (!webApp) {
    const op = await firebaseApi(token, `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`, {
      method: 'POST',
      body: JSON.stringify({ displayName: 'MyStrainAi Web' }),
    })
    const done = await pollOperation(token, op.name)
    webApp = done?.response
    if (!webApp?.name) throw new Error('Web app creation did not return a web app')
  }

  // Fetch config for that Web App.
  const config = await firebaseApi(
    token,
    `https://firebase.googleapis.com/v1beta1/${webApp.name}/config`
  )

  const envText = toEnv(config)
  const targetEnvPath = path.resolve('frontend/.env.local')
  await fs.writeFile(targetEnvPath, envText, { encoding: 'utf8' })

  // Print non-sensitive confirmation only.
  console.log(`Wrote Firebase VITE env vars to ${targetEnvPath}`)
  console.log(`Firebase project: ${config.projectId}`)
  console.log(`Web appId: ${config.appId}`)
}

main().catch((err) => {
  console.error(err?.stack || String(err))
  process.exit(1)
})

