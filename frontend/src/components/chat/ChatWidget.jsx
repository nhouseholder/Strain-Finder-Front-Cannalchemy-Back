import { useState, useRef, useEffect, useCallback, useContext } from 'react'
import { Link } from 'react-router-dom'
import { QuizContext } from '../../context/QuizContext'
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, ChevronDown, Maximize2, Minimize2 } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Typing indicator dots                                             */
/* ------------------------------------------------------------------ */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <div className="w-2 h-2 rounded-full bg-leaf-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 rounded-full bg-leaf-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 rounded-full bg-leaf-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Single message bubble                                             */
/* ------------------------------------------------------------------ */
function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  // Build a set of referenced strain names (lowercase) for link matching
  const refSet = new Set((message.strains_referenced || []).map(n => n.toLowerCase()))

  // Render a bold segment — if the text matches a referenced strain, render as a link
  const renderBold = (text, key) => {
    if (!isUser && refSet.has(text.toLowerCase())) {
      return (
        <Link
          key={key}
          to={`/search?q=${encodeURIComponent(text)}`}
          className="font-semibold text-leaf-500 dark:text-leaf-400 underline decoration-leaf-500/30 hover:decoration-leaf-500/60 transition-colors"
        >
          {text}
        </Link>
      )
    }
    return <strong key={key} className={isUser ? 'font-semibold' : 'font-semibold text-gray-900 dark:text-[#e8f0ea]'}>{text}</strong>
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        isUser
          ? 'bg-leaf-500/15 text-leaf-500'
          : 'bg-purple-500/15 text-purple-400'
      }`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
        isUser
          ? 'bg-leaf-500 text-white rounded-br-md'
          : 'bg-gray-100 dark:bg-white/[0.06] text-gray-800 dark:text-[#d0e0d4] rounded-bl-md border border-gray-200/40 dark:border-white/[0.06]'
      }`}>
        {message.content.split('\n').map((line, i) => (
          <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
            {line.split(/(\*\*[^*]+\*\*)/).map((seg, j) =>
              seg.startsWith('**') && seg.endsWith('**')
                ? renderBold(seg.slice(2, -2), j)
                : seg
            )}
          </p>
        ))}

        {/* Referenced strains badge links */}
        {message.strains_referenced?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200/30 dark:border-white/[0.06]">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase mb-1">Strains Referenced</p>
            <div className="flex flex-wrap gap-1">
              {message.strains_referenced.map(name => (
                <Link
                  key={name}
                  to={`/search?q=${encodeURIComponent(name)}`}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-leaf-500/10 text-leaf-500 dark:text-leaf-400 border border-leaf-500/20 hover:bg-leaf-500/20 transition-colors"
                >
                  {name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Suggested starter questions                                       */
/* ------------------------------------------------------------------ */
const SUGGESTIONS = [
  'What are the best strains for relaxation?',
  'Tell me about Blue Dream',
  'Which strains are highest in CBD?',
  'What strains have the most myrcene?',
]

/* ================================================================== */
/*  ChatWidget — floating chat bubble + expandable window             */
/*  inline mode: embedded panel (always visible, no bubble trigger)   */
/* ================================================================== */
export default function ChatWidget({ inline = false, className = '' }) {
  const quizCtx = useContext(QuizContext)
  const userZipCode = quizCtx?.state?.zipCode || ''

  const [isOpen, setIsOpen] = useState(inline)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // ── Resize state ──────────────────────────────────────────────────
  const [size, setSize] = useState({ w: 400, h: 520 })
  const resizing = useRef(null)

  const onResizeStart = useCallback((e, direction) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startW = size.w
    const startH = size.h
    resizing.current = { startX, startY, startW, startH, direction }

    const onMove = (ev) => {
      if (!resizing.current) return
      const { startX, startY, startW, startH, direction: dir } = resizing.current
      let newW = startW
      let newH = startH
      // Left edge/corner: dragging left increases width
      if (dir.includes('l')) newW = Math.min(700, Math.max(320, startW - (ev.clientX - startX)))
      // Top edge/corner: dragging up increases height
      if (dir.includes('t')) newH = Math.min(800, Math.max(360, startH - (ev.clientY - startY)))
      setSize({ w: newW, h: newH })
    }

    const onUp = () => {
      resizing.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [size])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [isOpen])

  // Allow external components to open the chat via custom event
  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    window.addEventListener('open-chat', handleOpen)
    return () => window.removeEventListener('open-chat', handleOpen)
  }, [])

  const sendMessage = useCallback(async (text) => {
    const userMessage = (text || input).trim()
    if (!userMessage || loading) return

    // Add user message
    const userMsg = { role: 'user', content: userMessage }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      // Build conversation history for context
      const history = updatedMessages.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          zipCode: userZipCode || undefined,
          history: history.slice(0, -1), // exclude the current message (sent separately)
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const data = await res.json()

      const aiMsg = {
        role: 'assistant',
        content: data.reply || 'Sorry, I could not generate a response.',
        strains_referenced: data.strains_referenced || [],
      }

      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I'm having trouble connecting right now. Please try again in a moment. (${err.message})`,
      }])
    } finally {
      setLoading(false)
    }
  }, [input, messages, loading])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleSuggestion = (q) => {
    sendMessage(q)
  }

  // ── Inline mode: embedded panel ──────────────────────────────────
  if (inline) {
    return (
      <div className={`flex flex-col rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-[#f8faf8] dark:bg-[#0f1a12] overflow-hidden ${className}`} style={{ minHeight: '420px', maxHeight: className ? undefined : '70vh' }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-leaf-500 to-leaf-600 text-white">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">MyStrainAI Chat</h3>
            <p className="text-[10px] text-white/70">Ask me anything about strains</p>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ minHeight: '200px' }}>
          {messages.length === 0 ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-leaf-500/10 flex items-center justify-center mx-auto mb-3">
                <Bot size={24} className="text-leaf-400" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">
                Ask AI About Any Strain
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-[#6a7a6e] mb-4 max-w-[300px] mx-auto">
                Effects, terpenes, cannabinoids, genetics, comparisons — I know all {'\u{2728}'}20,684 strains in our database.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {SUGGESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    className="text-left px-3 py-2 rounded-xl text-[12px] text-gray-600 dark:text-[#8a9a8e] bg-gray-100 dark:bg-white/[0.04] hover:bg-leaf-500/10 hover:text-leaf-600 dark:hover:text-leaf-400 border border-gray-200/40 dark:border-white/[0.06] hover:border-leaf-500/20 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
          )}
          {loading && (
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/15 text-purple-400 flex items-center justify-center">
                <Bot size={14} />
              </div>
              <div className="rounded-2xl rounded-bl-md bg-gray-100 dark:bg-white/[0.06] border border-gray-200/40 dark:border-white/[0.06]">
                <TypingIndicator />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="px-3 py-3 border-t border-gray-200/60 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02]">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about a strain..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200/60 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-base text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500/40 transition-all"
              style={{ maxHeight: '80px' }}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-leaf-500 hover:bg-leaf-600 disabled:opacity-40 disabled:hover:bg-leaf-500 text-white flex items-center justify-center transition-all shadow-md shadow-leaf-500/25"
              aria-label="Send message"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-[9px] text-gray-400 dark:text-[#4a5a4e] mt-1.5 text-center">
            Powered by AI · Answers sourced from our strain database · Not medical advice
          </p>
        </div>
      </div>
    )
  }

  // ── Floating mode (default): popup + bubble trigger ────────────
  return (
    <>
      {/* ── Chat Window ──────────────────────────────────────────── */}
      {isOpen && (
        <div
          className={`fixed z-[9999] flex flex-col border bg-[#f8faf8] dark:bg-[#0f1a12] shadow-2xl shadow-black/20 animate-slide-up overflow-hidden ${
            isFullscreen
              ? 'inset-0 rounded-none border-transparent'
              : 'bottom-20 right-4 sm:right-6 rounded-2xl border-gray-200/60 dark:border-white/[0.08]'
          }`}
          style={isFullscreen ? undefined : { width: `min(${size.w}px, calc(100vw - 2rem))`, height: `min(${size.h}px, 80vh)` }}
        >

          {/* Resize handles (desktop only, hidden in fullscreen) */}
          {!isFullscreen && (
            <>
              {/* Top-left corner */}
              <div
                onMouseDown={(e) => onResizeStart(e, 'tl')}
                className="hidden sm:block absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10"
              />
              {/* Top edge */}
              <div
                onMouseDown={(e) => onResizeStart(e, 't')}
                className="hidden sm:block absolute top-0 left-4 right-0 h-1.5 cursor-n-resize z-10"
              />
              {/* Left edge */}
              <div
                onMouseDown={(e) => onResizeStart(e, 'l')}
                className="hidden sm:block absolute top-4 left-0 bottom-0 w-1.5 cursor-w-resize z-10"
              />
            </>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-leaf-500 to-leaf-600 text-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">MyStrainAI Chat</h3>
                <p className="text-[10px] text-white/70">Ask me anything about strains</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsFullscreen(f => !f)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
                title={isFullscreen ? 'Exit full screen' : 'Full screen'}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={() => { setIsOpen(false); setIsFullscreen(false) }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Close chat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ minHeight: '120px' }}>
            {messages.length === 0 ? (
              /* Welcome state */
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-2xl bg-leaf-500/10 flex items-center justify-center mx-auto mb-3">
                  <Bot size={24} className="text-leaf-400" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-[#e8f0ea] mb-1">
                  Welcome to MyStrainAI Chat
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-[#6a7a6e] mb-4 max-w-[260px] mx-auto">
                  Ask me about any strain in our database — effects, terpenes, cannabinoids, genetics, and more.
                </p>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => handleSuggestion(q)}
                      className="block w-full text-left px-3 py-2 rounded-xl text-[12px] text-gray-600 dark:text-[#8a9a8e] bg-gray-100 dark:bg-white/[0.04] hover:bg-leaf-500/10 hover:text-leaf-600 dark:hover:text-leaf-400 border border-gray-200/40 dark:border-white/[0.06] hover:border-leaf-500/20 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Conversation messages */
              messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
            )}

            {loading && (
              <div className="flex gap-2.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/15 text-purple-400 flex items-center justify-center">
                  <Bot size={14} />
                </div>
                <div className="rounded-2xl rounded-bl-md bg-gray-100 dark:bg-white/[0.06] border border-gray-200/40 dark:border-white/[0.06]">
                  <TypingIndicator />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-3 py-3 border-t border-gray-200/60 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02]">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about a strain..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200/60 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-[#e8f0ea] placeholder-gray-400 dark:placeholder-[#5a6a5e] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500/40 transition-all"
                style={{ maxHeight: '80px' }}
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-leaf-500 hover:bg-leaf-600 disabled:opacity-40 disabled:hover:bg-leaf-500 text-white flex items-center justify-center transition-all shadow-md shadow-leaf-500/25"
                aria-label="Send message"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            <p className="text-[9px] text-gray-400 dark:text-[#4a5a4e] mt-1.5 text-center">
              Powered by AI · Answers sourced from our strain database · Not medical advice
            </p>
          </div>
        </div>
      )}

      {/* ── Floating trigger button + label ─────────────────────── */}
      <div className="fixed bottom-4 right-4 sm:right-6 z-[9999] flex items-center gap-2">
        {!isOpen && (
          <div
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/90 dark:bg-[#1a2a1e]/90 backdrop-blur-md border border-leaf-500/30 shadow-lg shadow-leaf-500/10 cursor-pointer hover:border-leaf-500/50 hover:shadow-leaf-500/20 transition-all animate-fade-in animate-shimmer"
          >
            <Sparkles size={14} className="text-leaf-400" />
            <span className="text-[13px] font-semibold text-gray-800 dark:text-[#c0d4c4] whitespace-nowrap">Ask AI about any strain!</span>
          </div>
        )}
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
            isOpen
              ? 'bg-gray-500 hover:bg-gray-600 shadow-gray-500/25 rotate-0'
              : 'bg-leaf-500 hover:bg-leaf-600 shadow-leaf-500/40 hover:scale-105 animate-pulse-subtle'
          }`}
          aria-label={isOpen ? 'Close chat' : 'Open strain chat'}
        >
          {isOpen ? <ChevronDown size={22} className="text-white" /> : <MessageCircle size={22} className="text-white" />}
        </button>
      </div>
    </>
  )
}
