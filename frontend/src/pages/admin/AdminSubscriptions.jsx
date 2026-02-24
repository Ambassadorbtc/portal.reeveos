import { useState, useEffect } from 'react'
import { CreditCard, RefreshCw, TrendingUp, Building2, Crown, Zap } from 'lucide-react'

const api = (path) => fetch(`/api${path}`).then(r => r.ok ? r.json() : null).catch(() => null)

const TIER_CONFIG = {
  free: { label: 'Free', price: '£0', color: 'gray', icon: Building2 },
  starter: { label: 'Starter', price: '£8.99', color: 'blue', icon: Zap },
  growth: { label: 'Growth', price: '£29', color: 'emerald', icon: TrendingUp },
  scale: { label: 'Scale', price: '£59', color: 'purple', icon: Crown },
  enterprise: { label: 'Enterprise', price: 'Custom', color: 'amber', icon: Crown },
}

export default function AdminSubscriptions() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const res = await api('/admin/subscriptions')
    setData(res)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const tiers = data?.tier_distribution || {}

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Subscriptions</h1>
          <p className="text-xs text-gray-500 mt-0.5">Revenue, MRR tracking, and plan distribution</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 text-xs hover:bg-gray-700">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Revenue cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">MRR</p>
          <p className="text-2xl font-bold text-emerald-400">{data?.mrr || '£0'}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">ARR</p>
          <p className="text-2xl font-bold text-white">{data?.arr || '£0'}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Businesses</p>
          <p className="text-2xl font-bold text-white">{data?.total ?? '—'}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Paid Businesses</p>
          <p className="text-2xl font-bold text-blue-400">
            {Object.entries(tiers).filter(([k]) => k !== 'free').reduce((sum, [, v]) => sum + v, 0)}
          </p>
        </div>
      </div>

      {/* Tier distribution */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-bold text-white mb-4">Tier Distribution</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(TIER_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon
            const count = tiers[key] || 0
            return (
              <div key={key} className={`rounded-xl p-4 border ${
                count > 0 ? `bg-${cfg.color}-500/5 border-${cfg.color}-500/20` : 'bg-gray-800/50 border-gray-800'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <Icon size={14} className={`text-${cfg.color}-400`} />
                  <span className="text-xs text-gray-500">{cfg.price}/mo</span>
                </div>
                <p className="text-xl font-bold text-white">{count}</p>
                <p className="text-xs text-gray-500">{cfg.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stripe Connect status */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
        <p className="text-xs text-amber-400 font-medium mb-1">Stripe Connect Not Configured</p>
        <p className="text-xs text-gray-400">
          Subscription billing via Stripe Connect needs configuring. Once live, this page will show real-time MRR, ARR, 
          failed payments, dunning status, and churn analytics. Currently showing tier data from MongoDB.
        </p>
      </div>

      {/* Business list */}
      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-emerald-500" size={20} /></div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Business</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Tier</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 hidden md:table-cell">Email</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 hidden lg:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data?.businesses?.map((b, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3 px-4">
                    <span className="text-white font-medium">{b.name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      b.tier === 'free' ? 'bg-gray-800 text-gray-400' :
                      b.tier === 'starter' ? 'bg-blue-500/10 text-blue-400' :
                      b.tier === 'growth' ? 'bg-emerald-500/10 text-emerald-400' :
                      b.tier === 'scale' ? 'bg-purple-500/10 text-purple-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {b.tier || 'free'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs hidden md:table-cell truncate max-w-[200px]">
                    {b.owner_email || '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs hidden lg:table-cell">
                    {b.created_at ? new Date(b.created_at).toLocaleDateString('en-GB') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
