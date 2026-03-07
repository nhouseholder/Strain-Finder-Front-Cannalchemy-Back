import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

export default function Modal({ open, onClose, title, children, className }) {
  const overlayRef = useRef(null)
  const contentRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    contentRef.current?.focus()

    // Pin body to prevent iOS Safari scroll-through behind modal
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'

    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)

    return () => {
      document.removeEventListener('keydown', handleEsc)
      const top = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      window.scrollTo(0, parseInt(top || '0', 10) * -1)
      prev?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={clsx(
          'relative w-full sm:max-w-lg max-h-[calc(100%-2.5rem)] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl',
          'bg-[#f4f7f5] dark:bg-[#0f1a12] border border-gray-200/80 dark:border-white/10 shadow-2xl',
          'animate-slide-up',
          className
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 pb-2 bg-[#f4f7f5]/90 dark:bg-[#0f1a12]/90 backdrop-blur-md border-b border-gray-200/60 dark:border-white/[0.05]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-[#e8f0ea]">{title}</h2>
          <button
            onClick={onClose}
            className="p-2.5 rounded-lg text-gray-400 dark:text-[#6a7a6e] hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 pt-3">
          {children}
        </div>
      </div>
    </div>
  )
}
