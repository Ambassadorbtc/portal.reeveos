/**
 * Analytics & Payments — Rezvo branded
 * Polished pill tabs, gradient charts, Lucide icons, Figtree everywhere
 */
import { useState, useEffect, useMemo } from 'react'
import {
  PoundSterling, Users, CalendarCheck, UserX, TrendingUp, TrendingDown,
  CreditCard, BarChart3, ArrowRight, ChevronRight, Wallet, Receipt,
  RefreshCw, Download, Filter
} from 'lucide-react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import RezvoLoader from '../../components/shared/RezvoLoader'

/* ═══ KPI Card ═══ */
const KpiCard = ({ label, value, Icon, iconColor, iconBg, trend, trendLabel, trendUp }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_-5px_rgba(17,17,17,0.08)] transition-all duration-300 group"
    style={{ fontFamily: "'Figtree', sans-serif" }}>
    <div className="flex justify-between items-start mb-3">
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <h3 className="text-2xl font-extrabold text-gray-900 mt-1 group-hover:text-primary transition-colors">{value}</h3>
      </div>
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>
    </div>
    {trend && (
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold flex items-center gap-1 ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
          {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {trend}
        </span>
        <span className="text-[11px] text-gray-400 font-medium">{trendLabel}</span>
      </div>
    )}
  </div>
)

/* ═══ Pill Tab ═══ */
const PillTab = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
      active
        ? 'bg-primary text-white shadow-lg shadow-primary/20'
        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
    }`}>
    {Icon && <Icon className="w-4 h-4" />}
    {label}
  </button>
)

/* ═══ Range Pill ═══ */
const RangePill = ({ active, onClick, label }) => (
  <button onClick={onClick}
    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
      active
        ? 'bg-primary text-white shadow-md shadow-primary/20'
        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
    }`}>
    {label}
  </button>
)

/* ═══ Main ═══ */
const Payments = () => {
  const { business, loading: bizLoading } = useBusiness()
  const [tab, setTab] = useState('analytics')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({})
  const [transactions, setTransactions] = useState([])
  const [txSummary, setTxSummary] = useState({})
  const [chartRange, setChartRange] = useState('30')

  const bid = business?.id ?? business?._id

  useEffect(() => {
    if (!bid) { setLoading(false); return }
    const load = async () => {
      try {
        const [s, t] = await Promise.all([
          api.get(`/analytics/business/${bid}?days=${chartRange}`).catch(() => ({})),
          api.get(`/analytics/business/${bid}/transactions`).catch(() => ({ transactions: [], summary: {} }))
        ])
        setStats(s); setTransactions(t.transactions || []); setTxSummary(t.summary || {})
      } catch {}
      setLoading(false)
    }
    load()
  }, [bid, chartRange])

  const kpis = [
    { label: 'Total Revenue', value: stats.total_revenue ? `£${Number(stats.total_revenue).toLocaleString('en-GB', {minimumFractionDigits: 2})}` : '£0.00', Icon: PoundSterling, iconColor: '#111111', iconBg: 'bg-emerald-50', trend: stats.revenue_trend || '—', trendLabel: 'vs last 30 days', trendUp: (stats.revenue_trend_pct || 0) > 0 },
    { label: 'Occupancy', value: stats.occupancy_rate ? `${stats.occupancy_rate}%` : '—', Icon: Users, iconColor: '#2563EB', iconBg: 'bg-blue-50', trend: stats.occupancy_trend || '—', trendLabel: 'vs last 30 days', trendUp: (stats.occupancy_trend_pct || 0) > 0 },
    { label: 'Bookings', value: stats.total_bookings || '0', Icon: CalendarCheck, iconColor: '#D97706', iconBg: 'bg-amber-50', trend: stats.bookings_trend || '—', trendLabel: 'vs last 30 days', trendUp: (stats.bookings_trend_pct || 0) > 0 },
    { label: 'No-Show Rate', value: stats.no_show_rate ? `${stats.no_show_rate}%` : '—', Icon: UserX, iconColor: '#EF4444', iconBg: 'bg-red-50', trend: stats.no_show_trend || '—', trendLabel: 'Improvement', trendUp: (stats.no_show_trend_pct || 0) < 0 },
  ]

  const topItems = (stats.top_items || []).slice(0, 5).map(i => ({
    name: i.name, bookings: i.count || 0, revenue: i.revenue || 0,
  }))

  const revData = useMemo(() => {
    if (stats.daily_revenue?.length > 0) return stats.daily_revenue
    return []
  }, [stats.daily_revenue, chartRange])

  const maxRev = revData.length > 0 ? Math.max(...revData.map(d => d.revenue || 0)) : 0

  const displayTx = transactions

  if (bizLoading || loading) return <RezvoLoader message="Loading analytics..." />

  return (
    <div className="space-y-6" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* ═══ PILL TABS ═══ */}
      <div className="flex items-center gap-2 -mt-2">
        <PillTab active={tab === 'analytics'} onClick={() => setTab('analytics')} icon={BarChart3} label="Analytics" />
        <PillTab active={tab === 'payments'} onClick={() => setTab('payments')} icon={CreditCard} label="Payments" />
      </div>

      {/* ═══ ANALYTICS TAB ═══ */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-extrabold text-lg text-gray-900">Revenue & Occupancy</h3>
                <div className="flex gap-2">
                  <RangePill active={chartRange === '30'} onClick={() => setChartRange('30')} label="30 Days" />
                  <RangePill active={chartRange === '90'} onClick={() => setChartRange('90')} label="90 Days" />
                </div>
              </div>
              {/* Branded bar chart */}
              <div className="h-[280px] flex items-end gap-px px-1">
                {revData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all z-10 pointer-events-none shadow-lg"
                      style={{ fontFamily: "'Figtree', sans-serif" }}>
                      £{d.revenue} · {d.bookings} covers
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                    </div>
                    <div
                      className="w-full rounded-t-sm cursor-pointer transition-all duration-200 group-hover:opacity-100"
                      style={{
                        height: `${(d.revenue / maxRev) * 240}px`,
                        background: `linear-gradient(to top, #111111, #1a1a1a)`,
                        opacity: 0.7 + (d.revenue / maxRev) * 0.3,
                      }}
                    />
                    {(chartRange === '30' ? i % 5 === 0 : i % 15 === 0) && (
                      <span className="text-[8px] text-gray-400 font-medium mt-1">{d.day}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Top Menu Items */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col">
              <h3 className="font-extrabold text-lg text-gray-900 mb-4">Top Menu Items</h3>
              <div className="flex-1 space-y-1">
                {topItems.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-xs"
                        style={{
                          background: i === 0 ? '#ECFDF5' : i === 1 ? '#EFF6FF' : i === 2 ? '#FFF7ED' : '#F3F4F6',
                          color: i === 0 ? '#059669' : i === 1 ? '#2563EB' : i === 2 ? '#D97706' : '#6B7280',
                        }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">{s.name}</p>
                        <p className="text-[11px] text-gray-400 font-medium">{s.bookings} bookings</p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-gray-900">£{s.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                <button className="text-xs font-bold text-primary hover:text-emerald-700 flex items-center justify-center gap-1 mx-auto transition-colors">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Staff Performance */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
              <h3 className="font-extrabold text-lg text-gray-900 mb-5">Staff Performance</h3>
              <div className="space-y-4">
                {(stats.staff_performance || []).map((s, i) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-bold text-gray-900">{s.name}</span>
                      <span className="font-bold text-gray-500">£{Number(s.revenue).toLocaleString()}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${s.pct}%`,
                          background: i === 0 ? 'linear-gradient(to right, #111111, #1a1a1a)' : i === 1 ? 'linear-gradient(to right, #1a1a1a, #52B788)' : i === 2 ? '#52B788' : '#D1D5DB',
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Booking Channels */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
              <h3 className="font-extrabold text-lg text-gray-900 mb-5">Booking Channels</h3>
              <div className="space-y-4">
                {(stats.booking_channels || []).map(c => (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-bold text-gray-900">{c.name}</span>
                      <span className="font-bold text-gray-500">{c.pct}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.pct}%`, background: c.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PAYMENTS TAB ═══ */}
      {tab === 'payments' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Collected', value: '£' + Number(txSummary.total_collected || stats.total_collected || 0).toLocaleString('en-GB', {minimumFractionDigits: 2}), Icon: Wallet, iconBg: 'bg-emerald-50', iconColor: '#059669' },
              { label: 'Pending Deposits', value: '£' + Number(txSummary.pending || 0).toLocaleString('en-GB', {minimumFractionDigits: 2}), Icon: Receipt, iconBg: 'bg-amber-50', iconColor: '#D97706' },
              { label: 'Refunds', value: '£' + Number(txSummary.refunds || 0).toLocaleString('en-GB', {minimumFractionDigits: 2}), Icon: RefreshCw, iconBg: 'bg-red-50', iconColor: '#EF4444' },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] group hover:shadow-[0_10px_30px_-5px_rgba(17,17,17,0.08)] transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <c.Icon className="w-5 h-5" style={{ color: c.iconColor }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.label}</p>
                    <h3 className="text-xl font-extrabold text-gray-900">{c.value}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Transactions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-gray-900">Recent Transactions</h3>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all">
                  <Filter className="w-3.5 h-3.5" /> Filter
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all">
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Guest</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Description</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Amount</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayTx.map(tx => (
                    <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-gray-500 font-medium whitespace-nowrap">{tx.date}</td>
                      <td className="px-5 py-3.5 font-bold text-gray-900">{tx.client}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          tx.type === 'Payment' ? 'bg-emerald-50 text-emerald-700' :
                          tx.type === 'Deposit' ? 'bg-blue-50 text-blue-700' :
                          'bg-red-50 text-red-600'
                        }`}>{tx.type}</span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{tx.desc}</td>
                      <td className={`px-5 py-3.5 text-right font-extrabold ${tx.amount < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                        {tx.amount < 0 ? '-' : ''}£{Math.abs(tx.amount).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          tx.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                          tx.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-600'
                        }`}>{tx.status === 'completed' ? 'Completed' : tx.status === 'pending' ? 'Pending' : 'Refunded'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Payments
