import { getTerpeneColor } from '../../utils/colors'
import ChemTooltip from './ChemTooltip'

export default function TerpBadge({ name, pct, color }) {
  const c = color || getTerpeneColor(name)

  return (
    <ChemTooltip name={name}>
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap border"
        style={{
          backgroundColor: `${c}18`,
          borderColor: `${c}44`,
          color: c,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
        {name} {pct}
      </span>
    </ChemTooltip>
  )
}
