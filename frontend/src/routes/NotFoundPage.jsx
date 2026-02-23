import { Link } from 'react-router-dom'
import { MapPin, ArrowRight, Home } from 'lucide-react'
import usePageTitle from '../hooks/usePageTitle'
import Button from '../components/shared/Button'

export default function NotFoundPage() {
  usePageTitle('Page Not Found')
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white dark:bg-[#0a0f0c]">
      <div className="w-full max-w-sm text-center animate-fade-in">
        {/* Icon */}
        <div className="relative inline-block mb-6">
          <div className="absolute -inset-6 rounded-full bg-amber-500/10 blur-xl animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
            <MapPin size={32} className="text-amber-400" />
          </div>
        </div>

        <h1
          className="text-6xl font-extrabold text-gray-900 dark:text-[#e8f0ea] mb-2"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          404
        </h1>
        <p className="text-lg font-semibold text-gray-700 dark:text-[#b0c4b4] mb-2">
          Page not found
        </p>
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e] mb-8 leading-relaxed">
          This strain doesn't exist in our database.
          <br />
          Let's get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
          <Link to="/">
            <Button variant="secondary">
              <Home size={16} />
              Home
            </Button>
          </Link>
          <Link to="/quiz">
            <Button className="shadow-lg shadow-leaf-500/25">
              Find My Strain
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>

        <Link
          to="/learn"
          className="inline-block mt-6 text-xs text-gray-400 dark:text-[#6a7a6e] hover:text-leaf-500 transition-colors"
        >
          Or explore the Learn section →
        </Link>
      </div>
    </div>
  )
}
