/**
 * LearnPage — Cannabis education hub with terpene & cannabinoid guides.
 */
import { useParams, Link } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'
import Card from '../components/shared/Card'
import { BookOpen, Leaf, Beaker, ArrowRight, Sparkles, Info, Database, Shield, Brain, FlaskConical, Users, Zap } from 'lucide-react'

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
  { label: 'Strains', value: '1,094', icon: Leaf },
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
      ) : activeTopic ? (
        <TopicCard topic={activeTopic} />
      ) : (
        <TopicIndex />
      )}

      <div className="h-8" />
    </div>
  )
}
