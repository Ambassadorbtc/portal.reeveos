import AppLoader from "../../components/shared/AppLoader"
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const StatCard = ({ value, label, sub }) => (
  <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
    <div className="text-2xl font-extrabold text-primary">{value}</div>
    <div className="text-xs text-gray-400 font-semibold mt-1">{label}</div>
    {sub && <div className="text-[10px] text-[#C9A84C] font-bold mt-1">{sub}</div>}
  </div>
)

const MothershipDashboard = () => {
  const { business } = useBusiness()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('week')
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

  if (loading) return <AppLoader message="Loading mothership..." />

  if (!business?.mothership_mode) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4"/></svg>
        </div>
        <h2 className="font-heading font-bold text-xl text-primary mb-2">Self-Employed Mode not enabled</h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">Enable it in Settings to see your Mothership dashboard.</p>
        <button onClick={() => navigate('/dashboard/mothership/settings')} className="text-sm font-bold text-white bg-primary px-6 py-2.5 rounded-lg hover:bg-primary-hover shadow-md">Enable in Settings</button>
      </div>
    )
  }

  const d = data || {}
  const lb = d.leaderboard || []

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]" style={{ fontFamily: "'Figtree',sans-serif" }}>
      <div className="px-6 md:px-8 pt-6 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-heading font-extrabold text-primary">Mothership</h1>
            <p className="text-sm text-gray-500 mt-0.5">{d.operator_count || 0} active operators · {d.period || 'this week'}</p>
          </div>
          <div className="flex gap-1.5">
            {['week', 'month', 'all'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${period === p ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard value={`£${(d.total_revenue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} label="Total Revenue" />
          <StatCard value={d.total_bookings || 0} label="Total Bookings" />
          <StatCard value={`£${(d.salon_commission_earned || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} label="Your Commission" sub="Your cut from all operators" />
          <StatCard value={`${d.utilisation_percent || 0}%`} label="Chair Utilisation" />
        </div>

        {/* Leaderboard */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-heading font-bold text-primary">Operator Leaderboard</h2>
            <button onClick={() => navigate('/dashboard/mothership/performance')} className="text-xs font-bold text-[#C9A84C] hover:underline">View Performance →</button>
          </div>
          {lb.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No operator data yet. Invite operators and bookings will appear here.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {lb.map((op, i) => (
                <div key={op.id} className={`flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors ${i < 3 ? '' : ''}`}>
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                    i === 0 ? 'bg-[#C9A84C]/15 text-[#C9A84C]' : i === 1 ? 'bg-gray-100 text-gray-500' : i === 2 ? 'bg-orange-50 text-orange-400' : 'bg-gray-50 text-gray-300'
                  }`}>{i + 1}</div>
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center text-[#C9A84C] font-bold text-sm shrink-0">
                    {(op.name || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-primary truncate">{op.name}</div>
                    <div className="text-[11px] text-gray-400">{op.bookings} bookings · {op.completed || 0} completed</div>
                  </div>
                  {/* Revenue */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-extrabold text-primary">£{(op.revenue || 0).toFixed(2)}</div>
                    <div className="text-[10px] text-gray-400">Your cut: £{(op.salon_cut || 0).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <button onClick={() => navigate('/dashboard/mothership/team')} className="bg-white border border-gray-100 rounded-xl p-5 text-left hover:shadow-md hover:border-primary/20 transition-all">
            <svg className="w-5 h-5 text-[#C9A84C] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            <div className="text-sm font-bold text-primary">Invite Operator</div>
            <div className="text-xs text-gray-400 mt-0.5">Add a new self-employed team member</div>
          </button>
          <button onClick={() => navigate('/dashboard/mothership/payments')} className="bg-white border border-gray-100 rounded-xl p-5 text-left hover:shadow-md hover:border-primary/20 transition-all">
            <svg className="w-5 h-5 text-[#C9A84C] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <div className="text-sm font-bold text-primary">Settlements</div>
            <div className="text-xs text-gray-400 mt-0.5">Generate payment reports</div>
          </button>
          <button onClick={() => navigate('/dashboard/mothership/bookings')} className="bg-white border border-gray-100 rounded-xl p-5 text-left hover:shadow-md hover:border-primary/20 transition-all">
            <svg className="w-5 h-5 text-[#C9A84C] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <div className="text-sm font-bold text-primary">All Bookings</div>
            <div className="text-xs text-gray-400 mt-0.5">Master view across all operators</div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default MothershipDashboard
