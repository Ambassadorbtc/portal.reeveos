/**
 * Restaurant Calendar — Timeline Planner, Table Status, Reservation List
 * Designed for restaurant booking management with table-based views
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Clock, Users, Search, Filter, Plus, LayoutGrid, List, CalendarDays, MapPin, AlertCircle, Phone, Mail } from 'lucide-react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

/* ── Constants ── */
const STATUS_COLORS = {
  confirmed: { bg: '#DCFCE7', border: '#16A34A', text: '#166534', label: 'Confirmed' },
  pending:   { bg: '#FEF3C7', border: '#D97706', text: '#92400E', label: 'Pending' },
  seated:    { bg: '#DBEAFE', border: '#2563EB', text: '#1E40AF', label: 'Seated' },
  completed: { bg: '#F3F4F6', border: '#9CA3AF', text: '#4B5563', label: 'Completed' },
  cancelled: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B', label: 'Cancelled' },
  noshow:    { bg: '#FEE2E2', border: '#DC2626', text: '#991B1B', label: 'No Show' },
  walkin:    { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3', label: 'Walk-in' },
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 8am to 10pm
const SLOT_HEIGHT = 60 // px per hour

const formatTime12 = (t) => {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')}${suffix}`
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function RestaurantCalendar() {
  const { business } = useBusiness()
  const bid = business?.id ?? business?._id
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [view, setView] = useState('timeline') // 'timeline' | 'tables' | 'list'
  const [data, setData] = useState({ bookings: [], tables: [], covers: {}, servicePeriods: [] })
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const timelineRef = useRef(null)

  const dateObj = new Date(selectedDate + 'T00:00:00')
  const isToday = selectedDate === new Date().toISOString().slice(0, 10)
  const dateLabel = `${DAY_NAMES[dateObj.getDay()]} ${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()]}`

  /* ── Fetch data ── */
  useEffect(() => {
    if (!bid) return
    setLoading(true)
    api.get(`/calendar/business/${bid}/restaurant?date=${selectedDate}&view=day`)
      .then(d => setData(d))
      .catch(err => console.error('Restaurant calendar error:', err))
      .finally(() => setLoading(false))
  }, [bid, selectedDate])

  /* ── Auto-scroll to current time ── */
  useEffect(() => {
    if (view === 'timeline' && timelineRef.current && isToday) {
      const now = new Date()
      const scrollTo = (now.getHours() - 8) * SLOT_HEIGHT - 100
      if (scrollTo > 0) timelineRef.current.scrollTop = scrollTo
    }
  }, [view, loading, isToday])

  /* ── Navigation ── */
  const goPrev = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().slice(0, 10)) }
  const goNext = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().slice(0, 10)) }
  const goToday = () => setSelectedDate(new Date().toISOString().slice(0, 10))

  /* ── Derived data ── */
  const filteredBookings = useMemo(() => {
    let b = data.bookings || []
    if (statusFilter !== 'all') b = b.filter(x => x.status === statusFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      b = b.filter(x => x.customerName?.toLowerCase().includes(q) || x.tableName?.toLowerCase().includes(q))
    }
    return b
  }, [data.bookings, statusFilter, searchQuery])

  const tableBookings = useMemo(() => {
    const map = {}
    ;(data.tables || []).forEach(t => { map[t.id] = [] })
    filteredBookings.forEach(b => {
      if (map[b.tableId]) map[b.tableId].push(b)
    })
    return map
  }, [data.tables, filteredBookings])

  /* ── Current time indicator ── */
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const timeIndicatorTop = ((now.getHours() - 8) + now.getMinutes() / 60) * SLOT_HEIGHT

  const getStatus = (s) => STATUS_COLORS[s] || STATUS_COLORS.confirmed

  /* ── Table status calculation ── */
  const getTableStatus = (tableId) => {
    const bookings = tableBookings[tableId] || []
    const activeBooking = bookings.find(b => {
      const [h, m] = b.time.split(':').map(Number)
      const start = h * 60 + m
      const end = start + (b.duration || 75)
      return nowMinutes >= start && nowMinutes <= end && (b.status === 'seated' || b.status === 'confirmed')
    })
    if (activeBooking) return { status: activeBooking.status, booking: activeBooking }
    const nextBooking = bookings
      .filter(b => { const [h, m] = b.time.split(':').map(Number); return h * 60 + m > nowMinutes })
      .sort((a, b) => a.time.localeCompare(b.time))[0]
    if (nextBooking) return { status: 'upcoming', booking: nextBooking }
    return { status: 'available', booking: null }
  }

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: '"Figtree", system-ui, sans-serif' }}>
      {/* ── Top Bar ── */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Date nav */}
          <div className="flex items-center gap-2">
            <button onClick={goPrev} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-[#1B4332] min-w-[100px] text-center">{dateLabel}</span>
            <button onClick={goNext} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={goToday} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isToday ? 'bg-[#1B4332] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>Today</button>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {[
              { id: 'timeline', icon: CalendarDays, label: 'Timeline' },
              { id: 'tables', icon: LayoutGrid, label: 'Tables' },
              { id: 'list', icon: List, label: 'List' },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                view === v.id ? 'bg-white text-[#1B4332] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
                <v.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Users className="w-3.5 h-3.5" />
              <span><strong className="text-[#1B4332]">{data.covers?.total || 0}</strong> covers</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{filteredBookings.filter(b => b.status === 'confirmed').length} confirmed</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>{filteredBookings.filter(b => b.status === 'seated').length} seated</span>
            </div>
          </div>
        </div>

        {/* Search + Filter row */}
        {view === 'list' && (
          <div className="flex items-center gap-3 mt-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search guests or tables..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
            >
              <option value="all">All statuses</option>
              {Object.entries(STATUS_COLORS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-3 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : view === 'timeline' ? (
          <TimelineView
            timelineRef={timelineRef}
            tables={data.tables || []}
            bookings={filteredBookings}
            tableBookings={tableBookings}
            isToday={isToday}
            timeIndicatorTop={timeIndicatorTop}
            onSelectBooking={setSelectedBooking}
            selectedBooking={selectedBooking}
          />
        ) : view === 'tables' ? (
          <TablesView
            tables={data.tables || []}
            tableBookings={tableBookings}
            getTableStatus={getTableStatus}
            onSelectBooking={setSelectedBooking}
            covers={data.covers || {}}
          />
        ) : (
          <ListView
            bookings={filteredBookings}
            onSelectBooking={setSelectedBooking}
          />
        )}
      </div>

      {/* ── Booking Detail Panel ── */}
      {selectedBooking && (
        <>
          <div onClick={() => setSelectedBooking(null)} className="fixed inset-0 bg-black/20 z-40" />
          <div className="fixed top-0 right-0 bottom-0 w-[380px] max-w-[90vw] bg-white shadow-[-8px_0_40px_rgba(0,0,0,.12)] z-50 flex flex-col" style={{ animation: 'slideInRight .25s ease forwards' }}>
            <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] px-5 py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white font-bold text-sm">
                    {selectedBooking.customerName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{selectedBooking.customerName}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase`}
                        style={{ background: getStatus(selectedBooking.status).bg, color: getStatus(selectedBooking.status).text }}>
                        {getStatus(selectedBooking.status).label}
                      </span>
                      {selectedBooking.isVip && <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 text-[10px] font-bold">VIP</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedBooking(null)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20">
                  <span className="text-lg">×</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Booking details */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Clock, label: 'Time', value: formatTime12(selectedBooking.time) },
                  { icon: Users, label: 'Party', value: `${selectedBooking.partySize} guests` },
                  { icon: MapPin, label: 'Table', value: selectedBooking.tableName },
                  { icon: Clock, label: 'Duration', value: `${selectedBooking.duration || 75} min` },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-gray-400 text-[11px] font-medium mb-1">
                      <item.icon className="w-3 h-3" />
                      {item.label}
                    </div>
                    <div className="text-sm font-semibold text-[#1B4332]">{item.value}</div>
                  </div>
                ))}
              </div>

              {selectedBooking.occasion && (
                <div className="bg-amber-50 rounded-xl px-4 py-2.5 text-sm">
                  <span className="text-amber-600">🎉 {selectedBooking.occasion}</span>
                </div>
              )}

              {selectedBooking.notes && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</h4>
                  <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 italic">"{selectedBooking.notes}"</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 p-4 border-t border-gray-100 flex gap-2">
              <button className="flex-1 py-2.5 rounded-xl bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#1B4332]/90 transition-colors flex items-center justify-center gap-1.5">
                ✓ Check In
              </button>
              <button className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors">
                Edit
              </button>
              <button className="py-2.5 px-3 rounded-xl border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors">
                No Show
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   TIMELINE VIEW — Tables as columns, time as rows
   ══════════════════════════════════════════════════ */

const TimelineView = ({ timelineRef, tables, bookings, tableBookings, isToday, timeIndicatorTop, onSelectBooking, selectedBooking }) => {
  const colWidth = Math.max(120, tables.length <= 6 ? 160 : tables.length <= 10 ? 130 : 110)

  return (
    <div ref={timelineRef} className="h-full overflow-auto">
      <div className="relative" style={{ minWidth: tables.length * colWidth + 70 }}>
        {/* Table headers */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 flex">
          <div className="w-[70px] flex-shrink-0 bg-white border-r border-gray-100" />
          {tables.map(table => (
            <div key={table.id} className="flex-shrink-0 border-r border-gray-100 px-2 py-2.5 text-center" style={{ width: colWidth }}>
              <div className="text-xs font-semibold text-[#1B4332]">{table.name}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{table.capacity} seats · {table.zone || 'Main'}</div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="relative">
          {HOURS.map(hour => (
            <div key={hour} className="flex border-b border-gray-50" style={{ height: SLOT_HEIGHT }}>
              {/* Time label */}
              <div className="w-[70px] flex-shrink-0 border-r border-gray-100 pr-2 pt-1 text-right">
                <span className="text-[11px] text-gray-400 font-medium">
                  {hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
                </span>
              </div>

              {/* Table columns */}
              {tables.map(table => (
                <div key={table.id} className="flex-shrink-0 border-r border-gray-50 relative" style={{ width: colWidth }} />
              ))}
            </div>
          ))}

          {/* Booking blocks */}
          {tables.map((table, tIdx) => {
            const tBookings = tableBookings[table.id] || []
            return tBookings.map(booking => {
              const [h, m] = booking.time.split(':').map(Number)
              const top = (h - 8 + m / 60) * SLOT_HEIGHT
              const height = Math.max(((booking.duration || 75) / 60) * SLOT_HEIGHT, 30)
              const left = 70 + tIdx * colWidth + 4
              const width = colWidth - 8
              const status = getBookingStatus(booking.status)
              const isSelected = selectedBooking?.id === booking.id

              return (
                <div
                  key={booking.id}
                  onClick={() => onSelectBooking(booking)}
                  className="absolute cursor-pointer rounded-lg transition-all hover:shadow-md"
                  style={{
                    top, left, width, height,
                    background: status.bg,
                    borderLeft: `3px solid ${status.border}`,
                    boxShadow: isSelected ? `0 0 0 2px ${status.border}` : '0 1px 3px rgba(0,0,0,.06)',
                    padding: '4px 8px',
                    overflow: 'hidden',
                    zIndex: isSelected ? 10 : 1,
                  }}
                >
                  <div className="text-[11px] font-semibold truncate" style={{ color: status.text }}>{booking.customerName}</div>
                  {height > 35 && (
                    <div className="text-[10px] mt-0.5 truncate" style={{ color: status.text, opacity: 0.7 }}>
                      {formatTime12(booking.time)} · {booking.partySize}p
                    </div>
                  )}
                  {height > 55 && booking.occasion && (
                    <div className="text-[9px] mt-0.5 truncate" style={{ color: status.text, opacity: 0.5 }}>
                      🎉 {booking.occasion}
                    </div>
                  )}
                </div>
              )
            })
          })}

          {/* Current time indicator */}
          {isToday && timeIndicatorTop > 0 && timeIndicatorTop < HOURS.length * SLOT_HEIGHT && (
            <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: timeIndicatorTop }}>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 h-[1.5px] bg-red-500" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getBookingStatus(s) {
  return STATUS_COLORS[s] || STATUS_COLORS.confirmed
}

/* ══════════════════════════════════════════════════
   TABLES VIEW — Grid of table cards with status
   ══════════════════════════════════════════════════ */

function TablesView({ tables, tableBookings, getTableStatus, onSelectBooking, covers }) {
  // Group by zone
  const zones = useMemo(() => {
    const z = {}
    tables.forEach(t => {
      const zone = t.zone || 'Main'
      if (!z[zone]) z[zone] = []
      z[zone].push(t)
    })
    return z
  }, [tables])

  const statusStyles = {
    available: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Available', text: 'text-emerald-700' },
    confirmed: { bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500', label: 'Reserved', text: 'text-blue-700' },
    seated:    { bg: 'bg-indigo-50', border: 'border-indigo-200', dot: 'bg-indigo-500', label: 'Seated', text: 'text-indigo-700' },
    upcoming:  { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Next booking', text: 'text-amber-700' },
    pending:   { bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500', label: 'Pending', text: 'text-yellow-700' },
  }

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      {/* Capacity bar */}
      <div className="flex items-center gap-4 mb-6 bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">Today's Capacity</span>
            <span className="text-sm font-bold text-[#1B4332]">{covers.total || 0} / {covers.capacity || 0} covers</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#1B4332] to-[#52B788] rounded-full transition-all" style={{ width: `${Math.min(100, ((covers.total || 0) / (covers.capacity || 1)) * 100)}%` }} />
          </div>
        </div>
        <div className="text-center px-4 border-l border-gray-200">
          <div className="text-lg font-bold text-[#1B4332]">{covers.lunch || 0}</div>
          <div className="text-[10px] text-gray-400 font-medium">Lunch</div>
        </div>
        <div className="text-center px-4 border-l border-gray-200">
          <div className="text-lg font-bold text-[#1B4332]">{covers.dinner || 0}</div>
          <div className="text-[10px] text-gray-400 font-medium">Dinner</div>
        </div>
      </div>

      {/* Tables by zone */}
      {Object.entries(zones).map(([zone, zoneTables]) => (
        <div key={zone} className="mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{zone}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {zoneTables.map(table => {
              const { status, booking } = getTableStatus(table.id)
              const allBookings = tableBookings[table.id] || []
              const s = statusStyles[status] || statusStyles.available

              return (
                <div
                  key={table.id}
                  onClick={() => booking && onSelectBooking(booking)}
                  className={`${s.bg} border ${s.border} rounded-xl p-4 cursor-pointer hover:shadow-md transition-all`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-[#1B4332]">{table.name}</span>
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  </div>
                  <div className="text-[10px] text-gray-400 mb-2">{table.capacity} seats</div>

                  {booking ? (
                    <>
                      <div className="text-xs font-semibold text-[#1B4332] truncate">{booking.customerName}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {formatTime12(booking.time)} · {booking.partySize}p
                      </div>
                    </>
                  ) : (
                    <div className={`text-xs font-medium ${s.text}`}>{s.label}</div>
                  )}

                  {allBookings.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-gray-200/50 text-[10px] text-gray-400">
                      {allBookings.length} bookings today
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

/* ══════════════════════════════════════════════════
   LIST VIEW — Sortable table of reservations
   ══════════════════════════════════════════════════ */

function ListView({ bookings, onSelectBooking }) {
  const sorted = useMemo(() => [...bookings].sort((a, b) => a.time.localeCompare(b.time)), [bookings])

  if (sorted.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p className="text-sm">No reservations found</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Time</th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Guest</th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Party</th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Table</th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Occasion</th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Duration</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((booking, i) => {
            const status = getBookingStatus(booking.status)
            return (
              <tr
                key={booking.id}
                onClick={() => onSelectBooking(booking)}
                className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold text-[#1B4332]">{formatTime12(booking.time)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold" style={{ background: status.border }}>
                      {booking.customerName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{booking.customerName}</div>
                      {booking.isVip && <span className="text-[10px] text-amber-600 font-semibold">⭐ VIP</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">{booking.partySize}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">{booking.tableName}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: status.bg, color: status.text }}>
                    {status.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-400">{booking.occasion || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-400">{booking.duration || 75}m</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
