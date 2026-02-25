import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Restaurant Home Dashboard — matching UXPilot 6-Design App - Home Dashboard.html
 * Stats cards, occupancy chart, floor status, quick actions, live activity, upcoming arrivals
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, CalendarCheck, Clock, PoundSterling, Armchair, CalendarPlus, Ban, FileText, ArrowRight, ArrowUpRight, Filter, Search, Download, MoreVertical, TrendingUp } from 'lucide-react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const AVATAR_COLORS = ['bg-amber-100 text-amber-700','bg-purple-100 text-purple-700','bg-blue-100 text-blue-700','bg-green-100 text-green-700','bg-pink-100 text-pink-600','bg-gray-100 text-gray-600']
const getAv = (n) => { let h=0; for(let i=0;i<(n||'').length;i++) h=n.charCodeAt(i)+((h<<5)-h); return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length] }
const getInit = (n) => (n||'??').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)

const Dashboard = () => {
  const navigate = useNavigate()
  const { business, businessType } = useBusiness()
  const bid = business?.id ?? business?._id
  const [bookings, setBookings] = useState([])
  const [activity, setActivity] = useState([])
  const [stats, setStats] = useState({ total: 0, upcoming: 0, revenue: 0, newClients: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bid) { setLoading(false); return }
    const load = async () => {
      try {
        const res = await api.get(`/bookings/business/${bid}?limit=20&status=all`)
        const bks = res.bookings || []
        setBookings(bks)
        setStats({
          total: res.counts?.total || bks.length || 0,
          upcoming: bks.filter(b => ['confirmed','pending'].includes(b.status)).length,
          revenue: 0,
          newClients: bks.filter(b => b.isNewClient).length || 0,
        })
        setActivity(bks.slice(0, 5).map(b => ({
          id: b.id,
          text: `New booking: ${b.customerName}`,
          sub: `${b.service || 'Booking'}, ${b.date} at ${b.time}`,
          time: b.createdAt ? timeAgo(b.createdAt) : '',
          color: b.status === 'confirmed' ? 'bg-emerald-500' : b.status === 'pending' ? 'bg-amber-400' : 'bg-blue-400',
        })))
      } catch { }
      setLoading(false)
    }
    load()
  }, [bid])

  const timeAgo = (d) => {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff/60000)
    if (m < 60) return `${m} min ago`
    const h = Math.floor(m/60)
    if (h < 24) return `${h} hr ago`
    return `${Math.floor(h/24)}d ago`
  }

  // Demo data
  const demoStats = { total: 248, upcoming: 42, revenue: 3850, newClients: 12 }
  const demoActivity = [
    { id:1, text: <><b>Table 12</b> was seated.</>, sub: 'Assigned to: Sarah M.', time: '2m', color: 'bg-emerald-500' },
    { id:2, text: <>New Online Booking: <b>Miller (4)</b></>, sub: 'For Tomorrow, 7:00 PM', time: '15m', color: 'bg-[#D4A373]' },
    { id:3, text: <><b>Table 05</b> marked as Dirty.</>, sub: 'Check paid (£142.50)', time: '22m', color: 'bg-red-400' },
    { id:4, text: <>Shift Started: <b>Dinner Service</b></>, sub: 'Manager: Alex Johnson', time: '1h', color: 'bg-primary' },
    { id:5, text: <>Review Received: <b>5 Stars</b></>, sub: '"Excellent service by Mark!"', time: '2h', color: 'bg-blue-400' },
  ]
  const demoArrivals = [
    { id:'a1', time:'6:30 PM', name:'John Doe', phone:'+44 555 123 4567', guests:4, table:'T-02', status:'confirmed', statusLabel:'Confirmed', statusBg:'bg-blue-50 text-blue-600 border-blue-100', notes:'Anniversary, Window seat', action:'Seat' },
    { id:'a2', time:'6:45 PM', name:'Alice Smith', phone:'Regular', guests:2, table:null, status:'late', statusLabel:'Late (5m)', statusBg:'bg-yellow-50 text-yellow-600 border-yellow-100', notes:'—', action:'Assign', vip:true },
    { id:'a3', time:'7:00 PM', name:'Mike Brown', phone:'+44 555 987 6543', guests:6, table:'T-08', status:'confirmed', statusLabel:'Partially Arrived', statusBg:'bg-green-50 text-green-600 border-green-100', notes:'Birthday, Cake provided', action:'Seat' },
  ]

  const isDemo = !bookings.length
  const s = isDemo ? demoStats : stats
  const activityList = isDemo ? demoActivity : activity
  const arrivals = isDemo ? demoArrivals : bookings.filter(b=>['confirmed','pending'].includes(b.status)).slice(0,5).map(b=>({
    id:b.id, time:b.time, name:b.customerName, phone:b.customer?.phone||'', guests:b.guests||b.partySize||2,
    table:b.table||b.tableName, status:b.status, statusLabel:b.status==='confirmed'?'Confirmed':'Pending',
    statusBg:b.status==='confirmed'?'bg-blue-50 text-blue-600 border-blue-100':'bg-amber-50 text-amber-600 border-amber-100',
    notes:b.notes||'—', action:b.status==='confirmed'?'Seat':'Confirm',
  }))

  if (loading) return <RezvoLoader message="Loading dashboard..." />

  const statCards = [
    { label: 'Total Covers Today', value: s.total, icon: <Users className="w-5 h-5" />, iconBg: 'text-primary', trend: '12%', trendUp: true, sub: 'vs last week' },
    { label: 'Upcoming Reservations', value: s.upcoming, icon: <CalendarCheck className="w-5 h-5" />, iconBg: 'text-primary', sub: 'Next: 6:30 PM (Party of 6)' },
    { label: 'Waitlist', value: 4, icon: <Clock className="w-5 h-5" />, iconBg: 'text-[#D4A373]', sub: '~25 min avg. wait', hoverColor: 'group-hover:text-[#D4A373]' },
    { label: 'Revenue Estimate', value: `£${s.revenue.toLocaleString() || '3,850'}`, icon: <PoundSterling className="w-5 h-5" />, iconBg: 'text-emerald-500', trend: '4.2%', trendUp: true, sub: 'vs yesterday', hoverColor: 'group-hover:text-emerald-500' },
  ]

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)] overflow-y-auto" style={{ fontFamily: "'Figtree', sans-serif" }}>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 pb-12">

        {/* Stat Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((c,i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_-5px_rgba(27,67,50,0.1)] transition-all duration-300 group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{c.label}</p>
                  <h3 className={`text-3xl font-extrabold text-gray-900 ${c.hoverColor || 'group-hover:text-primary'} transition-colors`}>{c.value}</h3>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gray-50 ${c.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  {c.icon}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {c.trend && (
                  <span className="text-green-600 font-bold flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded">
                    <TrendingUp className="w-3 h-3" /> {c.trend}
                  </span>
                )}
                <span className="text-gray-400">{c.sub}</span>
              </div>
            </div>
          ))}
        </section>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* Left Column */}
          <div className="xl:col-span-2 space-y-8">

            {/* Occupancy Chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Occupancy Trends</h2>
                  <p className="text-sm text-gray-500">Live seating vs capacity over time</p>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-1 text-xs font-medium">
                  <button className="px-3 py-1.5 bg-white text-gray-900 rounded shadow-sm">Today</button>
                  <button className="px-3 py-1.5 text-gray-500 hover:text-gray-900">Week</button>
                  <button className="px-3 py-1.5 text-gray-500 hover:text-gray-900">Month</button>
                </div>
              </div>
              {/* Simple SVG chart */}
              <div className="h-[200px] relative">
                <svg viewBox="0 0 600 200" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#52B788" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#52B788" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d="M0,160 C50,135 100,100 150,110 C200,120 250,140 300,60 C350,20 400,30 450,50 C500,70 550,100 600,130 L600,200 L0,200 Z" fill="url(#chartFill)" />
                  <path d="M0,160 C50,135 100,100 150,110 C200,120 250,140 300,60 C350,20 400,30 450,50 C500,70 550,100 600,130" fill="none" stroke="#1B4332" strokeWidth="2.5" />
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-gray-400 px-2">
                  {['12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM','9PM','10PM'].map(t => <span key={t}>{t}</span>)}
                </div>
              </div>
            </div>

            {/* Floor Status */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Floor Status</h2>
                  <p className="text-sm text-gray-500">Main Dining Room · 78% Capacity</p>
                </div>
                <button onClick={() => navigate('/dashboard/floor-plan')} className="text-sm font-semibold text-primary hover:text-emerald-700 flex items-center gap-1">
                  Full View <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative bg-gray-50 h-[300px] p-6 overflow-hidden">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                {/* Table 1 - Seated (circle) */}
                <div className="absolute top-8 left-8 w-24 h-24 rounded-full bg-white border-2 border-emerald-500 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-shadow">
                  <span className="font-bold text-primary text-sm">T-01</span>
                  <div className="flex gap-0.5 mt-1">
                    {[1,2,3].map(i=><span key={i} className="w-2 h-2 rounded-full bg-emerald-500"/>)}
                    <span className="w-2 h-2 rounded-full bg-gray-200"/>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium mt-1">45m</span>
                </div>

                {/* Table 2 - Reserved (rect) */}
                <div className="absolute top-8 left-40 w-24 h-24 rounded-lg bg-white border-2 border-[#D4A373] shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-shadow">
                  <span className="font-bold text-primary text-sm">T-02</span>
                  <span className="text-[10px] text-[#D4A373] font-bold mt-1">6:30 PM</span>
                  <span className="text-[10px] text-gray-400">Smith (4)</span>
                </div>

                {/* Table 3 - Available */}
                <div className="absolute top-40 left-8 w-32 h-24 rounded-lg bg-white border-2 border-gray-200 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-shadow opacity-70 hover:opacity-100">
                  <span className="font-bold text-gray-400 text-sm">T-03</span>
                  <span className="text-[10px] text-green-600 font-medium mt-1">Available</span>
                </div>

                {/* Table 4 - Seated VIP */}
                <div className="absolute top-40 left-52 w-24 h-24 rounded-full bg-white border-2 border-primary shadow-md flex flex-col items-center justify-center cursor-pointer ring-2 ring-[#D4A373]/30 relative">
                  <div className="absolute -top-2 -right-2 bg-[#D4A373] text-white text-[10px] font-bold px-1.5 rounded-full shadow-sm">VIP</div>
                  <span className="font-bold text-primary text-sm">T-04</span>
                  <div className="flex gap-0.5 mt-1">
                    {[1,2].map(i=><span key={i} className="w-2 h-2 rounded-full bg-primary"/>)}
                  </div>
                  <span className="text-[10px] text-primary font-medium mt-1">12m</span>
                </div>

                {/* Table 5 - Dirty */}
                <div className="absolute top-8 right-16 w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-red-300 flex flex-col items-center justify-center cursor-pointer">
                  <span className="font-bold text-gray-500 text-sm">T-05</span>
                  <span className="text-[10px] text-red-500 font-bold mt-1">🧹 DIRTY</span>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex gap-4 text-xs text-gray-500 font-medium">
                {[{c:'bg-emerald-500',l:'Seated'},{c:'bg-[#D4A373]',l:'Reserved'},{c:'bg-gray-300',l:'Available'},{c:'bg-red-400',l:'Dirty'}].map(s=>(
                  <div key={s.l} className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${s.c}`}/>{s.l}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">

            {/* Quick Actions */}
            <div className="bg-primary rounded-2xl p-6 text-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-400 opacity-10 rounded-full -ml-10 -mb-10 blur-xl" />
              <h2 className="text-lg font-bold mb-4 relative z-10">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3 relative z-10">
                {[
                  { icon: <Armchair className="w-5 h-5 text-emerald-400" />, label: 'Walk-In' },
                  { icon: <CalendarPlus className="w-5 h-5 text-[#D4A373]" />, label: 'Reserve' },
                  { icon: <Ban className="w-5 h-5 text-red-300" />, label: 'Block Tbl' },
                  { icon: <FileText className="w-5 h-5 text-blue-300" />, label: 'Run Sheet' },
                ].map(a => (
                  <button key={a.label} className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-all group">
                    <span className="group-hover:scale-110 transition-transform">{a.icon}</span>
                    <span className="text-xs font-semibold">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Activity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col" style={{ maxHeight: 420 }}>
              <div className="p-5 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h2 className="text-lg font-bold text-gray-900">Live Activity</h2>
                <button className="text-gray-400 hover:text-primary"><Filter className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {activityList.map(a => (
                  <div key={a.id} className="p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full ${a.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{a.text}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.sub}</p>
                    </div>
                    <span className="text-xs text-gray-400 font-medium shrink-0">{a.time}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-gray-100 text-center shrink-0">
                <button onClick={() => navigate('/dashboard/notifications')} className="text-xs font-bold text-primary hover:text-emerald-700 uppercase tracking-wide">
                  View All Activity
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Arrivals Table */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Upcoming Arrivals</h2>
              <p className="text-sm text-gray-500">Next 2 hours</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="text" placeholder="Filter list..." className="pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary w-48" />
              </div>
              <button className="bg-gray-50 hover:bg-gray-100 text-gray-600 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium transition-colors flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Guest</th>
                  <th className="px-6 py-4">Size</th>
                  <th className="px-6 py-4">Table</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {arrivals.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50/50 group transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{a.time}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${getAv(a.name)} font-bold text-xs flex items-center justify-center`}>{getInit(a.name)}</div>
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-bold text-gray-900">{a.name}</p>
                            {a.vip && <span className="text-[10px] bg-[#D4A373] text-white px-1.5 rounded font-bold">VIP</span>}
                          </div>
                          <p className="text-xs text-gray-500">{a.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-gray-400" /> {a.guests}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${a.table ? 'text-gray-600' : 'text-gray-400 italic'}`}>{a.table || 'Unassigned'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${a.statusBg}`}>{a.statusLabel}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-[150px]">{a.notes}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button className="text-primary hover:text-emerald-700 font-bold text-xs bg-gray-50 hover:bg-white border border-transparent hover:border-primary/30 px-3 py-1.5 rounded transition-all shadow-sm">{a.action}</button>
                      <button className="text-gray-400 hover:text-gray-600 ml-2"><MoreVertical className="w-4 h-4 inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-center">
            <button onClick={() => navigate('/dashboard/bookings')} className="text-sm font-medium text-gray-600 hover:text-primary flex items-center gap-2">
              View All Upcoming <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Dashboard
