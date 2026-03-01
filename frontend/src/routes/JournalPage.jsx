/**
 * JournalPage — Full-featured strain session journal.
 *
 * Inspired by strain-tracker's SessionJournal / LogSession and enhanced
 * with all the best patterns from our existing codebase.
 *
 * Features:
 *  - Rich session form: strain autocomplete, date/time, dosage, temperature,
 *    context, effects, negatives, flavors, aromas, would-try-again, notes
 *  - Dual view: List (with filters/search) + Calendar heatmap
 *  - Rich stats dashboard
 *  - AI Journal Insights via Workers AI (Llama 3.3 70B)
 *  - Edit & delete existing entries
 *  - Backward-compatible with the simpler data model
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import usePageTitle from '../hooks/usePageTitle'
import { useJournal } from '../hooks/useJournal'
import { useStrainSearch } from '../hooks/useStrainSearch'
import { EFFECTS, AVOID_EFFECTS } from '../data/effects'
import { CONSUMPTION_METHODS } from '../data/consumptionMethods'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import Modal from '../components/shared/Modal'
import {
  Plus, BookMarked, Star, Trash2, Calendar, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Search, Filter, Edit3, Brain, BarChart3,
  List, CalendarDays, Loader2, Clock, Flame, ThumbsUp, ThumbsDown,
  X, RefreshCw,
} from 'lucide-react'

/* ================================================================== */
/*  CONSTANTS                                                         */
/* ================================================================== */

const COMMON_FLAVORS = [
  'Earthy','Sweet','Citrus','Pine','Berry','Spicy','Woody',
  'Floral','Tropical','Grape','Lemon','Mint','Diesel','Herbal',
  'Vanilla','Coffee','Lavender','Mango','Cheese','Nutty',
]

const COMMON_AROMAS = [
  'Pungent','Earthy','Sweet','Citrus','Pine','Floral','Fruity',
  'Woody','Skunky','Diesel','Spicy','Lavender','Tropical','Herbal',
]

const CONTEXTS = [
  { id: 'morning', label: 'Morning Wake & Bake', emoji: '\u{1F305}' },
  { id: 'daytime', label: 'Daytime Use', emoji: '\u{2600}\u{FE0F}' },
  { id: 'evening', label: 'Evening Wind-Down', emoji: '\u{1F306}' },
  { id: 'bedtime', label: 'Before Bed', emoji: '\u{1F319}' },
  { id: 'social', label: 'Social Gathering', emoji: '\u{1F389}' },
  { id: 'creative', label: 'Creative Session', emoji: '\u{1F3A8}' },
  { id: 'active', label: 'Workout / Active', emoji: '\u{1F3C3}' },
  { id: 'medical', label: 'Medical / Therapeutic', emoji: '\u{1F48A}' },
  { id: 'casual', label: 'Casual Relaxation', emoji: '\u{1F6CB}\u{FE0F}' },
]

const DOSAGE_PRESETS = [
  { id: 'micro', label: 'Microdose' },
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
  { id: 'heavy', label: 'Heavy' },
]

const METHOD_LABELS = Object.fromEntries(
  CONSUMPTION_METHODS.filter(m => m.id !== 'no_preference').map(m => [m.id, m.label])
)

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'highest', label: 'Highest Rated' },
  { value: 'lowest', label: 'Lowest Rated' },
  { value: 'name', label: 'Strain Name' },
]

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

/* ================================================================== */
/*  StarRating                                                        */
/* ================================================================== */
function StarRating({ value, onChange, size = 20, readOnly = false }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <button
          key={s}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(s)}
          onMouseEnter={() => !readOnly && setHover(s)}
          onMouseLeave={() => setHover(0)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer transition-transform hover:scale-110'}
          aria-label={`Rate ${s} star${s > 1 ? 's' : ''}`}
        >
          <Star
            size={size}
            className={
              s <= (hover || value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-gray-300 dark:text-[#5a6a5e]'
            }
          />
        </button>
      ))}
    </div>
  )
}

/* ================================================================== */
/*  TagPicker                                                         */
/* ================================================================== */
function TagPicker({ label, items, selected, onToggle, color = 'leaf' }) {
  const colorMap = {
    leaf:   'bg-leaf-500/15 text-leaf-400 border-leaf-500/30',
    amber:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
    red:    'bg-red-500/15 text-red-400 border-red-500/30',
    purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  }
  const active = colorMap[color] || colorMap.leaf
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => {
          const id  = typeof item === 'string' ? item : item.id || item.label
          const lbl = typeof item === 'string' ? item : (item.emoji ? `${item.emoji} ${item.label}` : item.label)
          const on  = selected.includes(id)
          return (
            <button
              key={id} type="button" onClick={() => onToggle(id)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-all border ${
                on ? active : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border-transparent hover:bg-gray-200 dark:hover:bg-white/[0.08]'
              }`}
            >{lbl}</button>
          )
        })}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  JournalForm                                                       */
/* ================================================================== */
function JournalForm({ onSubmit, onCancel, initialData = null }) {
  const { query, setQuery, results } = useStrainSearch()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)
  const isEdit = !!initialData

  const [strainName, setStrainName]         = useState(initialData?.strainName || '')
  const [strainType, setStrainType]         = useState(initialData?.strainType || 'hybrid')
  const [date, setDate]                     = useState(initialData?.date || new Date().toISOString().slice(0,10))
  const [time, setTime]                     = useState(initialData?.time || new Date().toTimeString().slice(0,5))
  const [rating, setRating]                 = useState(initialData?.rating || 0)
  const [method, setMethod]                 = useState(initialData?.method || 'flower')
  const [dosage, setDosage]                 = useState(initialData?.dosage || '')
  const [temperature, setTemperature]       = useState(initialData?.temperature || '')
  const [context, setContext]               = useState(initialData?.context || '')
  const [effects, setEffects]               = useState(initialData?.effects || [])
  const [negativeEffects, setNegativeEffects] = useState(initialData?.negativeEffects || [])
  const [flavors, setFlavors]               = useState(initialData?.flavors || [])
  const [aromas, setAromas]                 = useState(initialData?.aromas || [])
  const [wouldTryAgain, setWouldTryAgain]   = useState(initialData?.wouldTryAgain ?? null)
  const [notes, setNotes]                   = useState(initialData?.notes || '')
  const [showAdvanced, setShowAdvanced]     = useState(isEdit)

  useEffect(() => {
    if (strainName !== query) setQuery(strainName)
  }, [strainName])

  const selectStrain = s => {
    setStrainName(s.name)
    setStrainType(s.type || 'hybrid')
    setShowDropdown(false)
    setQuery('')
  }

  useEffect(() => {
    const handler = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (setter, id) => setter(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleSubmit = e => {
    e.preventDefault()
    if (!strainName.trim() || rating === 0) return
    onSubmit({
      ...(initialData || {}),
      strainName: strainName.trim(),
      strainType,
      date,
      time,
      rating,
      method,
      dosage,
      temperature: temperature ? parseInt(temperature) : null,
      context,
      effects,
      negativeEffects,
      flavors,
      aromas,
      wouldTryAgain,
      notes: notes.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Strain Name + autocomplete */}
      <div className="relative" ref={dropdownRef}>
        <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">
          Strain Name *
        </label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5a6a5e]" />
          <input
            type="text"
            value={strainName}
            onChange={e => { setStrainName(e.target.value); setShowDropdown(true) }}
            onFocus={() => strainName.length >= 2 && setShowDropdown(true)}
            placeholder="Search or type strain name..."
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all"
            required
          />
        </div>
        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-xl bg-white dark:bg-[#1a2a1e] border border-gray-200 dark:border-white/10 shadow-lg">
            {results.slice(0,8).map(s => (
              <button
                key={s.id || s.name}
                type="button"
                onClick={() => selectStrain(s)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors flex items-center gap-2"
              >
                <span className="text-sm text-gray-900 dark:text-[#e8f0ea] font-medium">{s.name}</span>
                <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] capitalize">{s.type}</span>
                {s.thc_max > 0 && (
                  <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] ml-auto">{s.thc_max}% THC</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">Type</label>
        <div className="flex gap-2">
          {['indica','sativa','hybrid'].map(t => (
            <button
              key={t} type="button" onClick={() => setStrainType(t)}
              className={`flex-1 py-2 text-xs rounded-lg font-medium capitalize transition-all ${
                strainType === t
                  ? 'bg-leaf-500/15 text-leaf-400 border border-leaf-500/30'
                  : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border border-transparent hover:bg-gray-200 dark:hover:bg-white/[0.08]'
              }`}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">
            <Calendar size={11} className="inline mr-1" />Date
          </label>
          <input
            type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">
            <Clock size={11} className="inline mr-1" />Time
          </label>
          <input
            type="time" value={time} onChange={e => setTime(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all"
          />
        </div>
      </div>

      {/* Rating */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">Rating *</label>
        <StarRating value={rating} onChange={setRating} />
      </div>

      {/* Method + Dosage */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">Method</label>
          <select
            value={method} onChange={e => setMethod(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all appearance-none"
          >
            {Object.entries(METHOD_LABELS).map(([v,l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">Dosage</label>
          <select
            value={dosage} onChange={e => setDosage(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all appearance-none"
          >
            <option value="">— Select —</option>
            {DOSAGE_PRESETS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
      </div>

      {/* Temperature (vape/concentrates only) */}
      {(method === 'vape' || method === 'concentrates') && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">
            <Flame size={11} className="inline mr-1" />Temperature (\u00B0F)
          </label>
          <input
            type="number" value={temperature}
            onChange={e => setTemperature(e.target.value)}
            placeholder="e.g., 380" min="200" max="600"
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all"
          />
        </div>
      )}

      {/* Context / Setting */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">
          Setting / Context
        </label>
        <div className="flex flex-wrap gap-1.5">
          {CONTEXTS.map(ctx => (
            <button
              key={ctx.id} type="button"
              onClick={() => setContext(context === ctx.id ? '' : ctx.id)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-all border ${
                context === ctx.id
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                  : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border-transparent hover:bg-gray-200 dark:hover:bg-white/[0.08]'
              }`}
            >{ctx.emoji} {ctx.label}</button>
          ))}
        </div>
      </div>

      {/* Effects */}
      <TagPicker
        label="Effects Felt"
        items={EFFECTS.map(e => ({ id: e.id, label: e.label, emoji: e.emoji }))}
        selected={effects}
        onToggle={id => toggle(setEffects, id)}
        color="leaf"
      />

      {/* Show Advanced toggle */}
      <button
        type="button" onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-[#5a6a5e] hover:text-leaf-500 transition-colors"
      >
        {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showAdvanced ? 'Less options' : 'More options (negatives, flavors, aromas...)'}
      </button>

      {showAdvanced && (
        <>
          <TagPicker
            label="Negative Effects"
            items={AVOID_EFFECTS.map(e => ({ id: e.id, label: e.label, emoji: e.emoji }))}
            selected={negativeEffects}
            onToggle={id => toggle(setNegativeEffects, id)}
            color="red"
          />

          <TagPicker
            label="Flavors Noticed"
            items={COMMON_FLAVORS}
            selected={flavors}
            onToggle={id => toggle(setFlavors, id)}
            color="amber"
          />

          <TagPicker
            label="Aromas Noticed"
            items={COMMON_AROMAS}
            selected={aromas}
            onToggle={id => toggle(setAromas, id)}
            color="purple"
          />

          {/* Would Try Again */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">
              Would Try Again?
            </label>
            <div className="flex gap-2">
              {[
                { val: true, Ic: ThumbsUp, lbl: 'Yes', c: 'leaf' },
                { val: false, Ic: ThumbsDown, lbl: 'No', c: 'red' },
              ].map(({ val, Ic, lbl, c }) => (
                <button
                  key={lbl} type="button"
                  onClick={() => setWouldTryAgain(wouldTryAgain === val ? null : val)}
                  className={`flex items-center gap-1.5 flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-all border ${
                    wouldTryAgain === val
                      ? c === 'leaf'
                        ? 'bg-leaf-500/15 text-leaf-400 border-leaf-500/30'
                        : 'bg-red-500/15 text-red-400 border-red-500/30'
                      : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border-transparent hover:bg-gray-200 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <Ic size={14} /> {lbl}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">Notes</label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="How did it make you feel? Setting, dosage tips, anything notable..."
          className="w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" size="full" disabled={!strainName.trim() || rating === 0}>
          {isEdit ? 'Update Entry' : 'Save Entry'}
        </Button>
      </div>
    </form>
  )
}

/* ================================================================== */
/*  JournalEntryCard                                                  */
/* ================================================================== */
function JournalEntryCard({ entry, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false)

  const formatDate = e => {
    const d = e.date || e.createdAt
    if (!d) return ''
    try {
      return new Date(d).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })
    } catch { return '' }
  }

  const formatTime = e => {
    if (!e.time) return ''
    try {
      const [h,m] = e.time.split(':')
      const hr = parseInt(h)
      return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
    } catch { return '' }
  }

  const resolveEffect = id => {
    const f = EFFECTS.find(e => e.id === id)
    return f ? `${f.emoji} ${f.label}` : id
  }

  const resolveNegEffect = id => {
    const f = AVOID_EFFECTS.find(e => e.id === id)
    return f ? `${f.emoji} ${f.label}` : id
  }

  const resolveContext = id => {
    const f = CONTEXTS.find(c => c.id === id)
    return f ? `${f.emoji} ${f.label}` : id
  }

  const resolveDosage = id => {
    const f = DOSAGE_PRESETS.find(d => d.id === id)
    return f ? f.label : id
  }

  const hasEffects   = entry.effects?.length > 0
  const hasNegatives = entry.negativeEffects?.length > 0
  const hasFlavors   = entry.flavors?.length > 0
  const hasAromas    = entry.aromas?.length > 0
  const hasExtras    = hasNegatives || hasFlavors || hasAromas || entry.notes ||
    entry.context || entry.dosage || entry.temperature ||
    (entry.wouldTryAgain !== undefined && entry.wouldTryAgain !== null)

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea]">
              {entry.strainName}
            </h3>
            {entry.strainType && (
              <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md font-semibold ${
                entry.strainType === 'indica'
                  ? 'bg-purple-500/10 text-purple-400'
                  : entry.strainType === 'sativa'
                    ? 'bg-orange-500/10 text-orange-400'
                    : 'bg-leaf-500/10 text-leaf-400'
              }`}>{entry.strainType}</span>
            )}
            {entry.wouldTryAgain === true  && <ThumbsUp  size={12} className="text-leaf-400" />}
            {entry.wouldTryAgain === false && <ThumbsDown size={12} className="text-red-400" />}
          </div>

          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StarRating value={entry.rating || 0} size={14} readOnly />
            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
              {METHOD_LABELS[entry.method] || entry.method}
            </span>
            {entry.dosage && (
              <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                &middot; {resolveDosage(entry.dosage)}
              </span>
            )}
            {entry.temperature && (
              <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                &middot; {entry.temperature}\u00B0F
              </span>
            )}
          </div>

          {hasEffects && (
            <div className="flex flex-wrap gap-1 mb-2">
              {entry.effects.slice(0, expanded ? undefined : 4).map(eff => (
                <span key={eff} className="px-2 py-0.5 rounded-md text-[10px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20">
                  {resolveEffect(eff)}
                </span>
              ))}
              {!expanded && entry.effects.length > 4 && (
                <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] self-center">
                  +{entry.effects.length - 4}
                </span>
              )}
            </div>
          )}

          {expanded && (
            <div className="space-y-2 mt-2">
              {hasNegatives && (
                <div className="flex flex-wrap gap-1">
                  {entry.negativeEffects.map(eff => (
                    <span key={eff} className="px-2 py-0.5 rounded-md text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">
                      {resolveNegEffect(eff)}
                    </span>
                  ))}
                </div>
              )}
              {hasFlavors && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] self-center mr-1">Flavors:</span>
                  {entry.flavors.map(f => (
                    <span key={f} className="px-2 py-0.5 rounded-md text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">{f}</span>
                  ))}
                </div>
              )}
              {hasAromas && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] self-center mr-1">Aromas:</span>
                  {entry.aromas.map(a => (
                    <span key={a} className="px-2 py-0.5 rounded-md text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20">{a}</span>
                  ))}
                </div>
              )}
              {entry.context && (
                <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                  Setting: {resolveContext(entry.context)}
                </p>
              )}
              {entry.notes && (
                <p className="text-xs text-gray-500 dark:text-[#8a9a8e] leading-relaxed whitespace-pre-wrap">
                  {entry.notes}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] flex items-center gap-1">
            <Calendar size={10} />{formatDate(entry)}
          </span>
          {formatTime(entry) && (
            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] flex items-center gap-1">
              <Clock size={10} />{formatTime(entry)}
            </span>
          )}
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={() => onEdit(entry)}
              className="p-1.5 rounded-lg text-gray-300 dark:text-[#5a6a5e] hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
              title="Edit"
            >
              <Edit3 size={13} />
            </button>
            <button
              onClick={() => onDelete(entry.id)}
              className="p-1.5 rounded-lg text-gray-300 dark:text-[#5a6a5e] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {(hasExtras || (hasEffects && entry.effects.length > 4)) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-[#5a6a5e] hover:text-leaf-500 transition-colors mt-2"
        >
          {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
        </button>
      )}
    </Card>
  )
}

/* ================================================================== */
/*  CalendarView                                                      */
/* ================================================================== */
function CalendarView({ entries }) {
  const [month, setMonth] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [selectedDay, setSelectedDay] = useState(null)

  const entryDays = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      const d = (e.date || e.createdAt || '').slice(0,10)
      if (d) { if (!map[d]) map[d] = []; map[d].push(e) }
    })
    return map
  }, [entries])

  const { year, month: m } = month
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const startOffset = (new Date(year, m, 1).getDay() + 6) % 7

  const prev = () => {
    setMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })
    setSelectedDay(null)
  }
  const next = () => {
    setMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 })
    setSelectedDay(null)
  }

  const monthLabel = new Date(year, m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selStr = selectedDay
    ? `${year}-${String(m + 1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
    : null
  const selEntries = selStr ? (entryDays[selStr] || []) : []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
          <ChevronLeft size={16} className="text-gray-600 dark:text-[#8a9a8e]" />
        </button>
        <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea]">{monthLabel}</h3>
        <button onClick={next} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
          <ChevronRight size={16} className="text-gray-600 dark:text-[#8a9a8e]" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-[#5a6a5e] py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />
          const ds = `${year}-${String(m + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const de = entryDays[ds] || []
          const cnt = de.length
          const isSel = selectedDay === day
          const isToday = ds === new Date().toISOString().slice(0,10)
          const avg = cnt > 0 ? de.reduce((s,e) => s + (e.rating || 0), 0) / cnt : 0

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(isSel ? null : day)}
              className={`relative aspect-square rounded-lg text-xs flex flex-col items-center justify-center transition-all ${
                isSel
                  ? 'bg-leaf-500/20 border border-leaf-500/40 text-leaf-400 font-bold'
                  : isToday
                    ? 'bg-blue-500/10 text-blue-400 font-semibold'
                    : cnt > 0
                      ? 'bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-[#e8f0ea] hover:bg-gray-100 dark:hover:bg-white/[0.08]'
                      : 'text-gray-400 dark:text-[#5a6a5e] hover:bg-gray-50 dark:hover:bg-white/[0.03]'
              }`}
            >
              <span>{day}</span>
              {cnt > 0 && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {cnt <= 3
                    ? Array.from({ length: cnt }).map((_, j) => (
                        <div
                          key={j}
                          className={`w-1.5 h-1.5 rounded-full ${
                            avg >= 4 ? 'bg-leaf-400' : avg >= 3 ? 'bg-amber-400' : 'bg-red-400'
                          }`}
                        />
                      ))
                    : <span className="text-[8px] font-bold text-leaf-400">{cnt}</span>
                  }
                </div>
              )}
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-semibold text-gray-600 dark:text-[#8a9a8e]">
            {new Date(year, m, selectedDay).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </h4>
          {selEntries.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-[#5a6a5e]">No sessions on this day</p>
          ) : selEntries.map(entry => (
            <div
              key={entry.id}
              className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-3 py-2 flex items-center gap-3"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-[#e8f0ea]">
                {entry.strainName}
              </span>
              <StarRating value={entry.rating || 0} size={12} readOnly />
              <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                {METHOD_LABELS[entry.method] || entry.method}
              </span>
              {entry.effects?.length > 0 && (
                <div className="flex gap-1 ml-auto">
                  {entry.effects.slice(0,2).map(eff => {
                    const f = EFFECTS.find(e => e.id === eff)
                    return <span key={eff} className="text-[10px]">{f?.emoji || ''}</span>
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/*  StatsSection                                                      */
/* ================================================================== */
function StatsSection({ entries }) {
  const stats = useMemo(() => {
    if (entries.length < 2) return null
    const total = entries.length
    const uniqueStrains = new Set(entries.map(e => e.strainName?.toLowerCase())).size
    const avgRating = entries.reduce((s, e) => s + (e.rating || 0), 0) / total

    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    entries.forEach(e => { if (e.rating >= 1 && e.rating <= 5) ratingDist[e.rating]++ })
    const maxRD = Math.max(...Object.values(ratingDist), 1)

    const typeCounts = {}
    entries.forEach(e => {
      typeCounts[e.strainType || 'unknown'] = (typeCounts[e.strainType || 'unknown'] || 0) + 1
    })

    const methodCounts = {}
    entries.forEach(e => {
      methodCounts[e.method || 'other'] = (methodCounts[e.method || 'other'] || 0) + 1
    })

    const strainMap = {}
    entries.forEach(e => {
      const n = e.strainName
      if (!n) return
      if (!strainMap[n]) strainMap[n] = { name: n, type: e.strainType, count: 0, total: 0 }
      strainMap[n].count++
      strainMap[n].total += (e.rating || 0)
    })
    const topStrains = Object.values(strainMap)
      .map(s => ({ ...s, avg: s.total / s.count }))
      .sort((a,b) => b.count - a.count || b.avg - a.avg)
      .slice(0,5)
    const maxSC = Math.max(...topStrains.map(s => s.count), 1)

    const effectCounts = {}
    entries.forEach(e => (e.effects || []).forEach(eff => {
      effectCounts[eff] = (effectCounts[eff] || 0) + 1
    }))
    const topEffects = Object.entries(effectCounts).sort(([,a],[,b]) => b - a).slice(0,8)
    const maxEC = Math.max(...topEffects.map(([,c]) => c), 1)

    const monthCounts = {}
    entries.forEach(e => {
      const d = e.date || e.createdAt || ''
      const mo = d.slice(0,7)
      if (mo) monthCounts[mo] = (monthCounts[mo] || 0) + 1
    })
    const sortedMonths = Object.entries(monthCounts).sort().slice(-6)
    const maxMC = Math.max(...sortedMonths.map(([,c]) => c), 1)

    const tryAgain = entries.filter(e => e.wouldTryAgain !== undefined && e.wouldTryAgain !== null)
    const tryPct = tryAgain.length > 0
      ? Math.round(100 * tryAgain.filter(e => e.wouldTryAgain).length / tryAgain.length)
      : null

    return {
      total, uniqueStrains, avgRating, ratingDist, maxRD, typeCounts,
      methodCounts, topStrains, maxSC, topEffects, maxEC, sortedMonths,
      maxMC, tryPct,
    }
  }, [entries])

  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-[#5a6a5e] text-sm">
        Log at least 2 sessions to see stats
      </div>
    )
  }

  const typeColors = {
    indica: 'bg-purple-400',
    sativa: 'bg-orange-400',
    hybrid: 'bg-leaf-400',
    unknown: 'bg-gray-400',
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Sessions', val: stats.total },
          { label: 'Unique Strains', val: stats.uniqueStrains },
          {
            label: 'Avg Rating',
            val: null,
            custom: (
              <div className="flex items-center justify-center gap-1">
                <Star size={16} className="fill-amber-400 text-amber-400" />
                <span className="text-2xl font-bold text-gray-900 dark:text-[#e8f0ea]">
                  {stats.avgRating.toFixed(1)}
                </span>
              </div>
            ),
          },
          {
            label: stats.tryPct !== null ? 'Try Again' : 'Variety',
            val: stats.tryPct !== null ? `${stats.tryPct}%` : stats.uniqueStrains,
          },
        ].map((c, i) => (
          <div key={i} className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] text-center">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] block mb-1">
              {c.label}
            </span>
            {c.custom || (
              <span className="text-2xl font-bold text-gray-900 dark:text-[#e8f0ea]">{c.val}</span>
            )}
          </div>
        ))}
      </div>

      {/* Type Breakdown */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-3">Type Breakdown</h3>
        <div className="flex gap-2">
          {Object.entries(stats.typeCounts).sort(([,a],[,b]) => b - a).map(([type, count]) => {
            const pct = Math.round(100 * count / stats.total)
            return (
              <div key={type} className="flex-1 text-center">
                <div className="h-16 flex items-end justify-center mb-1">
                  <div
                    className={`w-full max-w-[40px] rounded-t-lg ${typeColors[type] || typeColors.unknown}`}
                    style={{ height: `${Math.max(pct, 8)}%`, opacity: 0.8 }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-[#b0c4b4] capitalize block">
                  {type}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                  {pct}% ({count})
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Rating Distribution */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-3">
          Rating Distribution
        </h3>
        <div className="space-y-1.5">
          {[5,4,3,2,1].map(r => (
            <div key={r} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-[#6a7a6e] w-6 text-right">
                {r}\u2605
              </span>
              <div className="flex-1 h-4 bg-gray-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${(stats.ratingDist[r] / stats.maxRD) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] w-6">
                {stats.ratingDist[r]}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Top Strains */}
      {stats.topStrains.length > 0 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-3">
            Most-Logged Strains
          </h3>
          <div className="space-y-2">
            {stats.topStrains.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-[#5a6a5e] w-4">{i + 1}.</span>
                <span className="text-xs font-medium text-gray-900 dark:text-[#e8f0ea] flex-1 truncate">
                  {s.name}
                </span>
                <div className="w-24 h-3 bg-gray-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-leaf-400 rounded-full transition-all"
                    style={{ width: `${(s.count / stats.maxSC) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] w-16 text-right">
                  {s.count}x &middot; {s.avg.toFixed(1)}\u2605
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top Effects */}
      {stats.topEffects.length > 0 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-3">
            Most Reported Effects
          </h3>
          <div className="space-y-1.5">
            {stats.topEffects.map(([eff, count]) => {
              const f = EFFECTS.find(e => e.id === eff)
              const label = f ? `${f.emoji} ${f.label}` : eff
              return (
                <div key={eff} className="flex items-center gap-2">
                  <span className="text-xs text-gray-700 dark:text-[#b0c4b4] w-28 truncate">
                    {label}
                  </span>
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-leaf-400/70 rounded-full transition-all"
                      style={{ width: `${(count / stats.maxEC) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] w-6 text-right">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Method Breakdown */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-3">
          Consumption Methods
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.methodCounts).sort(([,a],[,b]) => b - a).map(([m, count]) => (
            <span
              key={m}
              className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.04] text-xs text-gray-700 dark:text-[#b0c4b4]"
            >
              {METHOD_LABELS[m] || m}{' '}
              <span className="text-gray-400 dark:text-[#5a6a5e]">({count})</span>
            </span>
          ))}
        </div>
      </Card>

      {/* Monthly Activity */}
      {stats.sortedMonths.length > 1 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-3">
            Monthly Activity
          </h3>
          <div className="flex items-end gap-2 h-20">
            {stats.sortedMonths.map(([mo, count]) => {
              const lbl = new Date(mo + '-01').toLocaleDateString('en-US', { month: 'short' })
              return (
                <div key={mo} className="flex-1 flex flex-col items-center">
                  <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mb-1">{count}</span>
                  <div
                    className="w-full rounded-t-lg bg-leaf-400/60"
                    style={{ height: `${Math.max((count / stats.maxMC) * 100, 8)}%` }}
                  />
                  <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mt-1">{lbl}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ================================================================== */
/*  InsightsPanel                                                     */
/* ================================================================== */
function InsightsPanel({ entries }) {
  const [insights, setInsights] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [period, setPeriod]     = useState('all')

  const fetchInsights = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/journal-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, period }),
      })
      if (!res.ok) throw new Error('Failed to generate insights')
      const data = await res.json()
      setInsights(data.insights || 'No insights available')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (entries.length < 2) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-[#5a6a5e] text-sm">
        Log at least 2 sessions to unlock AI insights
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={period} onChange={e => setPeriod(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#b0c4b4] focus:outline-none focus:ring-2 focus:ring-leaf-500/40"
        >
          <option value="all">All Time</option>
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
          <option value="3months">Last 3 Months</option>
        </select>
        <Button size="sm" onClick={fetchInsights} disabled={loading} className={loading ? 'animate-pulse' : ''}>
          {loading
            ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
            : insights
              ? <><RefreshCw size={14} /> Refresh</>
              : <><Brain size={14} /> Analyze My Journal</>
          }
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {insights && (
        <Card className="p-4">
          <div className="text-xs text-gray-700 dark:text-[#b0c4b4] leading-relaxed space-y-2">
            {insights.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return (
                  <h3 key={i} className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mt-4 mb-2">
                    {line.replace('## ', '')}
                  </h3>
                )
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return <p key={i} className="ml-3 text-xs">&bull; {line.slice(2)}</p>
              }
              if (line.trim() === '') return null
              return <p key={i}>{line.replace(/\*\*(.*?)\*\*/g, (_, t) => t)}</p>
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ================================================================== */
/*  FilterBar                                                         */
/* ================================================================== */
function FilterBar({
  search, setSearch, sort, setSort,
  filterMethod, setFilterMethod, filterRating, setFilterRating,
  filterType, setFilterType,
  showFilters, setShowFilters,
  totalFiltered, totalAll,
}) {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5a6a5e]" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search strains or notes..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all"
          />
        </div>
        <select
          value={sort} onChange={e => setSort(e.target.value)} title="Sort"
          className="px-2 py-2 text-xs rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#b0c4b4] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 appearance-none"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          onClick={() => setShowFilters(!showFilters)} title="Filters"
          className={`p-2 rounded-xl border transition-colors ${
            showFilters || filterMethod || filterRating || filterType
              ? 'bg-leaf-500/10 border-leaf-500/30 text-leaf-400'
              : 'bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/10 text-gray-500 dark:text-[#6a7a6e]'
          }`}
        >
          <Filter size={14} />
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
          <select
            value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#b0c4b4]"
          >
            <option value="">All Types</option>
            {['indica','sativa','hybrid'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#b0c4b4]"
          >
            <option value="">All Methods</option>
            {Object.entries(METHOD_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select
            value={filterRating} onChange={e => setFilterRating(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#b0c4b4]"
          >
            <option value="">All Ratings</option>
            {[5,4,3,2,1].map(r => <option key={r} value={r}>{r}\u2605 & up</option>)}
          </select>
          {(filterType || filterMethod || filterRating) && (
            <button
              onClick={() => { setFilterType(''); setFilterMethod(''); setFilterRating('') }}
              className="px-2 py-1 text-xs rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1"
            >
              <X size={12} /> Clear
            </button>
          )}
          <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] self-center ml-auto">
            {totalFiltered} of {totalAll}
          </span>
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/*  EmptyState                                                        */
/* ================================================================== */
function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center mb-4">
        <BookMarked size={28} className="text-gray-300 dark:text-[#5a6a5e]" />
      </div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">
        Start Your Strain Journal
      </h2>
      <p className="text-sm text-gray-500 dark:text-[#8a9a8e] text-center max-w-xs mb-2">
        Log your cannabis sessions to track effects, discover patterns, and unlock AI-powered insights.
      </p>
      <div className="flex flex-wrap gap-2 justify-center text-[10px] text-gray-400 dark:text-[#5a6a5e] mb-6">
        <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-white/[0.04]">{'\u{1F50D}'} Strain search</span>
        <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-white/[0.04]">{'\u{1F4CA}'} Analytics</span>
        <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-white/[0.04]">{'\u{1F4C5}'} Calendar</span>
        <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-white/[0.04]">{'\u{1F9E0}'} AI Insights</span>
      </div>
      <Button onClick={onAdd}><Plus size={14} /> Log Your First Session</Button>
    </div>
  )
}

/* ================================================================== */
/*  JournalPage (main)                                                */
/* ================================================================== */
export default function JournalPage() {
  usePageTitle('Strain Journal')
  const { entries, addEntry, updateEntry, deleteEntry } = useJournal()

  const [activeTab, setActiveTab]     = useState('list')
  const [modalOpen, setModalOpen]     = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)

  const [search, setSearch]             = useState('')
  const [sort, setSort]                 = useState('newest')
  const [filterType, setFilterType]     = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [filterRating, setFilterRating] = useState('')
  const [showFilters, setShowFilters]   = useState(false)

  const filteredEntries = useMemo(() => {
    let list = [...entries]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.strainName?.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q) ||
        e.effects?.some(eff => eff.toLowerCase().includes(q))
      )
    }
    if (filterType) list = list.filter(e => e.strainType === filterType)
    if (filterMethod) list = list.filter(e => e.method === filterMethod)
    if (filterRating) list = list.filter(e => (e.rating || 0) >= parseInt(filterRating))

    switch (sort) {
      case 'newest':  list.sort((a,b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)); break
      case 'oldest':  list.sort((a,b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt)); break
      case 'highest': list.sort((a,b) => (b.rating || 0) - (a.rating || 0)); break
      case 'lowest':  list.sort((a,b) => (a.rating || 0) - (b.rating || 0)); break
      case 'name':    list.sort((a,b) => (a.strainName || '').localeCompare(b.strainName || '')); break
    }
    return list
  }, [entries, search, sort, filterType, filterMethod, filterRating])

  const handleAdd = data => { addEntry(data); setModalOpen(false) }
  const handleUpdate = data => { updateEntry(data); setEditingEntry(null); setModalOpen(false) }
  const handleEdit = entry => { setEditingEntry(entry); setModalOpen(true) }
  const handleClose = () => { setModalOpen(false); setEditingEntry(null) }

  const tabs = [
    { id: 'list',     icon: List,         label: 'Sessions' },
    { id: 'calendar', icon: CalendarDays, label: 'Calendar' },
    { id: 'stats',    icon: BarChart3,    label: 'Stats' },
    { id: 'insights', icon: Brain,        label: 'AI Insights' },
  ]

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea] flex items-center gap-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <BookMarked size={24} className="text-leaf-500" />
            Strain Journal
          </h1>
          <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-0.5">
            {entries.length > 0
              ? `${entries.length} session${entries.length !== 1 ? 's' : ''} logged`
              : 'Track your experiences to improve recommendations'}
          </p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus size={14} /> Log Session
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 bg-gray-100 dark:bg-white/[0.04] rounded-xl p-1 overflow-x-auto">
        {tabs.map(tab => {
          const Ic = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-white/[0.08] text-gray-900 dark:text-[#e8f0ea] shadow-sm'
                  : 'text-gray-500 dark:text-[#6a7a6e] hover:text-gray-700 dark:hover:text-[#b0c4b4]'
              }`}
            >
              <Ic size={13} /> {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'list' && (
        <>
          <FilterBar
            search={search} setSearch={setSearch}
            sort={sort} setSort={setSort}
            filterMethod={filterMethod} setFilterMethod={setFilterMethod}
            filterRating={filterRating} setFilterRating={setFilterRating}
            filterType={filterType} setFilterType={setFilterType}
            showFilters={showFilters} setShowFilters={setShowFilters}
            totalFiltered={filteredEntries.length} totalAll={entries.length}
          />
          {filteredEntries.length > 0 ? (
            <div className="space-y-3 mb-8">
              {filteredEntries.map(entry => (
                <JournalEntryCard
                  key={entry.id}
                  entry={entry}
                  onDelete={deleteEntry}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          ) : entries.length > 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-[#5a6a5e] text-sm">
              No entries match your filters
            </div>
          ) : (
            <EmptyState onAdd={() => setModalOpen(true)} />
          )}
        </>
      )}

      {activeTab === 'calendar' && (
        <Card className="p-4 mb-8">
          <CalendarView entries={entries} />
        </Card>
      )}

      {activeTab === 'stats' && (
        <div className="mb-8">
          <StatsSection entries={entries} />
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="mb-8">
          <InsightsPanel entries={entries} />
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={handleClose}
        title={editingEntry ? 'Edit Journal Entry' : 'Log New Session'}
      >
        <JournalForm
          onSubmit={editingEntry ? handleUpdate : handleAdd}
          onCancel={handleClose}
          initialData={editingEntry}
        />
      </Modal>
    </div>
  )
}
