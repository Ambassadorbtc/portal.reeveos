/**
 * Restaurant Calendar — Reservations Planner
 * Horizontal timeline: tables as ROWS, time on X-axis
 * Faithful to 1-Timeline-Polished.html UXPilot design
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Clock, Users, LayoutGrid, List, CalendarDays, MapPin, Search, Plus, Star, AlertTriangle, Crown, Wine, Cake, CreditCard, IceCream, ChevronDown, ChevronUp } from 'lucide-react'
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
  muted: '#6B7280',
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
    <span style={{ fontSize: 8, color: '#999', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 8 }}>{o.icon}</span> {o.label}
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

  /* ── Filtered bookings ── */
  const filteredBookings = useMemo(() => {
    if (activePeriod === 'all') return data.bookings || []
    return (data.bookings || []).filter(b => {
      const bMin = timeToMin(b.time)
      return bMin >= timeRange.start && bMin < timeRange.end
    })
  }, [data.bookings, activePeriod, timeRange])

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

  const ROW_H = 48
  const ZONE_H = 31
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.white, fontFamily: "'Figtree', sans-serif", overflow: 'hidden' }}>

      {/* ══════ SUB-HEADER TOOLBAR ══════ */}
      <header style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 8, background: '#fff', borderBottom: `1px solid ${T.border}`, flexShrink: 0, zIndex: 40, flexWrap: 'wrap' }}>

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

        {/* Live Status Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatChip color={T.forest} value={stats.covers} label="Covers" />
          <StatChip color="#059669" value={stats.available} label="Available" />
          <StatChip color={T.sage} value={stats.seated} label="Seated" />
          <StatChip color={T.amber} value={stats.pending} label="Pending" />
          <StatChip color={T.status.late} value={stats.late} label="Late" />
        </div>

        <div style={divider} />

        <button style={iconBtn}><Search size={14} /></button>
      </header>

      {/* ══════ CAPACITY STRIP ══════ */}
      {view === 'timeline' && (
        <div style={{ height: 36, background: '#F5F5F5', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ width: LEFT_W, flexShrink: 0, background: '#F5F5F5', borderRight: '1px solid #E5E7EB', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capacity</span>
          </div>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {slotCaps.map((s, i) => (
              <div key={i} style={{ flex: 1, borderRight: '1px solid rgba(229,231,235,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 3px' }}>
                <span style={{ fontSize: 9, color: s.pct >= 90 ? T.status.late : s.pct >= 70 ? '#1F2937' : '#6B7280', fontWeight: s.pct >= 70 ? 700 : 400, lineHeight: 1 }}>{s.covers}/{s.capacity}</span>
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
              <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF' }}>TABLES</span>
            </div>

            {rows.map((row, idx) => {
              if (row.type === 'zone') {
                return (
                  <div key={`z-${row.zone}`} onClick={() => setCollapsedZones(prev => ({ ...prev, [row.zone]: !prev[row.zone] }))}
                    style={{ height: ZONE_H, background: '#FAFAFA', padding: '0 12px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 12, borderRadius: 2, background: ZONE_COLORS[row.zone] || T.forest }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>{row.zone}</span>
                    </div>
                    {collapsedZones[row.zone] ? <ChevronRight size={12} color="#9CA3AF" /> : <ChevronDown size={12} color="#9CA3AF" />}
                  </div>
                )
              }
              const t = row.table
              const shortName = t.name.replace('Table ', 'T')
              return (
                <div key={`t-${t.id}`} style={{ height: ROW_H, borderBottom: '1px solid #F9FAFB', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1F2937' }}>{shortName}</span>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>{t.capacity}-top</span>
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
                <div key={i} style={{ flex: 1, borderRight: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 12, color: '#9CA3AF' }}>
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
                            background: T.white,
                            border: isVip ? '1px solid rgba(59,130,246,0.25)' : '1px solid #E5E7EB',
                            borderRadius: 6,
                            boxShadow: isSelected ? '0 0 0 2px rgba(27,67,50,0.3)' : '0 1px 3px rgba(0,0,0,0.04)',
                            display: 'flex', alignItems: 'center', padding: '0 8px',
                            cursor: 'pointer', zIndex: 5,
                            transition: 'all 0.15s',
                            overflow: 'hidden',
                          }}
                          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'; e.currentTarget.style.zIndex = '10' }}
                          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isSelected ? '0 0 0 2px rgba(27,67,50,0.3)' : '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.zIndex = '5' }}
                        >
                          {/* Left color bar */}
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color, borderRadius: '6px 0 0 6px' }} />

                          {/* Content */}
                          <div style={{ marginLeft: 6, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {b.partySize} · {b.customerName?.split(' ').pop() || 'Guest'}
                                {isVip && <span style={{ marginLeft: 3 }}><Crown size={8} style={{ display: 'inline', color: '#3B82F6', verticalAlign: 'middle' }} /></span>}
                              </span>
                              {b.status === 'late' && <AlertTriangle size={10} color={T.status.late} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                              {isVip && <span style={{ fontSize: 9, background: '#EFF6FF', color: '#2563EB', padding: '0 4px', borderRadius: 3 }}>VIP</span>}
                              {b.occasion && <OccasionBadge occasion={b.occasion} />}
                              {b.notes && !b.occasion && <span style={{ fontSize: 8, color: '#9CA3AF' }}>📝</span>}
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
      <div style={{ height: 32, background: T.white, borderTop: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', fontSize: 12, color: '#6B7280', flexShrink: 0, zIndex: 50 }}>
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

      {/* ══════ BOOKING DETAIL PANEL ══════ */}
      {selectedBooking && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 320, background: T.white, boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', zIndex: 60, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', fontFamily: "'Figtree', sans-serif" }}>
          <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>{selectedBooking.customerName}</h3>
                <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{fmt12(selectedBooking.time)} · {selectedBooking.tableName}</p>
              </div>
              <button onClick={() => setSelectedBooking(null)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#F5F5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#999' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, background: statusColor(selectedBooking.status, selectedBooking.isVip) + '15', color: statusColor(selectedBooking.status, selectedBooking.isVip) }}>{selectedBooking.status}</span>
              {selectedBooking.isVip && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, background: '#EFF6FF', color: '#2563EB' }}>VIP</span>}
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <DetailCard label="Party" value={`${selectedBooking.partySize} Guests`} />
              <DetailCard label="Table" value={selectedBooking.tableName} />
              <DetailCard label="Time" value={fmt12(selectedBooking.time)} />
              <DetailCard label="Duration" value={`${selectedBooking.duration || 75}m`} />
            </div>

            {selectedBooking.occasion && (
              <div style={{ padding: '10px 12px', background: '#FFFBEB', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cake size={14} /> {selectedBooking.occasion.replace('_', ' ')}
              </div>
            )}

            {selectedBooking.notes && (
              <div style={{ padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#4B5563' }}>
                <span style={{ fontWeight: 600 }}>Notes:</span> {selectedBooking.notes}
              </div>
            )}
          </div>

          <div style={{ padding: '16px 20px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 700, color: '#374151', background: '#F3F4F6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Edit</button>
            <button style={{ flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 700, color: '#fff', background: T.forest, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Check In</button>
          </div>
        </div>
      )}

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
const toggleInactive = { padding: '7px 16px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: 'transparent', color: '#999', transition: 'all 0.15s', fontFamily: "'Figtree', sans-serif" }
const iconBtn = { width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#F5F5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }

function StatChip({ color, value, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>
        <strong style={{ color: '#1B4332', fontWeight: 800 }}>{value}</strong> {label}
      </span>
    </div>
  )
}

function DetailCard({ label, value }) {
  return (
    <div style={{ background: '#F9FAFB', padding: '8px 12px', borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
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
                    <span style={{ fontSize: 10, fontWeight: 600, color: sColors[status], textTransform: 'uppercase' }}>{status}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{t.capacity} seats · {zone}</span>
                  {booking && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{booking.partySize} · {booking.customerName?.split(' ').pop()}</div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{fmt12(booking.time)}{booking.occasion ? ` · ${booking.occasion}` : ''}</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1.5fr 80px 100px 80px 100px 1fr', padding: '10px 20px', background: '#FAFAFA', borderBottom: '1px solid #E5E7EB', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 5 }}>
        <span>Time</span><span>Guest</span><span>Party</span><span>Table</span><span>Status</span><span>Occasion</span><span>Notes</span>
      </div>
      {sorted.map(b => (
        <div key={b.id} onClick={() => onSelectBooking(b)}
          style={{ display: 'grid', gridTemplateColumns: '60px 1.5fr 80px 100px 80px 100px 1fr', padding: '12px 20px', borderBottom: '1px solid #F9FAFB', cursor: 'pointer', alignItems: 'center', transition: 'background 0.1s' }}
          onMouseOver={e => e.currentTarget.style.background = '#FAFAFA'}
          onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{fmt12(b.time)}</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{b.customerName}</span>
            {b.isVip && <Crown size={10} style={{ marginLeft: 4, color: '#3B82F6', display: 'inline', verticalAlign: 'middle' }} />}
          </div>
          <span style={{ fontSize: 13, color: '#374151' }}>{b.partySize}</span>
          <span style={{ fontSize: 13, color: '#374151' }}>{b.tableName}</span>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: statusColor(b.status, b.isVip), background: statusColor(b.status, b.isVip) + '15', padding: '2px 8px', borderRadius: 999, display: 'inline-block' }}>{b.status}</span>
          <span style={{ fontSize: 12, color: '#6B7280' }}>{b.occasion ? b.occasion.replace('_', ' ') : '—'}</span>
          <span style={{ fontSize: 12, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.notes || '—'}</span>
        </div>
      ))}
    </div>
  )
}
