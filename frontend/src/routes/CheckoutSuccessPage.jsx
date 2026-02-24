import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Button from '../components/shared/Button'
import { CheckCircle, Sparkles, ArrowRight } from 'lucide-react'

export default function CheckoutSuccessPage() {
  usePageTitle('Welcome to Premium')
  const [searchParams] = useSearchParams()
  const { refreshProfile } = useAuth()
  const toast = useToast()
  const [refreshed, setRefreshed] = useState(false)
  const sessionId = searchParams.get('session_id')

  // Refresh profile to pick up new subscription status
  // Retry a few times in case the webhook hasn't processed yet
  useEffect(() => {
    if (!sessionId || refreshed) return
    let attempts = 0
    const maxAttempts = 5

    const tryRefresh = async () => {
      attempts++
      await refreshProfile()
      // Check if profile now shows active (refreshProfile updates context)
      if (attempts < maxAttempts) {
        setTimeout(tryRefresh, 2000) // retry every 2s
      } else {
        setRefreshed(true)
        toast.success('Premium activated! All features unlocked.')
      }
    }

    // First attempt after 2s to give webhook time
    const timer = setTimeout(() => {
      tryRefresh()
    }, 2000)

    return () => clearTimeout(timer)
  }, [sessionId, refreshed, refreshProfile])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white dark:bg-[#0a0f0c]">
      <div className="w-full max-w-sm text-center animate-fade-in">
        {/* Success icon */}
        <div className="relative inline-block mb-6">
          <div className="absolute -inset-6 rounded-full bg-leaf-500/10 blur-xl animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-leaf-500/15 flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-leaf-500" />
          </div>
        </div>

        <h1
          className="text-2xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-2"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Welcome to Premium!
        </h1>

        <p className="text-sm text-gray-500 dark:text-[#8a9a8e] mb-2 leading-relaxed">
          Your subscription is active. You now have full access to all strain recommendations, science data, and premium features.
        </p>

        <div className="flex flex-wrap gap-2 justify-center mb-8 mt-4">
          {['Unlimited Results', 'Full Science Data', 'AI Analysis', 'Journal & Compare'].map(f => (
            <span key={f} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-leaf-500/10 text-leaf-500 border border-leaf-500/20">
              <Sparkles size={10} />
              {f}
            </span>
          ))}
        </div>

        <Link to="/quiz">
          <Button size="lg" className="w-full shadow-lg shadow-leaf-500/25">
            Find My Strains
            <ArrowRight size={16} />
          </Button>
        </Link>

        <Link
          to="/dashboard"
          className="inline-block mt-4 text-xs text-gray-400 dark:text-[#6a7a6e] hover:text-leaf-500 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
