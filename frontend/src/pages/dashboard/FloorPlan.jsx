import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Floor Plan — Drag-drop table editor + live status view
 * Table shapes: round, square, long, hexagon
 * Zones: Main, Bar, Patio, Window, Terrace, Upstairs, Kiosk, Toilets, Outside
 * Lock/unlock toggle, zone labels, booking sidebar
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Lock, Unlock, Plus, Trash2, RotateCcw, ChevronDown, X, Settings, Maximize2, Minimize2, Move } from 'lucide-react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const STATUS = {
  available: { bg: '#ECFDF5', border: '#059669', text: '#065F46', label: 'Available' },
  confirmed: { bg: '#EFF6FF', border: '#1B4332', text: '#1B4332', label: 'Confirmed' },
  seated: { bg: '#D1FAE5', border: '#52B788', text: '#065F46', label: 'Seated' },
  mains: { bg: '#FFF7ED', border: '#D4A373', text: '#92400E', label: 'Mains' },
  dessert: { bg: '#F5F3FF', border: '#8B5CF6', text: '#5B21B6', label: 'Dessert' },
  paying: { bg: '#F3F4F6', border: '#6B7280', text: '#374151', label: 'Paying' },
  dirty: { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B', label: 'Dirty' },
  pending: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E', label: 'Pending' },
}

const ZONES = [
  { id: 'main', label: 'Main Floor', color: '#1B4332' },
  { id: 'window', label: 'Window', color: '#2563EB' },
  { id: 'bar', label: 'Bar', color: '#D97706' },
  { id: 'patio', label: 'Patio', color: '#059669' },
  { id: 'terrace', label: 'Terrace', color: '#7C3AED' },
  { id: 'upstairs', label: 'Upstairs', color: '#DC2626' },
  { id: 'outside', label: 'Outside', color: '#0891B2' },
  { id: 'kiosk', label: 'Kiosk', color: '#EA580C' },
  { id: 'toilets', label: 'Toilets', color: '#6B7280', nonTable: true },
]

const TABLE_SHAPES = [
  { id: 'round', label: 'Round', icon: '○' },
  { id: 'square', label: 'Square', icon: '□' },
  { id: 'long', label: 'Long', icon: '▬' },
  { id: 'hexagon', label: 'Hexagon', icon: '⬡' },
]

const SEAT_OPTIONS = [2, 4, 6, 8, 10, 12]

const DEFAULT_TABLES = [
  { id: 't1', name: 'T1', seats: 2, zone: 'window', shape: 'round', x: 80, y: 60 },
  { id: 't2', name: 'T2', seats: 2, zone: 'window', shape: 'round', x: 240, y: 60 },
  { id: 't3', name: 'T3', seats: 4, zone: 'main', shape: 'round', x: 420, y: 60 },
  { id: 't4', name: 'T4', seats: 4, zone: 'main', shape: 'round', x: 600, y: 60 },
  { id: 't5', name: 'T5', seats: 6, zone: 'main', shape: 'long', x: 80, y: 220 },
  { id: 't6', name: 'T6', seats: 8, zone: 'main', shape: 'long', x: 320, y: 220 },
  { id: 't7', name: 'T7', seats: 4, zone: 'main', shape: 'square', x: 560, y: 220 },
  { id: 't8', name: 'T8', seats: 2, zone: 'bar', shape: 'round', x: 80, y: 380 },
  { id: 't9', name: 'T9', seats: 2, zone: 'bar', shape: 'round', x: 240, y: 380 },
  { id: 't10', name: 'T10', seats: 4, zone: 'patio', shape: 'square', x: 420, y: 380 },
  { id: 't11', name: 'T11', seats: 6, zone: 'patio', shape: 'long', x: 600, y: 380 },
  { id: 't12', name: 'T12', seats: 4, zone: 'patio', shape: 'round', x: 420, y: 520 },
]

const FloorPlan = ({ embedded = false }) => {
  const { business, businessType } = useBusiness()
  const bid = business?.id ?? business?._id
  const isFood = businessType === 'food' || businessType === 'restaurant'
  const [tables, setTables] = useState([])
  const [bookings, setBookings] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)
  const [locked, setLocked] = useState(true)
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(null)
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 })
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [addShape, setAddShape] = useState('round')
  const [addSeats, setAddSeats] = useState(4)
  const [addZone, setAddZone] = useState('main')
  const [editTable, setEditTable] = useState(null)
  const canvasRef = useRef(null)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!bid) { setTables(DEFAULT_TABLES); setLoading(false); return }
    api.get(`/calendar/business/${bid}/restaurant?date=${today}&view=day`)
      .then(d => {
        const apiTables = (d.tables || []).map((t, i) => ({
          ...t, id: t.id || `t${i+1}`, name: t.name || `T${i+1}`,
          shape: t.shape || 'round', zone: t.zone || t.section?.toLowerCase() || 'main',
          x: t.x ?? DEFAULT_TABLES[i]?.x ?? 80 + (i % 4) * 180,
          y: t.y ?? DEFAULT_TABLES[i]?.y ?? 60 + Math.floor(i / 4) * 160,
        }))
        setTables(apiTables.length > 0 ? apiTables : DEFAULT_TABLES)
        setBookings(d.bookings || [])
      })
      .catch(() => { setTables(DEFAULT_TABLES) })
      .finally(() => setLoading(false))
  }, [bid, today])

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const getTableStatus = (tableId) => {
    const active = bookings.find(b => {
      if (b.tableId !== tableId) return false
      const [h, m] = (b.time || '0:0').split(':').map(Number)
      const start = h * 60 + (m || 0), end = start + (b.duration || 90)
      return start <= nowMin && end > nowMin
    })
    if (active) return { ...active, status: active.status || 'seated' }
    const next = bookings
      .filter(b => { if (b.tableId !== tableId) return false; const [h, m] = (b.time || '0:0').split(':').map(Number); return h * 60 + (m || 0) > nowMin })
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))[0]
    if (next) return { ...next, _next: true, status: 'confirmed' }
    return null
  }

  const tableBookings = (tid) => bookings.filter(b => b.tableId === tid)

  /* ── Drag Handlers ── */
  const handleMouseDown = useCallback((e, tId) => {
    if (locked) return
    e.preventDefault(); e.stopPropagation()
    const t = tables.find(t => t.id === tId)
    if (!t) return
    const rect = canvasRef.current?.getBoundingClientRect()
    setDragging(tId)
    setDragOff({ x: e.clientX - (rect?.left || 0) - t.x, y: e.clientY - (rect?.top || 0) - t.y })
  }, [locked, tables])

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return
    const rect = canvasRef.current?.getBoundingClientRect()
    const nx = Math.max(0, Math.min(800, e.clientX - (rect?.left || 0) - dragOff.x))
    const ny = Math.max(0, Math.min(650, e.clientY - (rect?.top || 0) - dragOff.y))
    setTables(prev => prev.map(t => t.id === dragging ? { ...t, x: nx, y: ny } : t))
  }, [dragging, dragOff])

  const handleMouseUp = useCallback(() => { setDragging(null) }, [])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  /* Touch drag */
  const handleTouchStart = useCallback((e, tId) => {
    if (locked) return
    const t = tables.find(t => t.id === tId); if (!t) return
    const touch = e.touches[0]; const rect = canvasRef.current?.getBoundingClientRect()
    setDragging(tId)
    setDragOff({ x: touch.clientX - (rect?.left || 0) - t.x, y: touch.clientY - (rect?.top || 0) - t.y })
  }, [locked, tables])

  const handleTouchMove = useCallback((e) => {
    if (!dragging) return; e.preventDefault()
    const touch = e.touches[0]; const rect = canvasRef.current?.getBoundingClientRect()
    const nx = Math.max(0, Math.min(800, touch.clientX - (rect?.left || 0) - dragOff.x))
    const ny = Math.max(0, Math.min(650, touch.clientY - (rect?.top || 0) - dragOff.y))
    setTables(prev => prev.map(t => t.id === dragging ? { ...t, x: nx, y: ny } : t))
  }, [dragging, dragOff])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleMouseUp)
      return () => { window.removeEventListener('touchmove', handleTouchMove); window.removeEventListener('touchend', handleMouseUp) }
    }
  }, [dragging, handleTouchMove, handleMouseUp])

  /* ── Add/Delete Tables ── */
  const addTable = () => {
    const num = tables.length + 1
    const newT = { id: `t${Date.now()}`, name: `T${num}`, seats: addSeats, zone: addZone, shape: addShape, x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 }
    setTables(prev => [...prev, newT])
    setShowAddPanel(false)
  }

  const deleteTable = (tId) => {
    setTables(prev => prev.filter(t => t.id !== tId))
    if (selectedTable === tId) setSelectedTable(null)
    if (editTable?.id === tId) setEditTable(null)
  }

  const updateTable = (tId, updates) => {
    setTables(prev => prev.map(t => t.id === tId ? { ...t, ...updates } : t))
    if (editTable?.id === tId) setEditTable(prev => ({ ...prev, ...updates }))
  }

  /* ── Render Table Shape ── */
  const getShapeStyle = (table, st, isSelected) => {
    const seats = table.seats || 4
    const baseSize = seats <= 2 ? 80 : seats <= 4 ? 95 : seats <= 6 ? 110 : seats <= 8 ? 125 : 140
    const base = {
      position: 'absolute', left: table.x, top: table.y,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: st.bg, border: `2.5px solid ${st.border}`,
      boxShadow: isSelected ? `0 0 0 3px ${st.border}40, 0 8px 25px rgba(0,0,0,.15)` : '0 2px 10px rgba(0,0,0,.06)',
      cursor: locked ? 'pointer' : 'grab', transition: dragging === table.id ? 'none' : 'box-shadow 0.2s, transform 0.2s',
      transform: isSelected ? 'scale(1.06)' : 'scale(1)', zIndex: isSelected || dragging === table.id ? 20 : 1,
      userSelect: 'none',
    }
    switch (table.shape) {
      case 'square': return { ...base, width: baseSize, height: baseSize, borderRadius: 12 }
      case 'long': return { ...base, width: baseSize * 1.6, height: baseSize * 0.7, borderRadius: 12 }
      case 'hexagon': return { ...base, width: baseSize, height: baseSize, borderRadius: baseSize * 0.15, clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }
      default: return { ...base, width: baseSize, height: baseSize, borderRadius: '50%' }
    }
  }

  /* ── Seat dots ── */
  const renderSeats = (table, st) => {
    const seats = Math.min(table.seats || 4, 12)
    const baseSize = table.seats <= 2 ? 80 : table.seats <= 4 ? 95 : table.seats <= 6 ? 110 : table.seats <= 8 ? 125 : 140
    const w = table.shape === 'long' ? baseSize * 1.6 : baseSize
    const h = table.shape === 'long' ? baseSize * 0.7 : baseSize
    return Array.from({ length: seats }).map((_, ci) => {
      const angle = (ci / seats) * Math.PI * 2 - Math.PI / 2
      const rx = w / 2 + 12, ry = h / 2 + 12
      return (
        <div key={ci} style={{
          position: 'absolute', width: 8, height: 8, borderRadius: '50%',
          background: st.label === 'Available' ? '#D1D5DB' : st.border,
          left: w / 2 + Math.cos(angle) * rx - 4,
          top: h / 2 + Math.sin(angle) * ry - 4,
          opacity: 0.6,
        }} />
      )
    })
  }

  if (loading) return <RezvoLoader message="Loading floor plan..." />
  if (!isFood) return <div className="bg-white rounded-xl border border-border p-12 text-center"><h2 className="font-heading font-bold text-xl text-primary mb-2">Floor Plan</h2><p className="text-gray-500">Floor plans are available for restaurant businesses.</p></div>

  const activeZones = [...new Set(tables.map(t => t.zone))].map(z => ZONES.find(zz => zz.id === z)).filter(Boolean)

  return (
    <div className={`flex gap-0 overflow-hidden ${embedded ? 'h-full' : '-m-6 lg:-m-8 h-[calc(100vh-4rem)]'}`} style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!embedded && (
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Floor Plan</h1>
              <p className="text-xs text-gray-500">{tables.length} tables · {bookings.length} bookings today</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Zone labels */}
              {activeZones.map(z => (
                <span key={z.id} className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: z.color + '15', color: z.color, border: `1px solid ${z.color}30` }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: z.color }} />{z.label}
                </span>
              ))}
              <span className="w-px h-5 bg-gray-200" />
              {/* Status legend */}
              {['available', 'seated', 'mains', 'paying'].map(k => (
                <div key={k} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: STATUS[k].border }} />
                  <span className="text-[10px] font-medium text-gray-500">{STATUS[k].label}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Lock/Unlock */}
              <button
                onClick={() => setLocked(!locked)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${locked ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-primary text-white shadow-md'}`}
              >
                {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                {locked ? 'Locked' : 'Editing'}
              </button>
              {/* Add Table */}
              {!locked && (
                <button onClick={() => setShowAddPanel(!showAddPanel)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold shadow-md hover:bg-[#2D6A4F]">
                  <Plus className="w-3.5 h-3.5" /> Add Table
                </button>
              )}
            </div>
          </div>
        )}

        {/* Add Table Panel */}
        {showAddPanel && !locked && (
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 flex-wrap shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600">Shape:</span>
              {TABLE_SHAPES.map(s => (
                <button key={s.id} onClick={() => setAddShape(s.id)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all ${addShape === s.id ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  title={s.label}>{s.icon}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600">Seats:</span>
              {SEAT_OPTIONS.map(n => (
                <button key={n} onClick={() => setAddSeats(n)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${addSeats === n ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{n}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600">Zone:</span>
              <select value={addZone} onChange={e => setAddZone(e.target.value)} className="text-xs font-bold border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20">
                {ZONES.filter(z => !z.nonTable).map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
              </select>
            </div>
            <button onClick={addTable} className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold shadow hover:bg-emerald-600">Place Table</button>
            <button onClick={() => setShowAddPanel(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto" style={{ background: '#FAFAF8' }}>
          <div ref={canvasRef} style={{
            position: 'relative', minWidth: 820, minHeight: 650,
            backgroundImage: 'radial-gradient(#D1D5DB 1px, transparent 1px)', backgroundSize: '20px 20px',
          }}
            onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          >
            {/* Zone background labels */}
            {activeZones.map((z, i) => {
              const zoneTables = tables.filter(t => t.zone === z.id)
              if (zoneTables.length === 0) return null
              const minX = Math.min(...zoneTables.map(t => t.x)) - 30
              const minY = Math.min(...zoneTables.map(t => t.y)) - 30
              return (
                <div key={z.id} style={{ position: 'absolute', left: minX, top: minY, fontSize: 10, fontWeight: 800, color: z.color, opacity: 0.3, textTransform: 'uppercase', letterSpacing: 2, pointerEvents: 'none' }}>
                  {z.label}
                </div>
              )
            })}

            {/* Tables */}
            {tables.map(table => {
              const current = getTableStatus(table.id)
              const statusKey = current ? current.status : 'available'
              const st = STATUS[statusKey] || STATUS.available
              const isSelected = selectedTable === table.id
              const zone = ZONES.find(z => z.id === table.zone)
              const shapeStyle = getShapeStyle(table, st, isSelected)

              return (
                <div key={table.id} style={shapeStyle}
                  onClick={() => locked && setSelectedTable(table.id === selectedTable ? null : table.id)}
                  onMouseDown={(e) => handleMouseDown(e, table.id)}
                  onTouchStart={(e) => handleTouchStart(e, table.id)}
                >
                  {/* Zone dot */}
                  {zone && !locked && (
                    <div style={{ position: 'absolute', top: -4, left: -4, width: 10, height: 10, borderRadius: '50%', background: zone.color, border: '2px solid white' }} />
                  )}
                  {/* Drag handle when unlocked */}
                  {!locked && (
                    <div style={{ position: 'absolute', top: 2, right: 2, opacity: 0.4 }}>
                      <Move size={10} />
                    </div>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 800, color: st.text }}>{table.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: st.text, opacity: 0.7 }}>{table.seats} seats</span>
                  {current && !current._next && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: st.text, marginTop: 1 }}>{current.customerName?.split(' ')[0]}</span>
                  )}
                  {current?._next && (
                    <span style={{ fontSize: 9, color: '#6B7280', marginTop: 1 }}>Next: {current.time}</span>
                  )}
                  {/* Edit/Delete when unlocked and selected */}
                  {!locked && isSelected && (
                    <div style={{ position: 'absolute', bottom: -28, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
                      <button onClick={(e) => { e.stopPropagation(); setEditTable(table) }} style={{ width: 22, height: 22, borderRadius: 6, background: '#fff', border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10 }} title="Edit"><Settings size={11} /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteTable(table.id) }} style={{ width: 22, height: 22, borderRadius: 6, background: '#FEE2E2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#EF4444', fontSize: 10 }} title="Delete"><Trash2 size={11} /></button>
                    </div>
                  )}
                  {/* Seat dots */}
                  {renderSeats(table, st)}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Sidebar — bookings */}
      {!embedded && (
        <div className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-hidden shrink-0 hidden lg:flex">
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
                  </div>
                )
              })}
            {(selectedTable ? tableBookings(selectedTable) : bookings).length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">No bookings{selectedTable ? ' for this table' : ''}</div>
            )}
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {editTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setEditTable(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl" onClick={e => e.stopPropagation()} style={{ fontFamily: "'Figtree', sans-serif" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-extrabold text-lg text-primary">Edit {editTable.name}</h3>
              <button onClick={() => setEditTable(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-primary mb-1.5">Table Name</label>
                <input type="text" value={editTable.name} onChange={e => { const v = e.target.value; setEditTable(p => ({ ...p, name: v })); updateTable(editTable.id, { name: v }) }} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-bold text-primary mb-1.5">Shape</label>
                <div className="flex gap-2">
                  {TABLE_SHAPES.map(s => (
                    <button key={s.id} onClick={() => { setEditTable(p => ({ ...p, shape: s.id })); updateTable(editTable.id, { shape: s.id }) }}
                      className={`flex-1 py-2 rounded-lg text-center text-sm font-bold transition-all ${editTable.shape === s.id ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-primary mb-1.5">Seats</label>
                <div className="flex gap-2">
                  {SEAT_OPTIONS.map(n => (
                    <button key={n} onClick={() => { setEditTable(p => ({ ...p, seats: n })); updateTable(editTable.id, { seats: n }) }}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${editTable.seats === n ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-primary mb-1.5">Zone</label>
                <div className="flex gap-2 flex-wrap">
                  {ZONES.filter(z => !z.nonTable).map(z => (
                    <button key={z.id} onClick={() => { setEditTable(p => ({ ...p, zone: z.id })); updateTable(editTable.id, { zone: z.id }) }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${editTable.zone === z.id ? 'text-white shadow-md' : 'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                      style={editTable.zone === z.id ? { background: z.color, borderColor: z.color } : {}}>
                      {z.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { deleteTable(editTable.id); setEditTable(null) }} className="px-4 py-2.5 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              <div className="flex-1" />
              <button onClick={() => setEditTable(null)} className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-[#2D6A4F] shadow-lg">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FloorPlan
