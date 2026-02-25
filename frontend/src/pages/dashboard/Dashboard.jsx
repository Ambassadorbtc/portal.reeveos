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
  const waitlistCount = t.noShows || 0
  const revenue = t.revenue || 0
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
      sub: waitlistCount > 0 ? `~${waitlistCount * 8} min avg. wait` : 'No waitlist',
      hoverColor: 'group-hover:text-[#D4A373]',
    },
    {
      label: 'Revenue Estimate',
      value: `£${revenue.toLocaleString()}`,
      icon: <PoundSterling className="w-5 h-5" />, iconBg: 'text-emerald-500',
      trend: summary?.period?.revenueChange ? `${Math.abs(summary.period.revenueChange)}%` : null,
      trendUp: (summary?.period?.revenueChange || 0) >= 0,
      sub: 'vs yesterday',
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Home Dashboard</h1>
            <p className="text-sm text-gray-500">{formatDate()}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setLoading(true); loadDashboard() }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => navigate('/dashboard/notifications')} className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              {upcomingCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{upcomingCount > 9 ? '9+' : upcomingCount}</span>}
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
                  <h2 className="text-lg font-bold text-gray-900">Occupancy Trends</h2>
                  <p className="text-sm text-gray-500">Live seating vs capacity over time</p>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-1 text-xs font-medium">
                  <button className="px-3 py-1.5 bg-white text-gray-900 rounded shadow-sm">Today</button>
                  <button className="px-3 py-1.5 text-gray-500 hover:text-gray-900">Week</button>
                  <button className="px-3 py-1.5 text-gray-500 hover:text-gray-900">Month</button>
                </div>
              </div>
              <div className="h-[200px] relative">
                <svg viewBox="0 0 600 200" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#52B788" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#52B788" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d="M0,160 C50,135 100,100 150,110 C200,120 250,140 300,60 C350,20 400,30 450,50 C500,70 550,100 600,130 L600,200 L0,200 Z" fill="url(#chartFill)" />
                  <path d="M0,160 C50,135 100,100 150,110 C200,120 250,140 300,60 C350,20 400,30 450,50 C500,70 550,100 600,130" fill="none" stroke="#1B4332" strokeWidth="2.5" />
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-gray-400 px-2">
                  {['12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM','9PM','10PM'].map(t => <span key={t}>{t}</span>)}
                </div>
              </div>
            </div>

            {/* Floor Status */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Floor Status</h2>
                  <p className="text-sm text-gray-500">
                    {tables.length > 0
                      ? `${tables.length} tables · ${tables.filter(t => t.status === 'seated' || t.status === 'occupied').length} seated`
                      : 'Main Dining Room · 78% Capacity'}
                  </p>
                </div>
                <button onClick={() => navigate('/dashboard/floor-plan')} className="text-sm font-semibold text-primary hover:text-emerald-700 flex items-center gap-1">
                  Full View <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative bg-gray-50 h-[260px] p-6 overflow-hidden">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                {tables.length > 0 ? (
                  <div className="relative z-10 flex flex-wrap gap-4 justify-center items-center h-full">
                    {tables.slice(0, 8).map((tbl, idx) => {
                      const isSeated = tbl.status === 'seated' || tbl.status === 'occupied'
                      const isReserved = tbl.status === 'reserved'
                      const isDirty = tbl.status === 'dirty'
                      const isAvailable = !isSeated && !isReserved && !isDirty
                      const borderColor = isSeated ? 'border-emerald-500' : isReserved ? 'border-[#D4A373]' : isDirty ? 'border-red-300 border-dashed' : 'border-gray-200'
                      const bg = isDirty ? 'bg-gray-100' : 'bg-white'
                      const shape = tbl.shape === 'circle' || (idx % 3 === 0) ? 'rounded-full' : 'rounded-lg'
                      return (
                        <div key={tbl.id || idx} className={`w-20 h-20 ${shape} ${bg} border-2 ${borderColor} shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-shadow ${isAvailable ? 'opacity-70 hover:opacity-100' : ''}`}>
                          <span className={`font-bold text-sm ${isAvailable ? 'text-gray-400' : 'text-primary'}`}>{tbl.label || tbl.name || `T-${String(idx+1).padStart(2,'0')}`}</span>
                          {isSeated && <span className="text-[10px] text-emerald-600 font-medium mt-0.5">Seated</span>}
                          {isReserved && <span className="text-[10px] text-[#D4A373] font-bold mt-0.5">Reserved</span>}
                          {isDirty && <span className="text-[10px] text-red-500 font-bold mt-0.5">Dirty</span>}
                          {isAvailable && <span className="text-[10px] text-green-600 font-medium mt-0.5">Available</span>}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <>
                    <div className="absolute top-8 left-8 w-24 h-24 rounded-full bg-white border-2 border-emerald-500 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-shadow">
                      <span className="font-bold text-primary text-sm">T-01</span>
                      <div className="flex gap-0.5 mt-1">{[1,2,3].map(i=><span key={i} className="w-2 h-2 rounded-full bg-emerald-500"/>)}<span className="w-2 h-2 rounded-full bg-gray-200"/></div>
                      <span className="text-[10px] text-emerald-600 font-medium mt-1">45m</span>
                    </div>
                    <div className="absolute top-8 left-40 w-24 h-24 rounded-lg bg-white border-2 border-[#D4A373] shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-shadow">
                      <span className="font-bold text-primary text-sm">T-02</span>
                      <span className="text-[10px] text-[#D4A373] font-bold mt-1">6:30 PM</span>
                      <span className="text-[10px] text-gray-400">Smith (4)</span>
                    </div>
                    <div className="absolute top-40 left-8 w-32 h-24 rounded-lg bg-white border-2 border-gray-200 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-shadow opacity-70 hover:opacity-100">
                      <span className="font-bold text-gray-400 text-sm">T-03</span>
                      <span className="text-[10px] text-green-600 font-medium mt-1">Available</span>
                    </div>
                    <div className="absolute top-40 left-52 w-24 h-24 rounded-full bg-white border-2 border-primary shadow-md flex flex-col items-center justify-center cursor-pointer ring-2 ring-[#D4A373]/30 relative">
                      <div className="absolute -top-2 -right-2 bg-[#D4A373] text-white text-[10px] font-bold px-1.5 rounded-full shadow-sm">VIP</div>
                      <span className="font-bold text-primary text-sm">T-04</span>
                      <div className="flex gap-0.5 mt-1">{[1,2].map(i=><span key={i} className="w-2 h-2 rounded-full bg-primary"/>)}</div>
                      <span className="text-[10px] text-primary font-medium mt-1">12m</span>
                    </div>
                    <div className="absolute top-8 right-16 w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-red-300 flex flex-col items-center justify-center cursor-pointer">
                      <span className="font-bold text-gray-500 text-sm">T-05</span>
                      <span className="text-[10px] text-red-500 font-bold mt-1">DIRTY</span>
                    </div>
                  </>
                )}
              </div>
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex gap-4 text-xs text-gray-500 font-medium">
                {[{c:'bg-emerald-500',l:'Seated'},{c:'bg-[#D4A373]',l:'Reserved'},{c:'bg-gray-300',l:'Available'},{c:'bg-red-400',l:'Dirty'}].map(s=>(
                  <div key={s.l} className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${s.c}`}/>{s.l}</div>
                ))}
              </div>
            </div>
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
                <input type="text" placeholder="Filter guests..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary w-48" />
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
