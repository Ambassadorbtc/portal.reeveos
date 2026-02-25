import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Bookings — Card-based browse view matching UXPilot Browse design
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ChevronRight, RefreshCw, Download, X, Check, Users, Armchair, Phone, Mail, Cake, Pencil, SlidersHorizontal, Clock } from 'lucide-react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100', bar: 'bg-emerald-500' },
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', bar: 'bg-amber-400' },
  checked_in: { label: 'Seated', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', bar: 'bg-blue-500' },
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
  const { business, isDemo } = useBusiness()
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
  const [updating, setUpdating] = useState(false)

  const bookingId = searchParams.get('booking')
  const bid = business?.id ?? business?._id
  const seenIdsRef = useRef(new Set())
  const [newBookingIds, setNewBookingIds] = useState(new Set())

  const fetchBookings = async (silent = false) => {
    if (!bid) { setLoading(false); return }
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', '1'); params.set('limit', '20'); params.set('status', status)
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
    try { const res = await api.get(`/bookings/business/${bid}/detail/${id}`); setDetail(res.booking) }
    catch { setDetail(null) }
    finally { setDetailLoading(false) }
  }

  const updateStatus = async (id, newStatus) => {
    if (!bid || !id) return
    setUpdating(true)
    try {
      await api.patch(`/bookings/business/${bid}/detail/${id}/status`, { status: newStatus })
      fetchBookings()
      if (detail?.id === id) setDetail(d => d ? { ...d, status: newStatus } : null)
    } catch (err) { alert(err.message || 'Failed to update') }
    finally { setUpdating(false) }
  }

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 300); return () => clearTimeout(t) }, [search])
  useEffect(() => { fetchBookings(false) }, [bid, status, searchDebounce])
  useEffect(() => { if (bookingId) fetchDetail(bookingId); else setDetail(null) }, [bookingId, bid])

  // Live polling — silently refresh every 15 seconds
  useEffect(() => {
    if (!bid || isDemo) return
    const interval = setInterval(() => fetchBookings(true), 15000)
    return () => clearInterval(interval)
  }, [bid, status, searchDebounce, isDemo])

  // Clear new-booking animation after 3 seconds
  useEffect(() => {
    if (newBookingIds.size === 0) return
    const t = setTimeout(() => setNewBookingIds(new Set()), 3000)
    return () => clearTimeout(t)
  }, [newBookingIds])

  const openDetail = (id) => setSearchParams({ booking: id })
  const closeDetail = () => setSearchParams({})

  const demoBookings = [
    { id: 'd1', reference: 'REZ-0001', customerName: 'John Doe', phone: '(555) 123-4567', email: 'john@example.com', service: 'Table for 4', guests: 4, table: 'T-02', zone: 'Main Dining', date: 'Today', time: '18:30', status: 'confirmed', vip: true },
    { id: 'd2', reference: 'REZ-0002', customerName: 'Alice Smith', phone: '(555) 987-6543', service: 'Table for 2', guests: 2, date: 'Today', time: '18:45', status: 'late', vip: true, lateMinutes: 10 },
    { id: 'd3', reference: 'REZ-0003', customerName: 'Michael Ross', phone: '(555) 222-3333', email: 'michael@mail.com', service: 'Table for 6', guests: 6, table: 'T-08', zone: 'Main Dining', date: 'Today', time: '19:00', status: 'confirmed', occasion: 'Birthday' },
    { id: 'd4', reference: 'REZ-0004', customerName: 'Sarah Jenkins', phone: '(555) 444-5555', service: 'Table for 3', guests: 3, date: 'Today', time: '19:15', status: 'waitlist', waitMinutes: 25 },
    { id: 'd5', reference: 'REZ-0005', customerName: 'David Lee', phone: '(555) 777-8888', email: 'david.lee@mail.com', service: 'Table for 2', guests: 2, table: 'T-14', zone: 'Patio', date: 'Today', time: '19:30', status: 'confirmed' },
    { id: 'd6', reference: 'REZ-0006', customerName: 'Priya Patel', phone: '(555) 333-2222', email: 'priya@gmail.com', service: 'Table for 4', guests: 4, table: 'T-05', zone: 'Window', date: 'Today', time: '20:00', status: 'confirmed', vip: true },
    { id: 'd7', reference: 'REZ-0007', customerName: 'Tom Walker', phone: '(555) 111-9999', service: 'Table for 8', guests: 8, table: 'T-12', zone: 'Private', date: 'Tomorrow', time: '19:00', status: 'pending', notes: 'Anniversary dinner' },
    { id: 'd8', reference: 'REZ-0008', customerName: 'Grace Kim', phone: '(555) 666-7777', email: 'grace@company.com', service: 'Table for 2', guests: 2, table: 'T-03', zone: 'Bar', date: 'Tomorrow', time: '20:30', status: 'confirmed' },
  ]

  const displayBookings = (bookings.length > 0 || !isDemo) ? bookings : demoBookings

  const getPrimaryAction = (b) => {
    const s = b.status
    if (s === 'confirmed' || s === 'late') return { label: 'Seat', action: () => updateStatus(b.id, 'checked_in') }
    if (s === 'pending') return { label: 'Confirm', action: () => updateStatus(b.id, 'confirmed') }
    if (s === 'waitlist') return { label: 'Notify', action: null, outline: true }
    if (s === 'checked_in') return { label: 'Checkout', action: () => updateStatus(b.id, 'completed') }
    return null
  }

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]">
      {/* Search & Controls */}
      <div className="px-6 md:px-8 pt-6 pb-4 space-y-4 shrink-0">
        <div className="relative max-w-2xl flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by guest name, phone..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/15 focus:border-[#1B4332]/30 text-sm font-medium transition-all"
              style={{ fontFamily: "'Figtree', sans-serif" }} />
          </div>
          <button className="md:hidden bg-white border border-gray-200 text-gray-600 px-4 rounded-full shadow-sm hover:bg-gray-50"><SlidersHorizontal className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-1.5">
            {['all', 'waitlist', 'history'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all ${
                  activeTab === t
                    ? 'bg-[#1B4332] text-white shadow-lg shadow-[#1B4332]/20'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                style={{ fontFamily: "'Figtree', sans-serif" }}>
                {t === 'all' ? 'All Bookings' : t === 'waitlist' ? 'Waitlist' : 'History'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button onClick={fetchBookings} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#1B4332] hover:bg-[#1B4332]/5 transition-colors" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
            <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:text-[#1B4332] hover:border-[#1B4332]/20 shadow-sm transition-all"
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
          <RezvoLoader message="Loading bookings..." />
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
              const av = getAvatarColor(b.customerName)
              const primary = getPrimaryAction(b)
              const guests = b.guests || b.partySize || parseInt(b.service?.match(/\d+/)?.[0]) || 2
              const table = b.table || b.tableName
              const phone = b.customerPhone || b.phone || b.customer?.phone
              const email = b.customerEmail || b.email || b.customer?.email
              const time = formatTime(b.time)

              return (
                <div key={b.id} onClick={() => openDetail(b.id)}
                  className={`bg-white rounded-xl border border-gray-200 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_-5px_rgba(27,67,50,0.1)] transition-all duration-200 p-5 flex flex-col md:flex-row gap-4 md:gap-5 items-start md:items-center cursor-pointer group relative overflow-hidden ${newBookingIds.has(b.id) ? 'animate-[slideInGlow_0.6s_ease-out] ring-2 ring-emerald-400/50' : ''}`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${sc.bar}`} />

                  <div className="flex flex-row md:flex-col items-center md:items-start gap-3 md:gap-1 min-w-[100px] pl-2">
                    <span className="text-xl font-bold text-gray-900">{time}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${sc.bg} ${sc.text} border ${sc.border}`}>
                      {b.lateMinutes ? `Late (${b.lateMinutes}m)` : sc.label}
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
                    <div className="flex items-center gap-2" title="Party Size">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-700 border border-gray-100"><Users className="w-4 h-4" /></div>
                      <span className="font-semibold">{guests} Guest{guests !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2" title="Table">
                      <div className={`w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 ${table ? 'text-gray-700' : 'text-gray-400'}`}><Armchair className="w-4 h-4" /></div>
                      {table ? <span className="font-semibold">{table}</span> : <span className="font-medium text-gray-400 italic">Unassigned</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-auto mt-2 md:mt-0" onClick={e => e.stopPropagation()}>
                    {primary && (
                      <button onClick={primary.action} disabled={updating}
                        className={`px-4 py-1.5 text-xs font-bold rounded-full shadow-lg transition-all ${primary.outline ? 'bg-white border border-[#1B4332]/20 text-[#1B4332] hover:bg-[#1B4332]/5 shadow-sm' : 'bg-[#1B4332] hover:bg-[#2D6A4F] text-white shadow-[#1B4332]/20'}`}
                        style={{ fontFamily: "'Figtree', sans-serif" }}>
                        {primary.label}
                      </button>
                    )}
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#1B4332] hover:bg-[#1B4332]/5 transition-all" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => updateStatus(b.id, 'cancelled')} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Cancel"><X className="w-3.5 h-3.5" /></button>
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
              <button className="px-3 py-1.5 bg-[#1B4332] text-white rounded-full text-xs font-bold shadow-lg shadow-[#1B4332]/20" style={{ fontFamily: "'Figtree', sans-serif" }}>1</button>
              <button className="px-3.5 py-1.5 rounded-full text-xs font-bold text-gray-500 hover:bg-gray-100 transition-all" style={{ fontFamily: "'Figtree', sans-serif" }}>Next</button>
            </div>
          </div>
        )}
      </div>

      {detail && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={closeDetail} />}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white shadow-2xl transform transition-transform duration-300 z-40 border-l border-gray-200 flex flex-col ${detail ? 'translate-x-0' : 'translate-x-full'}`}>
        {detail && (
          <>
            <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-gray-50 shrink-0">
              <div className="flex items-center gap-2">
                {(() => { const sc = STATUS_CONFIG[detail.status] || STATUS_CONFIG.confirmed; return <span className={`px-2.5 py-1 rounded-full ${sc.bg} ${sc.text} text-xs font-bold border ${sc.border}`}>{sc.label}</span> })()}
                <span className="text-xs text-gray-400 font-mono">{detail.reference}</span>
              </div>
              <button className="w-8 h-8 rounded hover:bg-gray-200 flex items-center justify-center text-gray-400" onClick={closeDetail}><X className="w-4 h-4" /></button>
            </div>
            {detailLoading ? <RezvoLoader message="Loading..." size="sm" /> : (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="flex items-start gap-4">
                    {(() => { const n = detail.customer?.name || detail.customerName || ''; const av = getAvatarColor(n); return <div className={`w-14 h-14 rounded-full ${av.bg} flex items-center justify-center ${av.text} font-bold text-xl shadow-sm`}>{getInitials(n)}</div> })()}
                    <div className="flex-1">
                      <h2 className="text-xl font-heading font-bold text-primary">{detail.customer?.name || detail.customerName}</h2>
                      <p className="text-sm text-gray-500 mt-1">{[detail.customer?.phone || detail.phone, detail.customer?.email || detail.email].filter(Boolean).join(' • ')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[{l:'Date',v:detail.date},{l:'Time',v:formatTime(detail.time)},{l:'Guests',v:detail.guests||detail.partySize||'—'},{l:'Table',v:detail.table||detail.tableName||'Unassigned'}].map(d => (
                      <div key={d.l} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{d.l}</p>
                        <p className="text-sm font-bold text-primary mt-1">{d.v}</p>
                      </div>
                    ))}
                  </div>
                  {detail.notes && <div className="bg-gray-50 p-3 rounded-lg border border-gray-200"><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Notes</label><p className="text-sm text-primary/80">{detail.notes}</p></div>}
                </div>
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3 shrink-0">
                  <button className="flex-1 bg-white border border-gray-200 text-primary font-bold py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-sm">Reschedule</button>
                  {detail.status === 'confirmed' && <button onClick={() => updateStatus(detail.id, 'checked_in')} disabled={updating} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-primary-hover transition-colors shadow-lg flex items-center justify-center gap-2 text-sm"><span>Seat</span><ChevronRight className="w-4 h-4" /></button>}
                  {detail.status === 'checked_in' && <button onClick={() => updateStatus(detail.id, 'completed')} disabled={updating} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-primary-hover transition-colors shadow-lg flex items-center justify-center gap-2 text-sm"><span>Checkout</span><ChevronRight className="w-4 h-4" /></button>}
                  {detail.status === 'pending' && <button onClick={() => updateStatus(detail.id, 'confirmed')} disabled={updating} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-primary-hover transition-colors shadow-lg flex items-center justify-center gap-2 text-sm"><span>Confirm</span><Check className="w-4 h-4" /></button>}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Bookings
