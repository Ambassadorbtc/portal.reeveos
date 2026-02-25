import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Payments & Analytics — styled to match 9-Brand Design - Payments & Anal.html
 * Tabs: Analytics (KPI cards, charts, top services) | Payments (Stripe, deposits, transactions)
 */

import { useState, useEffect } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const KpiCard = ({ label, value, icon, iconBg, trend, trendLabel, trendUp }) => (
  <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
        <h3 className="text-2xl font-heading font-bold text-primary mt-1">{value}</h3>
      </div>
      <div className={`p-2 rounded-lg ${iconBg}`}><i className={`fa-solid ${icon}`} /></div>
    </div>
    {trend && (
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold flex items-center gap-1 ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
          <i className={`fa-solid ${trendUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`} /> {trend}
        </span>
        <span className="text-xs text-gray-500">{trendLabel}</span>
      </div>
    )}
  </div>
)

const Payments = () => {
  const { business, isDemo } = useBusiness()
  const [tab, setTab] = useState('analytics')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({})
  const [transactions, setTransactions] = useState([])
  const [chartRange, setChartRange] = useState('30')

  const bid = business?.id ?? business?._id

  useEffect(() => {
    if (!bid || isDemo) { setLoading(false); return }
    const fetch = async () => {
      try {
        const [s, t] = await Promise.all([
          api.get(`/analytics/business/${bid}`).catch(() => ({})),
          api.get(`/payments/business/${bid}/transactions`).catch(() => ({ transactions: [] }))
        ])
        setStats(s); setTransactions(t.transactions || [])
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetch()
  }, [bid, isDemo])

  const demoKpis = [
    { label: 'Total Revenue', value: '£12,450.00', icon: 'fa-sterling-sign', iconBg: 'bg-primary/5 text-primary', trend: '12.5%', trendLabel: 'vs last 30 days', trendUp: true },
    { label: 'Occupancy', value: '84%', icon: 'fa-users', iconBg: 'bg-blue-100 text-blue-600', trend: '4.2%', trendLabel: 'vs last 30 days', trendUp: true },
    { label: 'Bookings', value: '142', icon: 'fa-calendar-check', iconBg: 'bg-amber-100 text-amber-600', trend: '1.8%', trendLabel: 'vs last 30 days', trendUp: false },
    { label: 'No-Show Rate', value: '2.1%', icon: 'fa-user-slash', iconBg: 'bg-red-100 text-red-500', trend: '0.5%', trendLabel: 'Improvement', trendUp: true },
  ]

  const demoTopServices = [
    { name: 'Ladies Cut & Blow Dry', bookings: 45, revenue: 2250 },
    { name: 'Full Head Colour', bookings: 28, revenue: 2380 },
    { name: 'Balayage', bookings: 15, revenue: 1800 },
    { name: "Men's Cut", bookings: 62, revenue: 1550 },
    { name: 'Olaplex Treatment', bookings: 30, revenue: 900 },
  ]

  const demoTransactions = [
    { id: 't1', date: 'Oct 25, 2:30 PM', client: 'Emma Stone', type: 'Payment', desc: 'Ladies Cut & Blow Dry', amount: 45, status: 'completed', method: 'Card' },
    { id: 't2', date: 'Oct 25, 11:15 AM', client: 'Craig Mango', type: 'Deposit', desc: 'Deposit: Balayage', amount: 24, status: 'completed', method: 'Card' },
    { id: 't3', date: 'Oct 24, 4:00 PM', client: 'Anna Lee', type: 'Payment', desc: 'Deep Conditioning', amount: 35, status: 'completed', method: 'Apple Pay' },
    { id: 't4', date: 'Oct 24, 10:00 AM', client: 'James H.', type: 'Refund', desc: 'Cancelled: Mens Cut', amount: -25, status: 'refunded', method: 'Card' },
    { id: 't5', date: 'Oct 23, 3:45 PM', client: 'Sarah Rose', type: 'Payment', desc: 'Full Head Colour', amount: 85, status: 'completed', method: 'Google Pay' },
  ]

  const demoRevData = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    revenue: Math.floor(Math.random() * 300 + 200),
    bookings: Math.floor(Math.random() * 8 + 2),
  }))

  const maxRev = Math.max(...demoRevData.map(d => d.revenue))

  const displayTransactions = transactions.length > 0 ? transactions : (isDemo ? demoTransactions : [])

  if (loading) {
    return <RezvoLoader message="Loading payments..." />
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-border -mt-2">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setTab('analytics')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-colors ${tab === 'analytics' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-primary hover:border-gray-300'}`}>
            <i className="fa-solid fa-chart-line" /> Analytics
          </button>
          <button onClick={() => setTab('payments')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-colors ${tab === 'payments' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-primary hover:border-gray-300'}`}>
            <i className="fa-solid fa-credit-card" /> Payments
          </button>
        </nav>
      </div>

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {demoKpis.map((k, i) => <KpiCard key={i} {...k} />)}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-border p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-heading font-bold text-lg text-primary">Revenue & Occupancy</h3>
                <div className="flex gap-2">
                  {['30', '90'].map(r => (
                    <button key={r} onClick={() => setChartRange(r)}
                      className={`px-3 py-1 text-xs font-bold rounded-md ${chartRange === r ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {r} Days
                    </button>
                  ))}
                </div>
              </div>
              {/* Simple bar chart visualization */}
              <div className="h-[300px] flex items-end gap-1 px-2">
                {demoRevData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      £{d.revenue} • {d.bookings} bookings
                    </div>
                    <div
                      className="w-full bg-primary/20 hover:bg-primary/40 rounded-t transition-colors cursor-pointer"
                      style={{ height: `${(d.revenue / maxRev) * 250}px` }}
                    />
                    {i % 5 === 0 && <span className="text-[9px] text-gray-400 mt-1">{d.day}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Top Services */}
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm flex flex-col">
              <h3 className="font-heading font-bold text-lg text-primary mb-4">Top Services</h3>
              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {demoTopServices.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{String(i + 1).padStart(2, '0')}</div>
                      <div>
                        <p className="text-sm font-bold text-primary">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.bookings} bookings</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary">£{s.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border text-center">
                <button className="text-sm font-bold text-primary hover:underline">View All Services</button>
              </div>
            </div>
          </div>

          {/* Secondary Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <h3 className="font-heading font-bold text-lg text-primary mb-6">Staff Performance</h3>
              <div className="space-y-4">
                {[{ name: 'Sarah Jenkins', rev: 4200, pct: 85 }, { name: 'Mike Ross', rev: 3100, pct: 62 }, { name: 'Tom Walker', rev: 2800, pct: 56 }, { name: 'Emma Smith', rev: 1350, pct: 27 }].map(s => (
                  <div key={s.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-bold text-primary">{s.name}</span>
                      <span className="text-gray-500">£{s.rev.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <h3 className="font-heading font-bold text-lg text-primary mb-6">Booking Channels</h3>
              <div className="space-y-4">
                {[{ name: 'Direct / Walk-in', pct: 35, color: 'bg-primary' }, { name: 'Online Booking', pct: 42, color: 'bg-blue-500' }, { name: 'Google Reserve', pct: 15, color: 'bg-amber-500' }, { name: 'Instagram', pct: 8, color: 'bg-pink-500' }].map(c => (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-bold text-primary">{c.name}</span>
                      <span className="text-gray-500">{c.pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${c.color} rounded-full transition-all`} style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENTS TAB */}
      {tab === 'payments' && (
        <div className="space-y-6">
          {/* Stripe Banner */}
          <div className="bg-white rounded-xl border border-border p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8" />
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#635BFF] text-white rounded-lg flex items-center justify-center text-2xl">
                  <i className="fa-brands fa-stripe" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-lg text-primary">Stripe Connect Active</h3>
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                  <p className="text-sm text-gray-500">Payments go directly to your Stripe account. Next payout: <span className="font-bold text-primary">£850.00</span> on Oct 27.</p>
                </div>
              </div>
              <button className="text-sm font-bold text-primary border border-border bg-white px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2 shadow-sm">
                <i className="fa-solid fa-arrow-up-right-from-square" /> Open Stripe Dashboard
              </button>
            </div>
          </div>

          {/* Deposit Settings + Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-heading font-bold text-primary">Deposit Rules</h3>
                <button className="relative inline-flex h-5 w-10 items-center rounded-full bg-green-500">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-5 shadow" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Require deposits to reduce no-shows. Deposits are automatically deducted from the final bill.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-primary block mb-1">Deposit Amount</label>
                  <div className="flex items-center gap-2">
                    <input type="number" defaultValue={20} className="w-20 px-3 py-2 border border-border rounded-lg text-sm font-bold text-primary text-center" />
                    <span className="text-sm font-bold text-gray-500">% of service price</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-primary block mb-1">Minimum Deposit</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-gray-400 font-bold text-sm">£</span></div>
                    <input type="number" defaultValue={10} className="w-full pl-8 pr-3 py-2 border border-border rounded-lg text-sm font-bold text-primary" />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-heading font-bold text-primary">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">This month</span>
                  <span className="text-sm font-bold text-primary">£3,240.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Outstanding</span>
                  <span className="text-sm font-bold text-amber-600">£180.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Refunds</span>
                  <span className="text-sm font-bold text-red-500">-£75.00</span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-primary">Net Revenue</span>
                  <span className="text-lg font-heading font-bold text-primary">£3,165.00</span>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-heading font-bold text-primary">Recent Transactions</h3>
              <button className="text-sm font-bold text-primary border border-border px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2 shadow-sm">
                <i className="fa-solid fa-download" /> Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-border text-xs uppercase tracking-wider text-gray-500 font-bold">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Method</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {displayTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{t.date}</td>
                      <td className="px-6 py-4 font-bold text-primary whitespace-nowrap">{t.client}</td>
                      <td className="px-6 py-4 text-primary whitespace-nowrap">{t.desc}</td>
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{t.method}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${
                          t.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                          t.status === 'refunded' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {t.status === 'completed' ? 'Completed' : t.status === 'refunded' ? 'Refunded' : 'Pending'}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-bold whitespace-nowrap ${t.amount < 0 ? 'text-red-500' : 'text-primary'}`}>
                        {t.amount < 0 ? '-' : ''}£{Math.abs(t.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-border flex justify-between items-center bg-gray-50">
              <span className="text-xs text-gray-500">Showing 1-{displayTransactions.length} of {displayTransactions.length}</span>
              <div className="flex gap-2">
                <button className="px-3 py-1 border border-border bg-white rounded text-xs font-bold text-gray-400 disabled:opacity-50" disabled>Previous</button>
                <button className="px-3 py-1 border border-border bg-white rounded text-xs font-bold text-primary hover:bg-gray-50">Next</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Payments
