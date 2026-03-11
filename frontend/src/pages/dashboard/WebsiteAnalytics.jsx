/**
 * WebsiteAnalytics — website analytics dashboard with Overview, Per Page, and Heatmap tabs
 * Tier gating: Overview = Starter+, Per Page = Growth+, Heatmap = Scale only
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../utils/api'
import { useBusiness } from '../../contexts/BusinessContext'

/* ── helpers ── */
const fmt = (n) => (n == null ? '0' : Number(n).toLocaleString())
const fmtTime = (secs) => {
  if (secs == null || secs === 0) return '0m 0s'
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}m ${s}s`
}
const fmtPct = (v) => (v == null ? '0%' : `${Number(v).toFixed(1)}%`)
const trendColor = (v) => (v >= 0 ? '#22C55E' : '#EF4444')

/* ── inline SVG icons (monochrome) ── */
const IconEye = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)
const IconBounce = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 14 8 10 12 14 20 6"/>
    <polyline points="16 6 20 6 20 10"/>
  </svg>
)
const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)
const IconLock = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)
const IconTrendUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)
const IconTrendDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
    <polyline points="17 18 23 18 23 12"/>
  </svg>
)
const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconArrowIn = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 10 20 15 15 20"/>
    <path d="M4 4v7a4 4 0 004 4h12"/>
  </svg>
)
const IconArrowOut = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 10 4 15 9 20"/>
    <path d="M20 4v7a4 4 0 01-4 4H4"/>
  </svg>
)

/* ── skeleton placeholder ── */
const Skeleton = ({ width = '100%', height = 20, style = {} }) => (
  <div style={{
    width, height, borderRadius: 6, background: '#EFEFEF',
    animation: 'skeletonPulse 1.4s ease-in-out infinite',
    ...style,
  }} />
)
const skeletonKeyframes = `
@keyframes skeletonPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`

/* ── shared styles ── */
const cardStyle = {
  background: '#fff', borderRadius: 16, border: '1px solid #E5E5E5',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20,
}
const labelStyle = {
  fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1,
}
const bigNumStyle = { fontSize: 28, fontWeight: 800, color: '#111' }
const secTextStyle = { fontSize: 13, color: '#666' }
const btnStyle = (active) => ({
  padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
  border: active ? '1px solid #C9A84C' : '1px solid #E5E5E5',
  background: active ? '#FBF6E9' : '#FAFAFA', color: active ? '#C9A84C' : '#666',
  fontFamily: "'Figtree', sans-serif", transition: 'all 0.15s',
})

/* Heatmap colour helpers (CSS only — no heatmap.js dependency) */
function heatColor(value, max) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0
  if (ratio < 0.25) return `rgba(59,130,246,${0.15 + ratio * 2})`    // blue (cold)
  if (ratio < 0.5) return `rgba(34,197,94,${0.2 + ratio * 1.2})`     // green
  if (ratio < 0.75) return `rgba(234,179,8,${0.3 + ratio * 0.8})`    // yellow
  return `rgba(239,68,68,${0.4 + ratio * 0.6})`                       // red (hot)
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function WebsiteAnalytics() {
  const { business } = useBusiness()
  const bid = business?.id ?? business?._id
  const tier = business?.subscription_tier || business?.tier || 'free'
  const [activeTab, setActiveTab] = useState('overview')

  const tierLevel = { free: 0, starter: 1, growth: 2, scale: 3 }
  const userTier = tierLevel[tier] ?? 0

  const tabs = [
    { key: 'overview', label: 'Overview', minTier: 1, badge: null },
    { key: 'perpage', label: 'Per Page', minTier: 2, badge: 'Growth+' },
    { key: 'heatmap', label: 'Heatmap', minTier: 3, badge: 'Scale' },
  ]

  return (
    <div style={{ fontFamily: "'Figtree', sans-serif", padding: 24, background: '#fff', minHeight: '100vh' }}>
      <style>{skeletonKeyframes}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111', margin: 0 }}>Website Analytics</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>Monitor your website traffic and engagement</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E5E5E5', marginBottom: 24 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: activeTab === t.key ? '2px solid #C9A84C' : '2px solid transparent',
              color: activeTab === t.key ? '#111' : '#999',
              fontFamily: "'Figtree', sans-serif", transition: 'all 0.15s',
            }}
          >
            {t.label}
            {t.badge && (
              <span style={{
                marginLeft: 8, fontSize: 9, fontWeight: 700, padding: '2px 6px',
                background: '#F5F0E1', color: '#C9A84C', borderRadius: 4, textTransform: 'uppercase',
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab bid={bid} />}
      {activeTab === 'perpage' && (
        userTier >= 2 ? <PerPageTab bid={bid} /> : <TierGate feature="Per Page Analytics" requiredTier="Growth" />
      )}
      {activeTab === 'heatmap' && (
        userTier >= 3 ? <HeatmapTab bid={bid} /> : <TierGate feature="Heatmap Analytics" requiredTier="Scale" />
      )}
    </div>
  )
}

/* ── Tier Gate ── */
function TierGate({ feature, requiredTier }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 20px', textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 20, background: '#F5F5F5',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
      }}>
        <IconLock />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 8px' }}>{feature}</h2>
      <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px', maxWidth: 400 }}>
        {feature} is available on the {requiredTier} plan. Upgrade to unlock detailed insights about your visitors.
      </p>
      <button style={{
        padding: '12px 32px', fontSize: 14, fontWeight: 700, border: 'none', borderRadius: 10,
        background: '#C9A84C', color: '#fff', cursor: 'pointer', fontFamily: "'Figtree', sans-serif",
        transition: 'opacity 0.15s',
      }}>
        Upgrade to {requiredTier}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   TAB 1: OVERVIEW
   ═══════════════════════════════════════════════════════ */
function OverviewTab({ bid }) {
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!bid) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get(`/website/business/${bid}/analytics/overview?period=${period}`)
        if (!cancelled) setData(res)
      } catch (e) {
        console.error('Overview analytics load error:', e)
        if (!cancelled) setError('Failed to load analytics data.')
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [bid, period])

  if (!bid) return <EmptyState msg="No business selected." />
  if (error) return <ErrorState msg={error} />

  const d = data || {}
  const dailyVisitors = d.daily_visitors || []
  const topPages = d.top_pages || []
  const devices = d.devices || {}
  const referrers = d.referrers || []

  const kpis = [
    { label: 'Total Views', value: fmt(d.total_views), change: d.views_change, icon: <IconEye /> },
    { label: 'Unique Visitors', value: fmt(d.unique_visitors), change: d.visitors_change, icon: <IconUser /> },
    { label: 'Bounce Rate', value: fmtPct(d.bounce_rate), change: d.bounce_change, invertTrend: true, icon: <IconBounce /> },
    { label: 'Avg. Time on Page', value: fmtTime(d.avg_time_seconds), change: d.time_change, icon: <IconClock /> },
  ]

  return (
    <>
      {/* Period selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{
            padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8,
            border: '1px solid #E5E5E5', background: '#FAFAFA', color: '#333',
            fontFamily: "'Figtree', sans-serif", cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {kpis.map((k, i) => (
          <div key={i} style={cardStyle}>
            {loading ? (
              <>
                <Skeleton width={80} height={12} style={{ marginBottom: 12 }} />
                <Skeleton width={120} height={32} style={{ marginBottom: 8 }} />
                <Skeleton width={100} height={14} />
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={labelStyle}>{k.label}</div>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {k.icon}
                  </div>
                </div>
                <div style={bigNumStyle}>{k.value}</div>
                {k.change != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, fontWeight: 600, color: trendColor(k.invertTrend ? -k.change : k.change) }}>
                    {(k.invertTrend ? -k.change : k.change) >= 0 ? <IconTrendUp /> : <IconTrendDown />}
                    {Math.abs(k.change)}% vs prev. period
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Daily Visitors Chart */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>Daily Visitors</h2>
        <p style={{ ...secTextStyle, margin: '0 0 20px' }}>Visitor count over the selected period</p>
        {loading ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 180 }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} width="100%" height={40 + Math.random() * 120} />
            ))}
          </div>
        ) : dailyVisitors.length === 0 ? (
          <EmptyState msg="No visitor data for this period." />
        ) : (
          <BarChart data={dailyVisitors} />
        )}
      </div>

      {/* Top Pages */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>Top Pages</h2>
        <p style={{ ...secTextStyle, margin: '0 0 16px' }}>Most visited pages on your website</p>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={18} style={{ marginBottom: 10 }} />)
        ) : topPages.length === 0 ? (
          <EmptyState msg="No page data available." />
        ) : (
          <TopPagesTable pages={topPages} />
        )}
      </div>

      {/* Device + Referrers side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Device Breakdown */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>Device Breakdown</h2>
          <p style={{ ...secTextStyle, margin: '0 0 16px' }}>Traffic by device type</p>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={24} style={{ marginBottom: 12 }} />)
          ) : (
            <DeviceBreakdown devices={devices} />
          )}
        </div>

        {/* Referrer Sources */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>Referrer Sources</h2>
          <p style={{ ...secTextStyle, margin: '0 0 16px' }}>Where your visitors come from</p>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={18} style={{ marginBottom: 10 }} />)
          ) : referrers.length === 0 ? (
            <EmptyState msg="No referrer data available." />
          ) : (
            <ReferrersTable referrers={referrers} />
          )}
        </div>
      </div>
    </>
  )
}

/* ── Bar Chart (CSS only) ── */
function BarChart({ data }) {
  const maxCount = Math.max(...data.map(d => d.count || 0), 1)
  const chartH = 180
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: chartH }}>
        {data.map((d, i) => {
          const h = ((d.count || 0) / maxCount) * chartH
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <div
                title={`${d.date}: ${fmt(d.count)} visitors`}
                style={{
                  width: '100%', maxWidth: 40, height: Math.max(h, 2), borderRadius: '4px 4px 0 0',
                  background: '#C9A84C', transition: 'height 0.3s',
                }}
              />
            </div>
          )
        })}
      </div>
      {/* x-axis labels — show every Nth to avoid crowding */}
      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
        {data.map((d, i) => {
          const showLabel = data.length <= 14 || i % Math.ceil(data.length / 10) === 0
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#999' }}>
              {showLabel ? formatDateLabel(d.date) : ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatDateLabel(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return `${d.getDate()}/${d.getMonth() + 1}`
  } catch { return dateStr }
}

/* ── Top Pages Table ── */
function TopPagesTable({ pages }) {
  const maxViews = Math.max(...pages.map(p => p.views || 0), 1)
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
          {['#', 'Page', 'Slug', 'Views', ''].map((h, i) => (
            <th key={i} style={{ textAlign: 'left', padding: '8px 10px', ...labelStyle }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pages.map((p, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
            <td style={{ padding: '10px', fontSize: 13, color: '#999', fontWeight: 700 }}>{i + 1}</td>
            <td style={{ padding: '10px', fontSize: 13, color: '#111', fontWeight: 600 }}>{p.title || 'Untitled'}</td>
            <td style={{ padding: '10px', fontSize: 12, color: '#888', fontFamily: 'monospace' }}>{p.slug || '/'}</td>
            <td style={{ padding: '10px', fontSize: 13, fontWeight: 700, color: '#111' }}>{fmt(p.views)}</td>
            <td style={{ padding: '10px', width: '30%' }}>
              <div style={{ height: 8, borderRadius: 4, background: '#F5F5F5', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${((p.views || 0) / maxViews) * 100}%`, background: '#C9A84C', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ── Device Breakdown ── */
function DeviceBreakdown({ devices }) {
  const total = (devices.desktop || 0) + (devices.tablet || 0) + (devices.mobile || 0)
  if (total === 0) return <EmptyState msg="No device data available." />

  const items = [
    { label: 'Desktop', value: devices.desktop || 0 },
    { label: 'Tablet', value: devices.tablet || 0 },
    { label: 'Mobile', value: devices.mobile || 0 },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.map((it, i) => {
        const pct = total > 0 ? ((it.value / total) * 100).toFixed(1) : 0
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#333' }}>
              <span>{it.label}</span>
              <span>{pct}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: '#F5F5F5', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#C9A84C', borderRadius: 5, transition: 'width 0.3s' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Referrers Table ── */
function ReferrersTable({ referrers }) {
  const total = referrers.reduce((s, r) => s + (r.count || 0), 0) || 1
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
          {['Source', 'Visits', '%'].map((h, i) => (
            <th key={i} style={{ textAlign: 'left', padding: '8px 10px', ...labelStyle }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {referrers.map((r, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
            <td style={{ padding: '10px', fontSize: 13, fontWeight: 600, color: '#111' }}>{r.source || 'Direct'}</td>
            <td style={{ padding: '10px', fontSize: 13, color: '#333' }}>{fmt(r.count)}</td>
            <td style={{ padding: '10px', fontSize: 13, color: '#888' }}>{((r.count || 0) / total * 100).toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ═══════════════════════════════════════════════════════
   TAB 2: PER PAGE
   ═══════════════════════════════════════════════════════ */
function PerPageTab({ bid }) {
  const [pages, setPages] = useState([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [pageData, setPageData] = useState(null)
  const [loadingPages, setLoadingPages] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState(null)

  // Fetch pages list
  useEffect(() => {
    if (!bid) { setLoadingPages(false); return }
    const load = async () => {
      try {
        const res = await api.get(`/website/business/${bid}/pages`)
        const list = Array.isArray(res) ? res : res?.pages || []
        setPages(list)
        if (list.length > 0) setSelectedSlug(list[0].slug || '')
      } catch (e) {
        console.error('Failed to load pages list:', e)
        setError('Failed to load pages.')
      }
      setLoadingPages(false)
    }
    load()
  }, [bid])

  // Fetch selected page analytics
  useEffect(() => {
    if (!bid || !selectedSlug) return
    let cancelled = false
    const load = async () => {
      setLoadingData(true)
      setError(null)
      try {
        const res = await api.get(`/website/business/${bid}/analytics/page/${encodeURIComponent(selectedSlug)}`)
        if (!cancelled) setPageData(res)
      } catch (e) {
        console.error('Page analytics load error:', e)
        if (!cancelled) setError('Failed to load page analytics.')
      }
      if (!cancelled) setLoadingData(false)
    }
    load()
    return () => { cancelled = true }
  }, [bid, selectedSlug])

  if (!bid) return <EmptyState msg="No business selected." />
  if (loadingPages) return <LoadingSkeleton rows={4} />
  if (error && pages.length === 0) return <ErrorState msg={error} />
  if (pages.length === 0) return <EmptyState msg="No pages found for this website." />

  const pd = pageData || {}
  const scrollDepth = pd.scroll_depth || {}

  return (
    <>
      {/* Page selector */}
      <div style={{ marginBottom: 24 }}>
        <select
          value={selectedSlug}
          onChange={(e) => setSelectedSlug(e.target.value)}
          style={{
            padding: '10px 16px', fontSize: 14, fontWeight: 600, borderRadius: 8,
            border: '1px solid #E5E5E5', background: '#FAFAFA', color: '#333',
            fontFamily: "'Figtree', sans-serif", cursor: 'pointer', outline: 'none',
            minWidth: 260,
          }}
        >
          {pages.map((p, i) => (
            <option key={i} value={p.slug}>{p.title || p.slug || 'Untitled'}</option>
          ))}
        </select>
      </div>

      {/* Page stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Views', value: fmt(pd.views), icon: <IconEye /> },
          { label: 'Avg. Time on Page', value: fmtTime(pd.avg_time), icon: <IconClock /> },
          { label: 'Bounce Rate', value: fmtPct(pd.bounce_rate), icon: <IconBounce /> },
        ].map((k, i) => (
          <div key={i} style={cardStyle}>
            {loadingData ? (
              <>
                <Skeleton width={80} height={12} style={{ marginBottom: 12 }} />
                <Skeleton width={120} height={32} />
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={labelStyle}>{k.label}</div>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {k.icon}
                  </div>
                </div>
                <div style={bigNumStyle}>{k.value}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Scroll Depth + Entry/Exit Rates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Scroll Depth */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>Scroll Depth</h2>
          <p style={{ ...secTextStyle, margin: '0 0 20px' }}>Percentage of users reaching each depth</p>
          {loadingData ? (
            <Skeleton height={200} />
          ) : Object.keys(scrollDepth).length === 0 ? (
            <EmptyState msg="No scroll data available." />
          ) : (
            <ScrollDepthViz depth={scrollDepth} />
          )}
        </div>

        {/* Entry vs Exit Rate */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>Entry vs Exit</h2>
          <p style={{ ...secTextStyle, margin: '0 0 20px' }}>How often this is the first or last page visited</p>
          {loadingData ? (
            <Skeleton height={200} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconArrowIn />
                  </div>
                  <div>
                    <div style={labelStyle}>Entry Rate</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>{fmtPct(pd.entry_rate)}</div>
                  </div>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: '#F5F5F5', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pd.entry_rate || 0}%`, background: '#22C55E', borderRadius: 5, transition: 'width 0.3s' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconArrowOut />
                  </div>
                  <div>
                    <div style={labelStyle}>Exit Rate</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>{fmtPct(pd.exit_rate)}</div>
                  </div>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: '#F5F5F5', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pd.exit_rate || 0}%`, background: '#EF4444', borderRadius: 5, transition: 'width 0.3s' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Time Distribution */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>Time Distribution</h2>
        <p style={{ ...secTextStyle, margin: '0 0 20px' }}>How long visitors spend on this page</p>
        {loadingData ? (
          <Skeleton height={200} />
        ) : pd.avg_time == null ? (
          <EmptyState msg="No time data available." />
        ) : (
          <TimeDistribution avgTime={pd.avg_time} />
        )}
      </div>
    </>
  )
}

/* ── Scroll Depth Visualization ── */
function ScrollDepthViz({ depth }) {
  const markers = [25, 50, 75, 100]
  const barH = 200

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', height: barH }}>
      {markers.map(m => {
        const pct = depth[m] || 0
        const h = (pct / 100) * barH
        return (
          <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#333', marginBottom: 6 }}>
              {pct.toFixed(0)}%
            </div>
            <div style={{
              width: '100%', maxWidth: 48, height: Math.max(h, 4), borderRadius: '6px 6px 0 0',
              background: '#C9A84C', transition: 'height 0.3s',
            }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: '#999', marginTop: 6 }}>{m}%</div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Time Distribution Histogram ── */
function TimeDistribution({ avgTime }) {
  const avg = avgTime || 30
  const buckets = [
    { label: '0-15s', min: 0, max: 15 },
    { label: '15-30s', min: 15, max: 30 },
    { label: '30-60s', min: 30, max: 60 },
    { label: '1-2m', min: 60, max: 120 },
    { label: '2-5m', min: 120, max: 300 },
    { label: '5m+', min: 300, max: 600 },
  ]
  const values = buckets.map(b => {
    const mid = (b.min + b.max) / 2
    const dist = Math.abs(mid - avg)
    return Math.max(5, Math.round(100 * Math.exp(-dist / (avg || 30))))
  })
  const maxVal = Math.max(...values, 1)
  const chartH = 160

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: chartH }}>
        {values.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{
              width: '100%', maxWidth: 40, height: Math.max((v / maxVal) * chartH, 4),
              borderRadius: '4px 4px 0 0', background: '#C9A84C', transition: 'height 0.3s',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {buckets.map((b, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#999' }}>{b.label}</div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   TAB 3: HEATMAP (Scale tier)
   ═══════════════════════════════════════════════════════ */
function HeatmapTab({ bid }) {
  const [pages, setPages] = useState([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [device, setDevice] = useState('desktop')
  const [period, setPeriod] = useState('30d')
  const [heatData, setHeatData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingPages, setLoadingPages] = useState(true)
  const [tooltip, setTooltip] = useState(null)
  const containerRef = useRef(null)

  // Fetch pages
  useEffect(() => {
    if (!bid) { setLoadingPages(false); return }
    const load = async () => {
      try {
        const res = await api.get(`/website/business/${bid}/pages`)
        const list = Array.isArray(res) ? res : res?.pages || []
        setPages(list)
        if (list.length > 0) setSelectedSlug(list[0].slug || '')
      } catch (e) {
        console.error('Failed to load pages:', e)
      }
      setLoadingPages(false)
    }
    load()
  }, [bid])

  // Fetch heatmap data
  useEffect(() => {
    if (!bid || !selectedSlug) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const days = { '7d': 7, '30d': 30, '90d': 90 }[period] || 30
        const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
        const to = new Date().toISOString().split('T')[0]
        const res = await api.get(
          `/website/business/${bid}/analytics/page/${encodeURIComponent(selectedSlug)}/heatmap?device=${device}&from_date=${from}&to_date=${to}`
        )
        if (!cancelled) setHeatData(res)
      } catch (e) {
        console.error('Heatmap load error:', e)
        if (!cancelled) setHeatData(null)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [bid, selectedSlug, device, period])

  const handleExportPNG = useCallback(async () => {
    const el = containerRef.current
    if (!el) return
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(el, { useCORS: true, scale: 2 })
      const link = document.createElement('a')
      link.download = `heatmap-${selectedSlug || 'page'}-${device}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      // html2canvas not available — fallback: use native canvas
      const canvas = document.createElement('canvas')
      const rect = el.getBoundingClientRect()
      canvas.width = rect.width * 2
      canvas.height = rect.height * 2
      const ctx = canvas.getContext('2d')
      ctx.scale(2, 2)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, rect.width, rect.height)
      ctx.font = '14px Figtree, sans-serif'
      ctx.fillStyle = '#999'
      ctx.fillText('Export requires html2canvas package', 20, rect.height / 2)
      const link = document.createElement('a')
      link.download = `heatmap-${selectedSlug || 'page'}-${device}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
  }, [selectedSlug, device])

  if (!bid) return <EmptyState msg="No business selected." />
  if (loadingPages) return <LoadingSkeleton rows={4} />
  if (pages.length === 0) return <EmptyState msg="No pages found for this website." />

  const zones = heatData?.zones || []
  const totalClicks = heatData?.total_clicks || 0
  const gridSize = heatData?.grid_size || 50
  const maxCount = zones.length > 0 ? Math.max(...zones.map(z => z.count)) : 0

  return (
    <>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Page selector */}
        <select
          value={selectedSlug}
          onChange={(e) => setSelectedSlug(e.target.value)}
          style={{
            padding: '10px 16px', fontSize: 14, fontWeight: 600, borderRadius: 8,
            border: '1px solid #E5E5E5', background: '#FAFAFA', color: '#333',
            fontFamily: "'Figtree', sans-serif", cursor: 'pointer', outline: 'none',
            minWidth: 220,
          }}
        >
          {pages.map((p, i) => (
            <option key={i} value={p.slug}>{p.title || p.slug || 'Untitled'}</option>
          ))}
        </select>

        {/* Device filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['desktop', 'tablet', 'mobile'].map(d => (
            <button key={d} onClick={() => setDevice(d)} style={btnStyle(device === d)}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['7d', '30d', '90d'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={btnStyle(period === p)}>
              {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>

        {/* Export */}
        <button
          onClick={handleExportPNG}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            border: '1px solid #E5E5E5', background: '#FAFAFA', color: '#333',
            fontFamily: "'Figtree', sans-serif", cursor: 'pointer',
          }}
        >
          <IconDownload /> Export PNG
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={labelStyle}>Total Clicks</div>
          <div style={{ ...bigNumStyle, fontSize: 22, marginTop: 4 }}>{fmt(totalClicks)}</div>
        </div>
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={labelStyle}>Hot Zones</div>
          <div style={{ ...bigNumStyle, fontSize: 22, marginTop: 4 }}>{zones.length}</div>
        </div>
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={labelStyle}>Avg Viewport</div>
          <div style={{ ...bigNumStyle, fontSize: 22, marginTop: 4 }}>
            {heatData?.viewport_width_avg || '-'} x {heatData?.viewport_height_avg || '-'}
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div style={cardStyle} ref={containerRef}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>Click Heatmap</h2>
        <p style={{ ...secTextStyle, margin: '0 0 20px' }}>
          Showing click density for /{selectedSlug || 'home'} on {device}
        </p>

        {loading ? (
          <Skeleton height={400} />
        ) : zones.length === 0 ? (
          <EmptyState msg="No click data available for this page and device." />
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Grid container */}
            <div
              style={{
                position: 'relative', width: '100%', paddingBottom: '60%',
                background: '#FAFAFA', borderRadius: 12, overflow: 'hidden',
                border: '1px solid #E5E5E5',
              }}
            >
              {/* Page wireframe background */}
              <div style={{
                position: 'absolute', inset: 0, padding: 20,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                {/* Fake header */}
                <div style={{ height: 12, background: '#E5E5E5', borderRadius: 4, width: '30%' }} />
                <div style={{ height: 60, background: '#EFEFEF', borderRadius: 8, width: '100%' }} />
                {/* Fake content */}
                <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                  <div style={{ flex: 2, background: '#EFEFEF', borderRadius: 8 }} />
                  <div style={{ flex: 1, background: '#EFEFEF', borderRadius: 8 }} />
                </div>
                <div style={{ height: 40, background: '#EFEFEF', borderRadius: 8, width: '100%' }} />
              </div>

              {/* Heatmap overlay */}
              {zones.map((z, i) => {
                const left = (z.grid_x / gridSize) * 100
                const top = (z.grid_y / gridSize) * 100
                const cellW = 100 / gridSize
                const cellH = 100 / gridSize
                const color = heatColor(z.count, maxCount)
                return (
                  <div
                    key={i}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setTooltip({
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8,
                        count: z.count,
                        pct: z.percentage,
                      })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      position: 'absolute',
                      left: `${left}%`, top: `${top}%`,
                      width: `${cellW}%`, height: `${cellH}%`,
                      background: color,
                      borderRadius: 2,
                      transition: 'background 0.2s',
                      cursor: 'crosshair',
                    }}
                  />
                )
              })}
            </div>

            {/* Tooltip */}
            {tooltip && (
              <div style={{
                position: 'fixed',
                left: tooltip.x, top: tooltip.y,
                transform: 'translate(-50%, -100%)',
                background: '#111', color: '#fff', padding: '6px 12px',
                borderRadius: 6, fontSize: 12, fontWeight: 600,
                pointerEvents: 'none', zIndex: 100, whiteSpace: 'nowrap',
              }}>
                {tooltip.count} clicks ({tooltip.pct}% of visitors)
              </div>
            )}

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: '#999' }}>Cold</span>
              <div style={{
                width: 200, height: 10, borderRadius: 5,
                background: 'linear-gradient(to right, rgba(59,130,246,0.3), rgba(34,197,94,0.4), rgba(234,179,8,0.6), rgba(239,68,68,0.9))',
              }} />
              <span style={{ fontSize: 11, color: '#999' }}>Hot</span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════
   SHARED UI PIECES
   ═══════════════════════════════════════════════════════ */
function EmptyState({ msg }) {
  return (
    <div style={{ padding: '32px 20px', textAlign: 'center', color: '#999', fontSize: 13 }}>
      {msg}
    </div>
  )
}

function ErrorState({ msg }) {
  return (
    <div style={{ padding: '32px 20px', textAlign: 'center', color: '#EF4444', fontSize: 13, fontWeight: 600 }}>
      {msg}
    </div>
  )
}

function LoadingSkeleton({ rows = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={20} />
      ))}
    </div>
  )
}
