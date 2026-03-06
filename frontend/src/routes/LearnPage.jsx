/**
 * LearnPage — Cannabis education hub with terpene & cannabinoid guides.
 */
import { useParams, Link } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'
import Card from '../components/shared/Card'
import { BookOpen, Leaf, Beaker, ArrowRight, Sparkles, Info, Database, Shield, Brain, FlaskConical, Users, Zap, Dna } from 'lucide-react'

const TOPICS = [
  {
    id: 'terpenes',
    title: 'Terpenes',
    icon: Leaf,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    description: 'Aromatic compounds that shape each strain\'s unique effects, flavor, and aroma.',
    facts: [
      { name: 'Myrcene', detail: 'The most common terpene in cannabis. Earthy, musky aroma. Associated with relaxation and sedation.', color: 'bg-amber-500/10 text-amber-400' },
      { name: 'Limonene', detail: 'Bright citrus aroma. Associated with elevated mood, stress relief, and anti-anxiety effects.', color: 'bg-yellow-500/10 text-yellow-500' },
      { name: 'Linalool', detail: 'Floral, lavender scent. Known for calming, anti-anxiety, and sedative properties.', color: 'bg-violet-500/10 text-violet-400' },
      { name: 'Caryophyllene', detail: 'Spicy, peppery aroma. The only terpene that binds to CB2 receptors. Anti-inflammatory properties.', color: 'bg-orange-500/10 text-orange-400' },
      { name: 'Pinene', detail: 'Pine forest aroma. Associated with alertness, memory retention, and anti-inflammatory effects.', color: 'bg-green-500/10 text-green-400' },
      { name: 'Humulene', detail: 'Woody, earthy aroma (also found in hops). Known for appetite suppression and anti-inflammatory effects.', color: 'bg-lime-500/10 text-lime-500' },
      { name: 'Terpinolene', detail: 'Piney, floral, herbaceous. Found in strains described as "uplifting." Less common but distinctive.', color: 'bg-teal-500/10 text-teal-400' },
      { name: 'Ocimene', detail: 'Sweet, herbal, woody aroma. Associated with anti-viral and anti-fungal properties.', color: 'bg-cyan-500/10 text-cyan-400' },
    ],
  },
  {
    id: 'cannabinoids',
    title: 'Cannabinoids',
    icon: Beaker,
    color: 'text-leaf-400',
    bg: 'bg-leaf-500/10',
    description: 'Active compounds in cannabis that interact with your endocannabinoid system.',
    facts: [
      { name: 'THC (Δ9-THC)', detail: 'The primary psychoactive cannabinoid. Produces euphoria, pain relief, appetite stimulation, and altered perception.', color: 'bg-green-500/10 text-green-400' },
      { name: 'CBD', detail: 'Non-psychoactive. Known for anti-anxiety, anti-inflammatory, and neuroprotective properties without the "high."', color: 'bg-blue-500/10 text-blue-400' },
      { name: 'CBN', detail: 'Mildly psychoactive. Formed as THC degrades. Associated with sedation and sleep aid.', color: 'bg-purple-500/10 text-purple-400' },
      { name: 'CBG', detail: 'Non-psychoactive precursor to THC and CBD. Anti-inflammatory, antibacterial, and neuroprotective potential.', color: 'bg-amber-500/10 text-amber-400' },
      { name: 'THCV', detail: 'Psychoactive at high doses. Known for appetite suppression (unlike THC) and energizing effects.', color: 'bg-red-500/10 text-red-400' },
      { name: 'CBC', detail: 'Non-psychoactive. Anti-inflammatory and antidepressant-like effects. May work synergistically with other cannabinoids.', color: 'bg-cyan-500/10 text-cyan-400' },
    ],
  },
  {
    id: 'entourage',
    title: 'The Entourage Effect',
    icon: Sparkles,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    description: 'How terpenes, cannabinoids, and flavonoids work together synergistically.',
    facts: [
      { name: 'Synergy > Isolation', detail: 'Research suggests the full spectrum of cannabis compounds produces better therapeutic effects than isolated cannabinoids alone.', color: 'bg-amber-500/10 text-amber-400' },
      { name: 'Terpene Modulation', detail: 'Terpenes can modify how cannabinoids bind to receptors. For example, myrcene may increase THC absorption through the blood-brain barrier.', color: 'bg-purple-500/10 text-purple-400' },
      { name: 'CBD + THC', detail: 'CBD can temper THC\'s psychoactive intensity while enhancing therapeutic benefits like pain relief.', color: 'bg-blue-500/10 text-blue-400' },
      { name: 'Receptor Cross-Talk', detail: 'Compounds interact with CB1, CB2, TRPV1, 5-HT, and other receptors simultaneously — creating complex, strain-specific effects.', color: 'bg-green-500/10 text-green-400' },
    ],
  },
  {
    id: 'about',
    title: 'About MyStrainAI',
    icon: Info,
    color: 'text-leaf-400',
    bg: 'bg-leaf-500/10',
    description: 'Our mission, our science, and why you can trust our recommendations.',
    custom: 'about',
  },
  {
    id: 'archetypes',
    title: 'Strain Archetypes',
    icon: Dna,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    description: 'How we use terpene profile archetypes to estimate data for strains missing lab results.',
    custom: 'archetypes',
  },
]

function TopicCard({ topic }) {
  const Icon = topic.icon
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl ${topic.bg} flex items-center justify-center`}>
          <Icon size={20} className={topic.color} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea]" style={{ fontFamily: "'Playfair Display', serif" }}>
            {topic.title}
          </h2>
          <p className="text-xs text-gray-500 dark:text-[#8a9a8e]">{topic.description}</p>
        </div>
      </div>

      <div className="space-y-3">
        {topic.facts.map((fact) => (
          <div key={fact.name} className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-1.5 ${fact.color}`}>
              {fact.name}
            </span>
            <p className="text-xs text-gray-600 dark:text-[#b0c4b4] leading-relaxed">
              {fact.detail}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function TopicIndex() {
  return (
    <div className="space-y-3">
      {TOPICS.map((topic) => {
        const Icon = topic.icon
        return (
          <Link key={topic.id} to={`/learn/${topic.id}`}>
            <Card hoverable className="p-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${topic.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={22} className={topic.color} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea]">
                  {topic.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-[#8a9a8e] line-clamp-1">
                  {topic.description}
                </p>
              </div>
              <ArrowRight size={16} className="text-gray-300 dark:text-[#5a6a5e] flex-shrink-0" />
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

/* ================================================================ */
/*  About Section                                                    */
/* ================================================================ */

const DATA_STATS = [
  { label: 'Strains', value: '2,097', icon: Leaf },
  { label: 'Lab-Verified', value: '1,833', icon: Shield },
  { label: 'Cannabinoids / Strain', value: '6', icon: Beaker },
  { label: 'Terpenes / Strain', value: '6', icon: FlaskConical },
  { label: 'Molecular Bindings', value: '19', icon: Zap },
  { label: 'Receptor Pathways', value: '6', icon: Brain },
  { label: 'Canonical Effects', value: '51', icon: Users },
]

const DATA_SOURCES = [
  {
    name: 'Cannlytics',
    description: 'Open-source cannabis data platform aggregating lab results from state-licensed testing facilities across the U.S. Provides standardized COA (Certificate of Analysis) data.',
    url: 'https://cannlytics.com',
    type: 'Lab Data',
  },
  {
    name: 'SC Labs',
    description: 'One of the largest cannabis testing laboratories in California. Their published aggregate terpene and cannabinoid data informs our strain chemotype classifications.',
    url: 'https://sclabs.com',
    type: 'Lab Data',
  },
  {
    name: 'PubChem (NIH)',
    description: 'The world\'s largest open chemistry database, maintained by the National Institutes of Health. We pull molecular structures, binding affinities, and pharmacological data for all 28 tracked compounds.',
    url: 'https://pubchem.ncbi.nlm.nih.gov',
    type: 'Molecular Science',
  },
  {
    name: 'ChEMBL',
    description: 'Open-access database of bioactive drug-like molecules maintained by the European Bioinformatics Institute. Source for receptor binding affinity data (Ki values) used in our effect prediction engine.',
    url: 'https://www.ebi.ac.uk/chembl',
    type: 'Receptor Binding',
  },
  {
    name: 'Leafly Strain Database',
    description: 'The largest cannabis strain database with millions of user reviews and verified strain profiles. Community-reported effects data informs our "Predicted vs Reported" verification system.',
    url: 'https://leafly.com',
    type: 'Community Data',
  },
  {
    name: 'Peer-Reviewed Research',
    description: 'Our models incorporate findings from landmark cannabis science papers including Russo (2011) on the entourage effect, Booth & Bohlmann (2019) on terpene biosynthesis, Hazekamp et al. (2016) on chemotype classification, and Mudge et al. (2019) on cannabinoid analytics.',
    type: 'Academic Science',
  },
]

function AboutSection() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero / Pitch */}
      <Card className="p-5 border-leaf-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-leaf-500/10 flex items-center justify-center">
            <Zap size={20} className="text-leaf-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea]" style={{ fontFamily: "'Playfair Display', serif" }}>
            The Science-First Cannabis Platform
          </h2>
        </div>

        <div className="space-y-3 text-xs text-gray-600 dark:text-[#b0c4b4] leading-relaxed">
          <p className="text-sm font-medium text-gray-800 dark:text-[#d0e4d6]">
            MyStrainAI is the only cannabis recommendation engine built on molecular pharmacology, not marketing.
          </p>
          <p>
            Most cannabis platforms recommend strains based on indica/sativa labels and user votes. We go deeper.
            Our 6-layer matching algorithm analyzes the actual <strong>molecular composition</strong> of each strain —
            6 cannabinoids, 6 terpenes, 28 tracked compounds, 19 receptor binding affinities — and cross-references
            them with your personal preferences, tolerance, and desired effects.
          </p>
          <p>
            When you take our quiz, you're not just filtering by category. You're activating a pharmacological
            matching engine that understands <em>why</em> certain terpene-cannabinoid combinations produce specific
            effects — from the CB1/CB2 receptor system to TRPV1 pain pathways to 5-HT serotonin modulation.
          </p>
          <p>
            Every recommendation includes a <strong>"Predicted vs Reported"</strong> verification score that
            compares our molecular science predictions against real community data — so you can see exactly how
            accurate the science is for each strain.
          </p>
        </div>
      </Card>

      {/* How It Works */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-4 flex items-center gap-2">
          <Brain size={16} className="text-purple-400" />
          How the 6-Layer Engine Works
        </h3>
        <div className="space-y-2">
          {[
            { step: '1', title: 'Effect Matching', desc: 'Maps your desired effects to strains with the highest report counts for those specific effects.' },
            { step: '2', title: 'Terpene Alignment', desc: 'Cross-references your preferred effects with the terpene profiles scientifically linked to producing them.' },
            { step: '3', title: 'Cannabinoid Fit', desc: 'Matches THC/CBD tolerance levels and therapeutic cannabinoid needs (CBG for inflammation, CBN for sleep, etc.).' },
            { step: '4', title: 'Receptor Pathway Analysis', desc: 'Uses binding affinity data from ChEMBL to predict how each strain\'s compounds interact with your endocannabinoid system.' },
            { step: '5', title: 'Consumption Optimization', desc: 'Adjusts scores based on your preferred consumption method — flower, vape, edibles each express terpenes differently.' },
            { step: '6', title: 'AI Synthesis', desc: 'Llama 3.3 70B AI synthesizes all layers into a personalized explanation of why each strain matches you specifically.' },
          ].map(item => (
            <div key={item.step} className="flex gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
              <div className="w-6 h-6 rounded-lg bg-leaf-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-leaf-400">{item.step}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-800 dark:text-[#d0e4d6]">{item.title}</span>
                <p className="text-[11px] text-gray-500 dark:text-[#8a9a8e] mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Database Stats */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-4 flex items-center gap-2">
          <Database size={16} className="text-blue-400" />
          Our Proprietary Database
        </h3>
        <p className="text-xs text-gray-500 dark:text-[#8a9a8e] mb-3">
          Every strain in our database has a complete molecular fingerprint — not just THC and CBD.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DATA_STATS.map(stat => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] text-center">
                <Icon size={16} className="text-leaf-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea]">{stat.value}</div>
                <div className="text-[9px] text-gray-400 dark:text-[#5a6a5e] uppercase tracking-wider">{stat.label}</div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Data Sources */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-3 flex items-center gap-2">
          <Shield size={16} className="text-green-400" />
          Data Sources & Trust
        </h3>
        <p className="text-xs text-gray-500 dark:text-[#8a9a8e] mb-3">
          Our data is aggregated from peer-reviewed research, licensed testing laboratories, and
          verified community reports. Every data point is traceable to its source.
        </p>
        <div className="space-y-2">
          {DATA_SOURCES.map(src => (
            <div key={src.name} className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-800 dark:text-[#d0e4d6]">{src.name}</span>
                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-leaf-500/10 text-leaf-400 border border-leaf-500/20">
                  {src.type}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-[#8a9a8e] leading-relaxed">
                {src.description}
              </p>
              {src.url && (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 text-[10px] text-leaf-500 hover:text-leaf-400 transition-colors"
                >
                  {src.url.replace('https://', '')} ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Why Trust Us */}
      <Card className="p-5 border-amber-500/20">
        <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-400" />
          Why MyStrainAI Is Different
        </h3>
        <div className="space-y-2">
          {[
            { title: 'Science, not marketing', desc: 'We match based on molecular pharmacology — receptor binding affinities, terpene-cannabinoid interactions, and evidence-based effect prediction. Not vibes.' },
            { title: 'Full transparency', desc: 'Every strain shows its complete chemical profile and "Predicted vs Reported" validation score. We show you where the science aligns with reality — and where it doesn\'t.' },
            { title: 'Your data stays yours', desc: 'Ratings, preferences, and journal entries are stored locally and encrypted. We never sell your data. Period.' },
            { title: 'Honest about uncertainty', desc: 'Cannabis science is evolving. When our data is estimated rather than lab-tested, we say so. We\'d rather be honest than impressive.' },
            { title: 'Open methodology', desc: 'Our matching engine uses published, verifiable research. We cite our sources. We welcome scrutiny.' },
          ].map(item => (
            <div key={item.title} className="p-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
              <span className="text-xs font-semibold text-gray-800 dark:text-[#d0e4d6]">{item.title}</span>
              <p className="text-[11px] text-gray-500 dark:text-[#8a9a8e] mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Vision */}
      <div className="text-center py-6 px-4">
        <p className="text-xs text-gray-400 dark:text-[#5a6a5e] italic leading-relaxed max-w-md mx-auto">
          "Every cannabis consumer deserves access to the same caliber of pharmacological matching
          that prescription medicine takes for granted. That's what we're building."
        </p>
        <p className="text-[10px] text-gray-300 dark:text-[#4a5a4e] mt-2">
          — The MyStrainAI Team
        </p>
      </div>
    </div>
  )
}

/* ================================================================ */
/*  Archetypes Section                                               */
/* ================================================================ */

const ARCHETYPE_GROUPS = [
  {
    category: 'Indica-Dominant',
    archetypes: [
      { name: 'Classic Indica', terps: 'Myrcene, Linalool, Humulene', thc: '18–24%', character: 'Heavy body relaxation, sedative, couch-lock' },
      { name: 'Gas / Kush', terps: 'Caryophyllene, Limonene, Myrcene', thc: '22–28%', character: 'Fuel/diesel aroma, potent physical sedation' },
      { name: 'Dessert / Sweet', terps: 'Limonene, Caryophyllene, Linalool', thc: '20–26%', character: 'Sweet, euphoric relaxation with mood lift' },
      { name: 'Earthy OG', terps: 'Myrcene, Caryophyllene, Limonene', thc: '20–26%', character: 'Earthy, piney, classic OG body-and-mind calm' },
      { name: 'Purple / Berry', terps: 'Myrcene, Linalool, Caryophyllene', thc: '18–24%', character: 'Berry-sweet, deeply relaxing, sleepy' },
      { name: 'CBD Indica', terps: 'Myrcene, Caryophyllene, Pinene', thc: '1–8%', character: 'Minimal psychoactivity, anti-inflammatory calm' },
    ],
  },
  {
    category: 'Hybrid',
    archetypes: [
      { name: 'Balanced Hybrid', terps: 'Caryophyllene, Limonene, Myrcene', thc: '18–24%', character: 'Even head/body, versatile, sociable' },
      { name: 'Cookies / Dough', terps: 'Caryophyllene, Limonene, Linalool', thc: '22–28%', character: 'Sweet dough, euphoric yet relaxed, creative' },
      { name: 'Fruity Hybrid', terps: 'Limonene, Myrcene, Caryophyllene', thc: '18–24%', character: 'Tropical/citrus, mood boost with gentle body' },
      { name: 'Haze Hybrid', terps: 'Terpinolene, Myrcene, Caryophyllene', thc: '20–26%', character: 'Cerebral, creative, gentle energy' },
      { name: 'Spicy Hybrid', terps: 'Caryophyllene, Humulene, Myrcene', thc: '18–24%', character: 'Pepper/herbal, anti-inflammatory, mellowing' },
      { name: 'Gelato / Cream', terps: 'Limonene, Caryophyllene, Myrcene', thc: '22–28%', character: 'Creamy, euphoric, potent relaxation with uplift' },
      { name: 'CBD Hybrid', terps: 'Myrcene, Caryophyllene, Pinene', thc: '3–10%', character: 'Balanced THC:CBD, gentle, therapeutic' },
    ],
  },
  {
    category: 'Sativa-Dominant',
    archetypes: [
      { name: 'Classic Sativa', terps: 'Terpinolene, Pinene, Myrcene', thc: '18–24%', character: 'Uplifting, cerebral, energizing, focused' },
      { name: 'Citrus Sativa', terps: 'Limonene, Pinene, Caryophyllene', thc: '18–24%', character: 'Bright citrus, mood-elevating, anti-anxiety' },
      { name: 'Tropical Sativa', terps: 'Myrcene, Limonene, Ocimene', thc: '16–22%', character: 'Mango/pineapple, relaxed energy, creative' },
      { name: 'Piney Sativa', terps: 'Pinene, Terpinolene, Caryophyllene', thc: '16–22%', character: 'Forest pine, alert, memory-boosting' },
      { name: 'Jack / Spicy Sativa', terps: 'Terpinolene, Caryophyllene, Pinene', thc: '20–26%', character: 'Peppery-pine, energetic, focused euphoria' },
      { name: 'Floral Sativa', terps: 'Linalool, Terpinolene, Limonene', thc: '16–22%', character: 'Lavender-floral, calm creativity, anti-stress' },
    ],
  },
  {
    category: 'Specialty',
    archetypes: [
      { name: 'Landrace / Heritage', terps: 'Varies by origin', thc: '12–20%', character: 'Pure genetics, historically significant, region-specific profiles' },
      { name: 'High-Potency Modern', terps: 'Caryophyllene, Limonene, Myrcene', thc: '28–35%', character: 'Extreme potency, intense effects, low tolerance not advised' },
      { name: 'THC-Dominant Narrow', terps: 'Myrcene, Caryophyllene', thc: '20–28%', character: 'Minimal terpene diversity, THC-forward effects' },
      { name: 'Rare Terpene', terps: 'Ocimene, Terpinolene, Linalool', thc: '16–24%', character: 'Uncommon profiles, unique flavors and effects' },
      { name: 'CBD-Dominant', terps: 'Myrcene, Caryophyllene, Pinene', thc: '<1%', character: 'Non-psychoactive, therapeutic focus, anti-inflammatory' },
      { name: 'Exotic / Novel', terps: 'Complex blend', thc: '22–30%', character: 'Designer genetics, unusual terpene combinations' },
    ],
  },
]

function ArchetypeSection() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Intro */}
      <Card className="p-5 border-indigo-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Dna size={20} className="text-indigo-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea]" style={{ fontFamily: "'Playfair Display', serif" }}>
            What Are Strain Archetypes?
          </h2>
        </div>
        <div className="space-y-3 text-xs text-gray-600 dark:text-[#b0c4b4] leading-relaxed">
          <p className="text-sm font-medium text-gray-800 dark:text-[#d0e4d6]">
            Archetypes are our system for estimating terpene and cannabinoid profiles when lab data isn't available.
          </p>
          <p>
            Not every cannabis strain has been comprehensively lab-tested. When a well-known strain lacks published
            COA (Certificate of Analysis) data, we assign it to one of <strong>25 terpene profile archetypes</strong> based
            on its genetics, reported effects, and aroma descriptions from community data.
          </p>
          <p>
            This means you can still search for and learn about these strains in our database — but their chemical
            profiles are <strong>estimates, not lab-verified data</strong>. We clearly mark these strains with an
            "Estimated Profile" badge so you always know the difference.
          </p>
          <p>
            As lab data becomes available, we replace archetype estimates with real results. Our goal is always
            to provide the most accurate data possible.
          </p>
        </div>
      </Card>

      {/* Science basis */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-4 flex items-center gap-2">
          <Brain size={16} className="text-purple-400" />
          Scientific Foundation
        </h3>
        <div className="space-y-2">
          {[
            { title: 'Russo (2011)', desc: 'Taming THC — foundational research on how specific terpenes modulate cannabinoid effects through the entourage effect, establishing the pharmacological basis for our archetype classifications.' },
            { title: 'Pertwee (2008)', desc: 'The Diverse CB1 and CB2 Receptor Pharmacology — the receptor binding framework we use to predict how terpene-cannabinoid combinations produce specific therapeutic and psychoactive effects.' },
            { title: 'Booth & Bohlmann (2019)', desc: 'Terpene biosynthesis in cannabis — how genetics determine terpene production, supporting our archetype assignments based on strain lineage and genetics.' },
            { title: 'Hazekamp et al. (2016)', desc: 'Cannabis chemotype classification — the clustering approach that informed our 25-archetype system for grouping strains by chemical similarity.' },
          ].map(item => (
            <div key={item.title} className="p-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
              <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-400">{item.title}</span>
              <p className="text-[11px] text-gray-500 dark:text-[#8a9a8e] mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Archetype groups */}
      {ARCHETYPE_GROUPS.map(group => (
        <Card key={group.category} className="p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-3">
            {group.category}
          </h3>
          <div className="space-y-2">
            {group.archetypes.map(a => (
              <div key={a.name} className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-800 dark:text-[#d0e4d6]">{a.name}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    THC {a.thc}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-[#6a7a6e] mb-1">
                  <span className="font-semibold text-gray-500 dark:text-[#8a9a8e]">Key terpenes:</span> {a.terps}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-[#8a9a8e] leading-relaxed">{a.character}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {/* Disclaimer */}
      <Card className="p-5 border-amber-500/20">
        <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-3 flex items-center gap-2">
          <Shield size={16} className="text-amber-400" />
          Important: Archetypes Are Estimates
        </h3>
        <div className="space-y-2 text-[11px] text-gray-500 dark:text-[#8a9a8e] leading-relaxed">
          <p>
            Archetype profiles are <strong>educated estimates</strong> based on genetic lineage, community-reported effects,
            and peer-reviewed terpene research. They are <strong>not</strong> the same as lab-tested data.
          </p>
          <p>
            Strains tagged as "Estimated Profile" are excluded from quiz recommendations and educational spotlights.
            They appear only in search and explorer to help you discover strains that may interest you.
          </p>
          <p>
            Actual terpene and cannabinoid levels can vary significantly between grows, harvests, and testing labs.
            Always check dispensary COAs for the most accurate data on the specific product in front of you.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default function LearnPage() {
  const { topic } = useParams()
  const activeTopic = TOPICS.find((t) => t.id === topic)

  usePageTitle(activeTopic ? `Learn: ${activeTopic.title}` : 'Learn About Cannabis')

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-4 animate-fade-in">
      <div className="mb-6">
        <h1
          className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea] flex items-center gap-2"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          <BookOpen size={24} className="text-leaf-500" />
          {activeTopic ? activeTopic.title : 'Cannabis Education'}
        </h1>
        <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mt-0.5">
          {activeTopic
            ? activeTopic.description
            : 'Understanding what makes each strain unique'}
        </p>
        {activeTopic && (
          <Link to="/learn" className="inline-flex items-center gap-1 text-[10px] text-leaf-500 hover:text-leaf-400 mt-2 transition-colors">
            ← All Topics
          </Link>
        )}
      </div>

      {activeTopic?.custom === 'about' ? (
        <AboutSection />
      ) : activeTopic?.custom === 'archetypes' ? (
        <ArchetypeSection />
      ) : activeTopic ? (
        <TopicCard topic={activeTopic} />
      ) : (
        <TopicIndex />
      )}

      <div className="h-8" />
    </div>
  )
}
