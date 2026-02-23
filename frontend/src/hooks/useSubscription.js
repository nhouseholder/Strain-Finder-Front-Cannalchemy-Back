import { useAuth } from '../context/AuthContext'

const FREE_LIMIT = 2

export function useSubscription() {
  const { isPremium, user } = useAuth()

  const canViewResult = (index) => isPremium || index < FREE_LIMIT

  return {
    isPremium,
    canViewResult,
    FREE_LIMIT,
    user,
  }
}
