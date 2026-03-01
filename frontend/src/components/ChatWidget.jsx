/**
 * Rezvo AI Dashboard Chat — wired to real database
 * Calls /api/chatbot/chat with business_id so Claude can query MongoDB
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useBusiness } from '../contexts/BusinessContext'
import { API_BASE_URL } from '../utils/api'

const FOREST = '#111111'
const MINT = '#52B788'
const GOLD = '#D4A373'

const GREETING = "Hey! 👋 I'm your Rezvo AI assistant. I can see your live booking data — ask me about today's covers, upcoming reservations, customer stats, or anything about the platform."

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatMsg(text) {
  // Escape HTML first, THEN apply safe markdown formatting
  const safe = escapeHtml(text)
  return safe
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n• /g, '<br/>• ')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n(\d+)\./g, '<br/>$1.')
    .replace(/\n/g, '<br/>')
}

const quickButtons = [
  { label: '📊 Today\'s covers', q: 'How many covers have I got today?' },
  { label: '👥 Total customers', q: 'How many customers do I have altogether?' },
  { label: '📅 This week', q: 'What does this week look like for bookings?' },
  { label: '🚫 No-shows', q: 'What is my no-show rate?' },
  { label: '⏰ Next up', q: 'What are the next bookings coming up today?' },
  { label: '💡 Help', q: 'What can you help me with?' },
]

/* Icons */
const ChatIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const ChatWidget = () => {
  const { business } = useBusiness()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [chatHistory, setChatHistory] = useState([]) // API message format
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showQuick, setShowQuick] = useState(true)
  const [hasOpened, setHasOpened] = useState(false)
  const [showBadge, setShowBadge] = useState(true)
  const messagesRef = useRef(null)

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const handleOpen = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev
      if (next && !hasOpened) {
        setHasOpened(true)
        setTimeout(() => {
          setMessages([{ text: GREETING, sender: 'bot' }])
        }, 300)
      }
      setShowBadge(false)
      return next
    })
  }, [hasOpened])

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return
    const userText = text.trim()
    setInput('')
    setShowQuick(false)
    setIsTyping(true)

    // Add user message to display
    setMessages(prev => [...prev, { text: userText, sender: 'user' }])

    // Build API history
    const newHistory = [...chatHistory, { role: 'user', content: userText }]
    setChatHistory(newHistory)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/chatbot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: newHistory.slice(-20),
          business_id: business?.id || null,
        }),
      })

      if (!res.ok) throw new Error(`API ${res.status}`)

      const data = await res.json()
      const reply = data.reply || "Hmm, couldn't get a response. Try again!"

      setMessages(prev => [...prev, { text: reply, sender: 'bot' }])
      setChatHistory(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      console.error('Chat API error:', err)
      setMessages(prev => [...prev, {
        text: "I'm having trouble connecting right now. Check your dashboard directly or try again in a moment.",
        sender: 'bot'
      }])
    } finally {
      setIsTyping(false)
    }
  }, [chatHistory, business?.id])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  return (
    <>
      {/* Panel */}
      <div style={{
        position: 'fixed', bottom: 96, right: 24, zIndex: 9998,
        width: 400, maxWidth: 'calc(100vw - 32px)', height: 540, maxHeight: 'calc(100vh - 140px)',
        borderRadius: 20, background: '#fff',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
        pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        fontFamily: "'Figtree', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{ background: FOREST, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: GOLD,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 16, color: FOREST, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>R.</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Rezvo AI</div>
            <div style={{ color: MINT, fontSize: 11, fontWeight: 600, marginTop: 2, opacity: 0.9 }}>
              ● Live — connected to your data
            </div>
          </div>
          {business?.name && (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 500, textAlign: 'right', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {business.name}
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={messagesRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: '#f9fafb' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              maxWidth: '85%', padding: '12px 16px', borderRadius: 16, fontSize: 13, lineHeight: 1.6,
              wordWrap: 'break-word',
              ...(msg.sender === 'bot' ? {
                background: '#fff', color: '#333', border: '1px solid #e5e7eb',
                borderBottomLeftRadius: 4, alignSelf: 'flex-start',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              } : {
                background: FOREST, color: '#fff',
                borderBottomRightRadius: 4, alignSelf: 'flex-end',
              })
            }} dangerouslySetInnerHTML={
              msg.sender === 'bot'
                ? { __html: formatMsg(msg.text) }
                : { __html: msg.text.replace(/</g, '&lt;') }
            } />
          ))}
          {isTyping && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, borderBottomLeftRadius: 4, alignSelf: 'flex-start', padding: '14px 20px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#bbb',
                    animation: `rcDot 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Buttons */}
        {showQuick && messages.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 12px', background: '#f9fafb' }}>
            {quickButtons.map((btn, i) => (
              <button key={i} onClick={() => sendMessage(btn.q)} style={{
                padding: '6px 14px', borderRadius: 20, border: '1.5px solid #e5e7eb', background: '#fff',
                fontSize: 11, fontWeight: 600, color: FOREST, cursor: 'pointer',
                fontFamily: "'Figtree', system-ui, sans-serif", whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}>{btn.label}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#fff', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
            placeholder="Ask about your bookings, covers, customers..."
            disabled={isTyping}
            style={{
              flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '10px 14px',
              fontSize: 13, fontFamily: "'Figtree', system-ui, sans-serif", outline: 'none', color: '#333',
            }}
          />
          <button onClick={() => sendMessage(input)} disabled={isTyping || !input.trim()} style={{
            width: 38, height: 38, borderRadius: 10, border: 'none', background: FOREST, color: '#fff',
            cursor: isTyping || !input.trim() ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isTyping || !input.trim() ? 0.4 : 1, transition: 'all 0.2s', flexShrink: 0,
          }}><SendIcon /></button>
        </div>

        <div style={{ textAlign: 'center', padding: 6, fontSize: 9, color: '#bbb', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
          Powered by Rezvo AI · Live data
        </div>
      </div>

      {/* FAB */}
      <button onClick={handleOpen} style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        width: 60, height: 60, borderRadius: '50%', background: FOREST, color: '#fff',
        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 24px rgba(17,17,17,0.4)',
        transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        {isOpen ? <CloseIcon /> : <ChatIcon />}
        {showBadge && !isOpen && (
          <div style={{
            position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%',
            background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff',
          }}>1</div>
        )}
      </button>

      <style>{`
        @keyframes rcDot {
          0%, 60%, 100% { transform: translateY(0) }
          30% { transform: translateY(-6px) }
        }
      `}</style>
    </>
  )
}

export default ChatWidget
