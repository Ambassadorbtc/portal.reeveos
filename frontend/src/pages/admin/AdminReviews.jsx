import adminFetch from '../../utils/adminFetch'
import { useState, useEffect, useCallback } from 'react'
import { Star, RefreshCw, ThumbsUp, ThumbsDown, Flag, CheckCircle2, Search, Filter, MessageSquare, X } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''
const STATUS_C = { pending:'#F59E0B', approved:'#10B981', flagged:'#EF4444', hidden:'#6B7280' }

export default function AdminReviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [stats, setStats] = useState({ avg:0, total:0, pending:0 })

  const load = useCallback(async () => {
    try {
      const r = await adminFetch(`${API}/admin/reviews?status=${filter}`)
      if (r.ok) { const d = await r.json(); setReviews(d.reviews||[]); setStats(d.stats||{avg:0,total:0,pending:0}) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const moderate = async (id, action) => {
    try { await adminFetch(`${API}/admin/reviews/${id}/moderate`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action}) }); load() } catch(e) { console.error(e) }
  }

  const Stars = ({n}) => <div className="flex gap-0.5">{[1,2,3,4,5].map(i=><Star key={i} size={11} className={i<=n?'text-amber-400 fill-amber-400':'text-gray-700'}/>)}</div>
  const dist = [5,4,3,2,1].map(n=>({n, count:reviews.filter(r=>r.rating===n).length}))

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center"><Star size={18} className="text-amber-400"/></div>
            <div><h1 className="text-lg font-bold text-white">Reviews & Moderation</h1><p className="text-[11px] text-gray-500">{stats.total} reviews · {stats.avg?.toFixed(1)} avg · {stats.pending} pending</p></div>
          </div>
          <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><RefreshCw size={14}/></button>
        </div>
        <div className="flex gap-4 mb-3">
          <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3 flex-1">
            <div className="text-3xl font-bold text-white">{stats.avg?.toFixed(1)||'—'}</div>
            <div>{dist.map(d=><div key={d.n} className="flex items-center gap-1.5"><span className="text-[9px] text-gray-500 w-2">{d.n}</span><div className="w-20 h-1 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{width:`${stats.total?d.count/stats.total*100:0}%`}}/></div><span className="text-[9px] text-gray-600">{d.count}</span></div>)}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setFilter('')} className={`px-3 py-1 rounded-lg text-[11px] font-medium ${!filter?'bg-gray-700 text-white':'text-gray-500'}`}>All</button>
          {Object.entries(STATUS_C).map(([s,c])=><button key={s} onClick={()=>setFilter(f=>f===s?'':s)} className="px-3 py-1 rounded-lg text-[11px] font-medium capitalize" style={{color:c,backgroundColor:`${c}${filter===s?'20':'08'}`}}>{s}</button>)}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {reviews.length===0&&<div className="text-center py-12 text-sm text-gray-600">No reviews{filter?` with status "${filter}"`:' yet'}. Reviews will appear here as diners leave feedback.</div>}
        {reviews.map(r=>(
          <div key={r._id} className="p-4 rounded-xl border border-gray-800 bg-gray-900/60">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1"><Stars n={r.rating}/><span className="text-xs font-semibold text-gray-200">{r.guest_name||'Anonymous'}</span></div>
                <p className="text-[10px] text-gray-500">{r.business_name||'Unknown business'} · {r.created_at?new Date(r.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):''}</p>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded capitalize font-bold" style={{color:STATUS_C[r.status||'pending'],backgroundColor:`${STATUS_C[r.status||'pending']}15`}}>{r.status||'pending'}</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed mb-3">{r.text||r.comment||'No comment'}</p>
            <div className="flex gap-2">
              <button onClick={()=>moderate(r._id,'approved')} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/20"><CheckCircle2 size={11}/>Approve</button>
              <button onClick={()=>moderate(r._id,'flagged')} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-semibold hover:bg-red-500/20"><Flag size={11}/>Flag</button>
              <button onClick={()=>moderate(r._id,'hidden')} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-700/50 text-gray-400 text-[10px] font-semibold hover:bg-gray-700"><X size={11}/>Hide</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
