import { useMemo, useState } from 'react'
import { Network } from 'lucide-react'
import { getReceptorColor, RECEPTOR_COLORS } from '../../utils/colors'

/**
 * PathwayGraph — Interactive 2D force-layout molecular pathway visualization.
 *
 * Renders a Strain Finder-style graph showing:
 *   Molecule nodes → Receptor nodes → Effect nodes
 * with animated links colored by receptor type.
 *
 * Uses a deterministic 3-column layout with strong repulsion to prevent overlap.
 */

const NODE_RADIUS = { molecule: 14, receptor: 16, effect: 14 }
const MIN_NODE_GAP = 68 // minimum vertical gap between node centers (generous for labels)

function simpleForceLayout(nodes, links, width, height) {
  const byType = { molecule: [], receptor: [], effect: [] }
  nodes.forEach((n) => byType[n.type]?.push(n))

  // 3-column positions — generous margins so labels don't clip
  const colX = { molecule: width * 0.14, receptor: width * 0.5, effect: width * 0.86 }

  // Initial even spacing per column
  Object.entries(byType).forEach(([type, group]) => {
    const gap = Math.max(MIN_NODE_GAP, height / (group.length + 1))
    group.forEach((n, i) => {
      n.x = colX[type]
      n.y = gap * (i + 1)
    })
  })

  // Run repulsion + link-spring for 60 iterations
  for (let iter = 0; iter < 60; iter++) {
    // Strong repulsion between same-column nodes
    Object.values(byType).forEach((group) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const dy = group[j].y - group[i].y
          const dist = Math.abs(dy) || 1
          if (dist < MIN_NODE_GAP) {
            const push = (MIN_NODE_GAP - dist) * 0.35
            group[i].y -= push
            group[j].y += push
          }
        }
      }
    })

    // Gentle vertical attraction between linked nodes
    links.forEach((l) => {
      const a = nodes.find((n) => n.id === l.source)
      const b = nodes.find((n) => n.id === l.target)
      if (a && b) {
        const dy = b.y - a.y
        a.y += dy * 0.015
        b.y -= dy * 0.015
      }
    })
  }

  // Clamp to viewbox with generous padding for labels
  const pad = 40
  nodes.forEach((n) => {
    n.y = Math.max(pad, Math.min(height - pad, n.y))
  })

  return nodes
}

function GraphNode({ node, dark, onHover, isHovered, connections }) {
  const r = (NODE_RADIUS[node.type] || 16) + (isHovered ? 3 : 0)
  const opacity = connections === false ? 0.2 : 1

  // Colors by type
  const colors = {
    molecule: {
      fill: dark ? 'rgba(100,140,120,0.15)' : 'rgba(60,120,80,0.08)',
      stroke: dark ? 'rgba(140,180,160,0.5)' : 'rgba(60,120,80,0.35)',
      text: dark ? '#c0d4c6' : '#374151',
    },
    receptor: {
      fill: `${getReceptorColor(node.label)}18`,
      stroke: getReceptorColor(node.label),
      text: getReceptorColor(node.label),
    },
    effect: {
      fill: dark ? 'rgba(50,200,100,0.12)' : 'rgba(50,200,100,0.08)',
      stroke: dark ? 'rgba(50,200,100,0.5)' : 'rgba(50,200,100,0.4)',
      text: dark ? '#6ee7a0' : '#16a34a',
    },
  }
  const c = colors[node.type] || colors.molecule

  // Label — truncate long names
  const displayLabel = node.label.length > 12 ? node.label.slice(0, 11) + '\u2026' : node.label
  const fontSize = node.label.length > 9 ? 6 : 7

  // Place label outside the node to prevent overlap — always below for consistency
  const labelY = node.y + r + 10

  return (
    <g
      style={{ opacity, transition: 'opacity 0.2s' }}
      onMouseEnter={() => onHover?.(node.id)}
      onMouseLeave={() => onHover?.(null)}
      className="cursor-pointer"
    >
      {/* Glow on hover */}
      {isHovered && (
        <circle cx={node.x} cy={node.y} r={r + 5} fill={c.stroke} opacity={0.12} />
      )}
      {/* Node circle */}
      <circle
        cx={node.x}
        cy={node.y}
        r={r}
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={isHovered ? 2 : 1.2}
      />
      {/* Label below circle for all node types */}
      <text
        x={node.x}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="central"
        fill={c.text}
        fontSize={fontSize}
        fontWeight={600}
        className="pointer-events-none select-none"
      >
        {displayLabel}
      </text>
      {/* Subtitle below label */}
      {node.subtitle && (
        <text
          x={node.x}
          y={labelY + 9}
          textAnchor="middle"
          dominantBaseline="central"
          fill={dark ? '#6a7a6e' : '#9ca3af'}
          fontSize={5}
          className="pointer-events-none select-none"
        >
          {node.subtitle}
        </text>
      )}
    </g>
  )
}

function GraphLink({ x1, y1, x2, y2, color, highlighted, dimmed }) {
  // Smooth bezier curve from source to target
  const dx = x2 - x1
  const cp1x = x1 + dx * 0.4
  const cp2x = x1 + dx * 0.6
  const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={highlighted ? 2.2 : 1}
      strokeOpacity={dimmed ? 0.06 : highlighted ? 0.65 : 0.2}
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
          id: molId, type: 'molecule',
          label: p.molecule.charAt(0).toUpperCase() + p.molecule.slice(1),
          subtitle: p.ki_nm ? `Ki ${p.ki_nm} nM` : '',
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
            subtitle: `${Math.round((ep.probability || 0) * 100)}%`,
            x: 0, y: 0,
          })
        }
        // Link receptors → effect
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
    // Give each node plenty of vertical space (+ label + subtitle room)
    const h = Math.max(maxCol * MIN_NODE_GAP + 100, 280)
    const w = 440

    simpleForceLayout(allNodes, linkList, w, h)

    return { nodes: allNodes, links: linkList, width: w, height: h }
  }, [pathways, effectPredictions])

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

  if (!nodes.length) return null

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
            <Network size={14} className="text-blue-400" />
          </div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#8a9a8e]">
            Molecular Pathways
          </h4>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3">
          {[
            { type: 'molecule', color: '#8a9a8e', label: 'Compound' },
            { type: 'receptor', color: '#3b82f6', label: 'Receptor' },
            { type: 'effect', color: '#32c864', label: 'Effect' },
          ].map(({ type, color, label }) => (
            <div key={type} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[8px] text-gray-400 dark:text-[#6a7a6e]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex justify-between px-2 mb-1">
        <span className="text-[8px] font-semibold text-gray-400 dark:text-[#5a6a5e] uppercase tracking-wider">Compounds</span>
        <span className="text-[8px] font-semibold text-gray-400 dark:text-[#5a6a5e] uppercase tracking-wider">Receptors</span>
        <span className="text-[8px] font-semibold text-gray-400 dark:text-[#5a6a5e] uppercase tracking-wider">Effects</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 380 }}>
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
      <div className="flex flex-wrap gap-3 justify-center mt-2 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
        {Object.entries(RECEPTOR_COLORS).map(([name, color]) => {
          const hasReceptor = nodes.some((n) => n.id === `rec:${name}`)
          if (!hasReceptor) return null
          return (
            <div key={name} className="flex items-center gap-1 text-[9px] text-gray-500 dark:text-[#8a9a8e]">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {name}
            </div>
          )
        })}
      </div>
    </div>
  )
}
