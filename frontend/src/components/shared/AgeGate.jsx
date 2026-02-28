import { useState, useMemo } from 'react'
import { ShieldCheck, AlertCircle } from 'lucide-react'

const STORAGE_KEY = 'sf_age_verified'

/**
 * Full-screen age verification + legal disclaimer gate.
 * Requires date-of-birth entry (month + year) and validates ≥ 21.
 * Shows once per device — stores confirmation in localStorage.
 * Required for cannabis-related apps (21+ in most US jurisdictions).
 */

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

function calculateAge(month, year) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-indexed
  let age = currentYear - year
  if (currentMonth < month) age -= 1
  return age
}

export default function AgeGate({ children }) {
  const [verified, setVerified] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [error, setError] = useState('')
  const [declining, setDeclining] = useState(false)

  const currentYear = new Date().getFullYear()

  const yearOptions = useMemo(() => {
    const years = []
    for (let y = currentYear; y >= currentYear - 100; y--) {
      years.push(y)
    }
    return years
  }, [currentYear])

  const handleVerify = () => {
    const m = parseInt(month, 10)
    const y = parseInt(year, 10)

    if (!m || !y) {
      setError('Please select your birth month and year.')
      return
    }

    const age = calculateAge(m, y)

    if (age < 21) {
      setDeclining(true)
      setError('')
      return
    }

    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch { /* localStorage unavailable */ }
    setVerified(true)
  }

  if (verified) return children

  if (declining) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0f0c] px-6">
        <div className="max-w-sm text-center">
          <p className="text-lg font-bold text-[#e8f0ea] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Sorry, you must be 21 or older to use MyStrainAI.
          </p>
          <p className="text-sm text-[#8a9a8e] mb-6">
            Cannabis products are restricted to adults of legal age in your jurisdiction.
          </p>
          <button
            onClick={() => { setDeclining(false); setMonth(''); setYear(''); setError('') }}
            className="text-sm text-leaf-400 hover:text-leaf-300 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0f0c] px-6 overflow-y-auto">
      <div className="max-w-md w-full text-center py-10">
        {/* Logo */}
        <div className="text-5xl mb-4 select-none">{'\u{1F33F}'}</div>
        <h1
          className="text-2xl font-bold text-[#e8f0ea] mb-2"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          <span className="bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent">
            MyStrainAI
          </span>
        </h1>

        <p className="text-sm text-[#8a9a8e] mb-6">
          This website contains cannabis-related content intended for adults only.
        </p>

        <p className="text-base font-semibold text-[#e8f0ea] mb-5">
          Please enter your date of birth
        </p>

        {/* DOB Entry */}
        <div className="flex gap-3 justify-center mb-4 max-w-xs mx-auto">
          <select
            value={month}
            onChange={(e) => { setMonth(e.target.value); setError('') }}
            className="flex-1 px-3 py-3 text-sm rounded-xl bg-white/[0.06] border border-white/10 text-[#e8f0ea] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all appearance-none"
            aria-label="Birth month"
          >
            <option value="" disabled className="bg-[#0a0f0c] text-[#5a6a5e]">Month</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value} className="bg-[#0a0f0c] text-[#e8f0ea]">
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => { setYear(e.target.value); setError('') }}
            className="flex-1 px-3 py-3 text-sm rounded-xl bg-white/[0.06] border border-white/10 text-[#e8f0ea] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all appearance-none"
            aria-label="Birth year"
          >
            <option value="" disabled className="bg-[#0a0f0c] text-[#5a6a5e]">Year</option>
            {yearOptions.map((y) => (
              <option key={y} value={y} className="bg-[#0a0f0c] text-[#e8f0ea]">
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center justify-center gap-1.5 mb-4 text-red-400 text-xs animate-fade-in">
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
        )}

        {/* Legal disclaimers box */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 mb-6 text-left max-w-sm mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={14} className="text-leaf-400 flex-shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a9a8e]">
              By entering, you agree that:
            </span>
          </div>
          <ul className="space-y-2 text-[11px] leading-relaxed text-[#6a7a6e]">
            <li className="flex items-start gap-2">
              <span className="text-leaf-500 mt-0.5 flex-shrink-0">&bull;</span>
              <span>You are <strong className="text-[#8a9a8e]">21 years of age or older</strong> and legally permitted to view cannabis-related content in your jurisdiction.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-leaf-500 mt-0.5 flex-shrink-0">&bull;</span>
              <span>This site is for <strong className="text-[#8a9a8e]">legal use only</strong> in states and jurisdictions where cannabis is permitted by law. We do not encourage or advise breaking any local, state, or federal law.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-leaf-500 mt-0.5 flex-shrink-0">&bull;</span>
              <span>All content is <strong className="text-[#8a9a8e]">for informational purposes only</strong> and is based on open-source community data. Nothing on this site constitutes medical, legal, or professional advice.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-leaf-500 mt-0.5 flex-shrink-0">&bull;</span>
              <span>MyStrainAI provides <strong className="text-[#8a9a8e]">recommendations, not prescriptions</strong>. Individual experiences vary. Always consult a healthcare professional before using cannabis for medical purposes.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-leaf-500 mt-0.5 flex-shrink-0">&bull;</span>
              <span>We are <strong className="text-[#8a9a8e]">not liable</strong> for any adverse reactions, outcomes, or experiences resulting from use of any product or information found on this site.</span>
            </li>
          </ul>
        </div>

        {/* Verify button */}
        <button
          onClick={handleVerify}
          className="px-8 py-3 rounded-xl text-sm font-semibold bg-leaf-500 text-leaf-900 hover:bg-leaf-400 transition-colors shadow-lg shadow-leaf-500/25"
        >
          Verify &amp; Enter
        </button>

        <p className="text-[10px] text-[#3a4a3e] mt-6 leading-relaxed max-w-xs mx-auto">
          By verifying your age, you confirm that you are at least 21 years old,
          that you accept the terms above, and that cannabis use is legal in your jurisdiction.
          We do not store your date of birth.
        </p>
      </div>
    </div>
  )
}
