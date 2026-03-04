import { useState, useEffect } from 'react'
import { CalendarCheck, RefreshCw, Clock, Building2, User, Filter } from 'lucide-react'

const api = (path) => { const t = sessionStorage.getItem('rezvo_admin_token'); return fetch(`/api${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} }).then(r => r.ok ? r.json() : null).catch(() => null) }

const STATUS_STYLES = {
  confirmed: 'bg-emerald-500/10 text-emerald-400',
  pending: 'bg-amber-500/10 text-amber-400',
  cancelled: 'bg-red-500/10 text-red-400',
  seated: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-gray-700 text-gray-300',
  'no-show': 'bg-red-500/10 text-red-400',
}

export default function AdminBookings() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (dateFilter) params.set('date', dateFilter)
    const res = await api(`/admin/bookings?${params}`)
    setData(res)
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter, dateFilter])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">All Bookings</h1>
          <p className="text-xs text-gray-500 mt-0.5">Platform-wide booking data across all businesses</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 text-xs hover:bg-gray-700">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: data?.total ?? '—' },
          { label: 'Today', value: data?.today ?? '—' },
          { label: 'Confirmed', value: data?.confirmed ?? '—' },
          { label: 'Pending', value: data?.pending ?? '—' },
          { label: 'Cancelled', value: data?.cancelled ?? '—' },
        ].map((s, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <Filter size={14} className="text-gray-500" />
        <div className="flex gap-1">
          {['', 'confirmed', 'pending', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
        />
        {dateFilter && (
          <button onClick={() => setDateFilter('')} className="text-xs text-gray-500 hover:text-gray-300">Clear date</button>
        )}
      </div>

      {/* Bookings list */}
      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-emerald-500" size={20} /></div>
      ) : data?.bookings?.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <CalendarCheck size={32} className="mx-auto text-gray-500 mb-3" />
          <p className="text-gray-500 text-sm">No bookings found</p>
          <p className="text-gray-600 text-xs mt-1">Bookings will appear here as customers make reservations</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.bookings?.map((b, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(201,168,76,0.1)' }}>
                    <CalendarCheck size={16} style={{ color: '#C9A84C' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {b.customer_name || b.name || b.guest_name || 'Walk-in'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Building2 size={10} />{b.business_name || 'Unknown'}</span>
                      <span className="flex items-center gap-1"><Clock size={10} />{b.date} {b.time && `at ${b.time}`}</span>
                      {b.party_size && <span className="flex items-center gap-1"><User size={10} />{b.party_size} guests</span>}
                      {b.service_name && <span>{b.service_name}</span>}
                    </div>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 ${STATUS_STYLES[b.status] || 'bg-gray-800 text-gray-400'}`}>
                  {b.status || 'unknown'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
