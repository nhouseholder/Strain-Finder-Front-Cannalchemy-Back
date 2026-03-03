/**
 * One-sentence educational descriptions for terpenes and cannabinoids.
 * Used by ChemTooltip to show hover explanations site-wide.
 */
export const CHEM_DESCRIPTIONS = {
  /* ── Terpenes ────────────────────────────────────────────── */
  myrcene:
    'The most abundant cannabis terpene — promotes deep relaxation and may enhance THC absorption.',
  limonene:
    'Citrus-scented terpene linked to mood elevation, stress relief, and energizing effects.',
  linalool:
    'Floral lavender terpene known for calming, anti-anxiety, and sedative properties.',
  caryophyllene:
    'The only terpene that binds to CB2 receptors — associated with pain relief and anti-inflammation.',
  pinene:
    'Pine-scented terpene linked to alertness, memory retention, and mental clarity.',
  terpinolene:
    'Complex herbal terpene with piney, floral notes — associated with uplifting, creative effects.',
  humulene:
    'Woody, hoppy terpene noted for appetite suppression and anti-inflammatory properties.',
  ocimene:
    'Sweet herbal terpene associated with energizing and decongestant effects.',
  bisabolol:
    'Gentle chamomile-derived terpene known for soothing and skin-healing properties.',

  /* ── Cannabinoids ────────────────────────────────────────── */
  thc:
    'The primary psychoactive compound — produces euphoria, pain relief, and altered perception.',
  cbd:
    'Non-psychoactive cannabinoid known for anti-anxiety and anti-inflammatory benefits without a "high."',
  cbn:
    'Mildly psychoactive compound formed as THC ages — commonly associated with sedation and sleep.',
  cbg:
    'The "mother cannabinoid" — a non-psychoactive precursor to THC and CBD with neuroprotective potential.',
  thcv:
    'Energizing cannabinoid that may suppress appetite — psychoactive only at higher doses.',
  cbc:
    'Non-psychoactive cannabinoid with antidepressant-like effects that works synergistically with others.',
}

/**
 * Look up a one-sentence description for any terpene or cannabinoid name.
 * Handles variations like "THC %", "Δ9-THC", "β-Caryophyllene", etc.
 */
export function getChemDescription(name) {
  if (!name) return null
  const key = name.toLowerCase().replace(/[^a-z]/g, '')
  return CHEM_DESCRIPTIONS[key] || null
}
