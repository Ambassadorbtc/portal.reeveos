/**
 * Floor Plan — Full drag-drop table editor + live status view
 * Zone views: Main Floor, Bar, Kitchen, Terrace, Window, Upstairs, Outside, Basement
 * Table shapes: round, square, long, booth
 * Lock/unlock toggle, add/remove tables, zone tabs, proper spacing
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Lock, Unlock, Plus, Trash2, X, Settings, GripVertical,
  LayoutGrid, Copy, Move,
  Circle, Square, RectangleHorizontal, Sofa,
  Home, UtensilsCrossed, Wine, ChefHat, Sun, PanelTop, ArrowUp, TreePine, ArrowDown
} from 'lucide-react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import RezvoLoader from '../../components/shared/RezvoLoader'

/* ═══════════════ CONSTANTS ═══════════════ */

const STATUS = {
  available:  { bg: '#F7F7F5', border: '#D1D5DB', text: '#6B7280', label: 'Available', dot: '#9CA3AF' },
  reserved:   { bg: '#FFF8F0', border: '#D4A373', text: '#92400E', label: 'Reserved', dot: '#D4A373' },
  confirmed:  { bg: '#EFF6FF', border: '#1B4332', text: '#1B4332', label: 'Confirmed', dot: '#1B4332' },
  seated:     { bg: '#ECFDF5', border: '#059669', text: '#065F46', label: 'Seated', dot: '#059669' },
  mains:      { bg: '#FFF7ED', border: '#EA580C', text: '#9A3412', label: 'Mains', dot: '#EA580C' },
  dessert:    { bg: '#FAF5FF', border: '#8B5CF6', text: '#5B21B6', label: 'Dessert', dot: '#8B5CF6' },
  paying:     { bg: '#F3F4F6', border: '#6B7280', text: '#374151', label: 'Paying', dot: '#6B7280' },
  dirty:      { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B', label: 'Dirty', dot: '#EF4444' },
  pending:    { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E', label: 'Pending', dot: '#F59E0B' },
}

const ZONES = [
  { id: 'all',       label: 'All Zones',    Icon: Home,              color: '#1B4332' },
  { id: 'main',      label: 'Main Floor',   Icon: UtensilsCrossed,   color: '#1B4332' },
  { id: 'bar',       label: 'Bar',          Icon: Wine,              color: '#D97706' },
  { id: 'kitchen',   label: 'Kitchen',      Icon: ChefHat,           color: '#DC2626' },
  { id: 'terrace',   label: 'Terrace',      Icon: Sun,               color: '#059669' },
  { id: 'window',    label: 'Window',       Icon: PanelTop,          color: '#2563EB' },
  { id: 'upstairs',  label: 'Upstairs',     Icon: ArrowUp,           color: '#7C3AED' },
  { id: 'outside',   label: 'Outside',      Icon: TreePine,          color: '#0891B2' },
  { id: 'basement',  label: 'Basement',     Icon: ArrowDown,         color: '#78716C' },
]

const TABLE_SHAPES = [
  { id: 'round',   label: 'Round',   Icon: Circle },
  { id: 'square',  label: 'Square',  Icon: Square },
  { id: 'long',    label: 'Long',    Icon: RectangleHorizontal },
  { id: 'booth',   label: 'Booth',   Icon: Sofa },
]

const SEAT_OPTIONS = [2, 4, 6, 8, 10, 12]

/* Demo tables with proper zones, shapes, statuses, and spaced positions */
const DEFAULT_TABLES = [
  // Main Floor
  { id: 't1',  name: 'T-01', seats: 4, zone: 'main', shape: 'round',  x: 60,  y: 50,  status: 'seated',    timer: '45m', vip: false },
  { id: 't2',  name: 'T-02', seats: 4, zone: 'main', shape: 'square', x: 250, y: 50,  status: 'reserved',  nextTime: '6:30 PM', guest: 'Smith (4)' },
  { id: 't3',  name: 'T-03', seats: 2, zone: 'main', shape: 'square', x: 440, y: 50,  status: 'available' },
  { id: 't4',  name: 'T-04', seats: 6, zone: 'main', shape: 'round',  x: 60,  y: 230, status: 'seated',    timer: '12m', vip: true },
  { id: 't5',  name: 'T-05', seats: 4, zone: 'main', shape: 'round',  x: 250, y: 230, status: 'dirty' },
  { id: 't6',  name: 'T-06', seats: 8, zone: 'main', shape: 'long',   x: 440, y: 230, status: 'mains', guest: 'Williams' },
  // Window
  { id: 't7',  name: 'T-07', seats: 2, zone: 'window', shape: 'round',  x: 60,  y: 50,  status: 'seated', timer: '20m', guest: 'Johnson' },
  { id: 't8',  name: 'T-08', seats: 2, zone: 'window', shape: 'round',  x: 250, y: 50,  status: 'available' },
  { id: 't9',  name: 'T-09', seats: 4, zone: 'window', shape: 'square', x: 440, y: 50,  status: 'reserved', nextTime: '7:15 PM' },
  // Bar
  { id: 't10', name: 'T-10', seats: 2, zone: 'bar', shape: 'round', x: 60,  y: 50,  status: 'seated', timer: '30m' },
  { id: 't11', name: 'T-11', seats: 2, zone: 'bar', shape: 'round', x: 220, y: 50,  status: 'available' },
  { id: 't12', name: 'T-12', seats: 4, zone: 'bar', shape: 'booth', x: 380, y: 50,  status: 'reserved', nextTime: '7:00 PM' },
  { id: 't13', name: 'T-13', seats: 4, zone: 'bar', shape: 'booth', x: 60,  y: 200, status: 'available' },
  // Terrace
  { id: 't14', name: 'T-14', seats: 6, zone: 'terrace', shape: 'round',  x: 60,  y: 50,  status: 'available' },
  { id: 't15', name: 'T-15', seats: 4, zone: 'terrace', shape: 'square', x: 260, y: 50,  status: 'seated', timer: '35m', guest: 'Park' },
  { id: 't16', name: 'T-16', seats: 8, zone: 'terrace', shape: 'long',   x: 60,  y: 230, status: 'mains', guest: 'Chen' },
  // Upstairs
  { id: 't17', name: 'T-17', seats: 4, zone: 'upstairs', shape: 'round', x: 60,  y: 50,  status: 'available' },
  { id: 't18', name: 'T-18', seats: 6, zone: 'upstairs', shape: 'long',  x: 260, y: 50,  status: 'reserved', nextTime: '8:00 PM' },
  { id: 't19', name: 'T-19', seats: 4, zone: 'upstairs', shape: 'round', x: 60,  y: 230, status: 'seated', timer: '15m' },
  // Outside
  { id: 't20', name: 'T-20', seats: 4, zone: 'outside', shape: 'round', x: 60,  y: 50,  status: 'available' },
  { id: 't21', name: 'T-21', seats: 2, zone: 'outside', shape: 'round', x: 250, y: 50,  status: 'available' },
  { id: 't22', name: 'T-22', seats: 6, zone: 'outside', shape: 'long',  x: 60,  y: 230, status: 'seated', timer: '25m' },
  // Basement
  { id: 't23', name: 'T-23', seats: 8, zone: 'basement', shape: 'long',   x: 60,  y: 50,  status: 'available' },
  { id: 't24', name: 'T-24', seats: 10, zone: 'basement', shape: 'long',  x: 60,  y: 220, status: 'reserved', nextTime: '8:30 PM', guest: 'Party booking' },
  // Kitchen (chef's table)
  { id: 't25', name: 'Chef Table', seats: 6, zone: 'kitchen', shape: 'long', x: 60, y: 50, status: 'reserved', nextTime: '7:30 PM', guest: 'VIP', vip: true },
]

/* ═══════════════ SEAT DOTS ═══════════════ */

const SeatDots = ({ seats, w, h, color, active }) => {
  const count = Math.min(seats, 12)
  return Array.from({ length: count }).map((_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const rx = w / 2 + 14, ry = h / 2 + 14
    return (
      <div key={i} style={{
        position: 'absolute', width: 8, height: 8, borderRadius: '50%',
        background: active ? color : '#D1D5DB',
        left: w / 2 + Math.cos(angle) * rx - 4,
        top: h / 2 + Math.sin(angle) * ry - 4,
        opacity: active ? 0.5 : 0.25, transition: 'all 0.3s',
      }} />
    )
  })
}

/* ═══════════════ TABLE NODE ═══════════════ */

const TableNode = ({ table, status, isSelected, locked, isDragging, onMouseDown, onTouchStart, onClick, onEdit, onDelete }) => {
  const st = STATUS[status] || STATUS.available
  const seats = table.seats || 4
  const baseSize = seats <= 2 ? 85 : seats <= 4 ? 100 : seats <= 6 ? 120 : seats <= 8 ? 140 : 155

  const getDims = () => {
    switch (table.shape) {
      case 'square': return { w: baseSize, h: baseSize, radius: 14 }
      case 'long':   return { w: baseSize * 1.7, h: baseSize * 0.65, radius: 14 }
      case 'booth':  return { w: baseSize * 1.4, h: baseSize * 0.8, radius: 20 }
      default:       return { w: baseSize, h: baseSize, radius: '50%' }
    }
  }
  const { w, h, radius } = getDims()
  const isDirty = status === 'dirty'

  return (
    <div
      style={{
        position: 'absolute', left: table.x, top: table.y, width: w, height: h, borderRadius: radius,
        background: st.bg,
        border: isDirty ? `2.5px dashed ${st.border}` : `2.5px solid ${st.border}`,
        boxShadow: isSelected ? `0 0 0 3px ${st.border}30, 0 8px 30px rgba(0,0,0,.12)` : isDragging ? '0 12px 40px rgba(0,0,0,.2)' : '0 2px 12px rgba(0,0,0,.04)',
        cursor: locked ? 'pointer' : isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'box-shadow 0.15s' : 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
        transform: isSelected ? 'scale(1.05)' : isDragging ? 'scale(1.08)' : 'scale(1)',
        zIndex: isDragging ? 100 : isSelected ? 20 : 1,
        userSelect: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Figtree', sans-serif",
      }}
      onClick={onClick} onMouseDown={onMouseDown} onTouchStart={onTouchStart}
    >
      {table.vip && (
        <div style={{ position: 'absolute', top: -8, right: -8, background: '#F59E0B', color: '#fff', fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 6, boxShadow: '0 2px 6px rgba(245,158,11,0.4)' }}>VIP</div>
      )}
      {!locked && <div style={{ position: 'absolute', top: 4, right: 4, opacity: 0.3 }}><GripVertical size={12} /></div>}

      <span style={{ fontSize: 14, fontWeight: 800, color: st.text, letterSpacing: '-0.02em' }}>{table.name}</span>

      {status === 'seated' && table.timer ? (
        <>
          <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
            {Array.from({ length: Math.min(seats, 6) }).map((_, i) => (
              <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: st.text }} />
            ))}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: st.text, marginTop: 2, opacity: 0.8 }}>{table.timer}</span>
        </>
      ) : status === 'reserved' && table.nextTime ? (
        <>
          <span style={{ fontSize: 11, fontWeight: 600, color: st.border, marginTop: 2 }}>{table.nextTime}</span>
          {table.guest && <span style={{ fontSize: 9, color: st.text, opacity: 0.7 }}>{table.guest}</span>}
        </>
      ) : status === 'dirty' ? (
        <span style={{ fontSize: 10, fontWeight: 800, color: st.text, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>DIRTY</span>
      ) : status === 'mains' ? (
        <span style={{ fontSize: 10, fontWeight: 700, color: st.text, marginTop: 2 }}>{table.guest || 'Mains'}</span>
      ) : (
        <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', marginTop: 2 }}>Available</span>
      )}

      <SeatDots seats={seats} w={w} h={h} color={st.dot} active={status !== 'available' && status !== 'dirty'} />

      {!locked && isSelected && (
        <div style={{ position: 'absolute', bottom: -36, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 30 }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit?.() }} style={{ width: 28, height: 28, borderRadius: 8, background: '#fff', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
            <Settings size={13} color="#6B7280" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete?.() }} style={{ width: 28, height: 28, borderRadius: 8, background: '#FEE2E2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(239,68,68,.12)' }}>
            <Trash2 size={13} color="#EF4444" />
          </button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════ STAT PILL ═══════════════ */
const StatPill = ({ label, value, color }) => (
  <div className="flex items-center gap-1.5">
    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
    <span className="text-[11px] font-bold" style={{ color }}>{value}</span>
    <span className="text-[10px] font-medium text-gray-400">{label}</span>
  </div>
)

/* ═══════════════ MAIN COMPONENT ═══════════════ */

const FloorPlan = ({ embedded = false }) => {
  const { business, businessType } = useBusiness()
  const bid = business?.id ?? business?._id
  const isFood = businessType === 'food' || businessType === 'restaurant'

  const [tables, setTables] = useState(DEFAULT_TABLES)
  const [bookings, setBookings] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)
  const [locked, setLocked] = useState(true)
  const [loading, setLoading] = useState(false)
  const [activeZone, setActiveZone] = useState('all')
  const [toast, setToast] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 })
  const canvasRef = useRef(null)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [addShape, setAddShape] = useState('round')
  const [addSeats, setAddSeats] = useState(4)
  const [addZone, setAddZone] = useState('main')
  const [addName, setAddName] = useState('')
  const [editTable, setEditTable] = useState(null)

  /* ── Load bookings from API (keep demo tables for layout) ── */
  useEffect(() => {
    if (!bid) return
    const today = new Date().toISOString().slice(0, 10)
    api.get(`/calendar/business/${bid}/restaurant?date=${today}&view=day`)
      .then(d => { if (d.bookings?.length) setBookings(d.bookings) })
      .catch(() => {})
  }, [bid])

  const visibleTables = useMemo(() => activeZone === 'all' ? tables : tables.filter(t => t.zone === activeZone), [tables, activeZone])

  const zoneCounts = useMemo(() => {
    const c = { all: tables.length }
    ZONES.forEach(z => { if (z.id !== 'all') c[z.id] = tables.filter(t => t.zone === z.id).length })
    return c
  }, [tables])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  /* ── Mouse Drag ── */
  const handleMouseDown = useCallback((e, tId) => {
    if (locked) return
    e.preventDefault(); e.stopPropagation()
    const t = tables.find(t => t.id === tId); if (!t) return
    const rect = canvasRef.current?.getBoundingClientRect()
    setDragging(tId)
    setDragOff({ x: e.clientX - (rect?.left || 0) - t.x, y: e.clientY - (rect?.top || 0) - t.y })
  }, [locked, tables])

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return
    const nx = Math.max(0, Math.min(rect.width - 60, e.clientX - rect.left - dragOff.x))
    const ny = Math.max(0, Math.min(rect.height - 60, e.clientY - rect.top - dragOff.y))
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

  /* ── Touch Drag ── */
  const handleTouchStart = useCallback((e, tId) => {
    if (locked) return
    const t = tables.find(t => t.id === tId); if (!t) return
    const touch = e.touches[0]; const rect = canvasRef.current?.getBoundingClientRect()
    setDragging(tId)
    setDragOff({ x: touch.clientX - (rect?.left || 0) - t.x, y: touch.clientY - (rect?.top || 0) - t.y })
  }, [locked, tables])

  const handleTouchMove = useCallback((e) => {
    if (!dragging) return; e.preventDefault()
    const touch = e.touches[0]; const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return
    const nx = Math.max(0, Math.min(rect.width - 60, touch.clientX - rect.left - dragOff.x))
    const ny = Math.max(0, Math.min(rect.height - 60, touch.clientY - rect.top - dragOff.y))
    setTables(prev => prev.map(t => t.id === dragging ? { ...t, x: nx, y: ny } : t))
  }, [dragging, dragOff])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleMouseUp)
      return () => { window.removeEventListener('touchmove', handleTouchMove); window.removeEventListener('touchend', handleMouseUp) }
    }
  }, [dragging, handleTouchMove, handleMouseUp])

  /* ── Table CRUD ── */
  const addTableFn = () => {
    const zone = addZone || (activeZone !== 'all' ? activeZone : 'main')
    const num = tables.length + 1
    const name = addName.trim() || `T-${String(num).padStart(2, '0')}`
    setTables(prev => [...prev, { id: `t${Date.now()}`, name, seats: addSeats, zone, shape: addShape, x: 60 + Math.random() * 350, y: 50 + Math.random() * 250, status: 'available' }])
    setShowAddPanel(false); setAddName('')
    showToast(`${name} added to ${ZONES.find(z => z.id === zone)?.label || zone}`)
  }

  const deleteTable = (tId) => {
    const t = tables.find(t => t.id === tId)
    setTables(prev => prev.filter(t => t.id !== tId))
    if (selectedTable === tId) setSelectedTable(null)
    if (editTable?.id === tId) setEditTable(null)
    showToast(`${t?.name || 'Table'} removed`)
  }

  const duplicateTable = (tId) => {
    const orig = tables.find(t => t.id === tId); if (!orig) return
    setTables(prev => [...prev, { ...orig, id: `t${Date.now()}`, name: `${orig.name}-copy`, x: orig.x + 30, y: orig.y + 30 }])
    showToast(`Duplicated ${orig.name}`)
  }

  const updateTable = (tId, updates) => {
    setTables(prev => prev.map(t => t.id === tId ? { ...t, ...updates } : t))
    if (editTable?.id === tId) setEditTable(prev => prev ? { ...prev, ...updates } : prev)
  }

  /* ── Stats ── */
  const stats = useMemo(() => {
    const vis = visibleTables
    return {
      total: vis.length,
      available: vis.filter(t => t.status === 'available').length,
      seated: vis.filter(t => ['seated', 'mains', 'dessert'].includes(t.status)).length,
      reserved: vis.filter(t => ['reserved', 'confirmed', 'pending'].includes(t.status)).length,
      dirty: vis.filter(t => t.status === 'dirty').length,
    }
  }, [visibleTables])

  const occupancy = stats.total > 0 ? Math.round((stats.seated / stats.total) * 100) : 0

  if (loading) return <RezvoLoader message="Loading floor plan..." />
  if (!isFood) return <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm"><h2 className="font-bold text-xl text-gray-900 mb-2">Floor Plan</h2><p className="text-gray-500">Floor plans are available for restaurant businesses.</p></div>

  return (
    <div className={`flex flex-col overflow-hidden bg-white ${embedded ? 'h-full' : 'h-full'}`} style={{ fontFamily: "'Figtree', sans-serif" }}>

      {/* ═══ CONTROLS BAR (no duplicate title — TopBar already shows Floor Plan) ═══ */}
      {!embedded && (
        <div className="border-b border-gray-100 px-5 py-3 shrink-0">
          {/* Row 1: Stats + Controls */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-5">
              <StatPill label="Tables" value={stats.total} color="#1B4332" />
              <StatPill label="Seated" value={stats.seated} color="#059669" />
              <StatPill label="Available" value={stats.available} color="#9CA3AF" />
              <StatPill label="Reserved" value={stats.reserved} color="#D4A373" />
              {stats.dirty > 0 && <StatPill label="Dirty" value={stats.dirty} color="#EF4444" />}
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs" style={{ background: occupancy > 50 ? '#ECFDF5' : '#F7F7F5', color: occupancy > 50 ? '#059669' : '#6B7280' }}>{occupancy}%</div>
                <span className="text-[10px] font-medium text-gray-400">occupancy</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => { setLocked(!locked); if (!locked) showToast('Layout locked') }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                style={{ background: locked ? '#F3F4F6' : '#1B4332', color: locked ? '#374151' : '#fff', boxShadow: locked ? 'none' : '0 4px 14px rgba(27,67,50,0.3)' }}>
                {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                {locked ? 'Locked' : 'Editing'}
              </button>
              {!locked && (
                <button onClick={() => setShowAddPanel(!showAddPanel)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 transition-all">
                  <Plus className="w-4 h-4" /> Add Table
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Zone Tabs — ALWAYS show all zones */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {ZONES.map(zone => {
              const isActive = activeZone === zone.id
              const count = zoneCounts[zone.id] || 0
              return (
                <button key={zone.id} onClick={() => { setActiveZone(zone.id); if (zone.id !== 'all') setAddZone(zone.id) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0"
                  style={{ background: isActive ? zone.color + '12' : 'transparent', color: isActive ? zone.color : count > 0 ? '#6B7280' : '#C9C9C9', border: isActive ? `1.5px solid ${zone.color}30` : '1.5px solid transparent' }}>
                  {zone.Icon && <zone.Icon size={14} strokeWidth={2} />}
                  {zone.label}
                  {count > 0 && <span className="ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ background: isActive ? zone.color + '18' : '#F3F4F6', color: isActive ? zone.color : '#9CA3AF' }}>{count}</span>}
                </button>
              )
            })}
          </div>

          {/* Row 3: Status Legend */}
          <div className="flex items-center gap-3 mt-2.5">
            {['available', 'seated', 'reserved', 'mains', 'paying', 'dirty'].map(k => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: STATUS[k].dot }} />
                <span className="text-[10px] font-semibold text-gray-400">{STATUS[k].label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ADD TABLE PANEL ═══ */}
      {showAddPanel && !locked && (
        <div className="border-b border-gray-100 px-5 py-3 bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Name:</span>
              <input type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder={`T-${String(tables.length + 1).padStart(2, '0')}`}
                className="w-20 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Shape:</span>
              {TABLE_SHAPES.map(s => { const SIcon = s.Icon; return (
                <button key={s.id} onClick={() => setAddShape(s.id)} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${addShape === s.id ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`} title={s.label}><SIcon size={16} /></button>
              )})}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Seats:</span>
              {SEAT_OPTIONS.map(n => (
                <button key={n} onClick={() => setAddSeats(n)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${addSeats === n ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`}>{n}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Zone:</span>
              <div className="flex gap-1.5 flex-wrap">
                {ZONES.filter(z => z.id !== 'all').map(z => (
                  <button key={z.id} onClick={() => setAddZone(z.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${addZone === z.id ? 'text-white' : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50'}`}
                    style={addZone === z.id ? { background: z.color, borderColor: z.color } : {}}><z.Icon size={11} className="inline -mt-px" /> {z.label}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={addTableFn} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-emerald-600 transition-all">Place Table</button>
              <button onClick={() => setShowAddPanel(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"><X className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAIN: CANVAS + SIDEBAR ═══ */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto" style={{ background: '#FAFAF8' }}>
          <div ref={canvasRef} className="relative"
            style={{ minWidth: 700, minHeight: 500, height: '100%',
              backgroundImage: locked ? 'radial-gradient(circle, #E5E5E0 0.8px, transparent 0.8px)' : 'radial-gradient(circle, #93C5FD 0.8px, transparent 0.8px)',
              backgroundSize: '24px 24px', transition: 'background-image 0.3s',
              padding: 20,
            }}
            onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>

            {/* Zone label watermark */}
            {activeZone !== 'all' && (
              <div style={{ position: 'absolute', right: 30, bottom: 20, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.08, pointerEvents: 'none' }}>
                {(() => { const ZI = ZONES.find(z => z.id === activeZone)?.Icon; return ZI ? <ZI size={48} strokeWidth={1.2} color={ZONES.find(z => z.id === activeZone)?.color} /> : null })()}
                <span style={{ fontSize: 36, fontWeight: 900, color: ZONES.find(z => z.id === activeZone)?.color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{ZONES.find(z => z.id === activeZone)?.label}</span>
              </div>
            )}

            {/* Edit mode banner */}
            {!locked && (
              <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: '#1B4332', color: '#fff', fontSize: 11, fontWeight: 700, padding: '6px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 20px rgba(27,67,50,0.3)' }}>
                <Move size={13} /> Drag tables to rearrange · Click to select
              </div>
            )}

            {/* Empty state */}
            {visibleTables.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                <LayoutGrid size={48} strokeWidth={1} className="mb-3 opacity-30" />
                <p className="text-sm font-bold">No tables in {ZONES.find(z => z.id === activeZone)?.label || 'this zone'}</p>
                {!locked && <button onClick={() => setShowAddPanel(true)} className="mt-3 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-lg hover:bg-[#2D6A4F] transition-all"><Plus className="w-3.5 h-3.5 inline mr-1" /> Add First Table</button>}
              </div>
            )}

            {/* Tables */}
            {visibleTables.map(table => (
              <TableNode key={table.id} table={table} status={table.status || 'available'} isSelected={selectedTable === table.id} locked={locked} isDragging={dragging === table.id}
                onMouseDown={(e) => handleMouseDown(e, table.id)} onTouchStart={(e) => handleTouchStart(e, table.id)}
                onClick={() => locked && setSelectedTable(table.id === selectedTable ? null : table.id)}
                onEdit={() => setEditTable(table)} onDelete={() => deleteTable(table.id)} />
            ))}
          </div>
        </div>

        {/* ═══ SIDEBAR ═══ */}
        {!embedded && (
          <div className="w-[280px] bg-white border-l border-gray-100 flex flex-col overflow-hidden shrink-0 hidden lg:flex">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="font-extrabold text-sm text-gray-900">Today's Bookings</h2>
              <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{bookings.length} total</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {bookings.length > 0 ? bookings.sort((a, b) => (a.time || '').localeCompare(b.time || '')).map((b, i) => {
                const st = STATUS[b.status] || STATUS.confirmed
                return (
                  <div key={b.id || i} className="p-3 rounded-xl border border-gray-50 hover:border-gray-200 transition-all hover:shadow-sm" style={{ borderLeft: `3px solid ${st.border}` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-gray-900">{b.customerName}</span>
                      <span className="text-xs font-extrabold" style={{ color: st.text }}>{b.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                      <span>{b.partySize || 2} guests</span><span>·</span><span>{b.tableName || `Table ${b.tableId}`}</span>
                      <span className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-extrabold" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                    </div>
                  </div>
                )
              }) : (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                    <svg className="text-gray-300" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <p className="text-sm font-bold text-gray-400">No bookings yet</p>
                  <p className="text-[11px] text-gray-300 mt-1">Bookings will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ EDIT TABLE MODAL ═══ */}
      {editTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setEditTable(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()} style={{ fontFamily: "'Figtree', sans-serif" }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-extrabold text-lg text-gray-900">Edit {editTable.name}</h3>
              <button onClick={() => setEditTable(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Table Name</label>
                <input type="text" value={editTable.name} onChange={e => { const v = e.target.value; setEditTable(p => ({ ...p, name: v })); updateTable(editTable.id, { name: v }) }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Shape</label>
                <div className="flex gap-2">
                  {TABLE_SHAPES.map(s => { const SIcon = s.Icon; return (
                    <button key={s.id} onClick={() => { setEditTable(p => ({ ...p, shape: s.id })); updateTable(editTable.id, { shape: s.id }) }}
                      className={`flex-1 py-2.5 rounded-xl text-center text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${editTable.shape === s.id ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      <SIcon size={15} /> {s.label}
                    </button>
                  )})}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Seats</label>
                <div className="flex gap-2">
                  {SEAT_OPTIONS.map(n => (
                    <button key={n} onClick={() => { setEditTable(p => ({ ...p, seats: n })); updateTable(editTable.id, { seats: n }) }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${editTable.seats === n ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Zone</label>
                <div className="flex gap-2 flex-wrap">
                  {ZONES.filter(z => z.id !== 'all').map(z => (
                    <button key={z.id} onClick={() => { setEditTable(p => ({ ...p, zone: z.id })); updateTable(editTable.id, { zone: z.id }) }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${editTable.zone === z.id ? 'text-white shadow-md' : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                      style={editTable.zone === z.id ? { background: z.color, borderColor: z.color } : {}}><z.Icon size={11} className="inline -mt-px" /> {z.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Status</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(STATUS).map(([key, val]) => (
                    <button key={key} onClick={() => { setEditTable(p => ({ ...p, status: key })); updateTable(editTable.id, { status: key }) }}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${editTable.status === key ? 'shadow-md' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                      style={editTable.status === key ? { background: val.bg, color: val.text, borderColor: val.border } : { color: '#9CA3AF' }}>{val.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => { duplicateTable(editTable.id); setEditTable(null) }} className="px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Duplicate</button>
              <button onClick={() => { deleteTable(editTable.id); setEditTable(null) }} className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              <div className="flex-1" />
              <button onClick={() => setEditTable(null)} className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-[#2D6A4F] shadow-lg shadow-primary/20">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: '#1B4332', color: '#fff', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700, boxShadow: '0 8px 30px rgba(27,67,50,0.3)', fontFamily: "'Figtree', sans-serif" }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}

export default FloorPlan
