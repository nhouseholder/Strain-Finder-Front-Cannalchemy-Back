import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Sparkles, Loader2, UserPlus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Button from './Button'

export default function PaywallOverlay() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleUpgrade = async () => {
    if (!user) {
      // Guest user — redirect to signup
      navigate('/signup', { state: { from: { pathname: '/results' } } })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/.netlify/functions/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          userId: user.id,
          returnUrl: window.location.origin + '/checkout-success',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
      setError('Could not start checkout. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60 dark:bg-[#0a0f0c]/60 backdrop-blur-sm">
      <div className="text-center px-6 py-8 max-w-xs">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <Lock size={20} className="text-amber-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea] mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
          Premium Results
        </h3>
        <p className="text-xs text-gray-500 dark:text-[#8a9a8e] mb-4 leading-relaxed">
          {user
            ? 'Unlock all strain matches, full science data, journal sync, and more.'
            : 'Create a free account or go premium to unlock all strain matches.'}
        </p>

        {user ? (
          /* Logged-in free user — show upgrade button */
          <Button
            size="lg"
            className="w-full shadow-lg shadow-leaf-500/25"
            onClick={handleUpgrade}
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {loading ? 'Loading...' : 'Upgrade for $9.99/mo'}
          </Button>
        ) : (
          /* Guest user — show sign up + upgrade options */
          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full shadow-lg shadow-leaf-500/25"
              onClick={() => navigate('/signup', { state: { from: { pathname: '/results' } } })}
            >
              <UserPlus size={16} />
              Sign Up Free
            </Button>
            <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
              or <button onClick={() => navigate('/login', { state: { from: { pathname: '/results' } } })} className="text-leaf-500 hover:text-leaf-400 underline underline-offset-2 transition-colors">sign in</button> if you have an account
            </p>
          </div>
        )}

        {error && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={() => { setError(null); handleUpgrade() }}
              className="text-[11px] text-leaf-500 hover:text-leaf-400 underline underline-offset-2 transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
