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

LOCAL ENGINE PRE-FILTERED CANDIDATES: ${candidateNames || 'None - use your own knowledge'}

TASK: Search the web to find the best cannabis strains for this user. For each strain, search Reddit (r/trees, r/cannabis), Leafly, and other cannabis forums for real user reviews and community sentiment. Report BOTH positives AND negatives honestly — this is a research tool, not a sales tool.

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
      "whyMatch": "2-3 sentence explanation connecting this strain's chemistry to the user's specific preferences",
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
      "notIdealFor": ["Daytime productivity", "Anxiety-prone beginners"],
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
      "whyMatch": "Why this hidden gem is worth trying despite not being an obvious match",
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
- forumAnalysis pros must have at least 4 entries, cons at least 3 entries
- Include baseline comparison percentages for EVERY pro and con
- Report negatives HONESTLY — do not minimize or suppress negative user reports
- sommelierScores values must be 1-10 integers
- All data should be based on actual strain data from web searches`
}

export function buildDispensaryPrompt(location, strainNames) {
  let locationStr
  if (typeof location === 'string') {
    locationStr = location
  } else if (location?.lat != null && location?.lng != null) {
    locationStr = `latitude ${location.lat}, longitude ${location.lng}`
  } else {
    throw new Error('Invalid location for dispensary search')
  }

  return `Search for REAL cannabis dispensaries near ${locationStr} that carry or may carry these strains: ${strainNames.join(', ')}.

CRITICAL RULES:
- Only include dispensaries you can verify actually exist via web search
- Only include prices if you can verify them from the dispensary's actual menu (Weedmaps, Leafly, or their website)
- If you cannot verify a price, set priceRange to null — do NOT guess or make up prices
- Include the dispensary's real website URL and their Weedmaps/Leafly menu link
- Check if each dispensary actually carries the requested strains or similar ones

Return ONLY valid JSON (no markdown, no backticks):

{
  "dispensaries": [
    {
      "name": "Real Dispensary Name",
      "address": "Full verified street address",
      "distance": "2.3 mi",
      "rating": 4.7,
      "reviewCount": 234,
      "delivery": true,
      "deliveryEta": "45-60 min",
      "matchedStrains": ["Only strains VERIFIED on their menu"],
      "alternativeStrains": ["Similar strains found on their menu"],
      "deals": ["Only REAL current promotions you found"],
      "priceRange": null,
      "hours": "9am-9pm",
      "phone": "(555) 123-4567",
      "website": "https://their-actual-website.com",
      "menuUrl": "https://weedmaps.com/dispensaries/their-name or leafly link"
    }
  ]
}

Return 4-6 dispensaries. Prioritize those with matching strains on their menu. Always include menuUrl so users can check real-time prices and availability themselves.`
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

  return `You are a cannabis pharmacology expert writing for a curious consumer. Explain in 2-3 sentences WHY this strain matches this specific user. Be conversational but scientifically grounded. Mention at least one terpene or cannabinoid by name, its receptor target, and the resulting effect. Keep it simple enough for a non-scientist.

STRAIN: ${strain.name} (${strain.type}) — ${strain.matchPct}% match
TERPENES: ${terpStr || 'No terpene data'}
CANNABINOIDS: ${cannabStr || 'No cannabinoid data'}
RECEPTOR PATHWAYS: ${pathwayStr || 'No pathway data'}
COMMUNITY REPORTS: Top effects — ${forumPros || 'Limited data'}
USER WANTS: ${userEffects || 'General wellness'}
USER AVOIDS: ${userAvoid}

Write ONLY the explanation. No JSON, no headers, no formatting.`
}
