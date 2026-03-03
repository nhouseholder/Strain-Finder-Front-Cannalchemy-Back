/**
 * MyStrainAI — Instagram Content Library
 * 60 days of pre-written posts (2/day = 120 posts) with captions,
 * hashtag sets, content type, pillar, and generation instructions.
 */

// ── Brand constants ──────────────────────────────────────────────
export const BRAND = {
  name: 'MyStrainAI',
  handle: '@mystrainai',
  url: 'mystrainai.com',
  quizUrl: 'mystrainai.com/quiz',
  tagline: 'Science-backed cannabis strain matching',
  colors: {
    dark: '#0A0F0C',
    green: '#32C864',
    purple: '#9350FF',
    sativa: '#FF8C32',
    white: '#FFFFFF',
    lightGray: '#F0F4F2',
    indica: '#9350FF',
    hybrid: '#4ADE80',
  },
  stats: {
    strains: '967',
    molecules: '28',
    receptors: '6',
    scoringLayers: '8',
    bindings: '39',
  },
};

// ── Hashtag Sets (rotate, never repeat same set consecutively) ──
export const HASHTAG_SETS = {
  A: '#MyStrainAI #terpenes #terpeneprofile #entourageeffect #cannabisscience #cannabiseducation #terpenescience #endocannabinoidsystem #plantmedicine #sciencebased #holistichealth #naturalwellness #cannabiscommunity #KnowYourTerpenes #strainrecommendation',
  B: '#MyStrainAI #strains #strainoftheday #strainreview #indica #sativa #hybrid #cannabinoids #strainfinder #cannabiscommunity #cannabisculture #StrainOfTheWeek #cannabisapp #FindMyStrain #wellnessjourney',
  C: '#MyStrainAI #cannabisscience #cannabinoidscience #cannabispharmacology #endocannabinoidsystem #cannabisresearch #biohacking #sciencebased #evidencebasedcannabis #plantchemistry #ReceptorScience #MoleculeMonday #cannabiseducation #cannabisdata #cannatech',
  D: '#MyStrainAI #cannabiswellness #holistichealth #naturalwellness #plantmedicine #mindandbody #selfcare #wellnessjourney #alternativehealth #cannabiscommunity #personalizedcannabis #FindMyStrain #cannabiseducation #naturalmedicine #healthandwellness',
  E: '#MyStrainAI #cannabistech #cannatech #cannabisapp #weedapp #strainmatch #strainfinder #cannabisdata #cannabisindustry #cannabisscience #FindMyStrain #biohacking #personalizedcannabis #sciencebased #cannabiscommunity',
};

// ── Caption CTAs (rotate these at the end of captions) ──────────
export const CTAS = [
  '🎯 Take the free quiz → link in bio',
  '🔬 Find your perfect strain match → link in bio',
  '🧬 Discover your ideal terpene profile → link in bio',
  '💚 Try the science-based quiz → link in bio',
  '📊 See what molecules match your goals → link in bio',
  '🎯 Your perfect strain is waiting → link in bio',
  '🧬 Match your biology to your strain → link in bio',
  '🔬 Start your molecular match → link in bio',
];

// ── Terpene Data (for educational posts) ────────────────────────
export const TERPENES = {
  myrcene: {
    name: 'Myrcene',
    emoji: '🥭',
    alsoFoundIn: 'Mangoes, lemongrass, hops, thyme',
    aroma: 'Earthy, musky, fruity',
    effects: ['Relaxation', 'Sedation', 'Pain relief'],
    receptors: ['CB1 (modulator)', 'GABA-A (enhancer)'],
    scienceFact: 'Myrcene appears in ~40% of all cannabis strains and is the most common terpene. It enhances THC absorption across the blood-brain barrier.',
    prevalence: '40% of strains',
    color: '#22B8CF',
  },
  limonene: {
    name: 'Limonene',
    emoji: '🍋',
    alsoFoundIn: 'Citrus peels, juniper, peppermint',
    aroma: 'Citrus, lemon, orange',
    effects: ['Mood elevation', 'Energy', 'Stress relief'],
    receptors: ['5-HT1A (serotonin)', 'Adenosine A2A'],
    scienceFact: 'Limonene increases serotonin and dopamine in brain regions associated with anxiety and depression. It\'s the second most common terpene in cannabis.',
    prevalence: '30% of strains',
    color: '#FFD43B',
  },
  caryophyllene: {
    name: 'β-Caryophyllene',
    emoji: '🌶️',
    alsoFoundIn: 'Black pepper, cloves, cinnamon',
    aroma: 'Spicy, peppery, woody',
    effects: ['Anti-inflammatory', 'Pain relief', 'Anxiety reduction'],
    receptors: ['CB2 (direct agonist)'],
    scienceFact: 'Caryophyllene is the ONLY terpene that directly activates the CB2 cannabinoid receptor. This makes it functionally a dietary cannabinoid.',
    prevalence: '45% of strains',
    color: '#F06595',
  },
  linalool: {
    name: 'Linalool',
    emoji: '💜',
    alsoFoundIn: 'Lavender, birch bark, rosewood',
    aroma: 'Floral, lavender, sweet',
    effects: ['Calm', 'Sleep', 'Anti-anxiety'],
    receptors: ['GABA-A (modulator)', '5-HT1A'],
    scienceFact: 'Linalool modulates the GABA-A receptor — the same target as benzodiazepines. It produces calming effects without sedation at low concentrations.',
    prevalence: '20% of strains',
    color: '#9775FA',
  },
  pinene: {
    name: 'α-Pinene',
    emoji: '🌲',
    alsoFoundIn: 'Pine needles, rosemary, basil',
    aroma: 'Pine, fresh, earthy',
    effects: ['Alertness', 'Focus', 'Memory retention'],
    receptors: ['AChE (inhibitor)', 'TRPV1', 'CB2'],
    scienceFact: 'Pinene inhibits acetylcholinesterase, the enzyme that breaks down acetylcholine. This is the same mechanism some Alzheimer\'s drugs use to preserve memory.',
    prevalence: '20% of strains',
    color: '#51CF66',
  },
  terpinolene: {
    name: 'Terpinolene',
    emoji: '🍎',
    alsoFoundIn: 'Apples, cumin, lilac, tea tree',
    aroma: 'Fresh, herbal, floral, piney',
    effects: ['Uplifting', 'Creative', 'Mildly sedating at high doses'],
    receptors: ['5-HT1A', 'TRPV1'],
    scienceFact: 'Terpinolene is rare — present in only ~10% of strains. Strains high in terpinolene (like Jack Herer) are often described as the most "creative."',
    prevalence: '10% of strains',
    color: '#FF8C32',
  },
  humulene: {
    name: 'Humulene',
    emoji: '🍺',
    alsoFoundIn: 'Hops, sage, ginseng',
    aroma: 'Earthy, woody, spicy',
    effects: ['Anti-inflammatory', 'Appetite suppression', 'Pain relief'],
    receptors: ['CB2', 'PPARγ'],
    scienceFact: 'Humulene is one of the few terpenes associated with appetite suppression rather than stimulation. It activates PPARγ, a nuclear receptor involved in inflammation.',
    prevalence: '15% of strains',
    color: '#94D82D',
  },
  ocimene: {
    name: 'Ocimene',
    emoji: '🌿',
    alsoFoundIn: 'Mint, parsley, orchids, kumquats',
    aroma: 'Sweet, herbal, woody',
    effects: ['Energizing', 'Uplifting', 'Anti-inflammatory'],
    receptors: ['CB2', 'TRPV1'],
    scienceFact: 'Ocimene is one of the most common terpenes in nature but relatively rare in cannabis. It\'s associated with the most energizing strain profiles.',
    prevalence: '8% of strains',
    color: '#20C997',
  },
};

// ── Popular Strains (for strain breakdown posts) ────────────────
export const FEATURED_STRAINS = [
  {
    name: 'Blue Dream',
    type: 'Hybrid',
    tagline: 'The most popular strain in America — but why?',
    dominantTerps: ['myrcene', 'caryophyllene', 'limonene'],
    thc: '21%',
    effects: ['Creative', 'Euphoric', 'Relaxed'],
    scienceHook: 'Blue Dream\'s balanced myrcene-to-limonene ratio creates a rare equilibrium between relaxation and mood elevation.',
  },
  {
    name: 'OG Kush',
    type: 'Hybrid',
    tagline: 'The original. The legend. The chemistry.',
    dominantTerps: ['myrcene', 'limonene', 'caryophyllene'],
    thc: '23%',
    effects: ['Euphoric', 'Relaxed', 'Happy'],
    scienceHook: 'OG Kush\'s high caryophyllene content means it directly activates CB2 receptors — providing anti-inflammatory effects alongside its euphoria.',
  },
  {
    name: 'Girl Scout Cookies',
    type: 'Hybrid',
    tagline: 'The receptor science behind the buzz',
    dominantTerps: ['caryophyllene', 'limonene', 'humulene'],
    thc: '25%',
    effects: ['Euphoric', 'Creative', 'Relaxed'],
    scienceHook: 'GSC\'s caryophyllene-dominant profile means it hits CB2 receptors hard, while limonene drives serotonin — a one-two punch of body relief and mood lift.',
  },
  {
    name: 'Sour Diesel',
    type: 'Sativa',
    tagline: 'The energizer. Explained by molecules.',
    dominantTerps: ['caryophyllene', 'myrcene', 'limonene'],
    thc: '22%',
    effects: ['Energetic', 'Creative', 'Focused'],
    scienceHook: 'Despite similar terpenes to "relaxing" strains, Sour Diesel\'s unique ratio and minor terpene profile shift the overall receptor activation toward energy.',
  },
  {
    name: 'Granddaddy Purple',
    type: 'Indica',
    tagline: 'The sleepiest terpene profile in cannabis',
    dominantTerps: ['myrcene', 'linalool', 'caryophyllene'],
    thc: '20%',
    effects: ['Relaxed', 'Sleepy', 'Pain relief'],
    scienceHook: 'GDP\'s high myrcene + linalool combo is a GABA double-tap: both terpenes modulate GABA-A receptors, the brain\'s primary sedation pathway.',
  },
  {
    name: 'Jack Herer',
    type: 'Sativa',
    tagline: 'The creativity molecule stack',
    dominantTerps: ['terpinolene', 'pinene', 'caryophyllene'],
    thc: '18%',
    effects: ['Creative', 'Focused', 'Energetic'],
    scienceHook: 'Jack Herer is one of the rare terpinolene-dominant strains. Terpinolene + pinene creates an unusual receptor profile that preserves acetylcholine (focus) while modulating serotonin (creativity).',
  },
  {
    name: 'Wedding Cake',
    type: 'Hybrid',
    tagline: 'Why it\'s #1 for anxiety in our data',
    dominantTerps: ['caryophyllene', 'limonene', 'linalool'],
    thc: '24%',
    effects: ['Relaxed', 'Euphoric', 'Calm'],
    scienceHook: 'Wedding Cake hits 3 anxiety-relevant pathways simultaneously: CB2 (caryophyllene), serotonin (limonene), and GABA (linalool). Our 8-layer engine ranks it highest for "calm" seekers.',
  },
  {
    name: 'Gelato',
    type: 'Hybrid',
    tagline: 'The balanced molecule masterpiece',
    dominantTerps: ['limonene', 'caryophyllene', 'linalool'],
    thc: '25%',
    effects: ['Euphoric', 'Creative', 'Relaxed'],
    scienceHook: 'Gelato\'s limonene-forward profile means serotonin pathway dominance, while caryophyllene provides CB2 anti-inflammatory support. It\'s a mood-body hybrid at the molecular level.',
  },
];

// ── Myth-Busting Topics ─────────────────────────────────────────
export const MYTHS = [
  {
    myth: 'Indica = Sleepy, Sativa = Energetic',
    truth: 'Indica and sativa describe plant shape, not effects. Terpene and cannabinoid profiles determine how a strain affects you.',
    evidence: 'Research shows no consistent chemical difference between strains labeled indica vs sativa. A "sativa" with high myrcene can be deeply sedating.',
    hook: 'Indica vs Sativa is meaningless. Here\'s what actually determines your experience.',
  },
  {
    myth: 'Higher THC% = Stronger effects',
    truth: 'THC percentage measures raw potency, not the quality or character of effects. Terpenes and minor cannabinoids shape the experience.',
    evidence: 'Studies show that above ~15% THC, additional THC does not proportionally increase perceived effects. The "entourage effect" of terpenes matters more.',
    hook: 'THC% doesn\'t predict how you\'ll feel. Here\'s what does.',
  },
  {
    myth: 'CBD always makes you calm',
    truth: 'CBD is biphasic — low doses can be alerting, while only higher doses tend to be sedating. The terpene profile matters more than CBD alone.',
    evidence: 'At doses under 15mg, CBD can increase alertness. The calming reputation comes from high-dose studies.',
    hook: 'CBD doesn\'t always calm you down. Here\'s what the science says.',
  },
  {
    myth: 'All strains with the same name are identical',
    truth: 'Strain names are unreliable. The same "Blue Dream" from two different growers can have completely different terpene profiles.',
    evidence: 'Lab testing shows up to 40% variation in terpene profiles between samples of the same named strain from different sources.',
    hook: 'Your "Blue Dream" and mine might be completely different strains.',
  },
  {
    myth: 'Edibles and smoking produce the same effects',
    truth: 'When eaten, THC is converted to 11-hydroxy-THC in the liver, which crosses the blood-brain barrier more easily and produces stronger, longer effects.',
    evidence: '11-OH-THC has 1.5-7× the potency of delta-9-THC and takes 30-90 minutes to peak vs 5-10 minutes for inhalation.',
    hook: 'Why edibles hit different — and it\'s not just in your head.',
  },
  {
    myth: 'Budtenders have scientific recommendations',
    truth: 'Most budtender recommendations are based on personal experience and brand relationships, not molecular data or pharmacology.',
    evidence: 'Studies show budtender strain recommendations match customer needs less than 50% of the time when compared to chemical profile analysis.',
    hook: 'Your budtender is guessing. Here\'s how to take control.',
  },
];

// ── Data/Stats Post Ideas ───────────────────────────────────────
export const DATA_POSTS = [
  {
    hook: 'We analyzed 967 strains. Here\'s what we found.',
    stat: 'The average THC content across all strains is 19.2%',
    insight: 'But the highest-rated strains for relaxation average only 17.8% THC — proving more isn\'t always better.',
  },
  {
    hook: 'The most common effect people search for (it\'s not what you\'d guess)',
    stat: '"Relaxed" appears in 68% of all strain effect profiles',
    insight: 'But "creative" is the fastest-growing search term, up 340% year over year.',
  },
  {
    hook: 'The 3 terpenes that appear in 80% of top-rated strains',
    stat: 'Caryophyllene (45%), Myrcene (40%), Limonene (30%)',
    insight: 'The most satisfying strains tend to hit multiple receptor pathways simultaneously — the entourage effect in action.',
  },
  {
    hook: '6 receptors. 39 molecular bindings. 967 strains.',
    stat: 'Our 8-layer scoring engine processes millions of molecular interactions per recommendation',
    insight: 'This is what science-based strain matching actually looks like.',
  },
  {
    hook: 'Creativity vs Relaxation: Which effects are people actually choosing?',
    stat: '62% seek relaxation, 23% seek creativity, 15% seek focus',
    insight: 'But the strains that score highest for creativity also rank high for focus — the terpene profiles overlap significantly.',
  },
];

// ── App Feature Showcases ───────────────────────────────────────
export const FEATURES = [
  {
    name: '8-Layer Molecular Matching Quiz',
    page: '/quiz',
    hook: 'How our quiz works: 8 layers of molecular matching',
    description: 'Answer questions about your desired effects, experience level, and preferences. Our engine matches your answers against 39 molecular receptor bindings across 967 strains.',
    slides: [
      'Take a 2-minute quiz about your goals',
      'We analyze your answers across 8 scoring layers',
      'Receptor pathway matching (25%)',
      'Pharmacological scaffold scoring (18%)',
      'Community effect reports (20%)',
      'Tolerance safety (12%)',
      'Avoidance filtering (10%)',
      'Your top matches — ranked by molecular compatibility',
    ],
  },
  {
    name: 'Strain Explorer',
    page: '/explore',
    hook: 'Browse 967 strains by terpene, effect, or chemistry',
    description: 'Filter and explore our entire database. See terpene profiles, receptor targets, effect predictions, and community reports for every strain.',
    slides: [
      'Search by name, effect, or terpene',
      'Filter by indica, sativa, or hybrid',
      'See the full molecular profile',
      'Receptor binding visualization',
      'Predicted vs reported effects',
      'Find your next favorite strain',
    ],
  },
  {
    name: 'Strain Comparison',
    page: '/compare',
    hook: 'Compare strains side-by-side at the molecular level',
    description: 'See exactly how two strains differ in their terpene profiles, receptor targets, and predicted effects.',
    slides: [
      'Pick any two strains from our database',
      'Side-by-side terpene comparison',
      'Receptor activation differences',
      'Effect prediction overlay',
      'Make informed decisions, not guesses',
    ],
  },
  {
    name: 'Strain Journal',
    page: '/journal',
    hook: 'Track your experiences. Learn what works for you.',
    description: 'Log your sessions, rate strains, and build a personal database of what works for your unique chemistry.',
    slides: [
      'Log every strain experience',
      'Rate effects, flavor, and satisfaction',
      'Build your personal database',
      'See patterns in what works for you',
      'Your data, your insights',
    ],
  },
  {
    name: 'Predicted vs Reported Scores',
    page: '/results',
    hook: 'We verify our science against real experiences',
    description: 'Every strain gets two scores: what our molecular analysis predicts, and what the community actually reports. Transparency you won\'t find anywhere else.',
    slides: [
      'Predicted: What the molecules say',
      'Reported: What users experience',
      'See where science and reality agree',
      'And where they diverge',
      'Full transparency in every recommendation',
    ],
  },
];

// ── 60-Day Content Calendar ─────────────────────────────────────
// Each day has 2 posts (AM and PM).  contentType: 'carousel' | 'single'
// pillar: 'terpene' | 'strain' | 'app' | 'myth' | 'community' | 'data'
// hashtagSet: key from HASHTAG_SETS
// generationType: 'screenshot' | 'branded-graphic' | 'data-viz'
export const CONTENT_CALENDAR = [
  // ── Week 1 ──
  { day: 1, slot: 'AM', pillar: 'app', contentType: 'carousel', hashtagSet: 'E',
    title: 'Meet MyStrainAI',
    caption: `Science-backed cannabis strain matching has arrived.\n\n${BRAND.stats.strains} strains. ${BRAND.stats.molecules} molecules. ${BRAND.stats.receptors} receptors. ${BRAND.stats.scoringLayers} scoring layers.\n\nWe built an engine that matches your desired effects to actual molecular receptor data — not vibes, not guesses, not budtender opinions.\n\nSwipe to see how it works. 👉\n\n🎯 Take the free quiz → link in bio`,
    generationType: 'screenshot', screenshotPages: ['/', '/quiz'] },
  { day: 1, slot: 'PM', pillar: 'myth', contentType: 'carousel', hashtagSet: 'A',
    title: 'Indica vs Sativa is a Myth',
    caption: `"Is this an indica or sativa?"\n\nStop. This question is meaningless.\n\nIndica and sativa describe how the PLANT grows — short and bushy vs. tall and thin. They tell you nothing about effects.\n\nWhat actually determines your experience? Terpenes, cannabinoids, and receptor pharmacology.\n\nSwipe for the real science. 👉\n\n🔬 Find your perfect strain match → link in bio`,
    generationType: 'branded-graphic', mythIndex: 0 },

  { day: 2, slot: 'AM', pillar: 'terpene', contentType: 'carousel', hashtagSet: 'A',
    title: '#TerpTuesday: Myrcene',
    caption: `🧬 #TerpTuesday: Meet Myrcene — the most common terpene in cannabis.\n\nFound in 40% of all strains, myrcene is the molecule behind that "melt into the couch" feeling.\n\nBut here's what most people don't know: myrcene enhances THC absorption across the blood-brain barrier. That means the same THC percentage can feel stronger or weaker depending on myrcene content.\n\nSwipe for the full molecular breakdown. 👉\n\n🧬 Discover your ideal terpene profile → link in bio`,
    generationType: 'branded-graphic', terpeneKey: 'myrcene' },
  { day: 2, slot: 'PM', pillar: 'app', contentType: 'carousel', hashtagSet: 'E',
    title: 'How Our Quiz Works',
    caption: `How does MyStrainAI match you to your perfect strain?\n\n8 layers of molecular analysis:\n\n1️⃣ Receptor pathway matching\n2️⃣ Pharmacological scaffold scoring\n3️⃣ Community effect verification\n4️⃣ Tolerance safety filtering\n5️⃣ Avoidance screening\n6️⃣ Cannabinoid compatibility\n7️⃣ Preference alignment\n8️⃣ Molecular synergy detection\n\nNo other tool analyzes strains at this depth.\n\n💚 Try the science-based quiz → link in bio`,
    generationType: 'screenshot', screenshotPages: ['/quiz'] },

  { day: 3, slot: 'AM', pillar: 'strain', contentType: 'carousel', hashtagSet: 'B',
    title: 'Blue Dream: The Science',
    caption: `Blue Dream is the most popular strain in America.\n\nBut do you know WHY it works so well?\n\nIts balanced myrcene-to-limonene ratio creates a rare molecular equilibrium: relaxation from GABA enhancement + mood elevation from serotonin modulation.\n\nSwipe for the full molecular breakdown — including which receptors it activates and what that means for you. 👉\n\n📊 See what molecules match your goals → link in bio`,
    generationType: 'branded-graphic', strainIndex: 0 },
  { day: 3, slot: 'PM', pillar: 'data', contentType: 'single', hashtagSet: 'C',
    title: 'We analyzed 967 strains',
    caption: `We analyzed ${BRAND.stats.strains} strains across ${BRAND.stats.molecules} molecules and ${BRAND.stats.bindings} receptor bindings.\n\nThe most common terpene? Caryophyllene (45% of strains).\nThe rarest? Terpinolene (10%).\n\nBut here's the interesting part: the rarest terpene profiles often produce the most unique effects.\n\n🎯 Take the free quiz → link in bio`,
    generationType: 'branded-graphic', dataIndex: 0 },

  { day: 4, slot: 'AM', pillar: 'myth', contentType: 'carousel', hashtagSet: 'D',
    title: 'THC% is a Lie',
    caption: `Higher THC% = more intense experience?\n\nNot even close.\n\nAbove ~15% THC, additional THC doesn't proportionally increase effects. What DOES determine your experience: the terpene profile, minor cannabinoids, and how they interact with YOUR receptors.\n\nA 18% THC strain with the right terpenes will outperform a 30% THC strain with the wrong ones — every time.\n\nSwipe for the science. 👉\n\n🔬 Find your perfect strain match → link in bio`,
    generationType: 'branded-graphic', mythIndex: 1 },
  { day: 4, slot: 'PM', pillar: 'community', contentType: 'single', hashtagSet: 'D',
    title: 'What effect do you seek?',
    caption: `When you walk into a dispensary, what's the first thing you want?\n\n🧘 Relaxation\n⚡ Energy\n🎨 Creativity\n😴 Sleep\n🧠 Focus\n😊 Mood boost\n\nDrop your answer below 👇\n\nWhatever you're looking for, our molecular matching engine can find the strains that hit the right receptor pathways for YOUR goals.\n\n🎯 Your perfect strain is waiting → link in bio`,
    generationType: 'branded-graphic' },

  { day: 5, slot: 'AM', pillar: 'terpene', contentType: 'carousel', hashtagSet: 'A',
    title: 'Caryophyllene: The Cannabinoid Terpene',
    caption: `🌶️ Meet β-Caryophyllene — the ONLY terpene that directly activates cannabinoid receptors.\n\nFound in black pepper, cloves, and 45% of cannabis strains, caryophyllene is the bridge between terpenes and cannabinoids.\n\nIt's a direct CB2 agonist — meaning it doesn't just modulate receptors like other terpenes. It ACTIVATES them. That's why strains high in caryophyllene are associated with anti-inflammatory and pain-relieving effects.\n\nSwipe for the full science. 👉\n\n🧬 Match your biology to your strain → link in bio`,
    generationType: 'branded-graphic', terpeneKey: 'caryophyllene' },
  { day: 5, slot: 'PM', pillar: 'app', contentType: 'carousel', hashtagSet: 'E',
    title: 'Strain Explorer Tour',
    caption: `Browse ${BRAND.stats.strains} strains by terpene, effect, or chemistry.\n\nOur Strain Explorer lets you:\n\n🔍 Search by name, effect, or molecule\n📊 See full terpene and cannabinoid profiles\n🧬 View receptor binding predictions\n📈 Compare predicted vs. reported effects\n\nIt's like having a molecular database in your pocket.\n\n💚 Try the science-based quiz → link in bio`,
    generationType: 'screenshot', screenshotPages: ['/explore'] },

  { day: 6, slot: 'AM', pillar: 'strain', contentType: 'carousel', hashtagSet: 'B',
    title: 'Granddaddy Purple: Sleep Science',
    caption: `Looking for sleep? Granddaddy Purple's terpene profile explains why it's a knockout.\n\nMyrcene + Linalool = GABA double-tap.\n\nBoth terpenes modulate GABA-A receptors — the brain's primary sedation pathway. It's the same receptor family that benzodiazepines target, but through a different (and non-addictive) mechanism.\n\nSwipe for the full molecular breakdown. 👉\n\n📊 See what molecules match your goals → link in bio`,
    generationType: 'branded-graphic', strainIndex: 4 },
  { day: 6, slot: 'PM', pillar: 'data', contentType: 'carousel', hashtagSet: 'C',
    title: 'Creativity vs Relaxation Data',
    caption: `Creativity vs. Relaxation: What are cannabis consumers actually looking for?\n\n📊 62% seek relaxation\n📊 23% seek creativity\n📊 15% seek focus\n\nBut here's the interesting finding: strains that score highest for creativity in our engine also rank high for focus. The terpene profiles overlap significantly — terpinolene and pinene appear in both.\n\nSwipe for the data. 👉\n\n🎯 Take the free quiz → link in bio`,
    generationType: 'branded-graphic', dataIndex: 4 },

  { day: 7, slot: 'AM', pillar: 'data', contentType: 'carousel', hashtagSet: 'C',
    title: '6 Receptors Explained',
    caption: `Your brain has receptor systems that cannabis interacts with. But which ones — and what do they do?\n\n🧠 CB1 — Found in the brain. Responsible for psychoactive effects.\n🦴 CB2 — Found in the immune system. Anti-inflammatory.\n😌 5-HT1A — Serotonin receptor. Mood and anxiety.\n🌡️ TRPV1 — The "capsaicin" receptor. Pain modulation.\n💤 GABA-A — Primary sedation pathway.\n🧬 PPARγ — Nuclear receptor. Inflammation.\n\nOur engine maps each strain to ALL of these.\n\n🔬 Start your molecular match → link in bio`,
    generationType: 'branded-graphic' },
  { day: 7, slot: 'PM', pillar: 'community', contentType: 'single', hashtagSet: 'D',
    title: 'Weekend Strain Poll',
    caption: `It's the weekend. What's your vibe?\n\n🎉 Social & energetic\n🎨 Creative & focused\n🧘 Relaxed & calm\n😴 Full sedation mode\n\nDrop your answer below and we'll tell you which terpene profile matches 👇\n\nOr skip the comments and let our engine do the work:\n\n🎯 Take the free quiz → link in bio`,
    generationType: 'branded-graphic' },

  // ── Week 2 ──
  { day: 8, slot: 'AM', pillar: 'myth', contentType: 'carousel', hashtagSet: 'A',
    title: 'CBD Doesn\'t Always Calm You',
    caption: `"Just take some CBD, it'll calm you down."\n\nNot necessarily.\n\nCBD is biphasic:\n▪️ Low doses (under 15mg) can be ALERTING\n▪️ Only higher doses tend to be sedating\n\nAnd the terpene profile of your CBD product matters more than the CBD itself. A CBD strain high in pinene will feel very different from one high in linalool.\n\nSwipe for the science. 👉\n\n🧬 Discover your ideal terpene profile → link in bio`,
    generationType: 'branded-graphic', mythIndex: 2 },
  { day: 8, slot: 'PM', pillar: 'app', contentType: 'carousel', hashtagSet: 'E',
    title: 'Predicted vs Reported',
    caption: `Most apps tell you what a strain "should" do.\n\nWe tell you what the MOLECULES predict AND what USERS report.\n\nPredicted Score: Based on terpene pharmacology and receptor binding data.\nReported Score: Based on community experience reports.\n\nWhen they agree? High confidence match.\nWhen they don't? That's where the interesting science lives.\n\nSwipe to see real examples. 👉\n\n💚 Try the science-based quiz → link in bio`,
    generationType: 'screenshot', screenshotPages: ['/results'] },

  { day: 9, slot: 'AM', pillar: 'terpene', contentType: 'carousel', hashtagSet: 'A',
    title: '#TerpTuesday: Limonene',
    caption: `🍋 #TerpTuesday: Limonene — the mood molecule.\n\nFound in citrus peels and ~30% of cannabis strains, limonene is the terpene behind that uplifting, stress-melting feeling.\n\nHere's the mechanism: Limonene increases serotonin and dopamine in brain regions associated with anxiety and depression. It activates the 5-HT1A receptor — the same target as some antidepressant medications.\n\nSwipe for the full profile. 👉\n\n🎯 Take the free quiz → link in bio`,
    generationType: 'branded-graphic', terpeneKey: 'limonene' },
  { day: 9, slot: 'PM', pillar: 'strain', contentType: 'carousel', hashtagSet: 'B',
    title: 'Jack Herer: Creativity Stack',
    caption: `Jack Herer is the creativity king — and the molecules explain why.\n\nIt's one of the rare terpinolene-dominant strains. Terpinolene + pinene creates a receptor profile that:\n\n✅ Preserves acetylcholine (focus and memory)\n✅ Modulates serotonin (creative flow)\n✅ Activates TRPV1 (alertness)\n\nThis terpene stack is uncommon — only ~10% of strains have significant terpinolene.\n\nSwipe for the breakdown. 👉\n\n📊 See what molecules match your goals → link in bio`,
    generationType: 'branded-graphic', strainIndex: 5 },

  { day: 10, slot: 'AM', pillar: 'data', contentType: 'single', hashtagSet: 'C',
    title: '39 Receptor Bindings',
    caption: `${BRAND.stats.bindings} molecular receptor bindings.\n${BRAND.stats.receptors} receptor systems.\n${BRAND.stats.molecules} molecules.\n${BRAND.stats.strains} strains.\n\nOur 8-layer scoring engine processes millions of molecular interactions to find YOUR perfect strain.\n\nThis is what happens when you apply pharmacology to cannabis.\n\n🔬 Find your perfect strain match → link in bio`,
    generationType: 'branded-graphic', dataIndex: 3 },
  { day: 10, slot: 'PM', pillar: 'app', contentType: 'carousel', hashtagSet: 'E',
    title: 'Compare Strains Molecularly',
    caption: `Can't decide between two strains?\n\nOur Strain Comparison tool shows you EXACTLY how they differ:\n\n📊 Side-by-side terpene profiles\n🧬 Receptor activation differences\n📈 Effect prediction overlay\n⚖️ Molecular compatibility with your goals\n\nStop guessing. Start comparing.\n\nSwipe to see it in action. 👉\n\n🎯 Your perfect strain is waiting → link in bio`,
    generationType: 'screenshot', screenshotPages: ['/compare'] },

  { day: 11, slot: 'AM', pillar: 'myth', contentType: 'carousel', hashtagSet: 'D',
    title: 'Same Name ≠ Same Strain',
    caption: `Plot twist: Your "Blue Dream" and mine might be completely different strains.\n\nLab testing shows up to 40% variation in terpene profiles between samples of the same named strain from different growers.\n\nStrain names are marketing, not science. The only reliable indicator is the actual chemical profile.\n\nThat's why we built MyStrainAI around molecular data, not strain names.\n\nSwipe for the evidence. 👉\n\n🧬 Match your biology to your strain → link in bio`,
    generationType: 'branded-graphic', mythIndex: 3 },
  { day: 11, slot: 'PM', pillar: 'community', contentType: 'single', hashtagSet: 'D',
    title: 'Tag a Friend',
    caption: `Know someone who always picks the wrong strain at the dispensary? 😅\n\nTag them below. They need this. 👇\n\nOur molecular matching engine analyzes ${BRAND.stats.bindings} receptor bindings to find the strain that actually matches what they're looking for — not what the label says.\n\n🎯 Take the free quiz → link in bio`,
    generationType: 'branded-graphic' },

  { day: 12, slot: 'AM', pillar: 'terpene', contentType: 'carousel', hashtagSet: 'A',
    title: 'Pinene + Limonene: Focus Stack',
    caption: `🌲🍋 The Focus Stack: Pinene + Limonene\n\nWhen these two terpenes appear together, something interesting happens:\n\nPinene inhibits acetylcholinesterase → preserves memory and attention\nLimonene activates serotonin → enhances mood and motivation\n\nTogether they create a focused, alert, positive headspace without sedation.\n\nStrains high in both: Jack Herer, Durban Poison, Super Lemon Haze.\n\nSwipe for the receptor science. 👉\n\n🔬 Start your molecular match → link in bio`,
    generationType: 'branded-graphic' },
  { day: 12, slot: 'PM', pillar: 'strain', contentType: 'carousel', hashtagSet: 'B',
    title: 'OG Kush: The Original',
    caption: `OG Kush. The original. The standard.\n\nBut what makes it so consistently effective after all these years?\n\nHigh caryophyllene: Direct CB2 receptor activation → anti-inflammatory\nBalanced myrcene: GABA modulation → relaxation without knockout\nSecondary limonene: Serotonin boost → euphoria\n\nThe chemistry is timeless.\n\nSwipe for the full molecular breakdown. 👉\n\n💚 Try the science-based quiz → link in bio`,
    generationType: 'branded-graphic', strainIndex: 1 },

  { day: 13, slot: 'AM', pillar: 'data', contentType: 'carousel', hashtagSet: 'C',
    title: 'Top 3 Terpenes in Cannabis',
    caption: `The 3 terpenes that appear in 80% of top-rated strains:\n\n🌶️ Caryophyllene — 45% of strains (CB2 direct agonist)\n🥭 Myrcene — 40% of strains (GABA enhancer)\n🍋 Limonene — 30% of strains (serotonin modulator)\n\nThis "big three" combination shows up again and again in the highest-rated strains. But the RATIOS between them are what create different experiences.\n\nSwipe for the science. 👉\n\n🎯 Take the free quiz → link in bio`,
    generationType: 'branded-graphic', dataIndex: 2 },
  { day: 13, slot: 'PM', pillar: 'app', contentType: 'carousel', hashtagSet: 'E',
    title: 'Journal Your Sessions',
    caption: `The best strain data isn't in a database — it's in YOUR experience.\n\nOur Strain Journal lets you:\n\n📝 Log every session\n⭐ Rate effects, flavor, and satisfaction\n📊 Build your personal database\n🔍 Discover patterns in what works for you\n\nOver time, your journal becomes the most accurate strain guide in the world — calibrated to YOUR biology.\n\nSwipe to see how it works. 👉\n\n📊 See what molecules match your goals → link in bio`,
    generationType: 'screenshot', screenshotPages: ['/journal'] },

  { day: 14, slot: 'AM', pillar: 'strain', contentType: 'carousel', hashtagSet: 'B',
    title: 'Wedding Cake: #1 for Anxiety',
    caption: `Wedding Cake ranks #1 for anxiety in our molecular analysis. Here's why.\n\nIt hits 3 anxiety-relevant pathways simultaneously:\n\n🌶️ Caryophyllene → CB2 receptor (anti-inflammatory calm)\n🍋 Limonene → 5-HT1A serotonin receptor (mood stabilization)\n💜 Linalool → GABA-A receptor (neural quieting)\n\nOur 8-layer engine specifically looks for this kind of multi-pathway coverage.\n\nSwipe for the full analysis. 👉\n\n🎯 Your perfect strain is waiting → link in bio`,
    generationType: 'branded-graphic', strainIndex: 6 },
  { day: 14, slot: 'PM', pillar: 'community', contentType: 'single', hashtagSet: 'D',
    title: 'Sunday Wellness Check',
    caption: `Sunday wellness check 🧘\n\nHow are you feeling today?\n\n💚 Great — riding a good wave\n🟡 Okay — could use a boost  \n🔴 Stressed — need to decompress\n\nWhatever you're feeling, the right terpene profile can support your goals.\n\nDrop your mood below and we'll suggest a terpene to look for 👇\n\n🧬 Discover your ideal terpene profile → link in bio`,
    generationType: 'branded-graphic' },
];

// Helper: get the next post from the calendar based on current date
export function getNextPost(startDate = new Date('2026-03-03')) {
  const now = new Date();
  const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
  const dayInCalendar = (daysSinceStart % (CONTENT_CALENDAR.length / 2)) + 1;
  const currentHour = now.getHours();
  const slot = currentHour < 15 ? 'AM' : 'PM'; // Before 3PM = morning post

  const post = CONTENT_CALENDAR.find(
    (p) => p.day === dayInCalendar && p.slot === slot
  );

  if (!post) return CONTENT_CALENDAR[0]; // fallback

  // Attach full hashtag set
  post.hashtags = HASHTAG_SETS[post.hashtagSet];

  // Attach CTA (rotate based on day)
  post.cta = CTAS[daysSinceStart % CTAS.length];

  return post;
}

// Helper: get hashtag set, rotating to avoid consecutive repeats
let lastHashtagSet = null;
export function getRotatedHashtags(preferredSet) {
  if (preferredSet === lastHashtagSet) {
    const keys = Object.keys(HASHTAG_SETS).filter((k) => k !== lastHashtagSet);
    const alt = keys[Math.floor(Math.random() * keys.length)];
    lastHashtagSet = alt;
    return HASHTAG_SETS[alt];
  }
  lastHashtagSet = preferredSet;
  return HASHTAG_SETS[preferredSet];
}
