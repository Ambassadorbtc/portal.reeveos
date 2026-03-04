import adminFetch from '../../utils/adminFetch'
import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw, TrendingDown, Building2, Calendar, CreditCard, Activity, Shield } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''
const RISK_C = { high:'#EF4444', medium:'#F59E0B', low:'#10B981', none:'#6B7280' }

export default function AdminChurn() {
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total:0, at_risk:0, healthy:0 })

  const load = useCallback(async () => {
    try {
      const r = await adminFetch(`${API}/admin/churn/overview`)
      if (r.ok) { const d = await r.json(); setBusinesses(d.businesses||[]); setStats(d.stats||{total:0,at_risk:0,healthy:0}) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const riskLevel = (score) => score >= 70 ? 'high' : score >= 40 ? 'medium' : score > 0 ? 'low' : 'none'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center"><AlertTriangle size={18} className="text-red-400"/></div>
            <div><h1 className="text-lg font-bold text-white">Churn Risk Monitor</h1><p className="text-[11px] text-gray-500">{stats.total} businesses · {stats.at_risk} at risk · {stats.healthy} healthy</p></div>
          </div>
          <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><RefreshCw size={14}/></button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            {label:'Healthy',count:businesses.filter(b=>riskLevel(b.churn_score)==='low'||riskLevel(b.churn_score)==='none').length,color:'#C9A84C',icon:Shield},
            {label:'Medium Risk',count:businesses.filter(b=>riskLevel(b.churn_score)==='medium').length,color:'#C9A84C',icon:Activity},
            {label:'High Risk',count:businesses.filter(b=>riskLevel(b.churn_score)==='high').length,color:'#C9A84C',icon:AlertTriangle},
            {label:'Avg Score',count:businesses.length?Math.round(businesses.reduce((s,b)=>s+(b.churn_score||0),0)/businesses.length):'—',color:'#C9A84C',icon:TrendingDown},
          ].map((s,i)=>(
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2"><s.icon size={14} style={{color:s.color}}/><span className="text-[10px] text-gray-500 uppercase font-semibold">{s.label}</span></div>
              <p className="text-xl font-bold text-white">{s.count}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <table className="w-full">
          <thead><tr className="text-[10px] uppercase tracking-wider text-gray-600 border-b border-gray-800">
            {['Business','Plan','Last Booking','Last Login','Churn Score','Risk','Actions'].map(h=><th key={h} className="text-left py-2 px-2 font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>
            {businesses.length===0&&<tr><td colSpan={7} className="py-12 text-center text-sm text-gray-600">No businesses to monitor yet. Business data will populate as restaurants onboard.</td></tr>}
            {businesses.sort((a,b)=>(b.churn_score||0)-(a.churn_score||0)).map(b=>{
              const risk = riskLevel(b.churn_score||0)
              return (
                <tr key={b._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2.5 px-2"><div className="flex items-center gap-2"><Building2 size={13} className="text-gray-600"/><span className="text-xs text-gray-200 font-medium">{b.name}</span></div></td>
                  <td className="py-2.5 px-2 text-xs text-gray-400">{b.plan||'Free'}</td>
                  <td className="py-2.5 px-2 text-xs text-gray-400">{b.last_booking?new Date(b.last_booking).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'Never'}</td>
                  <td className="py-2.5 px-2 text-xs text-gray-400">{b.last_login?new Date(b.last_login).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'Never'}</td>
                  <td className="py-2.5 px-2"><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${b.churn_score||0}%`,backgroundColor:RISK_C[risk]}}/></div><span className="text-[10px] font-mono" style={{color:RISK_C[risk]}}>{b.churn_score||0}</span></div></td>
                  <td className="py-2.5 px-2"><span className="text-[10px] px-2 py-0.5 rounded font-bold capitalize" style={{color:RISK_C[risk],backgroundColor:`${RISK_C[risk]}15`}}>{risk}</span></td>
                  <td className="py-2.5 px-2"><button className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-semibold hover:bg-emerald-500/20">Reach Out</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
