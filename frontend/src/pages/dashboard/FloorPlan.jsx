import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Floor Plan — Live table map with status colours and booking sidebar
 * Uses restaurant calendar endpoint for real data
 */

import { useState, useEffect } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const STATUS = {
  available: { bg: '#ECFDF5', border: '#059669', text: '#065F46', label: 'Available' },
  confirmed: { bg: '#EFF6FF', border: '#1B4332', text: '#1B4332', label: 'Confirmed' },
  seated: { bg: '#D1FAE5', border: '#52B788', text: '#065F46', label: 'Seated' },
  mains: { bg: '#FFF7ED', border: '#D4A373', text: '#92400E', label: 'Mains' },
  dessert: { bg: '#F5F3FF', border: '#8B5CF6', text: '#5B21B6', label: 'Dessert' },
  paying: { bg: '#F3F4F6', border: '#6B7280', text: '#374151', label: 'Paying' },
  dirty: { bg: '#F9FAFB', border: '#374151', text: '#1F2937', label: 'Dirty' },
  pending: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E', label: 'Pending' },
  walkin: { bg: '#FFFBEB', border: '#D97706', text: '#92400E', label: 'Walk-in' },
}

const DEFAULT_POSITIONS = [
  { x: 80, y: 60 }, { x: 200, y: 60 }, { x: 320, y: 60 },
  { x: 80, y: 200 }, { x: 200, y: 200 }, { x: 320, y: 200 },
  { x: 80, y: 340 }, { x: 200, y: 340 }, { x: 320, y: 340 },
  { x: 460, y: 60 }, { x: 460, y: 200 }, { x: 460, y: 340 },
  { x: 140, y: 460 }, { x: 280, y: 460 }, { x: 420, y: 460 },
]

const FloorPlan = () => {
  const { business, businessType } = useBusiness()
  const bid = business?.id ?? business?._id
  const isFood = businessType === 'food' || businessType === 'restaurant'
  const [tables, setTables] = useState([])
  const [bookings, setBookings] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!bid) { setLoading(false); return }
    setLoading(true)
    api.get(`/calendar/business/${bid}/restaurant?date=${today}&view=day`)
      .then(d => {
        setTables(d.tables || [])
        setBookings(d.bookings || [])
      })
      .catch(() => {
        setTables(Array.from({ length: 12 }, (_, i) => ({
          id: `t${i + 1}`, name: `Table ${i + 1}`, seats: [2, 4, 4, 6, 2, 4, 8, 4, 2, 6, 4, 6][i],
          section: i < 3 ? 'Bar' : i < 9 ? 'Main' : 'Patio',
        })))
      })
      .finally(() => setLoading(false))
  }, [bid, today])

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const getTableStatus = (tableId) => {
    const active = bookings.find(b => {
      if (b.tableId !== tableId) return false
      const [h, m] = (b.time || '0:0').split(':').map(Number)
      const start = h * 60 + (m || 0)
      const end = start + (b.duration || 90)
      return start <= nowMin && end > nowMin
    })
    if (active) return { ...active, status: active.status || 'seated' }
    const next = bookings
      .filter(b => {
        if (b.tableId !== tableId) return false
        const [h, m] = (b.time || '0:0').split(':').map(Number)
        return h * 60 + (m || 0) > nowMin
      })
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))[0]
    if (next) return { ...next, _next: true, status: 'confirmed' }
    return null
  }

  const tableBookings = (tid) => bookings.filter(b => b.tableId === tid)

  if (loading) {
    return <RezvoLoader message="Loading floor plan..." />
  }

  if (!isFood) {
    return (
      <div className="bg-white rounded-xl border border-border p-12 text-center">
        <h2 className="font-heading font-bold text-xl text-primary mb-2">Floor Plan</h2>
        <p className="text-gray-500">Floor plans are available for restaurant businesses.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex gap-0 overflow-hidden -m-6 lg:-m-8" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Canvas */}
      <div className="flex-1 overflow-auto relative" style={{ background: '#FAFAF8' }}>
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-5 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Floor Plan</h1>
            <p className="text-xs text-gray-500">{tables.length} tables · {bookings.length} bookings today</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {['available', 'seated', 'mains', 'paying'].map(k => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS[k].border }} />
                <span className="text-[10px] font-medium text-gray-500">{STATUS[k].label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6" style={{ minHeight: 560, backgroundImage: 'radial-gradient(#D1D5DB 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          <div className="relative" style={{ minHeight: 520, minWidth: 520 }}>
            {tables.map((table, i) => {
              const pos = DEFAULT_POSITIONS[i] || { x: 80 + (i % 4) * 120, y: 60 + Math.floor(i / 4) * 120 }
              const current = getTableStatus(table.id)
              const statusKey = current ? current.status : 'available'
              const st = STATUS[statusKey] || STATUS.available
              const isSelected = selectedTable === table.id
              const seats = table.seats || 4
              const size = seats <= 2 ? 70 : seats <= 4 ? 85 : seats <= 6 ? 100 : 110
              const isRound = seats <= 4

              return (
                <div key={table.id} onClick={() => setSelectedTable(table.id === selectedTable ? null : table.id)}
                  style={{
                    position: 'absolute', left: pos.x, top: pos.y, width: size,
                    height: isRound ? size : size * 0.75,
                    borderRadius: isRound ? '50%' : 12,
                    background: st.bg, border: `2.5px solid ${st.border}`,
                    boxShadow: isSelected ? `0 0 0 3px ${st.border}40, 0 8px 20px rgba(0,0,0,.12)` : '0 2px 8px rgba(0,0,0,.06)',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', transform: isSelected ? 'scale(1.08)' : 'scale(1)', zIndex: isSelected ? 10 : 1,
                  }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: st.text }}>{table.name?.replace('Table ', 'T')}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: st.text, opacity: 0.7 }}>{seats} seats</span>
                  {current && !current._next && (
                    <span style={{ fontSize: 8, fontWeight: 700, color: st.text, marginTop: 2 }}>{current.customerName?.split(' ')[0]}</span>
                  )}
                  {current?._next && (
                    <span style={{ fontSize: 8, color: '#6B7280', marginTop: 2 }}>Next: {current.time}</span>
                  )}
                  {Array.from({ length: Math.min(seats, 8) }).map((_, ci) => {
                    const angle = (ci / Math.min(seats, 8)) * Math.PI * 2 - Math.PI / 2
                    const r = (isRound ? size : Math.max(size, size * 0.75)) / 2 + 8
                    return (
                      <div key={ci} style={{
                        position: 'absolute', width: 8, height: 8, borderRadius: '50%',
                        background: statusKey === 'available' ? '#D1D5DB' : st.border,
                        left: size / 2 + Math.cos(angle) * r - 4,
                        top: (isRound ? size : size * 0.75) / 2 + Math.sin(angle) * r - 4, opacity: 0.6,
                      }} />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden shrink-0 hidden lg:flex">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-sm text-gray-900">
            {selectedTable ? tables.find(t => t.id === selectedTable)?.name || 'Table' : 'All Bookings'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {selectedTable ? `${tableBookings(selectedTable).length} bookings` : `${bookings.length} total`}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {(selectedTable ? tableBookings(selectedTable) : bookings)
            .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
            .map((b, i) => {
              const st = STATUS[b.status] || STATUS.confirmed
              return (
                <div key={b.id || i} className="p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors" style={{ borderLeft: `3px solid ${st.border}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-gray-900">{b.customerName}</span>
                    <span className="text-xs font-bold" style={{ color: st.text }}>{b.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{b.partySize || 2} guests</span>
                    <span>·</span>
                    <span>{b.tableName}</span>
                    <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                  </div>
                  {b.notes && <p className="text-[11px] text-gray-400 mt-1 truncate">{b.notes}</p>}
                </div>
              )
            })}
          {(selectedTable ? tableBookings(selectedTable) : bookings).length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">No bookings{selectedTable ? ' for this table' : ''}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FloorPlan
