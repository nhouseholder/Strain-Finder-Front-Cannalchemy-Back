import { memo, useMemo } from 'react'
import { Heart, Info, ChevronDown, ChevronUp, Star, GitCompareArrows } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import Card from '../shared/Card'
import { TypeBadge, EffectBadge } from '../shared/Badge'
import TerpBadge from '../shared/TerpBadge'
import ProgressBar from '../shared/ProgressBar'
import Tooltip from '../shared/Tooltip'
import { getTypeColor } from '../../utils/colors'
import { normalizeStrain } from '../../utils/normalizeStrain'
import StrainCardExpanded from './StrainCardExpanded'
import AvailabilityBadge from './AvailabilityBadge'
import QuickRate from '../ratings/QuickRate'
import { useRatings } from '../../hooks/useRatings'

function CannabinoidMiniGrid({ strain }) {
  const items = [
    { name: 'THC', value: strain.thc, color: '#32c864' },
    { name: 'CBD', value: strain.cbd, color: '#3b82f6' },
    { name: 'CBN', value: strain.cbn, color: '#a855f7' },
    { name: 'CBG', value: strain.cbg, color: '#f59e0b' },
  ].filter(c => c.value != null)

  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
      {items.map((c) => (
        <ProgressBar
          key={c.name}
          label={c.name}
          value={c.value}
          max={c.name === 'THC' ? 35 : 20}
          color={c.color}
          height={4}
        />
      ))}
    </div>
  )
}

function StrainCard({ strain: rawStrain, expanded, onToggle, isFavorite, onFavorite, availability, availabilityLoading, onViewDispensary, hideExpandButton }) {
  const strain = useMemo(() => normalizeStrain(rawStrain), [rawStrain])
  const { getRating, rateStrain } = useRatings()
  const existingRating = getRating(strain.name)
  const tc = getTypeColor(strain.type)
  const topTerpenes = (strain.terpenes || []).slice(0, 3)
  const navigate = useNavigate()

  return (
    <Card
      className={clsx(
        'p-4 transition-all duration-300',
        expanded && 'border-leaf-500/30 dark:border-leaf-500/30'
      )}
    >
      {/* Clickable header region */}
      <div
        className="cursor-pointer"
        onClick={() => onToggle?.()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle?.()
          }
        }}
        aria-expanded={expanded}
      >
        {/* Row 1: Name, Type Badge, Match %, Favorite */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="text-lg font-bold text-gray-900 dark:text-white truncate"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {strain.name}
              </h3>
              <TypeBadge type={strain.type} />
              {/* Why This Match - info icon tooltip */}
              {strain.whyMatch && (
                <Tooltip content={strain.whyMatch}>
                  <Info size={14} className="text-leaf-400/60 hover:text-leaf-400 transition-colors" />
                </Tooltip>
              )}
            </div>

            {/* Genetics line */}
            {strain.genetics && strain.genetics.toLowerCase() !== 'null' && (
              <p className="text-[11px] italic text-gray-400 dark:text-[#6a7a6e] mt-0.5 truncate">
                {strain.genetics}
              </p>
            )}

            {/* Description tagline */}
            {strain.description && strain.description.toLowerCase() !== 'null' && (
              <p className="text-[11px] text-gray-500 dark:text-[#8a9a8e] mt-1 line-clamp-1">
                {strain.description}
              </p>
            )}
          </div>

          {/* Match % + Favorite */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Match percentage box */}
            {strain.matchPct != null && (
              <div
                className="flex items-center justify-center min-w-[48px] h-10 rounded-xl text-sm font-bold border"
                style={{
                  backgroundColor: `${tc.hex}18`,
                  borderColor: `${tc.hex}44`,
                  color: tc.hex,
                }}
              >
                {Math.round(strain.matchPct)}%
              </div>
            )}

            {/* Availability badge */}
            <div onClick={(e) => e.stopPropagation()}>
              <AvailabilityBadge
                strainName={strain.name}
                availability={availability}
                loading={availabilityLoading}
                onViewDispensary={onViewDispensary}
              />
            </div>

            {/* Compare button */}
            <button
              type="button"
              className={clsx(
                'flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500',
                'text-gray-400 dark:text-[#6a7a6e] hover:text-purple-400 hover:bg-purple-500/10'
              )}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/compare?add=${encodeURIComponent(strain.name)}`)
              }}
              aria-label={`Compare ${strain.name}`}
              title="Compare strain"
            >
              <GitCompareArrows size={16} />
            </button>

            {/* Favorite button */}
            <button
              type="button"
              className={clsx(
                'flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500',
                isFavorite
                  ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                  : 'text-gray-400 dark:text-[#6a7a6e] hover:text-red-400 hover:bg-red-500/10'
              )}
              onClick={(e) => {
                e.stopPropagation()
                onFavorite?.(strain.name)
              }}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* Row 2: Best For tags + Effect tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {strain.bestFor?.slice(0, 4).map((tag) => (
            <span
              key={`bf-${tag}`}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-leaf-500/12 text-leaf-500 dark:text-leaf-400 border border-leaf-500/20"
            >
              {tag}
            </span>
          ))}
          {strain.effects?.slice(0, strain.bestFor?.length ? 3 : 6).map((effect, idx) => {
            const label = typeof effect === 'string' ? effect : (effect?.name || effect?.label || `effect-${idx}`)
            return <EffectBadge key={label} effect={label} variant="positive" />
          })}
        </div>

        {/* Row 3: Cannabinoid mini bars */}
        <CannabinoidMiniGrid strain={strain} />

        {/* Row 4: Top 3 terpenes + community sentiment */}
        <div className="flex items-center justify-between mt-3">
          {/* Terpenes */}
          <div className="flex flex-wrap gap-1">
            {topTerpenes.map((t, idx) => (
              <TerpBadge
                key={t.name || `terp-${idx}`}
                name={t.name}
                pct={t.pct != null ? (String(t.pct).includes('%') ? t.pct : `${t.pct}%`) : ''}
              />
            ))}
          </div>

          {/* Community sentiment + Your rating + review count */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Your rating (compact stars) */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <span className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e] font-semibold">
                Rate
              </span>
              <QuickRate
                strainName={strain.name}
                strainType={strain.type}
                existingRating={existingRating}
                onRate={rateStrain}
                compact
              />
            </div>

            {/* Community sentiment */}
            {(strain.sentimentScore != null || strain.reviewCount != null) && (
              <div className="flex items-center gap-1.5">
                {strain.sentimentScore != null && (
                  <div className="flex items-center gap-0.5">
                    <Star size={11} className="text-amber-400" fill="currentColor" />
                    <span className="text-[11px] font-semibold text-gray-700 dark:text-[#b0c4b4]">
                      {typeof strain.sentimentScore === 'number'
                        ? strain.sentimentScore.toFixed(1)
                        : strain.sentimentScore}
                    </span>
                  </div>
                )}
                {strain.reviewCount != null && (
                  <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
                    ({strain.reviewCount})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expand / Collapse button — hidden when auto-expanded for single result */}
        {hideExpandButton ? null : expanded ? (
          <div className="flex items-center justify-center gap-1.5 mt-3 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
            <ChevronUp size={14} className="text-leaf-400" />
            <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">
              Collapse
            </span>
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.04]">
            <div
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-leaf-500/[0.08] via-purple-500/[0.06] to-leaf-500/[0.08] border border-leaf-500/20 hover:border-leaf-500/40 hover:from-leaf-500/[0.14] hover:via-purple-500/[0.10] hover:to-leaf-500/[0.14] transition-all duration-300 group"
            >
              <span className="text-xs font-semibold text-leaf-500 dark:text-leaf-400 group-hover:text-leaf-400">
                View All Details
              </span>
              <ChevronDown
                size={16}
                className="text-leaf-500 dark:text-leaf-400 group-hover:translate-y-0.5 transition-transform duration-200"
              />
            </div>
          </div>
        )}
      </div>

      {/* Expanded detail section */}
      {expanded && (
        <StrainCardExpanded strain={strain} />
      )}

      {/* Legal micro-disclaimer */}
      <p className="text-[8px] text-gray-300 dark:text-[#6a7a6e] text-center mt-2 px-2">
        Community-reported data. Not medical advice. Individual results vary.
      </p>
    </Card>
  )
}

export default memo(StrainCard)
