import { useEffect, useRef, useCallback } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import {
  FlaskConical, Fingerprint, BookMarked, ArrowRight, Sparkles,
  Search, Zap, BarChart3, ChevronRight, Star, Lock, Check,
} from 'lucide-react'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
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
/*  Section 1: Hero                                                   */
/* ------------------------------------------------------------------ */
function HeroSection({ onGetStarted }) {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      {/* Animated BG orbs */}
      <div className="absolute w-[700px] h-[700px] rounded-full animate-float-a opacity-60" style={{ background: 'radial-gradient(circle, rgba(50,200,100,0.12) 0%, transparent 70%)', top: '-15%', left: '-15%' }} />
      <div className="absolute w-[500px] h-[500px] rounded-full animate-float-b opacity-60" style={{ background: 'radial-gradient(circle, rgba(147,80,255,0.08) 0%, transparent 70%)', bottom: '-10%', right: '-10%' }} />
      <div className="absolute w-[300px] h-[300px] rounded-full animate-pulse-glow" style={{ background: 'radial-gradient(circle, rgba(50,200,100,0.06) 0%, transparent 70%)', top: '40%', right: '20%' }} />

      <div className="relative z-10 max-w-2xl animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-leaf-500/10 border border-leaf-500/20 mb-8">
          <Sparkles size={14} className="text-leaf-400" />
          <span className="text-xs font-medium text-leaf-400">Powered by receptor science</span>
        </div>

        <h1
          className="text-4xl sm:text-6xl font-extrabold mb-6 text-gray-900 dark:text-[#e8f0ea] leading-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Cannabis science,{' '}
          <span className="bg-gradient-to-r from-leaf-400 to-leaf-500 bg-clip-text text-transparent">
            personalized.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-500 dark:text-[#8a9a8e] mb-10 max-w-lg mx-auto leading-relaxed">
          Find your perfect strain based on molecular pathways, terpene profiles, and real community data.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
          <Button size="lg" className="shadow-xl shadow-leaf-500/25" onClick={onGetStarted}>
            Find My Strain
            <ArrowRight size={18} />
          </Button>
          <Button variant="ghost" size="lg" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
            See How It Works
          </Button>
        </div>

        <div className="flex items-center justify-center gap-6 mt-12 text-sm text-gray-400 dark:text-[#5a6a5e]">
          <span className="flex items-center gap-1.5"><FlaskConical size={14} /> 77 Strains</span>
          <span className="flex items-center gap-1.5"><Zap size={14} /> 51 Effects</span>
          <span className="flex items-center gap-1.5"><BarChart3 size={14} /> 6 Receptors</span>
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
      desc: 'Our matching engine scores strains across 6 receptor pathways — CB1, CB2, TRPV1, 5-HT1A, and more — using real binding affinity data.',
      color: 'text-leaf-400 bg-leaf-500/10',
    },
    {
      icon: Fingerprint,
      title: 'Personalized Matching',
      desc: 'A 5-layer algorithm weighs your desired effects, tolerance, budget, and preferences to find your ideal strain match.',
      color: 'text-purple-400 bg-purple-500/10',
    },
    {
      icon: BookMarked,
      title: 'Track & Learn',
      desc: 'Log your experiences in a personal journal, compare strains side-by-side, and learn the science behind every recommendation.',
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
          Every recommendation is backed by pharmacology data, not just vibes.
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
/*  Section 3: Demo strain card                                       */
/* ------------------------------------------------------------------ */
function DemoSection() {
  const ref = useScrollReveal()
  return (
    <section className="py-24 px-6 overflow-hidden" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl font-bold text-center text-gray-900 dark:text-[#e8f0ea] mb-4"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Every strain, decoded
        </h2>
        <p className="text-center text-gray-500 dark:text-[#6a7a6e] mb-12 max-w-lg mx-auto">
          See exactly what you're getting — cannabinoids, terpenes, predicted effects, and community reviews.
        </p>

        <div className="max-w-md mx-auto" style={{ perspective: '1200px' }}>
          <Card
            className="p-4"
            style={{ transform: 'rotateY(-2deg) rotateX(1deg)', transition: 'transform 0.6s ease' }}
          >
            {/* Mock strain header */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className="text-lg font-bold text-gray-900 dark:text-white"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Blue Dream
                  </h3>
                  <TypeBadge type="hybrid" />
                </div>
                <p className="text-[11px] italic text-gray-400 dark:text-[#6a7a6e] mt-0.5">Blueberry x Haze</p>
                <p className="text-[11px] text-gray-500 dark:text-[#8a9a8e] mt-1 line-clamp-1">
                  A balanced hybrid known for gentle euphoria and full-body relaxation
                </p>
              </div>
              <div className="flex items-center justify-center min-w-[48px] h-10 rounded-xl text-sm font-bold border" style={{ backgroundColor: '#32c86418', borderColor: '#32c86444', color: '#32c864' }}>
                94%
              </div>
            </div>

            {/* Best For + Effects */}
            <div className="flex flex-wrap gap-1 mb-3">
              {['Relaxation', 'Creativity'].map(t => (
                <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-leaf-500/12 text-leaf-500 dark:text-leaf-400 border border-leaf-500/20">{t}</span>
              ))}
              {['Euphoric', 'Uplifted', 'Happy'].map(e => (
                <EffectBadge key={e} effect={e} variant="positive" />
              ))}
            </div>

            {/* Cannabinoid mini */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-3">
              <ProgressBar label="THC" value={21} max={35} color="#32c864" height={4} />
              <ProgressBar label="CBD" value={2} max={20} color="#3b82f6" height={4} />
              <ProgressBar label="CBN" value={0.3} max={20} color="#a855f7" height={4} />
              <ProgressBar label="CBG" value={1.1} max={20} color="#f59e0b" height={4} />
            </div>

            {/* Terpenes + sentiment */}
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

            {/* Fake expand indicator */}
            <div className="flex items-center justify-center gap-1 mt-3 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
              <ChevronRight size={14} className="text-leaf-400" />
              <span className="text-[10px] text-gray-400 dark:text-[#6a7a6e]">Tap to explore full profile</span>
            </div>
          </Card>
        </div>
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
    { num: '02', title: 'Get Matched', desc: 'Our 5-layer algorithm scores every strain across molecular pathways, terpene profiles, and community data.', icon: Zap },
    { num: '03', title: 'Explore the Science', desc: 'Dive into cannabinoid charts, receptor maps, predicted effects, and real user reviews for every match.', icon: FlaskConical },
  ]

  return (
    <section className="py-24 px-6 bg-leaf-500/[0.03]" ref={ref}>
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
/*  Section 5: Pricing                                                */
/* ------------------------------------------------------------------ */
function PricingSection({ onGetStarted }) {
  const ref = useScrollReveal()

  const free = ['2 strain recommendations per quiz', 'Basic cannabinoid profiles', 'Community reviews']
  const premium = ['Unlimited recommendations', 'Full receptor science & pathways', 'Terpene radar & molecular maps', 'Personal journal & compare tool', 'AI strain analysis', 'Priority support']

  return (
    <section className="py-24 px-6" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl font-bold text-center text-gray-900 dark:text-[#e8f0ea] mb-4"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Simple pricing
        </h2>
        <p className="text-center text-gray-500 dark:text-[#6a7a6e] mb-12">
          Start free, upgrade when you're ready.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Free tier */}
          <Card className="p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">Free</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">$0<span className="text-sm font-normal text-gray-400">/mo</span></p>
            <p className="text-xs text-gray-400 dark:text-[#6a7a6e] mb-6">Get started, no credit card needed</p>
            <ul className="space-y-3 mb-8">
              {free.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-[#8a9a8e]">
                  <Check size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="full" onClick={onGetStarted}>
              Get Started Free
            </Button>
          </Card>

          {/* Premium tier */}
          <Card active className="p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-leaf-500 text-leaf-900 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Popular
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">Premium</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">$9.99<span className="text-sm font-normal text-gray-400">/mo</span></p>
            <p className="text-xs text-gray-400 dark:text-[#6a7a6e] mb-6">Full access to every feature</p>
            <ul className="space-y-3 mb-8">
              {premium.map(p => (
                <li key={p} className="flex items-start gap-2 text-sm text-gray-600 dark:text-[#8a9a8e]">
                  <Check size={16} className="text-leaf-400 flex-shrink-0 mt-0.5" />
                  {p}
                </li>
              ))}
            </ul>
            <Button size="full" className="shadow-lg shadow-leaf-500/25" onClick={onGetStarted}>
              Start Premium
              <Sparkles size={16} />
            </Button>
          </Card>
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
          Join thousands making smarter cannabis choices with real science.
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
  const navigate = useNavigate()

  const handleGetStarted = useCallback(() => {
    navigate('/signup')
  }, [navigate])

  return (
    <div className="min-h-screen relative bg-white dark:bg-[#0a0f0c]">
      {/* Sticky nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-white/80 dark:bg-[#0a0f0c]/80 backdrop-blur-md border-b border-gray-200/50 dark:border-white/[0.04]">
        <NavLink to="/" className="flex items-center gap-2 text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
          <span className="text-2xl">{'\u{1F33F}'}</span>
          <span className="bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent">Cannalchemy</span>
        </NavLink>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
            Log In
          </Button>
          <Button size="sm" onClick={() => navigate('/signup')}>
            Sign Up
          </Button>
        </div>
      </nav>

      <HeroSection onGetStarted={handleGetStarted} />
      <FeaturesSection />
      <DemoSection />
      <HowItWorksSection />
      <PricingSection onGetStarted={handleGetStarted} />
      <CTASection onGetStarted={handleGetStarted} />

      {/* Footer */}
      <footer className="text-center py-8 border-t border-gray-200/50 dark:border-white/[0.04]">
        <p className="text-[11px] text-gray-400 dark:text-[#2a352c]">
          Cannalchemy &middot; AI-Powered Cannabis Science &middot; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}
