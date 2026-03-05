/**
 * Portal Clients — Client Portal Management
 * Searchable list of all consumer accounts linked to this business.
 * Click into any client to see their full profile: bookings, forms, messages, spend.
 */
import { useState, useEffect } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import { Search, User, Calendar, FileText, MessageSquare, ChevronRight, ArrowLeft } from 'lucide-react'

const API = '/api'
const fetchApi = async (path, opts = {}) => {
  const token = sessionStorage.getItem('reeveos_admin_token') || sessionStorage.getItem('rezvo_token') || localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const res = await fetch(`${API}${path}`, { ...opts, headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const gold = '#C9A84C'

export default function PortalClients() {
  const { business } = useBusiness()
  const bizId = business?._id || business?.id || ''
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [clientDetail, setClientDetail] = useState(null)

  useEffect(() => { if (bizId) loadClients() }, [bizId])

  const loadClients = async () => {
    setLoading(true)
    try {
      const d = await fetchApi(`/client/business/${bizId}/portal-clients`)
      setClients(d.clients || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const openClient = async (client) => {
    setSelected(client)
    try {
      const d = await fetchApi(`/client/business/${bizId}/portal-clients/${client.id}`)
      setClientDetail(d)
    } catch (e) { console.error(e) }
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return !q || (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
  })

  const S = { font: "'Figtree',-apple-system,sans-serif", h: '#111', txt: '#374151', txtM: '#6B7280', txtL: '#9CA3AF', bdr: '#E5E7EB', bg: '#F9FAFB', card: '#fff' }

  // ─── Client Detail View ───
  if (selected && clientDetail) return (
    <div style={{ fontFamily: S.font, padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <button onClick={() => { setSelected(null); setClientDetail(null) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: S.txtM, marginBottom: 20, fontFamily: S.font }}>
        <ArrowLeft size={16} /> Back to client list
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: 99, background: S.bg, border: `2px solid ${gold}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: gold }}>
          {(clientDetail.name || '?').charAt(0)}
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: S.h, margin: 0 }}>{clientDetail.name}</h1>
          <p style={{ fontSize: 13, color: S.txtM, margin: '2px 0 0' }}>{clientDetail.email}{clientDetail.phone ? ` · ${clientDetail.phone}` : ''}</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Visits', value: clientDetail.visit_count || 0 },
          { label: 'Total Spent', value: `£${(clientDetail.total_spend || 0).toFixed(2)}` },
          { label: 'Form Status', value: clientDetail.consultation_status || 'None' },
          { label: 'Member Since', value: clientDetail.created_at ? new Date(clientDetail.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—' },
        ].map((s, i) => (
          <div key={i} style={{ background: S.card, border: `1px solid ${S.bdr}`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: S.h, margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: S.txtM, margin: '2px 0 0' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bookings */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: S.h, margin: '0 0 10px' }}>Booking History</h3>
      <div style={{ background: S.card, border: `1px solid ${S.bdr}`, borderRadius: 12, marginBottom: 24 }}>
        {(clientDetail.bookings || []).length === 0 ? (
          <p style={{ padding: 20, textAlign: 'center', fontSize: 13, color: S.txtM, margin: 0 }}>No bookings yet.</p>
        ) : (clientDetail.bookings || []).map((b, i) => (
          <div key={i} style={{ padding: '12px 16px', borderBottom: i < (clientDetail.bookings || []).length - 1 ? `1px solid ${S.bdr}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: S.h, margin: 0 }}>{b.service}</p>
              <p style={{ fontSize: 12, color: S.txtM, margin: '2px 0 0' }}>{b.date}{b.time ? ` at ${b.time}` : ''}{b.staff ? ` · ${b.staff}` : ''}</p>
            </div>
            {b.price && <span style={{ fontSize: 14, fontWeight: 700, color: S.h }}>£{b.price}</span>}
          </div>
        ))}
      </div>

      {/* Consultation Form */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: S.h, margin: '0 0 10px' }}>Consultation Form</h3>
      <div style={{ background: S.card, border: `1px solid ${S.bdr}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        {clientDetail.consultation ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 12, background: clientDetail.consultation.status === 'clear' ? '#ecfdf5' : clientDetail.consultation.status === 'flagged' ? '#fff7ed' : '#fef2f2', color: clientDetail.consultation.status === 'clear' ? '#059669' : clientDetail.consultation.status === 'flagged' ? '#ea580c' : '#dc2626' }}>
                  {(clientDetail.consultation.status || 'submitted').charAt(0).toUpperCase() + (clientDetail.consultation.status || 'submitted').slice(1)}
                </span>
                <span style={{ fontSize: 12, color: S.txtM, marginLeft: 10 }}>Submitted {clientDetail.consultation.submitted_at ? new Date(clientDetail.consultation.submitted_at).toLocaleDateString('en-GB') : ''}</span>
              </div>
            </div>
            {clientDetail.consultation.alerts && (clientDetail.consultation.alerts.blocks?.length > 0 || clientDetail.consultation.alerts.flags?.length > 0) && (
              <div style={{ marginTop: 12 }}>
                {(clientDetail.consultation.alerts.blocks || []).map((a, i) => (
                  <p key={i} style={{ fontSize: 12, color: '#dc2626', margin: '4px 0' }}>BLOCKED: {a.treatment} — {a.condition}</p>
                ))}
                {(clientDetail.consultation.alerts.flags || []).map((a, i) => (
                  <p key={i} style={{ fontSize: 12, color: '#ea580c', margin: '4px 0' }}>FLAG: {a.treatment} — {a.condition}</p>
                ))}
              </div>
            )}
          </div>
        ) : <p style={{ fontSize: 13, color: S.txtM, margin: 0 }}>No consultation form submitted yet.</p>}
      </div>
    </div>
  )

  // ─── Client List View ───
  return (
    <div style={{ fontFamily: S.font, padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: S.h, margin: '0 0 4px' }}>Portal Clients</h1>
      <p style={{ fontSize: 13, color: S.txtM, margin: '0 0 20px' }}>All customers who have signed up through your client portal.</p>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={16} color={S.txtL} style={{ position: 'absolute', left: 14, top: 12 }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone..."
          style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10, border: `1px solid ${S.bdr}`, fontSize: 14, outline: 'none', fontFamily: S.font, boxSizing: 'border-box' }}
        />
      </div>

      {/* List */}
      <div style={{ background: S.card, border: `1px solid ${S.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 40, textAlign: 'center', color: S.txtM, fontSize: 13 }}>Loading clients...</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <User size={28} color={S.bdr} />
            <p style={{ fontSize: 14, fontWeight: 600, color: S.txt, marginTop: 10 }}>{search ? 'No clients match your search' : 'No portal clients yet'}</p>
            <p style={{ fontSize: 12, color: S.txtM }}>Clients will appear here once they sign up through your portal.</p>
          </div>
        ) : filtered.map((c, i) => (
          <button key={c.id} onClick={() => openClient(c)} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px',
            border: 'none', borderBottom: i < filtered.length - 1 ? `1px solid ${S.bdr}` : 'none',
            background: S.card, cursor: 'pointer', textAlign: 'left', fontFamily: S.font,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 99, background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User size={18} color={S.txtM} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: S.h, margin: 0 }}>{c.name || 'Unnamed'}</p>
              <p style={{ fontSize: 12, color: S.txtM, margin: '1px 0 0' }}>{c.email}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {c.consultation_status && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8, background: c.consultation_status === 'clear' ? '#ecfdf5' : c.consultation_status === 'submitted' ? '#eff6ff' : '#fff7ed', color: c.consultation_status === 'clear' ? '#059669' : c.consultation_status === 'submitted' ? '#2563eb' : '#ea580c' }}>{c.consultation_status}</span>}
              <p style={{ fontSize: 11, color: S.txtL, margin: '2px 0 0' }}>{c.visit_count || 0} visits</p>
            </div>
            <ChevronRight size={16} color={S.bdr} />
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: S.txtL, marginTop: 12, textAlign: 'center' }}>{filtered.length} client{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
