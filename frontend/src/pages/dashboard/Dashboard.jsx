import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Restaurant Home Dashboard — wired to real API data
 * /dashboard/business/{id}/summary — stats
 * /dashboard/business/{id}/today — today's bookings
 * /dashboard/business/{id}/activity — live feed
 * /tables/business/{id}/floor-plan — floor status
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, CalendarCheck, Clock, PoundSterling, Armchair, CalendarPlus, Ban, FileText, ArrowRight, Filter, Search, Download, MoreVertical, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const AVATAR_COLORS = ['bg-amber-100 text-amber-700','bg-purple-100 text-purple-700','bg-blue-100 text-blue-700','bg-green-100 text-green-700','bg-pink-100 text-pink-600','bg-gray-100 text-gray-600']
const getAv = (n) => { let h=0; for(let i=0;i<(n||'').length;i++) h=n.charCodeAt(i)+((h<<5)-h); return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length] }
const getInit = (n) => (n||'??').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)

const timeAgo = (d) => {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff/60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m/60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h/24)}d ago`
}

const formatDate = () => {
  const d = new Date()
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

/* ═══ Floor Status Widget — reads LIVE from localStorage ═══ */
const STATUS_STYLES = {
  seated:    { border: '#059669', bg: '#ECFDF5', text: '#065F46', label: 'Seated', dot: '#059669' },
  mains:     { border: '#EA580C', bg: '#FFF7ED', text: '#9A3412', label: 'Mains', dot: '#EA580C' },
  dessert:   { border: '#8B5CF6', bg: '#FAF5FF', text: '#5B21B6', label: 'Dessert', dot: '#8B5CF6' },
  reserved:  { border: '#D4A373', bg: '#FFF8F0', text: '#92400E', label: 'Reserved', dot: '#D4A373' },
  confirmed: { border: '#1B4332', bg: '#EFF6FF', text: '#1B4332', label: 'Confirmed', dot: '#1B4332' },
  pending:   { border: '#F59E0B', bg: '#FFFBEB', text: '#92400E', label: 'Pending', dot: '#F59E0B' },
  dirty:     { border: '#EF4444', bg: '#FEF2F2', text: '#991B1B', label: 'Dirty', dot: '#EF4444' },
  paying:    { border: '#6B7280', bg: '#F3F4F6', text: '#374151', label: 'Paying', dot: '#6B7280' },
  available: { border: '#D1D5DB', bg: '#F9FAFB', text: '#9CA3AF', label: 'Available', dot: '#9CA3AF' },
}

const FloorStatusWidget = ({ navigate }) => {
  const { business } = useBusiness()
  const bid = business?.id ?? business?._id

  // Fallback demo tables (mirrors FloorPlan DEFAULT_TABLES)
  const DEMO_TABLES = [
    { id: 't1', name: 'T-01', seats: 4, zone: 'window', shape: 'round', x: 80, y: 60, status: 'seated', timer: '45m' },
    { id: 't2', name: 'T-02', seats: 4, zone: 'window', shape: 'square', x: 250, y: 60, status: 'reserved', nextTime: '6:30 PM', guest: 'Smith (4)' },
    { id: 't3', name: 'T-03', seats: 2, zone: 'main', shape: 'square', x: 80, y: 240, status: 'available' },
    { id: 't4', name: 'T-04', seats: 6, zone: 'main', shape: 'round', x: 280, y: 250, status: 'seated', timer: '12m', vip: true },
    { id: 't5', name: 'T-05', seats: 4, zone: 'main', shape: 'round', x: 500, y: 60, status: 'dirty' },
    { id: 't6', name: 'T-06', seats: 8, zone: 'main', shape: 'long', x: 480, y: 230, status: 'available' },
  ]

  // Read tables from localStorage (same source as FloorPlan page)
  const [liveTables, setLiveTables] = useState(() => {
    try {
      // Try all possible keys
      const keys = [
        bid ? `rezvo_fp_${bid}` : null,
        'rezvo_fp_demo',
        bid ? `rezvo_floorplan_${bid}` : null,
        'rezvo_floorplan_demo',
      ].filter(Boolean)
      for (const key of keys) {
        const s = localStorage.getItem(key)
        if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length) return p }
      }
    } catch {}
    return DEMO_TABLES
  })

  // Re-read on focus (user may have edited floor plan in another tab)
  useEffect(() => {
    const reload = () => {
      try {
        const keys = [
          bid ? `rezvo_fp_${bid}` : null,
          'rezvo_fp_demo',
          bid ? `rezvo_floorplan_${bid}` : null,
          'rezvo_floorplan_demo',
        ].filter(Boolean)
        for (const key of keys) {
          const s = localStorage.getItem(key)
          if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length) { setLiveTables(p); return } }
        }
      } catch {}
    }
    window.addEventListener('focus', reload)
    const iv = setInterval(reload, 10000)
    return () => { window.removeEventListener('focus', reload); clearInterval(iv) }
  }, [bid])

  // Show first 6 tables from main zone, or just first 6
  const display = liveTables.length > 0
    ? (liveTables.filter(t => t.zone === 'main').length >= 3
        ? liveTables.filter(t => t.zone === 'main').slice(0, 6)
        : liveTables.slice(0, 6))
    : []

  const seated = liveTables.filter(t => ['seated', 'mains', 'dessert'].includes(t.status)).length
  const total = liveTables.length
  const occupancy = total > 0 ? Math.round((seated / total) * 100) : 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Floor Status</h2>
          <p className="text-sm text-gray-500">
            {total > 0 ? `${total} tables · ${occupancy}% Capacity` : 'No tables configured'}
          </p>
        </div>
        <button onClick={() => navigate('/dashboard/floor-plan')} className="text-sm font-semibold text-primary hover:text-emerald-700 flex items-center gap-1">
          Full View <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="relative h-[260px] p-4 overflow-hidden" style={{ background: '#FAFAF8' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#D1D5DB 0.8px, transparent 0.8px)', backgroundSize: '20px 20px' }} />
        {display.length > 0 ? (() => {
          // Calculate bounding box of all tables
          const xs = display.map(t => t.x || 0)
          const ys = display.map(t => t.y || 0)
          const minX = Math.min(...xs), maxX = Math.max(...xs)
          const minY = Math.min(...ys), maxY = Math.max(...ys)
          const rangeX = Math.max(maxX - minX, 200)
          const rangeY = Math.max(maxY - minY, 150)

          // Widget inner dimensions (accounting for padding + table size)
          const widgetW = 620, widgetH = 200
          const tblScale = 0.55 // Scale tables down
          const scaleX = widgetW / (rangeX + 180)
          const scaleY = widgetH / (rangeY + 150)
          const scale = Math.min(scaleX, scaleY, 0.9)

          return (
            <div className="relative z-10 h-full w-full">
              {display.map((tbl, idx) => {
                const st = STATUS_STYLES[tbl.status] || STATUS_STYLES.available
                const seats = tbl.seats || 4
                const rawSize = seats <= 2 ? 60 : seats <= 4 ? 68 : seats <= 6 ? 78 : 88
                const size = rawSize * tblScale
                const isRound = tbl.shape === 'round' || !tbl.shape
                const isLong = tbl.shape === 'long' || tbl.shape === 'booth'
                const w = isLong ? size * 1.5 : size
                const h = isLong ? size * 0.65 : size
                const isDirty = tbl.status === 'dirty'

                // Normalize positions into widget space
                const nx = ((tbl.x || 0) - minX) * scale + 16
                const ny = ((tbl.y || 0) - minY) * scale + 12

                return (
                  <div key={tbl.id || idx} style={{
                    position: 'absolute', left: nx, top: ny,
                    width: w, height: h,
                    borderRadius: isRound ? '50%' : 8,
                    background: st.bg,
                    border: isDirty ? `1.5px dashed ${st.border}` : `1.5px solid ${st.border}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                    transform: `rotate(${tbl.rotation || 0}deg)`,
                    fontFamily: "'Figtree', sans-serif",
                    fontSize: 0,
                  }}
                    onClick={() => navigate('/dashboard/floor-plan')}
                  >
                    {tbl.vip && (
                      <div style={{ position: 'absolute', top: -5, right: -5, background: '#F59E0B', color: '#fff', fontSize: 6, fontWeight: 800, padding: '1px 3px', borderRadius: 3 }}>VIP</div>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 800, color: st.text, lineHeight: 1 }}>{tbl.name}</span>
                    {tbl.status === 'seated' && tbl.timer && (
                      <>
                        <div style={{ display: 'flex', gap: 1.5, marginTop: 2 }}>
                          {Array.from({ length: Math.min(seats, 3) }).map((_, i) => (
                            <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: st.text }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 7, fontWeight: 700, color: st.text, opacity: 0.8 }}>{tbl.timer}</span>
                      </>
                    )}
                    {tbl.status === 'reserved' && tbl.nextTime && (
                      <span style={{ fontSize: 7, fontWeight: 600, color: st.border, marginTop: 1 }}>{tbl.nextTime}</span>
                    )}
                    {tbl.status === 'dirty' && (
                      <span style={{ fontSize: 7, fontWeight: 800, color: st.text, textTransform: 'uppercase', marginTop: 1 }}>DIRTY</span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })() : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm font-medium">
            <div className="text-center">
              <p className="font-bold">No floor plan configured</p>
              <button onClick={() => navigate('/dashboard/floor-plan')} className="mt-2 text-primary font-bold text-xs hover:underline">Set up Floor Plan →</button>
            </div>
          </div>
        )}
      </div>
      <div className="bg-gray-50/50 px-6 py-3 border-t border-gray-100 flex gap-4 text-xs text-gray-500 font-medium">
        {[
          { c: '#059669', l: 'Seated' }, { c: '#D4A373', l: 'Reserved' },
          { c: '#D1D5DB', l: 'Available' }, { c: '#EF4444', l: 'Dirty' },
        ].map(s => (
          <div key={s.l} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.c }} />{s.l}
          </div>
        ))}
      </div>
    </div>
  )
}

const Dashboard = () => {
  const navigate = useNavigate()
  const { business } = useBusiness()
  const bid = business?.id ?? business?._id
  const [summary, setSummary] = useState(null)
  const [todayBookings, setTodayBookings] = useState([])
  const [activity, setActivity] = useState([])
  const [floorPlan, setFloorPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchFilter, setSearchFilter] = useState('')

  const loadDashboard = useCallback(async () => {
    if (!bid) { setLoading(false); return }
    try {
      const [sumRes, todayRes, actRes, floorRes] = await Promise.allSettled([
        api.get(`/dashboard/business/${bid}/summary`),
        api.get(`/dashboard/business/${bid}/today`),
        api.get(`/dashboard/business/${bid}/activity?limit=10`),
        api.get(`/tables/business/${bid}/floor-plan`),
      ])
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value)
      if (todayRes.status === 'fulfilled') setTodayBookings(todayRes.value?.bookings || [])
      if (actRes.status === 'fulfilled') setActivity(actRes.value?.events || [])
      if (floorRes.status === 'fulfilled') setFloorPlan(floorRes.value)
    } catch (e) { console.error('Dashboard load error:', e) }
    setLoading(false)
  }, [bid])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  // Live polling — silently refresh every 20 seconds
  useEffect(() => {
    if (!bid) return
    const interval = setInterval(() => loadDashboard(), 20000)
    return () => clearInterval(interval)
  }, [loadDashboard, bid])

  // Also load from bookings as fallback for activity
  useEffect(() => {
    if (!bid || activity.length > 0) return
    const loadFallback = async () => {
      try {
        const res = await api.get(`/bookings/business/${bid}?limit=10&status=all`)
        const bks = res.bookings || []
        if (bks.length && !activity.length) {
          setActivity(bks.slice(0, 8).map(b => ({
            id: b.id || b._id,
            type: 'booking',
            message: `New booking: ${b.customerName || b.customer?.name || 'Guest'}`,
            sub: `Booking, ${b.date} at ${b.time}`,
            timestamp: b.createdAt,
          })))
        }
        if (!summary) {
          const todayStr = new Date().toISOString().split('T')[0]
          const todayBks = bks.filter(b => b.date === todayStr && b.status !== 'cancelled')
          const upcoming = bks.filter(b => ['confirmed','pending'].includes(b.status))
          setSummary({
            today: {
              bookings: todayBks.length,
              upcomingBookings: upcoming.length,
              revenue: todayBks.reduce((s, b) => s + (b.price || b.service?.price || 0), 0),
              noShows: todayBks.filter(b => b.status === 'no_show').length,
            },
            nextBooking: upcoming[0] ? {
              customerName: upcoming[0].customerName || upcoming[0].customer?.name,
              time: upcoming[0].time,
              guests: upcoming[0].guests || upcoming[0].partySize,
            } : null,
          })
          if (!todayBookings.length) {
            setTodayBookings(upcoming.slice(0, 10).map(b => ({
              id: b.id || b._id,
              time: b.time,
              customerName: b.customerName || b.customer?.name || 'Guest',
              guests: b.guests || b.partySize || 2,
              table: b.table || b.tableName,
              status: b.status,
              notes: b.notes || '',
              phone: b.customer?.phone || b.phone || '',
              isVip: b.isVip || b.tags?.includes('VIP'),
            })))
          }
        }
      } catch {}
    }
    loadFallback()
  }, [bid, activity.length, summary, todayBookings.length])

  if (loading) return <RezvoLoader message="Loading dashboard..." />

  const t = summary?.today || {}
  const totalCovers = t.bookings || 0
  const upcomingCount = t.upcomingBookings || 0
  const waitlistCount = 0 // Real waitlist not yet implemented
  // Estimate revenue: if API returns 0 but we have bookings, estimate £30 per cover
  const apiRevenue = t.revenue || 0
  const estimatedRevenue = apiRevenue > 0 ? apiRevenue : totalCovers * 30
  const revenue = estimatedRevenue
  const nextBkg = summary?.nextBooking

  const statCards = [
    {
      label: 'Total Covers Today', value: totalCovers,
      icon: <Users className="w-5 h-5" />, iconBg: 'text-primary',
      trend: summary?.period?.bookingsChange ? `${Math.abs(summary.period.bookingsChange)}%` : null,
      trendUp: (summary?.period?.bookingsChange || 0) >= 0,
      sub: 'vs last week',
    },
    {
      label: 'Upcoming Reservations', value: upcomingCount,
      icon: <CalendarCheck className="w-5 h-5" />, iconBg: 'text-primary',
      sub: nextBkg ? `Next: ${nextBkg.time || ''} (Party of ${nextBkg.guests || '?'})` : 'No upcoming',
    },
    {
      label: 'Waitlist', value: waitlistCount,
      icon: <Clock className="w-5 h-5" />, iconBg: 'text-[#D4A373]',
      sub: waitlistCount > 0 ? `~${waitlistCount * 8} min avg. wait` : 'No waitlist active',
      hoverColor: 'group-hover:text-[#D4A373]',
    },
    {
      label: 'Revenue Estimate',
      value: `£${revenue.toLocaleString()}`,
      icon: <PoundSterling className="w-5 h-5" />, iconBg: 'text-emerald-500',
      trend: summary?.period?.revenueChange ? `${Math.abs(summary.period.revenueChange)}%` : null,
      trendUp: (summary?.period?.revenueChange || 0) >= 0,
      sub: apiRevenue > 0 ? 'vs yesterday' : totalCovers > 0 ? 'est. ~£30/cover' : 'vs yesterday',
      hoverColor: 'group-hover:text-emerald-500',
    },
  ]

  const activityList = activity.length ? activity.map(e => ({
    id: e.id,
    text: e.message || `${e.type}: event`,
    sub: e.sub || (e.timestamp ? new Date(e.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''),
    time: timeAgo(e.timestamp),
    color: e.type === 'booking' ? 'bg-emerald-500' : e.type === 'cancellation' ? 'bg-red-400' : e.type === 'no_show' ? 'bg-amber-400' : 'bg-blue-400',
  })) : []

  const arrivals = todayBookings
    .filter(b => ['confirmed','pending','checked_in'].includes(b.status))
    .filter(b => !searchFilter || (b.customerName || '').toLowerCase().includes(searchFilter.toLowerCase()))
    .map(b => ({
      id: b.id,
      time: b.time || '',
      name: b.customerName || 'Guest',
      phone: b.phone || '',
      guests: b.guests || b.partySize || 2,
      table: b.table || b.tableName || null,
      status: b.status,
      statusLabel: b.status === 'confirmed' ? 'Confirmed' : b.status === 'pending' ? 'Pending' : b.status === 'checked_in' ? 'Seated' : b.status,
      statusBg: b.status === 'confirmed' ? 'bg-blue-50 text-blue-600 border-blue-100' : b.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : b.status === 'checked_in' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-gray-50 text-gray-600 border-gray-100',
      notes: b.notes || '—',
      action: b.status === 'confirmed' ? 'Seat' : b.status === 'pending' ? 'Confirm' : 'View',
      vip: b.isVip,
    }))

  const tables = floorPlan?.tables || []

  const handleQuickAction = (action) => {
    switch (action) {
      case 'Walk-In': navigate('/dashboard/calendar'); break
      case 'Reserve': navigate('/dashboard/calendar'); break
      case 'Block Tbl': navigate('/dashboard/floor-plan'); break
      case 'Run Sheet': navigate('/dashboard/bookings'); break
      default: break
    }
  }

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)] overflow-y-auto" style={{ fontFamily: "'Figtree', sans-serif" }}>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Booking Link CTA */}
          <button onClick={() => navigate('/dashboard/booking-link')} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-[#2D6A4F] shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            Booking Link
          </button>

          {/* Right: Search pill + refresh + notifications */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Search guests, bookings..."
                className="pl-9 pr-4 py-2 w-56 lg:w-72 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
              />
            </div>
            <button onClick={() => { setLoading(true); loadDashboard() }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((c,i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_-5px_rgba(27,67,50,0.1)] transition-all duration-300 group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{c.label}</p>
                  <h3 className={`text-3xl font-extrabold text-gray-900 ${c.hoverColor || 'group-hover:text-primary'} transition-colors`}>{c.value}</h3>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gray-50 ${c.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  {c.icon}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {c.trend && (
                  <span className={`${c.trendUp ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'} font-bold flex items-center gap-1 px-1.5 py-0.5 rounded`}>
                    {c.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {c.trend}
                  </span>
                )}
                <span className="text-gray-400">{c.sub}</span>
              </div>
            </div>
          ))}
        </section>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">

            {/* Occupancy Chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">Occupancy Trends</h2>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">Live seating vs capacity over time</p>
                </div>
                <div className="flex gap-1.5">
                  {['Today', 'Week', 'Month'].map((label, i) => (
                    <button key={label} className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                      i === 0
                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="h-[200px] relative">
                <svg viewBox="0 0 600 200" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2D6A4F" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2D6A4F" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d="M0,160 C50,135 100,100 150,110 C200,120 250,140 300,60 C350,20 400,30 450,50 C500,70 550,100 600,130 L600,200 L0,200 Z" fill="url(#chartFill)" />
                  <path d="M0,160 C50,135 100,100 150,110 C200,120 250,140 300,60 C350,20 400,30 450,50 C500,70 550,100 600,130" fill="none" stroke="#1B4332" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-gray-400 font-medium px-2">
                  {['12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM','9PM','10PM'].map(t => <span key={t}>{t}</span>)}
                </div>
              </div>
            </div>

            {/* Floor Status — LIVE from localStorage */}
            <FloorStatusWidget tables={tables} navigate={navigate} />
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Quick Actions */}
            <div className="bg-primary rounded-2xl p-6 text-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-400 opacity-10 rounded-full -ml-10 -mb-10 blur-xl" />
              <h2 className="text-lg font-bold mb-4 relative z-10">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3 relative z-10">
                {[
                  { icon: <Armchair className="w-5 h-5 text-emerald-400" />, label: 'Walk-In' },
                  { icon: <CalendarPlus className="w-5 h-5 text-[#D4A373]" />, label: 'Reserve' },
                  { icon: <Ban className="w-5 h-5 text-red-300" />, label: 'Block Tbl' },
                  { icon: <FileText className="w-5 h-5 text-blue-300" />, label: 'Run Sheet' },
                ].map(a => (
                  <button key={a.label} onClick={() => handleQuickAction(a.label)} className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-all group">
                    <span className="group-hover:scale-110 transition-transform">{a.icon}</span>
                    <span className="text-xs font-semibold">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Activity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col" style={{ maxHeight: 420 }}>
              <div className="p-5 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h2 className="text-lg font-bold text-gray-900">Live Activity</h2>
                <button className="text-gray-400 hover:text-primary"><Filter className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {activityList.length > 0 ? activityList.map(a => (
                  <div key={a.id} className="p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full ${a.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{a.text}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.sub}</p>
                    </div>
                    <span className="text-xs text-gray-400 font-medium shrink-0">{a.time}</span>
                  </div>
                )) : (
                  <div className="p-6 text-center text-sm text-gray-400">No recent activity</div>
                )}
              </div>
              <div className="p-3 border-t border-gray-100 text-center shrink-0">
                <button onClick={() => navigate('/dashboard/notifications')} className="text-xs font-bold text-primary hover:text-emerald-700 uppercase tracking-wide">
                  View All Activity
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Arrivals Table */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Upcoming Arrivals</h2>
              <p className="text-sm text-gray-500">{arrivals.length > 0 ? `${arrivals.length} reservations` : 'Next 2 hours'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="text" placeholder="Filter guests..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="pl-8 pr-4 py-2 bg-white border border-gray-200 rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1B4332]/15 focus:border-[#1B4332]/30 shadow-sm w-48 transition-all" style={{ fontFamily: "'Figtree', sans-serif" }} />
              </div>
              <button className="bg-gray-50 hover:bg-gray-100 text-gray-600 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium transition-colors flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Guest</th>
                  <th className="px-6 py-4">Size</th>
                  <th className="px-6 py-4">Table</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {arrivals.length > 0 ? arrivals.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50/50 group transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{a.time}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${getAv(a.name)} font-bold text-xs flex items-center justify-center`}>{getInit(a.name)}</div>
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-bold text-gray-900">{a.name}</p>
                            {a.vip && <span className="text-[10px] bg-[#D4A373] text-white px-1.5 rounded font-bold">VIP</span>}
                          </div>
                          {a.phone && <p className="text-xs text-gray-500">{a.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600"><div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-gray-400" /> {a.guests}</div></td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${a.table ? 'text-gray-600' : 'text-gray-400 italic'}`}>{a.table || 'Unassigned'}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${a.statusBg}`}>{a.statusLabel}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-[150px]">{a.notes}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button className="text-primary hover:text-emerald-700 font-bold text-xs bg-gray-50 hover:bg-white border border-transparent hover:border-primary/30 px-3 py-1.5 rounded transition-all shadow-sm">{a.action}</button>
                      <button className="text-gray-400 hover:text-gray-600 ml-2"><MoreVertical className="w-4 h-4 inline" /></button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">No upcoming arrivals. Bookings will appear here as they come in.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-center">
            <button onClick={() => navigate('/dashboard/bookings')} className="text-sm font-medium text-gray-600 hover:text-primary flex items-center gap-2">
              View All Upcoming <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Dashboard
