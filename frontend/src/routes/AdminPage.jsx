import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { db, isFirebaseConfigured } from '../services/firebase'
import {
  collection,
  getDocs,
  updateDoc,
  doc,
} from 'firebase/firestore'
import usePageTitle from '../hooks/usePageTitle'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import { Shield, Users, Crown, RefreshCw, Search, CheckCircle, XCircle } from 'lucide-react'

export default function AdminPage() {
  usePageTitle('Admin Dashboard')
  const { isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState(null)
  const [stats, setStats] = useState({ total: 0, premium: 0, free: 0 })

  /* ---- Redirect non-admin ---- */
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAdmin, authLoading, navigate])

  /* ---- Fetch all users ---- */
  const fetchUsers = useCallback(async () => {
    if (!db) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'profiles'))
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => {
        const aTime = a.created_at?.toMillis?.() || 0
        const bTime = b.created_at?.toMillis?.() || 0
        return bTime - aTime
      })
      setUsers(data || [])
      const premiumCount = (data || []).filter(u => u.subscription_status === 'active').length
      setStats({
        total: data?.length || 0,
        premium: premiumCount,
        free: (data?.length || 0) - premiumCount,
      })
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) fetchUsers()
  }, [isAdmin, fetchUsers])

  /* ---- Toggle premium status ---- */
  const togglePremium = async (userId, currentStatus) => {
    if (!db) return
    setUpdating(userId)
    try {
      const newStatus = currentStatus === 'active' ? 'free' : 'active'
      const updates = {
        subscription_status: newStatus,
        ...(newStatus === 'active'
          ? { subscription_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() }
          : { subscription_end: null }
        ),
      }
      const profileRef = doc(db, 'profiles', userId)
      await updateDoc(profileRef, updates)

      // Update local state
      setUsers(prev => prev.map(u =>
        u.id === userId
          ? { ...u, ...updates }
          : u
      ))

      // Update stats
      setStats(prev => {
        const delta = newStatus === 'active' ? 1 : -1
        return {
          ...prev,
          premium: prev.premium + delta,
          free: prev.free - delta,
        }
      })
    } catch (err) {
      console.error('Failed to update user:', err)
      alert('Failed to update subscription status. Check console for details.')
    } finally {
      setUpdating(null)
    }
  }

  /* ---- Filter users ---- */
  const filteredUsers = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (u.email || '').toLowerCase().includes(q) ||
      (u.display_name || '').toLowerCase().includes(q)
    )
  })

  if (!isAdmin && !authLoading) return null

  // Show setup instructions when Supabase is not configured
  if (!isFirebaseConfigured) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 pt-8 animate-fade-in">
        <Card className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
            <Shield size={24} className="text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            Admin Setup Required
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#8a9a8e] mb-6 max-w-md mx-auto">
            Connect Firebase to enable user management, authentication, and the admin dashboard.
          </p>
          <div className="text-left bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 mb-6 max-w-sm mx-auto">
            <p className="text-xs font-mono text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
              <span className="text-leaf-500">$</span> bash setup.sh
            </p>
            <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mt-2">
              Run from the project root to configure Firebase + Stripe credentials
            </p>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
            Need help? Check the README or run the setup script for guided configuration.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pt-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea] flex items-center gap-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <Shield size={24} className="text-purple-400" />
            Admin Dashboard
          </h1>
          <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-0.5">
            Manage users and subscriptions
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchUsers} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
            <Users size={18} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-[#e8f0ea]">{stats.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e]">Total Users</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
            <Crown size={18} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-500">{stats.premium}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e]">Premium</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-gray-500/10 flex items-center justify-center mx-auto mb-2">
            <Users size={18} className="text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-500">{stats.free}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e]">Free</div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search users by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-[#e8f0ea] placeholder:text-gray-400 dark:placeholder:text-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40"
        />
      </div>

      {/* User table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin-slow" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400 dark:text-[#5a6a5e]">
            {search ? 'No users match your search' : 'No users yet'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e]">User</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e]">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e]">Joined</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-leaf-500/10 flex items-center justify-center text-xs font-bold text-leaf-500 flex-shrink-0">
                          {(u.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-[#e8f0ea] truncate">
                            {u.display_name || u.email || 'Unknown'}
                          </div>
                          {u.display_name && u.email && (
                            <div className="text-[10px] text-gray-400 dark:text-[#5a6a5e] truncate">{u.email}</div>
                          )}
                          {u.is_admin && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-purple-400">
                              <Shield size={8} /> Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.subscription_status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          <Crown size={10} />
                          Premium
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e]">
                          Free
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-[#8a9a8e] whitespace-nowrap">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!u.is_admin && (
                        <button
                          onClick={() => togglePremium(u.id, u.subscription_status)}
                          disabled={updating === u.id}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50 ${
                            u.subscription_status === 'active'
                              ? 'text-red-400 hover:bg-red-500/10 border border-red-500/20'
                              : 'text-leaf-500 hover:bg-leaf-500/10 border border-leaf-500/20'
                          }`}
                        >
                          {updating === u.id ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : u.subscription_status === 'active' ? (
                            <>
                              <XCircle size={12} />
                              Revoke
                            </>
                          ) : (
                            <>
                              <CheckCircle size={12} />
                              Grant Premium
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] text-center mt-4 pb-4">
        Admin access is restricted to master accounts only
      </p>
    </div>
  )
}
