/**
 * Client Email Management — Client Portal Management
 * Send targeted emails or offers to portal clients.
 */
import { useState, useEffect } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import { Mail, Send, Users, Search, Check, ChevronDown } from 'lucide-react'

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

export default function ClientEmails() {
  const { business } = useBusiness()
  const bizId = business?._id || business?.id || ''
  const [clients, setClients] = useState([])
  const [selected, setSelected] = useState([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState([])

  useEffect(() => { if (bizId) loadData() }, [bizId])

  const loadData = async () => {
    try {
      const d = await fetchApi(`/client/business/${bizId}/portal-clients`)
      setClients(d.clients || [])
    } catch (e) {}
    try {
      const d = await fetchApi(`/client/business/${bizId}/email-history`)
      setHistory(d.emails || [])
    } catch (e) {}
  }

  const toggleClient = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const selectAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map(c => c.id))

  const sendEmail = async () => {
    if (!subject.trim() || !body.trim() || selected.length === 0) return
    setSending(true)
    try {
      await fetchApi(`/client/business/${bizId}/send-email`, {
        method: 'POST',
        body: JSON.stringify({ client_ids: selected, subject, body }),
      })
      setSent(true)
      setSubject('')
      setBody('')
      setSelected([])
      setTimeout(() => setSent(false), 3000)
      loadData()
    } catch (e) { alert(e.message) }
    setSending(false)
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return !q || (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
  })

  return (
    <div style={{ fontFamily: S.font, padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: S.h, margin: '0 0 4px' }}>Email Management</h1>
      <p style={{ fontSize: 13, color: S.txtM, margin: '0 0 24px' }}>Send targeted emails or special offers to your portal clients.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Compose */}
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: S.h, margin: '0 0 12px' }}>Compose Email</h3>
          <div style={{ background: S.card, border: `1px solid ${S.bdr}`, borderRadius: 12, padding: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: S.txt, display: 'block', marginBottom: 4 }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Spring Treatment Offer" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.bdr}`, fontSize: 14, outline: 'none', fontFamily: S.font, boxSizing: 'border-box', marginBottom: 14 }} />

            <label style={{ fontSize: 12, fontWeight: 600, color: S.txt, display: 'block', marginBottom: 4 }}>Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your email content..." rows={8} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.bdr}`, fontSize: 14, outline: 'none', fontFamily: S.font, boxSizing: 'border-box', resize: 'vertical', marginBottom: 14 }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: S.txtM }}>{selected.length} recipient{selected.length !== 1 ? 's' : ''} selected</span>
              <button onClick={sendEmail} disabled={sending || !subject.trim() || !body.trim() || selected.length === 0} style={{
                padding: '10px 24px', borderRadius: 99, border: 'none',
                background: subject.trim() && body.trim() && selected.length > 0 ? gold : S.bdr,
                color: subject.trim() && body.trim() && selected.length > 0 ? '#111' : S.txtL,
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: S.font,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {sent ? <><Check size={14} /> Sent!</> : sending ? 'Sending...' : <><Send size={14} /> Send Email</>}
              </button>
            </div>
          </div>

          {/* History */}
          {history.length > 0 && <>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: S.h, margin: '24px 0 12px' }}>Recent Emails</h3>
            <div style={{ background: S.card, border: `1px solid ${S.bdr}`, borderRadius: 12 }}>
              {history.slice(0, 5).map((e, i) => (
                <div key={i} style={{ padding: '12px 16px', borderBottom: i < Math.min(history.length, 5) - 1 ? `1px solid ${S.bdr}` : 'none' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: S.h, margin: 0 }}>{e.subject}</p>
                  <p style={{ fontSize: 11, color: S.txtM, margin: '2px 0 0' }}>To {e.recipient_count} client{e.recipient_count !== 1 ? 's' : ''} · {e.sent_at ? new Date(e.sent_at).toLocaleDateString('en-GB') : ''}</p>
                </div>
              ))}
            </div>
          </>}
        </div>

        {/* Client selector */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: S.h, margin: 0 }}>Select Recipients</h3>
            <button onClick={selectAll} style={{ fontSize: 12, color: gold, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: S.font }}>
              {selected.length === filtered.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={14} color={S.txtL} style={{ position: 'absolute', left: 12, top: 11 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: `1px solid ${S.bdr}`, fontSize: 13, outline: 'none', fontFamily: S.font, boxSizing: 'border-box' }} />
          </div>
          <div style={{ background: S.card, border: `1px solid ${S.bdr}`, borderRadius: 12, maxHeight: 420, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <p style={{ padding: 20, textAlign: 'center', fontSize: 13, color: S.txtM }}>No clients found.</p>
            ) : filtered.map((c, i) => (
              <button key={c.id} onClick={() => toggleClient(c.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px',
                border: 'none', borderBottom: i < filtered.length - 1 ? `1px solid ${S.bdr}` : 'none',
                background: selected.includes(c.id) ? 'rgba(200,163,76,0.04)' : S.card,
                cursor: 'pointer', textAlign: 'left', fontFamily: S.font,
              }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, border: selected.includes(c.id) ? `2px solid ${gold}` : `2px solid ${S.bdr}`, background: selected.includes(c.id) ? gold : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selected.includes(c.id) && <Check size={12} color="#fff" />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: S.h, margin: 0 }}>{c.name || 'Unnamed'}</p>
                  <p style={{ fontSize: 11, color: S.txtM, margin: 0 }}>{c.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
