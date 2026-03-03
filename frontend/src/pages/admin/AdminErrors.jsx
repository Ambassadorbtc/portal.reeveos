import adminFetch from '../../utils/adminFetch'
import { useState, useEffect, useCallback } from 'react'
import { Bug, RefreshCw, AlertTriangle, XCircle, CheckCircle2, Search, Filter, Clock, ExternalLink } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''
const SEV_C = { critical:'#EF4444', error:'#F97316', warning:'#F59E0B', info:'#3B82F6' }
const STATUS_C = { open:'#EF4444', investigating:'#F59E0B', resolved:'#10B981', ignored:'#6B7280' }

export default function AdminErrors() {
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await adminFetch(`${API}/admin/errors?severity=${filter}`)
      if (r.ok) { const d = await r.json(); setErrors(d.errors||[]) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const updateError = async (id, status) => {
    try { await adminFetch(`${API}/admin/errors/${id}/status`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) }); load() } catch(e) { console.error(e) }
  }

  const stats = { total:errors.length, critical:errors.filter(e=>e.severity==='critical').length, open:errors.filter(e=>e.status==='open').length, resolved:errors.filter(e=>e.status==='resolved').length }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stats.critical>0?'bg-red-500/15':'bg-emerald-500/15'}`}><Bug size={18} className={stats.critical>0?'text-red-400':'text-emerald-400'}/></div>
            <div><h1 className="text-lg font-bold text-white">Error Logs</h1><p className="text-[11px] text-gray-500">{stats.total} errors · {stats.critical} critical · {stats.open} open</p></div>
          </div>
          <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><RefreshCw size={14}/></button>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setFilter('')} className={`px-3 py-1 rounded-lg text-[11px] font-medium ${!filter?'bg-gray-700 text-white':'text-gray-500'}`}>All ({errors.length})</button>
          {Object.entries(SEV_C).map(([s,c])=><button key={s} onClick={()=>setFilter(f=>f===s?'':s)} className="px-3 py-1 rounded-lg text-[11px] font-medium capitalize" style={{color:c,backgroundColor:`${c}${filter===s?'20':'08'}`}}>{s}</button>)}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {errors.length===0&&<div className="text-center py-12"><div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3"><CheckCircle2 size={20} className="text-emerald-400"/></div><p className="text-sm text-gray-400 font-medium mb-1">No errors</p><p className="text-xs text-gray-600">All systems running clean. Errors will appear here when they occur.</p></div>}
        <div className="space-y-2">
          {errors.map(e=>(
            <div key={e._id} className="p-4 rounded-xl border border-gray-800 bg-gray-900/60 cursor-pointer hover:border-gray-700" onClick={()=>setSelected(selected?._id===e._id?null:e)}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{color:SEV_C[e.severity],backgroundColor:`${SEV_C[e.severity]}15`}}>{e.severity}</span>
                  <span className="text-xs font-semibold text-gray-200">{e.message||'Unknown error'}</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded capitalize font-bold" style={{color:STATUS_C[e.status||'open'],backgroundColor:`${STATUS_C[e.status||'open']}15`}}>{e.status||'open'}</span>
              </div>
              <p className="text-[10px] text-gray-500">{e.source||'Unknown'} · {e.count||1} occurrences · {e.created_at?new Date(e.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}</p>
              {selected?._id===e._id&&(
                <div className="mt-3 pt-3 border-t border-gray-800">
                  {e.stack&&<pre className="text-[10px] text-gray-500 font-mono bg-gray-800 rounded-lg p-3 mb-3 overflow-x-auto whitespace-pre-wrap">{e.stack}</pre>}
                  <div className="flex gap-2">
                    <button onClick={(ev)=>{ev.stopPropagation();updateError(e._id,'investigating')}} className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[10px] font-semibold">Investigating</button>
                    <button onClick={(ev)=>{ev.stopPropagation();updateError(e._id,'resolved')}} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">Resolve</button>
                    <button onClick={(ev)=>{ev.stopPropagation();updateError(e._id,'ignored')}} className="px-2.5 py-1 rounded-lg bg-gray-700/50 text-gray-400 text-[10px] font-semibold">Ignore</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
