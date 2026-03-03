import { useState, useEffect, useRef, useContext, useCallback } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Search, BookOpen, LayoutDashboard, GitCompareArrows, BookMarked, LogOut, Shield, MapPin, UserPlus, ClipboardList, Brain, Sparkles, RotateCcw, SlidersHorizontal } from 'lucide-react'
import clsx from 'clsx'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { ResultsContext } from '../../context/ResultsContext'
import { APP_VERSION } from '../../utils/constants'

/* Nav items adapt based on auth state */
const coreItems = [
  { to: '/quiz', icon: ClipboardList, label: 'Quiz', guest: true },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', guest: false },
  { to: '/search', icon: Search, label: 'Search', guest: true },
  { to: '/explore', icon: SlidersHorizontal, label: 'Explorer', guest: true },
  { to: '/journal', icon: BookMarked, label: 'Journal', guest: false },
  { to: '/compare', icon: GitCompareArrows, label: 'Compare', guest: false },
  { to: '/preferences', icon: Brain, label: 'Taste Profile', guest: false },
  { to: '/learn', icon: BookOpen, label: 'Learn', guest: true },
]

/* Guest-only items (replace protected nav items on mobile) */
const guestMobileItems = [
  { to: '/quiz', icon: ClipboardList, label: 'Quiz' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/explore', icon: SlidersHorizontal, label: 'Explorer' },
  { to: '/learn', icon: BookOpen, label: 'Learn' },
  { to: '/signup', icon: UserPlus, label: 'Sign Up' },
]

export default function NavBar() {
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const { hasResults } = useContext(ResultsContext)

  /* Quiz overlay state */
  const [quizOverlay, setQuizOverlay] = useState(false)
  const desktopOverlayRef = useRef(null)
  const mobileOverlayRef = useRef(null)

  /* Close quiz overlay on outside click */
  useEffect(() => {
    if (!quizOverlay) return
    const handleClick = (e) => {
      if (
        (desktopOverlayRef.current && desktopOverlayRef.current.contains(e.target)) ||
        (mobileOverlayRef.current && mobileOverlayRef.current.contains(e.target))
      ) return
      setQuizOverlay(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [quizOverlay])

  /* Close overlay on route change */
  useEffect(() => { setQuizOverlay(false) }, [location.pathname])

  const handleQuizClick = useCallback((e) => {
    if (hasResults) {
      e.preventDefault()
      setQuizOverlay((v) => !v)
    }
    // else: default NavLink navigation to /quiz
  }, [hasResults])

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out successfully')
    navigate('/')
  }

  const initial = user?.email?.[0]?.toUpperCase() || '?'

  // Desktop nav shows all items regardless (protected routes redirect themselves)
  const desktopItems = user ? coreItems : coreItems.filter(i => i.guest)
  // Mobile nav is simplified for guests
  const mobileItems = user ? coreItems : guestMobileItems

  return (
    <>
      {/* Desktop top bar */}
      <nav className="hidden sm:flex items-center justify-between px-6 py-3 border-b border-gray-200/70 dark:border-white/[0.07] bg-[#f4f7f5]/90 dark:bg-leaf-900/85 backdrop-blur-xl sticky top-0 z-40 shadow-sm dark:shadow-none" role="navigation" aria-label="Main navigation">
        <NavLink to="/" className="flex items-center gap-2 text-lg font-bold font-display text-gray-900 dark:text-[#e8f0ea]">
          <span className="text-2xl">🌿</span>
          <div className="flex flex-col leading-tight">
            <span className="bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent">MyStrainAI</span>
            <span className="text-[9px] font-normal text-gray-400 dark:text-[#7a9a7e] tracking-wide">{APP_VERSION}</span>
          </div>
        </NavLink>
        <div className="flex items-center gap-1">
          {desktopItems.map(({ to, icon: Icon, label }) => {
            const isQuiz = to === '/quiz'
            return (
              <div key={to} className={isQuiz ? 'relative' : undefined}>
                <NavLink
                  to={to}
                  end={isQuiz}
                  onClick={isQuiz ? handleQuizClick : undefined}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-leaf-500/15 text-leaf-500 dark:text-leaf-400'
                      : 'text-gray-500 dark:text-[#8a9a8e] hover:text-gray-800 dark:hover:text-[#c8dccb] hover:bg-gray-100/80 dark:hover:bg-white/[0.06]'
                  )}
                >
                  <Icon size={16} />
                  {label}
                </NavLink>

                {/* Quiz overlay dropdown */}
                {isQuiz && quizOverlay && (
                  <div
                    ref={desktopOverlayRef}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 rounded-2xl bg-white dark:bg-[#141f16] border border-gray-200 dark:border-white/10 shadow-2xl z-50 overflow-hidden animate-fade-in"
                  >
                    {/* Decorative header */}
                    <div className="px-4 pt-4 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🌿</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-[#e0f0e4]">Welcome Back</span>
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-[#6a7a6e]">
                        Pick up where you left off or start fresh.
                      </p>
                    </div>

                    <div className="px-3 pb-3 space-y-1.5">
                      {/* View previous results */}
                      <button
                        onClick={() => { setQuizOverlay(false); navigate('/results') }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-leaf-500/10 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-leaf-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-leaf-500/25 transition-colors">
                          <Sparkles size={16} className="text-leaf-500" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-gray-800 dark:text-[#d0e4d4] block">My Matches</span>
                          <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">View your personalized results</span>
                        </div>
                      </button>

                      {/* Take new quiz */}
                      <button
                        onClick={() => { setQuizOverlay(false); navigate('/quiz?fresh=1') }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-purple-500/10 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/25 transition-colors">
                          <RotateCcw size={16} className="text-purple-400" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-gray-800 dark:text-[#d0e4d4] block">Fresh Start</span>
                          <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">Take a new quiz from scratch</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Admin link */}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-purple-500/10 text-purple-500'
                  : 'text-purple-400/60 hover:text-purple-400 hover:bg-purple-500/10'
              )}
            >
              <Shield size={16} />
              Admin
            </NavLink>
          )}

          <div className="ml-2 border-l border-gray-200/70 dark:border-white/[0.10] pl-2 flex items-center gap-2">
            <ThemeToggle />

            {user ? (
              <div className="flex items-center gap-2">
                {/* User initial badge */}
                <div className="w-7 h-7 rounded-full bg-leaf-500/15 flex items-center justify-center text-xs font-bold text-leaf-500" title={user.email}>
                  {initial}
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-[#6a7a6e] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <NavLink
                  to="/login"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-[#6a7a6e] hover:text-gray-700 dark:hover:text-[#b0c4b4] transition-colors"
                >
                  Log In
                </NavLink>
                <NavLink
                  to="/signup"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-leaf-500/10 text-leaf-500 hover:bg-leaf-500/20 transition-colors"
                >
                  Sign Up
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-1.5 border-t border-gray-200/70 dark:border-white/[0.06] bg-[#f4f7f5]/95 dark:bg-leaf-900/92 backdrop-blur-xl safe-area-bottom" style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom, 0.375rem))' }} role="navigation" aria-label="Main navigation">
        {mobileItems.map(({ to, icon: Icon, label }) => {
          const isQuiz = to === '/quiz'
          return (
            <div key={to} className={isQuiz ? 'relative' : undefined}>
              <NavLink
                to={to}
                end={isQuiz}
                onClick={isQuiz ? handleQuizClick : undefined}
                className={({ isActive }) => clsx(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-colors min-w-[56px]',
                  isActive
                    ? 'text-leaf-400'
                    : 'text-gray-400 dark:text-[#8a9a8e]'
                )}
              >
                <Icon size={20} />
                {label}
              </NavLink>

              {/* Mobile quiz overlay – appears above the bottom bar */}
              {isQuiz && quizOverlay && (
                <div
                  ref={mobileOverlayRef}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 rounded-2xl bg-white dark:bg-[#141f16] border border-gray-200 dark:border-white/10 shadow-2xl z-50 overflow-hidden animate-fade-in"
                >
                  <div className="px-3 pt-3 pb-1.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base">🌿</span>
                      <span className="text-xs font-bold text-gray-800 dark:text-[#e0f0e4]">Welcome Back</span>
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
                      Pick up where you left off or start fresh.
                    </p>
                  </div>
                  <div className="px-2.5 pb-2.5 space-y-1">
                    <button
                      onClick={() => { setQuizOverlay(false); navigate('/results') }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-leaf-500/10 active:bg-leaf-500/15 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-leaf-500/15 flex items-center justify-center flex-shrink-0">
                        <Sparkles size={14} className="text-leaf-500" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-800 dark:text-[#d0e4d4] block">My Matches</span>
                        <span className="text-[9px] text-gray-400 dark:text-[#6a7a6e]">View your results</span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setQuizOverlay(false); navigate('/quiz?fresh=1') }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-purple-500/10 active:bg-purple-500/15 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                        <RotateCcw size={14} className="text-purple-400" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-800 dark:text-[#d0e4d4] block">Fresh Start</span>
                        <span className="text-[9px] text-gray-400 dark:text-[#6a7a6e]">Take a new quiz</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </>
  )
}
