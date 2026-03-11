import clsx from 'clsx'
import { getRankForPoints, RANK_TIERS } from '../../services/reviewsService'

const COLOR_MAP = {
  green:  'bg-green-400/20 text-green-500 dark:text-green-400',
  blue:   'bg-blue-400/20 text-blue-500 dark:text-blue-400',
  purple: 'bg-purple-400/20 text-purple-500 dark:text-purple-400',
  amber:  'bg-amber-400/20 text-amber-500 dark:text-amber-400',
  red:    'bg-red-400/20 text-red-500 dark:text-red-400',
}

const DOT_MAP = {
  green: 'bg-green-400',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
}

export default function ContributorBadge({ points = 0, rank, className }) {
  const tier = rank
    ? RANK_TIERS.find(t => t.rank === rank) || RANK_TIERS[0]
    : getRankForPoints(points)

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none',
        COLOR_MAP[tier.color] || COLOR_MAP.green,
        className
      )}
      title={`${tier.rank} — ${points} pts`}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', DOT_MAP[tier.color] || DOT_MAP.green)} />
      {tier.rank}
    </span>
  )
}
