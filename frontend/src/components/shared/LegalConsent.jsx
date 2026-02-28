import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, AlertTriangle } from 'lucide-react'

const STORAGE_KEY = 'sf_legal_consent'

/**
 * Legal consent gate — shown before quiz results for users who haven't
 * already consented via account creation (signup checkbox).
 * Stores consent in localStorage. Required for all users before viewing
 * AI-generated recommendations.
 */
export default function LegalConsent({ children }) {
  const [consented, setConsented] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false)
  const [error, setError] = useState('')

  const handleAccept = () => {
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy.')
      return
    }
    if (!acknowledgedRisk) {
      setError('You must acknowledge the health and legal disclaimers.')
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch { /* localStorage unavailable */ }
    setConsented(true)
  }

  if (consented) return children

  return (
    <div className="w-full max-w-lg mx-auto px-4 pt-8 pb-16 animate-fade-in">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={24} className="text-amber-500" />
        </div>
        <h2
          className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-2"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Before viewing your results
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e] leading-relaxed">
          Please review and accept the following terms to continue.
        </p>
      </div>

      {/* Disclaimer box */}
      <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.02] p-4 mb-5 text-left">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-[#8a9a8e]">
            Important Disclaimers
          </span>
        </div>
        <ul className="space-y-2 text-[11px] leading-relaxed text-gray-500 dark:text-[#6a7a6e]">
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5 flex-shrink-0">&bull;</span>
            <span><strong className="text-gray-600 dark:text-[#8a9a8e]">Not medical advice:</strong> All results are AI-generated informational suggestions based on community-reported data. They may contain inaccuracies and do not constitute medical, legal, or professional advice.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5 flex-shrink-0">&bull;</span>
            <span><strong className="text-gray-600 dark:text-[#8a9a8e]">Not a retailer:</strong> MyStrainAI does not sell, distribute, or deliver cannabis products. We are an informational software platform only.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5 flex-shrink-0">&bull;</span>
            <span><strong className="text-gray-600 dark:text-[#8a9a8e]">Health risks:</strong> Cannabis use carries inherent risks. Consult a healthcare professional before using cannabis, especially if pregnant, nursing, or managing mental health conditions.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5 flex-shrink-0">&bull;</span>
            <span><strong className="text-gray-600 dark:text-[#8a9a8e]">Your responsibility:</strong> You are solely responsible for complying with all applicable laws in your jurisdiction. Cannabis is federally illegal in the US.</span>
          </li>
        </ul>
      </div>

      {/* Consent checkboxes */}
      <div className="space-y-3 mb-5">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => { setAgreedToTerms(e.target.checked); setError('') }}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-white/20 text-leaf-500 focus:ring-leaf-500/40 flex-shrink-0"
          />
          <span className="text-xs text-gray-500 dark:text-[#6a7a6e] leading-relaxed">
            I have read and agree to the{' '}
            <Link to="/terms" target="_blank" className="text-leaf-500 hover:text-leaf-400 underline">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" target="_blank" className="text-leaf-500 hover:text-leaf-400 underline">Privacy Policy</Link>.
          </span>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledgedRisk}
            onChange={(e) => { setAcknowledgedRisk(e.target.checked); setError('') }}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-white/20 text-leaf-500 focus:ring-leaf-500/40 flex-shrink-0"
          />
          <span className="text-xs text-gray-500 dark:text-[#6a7a6e] leading-relaxed">
            I understand that these results are AI-generated, may contain errors, are for educational purposes only, and do not replace professional medical advice. I assume all risk for any decisions I make based on this information.
          </span>
        </label>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 text-center mb-3">{error}</p>
      )}

      {/* Accept button */}
      <button
        onClick={handleAccept}
        className="w-full px-6 py-3 rounded-xl text-sm font-semibold bg-leaf-500 text-leaf-900 hover:bg-leaf-400 transition-colors shadow-lg shadow-leaf-500/25"
      >
        I Understand &mdash; Show My Results
      </button>

      <p className="text-[9px] text-gray-300 dark:text-[#6a7a6e] text-center mt-4 leading-relaxed">
        This consent is stored locally on your device. You will not be asked again unless you clear your browser data.
      </p>
    </div>
  )
}
