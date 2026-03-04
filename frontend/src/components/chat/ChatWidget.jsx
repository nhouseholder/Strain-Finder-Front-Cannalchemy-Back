import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, ChevronDown } from 'lucide-react'

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
            {/* Bold formatting */}
            {line.split(/(\*\*[^*]+\*\*)/).map((seg, j) =>
              seg.startsWith('**') && seg.endsWith('**')
                ? <strong key={j} className={isUser ? 'font-semibold' : 'font-semibold text-gray-900 dark:text-[#e8f0ea]'}>{seg.slice(2, -2)}</strong>
                : seg
            )}
          </p>
        ))}

        {/* Referenced strains badge */}
        {message.strains_referenced?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200/30 dark:border-white/[0.06]">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-[#6a7a6e] uppercase mb-1">Strains Referenced</p>
            <div className="flex flex-wrap gap-1">
              {message.strains_referenced.map(name => (
                <span key={name} className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-leaf-500/10 text-leaf-500 dark:text-leaf-400 border border-leaf-500/20">
                  {name}
                </span>
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
/* ================================================================== */
export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

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

  return (
    <>
      {/* ── Chat Window ──────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-[9999] w-[calc(100vw-2rem)] sm:w-[400px] max-h-[70vh] flex flex-col rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-[#f8faf8] dark:bg-[#0f1a12] shadow-2xl shadow-black/20 animate-slide-up overflow-hidden">

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
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ maxHeight: 'calc(70vh - 130px)', minHeight: '200px' }}>
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
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/90 dark:bg-[#1a2a1e]/90 backdrop-blur-md border border-leaf-500/20 shadow-lg shadow-black/10 cursor-pointer hover:border-leaf-500/40 transition-all animate-fade-in"
          >
            <Sparkles size={12} className="text-leaf-400" />
            <span className="text-[11px] font-medium text-gray-700 dark:text-[#b0c4b4] whitespace-nowrap">Ask AI about any strain</span>
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
