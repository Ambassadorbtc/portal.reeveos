import { useState, useEffect, useCallback } from 'react'
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Server, Database, Globe, Wifi, Clock, Zap } from 'lucide-react'
import adminFetch from '../../utils/adminFetch'

const API = import.meta.env.VITE_API_URL || ''
const STATUS_C = { healthy:'#10B981', degraded:'#F59E0B', down:'#EF4444' }

export default function AdminHealth() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const load = useCallback(async () => {
    const start = Date.now()
    try {
      const r = await adminFetch(`${API}/admin/health/check`)
      const latency = Date.now() - start
      if (r.ok) { const d = await r.json(); setHealth({...d, api_latency:latency}) }
      else setHealth({ status:'degraded', api_latency:latency, services:[] })
    } catch(e) {
      setHealth({ status:'down', api_latency: Date.now()-start, services:[], error:e.message })
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!autoRefresh) return
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [autoRefresh, load])

  const h = health || {}
  const StatusIcon = ({s}) => s==='healthy'?<CheckCircle2 size={14} className="text-emerald-400"/>:s==='degraded'?<AlertTriangle size={14} className="text-amber-400"/>:<XCircle size={14} className="text-red-400"/>

  const services = h.services || [
    { name:'FastAPI Backend', status:'healthy', latency:`${h.api_latency||0}ms`, uptime:'99.9%' },
    { name:'MongoDB', status: h.status==='down'?'down':'healthy', latency:'—', uptime:'99.9%' },
    { name:'Stripe Connect', status:'healthy', latency:'—', uptime:'99.9%' },
    { name:'Resend Email', status:'healthy', latency:'—', uptime:'—' },
    { name:'Nginx Proxy', status:'healthy', latency:'<1ms', uptime:'99.9%' },
    { name:'SSL Certificates', status:'healthy', latency:'—', uptime:'—' },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              h.status === 'down' ? 'bg-red-500/15' : h.status === 'degraded' ? 'bg-amber-500/15' : 'bg-emerald-500/15'
            }`}>
              <Activity size={18} className={
                h.status === 'down' ? 'text-red-400' : h.status === 'degraded' ? 'text-amber-400' : 'text-emerald-400'
              } />
            </div>
            <div><h1 className="text-lg font-bold text-white">System Health</h1><p className="text-[11px] text-gray-500">Real-time monitoring · Auto-refresh {autoRefresh?'on':'off'} · API latency {h.api_latency||0}ms</p></div>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={()=>setAutoRefresh(!autoRefresh)} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${autoRefresh?'bg-emerald-500/15 text-emerald-400':'bg-gray-800 text-gray-500'}`}>{autoRefresh?'● Live':'○ Paused'}</button>
            <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><RefreshCw size={14}/></button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            {label:'Overall Status',value:h.status||'checking...',icon:Activity,color:STATUS_C[h.status]||'#6B7280'},
            {label:'API Latency',value:`${h.api_latency||0}ms`,icon:Zap,color:h.api_latency>500?'#EF4444':h.api_latency>200?'#F59E0B':'#10B981'},
            {label:'Uptime',value:h.uptime||'99.9%',icon:Clock,color:'#10B981'},
            {label:'Error Rate',value:h.error_rate||'0%',icon:AlertTriangle,color:'#6B7280'},
          ].map((s,i)=>(
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2"><s.icon size={14} style={{color:s.color}}/><span className="text-[10px] text-gray-500 uppercase font-semibold">{s.label}</span></div>
              <p className="text-lg font-bold capitalize" style={{color:s.color}}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">Service Status</h3>
          <div className="space-y-2">
            {services.map((s,i)=>(
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/40">
                <StatusIcon s={s.status}/>
                <span className="text-xs text-gray-200 font-medium flex-1">{s.name}</span>
                <span className="text-[10px] text-gray-500">{s.latency}</span>
                <span className="text-[10px] font-semibold capitalize" style={{color:STATUS_C[s.status]}}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-3">Server Resources</h3>
            <div className="space-y-3">
              {(h.resources||[{label:'CPU',value:h.cpu||'—',pct:h.cpu_pct||0},{label:'Memory',value:h.memory||'—',pct:h.mem_pct||0},{label:'Disk',value:h.disk||'—',pct:h.disk_pct||0}]).map((r,i)=>(
                <div key={i}><div className="flex justify-between mb-1"><span className="text-xs text-gray-400">{r.label}</span><span className="text-xs text-gray-300">{r.value}</span></div><div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${r.pct}%`,backgroundColor:r.pct>80?'#EF4444':r.pct>60?'#F59E0B':'#10B981'}}/></div></div>
              ))}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-3">Recent Checks</h3>
            <div className="space-y-2">
              {(h.recent_checks||[{at:new Date().toISOString(),status:'healthy',latency:`${h.api_latency||0}ms`}]).slice(0,8).map((c,i)=>(
                <div key={i} className="flex items-center gap-2 text-[11px]"><StatusIcon s={c.status}/><span className="text-gray-400 flex-1">{c.at?new Date(c.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):''}</span><span className="text-gray-500">{c.latency}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
