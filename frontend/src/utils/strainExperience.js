/**
 * Generates a personal, poetic description of a strain's full experience —
 * appearance, taste, aroma, the arc of the high, and the comedown.
 *
 * Top matches (≥ 80%) get a warm, sell-you-on-it tone.
 * Mid matches (60-79%) are balanced. Lower matches stay objective.
 */

/* ------------------------------------------------------------------ */
/*  Flavor specificity — turn generic words into vivid, real flavors  */
/* ------------------------------------------------------------------ */

const FLAVOR_SPECIFICS = {
  citrus:    ['blood orange', 'Meyer lemon', 'tangerine zest', 'ruby grapefruit', 'clementine peel', 'key lime'],
  sweet:     ['raw honey', 'brown sugar', 'ripe fig', 'vanilla bean', 'caramel', 'maple syrup'],
  berry:     ['wild blackberry', 'ripe raspberry', 'crushed blueberry', 'dark cherry', 'boysenberry'],
  fruity:    ['sun-ripened mango', 'fresh peach', 'sliced papaya', 'passion fruit', 'guava nectar'],
  earthy:    ['damp forest floor', 'fresh-turned soil', 'wet clay', 'mushroom', 'petrichor'],
  woody:     ['aged cedar', 'sandalwood', 'fresh-cut oak', 'birch bark', 'driftwood'],
  pine:      ['blue spruce', 'juniper', 'fresh rosemary', 'crushed pine needle', 'fir resin'],
  spicy:     ['cracked black pepper', 'cinnamon bark', 'clove bud', 'cardamom', 'star anise'],
  floral:    ['jasmine', 'fresh lavender', 'honeysuckle', 'rose water', 'chamomile blossom'],
  tropical:  ['ripe pineapple', 'coconut cream', 'lychee', 'starfruit', 'passion fruit'],
  herbal:    ['fresh basil', 'sage', 'thyme', 'oregano', 'mint leaf'],
  diesel:    ['jet fuel', 'fresh asphalt after rain', 'motor oil and rubber', 'sharp petroleum'],
  skunky:    ['dank musk', 'sharp skunk', 'pungent funk'],
  cheese:    ['aged cheddar', 'sharp parmesan rind', 'creamy brie'],
  grape:     ['Concord grape', 'crushed wine grape', 'plum skin', 'dark raisin'],
  lemon:     ['fresh Meyer lemon', 'lemon curd', 'lemon zest', 'candied lemon peel'],
  orange:    ['blood orange', 'navel orange zest', 'tangerine', 'mandarin peel'],
  mango:     ['ripe Alphonso mango', 'mango lassi', 'dried mango'],
  blueberry: ['wild Maine blueberry', 'blueberry preserves', 'frosted blueberry'],
  strawberry:['sun-warmed strawberry', 'strawberry jam', 'fresh strawberry'],
  mint:      ['fresh spearmint', 'peppermint', 'wild mint leaf'],
  coffee:    ['dark-roast espresso', 'cold-brew coffee', 'roasted coffee bean'],
  chocolate: ['dark cacao', 'cocoa nib', 'bittersweet chocolate'],
  vanilla:   ['Madagascar vanilla', 'vanilla bean pod', 'bourbon vanilla'],
  nutty:     ['toasted almond', 'roasted hazelnut', 'walnut', 'cashew butter'],
  peppery:   ['cracked Tellicherry pepper', 'Szechuan peppercorn', 'pink peppercorn'],
  honey:     ['wildflower honey', 'buckwheat honey', 'raw honeycomb'],
  butter:    ['brown butter', 'cultured butter', 'ghee'],
  apple:     ['Honeycrisp apple', 'green Granny Smith', 'baked apple'],
  pear:      ['ripe Bartlett pear', 'Asian pear', 'poached pear'],
  peach:     ['white peach', 'Georgia peach', 'nectarine'],
}

/* ------------------------------------------------------------------ */
/*  Terpene data — aroma + experiential feel                          */
/* ------------------------------------------------------------------ */

const TERPENE_VIBES = {
  myrcene:       { aroma: 'ripe mango and fresh hops',          feel: 'heavy-lidded body melt' },
  limonene:      { aroma: 'tangerine zest and lemon rind',      feel: 'sunny, uplifting mood lift' },
  caryophyllene: { aroma: 'cracked black pepper and clove',     feel: 'warm, soothing ease' },
  linalool:      { aroma: 'French lavender and sweet basil',    feel: 'soft, tension-dissolving calm' },
  pinene:        { aroma: 'blue spruce and rosemary',           feel: 'crisp, clear-headed focus' },
  terpinolene:   { aroma: 'fresh lilac and green apple',        feel: 'dreamy, creative float' },
  humulene:      { aroma: 'dried hops and coriander',           feel: 'grounded, earthy stillness' },
  ocimene:       { aroma: 'sweet basil and orchid',             feel: 'energizing, open-air freshness' },
  bisabolol:     { aroma: 'chamomile tea and warm honey',       feel: 'gentle, silky ease' },
  valencene:     { aroma: 'Valencia orange peel',               feel: 'cheerful, light-hearted pep' },
  geraniol:      { aroma: 'rose petal and peach skin',          feel: 'calming, floral softness' },
  nerolidol:     { aroma: 'jasmine bark and fresh ginger',      feel: 'deep, tranquil wind-down' },
}

/* ------------------------------------------------------------------ */
/*  Type-based personality                                            */
/* ------------------------------------------------------------------ */

const TYPE_PERSONALITY = {
  sativa: {
    energy: 'cerebral and energizing',
    onset: 'It starts behind the eyes — a bright, electric spark that lifts your thoughts upward.',
    peak:  'At its peak the mind hums with ideas, everything feels a little more interesting.',
    fade:  'It fades gently, like the last hour of golden light, leaving you clearheaded and content.',
  },
  indica: {
    energy: 'full-body and sedating',
    onset: 'It begins in the shoulders — a warm heaviness that invites you to exhale and let go.',
    peak:  'At its peak every muscle softens, the couch feels like a cloud, and time slows down.',
    fade:  'It tapers into a drowsy, dreamless calm — the kind of night where you sleep like you mean it.',
  },
  hybrid: {
    energy: 'balanced and versatile',
    onset: 'It arrives as a gentle wave — part cerebral glow, part physical ease, meeting in the middle.',
    peak:  'At its peak you feel both present and relaxed, mind active but body comfortable.',
    fade:  'It eases out gradually, leaving a pleasant afterglow — clear enough to carry on, calm enough to unwind.',
  },
}

/* ------------------------------------------------------------------ */
/*  Appearance — bud structure by type + terpene-driven color hints    */
/* ------------------------------------------------------------------ */

const TYPE_APPEARANCE = {
  sativa: {
    shape: ['long, finger-like buds', 'airy, elongated nugs', 'wispy, open-structured colas'],
    density: ['light and fluffy to the touch', 'loosely stacked with visible pistils', 'airy with a gentle squeeze'],
  },
  indica: {
    shape: ['dense, golf-ball nugs', 'tight, chunky buds', 'compact, rock-hard colas'],
    density: ['heavy in the hand, solid and satisfying', 'firm and tightly packed', 'dense enough to clink if you tapped them together'],
  },
  hybrid: {
    shape: ['medium-density buds with a balanced structure', 'well-formed, cone-shaped nugs', 'rounded buds with a mix of tight and airy layers'],
    density: ['a satisfying middle ground — not too airy, not a brick', 'moderately dense with a slight give when squeezed', 'nicely structured with a gentle firmness'],
  },
}

// Map dominant terpene to likely color palette
const TERPENE_COLORS = {
  myrcene:       { bud: 'deep forest green',            trichomes: 'milky white',   pistils: 'burnt orange' },
  limonene:      { bud: 'bright lime green',             trichomes: 'frosty white',  pistils: 'golden amber' },
  caryophyllene: { bud: 'olive green with brown hues',   trichomes: 'sparkling amber',pistils: 'dark russet' },
  linalool:      { bud: 'soft sage green with lavender undertones', trichomes: 'crystalline white', pistils: 'light copper' },
  pinene:        { bud: 'vivid emerald green',           trichomes: 'glistening white',pistils: 'pale orange' },
  terpinolene:   { bud: 'minty green with purple streaks',trichomes: 'dewy white',   pistils: 'pinkish amber' },
  humulene:      { bud: 'muted army green',              trichomes: 'dusty gold',    pistils: 'dark amber' },
  ocimene:       { bud: 'bright spring green',           trichomes: 'sugary white',  pistils: 'orange-gold' },
  bisabolol:     { bud: 'pale green with yellow tints',  trichomes: 'silky white',   pistils: 'light amber' },
  valencene:     { bud: 'golden-green',                  trichomes: 'glittering white',pistils: 'tangerine' },
  geraniol:      { bud: 'green with rosy purple tips',   trichomes: 'frosty crystal',pistils: 'rose pink' },
  nerolidol:     { bud: 'dark green with violet shadows',trichomes: 'thick white frost',pistils: 'deep amber' },
}

const DEFAULT_COLORS = { bud: 'green', trichomes: 'frosty white', pistils: 'amber' }

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function joinNatural(items) {
  if (!items.length) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function lc(s) { return (s || '').toLowerCase().trim() }

/** Deterministic pick from array using a string hash */
function hashPick(arr, seed) {
  const h = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return arr[h % arr.length]
}

/** Turn a generic flavor word into something vivid and specific */
function specifyFlavor(flavor, strainName) {
  const key = lc(flavor)
  const options = FLAVOR_SPECIFICS[key]
  if (options) return hashPick(options, strainName + key)
  // Already specific enough
  return flavor.toLowerCase()
}

/* ------------------------------------------------------------------ */
/*  Main generator                                                    */
/* ------------------------------------------------------------------ */

export function generateExperienceDescription(strain) {
  if (!strain) return ''

  const matchPct  = strain.matchPct || 0
  const isTop     = matchPct >= 80
  const isMid     = matchPct >= 60
  const name      = strain.name || 'This strain'
  const type      = lc(strain.type) || 'hybrid'
  const tp        = TYPE_PERSONALITY[type] || TYPE_PERSONALITY.hybrid
  const terpNames = (strain.terpenes || []).map(t => lc(t.name))
  const effects   = (strain.effects || []).slice(0, 5).map(e => lc(e))
  const thc       = strain.thc || 0

  const parts = []

  /* ---- 1. FLAVOR ---- */
  const rawFlavors = (strain.flavors || []).slice(0, 3)
  if (rawFlavors.length > 0) {
    const specific = rawFlavors.map(f => specifyFlavor(f, name))
    const flavorStr = joinNatural(specific)
    if (isTop) {
      parts.push(`It tastes like ${flavorStr} — layered and lingering, the kind of flavor that makes you pause mid-exhale.`)
    } else {
      parts.push(`On the palate you'll pick up ${flavorStr}.`)
    }
  }

  /* ---- 2. AROMA ---- */
  const terpAroma = terpNames.slice(0, 2).map(t => TERPENE_VIBES[t]?.aroma).filter(Boolean)
  if (terpAroma.length > 0) {
    const aromaStr = joinNatural(terpAroma)
    parts.push(`Break a bud open and the nose fills with ${aromaStr}.`)
  }

  /* ---- 3. THE HIGH — onset, peak, fade ---- */
  if (isTop) {
    parts.push(tp.onset)
    if (effects.length >= 2) {
      parts.push(`People describe it as ${effects[0]} and ${effects[1]}.`)
    }
    parts.push(tp.peak)
    parts.push(tp.fade)
  } else if (isMid) {
    parts.push(tp.onset)
    if (effects.length >= 2) {
      parts.push(`The experience leans ${effects[0]} and ${effects[1]}.`)
    }
    parts.push(tp.fade)
  } else {
    if (effects.length >= 2) {
      parts.push(`Effects are commonly reported as ${effects[0]} and ${effects[1]}, with a ${tp.energy} character.`)
    }
  }

  /* ---- 4. THC context ---- */
  if (thc >= 25) {
    parts.push(`At ${thc}% THC, approach with a little respect — this one doesn't whisper.`)
  } else if (thc >= 18) {
    parts.push(`At ${thc}% THC it sits in the sweet spot — present but not pushy.`)
  } else if (thc >= 10) {
    parts.push(`At ${thc}% THC it's a lighter touch — good for staying functional and clear.`)
  }

  /* ---- 5. APPEARANCE (the closer) ---- */
  const appear  = TYPE_APPEARANCE[type] || TYPE_APPEARANCE.hybrid
  const colors  = TERPENE_COLORS[terpNames[0]] || DEFAULT_COLORS
  const shape   = hashPick(appear.shape, name)
  const density = hashPick(appear.density, name + 'density')

  parts.push(
    `The buds are ${colors.bud}, dressed in ${colors.trichomes} trichomes with ${colors.pistils} pistils threading through — ${shape}, ${density}.`
  )

  return parts.join(' ')
}
