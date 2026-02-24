import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'
import {
  BookOpen,
  Leaf,
  FlaskConical,
  Layers,
  Droplets,
  ChevronDown,
  ChevronUp,
  Flame,
  Clock,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  FileText,
} from 'lucide-react'
import Card from '../components/shared/Card'
import terpenes from '../data/terpenes.json'
import { CANNABINOIDS } from '../data/cannabinoids'
import { CONSUMPTION_METHODS } from '../data/consumptionMethods'
import { getTerpeneColor } from '../utils/colors'

/* ------------------------------------------------------------------ */
/*  Topic section wrapper                                             */
/* ------------------------------------------------------------------ */
function TopicSection({ id, title, icon: Icon, preview, children, isOpen, onToggle }) {
  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-leaf-500/10 flex items-center justify-center flex-shrink-0">
            <Icon size={18} className="text-leaf-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea]">{title}</h2>
            {!isOpen && (
              <p className="text-xs text-gray-500 dark:text-[#6a7a6e] mt-0.5 line-clamp-1">
                {preview}
              </p>
            )}
          </div>
        </div>
        {isOpen ? (
          <ChevronUp size={18} className="text-gray-400 dark:text-[#5a6a5e] flex-shrink-0" />
        ) : (
          <ChevronDown size={18} className="text-gray-400 dark:text-[#5a6a5e] flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 animate-fade-in-fast border-t border-gray-100 dark:border-white/[0.04] pt-4">
          {children}
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  1. Terpene Guide                                                  */
/* ------------------------------------------------------------------ */
function TerpeneGuide() {
  const terpeneEntries = Object.entries(terpenes)

  return (
    <div>
      <p className="text-sm text-gray-600 dark:text-[#8a9a8e] mb-4 leading-relaxed">
        Terpenes are aromatic compounds produced by cannabis and many other plants. They shape
        the taste, smell, and -- most importantly -- the effects of each strain. Understanding
        terpenes is the key to predicting how a strain will affect you.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {terpeneEntries.map(([key, terp]) => (
          <div
            key={key}
            className="p-3 rounded-xl border border-gray-100 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: terp.color }}
              />
              <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea]">
                {terp.name}
              </h3>
            </div>

            {/* Effects */}
            <div className="mb-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e]">
                Key Effects
              </span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {terp.effects.map((eff) => (
                  <span
                    key={eff}
                    className="px-1.5 py-0.5 rounded text-[10px] capitalize"
                    style={{
                      backgroundColor: `${terp.color}15`,
                      color: terp.color,
                    }}
                  >
                    {eff.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>

            {/* Aromas */}
            <div className="mb-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e]">
                Aromas
              </span>
              <p className="text-xs text-gray-600 dark:text-[#8a9a8e] mt-0.5">
                {terp.aroma.join(', ')}
              </p>
            </div>

            {/* Also found in */}
            <div className="mb-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5a6a5e]">
                Also Found In
              </span>
              <p className="text-xs text-gray-600 dark:text-[#8a9a8e] mt-0.5">
                {terp.alsoFoundIn.join(', ')}
              </p>
            </div>

            {/* Boiling point */}
            <div className="pt-1.5 border-t border-gray-100 dark:border-white/[0.04]">
              <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                Boiling point: {terp.boilingPoint}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  2. Cannabinoid Guide                                              */
/* ------------------------------------------------------------------ */
function CannabinoidGuide() {
  return (
    <div>
      <p className="text-sm text-gray-600 dark:text-[#8a9a8e] mb-4 leading-relaxed">
        Cannabinoids are the active chemical compounds in cannabis that interact with your
        endocannabinoid system. Each one produces different effects, and understanding them
        helps you make better choices.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {CANNABINOIDS.map((cann) => (
          <div
            key={cann.id}
            className="p-4 rounded-xl border border-gray-100 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: `${cann.color}20`, color: cann.color }}
              >
                {cann.name}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea]">
                  {cann.name}
                </h3>
                <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e]">
                  {cann.fullName}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
              {cann.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  3. Entourage Effect                                               */
/* ------------------------------------------------------------------ */
function EntourageEffect() {
  const terpeneNames = Object.values(terpenes).slice(0, 5).map((t) => t.name)
  const cannabinoidNames = CANNABINOIDS.slice(0, 4).map((c) => c.name)

  return (
    <div>
      <p className="text-sm text-gray-600 dark:text-[#8a9a8e] mb-4 leading-relaxed">
        The entourage effect describes how cannabinoids and terpenes work together synergistically
        to produce effects greater than any single compound alone. It is the reason why full-spectrum
        products often feel different from pure THC isolate.
      </p>

      {/* Visual diagram */}
      <div className="p-6 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06] mb-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center gap-8">
          {/* Terpenes column */}
          <div className="text-center">
            <h4 className="text-xs font-semibold text-leaf-400 uppercase tracking-wider mb-3">
              Terpenes
            </h4>
            <div className="flex flex-col gap-2">
              {terpeneNames.map((name) => {
                const color = getTerpeneColor(name)
                return (
                  <div
                    key={name}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                    style={{
                      backgroundColor: `${color}15`,
                      borderColor: `${color}30`,
                      color: color,
                    }}
                  >
                    {name}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Connecting arrows */}
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            <div className="hidden sm:flex flex-col gap-1 items-center">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-12 h-0.5 rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #32c864, #9775fa)',
                    opacity: 0.3 + (i * 0.15),
                    transform: `rotate(${-20 + i * 10}deg)`,
                  }}
                />
              ))}
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-leaf-500/20 to-purple-500/20 border border-leaf-500/30 flex items-center justify-center">
              <Layers size={18} className="text-leaf-400" />
            </div>
            <span className="text-[10px] text-gray-400 dark:text-[#5a6a5e] font-medium">
              SYNERGY
            </span>
          </div>

          {/* Cannabinoids column */}
          <div className="text-center">
            <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3">
              Cannabinoids
            </h4>
            <div className="flex flex-col gap-2">
              {cannabinoidNames.map((name) => {
                const cann = CANNABINOIDS.find((c) => c.name === name)
                return (
                  <div
                    key={name}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                    style={{
                      backgroundColor: `${cann?.color || '#888'}15`,
                      borderColor: `${cann?.color || '#888'}30`,
                      color: cann?.color || '#888',
                    }}
                  >
                    {name}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Key points */}
      <div className="space-y-2">
        <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#8a9a8e]">
          <span className="text-leaf-500 mt-0.5">1.</span>
          <span>
            <strong className="text-gray-700 dark:text-[#b0c4b4]">CBD may modulate THC:</strong> Some research suggests CBD
            may reduce the anxiety and paranoia sometimes associated with high THC levels.
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#8a9a8e]">
          <span className="text-leaf-500 mt-0.5">2.</span>
          <span>
            <strong className="text-gray-700 dark:text-[#b0c4b4]">Myrcene and absorption:</strong> Some researchers
            theorize this terpene may influence cell membrane permeability, potentially affecting
            how cannabinoids are absorbed.
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#8a9a8e]">
          <span className="text-leaf-500 mt-0.5">3.</span>
          <span>
            <strong className="text-gray-700 dark:text-[#b0c4b4]">Caryophyllene and CB2:</strong> The
            only terpene known to interact with CB2 cannabinoid receptors. Researchers are studying
            what this unique interaction may mean.
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#8a9a8e]">
          <span className="text-leaf-500 mt-0.5">4.</span>
          <span>
            <strong className="text-gray-700 dark:text-[#b0c4b4]">Pinene and memory:</strong> Some anecdotal reports
            suggest pinene may counteract the short-term memory effects sometimes associated with THC.
          </span>
        </div>
        <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e] mt-3 italic">
          Note: The entourage effect is a scientific hypothesis still being actively researched. The information above is for educational purposes only and does not constitute medical advice.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  4. Consumption Methods                                            */
/* ------------------------------------------------------------------ */
function ConsumptionMethodsGuide() {
  const methods = CONSUMPTION_METHODS.filter((m) => m.id !== 'no_preference')

  const prosConsMap = {
    flower: {
      pros: ['Fast onset', 'Full terpene experience', 'Wide variety', 'Easy to dose incrementally'],
      cons: ['Combustion byproducts', 'Strong odor', 'Shorter duration', 'Harsh on lungs'],
    },
    vape: {
      pros: ['Fast onset', 'Discreet', 'Less harsh than smoke', 'Portable'],
      cons: ['Cart quality varies', 'Some terpenes lost', 'Battery required', 'Can be easy to overconsume'],
    },
    edibles: {
      pros: ['Long-lasting', 'No lung impact', 'Discreet', 'Precise dosing (packaged)'],
      cons: ['Slow onset', 'Hard to dose', '11-hydroxy-THC is more potent', 'Unpredictable timing'],
    },
    concentrates: {
      pros: ['Very potent', 'Immediate onset', 'Full flavor', 'Cost-effective per dose'],
      cons: ['Tolerance builds fast', 'Equipment needed', 'Not for beginners', 'Easy to overconsume'],
    },
    tinctures: {
      pros: ['Precise dosing', 'Discreet', 'No lung impact', 'Moderate onset'],
      cons: ['Taste can be off-putting', 'Less available', 'Can be expensive', 'Slower than inhalation'],
    },
    topicals: {
      pros: ['Non-psychoactive', 'Targeted relief', 'No systemic effects', 'Safe for beginners'],
      cons: ['No cerebral effects', 'Limited product range', 'Effects may be subtle', 'Reapplication needed'],
    },
  }

  return (
    <div>
      <p className="text-sm text-gray-600 dark:text-[#8a9a8e] mb-4 leading-relaxed">
        How you consume cannabis significantly affects the experience. Each method has a different
        onset time, duration, and intensity profile. Choosing the right method is just as important
        as choosing the right strain.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {methods.map((method) => {
          const pc = prosConsMap[method.id] || { pros: [], cons: [] }
          return (
            <div
              key={method.id}
              className="p-4 rounded-xl border border-gray-100 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02]"
            >
              <h3 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">
                {method.label}
              </h3>
              <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mb-2">
                {method.desc}
              </p>

              {/* Onset + duration */}
              <div className="flex items-center gap-4 mb-3 text-xs">
                {method.onset && (
                  <div className="flex items-center gap-1 text-gray-500 dark:text-[#6a7a6e]">
                    <Clock size={11} />
                    <span>Onset: <strong className="text-gray-700 dark:text-[#b0c4b4]">{method.onset}</strong></span>
                  </div>
                )}
                {method.duration && (
                  <div className="flex items-center gap-1 text-gray-500 dark:text-[#6a7a6e]">
                    <Clock size={11} />
                    <span>Duration: <strong className="text-gray-700 dark:text-[#b0c4b4]">{method.duration}</strong></span>
                  </div>
                )}
              </div>

              {/* Pros */}
              {pc.pros.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-leaf-400 flex items-center gap-1 mb-1">
                    <ThumbsUp size={10} /> Pros
                  </span>
                  <ul className="space-y-0.5">
                    {pc.pros.map((p) => (
                      <li key={p} className="text-xs text-gray-600 dark:text-[#8a9a8e] flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-leaf-500 flex-shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cons */}
              {pc.cons.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-red-400 flex items-center gap-1 mb-1">
                    <ThumbsDown size={10} /> Cons
                  </span>
                  <ul className="space-y-0.5">
                    {pc.cons.map((c) => (
                      <li key={c} className="text-xs text-gray-600 dark:text-[#8a9a8e] flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  5. Reading Lab Results                                            */
/* ------------------------------------------------------------------ */
function LabResultsGuide() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
        A Certificate of Analysis (COA) is a lab report that details exactly what is in a cannabis
        product. Knowing how to read one helps you make informed purchasing decisions and ensures
        product safety.
      </p>

      <div className="space-y-3">
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]">
          <h4 className="text-xs font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">
            1. Cannabinoid Potency
          </h4>
          <p className="text-xs text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
            Look for Total THC and Total CBD percentages. "Total THC" accounts for
            both THCA (the precursor) and active THC using the formula:
            Total THC = (THCA x 0.877) + THC. This gives you the true potency after decarboxylation.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]">
          <h4 className="text-xs font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">
            2. Terpene Profile
          </h4>
          <p className="text-xs text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
            The terpene section lists each terpene by percentage. Higher percentages indicate
            greater presence. Total terpene content above 2% is considered rich. The dominant
            terpene (highest percentage) is the best predictor of effects.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]">
          <h4 className="text-xs font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">
            3. Contaminant Testing
          </h4>
          <p className="text-xs text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
            Verify that the product has passed tests for pesticides, heavy metals (lead, arsenic,
            mercury, cadmium), microbial contaminants (E. coli, Salmonella), and residual solvents
            (for concentrates). All results should show "Pass" or "ND" (Not Detected).
          </p>
        </div>

        <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]">
          <h4 className="text-xs font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">
            4. Moisture Content
          </h4>
          <p className="text-xs text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
            Flower should have a moisture content between 10-15% for optimal freshness and
            combustion. Too dry means harsh smoke and lost terpenes; too wet risks mold growth.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]">
          <h4 className="text-xs font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">
            5. Lab Accreditation
          </h4>
          <p className="text-xs text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
            Check that the testing lab is accredited and state-licensed. Look for ISO 17025
            certification. The COA should include the lab name, license number, date of testing,
            and the batch/lot number matching your product.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  6. Indica vs Sativa: The Truth                                    */
/* ------------------------------------------------------------------ */
function IndicaSativaGuide() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
        The indica/sativa classification was originally based on the physical appearance of the
        plant, not its effects. Modern cannabis science has revealed that these categories are
        far less meaningful than most consumers believe.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <div className="p-4 rounded-xl bg-purple-500/[0.06] border border-purple-500/20">
          <h4 className="text-sm font-bold text-purple-400 mb-2">The Old Thinking</h4>
          <ul className="space-y-1.5 text-xs text-gray-600 dark:text-[#8a9a8e]">
            <li className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-purple-400" />
              Indica = Relaxing, sedating, "body high"
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-purple-400" />
              Sativa = Energizing, uplifting, "head high"
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-purple-400" />
              Hybrid = Somewhere in between
            </li>
          </ul>
        </div>

        <div className="p-4 rounded-xl bg-leaf-500/[0.06] border border-leaf-500/20">
          <h4 className="text-sm font-bold text-leaf-400 mb-2">What Science Says</h4>
          <ul className="space-y-1.5 text-xs text-gray-600 dark:text-[#8a9a8e]">
            <li className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-leaf-500" />
              Terpene profiles are the strongest effect predictors
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-leaf-500" />
              Cannabinoid ratios shape the experience
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-leaf-500" />
              Individual body chemistry matters most
            </li>
          </ul>
        </div>
      </div>

      <div className="space-y-2 text-xs text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
        <p>
          <strong className="text-gray-700 dark:text-[#b0c4b4]">Why terpenes matter more:</strong> A
          "sativa" strain high in myrcene may be more sedating than an "indica" strain dominant
          in terpinolene. The terpene profile is a much better predictor of how you will feel
          than the indica/sativa label on the jar.
        </p>
        <p>
          <strong className="text-gray-700 dark:text-[#b0c4b4]">Decades of crossbreeding:</strong> Nearly
          all modern cannabis strains are hybrids. The genetic lines between "pure indica" and
          "pure sativa" have been blurred to the point of near-irrelevance. DNA studies show
          little correlation between labeled type and actual genetic lineage.
        </p>
        <p>
          <strong className="text-gray-700 dark:text-[#b0c4b4]">What to do instead:</strong> Rather than
          relying on indica/sativa labels, look at the lab-tested terpene profile and cannabinoid
          ratios. MyStrain+ uses this approach to match you with strains based on chemistry,
          not marketing labels.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  TOPICS CONFIG                                                     */
/* ------------------------------------------------------------------ */
const TOPICS = [
  {
    id: 'terpenes',
    title: 'Terpene Guide',
    icon: Droplets,
    preview: 'Explore the 9 key terpenes that shape cannabis effects, aromas, and experiences.',
    component: TerpeneGuide,
  },
  {
    id: 'cannabinoids',
    title: 'Cannabinoid Guide',
    icon: FlaskConical,
    preview: 'Understand THC, CBD, CBN, CBG, THCV, and CBC and how they affect your body.',
    component: CannabinoidGuide,
  },
  {
    id: 'entourage',
    title: 'The Entourage Effect',
    icon: Layers,
    preview: 'How terpenes and cannabinoids work together for effects greater than the sum of parts.',
    component: EntourageEffect,
  },
  {
    id: 'methods',
    title: 'Consumption Methods',
    icon: Flame,
    preview: 'Compare flower, vape, edibles, concentrates, tinctures, and topicals side by side.',
    component: ConsumptionMethodsGuide,
  },
  {
    id: 'lab-results',
    title: 'Reading Lab Results',
    icon: FileText,
    preview: 'How to read a Certificate of Analysis and what to look for in lab testing.',
    component: LabResultsGuide,
  },
  {
    id: 'indica-sativa',
    title: 'Indica vs Sativa: The Truth',
    icon: Leaf,
    preview: 'Why these categories are less meaningful than terpene profiles.',
    component: IndicaSativaGuide,
  },
]

/* ------------------------------------------------------------------ */
/*  LearnPage                                                         */
/* ------------------------------------------------------------------ */
export default function LearnPage() {
  usePageTitle('Learn Cannabis Science')
  const { topic: urlTopic } = useParams()
  const [openTopics, setOpenTopics] = useState(() => {
    if (urlTopic) {
      const found = TOPICS.find((t) => t.id === urlTopic)
      return found ? new Set([found.id]) : new Set()
    }
    return new Set()
  })

  const toggleTopic = (id) => {
    setOpenTopics((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pt-4 animate-fade-in">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-leaf-500/10 flex items-center justify-center mx-auto mb-4">
          <BookOpen size={24} className="text-leaf-500" />
        </div>
        <h1
          className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#e8f0ea]"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Cannabis Education
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#8a9a8e] mt-1">
          Understanding the science behind your experience
        </p>
      </div>

      {/* Topic sections */}
      <div className="space-y-3 mb-8">
        {TOPICS.map((topic) => {
          const TopicComponent = topic.component
          return (
            <TopicSection
              key={topic.id}
              id={topic.id}
              title={topic.title}
              icon={topic.icon}
              preview={topic.preview}
              isOpen={openTopics.has(topic.id)}
              onToggle={() => toggleTopic(topic.id)}
            >
              <TopicComponent />
            </TopicSection>
          )
        })}
      </div>
    </div>
  )
}
