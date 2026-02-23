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
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const bid = business?.id ?? business?._id
    if (!bid || isDemo) { setLoading(false); return }
    const fetchData = async () => {
      try {
        const res = await api.get(`/dashboard/business/${bid}/summary`)
        setAnalytics(res)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [business?.id ?? business?._id])

  const topServices = [
    { rank: '01', name: 'Ladies Cut & Blow Dry', bookings: 45, revenue: '£2,250' },
    { rank: '02', name: 'Full Head Colour', bookings: 28, revenue: '£2,380' },
    { rank: '03', name: 'Balayage', bookings: 15, revenue: '£1,800' },
    { rank: '04', name: "Men's Cut", bookings: 62, revenue: '£1,550' },
    { rank: '05', name: 'Olaplex Treatment', bookings: 30, revenue: '£900' },
  ]

  const transactions = [
    { date: 'Today, 10:42 AM', desc: 'Ladies Cut & Blow Dry', customer: 'Emma Stone', method: 'visa', card: '4242', amount: '£45.00', status: 'paid' },
    { date: 'Today, 09:15 AM', desc: 'Full Head Colour', customer: 'Sarah Rose', method: 'apple', card: '', amount: '£85.00', status: 'paid' },
    { date: 'Yesterday, 4:30 PM', desc: 'Deposit: Balayage', customer: 'Jessica M.', method: 'mastercard', card: '8890', amount: '£30.00', status: 'paid' },
    { date: 'Yesterday, 2:00 PM', desc: 'Refund: Product Return', customer: 'Mike T.', method: 'visa', card: '1234', amount: '-£15.00', status: 'refunded' },
  ]

  const methodIcons = { visa: 'fa-cc-visa', mastercard: 'fa-cc-mastercard', apple: 'fa-apple-pay', amex: 'fa-cc-amex' }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line' },
            { id: 'payments', label: 'Payments', icon: 'fa-credit-card' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-primary hover:border-gray-300'}`}>
              <i className={`fa-solid ${t.icon}`} /> {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">Business Hub</h1>
          <p className="text-sm text-gray-500 mt-1">Last 30 Days</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg text-sm font-bold text-primary hover:bg-gray-50 shadow-sm">
          <i className="fa-solid fa-download" /> Export Report
        </button>
      </div>

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Revenue" value={analytics?.revenue ? `£${(analytics.revenue / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '£12,450.00'} icon="fa-sterling-sign" iconBg="bg-primary/5 text-primary" trend="12.5%" trendLabel="vs last 30 days" trendUp />
            <KpiCard label="Occupancy" value={analytics?.occupancy || '84%'} icon="fa-users" iconBg="bg-blue-50 text-blue-500" trend="4.2%" trendLabel="vs last 30 days" trendUp />
            <KpiCard label="Bookings" value={analytics?.totalBookings || '142'} icon="fa-calendar-check" iconBg="bg-amber-50 text-amber-500" trend="1.8%" trendLabel="vs last 30 days" trendUp={false} />
            <KpiCard label="No-Show Rate" value={analytics?.noShowRate || '2.1%'} icon="fa-user-slash" iconBg="bg-red-50 text-red-500" trend="0.5%" trendLabel="Improvement" trendUp />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart Placeholder */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-border p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-heading font-bold text-lg text-primary">Revenue & Occupancy</h3>
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-xs font-bold rounded-md bg-primary text-white">30 Days</button>
                  <button className="px-3 py-1 text-xs font-bold rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200">90 Days</button>
                </div>
              </div>
              <div className="h-[300px] flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-border">
                <div className="text-center">
                  <i className="fa-solid fa-chart-area text-4xl text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 font-medium">Revenue chart will appear here</p>
                  <p className="text-xs text-gray-400 mt-1">Connected to your live booking data</p>
                </div>
              </div>
            </div>

            {/* Top Services */}
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm flex flex-col">
              <h3 className="font-heading font-bold text-lg text-primary mb-4">Top Services</h3>
              <div className="flex-1 space-y-3">
                {topServices.map(s => (
                  <div key={s.rank} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{s.rank}</div>
                      <div>
                        <p className="text-sm font-bold text-primary">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.bookings} bookings</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary">{s.revenue}</span>
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
              <h3 className="font-heading font-bold text-lg text-primary mb-4">Staff Performance</h3>
              <div className="h-[250px] flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-border">
                <div className="text-center"><i className="fa-solid fa-chart-bar text-3xl text-gray-300 mb-2" /><p className="text-sm text-gray-500">Staff metrics chart</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <h3 className="font-heading font-bold text-lg text-primary mb-4">Booking Channels</h3>
              <div className="h-[250px] flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-border">
                <div className="text-center"><i className="fa-solid fa-chart-pie text-3xl text-gray-300 mb-2" /><p className="text-sm text-gray-500">Channel distribution chart</p></div>
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
                <div className="w-12 h-12 bg-[#635BFF] text-white rounded-lg flex items-center justify-center text-2xl"><i className="fa-brands fa-stripe" /></div>
                <div>
                  <h3 className="text-lg font-heading font-bold text-primary flex items-center gap-2">
                    Stripe Connect Active
                    <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Verified</span>
                  </h3>
                  <p className="text-sm text-gray-500">Your account is fully set up to receive payments and payouts.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-bold text-primary hover:bg-gray-50 flex items-center gap-2"><i className="fa-solid fa-gear" /> Settings</button>
                <button className="px-4 py-2 bg-[#635BFF] text-white rounded-lg text-sm font-bold hover:bg-[#534be0] flex items-center gap-2 shadow-md"><i className="fa-solid fa-arrow-up-right-from-square" /> Stripe Dashboard</button>
              </div>
            </div>
          </div>

          {/* Payment Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Balance */}
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Available for Payout</h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-heading font-bold text-primary">£845.20</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-border mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500 font-medium">Next Payout</span>
                  <span className="text-xs font-bold text-primary">Tomorrow</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: '75%' }} /></div>
              </div>
              <button className="w-full py-2 border border-border rounded-lg text-sm font-bold text-primary hover:bg-gray-50 transition-colors">View Payout Schedule</button>
            </div>

            {/* Deposit Rules */}
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-heading font-bold text-primary">Deposit Rules</h3>
                <div className="w-9 h-5 bg-primary rounded-full relative cursor-pointer"><div className="absolute top-[2px] right-[2px] w-4 h-4 bg-white rounded-full" /></div>
              </div>
              <p className="text-sm text-gray-500 mb-4">Require deposits to reduce no-shows. Deposits are automatically deducted from the final bill.</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-border"><span className="text-sm font-bold text-primary">Deposit Amount</span><span className="text-sm font-bold text-primary">20%</span></div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-border"><span className="text-sm font-bold text-primary">Threshold</span><span className="text-sm font-bold text-primary">Orders {'>'} £30</span></div>
              </div>
              <button className="mt-4 w-full text-xs font-bold text-primary hover:underline text-center">Configure Rules</button>
            </div>

            {/* No-Show Protection */}
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-heading font-bold text-primary">No-Show Protection</h3>
                <div className="w-9 h-5 bg-gray-200 rounded-full relative cursor-pointer"><div className="absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full" /></div>
              </div>
              <p className="text-sm text-gray-500 mb-4">Secure card details for all bookings. Charge a fee for late cancellations or no-shows.</p>
              <div className="p-3 border border-dashed border-border rounded-lg text-center bg-gray-50/50">
                <p className="text-xs text-gray-500 italic">Currently disabled. Enable to reduce revenue loss from empty slots.</p>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-lg font-heading font-bold text-primary">Recent Transactions</h3>
              <div className="flex gap-2">
                <div className="relative">
                  <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input type="text" placeholder="Search..." className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:border-primary w-48" />
                </div>
                <button className="px-3 py-1.5 border border-border rounded-lg text-sm font-bold text-gray-500 hover:text-primary hover:bg-gray-50"><i className="fa-solid fa-filter mr-1" /> Filter</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    {['Date', 'Description', 'Customer', 'Method', 'Amount', 'Status', ''].map(h => (
                      <th key={h} className={`px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider ${h === 'Amount' ? 'text-right' : ''} ${h === 'Status' ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{t.date}</td>
                      <td className="px-6 py-4 text-sm font-bold text-primary whitespace-nowrap">{t.desc}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{t.customer}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        <i className={`fa-brands ${methodIcons[t.method] || 'fa-credit-card'} text-lg mr-2 align-middle`} />
                        {t.card ? `•••• ${t.card}` : 'Apple Pay'}
                      </td>
                      <td className={`px-6 py-4 text-sm font-bold text-right whitespace-nowrap ${t.amount.startsWith('-') ? 'text-gray-500' : 'text-primary'}`}>{t.amount}</td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${t.status === 'paid' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-gray-100 text-gray-500 border border-border'}`}>
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap"><button className="text-gray-400 hover:text-primary"><i className="fa-solid fa-ellipsis" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-between items-center bg-gray-50">
              <span className="text-xs text-gray-500">Showing 1-4 of 128 transactions</span>
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
