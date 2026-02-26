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
    throw new Error(`Rules API failed (${res.status}) ${url}\n${text}`.slice(0, 2000))
  }
  return json
}

async function main() {
  const [serviceAccountPath, rulesPath = 'firestore.rules'] = process.argv.slice(2)
  if (!serviceAccountPath) {
    console.error('Usage: node scripts/deploy_firestore_rules.mjs /absolute/path/serviceAccount.json [rulesFile]')
    process.exit(2)
  }

  const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'))
  const projectId = serviceAccount.project_id
  if (!projectId) throw new Error('service account JSON missing project_id')

  const rulesSource = await fs.readFile(rulesPath, 'utf8')
  const token = await getAccessToken(serviceAccount, [
    'https://www.googleapis.com/auth/firebase',
    'https://www.googleapis.com/auth/cloud-platform',
  ])

  // Create ruleset
  const ruleset = await api(
    token,
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    {
      method: 'POST',
      body: JSON.stringify({
        source: {
          files: [
            { name: 'firestore.rules', content: rulesSource },
          ],
        },
      }),
    }
  )

  // Release to firestore service (create if missing, otherwise patch)
  const releaseName = `projects/${projectId}/releases/cloud.firestore`
  try {
    await api(token, `https://firebaserules.googleapis.com/v1/${releaseName}`, {
      method: 'PATCH',
      body: JSON.stringify({
        release: {
          name: releaseName,
          rulesetName: ruleset.name,
        },
        updateMask: 'rulesetName',
      }),
    })
  } catch (err) {
    const msg = err?.message || ''
    if (!msg.includes('404')) throw err
    await api(token, `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`, {
      method: 'POST',
      body: JSON.stringify({
        name: releaseName,
        rulesetName: ruleset.name,
      }),
    })
  }

  console.log(`✅ Deployed Firestore ruleset: ${ruleset.name}`)
}

main().catch((err) => {
  console.error(err?.stack || String(err))
  process.exit(1)
})

