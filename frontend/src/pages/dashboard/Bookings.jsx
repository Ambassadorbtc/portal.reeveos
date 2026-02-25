import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Bookings — styled to match 4-Brand Design - Bookings.html
 * Table with filters toolbar, bulk actions, and slide-over detail panel
 */

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  checked_in: { label: 'Checked In', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  completed: { label: 'Completed', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  no_show: { label: 'No-show', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
}

const PAYMENT_CONFIG = {
  paid: { label: 'Paid', icon: 'fa-check', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  unpaid: { label: 'Unpaid', icon: 'fa-circle-exclamation', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  deposit: { label: 'Deposit Pd', icon: 'fa-circle-half-stroke', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  refunded: { label: 'Refunded', icon: 'fa-rotate-left', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
}

const AVATAR_COLORS = [
  { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
  { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
  { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
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
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [selected, setSelected] = useState([])

  const bookingId = searchParams.get('booking')
  const bid = business?.id ?? business?._id

  const fetchBookings = async () => {
    if (!bid) { setLoading(false); return }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', '1'); params.set('limit', '20'); params.set('status', status)
      if (searchDebounce) params.set('search', searchDebounce)
      const res = await api.get(`/bookings/business/${bid}?${params}`)
      setBookings(res.bookings || []); setPagination(res.pagination || {}); setCounts(res.counts || {})
    } catch (err) { console.error('Failed to fetch bookings:', err) }
    finally { setLoading(false) }
  }

  const fetchDetail = async (id) => {
    if (!bid || !id) return
    setDetailLoading(true)
    try { const res = await api.get(`/bookings/business/${bid}/detail/${id}`); setDetail(res.booking) }
    catch { setDetail(null) }
    finally { setDetailLoading(false) }
  }

  const updateStatus = async (newStatus) => {
    if (!bid || !detail?.id) return
    setUpdating(true)
    try {
      await api.patch(`/bookings/business/${bid}/detail/${detail.id}/status`, { status: newStatus })
      setDetail(d => d ? { ...d, status: newStatus } : null); fetchBookings()
    } catch (err) { alert(err.message || 'Failed to update') }
    finally { setUpdating(false) }
  }

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 300); return () => clearTimeout(t) }, [search])
  useEffect(() => { fetchBookings() }, [bid, status, searchDebounce])
  useEffect(() => { if (bookingId) fetchDetail(bookingId); else setDetail(null) }, [bookingId, bid])

  const openDetail = (id) => setSearchParams({ booking: id })
  const closeDetail = () => setSearchParams({})
  const toggleSelect = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleSelectAll = () => { if (selected.length === displayBookings.length) setSelected([]); else setSelected(displayBookings.map(b => b.id)) }

  const demoBookings = [
    { id: 'd1', reference: '#BK-2938', customerName: 'Brenda Massey', service: 'Blow Dry', staff: 'Sarah Jenkins', date: 'Wed, 25 Oct', time: '09:00 - 09:45', status: 'confirmed', payment: 'unpaid', price: '£45.00' },
    { id: 'd2', reference: '#BK-2940', customerName: 'Craig Mango', service: 'Mens Cut', staff: 'Mike Ross', date: 'Wed, 25 Oct', time: '11:00 - 11:30', status: 'checked_in', payment: 'paid', price: '£32.00' },
    { id: 'd3', reference: '#BK-2942', customerName: 'James Herwitz', service: 'Balinese Massage', staff: 'Tom Walker', date: 'Wed, 25 Oct', time: '09:30 - 10:45', status: 'pending', payment: 'deposit', price: '£85.00' },
    { id: 'd4', reference: '#BK-2944', customerName: 'Jessica Pearson', service: 'Full Colour', staff: 'Sarah Jenkins', date: 'Thu, 26 Oct', time: '10:00 - 12:00', status: 'confirmed', payment: 'paid', price: '£120.00' },
    { id: 'd5', reference: '#BK-2946', customerName: 'Rachel Zane', service: 'Balayage', staff: 'Sarah Jenkins', date: 'Thu, 26 Oct', time: '14:00 - 17:00', status: 'confirmed', payment: 'deposit', price: '£180.00' },
    { id: 'd6', reference: '#BK-2948', customerName: 'Louis Litt', service: 'Gents Cut', staff: 'Mike Ross', date: 'Fri, 27 Oct', time: '09:00 - 09:30', status: 'cancelled', payment: 'refunded', price: '£25.00' },
  ]

  const displayBookings = (bookings.length > 0 || !isDemo) ? bookings : demoBookings
  const staffColors = { 'Sarah Jenkins': 'bg-green-500', 'Mike Ross': 'bg-blue-500', 'Tom Walker': 'bg-gray-400' }

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]">
      {/* Filters Toolbar */}
      <div className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0 bg-white border-b border-border">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input type="text" placeholder="Search by client, booking ref, or email..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-lg text-sm font-medium text-primary hover:border-primary/50 transition-colors whitespace-nowrap shadow-sm">
              <i className="fa-regular fa-calendar text-gray-400" /><span>This Week</span><i className="fa-solid fa-chevron-down text-xs text-gray-400 ml-1" />
            </button>
            <div className="relative">
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="appearance-none px-3 py-2 pr-8 bg-white border border-border rounded-lg text-sm font-medium text-primary hover:border-primary/50 transition-colors whitespace-nowrap shadow-sm cursor-pointer">
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <i className="fa-solid fa-chevron-down text-xs text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchBookings} className="p-2 text-gray-400 hover:text-primary hover:bg-white rounded-lg transition-colors" title="Refresh"><i className="fa-solid fa-rotate-right" /></button>
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-lg text-sm font-bold text-gray-500 hover:text-primary transition-colors shadow-sm">
            <i className="fa-solid fa-download" /><span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="bg-white border-b border-border px-6 py-2 flex items-center gap-4 text-sm shrink-0">
          <span className="font-bold text-primary">{selected.length} selected</span>
          <div className="h-4 w-px bg-border" />
          <button className="text-gray-500 hover:text-primary font-medium">Cancel Bookings</button>
          <button className="text-gray-500 hover:text-primary font-medium">Send Message</button>
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        {loading ? (
          <RezvoLoader message="Loading bookings..." />
        ) : displayBookings.length === 0 ? (
          <div className="bg-white border border-border rounded-xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fa-regular fa-calendar text-gray-400 text-2xl" /></div>
            <h3 className="font-heading font-bold text-lg text-primary mb-2">No bookings found</h3>
            <p className="text-sm text-gray-500">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-border text-xs uppercase tracking-wider text-gray-500 font-bold">
                    <th className="p-4 w-12 text-center"><input type="checkbox" checked={selected.length === displayBookings.length && displayBookings.length > 0} onChange={toggleSelectAll} className="w-4 h-4 text-primary rounded cursor-pointer" /></th>
                    <th className="p-4">Client / Ref</th><th className="p-4">Service & Staff</th><th className="p-4">Date & Time</th>
                    <th className="p-4">Status</th><th className="p-4">Payment</th><th className="p-4 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {displayBookings.map(b => {
                    const sc = STATUS_CONFIG[b.status] || STATUS_CONFIG.confirmed
                    const pc = PAYMENT_CONFIG[b.payment] || PAYMENT_CONFIG.unpaid
                    const av = getAvatarColor(b.customerName)
                    return (
                      <tr key={b.id} className="group transition-colors hover:bg-gray-50/80 cursor-pointer" onClick={() => openDetail(b.id)}>
                        <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggleSelect(b.id)} className="w-4 h-4 text-primary rounded cursor-pointer" />
                        </td>
                        <td className="p-4"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full ${av.bg} ${av.text} flex items-center justify-center font-bold text-xs border ${av.border}`}>{getInitials(b.customerName)}</div><div><div className="font-bold text-primary">{b.customerName}</div><div className="text-[10px] text-gray-400 font-mono">{b.reference}</div></div></div></td>
                        <td className="p-4"><div className="font-medium text-primary">{b.service}</div>{b.staff && <div className="text-xs text-gray-400 flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${staffColors[b.staff] || 'bg-gray-400'}`} />{b.staff}</div>}</td>
                        <td className="p-4"><div className="font-medium text-primary">{b.date}</div><div className="text-xs text-gray-400">{b.time}</div></td>
                        <td className="p-4"><span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${sc.bg} ${sc.text} border ${sc.border}`}>{sc.label}</span></td>
                        <td className="p-4"><span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${pc.bg} ${pc.text} border ${pc.border}`}>{pc.icon && <i className={`fa-solid ${pc.icon} text-[10px]`} />}{pc.label}</span></td>
                        <td className="p-4 text-right font-bold text-primary">{b.price || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-border flex justify-between items-center bg-gray-50 text-sm">
              <span className="text-xs text-gray-500">Showing 1-{displayBookings.length} of {pagination.total || displayBookings.length}</span>
              <div className="flex gap-2">
                <button className="px-3 py-1 border border-border bg-white rounded text-xs font-bold text-gray-400 disabled:opacity-50" disabled>Previous</button>
                <button className="px-3 py-1 border border-border bg-white rounded text-xs font-bold text-primary hover:bg-gray-50">Next</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Overlay */}
      {detail && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={closeDetail} />}

      {/* Detail Side Panel */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white shadow-2xl transform transition-transform duration-300 z-40 border-l border-border flex flex-col ${detail ? 'translate-x-0' : 'translate-x-full'}`}>
        {detail && (
          <>
            <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-gray-50 shrink-0">
              <div className="flex items-center gap-2">
                {(() => { const sc = STATUS_CONFIG[detail.status] || STATUS_CONFIG.confirmed; return <span className={`px-2 py-1 rounded ${sc.bg} ${sc.text} text-xs font-bold border ${sc.border}`}>{sc.label?.toUpperCase()}</span> })()}
                <span className="text-xs text-gray-400 font-mono">{detail.reference}</span>
              </div>
              <button className="w-8 h-8 rounded hover:bg-gray-200 flex items-center justify-center text-gray-400" onClick={closeDetail}><i className="fa-solid fa-xmark" /></button>
            </div>
            {detailLoading ? (
              <RezvoLoader message="Loading..." size="sm" />
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="flex items-start gap-4">
                    {(() => { const n = detail.customer?.name || detail.customerName || ''; const av = getAvatarColor(n); return <div className={`w-14 h-14 rounded-full ${av.bg} flex items-center justify-center ${av.text} font-bold text-xl border ${av.border}`}>{getInitials(n)}</div> })()}
                    <div className="flex-1">
                      <h2 className="text-xl font-heading font-bold text-primary">{detail.customer?.name || detail.customerName}</h2>
                      <p className="text-sm text-gray-500 mt-1">{[detail.customer?.phone, detail.customer?.email].filter(Boolean).join(' • ')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[{icon:'fa-comment',label:'Message',color:'text-primary',action:null},{icon:'fa-ban',label:'No-Show',color:'text-red-500',action:'no_show'},{icon:'fa-calendar-xmark',label:'Cancel',color:'text-gray-500',action:'cancelled'},{icon:'fa-clock-rotate-left',label:'History',color:'text-gray-500',action:null}].map(a => (
                      <button key={a.label} onClick={() => a.action && updateStatus(a.action)} disabled={updating}
                        className="flex flex-col items-center justify-center p-3 rounded-lg bg-gray-50 border border-border hover:bg-gray-100 hover:border-primary/30 transition-all group">
                        <i className={`fa-solid ${a.icon} ${a.color} mb-1 group-hover:scale-110 transition-transform`} />
                        <span className="text-[10px] font-bold text-gray-500">{a.label}</span>
                      </button>
                    ))}
                  </div>
                  <hr className="border-border" />
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-lg border border-border"><p className="text-[10px] font-bold text-gray-400 uppercase">Date</p><p className="text-sm font-bold text-primary mt-1">{detail.date}</p></div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-border"><p className="text-[10px] font-bold text-gray-400 uppercase">Time</p><p className="text-sm font-bold text-primary mt-1">{detail.time}</p></div>
                    </div>
                    <div className="bg-white border border-border rounded-lg overflow-hidden">
                      <div className="p-4 border-b border-border flex justify-between items-start bg-gray-50/50">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center text-blue-600 shrink-0"><i className="fa-solid fa-scissors" /></div>
                          <div><p className="text-sm font-bold text-primary">{detail.service?.name || detail.service}</p><p className="text-xs text-gray-500 mt-0.5">{detail.service?.duration || ''} {detail.staff && `with ${detail.staff}`}</p></div>
                        </div>
                      </div>
                      {detail.notes && <div className="p-3 bg-gray-50/30"><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Notes</label><p className="text-xs text-primary/80">{detail.notes}</p></div>}
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-border bg-gray-50 flex gap-3 shrink-0">
                  <button className="flex-1 bg-white border border-border text-primary font-bold py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-sm">Reschedule</button>
                  {detail.status === 'confirmed' && <button onClick={() => updateStatus('checked_in')} disabled={updating} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-primary-hover transition-colors shadow-lg flex items-center justify-center gap-2 text-sm"><span>Check In</span><i className="fa-solid fa-arrow-right" /></button>}
                  {detail.status === 'checked_in' && <button onClick={() => updateStatus('completed')} disabled={updating} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-primary-hover transition-colors shadow-lg flex items-center justify-center gap-2 text-sm"><span>Checkout</span><i className="fa-solid fa-arrow-right" /></button>}
                  {detail.status === 'pending' && <button onClick={() => updateStatus('confirmed')} disabled={updating} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-primary-hover transition-colors shadow-lg flex items-center justify-center gap-2 text-sm"><span>Confirm</span><i className="fa-solid fa-check" /></button>}
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
