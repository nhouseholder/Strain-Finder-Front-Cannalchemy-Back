import { useState, useEffect } from 'react'

const STORAGE_KEY = 'sf_age_verified'

/**
 * Full-screen age verification gate.
 * Shows once per device — stores confirmation in localStorage.
 * Required for cannabis-related apps (21+ in most US jurisdictions).
 */
export default function AgeGate({ children }) {
  const [verified, setVerified] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [declining, setDeclining] = useState(false)

  const handleConfirm = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch { /* localStorage unavailable */ }
    setVerified(true)
  }

  const handleDecline = () => {
    setDeclining(true)
  }

  if (verified) return children

  if (declining) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0f0c] px-6">
        <div className="max-w-sm text-center">
          <p className="text-lg font-bold text-[#e8f0ea] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Sorry, you must be 21 or older to use Strain Finder.
          </p>
          <p className="text-sm text-[#8a9a8e] mb-6">
            Cannabis products are restricted to adults of legal age in your jurisdiction.
          </p>
          <button
            onClick={() => setDeclining(false)}
            className="text-sm text-leaf-400 hover:text-leaf-300 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0f0c] px-6">
      <div className="max-w-sm text-center">
        {/* Logo */}
        <div className="text-5xl mb-4 select-none">{'\u{1F33F}'}</div>
        <h1
          className="text-2xl font-bold text-[#e8f0ea] mb-2"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          <span className="bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent">
            Strain Finder
          </span>
        </h1>

        <p className="text-sm text-[#8a9a8e] mb-8">
          This website contains cannabis-related content intended for adults only.
        </p>

        <p className="text-base font-semibold text-[#e8f0ea] mb-6">
          Are you 21 years of age or older?
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={handleConfirm}
            className="px-8 py-3 rounded-xl text-sm font-semibold bg-leaf-500 text-leaf-900 hover:bg-leaf-400 transition-colors shadow-lg shadow-leaf-500/25"
          >
            Yes, I'm 21+
          </button>
          <button
            onClick={handleDecline}
            className="px-8 py-3 rounded-xl text-sm font-semibold bg-white/[0.06] text-[#8a9a8e] border border-white/10 hover:bg-white/[0.1] transition-colors"
          >
            No
          </button>
        </div>

        <p className="text-[10px] text-[#3a4a3e] mt-8 leading-relaxed max-w-xs mx-auto">
          By entering this site you acknowledge that cannabis products are only for use where
          legally permitted and by adults of legal age in your jurisdiction.
        </p>
      </div>
    </div>
  )
}
