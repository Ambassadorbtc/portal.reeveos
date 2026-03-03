import adminFetch from '../../utils/adminFetch'
import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, RefreshCw, Clock, CheckCircle2, AlertTriangle, Search, Filter, X, Send, User } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''
const STATUS_C = { open:'#F59E0B', pending:'#3B82F6', resolved:'#10B981', closed:'#6B7280' }
const PRI_C = { high:'#EF4444', medium:'#F59E0B', low:'#6B7280' }

export default function AdminSupport() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('')
  const [reply, setReply] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await adminFetch(`${API}/admin/support/tickets`)
      if (r.ok) { const d = await r.json(); setTickets(d.tickets || []) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id, status) => {
    try { await adminFetch(`${API}/admin/support/tickets/${id}/status`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) }); load() } catch(e) { console.error(e) }
  }

  const sendReply = async (id) => {
    if (!reply.trim()) return
    try { await adminFetch(`${API}/admin/support/tickets/${id}/reply`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:reply,author:'Support'}) }); setReply(''); load() } catch(e) { console.error(e) }
  }

  const filtered = filter ? tickets.filter(t=>t.status===filter) : tickets
  const counts = { open:tickets.filter(t=>t.status==='open').length, pending:tickets.filter(t=>t.status==='pending').length, resolved:tickets.filter(t=>t.status==='resolved').length }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center"><MessageSquare size={18} className="text-orange-400"/></div>
            <div><h1 className="text-lg font-bold text-white">Support Tickets</h1><p className="text-[11px] text-gray-500">{counts.open} open · {counts.pending} pending · {counts.resolved} resolved</p></div>
          </div>
          <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><RefreshCw size={14}/></button>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setFilter('')} className={`px-3 py-1 rounded-lg text-[11px] font-medium ${!filter?'bg-gray-700 text-white':'text-gray-500 hover:text-gray-300'}`}>All ({tickets.length})</button>
          {Object.entries(STATUS_C).map(([s,c])=><button key={s} onClick={()=>setFilter(f=>f===s?'':s)} className="px-3 py-1 rounded-lg text-[11px] font-medium capitalize" style={{color:c,backgroundColor:filter===s?`${c}20`:`${c}08`}}>{s} ({tickets.filter(t=>t.status===s).length})</button>)}
        </div>
      </div>
      <div className="flex-1 overflow-hidden flex">
        <div className="w-80 border-r border-gray-800 overflow-y-auto">
          {filtered.length===0&&<div className="p-8 text-center text-xs text-gray-600">No tickets{filter?` with status "${filter}"`:''}</div>}
          {filtered.map(t=>(
            <button key={t._id} onClick={()=>setSelected(t)} className={`w-full text-left p-3 border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${selected?._id===t._id?'bg-gray-800/60 border-l-2 border-l-orange-500':''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-200 truncate flex-1">{t.subject||'No subject'}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded capitalize font-bold" style={{color:STATUS_C[t.status],backgroundColor:`${STATUS_C[t.status]}15`}}>{t.status}</span>
              </div>
              <p className="text-[10px] text-gray-500 truncate">{t.from_name||t.from_email||'Unknown'}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{t.created_at?new Date(t.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}</p>
            </button>
          ))}
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected?(
            <div className="flex-1 flex items-center justify-center"><p className="text-sm text-gray-600">Select a ticket to view details</p></div>
          ):(
            <>
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">{selected.subject||'No subject'}</h2>
                  <div className="flex gap-1">{Object.keys(STATUS_C).map(s=><button key={s} onClick={()=>updateStatus(selected._id,s)} className="px-2 py-0.5 rounded text-[10px] font-semibold capitalize" style={{color:STATUS_C[s],backgroundColor:selected.status===s?`${STATUS_C[s]}25`:`${STATUS_C[s]}08`}}>{s}</button>)}</div>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">From: {selected.from_name||selected.from_email} · {selected.priority&&<span style={{color:PRI_C[selected.priority]}} className="capitalize font-semibold">{selected.priority} priority</span>}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selected.messages?.map((m,i)=>(
                  <div key={i} className={`p-3 rounded-lg max-w-[80%] ${m.from==='customer'?'bg-gray-800 mr-auto':'bg-emerald-900/20 border border-emerald-800/30 ml-auto'}`}>
                    <p className="text-xs text-gray-300 whitespace-pre-wrap">{m.text}</p>
                    <p className="text-[9px] text-gray-600 mt-1">{m.author||m.from} · {m.at?new Date(m.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):''}</p>
                  </div>
                ))}
                {(!selected.messages||selected.messages.length===0)&&<div className="p-3 rounded-lg bg-gray-800"><p className="text-xs text-gray-400">{selected.body||'No message content'}</p></div>}
              </div>
              <div className="p-3 border-t border-gray-800 flex gap-2">
                <textarea value={reply} onChange={e=>setReply(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendReply(selected._id)}}} placeholder="Reply..." rows={2} className="flex-1 text-xs bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-gray-300 placeholder-gray-600 focus:outline-none resize-none"/>
                <button onClick={()=>sendReply(selected._id)} className="self-end p-2 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"><Send size={14}/></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
