import { memo, useMemo } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Hexagon } from 'lucide-react'
import { getTypeColor, getTerpeneColor } from '../../utils/colors'

function CustomAxisTick({ payload, x, y, cx, cy }) {
  const dx = x - cx
  const dy = y - cy
  const textAnchor = dx > 5 ? 'start' : dx < -5 ? 'end' : 'middle'
  const offsetY = dy > 5 ? 12 : dy < -5 ? -4 : 4

  return (
    <text
      x={x}
      y={y + offsetY}
      textAnchor={textAnchor}
      className="fill-gray-600 dark:fill-[#8a9a8e] text-[10px] font-medium"
    >
      {payload.value}
    </text>
  )
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0].payload
  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a2420] px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-gray-700 dark:text-[#c0d4c6]">{name}</p>
      <p className="text-[10px] text-gray-500 dark:text-[#8a9a8e]">{value}%</p>
    </div>
  )
}

export default memo(function TerpeneRadar({ terpenes, strainType = 'hybrid' }) {
  const { data, maxVal } = useMemo(() => {
    if (!terpenes?.length) return { data: [], maxVal: 0 }

    const items = terpenes.slice(0, 6).map((t) => ({
      name: typeof t === 'string' ? t : t.name,
      value: parseFloat(String(t.pct || t.value || 0).replace('%', '')) || 0,
    }))

    const mv = Math.max(...items.map((d) => d.value), 0.01)
    const normalized = items.map((d) => ({
      ...d,
      normalized: Math.round((d.value / mv) * 100),
    }))

    return { data: normalized, maxVal: mv }
  }, [terpenes])

  if (data.length < 3) return null

  const typeColor = getTypeColor(strainType)?.hex || '#32c864'

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-leaf-500/10 flex items-center justify-center">
          <Hexagon size={14} className="text-leaf-400" />
        </div>
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#8a9a8e]">
          Terpene Profile
        </h4>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <RadarChart cx="50%" cy="50%" outerRadius="60%" data={data}>
          <PolarGrid
            stroke="currentColor"
            className="text-gray-200 dark:text-white/10"
          />
          <PolarAngleAxis
            dataKey="name"
            tick={<CustomAxisTick />}
          />
          <Radar
            dataKey="normalized"
            stroke={typeColor}
            fill={typeColor}
            fillOpacity={0.15}
            strokeWidth={2}
            dot={{ r: 3, fill: typeColor, strokeWidth: 0 }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>

      {/* Terpene legend with actual values */}
      <div className="flex flex-wrap gap-2 justify-center mt-1">
        {data.map((t) => (
          <div
            key={t.name}
            className="flex items-center gap-1 text-[9px] text-gray-500 dark:text-[#6a7a6e]"
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getTerpeneColor(t.name) }}
            />
            <span>{t.name}</span>
            <span className="font-semibold">{t.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
})
