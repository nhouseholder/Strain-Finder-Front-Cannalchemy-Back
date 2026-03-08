import { useState, useRef, useEffect, useMemo } from 'react'
import { ArrowUpDown, ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, Check, FlaskConical, Leaf, MapPin } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────
   Sort field options — each listed ONCE, direction is separate
   ────────────────────────────────────────────────────────────── */

const CANNABINOID_FIELDS = [
  { field: 'thc',  label: 'THC' },
  { field: 'cbd',  label: 'CBD' },
  { field: 'cbg',  label: 'CBG' },
  { field: 'cbn',  label: 'CBN' },
  { field: 'thcv', label: 'THCV' },
  { field: 'cbc',  label: 'CBC' },
]

const TERPENE_FIELDS = [
  { field: 'myrcene',       label: 'Myrcene' },
  { field: 'limonene',      label: 'Limonene' },
  { field: 'caryophyllene', label: 'Caryophyllene' },
  { field: 'linalool',      label: 'Linalool' },
  { field: 'pinene',        label: 'Pinene' },
  { field: 'terpinolene',   label: 'Terpinolene' },
  { field: 'humulene',      label: 'Humulene' },
  { field: 'ocimene',       label: 'Ocimene' },
  { field: 'bisabolol',     label: 'Bisabolol' },
]

const GENERAL_FIELDS = [
  { field: 'name',   label: 'Name' },
  { field: 'rating', label: 'Community Rating' },
  { field: 'common', label: 'Commonness' },
]

const SORT_GROUPS = [
  { label: 'General',      icon: ArrowUpDown,  items: GENERAL_FIELDS },
  { label: 'Cannabinoids', icon: FlaskConical, items: CANNABINOID_FIELDS },
  { label: 'Terpenes',     icon: Leaf,         items: TERPENE_FIELDS },
]

const ALL_FIELDS = [...GENERAL_FIELDS, ...CANNABINOID_FIELDS, ...TERPENE_FIELDS]

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

const CANNABINOID_NAMES = new Set(['thc', 'cbd', 'cbg', 'cbn', 'thcv', 'cbc'])
const TERPENE_NAMES = new Set([
  'myrcene', 'limonene', 'caryophyllene', 'linalool', 'pinene',
  'terpinolene', 'humulene', 'ocimene', 'bisabolol',
])

/* ─── Parse combined sort ID into field + direction ──────── */
export function parseSortId(sortId) {
  if (!sortId || sortId === 'name') return { field: 'name', dir: 'asc' }
  const lastDash = sortId.lastIndexOf('-')
  if (lastDash === -1) return { field: sortId, dir: 'desc' }
  const dir = sortId.substring(lastDash + 1)
  if (dir !== 'asc' && dir !== 'desc') return { field: sortId, dir: 'desc' }
  return { field: sortId.substring(0, lastDash), dir }
}

/* ─── Build combined sort ID from field + direction ──────── */
export function buildSortId(field, dir) {
  if (field === 'name' && dir === 'asc') return 'name'
  return `${field}-${dir}`
}

/**
 * Returns a comparator function for Array.sort based on a sort ID.
 * Exported so both Explorer and Search pages can use the same logic.
 *
 * @param {string} sortId - Combined "field-direction" sort key
 * @param {number|null} userRegionIndex - Optional region index for availability sort
 */
export function applySortComparator(sortId, userRegionIndex = null) {
  const { field, dir } = parseSortId(sortId)

  return (a, b) => {
    // Name sort
    if (field === 'name') {
      const cmp = (a.name || '').localeCompare(b.name || '')
      return dir === 'desc' ? -cmp : cmp
    }

    // Rating (sentimentScore)
    if (field === 'rating') {
      const diff = (b.sentimentScore || 0) - (a.sentimentScore || 0)
      return dir === 'asc' ? -diff : diff
    }

    // Commonness (availability)
    if (field === 'common') {
      const diff = (b.availability || 5) - (a.availability || 5)
      return dir === 'asc' ? -diff : diff
    }

    // Regional availability sort — uses reg array + user's region
    if (field === 'regional') {
      const regA = (userRegionIndex != null && a.reg) ? (a.reg[userRegionIndex] || 0) : 0
      const regB = (userRegionIndex != null && b.reg) ? (b.reg[userRegionIndex] || 0) : 0
      return dir === 'desc' ? regB - regA : regA - regB
    }

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

/* ─── SortDropdown component ─────────────────────────────────
   Two controls side by side:
   1. Direction toggle (Increasing ↑ / Decreasing ↓)
   2. Sort-field dropdown (grouped: General, Cannabinoids, Terpenes)
   ────────────────────────────────────────────────────────────── */
export default function SortDropdown({ value, onChange, className = '', hasLocation = false }) {
  const { field: currentField, dir: currentDir } = parseSortId(value)

  // Build sort groups dynamically — include "Availability in Your Area" when user has location
  const sortGroups = useMemo(() => {
    const generalItems = hasLocation
      ? [...GENERAL_FIELDS, { field: 'regional', label: 'Availability in Your Area' }]
      : GENERAL_FIELDS
    return [
      { label: 'General', icon: hasLocation ? MapPin : ArrowUpDown, items: generalItems },
      { label: 'Cannabinoids', icon: FlaskConical, items: CANNABINOID_FIELDS },
      { label: 'Terpenes', icon: Leaf, items: TERPENE_FIELDS },
    ]
  }, [hasLocation])

  const allFieldsList = useMemo(() => {
    return sortGroups.flatMap(g => g.items)
  }, [sortGroups])
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

  // Auto-expand group containing current selection
  useEffect(() => {
    if (open) {
      const group = sortGroups.find(g => g.items.some(i => i.field === currentField))
      if (group) setExpandedGroup(group.label)
    }
  }, [open, currentField])

  const handleFieldSelect = (field) => {
    onChange(buildSortId(field, currentDir))
    setOpen(false)
  }

  const toggleDirection = () => {
    const newDir = currentDir === 'desc' ? 'asc' : 'desc'
    onChange(buildSortId(currentField, newDir))
  }

  const toggleGroup = (label) => {
    setExpandedGroup(prev => prev === label ? null : label)
  }

  const fieldLabel = allFieldsList.find(f => f.field === currentField)?.label || 'Name'
  const isDesc = currentDir === 'desc'

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* ── Direction toggle button ── */}
      <button
        onClick={toggleDirection}
        title={isDesc ? 'Decreasing (highest first) — click to switch' : 'Increasing (lowest first) — click to switch'}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium
                    border transition-all cursor-pointer select-none
                    ${isDesc
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                      : 'border-amber-400/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                    }`}
      >
        {isDesc
          ? <ArrowDownWideNarrow size={13} className="shrink-0" />
          : <ArrowUpNarrowWide size={13} className="shrink-0" />
        }
        <span className="hidden sm:inline">{isDesc ? 'Decreasing' : 'Increasing'}</span>
        <span className="sm:hidden">{isDesc ? '↓' : '↑'}</span>
      </button>

      {/* ── Sort field dropdown ── */}
      <div ref={ref} className="relative">
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
          <span className="truncate max-w-[120px]">{fieldLabel}</span>
          <ChevronDown size={11} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute right-0 top-full mt-1.5 z-50
                          w-56 max-h-[70vh] overflow-y-auto overscroll-contain
                          rounded-xl border border-gray-200/60 dark:border-white/10
                          bg-white dark:bg-[#1a2e1e]
                          shadow-xl shadow-black/10 dark:shadow-black/40
                          animate-fade-in">
            {sortGroups.map((group) => {
              const GroupIcon = group.icon
              const isExpanded = expandedGroup === group.label

              return (
                <div key={group.label}>
                  {/* Group header */}
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
                    <ChevronDown size={11} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Group items — each field listed ONCE */}
                  {isExpanded && (
                    <div className="py-0.5">
                      {group.items.map((item) => {
                        const isActive = currentField === item.field

                        return (
                          <button
                            key={item.field}
                            onClick={() => handleFieldSelect(item.field)}
                            className={`flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors
                              ${isActive
                                ? 'bg-leaf-500/10 text-leaf-500 dark:text-leaf-400'
                                : 'text-gray-600 dark:text-[#a0b4a6] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                              }`}
                          >
                            <span className="w-3.5 shrink-0">
                              {isActive && <Check size={12} className="text-leaf-400" />}
                            </span>
                            <span className="text-[11px] font-medium">{item.label}</span>
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
    </div>
  )
}
