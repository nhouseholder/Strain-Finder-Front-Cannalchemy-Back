/**
 * LearnPage — Cannabis education hub with terpene & cannabinoid guides.
 */
import { useParams, Link } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'
import Card from '../components/shared/Card'
import { BookOpen, Leaf, Beaker, ArrowRight, Sparkles } from 'lucide-react'

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

      {activeTopic ? (
        <TopicCard topic={activeTopic} />
      ) : (
        <TopicIndex />
      )}

      <div className="h-8" />
    </div>
  )
}
