import { GitBranch } from 'lucide-react'

const NODE_W = 120
const NODE_H = 32
const PADDING = 16

function StrainNode({ x, y, name, onClick }) {
  return (
    <g
      className="cursor-pointer"
      onClick={() => {
        onClick?.(name)
      }}
    >
      <rect
        x={x - NODE_W / 2}
        y={y - NODE_H / 2}
        width={NODE_W}
        height={NODE_H}
        rx={12}
        ry={12}
        fill="rgba(50, 200, 100, 0.12)"
        stroke="rgba(50, 200, 100, 0.35)"
        strokeWidth={1}
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#b0c4b4"
        fontSize={10}
        fontWeight={500}
        className="pointer-events-none select-none"
      >
        {name?.length > 16 ? name.slice(0, 15) + '\u2026' : name}
      </text>
    </g>
  )
}

function CurvedLine({ x1, y1, x2, y2 }) {
  const midY = (y1 + y2) / 2
  const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`

  return (
    <path
      d={d}
      fill="none"
      stroke="rgba(50, 200, 100, 0.2)"
      strokeWidth={1.5}
    />
  )
}

export default function LineageTree({ lineage, onNodeClick }) {
  if (!lineage?.self) return null

  const parents = lineage.parents || []
  const grandparents = lineage.grandparents || {}

  const hasParents = parents.length > 0
  const gpEntries = Object.entries(grandparents)
  const hasGrandparents = gpEntries.length > 0 && gpEntries.some(([, gps]) => gps?.length > 0)

  // Calculate layout
  const rows = hasGrandparents ? 3 : hasParents ? 2 : 1
  const totalHeight = rows * 56 + (rows - 1) * 20 + PADDING * 2

  // Gather all grandparent nodes to determine width
  const gpNodes = []
  if (hasGrandparents) {
    parents.forEach((parent) => {
      const gps = grandparents[parent] || []
      gps.forEach((gp) => gpNodes.push({ name: gp, parentName: parent }))
    })
  }

  const topRowCount = Math.max(gpNodes.length, 1)
  const midRowCount = Math.max(parents.length, 1)
  const maxCols = Math.max(topRowCount, midRowCount, 1)
  const totalWidth = Math.max(maxCols * (NODE_W + 16) + PADDING * 2, 320)

  const centerX = totalWidth / 2

  // Y positions
  const selfY = totalHeight - PADDING - NODE_H / 2
  const parentY = hasGrandparents
    ? PADDING + 56 + 20 + NODE_H / 2
    : hasParents
      ? PADDING + NODE_H / 2
      : selfY
  const gpY = PADDING + NODE_H / 2

  // Parent X positions
  const parentPositions = parents.map((name, i) => {
    const totalSpan = (parents.length - 1) * (NODE_W + 24)
    const startX = centerX - totalSpan / 2
    return { name, x: parents.length === 1 ? centerX : startX + i * (NODE_W + 24) }
  })

  // Grandparent X positions
  const gpPositions = gpNodes.map((gp, i) => {
    const totalSpan = (gpNodes.length - 1) * (NODE_W + 12)
    const startX = centerX - totalSpan / 2
    return { ...gp, x: gpNodes.length === 1 ? centerX : startX + i * (NODE_W + 12) }
  })

  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6a7a6e] mb-3 flex items-center gap-1.5">
        <GitBranch size={12} className="text-leaf-400" />
        Lineage
      </h4>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="w-full"
          style={{ minHeight: `${Math.max(totalHeight, 200)}px` }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Lines from self to parents */}
          {parentPositions.map((p) => (
            <CurvedLine
              key={`self-${p.name}`}
              x1={centerX}
              y1={selfY - NODE_H / 2}
              x2={p.x}
              y2={parentY + NODE_H / 2}
            />
          ))}

          {/* Lines from parents to grandparents */}
          {gpPositions.map((gp) => {
            const parent = parentPositions.find((p) => p.name === gp.parentName)
            if (!parent) return null
            return (
              <CurvedLine
                key={`${gp.parentName}-${gp.name}`}
                x1={parent.x}
                y1={parentY - NODE_H / 2}
                x2={gp.x}
                y2={gpY + NODE_H / 2}
              />
            )
          })}

          {/* Grandparent nodes */}
          {gpPositions.map((gp, i) => (
            <StrainNode
              key={`gp-${gp.parentName}-${gp.name}-${i}`}
              x={gp.x}
              y={gpY}
              name={gp.name}
              onClick={onNodeClick}
            />
          ))}

          {/* Parent nodes */}
          {parentPositions.map((p) => (
            <StrainNode
              key={`parent-${p.name}`}
              x={p.x}
              y={parentY}
              name={p.name}
              onClick={onNodeClick}
            />
          ))}

          {/* Self node (highlighted) */}
          <g>
            <rect
              x={centerX - NODE_W / 2}
              y={selfY - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx={12}
              ry={12}
              fill="rgba(50, 200, 100, 0.22)"
              stroke="rgba(50, 200, 100, 0.55)"
              strokeWidth={1.5}
            />
            <text
              x={centerX}
              y={selfY + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#32c864"
              fontSize={11}
              fontWeight={700}
              className="pointer-events-none select-none"
            >
              {lineage.self?.length > 16
                ? lineage.self.slice(0, 15) + '\u2026'
                : lineage.self}
            </text>
          </g>
        </svg>
      </div>
    </div>
  )
}
