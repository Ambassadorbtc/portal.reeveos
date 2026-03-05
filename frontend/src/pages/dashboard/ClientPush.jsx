/**
 * Push Notifications — Client Portal Management
 * Send updates, offers, or announcements directly to client portals.
 */
import { useState, useEffect } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import { Bell, Send, Check, Search, Users, Tag, Video, Gift, Megaphone } from 'lucide-react'

const API = '/api'
const fetchApi = async (path, opts = {}) => {
  const token = sessionStorage.getItem('reeveos_admin_token') || sessionStorage.getItem('rezvo_token') || localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const res = await fetch(`${API}${path}`, { ...opts, headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const gold = '#C9A84C'
const S = { font: "'Figtree',-apple-system,sans-serif", h: '#111', txt: '#374151', txtM: '#6B7280', txtL: '#9CA3AF', bdr: '#E5E7EB', bg: '#F9FAFB', card: '#fff' }

const TYPES = [
  { id: 'announcement', label: 'Announcement', Icon: Megaphone, desc: 'General update for all clients' },
  { id: 'offer', label: 'Special Offer', Icon: Gift, desc: 'Promotion or discount' },
  { id: 'new_content', label: 'New Content', Icon: Video, desc: 'New video, blog post, or tutorial' },
  { id: 'reminder', label: 'Reminder', Icon: Bell, desc: 'Appointment or aftercare reminder' },
]

export default function ClientPush() {
  const { business } = useBusiness()
  const bizId = business?._id || business?.id || ''
  const [clients, setClients] = useState([])
  const [selected, setSelected] = useState([])
  const [type, setType] = useState('announcement')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState([])
  const [target, setTarget] = useState('all') // 'all' or 'selected'

  useEffect(() => { if (bizId) loadData() }, [bizId])

  const loadData = async () => {
    try {
      const d = await fetchApi(`/client/business/${bizId}/portal-clients`)
      setClients(d.clients || [])
    } catch (e) {}
    try {
      const d = await fetchApi(`/client/business/${bizId}/push-history`)
      setHistory(d.notifications || [])
    } catch (e) {}
  }

  const toggleClient = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const sendPush = async () => {
    if (!title.trim() || !message.trim()) return
    if (target === 'selected' && selected.length === 0) return
    setSending(true)
    try {
      await fetchApi(`/client/business/${bizId}/send-push`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          title,
          message,
          target,
          client_ids: target === 'selected' ? selected : [],
        }),
      })
      setSent(true)
      setTitle('')
      setMessage('')
      setSelected([])
      setTimeout(() => setSent(false), 3000)
      loadData()
    } catch (e) { alert(e.message) }
    setSending(false)
  }

  const recipientCount = target === 'all' ? clients.length : selected.length
  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return !q || (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
  })

  return (
    <div style={{ fontFamily: S.font, padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: S.h, margin: '0 0 4px' }}>Push Notifications</h1>
      <p style={{ fontSize: 13, color: S.txtM, margin: '0 0 24px' }}>Send messages, offers, or updates directly to client portals.</p>

      {/* Notification type */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: S.h, margin: '0 0 10px' }}>Notification Type</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {TYPES.map(t => (
          <button key={t.id} onClick={() => setType(t.id)} style={{
            padding: '14px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: S.font,
            border: type === t.id ? `2px solid ${gold}` : `1px solid ${S.bdr}`,
            background: type === t.id ? 'rgba(200,163,76,0.04)' : S.card,
          }}>
            <t.Icon size={20} color={type === t.id ? gold : S.txtM} />
            <p style={{ fontSize: 13, fontWeight: 600, color: S.h, margin: '8px 0 0' }}>{t.label}</p>
            <p style={{ fontSize: 11, color: S.txtM, margin: '2px 0 0' }}>{t.desc}</p>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Compose */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: S.h, margin: '0 0 10px' }}>Compose</h3>
          <div style={{ background: S.card, border: `1px solid ${S.bdr}`, borderRadius: 12, padding: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: S.txt, display: 'block', marginBottom: 4 }}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. 20% Off This Week!" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.bdr}`, fontSize: 14, outline: 'none', fontFamily: S.font, boxSizing: 'border-box', marginBottom: 14 }} />

            <label style={{ fontSize: 12, fontWeight: 600, color: S.txt, display: 'block', marginBottom: 4 }}>Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Write your notification..." rows={5} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.bdr}`, fontSize: 14, outline: 'none', fontFamily: S.font, boxSizing: 'border-box', resize: 'vertical', marginBottom: 14 }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: S.txtM }}>{recipientCount} recipient{recipientCount !== 1 ? 's' : ''}</span>
              <button onClick={sendPush} disabled={sending || !title.trim() || !message.trim() || recipientCount === 0} style={{
                padding: '10px 24px', borderRadius: 99, border: 'none',
                background: title.trim() && message.trim() && recipientCount > 0 ? gold : S.bdr,
                color: title.trim() && message.trim() && recipientCount > 0 ? '#111' : S.txtL,
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: S.font,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {sent ? <><Check size={14} /> Sent!</> : sending ? 'Sending...' : <><Send size={14} /> Send</>}
              </button>
            </div>
          </div>
        </div>

        {/* Recipients */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: S.h, margin: '0 0 10px' }}>Recipients</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[{ id: 'all', label: `All Clients (${clients.length})` }, { id: 'selected', label: 'Select Specific' }].map(t => (
              <button key={t.id} onClick={() => setTarget(t.id)} style={{
                padding: '7px 16px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: S.font,
                border: target === t.id ? `2px solid ${gold}` : `1px solid ${S.bdr}`,
                background: target === t.id ? 'rgba(200,163,76,0.06)' : S.card,
                color: target === t.id ? gold : S.txtM,
              }}>{t.label}</button>
            ))}
          </div>

          {target === 'selected' && <>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={14} color={S.txtL} style={{ position: 'absolute', left: 12, top: 10 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: `1px solid ${S.bdr}`, fontSize: 12, outline: 'none', fontFamily: S.font, boxSizing: 'border-box' }} />
            </div>
            <div style={{ background: S.card, border: `1px solid ${S.bdr}`, borderRadius: 12, maxHeight: 300, overflowY: 'auto' }}>
              {filtered.map((c, i) => (
                <button key={c.id} onClick={() => toggleClient(c.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
                  border: 'none', borderBottom: i < filtered.length - 1 ? `1px solid ${S.bdr}` : 'none',
                  background: selected.includes(c.id) ? 'rgba(200,163,76,0.04)' : S.card,
                  cursor: 'pointer', textAlign: 'left', fontFamily: S.font,
                }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: selected.includes(c.id) ? `2px solid ${gold}` : `2px solid ${S.bdr}`, background: selected.includes(c.id) ? gold : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selected.includes(c.id) && <Check size={10} color="#fff" />}
                  </div>
                  <span style={{ fontSize: 12, color: S.h }}>{c.name || c.email}</span>
                </button>
              ))}
            </div>
          </>}

          {/* History */}
          {history.length > 0 && <>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: S.h, margin: '20px 0 10px' }}>Recent Notifications</h3>
            <div style={{ background: S.card, border: `1px solid ${S.bdr}`, borderRadius: 12 }}>
              {history.slice(0, 5).map((n, i) => (
                <div key={i} style={{ padding: '10px 14px', borderBottom: i < Math.min(history.length, 5) - 1 ? `1px solid ${S.bdr}` : 'none' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: S.h, margin: 0 }}>{n.title}</p>
                  <p style={{ fontSize: 11, color: S.txtM, margin: '1px 0 0' }}>To {n.recipient_count} · {n.sent_at ? new Date(n.sent_at).toLocaleDateString('en-GB') : ''}</p>
                </div>
              ))}
            </div>
          </>}
        </div>
      </div>
    </div>
  )
}
