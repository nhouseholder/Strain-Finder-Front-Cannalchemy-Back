import { Outlet } from 'react-router-dom'
import NavBar from './NavBar'
import BGGlow from './BGGlow'

export default function AppShell() {
  return (
    <div className="min-h-screen relative">
      <a href="#main-content" className="skip-link bg-leaf-500 text-leaf-900 font-semibold rounded-br-lg z-50">
        Skip to main content
      </a>
      <BGGlow />
      <NavBar />
      <main id="main-content" className="relative z-10 pb-20 sm:pb-8">
        <Outlet />
      </main>
      <footer className="relative z-10 text-center py-6 pb-20 sm:pb-6 text-[10px] text-gray-300 dark:text-[#2a352c]">
        Strain Finder &middot; AI-Powered Cannabis Science &middot; v4.1
      </footer>
    </div>
  )
}
