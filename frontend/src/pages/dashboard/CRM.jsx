/**
 * CRM.jsx — Complete Client Relationship Management
 * Single page with 4 views: Dashboard, Pipeline, Clients, Analytics
 * Click any client → Detail panel slides in from right
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import AppLoader from '../../components/shared/AppLoader'
import {
  LayoutDashboard, Columns3, Users, BarChart3, Search, X, Phone, Mail,
  Calendar, Clock, ChevronRight, ArrowLeft, Plus, CheckCircle, AlertTriangle,
  TrendingUp, TrendingDown, Heart, Target, Star, Tag, FileText, MessageSquare,
  Activity, DollarSign, Package, ShoppingBag, Clipboard, Send, UserPlus
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const GOLD = '#C9A84C'
const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'pipeline', label: 'Pipeline', Icon: Columns3 },
  { id: 'clients', label: 'Clients', Icon: Users },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
]

const STAGE_COLORS = {
  new_lead: '#6B7280', consultation: '#3B82F6', first_treatment: '#F59E0B',
  regular: '#10B981', package_holder: '#8B5CF6', at_risk: '#EF4444', lapsed: '#9CA3AF',
}

const HEALTH_COLORS = { excellent: '#10B981', good: '#34D399', fair: '#F59E0B', poor: '#EF4444', critical: '#991B1B' }

const CATEGORY_ICONS = {
  booking: Calendar, clinical: FileText, comms: MessageSquare, financial: DollarSign,
  package: Package, retail: ShoppingBag, pipeline: Target, profile: Users,
  portal: Users, marketing: Send, gdpr: FileText, academy: Star,
}

const getInit = (n) => (n || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
const ABG = ['#FEF3C7','#DBEAFE','#FCE7F3','#D1FAE5','#EDE9FE','#FEE2E2','#E0E7FF']
const getABG = (n) => ABG[Math.abs([...(n||'')].reduce((h,c) => c.charCodeAt(0)+((h<<5)-h), 0)) % ABG.length]

const healthLabel = (s) => s >= 80 ? 'Excellent' : s >= 60 ? 'Good' : s >= 40 ? 'Fair' : s >= 20 ? 'Poor' : 'Critical'
const healthColor = (s) => s >= 80 ? '#10B981' : s >= 60 ? '#34D399' : s >= 40 ? '#F59E0B' : s >= 20 ? '#EF4444' : '#991B1B'

const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) } catch { return '—' } }
const fmtCurrency = (v) => `£${(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function CRM() {
  const { business } = useBusiness()
  const bid = business?.id ?? business?._id
  const [view, setView] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)
  const [pipelineData, setPipelineData] = useState(null)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientDetail, setClientDetail] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [dragItem, setDragItem] = useState(null)
  const [interactionModal, setInteractionModal] = useState(false)

  // Load data based on view
  const loadDashboard = useCallback(async () => {
    if (!bid) return
    try { const r = await api.get(`/crm/business/${bid}/dashboard`); setDashboard(r) } catch (e) { console.error(e) }
    setLoading(false)
  }, [bid])

  const loadPipeline = useCallback(async () => {
    if (!bid) return
    try { const r = await api.get(`/crm/business/${bid}/pipeline`); setPipelineData(r) } catch (e) { console.error(e) }
    setLoading(false)
  }, [bid])

  const loadClients = useCallback(async () => {
    if (!bid) return
    try {
      const r = await api.get(`/clients/business/${bid}?limit=200`)
      setClients(r.clients || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [bid])

  const loadAnalytics = useCallback(async () => {
    if (!bid) return
    try { const r = await api.get(`/crm/business/${bid}/analytics`); setAnalyticsData(r) } catch (e) { console.error(e) }
    setLoading(false)
  }, [bid])

  const loadClientDetail = useCallback(async (cid) => {
    if (!bid || !cid) return
    try {
      const [detail, tl] = await Promise.all([
        api.get(`/crm/business/${bid}/client/${cid}`),
        api.get(`/crm/business/${bid}/client/${cid}/timeline?limit=30`),
      ])
      setClientDetail(detail)
      setTimeline(tl.events || [])
    } catch (e) { console.error(e) }
  }, [bid])

  useEffect(() => {
    setLoading(true)
    if (view === 'dashboard') loadDashboard()
    else if (view === 'pipeline') loadPipeline()
    else if (view === 'clients') loadClients()
    else if (view === 'analytics') loadAnalytics()
  }, [view, loadDashboard, loadPipeline, loadClients, loadAnalytics])

  useEffect(() => {
    if (selectedClient) loadClientDetail(selectedClient.id || selectedClient)
  }, [selectedClient, loadClientDetail])

  const openClient = (c) => setSelectedClient(typeof c === 'string' ? { id: c } : c)
  const closeClient = () => { setSelectedClient(null); setClientDetail(null); setTimeline([]) }

  const moveClient = async (clientId, newStage) => {
    try {
      await api.patch(`/crm/business/${bid}/pipeline/${clientId}/move`, { stage: newStage })
      loadPipeline()
    } catch (e) { console.error(e) }
  }

  if (loading && !dashboard && !pipelineData) return <AppLoader message="Loading CRM..." />

  return (
    <div style={{ fontFamily: "'Figtree', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', background: '#FAFAF8' }}>
      {/* ── Top Nav ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #EBEBEB', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none',
              background: view === v.id ? '#111' : 'transparent', color: view === v.id ? '#fff' : '#666',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif",
              transition: 'all 0.15s',
            }}>
              <v.Icon size={15} /> {v.label}
            </button>
          ))}
        </div>
        {view === 'clients' && (
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#999' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..."
              style={{ paddingLeft: 32, padding: '7px 12px 7px 32px', border: '1px solid #E0E0E0', borderRadius: 10, fontSize: 13, width: 220, outline: 'none', fontFamily: "'Figtree', sans-serif" }} />
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: view === 'pipeline' ? 'auto' : 'hidden' }}>
          {view === 'dashboard' && <DashboardView data={dashboard} onClientClick={openClient} />}
          {view === 'pipeline' && <PipelineView data={pipelineData} onClientClick={openClient} moveClient={moveClient} dragItem={dragItem} setDragItem={setDragItem} />}
          {view === 'clients' && <ClientListView clients={clients} search={search} onClientClick={openClient} />}
          {view === 'analytics' && <AnalyticsView data={analyticsData} />}
        </div>

        {/* ── Client Detail Panel ── */}
        {selectedClient && (
          <>
            <div onClick={closeClient} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 200, cursor: 'pointer' }} />
            <ClientDetailPanel detail={clientDetail} timeline={timeline} onClose={closeClient} bid={bid}
              onInteraction={() => setInteractionModal(true)} onReload={() => loadClientDetail(selectedClient.id || selectedClient)} />
          </>
        )}
      </div>

      {/* ── Interaction Modal ── */}
      {interactionModal && selectedClient && (
        <InteractionModal bid={bid} clientId={clientDetail?.client?.id || selectedClient.id || selectedClient}
          clientName={clientDetail?.client?.name || selectedClient.name || ''}
          onClose={() => setInteractionModal(false)}
          onSaved={() => { setInteractionModal(false); loadClientDetail(selectedClient.id || selectedClient) }} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════
function DashboardView({ data, onClientClick }) {
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading dashboard...</div>
  const { kpis, pipeline, health_distribution, recent_activity, sources } = data

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Clients', value: kpis.total_clients, Icon: Users, color: '#111' },
          { label: 'New This Week', value: kpis.new_this_week, Icon: UserPlus, color: '#3B82F6' },
          { label: 'Revenue MTD', value: fmtCurrency(kpis.revenue_mtd), Icon: TrendingUp, color: '#10B981' },
          { label: 'At Risk', value: kpis.at_risk_count, Icon: AlertTriangle, color: '#EF4444' },
          { label: 'Forms Expiring', value: kpis.forms_expiring, Icon: FileText, color: '#F59E0B' },
          { label: 'Tasks Due', value: kpis.tasks_due, Icon: CheckCircle, color: '#8B5CF6' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #EBEBEB' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>{k.label}</span>
              <k.Icon size={16} color={k.color} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#111' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Pipeline Summary */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #EBEBEB' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 14px' }}>Pipeline</h3>
          {(pipeline.stages || []).map(s => {
            const count = pipeline.counts[s.id] || 0
            const total = kpis.total_clients || 1
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#333', flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{count}</span>
                <div style={{ width: 60, height: 6, borderRadius: 3, background: '#F3F4F6', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(count / total * 100)}%`, height: '100%', background: s.color, borderRadius: 3 }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Health Distribution */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #EBEBEB' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 14px' }}>Client Health</h3>
          {Object.entries(health_distribution || {}).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: HEALTH_COLORS[k], flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#333', flex: 1, textTransform: 'capitalize' }}>{k}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #EBEBEB', gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 14px' }}>Recent Activity</h3>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {(recent_activity || []).map((ev, i) => {
              const CatIcon = CATEGORY_ICONS[ev.category] || Activity
              return (
                <div key={ev.id || i} onClick={() => ev.client_id && onClientClick({ id: ev.client_id, name: ev.client_name })}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F5F5F5', cursor: ev.client_id ? 'pointer' : 'default' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F5F5F3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CatIcon size={13} color="#888" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.client_name ? <span style={{ color: GOLD }}>{ev.client_name}</span> : null}
                      {ev.client_name ? ' — ' : ''}{ev.summary}
                    </div>
                    <div style={{ fontSize: 10, color: '#999' }}>{fmtDate(ev.timestamp)} · {ev.actor?.name || 'System'}</div>
                  </div>
                  {ev.revenue_impact !== 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: ev.revenue_impact > 0 ? '#10B981' : '#EF4444' }}>
                      {ev.revenue_impact > 0 ? '+' : ''}{fmtCurrency(ev.revenue_impact)}
                    </span>
                  )}
                </div>
              )
            })}
            {(!recent_activity || recent_activity.length === 0) && (
              <p style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 20 }}>No activity yet. Events will appear as clients interact with your business.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PIPELINE VIEW
// ═══════════════════════════════════════════════════════════════
function PipelineView({ data, onClientClick, moveClient, dragItem, setDragItem }) {
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading pipeline...</div>
  const { stages, pipeline, stage_values } = data

  return (
    <div style={{ display: 'flex', gap: 12, padding: 16, height: '100%' }}>
      {(stages || []).map(stage => {
        const clients = pipeline[stage.id] || []
        const stageVal = stage_values?.[stage.id] || 0

        return (
          <div key={stage.id}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = '#EEEEE8' }}
            onDragLeave={e => { e.currentTarget.style.background = '#F5F5F3' }}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.background = '#F5F5F3'; if (dragItem && dragItem.stage !== stage.id) moveClient(dragItem.id, stage.id); setDragItem(null) }}
            style={{ minWidth: 260, maxWidth: 280, flex: '0 0 260px', background: '#F5F5F3', borderRadius: 14, display: 'flex', flexDirection: 'column', height: '100%', transition: 'background 0.15s' }}>

            {/* Stage Header */}
            <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{stage.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, background: '#E5E5E5', color: '#666', padding: '1px 6px', borderRadius: 8 }}>{clients.length}</span>
              </div>
              {stageVal > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: stage.color }}>{fmtCurrency(stageVal)}</span>}
            </div>

            {/* Cards */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {clients.map(c => (
                <div key={c.id} draggable onDragStart={() => setDragItem(c)} onDragEnd={() => setDragItem(null)}
                  onClick={() => onClientClick(c)}
                  style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', cursor: 'grab', border: '1px solid #EBEBEB', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', opacity: dragItem?.id === c.id ? 0.4 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: getABG(c.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{getInit(c.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    </div>
                    {/* Health score dot */}
                    <div title={`Health: ${c.health_score}`} style={{ width: 8, height: 8, borderRadius: '50%', background: healthColor(c.health_score), flexShrink: 0 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888' }}>
                    <span>{c.total_visits} visits · {fmtCurrency(c.total_spend)}</span>
                    {c.source && <span style={{ color: '#BBB' }}>{c.source}</span>}
                  </div>
                </div>
              ))}
              {clients.length === 0 && <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: '#BBB' }}>Empty</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CLIENT LIST VIEW
// ═══════════════════════════════════════════════════════════════
function ClientListView({ clients, search, onClientClick }) {
  const filtered = (clients || []).filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return (c.name || '').toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s) || (c.phone || '').includes(s)
  })

  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #EBEBEB', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 80px', gap: 8, padding: '10px 16px', borderBottom: '1px solid #EBEBEB', background: '#FAFAF8' }}>
          {['Client', 'Contact', 'Visits', 'Spend', 'Last Visit', 'Health'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>
        {/* Rows */}
        {filtered.map(c => {
          const hs = c.healthScore || c.health_score || 50
          return (
            <div key={c.id} onClick={() => onClientClick(c)}
              style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 80px', gap: 8, padding: '10px 16px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer', alignItems: 'center' }}
              onMouseOver={e => e.currentTarget.style.background = '#FAFAF8'} onMouseOut={e => e.currentTarget.style.background = '#fff'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: getABG(c.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{getInit(c.name)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{c.name}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                    {(c.tags || []).slice(0, 2).map(t => <span key={t} style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#F3F4F6', color: '#666' }}>{t}</span>)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.email || c.phone || '—'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{c.totalVisits || c.total_visits || 0}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{fmtCurrency(c.totalSpend || c.total_spend || 0)}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{fmtDate(c.lastVisit || c.last_visit)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: healthColor(hs) }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: healthColor(hs) }}>{hs}</span>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>No clients found</div>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ANALYTICS VIEW
// ═══════════════════════════════════════════════════════════════
function AnalyticsView({ data }) {
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading analytics...</div>

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Funnel */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #EBEBEB' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 14px' }}>Client Funnel</h3>
          {Object.entries(data.funnel || {}).map(([stage, count], i, arr) => {
            const maxCount = Math.max(...Object.values(data.funnel || {}), 1)
            const color = STAGE_COLORS[stage] || '#999'
            return (
              <div key={stage} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#333', textTransform: 'capitalize' }}>{stage.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{count}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(count / maxCount * 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Source Breakdown */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #EBEBEB' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 14px' }}>Acquisition Channels</h3>
          {Object.entries(data.sources || {}).sort((a, b) => b[1].count - a[1].count).map(([src, d]) => (
            <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #F5F5F5' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#333', flex: 1, textTransform: 'capitalize' }}>{src.replace(/_/g, ' ')}</span>
              <span style={{ fontSize: 11, color: '#888' }}>{d.count} clients</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>{fmtCurrency(d.revenue)}</span>
              <span style={{ fontSize: 10, color: '#BBB' }}>LTV: {fmtCurrency(d.ltv || 0)}</span>
            </div>
          ))}
          {Object.keys(data.sources || {}).length === 0 && <p style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>No source data yet</p>}
        </div>

        {/* Staff Performance */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #EBEBEB' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 14px' }}>Staff Performance</h3>
          {(data.staff_performance || []).map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: getABG(s.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{getInit(s.name)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{s.name}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{s.bookings} bookings · {s.unique_clients} clients</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{fmtCurrency(s.revenue)}</span>
            </div>
          ))}
          {(data.staff_performance || []).length === 0 && <p style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>No data yet</p>}
        </div>

        {/* Retention */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #EBEBEB' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 14px' }}>Key Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Retention Rate', value: `${data.retention_rate || 0}%`, color: '#10B981' },
              { label: 'Period Revenue', value: fmtCurrency(data.total_revenue_period), color: '#111' },
              { label: 'Total Clients', value: data.total_clients, color: '#3B82F6' },
              { label: 'Period', value: `${data.period_days} days`, color: '#888' },
            ].map(m => (
              <div key={m.label} style={{ background: '#FAFAF8', borderRadius: 10, padding: '12px 14px', border: '1px solid #EBEBEB' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: m.color, marginTop: 4 }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CLIENT DETAIL PANEL
// ═══════════════════════════════════════════════════════════════
function ClientDetailPanel({ detail, timeline, onClose, bid, onInteraction, onReload }) {
  if (!detail) return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '90vw', background: '#fff', zIndex: 201, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '-4px 0 30px rgba(0,0,0,0.1)' }}>
      <AppLoader message="Loading client..." />
    </div>
  )

  const { client, stats, health_score, pipeline_stage, consultation_form_status, bookings, tasks, ltv, referral_count } = detail

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, maxWidth: '90vw', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 30px rgba(0,0,0,0.1)' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #EBEBEB', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><ArrowLeft size={18} color="#666" /></button>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: getABG(client.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{getInit(client.name)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{client.name}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{client.email || client.phone}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: healthColor(health_score) }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: healthColor(health_score) }}>{health_score}</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Pipeline Stage */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Stage</span>
          <span style={{ display: 'inline-block', marginLeft: 8, padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${STAGE_COLORS[pipeline_stage] || '#999'}15`, color: STAGE_COLORS[pipeline_stage] || '#999', textTransform: 'capitalize' }}>
            {(pipeline_stage || 'new_lead').replace(/_/g, ' ')}
          </span>
          {consultation_form_status && (
            <span style={{ marginLeft: 8, padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: consultation_form_status === 'valid' ? '#ECFDF5' : '#FEF2F2', color: consultation_form_status === 'valid' ? '#10B981' : '#EF4444' }}>
              Form: {consultation_form_status}
            </span>
          )}
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Visits', value: stats.total_visits },
            { label: 'Spend', value: fmtCurrency(stats.total_spend) },
            { label: 'Avg', value: fmtCurrency(stats.avg_spend) },
            { label: 'No-shows', value: stats.no_shows },
            { label: 'Last Visit', value: fmtDate(stats.last_visit) },
            { label: 'Referrals', value: referral_count },
          ].map(s => (
            <div key={s.label} style={{ background: '#FAFAF8', borderRadius: 8, padding: '8px 10px', border: '1px solid #EBEBEB' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* LTV Breakdown */}
        {ltv && ltv.total > 0 && (
          <div style={{ background: '#FAFAF8', borderRadius: 10, padding: '10px 12px', border: '1px solid #EBEBEB', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>Lifetime Value</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 6 }}>{fmtCurrency(ltv.total)}</div>
            <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#666' }}>
              {ltv.treatments > 0 && <span>Treatments: {fmtCurrency(ltv.treatments)}</span>}
              {ltv.packages > 0 && <span>Packages: {fmtCurrency(ltv.packages)}</span>}
              {ltv.retail > 0 && <span>Retail: {fmtCurrency(ltv.retail)}</span>}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[
            { label: 'Log Interaction', Icon: Phone, onClick: onInteraction },
            { label: 'Send Message', Icon: MessageSquare, onClick: () => {} },
            { label: 'Book', Icon: Calendar, onClick: () => {} },
          ].map(a => (
            <button key={a.label} onClick={a.onClick} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 8px', borderRadius: 8, border: '1px solid #EBEBEB', background: '#fff', fontSize: 11, fontWeight: 600, color: '#333', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>
              <a.Icon size={13} /> {a.label}
            </button>
          ))}
        </div>

        {/* Tasks */}
        {tasks && tasks.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>Open Tasks</h4>
            {tasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F5F5F5' }}>
                <CheckCircle size={14} color={t.status === 'completed' ? '#10B981' : '#DDD'} />
                <span style={{ fontSize: 12, color: '#333', flex: 1 }}>{t.title}</span>
                <span style={{ fontSize: 10, color: '#999' }}>{fmtDate(t.due_date)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recent Bookings */}
        {bookings && bookings.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>Recent Bookings</h4>
            {bookings.slice(0, 8).map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F5F5F5' }}>
                <Calendar size={13} color="#BBB" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{b.service}</div>
                  <div style={{ fontSize: 10, color: '#999' }}>{fmtDate(b.date)} · {b.staff || 'Any'}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: b.status === 'completed' ? '#10B981' : b.status === 'cancelled' ? '#EF4444' : '#F59E0B', textTransform: 'capitalize' }}>{b.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Timeline */}
        <div>
          <h4 style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>Timeline</h4>
          {timeline.length > 0 ? timeline.map((ev, i) => {
            const CatIcon = CATEGORY_ICONS[ev.category] || Activity
            return (
              <div key={ev.id || i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: '#F5F5F3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <CatIcon size={12} color="#888" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{ev.summary}</div>
                  <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{fmtDate(ev.timestamp)} · {ev.actor?.name || 'System'}</div>
                </div>
                {ev.revenue_impact !== 0 && <span style={{ fontSize: 11, fontWeight: 700, color: ev.revenue_impact > 0 ? '#10B981' : '#EF4444', flexShrink: 0 }}>{ev.revenue_impact > 0 ? '+' : ''}{fmtCurrency(ev.revenue_impact)}</span>}
              </div>
            )
          }) : <p style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 12 }}>No timeline events yet</p>}
        </div>

        {/* Contact */}
        <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid #EBEBEB' }}>
          <h4 style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>Contact</h4>
          {client.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#333', marginBottom: 4 }}><Phone size={13} color="#BBB" /> {client.phone}</div>}
          {client.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#333', marginBottom: 4 }}><Mail size={13} color="#BBB" /> {client.email}</div>}
          {client.source && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#333', marginBottom: 4 }}><Target size={13} color="#BBB" /> Source: {client.source}{client.source_campaign ? ` / ${client.source_campaign}` : ''}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#333' }}><Clock size={13} color="#BBB" /> Client since: {fmtDate(client.created_at)}</div>
        </div>

        {/* Tags */}
        {client.tags && client.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
            {client.tags.map(t => <span key={t} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#F3F4F6', color: '#555' }}>{t}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// INTERACTION MODAL — log calls, DMs, walk-ins
// ═══════════════════════════════════════════════════════════════
function InteractionModal({ bid, clientId, clientName, onClose, onSaved }) {
  const [type, setType] = useState('phone_call')
  const [summary, setSummary] = useState('')
  const [outcome, setOutcome] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [saving, setSaving] = useState(false)

  const types = [
    { id: 'phone_call', label: 'Phone Call' },
    { id: 'walkin_enquiry', label: 'Walk-in' },
    { id: 'dm_received', label: 'DM / Social' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'email', label: 'Email' },
    { id: 'in_person', label: 'In Person' },
  ]
  const outcomes = [
    { id: 'booked', label: 'Booked' },
    { id: 'interested', label: 'Interested' },
    { id: 'not_interested', label: 'Not Interested' },
    { id: 'follow_up_needed', label: 'Follow-up Needed' },
    { id: 'no_answer', label: 'No Answer' },
    { id: 'info_provided', label: 'Info Provided' },
  ]

  const save = async () => {
    if (!summary.trim()) return
    setSaving(true)
    try {
      await api.post(`/crm/business/${bid}/client/${clientId}/interaction`, {
        type, summary, outcome,
        follow_up_date: outcome === 'follow_up_needed' && followUp ? followUp : null,
        staff_name: 'Staff',
      })
      onSaved()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 440, maxWidth: '90vw', background: '#fff', borderRadius: 16, zIndex: 301, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: "'Figtree', sans-serif" }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #EBEBEB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0 }}>Log Interaction</h3>
            <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>{clientName}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#999" /></button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Type */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {types.map(t => (
                <button key={t.id} onClick={() => setType(t.id)} style={{ padding: '5px 12px', borderRadius: 8, border: type === t.id ? '2px solid #111' : '1px solid #E5E5E5', background: type === t.id ? '#111' : '#fff', color: type === t.id ? '#fff' : '#555', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>{t.label}</button>
              ))}
            </div>
          </div>
          {/* Summary */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Summary</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} placeholder="What was discussed..."
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 10, fontSize: 13, fontFamily: "'Figtree', sans-serif", resize: 'none', outline: 'none' }} />
          </div>
          {/* Outcome */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Outcome</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {outcomes.map(o => (
                <button key={o.id} onClick={() => setOutcome(o.id)} style={{ padding: '5px 12px', borderRadius: 8, border: outcome === o.id ? `2px solid ${GOLD}` : '1px solid #E5E5E5', background: outcome === o.id ? `${GOLD}15` : '#fff', color: outcome === o.id ? GOLD : '#555', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>{o.label}</button>
              ))}
            </div>
          </div>
          {/* Follow-up date */}
          {outcome === 'follow_up_needed' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Follow-up Date</label>
              <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: 10, fontSize: 13, fontFamily: "'Figtree', sans-serif", outline: 'none' }} />
            </div>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #EBEBEB', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #E5E5E5', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif", color: '#555' }}>Cancel</button>
          <button onClick={save} disabled={saving || !summary.trim()} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: summary.trim() ? 'pointer' : 'default', opacity: summary.trim() ? 1 : 0.5, fontFamily: "'Figtree', sans-serif" }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}
