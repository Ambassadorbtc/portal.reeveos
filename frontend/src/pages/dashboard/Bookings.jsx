import AppLoader from "../../components/shared/AppLoader"
/**
 * Bookings — Card-based browse view matching UXPilot Browse design
 */

import { useState, useEffect, useRef, useCallback, Component } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, ChevronRight, RefreshCw, Download, X, Check, Users, Armchair, Phone, Mail, Cake, Pencil, SlidersHorizontal, Clock, Calendar, Save, AlertTriangle, ExternalLink } from 'lucide-react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

/* ── Error Boundary: catches ANY React render crash in the detail panel ── */
class DetailErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err) { console.error('Booking detail crash:', err) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <p className="text-gray-500 mb-4">Could not load booking details.</p>
          <button onClick={() => { this.setState({ hasError: false }); this.props.onClose?.() }}
            className="px-6 py-2 bg-[#111] text-white rounded-lg text-sm font-bold">Close</button>
        </div>
      )
    }
    return this.props.children
  }
}

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100', bar: 'bg-emerald-500' },
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', bar: 'bg-amber-400' },
  checked_in: { label: 'In Progress', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', bar: 'bg-blue-500' },
  completed: { label: 'Finished', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', bar: 'bg-gray-400' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100', bar: 'bg-red-400' },
  no_show: { label: 'No-show', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100', bar: 'bg-red-500' },
  late: { label: 'Late', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-100', bar: 'bg-yellow-400' },
  waitlist: { label: 'Waitlist', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', bar: 'bg-gray-300' },
}

const AVATAR_COLORS = [
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-green-100', text: 'text-green-700' },
  { bg: 'bg-pink-100', text: 'text-pink-600' },
  { bg: 'bg-gray-800', text: 'text-white' },
]

const getInitials = (name) => {
  if (!name) return '??'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[5]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const formatTime = (timeStr) => {
  if (!timeStr) return '—'
  const parts = timeStr.split(' ')
  const timePart = parts.length > 1 && parts[parts.length - 1].includes(':') ? parts[parts.length - 1] : parts[0]
  if (timePart.includes(':')) {
    const [h, m] = timePart.split(':').map(Number)
    if (isNaN(h)) return timeStr
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  }
  return timeStr
}

const Bookings = () => {
  const { business, businessType, loading: bizLoading } = useBusiness()
  const isRestaurant = businessType === 'restaurant'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [bookings, setBookings] = useState([])
  const [pagination, setPagination] = useState({})
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(searchParams.get('status') || 'all')
  const [search, setSearch] = useState('')
  const [searchDebounce, setSearchDebounce] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailClient, setDetailClient] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editFields, setEditFields] = useState({})
  const [rescheduleMode, setRescheduleMode] = useState(false)
  const [rescheduleFields, setRescheduleFields] = useState({})
  const [cancelConfirm, setCancelConfirm] = useState(null)
  const [saving, setSaving] = useState(false)

  const bookingId = searchParams.get('booking')
  const bid = business?.id ?? business?._id
  const seenIdsRef = useRef(new Set())
  const [newBookingIds, setNewBookingIds] = useState(new Set())

  const fetchBookings = async (silent = false) => {
    if (!bid) { setLoading(false); return }
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', '1'); params.set('limit', '50')
      // When viewing history or all, fetch 'all' statuses from API
      // When waitlist tab, still fetch all (client-side filters)
      params.set('status', 'all')
      if (searchDebounce) params.set('search', searchDebounce)
      const res = await api.get(`/bookings/business/${bid}?${params}`)
      const fetched = res.bookings || []

      // Detect new bookings for animation
      if (seenIdsRef.current.size > 0) {
        const freshIds = new Set()
        fetched.forEach(b => {
          if (!seenIdsRef.current.has(b.id)) freshIds.add(b.id)
        })
        if (freshIds.size > 0) setNewBookingIds(freshIds)
      }
      // Track all seen IDs
      fetched.forEach(b => seenIdsRef.current.add(b.id))

      setBookings(fetched); setPagination(res.pagination || {}); setCounts(res.counts || {})
    } catch (err) { console.error('Failed to fetch bookings:', err) }
    finally { if (!silent) setLoading(false) }
  }

  const fetchDetail = async (id) => {
    if (!bid || !id) return
    setDetailLoading(true)
    try {
      const res = await api.get(`/bookings/business/${bid}/detail/${id}`)
      const b = res?.booking || res || null
      if (b) {
        // Backend returns service/staff/customer as OBJECTS — extract strings
        const serviceName = typeof b.service === 'object' ? b.service?.name : (b.service || b.serviceName || b.service_name || '')
        const servicePrice = typeof b.service === 'object' ? b.service?.price : b.servicePrice
        const serviceDuration = typeof b.service === 'object' ? b.service?.duration : b.serviceDuration
        const staffName = typeof b.staff === 'object' ? b.staff?.name : (b.staffName || b.staff_name || 'Any available')
        const custName = typeof b.customer === 'object' ? b.customer?.name : (b.customerName || b.customer_name || 'Unknown')
        const custPhone = typeof b.customer === 'object' ? b.customer?.phone : (b.customerPhone || b.phone || '')
        const custEmail = typeof b.customer === 'object' ? b.customer?.email : (b.customerEmail || b.email || '')

        setDetail({
          ...b,
          id: b.id || b._id || id,
          status: b.status || 'pending',
          reference: b.reference || b.id || b._id || '',
          customerName: custName,
          date: b.date || b.booking_date || '',
          time: b.time || b.start_time || '',
          service: serviceName,
          servicePrice: servicePrice,
          serviceDuration: serviceDuration,
          staffName: staffName,
          notes: b.notes || '',
          customer: { name: custName, phone: custPhone, email: custEmail },
        })
        // Fetch CRM client detail for rich info
        const custId = b.customerId || b.customer_id
        if (custId && bid) {
          api.get(`/crm/business/${bid}/client/${custId}`).then(r => setDetailClient(r)).catch(() => setDetailClient(null))
        } else {
          setDetailClient(null)
        }
      } else {
        setDetail(null)
      }
    }
    catch (e) { console.error('Failed to load booking detail:', e); setDetail(null) }
    finally { setDetailLoading(false) }
  }

  const updateStatus = async (id, newStatus) => {
    if (!bid || !id) return
    setUpdating(true)
    try {
      await api.patch(`/bookings/business/${bid}/detail/${id}/status`, { status: newStatus })
      fetchBookings()
      if (detail?.id === id) setDetail(d => d ? { ...d, status: newStatus } : null)
      if (newStatus === 'cancelled') setCancelConfirm(null)
    } catch (err) { alert(err.message || 'Failed to update') }
    finally { setUpdating(false) }
  }

  const startEdit = () => {
    if (!detail) return
    setEditFields({
      customerName: detail.customerName || '',
      phone: detail.customer?.phone || '',
      email: detail.customer?.email || '',
      notes: detail.notes || '',
    })
    setEditMode(true)
    setRescheduleMode(false)
  }

  const saveEdit = async () => {
    if (!bid || !detail?.id) return
    setSaving(true)
    try {
      await api.patch(`/bookings/business/${bid}/detail/${detail.id}/edit`, editFields)
      setDetail(d => d ? { ...d, ...editFields, customerName: editFields.customerName, customer: { ...d.customer, name: editFields.customerName, phone: editFields.phone, email: editFields.email } } : null)
      setEditMode(false)
      fetchBookings()
    } catch (err) { alert(err.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  const startReschedule = () => {
    if (!detail) return
    setRescheduleFields({ date: detail.date || '', time: detail.time || '' })
    setRescheduleMode(true)
    setEditMode(false)
  }

  const saveReschedule = async () => {
    if (!bid || !detail?.id) return
    setSaving(true)
    try {
      await api.patch(`/bookings/business/${bid}/detail/${detail.id}/move`, rescheduleFields)
      setDetail(d => d ? { ...d, date: rescheduleFields.date, time: rescheduleFields.time } : null)
      setRescheduleMode(false)
      fetchBookings()
    } catch (err) { alert(err.message || 'Failed to reschedule') }
    finally { setSaving(false) }
  }

  const confirmCancel = (id) => { setCancelConfirm(id) }
  const doCancel = () => { if (cancelConfirm) updateStatus(cancelConfirm, 'cancelled') }

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 300); return () => clearTimeout(t) }, [search])
  useEffect(() => { if (bid) fetchBookings(false) }, [bid, activeTab, searchDebounce])
  useEffect(() => { if (bookingId && bid) fetchDetail(bookingId); else if (!bookingId) setDetail(null) }, [bookingId, bid])

  // Live polling — silently refresh every 15 seconds
  useEffect(() => {
    if (!bid) return
    const interval = setInterval(() => fetchBookings(true), 15000)
    return () => clearInterval(interval)
  }, [bid, status, searchDebounce])

  // Clear new-booking animation after 3 seconds
  useEffect(() => {
    if (newBookingIds.size === 0) return
    const t = setTimeout(() => setNewBookingIds(new Set()), 3000)
    return () => clearTimeout(t)
  }, [newBookingIds])

  const openDetail = (id) => setSearchParams({ booking: id })
  const closeDetail = () => { setDetail(null); setDetailClient(null); setEditMode(false); setRescheduleMode(false); setSearchParams({}) }

  const displayBookings = bookings.filter(b => {
    // Tab filtering
    if (activeTab === 'waitlist') return b.status === 'waitlist'
    if (activeTab === 'history') return ['completed', 'cancelled', 'no_show'].includes(b.status)
    // 'all' tab: show everything except waitlist (waitlist has its own tab)
    if (activeTab === 'all') return b.status !== 'waitlist'
    return true
  }).filter(b => {
    // Search filtering (client-side on top of API search)
    if (!search) return true
    const q = search.toLowerCase()
    const name = (typeof b.customer === 'object' ? b.customer?.name : b.customerName) || ''
    const phone = (typeof b.customer === 'object' ? b.customer?.phone : b.customerPhone) || ''
    const svc = (typeof b.service === 'object' ? b.service?.name : b.service) || ''
    return name.toLowerCase().includes(q) || phone.includes(q) || svc.toLowerCase().includes(q)
  })

  const STATUS_LABELS = {
    checked_in: isRestaurant ? 'Seated' : 'In Treatment',
    seat_action: isRestaurant ? 'Seat' : 'Check In',
    checkout_action: isRestaurant ? 'Checkout' : 'Complete',
    guest_label: isRestaurant ? 'Guests' : 'Client',
    table_label: isRestaurant ? 'Table' : 'Therapist',
  }

  const getPrimaryAction = (b) => {
    const s = b.status
    if (s === 'confirmed' || s === 'late') return { label: STATUS_LABELS.seat_action, action: () => updateStatus(b.id, 'checked_in') }
    if (s === 'pending') return { label: 'Confirm', action: () => updateStatus(b.id, 'confirmed') }
    if (s === 'waitlist') return { label: 'Notify', action: null, outline: true }
    if (s === 'checked_in') return { label: STATUS_LABELS.checkout_action, action: () => updateStatus(b.id, 'completed') }
    return null
  }

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]">
      {/* Search & Controls */}
      <div className="px-6 md:px-8 pt-6 pb-4 space-y-4 shrink-0">
        <div className="relative max-w-2xl flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder={isRestaurant ? "Search by guest name, phone..." : "Search by client name, phone..."} value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-[#111111]/15 focus:border-[#111111]/30 text-sm font-medium transition-all"
              style={{ fontFamily: "'Figtree', sans-serif" }} />
          </div>
          <button className="md:hidden bg-white border border-gray-200 text-gray-600 px-4 rounded-full shadow-sm hover:bg-gray-50"><SlidersHorizontal className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-1.5">
            {['all', 'waitlist', 'history'].map(t => {
              const count = t === 'all' ? bookings.filter(b => b.status !== 'waitlist').length
                : t === 'waitlist' ? bookings.filter(b => b.status === 'waitlist').length
                : bookings.filter(b => ['completed', 'cancelled', 'no_show'].includes(b.status)).length
              return (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all ${
                  activeTab === t
                    ? 'bg-[#111111] text-white shadow-lg shadow-[#111111]/20'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                style={{ fontFamily: "'Figtree', sans-serif" }}>
                {t === 'all' ? 'All Bookings' : t === 'waitlist' ? 'Waitlist' : 'History'}
                {count > 0 && <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === t ? 'bg-white/20' : 'bg-gray-200 text-gray-500'}`}>{count}</span>}
              </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button onClick={fetchBookings} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#111111] hover:bg-[#111111]/5 transition-colors" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
            <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:text-[#111111] hover:border-[#111111]/20 shadow-sm transition-all"
              style={{ fontFamily: "'Figtree', sans-serif" }}>
              <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-8">
        <h3 className="text-sm font-bold text-gray-500 mb-4">Showing {displayBookings.length} result{displayBookings.length !== 1 ? 's' : ''}</h3>

        {loading ? (
          <AppLoader message="Loading bookings..." />
        ) : displayBookings.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><Users className="w-8 h-8 text-gray-400" /></div>
            <h3 className="font-heading font-bold text-lg text-primary mb-2">No bookings found</h3>
            <p className="text-sm text-gray-500">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayBookings.map(b => {
              const sc = STATUS_CONFIG[b.status] || STATUS_CONFIG.confirmed
              const statusLabel = b.status === 'checked_in' ? STATUS_LABELS.checked_in : sc.label
              const av = getAvatarColor(b.customerName)
              const primary = getPrimaryAction(b)
              const guests = b.guests || b.partySize || parseInt(b.service?.match(/\d+/)?.[0]) || 2
              const table = b.table || b.tableName
              const phone = b.customerPhone || b.phone || b.customer?.phone
              const email = b.customerEmail || b.email || b.customer?.email
              const time = formatTime(b.time)

              return (
                <div key={b.id} onClick={() => openDetail(b.id)}
                  className={`bg-white rounded-xl border border-gray-200 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_-5px_rgba(17,17,17,0.1)] transition-all duration-200 p-5 flex flex-col md:flex-row gap-4 md:gap-5 items-start md:items-center cursor-pointer group relative overflow-hidden ${newBookingIds.has(b.id) ? 'animate-[slideInGlow_0.6s_ease-out] ring-2 ring-emerald-400/50' : ''}`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${sc.bar}`} />

                  <div className="flex flex-row md:flex-col items-center md:items-start gap-3 md:gap-1 min-w-[100px] pl-2">
                    <span className="text-xl font-bold text-gray-900">{time}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${sc.bg} ${sc.text} border ${sc.border}`}>
                      {b.lateMinutes ? `Late (${b.lateMinutes}m)` : statusLabel}
                    </span>
                  </div>

                  <div className="flex-1 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full ${av.bg} ${av.text} font-bold text-lg flex items-center justify-center shadow-sm shrink-0`}>{getInitials(b.customerName)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors">{b.customerName}</h4>
                        {b.vip && <span className="px-1.5 py-0.5 rounded bg-[#D4A373] text-[10px] font-bold text-white uppercase tracking-wide">VIP</span>}
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-3 mt-0.5 flex-wrap">
                        {phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {phone}</span>}
                        {phone && email && <span className="text-gray-300">|</span>}
                        {email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {email}</span>}
                        {b.occasion && <><span className="text-gray-300">|</span><span className="text-[#D4A373] font-medium flex items-center gap-1"><Cake className="w-3 h-3" /> {b.occasion}</span></>}
                        {b.waitMinutes && <span className="flex items-center gap-1 text-gray-400"><Clock className="w-3 h-3" /> ~{b.waitMinutes}m wait</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 md:gap-6 items-center text-sm text-gray-600">
                    {isRestaurant ? (
                      <>
                        <div className="flex items-center gap-2" title="Party Size">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-700 border border-gray-100"><Users className="w-4 h-4" /></div>
                          <span className="font-semibold">{guests} Guest{guests !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2" title="Table">
                          <div className={`w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 ${table ? 'text-gray-700' : 'text-gray-400'}`}><Armchair className="w-4 h-4" /></div>
                          {table ? <span className="font-semibold">{table}</span> : <span className="font-medium text-gray-400 italic">Unassigned</span>}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2" title="Service">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-700 border border-gray-100"><Clock className="w-4 h-4" /></div>
                          <span className="font-semibold">{b.service || b.serviceName || 'Treatment'}</span>
                        </div>
                        <div className="flex items-center gap-2" title="Therapist">
                          <div className={`w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 ${b.staffName ? 'text-gray-700' : 'text-gray-400'}`}><Users className="w-4 h-4" /></div>
                          {b.staffName ? <span className="font-semibold">{b.staffName}</span> : <span className="font-medium text-gray-400 italic">Any available</span>}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-auto mt-2 md:mt-0" onClick={e => e.stopPropagation()}>
                    {primary && (
                      <button onClick={primary.action} disabled={updating}
                        className={`px-4 py-1.5 text-xs font-bold rounded-full shadow-lg transition-all ${primary.outline ? 'bg-white border border-[#111111]/20 text-[#111111] hover:bg-[#111111]/5 shadow-sm' : 'bg-[#111111] hover:bg-[#1a1a1a] text-white shadow-[#111111]/20'}`}
                        style={{ fontFamily: "'Figtree', sans-serif" }}>
                        {primary.label}
                      </button>
                    )}
                    <button onClick={() => { openDetail(b.id); setTimeout(startEdit, 500) }} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#111111] hover:bg-[#111111]/5 transition-all" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => confirmCancel(b.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {displayBookings.length > 0 && (
          <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
            <div className="text-sm text-gray-500">Showing <span className="font-bold text-gray-900">1-{displayBookings.length}</span> of <span className="font-bold text-gray-900">{pagination.total || displayBookings.length}</span> results</div>
            <div className="flex items-center gap-2">
              <button className="px-3.5 py-1.5 rounded-full text-xs font-bold text-gray-300 bg-gray-50 cursor-not-allowed" style={{ fontFamily: "'Figtree', sans-serif" }}>Previous</button>
              <button className="px-3 py-1.5 bg-[#111111] text-white rounded-full text-xs font-bold shadow-lg shadow-[#111111]/20" style={{ fontFamily: "'Figtree', sans-serif" }}>1</button>
              <button className="px-3.5 py-1.5 rounded-full text-xs font-bold text-gray-500 hover:bg-gray-100 transition-all" style={{ fontFamily: "'Figtree', sans-serif" }}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <h3 className="font-bold text-lg text-gray-900">Cancel Booking?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">This will cancel the appointment and notify the client. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setCancelConfirm(null)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition-colors">Keep It</button>
              <button onClick={doCancel} disabled={updating} className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-red-600 transition-colors">{updating ? 'Cancelling...' : 'Yes, Cancel'}</button>
            </div>
          </div>
        </div>
      )}

      {detail && <div className="fixed inset-0 bg-black/20 z-30" onClick={closeDetail} />}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white shadow-2xl transform transition-transform duration-300 z-40 border-l border-gray-200 flex flex-col ${detail ? 'translate-x-0' : 'translate-x-full'}`}>
        {detail && (
          <DetailErrorBoundary key={detail.id || 'detail'} onClose={closeDetail}>
            {/* Header */}
            <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-gray-50 shrink-0">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${(STATUS_CONFIG[detail.status || 'pending'] || STATUS_CONFIG.confirmed).bg} ${(STATUS_CONFIG[detail.status || 'pending'] || STATUS_CONFIG.confirmed).text} border ${(STATUS_CONFIG[detail.status || 'pending'] || STATUS_CONFIG.confirmed).border}`}>
                  {detail.status === 'checked_in' ? (isRestaurant ? 'Seated' : 'In Treatment') : (STATUS_CONFIG[detail.status || 'pending'] || STATUS_CONFIG.confirmed).label}
                </span>
                <span className="text-xs text-gray-400 font-mono">{detail.reference || detail.id || ''}</span>
              </div>
              <div className="flex items-center gap-1">
                {!editMode && !rescheduleMode && <button onClick={startEdit} className="w-8 h-8 rounded hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-[#111]" title="Edit"><Pencil className="w-4 h-4" /></button>}
                <button className="w-8 h-8 rounded hover:bg-gray-200 flex items-center justify-center text-gray-400" onClick={closeDetail}><X className="w-4 h-4" /></button>
              </div>
            </div>

            {detailLoading ? <AppLoader message="Loading..." size="sm" /> : (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Customer header */}
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-full ${getAvatarColor(detail.customerName || 'C').bg} flex items-center justify-center ${getAvatarColor(detail.customerName || 'C').text} font-bold text-xl shadow-sm`}>
                      {getInitials(detail.customerName || 'Client')}
                    </div>
                    <div className="flex-1">
                      {editMode ? (
                        <input value={editFields.customerName || ''} onChange={e => setEditFields(f => ({ ...f, customerName: e.target.value }))}
                          className="text-xl font-bold text-gray-900 bg-transparent border-b-2 border-[#111]/20 focus:border-[#111] outline-none w-full pb-1" />
                      ) : (
                        <h2 className="text-xl font-heading font-bold text-primary">{detail.customerName || 'Client'}</h2>
                      )}
                      {editMode ? (
                        <div className="mt-2 space-y-2">
                          <input value={editFields.phone || ''} onChange={e => setEditFields(f => ({ ...f, phone: e.target.value }))} placeholder="Phone"
                            className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-full focus:border-[#111] outline-none" />
                          <input value={editFields.email || ''} onChange={e => setEditFields(f => ({ ...f, email: e.target.value }))} placeholder="Email"
                            className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-full focus:border-[#111] outline-none" />
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 mt-1">{[detail.customer?.phone, detail.customer?.email].filter(Boolean).join(' • ') || '—'}</p>
                      )}
                    </div>
                  </div>

                  {/* Reschedule mode */}
                  {rescheduleMode && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                      <h3 className="text-sm font-bold text-[#111111] flex items-center gap-2"><Calendar className="w-4 h-4" /> Reschedule Appointment</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-[#C9A84C] uppercase block mb-1">New Date</label>
                          <input type="date" value={rescheduleFields.date || ''} onChange={e => setRescheduleFields(f => ({ ...f, date: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#111111] outline-none bg-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#C9A84C] uppercase block mb-1">New Time</label>
                          <input type="time" value={rescheduleFields.time || ''} onChange={e => setRescheduleFields(f => ({ ...f, time: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#111111] outline-none bg-white" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setRescheduleMode(false)} className="flex-1 bg-white border border-gray-200 text-gray-600 font-bold py-2 rounded-lg text-sm">Cancel</button>
                        <button onClick={saveReschedule} disabled={saving} className="flex-1 bg-[#111111] text-white font-bold py-2 rounded-lg text-sm hover:bg-[#1a1a1a] transition-colors flex items-center justify-center gap-2">
                          {saving ? 'Saving...' : <><Save className="w-3.5 h-3.5" /> Save</>}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Booking details grid */}
                  {!rescheduleMode && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Date</p>
                        <p className="text-sm font-bold text-primary mt-1">{detail.date || '—'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Time</p>
                        <p className="text-sm font-bold text-primary mt-1">{detail.time ? formatTime(detail.time) : '—'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{isRestaurant ? 'Guests' : 'Service'}</p>
                        <p className="text-sm font-bold text-primary mt-1">{isRestaurant ? (detail.guests || detail.partySize || '—') : (detail.service || '—')}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{isRestaurant ? 'Table' : 'Therapist'}</p>
                        <p className="text-sm font-bold text-primary mt-1">{isRestaurant ? (detail.table || detail.tableName || 'Unassigned') : (detail.staffName || 'Any available')}</p>
                      </div>
                      {detail.servicePrice && (
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Price</p>
                          <p className="text-sm font-bold text-primary mt-1">£{detail.servicePrice}</p>
                        </div>
                      )}
                      {detail.serviceDuration && (
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Duration</p>
                          <p className="text-sm font-bold text-primary mt-1">{detail.serviceDuration} min</p>
                        </div>
                      )}
                      {detail.source && (
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Source</p>
                          <p className="text-sm font-bold text-primary mt-1 capitalize">{detail.source}</p>
                        </div>
                      )}
                      {detail.occasion && (
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Occasion</p>
                          <p className="text-sm font-bold text-primary mt-1 capitalize">{detail.occasion}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {editMode ? (
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Notes</label>
                      <textarea value={editFields.notes || ''} onChange={e => setEditFields(f => ({ ...f, notes: e.target.value }))} rows={3}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#111] outline-none resize-none" />
                    </div>
                  ) : (
                    detail.notes && <div className="bg-gray-50 p-3 rounded-lg border border-gray-200"><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Notes</label><p className="text-sm text-primary/80">{detail.notes}</p></div>
                  )}

                  {/* Deposit / allergens */}
                  {detail.deposit?.status && (
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Booking Fee</label>
                      <p className="text-sm font-bold text-primary capitalize">{detail.deposit.status} {detail.deposit.amount ? `— £${detail.deposit.amount}` : ''}</p>
                    </div>
                  )}
                  {detail.allergens?.length > 0 && (
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <label className="text-[10px] font-bold text-red-500 uppercase block mb-1">Allergens</label>
                      <p className="text-sm font-bold text-red-700">{detail.allergens.join(', ')}</p>
                    </div>
                  )}

                  {/* CRM Client Details */}
                  {detailClient && (
                    <div className="space-y-2">
                      {/* Visit count + lifetime spend */}
                      <div className="grid grid-cols-3 gap-2">
                        {detailClient.stats?.total_visits != null && (
                          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-center">
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Visits</p>
                            <p className="text-lg font-extrabold text-primary">{detailClient.stats.total_visits}</p>
                          </div>
                        )}
                        {detailClient.ltv?.total != null && (
                          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-center">
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Lifetime</p>
                            <p className="text-lg font-extrabold text-primary">£{Math.round(detailClient.ltv.total)}</p>
                          </div>
                        )}
                        {detailClient.stats?.no_shows != null && (
                          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-center">
                            <p className="text-[9px] font-bold text-gray-400 uppercase">No-shows</p>
                            <p className={`text-lg font-extrabold ${detailClient.stats.no_shows > 0 ? 'text-red-600' : 'text-primary'}`}>{detailClient.stats.no_shows}</p>
                          </div>
                        )}
                      </div>
                      {/* Consultation form status */}
                      {detailClient.consultation_form_status && detailClient.consultation_form_status !== 'none' && (
                        <div className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs font-semibold ${
                          detailClient.consultation_form_status === 'valid' ? 'bg-green-50 border-green-200 text-green-700' :
                          detailClient.consultation_form_status === 'expiring_soon' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                          'bg-red-50 border-red-200 text-red-700'
                        }`}>
                          <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                          Consultation: {detailClient.consultation_form_status === 'valid' ? 'Valid' : detailClient.consultation_form_status === 'expiring_soon' ? 'Expiring soon' : 'Expired — needs renewal'}
                        </div>
                      )}
                      {/* Staff notes */}
                      {detailClient.client?.notes?.length > 0 && (
                        <div className="bg-[#F5EDD6] p-2.5 rounded-lg border border-[#C9A84C]/30 text-xs text-[#111111]">
                          <strong>Staff notes:</strong> {Array.isArray(detailClient.client.notes) ? detailClient.client.notes.join(' · ') : detailClient.client.notes}
                        </div>
                      )}
                      {/* Tags */}
                      {detailClient.client?.tags?.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {detailClient.client.tags.map(t => (
                            <span key={t} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t === 'VIP' ? 'bg-[#C9A84C] text-white' : 'bg-gray-100 text-gray-600'}`}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CRM link */}
                  {detail.customer && (
                    <button onClick={() => {
                      const cid = detail?.customerId || detailClient?.client?.id || ''
                      navigate(cid ? `/dashboard/crm?client=${cid}` : '/dashboard/crm')
                    }} className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 transition-colors group">
                      <span className="text-sm font-bold text-gray-600 group-hover:text-[#111]">View in CRM</span>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#111]" />
                    </button>
                  )}
                </div>

                {/* Footer actions */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
                  {editMode ? (
                    <div className="flex gap-3">
                      <button onClick={() => setEditMode(false)} className="flex-1 bg-white border border-gray-200 text-gray-600 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-100 transition-colors">Cancel</button>
                      <button onClick={saveEdit} disabled={saving} className="flex-1 bg-[#111] text-white font-bold py-2.5 rounded-lg text-sm hover:bg-[#222] transition-colors flex items-center justify-center gap-2">
                        {saving ? 'Saving...' : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={startReschedule} className="flex-1 bg-white border border-gray-200 text-primary font-bold py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-sm flex items-center justify-center gap-2"><Calendar className="w-3.5 h-3.5" /> Reschedule</button>
                      {(detail.status === 'confirmed' || detail.status === 'late') && <button onClick={() => updateStatus(detail.id, 'checked_in')} disabled={updating} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-primary-hover transition-colors shadow-lg flex items-center justify-center gap-2 text-sm"><span>{isRestaurant ? 'Seat' : 'Check In'}</span><ChevronRight className="w-4 h-4" /></button>}
                      {detail.status === 'checked_in' && <button onClick={() => updateStatus(detail.id, 'completed')} disabled={updating} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-primary-hover transition-colors shadow-lg flex items-center justify-center gap-2 text-sm"><span>{isRestaurant ? 'Checkout' : 'Complete'}</span><ChevronRight className="w-4 h-4" /></button>}
                      {detail.status === 'pending' && <button onClick={() => updateStatus(detail.id, 'confirmed')} disabled={updating} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-primary-hover transition-colors shadow-lg flex items-center justify-center gap-2 text-sm"><span>Confirm</span><Check className="w-4 h-4" /></button>}
                    </div>
                  )}
                  {!editMode && !rescheduleMode && detail.status !== 'cancelled' && (
                    <button onClick={() => confirmCancel(detail.id)} className="w-full mt-2 text-xs text-red-400 hover:text-red-600 font-bold py-2 transition-colors">Cancel Booking</button>
                  )}
                </div>
              </>
            )}
          </DetailErrorBoundary>
        )}
      </div>
    </div>
  )
}

export default Bookings
