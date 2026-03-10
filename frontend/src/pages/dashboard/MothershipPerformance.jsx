import AppLoader from "../../components/shared/AppLoader"
import { useState, useEffect, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const MothershipPerformance = () => {
  const { business } = useBusiness()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [selectedOp, setSelectedOp] = useState(null)
  const bid = business?.id ?? business?._id

  const fetchData = useCallback(async () => {
    if (!bid) { setLoading(false); return }
    try {
      const res = await api.get(`/mothership/business/${bid}/dashboard?period=${period}`)
      setData(res)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [bid, period])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <AppLoader message="Loading performance..." />

  const lb = data?.leaderboard || []
  const avg = lb.length > 0 ? lb.reduce((s, o) => s + o.revenue, 0) / lb.length : 0

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]" style={{ fontFamily: "'Figtree',sans-serif" }}>
      <div className="px-6 md:px-8 pt-6 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-heading font-extrabold text-primary">Performance</h1>
            <p className="text-sm text-gray-500 mt-0.5">Per-operator breakdown · {lb.length} operators</p>
          </div>
          <div className="flex gap-1.5">
            {['week', 'month', 'all'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${period === p ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
                {p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-8">
        {lb.length === 0 ? (
          <div className="text-center py-20 text-sm text-gray-400">No operator data yet.</div>
        ) : (
          <div className="space-y-4">
            {lb.map((op, i) => {
              const isBelow = op.revenue < avg
              const expanded = selectedOp === op.id
              return (
                <div key={op.id} onClick={() => setSelectedOp(expanded ? null : op.id)}
                  className={`bg-white border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                    isBelow ? 'border-red-100' : 'border-gray-100'
                  }`}>
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Rank */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                      i === 0 ? 'bg-[#C9A84C]/15 text-[#C9A84C]' : 'bg-gray-50 text-gray-400'
                    }`}>{i + 1}</div>
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center text-[#C9A84C] font-bold text-sm shrink-0">
                      {(op.name || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    {/* Name + status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-primary">{op.name}</span>
                        {isBelow && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-500">Below average</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{op.bookings} bookings · {op.completed || 0} completed</div>
                    </div>
                    {/* Revenue bars */}
                    <div className="w-40 shrink-0 hidden lg:block">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${Math.min(100, lb[0]?.revenue > 0 ? (op.revenue / lb[0].revenue) * 100 : 0)}%`,
                          background: isBelow ? '#EF4444' : '#C9A84C',
                        }} />
                      </div>
                    </div>
                    {/* Revenue */}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-extrabold text-primary">£{(op.revenue || 0).toFixed(2)}</div>
                      <div className="text-[10px] text-gray-400">Avg: £{avg.toFixed(0)}</div>
                    </div>
                    {/* Chevron */}
                    <svg className={`w-4 h-4 text-gray-300 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="px-5 pb-5 border-t border-gray-50">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-400">Total Revenue</div>
                          <div className="text-lg font-extrabold text-primary">£{(op.revenue || 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-400">Your Cut</div>
                          <div className="text-lg font-extrabold text-[#C9A84C]">£{(op.salon_cut || 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-400">Their Cut</div>
                          <div className="text-lg font-extrabold text-primary">£{(op.operator_cut || 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-400">Avg per Booking</div>
                          <div className="text-lg font-extrabold text-primary">£{op.bookings > 0 ? (op.revenue / op.bookings).toFixed(2) : '0.00'}</div>
                        </div>
                      </div>
                      {isBelow && (
                        <div className="flex gap-2 mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                          <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          <span>{op.name} is below the average revenue this {period}. Consider checking their availability or discussing performance.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default MothershipPerformance
