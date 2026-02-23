import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import usePageTitle from '../hooks/usePageTitle'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'

export default function SignupPage() {
  usePageTitle('Sign Up')
  const navigate = useNavigate()
  const { signUp, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // If already logged in, redirect
  if (user) {
    navigate('/quiz', { replace: true })
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const data = await signUp(email, password)
      // Supabase may require email confirmation
      if (data?.user?.identities?.length === 0) {
        setError('An account with this email already exists.')
      } else if (data?.user && !data?.session) {
        // Email confirmation required
        setSuccess(true)
      } else {
        // Auto-confirmed, redirect
        navigate('/quiz', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-white dark:bg-[#0a0f0c]">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            Check your email
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#8a9a8e] mb-6">
            We sent a confirmation link to <strong className="text-gray-700 dark:text-[#b0c4b4]">{email}</strong>. Click it to activate your account.
          </p>
          <Link to="/login" className="text-leaf-500 hover:text-leaf-400 font-medium text-sm transition-colors">
            Go to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white dark:bg-[#0a0f0c]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <span className="text-3xl">🌿</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent" style={{ fontFamily: "'Playfair Display', serif" }}>
            Strain Finder
          </span>
        </Link>

        <Card className="p-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-1 text-center" style={{ fontFamily: "'Playfair Display', serif" }}>
            Create your account
          </h1>
          <p className="text-xs text-gray-500 dark:text-[#8a9a8e] text-center mb-6">
            Get personalized cannabis recommendations backed by science
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-700 dark:text-[#b0c4b4] mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-[#e8f0ea] placeholder:text-gray-400 dark:placeholder:text-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 focus:border-leaf-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 dark:text-[#b0c4b4] mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-[#e8f0ea] placeholder:text-gray-400 dark:placeholder:text-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 focus:border-leaf-500"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-xs font-medium text-gray-700 dark:text-[#b0c4b4] mb-1">
                Confirm Password
              </label>
              <input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-[#e8f0ea] placeholder:text-gray-400 dark:placeholder:text-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 focus:border-leaf-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
        </Card>

        <p className="text-xs text-gray-500 dark:text-[#8a9a8e] text-center mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-leaf-500 hover:text-leaf-400 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
