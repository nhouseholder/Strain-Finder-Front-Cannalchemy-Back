/**
 * ChemTooltip — Hover tooltip that shows a one-sentence educational
 * description for any terpene or cannabinoid. Wraps any child element.
 *
 * Usage:
 *   <ChemTooltip name="myrcene">
 *     <TerpBadge name="Myrcene" pct="0.6%" />
 *   </ChemTooltip>
 *
 *   <ChemTooltip name="THC">
 *     <span>THC</span>
 *   </ChemTooltip>
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getChemDescription } from '../../data/chemDescriptions'

export default function ChemTooltip({ name, children }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const desc = getChemDescription(name)

  const onEnter = useCallback(() => setShow(true), [])
  const onLeave = useCallback(() => setShow(false), [])

  // Recalculate position when tooltip becomes visible
  useEffect(() => {
    if (!show || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipW = 240 // matches w-60
    let left = rect.left + rect.width / 2 - tooltipW / 2
    // Keep within viewport horizontally
    if (left < 8) left = 8
    if (left + tooltipW > window.innerWidth - 8) left = window.innerWidth - tooltipW - 8
    setPos({ top: rect.top + window.scrollY - 10, left })
  }, [show])

  // If no description found, render children as-is
  if (!desc) return children ?? null

  return (
    <span
      ref={triggerRef}
      className="inline-flex cursor-help"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={(e) => { e.stopPropagation(); setShow(prev => !prev) }}
      role="button"
      tabIndex={0}
    >
      {children}
      {show && createPortal(
        <span
          role="tooltip"
          className="fixed w-60 p-2.5 rounded-xl text-[11px] leading-relaxed bg-white dark:bg-[#1a2a1e] border border-gray-200 dark:border-white/10 shadow-xl text-gray-600 dark:text-[#b0c4b4] pointer-events-none animate-fade-in"
          style={{
            zIndex: 9999,
            top: pos.top,
            left: pos.left,
            position: 'absolute',
            transform: 'translateY(-100%)',
          }}
        >
          <span className="font-semibold text-gray-800 dark:text-[#d0e4d4]">
            {name}
          </span>
          <span className="mx-1 text-gray-300 dark:text-white/20">·</span>
          {desc}
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-white dark:bg-[#1a2a1e] border-b border-r border-gray-200 dark:border-white/10 rotate-45" />
        </span>,
        document.body
      )}
    </span>
  )
}
