import { EFFECTS } from '../data/effects'
import { TOLERANCES } from '../data/tolerances'
import { BUDGETS } from '../data/budgets'
import { CONSUMPTION_METHODS } from '../data/consumptionMethods'

export function buildRecommendationPrompt(quizState, preFilteredStrains = [], journalSummary = null) {
  const effectLabels = quizState.effects
    .map(id => EFFECTS.find(e => e.id === id)?.label)
    .filter(Boolean)

  const rankedEffects = quizState.effectRanking.length > 0
    ? quizState.effectRanking.map((id, i) => `${i + 1}. ${EFFECTS.find(e => e.id === id)?.label}`).join(', ')
    : effectLabels.join(', ')

  const toleranceLabel = TOLERANCES.find(t => t.id === quizState.tolerance)?.label || 'Intermediate'
  const toleranceId = quizState.tolerance || 'intermediate'
  const budgetLabel = BUDGETS.find(b => b.id === quizState.budget)?.desc || 'Any'
  const methodLabel = CONSUMPTION_METHODS.find(m => m.id === quizState.consumptionMethod)?.label || 'Any'

  const avoidLabels = quizState.avoidEffects.length > 0
    ? quizState.avoidEffects.join(', ')
    : 'None specified'

  const candidateNames = preFilteredStrains.map(s => s.name).join(', ')

  let journalContext = ''
  if (journalSummary) {
    journalContext = `
USER HISTORY (from strain journal):
${journalSummary}`
  }

  return `You are an expert cannabis scientist, sommelier, and recommendation engine. A user wants strain recommendations based on their detailed preference profile.

USER PREFERENCES:
- Desired effects (ranked): ${rankedEffects}
- All selected effects: ${effectLabels.join(', ')}
- Experience level: ${toleranceLabel}
- Effects to AVOID: ${avoidLabels}
- Consumption method: ${methodLabel}
- Budget: ${budgetLabel}
- Subtype preference: ${quizState.subtype || 'no preference'}
- THC preference: ${quizState.thcPreference || 'no preference'}
- CBD preference: ${quizState.cbdPreference || 'none'}
- Flavor preferences: ${quizState.flavors.length > 0 ? quizState.flavors.join(', ') : 'no preference'}
${journalContext}

EXPERIENCE-LEVEL THC GUIDANCE (MANDATORY):
${toleranceId === 'beginner' ? `This user is a BEGINNER. You MUST recommend strains with THC ≤ 18%. Prioritize strains with higher CBD ratios and gentle effects. NEVER recommend high-potency strains (>20% THC) to beginners — this is a safety requirement.` : ''}${toleranceId === 'intermediate' ? `This user has intermediate experience. Recommend strains with THC between 15-25%. Include at least one lower-THC option (≤18%) for variety. Avoid recommending strains above 28% THC.` : ''}${toleranceId === 'experienced' ? `This user is experienced (weekly consumer). THC range 18-30% is appropriate. You may include potent strains but still note intensity in descriptions.` : ''}${toleranceId === 'high' ? `This user has high tolerance (daily consumer). Any THC level is appropriate. Include potent options (25%+) that will be effective for experienced users.` : ''}

LOCAL ENGINE PRE-FILTERED CANDIDATES: ${candidateNames || 'None - use your own knowledge'}

TASK: Search the web to find the best cannabis strains for the user. For each strain, search Reddit (r/trees, r/cannabis), Leafly, and other cannabis forums for real user reviews and community sentiment. Report BOTH positives AND negatives honestly — this is a research tool, not a sales tool.

Return ONLY valid JSON (no markdown, no backticks, no explanation) in this EXACT format:

{
  "idealProfile": {
    "terpenes": [{"name":"terpene_name","ratio":"percentage"}],
    "cannabinoids": {"thc":"range","cbd":"range","other":"notes"},
    "subtype": "recommendation"
  },
  "strains": [
    {
      "name": "Real Strain Name",
      "type": "indica|sativa|hybrid",
      "matchPct": 92,
      "thc": 22,
      "cbd": 1,
      "genetics": "Parent1 × Parent2",
      "lineage": {
        "self": "Strain Name",
        "parents": ["Parent1", "Parent2"],
        "grandparents": {"Parent1": ["GP1", "GP2"], "Parent2": ["GP3", "GP4"]}
      },
      "effects": ["Relaxed","Happy","Creative","Focused","Euphoric"],
      "terpenes": [{"name":"Myrcene","pct":"0.8%"},{"name":"Limonene","pct":"0.4%"},{"name":"Caryophyllene","pct":"0.3%"}],
      "cannabinoids": [
        {"name":"THC","value":22,"color":"#ff8c32"},
        {"name":"CBD","value":1,"color":"#9775fa"},
        {"name":"CBN","value":0.3,"color":"#ffd43b"},
        {"name":"CBG","value":0.8,"color":"#51cf66"},
        {"name":"THCV","value":0.1,"color":"#22b8cf"},
        {"name":"CBC","value":0.2,"color":"#f06595"}
      ],
      "sommelierNotes": {
        "taste": "Detailed flavor description on inhale and exhale",
        "aroma": "Nose description from jar and after grinding",
        "smoke": "Vapor/smoke density and smoothness",
        "burn": "Burn quality, ash color, ring consistency"
      },
      "sommelierScores": {
        "taste": 8,
        "aroma": 7,
        "smoke": 8,
        "throat": 7,
        "burn": 9
      },
      "whyMatch": "2-3 sentence explanation speaking directly to the user (use 'you/your') connecting this strain's chemistry to their specific preferences",
      "forumAnalysis": {
        "totalReviews": "~420 across r/trees, r/cannabis, Leafly, AllBud",
        "sentimentScore": 8.2,
        "pros": [
          {"effect":"Relaxation","pct":87,"baseline":60},
          {"effect":"Pain Relief","pct":72,"baseline":45},
          {"effect":"Euphoria","pct":68,"baseline":50},
          {"effect":"Stress Relief","pct":65,"baseline":48}
        ],
        "cons": [
          {"effect":"Dry Mouth","pct":45,"baseline":40},
          {"effect":"Dry Eyes","pct":30,"baseline":25},
          {"effect":"Anxiety at High Doses","pct":12,"baseline":11}
        ],
        "sources": "r/trees, r/cannabis, Leafly reviews, AllBud"
      },
      "sentimentScore": 8.2,
      "bestFor": ["Evening relaxation", "Chronic pain", "Insomnia"],
      "notIdealFor": ["Daytime productivity", "Tasks requiring alertness"],
      "description": "Brief 1-2 sentence description"
    }
  ],
  "aiPicks": [
    {
      "name": "Unexpected Strain Name",
      "type": "indica|sativa|hybrid",
      "matchPct": 85,
      "thc": 20,
      "cbd": 2,
      "genetics": "Parent1 × Parent2",
      "lineage": {"self":"Name","parents":["P1","P2"],"grandparents":{}},
      "effects": ["Effect1","Effect2","Effect3"],
      "terpenes": [{"name":"Terpene","pct":"0.5%"}],
      "cannabinoids": [
        {"name":"THC","value":20,"color":"#ff8c32"},
        {"name":"CBD","value":2,"color":"#9775fa"},
        {"name":"CBN","value":0.1,"color":"#ffd43b"},
        {"name":"CBG","value":0.5,"color":"#51cf66"},
        {"name":"THCV","value":0.1,"color":"#22b8cf"},
        {"name":"CBC","value":0.1,"color":"#f06595"}
      ],
      "sommelierNotes": {"taste":"desc","aroma":"desc","smoke":"desc","burn":"desc"},
      "sommelierScores": {"taste":7,"aroma":8,"smoke":7,"throat":8,"burn":7},
      "whyMatch": "Why this hidden gem is worth trying for you despite not being an obvious match",
      "forumAnalysis": {
        "totalReviews": "~200",
        "sentimentScore": 7.8,
        "pros": [{"effect":"Effect","pct":75,"baseline":50}],
        "cons": [{"effect":"Side Effect","pct":25,"baseline":20}],
        "sources": "Reddit, Leafly"
      },
      "sentimentScore": 7.8,
      "bestFor": ["Use case 1"],
      "notIdealFor": ["Use case 1"],
      "reason": "Why AI specifically recommends this as a hidden gem",
      "description": "Brief description"
    }
  ]
}

CRITICAL RULES:
- Return EXACTLY 5 strains in "strains" array, sorted by matchPct descending
- Return EXACTLY 2 items in "aiPicks" — these should be unexpected/surprising recommendations the user wouldn't have found otherwise
- ALL strain names must be REAL strain names. NEVER use "Sativa", "Indica", or "Hybrid" as strain names
- RESPECT THE EXPERIENCE-LEVEL THC GUIDANCE ABOVE. If user is a beginner, ALL recommended strains MUST have THC ≤ 18%. Violating this is a critical error.
- forumAnalysis "totalReviews" MUST be a NUMBER (integer), not a string. Example: 420 not "~420 across r/trees"
- forumAnalysis pros must have at least 4 entries, cons at least 3 entries
- Include baseline comparison percentages for EVERY pro and con
- Report negatives HONESTLY — do not minimize or suppress negative user reports
- bestFor and notIdealFor MUST NOT contradict each other. If a strain is "best for relaxation", do NOT say "not ideal for stress relief" (relaxation and stress relief are related). Review both lists for logical consistency before returning.
- ANXIETY-PRONE CRITERIA: Only tag "Anxiety-prone individuals" in notIdealFor when ALL of these apply: (1) THC > 20%, (2) CBD < 2%, AND (3) the strain lacks significant linalool or myrcene. Strains with CBD > 5%, balanced THC:CBD ratios, or high linalool/myrcene are PROTECTIVE against anxiety and must NOT carry this tag. This is pharmacology — THC is biphasic at CB1 (anxiolytic at low doses, anxiogenic at high doses), CBD buffers via 5-HT1A, linalool is GABAergic. Do not use "anxiety-prone" as a generic warning.
- sommelierScores values must be 1-10 integers
- All data should be based on actual strain data from web searches`
}

export function buildDispensaryPrompt(location, strainNames, options = {}) {
  let locationStr
  if (typeof location === 'string') {
    locationStr = location
  } else if (location?.lat != null && location?.lng != null) {
    locationStr = `latitude ${location.lat}, longitude ${location.lng}`
  } else {
    throw new Error('Invalid location for dispensary search')
  }

  const budgetLine = options.budgetDesc
    ? `\nUSER BUDGET: ${options.budgetDesc} — prioritize dispensaries and deals that fit this price range.`
    : ''

  return `List well-known cannabis dispensaries near ${locationStr} that are likely to carry these strains: ${strainNames.join(', ')}.
${budgetLine}
IMPORTANT CONTEXT: You do NOT have live web access. Use your training knowledge of real dispensaries from Weedmaps, Leafly, and dispensary directories. Only include dispensaries you are confident actually exist based on your knowledge.

RULES:
- Only include dispensaries you are confident are REAL businesses based on your training data
- For strain prices, use realistic market-rate estimates for the area. Set price to null if unsure.
- Include the dispensary's known website URL or Weedmaps/Leafly page if you know it
- Suggest which of the requested strains each dispensary is likely to carry based on their typical inventory
- Include realistic deals and promotions typical for the area
- Include estimated pickup readiness time (e.g. "15 min", "30 min") if typical for the dispensary

Return ONLY valid JSON (no markdown, no backticks):

{
  "dispensaries": [
    {
      "name": "Real Dispensary Name",
      "address": "Full street address",
      "distance": "2.3 mi",
      "rating": 4.7,
      "reviewCount": 234,
      "delivery": true,
      "deliveryEta": "45-60 min",
      "pickupReady": "15 min",
      "matchedStrains": [
        { "name": "Strain Name", "price": "$45/eighth", "inStock": true, "strainMenuUrl": null }
      ],
      "alternativeStrains": [
        { "name": "Similar Strain", "price": "$38/eighth", "strainMenuUrl": null }
      ],
      "deals": ["Typical promotions for this dispensary"],
      "priceRange": "$35-50/eighth",
      "hours": "9am-9pm",
      "phone": "(555) 123-4567",
      "website": "https://their-website.com",
      "menuUrl": "https://weedmaps.com/dispensaries/their-name"
    }
  ]
}

Return 5-8 dispensaries. Prioritize those most likely to carry the requested strains. Always include menuUrl so users can verify prices and availability themselves.`
}

export function buildTrendingPrompt(location) {
  return `Search for currently trending and popular cannabis strains in ${location || 'the United States'}. Look at Reddit r/trees, Leafly trending, and popular dispensary menus.

Return ONLY valid JSON:

{
  "trending": [
    {"name": "Strain Name", "type": "hybrid", "reason": "Why it's trending", "momentum": "rising|stable|hot"}
  ],
  "communityFavorites": {
    "sleep": [{"name": "Strain", "score": 8.5}],
    "pain": [{"name": "Strain", "score": 8.2}],
    "creativity": [{"name": "Strain", "score": 7.9}],
    "anxiety": [{"name": "Strain", "score": 8.1}]
  }
}

Return 5-8 trending strains and 3 favorites per category.`
}

export function buildExperiencePrompt(strain) {
  const terpStr = (strain.terpenes || [])
    .map(t => `${t.name} (${t.pct})`)
    .join(', ')

  const cannabStr = (strain.cannabinoids || [])
    .filter(c => parseFloat(c.value) > 0)
    .map(c => `${c.name}: ${c.value}%`)
    .join(', ')

  const effectsStr = (strain.effects || []).join(', ')
  const flavorsStr = (strain.flavors || []).join(', ')

  const somNotes = strain.sommelierNotes
    ? `Taste: ${strain.sommelierNotes.taste || 'N/A'}; Aroma: ${strain.sommelierNotes.aroma || 'N/A'}; Smoke: ${strain.sommelierNotes.smoke || 'N/A'}`
    : 'No sommelier data'

  const forumPros = (strain.forumAnalysis?.pros || [])
    .map(p => `${p.effect} (${p.pct}% of users)`)
    .join(', ')
  const forumCons = (strain.forumAnalysis?.cons || [])
    .map(c => `${c.effect} (${c.pct}% of users)`)
    .join(', ')

  const pathwayStr = (strain.pathways || [])
    .slice(0, 5)
    .map(p => `${p.molecule} binds ${p.receptor} (Ki=${p.ki_nm}nM, ${p.action_type || 'modulator'})`)
    .join('; ')

  return `You are a cannabis sommelier. Write a vivid, authentic description (3 sentences maximum) of what it's like to consume ${strain.name}. This must be UNIQUE to this strain — grounded in its terpene profile, cannabinoid levels, and community-reported effects. Do NOT describe appearance.

STRAIN: ${strain.name} (${strain.type})
THC: ${strain.thc || 'unknown'}% | CBD: ${strain.cbd || 0}%
TERPENES: ${terpStr || 'No data'}
CANNABINOIDS: ${cannabStr || 'No data'}
EFFECTS (community-reported): ${effectsStr || 'No data'}
FLAVORS: ${flavorsStr || 'No data'}
SOMMELIER NOTES: ${somNotes}
COMMUNITY PROS: ${forumPros || 'Limited data'}
COMMUNITY CONS: ${forumCons || 'Limited data'}
RECEPTOR PATHWAYS: ${pathwayStr || 'No data'}

RULES:
- Mention the onset and peak experience in 3 concise sentences maximum
- Reference at least one terpene or cannabinoid by name
- Briefly mention the aroma/fragrance in 1-2 words (e.g. "piney nose", "citrus funk", "gassy sweetness") — weave it naturally into a sentence, don't add extra length
- Write in second person ("you'll notice...", "expect to feel...")
- Keep it poetic but factually grounded — no hype, no medical claims
- Write ONLY the sentences. No headers, no JSON, no formatting.`
}

export function buildScienceExplanation(strain, quizState) {
  const terpStr = (strain.terpenes || [])
    .map(t => `${t.name} (${t.pct})`)
    .join(', ')

  const cannabStr = (strain.cannabinoids || [])
    .filter(c => parseFloat(c.value) > 0)
    .map(c => `${c.name}: ${c.value}%`)
    .join(', ')

  const pathwayStr = (strain.pathways || [])
    .slice(0, 5)
    .map(p => `${p.molecule} binds ${p.receptor} (Ki=${p.ki_nm}nM, ${p.action_type || 'modulator'})`)
    .join('; ')

  const forumPros = (strain.forumAnalysis?.pros || [])
    .map(p => `${p.effect} (${p.pct}% of users)`)
    .join(', ')

  const userEffects = (quizState?.effects || [])
    .map(id => EFFECTS.find(e => e.id === id)?.label || id)
    .join(', ')
  const userAvoid = (quizState?.avoidEffects || [])
    .map(id => id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .join(', ') || 'none specified'

  return `You're a knowledgeable budtender explaining why this specific strain suits this person. Be warm, direct, and specific — like talking to a friend at a dispensary.

STRAIN: ${strain.name} (${strain.type}) — ${strain.matchPct}% match
TERPENES: ${terpStr || 'No terpene data'}
CANNABINOIDS: ${cannabStr || 'No cannabinoid data'}
KEY PATHWAYS: ${pathwayStr || 'No pathway data'}
WHAT USERS REPORT: ${forumPros || 'Limited data'}
THIS PERSON WANTS: ${userEffects || 'General wellness'}
THIS PERSON AVOIDS: ${userAvoid}

RULES:
- 2 sentences maximum. Short and punchy.
- Focus on what makes THIS strain special for THIS person — connect their goals to the strain's standout terpene or cannabinoid.
- Use one simple science detail (e.g. "myrcene, the same terpene in mangoes, promotes deep relaxation") — no receptor codes or Ki values.
- Use "you/your". No generic THC claims. No hedging ("may potentially possibly").
- Write ONLY the explanation. No headers, no formatting, no preamble.`
}
