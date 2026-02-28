import { NavLink, useNavigate } from 'react-router-dom'
import { Search, BookOpen, LayoutDashboard, GitCompareArrows, BookMarked, LogOut, Shield, MapPin, UserPlus, Target } from 'lucide-react'
import clsx from 'clsx'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { APP_VERSION } from '../../utils/constants'

/* Nav items adapt based on auth state */
const coreItems = [
  { to: '/quiz', icon: Search, label: 'Find', guest: true },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', guest: false },
  { to: '/search', icon: Target, label: 'Search', guest: false },
  { to: '/journal', icon: BookMarked, label: 'Journal', guest: false },
  { to: '/compare', icon: GitCompareArrows, label: 'Compare', guest: false },
  { to: '/learn', icon: BookOpen, label: 'Learn', guest: true },
]

/* Guest-only items (replace protected nav items on mobile) */
const guestMobileItems = [
  { to: '/quiz', icon: Search, label: 'Find' },
  { to: '/dispensaries', icon: MapPin, label: 'Map' },
  { to: '/learn', icon: BookOpen, label: 'Learn' },
  { to: '/signup', icon: UserPlus, label: 'Sign Up' },
]

export default function NavBar() {
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

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
      <nav className="hidden sm:flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-white/[0.06] bg-white/80 dark:bg-leaf-900/80 backdrop-blur-md sticky top-0 z-40" role="navigation" aria-label="Main navigation">
        <NavLink to="/" className="flex items-center gap-2 text-lg font-bold font-display text-gray-900 dark:text-[#e8f0ea]">
          <span className="text-2xl">🌿</span>
          <div className="flex flex-col leading-tight">
            <span className="bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent">MyStrainAI</span>
            <span className="text-[9px] font-normal text-gray-400 dark:text-[#4a5a4e] tracking-wide">{APP_VERSION}</span>
          </div>
        </NavLink>
        <div className="flex items-center gap-1">
          {desktopItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/quiz'}
              className={({ isActive }) => clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-leaf-500/10 text-leaf-500'
                  : 'text-gray-500 dark:text-[#6a7a6e] hover:text-gray-700 dark:hover:text-[#b0c4b4] hover:bg-gray-100 dark:hover:bg-white/[0.04]'
              )}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}

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

          <div className="ml-2 border-l border-gray-200 dark:border-white/[0.08] pl-2 flex items-center gap-2">
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
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-1.5 border-t border-gray-200 dark:border-white/[0.06] bg-white/90 dark:bg-leaf-900/90 backdrop-blur-md safe-area-bottom" role="navigation" aria-label="Main navigation">
        {mobileItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/quiz'}
            className={({ isActive }) => clsx(
              'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-colors min-w-[56px]',
              isActive
                ? 'text-leaf-500'
                : 'text-gray-400 dark:text-[#4a5a4e]'
            )}
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
