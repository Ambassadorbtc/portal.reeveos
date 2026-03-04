import adminFetch from '../../utils/adminFetch'
import { useState, useEffect, useCallback } from 'react'
import { BarChart3, RefreshCw, Users, Building2, CalendarCheck, CreditCard, TrendingUp, TrendingDown, Globe, Clock } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

const KPI = ({ label, value, change, icon: Icon }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
    <div className="flex items-center justify-between mb-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(201,168,76,0.1)' }}><Icon size={16} style={{ color: '#C9A84C' }}/></div>
      {change&&<span className={`text-xs font-medium ${change.startsWith('+')?'text-emerald-400':'text-red-400'}`}>{change}</span>}
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
  </div>
)

export default function AdminAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7d')

  const load = useCallback(async () => {
    try {
      const r = await adminFetch(`${API}/admin/analytics/platform?period=${period}`)
      if (r.ok) { setData(await r.json()) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [period])

  useEffect(() => { load() }, [load])

  const d = data || {}

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center"><BarChart3 size={18} className="text-emerald-400"/></div>
            <div><h1 className="text-lg font-bold text-white">Platform Analytics</h1><p className="text-[11px] text-gray-500">Growth rate, cohort analysis, feature adoption, and benchmarks</p></div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex bg-gray-800 rounded-lg p-0.5">{['24h','7d','30d','90d'].map(p=><button key={p} onClick={()=>setPeriod(p)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${period===p?'bg-gray-700 text-white':'text-gray-500 hover:text-gray-300'}`}>{p}</button>)}</div>
            <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><RefreshCw size={14}/></button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPI label="MRR" value={d.mrr||'£0'} change={d.mrr_change} icon={CreditCard}/>
          <KPI label="Active Businesses" value={d.businesses||0} change={d.biz_change} icon={Building2}/>
          <KPI label="Total Users" value={d.users||0} change={d.user_change} icon={Users}/>
          <KPI label="Bookings" value={d.bookings||0} change={d.booking_change} icon={CalendarCheck}/>
          <KPI label="Page Views" value={d.page_views||0} icon={Globe}/>
          <KPI label="Avg Session" value={d.avg_session||'0s'} icon={Clock}/>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-3">Revenue Breakdown</h3>
            <div className="space-y-3">
              {(d.revenue_breakdown||[
                {label:'Subscriptions',value:'£0',pct:0},
                {label:'Delivery Commission',value:'£0',pct:0},
                {label:'Booking Deposits',value:'£0',pct:0},
              ]).map((r,i)=>(
                <div key={i}><div className="flex items-center justify-between mb-1"><span className="text-xs text-gray-400">{r.label}</span><span className="text-xs text-white font-semibold">{r.value}</span></div><div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{width:`${r.pct}%`}}/></div></div>
              ))}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-3">Feature Adoption</h3>
            <div className="space-y-3">
              {(d.feature_adoption||[
                {label:'Booking System',pct:100,users:2},
                {label:'Floor Plan',pct:50,users:1},
                {label:'Menu Management',pct:100,users:2},
                {label:'Food Ordering',pct:0,users:0},
                {label:'Delivery',pct:0,users:0},
              ]).map((f,i)=>(
                <div key={i}><div className="flex items-center justify-between mb-1"><span className="text-xs text-gray-400">{f.label}</span><span className="text-[10px] text-gray-500">{f.users} businesses · {f.pct}%</span></div><div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${f.pct}%`,backgroundColor:f.pct>50?'#10B981':f.pct>0?'#F59E0B':'#374151'}}/></div></div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">Growth Metrics</h3>
          <div className="grid grid-cols-4 gap-4">
            {(d.growth_metrics||[
              {label:'WAU',value:0,change:'—'},{label:'DAU',value:0,change:'—'},{label:'Churn Rate',value:'0%',change:'—'},{label:'NPS',value:'—',change:'—'},
            ]).map((m,i)=>(
              <div key={i} className="text-center p-3 rounded-lg bg-gray-800/50"><p className="text-xl font-bold text-white">{m.value}</p><p className="text-[10px] text-gray-500 mt-0.5">{m.label}</p>{m.change!=='—'&&<p className={`text-[10px] mt-0.5 ${String(m.change).startsWith('+')?'text-emerald-400':'text-red-400'}`}>{m.change}</p>}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
