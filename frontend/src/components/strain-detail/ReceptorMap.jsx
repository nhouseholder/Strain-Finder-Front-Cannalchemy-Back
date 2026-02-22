import { useMemo, useState, useRef, useEffect } from 'react'
import { Network } from 'lucide-react'
import { getReceptorColor, RECEPTOR_COLORS } from '../../utils/colors'

/**
 * PathwayGraph — Interactive 2D force-layout molecular pathway visualization.
 *
 * Renders a Cannalchemy-style graph showing:
 *   Molecule nodes → Receptor nodes → Effect nodes
 * with animated links colored by receptor type.
 *
 * Uses a simple spring-force simulation (no D3 dependency).
 */

const NODE_TYPES = {
  molecule: {
    radius: 20,
    fill: (_, dark) => dark ? 'rgba(100,140,120,0.15)' : 'rgba(60,120,80,0.08)',
    stroke: (_, dark) => dark ? 'rgba(140,180,160,0.4)' : 'rgba(60,120,80,0.3)',
    textFill: (_, dark) => dark ? '#c0d4c6' : '#374151',
    label: 'Compound',
  },
  receptor: {
    radius: 22,
    fill: (name) => `${getReceptorColor(name)}22`,
    stroke: (name) => getReceptorColor(name),
    textFill: (name) => getReceptorColor(name),
    label: 'Receptor',
  },
  effect: {
    radius: 18,
    fill: (_, dark) => dark ? 'rgba(50,200,100,0.12)' : 'rgba(50,200,100,0.08)',
    stroke: (_, dark) => dark ? 'rgba(50,200,100,0.45)' : 'rgba(50,200,100,0.35)',
    textFill: (_, dark) => dark ? '#6ee7a0' : '#16a34a',
    label: 'Effect',
  },
}

function simpleForceLayout(nodes, links, width, height) {
  // Place nodes in 3 columns: molecules left, receptors center, effects right
  const byType = { molecule: [], receptor: [], effect: [] }
  nodes.forEach((n) => byType[n.type]?.push(n))

  const colX = { molecule: width * 0.18, receptor: width * 0.5, effect: width * 0.82 }
  const colSpacing = { molecule: 52, receptor: 48, effect: 44 }

  Object.entries(byType).forEach(([type, group]) => {
    const totalH = (group.length - 1) * colSpacing[type]
    const startY = height / 2 - totalH / 2
    group.forEach((n, i) => {
      n.x = colX[type] + (Math.sin(i * 1.5) * 8)
      n.y = startY + i * colSpacing[type]
    })
  })

  // Simple spring iterations for organic feel
  for (let iter = 0; iter < 30; iter++) {
    // Repulsion between same-type nodes
    Object.values(byType).forEach((group) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const dy = group[j].y - group[i].y
          const dist = Math.max(Math.abs(dy), 1)
          if (dist < 40) {
            const force = (40 - dist) * 0.1
            group[i].y -= force
            group[j].y += force
          }
        }
      }
    })

    // Pull linked nodes closer vertically
    links.forEach((l) => {
      const a = nodes.find((n) => n.id === l.source)
      const b = nodes.find((n) => n.id === l.target)
      if (a && b) {
        const dy = b.y - a.y
        a.y += dy * 0.02
        b.y -= dy * 0.02
      }
    })
  }

  // Clamp positions
  nodes.forEach((n) => {
    n.y = Math.max(24, Math.min(height - 24, n.y))
  })

  return nodes
}

function GraphNode({ node, dark, onHover, isHovered, connections }) {
  const config = NODE_TYPES[node.type]
  if (!config) return null

  const r = config.radius + (isHovered ? 4 : 0)
  const opacity = connections === false ? 0.25 : 1

  return (
    <g
      style={{ opacity, transition: 'opacity 0.2s' }}
      onMouseEnter={() => onHover?.(node.id)}
      onMouseLeave={() => onHover?.(null)}
      className="cursor-pointer"
    >
      {/* Glow */}
      {isHovered && (
        <circle
          cx={node.x}
          cy={node.y}
          r={r + 6}
          fill={config.stroke(node.label, dark)}
          opacity={0.12}
        />
      )}
      {/* Node circle */}
      <circle
        cx={node.x}
        cy={node.y}
        r={r}
        fill={config.fill(node.label, dark)}
        stroke={config.stroke(node.label, dark)}
        strokeWidth={isHovered ? 2 : 1.2}
      />
      {/* Label */}
      <text
        x={node.x}
        y={node.y - (node.subtitle ? 4 : 0)}
        textAnchor="middle"
        dominantBaseline="central"
        fill={config.textFill(node.label, dark)}
        fontSize={node.label.length > 10 ? 7 : 8}
        fontWeight={600}
        className="pointer-events-none select-none"
      >
        {node.label.length > 12 ? node.label.slice(0, 11) + '\u2026' : node.label}
      </text>
      {/* Subtitle (percentage or probability) */}
      {node.subtitle && (
        <text
          x={node.x}
          y={node.y + 9}
          textAnchor="middle"
          dominantBaseline="central"
          fill={dark ? '#6a7a6e' : '#9ca3af'}
          fontSize={6}
          className="pointer-events-none select-none"
        >
          {node.subtitle}
        </text>
      )}
    </g>
  )
}

function GraphLink({ x1, y1, x2, y2, color, highlighted, dimmed }) {
  const midX = (x1 + x2) / 2
  const curve = (y2 - y1) * 0.15
  const d = `M ${x1} ${y1} Q ${midX} ${y1 + curve} ${midX} ${(y1 + y2) / 2} T ${x2} ${y2}`

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={highlighted ? 2 : 1.2}
      strokeOpacity={dimmed ? 0.08 : highlighted ? 0.7 : 0.25}
      style={{ transition: 'stroke-opacity 0.2s, stroke-width 0.2s' }}
    />
  )
}

export default function ReceptorMap({ pathways, effectPredictions }) {
  const [hoveredNode, setHoveredNode] = useState(null)
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')

  const { nodes, links, width, height } = useMemo(() => {
    if (!pathways?.length) return { nodes: [], links: [], width: 0, height: 0 }

    const nodeMap = new Map()
    const linkList = []
    const seen = new Set()

    // Molecule + receptor nodes from pathways
    for (const p of pathways) {
      const molId = `mol:${p.molecule}`
      const recId = `rec:${p.receptor}`
      if (!nodeMap.has(molId)) {
        nodeMap.set(molId, {
          id: molId, type: 'molecule', label: p.molecule.charAt(0).toUpperCase() + p.molecule.slice(1),
          subtitle: p.ki_nm ? `Ki: ${p.ki_nm}nM` : '',
          x: 0, y: 0,
        })
      }
      if (!nodeMap.has(recId)) {
        nodeMap.set(recId, {
          id: recId, type: 'receptor', label: p.receptor,
          subtitle: (p.action_type || 'modulator').replace('partial ', ''),
          x: 0, y: 0,
        })
      }
      const lk = `${molId}-${recId}`
      if (!seen.has(lk)) {
        seen.add(lk)
        linkList.push({ source: molId, target: recId, receptor: p.receptor })
      }
    }

    // Effect nodes from predictions
    if (effectPredictions?.length) {
      for (const ep of effectPredictions.slice(0, 5)) {
        const name = ep.effect.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        const effId = `eff:${name}`
        if (!nodeMap.has(effId)) {
          nodeMap.set(effId, {
            id: effId, type: 'effect', label: name,
            subtitle: `${Math.round((ep.probability || 0) * 100)}% likely`,
            x: 0, y: 0,
          })
        }
        // Link receptors to this effect
        if (ep.pathway) {
          for (const rec of ep.pathway.split(',').map((s) => s.trim())) {
            const recId = `rec:${rec}`
            if (nodeMap.has(recId)) {
              const lk = `${recId}-${effId}`
              if (!seen.has(lk)) {
                seen.add(lk)
                linkList.push({ source: recId, target: effId, receptor: rec })
              }
            }
          }
        }
      }
    }

    const allNodes = [...nodeMap.values()]
    const maxCol = Math.max(
      allNodes.filter((n) => n.type === 'molecule').length,
      allNodes.filter((n) => n.type === 'receptor').length,
      allNodes.filter((n) => n.type === 'effect').length,
    )
    const h = Math.max(maxCol * 52 + 40, 200)
    const w = 380

    simpleForceLayout(allNodes, linkList, w, h)

    return { nodes: allNodes, links: linkList, width: w, height: h }
  }, [pathways, effectPredictions])

  if (!nodes.length) return null

  // Determine which nodes/links are connected to hovered node
  const connectedIds = useMemo(() => {
    if (!hoveredNode) return null
    const ids = new Set([hoveredNode])
    links.forEach((l) => {
      if (l.source === hoveredNode || l.target === hoveredNode) {
        ids.add(l.source)
        ids.add(l.target)
      }
    })
    return ids
  }, [hoveredNode, links])

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
            <Network size={14} className="text-blue-400" />
          </div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#8a9a8e]">
            Molecular Pathway Graph
          </h4>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-2">
          {['molecule', 'receptor', 'effect'].map((type) => (
            <div key={type} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: type === 'molecule' ? '#8a9a8e' : type === 'receptor' ? '#3b82f6' : '#32c864',
                }}
              />
              <span className="text-[8px] text-gray-400 dark:text-[#6a7a6e] capitalize">{type}s</span>
            </div>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 320 }}>
        {/* Links */}
        {links.map((l, i) => {
          const source = nodes.find((n) => n.id === l.source)
          const target = nodes.find((n) => n.id === l.target)
          if (!source || !target) return null
          const color = getReceptorColor(l.receptor)
          const isHighlighted = connectedIds?.has(l.source) && connectedIds?.has(l.target)
          const isDimmed = connectedIds && !isHighlighted

          return (
            <GraphLink
              key={`link-${i}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              color={color}
              highlighted={isHighlighted}
              dimmed={isDimmed}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => (
          <GraphNode
            key={node.id}
            node={node}
            dark={isDark}
            onHover={setHoveredNode}
            isHovered={hoveredNode === node.id}
            connections={connectedIds ? connectedIds.has(node.id) : true}
          />
        ))}
      </svg>

      {/* Receptor color key */}
      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {Object.entries(RECEPTOR_COLORS).map(([name, color]) => {
          const hasReceptor = nodes.some((n) => n.id === `rec:${name}`)
          if (!hasReceptor) return null
          return (
            <div key={name} className="flex items-center gap-1 text-[8px] text-gray-400 dark:text-[#6a7a6e]">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              {name}
            </div>
          )
        })}
      </div>
    </div>
  )
}
