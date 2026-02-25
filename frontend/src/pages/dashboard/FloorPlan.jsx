/**
 * Floor Plan v2 — Venue layout editor with fixtures + tables
 * 
 * Concept: Floors (Main, Upstairs, Terrace, Basement) contain Elements.
 * Elements are either Tables (bookable, have seats/status) or Fixtures (structural).
 * "All Zones" auto-arranges every floor into one vertical overview.
 * Persists to MongoDB via API — no localStorage.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Lock, Unlock, Plus, Trash2, X, Settings, GripVertical,
  LayoutGrid, Copy, Move, Save, Check, RotateCw,
  Circle, Square, RectangleHorizontal, Sofa,
  Home, Wine, Sun, ArrowUp, TreePine, ArrowDown, Layers,
  Users, Clock, DoorOpen, PanelTop, Bath, CookingPot,
  Minus, Eye, ChevronDown, ChevronRight, Armchair
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
}

const FLOOR_PRESETS = [
  { id: 'main',      label: 'Main Floor',  Icon: Home,     color: '#1B4332' },
  { id: 'upstairs',  label: 'Upstairs',    Icon: ArrowUp,  color: '#7C3AED' },
  { id: 'mezzanine', label: 'Mezzanine',   Icon: Layers,   color: '#2563EB' },
  { id: 'terrace',   label: 'Terrace',     Icon: Sun,      color: '#059669' },
  { id: 'outside',   label: 'Outside',     Icon: TreePine,  color: '#0891B2' },
  { id: 'basement',  label: 'Basement',    Icon: ArrowDown, color: '#78716C' },
]

const TABLE_SHAPES = [
  { id: 'round',   label: 'Round',  Icon: Circle },
  { id: 'square',  label: 'Square', Icon: Square },
  { id: 'long',    label: 'Long',   Icon: RectangleHorizontal },
  { id: 'booth',   label: 'Booth',  Icon: Sofa },
]

const SEAT_OPTIONS = [2, 4, 6, 8, 10, 12]

const FIXTURE_TYPES = [
  { id: 'window',    label: 'Window',    w: 100, h: 16,  color: '#93C5FD', borderColor: '#60A5FA', Icon: PanelTop },
  { id: 'door',      label: 'Entrance',  w: 50,  h: 16,  color: '#86EFAC', borderColor: '#4ADE80', Icon: DoorOpen },
  { id: 'bar',       label: 'Bar',       w: 160, h: 36,  color: '#92400E', borderColor: '#78350F', Icon: Wine },
  { id: 'stairs',    label: 'Stairs',    w: 70,  h: 50,  color: '#D6D3D1', borderColor: '#A8A29E', Icon: ArrowUp },
  { id: 'toilets',   label: 'Toilets',   w: 70,  h: 50,  color: '#E0E7FF', borderColor: '#A5B4FC', Icon: Bath },
  { id: 'kitchen',   label: 'Kitchen',   w: 120, h: 80,  color: '#FEE2E2', borderColor: '#FCA5A5', Icon: CookingPot },
  { id: 'wall',      label: 'Wall',      w: 120, h: 8,   color: '#374151', borderColor: '#1F2937', Icon: Minus },
  { id: 'till',      label: 'Till',      w: 40,  h: 40,  color: '#FEF3C7', borderColor: '#FCD34D', Icon: Square },
]

/* ═══════════════ FIXTURE ELEMENT ═══════════════ */

const FixtureNode = ({ el, locked, isSelected, isDragging, onMouseDown, onTouchStart, onClick, onDelete, onRotate, scale = 1 }) => {
  const [hovered, setHovered] = useState(false)
  const ft = FIXTURE_TYPES.find(f => f.id === el.kind) || FIXTURE_TYPES[0]
  const w = (el.w || ft.w) * scale
  const h = (el.h || ft.h) * scale
  const FIcon = ft.Icon

  return (
    <div
      style={{
        position: 'absolute', left: el.x * scale, top: el.y * scale,
        zIndex: isDragging ? 200 : hovered ? 50 : 1,
        transform: `rotate(${el.rotation || 0}deg)`,
      }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      {/* Delete on hover in edit mode */}
      {!locked && hovered && !isDragging && (
        <div style={{ position: 'absolute', top: -10, right: -10, zIndex: 40, display: 'flex', gap: 3 }}>
          {(el.kind === 'wall' || el.kind === 'window' || el.kind === 'bar') && (
            <button onClick={e => { e.stopPropagation(); onRotate?.() }} style={{
              width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: '#fff', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,.15)', fontSize: 10,
            }}><RotateCw size={10} /></button>
          )}
          <button onClick={e => { e.stopPropagation(); onDelete?.() }} style={{
            width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(239,68,68,.4)',
          }}><X size={10} strokeWidth={3} /></button>
        </div>
      )}

      <div
        style={{
          width: w, height: h,
          background: el.kind === 'wall' ? ft.color : `${ft.color}60`,
          border: `1.5px ${el.kind === 'kitchen' ? 'dashed' : 'solid'} ${ft.borderColor}`,
          borderRadius: el.kind === 'wall' ? 2 : 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          cursor: locked ? 'default' : isDragging ? 'grabbing' : 'grab',
          boxShadow: isSelected ? `0 0 0 2px ${ft.borderColor}` : isDragging ? '0 4px 16px rgba(0,0,0,.15)' : 'none',
          transition: isDragging ? 'none' : 'box-shadow 0.2s',
          userSelect: 'none', fontFamily: "'Figtree', sans-serif",
          overflow: 'hidden',
        }}
        onClick={onClick} onMouseDown={onMouseDown} onTouchStart={onTouchStart}
      >
        {el.kind !== 'wall' && h * scale > 14 && (
          <>
            <FIcon size={Math.min(14, h * 0.6) * scale} color={ft.borderColor} strokeWidth={2} />
            {w > 50 * scale && <span style={{ fontSize: Math.max(8, 10 * scale), fontWeight: 700, color: ft.borderColor, letterSpacing: '-0.02em' }}>{ft.label}</span>}
          </>
        )}
        {!locked && <div style={{ position: 'absolute', top: 1, right: 2, opacity: 0.3 }}><GripVertical size={8} /></div>}
      </div>
    </div>
  )
}

/* ═══════════════ TABLE ELEMENT ═══════════════ */

const TableNode = ({ el, locked, isSelected, isDragging, onMouseDown, onTouchStart, onClick, onDelete, onEdit, onRotate, scale = 1 }) => {
  const [hovered, setHovered] = useState(false)
  const status = el.status || 'available'
  const st = STATUS[status] || STATUS.available
  const seats = el.seats || 4
  const baseSize = (seats <= 2 ? 70 : seats <= 4 ? 85 : seats <= 6 ? 100 : seats <= 8 ? 115 : 130) * scale

  const getDims = () => {
    switch (el.shape) {
      case 'square': return { w: baseSize, h: baseSize, radius: 10 }
      case 'long':   return { w: baseSize * 1.6, h: baseSize * 0.6, radius: 10 }
      case 'booth':  return { w: baseSize * 1.3, h: baseSize * 0.75, radius: 16 }
      default:       return { w: baseSize, h: baseSize, radius: '50%' }
    }
  }
  const { w, h, radius } = getDims()

  // Seat dots around the table
  const seatCount = Math.min(seats, 12)
  const seatDots = Array.from({ length: seatCount }).map((_, i) => {
    const angle = (i / seatCount) * Math.PI * 2 - Math.PI / 2
    const rx = w / 2 + 10 * scale, ry = h / 2 + 10 * scale
    return (
      <div key={i} style={{
        position: 'absolute', width: 6 * scale, height: 6 * scale, borderRadius: '50%',
        background: status !== 'available' ? st.dot : '#D1D5DB',
        left: w / 2 + Math.cos(angle) * rx - 3 * scale,
        top: h / 2 + Math.sin(angle) * ry - 3 * scale,
        opacity: status !== 'available' ? 0.5 : 0.25,
      }} />
    )
  })

  return (
    <div
      style={{
        position: 'absolute', left: el.x * scale, top: el.y * scale,
        zIndex: isDragging ? 200 : hovered ? 150 : isSelected ? 20 : 2,
      }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      {/* Delete + Edit on hover */}
      {!locked && hovered && !isDragging && (
        <div style={{ position: 'absolute', top: -10, right: -10, zIndex: 40, display: 'flex', gap: 3 }}>
          <button onClick={e => { e.stopPropagation(); onEdit?.() }} style={{
            width: 20, height: 20, borderRadius: '50%', border: '1px solid #E5E7EB', cursor: 'pointer',
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,.1)',
          }}><Settings size={10} color="#6B7280" /></button>
          <button onClick={e => { e.stopPropagation(); onDelete?.() }} style={{
            width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(239,68,68,.4)',
          }}><X size={10} strokeWidth={3} /></button>
        </div>
      )}

      {/* Tooltip on hover in locked mode */}
      {locked && hovered && (
        <div style={{
          position: 'absolute', bottom: h + 14, left: '50%', transform: 'translateX(-50%)',
          background: '#1B4332', color: '#fff', borderRadius: 10, padding: '8px 12px',
          minWidth: 140, zIndex: 50, pointerEvents: 'none', boxShadow: '0 6px 24px rgba(27,67,50,.3)',
          fontFamily: "'Figtree', sans-serif",
        }}>
          <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 10, height: 10, background: '#1B4332' }} />
          <div style={{ fontSize: 12, fontWeight: 800 }}>{el.name}</div>
          <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}><Users size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {seats} seats · {st.label}</div>
          {el.guest && <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>{el.guest}</div>}
          {el.timer && <div style={{ fontSize: 9, opacity: 0.6, marginTop: 1 }}>{el.timer}</div>}
        </div>
      )}

      {/* Table body */}
      <div
        style={{
          width: w, height: h, borderRadius: radius, position: 'relative',
          background: st.bg,
          border: status === 'dirty' ? `2px dashed ${st.border}` : `2px solid ${st.border}`,
          boxShadow: isSelected ? `0 0 0 3px ${st.border}30, 0 6px 20px rgba(0,0,0,.1)` : isDragging ? '0 8px 30px rgba(0,0,0,.15)' : '0 1px 6px rgba(0,0,0,.04)',
          cursor: locked ? 'pointer' : isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'none' : 'all 0.2s',
          transform: `${hovered && !isDragging ? 'scale(1.03)' : isDragging ? 'scale(1.06)' : ''} rotate(${el.rotation || 0}deg)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none', fontFamily: "'Figtree', sans-serif",
        }}
        onClick={onClick} onMouseDown={onMouseDown} onTouchStart={onTouchStart}
      >
        {el.vip && (
          <div style={{ position: 'absolute', top: -7, right: -7, background: '#F59E0B', color: '#fff', fontSize: 7 * scale, fontWeight: 800, padding: '1px 5px', borderRadius: 5, boxShadow: '0 2px 6px rgba(245,158,11,.4)' }}>VIP</div>
        )}
        {!locked && <div style={{ position: 'absolute', top: 2, right: 3, opacity: 0.25 }}><GripVertical size={10} /></div>}

        <span style={{ fontSize: 12 * scale, fontWeight: 800, color: st.text }}>{el.name}</span>

        {status === 'seated' && el.timer ? (
          <span style={{ fontSize: 9 * scale, fontWeight: 700, color: st.text, marginTop: 1, opacity: 0.8 }}>{el.timer}</span>
        ) : status === 'reserved' && el.nextTime ? (
          <span style={{ fontSize: 9 * scale, fontWeight: 600, color: st.border, marginTop: 1 }}>{el.nextTime}</span>
        ) : status === 'dirty' ? (
          <span style={{ fontSize: 8 * scale, fontWeight: 800, color: st.text, marginTop: 1, textTransform: 'uppercase' }}>DIRTY</span>
        ) : (
          <span style={{ fontSize: 9 * scale, fontWeight: 600, color: '#9CA3AF', marginTop: 1 }}>{seats}p</span>
        )}

        {seatDots}
      </div>
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

/* ═══════════════ PALETTE ITEM (draggable from sidebar) ═══════════════ */
const PaletteItem = ({ label, Icon, color, onAdd }) => (
  <button onClick={onAdd}
    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold hover:bg-gray-100 transition-all w-full text-left text-gray-700 border border-transparent hover:border-gray-200">
    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
      <Icon size={14} color={color} strokeWidth={2} />
    </div>
    {label}
  </button>
)

/* ═══════════════ MAIN COMPONENT ═══════════════ */

const FloorPlan = ({ embedded = false }) => {
  const { business, businessType } = useBusiness()
  const bid = business?.id ?? business?._id
  const isFood = businessType === 'food' || businessType === 'restaurant'

  const [floors, setFloors] = useState([])
  const [activeFloor, setActiveFloor] = useState('all')
  const [locked, setLocked] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [toast, setToast] = useState(null)

  // Drag state
  const [dragging, setDragging] = useState(null) // { floorId, elementId }
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 })
  const canvasRef = useRef(null)

  // Selection + edit modal
  const [selected, setSelected] = useState(null) // { floorId, elementId }
  const [editEl, setEditEl] = useState(null)

  // Palette state
  const [paletteOpen, setPaletteOpen] = useState(true)
  const [tablesOpen, setTablesOpen] = useState(true)
  const [fixturesOpen, setFixturesOpen] = useState(true)

  const savedRef = useRef(null)
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  /* ── Load from API ── */
  useEffect(() => {
    if (!bid) { setLoading(false); return }
    setLoading(true)
    api.get(`/tables/business/${bid}/floor-plan`)
      .then(data => {
        const f = data.floors || []
        if (f.length === 0) {
          // First time: create a default Main Floor
          setFloors([{ id: 'main', name: 'Main Floor', elements: [] }])
          setActiveFloor('main')
        } else {
          setFloors(f)
          setActiveFloor(f[0]?.id || 'all')
        }
        savedRef.current = JSON.stringify(f)
      })
      .catch(() => {
        setFloors([{ id: 'main', name: 'Main Floor', elements: [] }])
        setActiveFloor('main')
        savedRef.current = '[]'
      })
      .finally(() => setLoading(false))
  }, [bid])

  // Track changes
  useEffect(() => {
    if (savedRef.current === null) return
    setHasChanges(JSON.stringify(floors) !== savedRef.current)
  }, [floors])

  /* ── Save to API ── */
  const saveLayout = async () => {
    setSaving(true)
    try {
      if (bid) {
        await api.put(`/tables/business/${bid}/floor-plan`, { floors, width: 1000, height: 800 })
      }
      savedRef.current = JSON.stringify(floors)
      setHasChanges(false)
      setLocked(true)
      showToast('Layout saved')
    } catch (err) {
      showToast('Save failed — try again')
    }
    setSaving(false)
  }

  /* ── Helper: update element in a floor ── */
  const updateElement = useCallback((floorId, elId, updates) => {
    setFloors(prev => prev.map(f => f.id === floorId
      ? { ...f, elements: f.elements.map(e => e.id === elId ? { ...e, ...updates } : e) }
      : f
    ))
  }, [])

  const deleteElement = useCallback((floorId, elId) => {
    setFloors(prev => prev.map(f => f.id === floorId
      ? { ...f, elements: f.elements.filter(e => e.id !== elId) }
      : f
    ))
    if (selected?.elementId === elId) setSelected(null)
    if (editEl?.id === elId) setEditEl(null)
  }, [selected, editEl])

  /* ── Add element ── */
  const addElement = useCallback((type, kind, extra = {}) => {
    const floorId = activeFloor === 'all' ? (floors[0]?.id || 'main') : activeFloor
    const floor = floors.find(f => f.id === floorId)
    if (!floor) return

    const tableCount = floors.reduce((n, f) => n + f.elements.filter(e => e.type === 'table').length, 0)
    const id = `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

    let el
    if (type === 'table') {
      el = {
        id, type: 'table', shape: kind, name: `T-${String(tableCount + 1).padStart(2, '0')}`,
        seats: extra.seats || 4, x: 80 + Math.random() * 300, y: 60 + Math.random() * 250,
        status: 'available', rotation: 0, vip: false, ...extra,
      }
    } else {
      const ft = FIXTURE_TYPES.find(f => f.id === kind) || FIXTURE_TYPES[0]
      el = {
        id, type: 'fixture', kind, name: ft.label,
        w: ft.w, h: ft.h, x: 60 + Math.random() * 300, y: 60 + Math.random() * 200,
        rotation: 0, ...extra,
      }
    }

    setFloors(prev => prev.map(f => f.id === floorId ? { ...f, elements: [...f.elements, el] } : f))
    showToast(`${el.name} added`)
  }, [activeFloor, floors])

  /* ── Add / remove floor ── */
  const addFloor = (preset) => {
    if (floors.find(f => f.id === preset.id)) { showToast(`${preset.label} already exists`); return }
    setFloors(prev => [...prev, { id: preset.id, name: preset.label, elements: [] }])
    setActiveFloor(preset.id)
    showToast(`${preset.label} added`)
  }

  const removeFloor = (floorId) => {
    if (floors.length <= 1) { showToast("Can't remove the last floor"); return }
    setFloors(prev => prev.filter(f => f.id !== floorId))
    if (activeFloor === floorId) setActiveFloor(floors[0]?.id === floorId ? floors[1]?.id : floors[0]?.id)
    showToast('Floor removed')
  }

  /* ── Mouse Drag ── */
  const handleMouseDown = useCallback((e, floorId, elId) => {
    if (locked) return
    e.preventDefault(); e.stopPropagation()
    const floor = floors.find(f => f.id === floorId)
    const el = floor?.elements.find(e => e.id === elId)
    if (!el) return
    const rect = canvasRef.current?.getBoundingClientRect()
    setDragging({ floorId, elementId: elId })
    setDragOff({ x: e.clientX - (rect?.left || 0) - el.x, y: e.clientY - (rect?.top || 0) - el.y })
  }, [locked, floors])

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return
    const nx = Math.max(0, Math.min(rect.width - 40, e.clientX - rect.left - dragOff.x))
    const ny = Math.max(0, Math.min(rect.height - 40, e.clientY - rect.top - dragOff.y))
    updateElement(dragging.floorId, dragging.elementId, { x: Math.round(nx), y: Math.round(ny) })
  }, [dragging, dragOff, updateElement])

  const handleMouseUp = useCallback(() => setDragging(null), [])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  /* ── Touch Drag ── */
  const handleTouchStart = useCallback((e, floorId, elId) => {
    if (locked) return
    const floor = floors.find(f => f.id === floorId)
    const el = floor?.elements.find(e => e.id === elId)
    if (!el) return
    const touch = e.touches[0]; const rect = canvasRef.current?.getBoundingClientRect()
    setDragging({ floorId, elementId: elId })
    setDragOff({ x: touch.clientX - (rect?.left || 0) - el.x, y: touch.clientY - (rect?.top || 0) - el.y })
  }, [locked, floors])

  const handleTouchMove = useCallback((e) => {
    if (!dragging) return; e.preventDefault()
    const touch = e.touches[0]; const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return
    const nx = Math.max(0, Math.min(rect.width - 40, touch.clientX - rect.left - dragOff.x))
    const ny = Math.max(0, Math.min(rect.height - 40, touch.clientY - rect.top - dragOff.y))
    updateElement(dragging.floorId, dragging.elementId, { x: Math.round(nx), y: Math.round(ny) })
  }, [dragging, dragOff, updateElement])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleMouseUp)
      return () => { window.removeEventListener('touchmove', handleTouchMove); window.removeEventListener('touchend', handleMouseUp) }
    }
  }, [dragging, handleTouchMove, handleMouseUp])

  /* ── Stats (tables only) ── */
  const allTables = useMemo(() => floors.flatMap(f => f.elements.filter(e => e.type === 'table')), [floors])
  const stats = useMemo(() => {
    const t = activeFloor === 'all' ? allTables : (floors.find(f => f.id === activeFloor)?.elements.filter(e => e.type === 'table') || [])
    return {
      total: t.length,
      seats: t.reduce((n, e) => n + (e.seats || 0), 0),
      available: t.filter(e => e.status === 'available').length,
      seated: t.filter(e => ['seated', 'mains', 'dessert'].includes(e.status)).length,
      reserved: t.filter(e => ['reserved', 'confirmed'].includes(e.status)).length,
      dirty: t.filter(e => e.status === 'dirty').length,
    }
  }, [floors, activeFloor, allTables])

  const occupancy = stats.total > 0 ? Math.round((stats.seated / stats.total) * 100) : 0

  /* ── Render a single floor canvas ── */
  const renderFloor = (floor, scale = 1, overview = false) => {
    const elements = floor.elements || []
    return elements.map(el => {
      if (el.type === 'fixture') {
        return <FixtureNode key={el.id} el={el} locked={locked || overview} isSelected={selected?.elementId === el.id} isDragging={dragging?.elementId === el.id} scale={scale}
          onMouseDown={e => handleMouseDown(e, floor.id, el.id)} onTouchStart={e => handleTouchStart(e, floor.id, el.id)}
          onClick={() => !overview && setSelected({ floorId: floor.id, elementId: el.id })}
          onDelete={() => deleteElement(floor.id, el.id)}
          onRotate={() => updateElement(floor.id, el.id, { rotation: ((el.rotation || 0) + 90) % 360 })} />
      }
      return <TableNode key={el.id} el={el} locked={locked || overview} isSelected={selected?.elementId === el.id} isDragging={dragging?.elementId === el.id} scale={scale}
        onMouseDown={e => handleMouseDown(e, floor.id, el.id)} onTouchStart={e => handleTouchStart(e, floor.id, el.id)}
        onClick={() => !overview && (locked ? setSelected(s => s?.elementId === el.id ? null : { floorId: floor.id, elementId: el.id }) : setSelected({ floorId: floor.id, elementId: el.id }))}
        onDelete={() => deleteElement(floor.id, el.id)}
        onEdit={() => setEditEl({ ...el, _floorId: floor.id })}
        onRotate={() => updateElement(floor.id, el.id, { rotation: ((el.rotation || 0) + 90) % 360 })} />
    })
  }

  if (loading) return <RezvoLoader message="Loading floor plan..." />
  if (!isFood) return <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm"><h2 className="font-bold text-xl text-gray-900 mb-2">Floor Plan</h2><p className="text-gray-500">Floor plans are available for restaurant businesses.</p></div>

  return (
    <div className="flex flex-col overflow-hidden bg-white h-full" style={{ fontFamily: "'Figtree', sans-serif" }}>
      <style>{`
        @keyframes fpPopIn { from { opacity:0; transform:scale(.7) translateY(4px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes fpPulse { 0%,100% { box-shadow:0 4px 14px rgba(27,67,50,.3); } 50% { box-shadow:0 4px 20px rgba(27,67,50,.5); } }
      `}</style>

      {/* ═══ TOP BAR ═══ */}
      {!embedded && (
        <div className="border-b border-gray-100 px-5 py-3 shrink-0">
          {/* Row 1: Stats + Controls */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <StatPill label="Tables" value={stats.total} color="#1B4332" />
              <StatPill label="Seats" value={stats.seats} color="#6B7280" />
              <StatPill label="Seated" value={stats.seated} color="#059669" />
              <StatPill label="Available" value={stats.available} color="#9CA3AF" />
              {stats.reserved > 0 && <StatPill label="Reserved" value={stats.reserved} color="#D4A373" />}
              {stats.dirty > 0 && <StatPill label="Dirty" value={stats.dirty} color="#EF4444" />}
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs" style={{ background: occupancy > 50 ? '#ECFDF5' : '#F7F7F5', color: occupancy > 50 ? '#059669' : '#6B7280' }}>{occupancy}%</div>
                <span className="text-[10px] font-medium text-gray-400">occupancy</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => {
                  if (!locked && hasChanges) saveLayout()
                  else if (!locked) { setLocked(true); showToast('Locked') }
                  else setLocked(false)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                style={{ background: locked ? '#F3F4F6' : '#1B4332', color: locked ? '#374151' : '#fff', boxShadow: locked ? 'none' : '0 4px 14px rgba(27,67,50,.3)' }}>
                {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                {locked ? 'Locked' : 'Editing'}
              </button>
              {hasChanges && (
                <button onClick={saveLayout} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: saving ? '#9CA3AF' : '#1B4332', animation: saving ? 'none' : 'fpPulse 2s ease-in-out infinite' }}>
                  {saving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Floor Tabs */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {/* All Zones */}
            <button onClick={() => setActiveFloor('all')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0"
              style={{ background: activeFloor === 'all' ? '#1B433212' : 'transparent', color: activeFloor === 'all' ? '#1B4332' : '#6B7280', border: activeFloor === 'all' ? '1.5px solid #1B433230' : '1.5px solid transparent' }}>
              <Eye size={14} /> All Zones
              <span className="ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ background: activeFloor === 'all' ? '#1B433218' : '#F3F4F6', color: activeFloor === 'all' ? '#1B4332' : '#9CA3AF' }}>{allTables.length}</span>
            </button>

            <div className="w-px h-5 bg-gray-200 shrink-0" />

            {/* Individual floors */}
            {floors.map(floor => {
              const preset = FLOOR_PRESETS.find(p => p.id === floor.id)
              const FIcon = preset?.Icon || Home
              const color = preset?.color || '#6B7280'
              const isActive = activeFloor === floor.id
              const tableCount = floor.elements.filter(e => e.type === 'table').length
              return (
                <button key={floor.id} onClick={() => setActiveFloor(floor.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0"
                  style={{ background: isActive ? `${color}12` : 'transparent', color: isActive ? color : '#6B7280', border: isActive ? `1.5px solid ${color}30` : '1.5px solid transparent' }}>
                  <FIcon size={14} /> {floor.name}
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ background: isActive ? `${color}18` : '#F3F4F6', color: isActive ? color : '#9CA3AF' }}>{tableCount}</span>
                  {!locked && floors.length > 1 && (
                    <span onClick={e => { e.stopPropagation(); removeFloor(floor.id) }} className="ml-1 opacity-40 hover:opacity-100 cursor-pointer"><X size={12} /></span>
                  )}
                </button>
              )
            })}

            {/* Add floor */}
            {!locked && (
              <div className="relative group shrink-0">
                <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                  <Plus size={14} /> Floor
                </button>
                <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 min-w-[160px]">
                  {FLOOR_PRESETS.filter(p => !floors.find(f => f.id === p.id)).map(preset => (
                    <button key={preset.id} onClick={() => addFloor(preset)}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 w-full text-left">
                      <preset.Icon size={14} color={preset.color} /> {preset.label}
                    </button>
                  ))}
                  {FLOOR_PRESETS.filter(p => !floors.find(f => f.id === p.id)).length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-400">All floors added</div>
                  )}
                </div>
              </div>
            )}
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

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Edit Palette (left sidebar, edit mode only) ── */}
        {!locked && !embedded && (
          <div className="w-[200px] bg-white border-r border-gray-100 overflow-y-auto shrink-0 p-3" style={{ scrollbarWidth: 'thin' }}>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Add Elements</div>

            {/* Tables section */}
            <button onClick={() => setTablesOpen(!tablesOpen)} className="flex items-center justify-between w-full px-1 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900">
              <span className="flex items-center gap-1.5"><Armchair size={13} /> Tables</span>
              {tablesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            {tablesOpen && (
              <div className="space-y-0.5 mb-3">
                {TABLE_SHAPES.map(s => (
                  <PaletteItem key={s.id} label={`${s.label} Table`} Icon={s.Icon} color="#1B4332" onAdd={() => addElement('table', s.id)} />
                ))}
              </div>
            )}

            {/* Fixtures section */}
            <button onClick={() => setFixturesOpen(!fixturesOpen)} className="flex items-center justify-between w-full px-1 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900">
              <span className="flex items-center gap-1.5"><LayoutGrid size={13} /> Fixtures</span>
              {fixturesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            {fixturesOpen && (
              <div className="space-y-0.5">
                {FIXTURE_TYPES.map(f => (
                  <PaletteItem key={f.id} label={f.label} Icon={f.Icon} color={f.borderColor} onAdd={() => addElement('fixture', f.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Canvas ── */}
        <div className="flex-1 overflow-auto" style={{ background: '#FAFAF8' }}>

          {/* ALL ZONES VIEW */}
          {activeFloor === 'all' ? (
            <div className="p-6 space-y-4" style={{ minWidth: 600 }}>
              {floors.map((floor, fi) => {
                const preset = FLOOR_PRESETS.find(p => p.id === floor.id)
                const color = preset?.color || '#6B7280'
                const elements = floor.elements || []
                if (elements.length === 0) return null
                // Calculate bounding box for auto-scaling
                const maxX = Math.max(200, ...elements.map(e => (e.x || 0) + (e.w || 120)))
                const maxY = Math.max(150, ...elements.map(e => (e.y || 0) + (e.h || 120)))
                const containerW = 800 // target width
                const scale = Math.min(1, containerW / (maxX + 60), 400 / (maxY + 60))

                return (
                  <div key={floor.id}>
                    {fi > 0 && <div className="border-t border-dashed border-gray-200 my-2" />}
                    <div className="flex items-center gap-2 mb-2">
                      {preset?.Icon && <preset.Icon size={16} color={color} />}
                      <span className="text-sm font-extrabold" style={{ color }}>{floor.name}</span>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{floor.elements.filter(e => e.type === 'table').length} tables</span>
                      <button onClick={() => setActiveFloor(floor.id)} className="ml-auto text-[10px] font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        <Eye size={12} /> View full
                      </button>
                    </div>
                    <div className="relative rounded-xl border border-gray-200 bg-white overflow-hidden" style={{ height: Math.max(120, (maxY + 40) * scale), minHeight: 120 }}>
                      <div className="relative w-full h-full"
                        style={{ backgroundImage: 'radial-gradient(circle, #E5E5E0 0.5px, transparent 0.5px)', backgroundSize: '16px 16px' }}>
                        {renderFloor(floor, scale, true)}
                      </div>
                    </div>
                  </div>
                )
              })}
              {floors.every(f => f.elements.length === 0) && (
                <div className="text-center py-20 text-gray-400">
                  <LayoutGrid size={48} strokeWidth={1} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-bold">No elements yet</p>
                  <p className="text-xs mt-1">Unlock and start adding tables and fixtures</p>
                </div>
              )}
            </div>
          ) : (
            /* SINGLE FLOOR VIEW */
            <div ref={canvasRef} className="relative"
              style={{
                minWidth: 700, minHeight: 500, height: '100%',
                backgroundImage: locked ? 'radial-gradient(circle, #E5E5E0 0.8px, transparent 0.8px)' : 'radial-gradient(circle, #93C5FD 0.8px, transparent 0.8px)',
                backgroundSize: '24px 24px', transition: 'background-image 0.3s', padding: 20,
              }}
              onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>

              {/* Floor watermark */}
              {(() => {
                const floor = floors.find(f => f.id === activeFloor)
                const preset = FLOOR_PRESETS.find(p => p.id === activeFloor)
                if (!preset) return null
                return (
                  <div style={{ position: 'absolute', right: 30, bottom: 20, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.06, pointerEvents: 'none' }}>
                    <preset.Icon size={48} strokeWidth={1.2} color={preset.color} />
                    <span style={{ fontSize: 36, fontWeight: 900, color: preset.color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{floor?.name}</span>
                  </div>
                )
              })()}

              {/* Edit mode banner */}
              {!locked && (
                <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: '#1B4332', color: '#fff', fontSize: 11, fontWeight: 700, padding: '6px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 20px rgba(27,67,50,.3)' }}>
                  <Move size={13} /> Drag elements to position · Click to select
                </div>
              )}

              {/* Empty state */}
              {(() => {
                const floor = floors.find(f => f.id === activeFloor)
                if (!floor || floor.elements.length > 0) return null
                return (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                    <LayoutGrid size={48} strokeWidth={1} className="mb-3 opacity-30" />
                    <p className="text-sm font-bold">Empty floor</p>
                    <p className="text-xs mt-1 text-gray-300">
                      {locked ? 'Unlock to start adding tables and fixtures' : 'Use the palette on the left to add elements'}
                    </p>
                  </div>
                )
              })()}

              {/* Render elements */}
              {(() => {
                const floor = floors.find(f => f.id === activeFloor)
                return floor ? renderFloor(floor) : null
              })()}
            </div>
          )}
        </div>

        {/* ── Today's Bookings Sidebar (locked mode) ── */}
        {locked && !embedded && (
          <div className="w-[260px] bg-white border-l border-gray-100 flex flex-col overflow-hidden shrink-0 hidden lg:flex">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="font-extrabold text-sm text-gray-900">Today's Bookings</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="text-gray-300" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <p className="text-sm font-bold text-gray-400">No bookings yet</p>
                <p className="text-[11px] text-gray-300 mt-1">Bookings will appear here</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ EDIT TABLE MODAL ═══ */}
      {editEl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setEditEl(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()} style={{ fontFamily: "'Figtree', sans-serif" }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-extrabold text-lg text-gray-900">Edit {editEl.name}</h3>
              <button onClick={() => setEditEl(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Name</label>
                <input type="text" value={editEl.name} onChange={e => { const v = e.target.value; setEditEl(p => ({ ...p, name: v })); updateElement(editEl._floorId, editEl.id, { name: v }) }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>

              {/* Shape */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Shape</label>
                <div className="flex gap-2">
                  {TABLE_SHAPES.map(s => { const SIcon = s.Icon; return (
                    <button key={s.id} onClick={() => { setEditEl(p => ({ ...p, shape: s.id })); updateElement(editEl._floorId, editEl.id, { shape: s.id }) }}
                      className={`flex-1 py-2.5 rounded-xl text-center text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${editEl.shape === s.id ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      <SIcon size={15} /> {s.label}
                    </button>
                  )})}
                </div>
              </div>

              {/* Seats */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Seats</label>
                <div className="flex gap-2">
                  {SEAT_OPTIONS.map(n => (
                    <button key={n} onClick={() => { setEditEl(p => ({ ...p, seats: n })); updateElement(editEl._floorId, editEl.id, { seats: n }) }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${editEl.seats === n ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{n}</button>
                  ))}
                </div>
              </div>

              {/* Move to floor */}
              {floors.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Floor</label>
                  <div className="flex gap-2 flex-wrap">
                    {floors.map(f => {
                      const preset = FLOOR_PRESETS.find(p => p.id === f.id)
                      const isOn = editEl._floorId === f.id
                      return (
                        <button key={f.id} onClick={() => {
                          if (isOn) return
                          // Move element to another floor
                          setFloors(prev => prev.map(fl => {
                            if (fl.id === editEl._floorId) return { ...fl, elements: fl.elements.filter(e => e.id !== editEl.id) }
                            if (fl.id === f.id) return { ...fl, elements: [...fl.elements, { ...editEl, _floorId: undefined }] }
                            return fl
                          }))
                          setEditEl(p => ({ ...p, _floorId: f.id }))
                        }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${isOn ? 'text-white shadow-md' : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                          style={isOn ? { background: preset?.color || '#6B7280', borderColor: preset?.color || '#6B7280' } : {}}>
                          {f.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Rotation */}
              {(editEl.shape === 'long' || editEl.shape === 'booth') && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Rotation</label>
                  <div className="flex gap-2">
                    {[0, 90, 180, 270].map(deg => (
                      <button key={deg} onClick={() => { setEditEl(p => ({ ...p, rotation: deg })); updateElement(editEl._floorId, editEl.id, { rotation: deg }) }}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${(editEl.rotation || 0) === deg ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        <RotateCw size={14} style={{ transform: `rotate(${deg}deg)` }} /> {deg}°
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Status</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(STATUS).map(([key, val]) => (
                    <button key={key} onClick={() => { setEditEl(p => ({ ...p, status: key })); updateElement(editEl._floorId, editEl.id, { status: key }) }}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${editEl.status === key ? 'shadow-md' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                      style={editEl.status === key ? { background: val.bg, color: val.text, borderColor: val.border } : { color: '#9CA3AF' }}>{val.label}</button>
                  ))}
                </div>
              </div>

              {/* VIP toggle */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">VIP</label>
                <button onClick={() => { const v = !editEl.vip; setEditEl(p => ({ ...p, vip: v })); updateElement(editEl._floorId, editEl.id, { vip: v }) }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${editEl.vip ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                  {editEl.vip ? 'VIP ★' : 'Standard'}
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => { deleteElement(editEl._floorId, editEl.id); setEditEl(null) }} className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              <div className="flex-1" />
              <button onClick={() => setEditEl(null)} className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-[#2D6A4F] shadow-lg shadow-primary/20">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: '#1B4332', color: '#fff', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700, boxShadow: '0 8px 30px rgba(27,67,50,.3)', fontFamily: "'Figtree', sans-serif" }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}

export default FloorPlan
