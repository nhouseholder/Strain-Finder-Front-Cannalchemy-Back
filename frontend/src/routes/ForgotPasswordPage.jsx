import { useState } from 'react'
import { Link } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'
import { supabase, isSupabaseConfigured } from '../services/supabase'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'

export default function ForgotPasswordPage() {
  usePageTitle('Reset Password')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!supabase) throw new Error('Authentication is not configured yet.')
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (resetError) throw resetError
      setSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-white dark:bg-[#0a0f0c]">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            Check your email
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#8a9a8e] mb-6">
            We sent a password reset link to <strong className="text-gray-700 dark:text-[#b0c4b4]">{email}</strong>.
          </p>
          <Link to="/login" className="text-leaf-500 hover:text-leaf-400 font-medium text-sm transition-colors">
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white dark:bg-[#0a0f0c]">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <span className="text-3xl">🌿</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent" style={{ fontFamily: "'Playfair Display', serif" }}>
            Strain Finder
          </span>
        </Link>

        <Card className="p-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-1 text-center" style={{ fontFamily: "'Playfair Display', serif" }}>
            Reset your password
          </h1>
          <p className="text-xs text-gray-500 dark:text-[#8a9a8e] text-center mb-6">
            Enter your email and we'll send you a reset link
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

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        </Card>

        <p className="text-xs text-gray-500 dark:text-[#8a9a8e] text-center mt-4">
          Remember your password?{' '}
          <Link to="/login" className="text-leaf-500 hover:text-leaf-400 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
