/**
 * Client Messages — Business dashboard page
 * Shows message threads from client portal users.
 * Business owner/staff can read and reply to each thread.
 */
import { useState, useEffect, useRef } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import { MessageSquare, Send, ArrowLeft, User, Clock } from 'lucide-react'

const API = '/api'
const fetchApi = async (path, opts = {}) => {
  const token = sessionStorage.getItem('reeveos_admin_token') || sessionStorage.getItem('rezvo_token') || localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const res = await fetch(`${API}${path}`, { ...opts, headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function ClientMessages() {
  const { business } = useBusiness()
  const bizId = business?._id || business?.id || ''
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (bizId) loadThreads()
  }, [bizId])

  const loadThreads = async () => {
    setLoading(true)
    try {
      const d = await fetchApi(`/client/business/${bizId}/messages`)
      setThreads(d.threads || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const openThread = async (thread) => {
    setActiveThread(thread)
    try {
      const d = await fetchApi(`/client/business/${bizId}/messages/${thread.consumer_id}`)
      setMessages(d.messages || [])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e) { console.error(e) }
    // Update unread count locally
    setThreads(prev => prev.map(t => t.consumer_id === thread.consumer_id ? { ...t, unread: 0 } : t))
  }

  const sendReply = async () => {
    if (!reply.trim() || !activeThread) return
    setSending(true)
    try {
      const d = await fetchApi(`/client/business/${bizId}/messages/${activeThread.consumer_id}`, {
        method: 'POST',
        body: JSON.stringify({ text: reply, staff_name: '' }),
      })
      setMessages(prev => [...prev, d])
      setReply('')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e) { console.error(e) }
    setSending(false)
  }

  const timeAgo = (iso) => {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  if (!bizId) return <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Loading business...</div>

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 4rem)', fontFamily: "'Figtree',-apple-system,sans-serif", margin: '-1.5rem -1.5rem 0' }}>
      {/* Thread list */}
      <div style={{
        width: activeThread ? (window.innerWidth < 768 ? 0 : 340) : '100%',
        maxWidth: 400,
        borderRight: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.2s',
      }}>
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid #E5E7EB' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>Client Messages</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>{threads.length} conversation{threads.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
          ) : threads.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <MessageSquare size={32} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>No messages yet</p>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>When clients message you through the portal, they'll appear here.</p>
            </div>
          ) : threads.map(t => (
            <button
              key={t.consumer_id}
              onClick={() => openThread(t)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '14px 20px', border: 'none', borderBottom: '1px solid #F3F4F6',
                background: activeThread?.consumer_id === t.consumer_id ? '#F9FAFB' : '#fff',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 99, background: '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <User size={18} color="#6B7280" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{t.consumer_name || t.consumer_email}</span>
                  {t.unread > 0 && <span style={{
                    fontSize: 10, fontWeight: 700, color: '#fff', background: '#C9A84C',
                    borderRadius: 99, padding: '2px 7px', minWidth: 18, textAlign: 'center',
                  }}>{t.unread}</span>}
                </div>
                <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.last_from === 'business' ? 'You: ' : ''}{t.last_message}
                </p>
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>{timeAgo(t.last_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      {activeThread ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Chat header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setActiveThread(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <ArrowLeft size={20} color="#374151" />
            </button>
            <div style={{ width: 36, height: 36, borderRadius: 99, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={16} color="#6B7280" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0 }}>{activeThread.consumer_name || 'Client'}</p>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{activeThread.consumer_email}</p>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#FAFAFA' }}>
            {messages.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginTop: 40 }}>No messages in this conversation yet.</p>
            ) : messages.map((m, i) => (
              <div key={m.id || i} style={{ display: 'flex', justifyContent: m.from === 'business' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                <div style={{
                  maxWidth: '70%', padding: '10px 14px',
                  borderRadius: m.from === 'business' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.from === 'business' ? '#111' : '#fff',
                  color: m.from === 'business' ? '#fff' : '#111',
                  border: m.from === 'business' ? 'none' : '1px solid #E5E7EB',
                }}>
                  <p style={{ fontSize: 14, margin: 0, lineHeight: 1.5 }}>{m.text}</p>
                  <p style={{ fontSize: 10, margin: '4px 0 0', opacity: 0.6, textAlign: 'right' }}>
                    {m.staff_name ? `${m.staff_name} · ` : ''}{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Reply input */}
          <div style={{ borderTop: '1px solid #E5E7EB', padding: '12px 20px', display: 'flex', gap: 8, background: '#fff' }}>
            <input
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendReply()}
              placeholder="Type a reply..."
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 99, border: '1px solid #E5E7EB',
                fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#F9FAFB',
              }}
            />
            <button
              onClick={sendReply}
              disabled={sending || !reply.trim()}
              style={{
                width: 40, height: 40, borderRadius: 99, border: 'none',
                background: reply.trim() ? '#C9A84C' : '#E5E7EB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: reply.trim() ? 'pointer' : 'default',
              }}
            >
              <Send size={16} color={reply.trim() ? '#111' : '#9CA3AF'} />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }}>
          <div style={{ textAlign: 'center' }}>
            <MessageSquare size={40} color="#D1D5DB" />
            <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginTop: 12 }}>Select a conversation</p>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Choose a client thread to view and reply to messages.</p>
          </div>
        </div>
      )}
    </div>
  )
}
