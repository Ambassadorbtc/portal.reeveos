/**
 * ReeveOS Calendar v9 — Drag & Drop
 * Full drag-to-move (across time + staff columns) and drag-to-resize.
 * Built on top of v8 (polished Fresha-level design with live API data).
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import RestaurantCalendar from './RestaurantCalendar'
import AppLoader from '../../components/shared/AppLoader'

/* ───────────────────── Constants ───────────────────── */
const SH = 8, EH = 20, HH = 80, TCW = 52
const SNAP_MINS = 15
const SNAP_PX = HH * (SNAP_MINS / 60) // 20px per 15min

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
  walkin: { color: '#111111', label: 'Walk-in' },
}

/* ───────────────────── Helpers ───────────────────── */
const fmt = t => { const h = Math.floor(t), m = Math.round((t - h) * 60); return `${h}:${String(m).padStart(2, '0')}` }
const fmtAP = h => { const hr = h > 12 ? h - 12 : h === 0 ? 12 : h; return `${hr}${h >= 12 ? 'pm' : 'am'}` }
const gtp = () => { const n = new Date(); return Math.max(0, (n.getHours() + n.getMinutes() / 60 - SH) * HH) }
const gts = () => { const n = new Date(); return `${n.getHours()}:${String(n.getMinutes()).padStart(2, '0')}` }
const snapToGrid = (px) => Math.round(px / SNAP_PX) * SNAP_PX
const pxToTime = (px) => SH + px / HH
const timeToPx = (t) => (t - SH) * HH

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
const PhoneIcon = () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
const MailIcon = () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
const GripIcon = () => <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor" opacity="0.5"><circle cx="8" cy="4" r="2"/><circle cx="16" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/></svg>
const UndoIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
const RotateCcwIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
const CalendarPlusIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="20"/><line x1="9" y1="17" x2="15" y2="17"/></svg>

/* Mini sparkline */
const Spark = ({ data, color }) => {
  const w = 50, h = 16
  const max = Math.max(...data), min = Math.min(...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(' ')
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
const Calendar = () => {
  const { business, businessType, loading: bizLoading } = useBusiness()
  const bid = business?.id ?? business?._id

  /* ── Restaurant mode: use dedicated restaurant calendar ── */
  if (businessType === 'restaurant') {
    return <RestaurantCalendar />
  }

  /* ── Still loading business context ── */
  if (bizLoading) {
    return <AppLoader message="Loading..." size="md" />
  }

  /* ── SAFEGUARD: If user is logged in but got demo fallback, something failed.
       NEVER show salon demo to an authenticated user — show error instead. ── */
  if (false && localStorage.getItem('token')) {
    return (
      <div data-tour="calendar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: "'Figtree', sans-serif", color: '#111111' }}>
        <p style={{ fontSize: 18, fontWeight: 600 }}>Could not load your business</p>
        <p style={{ fontSize: 14, color: '#666', marginTop: 8 }}>Your session may have expired. Try refreshing or logging in again.</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', background: '#111111', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: "'Figtree', sans-serif" }}>Refresh</button>
          <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('refresh_token'); window.location.href = '/login' }} style={{ padding: '10px 24px', background: '#fff', color: '#111111', border: '2px solid #111111', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: "'Figtree', sans-serif" }}>Log in again</button>
        </div>
      </div>
    )
  }

  /* ── State ── */
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [viewMode, setViewMode] = useState('Day')
  const [cm, setCm] = useState('service')
  const [showBook, setShowBook] = useState(false)
  const [editingId, setEditingId] = useState(null) // null = new booking, string = editing existing
  const [cancelConfirm, setCancelConfirm] = useState(null) // booking id to cancel
  const [treatDrop, setTreatDrop] = useState(false)
  const [staffDrop, setStaffDrop] = useState(false)
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
  const gridRef = useRef(null)
  const calSeenIdsRef = useRef(new Set())
  const [newCalBookingIds, setNewCalBookingIds] = useState(new Set())

  /* ── Drag & Drop State ── */
  const [drag, setDrag] = useState(null)
  const dragRef = useRef(null)
  const [undoToast, setUndoToast] = useState(null)
  const staffColRefs = useRef({})

  const isRestaurant = businessType === 'restaurant'
  const isToday = selectedDate === new Date().toISOString().slice(0, 10)

  /* ── Add Booking Modal State ── */
  const [bookServices, setBookServices] = useState([])
  const [bookForm, setBookForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', serviceId: '', staffId: '', date: '', time: '', notes: '' })
  const [bookSaving, setBookSaving] = useState(false)
  const [bookError, setBookError] = useState('')
  const [selPackages, setSelPackages] = useState([])
  const [selClient, setSelClient] = useState(null)
  const [selAlerts, setSelAlerts] = useState([])
  const [showBlockTime, setShowBlockTime] = useState(false)
  const [blockForm, setBlockForm] = useState({ staff_id: '', start_time: '', end_time: '', preset: 'custom', reason: '' })
  const openBookModal = () => {
    setEditingId(null)
    setBookForm(f => ({ ...f, date: selectedDate, time: '', serviceId: '', staffId: '', customerName: '', customerPhone: '', customerEmail: '', notes: '' }))
    setBookError('')
    setShowBook(true)
    if (bid && bookServices.length === 0) {
      api.get(`/services-v2/business/${bid}`).then(r => {
        const svcs = (r.categories || []).flatMap(c => c.services || [])
        setBookServices(svcs)
      }).catch(() => {
        // Fallback to v1
        api.get(`/services/business/${bid}/services`).then(r => {
          setBookServices(Array.isArray(r) ? r : r.services || [])
        }).catch(() => {})
      })
    }
  }

  const submitBooking = async () => {
    if (!bookForm.customerName.trim()) { setBookError('Client name is required'); return }
    if (!bookForm.date || !bookForm.time) { setBookError('Date and time are required'); return }
    setBookSaving(true); setBookError('')
    try {
      const svc = bookServices.find(s => s.id === bookForm.serviceId || s._id === bookForm.serviceId)

      if (editingId) {
        // EDIT existing booking — service swap, time change, etc.
        await api.patch(`/bookings/business/${bid}/detail/${editingId}/edit`, {
          customerName: bookForm.customerName.trim(),
          phone: bookForm.customerPhone.trim(),
          email: bookForm.customerEmail.trim(),
          date: bookForm.date,
          time: bookForm.time,
          staffId: bookForm.staffId || undefined,
          serviceId: svc ? (svc.id || svc._id) : undefined,
          notes: bookForm.notes.trim(),
        })
      } else {
        // CREATE new booking
        await api.post(`/calendar/business/${bid}/booking`, {
          customerName: bookForm.customerName.trim(),
          customerPhone: bookForm.customerPhone.trim(),
          customerEmail: bookForm.customerEmail.trim(),
          date: bookForm.date,
          time: bookForm.time,
          staffId: bookForm.staffId || undefined,
          service: svc ? { id: svc.id || svc._id, name: svc.name, duration: svc.duration || 60, price: svc.price || 0 } : undefined,
          notes: bookForm.notes.trim(),
        })
      }
      setShowBook(false); setEditingId(null)
      fetchCalendarData(false)
    } catch (err) {
      setBookError(err?.message || (editingId ? 'Failed to update booking' : 'Failed to create booking'))
    }
    setBookSaving(false)
  }

  /* ── Fetch API data ── */
  const fetchCalendarData = useCallback((showLoading = true) => {
    if (!bid) {
      setLoading(false)
      setData({ staff: [], bookings: [], blocks: [] })
      return
    }
    if (showLoading) { setLoading(true); setError(null) }
    const endpoint = isRestaurant
      ? `/calendar/business/${bid}/restaurant?date=${selectedDate}&view=${viewMode.toLowerCase()}`
      : `/calendar/business/${bid}?date=${selectedDate}&view=${viewMode.toLowerCase()}`
    api.get(endpoint)
      .then(d => {
        // For restaurants: use tables as columns; for services: use staff
        const rawColumns = isRestaurant
          ? (d.tables || d.staff || [])
          : (d.staff || [])
        let staff = rawColumns.map((s, i) => ({
          ...s,
          id: s.id || String(i),
          color: s.color || STAFF_PALETTES[i % STAFF_PALETTES.length],
          initials: s.name ? s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?',
          full: s.full_name || s.name || s.zone || 'Table',
        }))
        // If restaurant has bookings but no tables, create a default column
        if (isRestaurant && staff.length === 0 && (d.bookings || []).length > 0) {
          staff = [{ id: '_unassigned', name: 'All Bookings', color: STAFF_PALETTES[0], initials: 'AB', full: 'All Bookings' }]
        }
        const bookings = (d.bookings || []).map(b => {
          const [h, m] = (b.time || '9:00').split(':').map(Number)
          const mappedStaffId = b.staffId || b.tableId || (staff[0]?.id)
          return {
            ...b,
            staffId: mappedStaffId,
            start: h + (m || 0) / 60,
            dur: (b.duration || 60) / 60,
            cat: b.category || b.service_type || 'default',
            customerName: b.customerName || b.customer_name || 'Walk-in',
          }
        })
        setData({ staff, bookings, blocks: d.blocks || [] })

        // Detect new bookings for animation
        if (calSeenIdsRef.current.size > 0) {
          const freshIds = new Set()
          bookings.forEach(b => { if (!calSeenIdsRef.current.has(b.id)) freshIds.add(b.id) })
          if (freshIds.size > 0) setNewCalBookingIds(freshIds)
        }
        bookings.forEach(b => calSeenIdsRef.current.add(b.id))
      })
      .catch(err => {
        console.error('Calendar fetch error:', err)
        setError('Could not load calendar')
      })
      .finally(() => setLoading(false))
  }, [bid, selectedDate, viewMode, isRestaurant])

  useEffect(() => {
    fetchCalendarData(true)
  }, [fetchCalendarData])

  // Live polling — refresh every 15 seconds without showing loading spinner
  useEffect(() => {
    if (!bid) return
    const interval = setInterval(() => fetchCalendarData(false), 15000)
    return () => clearInterval(interval)
  }, [fetchCalendarData, bid])

  // Clear new-booking animation after 3 seconds
  useEffect(() => {
    if (newCalBookingIds.size === 0) return
    const t = setTimeout(() => setNewCalBookingIds(new Set()), 3000)
    return () => clearTimeout(t)
  }, [newCalBookingIds])

  /* ── Fetch packages + CRM client when booking selected ── */
  useEffect(() => {
    if (!selA || !bid) { setSelPackages([]); setSelClient(null); setSelAlerts([]); return }
    const booking = (data?.bookings || []).find(b => b.id === selA)
    if (!booking?.customerId) { setSelPackages([]); setSelClient(null); setSelAlerts([]); return }
    // Packages
    api.get(`/packages/business/${bid}/client/${booking.customerId}`).then(r => {
      setSelPackages(r.packages || [])
    }).catch(() => setSelPackages([]))
    // CRM client detail — notes, visit history, consultation status
    api.get(`/crm/business/${bid}/client/${booking.customerId}`).then(r => {
      setSelClient(r)
    }).catch(() => setSelClient(null))
    // Staff alerts
    api.get(`/notes/business/${bid}/client/${booking.customerId}/alerts`).then(r => {
      setSelAlerts((r.alerts || []).filter(a => a.active !== false))
    }).catch(() => setSelAlerts([]))
  }, [selA, bid, data])

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

  const filteredBookings = bookings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (staffFilter !== 'all' && b.staffId !== staffFilter) return false
    if (calSearch) {
      const q = calSearch.toLowerCase()
      return (b.customerName || '').toLowerCase().includes(q) || (b.service || '').toLowerCase().includes(q)
    }
    return true
  })

  const gc = useCallback((a) => {
    // Priority: no_show=red, completed=grey, then service color, then fallback
    if (a.status === 'no_show') return '#EF4444'
    if (a.status === 'completed') return '#9CA3AF'
    if (cm === 'staff') {
      const s = staffColumns.find(s => s.id === a.staffId)
      return s?.color || '#999'
    }
    if (cm === 'status') return STATUS_MAP[a.status]?.color || '#999'
    // Service color from backend (primary) or category fallback
    return a.serviceColor || SERVICE_COLORS[a.cat] || SERVICE_COLORS.default
  }, [cm, staffColumns])

  const revenue = bookings.reduce((s, a) => s + (a.price || 0), 0)
  const totHrs = EH - SH

  /* ═══════════════════ DRAG & DROP LOGIC ═══════════════════ */

  const getStaffIdAtX = useCallback((clientX) => {
    for (const [sid, el] of Object.entries(staffColRefs.current)) {
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right) return sid
    }
    return null
  }, [])

  const getGridY = useCallback((clientY) => {
    if (!scrollRef.current) return 0
    const rect = scrollRef.current.getBoundingClientRect()
    return clientY - rect.top + scrollRef.current.scrollTop
  }, [])

  const startDragMove = useCallback((e, a) => {
    if (e.button !== 0) return
    const startX = e.clientX, startY = e.clientY
    const gridY = getGridY(startY)
    const blockTop = timeToPx(a.start)
    const offsetY = gridY - blockTop

    const onFirstMove = (me) => {
      const dx = me.clientX - startX, dy = me.clientY - startY
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
      window.removeEventListener('mousemove', onFirstMove)
      window.removeEventListener('mouseup', onFirstUp)
      const d = {
        id: a.id, type: 'move', offsetY,
        origStart: a.start, origDur: a.dur, origStaffId: a.staffId,
        ghostTop: blockTop, ghostH: a.dur * HH, ghostStaffId: a.staffId,
      }
      dragRef.current = d
      setDrag(d)
      setSelA(null)
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }
    const onFirstUp = () => {
      window.removeEventListener('mousemove', onFirstMove)
      window.removeEventListener('mouseup', onFirstUp)
    }
    window.addEventListener('mousemove', onFirstMove)
    window.addEventListener('mouseup', onFirstUp)
  }, [getGridY])

  const startDragResize = useCallback((e, a) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const d = {
      id: a.id, type: 'resize', offsetY: 0,
      origStart: a.start, origDur: a.dur, origStaffId: a.staffId,
      ghostTop: timeToPx(a.start), ghostH: a.dur * HH, ghostStaffId: a.staffId,
    }
    dragRef.current = d
    setDrag(d)
    setSelA(null)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current
      if (!d) return
      const gridY = getGridY(e.clientY)

      if (d.type === 'move') {
        const rawTop = gridY - d.offsetY
        const snappedTop = snapToGrid(Math.max(0, Math.min(rawTop, totHrs * HH - d.ghostH)))
        const newStaffId = getStaffIdAtX(e.clientX) || d.ghostStaffId
        const updated = { ...d, ghostTop: snappedTop, ghostStaffId: newStaffId }
        dragRef.current = updated
        setDrag(updated)
      } else if (d.type === 'resize') {
        const blockTop = d.ghostTop
        const rawBottom = gridY
        const minH = SNAP_PX
        const maxBottom = totHrs * HH
        const snappedH = snapToGrid(Math.max(minH, Math.min(rawBottom - blockTop, maxBottom - blockTop)))
        const updated = { ...d, ghostH: snappedH }
        dragRef.current = updated
        setDrag(updated)
      }
    }

    const onUp = () => {
      const d = dragRef.current
      if (!d) return

      const newStart = pxToTime(d.ghostTop)
      const newDur = d.ghostH / HH
      const newStaffId = d.type === 'move' ? d.ghostStaffId : d.origStaffId

      const changed = (
        Math.abs(newStart - d.origStart) > 0.01 ||
        Math.abs(newDur - d.origDur) > 0.01 ||
        newStaffId !== d.origStaffId
      )

      if (changed) {
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            bookings: prev.bookings.map(b =>
              b.id === d.id ? { ...b, start: newStart, dur: newDur, staffId: newStaffId } : b
            )
          }
        })

        const toastTimer = setTimeout(() => setUndoToast(null), 5000)
        setUndoToast({
          id: d.id, origStart: d.origStart, origDur: d.origDur, origStaffId: d.origStaffId,
          msg: d.type === 'move'
            ? `Moved to ${fmt(newStart)}${newStaffId !== d.origStaffId ? ' · ' + (staffColumns.find(s => s.id === newStaffId)?.name || '') : ''}`
            : `Resized to ${Math.round(newDur * 60)}min`,
          timer: toastTimer,
        })

        if (bid) {
          const timeStr = `${Math.floor(newStart)}:${String(Math.round((newStart % 1) * 60)).padStart(2, '0')}`
          api.patch(`/bookings/business/${bid}/detail/${d.id}/move`, {
            time: timeStr,
            duration: Math.round(newDur * 60),
            staffId: newStaffId,
          }).catch(err => {
            console.error('Failed to save drag change:', err)
            setData(prev => {
              if (!prev) return prev
              return {
                ...prev,
                bookings: prev.bookings.map(b =>
                  b.id === d.id ? { ...b, start: d.origStart, dur: d.origDur, staffId: d.origStaffId } : b
                )
              }
            })
          })
        }
      }

      dragRef.current = null
      setDrag(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    if (drag) {
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      return () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
    }
  }, [drag, totHrs, getGridY, getStaffIdAtX, staffColumns, bid])

  const handleUndo = useCallback(() => {
    if (!undoToast) return
    const { id, origStart, origDur, origStaffId, timer } = undoToast
    clearTimeout(timer)
    setData(prev => {
      if (!prev) return prev
      return { ...prev, bookings: prev.bookings.map(b => b.id === id ? { ...b, start: origStart, dur: origDur, staffId: origStaffId } : b) }
    })
    if (bid) {
      const timeStr = `${Math.floor(origStart)}:${String(Math.round((origStart % 1) * 60)).padStart(2, '0')}`
      api.patch(`/bookings/business/${bid}/detail/${id}/move`, { time: timeStr, duration: Math.round(origDur * 60), staffId: origStaffId }).catch(err => console.error('Undo API error:', err))
    }
    setUndoToast(null)
  }, [undoToast, bid])

  /* ── Popover ── */
  const Pop = ({ a }) => {
    const staff = staffColumns.find(s => s.id === a.staffId)
    const st = STATUS_MAP[a.status] || STATUS_MAP.confirmed
    const bg = gc(a)
    const [showResched, setShowResched] = useState(false)
    const [reschedSlots, setReschedSlots] = useState([])
    const [reschedLoading, setReschedLoading] = useState(false)
    const [reschedDate, setReschedDate] = useState(() => (a.date || selectedDate))
    const [reschedSaving, setReschedSaving] = useState(null)

    const fetchAvailability = (dateStr) => {
      if (!bid) return
      setReschedLoading(true)
      setReschedSlots([])
      const timeStr = fmt(a.start)
      api.get(`/rota/business/${bid}/available-staff?date=${dateStr}&time=${timeStr}`)
        .then(r => {
          const slots = r.slots || r.available || r.data || []
          setReschedSlots(Array.isArray(slots) ? slots : [])
        })
        .catch(() => setReschedSlots([]))
        .finally(() => setReschedLoading(false))
    }

    const handleReschedSelect = (slot) => {
      if (!bid || reschedSaving) return
      setReschedSaving(slot.time || slot.start_time)
      api.patch(`/bookings/business/${bid}/detail/${a.id}/edit`, {
        date: reschedDate,
        time: slot.time || slot.start_time,
        staffId: slot.staffId || slot.staff_id || a.staffId,
      }).then(() => {
        fetchCalendarData(false)
        setSelA(null)
      }).catch(err => console.error('Reschedule failed:', err))
        .finally(() => setReschedSaving(null))
    }

    const handleRebook = (weeks) => {
      const rebookDate = new Date()
      rebookDate.setDate(rebookDate.getDate() + weeks * 7)
      const dateStr = rebookDate.toISOString().slice(0, 10)
      const svcName = typeof a.service === 'object' ? a.service?.name : a.service
      const matchedSvc = bookServices.find(s => s.name === svcName)
      setEditingId(null)
      setBookForm({
        customerName: a.customerName || '',
        customerPhone: a.customerPhone || '',
        customerEmail: a.customerEmail || '',
        serviceId: matchedSvc ? (matchedSvc.id || matchedSvc._id) : '',
        staffId: a.staffId || '',
        date: dateStr,
        time: '',
        notes: '',
      })
      setBookError('')
      setShowBook(true)
      setSelA(null)
      if (bid && bookServices.length === 0) {
        api.get(`/services-v2/business/${bid}`).then(r => setBookServices((r.categories || []).flatMap(c => c.services || []))).catch(() => {})
      }
    }

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
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111111' }}>{a.customerName}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{typeof a.service === 'object' ? a.service?.name : a.service}</div>
            </div>
            <div style={{ padding: '4px 10px', borderRadius: 20, background: st.color + '12', fontSize: 10, fontWeight: 700, color: st.color }}>{st.label}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#888' }}><ClockIcon />{fmt(a.start)} - {fmt(a.start + a.dur)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#888' }}><UserIcon />{staff?.full || staff?.name}</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111111', marginBottom: 12 }}>£{a.price || 0}</div>
          {/* ── Client Details from CRM ── */}
          {(a.customerPhone || a.customerEmail) && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {a.customerPhone && <a href={`tel:${a.customerPhone}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666', textDecoration: 'none', padding: '3px 8px', background: '#F5F5F5', borderRadius: 6 }}><PhoneIcon />{a.customerPhone}</a>}
              {a.customerEmail && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666', padding: '3px 8px', background: '#F5F5F5', borderRadius: 6 }}><MailIcon />{a.customerEmail}</span>}
            </div>
          )}
          {selClient && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Visit count + lifetime spend */}
              <div style={{ display: 'flex', gap: 8 }}>
                {selClient.stats?.total_visits != null && (
                  <div style={{ flex: 1, padding: '7px 10px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #F0F0F0' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>Visits</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{selClient.stats.total_visits}</div>
                  </div>
                )}
                {selClient.ltv?.total != null && (
                  <div style={{ flex: 1, padding: '7px 10px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #F0F0F0' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>Lifetime</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>£{Math.round(selClient.ltv.total || 0)}</div>
                  </div>
                )}
                {selClient.pipeline_stage && (
                  <div style={{ flex: 1, padding: '7px 10px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #F0F0F0' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>Stage</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111', textTransform: 'capitalize' }}>{selClient.pipeline_stage?.replace(/_/g, ' ')}</div>
                  </div>
                )}
              </div>
              {/* Consultation form status */}
              {selClient.consultation_form_status && (
                <div style={{
                  padding: '7px 10px', borderRadius: 8,
                  background: selClient.consultation_form_status === 'valid' ? '#F0FDF4' : selClient.consultation_form_status === 'expiring_soon' ? '#FFFBEB' : selClient.consultation_form_status === 'expired' ? '#FEF2F2' : '#F9FAFB',
                  border: `1px solid ${selClient.consultation_form_status === 'valid' ? '#BBF7D0' : selClient.consultation_form_status === 'expiring_soon' ? '#FDE68A' : selClient.consultation_form_status === 'expired' ? '#FECACA' : '#F0F0F0'}`,
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
                  color: selClient.consultation_form_status === 'valid' ? '#15803D' : selClient.consultation_form_status === 'expiring_soon' ? '#92400E' : selClient.consultation_form_status === 'expired' ? '#DC2626' : '#666',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                  Consultation: {selClient.consultation_form_status === 'valid' ? 'Valid' : selClient.consultation_form_status === 'expiring_soon' ? 'Expiring soon — renewal needed' : selClient.consultation_form_status === 'expired' ? 'Expired — needs renewal' : selClient.consultation_form_status === 'none' ? 'Not completed' : selClient.consultation_form_status}
                </div>
              )}
              {/* Therapist / staff notes */}
              {selClient.client?.notes?.length > 0 && (
                <div style={{ padding: '7px 10px', background: '#F5F3FF', borderRadius: 8, border: '1px solid #DDD6FE', fontSize: 11, color: '#5B21B6', lineHeight: '16px' }}>
                  <strong>Staff notes:</strong> {Array.isArray(selClient.client.notes) ? selClient.client.notes.join(' · ') : selClient.client.notes}
                </div>
              )}
              {/* Preferences */}
              {selClient.preferences?.bed_setup && (
                <div style={{ padding: '7px 10px', background: '#FFF7ED', borderRadius: 8, border: '1px solid #FED7AA', fontSize: 11, color: '#9A3412', lineHeight: '16px' }}>
                  <strong>Preference:</strong> {selClient.preferences.bed_setup}
                </div>
              )}
              {/* Tags */}
              {selClient.client?.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {selClient.client.tags.map(t => (
                    <span key={t} style={{ padding: '2px 8px', background: t === 'VIP' ? '#C9A84C' : '#F0F0F0', color: t === 'VIP' ? '#fff' : '#666', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          {selAlerts.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {selAlerts.map((al, idx) => (
                <div key={al.id || idx} style={{ padding: '7px 10px', background: '#FEF9E7', borderRadius: 8, border: '1px solid #F9E79F', fontSize: 11, color: '#7D6608', lineHeight: '16px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div><strong style={{ fontWeight: 700 }}>Staff Alert{al.category ? ` (${al.category})` : ''}:</strong> {al.text}</div>
                </div>
              ))}
            </div>
          )}
          {selPackages.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selPackages.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #F0F0F0' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#111', letterSpacing: 0.3 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{p.used_sessions} of {p.total_sessions} used</div>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {Array.from({ length: p.total_sessions }, (_, i) => (
                      <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < p.used_sessions ? '#111' : '#E5E7EB' }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: p.remaining > 0 ? '#111' : '#EF4444' }}>{p.remaining}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #F0F0F0', paddingTop: 12 }}>
            <button onClick={() => {
              const svcName = typeof a.service === 'object' ? a.service?.name : a.service
              const matchedSvc = bookServices.find(s => s.name === svcName)
              setEditingId(a.id)
              setBookForm({
                customerName: a.customerName || '',
                customerPhone: a.customerPhone || '',
                customerEmail: a.customerEmail || '',
                serviceId: matchedSvc ? (matchedSvc.id || matchedSvc._id) : '',
                staffId: a.staffId || '',
                date: a.date || selectedDate,
                time: a.time ? fmt(a.start) : '',
                notes: a.notes || '',
              })
              setBookError('')
              setShowBook(true); setSelA(null)
              if (bid && bookServices.length === 0) {
                api.get(`/services-v2/business/${bid}`).then(r => setBookServices((r.categories || []).flatMap(c => c.services || []))).catch(() => {})
              }
            }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 0', borderRadius: 10, border: '1px solid #EBEBEB', background: '#fff', fontSize: 12, fontWeight: 600, color: '#111111', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}><EditIcon /> Edit</button>
            <button onClick={() => {
              setShowResched(prev => {
                if (!prev) fetchAvailability(reschedDate)
                return !prev
              })
            }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 0', borderRadius: 10, border: '1px solid #EBEBEB', background: '#fff', fontSize: 12, fontWeight: 600, color: '#111111', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}><RotateCcwIcon /> Reschedule</button>
            <button onClick={() => {
              const newStatus = a.status === 'checked_in' ? 'completed' : 'checked_in'
              api.patch(`/bookings/business/${bid}/detail/${a.id}/status`, { status: newStatus }).then(() => {
                fetchCalendarData(false); setSelA(null)
              }).catch(err => console.error('Status update failed:', err))
            }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 0', borderRadius: 10, border: 'none', background: '#111111', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(17,17,17,0.2)', fontFamily: "'Figtree', sans-serif" }}>
              <CheckIcon /> {a.status === 'checked_in' ? 'Complete' : 'Check In'}
            </button>
            <button onClick={() => {
              setCancelConfirm(a.id)
            }} style={{ width: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: '1px solid #EF444420', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer' }}><TrashIcon /></button>
          </div>
          {/* ── Reschedule availability panel ── */}
          {showResched && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #F0F0F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <RotateCcwIcon />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#111111', fontFamily: "'Figtree', sans-serif" }}>Available slots</span>
                <input
                  type="date"
                  value={reschedDate}
                  onChange={e => { setReschedDate(e.target.value); fetchAvailability(e.target.value) }}
                  style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#111111', border: '1px solid #E5E7EB', borderRadius: 6, padding: '3px 6px', fontFamily: "'Figtree', sans-serif", outline: 'none' }}
                />
              </div>
              {reschedLoading && (
                <div style={{ fontSize: 11, color: '#999', padding: '8px 0', textAlign: 'center', fontFamily: "'Figtree', sans-serif" }}>Loading availability...</div>
              )}
              {!reschedLoading && reschedSlots.length === 0 && (
                <div style={{ fontSize: 11, color: '#999', padding: '8px 0', textAlign: 'center', fontFamily: "'Figtree', sans-serif" }}>No available slots found</div>
              )}
              {!reschedLoading && reschedSlots.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {reschedSlots.map((slot, idx) => {
                    const slotTime = slot.time || slot.start_time || ''
                    const slotStaff = slot.staff_name || slot.staffName || ''
                    const isSaving = reschedSaving === slotTime
                    return (
                      <button
                        key={idx}
                        onClick={() => handleReschedSelect(slot)}
                        disabled={!!reschedSaving}
                        style={{
                          padding: '5px 10px', borderRadius: 20, border: '1px solid #E5E7EB',
                          background: isSaving ? '#111111' : '#fff', color: isSaving ? '#fff' : '#111111',
                          fontSize: 11, fontWeight: 700, cursor: reschedSaving ? 'wait' : 'pointer',
                          fontFamily: "'Figtree', sans-serif", display: 'flex', flexDirection: 'column',
                          alignItems: 'center', gap: 1, transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => { if (!reschedSaving) { e.currentTarget.style.background = '#111111'; e.currentTarget.style.color = '#fff' } }}
                        onMouseLeave={e => { if (!isSaving) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#111111' } }}
                      >
                        <span>{slotTime}</span>
                        {slotStaff && <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.7 }}>{slotStaff}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {/* ── Quick Rebook chips (shown when completed) ── */}
          {a.status === 'completed' && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0F0F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <CalendarPlusIcon />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#111111', fontFamily: "'Figtree', sans-serif" }}>Quick rebook</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[2, 4, 6, 8].map(w => (
                  <button
                    key={w}
                    onClick={() => handleRebook(w)}
                    style={{
                      padding: '5px 12px', borderRadius: 20, border: 'none',
                      background: '#F3F4F6', color: '#111111',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      fontFamily: "'Figtree', sans-serif", transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#111111'; e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#111111' }}
                  >
                    {w} weeks
                  </button>
                ))}
              </div>
            </div>
          )}
          {a.medicalAlert && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA', fontSize: 11, color: '#DC2626', lineHeight: '16px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div><strong>Medical update flagged</strong>{a.medicalAlertDesc ? ` — ${a.medicalAlertDesc}` : ''}</div>
            </div>
          )}
          {a.firstVisit && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE', fontSize: 11, color: '#1D4ED8', fontWeight: 600 }}>First visit — 15min consultation buffer added</div>
          )}
          {a.notes && <div style={{ marginTop: 8, padding: '8px 10px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A', fontSize: 11, color: '#92400E', lineHeight: '16px' }}>{a.notes}</div>}
        </div>
      </div>
    )
  }

  /* ── Booking Block with drag ── */
  const Bl = ({ a }) => {
    const isDragging = drag?.id === a.id
    const isNewBooking = newCalBookingIds.has(a.id)
    const top = isDragging ? drag.ghostTop : timeToPx(a.start)
    const h = isDragging ? drag.ghostH : a.dur * HH
    const bg = gc(a)
    const hov = hovA === a.id
    const sel = selA === a.id
    const done = a.status === 'completed'
    const minCardH = 64
    const cardH = Math.max(h - 2, minCardH)
    const isShort = h < minCardH + 2
    const tiny = cardH <= 38, sm = cardH <= 56

    if (isDragging && drag.type === 'move' && drag.ghostStaffId !== a.staffId) return null

    return (
      <>
        <div data-ap="1"
          onMouseEnter={() => !drag && setHovA(a.id)}
          onMouseLeave={() => !drag && setHovA(null)}
          onMouseDown={e => {
            if (e.target.closest('[data-resize]')) return
            startDragMove(e, a)
          }}
          onClick={e => {
            if (drag) return
            e.stopPropagation()
            setSelA(sel ? null : a.id)
          }}
          style={{
            position: 'absolute', top: top + 1, left: 4, right: 4, height: cardH,
            minHeight: minCardH,
            borderRadius: 6, background: done ? `${bg}60` : bg,
            opacity: isDragging ? 0.85 : done ? 0.7 : a.status === 'no_show' ? 0.55 : 1,
            cursor: isDragging ? 'grabbing' : 'grab',
            overflow: 'hidden', color: '#111',
            transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.22,1,0.36,1)',
            transform: isDragging ? 'scale(1.03)' : hov && !sel ? 'scale(1.012) translateY(-1px)' : 'none',
            animation: isNewBooking ? 'calendarPulse 0.6s ease-out' : 'none',
            boxShadow: isNewBooking ? `0 0 0 3px rgba(16,185,129,0.4), 0 8px 24px ${bg}25`
              : isDragging ? `0 12px 36px ${bg}40, 0 0 0 2px #fff, 0 0 0 4px ${bg}`
              : sel ? `0 0 0 2.5px #fff, 0 0 0 4.5px ${bg}, 0 8px 24px ${bg}25`
              : hov ? `0 8px 24px ${bg}30` : `0 2px 6px ${bg}12`,
            zIndex: isDragging ? 40 : sel ? 30 : hov ? 20 : isShort ? 5 : 2,
            padding: tiny ? '4px 8px' : sm ? '5px 9px' : '7px 11px',
            display: 'flex', flexDirection: 'column',
          }}>
          {!tiny && !isDragging && (
            <div style={{ position: 'absolute', top: 4, left: 6, opacity: hov ? 0.6 : 0, transition: 'opacity 0.15s' }}>
              <GripIcon />
            </div>
          )}
          {!tiny && <div style={{ position: 'absolute', top: 6, right: 7, opacity: 0.7 }}>{(a.status === 'confirmed' || a.status === 'completed') ? <SICheck s={10} c="#111" /> : a.status === 'pending' ? <SIClock s={10} c="#111" /> : null}</div>}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden' }}>
            {tiny ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
                <span style={{ fontSize: 9, opacity: 0.85, fontWeight: 600 }}>{fmt(isDragging ? pxToTime(drag.ghostTop) : a.start)}</span>
                <span style={{ fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{a.customerName}</span>
                {(a.price || 0) > 0 && <span style={{ fontSize: 8, fontWeight: 700, background: 'rgba(0,0,0,0.12)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>£{a.price}</span>}
              </div>
            ) : sm ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 9, opacity: 0.85, fontWeight: 600 }}>{fmt(isDragging ? pxToTime(drag.ghostTop) : a.start)}-{fmt((isDragging ? pxToTime(drag.ghostTop) : a.start) + (isDragging ? drag.ghostH / HH : a.dur))}</div>
                  {(a.price || 0) > 0 && <div style={{ fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,0.1)', borderRadius: 5, padding: '1px 6px' }}>£{a.price}</div>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.customerName}</div>
                <div style={{ fontSize: 10, opacity: 0.85, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeof a.service === 'object' ? a.service?.name : a.service}</div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <div style={{ fontSize: 9, opacity: 0.85, fontWeight: 700, letterSpacing: 0.3 }}>{fmt(isDragging ? pxToTime(drag.ghostTop) : a.start)} - {fmt((isDragging ? pxToTime(drag.ghostTop) : a.start) + (isDragging ? drag.ghostH / HH : a.dur))}</div>
                  {(a.price || 0) > 0 && <div style={{ fontSize: 11, fontWeight: 700, background: 'rgba(0,0,0,0.1)', borderRadius: 6, padding: '2px 8px' }}>£{a.price}</div>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.customerName}</div>
                <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeof a.service === 'object' ? a.service?.name : a.service}</div>
                {a.isNewClient && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 9, fontWeight: 800, letterSpacing: 1, background: 'linear-gradient(110deg, #111111 30%, #1a1a1a 50%, #111111 70%)', backgroundSize: '200% 100%', borderRadius: 20, padding: '4px 12px 4px 9px', textTransform: 'uppercase', width: 'fit-content', color: '#fff', animation: 'newPulse 2s ease-in-out infinite, shimmer 3s linear infinite', boxShadow: '0 2px 12px rgba(17,17,17,0.4)' }}><StarIcon /> New Client</span>}
                {a.status === 'completed' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 9, fontWeight: 800, letterSpacing: 1, background: '#22C55E', borderRadius: 20, padding: '4px 12px 4px 9px', textTransform: 'uppercase', width: 'fit-content', color: '#fff', boxShadow: '0 2px 8px rgba(34,197,94,0.3)' }}>✓ Completed</span>}
              </>
            )}
          </div>
          <div data-resize="1" onMouseDown={e => startDragResize(e, a)} style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 8,
            cursor: 'ns-resize', zIndex: 5,
            background: (hov || isDragging) ? `linear-gradient(transparent, ${bg}40)` : 'transparent',
            borderRadius: '0 0 6px 6px',
          }}>
            {(hov || isDragging) && (
              <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 20, height: 3, borderRadius: 2, background: '#00000030' }} />
            )}
          </div>
        </div>
        {sel && !isDragging && <Pop a={a} />}
      </>
    )
  }

  const DragGhost = () => {
    if (!drag || drag.type !== 'move') return null
    const a = bookings.find(b => b.id === drag.id)
    if (!a || a.staffId === drag.ghostStaffId) return null
    const bg = gc(a)
    return (
      <div style={{
        position: 'absolute', top: drag.ghostTop + 1, left: 4, right: 4,
        height: drag.ghostH - 2, borderRadius: 6,
        background: bg, opacity: 0.85,
        boxShadow: `0 12px 36px ${bg}40, 0 0 0 2px #fff, 0 0 0 4px ${bg}`,
        zIndex: 40, transform: 'scale(1.03)',
        padding: '7px 11px', color: '#111', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 9, opacity: 0.85, fontWeight: 700, letterSpacing: 0.3, marginBottom: 2 }}>
          {fmt(pxToTime(drag.ghostTop))} - {fmt(pxToTime(drag.ghostTop) + drag.ghostH / HH)}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>{a.customerName}</div>
        <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500 }}>{typeof a.service === 'object' ? a.service?.name : a.service}</div>
      </div>
    )
  }

  /* ═════════════════ RENDER ═════════════════ */
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', fontFamily: "'Figtree', system-ui, sans-serif", overflow: 'hidden' }}>
      <style>{`
        @keyframes newPulse{0%,100%{box-shadow:0 0 0 0 rgba(17,17,17,0.6)}50%{box-shadow:0 0 0 8px rgba(17,17,17,0)}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes toastIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>

      {/* ═══ TOP CONTROLS ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 8,
        background: '#fff', borderBottom: '1px solid #EBEBEB', flexShrink: 0, zIndex: 35, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#F5F5F5', borderRadius: 24, padding: '3px 4px' }}>
          <button onClick={goPrev} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111111', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}><ChevL /></button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111111', padding: '0 8px', whiteSpace: 'nowrap' }}>{dateLabel}</span>
          <button onClick={goNext} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111111', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}><ChevR /></button>
        </div>
        <button onClick={goToday} style={{ padding: '8px 18px', borderRadius: 20, border: 'none', background: isToday ? '#111111' : '#F5F5F5', color: isToday ? '#fff' : '#111111', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: isToday ? '0 2px 8px rgba(17,17,17,0.2)' : 'none' }}>Today</button>
        <div style={{ width: 1, height: 24, background: '#EBEBEB' }} />
        <div style={{ display: 'flex', background: '#F5F5F5', borderRadius: 20, padding: 3 }}>
          {['Day', 'Week', 'Month'].map(v => (
            <button key={v} onClick={() => setViewMode(v)} style={{ padding: '7px 18px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: viewMode === v ? 700 : 500, background: viewMode === v ? '#fff' : 'transparent', color: viewMode === v ? '#111111' : '#999', boxShadow: viewMode === v ? '0 2px 6px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.15s' }}>{v}</button>
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: '#EBEBEB' }} />
        <div data-filter-dd style={{ position: 'relative' }}>
          <button onClick={() => { setShowStatusDD(!showStatusDD); setShowStaffDD(false) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: 'none', background: statusFilter !== 'all' ? '#11111112' : '#F5F5F5', fontSize: 12, fontWeight: statusFilter !== 'all' ? 600 : 500, color: statusFilter !== 'all' ? '#111111' : '#777', cursor: 'pointer' }}>
            <FilterIcon /> {statusFilter === 'all' ? 'All status' : statusFilter} <ChevD />
          </button>
          {showStatusDD && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #E8E4DD', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 140, padding: '4px 0' }}>
              {['all', 'confirmed', 'pending', 'completed', 'no_show', 'cancelled'].map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setShowStatusDD(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', background: statusFilter === s ? '#11111112' : 'transparent', fontSize: 12, fontWeight: statusFilter === s ? 600 : 400, color: statusFilter === s ? '#111111' : '#555', cursor: 'pointer' }}>
                  {s === 'all' ? 'All status' : s === 'no_show' ? 'No-show' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div data-filter-dd style={{ position: 'relative' }}>
          <button onClick={() => { setShowStaffDD(!showStaffDD); setShowStatusDD(false) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: 'none', background: staffFilter !== 'all' ? '#11111112' : '#F5F5F5', fontSize: 12, fontWeight: staffFilter !== 'all' ? 600 : 500, color: staffFilter !== 'all' ? '#111111' : '#777', cursor: 'pointer' }}>
            <UsersIcon /> {staffFilter === 'all' ? 'All staff' : staffColumns.find(s => s.id === staffFilter)?.name || 'Staff'} <ChevD />
          </button>
          {showStaffDD && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #E8E4DD', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 160, padding: '4px 0' }}>
              <button onClick={() => { setStaffFilter('all'); setShowStaffDD(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', background: staffFilter === 'all' ? '#11111112' : 'transparent', fontSize: 12, fontWeight: staffFilter === 'all' ? 600 : 400, color: staffFilter === 'all' ? '#111111' : '#555', cursor: 'pointer' }}>All staff</button>
              {staffColumns.map(s => (
                <button key={s.id} onClick={() => { setStaffFilter(s.id); setShowStaffDD(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', background: staffFilter === s.id ? '#11111112' : 'transparent', fontSize: 12, fontWeight: staffFilter === s.id ? 600 : 400, color: staffFilter === s.id ? '#111111' : '#555', cursor: 'pointer' }}>{s.name}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setCm(cm === 'service' ? 'staff' : cm === 'staff' ? 'status' : 'service')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, border: 'none', background: '#F5F5F5', fontSize: 12, fontWeight: 500, color: '#777', cursor: 'pointer' }}>
          <TagIcon /> {cm === 'service' ? 'Service' : cm === 'staff' ? 'Staff' : 'Status'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderRadius: 20, background: '#F5F5F5', height: 38, flex: 1, minWidth: 160 }}>
          <SearchIcon />
          <input value={calSearch} onChange={e => setCalSearch(e.target.value)} placeholder="Search clients, services..." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: '#111111', width: '100%', fontWeight: 500, fontFamily: "'Figtree', system-ui, sans-serif" }} />
        </div>
        <button onClick={() => setShowBlockTime(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, border: 'none', background: '#F5F5F5', fontSize: 12, fontWeight: 500, color: '#777', cursor: 'pointer' }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg> Block Time
        </button>
        <button onClick={() => setShowKPI(!showKPI)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, border: 'none', background: showKPI ? '#11111112' : '#F5F5F5', fontSize: 12, fontWeight: 600, color: showKPI ? '#111111' : '#999', cursor: 'pointer' }}>
          <BarChartIcon /> Insights {showKPI ? <ChevU /> : <ChevD />}
        </button>
        <button style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#F5F5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', color: '#888' }}>
          <BellIcon />
          <div style={{ position: 'absolute', top: 6, right: 7, width: 8, height: 8, borderRadius: '50%', background: '#EF4444', border: '2px solid #F5F5F5' }} />
        </button>
      </div>

      {/* ═══ KPI STRIP ═══ */}
      <div style={{ maxHeight: showKPI ? 100 : 0, overflow: 'hidden', transition: 'max-height 0.3s cubic-bezier(0.22,1,0.36,1)', background: '#fff', borderBottom: showKPI ? '1px solid #EBEBEB' : 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, padding: '10px 16px' }}>
          {[
            { label: 'Total Appointments', value: String(bookings.length), change: '+12%', up: true, spark: [12,15,13,18,14,20,bookings.length || 22], color: '#111111' },
            { label: 'Completed', value: `${bookings.length ? Math.round(bookings.filter(b=>b.status==='completed').length/bookings.length*100) : 0}%`, change: '+8%', up: true, spark: [70,75,72,80,78,82,85], color: '#22C55E' },
            { label: 'No-show Rate', value: `${bookings.length ? Math.round(bookings.filter(b=>b.status==='no_show').length/bookings.length*100) : 0}%`, change: '+2%', up: false, spark: [5,4,6,5,8,6,7], color: '#EF4444' },
            { label: 'Revenue Today', value: `£${revenue}`, change: '+15%', up: true, spark: [800,950,870,1100,980,1050,revenue||1145], color: '#D4A574' },
          ].map((k, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #F0F0F0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#888', fontWeight: 500, marginBottom: 2 }}>{k.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#111111', lineHeight: 1 }}>{k.value}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: k.up ? '#22C55E' : '#EF4444', display: 'flex', alignItems: 'center', gap: 2 }}>{k.up ? '↑' : '↓'}{k.change}</span>
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
            <div style={{ width: 40, height: 40, border: '3px solid #E5E5E5', borderTopColor: '#111111', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{ marginTop: 16, fontSize: 14, color: '#888' }}>Loading calendar...</p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', height: 60, borderBottom: '1px solid #EBEBEB', background: '#fff', flexShrink: 0, zIndex: 10 }}>
              <div style={{ width: TCW, flexShrink: 0 }} />
              {staffColumns.map(s => (
                <div key={s.id} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  borderLeft: '1px solid #EBEBEB',
                  background: (hoverCol === s.id || drag?.ghostStaffId === s.id) ? '#F0FAF4' : '#fff',
                  transition: 'background 0.15s ease',
                  borderBottom: (hoverCol === s.id || drag?.ghostStaffId === s.id) ? '2px solid #111111' : '2px solid transparent',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${s.color}`, padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: `linear-gradient(135deg,${s.color},${s.color}BB)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>{s.initials}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111111', lineHeight: 1.2 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#666', fontWeight: 600 }}>{filteredBookings.filter(b => b.staffId === s.id).length} bookings</div>
                  </div>
                </div>
              ))}
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
              <div ref={gridRef} style={{ display: 'flex', minHeight: totHrs * HH }}>
                <div style={{ width: TCW, flexShrink: 0, position: 'sticky', left: 0, zIndex: 5, background: '#FFFFFF' }}>
                  {Array.from({ length: totHrs }, (_, i) => (
                    <div key={i} style={{ height: HH, position: 'relative', background: hoverRow === i ? '#F0FAF4' : 'transparent', transition: 'background 0.15s ease' }}>
                      <span style={{ position: 'absolute', top: -6, right: 6, fontSize: 11, fontWeight: hoverRow === i ? 700 : 600, color: hoverRow === i ? '#111111' : '#888', transition: 'all 0.15s ease' }}>{fmtAP(SH + i)}</span>
                    </div>
                  ))}
                  {isToday && tp > 0 && tp < totHrs * HH && (
                    <div style={{ position: 'absolute', top: tp - 8, left: 0, zIndex: 12, background: '#EF4444', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 5, boxShadow: '0 2px 6px rgba(239,68,68,0.25)' }}>{ts}</div>
                  )}
                </div>

                {staffColumns.map(staff => (
                  <div key={staff.id}
                    ref={el => { staffColRefs.current[staff.id] = el }}
                    onMouseEnter={() => { if (!drag) { setHovS(staff.id); setHoverCol(staff.id) } }}
                    onMouseLeave={() => { if (!drag) { setHovS(null); setHovSlot(null); setHoverCol(null); setHoverRow(null) } }}
                    onMouseMove={e => {
                      if (drag) return
                      const r = e.currentTarget.getBoundingClientRect()
                      const y = e.clientY - r.top + (scrollRef.current?.scrollTop || 0)
                      setHoverRow(Math.floor(y / HH))
                      if (hovS === staff.id && !hovA && !selA) setHovSlot(Math.floor(y / (HH / 2)) * (HH / 2))
                    }}
                    onClick={e => {
                      if (drag || hovA || selA) return
                      const r = e.currentTarget.getBoundingClientRect()
                      const y = e.clientY - r.top + (scrollRef.current?.scrollTop || 0)
                      const slotHour = SH + y / HH
                      const h = Math.floor(slotHour)
                      const m = Math.round((slotHour - h) * 60 / 15) * 15
                      const timeStr = `${String(h).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`
                      setEditingId(null)
                      setBookForm(f => ({ ...f, date: selectedDate, time: timeStr, staffId: staff.id, customerName: '', customerPhone: '', customerEmail: '', serviceId: '', notes: '' }))
                      setBookError('')
                      setShowBook(true)
                      if (bid && bookServices.length === 0) {
                        api.get(`/services-v2/business/${bid}`).then(r => setBookServices((r.categories || []).flatMap(c => c.services || []))).catch(() => {})
                      }
                    }}
                    style={{
                      flex: 1, position: 'relative', borderLeft: '1px solid #EBEBEB',
                      background: drag?.ghostStaffId === staff.id ? 'rgba(17,17,17,0.03)' : hoverCol === staff.id ? 'rgba(17,17,17,0.015)' : 'transparent',
                      cursor: drag ? (drag.type === 'resize' ? 'ns-resize' : 'grabbing') : hovA ? 'pointer' : 'cell',
                      transition: 'background 0.15s ease',
                    }}>
                    {Array.from({ length: totHrs }, (_, i) => (
                      <div key={i}>
                        <div style={{ position: 'absolute', top: i * HH, left: 0, right: 0, height: HH, background: hoverRow === i && hoverCol === staff.id ? 'rgba(17,17,17,0.04)' : hoverRow === i ? 'rgba(17,17,17,0.015)' : 'transparent', transition: 'background 0.15s ease', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', top: i * HH, left: 0, right: 0, height: 1, background: '#E5E5E5' }} />
                        <div style={{ position: 'absolute', top: i * HH + HH / 2, left: 0, right: 0, borderTop: '1px dashed #F0F0F0' }} />
                      </div>
                    ))}
                    {!drag && hovS === staff.id && !hovA && !selA && hovSlot !== null && (
                      <div style={{ position: 'absolute', top: hovSlot, left: 4, right: 4, height: HH / 2, borderRadius: 4, border: '2px dashed #D4A57440', background: '#D4A57406', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1 }}><PlusIcon size={16} /></div>
                    )}
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
                    {filteredBookings.filter(a => a.staffId === staff.id).map(a => <Bl key={a.id} a={a} />)}
                    {drag?.type === 'move' && drag.ghostStaffId === staff.id && (() => {
                      const a = bookings.find(b => b.id === drag.id)
                      if (!a || a.staffId === staff.id) return null
                      return <DragGhost />
                    })()}
                  </div>
                ))}

                {isToday && tp > 0 && tp < totHrs * HH && (
                  <div style={{ position: 'absolute', top: tp, left: TCW - 3, right: 0, height: 2, background: '#EF4444', zIndex: 15, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: 0, top: -3.5, width: 9, height: 9, borderRadius: '50%', background: '#EF4444' }} />
                  </div>
                )}
              </div>

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

      {/* ═══ UNDO TOAST ═══ */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
          background: '#111111', color: '#fff', borderRadius: 14,
          boxShadow: '0 12px 40px rgba(17,17,17,0.35)', zIndex: 100,
          animation: 'toastIn 0.25s ease-out', fontSize: 13, fontWeight: 600,
        }}>
          <span>{undoToast.msg}</span>
          <button onClick={handleUndo} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
          }}>
            <UndoIcon /> Undo
          </button>
          <button onClick={() => { clearTimeout(undoToast.timer); setUndoToast(null) }} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4,
          }}>
            <XIcon />
          </button>
        </div>
      )}

      {/* ═══ ADD BOOKING — SIDE PANEL ═══ */}
      {showBook && <div onClick={() => setShowBook(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 200 }} />}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '90vw',
        background: '#fff', zIndex: 201, boxShadow: showBook ? '0 8px 40px rgba(0,0,0,0.15)' : 'none',
        transform: showBook ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
        display: 'flex', flexDirection: 'column', fontFamily: "'Figtree', sans-serif",
        borderLeft: '1px solid #EBEBEB',
        pointerEvents: showBook ? 'auto' : 'none',
      }}>
        <div style={{ height: 60, borderBottom: '1px solid #EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#FAFAFA', flexShrink: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111' }}>{editingId ? 'Edit Appointment' : 'New Appointment'}</h3>
          <button onClick={() => setShowBook(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#999' }}><XIcon /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Client Name *</label>
            <input value={bookForm.customerName} onChange={e => setBookForm(f => ({ ...f, customerName: e.target.value }))} placeholder="Full name" style={{ width: '100%', padding: '10px 12px', border: '1px solid #E0E0E0', borderRadius: 10, fontSize: 14, fontFamily: "'Figtree', sans-serif", marginTop: 4, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Phone</label>
              <input value={bookForm.customerPhone} onChange={e => setBookForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="07..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #E0E0E0', borderRadius: 10, fontSize: 14, fontFamily: "'Figtree', sans-serif", marginTop: 4, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</label>
              <input value={bookForm.customerEmail} onChange={e => setBookForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="client@email.com" style={{ width: '100%', padding: '10px 12px', border: '1px solid #E0E0E0', borderRadius: 10, fontSize: 14, fontFamily: "'Figtree', sans-serif", marginTop: 4, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Treatment</label>
            <div style={{ position: 'relative', marginTop: 4 }}>
              <div onClick={() => { setTreatDrop(!treatDrop); setStaffDrop(false) }} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E0E0E0', borderRadius: 10, fontSize: 14, fontFamily: "'Figtree', sans-serif", background: '#FAFAF8', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', color: bookForm.serviceId ? '#111' : '#999' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookForm.serviceId ? (bookServices.find(s => (s.id || s._id) === bookForm.serviceId)?.name || 'Select treatment...') : 'Select treatment...'}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {treatDrop && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #EBEBEB', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 220, overflowY: 'auto', padding: 4 }}>
                  {bookServices.map(s => (
                    <div key={s.id || s._id} onClick={() => { setBookForm(f => ({ ...f, serviceId: s.id || s._id })); setTreatDrop(false) }}
                      style={{ padding: '10px 12px', fontSize: 13, fontFamily: "'Figtree', sans-serif", cursor: 'pointer', borderRadius: 8, background: bookForm.serviceId === (s.id || s._id) ? '#F5F5F5' : 'transparent', fontWeight: bookForm.serviceId === (s.id || s._id) ? 600 : 400, color: '#111', display: 'flex', justifyContent: 'space-between' }}
                      onMouseOver={e => e.currentTarget.style.background = '#F5F5F5'} onMouseOut={e => { if (bookForm.serviceId !== (s.id || s._id)) e.currentTarget.style.background = 'transparent' }}>
                      <span>{s.name}</span>
                      <span style={{ color: '#888', fontSize: 12 }}>£{s.price || 0} · {s.duration || 60}min</span>
                    </div>
                  ))}
                  {bookServices.length === 0 && <div style={{ padding: '10px 12px', fontSize: 13, color: '#999' }}>No treatments found</div>}
                </div>
              )}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Therapist</label>
            <div style={{ position: 'relative', marginTop: 4 }}>
              <div onClick={() => { setStaffDrop(!staffDrop); setTreatDrop(false) }} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E0E0E0', borderRadius: 10, fontSize: 14, fontFamily: "'Figtree', sans-serif", background: '#FAFAF8', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', color: bookForm.staffId ? '#111' : '#999' }}>
                <span>{bookForm.staffId ? ((data?.staff || []).find(s => s.id === bookForm.staffId)?.name || 'Any available') : 'Any available'}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {staffDrop && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #EBEBEB', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 200, overflowY: 'auto', padding: 4 }}>
                  <div onClick={() => { setBookForm(f => ({ ...f, staffId: '' })); setStaffDrop(false) }} style={{ padding: '10px 12px', fontSize: 13, color: '#999', cursor: 'pointer', borderRadius: 8, fontFamily: "'Figtree', sans-serif" }} onMouseOver={e => e.currentTarget.style.background = '#F5F5F5'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>Any available</div>
                  {(data?.staff || []).map(s => (
                    <div key={s.id} onClick={() => { setBookForm(f => ({ ...f, staffId: s.id })); setStaffDrop(false) }}
                      style={{ padding: '10px 12px', fontSize: 13, fontFamily: "'Figtree', sans-serif", cursor: 'pointer', borderRadius: 8, background: bookForm.staffId === s.id ? '#F5F5F5' : 'transparent', fontWeight: bookForm.staffId === s.id ? 600 : 400, color: '#111' }}
                      onMouseOver={e => e.currentTarget.style.background = '#F5F5F5'} onMouseOut={e => { if (bookForm.staffId !== s.id) e.currentTarget.style.background = 'transparent' }}>
                      {s.full || s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Date *</label>
              <input type="date" value={bookForm.date} onChange={e => setBookForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E0E0E0', borderRadius: 10, fontSize: 14, fontFamily: "'Figtree', sans-serif", marginTop: 4, outline: 'none', boxSizing: 'border-box', colorScheme: 'light', WebkitAppearance: 'none', background: '#FAFAF8' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Time *</label>
              <input type="time" value={bookForm.time} onChange={e => setBookForm(f => ({ ...f, time: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E0E0E0', borderRadius: 10, fontSize: 14, fontFamily: "'Figtree', sans-serif", marginTop: 4, outline: 'none', boxSizing: 'border-box', colorScheme: 'light', WebkitAppearance: 'none', background: '#FAFAF8' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes</label>
            <textarea value={bookForm.notes} onChange={e => setBookForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #E0E0E0', borderRadius: 10, fontSize: 14, fontFamily: "'Figtree', sans-serif", marginTop: 4, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
        {bookError && <p style={{ color: '#DC2626', fontSize: 13, fontWeight: 600, margin: 0, padding: '0 20px 8px' }}>{bookError}</p>}
        <div style={{ padding: '12px 20px 20px', borderTop: '1px solid #EBEBEB', flexShrink: 0, background: '#FAFAFA' }}>
          <button onClick={submitBooking} disabled={bookSaving} style={{ width: '100%', padding: '12px 0', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: bookSaving ? 'wait' : 'pointer', fontFamily: "'Figtree', sans-serif", opacity: bookSaving ? 0.6 : 1 }}>
            {bookSaving ? (editingId ? 'Saving...' : 'Creating...') : (editingId ? 'Save Changes' : 'Create Appointment')}
          </button>
        </div>
      </div>

      {/* ═══ CANCEL CONFIRMATION MODAL ═══ */}
      {cancelConfirm && (
        <>
          <div onClick={() => setCancelConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9998 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, background: '#fff', borderRadius: 20, padding: '32px 28px 24px', width: 380, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: "'Figtree', sans-serif" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>Cancel appointment?</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4, lineHeight: '18px' }}>This will cancel the appointment and notify the client. This action is logged and cannot be undone.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCancelConfirm(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid #EBEBEB', background: '#fff', fontSize: 14, fontWeight: 600, color: '#111', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>Keep appointment</button>
              <button onClick={() => {
                api.patch(`/bookings/business/${bid}/detail/${cancelConfirm}/status`, { status: 'cancelled' }).then(() => {
                  fetchCalendarData(false); setSelA(null); setCancelConfirm(null)
                }).catch(err => { console.error('Cancel failed:', err); setCancelConfirm(null) })
              }} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#EF4444', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: "'Figtree', sans-serif", boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}>Cancel appointment</button>
            </div>
          </div>
        </>
      )}

      {/* ── Block Time Modal ── */}
      {showBlockTime && (
        <>
          <div onClick={() => setShowBlockTime(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9998 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, background: '#fff', borderRadius: 20, padding: '28px', width: 420, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: "'Figtree', sans-serif" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 20 }}>Block Time</div>
            {/* Presets */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {[{ id: 'lunch', label: 'Lunch', start: '12:00', end: '13:00' }, { id: 'staff_meeting', label: 'Staff Meeting', start: '09:00', end: '10:00' }, { id: 'training', label: 'Training', start: '14:00', end: '16:00' }, { id: 'personal', label: 'Personal', start: '10:00', end: '11:00' }, { id: 'custom', label: 'Custom', start: '', end: '' }].map(p => (
                <button key={p.id} onClick={() => setBlockForm(f => ({ ...f, preset: p.id, start_time: p.start, end_time: p.end, reason: p.id === 'custom' ? f.reason : p.label }))} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: blockForm.preset === p.id ? '#111' : '#fff', color: blockForm.preset === p.id ? '#fff' : '#666', borderColor: blockForm.preset === p.id ? '#111' : '#E5E7EB' }}>{p.label}</button>
              ))}
            </div>
            {/* Staff */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 6 }}>Staff member</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {staffColumns.map(s => (
                  <button key={s.id} onClick={() => setBlockForm(f => ({ ...f, staff_id: s.id }))} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: blockForm.staff_id === s.id ? '#111' : '#fff', color: blockForm.staff_id === s.id ? '#fff' : '#666', borderColor: blockForm.staff_id === s.id ? '#111' : '#E5E7EB' }}>{s.name}</button>
                ))}
              </div>
            </div>
            {/* Times */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 6 }}>Start</label>
                <input type="text" placeholder="09:00" value={blockForm.start_time} onChange={e => setBlockForm(f => ({ ...f, start_time: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14, fontFamily: "'Figtree', sans-serif" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 6 }}>End</label>
                <input type="text" placeholder="17:00" value={blockForm.end_time} onChange={e => setBlockForm(f => ({ ...f, end_time: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14, fontFamily: "'Figtree', sans-serif" }} />
              </div>
            </div>
            {blockForm.preset === 'custom' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 6 }}>Reason</label>
                <input type="text" placeholder="e.g. Dentist appointment" value={blockForm.reason} onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14, fontFamily: "'Figtree', sans-serif" }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowBlockTime(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid #EBEBEB', background: '#fff', fontSize: 14, fontWeight: 600, color: '#111', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>Cancel</button>
              <button onClick={async () => {
                if (!blockForm.staff_id || !blockForm.start_time || !blockForm.end_time) return
                try {
                  await api.post(`/blocked-times/business/${bid}`, { staff_id: blockForm.staff_id, date: selectedDate, start_time: blockForm.start_time, end_time: blockForm.end_time, preset: blockForm.preset, reason: blockForm.reason || blockForm.preset })
                  setShowBlockTime(false)
                  fetchCalendarData(false)
                } catch (err) { console.error('Block time failed:', err) }
              }} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#111', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: "'Figtree', sans-serif", boxShadow: '0 2px 8px rgba(17,17,17,0.2)' }}>Block Time</button>
            </div>
          </div>
        </>
      )}

      {/* FAB handled by SupportBot — includes New Appointment, Walk-in, Chat Support */}
    </div>
  )
}

export default Calendar
