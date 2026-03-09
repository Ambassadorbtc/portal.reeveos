/**
 * AdminPartners.jsx — Partner Programme Management
 * Embedded in the Admin CRM section.
 * Proxies to partners.reeveos.app via /api/admin/partners/*
 * Monochrome Lucide icons only. No emojis.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Users, Clock, CheckCircle, XCircle, PauseCircle,
  Search, RefreshCw, ExternalLink, ChevronDown, ChevronUp,
  Handshake, PoundSterling, UserCheck, TrendingUp, BarChart3,
  Mail, Phone, Globe, Calendar, ArrowLeft
} from 'lucide-react'

async function adminFetch(url, options = {}) {
  const token = sessionStorage.getItem('reeveos_admin_token')
  const headers = { ...options.headers }
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    sessionStorage.removeItem('reeveos_admin_token')
    window.location.reload()
    throw new Error('Session expired')
  }
  return res
}

const GOLD = '#C9A84C'
const API = '/api/admin/partners'

const fDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fCur = p => p != null ? `£${(p / 100).toFixed(2)}` : '£0.00'

const STATUS_COLOURS = {
  pending:   { bg: 'rgba(251,191,36,0.1)',  text: '#FBBF24', border: 'rgba(251,191,36,0.3)'  },
  active:    { bg: 'rgba(52,211,153,0.1)',  text: '#34D399', border: 'rgba(52,211,153,0.3)'  },
  rejected:  { bg: 'rgba(248,113,113,0.1)', text: '#F87171', border: 'rgba(248,113,113,0.3)' },
  suspended: { bg: 'rgba(156,163,175,0.1)', text: '#9CA3AF', border: 'rgba(156,163,175,0.3)' },
}

function StatusBadge({ status }) {
  const c = STATUS_COLOURS[status] || STATUS_COLOURS.pending
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>
      {status}
    </span>
  )
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={GOLD} />
        </div>
        <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ─── Applications Tab ─────────────────────────────────────────
function ApplicationsTab() {
  const [data, setData] = useState({ affiliates: [], total: 0 })
  const [status, setStatus] = useState('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ status, page, limit: 25, search }).toString()
      const res = await adminFetch(`${API}/affiliates?${q}`)
      const d = await res.json()
      setData(d)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [status, page, search])

  useEffect(() => { load() }, [load])

  async function act(id, action) {
    if (action === 'suspend' && !window.confirm('Suspend this partner?')) return
    setActing(id + action)
    try {
      await adminFetch(`${API}/affiliates/${id}/${action}`, { method: 'PUT' })
      load()
    } finally {
      setActing(null)
    }
  }

  const STATUS_TABS = ['pending', 'active', 'rejected', 'suspended']

  return (
    <div>
      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #222', paddingBottom: 0 }}>
        {STATUS_TABS.map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: 'transparent', textTransform: 'capitalize',
              color: status === s ? GOLD : '#555',
              borderBottom: status === s ? `2px solid ${GOLD}` : '2px solid transparent',
              transition: 'all 0.15s'
            }}>
            {s}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} color="#555" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search name or email..."
          style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#ccc', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Count */}
      <div style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>{data.total} {status} partner{data.total !== 1 ? 's' : ''}</div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>
          <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: 13 }}>Loading...</div>
        </div>
      ) : data.affiliates?.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#444', fontSize: 13 }}>
          No {status} applications
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.affiliates.map(a => (
            <div key={a.id} style={{ background: '#111', border: '1px solid #222', borderRadius: 10, overflow: 'hidden' }}>
              {/* Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>
                    {(a.first_name?.[0] || '') + (a.last_name?.[0] || '')}
                  </span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#ddd' }}>
                      {a.first_name} {a.last_name}
                    </span>
                    <StatusBadge status={a.status} />
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{a.email}</div>
                </div>

                {/* Meta */}
                <div style={{ fontSize: 11, color: '#444', textAlign: 'right', flexShrink: 0 }}>
                  <div>Applied {fDate(a.created_at)}</div>
                  {a.referral_code && <div style={{ color: '#555', marginTop: 2 }}>Code: {a.referral_code}</div>}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {a.status === 'pending' && (
                    <>
                      <ActionBtn label="Approve" icon={CheckCircle} color="#34D399"
                        loading={acting === a.id + 'approve'} onClick={() => act(a.id, 'approve')} />
                      <ActionBtn label="Reject" icon={XCircle} color="#F87171"
                        loading={acting === a.id + 'reject'} onClick={() => act(a.id, 'reject')} />
                    </>
                  )}
                  {a.status === 'active' && (
                    <ActionBtn label="Suspend" icon={PauseCircle} color="#9CA3AF"
                      loading={acting === a.id + 'suspend'} onClick={() => act(a.id, 'suspend')} />
                  )}
                  {(a.status === 'rejected' || a.status === 'suspended') && (
                    <ActionBtn label="Approve" icon={CheckCircle} color="#34D399"
                      loading={acting === a.id + 'approve'} onClick={() => act(a.id, 'approve')} />
                  )}
                  <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                    style={{ padding: '6px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center' }}>
                    {expanded === a.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === a.id && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid #1d1d1d', background: '#0d0d0d', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {a.phone && <Detail icon={Phone} label="Phone" value={a.phone} />}
                  {a.company && <Detail icon={Handshake} label="Company" value={a.company} />}
                  {a.website && <Detail icon={Globe} label="Website" value={a.website} />}
                  {a.expected_referrals && <Detail icon={TrendingUp} label="Expected referrals/mo" value={a.expected_referrals} />}
                  {a.how_promote && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 11, color: '#444', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>How they'll promote</div>
                      <div style={{ fontSize: 13, color: '#999', lineHeight: 1.5, background: '#111', border: '1px solid #222', borderRadius: 6, padding: 10 }}>{a.how_promote}</div>
                    </div>
                  )}
                  {a.ref_code && <Detail icon={UserCheck} label="Referred by" value={a.ref_code} />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Active Partners Tab ──────────────────────────────────────
function ActivePartnersTab() {
  const [data, setData] = useState({ affiliates: [], total: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const q = new URLSearchParams({ status: 'active', page: 1, limit: 50, search }).toString()
        const res = await adminFetch(`${API}/affiliates?${q}`)
        const d = await res.json()
        setData(d)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [search])

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} color="#555" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search active partners..."
          style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#ccc', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#555', fontSize: 13 }}>Loading...</div>
      ) : data.affiliates?.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#444', fontSize: 13 }}>No active partners yet</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
          <thead>
            <tr>
              {['Partner', 'Referral Code', 'Referrals', 'MRR Generated', 'Total Earned', 'Joined'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 12px 8px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.affiliates.map(a => (
              <tr key={a.id}>
                <td style={{ background: '#111', border: '1px solid #1d1d1d', borderRadius: '8px 0 0 8px', padding: '12px 12px' }}>
                  <div style={{ fontWeight: 600, color: '#ddd', fontSize: 13 }}>{a.first_name} {a.last_name}</div>
                  <div style={{ fontSize: 11, color: '#555' }}>{a.email}</div>
                </td>
                <td style={{ background: '#111', border: '1px solid #1d1d1d', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', padding: '12px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: GOLD, background: 'rgba(201,168,76,0.08)', padding: '2px 8px', borderRadius: 4 }}>{a.referral_code || '—'}</span>
                </td>
                <td style={{ background: '#111', border: '1px solid #1d1d1d', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', padding: '12px', fontSize: 13, color: '#aaa' }}>{a.stats?.total_referrals ?? 0}</td>
                <td style={{ background: '#111', border: '1px solid #1d1d1d', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', padding: '12px', fontSize: 13, color: '#aaa' }}>{fCur(a.stats?.mrr_generated_pence)}</td>
                <td style={{ background: '#111', border: '1px solid #1d1d1d', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', padding: '12px', fontSize: 13, color: '#aaa' }}>{fCur(a.stats?.total_commission_pence)}</td>
                <td style={{ background: '#111', border: '1px solid #1d1d1d', borderRadius: '0 8px 8px 0', borderLeft: 'none', padding: '12px', fontSize: 12, color: '#555' }}>{fDate(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Commissions Tab ──────────────────────────────────────────
function CommissionsTab() {
  const [data, setData] = useState({ commissions: [], total: 0 })
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const q = new URLSearchParams({ status, page: 1 }).toString()
        const res = await adminFetch(`${API}/commissions?${q}`)
        const d = await res.json()
        setData(d)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [status])

  const total = data.commissions?.reduce((sum, c) => sum + (c.commission_amount_pence || 0), 0) || 0

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #222' }}>
        {['pending', 'paid', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: 'transparent', textTransform: 'capitalize',
              color: status === s ? GOLD : '#555',
              borderBottom: status === s ? `2px solid ${GOLD}` : '2px solid transparent',
            }}>
            {s}
          </button>
        ))}
      </div>

      {status === 'pending' && total > 0 && (
        <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <PoundSterling size={16} color={GOLD} />
          <span style={{ fontSize: 13, color: '#aaa' }}>Total pending payouts: </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>{fCur(total)}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#555', fontSize: 13 }}>Loading...</div>
      ) : !data.commissions?.length ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#444', fontSize: 13 }}>No {status} commissions</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
          <thead>
            <tr>
              {['Partner', 'Amount', 'Type', 'Period', 'Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 12px 8px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.commissions.map(c => (
              <tr key={c.id}>
                <td style={{ background: '#111', border: '1px solid #1d1d1d', borderRadius: '8px 0 0 8px', padding: '12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>{c.affiliate_name || c.affiliate_id}</div>
                </td>
                <td style={{ background: '#111', border: '1px solid #1d1d1d', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', padding: '12px', fontSize: 14, fontWeight: 700, color: GOLD }}>{fCur(c.commission_amount_pence)}</td>
                <td style={{ background: '#111', border: '1px solid #1d1d1d', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', padding: '12px', fontSize: 12, color: '#777', textTransform: 'capitalize' }}>{c.commission_type?.replace('_', ' ') || '—'}</td>
                <td style={{ background: '#111', border: '1px solid #1d1d1d', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', padding: '12px', fontSize: 12, color: '#555' }}>{c.period_month || fDate(c.created_at)}</td>
                <td style={{ background: '#111', border: '1px solid #1d1d1d', borderRadius: '0 8px 8px 0', borderLeft: 'none', padding: '12px' }}>
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Helper components ────────────────────────────────────────
function ActionBtn({ label, icon: Icon, color, loading: isLoading, onClick }) {
  return (
    <button onClick={onClick} disabled={isLoading}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
        background: 'transparent', border: `1px solid ${color}22`,
        borderRadius: 6, cursor: isLoading ? 'not-allowed' : 'pointer',
        color: isLoading ? '#444' : color, fontSize: 12, fontWeight: 600,
        transition: 'all 0.15s', opacity: isLoading ? 0.5 : 1
      }}>
      <Icon size={13} />
      {label}
    </button>
  )
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <Icon size={13} color="#444" style={{ marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#888' }}>{value}</div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────
const TABS = [
  { id: 'applications', label: 'Applications', icon: Clock },
  { id: 'active', label: 'Active Partners', icon: UserCheck },
  { id: 'commissions', label: 'Commissions', icon: PoundSterling },
]

export default function AdminPartners() {
  const [tab, setTab] = useState('applications')
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    adminFetch(`${API}/overview`)
      .then(r => r.json())
      .then(d => setOverview(d))
      .catch(() => {})
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Partner Programme</h1>
            <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Manage applications, active partners and commissions</p>
          </div>
          <a href="https://partners.reeveos.app/admin" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#777', fontSize: 12, fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s' }}>
            <ExternalLink size={13} />
            Full Partner Portal
          </a>
        </div>
      </div>

      {/* Stats */}
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <StatCard icon={Users} label="Total Partners" value={overview.total_affiliates} />
          <StatCard icon={UserCheck} label="Active" value={overview.active_affiliates} />
          <StatCard icon={Clock} label="Pending Review" value={overview.pending_applications} sub="Awaiting approval" />
          <StatCard icon={PoundSterling} label="Pending Payouts"
            value={overview.commission_stats?.pending ? fCur(overview.commission_stats.pending.total) : '£0'}
            sub={`${overview.commission_stats?.pending?.count ?? 0} commissions`} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ background: '#111', border: '1px solid #1d1d1d', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #1d1d1d', padding: '0 20px' }}>
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '14px 16px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: active ? GOLD : '#555', fontSize: 13, fontWeight: 600,
                  borderBottom: active ? `2px solid ${GOLD}` : '2px solid transparent',
                  marginBottom: -1, transition: 'all 0.15s'
                }}>
                <Icon size={15} />
                {t.label}
              </button>
            )
          })}
        </div>

        <div style={{ padding: 20 }}>
          {tab === 'applications' && <ApplicationsTab />}
          {tab === 'active' && <ActivePartnersTab />}
          {tab === 'commissions' && <CommissionsTab />}
        </div>
      </div>
    </div>
  )
}
