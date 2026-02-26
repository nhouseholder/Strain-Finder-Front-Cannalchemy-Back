import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import admin from 'firebase-admin'

function randomPassword() {
  // 24 chars, URL-safe, strong enough for a temporary password.
  return crypto.randomBytes(18).toString('base64url')
}

async function main() {
  const [serviceAccountPath, email] = process.argv.slice(2)
  if (!serviceAccountPath || !email) {
    console.error('Usage: node scripts/bootstrapAdmin.mjs /absolute/path/serviceAccount.json you@example.com')
    process.exit(2)
  }

  const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'))

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }

  let user
  try {
    user = await admin.auth().getUserByEmail(email)
  } catch (err) {
    const msg = err?.message || ''
    if (!msg.includes('There is no user record')) throw err
    user = await admin.auth().createUser({
      email,
      emailVerified: false,
      password: randomPassword(),
      disabled: false,
    })
  }

  const uid = user.uid
  const db = admin.firestore()
  await db.collection('profiles').doc(uid).set(
    {
      email: user.email || email,
      is_admin: true,
      subscription_status: 'active',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )

  const resetLink = await admin.auth().generatePasswordResetLink(email)
  console.log(`✅ Admin bootstrapped for: ${email}`)
  console.log(`uid: ${uid}`)
  console.log('Password setup link (open in browser):')
  console.log(resetLink)
}

main().catch((err) => {
  console.error(err?.stack || String(err))
  process.exit(1)
})

