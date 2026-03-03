import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import usePageTitle from '../hooks/usePageTitle'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'

export default function LoginPage() {
  usePageTitle('Sign In')
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, user } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // If already logged in, redirect
  if (user) {
    const from = location.state?.from?.pathname || '/quiz'
    navigate(from, { replace: true })
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await signIn(email, password)
      toast.success('Welcome back!')
      const from = location.state?.from?.pathname || '/quiz'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Sign in failed. Check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f4f7f5] dark:bg-leaf-900 relative overflow-hidden" style={{ minHeight: '100dvh' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <span className="text-3xl">🌿</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent" style={{ fontFamily: "'Playfair Display', serif" }}>
            MyStrainAI
          </span>
        </Link>

        <Card className="p-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-1 text-center" style={{ fontFamily: "'Playfair Display', serif" }}>
            Welcome back
          </h1>
          <p className="text-xs text-gray-500 dark:text-[#8a9a8e] text-center mb-6">
            Sign in to access your personalized experience
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

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="text-center">
              <Link to="/forgot-password" className="text-xs text-gray-400 dark:text-[#6a7a6e] hover:text-leaf-500 transition-colors">
                Forgot your password?
              </Link>
            </div>
          </form>
        </Card>

        <p className="text-xs text-gray-500 dark:text-[#8a9a8e] text-center mt-4">
          Don't have an account?{' '}
          <Link to="/signup" className="text-leaf-500 hover:text-leaf-400 font-medium transition-colors">
            Sign up
          </Link>
        </p>

        {/* Guest access */}
        <div className="text-center mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.04]">
          <Link
            to="/quiz"
            className="text-xs text-gray-400 dark:text-[#5a6a5e] hover:text-gray-600 dark:hover:text-[#8a9a8e] transition-colors"
          >
            Continue as guest &rarr;
          </Link>
          <p className="text-[10px] text-gray-300 dark:text-[#5a6a5e] mt-0.5">
            Try free with your top strain recommendation
          </p>
        </div>
      </div>
    </div>
  )
}
