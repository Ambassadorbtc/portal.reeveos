/**
 * Restaurant Calendar — Reservations Planner
 * Horizontal timeline: tables as ROWS, time on X-axis
 * Faithful to 1-Timeline-Polished.html UXPilot design
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Clock, Users, LayoutGrid, List, CalendarDays, MapPin, Search, Plus, Star, AlertTriangle, Crown, Wine, Cake, CreditCard, IceCream, ChevronDown, ChevronUp, Maximize2, Minimize2, X, Phone, Mail, Edit3, RotateCcw, UserX, MoreHorizontal } from 'lucide-react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import RezvoLoader from '../../components/shared/RezvoLoader'

/* ── Design Tokens (from UXPilot polished HTML) ── */
const T = {
  forest: '#1B4332',
  sage: '#52B788',
  amber: '#D4A373',
  white: '#FFFFFF',
  bg: '#FAFAF8',
  border: '#EBEBEB',
  borderLight: '#F0F0F0',
  text: '#111111',
  muted: '#374151',
  status: {
    confirmed: '#1B4332',
    seated: '#52B788',
    walkin: '#D4A373',
    vip: '#3B82F6',
    late: '#EF4444',
    dessert: '#8B5CF6',
    paying: '#9CA3AF',
    pending: '#F59E0B',
    completed: '#6B7280',
    cancelled: '#EF4444',
    noshow: '#DC2626',
  }
}

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const fmt12 = (t) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')}${suffix}`
}

const timeToMin = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const statusColor = (status, isVip) => {
  if (isVip) return T.status.vip
  return T.status[status] || T.status.confirmed
}

/* Zone accent colors */
const ZONE_COLORS = {
  Window: T.amber,
  Main: T.forest,
  Bar: '#3B82F6',
  Patio: T.sage,
  Private: '#8B5CF6',
  Terrace: '#10B981',
}

/* ── Occasion badge ── */
const OccasionBadge = ({ occasion }) => {
  if (!occasion) return null
  const map = {
    birthday: { icon: '🎂', label: 'Birthday' },
    anniversary: { icon: '🥂', label: 'Anniversary' },
    celebration: { icon: '🎉', label: 'Celebration' },
    business: { icon: '💼', label: 'Business' },
    date_night: { icon: '❤️', label: 'Date Night' },
    graduation: { icon: '🎓', label: 'Graduation' },
  }
  const o = map[occasion]
  if (!o) return null
  return (
    <span style={{ fontSize: 10, color: '#555', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 10 }}>{o.icon}</span> {o.label}
    </span>
  )
}

/* ════════════════ MAIN COMPONENT ════════════════ */
export default function RestaurantCalendar() {
  const { business } = useBusiness()
  const bid = business?.id ?? business?._id
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [view, setView] = useState('timeline')
  const [data, setData] = useState({ bookings: [], tables: [], covers: {}, servicePeriods: [] })
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [activePeriod, setActivePeriod] = useState('all')
  const [collapsedZones, setCollapsedZones] = useState({})
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const scrollRef = useRef(null)

  const dateObj = new Date(selectedDate + 'T00:00:00')
  const isToday = selectedDate === new Date().toISOString().slice(0, 10)
  const dateLabel = `${DAY_NAMES[dateObj.getDay()]} ${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()]} ${dateObj.getFullYear()}`

  /* ── Fetch ── */
  useEffect(() => {
    if (!bid) return
    setLoading(true)
    api.get(`/calendar/business/${bid}/restaurant?date=${selectedDate}&view=day`)
      .then(d => { setData(d); setLoading(false) })
      .catch(err => { console.error('Calendar error:', err); setLoading(false) })
  }, [bid, selectedDate])

  /* ── Date nav ── */
  const prevDay = () => { const d = new Date(dateObj); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().slice(0, 10)) }
  const nextDay = () => { const d = new Date(dateObj); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().slice(0, 10)) }
  const goToday = () => setSelectedDate(new Date().toISOString().slice(0, 10))

  /* ── Time range from service periods ── */
  const timeRange = useMemo(() => {
    const periods = data.servicePeriods || []
    if (periods.length === 0) return { start: 720, end: 1380, slots: [] }

    let startMin, endMin
    if (activePeriod === 'lunch') {
      const p = periods.find(p => p.name === 'Lunch')
      startMin = p ? timeToMin(p.start) : 720
      endMin = p ? timeToMin(p.end) + 60 : 900
    } else if (activePeriod === 'dinner') {
      const p = periods.find(p => p.name === 'Dinner')
      startMin = p ? timeToMin(p.start) : 1080
      endMin = p ? timeToMin(p.end) + 60 : 1380
    } else {
      startMin = Math.min(...periods.map(p => timeToMin(p.start)))
      endMin = Math.max(...periods.map(p => timeToMin(p.end))) + 60
    }

    const slots = []
    for (let m = startMin; m < endMin; m += 30) {
      const h = Math.floor(m / 60)
      const min = m % 60
      slots.push({ minutes: m, label: `${h}:${String(min).padStart(2, '0')}` })
    }
    return { start: startMin, end: endMin, slots }
  }, [data.servicePeriods, activePeriod])

  /* ── Tables grouped by zone ── */
  const tablesByZone = useMemo(() => {
    const zones = {}
    const order = []
    for (const t of data.tables || []) {
      const z = t.zone || 'Main'
      if (!zones[z]) { zones[z] = []; order.push(z) }
      zones[z].push(t)
    }
    return { zones, order }
  }, [data.tables])

  /* ── Filtered bookings (period + search) ── */
  const filteredBookings = useMemo(() => {
    let bs = data.bookings || []
    if (activePeriod !== 'all') {
      bs = bs.filter(b => {
        const bMin = timeToMin(b.time)
        return bMin >= timeRange.start && bMin < timeRange.end
      })
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      bs = bs.filter(b => {
        const fields = [
          b.customerName, b.tableName, b.status, b.occasion,
          b.notes, fmt12(b.time), String(b.partySize)
        ].filter(Boolean).join(' ').toLowerCase()
        // Fuzzy: every word in query must appear somewhere
        return q.split(/\s+/).every(word => fields.includes(word))
      })
    }
    return bs
  }, [data.bookings, activePeriod, timeRange, searchQuery])

  /* ── Bookings by table ── */
  const bookingsByTable = useMemo(() => {
    const map = {}
    for (const b of filteredBookings) {
      if (!map[b.tableId]) map[b.tableId] = []
      map[b.tableId].push(b)
    }
    return map
  }, [filteredBookings])

  /* ── Stats ── */
  const stats = useMemo(() => {
    const bs = filteredBookings
    const covers = bs.reduce((s, b) => s + (b.partySize || 0), 0)
    const confirmed = bs.filter(b => b.status === 'confirmed').length
    const seated = bs.filter(b => b.status === 'seated').length
    const late = bs.filter(b => b.status === 'late').length
    const pending = bs.filter(b => b.status === 'pending').length
    return { covers, confirmed, seated, late, pending, available: (data.tables || []).length - seated }
  }, [filteredBookings, data.tables])

  /* ── Current time line position (updates every 60s) ── */
  const [clockTick, setClockTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setClockTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  const nowPercent = useMemo(() => {
    if (!isToday) return null
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    if (nowMin < timeRange.start || nowMin > timeRange.end) return null
    return ((nowMin - timeRange.start) / (timeRange.end - timeRange.start)) * 100
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, timeRange, clockTick])

  /* ── Capacity per slot ── */
  const slotCaps = useMemo(() => {
    const totalCap = (data.tables || []).reduce((s, t) => s + (t.capacity || 0), 0)
    return timeRange.slots.map(slot => {
      const sStart = slot.minutes
      const sEnd = sStart + 30
      let covers = 0
      for (const b of filteredBookings) {
        const bStart = timeToMin(b.time)
        const bEnd = bStart + (b.duration || 75)
        if (bStart < sEnd && bEnd > sStart) covers += b.partySize || 0
      }
      const pct = totalCap ? Math.round((covers / totalCap) * 100) : 0
      return { ...slot, covers, capacity: totalCap, pct }
    })
  }, [timeRange.slots, filteredBookings, data.tables])

  /* ── Booking block position ── */
  const bookingStyle = (b) => {
    const bStart = timeToMin(b.time)
    const bEnd = bStart + (b.duration || 75)
    const range = timeRange.end - timeRange.start
    const left = ((bStart - timeRange.start) / range) * 100
    const width = ((bEnd - bStart) / range) * 100
    return { left: `${left}%`, width: `${Math.max(width, 2)}%` }
  }

  /* ── Build flat row list with zone headers ── */
  const rows = useMemo(() => {
    const list = []
    for (const zone of tablesByZone.order) {
      list.push({ type: 'zone', zone })
      if (!collapsedZones[zone]) {
        for (const table of tablesByZone.zones[zone]) {
          list.push({ type: 'table', table, zone })
        }
      }
    }
    return list
  }, [tablesByZone, collapsedZones])

  /* ── Fullscreen toggle ── */
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isFullscreen])

  /* ── FAB shift when panel open ── */
  useEffect(() => {
    if (selectedBooking) {
      document.body.classList.add('rezvo-fab-shifted')
      setEditMode(false)
    } else {
      document.body.classList.remove('rezvo-fab-shifted')
    }
    return () => document.body.classList.remove('rezvo-fab-shifted')
  }, [selectedBooking])

  const ROW_H = 54
  const ZONE_H = 34
  const LEFT_W = 180

  const capColor = (pct) => {
    if (pct >= 90) return T.status.late
    if (pct >= 70) return T.amber
    return T.forest
  }

  /* ═══════════════════════ RENDER ═══════════════════════ */

  if (loading && (data.tables || []).length === 0) {
    return <RezvoLoader message="Loading reservations..." size="md" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.white, fontFamily: "'Figtree', sans-serif", overflow: 'hidden',
      ...(isFullscreen ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 } : {})
    }}>

      {/* ══════ SUB-HEADER TOOLBAR ══════ */}
      <header style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 8, background: '#fff', borderBottom: `1px solid ${T.border}`, flexShrink: 0, zIndex: 40 }}>

        {/* Date Nav Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#F5F5F5', borderRadius: 24, padding: '3px 4px' }}>
          <button onClick={prevDay} style={pillBtn}><ChevronLeft size={13} /></button>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.forest, padding: '0 8px', whiteSpace: 'nowrap' }}>{dateLabel}</span>
          <button onClick={nextDay} style={pillBtn}><ChevronRight size={13} /></button>
        </div>

        {/* Today */}
        <button onClick={goToday} style={{ padding: '8px 18px', borderRadius: 20, border: 'none', background: T.forest, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(27,67,50,0.2)' }}>Today</button>

        <div style={divider} />

        {/* Lunch / Dinner toggle */}
        <div style={toggleWrap}>
          {[{ key: 'all', label: 'All' }, { key: 'lunch', label: 'Lunch' }, { key: 'dinner', label: 'Dinner' }].map(p => (
            <button key={p.key} onClick={() => setActivePeriod(p.key)}
              style={activePeriod === p.key ? toggleActive : toggleInactive}>
              {p.label}
            </button>
          ))}
        </div>

        <div style={divider} />

        {/* View toggle */}
        <div style={toggleWrap}>
          {[{ key: 'timeline', icon: <Clock size={11} />, label: 'Timeline' },
            { key: 'tables', icon: <LayoutGrid size={11} />, label: 'Tables' },
            { key: 'list', icon: <List size={11} />, label: 'List' }].map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              style={view === v.key ? { ...toggleActive, display: 'flex', alignItems: 'center', gap: 5 } : { ...toggleInactive, display: 'flex', alignItems: 'center', gap: 5 }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Live Status Chips + Search + Tablet Toggle (all top-right) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatChip color={T.forest} value={stats.covers} label="Covers" />
          <StatChip color="#059669" value={stats.available} label="Available" />
          <StatChip color={T.sage} value={stats.seated} label="Seated" />
          <StatChip color={T.amber} value={stats.pending} label="Pending" />
          <StatChip color={T.status.late} value={stats.late} label="Late" />

          <div style={{ width: 1, height: 24, background: '#EBEBEB' }} />

          {/* Search Pill — always visible */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F5F5F5', borderRadius: 999, padding: '6px 14px', minWidth: showSearch ? 200 : 38, transition: 'all 0.3s ease', cursor: 'pointer' }}
            onClick={() => !showSearch && setShowSearch(true)}>
            <Search size={14} color="#555" />
            {showSearch ? (
              <>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus
                  placeholder="Search guests, tables..."
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 500, color: '#111', width: 150, fontFamily: "'Figtree', sans-serif" }} />
                <button onClick={(e) => { e.stopPropagation(); setShowSearch(false); setSearchQuery('') }} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><X size={13} color="#666" /></button>
              </>
            ) : null}
          </div>

          {/* Tablet Fullscreen Toggle — animated icon */}
          <button onClick={() => setIsFullscreen(!isFullscreen)} 
            style={{ ...iconBtn, transition: 'all 0.3s ease', transform: isFullscreen ? 'rotate(180deg)' : 'rotate(0deg)' }} 
            title={isFullscreen ? 'Exit tablet mode' : 'Tablet mode'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.3s ease' }}>
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <line x1="12" y1="18" x2="12" y2="18" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* ══════ CAPACITY STRIP ══════ */}
      {view === 'timeline' && (
        <div style={{ height: 36, background: '#F5F5F5', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ width: LEFT_W, flexShrink: 0, background: '#F5F5F5', borderRight: '1px solid #E5E7EB', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capacity</span>
          </div>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {slotCaps.map((s, i) => (
              <div key={i} style={{ flex: 1, borderRight: '1px solid rgba(229,231,235,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 3px' }}>
                <span style={{ fontSize: 11, color: s.pct >= 90 ? T.status.late : s.pct >= 70 ? '#1F2937' : '#374151', fontWeight: s.pct >= 70 ? 700 : 400, lineHeight: 1 }}>{s.covers}/{s.capacity}</span>
                <div style={{ width: '100%', height: 3, background: '#E5E7EB', borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.pct}%`, background: capColor(s.pct), borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════ TIMELINE VIEW ══════ */}
      {view === 'timeline' && (
        <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', display: 'flex', background: T.white, position: 'relative' }}
          className="timeline-scroll">

          {/* LEFT COLUMN — Sticky tables */}
          <div style={{ width: LEFT_W, flexShrink: 0, background: T.white, borderRight: '1px solid #E5E7EB', position: 'sticky', left: 0, zIndex: 30, boxShadow: '2px 0 4px rgba(0,0,0,0.03)' }}>
            {/* TABLES header */}
            <div style={{ height: 40, background: T.white, borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>TABLES</span>
            </div>

            {rows.map((row, idx) => {
              if (row.type === 'zone') {
                return (
                  <div key={`z-${row.zone}`} onClick={() => setCollapsedZones(prev => ({ ...prev, [row.zone]: !prev[row.zone] }))}
                    style={{ height: ZONE_H, background: '#FAFAFA', padding: '0 12px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 12, borderRadius: 2, background: ZONE_COLORS[row.zone] || T.forest }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>{row.zone}</span>
                    </div>
                    {collapsedZones[row.zone] ? <ChevronRight size={12} color="#555" /> : <ChevronDown size={12} color="#555" />}
                  </div>
                )
              }
              const t = row.table
              const shortName = t.name.replace('Table ', 'T')
              return (
                <div key={`t-${t.id}`} style={{ height: ROW_H, borderBottom: '1px solid #F9FAFB', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#1F2937' }}>{shortName}</span>
                    <span style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>{t.capacity}-top</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* RIGHT COLUMN — Timeline grid */}
          <div style={{ flex: 1, minWidth: Math.max(timeRange.slots.length * 120, 800), position: 'relative' }}>

            {/* Time header (sticky) */}
            <div style={{ height: 40, background: T.white, borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 20, display: 'flex' }}>
              {timeRange.slots.map((s, i) => (
                <div key={i} style={{ flex: 1, borderRight: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  {s.label}
                </div>
              ))}
            </div>

            {/* Current time red line — design: red line + diamond top */}
            {nowPercent != null && (
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${nowPercent}%`, width: 2, background: '#EF4444', zIndex: 25, pointerEvents: 'none' }}>
                {/* Diamond indicator at top */}
                <div style={{ width: 10, height: 10, background: '#EF4444', transform: 'rotate(45deg)', position: 'absolute', top: 35, left: -4, borderRadius: 1 }} />
                {/* Time label */}
                <div style={{ position: 'absolute', top: 22, left: 8, background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                  {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}

            {/* Grid rows */}
            <div style={{ position: 'relative' }}>

              {/* Vertical grid lines */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none', zIndex: 0 }}>
                {timeRange.slots.map((_, i) => (
                  <div key={i} style={{ flex: 1, borderRight: '1px dashed #F3F4F6' }} />
                ))}
              </div>

              {/* Rows */}
              {rows.map((row) => {
                if (row.type === 'zone') {
                  return <div key={`zr-${row.zone}`} style={{ height: ZONE_H, background: 'rgba(249,250,251,0.3)', borderBottom: '1px solid #F9FAFB' }} />
                }

                const t = row.table
                const tableBookings = bookingsByTable[t.id] || []

                return (
                  <div key={`tr-${t.id}`} style={{ height: ROW_H, borderBottom: '1px solid #F9FAFB', position: 'relative' }}>
                    {tableBookings.map(b => {
                      const pos = bookingStyle(b)
                      const color = statusColor(b.status, b.isVip)
                      const isVip = b.isVip
                      const isSelected = selectedBooking?.id === b.id
                      return (
                        <div key={b.id}
                          onClick={() => setSelectedBooking(isSelected ? null : b)}
                          style={{
                            position: 'absolute', top: 4, bottom: 4,
                            left: pos.left, width: pos.width,
                            background: color + '15',
                            border: `1px solid ${color}30`,
                            borderRadius: 6,
                            boxShadow: isSelected ? `0 0 0 2px ${color}50` : '0 1px 3px rgba(0,0,0,0.04)',
                            display: 'flex', alignItems: 'center', padding: '0 8px',
                            cursor: 'pointer', zIndex: 5,
                            transition: 'all 0.15s',
                            overflow: 'hidden',
                          }}
                          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)'; e.currentTarget.style.zIndex = '10' }}
                          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isSelected ? `0 0 0 2px ${color}50` : '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.zIndex = '5' }}
                        >
                          {/* Left color bar highlight */}
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color, borderRadius: '6px 0 0 6px' }} />

                          {/* Content */}
                          <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {b.partySize} · {b.customerName?.split(' ').pop() || 'Guest'}
                                {isVip && <span style={{ marginLeft: 3 }}><Crown size={8} style={{ display: 'inline', color: '#3B82F6', verticalAlign: 'middle' }} /></span>}
                              </span>
                              {b.status === 'late' && <AlertTriangle size={10} color={T.status.late} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                              {isVip && <span style={{ fontSize: 10, background: '#EFF6FF', color: '#2563EB', padding: '1px 5px', borderRadius: 3 }}>VIP</span>}
                              {b.occasion && <OccasionBadge occasion={b.occasion} />}
                              {b.notes && !b.occasion && <span style={{ fontSize: 10, color: '#555' }}>📝</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════ TABLE STATUS VIEW ══════ */}
      {view === 'tables' && <TableStatusView data={data} filteredBookings={filteredBookings} onSelectBooking={setSelectedBooking} />}

      {/* ══════ LIST VIEW ══════ */}
      {view === 'list' && <ReservationListView bookings={filteredBookings} onSelectBooking={setSelectedBooking} />}

      {/* ══════ BOTTOM STATUS BAR ══════ */}
      <div style={{ height: 32, background: T.white, borderTop: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', fontSize: 13, color: '#374151', flexShrink: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span><strong style={{ color: '#374151' }}>Lunch:</strong> {(data.bookings || []).filter(b => timeToMin(b.time) < 900).length} bookings · {(data.bookings || []).filter(b => timeToMin(b.time) < 900).reduce((s, b) => s + (b.partySize || 0), 0)} covers</span>
          <span style={{ width: 1, height: 12, background: '#D1D5DB', display: 'inline-block' }} />
          <span><strong style={{ color: '#374151' }}>Dinner:</strong> {(data.bookings || []).filter(b => timeToMin(b.time) >= 1080).length} bookings · {(data.bookings || []).filter(b => timeToMin(b.time) >= 1080).reduce((s, b) => s + (b.partySize || 0), 0)} covers</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> Avg turn: <strong style={{ color: '#374151' }}>1h 15m</strong></span>
          <span style={{ width: 1, height: 12, background: '#D1D5DB', display: 'inline-block' }} />
          <span>{filteredBookings.length} total bookings</span>
        </div>
      </div>

      {/* ══════ CRM GUEST DETAIL PANEL (matches 3-Guest CRM design) ══════ */}
      {selectedBooking && <>
        {/* Glass overlay */}
        <div onClick={() => setSelectedBooking(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', zIndex: 55 }} />

        {/* FAB shift style — push FAB left when panel is open */}
        <style>{`
          .rezvo-chat-bubble { transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important; }
          .rezvo-fab-shifted .rezvo-chat-bubble { transform: translateX(-440px) !important; }
          @keyframes panelSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        `}</style>

        {/* Panel */}
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '100vw', background: T.white, boxShadow: '0 8px 40px rgba(0,0,0,0.12)', zIndex: 60, display: 'flex', flexDirection: 'column', fontFamily: "'Figtree', sans-serif", animation: 'panelSlideIn 0.3s ease-out' }}>

          {/* ─ Top bar: edit, delete, close ─ */}
          <div style={{ padding: '16px 24px 0', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setEditMode(!editMode)} style={{ ...panelIconBtn, background: editMode ? '#F0F7F4' : 'transparent', color: editMode ? T.forest : '#666' }} title="Edit"><Edit3 size={14} /></button>
            <button style={{ ...panelIconBtn, color: '#EF4444' }} title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
            <button onClick={() => setSelectedBooking(null)} style={{ ...panelIconBtn, color: '#666' }} title="Close"><X size={16} /></button>
          </div>

          {/* ─ Avatar + Name + Badges ─ */}
          <div style={{ padding: '12px 24px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: 16, marginBottom: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #1B4332, #2D6A4F)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0, border: '2px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {(selectedBooking.customerName || 'G').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editMode ? (
                  <input defaultValue={selectedBooking.customerName} style={{ fontSize: 22, fontWeight: 700, color: T.forest, border: 'none', borderBottom: `2px solid ${T.sage}`, outline: 'none', width: '100%', background: 'transparent', fontFamily: "'Figtree', sans-serif", padding: '0 0 4px' }} />
                ) : (
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: T.forest, margin: 0, lineHeight: 1.2 }}>{selectedBooking.customerName}</h2>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <span style={{ padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: T.forest, color: '#fff' }}>Regular</span>
                  <span style={{ padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: `1px solid ${T.sage}60`, color: `${T.sage}80` }}>New</span>
                  {selectedBooking.isVip && <span style={{ padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#D4A37330', color: '#D4A373' }}>VIP</span>}
                  <span style={{ padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: '1px solid #EF444440', color: '#EF444460' }}>At Risk</span>
                </div>
              </div>
            </div>

            {/* 4-stat grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, value: '12', label: 'visits', color: T.forest },
                { icon: <AlertTriangle size={14} />, value: '1', label: 'no-show', color: T.amber },
                { icon: <span style={{ fontSize: 13, fontWeight: 700 }}>£</span>, value: '847', label: 'spent', color: T.forest },
                { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.sage} strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>, value: '70.58', label: 'avg', color: T.sage },
              ].map((s, i) => (
                <div key={i} style={{ background: '#F5F5F5', borderRadius: 16, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ marginBottom: 4, color: s.color, opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.forest, lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─ Scrollable Content ─ */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }} className="timeline-scroll">

            {/* CONTACT */}
            <section style={{ marginBottom: 24 }}>
              <h3 style={sectionTitle}>Contact</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🇬🇧</div>
                    {editMode ? (
                      <input defaultValue={selectedBooking.phone || '+44 7886 483772'} style={editInput} />
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 500, color: T.forest }}>{selectedBooking.phone || '+44 7886 483772'}</span>
                    )}
                  </div>
                  <button style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${T.border}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.sage }}>
                    <Phone size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}><Mail size={13} /></div>
                    {editMode ? (
                      <input defaultValue={selectedBooking.email || 'guest@email.com'} style={editInput} />
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 500, color: T.forest }}>{selectedBooking.email || 'guest@email.com'}</span>
                    )}
                  </div>
                  <button style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${T.border}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.sage }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
                <div style={{ paddingLeft: 44 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 999, border: `1px solid ${T.sage}`, color: T.sage }}>SMS preferred</span>
                </div>
              </div>
            </section>

            {/* TAGS */}
            <section style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={sectionTitle}>Tags</h3>
                <button style={{ fontSize: 12, fontWeight: 700, color: T.sage, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={12} /> Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { label: 'Friday Regular', bg: '#F0F7F4', dot: T.sage },
                  ...(selectedBooking.occasion ? [{ label: selectedBooking.occasion.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()), bg: '#FFF8F0', dot: T.amber }] : []),
                  { label: 'Wine Lover', bg: '#fff', dot: T.sage, border: true },
                ].map((tag, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500, color: T.forest, background: tag.bg, border: tag.border ? `1px solid ${T.border}` : '1px solid transparent', cursor: 'pointer' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: tag.dot }} />
                    {tag.label}
                  </span>
                ))}
              </div>
            </section>

            {/* NOTES */}
            <section style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={sectionTitle}>Notes</h3>
                <button onClick={() => setEditMode(!editMode)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#666' }}><Edit3 size={13} /></button>
              </div>
              <div style={{ background: '#FAFAF8', border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, position: 'relative', marginBottom: 12 }}>
                {editMode ? (
                  <textarea defaultValue={selectedBooking.notes || ''} rows={3} style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: T.forest, lineHeight: 1.5, fontFamily: "'Figtree', sans-serif", resize: 'vertical' }} />
                ) : (
                  <p style={{ fontSize: 13, color: `${T.forest}CC`, fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
                    "{selectedBooking.notes || 'No notes yet'}"
                  </p>
                )}
              </div>
              {/* Preference pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selectedBooking.notes?.toLowerCase().includes('window') && (
                  <span style={prefPill}>🪑 Window seat</span>
                )}
                {selectedBooking.notes?.toLowerCase().includes('highchair') && (
                  <span style={prefPill}>👶 Highchair needed</span>
                )}
                {selectedBooking.notes?.toLowerCase().includes('allerg') && (
                  <span style={{ ...prefPill, color: '#EF4444', background: '#FFF0F0', border: '1px solid #EF444420' }}>⚠️ Allergy noted</span>
                )}
                {selectedBooking.occasion && (
                  <span style={prefPill}>🎉 {selectedBooking.occasion.replace('_', ' ')}</span>
                )}
              </div>
            </section>

            {/* BOOKING DETAILS */}
            <section style={{ marginBottom: 24 }}>
              <h3 style={sectionTitle}>Booking Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Date', value: dateLabel },
                  { label: 'Time', value: fmt12(selectedBooking.time), editable: true },
                  { label: 'Table', value: selectedBooking.tableName, editable: true },
                  { label: 'Party Size', value: `${selectedBooking.partySize} guests`, editable: true },
                  { label: 'Duration', value: `${selectedBooking.duration || 75} minutes`, editable: true },
                  { label: 'Status', value: selectedBooking.status?.toUpperCase(), isStatus: true },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0', borderBottom: i < 5 ? '1px solid #F5F5F5' : 'none' }}>
                    <span style={{ color: '#555' }}>{row.label}</span>
                    {row.isStatus ? (
                      <span style={{ fontWeight: 700, color: statusColor(selectedBooking.status, selectedBooking.isVip), fontSize: 11 }}>{row.value}</span>
                    ) : editMode && row.editable ? (
                      <input defaultValue={row.value} style={{ ...editInput, textAlign: 'right', width: 120 }} />
                    ) : (
                      <span style={{ fontWeight: 600, color: '#111' }}>{row.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* HISTORY */}
            <section style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={sectionTitle}>History</h3>
                <span style={{ fontSize: 11, fontWeight: 500, background: '#F5F5F5', padding: '3px 10px', borderRadius: 999, color: '#555' }}>All ▾</span>
              </div>
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: T.border }} />
                {[
                  { date: dateLabel, amount: '—', table: selectedBooking.tableName, party: selectedBooking.partySize, current: true },
                  { date: 'Previous visit', amount: '£89.50', table: 'Table 1', party: 2 },
                ].map((h, i) => (
                  <div key={i} style={{ position: 'relative', marginBottom: 16, paddingLeft: 16 }}>
                    <div style={{ position: 'absolute', left: -13, top: 4, width: 12, height: 12, borderRadius: '50%', background: h.current ? T.sage : T.sage, border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', zIndex: 1 }} />
                    {h.current ? (
                      <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: T.forest }}>{h.date}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: T.forest }}>{h.amount}</span>
                        </div>
                        <span style={{ fontSize: 12, color: '#555' }}>{h.table} · Party of {h.party}</span>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#555' }}>{h.date}</span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#555' }}>{h.amount}</span>
                        </div>
                        <span style={{ fontSize: 12, color: '#888' }}>{h.table} · Party of {h.party}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ─ Action Bar ─ */}
          <div style={{ padding: 16, background: T.white, borderTop: `1px solid ${T.border}`, flexShrink: 0, zIndex: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
              <button style={{ flex: 1, minWidth: 110, background: T.forest, color: '#fff', fontWeight: 600, padding: '12px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(27,67,50,0.3)' }}>
                ✓ Check In
              </button>
              <button style={{ flexShrink: 0, background: '#fff', border: `1px solid ${T.forest}`, color: T.forest, fontWeight: 500, padding: '12px 20px', borderRadius: 999, cursor: 'pointer', fontSize: 13 }}>
                Edit
              </button>
              <button style={{ flexShrink: 0, background: T.sage, color: '#fff', fontWeight: 500, padding: '12px 20px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, boxShadow: '0 2px 8px rgba(82,183,136,0.3)' }}>
                Rebook
              </button>
              <button style={{ flexShrink: 0, background: '#fff', border: '1px solid rgba(239,68,68,0.5)', color: '#EF4444', fontWeight: 500, padding: '12px 20px', borderRadius: 999, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
                No Show
              </button>
              <button style={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', border: `1px solid ${T.border}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        </div>
      </>}

      <style>{`
        .timeline-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
        .timeline-scroll::-webkit-scrollbar-track { background: #f1f1f1; }
        .timeline-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
        .timeline-scroll::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      `}</style>
    </div>
  )
}

/* ── Shared style objects ── */
const pillBtn = { width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1B4332', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const divider = { width: 1, height: 24, background: '#EBEBEB' }
const toggleWrap = { display: 'flex', background: '#F5F5F5', borderRadius: 20, padding: 3 }
const toggleActive = { padding: '7px 16px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: '#1B4332', color: '#fff', boxShadow: '0 2px 8px rgba(27,67,50,0.2)', transition: 'all 0.15s', fontFamily: "'Figtree', sans-serif" }
const toggleInactive = { padding: '7px 16px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: 'transparent', color: '#555', transition: 'all 0.15s', fontFamily: "'Figtree', sans-serif" }
const iconBtn = { width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#F5F5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }
const panelIconBtn = { width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }
const sectionTitle = { fontSize: 13, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, marginBottom: 12 }
const editInput = { fontSize: 14, fontWeight: 500, color: '#1B4332', border: 'none', borderBottom: '2px solid #52B788', outline: 'none', background: 'transparent', fontFamily: "'Figtree', sans-serif", padding: '2px 0' }
const prefPill = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#555', background: '#F5F5F5', padding: '4px 10px', borderRadius: 6, border: '1px solid #F0F0F0' }

function StatChip({ color, value, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
        <strong style={{ color: '#1B4332', fontWeight: 800 }}>{value}</strong> {label}
      </span>
    </div>
  )
}

function DetailCard({ label, value }) {
  return (
    <div style={{ background: '#F9FAFB', padding: '8px 12px', borderRadius: 8 }}>
      <div style={{ fontSize: 12, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937', marginTop: 2 }}>{value}</div>
    </div>
  )
}

/* ══════ TABLE STATUS VIEW ══════ */
function TableStatusView({ data, filteredBookings, onSelectBooking }) {
  const tablesByZone = useMemo(() => {
    const zones = {}; const order = []
    for (const t of data.tables || []) {
      const z = t.zone || 'Main'
      if (!zones[z]) { zones[z] = []; order.push(z) }
      zones[z].push(t)
    }
    return { zones, order }
  }, [data.tables])

  const bookingsByTable = useMemo(() => {
    const map = {}
    for (const b of filteredBookings) {
      if (!map[b.tableId]) map[b.tableId] = []
      map[b.tableId].push(b)
    }
    return map
  }, [filteredBookings])

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 20, background: '#FAFAFA' }}>
      {tablesByZone.order.map(zone => (
        <div key={zone} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: ZONE_COLORS[zone] || '#1B4332' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>{zone}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {(tablesByZone.zones[zone] || []).map(t => {
              const tbs = bookingsByTable[t.id] || []
              const current = tbs.find(b => {
                const start = timeToMin(b.time)
                const end = start + (b.duration || 75)
                return nowMin >= start && nowMin < end
              })
              const next = tbs.find(b => timeToMin(b.time) > nowMin)
              const booking = current || next
              const status = current ? 'seated' : next ? 'upcoming' : 'available'
              const sColors = { seated: T.sage, upcoming: T.amber, available: '#D1D5DB' }

              return (
                <div key={t.id} onClick={() => booking && onSelectBooking(booking)}
                  style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, cursor: booking ? 'pointer' : 'default', borderLeft: `4px solid ${sColors[status]}`, transition: 'all 0.15s' }}
                  onMouseOver={e => { if (booking) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                  onMouseOut={e => { e.currentTarget.style.boxShadow = 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{t.name.replace('Table ', 'T')}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sColors[status], textTransform: 'uppercase' }}>{status}</span>
                  </div>
                  <span style={{ fontSize: 13, color: '#555' }}>{t.capacity} seats · {zone}</span>
                  {booking && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{booking.partySize} · {booking.customerName?.split(' ').pop()}</div>
                      <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{fmt12(booking.time)}{booking.occasion ? ` · ${booking.occasion}` : ''}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ══════ RESERVATION LIST VIEW ══════ */
function ReservationListView({ bookings, onSelectBooking }) {
  const sorted = useMemo(() => [...bookings].sort((a, b) => timeToMin(a.time) - timeToMin(b.time)), [bookings])

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1.5fr 80px 100px 80px 100px 1fr', padding: '10px 20px', background: '#FAFAFA', borderBottom: '1px solid #E5E7EB', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 5 }}>
        <span>Time</span><span>Guest</span><span>Party</span><span>Table</span><span>Status</span><span>Occasion</span><span>Notes</span>
      </div>
      {sorted.map((b, idx) => (
        <div key={b.id} onClick={() => onSelectBooking(b)}
          style={{ display: 'grid', gridTemplateColumns: '60px 1.5fr 80px 100px 80px 100px 1fr', padding: '12px 20px', background: idx % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', alignItems: 'center', transition: 'background 0.1s' }}
          onMouseOver={e => e.currentTarget.style.background = '#F0F7F4'}
          onMouseOut={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFAFA'}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{fmt12(b.time)}</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{b.customerName}</span>
            {b.isVip && <Crown size={10} style={{ marginLeft: 4, color: '#3B82F6', display: 'inline', verticalAlign: 'middle' }} />}
          </div>
          <span style={{ fontSize: 13, color: '#111' }}>{b.partySize}</span>
          <span style={{ fontSize: 13, color: '#111' }}>{b.tableName}</span>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: statusColor(b.status, b.isVip), background: statusColor(b.status, b.isVip) + '15', padding: '2px 8px', borderRadius: 999, display: 'inline-block' }}>{b.status}</span>
          <span style={{ fontSize: 12, color: '#111' }}>{b.occasion ? b.occasion.replace('_', ' ') : '—'}</span>
          <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.notes || '—'}</span>
        </div>
      ))}
    </div>
  )
}
