import fs from 'node:fs/promises'
import admin from 'firebase-admin'

async function main() {
  const [serviceAccountPath, email] = process.argv.slice(2)
  if (!serviceAccountPath || !email) {
    console.error('Usage: node scripts/makeAdmin.mjs /absolute/path/serviceAccount.json you@example.com')
    process.exit(2)
  }

  const raw = await fs.readFile(serviceAccountPath, 'utf8')
  const serviceAccount = JSON.parse(raw)

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }

  const user = await admin.auth().getUserByEmail(email)
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

  console.log(`✅ Promoted to admin: ${email}`)
  console.log(`uid: ${uid}`)
}

main().catch((err) => {
  const msg = err?.message || String(err)
  if (msg.includes('There is no user record')) {
    console.error('User not found in Firebase Auth.')
    console.error('First: sign up in the app, then re-run this command.')
    process.exit(1)
  }
  console.error(err?.stack || msg)
  process.exit(1)
})

