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
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [confirmed21, setConfirmed21] = useState(false)

  // If already logged in, redirect
  if (user) {
    navigate('/quiz', { replace: true })
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to create an account.')
      return
    }
    if (!confirmed21) {
      setError('You must confirm that you are at least 21 years old.')
      return
    }
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
      await signUp(email, password)
      navigate('/quiz', { replace: true })
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white dark:bg-[#0a0f0c]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <span className="text-3xl">🌿</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent" style={{ fontFamily: "'Playfair Display', serif" }}>
            MyStrainAi
          </span>
        </Link>

        <Card className="p-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-1 text-center" style={{ fontFamily: "'Playfair Display', serif" }}>
            Create your account
          </h1>
          <p className="text-xs text-gray-500 dark:text-[#8a9a8e] text-center mb-6">
            Explore cannabis information based on community data and publicly available research
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

            {/* Explicit consent checkboxes */}
            <div className="space-y-2.5 text-left">
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => { setAgreedToTerms(e.target.checked); setError(null) }}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-white/20 text-leaf-500 focus:ring-leaf-500/40 flex-shrink-0"
                />
                <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] leading-relaxed">
                  I have read and agree to the{' '}
                  <Link to="/terms" target="_blank" className="text-leaf-500 hover:text-leaf-400 underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" target="_blank" className="text-leaf-500 hover:text-leaf-400 underline">Privacy Policy</Link>.
                  I understand that MyStrainAi is an informational platform only and does not provide medical advice, sell cannabis, or guarantee outcomes.
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={confirmed21}
                  onChange={(e) => { setConfirmed21(e.target.checked); setError(null) }}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-white/20 text-leaf-500 focus:ring-leaf-500/40 flex-shrink-0"
                />
                <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] leading-relaxed">
                  I confirm that I am <strong className="text-gray-500 dark:text-[#8a9a8e]">at least 21 years of age</strong> and that cannabis use is legal in my jurisdiction. I am solely responsible for complying with all applicable laws.
                </span>
              </label>
            </div>

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

        {/* Guest access */}
        <div className="text-center mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.04]">
          <Link
            to="/quiz"
            className="text-xs text-gray-400 dark:text-[#5a6a5e] hover:text-gray-600 dark:hover:text-[#8a9a8e] transition-colors"
          >
            Continue as guest &rarr;
          </Link>
          <p className="text-[10px] text-gray-300 dark:text-[#3a4a3e] mt-0.5">
            Try free with your top strain recommendation
          </p>
        </div>
      </div>
    </div>
  )
}
