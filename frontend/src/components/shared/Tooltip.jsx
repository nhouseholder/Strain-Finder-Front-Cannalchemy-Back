import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import clsx from 'clsx'

export default function Tooltip({ content, children, className }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <span ref={ref} className={clsx('relative inline-flex items-center', className)}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-gray-400 dark:text-[#6a7a6e] hover:text-gray-600 dark:hover:text-[#8a9a8e] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="More info"
        aria-expanded={open}
      >
        {children || <Info size={14} />}
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl text-xs leading-relaxed bg-white dark:bg-[#1a2a1e] border border-gray-200 dark:border-white/10 shadow-xl z-50 text-gray-700 dark:text-[#b0c4b4]"
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-white dark:bg-[#1a2a1e] border-b border-r border-gray-200 dark:border-white/10 rotate-45" />
        </div>
      )}
    </span>
  )
}
