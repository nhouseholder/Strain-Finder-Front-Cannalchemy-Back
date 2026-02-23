import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'

export default function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = (e) => {
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

    // Placeholder — will wire to Supabase in Phase 2
    navigate('/quiz')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white dark:bg-[#0a0f0c]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <span className="text-3xl">🌿</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent" style={{ fontFamily: "'Playfair Display', serif" }}>
            Cannalchemy
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

            <Button type="submit" size="lg" className="w-full">
              Create Account
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
