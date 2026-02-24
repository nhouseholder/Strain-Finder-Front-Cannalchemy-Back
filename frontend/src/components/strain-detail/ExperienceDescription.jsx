import { useMemo } from 'react'
import { Wind } from 'lucide-react'
import { generateExperienceDescription } from '../../utils/strainExperience'

export default function ExperienceDescription({ strain }) {
  const description = useMemo(
    () => generateExperienceDescription(strain),
    [strain]
  )

  if (!description) return null

  return (
    <div className="rounded-xl border border-purple-500/15 bg-purple-500/[0.04] p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Wind size={16} className="text-purple-400" />
        </div>
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5">
            The Experience
          </h4>
          <p className="text-xs leading-relaxed text-gray-600 dark:text-[#b0c4b4] italic">
            {description}
          </p>
          <p className="text-[8px] text-gray-400 dark:text-[#3a4a3e] mt-2 not-italic">
            Based on community reports. Individual experiences vary. Not medical advice.
          </p>
        </div>
      </div>
    </div>
  )
}
