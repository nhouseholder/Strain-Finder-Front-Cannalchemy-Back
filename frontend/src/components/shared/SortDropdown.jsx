import { useState, useRef, useEffect, useMemo } from 'react'
import { ArrowUpDown, ChevronDown, Check, FlaskConical, Leaf, Star, TrendingUp, TrendingDown } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────
   Sort options — grouped by category
   id format:  <field>-<direction>
     field:     cannabinoid/terpene name, 'name', 'rating', 'common'
     direction: 'desc' (highest first) or 'asc' (lowest first)
   ────────────────────────────────────────────────────────────── */

const CANNABINOID_SORTS = [
  { id: 'thc-desc',  label: 'THC',  sub: 'Highest first', icon: '↓' },
  { id: 'thc-asc',   label: 'THC',  sub: 'Lowest first',  icon: '↑' },
  { id: 'cbd-desc',  label: 'CBD',  sub: 'Highest first', icon: '↓' },
  { id: 'cbd-asc',   label: 'CBD',  sub: 'Lowest first',  icon: '↑' },
  { id: 'cbg-desc',  label: 'CBG',  sub: 'Highest first', icon: '↓' },
  { id: 'cbg-asc',   label: 'CBG',  sub: 'Lowest first',  icon: '↑' },
  { id: 'cbn-desc',  label: 'CBN',  sub: 'Highest first', icon: '↓' },
  { id: 'cbn-asc',   label: 'CBN',  sub: 'Lowest first',  icon: '↑' },
  { id: 'thcv-desc', label: 'THCV', sub: 'Highest first', icon: '↓' },
  { id: 'thcv-asc',  label: 'THCV', sub: 'Lowest first',  icon: '↑' },
  { id: 'cbc-desc',  label: 'CBC',  sub: 'Highest first', icon: '↓' },
  { id: 'cbc-asc',   label: 'CBC',  sub: 'Lowest first',  icon: '↑' },
]

const TERPENE_SORTS = [
  { id: 'myrcene-desc',       label: 'Myrcene',       sub: 'Highest first', icon: '↓' },
  { id: 'myrcene-asc',        label: 'Myrcene',       sub: 'Lowest first',  icon: '↑' },
  { id: 'limonene-desc',      label: 'Limonene',      sub: 'Highest first', icon: '↓' },
  { id: 'limonene-asc',       label: 'Limonene',      sub: 'Lowest first',  icon: '↑' },
  { id: 'caryophyllene-desc', label: 'Caryophyllene', sub: 'Highest first', icon: '↓' },
  { id: 'caryophyllene-asc',  label: 'Caryophyllene', sub: 'Lowest first',  icon: '↑' },
  { id: 'linalool-desc',      label: 'Linalool',      sub: 'Highest first', icon: '↓' },
  { id: 'linalool-asc',       label: 'Linalool',      sub: 'Lowest first',  icon: '↑' },
  { id: 'pinene-desc',        label: 'Pinene',        sub: 'Highest first', icon: '↓' },
  { id: 'pinene-asc',         label: 'Pinene',        sub: 'Lowest first',  icon: '↑' },
  { id: 'terpinolene-desc',   label: 'Terpinolene',   sub: 'Highest first', icon: '↓' },
  { id: 'terpinolene-asc',    label: 'Terpinolene',   sub: 'Lowest first',  icon: '↑' },
  { id: 'humulene-desc',      label: 'Humulene',      sub: 'Highest first', icon: '↓' },
  { id: 'humulene-asc',       label: 'Humulene',      sub: 'Lowest first',  icon: '↑' },
  { id: 'ocimene-desc',       label: 'Ocimene',       sub: 'Highest first', icon: '↓' },
  { id: 'ocimene-asc',        label: 'Ocimene',       sub: 'Lowest first',  icon: '↑' },
  { id: 'bisabolol-desc',     label: 'Bisabolol',     sub: 'Highest first', icon: '↓' },
  { id: 'bisabolol-asc',      label: 'Bisabolol',     sub: 'Lowest first',  icon: '↑' },
]

const GENERAL_SORTS = [
  { id: 'name',         label: 'Name A → Z',        sub: null, icon: null },
  { id: 'name-desc',    label: 'Name Z → A',        sub: null, icon: null },
  { id: 'rating-desc',  label: 'Community Rating',   sub: 'Highest first', icon: '↓' },
  { id: 'rating-asc',   label: 'Community Rating',   sub: 'Lowest first',  icon: '↑' },
  { id: 'common-desc',  label: 'Commonness',         sub: 'Most common',   icon: '↓' },
  { id: 'common-asc',   label: 'Commonness',         sub: 'Most rare',     icon: '↑' },
]

const SORT_GROUPS = [
  { label: 'General',       icon: ArrowUpDown,  items: GENERAL_SORTS },
  { label: 'Cannabinoids',  icon: FlaskConical, items: CANNABINOID_SORTS },
  { label: 'Terpenes',      icon: Leaf,         items: TERPENE_SORTS },
]

// All sort options flat (for label lookup)
const ALL_SORTS = [...GENERAL_SORTS, ...CANNABINOID_SORTS, ...TERPENE_SORTS]

/* ─── Helpers to extract values from strain objects ──────── */
const getCannVal = (strain, name) => {
  const c = (strain.cannabinoids || []).find(c => (c.name || '').toLowerCase() === name)
  return c?.value ?? 0
}

const getTerpVal = (strain, name) => {
  const t = (strain.terpenes || []).find(t => (t.name || '').toLowerCase() === name)
  if (!t) return 0
  return typeof t.pct === 'number' ? t.pct : parseFloat(String(t.pct || '0').replace('%', '')) || 0
}

// Cannabinoid names for sort resolution
const CANNABINOID_NAMES = new Set(['thc', 'cbd', 'cbg', 'cbn', 'thcv', 'cbc'])

// Terpene names for sort resolution
const TERPENE_NAMES = new Set([
  'myrcene', 'limonene', 'caryophyllene', 'linalool', 'pinene',
  'terpinolene', 'humulene', 'ocimene', 'bisabolol',
])

/**
 * Returns a comparator function for Array.sort based on a sort ID.
 * Exported so both Explorer and Search pages can use the same logic.
 */
export function applySortComparator(sortId) {
  return (a, b) => {
    if (!sortId || sortId === 'name') return (a.name || '').localeCompare(b.name || '')
    if (sortId === 'name-desc') return (b.name || '').localeCompare(a.name || '')

    // Rating (sentimentScore)
    if (sortId === 'rating-desc') return (b.sentimentScore || 0) - (a.sentimentScore || 0)
    if (sortId === 'rating-asc') return (a.sentimentScore || 0) - (b.sentimentScore || 0)

    // Commonness (availability)
    if (sortId === 'common-desc') return (b.availability || 5) - (a.availability || 5)
    if (sortId === 'common-asc') return (a.availability || 5) - (b.availability || 5)

    // Parse field-direction
    const lastDash = sortId.lastIndexOf('-')
    if (lastDash === -1) return 0
    const field = sortId.substring(0, lastDash)
    const dir = sortId.substring(lastDash + 1)

    // Cannabinoid sort
    if (CANNABINOID_NAMES.has(field)) {
      const valA = getCannVal(a, field)
      const valB = getCannVal(b, field)
      return dir === 'desc' ? valB - valA : valA - valB
    }

    // Terpene sort
    if (TERPENE_NAMES.has(field)) {
      const valA = getTerpVal(a, field)
      const valB = getTerpVal(b, field)
      return dir === 'desc' ? valB - valA : valA - valB
    }

    return 0
  }
}

/* ─── Get display label for current sort ─────────────────── */
function getSortLabel(sortId) {
  const opt = ALL_SORTS.find(o => o.id === sortId)
  if (!opt) return 'Sort'
  if (opt.sub) return `${opt.label} ${opt.icon || ''}`
  return opt.label
}

/* ─── SortDropdown component ─────────────────────────────── */
export default function SortDropdown({ value, onChange, className = '' }) {
  const [open, setOpen] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState(null)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // When opening, auto-expand the group containing the current value
  useEffect(() => {
    if (open) {
      const group = SORT_GROUPS.find(g => g.items.some(i => i.id === value))
      if (group) setExpandedGroup(group.label)
    }
  }, [open, value])

  const handleSelect = (id) => {
    onChange(id)
    setOpen(false)
  }

  const toggleGroup = (label) => {
    setExpandedGroup(prev => prev === label ? null : label)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                   border border-gray-200/50 dark:border-white/10
                   bg-white dark:bg-white/[0.04]
                   text-gray-700 dark:text-[#c0d4c6]
                   hover:border-leaf-400/30 hover:bg-leaf-500/5
                   transition-all cursor-pointer select-none"
      >
        <ArrowUpDown size={12} className="text-leaf-400 shrink-0" />
        <span className="truncate max-w-[140px]">{getSortLabel(value)}</span>
        <ChevronDown size={11} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50
                        w-64 max-h-[70vh] overflow-y-auto overscroll-contain
                        rounded-xl border border-gray-200/60 dark:border-white/10
                        bg-white dark:bg-[#1a2e1e]
                        shadow-xl shadow-black/10 dark:shadow-black/40
                        animate-fade-in">
          {SORT_GROUPS.map((group) => {
            const GroupIcon = group.icon
            const isExpanded = expandedGroup === group.label

            return (
              <div key={group.label}>
                {/* Group header — collapsible */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left
                             bg-gray-50/80 dark:bg-white/[0.03]
                             border-b border-gray-100/60 dark:border-white/[0.06]
                             hover:bg-gray-100/80 dark:hover:bg-white/[0.05]
                             transition-colors"
                >
                  <GroupIcon size={12} className="text-leaf-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-leaf-500 dark:text-leaf-400 flex-1">
                    {group.label}
                  </span>
                  <span className="text-[9px] text-gray-400 dark:text-[#5a6a5e]">
                    {group.items.length / 2 | 0} options
                  </span>
                  <ChevronDown size={11} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Group items */}
                {isExpanded && (
                  <div className="py-0.5">
                    {group.items.map((item) => {
                      const isActive = value === item.id

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item.id)}
                          className={`flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors
                            ${isActive
                              ? 'bg-leaf-500/10 text-leaf-500 dark:text-leaf-400'
                              : 'text-gray-600 dark:text-[#a0b4a6] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                            }`}
                        >
                          {/* Check mark for active */}
                          <span className="w-3.5 shrink-0">
                            {isActive && <Check size={12} className="text-leaf-400" />}
                          </span>

                          <span className="text-[11px] font-medium flex-1">{item.label}</span>

                          {item.sub && (
                            <span className={`text-[9px] ${isActive ? 'text-leaf-400/70' : 'text-gray-400 dark:text-[#5a6a5e]'}`}>
                              {item.sub}
                            </span>
                          )}

                          {item.icon && (
                            <span className={`text-[10px] font-mono ${
                              item.icon === '↓' ? 'text-emerald-500' : 'text-amber-500'
                            }`}>
                              {item.icon}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
