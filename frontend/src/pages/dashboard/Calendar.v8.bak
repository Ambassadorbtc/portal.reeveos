/**
 * Rezvo Calendar v8 — Polished, Fresha-level service calendar
 * Merges the polished design (staff columns, solid colour blocks,
 * crosshair hover, FAB, animated badges, KPI strip, popover)
 * with live API data from the Rezvo backend.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

/* ───────────────────── Constants ───────────────────── */
const SH = 8, EH = 20, HH = 80, TCW = 52

const SERVICE_COLORS = {
  cut: '#D4A574', colour: '#E8845E', style: '#6BA3C7',
  massage: '#6BC7A3', facial: '#A87BBF', beard: '#E8B84E',
  brow: '#E87B9E', default: '#6BA3C7',
}
const STAFF_PALETTES = [
  '#D4A574', '#6BA3C7', '#A87BBF', '#6BC7A3',
  '#E8845E', '#E8B84E', '#E87B9E', '#6366F1',
]
const STATUS_MAP = {
  confirmed: { color: '#22C55E', label: 'Confirmed' },
  pending: { color: '#F59E0B', label: 'Pending' },
  checked_in: { color: '#3B82F6', label: 'Checked In' },
  completed: { color: '#9CA3AF', label: 'Completed' },
  no_show: { color: '#EF4444', label: 'No-show' },
  walkin: { color: '#1B4332', label: 'Walk-in' },
}

/* ───────────────────── Helpers ───────────────────── */
const fmt = t => { const h = Math.floor(t), m = Math.round((t - h) * 60); return `${h}:${String(m).padStart(2, '0')}` }
const fmtAP = h => { const hr = h > 12 ? h - 12 : h === 0 ? 12 : h; return `${hr}${h >= 12 ? 'pm' : 'am'}` }
const gtp = () => { const n = new Date(); return Math.max(0, (n.getHours() + n.getMinutes() / 60 - SH) * HH) }
const gts = () => { const n = new Date(); return `${n.getHours()}:${String(n.getMinutes()).padStart(2, '0')}` }

/* Inline SVG icons */
const SICheck = ({ s = 10, c = '#fff' }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
const SIClock = ({ s = 10, c = '#fff' }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
const ChevL = () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
const ChevR = () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
const ChevD = () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
const ChevU = () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
const PlusIcon = ({ size = 26 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const StarIcon = ({ size = 10 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="#FFD700" stroke="#FFD700" strokeWidth="1"><polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.5 5.8 21 7 14 2 9.3 9 8.5"/></svg>
const FilterIcon = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
const UsersIcon = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const TagIcon = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
const SearchIcon = () => <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const BarChartIcon = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
const BellIcon = () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
const CalIcon = () => <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const ClockIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const XIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const EditIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const CheckIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const TrashIcon = () => <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
const UserIcon = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>

/* Mini sparkline */
const Spark = ({ data, color }) => {
  const w = 50, h = 16
  const max = Math.max(...data), min = Math.min(...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(' ')
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

/* ─────────────────── DEMO DATA ─────────────────── */
const DEMO_STAFF = [
  { id: 's1', name: 'Sarah', full: 'Sarah Jenkins', initials: 'SJ', color: '#D4A574' },
  { id: 's2', name: 'Mike', full: 'Mike Ross', initials: 'MR', color: '#6BA3C7' },
  { id: 's3', name: 'Jenny', full: 'Jenny Wilson', initials: 'JW', color: '#A87BBF' },
  { id: 's4', name: 'Tom', full: 'Tom Walker', initials: 'TW', color: '#6BC7A3' },
]
const DEMO_BOOKINGS = [
  { id: 'd1', staffId: 's1', customerName: 'Emma Watson', service: 'Full Balayage & Cut', cat: 'colour', start: 8.5, dur: 2, price: 145, status: 'confirmed' },
  { id: 'd2', staffId: 's1', customerName: 'Sophie Turner', service: 'Ladies Cut & Blow Dry', cat: 'cut', start: 11, dur: 1, price: 65, status: 'confirmed' },
  { id: 'd3', staffId: 's1', customerName: 'Olivia Rodrigo', service: 'HydraFacial Deluxe', cat: 'facial', start: 14, dur: 1.5, price: 120, status: 'pending', isNewClient: true },
  { id: 'd4', staffId: 's1', customerName: 'Laura Chen', service: 'Balayage Touch-Up', cat: 'colour', start: 16, dur: 1.25, price: 95, status: 'confirmed' },
  { id: 'd5', staffId: 's2', customerName: 'James Bond', service: "Men's Cut & Style", cat: 'cut', start: 8, dur: 1, price: 35, status: 'confirmed' },
  { id: 'd6', staffId: 's2', customerName: 'Marilyn Carder', service: 'Hair and Beard Cut', cat: 'beard', start: 10, dur: 1.25, price: 65, status: 'completed' },
  { id: 'd7', staffId: 's2', customerName: 'Desirae Stanton', service: 'Blow Dry & Style', cat: 'style', start: 12.5, dur: 1, price: 45, status: 'confirmed' },
  { id: 'd8', staffId: 's2', customerName: 'Walk-in Client', service: 'Beard Trim', cat: 'beard', start: 14.5, dur: 0.75, price: 25, status: 'walkin' },
  { id: 'd9', staffId: 's3', customerName: 'Phillip Dorwart', service: 'Beard Colouring', cat: 'beard', start: 9, dur: 1.5, price: 55, status: 'confirmed' },
  { id: 'd10', staffId: 's3', customerName: 'Amy Jones', service: 'Haircut & Colour', cat: 'colour', start: 11, dur: 1.5, price: 85, status: 'checked_in' },
  { id: 'd11', staffId: 's3', customerName: 'Alena Dias', service: 'Haircut & Colour', cat: 'colour', start: 13, dur: 1.25, price: 75, status: 'confirmed' },
  { id: 'd12', staffId: 's3', customerName: 'Zendaya C.', service: 'Brow Lamination', cat: 'brow', start: 15.5, dur: 1, price: 55, status: 'pending' },
  { id: 'd13', staffId: 's4', customerName: 'James Herwitz', service: 'Balinese Massage', cat: 'massage', start: 8.5, dur: 1.5, price: 70, status: 'confirmed' },
  { id: 'd14', staffId: 's4', customerName: 'Randy Press', service: 'Swedish Massage', cat: 'massage', start: 11, dur: 1.25, price: 80, status: 'confirmed' },
  { id: 'd15', staffId: 's4', customerName: 'Ryan Brooks', service: 'Sports Massage', cat: 'massage', start: 14, dur: 2.25, price: 130, status: 'confirmed' },
]
const DEMO_BLOCKS = [
  { staffId: 's1', start: 12.25, dur: 0.5, label: 'Lunch', type: 'break' },
  { start: 13, dur: 0.5, label: 'Team Huddle', type: 'meeting', allStaff: true },
]

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
const Calendar = () => {
  const { business, businessType, isDemo } = useBusiness()
  const bid = business?.id ?? business?._id

  /* ── State ── */
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [viewMode, setViewMode] = useState('Day')
  const [cm, setCm] = useState('service')
  const [showBook, setShowBook] = useState(false)
  const [hovA, setHovA] = useState(null)
  const [hovSlot, setHovSlot] = useState(null)
  const [selA, setSelA] = useState(null)
  const [showKPI, setShowKPI] = useState(true)
  const [fabOpen, setFabOpen] = useState(false)
  const [hoverCol, setHoverCol] = useState(null)
  const [hoverRow, setHoverRow] = useState(null)
  const [tp, setTp] = useState(gtp())
  const [ts, setTs] = useState(gts())
  const [hovS, setHovS] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [staffFilter, setStaffFilter] = useState('all')
  const [calSearch, setCalSearch] = useState('')
  const [showStatusDD, setShowStatusDD] = useState(false)
  const [showStaffDD, setShowStaffDD] = useState(false)
  const scrollRef = useRef(null)

  const isRestaurant = businessType === 'restaurant'
  const isToday = selectedDate === new Date().toISOString().slice(0, 10)

  /* ── Fetch API data ── */
  useEffect(() => {
    if (!bid || isDemo) {
      setLoading(false)
      setData({ staff: DEMO_STAFF, bookings: DEMO_BOOKINGS, blocks: DEMO_BLOCKS })
      return
    }
    setLoading(true)
    setError(null)
    const endpoint = isRestaurant
      ? `/calendar/business/${bid}/restaurant?date=${selectedDate}&view=${viewMode.toLowerCase()}`
      : `/calendar/business/${bid}?date=${selectedDate}&view=${viewMode.toLowerCase()}`
    api.get(endpoint)
      .then(d => {
        const staff = (d.staff || []).map((s, i) => ({
          ...s,
          color: s.color || STAFF_PALETTES[i % STAFF_PALETTES.length],
          initials: s.name ? s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?',
          full: s.full_name || s.name || 'Staff',
        }))
        const bookings = (d.bookings || []).map(b => {
          const [h, m] = (b.time || '9:00').split(':').map(Number)
          return {
            ...b,
            start: h + (m || 0) / 60,
            dur: (b.duration || 60) / 60,
            cat: b.category || b.service_type || 'default',
            customerName: b.customerName || b.customer_name || 'Walk-in',
          }
        })
        setData({ staff, bookings, blocks: d.blocks || [] })
      })
      .catch(err => {
        console.error('Calendar fetch error:', err)
        setError('Could not load calendar')
        setData({ staff: DEMO_STAFF, bookings: DEMO_BOOKINGS, blocks: DEMO_BLOCKS })
      })
      .finally(() => setLoading(false))
  }, [bid, selectedDate, viewMode, isRestaurant, isDemo])

  /* ── Time updater ── */
  useEffect(() => { const iv = setInterval(() => { setTp(gtp()); setTs(gts()) }, 30000); return () => clearInterval(iv) }, [])

  /* ── Click outside handler ── */
  useEffect(() => {
    const h = e => {
      if (!e.target.closest('[data-ap]') && !e.target.closest('[data-po]')) setSelA(null)
      if (!e.target.closest('[data-fab]')) setFabOpen(false)
      if (!e.target.closest('[data-filter-dd]')) { setShowStatusDD(false); setShowStaffDD(false) }
    }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  /* ── Navigation ── */
  const goPrev = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().slice(0, 10)) }
  const goNext = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().slice(0, 10)) }
  const goToday = () => setSelectedDate(new Date().toISOString().slice(0, 10))

  const dateLabel = new Date(selectedDate + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  /* ── Derived data ── */
  const staffColumns = data?.staff || []
  const bookings = data?.bookings || []
  const blocks = data?.blocks || []

  // Apply filters
  const filteredBookings = bookings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (staffFilter !== 'all' && b.staffId !== staffFilter) return false
    if (calSearch) {
      const q = calSearch.toLowerCase()
      return (b.clientName || '').toLowerCase().includes(q) || (b.serviceName || '').toLowerCase().includes(q)
    }
    return true
  })

  const gc = useCallback((a) => {
    if (cm === 'staff') {
      const s = staffColumns.find(s => s.id === a.staffId)
      return s?.color || '#999'
    }
    if (cm === 'status') return STATUS_MAP[a.status]?.color || '#999'
    return SERVICE_COLORS[a.cat] || SERVICE_COLORS.default
  }, [cm, staffColumns])

  const revenue = bookings.reduce((s, a) => s + (a.price || 0), 0)
  const totHrs = EH - SH

  /* ── Popover ── */
  const Pop = ({ a }) => {
    const staff = staffColumns.find(s => s.id === a.staffId)
    const st = STATUS_MAP[a.status] || STATUS_MAP.confirmed
    const bg = gc(a)
    return (
      <div data-po="1" onClick={e => e.stopPropagation()} style={{
        position: 'absolute', top: (a.start - SH) * HH + a.dur * HH + 6, left: 4, right: 4,
        background: '#fff', borderRadius: 16, zIndex: 50,
        boxShadow: '0 16px 48px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid #EBEBEB', overflow: 'hidden',
      }}>
        <div style={{ height: 4, background: bg }} />
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: bg + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: bg }}>
              {a.customerName?.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1B4332' }}>{a.customerName}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{a.service}</div>
            </div>
            <div style={{ padding: '4px 10px', borderRadius: 20, background: st.color + '12', fontSize: 10, fontWeight: 700, color: st.color }}>{st.label}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#888' }}><ClockIcon />{fmt(a.start)} - {fmt(a.start + a.dur)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#888' }}><UserIcon />{staff?.full || staff?.name}</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1B4332', marginBottom: 12 }}>£{a.price || 0}</div>
          <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #F0F0F0', paddingTop: 12 }}>
            <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 0', borderRadius: 10, border: '1px solid #EBEBEB', background: '#fff', fontSize: 12, fontWeight: 600, color: '#1B4332', cursor: 'pointer' }}><EditIcon /> Edit</button>
            <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 0', borderRadius: 10, border: 'none', background: '#1B4332', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(27,67,50,0.2)' }}><CheckIcon /> Check In</button>
            <button style={{ width: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: '1px solid #EF444420', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer' }}><TrashIcon /></button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Booking Block ── */
  const Bl = ({ a }) => {
    const top = (a.start - SH) * HH, h = a.dur * HH, bg = gc(a)
    const hov = hovA === a.id, sel = selA === a.id
    const done = a.status === 'completed'
    const tiny = h <= 32, sm = h <= 52
    return (
      <>
        <div data-ap="1" onMouseEnter={() => setHovA(a.id)} onMouseLeave={() => setHovA(null)}
          onClick={e => { e.stopPropagation(); setSelA(sel ? null : a.id) }}
          style={{
            position: 'absolute', top: top + 1, left: 4, right: 4, height: h - 2,
            borderRadius: 4, background: done ? `${bg}60` : bg,
            opacity: done ? 0.7 : a.status === 'no_show' ? 0.55 : 1,
            cursor: 'pointer', overflow: 'hidden', color: '#111',
            transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)',
            transform: hov && !sel ? 'scale(1.012) translateY(-1px)' : 'none',
            boxShadow: sel ? `0 0 0 2.5px #fff, 0 0 0 4.5px ${bg}, 0 8px 24px ${bg}25`
              : hov ? `0 8px 24px ${bg}30` : `0 2px 6px ${bg}12`,
            zIndex: sel ? 30 : hov ? 20 : 2,
            padding: tiny ? '2px 8px' : sm ? '4px 9px' : '7px 11px',
            display: 'flex', flexDirection: 'column',
          }}>
          {!tiny && <div style={{ position: 'absolute', top: 6, right: 7, opacity: 0.7 }}>{(a.status === 'confirmed' || a.status === 'completed') ? <SICheck s={10} c="#111" /> : a.status === 'pending' ? <SIClock s={10} c="#111" /> : null}</div>}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
            {tiny ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
                <span style={{ fontSize: 9, opacity: 0.85, fontWeight: 600 }}>{fmt(a.start)}</span>
                <span style={{ fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.customerName}</span>
              </div>
            ) : sm ? (
              <>
                <div style={{ fontSize: 9, opacity: 0.85, fontWeight: 600 }}>{fmt(a.start)}-{fmt(a.start + a.dur)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.customerName}</div>
                <div style={{ fontSize: 10, opacity: 0.85, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.service}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 9, opacity: 0.85, fontWeight: 700, letterSpacing: 0.3, marginBottom: 2 }}>{fmt(a.start)} - {fmt(a.start + a.dur)}</div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>{a.customerName}</div>
                <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500 }}>{a.service}</div>
                {a.isNewClient && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 9, fontWeight: 800, letterSpacing: 1, background: 'linear-gradient(110deg, #1B4332 30%, #2D6A4F 50%, #1B4332 70%)', backgroundSize: '200% 100%', borderRadius: 20, padding: '4px 12px 4px 9px', textTransform: 'uppercase', width: 'fit-content', color: '#fff', animation: 'newPulse 2s ease-in-out infinite, shimmer 3s linear infinite', boxShadow: '0 2px 12px rgba(27,67,50,0.4)' }}><StarIcon /> New Client</span>}
                {a.status === 'completed' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 9, fontWeight: 800, letterSpacing: 1, background: '#22C55E', borderRadius: 20, padding: '4px 12px 4px 9px', textTransform: 'uppercase', width: 'fit-content', color: '#fff', boxShadow: '0 2px 8px rgba(34,197,94,0.3)' }}>✓ Completed</span>}
                {(a.price || 0) > 0 && <div style={{ marginTop: 'auto', fontSize: 13, fontWeight: 700, opacity: 0.9, textAlign: 'right' }}>£{a.price}</div>}
              </>
            )}
          </div>
        </div>
        {sel && <Pop a={a} />}
      </>
    )
  }

  /* ═════════════════ RENDER ═════════════════ */
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', fontFamily: "'Figtree', system-ui, sans-serif", overflow: 'hidden' }}>
      <style>{`
        @keyframes newPulse{0%,100%{box-shadow:0 0 0 0 rgba(27,67,50,0.6)}50%{box-shadow:0 0 0 8px rgba(27,67,50,0)}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
      `}</style>

      {/* ═══ TOP CONTROLS ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 8,
        background: '#fff', borderBottom: '1px solid #EBEBEB', flexShrink: 0, zIndex: 35, flexWrap: 'wrap',
      }}>
        {/* Date nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#F5F5F5', borderRadius: 24, padding: '3px 4px' }}>
          <button onClick={goPrev} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1B4332', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}><ChevL /></button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1B4332', padding: '0 8px', whiteSpace: 'nowrap' }}>{dateLabel}</span>
          <button onClick={goNext} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1B4332', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}><ChevR /></button>
        </div>

        {/* Today pill */}
        <button onClick={goToday} style={{
          padding: '8px 18px', borderRadius: 20, border: 'none',
          background: isToday ? '#1B4332' : '#F5F5F5', color: isToday ? '#fff' : '#1B4332', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', boxShadow: isToday ? '0 2px 8px rgba(27,67,50,0.2)' : 'none',
        }}>Today</button>

        <div style={{ width: 1, height: 24, background: '#EBEBEB' }} />

        {/* View pills */}
        <div style={{ display: 'flex', background: '#F5F5F5', borderRadius: 20, padding: 3 }}>
          {['Day', 'Week', 'Month'].map(v => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              padding: '7px 18px', borderRadius: 18, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: viewMode === v ? 700 : 500,
              background: viewMode === v ? '#fff' : 'transparent',
              color: viewMode === v ? '#1B4332' : '#999',
              boxShadow: viewMode === v ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s',
            }}>{v}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: '#EBEBEB' }} />

        {/* Filter pills */}
        <div data-filter-dd style={{ position: 'relative' }}>
          <button onClick={() => { setShowStatusDD(!showStatusDD); setShowStaffDD(false) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: 'none', background: statusFilter !== 'all' ? '#1B433212' : '#F5F5F5', fontSize: 12, fontWeight: statusFilter !== 'all' ? 600 : 500, color: statusFilter !== 'all' ? '#1B4332' : '#777', cursor: 'pointer' }}>
            <FilterIcon /> {statusFilter === 'all' ? 'All status' : statusFilter} <ChevD />
          </button>
          {showStatusDD && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #E8E4DD', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 140, padding: '4px 0' }}>
              {['all', 'confirmed', 'pending', 'completed', 'no_show', 'cancelled'].map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setShowStatusDD(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', background: statusFilter === s ? '#1B433212' : 'transparent', fontSize: 12, fontWeight: statusFilter === s ? 600 : 400, color: statusFilter === s ? '#1B4332' : '#555', cursor: 'pointer' }}>
                  {s === 'all' ? 'All status' : s === 'no_show' ? 'No-show' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div data-filter-dd style={{ position: 'relative' }}>
          <button onClick={() => { setShowStaffDD(!showStaffDD); setShowStatusDD(false) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: 'none', background: staffFilter !== 'all' ? '#1B433212' : '#F5F5F5', fontSize: 12, fontWeight: staffFilter !== 'all' ? 600 : 500, color: staffFilter !== 'all' ? '#1B4332' : '#777', cursor: 'pointer' }}>
            <UsersIcon /> {staffFilter === 'all' ? 'All staff' : staffColumns.find(s => s.id === staffFilter)?.name || 'Staff'} <ChevD />
          </button>
          {showStaffDD && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #E8E4DD', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 160, padding: '4px 0' }}>
              <button onClick={() => { setStaffFilter('all'); setShowStaffDD(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', background: staffFilter === 'all' ? '#1B433212' : 'transparent', fontSize: 12, fontWeight: staffFilter === 'all' ? 600 : 400, color: staffFilter === 'all' ? '#1B4332' : '#555', cursor: 'pointer' }}>All staff</button>
              {staffColumns.map(s => (
                <button key={s.id} onClick={() => { setStaffFilter(s.id); setShowStaffDD(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', background: staffFilter === s.id ? '#1B433212' : 'transparent', fontSize: 12, fontWeight: staffFilter === s.id ? 600 : 400, color: staffFilter === s.id ? '#1B4332' : '#555', cursor: 'pointer' }}>{s.name}</button>
              ))}
            </div>
          )}
        </div>

        {/* Color mode */}
        <button onClick={() => setCm(cm === 'service' ? 'staff' : cm === 'staff' ? 'status' : 'service')} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, border: 'none', background: '#F5F5F5', fontSize: 12, fontWeight: 500, color: '#777', cursor: 'pointer',
        }}>
          <TagIcon /> {cm === 'service' ? 'Service' : cm === 'staff' ? 'Staff' : 'Status'}
        </button>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderRadius: 20, background: '#F5F5F5', height: 38, flex: 1, minWidth: 160 }}>
          <SearchIcon />
          <input value={calSearch} onChange={e => setCalSearch(e.target.value)} placeholder="Search clients, services..." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: '#1B4332', width: '100%', fontWeight: 500, fontFamily: "'Figtree', system-ui, sans-serif" }} />
        </div>

        {/* KPI toggle */}
        <button onClick={() => setShowKPI(!showKPI)} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, border: 'none',
          background: showKPI ? '#1B433212' : '#F5F5F5', fontSize: 12, fontWeight: 600,
          color: showKPI ? '#1B4332' : '#999', cursor: 'pointer',
        }}>
          <BarChartIcon /> Insights {showKPI ? <ChevU /> : <ChevD />}
        </button>

        {/* Bell */}
        <button style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#F5F5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', color: '#888' }}>
          <BellIcon />
          <div style={{ position: 'absolute', top: 6, right: 7, width: 8, height: 8, borderRadius: '50%', background: '#EF4444', border: '2px solid #F5F5F5' }} />
        </button>
      </div>

      {/* ═══ KPI STRIP ═══ */}
      <div style={{ maxHeight: showKPI ? 100 : 0, overflow: 'hidden', transition: 'max-height 0.3s cubic-bezier(0.22,1,0.36,1)', background: '#fff', borderBottom: showKPI ? '1px solid #EBEBEB' : 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, padding: '10px 16px' }}>
          {[
            { label: 'Total Appointments', value: String(bookings.length), change: '+12%', up: true, spark: [12,15,13,18,14,20,bookings.length || 22], color: '#1B4332' },
            { label: 'Completed', value: `${bookings.length ? Math.round(bookings.filter(b=>b.status==='completed').length/bookings.length*100) : 0}%`, change: '+8%', up: true, spark: [70,75,72,80,78,82,85], color: '#22C55E' },
            { label: 'No-show Rate', value: `${bookings.length ? Math.round(bookings.filter(b=>b.status==='no_show').length/bookings.length*100) : 0}%`, change: '+2%', up: false, spark: [5,4,6,5,8,6,7], color: '#EF4444' },
            { label: 'Revenue Today', value: `£${revenue}`, change: '+15%', up: true, spark: [800,950,870,1100,980,1050,revenue||1145], color: '#D4A574' },
          ].map((k, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #F0F0F0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#888', fontWeight: 500, marginBottom: 2 }}>{k.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#1B4332', lineHeight: 1 }}>{k.value}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: k.up ? '#22C55E' : '#EF4444', display: 'flex', alignItems: 'center', gap: 2 }}>
                    {k.up ? '↑' : '↓'}{k.change}
                  </span>
                </div>
              </div>
              <Spark data={k.spark} color={k.color} />
            </div>
          ))}
        </div>
      </div>

      {/* ═══ CALENDAR GRID ═══ */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #E5E5E5', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{ marginTop: 16, fontSize: 14, color: '#888' }}>Loading calendar...</p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Staff header */}
            <div style={{ display: 'flex', height: 60, borderBottom: '1px solid #EBEBEB', background: '#fff', flexShrink: 0, zIndex: 10 }}>
              <div style={{ width: TCW, flexShrink: 0 }} />
              {staffColumns.map(s => (
                <div key={s.id} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  borderLeft: '1px solid #EBEBEB',
                  background: hoverCol === s.id ? '#F0FAF4' : '#fff',
                  transition: 'background 0.15s ease',
                  borderBottom: hoverCol === s.id ? '2px solid #1B4332' : '2px solid transparent',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${s.color}`, padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: `linear-gradient(135deg,${s.color},${s.color}BB)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>{s.initials}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1B4332', lineHeight: 1.2 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#666', fontWeight: 600 }}>{filteredBookings.filter(b => b.staffId === s.id).length} bookings</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grid scroll area */}
            <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
              <div style={{ display: 'flex', minHeight: totHrs * HH }}>
                {/* Time column */}
                <div style={{ width: TCW, flexShrink: 0, position: 'sticky', left: 0, zIndex: 5, background: '#FFFFFF' }}>
                  {Array.from({ length: totHrs }, (_, i) => (
                    <div key={i} style={{ height: HH, position: 'relative', background: hoverRow === i ? '#F0FAF4' : 'transparent', transition: 'background 0.15s ease' }}>
                      <span style={{ position: 'absolute', top: -6, right: 6, fontSize: 11, fontWeight: hoverRow === i ? 700 : 600, color: hoverRow === i ? '#1B4332' : '#888', transition: 'all 0.15s ease' }}>{fmtAP(SH + i)}</span>
                    </div>
                  ))}
                  {isToday && tp > 0 && tp < totHrs * HH && (
                    <div style={{ position: 'absolute', top: tp - 8, left: 0, zIndex: 12, background: '#EF4444', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 5, boxShadow: '0 2px 6px rgba(239,68,68,0.25)' }}>{ts}</div>
                  )}
                </div>

                {/* Staff columns */}
                {staffColumns.map(staff => (
                  <div key={staff.id}
                    onMouseEnter={() => { setHovS(staff.id); setHoverCol(staff.id) }}
                    onMouseLeave={() => { setHovS(null); setHovSlot(null); setHoverCol(null); setHoverRow(null) }}
                    onMouseMove={e => {
                      const r = e.currentTarget.getBoundingClientRect()
                      const y = e.clientY - r.top + (scrollRef.current?.scrollTop || 0)
                      setHoverRow(Math.floor(y / HH))
                      if (hovS === staff.id && !hovA && !selA) setHovSlot(Math.floor(y / (HH / 2)) * (HH / 2))
                    }}
                    style={{
                      flex: 1, position: 'relative', borderLeft: '1px solid #EBEBEB',
                      background: hoverCol === staff.id ? 'rgba(27,67,50,0.015)' : 'transparent',
                      cursor: hovA ? 'pointer' : 'cell', transition: 'background 0.15s ease',
                    }}>
                    {Array.from({ length: totHrs }, (_, i) => (
                      <div key={i}>
                        <div style={{ position: 'absolute', top: i * HH, left: 0, right: 0, height: HH, background: hoverRow === i && hoverCol === staff.id ? 'rgba(27,67,50,0.04)' : hoverRow === i ? 'rgba(27,67,50,0.015)' : 'transparent', transition: 'background 0.15s ease', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', top: i * HH, left: 0, right: 0, height: 1, background: '#E5E5E5' }} />
                        <div style={{ position: 'absolute', top: i * HH + HH / 2, left: 0, right: 0, borderTop: '1px dashed #F0F0F0' }} />
                      </div>
                    ))}

                    {/* Hover slot indicator */}
                    {hovS === staff.id && !hovA && !selA && hovSlot !== null && (
                      <div style={{ position: 'absolute', top: hovSlot, left: 4, right: 4, height: HH / 2, borderRadius: 4, border: '2px dashed #D4A57440', background: '#D4A57406', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1 }}><PlusIcon size={16} /></div>
                    )}

                    {/* Break/meeting blocks */}
                    {blocks.filter(b => b.allStaff || b.staffId === staff.id).map((b, i) => (
                      <div key={`b${i}`} style={{
                        position: 'absolute', top: (b.start - SH) * HH + 1, left: 4, right: 4,
                        height: b.dur * HH - 2, borderRadius: 4,
                        background: b.type === 'meeting' ? 'repeating-linear-gradient(135deg,#D5D5D5,#D5D5D5 3px,#E8E8E8 3px,#E8E8E8 7px)' : '#ECECEC',
                        border: '1px solid #D0D0D0', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 2 }}>{b.label}</span>
                      </div>
                    ))}

                    {/* Booking blocks */}
                    {filteredBookings.filter(a => a.staffId === staff.id).map(a => <Bl key={a.id} a={a} />)}
                  </div>
                ))}

                {/* Current time line */}
                {isToday && tp > 0 && tp < totHrs * HH && (
                  <div style={{ position: 'absolute', top: tp, left: TCW - 3, right: 0, height: 2, background: '#EF4444', zIndex: 15, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: 0, top: -3.5, width: 9, height: 9, borderRadius: '50%', background: '#EF4444' }} />
                  </div>
                )}
              </div>

              {/* Empty state */}
              {filteredBookings.length === 0 && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><CalIcon /></div>
                    <p style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>No bookings for this date</p>
                    <p style={{ fontSize: 12, color: '#BBB', marginTop: 4 }}>Bookings will appear here as they come in</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ FAB ═══ */}
      <div data-fab="1" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 60 }}>
        {fabOpen && (
          <div style={{ position: 'absolute', bottom: 64, right: 0, width: 220, background: '#fff', borderRadius: 16, border: '1px solid #EBEBEB', boxShadow: '0 16px 48px rgba(0,0,0,0.16)', padding: 6 }}>
            {[
              { icon: <CalIcon />, label: 'New Appointment', color: '#1B4332' },
              { icon: <ClockIcon />, label: 'Add Time Reservation', color: '#6BA3C7' },
              { icon: <XIcon />, label: 'Add Time Off', color: '#EF4444' },
            ].map((item, i) => (
              <button key={i} onClick={() => { setShowBook(true); setFabOpen(false) }} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1B4332', textAlign: 'left',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: item.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>{item.icon}</div>
                {item.label}
              </button>
            ))}
          </div>
        )}
        <button onClick={e => { e.stopPropagation(); setFabOpen(!fabOpen) }} style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none', background: '#1B4332', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 20px rgba(27,67,50,0.35)', transition: 'all 0.2s', transform: fabOpen ? 'rotate(45deg)' : 'none',
        }}><PlusIcon /></button>
      </div>
    </div>
  )
}

export default Calendar
