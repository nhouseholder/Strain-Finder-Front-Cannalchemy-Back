/**
 * Generates a personal, empathetic description of a strain's smoking experience.
 * Uses the strain's existing data (flavors, terpenes, effects, type, sommelier notes)
 * to craft something that reads like a friend telling you about it.
 *
 * Top matches (matchPct >= 80) get a warm, "sell you on it" tone.
 * Mid matches (60-79) are balanced.
 * Lower matches are more objective and factual.
 */

/* ---------- helpers ---------- */

const TERPENE_VIBES = {
  myrcene:       { aroma: 'earthy and musky',   feel: 'deeply relaxing body melt' },
  limonene:      { aroma: 'bright citrus',       feel: 'uplifting mood boost' },
  caryophyllene: { aroma: 'peppery and spicy',   feel: 'soothing, anti-inflammatory calm' },
  linalool:      { aroma: 'floral lavender',      feel: 'gentle anxiety-easing warmth' },
  pinene:        { aroma: 'fresh pine forest',     feel: 'clear-headed alertness' },
  terpinolene:   { aroma: 'herbal and fruity',    feel: 'creative, slightly dreamy buzz' },
  humulene:      { aroma: 'woody and hoppy',      feel: 'grounded, appetite-suppressing calm' },
  ocimene:       { aroma: 'sweet and herbaceous',  feel: 'energizing, decongestant freshness' },
  bisabolol:     { aroma: 'delicate chamomile',    feel: 'gentle, skin-soothing relaxation' },
  valencene:     { aroma: 'sweet orange peel',     feel: 'cheerful, light-hearted energy' },
  geraniol:      { aroma: 'rose and citrus',       feel: 'calming, neuroprotective ease' },
  nerolidol:     { aroma: 'woody and floral',      feel: 'sedating, tranquil wind-down' },
}

const TYPE_PERSONALITY = {
  sativa:  { energy: 'cerebral and energizing', time: 'daytime adventure', vibe: 'creative spark' },
  indica:  { energy: 'full-body and sedating',  time: 'evening wind-down',  vibe: 'cozy blanket' },
  hybrid:  { energy: 'balanced and versatile',   time: 'any-time companion', vibe: 'best of both worlds' },
}

function pick(arr, n = 2) {
  return (arr || []).slice(0, n)
}

function joinNatural(items) {
  if (!items.length) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function lc(s) {
  return (s || '').toLowerCase()
}

/* ---------- main generator ---------- */

export function generateExperienceDescription(strain) {
  if (!strain) return ''

  const matchPct = strain.matchPct || 0
  const isTopMatch = matchPct >= 80
  const isMidMatch = matchPct >= 60

  const type = lc(strain.type) || 'hybrid'
  const tp = TYPE_PERSONALITY[type] || TYPE_PERSONALITY.hybrid
  const flavors = (strain.flavors || []).map(f => f.toLowerCase())
  const terpNames = (strain.terpenes || []).map(t => lc(t.name))
  const effects = (strain.effects || []).slice(0, 5).map(e => lc(e))
  const bestFor = (strain.bestFor || []).slice(0, 3)
  const thc = strain.thc || 0
  const somNotes = strain.sommelierNotes || {}

  const parts = []

  // --- Opening: Flavor / taste ---
  if (somNotes.taste && somNotes.taste.length > 10) {
    // Use sommelier taste note, clean up "Notes of" prefix
    const taste = somNotes.taste.replace(/^notes of\s*/i, '')
    if (isTopMatch) {
      parts.push(`Expect flavors of ${taste} that linger pleasantly on the palate.`)
    } else {
      parts.push(`On the inhale you'll notice ${taste}.`)
    }
  } else if (flavors.length > 0) {
    const fl = joinNatural(pick(flavors, 3))
    if (isTopMatch) {
      parts.push(`It opens with rich notes of ${fl} that make every draw feel intentional.`)
    } else {
      parts.push(`It carries flavors of ${fl}.`)
    }
  }

  // --- Aroma from terpenes ---
  const terpDescriptions = terpNames
    .slice(0, 2)
    .map(t => TERPENE_VIBES[t]?.aroma)
    .filter(Boolean)

  if (terpDescriptions.length > 0) {
    const aromaStr = joinNatural(terpDescriptions)
    if (somNotes.aroma && somNotes.aroma.length > 10) {
      const aroma = somNotes.aroma.replace(/^aromatic with\s*/i, '')
      parts.push(`The aroma is ${aroma} \u2014 ${aromaStr} undertones that set the mood before you even light up.`)
    } else {
      parts.push(`The aroma leans ${aromaStr}.`)
    }
  }

  // --- The high / experience ---
  const terpFeels = terpNames
    .slice(0, 2)
    .map(t => TERPENE_VIBES[t]?.feel)
    .filter(Boolean)

  if (isTopMatch) {
    if (effects.length >= 2) {
      parts.push(`The high is described as ${effects[0]} and ${effects[1]} \u2014 a ${tp.vibe} that settles in smoothly.`)
    } else if (effects.length === 1) {
      parts.push(`People describe the high as ${effects[0]} \u2014 a genuine ${tp.vibe} experience.`)
    }

    if (terpFeels.length > 0) {
      parts.push(`Users often report a ${joinNatural(terpFeels)} that builds gently without overwhelming.`)
    }
  } else if (isMidMatch) {
    if (effects.length >= 2) {
      parts.push(`The experience leans ${effects[0]} and ${effects[1]}, with a ${tp.energy} character.`)
    }
    if (terpFeels.length > 0) {
      parts.push(`Many users note a ${terpFeels[0]}.`)
    }
  } else {
    // Lower match — objective
    if (effects.length >= 2) {
      parts.push(`Effects are commonly reported as ${effects[0]} and ${effects[1]}.`)
    }
    parts.push(`It has a ${tp.energy} profile.`)
  }

  // --- THC context ---
  if (thc > 0) {
    if (thc >= 25) {
      parts.push(`At ${thc}% THC, this one packs a punch \u2014 best approached with a little respect.`)
    } else if (thc >= 18) {
      parts.push(`With ${thc}% THC, it hits a sweet spot \u2014 potent enough to feel meaningful, gentle enough to stay present.`)
    } else if (thc >= 10) {
      parts.push(`At ${thc}% THC, it\u2019s on the milder side \u2014 a good choice if you prefer staying functional.`)
    }
  }

  // --- Best for context (top matches only) ---
  if (isTopMatch && bestFor.length > 0) {
    const uses = joinNatural(bestFor.map(b => b.toLowerCase()))
    parts.push(`People love it for ${uses}.`)
  }

  // --- Smoke quality ---
  if (somNotes.smoke && isTopMatch) {
    parts.push(somNotes.smoke.charAt(0).toUpperCase() + somNotes.smoke.slice(1) + '.')
  }

  // --- Closing warmth for top matches ---
  if (isTopMatch && parts.length > 2) {
    const closers = [
      `A genuinely enjoyable ${tp.time} strain.`,
      `This is the kind of strain you come back to.`,
      `An easy recommendation for anyone who values ${flavors[0] || 'quality'} and ${effects[0] || 'good vibes'}.`,
    ]
    // Pick a consistent closer based on strain name hash
    const hash = strain.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    parts.push(closers[hash % closers.length])
  }

  return parts.join(' ')
}
