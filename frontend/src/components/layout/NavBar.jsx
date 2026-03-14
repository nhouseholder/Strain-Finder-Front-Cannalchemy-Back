import { useState, useEffect, useRef, useContext, useCallback } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Search, BookOpen, GitCompareArrows, BookMarked, LogOut, Shield,
  ClipboardList, Sparkles, RotateCcw, SlidersHorizontal, Compass,
  Leaf, Beaker, Dna, Info, MessageCircle, Map, Users,
  ChevronDown, Menu, X,
} from 'lucide-react'
import clsx from 'clsx'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { ResultsContext } from '../../context/ResultsContext'
import { APP_VERSION } from '../../utils/constants'
import { useStrainSearch } from '../../hooks/useStrainSearch'
import SearchAutocomplete from '../shared/SearchAutocomplete'

/* ─── Grouped sub-pages ─── */

const EXPLORE_PAGES = [
  { to: '/explore', icon: SlidersHorizontal, label: 'Explorer', color: 'text-teal-400', desc: 'Filter by effects & terpenes' },
  { to: '/explore-strains', icon: Compass, label: 'Discover', color: 'text-orange-400', desc: 'Browse curated collections' },
  { to: '/compare', icon: GitCompareArrows, label: 'Compare', color: 'text-cyan-400', desc: 'Compare strains side by side' },
]

const LEARN_PAGES = [
  { to: '/learn/terpenes', icon: Leaf, label: 'Terpenes', color: 'text-purple-400', desc: 'Aromatic compounds that shape effects' },
  { to: '/learn/cannabinoids', icon: Beaker, label: 'Cannabinoids', color: 'text-green-400', desc: 'Active compounds in cannabis' },
  { to: '/learn/entourage', icon: Sparkles, label: 'Entourage Effect', color: 'text-amber-400', desc: 'How compounds work together' },
  { to: '/learn/archetypes', icon: Dna, label: 'Strain Archetypes', color: 'text-indigo-400', desc: 'Terpene profile estimation system' },
  { to: '/learn/about', icon: Info, label: 'About MyStrainAI', color: 'text-leaf-400', desc: 'Our mission and methodology' },
]

/* ─── Reusable desktop dropdown panel ─── */

function DropdownPanel({ items, title, titleIcon: TitleIcon, onNavigate, align = 'left' }) {
  return (
    <div className={clsx(
      'absolute top-full mt-2 w-72 rounded-2xl bg-white dark:bg-[#141f16] border border-gray-200 dark:border-white/10 shadow-2xl z-50 overflow-hidden animate-fade-in',
      align === 'right' ? 'right-0' : 'left-0'
    )}>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <TitleIcon size={16} className="text-leaf-400" />
          <span className="text-sm font-bold text-gray-800 dark:text-[#e0f0e4]">{title}</span>
        </div>
      </div>
      <div className="px-3 pb-3 space-y-1">
        {items.map(({ to, icon: Icon, label, color, desc }) => (
          <button
            key={to}
            onClick={() => onNavigate(to)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-leaf-500/[0.06] transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] dark:bg-white/[0.04] flex items-center justify-center flex-shrink-0 group-hover:bg-leaf-500/10 transition-colors">
              <Icon size={16} className={color} />
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-800 dark:text-[#d0e4d4] block">{label}</span>
              <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">{desc}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Desktop dropdown trigger ─── */

function DropdownTrigger({ icon: Icon, label, isActive, isOpen, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
        isActive || isOpen
          ? 'bg-leaf-500/15 text-leaf-500 dark:text-leaf-400'
          : 'text-gray-500 dark:text-[#8a9a8e] hover:text-gray-800 dark:hover:text-[#c8dccb] hover:bg-gray-100/80 dark:hover:bg-white/[0.06]'
      )}
    >
      <Icon size={16} />
      {label}
      <ChevronDown size={12} className={clsx('transition-transform', isOpen && 'rotate-180')} />
    </button>
  )
}

/* ─── NavBar ─── */

export default function NavBar() {
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const { hasResults } = useContext(ResultsContext)
  const { allStrains, dataLoaded } = useStrainSearch()

  /* Single state controls all dropdowns: 'quiz' | 'search' | 'explore' | 'learn' | 'more' | null */
  const [activeDropdown, setActiveDropdown] = useState(null)

  /* Refs for outside-click detection */
  const dQuizRef = useRef(null)
  const dSearchRef = useRef(null)
  const dExploreRef = useRef(null)
  const dLearnRef = useRef(null)
  const mQuizRef = useRef(null)
  const mSearchRef = useRef(null)
  const mMoreRef = useRef(null)

  /* Close on outside click */
  useEffect(() => {
    if (!activeDropdown) return
    const handler = (e) => {
      const allRefs = [dQuizRef, dSearchRef, dExploreRef, dLearnRef, mQuizRef, mSearchRef, mMoreRef]
      for (const ref of allRefs) {
        if (ref.current?.contains(e.target)) return
      }
      setActiveDropdown(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeDropdown])

  /* Close on route change */
  useEffect(() => { setActiveDropdown(null) }, [location.pathname])

  const toggle = useCallback((name) => (e) => {
    e.preventDefault()
    setActiveDropdown(prev => prev === name ? null : name)
  }, [])

  const handleQuizClick = useCallback((e) => {
    if (hasResults) {
      e.preventDefault()
      setActiveDropdown(prev => prev === 'quiz' ? null : 'quiz')
    }
  }, [hasResults])

  const go = useCallback((to) => {
    setActiveDropdown(null)
    navigate(to)
  }, [navigate])

  const handleSignOut = async () => {
    setActiveDropdown(null)
    await signOut()
    toast.success('Signed out successfully')
    navigate('/')
  }

  const initial = user?.email?.[0]?.toUpperCase() || '?'

  /* Active-state detection for grouped items */
  const isExploreActive = ['/explore', '/explore-strains', '/compare'].some(p => location.pathname.startsWith(p))
  const isLearnActive = location.pathname.startsWith('/learn')

  /* Shared active / inactive class sets */
  const navCls = (isActive) => clsx(
    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
    isActive
      ? 'bg-leaf-500/15 text-leaf-500 dark:text-leaf-400'
      : 'text-gray-500 dark:text-[#8a9a8e] hover:text-gray-800 dark:hover:text-[#c8dccb] hover:bg-gray-100/80 dark:hover:bg-white/[0.06]'
  )

  return (
    <>
      {/* ═══════════════════════════════════════════
          Desktop top bar  — 7 items (+ admin if admin)
          Quiz | Search | Explore▾ | AI Chat | Maps | Journal | Learn▾
         ═══════════════════════════════════════════ */}
      <nav
        className="hidden sm:flex items-center justify-between px-6 py-3 border-b border-gray-200/70 dark:border-white/[0.07] bg-[#f4f7f5]/90 dark:bg-leaf-900/85 backdrop-blur-xl sticky top-0 z-40 shadow-sm dark:shadow-none"
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 text-lg font-bold font-display text-gray-900 dark:text-[#e8f0ea] flex-shrink-0 mr-4">
          <span className="text-2xl">🌿</span>
          <div className="flex flex-col leading-tight">
            <span className="bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent">MyStrainAI</span>
            <span className="text-[9px] font-normal text-gray-400 dark:text-[#7a9a7e] tracking-wide">{APP_VERSION}</span>
          </div>
        </NavLink>

        <div className="flex items-center gap-1">

          {/* 1 · Quiz (with returning-user overlay) */}
          <div className="relative" ref={dQuizRef}>
            <NavLink
              to="/quiz"
              end
              onClick={handleQuizClick}
              className={({ isActive }) => navCls(isActive)}
            >
              <ClipboardList size={16} />
              Quiz
            </NavLink>

            {activeDropdown === 'quiz' && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 rounded-2xl bg-white dark:bg-[#141f16] border border-gray-200 dark:border-white/10 shadow-2xl z-50 overflow-hidden animate-fade-in">
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
                  <button
                    onClick={() => go('/results')}
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
                  <button
                    onClick={() => go('/quiz?fresh=1')}
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

          {/* 2 · Search */}
          <div className="relative" ref={dSearchRef}>
            <button
              onClick={toggle('search')}
              className={navCls(activeDropdown === 'search' || location.pathname === '/search')}
            >
              <Search size={16} />
              Search
            </button>

            {activeDropdown === 'search' && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[400px] rounded-2xl bg-white dark:bg-[#141f16] border border-gray-200 dark:border-white/10 shadow-2xl z-50 overflow-visible animate-fade-in p-2">
                <SearchAutocomplete
                  strains={allStrains}
                  dataLoaded={dataLoaded}
                  placeholder="Search strains by name, type, effects..."
                  autoFocus={true}
                  onSelect={() => setActiveDropdown(null)}
                  onSearch={(q) => {
                    setActiveDropdown(null)
                    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
                  }}
                  inputClassName="py-2.5 rounded-xl text-sm"
                />
              </div>
            )}
          </div>

          {/* 3 · Explore ▾  (Explorer, Discover, Compare) */}
          <div className="relative" ref={dExploreRef}>
            <DropdownTrigger
              icon={Compass}
              label="Explore"
              isActive={isExploreActive}
              isOpen={activeDropdown === 'explore'}
              onClick={toggle('explore')}
            />
            {activeDropdown === 'explore' && (
              <DropdownPanel
                items={EXPLORE_PAGES}
                title="Explore Strains"
                titleIcon={Compass}
                onNavigate={go}
              />
            )}
          </div>

          {/* 4 · AI Chat */}
          <NavLink to="/chat" className={({ isActive }) => navCls(isActive)}>
            <MessageCircle size={16} />
            <span className="whitespace-nowrap">AI Chat</span>
          </NavLink>

          {/* 5 · Maps */}
          <NavLink to="/dispensaries" className={({ isActive }) => navCls(isActive)}>
            <Map size={16} />
            Maps
          </NavLink>

          {/* 6 · Journal (auth-only) */}
          {user && (
            <NavLink to="/journal" className={({ isActive }) => navCls(isActive)}>
              <BookMarked size={16} />
              Journal
            </NavLink>
          )}

          {/* 7 · Learn ▾  (Terpenes, Cannabinoids, Entourage, Archetypes, About) */}
          <div className="relative" ref={dLearnRef}>
            <DropdownTrigger
              icon={BookOpen}
              label="Learn"
              isActive={isLearnActive}
              isOpen={activeDropdown === 'learn'}
              onClick={toggle('learn')}
            />
            {activeDropdown === 'learn' && (
              <DropdownPanel
                items={LEARN_PAGES}
                title="Cannabis Education"
                titleIcon={BookOpen}
                onNavigate={go}
                align="right"
              />
            )}
          </div>

          {/* Admin (only visible to admins) */}
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

          {/* ─ Divider · Theme · Auth ─ */}
          <div className="ml-2 border-l border-gray-200/70 dark:border-white/[0.10] pl-2 flex items-center gap-2">
            <ThemeToggle />

            {user ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-leaf-500/15 flex items-center justify-center text-xs font-bold text-leaf-500" title={user.email}>
                  {initial}
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-lg text-xs font-medium text-gray-500 dark:text-[#6a7a6e] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <NavLink to="/login" className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-[#6a7a6e] hover:text-gray-700 dark:hover:text-[#b0c4b4] transition-colors">
                  Log In
                </NavLink>
                <NavLink to="/signup" className="px-3 py-1.5 rounded-lg text-xs font-medium bg-leaf-500/10 text-leaf-500 hover:bg-leaf-500/20 transition-colors">
                  Sign Up
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════
          Mobile bottom bar — 5 items
          Quiz | Search | Chat | Maps | More≡
         ═══════════════════════════════════════════ */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-1.5 border-t border-gray-200/70 dark:border-white/[0.06] bg-[#f4f7f5]/95 dark:bg-leaf-900/92 backdrop-blur-xl safe-area-bottom"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom, 0.375rem))' }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Quiz */}
        <div className="relative" ref={mQuizRef}>
          <NavLink
            to="/quiz"
            end
            onClick={handleQuizClick}
            className={({ isActive }) => clsx(
              'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium transition-colors min-w-[56px] min-h-[44px] justify-center',
              isActive ? 'text-leaf-400' : 'text-gray-400 dark:text-[#8a9a8e]'
            )}
          >
            <ClipboardList size={20} />
            Quiz
          </NavLink>

          {/* Mobile quiz overlay */}
          {activeDropdown === 'quiz' && (
            <div
              className="fixed left-4 right-4 rounded-2xl bg-white dark:bg-[#141f16] border border-gray-200 dark:border-white/10 shadow-2xl z-50 overflow-hidden animate-fade-in"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)' }}
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
                  onClick={() => go('/results')}
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
                  onClick={() => go('/quiz?fresh=1')}
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

        {/* Search (dropdown) */}
        <div className="relative" ref={mSearchRef}>
          <button
            onClick={toggle('search')}
            className={clsx(
              'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium transition-colors min-w-[56px] min-h-[44px] justify-center',
              activeDropdown === 'search' ? 'text-leaf-400' : 'text-gray-400 dark:text-[#8a9a8e]'
            )}
          >
            <Search size={20} />
            Search
          </button>

          {/* Mobile search overlay */}
          {activeDropdown === 'search' && (
            <div
              className="fixed left-4 right-4 rounded-2xl bg-white dark:bg-[#141f16] border border-gray-200 dark:border-white/10 shadow-2xl z-50 overflow-visible animate-fade-in p-2"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)' }}
            >
              <SearchAutocomplete
                strains={allStrains}
                dataLoaded={dataLoaded}
                placeholder="Search strains..."
                autoFocus={true}
                onSelect={() => setActiveDropdown(null)}
                onSearch={(q) => {
                  setActiveDropdown(null)
                  if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
                }}
                inputClassName="py-3 rounded-xl text-sm"
              />
            </div>
          )}
        </div>

        {/* Chat (direct) */}
        <NavLink
          to="/chat"
          className={({ isActive }) => clsx(
            'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium transition-colors min-w-[56px] min-h-[44px] justify-center',
            isActive ? 'text-leaf-400' : 'text-gray-400 dark:text-[#8a9a8e]'
          )}
        >
          <MessageCircle size={20} />
          Chat
        </NavLink>

        {/* Maps (direct) */}
        <NavLink
          to="/dispensaries"
          className={({ isActive }) => clsx(
            'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium transition-colors min-w-[56px] min-h-[44px] justify-center',
            isActive ? 'text-leaf-400' : 'text-gray-400 dark:text-[#8a9a8e]'
          )}
        >
          <Map size={20} />
          Maps
        </NavLink>

        {/* More ≡ (opens bottom sheet) */}
        <div className="relative" ref={mMoreRef}>
          <button
            onClick={toggle('more')}
            className={clsx(
              'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium transition-colors min-w-[56px] min-h-[44px] justify-center',
              activeDropdown === 'more' ? 'text-leaf-400' : 'text-gray-400 dark:text-[#8a9a8e]'
            )}
          >
            <Menu size={20} />
            More
          </button>

          {/* ─── Mobile bottom sheet ─── */}
          {activeDropdown === 'more' && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/30 z-40 animate-fade-in"
                onClick={() => setActiveDropdown(null)}
              />

              <div
                className="fixed left-0 right-0 bottom-0 rounded-t-3xl bg-white dark:bg-[#141f16] border-t border-gray-200 dark:border-white/10 shadow-2xl z-50 overflow-hidden animate-fade-in"
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/15" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-2">
                  <span className="text-sm font-bold text-gray-800 dark:text-[#e0f0e4]">Menu</span>
                  <button
                    onClick={() => setActiveDropdown(null)}
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <X size={18} className="text-gray-400 dark:text-[#6a7a6e]" />
                  </button>
                </div>

                <div
                  className="px-4 pb-4 space-y-4 max-h-[65vh] overflow-y-auto"
                  style={{ paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
                >
                  {/* Explore section */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-[#6a7a6e] uppercase tracking-wider px-1 mb-1.5">
                      Explore
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {EXPLORE_PAGES.map(({ to, icon: Icon, label, color }) => (
                        <button
                          key={to}
                          onClick={() => go(to)}
                          className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-left hover:bg-leaf-500/[0.06] active:bg-leaf-500/10 transition-colors min-h-[48px]"
                        >
                          <Icon size={18} className={color} />
                          <span className="text-sm font-medium text-gray-700 dark:text-[#c0d4c4]">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Community & Tools */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-[#6a7a6e] uppercase tracking-wider px-1 mb-1.5">
                      Community & Tools
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => go('/community')}
                        className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-left hover:bg-leaf-500/[0.06] active:bg-leaf-500/10 transition-colors min-h-[48px]"
                      >
                        <Users size={18} className="text-violet-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-[#c0d4c4]">Community</span>
                      </button>
                      {user && (
                        <button
                          onClick={() => go('/journal')}
                          className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-left hover:bg-leaf-500/[0.06] active:bg-leaf-500/10 transition-colors min-h-[48px]"
                        >
                          <BookMarked size={18} className="text-emerald-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-[#c0d4c4]">Journal</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Learn section */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-[#6a7a6e] uppercase tracking-wider px-1 mb-1.5">
                      Learn
                    </p>
                    <div className="space-y-0.5">
                      {LEARN_PAGES.map(({ to, icon: Icon, label, color, desc }) => (
                        <button
                          key={to}
                          onClick={() => go(to)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left hover:bg-leaf-500/[0.06] active:bg-leaf-500/10 transition-colors min-h-[44px]"
                        >
                          <Icon size={16} className={color} />
                          <div>
                            <span className="text-sm font-medium text-gray-700 dark:text-[#c0d4c4] block">{label}</span>
                            <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">{desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Account section */}
                  <div className="border-t border-gray-200/70 dark:border-white/[0.06] pt-3">
                    <div className="flex items-center gap-3">
                      <ThemeToggle />

                      {user ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-leaf-500/15 flex items-center justify-center text-xs font-bold text-leaf-500 flex-shrink-0">
                            {initial}
                          </div>
                          <span className="text-xs text-gray-500 dark:text-[#8a9a8e] truncate flex-1">{user.email}</span>
                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0 min-h-[44px]"
                          >
                            <LogOut size={14} />
                            Sign Out
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <NavLink
                            to="/login"
                            onClick={() => setActiveDropdown(null)}
                            className="px-4 py-2.5 rounded-xl text-xs font-medium text-gray-600 dark:text-[#8a9a8e] hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors min-h-[44px] flex items-center"
                          >
                            Log In
                          </NavLink>
                          <NavLink
                            to="/signup"
                            onClick={() => setActiveDropdown(null)}
                            className="px-4 py-2.5 rounded-xl text-xs font-medium bg-leaf-500 text-white hover:bg-leaf-400 transition-colors min-h-[44px] flex items-center"
                          >
                            Sign Up
                          </NavLink>
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => go('/admin')}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl mt-2 text-sm font-medium text-purple-400 hover:bg-purple-500/10 transition-colors w-full text-left min-h-[44px]"
                      >
                        <Shield size={16} />
                        Admin Panel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </nav>
    </>
  )
}
