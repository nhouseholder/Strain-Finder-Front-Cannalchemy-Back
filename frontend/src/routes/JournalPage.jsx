import { useState, useMemo } from 'react'
import usePageTitle from '../hooks/usePageTitle'
import { useJournal } from '../hooks/useJournal'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import Modal from '../components/shared/Modal'
import { EffectBadge } from '../components/shared/Badge'
import {
  Plus,
  BookMarked,
  Star,
  Trash2,
  Calendar,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                         */
/* ------------------------------------------------------------------ */
const METHOD_LABELS = {
  flower: 'Flower/Smoke',
  vape: 'Vape',
  edibles: 'Edibles',
  concentrates: 'Concentrates',
  tinctures: 'Tinctures',
  topicals: 'Topicals',
  other: 'Other',
}

const COMMON_EFFECTS = [
  'Relaxed', 'Happy', 'Euphoric', 'Creative', 'Energetic',
  'Focused', 'Sleepy', 'Uplifted', 'Hungry', 'Talkative',
  'Body Comfort', 'Calm & Ease', 'Calm', 'Giggly',
]

/* ------------------------------------------------------------------ */
/*  StarRating                                                        */
/* ------------------------------------------------------------------ */
function StarRating({ value, onChange, size = 20 }) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-colors"
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <Star
            size={size}
            className={
              star <= (hover || value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-gray-300 dark:text-[#5a6a5e]'
            }
          />
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  JournalForm (inline)                                              */
/* ------------------------------------------------------------------ */
function JournalForm({ onSubmit, onCancel }) {
  const [strainName, setStrainName] = useState('')
  const [strainType, setStrainType] = useState('hybrid')
  const [rating, setRating] = useState(0)
  const [method, setMethod] = useState('flower')
  const [effects, setEffects] = useState([])
  const [notes, setNotes] = useState('')

  const toggleEffect = (eff) => {
    setEffects((prev) =>
      prev.includes(eff) ? prev.filter((e) => e !== eff) : [...prev, eff]
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!strainName.trim() || rating === 0) return
    onSubmit({
      strainName: strainName.trim(),
      strainType,
      rating,
      method,
      effects,
      notes: notes.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Strain name */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">
          Strain Name *
        </label>
        <input
          type="text"
          value={strainName}
          onChange={(e) => setStrainName(e.target.value)}
          placeholder="e.g., Blue Dream"
          className="w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all"
          required
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">
          Type
        </label>
        <div className="flex gap-2">
          {['indica', 'sativa', 'hybrid'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setStrainType(t)}
              className={`flex-1 py-2 text-xs rounded-lg font-medium capitalize transition-all ${
                strainType === t
                  ? 'bg-leaf-500/15 text-leaf-400 border border-leaf-500/30'
                  : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border border-transparent hover:bg-gray-200 dark:hover:bg-white/[0.08]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">
          Rating *
        </label>
        <StarRating value={rating} onChange={setRating} />
      </div>

      {/* Method */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">
          Method
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all appearance-none"
        >
          {Object.entries(METHOD_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Effects */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">
          Effects Felt
        </label>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_EFFECTS.map((eff) => (
            <button
              key={eff}
              type="button"
              onClick={() => toggleEffect(eff)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                effects.includes(eff)
                  ? 'bg-leaf-500/15 text-leaf-400 border border-leaf-500/30'
                  : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] border border-transparent hover:bg-gray-200 dark:hover:bg-white/[0.08]'
              }`}
            >
              {eff}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-[#8a9a8e] mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="How did it make you feel? Any tips or observations..."
          className="w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] focus:outline-none focus:ring-2 focus:ring-leaf-500/40 transition-all resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" size="full" disabled={!strainName.trim() || rating === 0}>
          Save Entry
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/*  JournalEntry (inline)                                             */
/* ------------------------------------------------------------------ */
function JournalEntryCard({ entry, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return ''
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Name + rating */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea]">
              {entry.strainName}
            </h3>
            {entry.strainType && (
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] capitalize">
                {entry.strainType}
              </span>
            )}
          </div>

          {/* Stars */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={14}
                  className={
                    s <= (entry.rating || 0)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-200 dark:text-[#6a7a6e]'
                  }
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
              {METHOD_LABELS[entry.method] || entry.method}
            </span>
          </div>

          {/* Effects */}
          {entry.effects?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {entry.effects.slice(0, expanded ? undefined : 4).map((eff) => (
                <EffectBadge key={eff} effect={eff} variant="neutral" />
              ))}
              {!expanded && entry.effects.length > 4 && (
                <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] self-center">
                  +{entry.effects.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Notes preview */}
          {entry.notes && (
            <p className={`text-xs text-gray-500 dark:text-[#8a9a8e] leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
              {entry.notes}
            </p>
          )}
        </div>

        {/* Date + delete */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] flex items-center gap-1">
            <Calendar size={10} />
            {formatDate(entry.createdAt)}
          </span>
          <button
            onClick={() => onDelete(entry.id)}
            className="p-1.5 rounded-lg text-gray-300 dark:text-[#5a6a5e] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label="Delete entry"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expand toggle */}
      {(entry.notes || entry.effects?.length > 4) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-[#5a6a5e] hover:text-leaf-500 transition-colors mt-2"
        >
          {expanded ? (
            <>
              Show less <ChevronUp size={12} />
            </>
          ) : (
            <>
              Show more <ChevronDown size={12} />
            </>
          )}
        </button>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  JournalStats (inline)                                             */
/* ------------------------------------------------------------------ */
function JournalStatsSection({ stats }) {
  if (!stats || stats.totalEntries < 3) return null

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={14} className="text-leaf-500" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-[#b0c4b4]">
          Journal Insights
        </h2>
        <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
          {stats.totalEntries} entries
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Avg rating */}
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] block mb-1">
            Avg Rating
          </span>
          <div className="flex items-center gap-1">
            <Star size={16} className="fill-amber-400 text-amber-400" />
            <span className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea]">
              {stats.avgRating.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Preferred type */}
        {stats.typeCounts && Object.keys(stats.typeCounts).length > 0 && (
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] block mb-1">
              Preferred Type
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] capitalize">
              {Object.entries(stats.typeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'}
            </span>
          </div>
        )}

        {/* Top effects */}
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] col-span-2">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] block mb-1.5">
            Most Reported Effects
          </span>
          <div className="flex flex-wrap gap-1">
            {stats.topEffects.slice(0, 5).map((e) => (
              <span
                key={e.effect}
                className="px-2 py-0.5 rounded-md text-[10px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20"
              >
                {e.effect} ({e.count}x)
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  JournalPage                                                       */
/* ------------------------------------------------------------------ */
export default function JournalPage() {
  usePageTitle('Strain Journal')
  const { entries, addEntry, deleteEntry, getJournalStats } = useJournal()
  const [modalOpen, setModalOpen] = useState(false)

  const stats = useMemo(() => getJournalStats(), [getJournalStats])

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [entries]
  )

  const handleAddEntry = (data) => {
    addEntry(data)
    setModalOpen(false)
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea] flex items-center gap-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <BookMarked size={24} className="text-leaf-500" />
            Strain Journal
          </h1>
          <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-0.5">
            Track your experiences to improve recommendations
          </p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus size={14} />
          Add Entry
        </Button>
      </div>

      {/* Stats */}
      <JournalStatsSection stats={stats} />

      {/* Entry list */}
      {sortedEntries.length > 0 ? (
        <div className="space-y-3 mb-8">
          {sortedEntries.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              onDelete={deleteEntry}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center mb-4">
            <BookMarked size={28} className="text-gray-300 dark:text-[#5a6a5e]" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">
            Your journal is empty
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#8a9a8e] text-center max-w-xs mb-6">
            Log your first strain experience to start building personalized recommendations.
          </p>
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={14} />
            Log Your First Experience
          </Button>
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Journal Entry"
      >
        <JournalForm
          onSubmit={handleAddEntry}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
