/**
 * Floor Plan — Full drag-drop venue layout editor + live status view
 * Floors: Main Floor, Upstairs, Terrace, Outside, Basement (physical areas — tabs)
 * Elements: Tables (round, square, long, booth) + Fixtures (window, bar, stairs, toilets, kitchen, wall)
 * Lock/unlock toggle, add/remove elements, floor tabs, proper spacing
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Lock, Unlock, Plus, Trash2, X, Settings, GripVertical,
  LayoutGrid, Copy, Move, Save, Check, RotateCw,
  Circle, Square, RectangleHorizontal, Sofa,
  Home, UtensilsCrossed, Wine, Sun, ArrowUp, TreePine, ArrowDown,
  Users, Clock, PanelTop, Bath, CookingPot, Minus, Eye,
  Sparkles, AlertTriangle, Wand2
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

/* Floors = physical areas you toggle between (tabs) */
const FLOORS = [
  { id: 'all',       label: 'All Zones',   Icon: Eye,               color: '#1B4332' },
  { id: 'main',      label: 'Main Floor',  Icon: Home,              color: '#1B4332' },
  { id: 'upstairs',  label: 'Upstairs',    Icon: ArrowUp,           color: '#7C3AED' },
  { id: 'terrace',   label: 'Terrace',     Icon: Sun,               color: '#059669' },
  { id: 'outside',   label: 'Outside',     Icon: TreePine,          color: '#0891B2' },
  { id: 'basement',  label: 'Basement',    Icon: ArrowDown,         color: '#78716C' },
]

/* Table shapes (unchanged) */
const TABLE_SHAPES = [
  { id: 'round',   label: 'Round',   Icon: Circle },
  { id: 'square',  label: 'Square',  Icon: Square },
  { id: 'long',    label: 'Long',    Icon: RectangleHorizontal },
  { id: 'booth',   label: 'Booth',   Icon: Sofa },
]

const SEAT_OPTIONS = [2, 4, 6, 8, 10, 12]

/* Fixture types = droppable objects placed ON a floor */
const FIXTURE_TYPES = [
  { id: 'window',  label: 'Window',  Icon: PanelTop,    w: 100, h: 16,  bg: '#DBEAFE', border: '#60A5FA' },
  { id: 'bar',     label: 'Bar',     Icon: Wine,        w: 160, h: 36,  bg: '#FDE68A', border: '#D97706' },
  { id: 'stairs',  label: 'Stairs',  Icon: ArrowUp,     w: 60,  h: 50,  bg: '#E5E7EB', border: '#9CA3AF' },
  { id: 'toilets', label: 'Toilets', Icon: Bath,        w: 60,  h: 50,  bg: '#E0E7FF', border: '#818CF8' },
  { id: 'kitchen', label: 'Kitchen', Icon: CookingPot,  w: 120, h: 70,  bg: '#FEE2E2', border: '#F87171' },
  { id: 'wall',    label: 'Wall',    Icon: Minus,       w: 120, h: 8,   bg: '#374151', border: '#1F2937' },
]

/* Demo elements — tables + fixtures on the main floor */
const DEFAULT_ELEMENTS = [
  // Main Floor — Tables
  { id: 't1',  type: 'table', name: 'T-01', seats: 4, zone: 'main', shape: 'round',  x: 200, y: 80,  status: 'seated',   timer: '45m', vip: false },
  { id: 't2',  type: 'table', name: 'T-02', seats: 4, zone: 'main', shape: 'square', x: 390, y: 80,  status: 'reserved', nextTime: '6:30 PM', guest: 'Smith (4)' },
  { id: 't3',  type: 'table', name: 'T-03', seats: 2, zone: 'main', shape: 'square', x: 560, y: 80,  status: 'available' },
  { id: 't4',  type: 'table', name: 'T-04', seats: 6, zone: 'main', shape: 'round',  x: 200, y: 260, status: 'seated',   timer: '12m', vip: true },
  { id: 't5',  type: 'table', name: 'T-05', seats: 4, zone: 'main', shape: 'round',  x: 390, y: 260, status: 'dirty' },
  { id: 't6',  type: 'table', name: 'T-06', seats: 8, zone: 'main', shape: 'long',   x: 520, y: 260, status: 'mains', guest: 'Williams' },
  // Main Floor — Fixtures
  { id: 'f1', type: 'fixture', fixtureKind: 'window',  name: 'Window',  zone: 'main', x: 20,  y: 20,  rotation: 0 },
  { id: 'f2', type: 'fixture', fixtureKind: 'window',  name: 'Window',  zone: 'main', x: 20,  y: 160, rotation: 0 },
  { id: 'f3', type: 'fixture', fixtureKind: 'bar',     name: 'Bar',     zone: 'main', x: 20,  y: 340, rotation: 0 },
  { id: 'f4', type: 'fixture', fixtureKind: 'stairs',  name: 'Stairs',  zone: 'main', x: 680, y: 20,  rotation: 0 },
  { id: 'f5', type: 'fixture', fixtureKind: 'toilets', name: 'Toilets', zone: 'main', x: 680, y: 340, rotation: 0 },
  { id: 'f6', type: 'fixture', fixtureKind: 'kitchen', name: 'Kitchen', zone: 'main', x: 680, y: 160, rotation: 0 },
  // Terrace
  { id: 't7',  type: 'table', name: 'T-07', seats: 4, zone: 'terrace', shape: 'round',  x: 60,  y: 50,  status: 'available' },
  { id: 't8',  type: 'table', name: 'T-08', seats: 6, zone: 'terrace', shape: 'long',   x: 250, y: 50,  status: 'seated', timer: '35m', guest: 'Park' },
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

/* ═══════════════ TABLE NODE (unchanged styling) ═══════════════ */

const TableNode = ({ table, status, isSelected, locked, isDragging, onMouseDown, onTouchStart, onClick, onEdit, onDelete, onRotate, scale = 1, hasIssue = false }) => {
  const [hovered, setHovered] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const st = STATUS[status] || STATUS.available
  const seats = table.seats || 4
  const rawBase = seats <= 2 ? 85 : seats <= 4 ? 100 : seats <= 6 ? 120 : seats <= 8 ? 140 : 155
  const baseSize = rawBase * scale

  const getDims = () => {
    switch (table.shape) {
      case 'square': return { w: baseSize, h: baseSize, radius: 14 * scale }
      case 'long':   return { w: baseSize * 1.7, h: baseSize * 0.65, radius: 14 * scale }
      case 'booth':  return { w: baseSize * 1.4, h: baseSize * 0.8, radius: 20 * scale }
      default:       return { w: baseSize, h: baseSize, radius: '50%' }
    }
  }
  const { w, h, radius } = getDims()
  const isDirty = status === 'dirty'
  const floor = FLOORS.find(z => z.id === table.zone)

  return (
    <div
      style={{ position: 'absolute', left: table.x * scale, top: table.y * scale, zIndex: isDragging ? 200 : hovered ? 150 : isSelected ? 20 : 1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false) }}
    >
      {/* ── Delete X button (unlocked mode, on hover) ── */}
      {!locked && hovered && !isDragging && (
        <div style={{
          position: 'absolute', top: -10, right: -10, zIndex: 40,
          animation: 'fpPopIn 150ms cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={(e) => { e.stopPropagation(); onDelete?.() }} style={{
                width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(239,68,68,.4)', transition: 'transform 0.15s',
              }} title="Confirm delete">
                <Check size={12} strokeWidth={3} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }} style={{
                width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: '#fff', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,.1)', border: '1px solid #E5E7EB',
              }} title="Cancel">
                <X size={12} strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }} style={{
              width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(239,68,68,.35)', transition: 'transform 0.15s',
            }} title="Delete table">
              <X size={12} strokeWidth={3} />
            </button>
          )}
        </div>
      )}

      {/* ── Edit + Rotate (unlocked, on hover) ── */}
      {!locked && hovered && !isDragging && !confirmDelete && (
        <div style={{
          position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)', zIndex: 40,
          display: 'flex', gap: 4,
          animation: 'fpPopIn 150ms cubic-bezier(0.34,1.56,0.64,1) 50ms forwards', opacity: 0,
        }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit?.() }} style={{
            width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E7EB', cursor: 'pointer',
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,.1)',
          }} title="Edit table">
            <Settings size={13} color="#6B7280" />
          </button>
          {(table.shape === 'long' || table.shape === 'booth') && (
            <button onClick={(e) => { e.stopPropagation(); onRotate?.() }} style={{
              width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E7EB', cursor: 'pointer',
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,.1)',
            }} title="Rotate 90°">
              <RotateCw size={13} color="#6B7280" />
            </button>
          )}
        </div>
      )}

      {/* ── Hover popup tooltip ── */}
      {locked && hovered && !isDragging && (
        <div style={{
          position: 'absolute', bottom: h + 16, left: '50%', transform: 'translateX(-50%)',
          background: '#1B4332', color: '#FAF7F2', borderRadius: 12, padding: '10px 14px',
          minWidth: 160, zIndex: 50, pointerEvents: 'none',
          boxShadow: '0 8px 30px rgba(27,67,50,0.3)',
          animation: 'fpPopIn 200ms cubic-bezier(0.34,1.56,0.64,1) forwards',
          fontFamily: "'Figtree', sans-serif",
        }}>
          {/* Arrow */}
          <div style={{
            position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
            width: 12, height: 12, background: '#1B4332',
          }} />
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{table.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, opacity: 0.8, marginBottom: 3 }}>
            <Users size={11} /> {seats} seats
            {floor && <><span style={{ opacity: 0.4 }}>·</span> {floor.label}</>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
            <span style={{ fontWeight: 700 }}>{st.label}</span>
            {table.timer && <span style={{ opacity: 0.6 }}>· {table.timer}</span>}
            {table.nextTime && <span style={{ opacity: 0.6 }}>· {table.nextTime}</span>}
          </div>
          {table.guest && (
            <div style={{ fontSize: 10, marginTop: 3, opacity: 0.6 }}>{table.guest}</div>
          )}
        </div>
      )}

      {/* ── Table body ── */}
      <div
        style={{
          width: w, height: h, borderRadius: radius,
          background: st.bg,
          border: isDirty ? `2.5px dashed ${st.border}` : `2.5px solid ${st.border}`,
          boxShadow: hasIssue ? `0 0 0 3px #EF444480, 0 0 12px rgba(239,68,68,0.3)`
            : isSelected ? `0 0 0 3px ${st.border}30, 0 8px 30px rgba(0,0,0,.12)`
            : hovered ? `0 0 0 2px ${st.border}20, 0 8px 24px rgba(0,0,0,.1)`
            : isDragging ? '0 12px 40px rgba(0,0,0,.2)' : '0 2px 12px rgba(0,0,0,.04)',
          cursor: locked ? 'pointer' : isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'box-shadow 0.15s' : 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
          transform: `${isSelected ? 'scale(1.05)' : hovered ? 'scale(1.03)' : isDragging ? 'scale(1.08)' : 'scale(1)'} rotate(${table.rotation || 0}deg)`,
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

        <span style={{ fontSize: 14 * scale, fontWeight: 800, color: st.text, letterSpacing: '-0.02em' }}>{table.name}</span>

        {status === 'seated' && table.timer ? (
          <>
            <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
              {Array.from({ length: Math.min(seats, 6) }).map((_, i) => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: st.text }} />
              ))}
            </div>
            <span style={{ fontSize: 10 * scale, fontWeight: 700, color: st.text, marginTop: 2, opacity: 0.8 }}>{table.timer}</span>
          </>
        ) : status === 'reserved' && table.nextTime ? (
          <>
            <span style={{ fontSize: 11 * scale, fontWeight: 600, color: st.border, marginTop: 2 }}>{table.nextTime}</span>
            {table.guest && <span style={{ fontSize: 9 * scale, color: st.text, opacity: 0.7 }}>{table.guest}</span>}
          </>
        ) : status === 'dirty' ? (
          <span style={{ fontSize: 10 * scale, fontWeight: 800, color: st.text, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>DIRTY</span>
        ) : status === 'mains' ? (
          <span style={{ fontSize: 10 * scale, fontWeight: 700, color: st.text, marginTop: 2 }}>{table.guest || 'Mains'}</span>
        ) : (
          <span style={{ fontSize: 10 * scale, fontWeight: 600, color: '#9CA3AF', marginTop: 2 }}>Available</span>
        )}

        <SeatDots seats={seats} w={w} h={h} color={st.dot} active={status !== 'available' && status !== 'dirty'} />
      </div>
    </div>
  )
}

/* ═══════════════ FIXTURE NODE (new — styled element on canvas) ═══════════════ */

const FixtureNode = ({ item, locked, isDragging, onMouseDown, onTouchStart, onDelete, onRotate, scale = 1 }) => {
  const [hovered, setHovered] = useState(false)
  const ft = FIXTURE_TYPES.find(f => f.id === item.fixtureKind) || FIXTURE_TYPES[0]
  const FIcon = ft.Icon
  const w = (item.w || ft.w) * scale
  const h = (item.h || ft.h) * scale

  return (
    <div
      style={{
        position: 'absolute', left: item.x * scale, top: item.y * scale,
        zIndex: isDragging ? 200 : hovered ? 50 : 0,
      }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      {/* Delete + Rotate on hover in edit mode */}
      {!locked && hovered && !isDragging && (
        <div style={{
          position: 'absolute', top: -10, right: -10, zIndex: 40, display: 'flex', gap: 3,
          animation: 'fpPopIn 150ms cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}>
          {(item.fixtureKind === 'wall' || item.fixtureKind === 'window' || item.fixtureKind === 'bar') && (
            <button onClick={e => { e.stopPropagation(); onRotate?.() }} style={{
              width: 22, height: 22, borderRadius: '50%', border: '1px solid #E5E7EB', cursor: 'pointer',
              background: '#fff', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,.12)',
            }}><RotateCw size={10} /></button>
          )}
          <button onClick={e => { e.stopPropagation(); onDelete?.() }} style={{
            width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(239,68,68,.4)',
          }}><X size={10} strokeWidth={3} /></button>
        </div>
      )}

      {/* Fixture body */}
      <div
        style={{
          width: w, height: h,
          background: item.fixtureKind === 'wall' ? ft.bg : `${ft.bg}`,
          border: `${item.fixtureKind === 'kitchen' ? '1.5px dashed' : '1.5px solid'} ${ft.border}`,
          borderRadius: item.fixtureKind === 'wall' ? 2 : 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          cursor: locked ? 'default' : isDragging ? 'grabbing' : 'grab',
          boxShadow: isDragging ? '0 6px 20px rgba(0,0,0,.15)' : hovered && !locked ? `0 0 0 2px ${ft.border}40` : '0 1px 4px rgba(0,0,0,.06)',
          transition: isDragging ? 'none' : 'all 0.2s',
          transform: `rotate(${item.rotation || 0}deg)`,
          userSelect: 'none', fontFamily: "'Figtree', sans-serif", overflow: 'hidden',
        }}
        onMouseDown={onMouseDown} onTouchStart={onTouchStart}
      >
        {item.fixtureKind !== 'wall' && h > 14 && (
          <>
            <FIcon size={Math.min(16, h * 0.5)} color={ft.border} strokeWidth={2} />
            {w > 50 && <span style={{ fontSize: 10 * scale, fontWeight: 700, color: ft.border }}>{ft.label}</span>}
          </>
        )}
        {!locked && <div style={{ position: 'absolute', top: 1, right: 2, opacity: 0.25 }}><GripVertical size={9} /></div>}
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

/* ═══════════════ MAIN COMPONENT ═══════════════ */

const FloorPlan = ({ embedded = false }) => {
  const { business, businessType } = useBusiness()
  const bid = business?.id ?? business?._id
  const isFood = businessType === 'food' || businessType === 'restaurant'

  const [elements, setElements] = useState(DEFAULT_ELEMENTS)
  const [bookings, setBookings] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)
  const [locked, setLocked] = useState(true)
  const [loading, setLoading] = useState(true)
  const [activeZone, setActiveZone] = useState('main')
  const [toast, setToast] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 })
  const canvasRef = useRef(null)
  const allZonesRef = useRef(null)
  const [azW, setAzW] = useState(800)
  const [azH, setAzH] = useState(500)
  useEffect(() => {
    if (!allZonesRef.current) return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      if (e) { setAzW(e.contentRect.width); setAzH(e.contentRect.height) }
    })
    ro.observe(allZonesRef.current)
    return () => ro.disconnect()
  }, [activeZone])
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [addType, setAddType] = useState('table') // 'table' | 'fixture'
  const [addShape, setAddShape] = useState('round')
  const [addSeats, setAddSeats] = useState(4)
  const [addFixture, setAddFixture] = useState('window')
  const [addName, setAddName] = useState('')
  const [editTable, setEditTable] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [arranging, setArranging] = useState(false)
  const [validationIssues, setValidationIssues] = useState([])
  const [validationStats, setValidationStats] = useState(null)
  const savedRef = useRef(null)

  /* ── AI Auto-Arrange ── */
  const autoArrange = async () => {
    if (!bid || arranging) return
    setArranging(true)
    try {
      const zoneEls = activeZone === 'all' ? elements : elements.filter(e => e.zone === activeZone)
      const otherEls = activeZone === 'all' ? [] : elements.filter(e => e.zone !== activeZone)
      const data = await api.post(`/tables/business/${bid}/auto-arrange`, {
        elements: zoneEls,
        width: 1000, height: 800,
        zone: activeZone === 'all' ? null : activeZone,
        style: 'balanced'
      })
      setElements([...otherEls, ...data.elements])
      setHasChanges(true)
      if (data.validation) {
        setValidationIssues(data.validation.issues || [])
        setValidationStats(data.validation.stats || null)
      }
      const tables = data.elements.filter(e => e.type !== 'fixture').length
      const aiLabel = data.ai ? `🧠 AI (${data.model || 'Claude'})` : '⚙️ Rule-based'
      showToast(`✨ ${tables} tables arranged by ${aiLabel} — ${data.validation?.stats?.errors || 0} issues`)
    } catch (err) {
      console.error('Auto-arrange failed:', err)
      const msg = err?.response?.data?.detail || err?.message || 'Unknown error'
      showToast(`Auto-arrange failed: ${msg}`)
    }
    setArranging(false)
  }

  /* ── Validate Layout ── */
  const validateLayout = async () => {
    if (!bid) return
    try {
      const zoneEls = activeZone === 'all' ? elements : elements.filter(e => e.zone === activeZone)
      const data = await api.post(`/tables/business/${bid}/validate-layout`, {
        elements: zoneEls,
        width: 1000, height: 800,
        min_gap: 60
      })
      setValidationIssues(data.issues || [])
      setValidationStats(data.stats || null)
      if (data.valid) {
        showToast('✅ Layout is valid — no issues found')
      } else {
        showToast(`⚠️ ${data.stats?.errors || 0} errors, ${data.stats?.warnings || 0} warnings`)
      }
    } catch (err) {
      console.error('Validation failed:', err)
    }
  }

  /* Clear validation when elements change */
  const problemElements = useMemo(() => {
    const ids = new Set()
    validationIssues.forEach(issue => {
      (issue.elements || []).forEach(id => ids.add(id))
    })
    return ids
  }, [validationIssues])

  // Auto-clear validation after 8 seconds or when user drags
  useEffect(() => {
    if (validationIssues.length > 0) {
      const t = setTimeout(() => setValidationIssues([]), 8000)
      return () => clearTimeout(t)
    }
  }, [validationIssues])

  /* ── Load from API, fallback to defaults ── */
  useEffect(() => {
    if (!bid) { setLoading(false); return }
    setLoading(true)
    api.get(`/tables/business/${bid}/floor-plan`)
      .then(data => {
        // Support both legacy {tables:[]} and new {elements:[]} formats
        const els = data.elements || data.tables || []
        if (els.length > 0) {
          // Ensure all items have type field (legacy migration)
          const migrated = els.map(e => ({ ...e, type: e.type || 'table' }))
          setElements(migrated)
          savedRef.current = JSON.stringify(migrated)
        } else {
          savedRef.current = JSON.stringify(DEFAULT_ELEMENTS)
        }
      })
      .catch(() => { savedRef.current = JSON.stringify(DEFAULT_ELEMENTS) })
      .finally(() => setLoading(false))
  }, [bid])

  // Track changes
  useEffect(() => {
    if (savedRef.current === null) return
    setHasChanges(JSON.stringify(elements) !== savedRef.current)
  }, [elements])

  /* ── Load bookings from API ── */
  useEffect(() => {
    if (!bid) return
    const today = new Date().toISOString().slice(0, 10)
    api.get(`/calendar/business/${bid}/restaurant?date=${today}&view=day`)
      .then(d => { if (d.bookings?.length) setBookings(d.bookings) })
      .catch(() => {})
  }, [bid])

  /* ── Derived: visible elements per zone ── */
  const tables = useMemo(() => elements.filter(e => e.type !== 'fixture'), [elements])
  const visibleElements = useMemo(() => activeZone === 'all' ? elements : elements.filter(e => e.zone === activeZone), [elements, activeZone])
  const visibleTables = useMemo(() => visibleElements.filter(e => e.type !== 'fixture'), [visibleElements])

  const floorCounts = useMemo(() => {
    const c = { all: tables.length }
    FLOORS.forEach(f => { if (f.id !== 'all') c[f.id] = tables.filter(t => t.zone === f.id).length })
    return c
  }, [tables])

  // Which floors actually have elements?
  const activeFloors = useMemo(() => FLOORS.filter(f => f.id !== 'all' && elements.some(e => e.zone === f.id)), [elements])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  /* ── Save to API (does NOT lock — that's separate) ── */
  const saveLayout = async () => {
    setSaving(true)
    const payload = elements.map(e => {
      const base = { id: e.id, type: e.type || 'table', name: e.name, zone: e.zone, x: Math.round(e.x), y: Math.round(e.y), rotation: e.rotation || 0 }
      if (e.type === 'fixture') return { ...base, fixtureKind: e.fixtureKind, w: e.w, h: e.h }
      return { ...base, seats: e.seats, shape: e.shape, status: e.status, vip: e.vip || false, guest: e.guest || '', timer: e.timer || '', nextTime: e.nextTime || '' }
    })
    try {
      if (bid) await api.put(`/tables/business/${bid}/floor-plan`, { elements: payload, width: 1000, height: 800 })
    } catch {}
    savedRef.current = JSON.stringify(elements)
    setHasChanges(false)
    showToast('Layout saved ✓')
    setSaving(false)
  }

  /* ── Mouse Drag (works for both tables & fixtures) ── */
  const handleMouseDown = useCallback((e, eId) => {
    if (locked) return
    e.preventDefault(); e.stopPropagation()
    const el = elements.find(t => t.id === eId); if (!el) return
    const rect = canvasRef.current?.getBoundingClientRect()
    setDragging(eId)
    setDragOff({ x: e.clientX - (rect?.left || 0) - el.x, y: e.clientY - (rect?.top || 0) - el.y })
  }, [locked, elements])

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return
    const nx = Math.max(0, Math.min(rect.width - 60, e.clientX - rect.left - dragOff.x))
    const ny = Math.max(0, Math.min(rect.height - 60, e.clientY - rect.top - dragOff.y))
    setElements(prev => prev.map(t => t.id === dragging ? { ...t, x: nx, y: ny } : t))
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
  const handleTouchStart = useCallback((e, eId) => {
    if (locked) return
    const el = elements.find(t => t.id === eId); if (!el) return
    const touch = e.touches[0]; const rect = canvasRef.current?.getBoundingClientRect()
    setDragging(eId)
    setDragOff({ x: touch.clientX - (rect?.left || 0) - el.x, y: touch.clientY - (rect?.top || 0) - el.y })
  }, [locked, elements])

  const handleTouchMove = useCallback((e) => {
    if (!dragging) return; e.preventDefault()
    const touch = e.touches[0]; const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return
    const nx = Math.max(0, Math.min(rect.width - 60, touch.clientX - rect.left - dragOff.x))
    const ny = Math.max(0, Math.min(rect.height - 60, touch.clientY - rect.top - dragOff.y))
    setElements(prev => prev.map(t => t.id === dragging ? { ...t, x: nx, y: ny } : t))
  }, [dragging, dragOff])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleMouseUp)
      return () => { window.removeEventListener('touchmove', handleTouchMove); window.removeEventListener('touchend', handleMouseUp) }
    }
  }, [dragging, handleTouchMove, handleMouseUp])

  /* ── Element CRUD ── */
  const addElementFn = () => {
    const zone = activeZone !== 'all' ? activeZone : 'main'
    if (addType === 'fixture') {
      const ft = FIXTURE_TYPES.find(f => f.id === addFixture) || FIXTURE_TYPES[0]
      const name = addName.trim() || ft.label
      setElements(prev => [...prev, {
        id: `f${Date.now()}`, type: 'fixture', fixtureKind: addFixture, name,
        zone, x: 60 + Math.random() * 350, y: 50 + Math.random() * 250,
        w: ft.w, h: ft.h, rotation: 0,
      }])
      showToast(`${name} placed on ${FLOORS.find(f => f.id === zone)?.label || zone}`)
    } else {
      const num = tables.length + 1
      const name = addName.trim() || `T-${String(num).padStart(2, '0')}`
      setElements(prev => [...prev, {
        id: `t${Date.now()}`, type: 'table', name, seats: addSeats, zone, shape: addShape,
        x: 60 + Math.random() * 350, y: 50 + Math.random() * 250, status: 'available', rotation: 0,
      }])
      showToast(`${name} placed on ${FLOORS.find(f => f.id === zone)?.label || zone}`)
    }
    setShowAddPanel(false); setAddName('')
  }

  const deleteElement = (eId) => {
    const el = elements.find(e => e.id === eId)
    setElements(prev => prev.filter(e => e.id !== eId))
    if (selectedTable === eId) setSelectedTable(null)
    if (editTable?.id === eId) setEditTable(null)
    showToast(`${el?.name || 'Element'} removed`)
  }

  const duplicateTable = (tId) => {
    const orig = elements.find(t => t.id === tId); if (!orig) return
    setElements(prev => [...prev, { ...orig, id: `t${Date.now()}`, name: `${orig.name}-copy`, x: orig.x + 30, y: orig.y + 30 }])
    showToast(`Duplicated ${orig.name}`)
  }

  const updateTable = (tId, updates) => {
    setElements(prev => prev.map(t => t.id === tId ? { ...t, ...updates } : t))
    if (editTable?.id === tId) setEditTable(prev => prev ? { ...prev, ...updates } : prev)
  }

  /* ── Stats (tables only) ── */
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
      <style>{`
        @keyframes fpPopIn { from { opacity: 0; transform: scale(0.7) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes fpPulse { 0%, 100% { box-shadow: 0 4px 14px rgba(27,67,50,0.3); } 50% { box-shadow: 0 4px 20px rgba(27,67,50,0.5); } }
      `}</style>

      {/* ═══ CONTROLS BAR ═══ */}
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
              {/* Save (just saves, stays in edit mode) */}
              {!locked && hasChanges && (
                <button onClick={saveLayout} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: saving ? '#D1D5DB' : '#1B4332', color: '#fff',
                    boxShadow: saving ? 'none' : '0 4px 14px rgba(27,67,50,0.3)',
                    animation: saving ? 'none' : 'fpPulse 2s ease-in-out infinite',
                  }}>
                  {saving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )}
              {/* Add Element */}
              {!locked && (
                <button onClick={() => setShowAddPanel(!showAddPanel)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 transition-all">
                  <Plus className="w-4 h-4" /> Add
                </button>
              )}
              {/* AI Auto-Arrange */}
              {!locked && elements.filter(e => e.type !== 'fixture').length >= 2 && (
                <button onClick={autoArrange} disabled={arranging}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: arranging ? '#D1D5DB' : '#1B4332',
                    color: '#fff',
                    boxShadow: arranging ? 'none' : '0 4px 14px rgba(27,67,50,0.3)',
                  }}>
                  {arranging ? <Clock className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {arranging ? 'AI thinking...' : 'AI Arrange'}
                </button>
              )}
              {/* Lock = Done / Unlock = Edit */}
              <button onClick={() => {
                  if (!locked) {
                    if (hasChanges) saveLayout()
                    setLocked(true); setShowAddPanel(false); showToast('Layout locked')
                  } else {
                    setLocked(false)
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                style={{ background: locked ? '#F3F4F6' : '#1B4332', color: locked ? '#374151' : '#fff', boxShadow: locked ? 'none' : '0 4px 14px rgba(27,67,50,0.3)' }}>
                {locked ? <Lock className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                {locked ? 'Edit Layout' : 'Done'}
              </button>
            </div>
          </div>

          {/* Row 2: Floor Tabs (physical areas only) */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {FLOORS.map(floor => {
              const isActive = activeZone === floor.id
              const count = floorCounts[floor.id] || 0
              // Only show floors that have elements, or main, or the active one
              if (floor.id !== 'all' && floor.id !== 'main' && count === 0 && !isActive && locked) return null
              return (
                <button key={floor.id} onClick={() => setActiveZone(floor.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0"
                  style={{ background: isActive ? floor.color + '12' : 'transparent', color: isActive ? floor.color : count > 0 ? '#6B7280' : '#C9C9C9', border: isActive ? `1.5px solid ${floor.color}30` : '1.5px solid transparent' }}>
                  {floor.Icon && <floor.Icon size={14} strokeWidth={2} />}
                  {floor.label}
                  {(count > 0 || floor.id === 'all') && <span className="ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ background: isActive ? floor.color + '18' : '#F3F4F6', color: isActive ? floor.color : '#9CA3AF' }}>{count}</span>}
                </button>
              )
            })}
            {/* Show all floor options in edit mode */}
            {!locked && FLOORS.filter(f => f.id !== 'all' && f.id !== 'main' && !floorCounts[f.id]).map(floor => (
              <button key={floor.id} onClick={() => setActiveZone(floor.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0"
                style={{ background: 'transparent', color: '#C9C9C9', border: '1.5px dashed #E5E7EB' }}>
                <floor.Icon size={14} strokeWidth={2} />
                {floor.label}
              </button>
            ))}
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

          {/* Validation results banner */}
          {validationIssues.length > 0 && (
            <div className="flex items-center gap-3 mt-2 px-3 py-2 rounded-xl text-xs font-bold" style={{
              background: validationStats?.errors > 0 ? '#FEF2F2' : '#FFFBEB',
              color: validationStats?.errors > 0 ? '#DC2626' : '#D97706',
              border: `1px solid ${validationStats?.errors > 0 ? '#FCA5A520' : '#FCD34D20'}`
            }}>
              <AlertTriangle size={14} />
              <span>
                {validationStats?.errors > 0 && `${validationStats.errors} error${validationStats.errors > 1 ? 's' : ''}`}
                {validationStats?.errors > 0 && validationStats?.warnings > 0 && ', '}
                {validationStats?.warnings > 0 && `${validationStats.warnings} warning${validationStats.warnings > 1 ? 's' : ''}`}
              </span>
              <span className="text-gray-400 font-medium ml-1">
                Min spacing: {validationStats?.min_spacing?.toFixed(0) || '?'}px · Avg: {validationStats?.avg_spacing?.toFixed(0) || '?'}px
              </span>
              <button onClick={() => setValidationIssues([])} className="ml-auto text-gray-400 hover:text-gray-600"><X size={12} /></button>
            </div>
          )}
        </div>
      )}

      {/* ═══ ADD PANEL (top bar, type toggle: Table | Fixture) ═══ */}
      {showAddPanel && !locked && (
        <div className="border-b border-gray-100 px-5 py-3 bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-5 flex-wrap">
            {/* Type Toggle */}
            <div className="flex items-center gap-1 bg-gray-200/60 rounded-lg p-0.5">
              <button onClick={() => setAddType('table')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${addType === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <UtensilsCrossed size={12} className="inline -mt-0.5 mr-1" /> Table
              </button>
              <button onClick={() => setAddType('fixture')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${addType === 'fixture' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <LayoutGrid size={12} className="inline -mt-0.5 mr-1" /> Fixture
              </button>
            </div>

            {addType === 'table' ? (
              <>
                {/* Name */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500">Name:</span>
                  <input type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder={`T-${String(tables.length + 1).padStart(2, '0')}`}
                    className="w-20 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
                </div>
                {/* Shape */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500">Shape:</span>
                  {TABLE_SHAPES.map(s => { const SIcon = s.Icon; return (
                    <button key={s.id} onClick={() => setAddShape(s.id)} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${addShape === s.id ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`} title={s.label}><SIcon size={16} /></button>
                  )})}
                </div>
                {/* Seats */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500">Seats:</span>
                  {SEAT_OPTIONS.map(n => (
                    <button key={n} onClick={() => setAddSeats(n)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${addSeats === n ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`}>{n}</button>
                  ))}
                </div>
              </>
            ) : (
              /* Fixture picker */
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500">Type:</span>
                {FIXTURE_TYPES.map(ft => { const FIcon = ft.Icon; return (
                  <button key={ft.id} onClick={() => { setAddFixture(ft.id); setAddName('') }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${addFixture === ft.id ? 'shadow-md text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                    style={addFixture === ft.id ? { background: ft.border, borderColor: ft.border } : {}}>
                    <FIcon size={14} /> {ft.label}
                  </button>
                )})}
              </div>
            )}

            {/* Place button */}
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={addElementFn} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-emerald-600 transition-all">
                {addType === 'table' ? 'Place Table' : `Place ${FIXTURE_TYPES.find(f => f.id === addFixture)?.label || 'Fixture'}`}
              </button>
              <button onClick={() => setShowAddPanel(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"><X className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAIN: CANVAS + SIDEBAR ═══ */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto" style={{ background: '#FAFAF8' }}>

          {/* ALL ZONES OVERVIEW — architect blueprint: tall portrait oblongs side by side */}
          {activeZone === 'all' ? (
            <div className="h-full overflow-auto p-4" style={{ minWidth: 600 }}>
              {activeFloors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <LayoutGrid size={48} strokeWidth={1} className="mb-3 opacity-30" />
                  <p className="text-sm font-bold">No elements yet</p>
                  <p className="text-xs mt-1">Unlock to start building your venue layout</p>
                </div>
              ) : (
                <div ref={allZonesRef} className="flex h-full rounded-2xl border border-gray-200 bg-white overflow-hidden" style={{ minHeight: 500 }}>
                  {activeFloors.map((floor, fi) => {
                    const floorElements = elements.filter(e => e.zone === floor.id)
                    const floorTables = floorElements.filter(e => e.type !== 'fixture')

                    /* ── Auto-scale algorithm ──
                       1. Compute tight bounding box (min→max) of all elements
                       2. Scale so bounding box fills 90% of available column
                       3. Center the scaled content in the column
                       Elements resize via their scale prop (text, dots, borders all scale) */
                    const getElSize = (el) => {
                      if (el.type === 'fixture') return { w: (el.w || 100), h: (el.h || 50) }
                      const seats = el.seats || 4
                      const raw = seats <= 2 ? 85 : seats <= 4 ? 100 : seats <= 6 ? 120 : seats <= 8 ? 140 : 155
                      let w = raw, h = raw
                      if (el.shape === 'long') { w = raw * 1.7; h = raw * 0.65 }
                      else if (el.shape === 'booth') { w = raw * 1.4; h = raw * 0.8 }
                      return { w: w + 30, h: h + 30 } // seat dots + hover tooltips
                    }
                    const margin = 10
                    const hasEls = floorElements.length > 0
                    const minX = hasEls ? Math.min(...floorElements.map(e => (e.x || 0))) : 0
                    const minY = hasEls ? Math.min(...floorElements.map(e => (e.y || 0))) : 0
                    const maxR = hasEls ? Math.max(...floorElements.map(e => (e.x || 0) + getElSize(e).w)) : 400
                    const maxB = hasEls ? Math.max(...floorElements.map(e => (e.y || 0) + getElSize(e).h)) : 400
                    const contentW = (maxR - minX) || 1
                    const contentH = (maxB - minY) || 1
                    const colW = (azW / activeFloors.length) - 2
                    const colH = azH - 44
                    const usableW = colW - margin * 2
                    const usableH = colH - margin * 2
                    // Scale to fill 90% of column — no cap, elements resize naturally
                    const scale = Math.min(usableW / contentW, usableH / contentH)
                    // Rendered size after scaling
                    const renderedW = contentW * scale
                    const renderedH = contentH * scale
                    // Center offset: shift origin + center in column
                    const offX = -minX + (usableW - renderedW) / (2 * scale) + margin / scale
                    const offY = -minY + (usableH - renderedH) / (2 * scale) + margin / scale

                    return (
                      <div key={floor.id} className="flex flex-col flex-1 min-w-[180px]" style={{ borderRight: fi < activeFloors.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                        {/* Floor label above */}
                        <div className="flex items-center justify-center gap-2 py-2" style={{ borderBottom: '1px solid #E5E7EB' }}>
                          <floor.Icon size={14} color={floor.color} />
                          <span className="text-xs font-extrabold" style={{ color: floor.color }}>{floor.label}</span>
                          <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{floorTables.length}</span>
                        </div>
                        {/* Floor canvas */}
                        <div className="flex-1 relative overflow-hidden cursor-pointer"
                          onClick={() => setActiveZone(floor.id)}
                          style={{ backgroundImage: 'radial-gradient(circle, #E5E5E0 0.8px, transparent 0.8px)', backgroundSize: '24px 24px' }}>
                          {floorElements.filter(e => e.type === 'fixture').map(item => (
                            <FixtureNode key={item.id} item={{ ...item, x: (item.x || 0) + offX, y: (item.y || 0) + offY }} locked={true} isDragging={false} scale={scale}
                              onMouseDown={() => {}} onTouchStart={() => {}} onDelete={() => {}} onRotate={() => {}} />
                          ))}
                          {floorTables.map(table => (
                            <TableNode key={table.id} table={{ ...table, x: (table.x || 0) + offX, y: (table.y || 0) + offY }} status={table.status || 'available'} isSelected={false} locked={true} isDragging={false} scale={scale}
                              onMouseDown={() => {}} onTouchStart={() => {}}
                              onClick={() => setActiveZone(floor.id)}
                              onEdit={() => {}} onDelete={() => {}} onRotate={() => {}} />
                          ))}
                          {floorElements.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-xs font-bold">Empty</div>
                          )}
                          <div className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] font-bold text-gray-400 opacity-50">Click to view</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            /* SINGLE FLOOR CANVAS */
            <div ref={canvasRef} className="relative"
              style={{ minWidth: 700, minHeight: 500, height: '100%',
                backgroundImage: locked ? 'radial-gradient(circle, #E5E5E0 0.8px, transparent 0.8px)' : 'radial-gradient(circle, #93C5FD 0.8px, transparent 0.8px)',
                backgroundSize: '24px 24px', transition: 'background-image 0.3s',
                padding: 20,
              }}
              onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>

              {/* Floor label watermark */}
              {(() => { const zf = FLOORS.find(z => z.id === activeZone); if (!zf || zf.id === 'all') return null; const ZI = zf.Icon; return (
                <div style={{ position: 'absolute', right: 30, bottom: 20, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.08, pointerEvents: 'none' }}>
                  {ZI && <ZI size={48} strokeWidth={1.2} color={zf.color} />}
                  <span style={{ fontSize: 36, fontWeight: 900, color: zf.color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{zf.label}</span>
                </div>
              )})()}

              {/* Edit mode banner */}
              {!locked && (
                <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: '#1B4332', color: '#fff', fontSize: 11, fontWeight: 700, padding: '6px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 20px rgba(27,67,50,0.3)' }}>
                  <Move size={13} /> Drag to rearrange · Click to select
                </div>
              )}

              {/* Empty state */}
              {visibleElements.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <LayoutGrid size={48} strokeWidth={1} className="mb-3 opacity-30" />
                  <p className="text-sm font-bold">No elements on {FLOORS.find(z => z.id === activeZone)?.label || 'this floor'}</p>
                  {!locked && <button onClick={() => setShowAddPanel(true)} className="mt-3 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-lg hover:bg-[#2D6A4F] transition-all"><Plus className="w-3.5 h-3.5 inline mr-1" /> Add First Element</button>}
                </div>
              )}

              {/* Render fixtures */}
              {visibleElements.filter(e => e.type === 'fixture').map(item => (
                <FixtureNode key={item.id} item={item} locked={locked} isDragging={dragging === item.id}
                  onMouseDown={(e) => handleMouseDown(e, item.id)} onTouchStart={(e) => handleTouchStart(e, item.id)}
                  onDelete={() => deleteElement(item.id)}
                  onRotate={() => updateTable(item.id, { rotation: ((item.rotation || 0) + 90) % 360 })} />
              ))}

              {/* Render tables */}
              {visibleElements.filter(e => e.type !== 'fixture').map(table => (
                <TableNode key={table.id} table={table} status={table.status || 'available'} isSelected={selectedTable === table.id} locked={locked} isDragging={dragging === table.id}
                  hasIssue={problemElements.has(table.id)}
                  onMouseDown={(e) => handleMouseDown(e, table.id)} onTouchStart={(e) => handleTouchStart(e, table.id)}
                  onClick={() => locked && setSelectedTable(table.id === selectedTable ? null : table.id)}
                  onEdit={() => setEditTable(table)} onDelete={() => deleteElement(table.id)}
                  onRotate={() => updateTable(table.id, { rotation: ((table.rotation || 0) + 90) % 360 })} />
              ))}
            </div>
          )}
        </div>

        {/* ═══ SIDEBAR (unchanged) ═══ */}
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

      {/* ═══ EDIT TABLE MODAL (unchanged styling) ═══ */}
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
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Floor</label>
                <div className="flex gap-2 flex-wrap">
                  {FLOORS.filter(z => z.id !== 'all').map(z => (
                    <button key={z.id} onClick={() => { setEditTable(p => ({ ...p, zone: z.id })); updateTable(editTable.id, { zone: z.id }) }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${editTable.zone === z.id ? 'text-white shadow-md' : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                      style={editTable.zone === z.id ? { background: z.color, borderColor: z.color } : {}}><z.Icon size={11} className="inline -mt-px" /> {z.label}</button>
                  ))}
                </div>
              </div>
              {/* Rotation — only for long/booth */}
              {(editTable.shape === 'long' || editTable.shape === 'booth') && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Rotation</label>
                  <div className="flex gap-2">
                    {[0, 90, 180, 270].map(deg => (
                      <button key={deg} onClick={() => { setEditTable(p => ({ ...p, rotation: deg })); updateTable(editTable.id, { rotation: deg }) }}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5
                          ${(editTable.rotation || 0) === deg ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        <RotateCw size={14} style={{ transform: `rotate(${deg}deg)` }} /> {deg}°
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
              <button onClick={() => { deleteElement(editTable.id); setEditTable(null) }} className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
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
