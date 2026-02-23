/**
 * Rezvo AI Support Chat Widget — React Component
 * Floating chat bubble with knowledge-base powered responses
 */
import { useState, useRef, useEffect, useCallback } from 'react'

const FOREST = '#1B4332'
const MINT = '#52B788'

/* ─── Knowledge Base ─── */
const KB = {
  greeting: "Hi! 👋 I'm Rezvo's AI assistant. I can help with pricing, features, getting started, or any questions about our platform. What would you like to know?",
  fallback: "Great question! I want to make sure you get the best answer. You can reach our team directly at hello@rezvo.app or use our contact page. Is there anything else I can help with?",
  topics: [
    { keys: ['price','pricing','cost','how much','plan','plans','subscription','free','tier'], answer: "**Rezvo Pricing:**\n\n• **Free** — £0/mo · 1 staff, 100 bookings\n• **Starter** — £8.99/mo · 3 staff, reminders\n• **Growth** — £29/mo · 5 staff, deposits, CRM\n• **Scale** — £59/mo · Unlimited, floor plans, white-label\n• **Enterprise** — Custom pricing\n\nAll plans include zero commission. 30-day free trial!" },
    { keys: ['commission','zero commission','no commission','fees','percentage'], answer: "**Zero commission, always.** Unlike platforms that take 15-30% of every booking, Rezvo charges a flat monthly rate. 100% of your revenue stays yours. Payments go directly to your bank via Stripe Connect." },
    { keys: ['restaurant','table','floor plan','covers','seating','dining'], answer: "**Rezvo for Restaurants:**\n\n• Floor Plan View with real-time table status\n• Covers tracking by party size\n• Service period management (lunch/dinner)\n• Online booking widget\n• Orders board for kitchen\n• Analytics & revenue tracking" },
    { keys: ['delivery','uber','uber direct','deliveroo','just eat','takeaway','ordering'], answer: "**Zero-Commission Delivery via Uber Direct:**\n\n• Customers order from YOUR branded page\n• Payments go directly to YOUR Stripe account\n• Uber Direct handles drivers — you pay only the delivery fee\n• No 25-30% commission like Deliveroo or JustEat" },
    { keys: ['booking','book','appointment','reserve','calendar'], answer: "**Smart Booking System:**\n\n• Online booking 24/7\n• Drag-and-drop calendar with staff columns\n• Deposit collection to reduce no-shows\n• SMS and email reminders\n• Walk-in management\n• Multi-staff support" },
    { keys: ['salon','barber','spa','hair','beauty','service business'], answer: "**Rezvo works for all service businesses:** Salons, Barbers, Personal Trainers, Physiotherapists, Tattoo Studios, Music Teachers, Dog Groomers and more. Each gets a tailored booking flow." },
    { keys: ['opentable','resdiary','thefork','competitor','compare','alternative','switch'], answer: "**vs OpenTable:** They charge £1-3 per seated diner. Rezvo is flat-rate, zero commission.\n**vs ResDiary:** Similar features but Rezvo includes online ordering + delivery.\n**vs TheFork:** They take commission and promote discounting. Rezvo protects your margins." },
    { keys: ['payment','stripe','pay','card','deposit','money'], answer: "**Stripe Connect Payments:**\n\n• Each business connects their own Stripe account\n• Payments go directly to you\n• Supports Apple Pay, Google Pay\n• Automatic deposit collection\n• Full refund management" },
    { keys: ['start','get started','sign up','signup','trial','begin','join'], answer: "**Getting started:**\n\n1. Sign up free — no credit card needed\n2. Set up your profile, services, and staff\n3. Start accepting bookings immediately\n\n30-day free trial on any plan!" },
    { keys: ['contact','support','help','email','speak','human','team'], answer: "**Get in touch:**\n\n• Email: hello@rezvo.app\n• Contact page: rezvo.app/contact.html\n• We typically reply within a few hours" },
    { keys: ['feature','what do','what can','include','offer'], answer: "**Key features:** Online booking, drag-and-drop calendar, floor plans, Stripe payments, CRM & analytics, SMS reminders, staff management, online ordering, Uber Direct delivery, white-label branding, directory listing." },
    { keys: ['hello','hi','hey','good morning','good afternoon'], answer: "Hey there! 👋 Welcome to Rezvo. I can help with pricing, features, getting started, or any questions. What can I help with?" },
    { keys: ['thank','thanks','cheers','appreciate'], answer: "You're welcome! 😊 If you have more questions, I'm here. Have a great day!" },
    { keys: ['bye','goodbye','see you','later'], answer: "Thanks for chatting! If you need anything, I'm always here. 👋" },
    { keys: ['dashboard','how to','setting','manage','staff','schedule'], answer: "**Dashboard Help:**\n\nFrom your dashboard you can manage bookings, staff, services, and settings. Use the sidebar to navigate between Calendar, Bookings, Staff, Services, Customers, and Analytics. Need help with something specific? Just ask!" },
    { keys: ['no show','no-show','cancel','cancellation'], answer: "**No-show Protection:**\n\n• Collect card-on-file deposits\n• Automatic reminders reduce no-shows by up to 70%\n• Easy cancellation policy management\n• Charge no-show fees automatically\n\nAvailable on Growth plan and above." },
  ]
}

function findAnswer(msg) {
  const lower = msg.toLowerCase().trim()
  if (lower.length < 2) return KB.greeting
  let best = null, bestScore = 0
  for (const topic of KB.topics) {
    let score = 0
    for (const key of topic.keys) {
      if (lower.includes(key)) score += key.split(' ').length
    }
    if (score > bestScore) { bestScore = score; best = topic }
  }
  return best ? best.answer : KB.fallback
}

function formatMsg(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n• /g, '<br/>• ')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n(\d+)\./g, '<br/>$1.')
    .replace(/\n/g, '<br/>')
}

const quickButtons = [
  { label: '💰 Pricing', q: 'What are your pricing plans?' },
  { label: '🍽️ Restaurants', q: 'Tell me about restaurant features' },
  { label: '🚫 Zero Commission', q: 'How does zero commission work?' },
  { label: '🚀 Get Started', q: 'How do I get started?' },
  { label: '✨ Features', q: 'What features do you offer?' },
  { label: '📧 Contact', q: 'How can I contact your team?' },
]

/* ─── Icons ─── */
const ChatBubbleIcon = () => (
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
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
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
          setMessages([{ text: KB.greeting, sender: 'bot' }])
        }, 400)
      }
      setShowBadge(false)
      return next
    })
  }, [hasOpened])

  const sendMessage = useCallback((text) => {
    if (!text.trim()) return
    setMessages(prev => [...prev, { text, sender: 'user' }])
    setInput('')
    setShowQuick(false)
    setIsTyping(true)

    const delay = 300 + Math.random() * 600
    setTimeout(() => {
      setIsTyping(false)
      const answer = findAnswer(text)
      setMessages(prev => [...prev, { text: answer, sender: 'bot' }])
    }, delay)
  }, [])

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
        width: 380, maxWidth: 'calc(100vw - 32px)', height: 520, maxHeight: 'calc(100vh - 140px)',
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
        <div style={{ background: FOREST, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: MINT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: FOREST }}>R</div>
          <div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Rezvo Support</div>
            <div style={{ color: MINT, fontSize: 11, fontWeight: 600, marginTop: 2, opacity: 0.9 }}>● Online — replies instantly</div>
          </div>
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
            }} dangerouslySetInnerHTML={msg.sender === 'bot' ? { __html: formatMsg(msg.text) } : { __html: msg.text.replace(/</g, '&lt;') }} />
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
            placeholder="Ask anything about Rezvo..."
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
          Powered by Rezvo AI
        </div>
      </div>

      {/* FAB */}
      <button onClick={handleOpen} style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        width: 60, height: 60, borderRadius: '50%', background: FOREST, color: '#fff',
        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 24px rgba(27,67,50,0.4)',
        transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        transform: isOpen ? 'scale(1)' : 'scale(1)',
      }}>
        {isOpen ? <CloseIcon /> : <ChatBubbleIcon />}
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
