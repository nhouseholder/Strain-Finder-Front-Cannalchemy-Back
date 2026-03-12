import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import usePageTitle from '../hooks/usePageTitle'
import { useStrainSearch } from '../hooks/useStrainSearch'
import {
  FlaskConical, Fingerprint, BookMarked, ArrowRight, Sparkles,
  Search, Zap, BarChart3, ChevronRight, Star, Lock,
  ThumbsUp, ThumbsDown, Users, Wine, Lightbulb, ChevronDown,
  Dna, ShieldCheck, Database, MessageCircle, Bot,
} from 'lucide-react'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import SearchAutocomplete from '../components/shared/SearchAutocomplete'
import ChatWidget from '../components/chat/ChatWidget'
import NavBar from '../components/layout/NavBar'
import { APP_VERSION } from '../utils/constants'
import { TypeBadge, EffectBadge } from '../components/shared/Badge'
import TerpBadge from '../components/shared/TerpBadge'
import ProgressBar from '../components/shared/ProgressBar'

/* ------------------------------------------------------------------ */
/*  Scroll-reveal hook — uses IntersectionObserver                    */
/* ------------------------------------------------------------------ */
function useScrollReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = '0'
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('animate-reveal-up')
          observer.unobserve(el)
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

/* ------------------------------------------------------------------ */
/*  Inline strain search bar for the hero                             */
/* ------------------------------------------------------------------ */
function StrainSearchBar({ strainCount }) {
  const navigate = useNavigate()
  const { allStrains, dataLoaded } = useStrainSearch()

  const displayCount = strainCount || allStrains.length

  return (
    <div className="mt-8 max-w-md mx-auto w-full relative z-50">
      <SearchAutocomplete
        strains={allStrains}
        dataLoaded={dataLoaded}
        placeholder="Search any strain by name..."
        showSearchButton
        onSelect={() => {}}
        onSearch={(q) => q && navigate(`/search?q=${encodeURIComponent(q)}`)}
        inputClassName="py-3.5 rounded-2xl pl-11 border border-gray-200/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] backdrop-blur-md shadow-lg shadow-black/5 dark:shadow-black/20"
      />
      <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mt-2 text-center">
        {displayCount > 0 ? `Search our database of ${displayCount.toLocaleString()}+ strains` : 'Search our strain database'}
      </p>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-chat'))}
        className="flex items-center gap-1.5 mx-auto mt-2.5 px-3 py-1 rounded-full text-[11px] text-gray-400 dark:text-[#6a7a6e] hover:text-leaf-500 dark:hover:text-leaf-400 transition-colors group"
      >
        <MessageCircle size={12} className="group-hover:text-leaf-400 transition-colors" />
        or ask our AI anything
        <ArrowRight size={10} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section 1: Hero — Physician-designed, AI-powered value prop       */
/* ------------------------------------------------------------------ */
function HeroSection({ onGetStarted, strainCount }) {
  const countLabel = strainCount > 0 ? `${strainCount.toLocaleString()}+ Strains` : 'Strain Database'

  const pillars = [
    {
      icon: Sparkles,
      title: 'AI-Driven Engine',
      desc: 'Advanced machine learning analyzes thousands of data points per strain.',
      iconBg: 'bg-amber-500/10 text-amber-400',
    },
    {
      icon: Database,
      title: countLabel,
      desc: 'One of the most comprehensive cannabis datasets, continuously updated.',
      iconBg: 'bg-blue-500/10 text-blue-400',
    },
    {
      icon: Dna,
      title: 'Molecular Precision',
      desc: 'Terpene profiles, cannabinoid ratios & 6 receptor pathways.',
      iconBg: 'bg-purple-500/10 text-purple-400',
    },
    {
      icon: ShieldCheck,
      title: 'Physician-Developed',
      desc: 'Built on clinical cannabis science & evidence-based pharmacology.',
      iconBg: 'bg-leaf-500/10 text-leaf-400',
    },
  ]

  return (
    <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16 pb-10" style={{ minHeight: '100dvh' }}>
      {/* Animated BG orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[700px] h-[700px] rounded-full animate-float-a opacity-60" style={{ background: 'radial-gradient(circle, rgba(50,200,100,0.12) 0%, transparent 70%)', top: '-15%', left: '-15%' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full animate-float-b opacity-60" style={{ background: 'radial-gradient(circle, rgba(147,80,255,0.08) 0%, transparent 70%)', bottom: '-10%', right: '-10%' }} />
        <div className="absolute w-[300px] h-[300px] rounded-full animate-pulse-glow" style={{ background: 'radial-gradient(circle, rgba(50,200,100,0.06) 0%, transparent 70%)', top: '40%', right: '20%' }} />
      </div>

      <div className="relative z-10 max-w-3xl animate-fade-in">
        {/* Trust badges row */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            <Sparkles size={12} className="text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-400">AI-Powered</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
            <Dna size={12} className="text-purple-400" />
            <span className="text-[11px] font-semibold text-purple-400">Receptor-Level Science</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-leaf-500/10 border border-leaf-500/20">
            <FlaskConical size={12} className="text-leaf-400" />
            <span className="text-[11px] font-semibold text-leaf-400">Evidence-Based</span>
          </div>
        </div>

        {/* Main headline */}
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-5 text-gray-900 dark:text-[#e8f0ea] leading-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Cannabis science,{' '}
          <span className="bg-gradient-to-r from-leaf-400 to-leaf-500 bg-clip-text text-transparent">
            personalized by AI.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-gray-500 dark:text-[#8a9a8e] mb-10 max-w-xl mx-auto leading-relaxed">
          Our AI analyzes your unique preferences against thousands of molecular profiles and receptor pathways to find strains that are truly right for you.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
          <Button size="lg" className="shadow-xl shadow-leaf-500/25" onClick={onGetStarted}>
            Find My Strain
            <ArrowRight size={18} />
          </Button>
          <Button variant="ghost" size="lg" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
            See How It Works
          </Button>
        </div>

        {/* Quick strain search */}
        <StrainSearchBar strainCount={strainCount} />

        {/* 4-pillar grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-12 max-w-2xl mx-auto">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-gray-200/40 dark:border-white/[0.05] bg-white/30 dark:bg-white/[0.02] hover:border-leaf-500/25 transition-all duration-300"
            >
              <div className={`w-9 h-9 rounded-lg ${p.iconBg} flex items-center justify-center`}>
                <p.icon size={18} />
              </div>
              <h3 className="text-[11px] font-bold text-gray-800 dark:text-[#d0e0d4] leading-tight text-center">{p.title}</h3>
              <p className="text-[10px] text-gray-500 dark:text-[#6a7a6e] leading-relaxed text-center">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* Accent tagline */}
        <div className="flex items-center justify-center gap-3 mt-8 text-[11px] text-gray-400 dark:text-[#5a6a5e]">
          <span className="h-px w-8 bg-gray-200 dark:bg-white/[0.08]" />
          <span>Science-first. Physician-informed. Personalized to you.</span>
          <span className="h-px w-8 bg-gray-200 dark:bg-white/[0.08]" />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Section 2: Features                                               */
/* ------------------------------------------------------------------ */
function FeaturesSection() {
  const ref = useScrollReveal()
  const features = [
    {
      icon: FlaskConical,
      title: 'Receptor Science',
      desc: 'Our informational tool references publicly available data on 6 receptor pathways — CB1, CB2, TRPV1, 5-HT1A, and more — using community-sourced binding affinity information.',
      color: 'text-leaf-400 bg-leaf-500/10',
    },
    {
      icon: Fingerprint,
      title: 'Personalized Matching',
      desc: 'A multi-factor algorithm weighs your preferences, reported effects, and publicly available data to suggest strains you may want to explore.',
      color: 'text-purple-400 bg-purple-500/10',
    },
    {
      icon: BookMarked,
      title: 'Track & Learn',
      desc: 'Log your personal experiences in a private journal, compare strains side-by-side, and explore the publicly available data behind each suggestion.',
      color: 'text-blue-400 bg-blue-500/10',
    },
  ]

  return (
    <section id="features" className="py-24 px-6" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl font-bold text-center text-gray-900 dark:text-[#e8f0ea] mb-4"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Science meets simplicity
        </h2>
        <p className="text-center text-gray-500 dark:text-[#6a7a6e] mb-16 max-w-lg mx-auto">
          Informational recommendations informed by publicly available pharmacology data and community reports.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="p-6">
              <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                <f.icon size={20} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 dark:text-[#8a9a8e] leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Section 3: Animated strain showcase                               */
/* ------------------------------------------------------------------ */
const DEMO_PANELS = [
  { id: 'card', label: 'Strain Card' },
  { id: 'expect', label: 'What To Expect' },
  { id: 'cannabinoids', label: 'Cannabinoids' },
  { id: 'terpenes', label: 'Terpenes' },
  { id: 'community', label: 'Community' },
  { id: 'taste', label: 'Taste' },
]

function DemoSection() {
  const ref = useScrollReveal()
  const [active, setActive] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!isAutoPlaying) return
    intervalRef.current = setInterval(() => {
      setActive(prev => (prev + 1) % DEMO_PANELS.length)
    }, 3500)
    return () => clearInterval(intervalRef.current)
  }, [isAutoPlaying])

  const handleTab = (i) => {
    setActive(i)
    setIsAutoPlaying(false)
    clearInterval(intervalRef.current)
    // Resume auto-play after 12s of inactivity
    setTimeout(() => setIsAutoPlaying(true), 12000)
  }

  return (
    <section className="py-24 px-6 overflow-hidden bg-leaf-500/[0.03] dark:bg-leaf-500/[0.02]" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 dark:text-[#e8f0ea] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
          Every strain, decoded
        </h2>
        <p className="text-center text-gray-500 dark:text-[#6a7a6e] mb-10 max-w-lg mx-auto">
          See exactly what you get — cannabinoids, terpenes, predicted effects, and community reviews.
        </p>

        {/* Panel tabs */}
        <div className="flex items-center justify-center gap-1.5 mb-6 flex-wrap">
          {DEMO_PANELS.map((p, i) => (
            <button key={p.id} onClick={() => handleTab(i)} className={`px-3 py-2 rounded-full text-[11px] font-medium transition-all min-h-[44px] ${active === i ? 'bg-leaf-500 text-white shadow-md shadow-leaf-500/30' : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-[#6a7a6e] hover:bg-gray-200 dark:hover:bg-white/[0.08]'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Animated panel container */}
        <div className="max-w-md mx-auto relative" style={{ minHeight: '360px' }}>
          {/* Progress bar */}
          <div className="flex gap-1 mb-4">
            {DEMO_PANELS.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${i < active ? 'w-full bg-leaf-500' : i === active ? 'bg-leaf-400 animate-progress-fill' : 'w-0'}`} style={i === active && isAutoPlaying ? { animation: 'progressFill 3.5s linear forwards' } : i < active ? { width: '100%' } : { width: '0%' }} />
              </div>
            ))}
          </div>

          {/* Panel 0: Strain Card */}
          <div className={`transition-all duration-500 ${active === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Blue Dream</h3>
                    <TypeBadge type="hybrid" />
                  </div>
                  <p className="text-[11px] italic text-gray-400 dark:text-[#6a7a6e] mt-0.5">Blueberry x Haze</p>
                  <p className="text-[11px] text-gray-500 dark:text-[#8a9a8e] mt-1">A balanced hybrid known for gentle euphoria and full-body relaxation</p>
                </div>
                <div className="flex items-center justify-center min-w-[48px] h-10 rounded-xl text-sm font-bold border" style={{ backgroundColor: '#32c86418', borderColor: '#32c86444', color: '#32c864' }}>94%</div>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {['Relaxation', 'Creativity'].map(t => (<span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-leaf-500/12 text-leaf-500 dark:text-leaf-400 border border-leaf-500/20">{t}</span>))}
                {['Euphoric', 'Uplifted', 'Happy'].map(e => (<EffectBadge key={e} effect={e} variant="positive" />))}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-3">
                <ProgressBar label="THC" value={21} max={35} color="#32c864" height={4} />
                <ProgressBar label="CBD" value={2} max={20} color="#3b82f6" height={4} />
                <ProgressBar label="CBN" value={0.3} max={20} color="#a855f7" height={4} />
                <ProgressBar label="CBG" value={1.1} max={20} color="#f59e0b" height={4} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  <TerpBadge name="Myrcene" pct="0.4%" />
                  <TerpBadge name="Limonene" pct="0.2%" />
                  <TerpBadge name="Caryophyllene" pct="0.1%" />
                </div>
                <div className="flex items-center gap-0.5">
                  <Star size={11} className="text-amber-400" fill="currentColor" />
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-[#b0c4b4]">8.7</span>
                  <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">(842)</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Panel 1: What To Expect */}
          <div className={`transition-all duration-500 ${active === 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
            <Card className="p-4 border-leaf-500/10">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-leaf-400" />
                <h4 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea]">What To Expect</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-1 mb-2"><ThumbsUp size={12} className="text-leaf-400" /><span className="text-[10px] font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase">Best For</span></div>
                  {['Daytime Use', 'Creativity', 'Social Settings'].map(t => (<span key={t} className="block mb-1 px-2 py-0.5 rounded-md text-[10px] bg-leaf-500/8 text-leaf-500 dark:text-leaf-400 border border-leaf-500/15 w-fit">{t}</span>))}
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-2"><ThumbsDown size={12} className="text-red-400" /><span className="text-[10px] font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase">Not Ideal For</span></div>
                  {['Sleep', 'Deep Relaxation'].map(t => (<span key={t} className="block mb-1 px-2 py-0.5 rounded-md text-[10px] bg-red-500/8 text-red-400 border border-red-500/15 w-fit">{t}</span>))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase">Predicted Effects</p>
                {[{ e: 'Focused', s: 3 }, { e: 'Creative', s: 3 }, { e: 'Energetic', s: 2 }, { e: 'Uplifted', s: 2 }, { e: 'Social', s: 2 }].map(({ e, s }) => (
                  <div key={e} className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 dark:text-[#b0c4b4]">{e}</span>
                    <div className="flex gap-0.5">{[1,2,3].map(d => (<div key={d} className={`w-2 h-2 rounded-full ${d <= s ? 'bg-leaf-400' : 'bg-gray-200 dark:bg-white/[0.06]'}`} />))}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Panel 2: Cannabinoids */}
          <div className={`transition-all duration-500 ${active === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <FlaskConical size={16} className="text-leaf-400" />
                <h4 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea]">Cannabinoids</h4>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mb-4">Full molecular breakdown of active compounds</p>
              <div className="space-y-3">
                {[{ n: 'THC', v: 21, m: 35, c: '#32c864', d: 'Primary psychoactive compound' }, { n: 'CBD', v: 2.0, m: 20, c: '#3b82f6', d: 'Non-psychoactive — may modulate THC effects' }, { n: 'CBN', v: 0.3, m: 5, c: '#a855f7', d: 'Mildly psychoactive — formed as THC ages' }, { n: 'CBG', v: 1.1, m: 5, c: '#f59e0b', d: 'Precursor cannabinoid — research ongoing' }, { n: 'THCV', v: 0.2, m: 5, c: '#ef4444', d: 'Reported as clear-headed and shorter-lasting' }, { n: 'CBC', v: 0.4, m: 5, c: '#22d3ee', d: 'Non-psychoactive — may contribute to entourage effect' }].map(({ n, v, m, c, d }) => (
                  <div key={n}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-gray-700 dark:text-[#b0c4b4]">{n}</span>
                      <span className="text-[10px] font-bold" style={{ color: c }}>{v}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(v / m) * 100}%`, backgroundColor: c }} />
                    </div>
                    <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e] mt-0.5">{d}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Panel 3: Terpenes */}
          <div className={`transition-all duration-500 ${active === 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">🧪</span>
                <h4 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea]">Terpenes</h4>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] mb-4">Aromatic compounds that shape effects, flavor, and synergy</p>
              <div className="space-y-3">
                {[{ n: 'Myrcene', p: 1.2, c: '#22c55e', a: 'Earthy, musky', e: 'Commonly associated with relaxation and body calm' }, { n: 'Limonene', p: 0.8, c: '#facc15', a: 'Citrus, lemon', e: 'Commonly associated with mood elevation' }, { n: 'Caryophyllene', p: 0.6, c: '#f97316', a: 'Peppery, spicy', e: 'Unique CB2 receptor interaction (research ongoing)' }, { n: 'Pinene', p: 0.4, c: '#10b981', a: 'Pine, herbal', e: 'Commonly associated with alertness and focus' }, { n: 'Humulene', p: 0.2, c: '#8b5cf6', a: 'Hoppy, woody', e: 'Earthy terpene found in hops and sage' }].map(({ n, p, c, a, e }) => (
                  <div key={n} className="flex items-start gap-3">
                    <TerpBadge name={n} pct={`${p}%`} />
                    <div className="flex-1 min-w-0">
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.04] overflow-hidden mb-1">
                        <div className="h-full rounded-full" style={{ width: `${(p / 1.2) * 100}%`, backgroundColor: c }} />
                      </div>
                      <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e]"><span className="font-medium text-gray-500 dark:text-[#6a7a6e]">{a}</span> — {e}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Panel 4: Community Reviews */}
          <div className={`transition-all duration-500 ${active === 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-400" />
                  <h4 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea]">Community Reviews</h4>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-leaf-500/10 border border-leaf-500/20">
                  <Star size={10} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-bold text-leaf-500">4.3</span>
                  <span className="text-[9px] text-gray-400">/5</span>
                </div>
              </div>
              <p className="text-[10px] font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase mb-2">Reported Positive Effects</p>
              {[{ e: 'Uplifting', p: 78 }, { e: 'Creative', p: 72 }, { e: 'Focused', p: 68 }, { e: 'Happy', p: 65 }].map(({ e, p }) => (
                <div key={e} className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-gray-700 dark:text-[#b0c4b4] w-16">{e}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full bg-leaf-400" style={{ width: `${p}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-leaf-500 w-8 text-right">{p}%</span>
                </div>
              ))}
              <p className="text-[10px] font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase mt-3 mb-2">Common Side Effects</p>
              {[{ e: 'Dry Mouth', p: 42 }, { e: 'Dry Eyes', p: 28 }].map(({ e, p }) => (
                <div key={e} className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-gray-700 dark:text-[#b0c4b4] w-16">{e}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full bg-red-400/60" style={{ width: `${p}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-red-400 w-8 text-right">{p}%</span>
                </div>
              ))}
              <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e] mt-2 text-center">Based on 842 community reports</p>
            </Card>
          </div>

          {/* Panel 5: Taste & Experience */}
          <div className={`transition-all duration-500 ${active === 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wine size={16} className="text-purple-400" />
                  <h4 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea]">Taste & Experience</h4>
                </div>
                <span className="text-xs font-bold text-purple-400">7.6 / 10</span>
              </div>
              <div className="space-y-3">
                {[{ l: 'Taste', v: 8, c: '#a855f7', n: 'Sweet blueberry with pine undertones' }, { l: 'Aroma', v: 7.5, c: '#8b5cf6', n: 'Strong fruity nose with floral hints' }, { l: 'Smoothness', v: 7, c: '#6366f1', n: 'Clean smoke, minimal irritation' }, { l: 'Throat Feel', v: 6.5, c: '#818cf8', n: 'Mild hit, mostly smooth' }, { l: 'Burn Quality', v: 8.5, c: '#a78bfa', n: 'Slow, even burn with white ash' }].map(({ l, v, c, n }) => (
                  <div key={l}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-medium text-gray-700 dark:text-[#b0c4b4]">{l}</span>
                      <span className="text-[10px] font-bold" style={{ color: c }}>{v}/10</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.04] overflow-hidden mb-0.5">
                      <div className="h-full rounded-full" style={{ width: `${v * 10}%`, backgroundColor: c }} />
                    </div>
                    <p className="text-[9px] text-gray-400 dark:text-[#5a6a5e]">{n}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Caption */}
        <p className="text-center text-[11px] text-gray-400 dark:text-[#5a6a5e] mt-4">
          Sample data from our 1,000+ strain database. All information is community-sourced, for educational purposes only, and may not reflect actual product characteristics.
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Section 4: How It Works                                           */
/* ------------------------------------------------------------------ */
function HowItWorksSection() {
  const ref = useScrollReveal()
  const steps = [
    { num: '01', title: 'Take the Quiz', desc: 'Tell us what effects you want, your tolerance, and preferences. Takes 60 seconds.', icon: Search },
    { num: '02', title: 'Get Suggestions', desc: 'Our algorithm references publicly available data on terpene profiles, reported effects, and community reviews to suggest strains to explore.', icon: Zap },
    { num: '03', title: 'Explore the Data', desc: 'Browse cannabinoid info, terpene data, community-reported effects, and user reviews for each suggestion. All data is informational only.', icon: FlaskConical },
  ]

  return (
    <section className="py-24 px-6 bg-black/[0.02] dark:bg-leaf-500/[0.025]" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl font-bold text-center text-gray-900 dark:text-[#e8f0ea] mb-16"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-leaf-500/10 flex items-center justify-center mx-auto mb-4">
                <s.icon size={24} className="text-leaf-400" />
              </div>
              <span className="text-[10px] font-bold text-leaf-400 uppercase tracking-widest">{s.num}</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea] mt-1 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 dark:text-[#8a9a8e] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Section 4b: AI Chat Spotlight                                     */
/* ------------------------------------------------------------------ */
function AIChatSection() {
  const ref = useScrollReveal()

  const sampleConvo = [
    { role: 'user', text: "What's a good strain for focus and creativity?" },
    { role: 'ai', text: "Based on our database, **Durban Poison** is a top pick — it's a pure sativa with high THCV and limonene, commonly reported for energizing focus. **Jack Herer** is another great option with a balanced terpene profile for creative flow." },
  ]

  return (
    <section className="py-20 px-6 overflow-hidden" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-14">
          {/* Left: copy */}
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-leaf-500/10 border border-leaf-500/20 mb-4">
              <Sparkles size={12} className="text-leaf-400" />
              <span className="text-[11px] font-semibold text-leaf-400">New Feature</span>
            </div>
            <h2
              className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Ask our AI about{' '}
              <span className="bg-gradient-to-r from-leaf-400 to-leaf-500 bg-clip-text text-transparent">
                any strain
              </span>
            </h2>
            <p className="text-sm text-gray-500 dark:text-[#8a9a8e] leading-relaxed mb-6 max-w-md mx-auto md:mx-0">
              Get instant, personalized answers grounded in our full strain database. Ask about effects, terpenes, comparisons, or recommendations — our AI searches {'\u{2318}'} 1,400+ strains in real time.
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-chat'))}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-leaf-500/10 hover:bg-leaf-500/20 border border-leaf-500/20 hover:border-leaf-500/30 text-leaf-500 dark:text-leaf-400 text-sm font-medium transition-all group"
            >
              <MessageCircle size={16} />
              Try it now
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Right: mini chat mockup */}
          <div className="flex-1 max-w-sm w-full">
            <div className="rounded-2xl border border-gray-200/50 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.03] backdrop-blur-lg shadow-xl shadow-black/5 dark:shadow-black/30 overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200/40 dark:border-white/[0.06] bg-gradient-to-r from-leaf-500/10 to-transparent">
                <div className="w-7 h-7 rounded-full bg-leaf-500/15 flex items-center justify-center">
                  <Bot size={14} className="text-leaf-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-[#d0e0d4]">Strain AI</p>
                  <p className="text-[9px] text-leaf-500">Online · Instant answers</p>
                </div>
              </div>
              {/* Messages */}
              <div className="p-3 space-y-3">
                {sampleConvo.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-leaf-500 text-white rounded-br-md'
                        : 'bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-[#c0d4c4] rounded-bl-md border border-gray-200/40 dark:border-white/[0.06]'
                    }`}>
                      {msg.text.split(/(\*\*[^*]+\*\*)/).map((seg, j) =>
                        seg.startsWith('**') && seg.endsWith('**')
                          ? <strong key={j} className="font-semibold">{seg.slice(2, -2)}</strong>
                          : seg
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Fake input */}
              <div className="px-3 pb-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200/50 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02]">
                  <span className="text-[11px] text-gray-400 dark:text-[#5a6a5e]">Ask about a strain...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Section 6: Final CTA                                              */
/* ------------------------------------------------------------------ */
function CTASection({ onGetStarted }) {
  const ref = useScrollReveal()
  return (
    <section className="py-24 px-6" ref={ref}>
      <div className="max-w-xl mx-auto text-center">
        <div className="text-5xl mb-6 select-none">{'\u{1F33F}'}</div>
        <h2
          className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-4"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Ready to find your strain?
        </h2>
        <p className="text-gray-500 dark:text-[#8a9a8e] mb-8">
          Explore cannabis information informed by community data and publicly available research.
        </p>
        <Button size="lg" className="shadow-xl shadow-leaf-500/25" onClick={onGetStarted}>
          Take the Quiz
          <ArrowRight size={18} />
        </Button>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Landing Page                                                      */
/* ================================================================== */
export default function LandingPage() {
  usePageTitle('Cannabis Science, Personalized')
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  // Get dynamic strain count
  const { allStrains } = useStrainSearch()
  const strainCount = allStrains.length

  // Smart navigation — results if available, otherwise quiz
  const handleGetStarted = useCallback(() => {
    navigate('/quiz')
  }, [navigate])

  return (
    <div className="min-h-screen relative bg-[#f4f7f5] dark:bg-leaf-900" style={{ minHeight: '100dvh' }}>
      {/* Sticky nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-[#f4f7f5]/90 dark:bg-leaf-900/85 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/[0.06] shadow-sm dark:shadow-none">
        <NavLink to="/" className="flex items-center gap-2 text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
          <span className="text-2xl">{'\u{1F33F}'}</span>
          <div className="flex flex-col leading-tight">
            <span className="bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent">MyStrainAI</span>
            <span className="text-[9px] font-normal text-gray-400 dark:text-[#7a9a7e] tracking-wide">{APP_VERSION}</span>
          </div>
        </NavLink>
        <div className="flex items-center gap-2">
          {user ? (
            <Button size="sm" onClick={() => navigate('/journal')}>
              Go to App
              <ArrowRight size={14} />
            </Button>
          ) : (
            <>
              <button
                onClick={() => navigate('/quiz')}
                className="text-sm font-medium text-gray-500 dark:text-[#6a7a6e] hover:text-gray-700 dark:hover:text-[#b0c4b4] transition-colors px-3 py-2.5 min-h-[44px] flex items-center"
              >
                Try Free
              </button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Log In
              </Button>
              <Button size="sm" onClick={() => navigate('/signup')}>
                Sign Up
              </Button>
            </>
          )}
        </div>
      </nav>

      <HeroSection onGetStarted={handleGetStarted} strainCount={strainCount} />
      <FeaturesSection />
      <DemoSection />
      <HowItWorksSection />
      <AIChatSection />
      <CTASection onGetStarted={handleGetStarted} />

      {/* Platform Identity & Disclaimer */}
      <div className="max-w-2xl mx-auto px-6 pt-6 pb-2 text-center">
        <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] p-4 mb-4">
          <p className="text-[11px] font-bold text-gray-500 dark:text-[#6a7a6e] uppercase tracking-wider mb-2">Important Notice</p>
          <p className="text-[11px] text-gray-500 dark:text-[#5a6a5e] leading-relaxed">
            <strong className="text-gray-600 dark:text-[#8a9a8e]">MyStrainAI is an informational and educational software platform only.</strong> We are <strong className="text-gray-600 dark:text-[#8a9a8e]">not</strong> a cannabis retailer, dispensary, distributor, or medical provider. We do not sell, deliver, prescribe, or facilitate the sale of any cannabis products. All recommendations are AI-generated based on community-sourced data and may contain inaccuracies.
          </p>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] leading-relaxed mb-3">
          <strong className="text-gray-500 dark:text-[#5a6a5e]">Medical Disclaimer:</strong> MyStrainAI does not provide medical advice, diagnoses, or treatment recommendations. No information on this site should be interpreted as a claim that any cannabis product can treat, cure, prevent, or diagnose any disease or medical condition. Individual experiences vary widely. Always consult a qualified healthcare professional before using cannabis, especially if you are pregnant or nursing, have a mental health condition, take prescription medications, or have a history of substance use disorder.
        </p>
        <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] leading-relaxed mb-3">
          <strong className="text-gray-500 dark:text-[#5a6a5e]">Health Warnings:</strong> Cannabis may impair cognitive and motor function. Do not drive or operate machinery while under the influence. Cannabis use during pregnancy or breastfeeding may harm fetal or infant development. Individuals with a personal or family history of psychosis, schizophrenia, or other mental health conditions should use extreme caution. Cannabis use carries a risk of dependence and may interact with medications.
        </p>
        <p className="text-[10px] text-gray-400 dark:text-[#5a6a5e] leading-relaxed">
          <strong className="text-gray-500 dark:text-[#5a6a5e]">Legal Notice:</strong> Cannabis remains a Schedule I substance under federal law. Legality varies by jurisdiction &mdash; you are solely responsible for knowing and complying with all applicable local, state, and federal laws. Must be 21+ to use this site. By using MyStrainAI you agree to our <a href="/terms" className="underline hover:text-gray-600 dark:hover:text-[#6a7a6e]">Terms of Service</a> and <a href="/privacy" className="underline hover:text-gray-600 dark:hover:text-[#6a7a6e]">Privacy Policy</a>.
        </p>
      </div>

      {/* Footer */}
      <footer className="text-center py-8 pb-24 sm:pb-8 border-t border-gray-200/60 dark:border-white/[0.05]">
        <div className="flex items-center justify-center gap-4 text-[11px] text-gray-400 dark:text-[#6a7a6e]">
          <NavLink to="/terms" className="hover:text-gray-600 dark:hover:text-[#6a7a6e] transition-colors py-2 px-1">Terms</NavLink>
          <span>&middot;</span>
          <NavLink to="/privacy" className="hover:text-gray-600 dark:hover:text-[#6a7a6e] transition-colors py-2 px-1">Privacy</NavLink>
          <span>&middot;</span>
          <span>MyStrainAI &copy; {new Date().getFullYear()}</span>
        </div>
      </footer>

      {/* Mobile bottom tab bar (same as AppShell) */}
      <div className="sm:hidden">
        <NavBar />
      </div>

      {/* Floating AI Chat widget — bottom-right FAB */}
      <ChatWidget />

    </div>
  )
}
