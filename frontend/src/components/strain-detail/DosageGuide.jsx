import { Pill, Clock, Timer, AlertTriangle } from 'lucide-react'

const DOSAGE_DATA = {
  flower: {
    beginner: {
      dose: '1 small hit',
      onset: '1-5 minutes',
      duration: '1-3 hours',
      redose: '10-15 minutes',
      note: 'Inhale lightly and hold briefly. Start with a single small puff.',
    },
    intermediate: {
      dose: '2-3 hits',
      onset: '1-5 minutes',
      duration: '1-3 hours',
      redose: '10-15 minutes',
      note: 'Take a few steady draws. Gauge effects before continuing.',
    },
    experienced: {
      dose: '3-5 hits',
      onset: '1-5 minutes',
      duration: '2-4 hours',
      redose: '5-10 minutes',
      note: 'Adjust to preference. Effects are well understood at this level.',
    },
    high: {
      dose: '5+ hits or full bowl',
      onset: '1-5 minutes',
      duration: '2-4 hours',
      redose: 'As desired',
      note: 'Consume to preference. High tolerance allows for larger sessions.',
    },
  },
  vape: {
    beginner: {
      dose: '1-2 second draw',
      onset: '30 seconds - 3 minutes',
      duration: '1-2 hours',
      redose: '10-15 minutes',
      note: 'Vapes deliver concentrated vapor. Start with a very short draw.',
    },
    intermediate: {
      dose: '2-3 second draw, 2-3 draws',
      onset: '30 seconds - 3 minutes',
      duration: '1-3 hours',
      redose: '10-15 minutes',
      note: 'Take a moderate draw and wait before taking more.',
    },
    experienced: {
      dose: '3-5 second draws, 3-5 draws',
      onset: '30 seconds - 3 minutes',
      duration: '2-3 hours',
      redose: '5-10 minutes',
      note: 'Comfortable with higher intake. Adjust temperature and draw length.',
    },
    high: {
      dose: 'Extended draws to preference',
      onset: '30 seconds - 3 minutes',
      duration: '2-3 hours',
      redose: 'As desired',
      note: 'Full sessions. Consider using lower temperature for flavor.',
    },
  },
  edibles: {
    beginner: {
      dose: '2.5-5mg THC',
      onset: '30-90 minutes',
      duration: '4-8 hours',
      redose: '90+ minutes',
      note: 'Edibles are much stronger and longer-lasting. Start very low. Wait at least 90 minutes before considering more.',
    },
    intermediate: {
      dose: '5-15mg THC',
      onset: '30-90 minutes',
      duration: '4-8 hours',
      redose: '60-90 minutes',
      note: 'Moderate dose. Still allow ample time for onset before re-dosing.',
    },
    experienced: {
      dose: '15-30mg THC',
      onset: '30-90 minutes',
      duration: '4-10 hours',
      redose: '60 minutes',
      note: 'Higher dose range. Understand your limits and plan accordingly.',
    },
    high: {
      dose: '30-50mg+ THC',
      onset: '30-90 minutes',
      duration: '6-12 hours',
      redose: '60 minutes',
      note: 'Very high dose. Long-lasting effects. Plan your schedule accordingly.',
    },
  },
  concentrates: {
    beginner: {
      dose: 'Rice grain-sized dab',
      onset: 'Seconds - 2 minutes',
      duration: '1-3 hours',
      redose: '15-20 minutes',
      note: 'Concentrates are extremely potent (60-90% THC). Start with the smallest amount possible.',
    },
    intermediate: {
      dose: 'Small dab (~25mg)',
      onset: 'Seconds - 2 minutes',
      duration: '1-3 hours',
      redose: '10-15 minutes',
      note: 'Moderate dab size. Use low-temp for smoother experience.',
    },
    experienced: {
      dose: 'Medium dab (~50mg)',
      onset: 'Seconds - 2 minutes',
      duration: '2-4 hours',
      redose: '10 minutes',
      note: 'Standard dose for experienced consumers. Adjust temperature to preference.',
    },
    high: {
      dose: 'Large dab to preference',
      onset: 'Seconds - 2 minutes',
      duration: '2-4 hours',
      redose: 'As desired',
      note: 'Full-size dabs. High tolerance allows for larger amounts.',
    },
  },
  tinctures: {
    beginner: {
      dose: '2.5-5mg THC (few drops)',
      onset: '15-45 minutes (sublingual)',
      duration: '4-6 hours',
      redose: '45-60 minutes',
      note: 'Place drops under tongue and hold for 30 seconds. Effects are felt faster than edibles.',
    },
    intermediate: {
      dose: '5-15mg THC',
      onset: '15-45 minutes (sublingual)',
      duration: '4-6 hours',
      redose: '30-45 minutes',
      note: 'Sublingual absorption is faster than swallowing. Adjust dose gradually.',
    },
    experienced: {
      dose: '15-30mg THC',
      onset: '15-45 minutes (sublingual)',
      duration: '4-8 hours',
      redose: '30 minutes',
      note: 'Consistent dosing is easy with tinctures. Fine-tune your amount.',
    },
    high: {
      dose: '30-50mg+ THC',
      onset: '15-45 minutes (sublingual)',
      duration: '4-8 hours',
      redose: '30 minutes',
      note: 'Higher doses for experienced consumers. Consider splitting into multiple administrations.',
    },
  },
  topicals: {
    beginner: {
      dose: 'Thin layer on affected area',
      onset: '15-45 minutes',
      duration: '2-4 hours',
      redose: 'As needed',
      note: 'Topicals do not produce psychoactive effects. Apply to skin as needed for localized relief.',
    },
    intermediate: {
      dose: 'Generous application',
      onset: '15-45 minutes',
      duration: '2-4 hours',
      redose: 'As needed',
      note: 'Reapply as needed. Non-psychoactive so dosing is more flexible.',
    },
    experienced: {
      dose: 'Generous application',
      onset: '15-45 minutes',
      duration: '2-4 hours',
      redose: 'As needed',
      note: 'Apply liberally. Consider transdermal patches for longer relief.',
    },
    high: {
      dose: 'Generous application',
      onset: '15-45 minutes',
      duration: '2-4 hours',
      redose: 'As needed',
      note: 'Apply liberally. Topicals work regardless of tolerance level.',
    },
  },
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-gray-100 dark:border-white/[0.04] last:border-0">
      <Icon size={13} className="text-leaf-400 mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-[#6a7a6e]">
          {label}
        </div>
        <div className="text-xs text-gray-700 dark:text-[#b0c4b4] mt-0.5">
          {value}
        </div>
      </div>
    </div>
  )
}

export default function DosageGuide({ strain, tolerance, method }) {
  const tol = tolerance || 'beginner'
  const meth = method || 'flower'

  const data = DOSAGE_DATA[meth]?.[tol] || DOSAGE_DATA.flower.beginner

  const thcLevel = strain?.thc
  const isHighTHC = thcLevel != null && thcLevel >= 25

  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e] mb-3 flex items-center gap-1.5">
        <Pill size={12} className="text-leaf-400" />
        Dosage Guide
      </h4>

      <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] p-3">
        {/* Method + Tolerance header */}
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-white/[0.06]">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-leaf-500/10 text-leaf-400 border border-leaf-500/20 capitalize">
            {meth}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize">
            {tol}
          </span>
          {thcLevel != null && (
            <span className="text-[10px] text-gray-500 dark:text-[#6a7a6e]">
              {thcLevel}% THC
            </span>
          )}
        </div>

        <div className="space-y-0">
          <InfoRow icon={Pill} label="Recommended Dose" value={data.dose} />
          <InfoRow icon={Clock} label="Expected Onset" value={data.onset} />
          <InfoRow icon={Timer} label="Duration" value={data.duration} />
          <InfoRow icon={Clock} label="Wait Before Re-dosing" value={data.redose} />
        </div>

        {/* Note */}
        <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-[#8a9a8e] italic">
          {data.note}
        </p>

        {/* High THC Warning */}
        {isHighTHC && tol === 'beginner' && (
          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300 leading-relaxed">
              This strain has high THC ({thcLevel}%). As a beginner, consider starting with an
              even smaller dose than recommended and waiting the full onset time before consuming more.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
