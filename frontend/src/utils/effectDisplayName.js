/**
 * Maps canonical effect names (from the quiz engine) to user-friendly display names.
 * Uses wellness-oriented language rather than medical/clinical terminology.
 * These describe community-reported experiences, not medical claims.
 */
const CANONICAL_TO_DISPLAY = {
  pain: 'Body Comfort',
  stress: 'Stress Ease',
  anxiety: 'Calm & Ease',
  inflammation: 'Soothing',
  insomnia: 'Restful',
  'appetite-loss': 'Appetite Boost',
  arthritis: 'Joint Comfort',
  fibromyalgia: 'Full-Body Ease',
  depression: 'Mood Lift',
  nausea: 'Stomach Calm',
  fatigue: 'Energy Boost',
  'muscle-spasms': 'Muscle Ease',
  headache: 'Head Comfort',
  migraines: 'Head Ease',
  seizures: 'Calming',
  ptsd: 'Emotional Ease',
  cramps: 'Body Ease',
}

/**
 * Convert a canonical effect name to a friendly display name.
 * First checks the explicit map, then falls back to title-casing.
 */
export function getEffectDisplayName(canonicalName) {
  if (!canonicalName) return ''
  const str = typeof canonicalName === 'string' ? canonicalName : (canonicalName?.name || canonicalName?.label || String(canonicalName))
  const lower = str.toLowerCase().trim()
  if (CANONICAL_TO_DISPLAY[lower]) return CANONICAL_TO_DISPLAY[lower]
  // Fallback: replace hyphens with spaces and title-case
  return str
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
