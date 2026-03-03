import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'
import Button from './Button'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)

    // Auto-reload once on stale chunk / dynamic import failures (e.g. after a new deploy)
    const isChunkError =
      error?.message?.includes('dynamically imported module') ||
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Loading CSS chunk')

    const reloadKey = 'eb-chunk-reload'
    if (isChunkError && !sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, '1')
      window.location.reload()
      return
    }
    // Clear the flag so future deploys can retry again
    sessionStorage.removeItem(reloadKey)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-[#e8f0ea]" style={{ fontFamily: "'Playfair Display', serif" }}>
            Something went wrong
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#6a7a6e] mb-1 max-w-sm leading-relaxed line-clamp-3">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mb-6">
            Try refreshing the page or going back.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
            <Button onClick={() => this.setState({ hasError: false, error: null })}>
              Try Again
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
