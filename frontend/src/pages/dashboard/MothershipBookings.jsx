import AppLoader from "../../components/shared/AppLoader"
import { useState, useEffect, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const MothershipBookings = () => {
  const { business } = useBusiness()
  const [bookings, setBookings] = useState([])
  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterOp, setFilterOp] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const bid = business?.id ?? business?._id

  const fetchData = useCallback(async () => {
    if (!bid) { setLoading(false); return }
    try {
      const [bRes, opRes] = await Promise.all([
        api.get(`/bookings/business/${bid}?limit=100`),
        api.get(`/operators/business/${bid}`),
      ])
      setBookings(bRes.bookings || bRes || [])
      setOperators(opRes.operators || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [bid])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <AppLoader message="Loading bookings..." />

  const opMap = {}
  operators.forEach(o => { opMap[o.id] = o.name })

  const filtered = bookings.filter(b => {
    if (filterOp !== 'all' && b.operator_id !== filterOp) return false
    if (filterStatus !== 'all' && b.status !== filterStatus) return false
    return true
  })

  const statusColors = {
    confirmed: 'bg-green-50 text-green-700',
    completed: 'bg-gray-100 text-gray-500',
    pending: 'bg-amber-50 text-amber-700',
    cancelled: 'bg-red-50 text-red-600',
    no_show: 'bg-red-50 text-red-600',
    checked_in: 'bg-blue-50 text-blue-600',
  }

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]" style={{ fontFamily: "'Figtree',sans-serif" }}>
      <div className="px-6 md:px-8 pt-6 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-heading font-extrabold text-primary">All Bookings</h1>
            <p className="text-sm text-gray-500 mt-0.5">{filtered.length} bookings across all operators</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400">Operator:</span>
            <div className="flex gap-1">
              <button onClick={() => setFilterOp('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filterOp === 'all' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-100'}`}>All</button>
              {operators.filter(o => o.status === 'active').map(o => (
                <button key={o.id} onClick={() => setFilterOp(o.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filterOp === o.id ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-100'}`}>{o.name?.split(' ')[0]}</button>
              ))}
            </div>
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400">Status:</span>
            <div className="flex gap-1">
              {['all', 'confirmed', 'pending', 'completed', 'cancelled', 'no_show'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filterStatus === s ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-100'}`}>
                  {s === 'all' ? 'All' : s === 'no_show' ? 'No-show' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-8">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-sm text-gray-400">No bookings match your filters.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((b, i) => {
              const svc = typeof b.service === 'string' ? b.service : b.service?.name || 'Service'
              const cust = typeof b.customer === 'string' ? b.customer : b.customer?.name || b.customerName || 'Walk-in'
              const opName = opMap[b.operator_id] || '—'
              const sc = statusColors[b.status] || 'bg-gray-100 text-gray-500'
              const split = b.revenue_split || {}

              return (
                <div key={b.id || b._id || i} className="bg-white border border-gray-100 rounded-xl px-5 py-3.5 flex items-center gap-4 hover:shadow-sm transition-all">
                  {/* Time */}
                  <div className="w-14 shrink-0 text-right">
                    <div className="text-sm font-bold text-primary">{b.time || '—'}</div>
                    <div className="text-[10px] text-gray-400">{b.date || ''}</div>
                  </div>
                  {/* Divider */}
                  <div className="w-0.5 h-8 bg-gray-100 rounded-full shrink-0" />
                  {/* Client + Service */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-primary truncate">{cust}</div>
                    <div className="text-[11px] text-gray-400 truncate">{svc}</div>
                  </div>
                  {/* Operator */}
                  <div className="shrink-0 px-2.5 py-1 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] text-[10px] font-bold">{opName}</div>
                  {/* Status */}
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${sc}`}>{b.status}</span>
                  {/* Revenue */}
                  <div className="text-right shrink-0 w-16">
                    <div className="text-sm font-bold text-primary">£{(split.total || b.price || 0).toFixed ? (split.total || b.price || 0).toFixed(2) : '0.00'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default MothershipBookings
