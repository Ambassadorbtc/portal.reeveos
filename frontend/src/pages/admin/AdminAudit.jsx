import { useState, useEffect, useCallback } from 'react'
import { ScrollText, RefreshCw, Filter, Search, User, Building2, Calendar, Settings, Mail, Bot, CreditCard, Globe } from 'lucide-react'
import adminFetch from '../../utils/adminFetch'

const API = import.meta.env.VITE_API_URL || ''
const TYPE_C = { auth:'#3B82F6', booking:'#10B981', business:'#F59E0B', payment:'#8B5CF6', email:'#EC4899', agent:'#6366F1', admin:'#EF4444', system:'#6B7280' }
const TYPE_I = { auth:User, booking:Calendar, business:Building2, payment:CreditCard, email:Mail, agent:Bot, admin:Settings, system:Globe }

export default function AdminAudit() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    try {
      const r = await adminFetch(`${API}/admin/audit/logs?type=${filter}&search=${search}&page=${page}&limit=50`)
      if (r.ok) { const d = await r.json(); setLogs(d.logs||[]); setTotal(d.total||0) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [filter, search, page])

  useEffect(() => { load() }, [load])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-500/15 flex items-center justify-center"><ScrollText size={18} className="text-gray-400"/></div>
            <div><h1 className="text-lg font-bold text-white">Activity Log</h1><p className="text-[11px] text-gray-500">{total} events logged · System-wide audit trail</p></div>
          </div>
          <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><RefreshCw size={14}/></button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search logs..." className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50 text-xs text-gray-300 placeholder-gray-600 focus:outline-none"/></div>
          <button onClick={()=>setFilter('')} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${!filter?'bg-gray-700 text-white':'text-gray-500'}`}>All</button>
          {Object.entries(TYPE_C).map(([t,c])=><button key={t} onClick={()=>setFilter(f=>f===t?'':t)} className="px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize" style={{color:c,backgroundColor:`${c}${filter===t?'20':'08'}`}}>{t}</button>)}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {logs.length===0&&<div className="text-center py-12 text-sm text-gray-600">No activity logs yet. Events will be recorded as users interact with the platform.</div>}
        <div className="space-y-1">
          {logs.map((l,i)=>{
            const Icon = TYPE_I[l.type] || Globe
            const color = TYPE_C[l.type] || '#6B7280'
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-800/30 transition-colors">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{backgroundColor:`${color}12`}}><Icon size={13} style={{color}}/></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200">{l.message||l.action||'Activity recorded'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-gray-600">{l.user||l.actor||'System'}</span>
                    <span className="text-[9px] text-gray-700">·</span>
                    <span className="text-[9px] text-gray-600">{l.created_at?new Date(l.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}</span>
                    {l.ip&&<><span className="text-[9px] text-gray-700">·</span><span className="text-[9px] text-gray-700 font-mono">{l.ip}</span></>}
                  </div>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded capitalize font-semibold shrink-0" style={{color,backgroundColor:`${color}12`}}>{l.type||'system'}</span>
              </div>
            )
          })}
        </div>
        {total>50&&<div className="flex justify-center gap-2 mt-4"><button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1 rounded text-xs text-gray-400 bg-gray-800 disabled:opacity-30">Prev</button><span className="text-xs text-gray-500 py-1">Page {page}</span><button onClick={()=>setPage(p=>p+1)} className="px-3 py-1 rounded text-xs text-gray-400 bg-gray-800">Next</button></div>}
      </div>
    </div>
  )
}
