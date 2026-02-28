import { Outlet, Link } from 'react-router-dom'
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
      <footer className="relative z-10 text-center py-6 pb-20 sm:pb-6">
        <p className="text-[9px] text-gray-300 dark:text-[#2a352c] mb-1 max-w-lg mx-auto px-4 leading-relaxed font-semibold">
          MyStrainAI is an informational software platform only. We do not sell, distribute, or deliver cannabis products. We are not a medical provider.
        </p>
        <p className="text-[9px] text-gray-300 dark:text-[#2a352c] mb-1.5 max-w-lg mx-auto px-4 leading-relaxed">
          For adults 21+ in legal jurisdictions only. For educational and informational purposes only &mdash; not medical, legal, or professional advice. Cannabis remains a Schedule I substance under federal law. Individual experiences vary. Always consult a healthcare professional before using cannabis. Do not use cannabis if pregnant or nursing.
        </p>
        <div className="flex items-center justify-center gap-3 text-[10px] text-gray-300 dark:text-[#2a352c]">
          <Link to="/terms" className="hover:text-gray-500 dark:hover:text-[#5a6a5e] transition-colors">Terms</Link>
          <span>&middot;</span>
          <Link to="/privacy" className="hover:text-gray-500 dark:hover:text-[#5a6a5e] transition-colors">Privacy</Link>
          <span>&middot;</span>
          <span>MyStrainAI &copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}
