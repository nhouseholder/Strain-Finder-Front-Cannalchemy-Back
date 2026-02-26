import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../services/firebase'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(isFirebaseConfigured) // only loading if Firebase is configured

  /* ---- Fetch profile from Firestore ---- */
  const fetchProfile = useCallback(async (userId) => {
    if (!db) return
    try {
      const profileRef = doc(db, 'profiles', userId)
      const snap = await getDoc(profileRef)
      setProfile(snap.exists() ? snap.data() : null)
    } catch (err) {
      console.error('Profile fetch failed:', err)
      setProfile(null)
    }
  }, [])

  /* ---- Listen to auth state changes ---- */
  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser || null)
      if (currentUser) {
        await fetchProfile(currentUser.uid)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [fetchProfile])

  /* ---- Auth methods ---- */
  const signUp = useCallback(async (email, password) => {
    if (!auth || !db) throw new Error('Authentication is not configured. Please set up Firebase credentials.')
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const profileRef = doc(db, 'profiles', cred.user.uid)
    await setDoc(profileRef, {
      email: cred.user.email,
      display_name: null,
      subscription_status: 'free',
      stripe_customer_id: null,
      subscription_end: null,
      is_admin: false,
      created_at: serverTimestamp(),
    }, { merge: true })
    return cred
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!auth) throw new Error('Authentication is not configured. Please set up Firebase credentials.')
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred
  }, [])

  const signOut = useCallback(async () => {
    if (!auth) return
    await firebaseSignOut(auth)
    setUser(null)
    setProfile(null)
  }, [])

  const resetPassword = useCallback(async (email) => {
    if (!auth) throw new Error('Authentication is not configured. Please set up Firebase credentials.')
    await sendPasswordResetEmail(auth, email)
  }, [])

  /* ---- Derived state ---- */
  const isPremium = profile?.subscription_status === 'active'
  const isAdmin = profile?.is_admin === true

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isPremium,
      isAdmin,
      isFirebaseConfigured,
      signUp,
      signIn,
      signOut,
      resetPassword,
      refreshProfile: () => user && fetchProfile(user.uid),
    }),
    [user, profile, loading, isPremium, isAdmin, signUp, signIn, signOut, resetPassword, fetchProfile]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
