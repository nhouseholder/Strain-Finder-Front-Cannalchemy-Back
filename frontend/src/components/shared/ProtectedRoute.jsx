import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading, isFirebaseConfigured } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin-slow" />
      </div>
    )
  }

  // If Firebase is not configured, allow access (dev mode / demo mode)
  if (!isFirebaseConfigured) {
    return children
  }

  // If Firebase is configured but user not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
