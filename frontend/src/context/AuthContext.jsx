import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabase'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured) // only loading if Supabase is configured

  /* ---- Fetch profile from profiles table ---- */
  const fetchProfile = useCallback(async (userId) => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Profile fetch error:', error)
      }
      setProfile(data || null)
    } catch (err) {
      console.error('Profile fetch failed:', err)
      setProfile(null)
    }
  }, [])

  /* ---- Listen to auth state changes ---- */
  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user || null
      setUser(currentUser)
      if (currentUser) {
        fetchProfile(currentUser.id)
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    // Subscribe to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user || null
        setUser(currentUser)
        if (currentUser) {
          await fetchProfile(currentUser.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  /* ---- Auth methods ---- */
  const signUp = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Authentication is not configured. Please set up Supabase credentials.')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Authentication is not configured. Please set up Supabase credentials.')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
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
      isSupabaseConfigured,
      signUp,
      signIn,
      signOut,
      refreshProfile: () => user && fetchProfile(user.id),
    }),
    [user, profile, loading, isPremium, isAdmin, signUp, signIn, signOut, fetchProfile]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
