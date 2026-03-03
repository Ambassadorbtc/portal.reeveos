import adminFetch from '../../utils/adminFetch'
import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Plus, Search, Filter, Phone, Mail, Building2, RefreshCw, ArrowRight, ExternalLink, ChevronDown, Star, X, MapPin } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''
const STAGES = ['cold','warm','hot','demo','won','lost']
const STAGE_C = { cold:'#6B7280', warm:'#F59E0B', hot:'#EF4444', demo:'#3B82F6', won:'#10B981', lost:'#6B7280' }
const SRC = ['Google Places','Outreach','Referral','Inbound','Walk-in']

export default function AdminPipeline() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [noteText, setNoteText] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await adminFetch(`${API}/admin/pipeline/leads?stage=${filter}&search=${search}`)
      if (r.ok) { const d = await r.json(); setLeads(d.leads || []) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [filter, search])

  useEffect(() => { load() }, [load])

  const moveLead = async (id, stage) => {
    try { await adminFetch(`${API}/admin/pipeline/leads/${id}/move`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({stage}) }); load(); if(selected?._id===id) setSelected({...selected, stage}) } catch(e) { console.error(e) }
  }

  const addNote = async (id) => {
    if (!noteText.trim()) return
    try { await adminFetch(`${API}/admin/pipeline/leads/${id}/notes`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:noteText,author:'Founder'}) }); setNoteText(''); load() } catch(e) { console.error(e) }
  }

  const createLead = async (data) => {
    try { await adminFetch(`${API}/admin/pipeline/leads`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }); setShowAdd(false); load() } catch(e) { console.error(e) }
  }

  const grouped = STAGES.reduce((a,s) => ({...a,[s]:leads.filter(l=>l.stage===s)}),{})
  const stats = { total:leads.length, won:leads.filter(l=>l.stage==='won').length, hot:leads.filter(l=>l.stage==='hot'||l.stage==='demo').length, value:leads.filter(l=>l.stage==='won').reduce((s,l)=>s+(l.est_value||0),0) }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center"><TrendingUp size={18} className="text-blue-400"/></div>
            <div><h1 className="text-lg font-bold text-white">Sales Pipeline</h1><p className="text-[11px] text-gray-500">{stats.total} leads · {stats.hot} hot · {stats.won} won · £{stats.value.toLocaleString()} closed</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25"><Plus size={13}/>Add Lead</button>
            <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><RefreshCw size={14}/></button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search leads..." className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600"/></div>
          {STAGES.map(s=><button key={s} onClick={()=>setFilter(f=>f===s?'':s)} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize ${filter===s?'ring-1 ring-offset-1 ring-offset-gray-950':''}`} style={{color:STAGE_C[s],backgroundColor:`${STAGE_C[s]}15`,ringColor:STAGE_C[s]}}>{s} ({grouped[s]?.length||0})</button>)}
        </div>
      </div>
      <div className="flex-1 overflow-auto flex gap-3 p-4">
        {STAGES.filter(s=>s!=='lost').map(stage=>(
          <div key={stage} className="flex flex-col w-56 min-w-[224px] shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-t-lg" style={{backgroundColor:`${STAGE_C[stage]}08`}}>
              <span className="text-xs font-semibold capitalize" style={{color:STAGE_C[stage]}}>{stage}</span>
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{backgroundColor:`${STAGE_C[stage]}20`,color:STAGE_C[stage]}}>{grouped[stage]?.length||0}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pb-4">
              {(grouped[stage]||[]).map(l=>(
                <div key={l._id} onClick={()=>setSelected(l)} className="p-3 rounded-lg border border-gray-800 bg-gray-900/60 hover:border-gray-600 cursor-pointer group">
                  <div className="flex items-center justify-between mb-1"><span className="text-xs font-semibold text-gray-200 truncate">{l.name}</span>{l.score>=70&&<Star size={10} className="text-amber-400"/>}</div>
                  <p className="text-[10px] text-gray-500 truncate">{l.city||'No city'}</p>
                  {l.est_value>0&&<p className="text-[10px] text-emerald-400 mt-1">£{l.est_value}/mo</p>}
                  <div className="flex gap-0.5 mt-2 opacity-0 group-hover:opacity-100" onClick={e=>e.stopPropagation()}>
                    {STAGES.filter(s=>s!==stage&&s!=='lost').map(s=><button key={s} onClick={()=>moveLead(l._id,s)} className="px-1.5 py-0.5 rounded text-[8px] font-bold capitalize" style={{color:STAGE_C[s],backgroundColor:`${STAGE_C[s]}15`}}>{s}</button>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {showAdd&&<AddLeadModal onClose={()=>setShowAdd(false)} onCreate={createLead}/>}
      {selected&&<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={()=>setSelected(null)}><div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-5 max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-white">{selected.name}</h2><button onClick={()=>setSelected(null)} className="text-gray-500 hover:text-gray-300"><X size={16}/></button></div>
        <div className="space-y-2 text-xs text-gray-400 mb-4">
          {selected.email&&<div className="flex items-center gap-2"><Mail size={12}/>{selected.email}</div>}
          {selected.phone&&<div className="flex items-center gap-2"><Phone size={12}/>{selected.phone}</div>}
          {selected.city&&<div className="flex items-center gap-2"><MapPin size={12}/>{selected.city}</div>}
          <div className="flex items-center gap-2">Stage: <span className="capitalize font-semibold" style={{color:STAGE_C[selected.stage]}}>{selected.stage}</span></div>
        </div>
        <div className="flex gap-1 mb-4">{STAGES.map(s=><button key={s} onClick={()=>{moveLead(selected._id,s);setSelected({...selected,stage:s})}} className="px-2 py-1 rounded text-[10px] font-semibold capitalize" style={{color:STAGE_C[s],backgroundColor:selected.stage===s?`${STAGE_C[s]}30`:`${STAGE_C[s]}10`}}>{s}</button>)}</div>
        <div className="border-t border-gray-800 pt-3">
          <h3 className="text-xs font-semibold text-gray-400 mb-2">Notes</h3>
          {selected.notes?.map((n,i)=><div key={i} className="p-2 rounded bg-gray-800/50 mb-2 text-xs text-gray-300">{n.text}<div className="text-[9px] text-gray-600 mt-1">{n.author} · {n.at?new Date(n.at).toLocaleDateString('en-GB'):''}</div></div>)}
          <div className="flex gap-2 mt-2"><input value={noteText} onChange={e=>setNoteText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addNote(selected._id)} placeholder="Add note..." className="flex-1 text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-300 focus:outline-none"/><button onClick={()=>addNote(selected._id)} className="px-3 py-1.5 rounded bg-emerald-500/15 text-emerald-400 text-xs font-semibold">Add</button></div>
        </div>
      </div></div>}
    </div>
  )
}

function AddLeadModal({onClose,onCreate}){
  const [f,setF]=useState({name:'',email:'',phone:'',city:'Nottingham',source:'Outreach',stage:'cold',est_value:0,score:50})
  return(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}><div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-5" onClick={e=>e.stopPropagation()}>
      <div className="flex justify-between mb-4"><h2 className="text-sm font-bold text-white">Add Lead</h2><button onClick={onClose} className="text-gray-500"><X size={16}/></button></div>
      <div className="space-y-3">
        {[['Business Name','name'],['Email','email'],['Phone','phone'],['City','city']].map(([l,k])=><div key={k}><label className="text-[10px] text-gray-500 uppercase font-semibold">{l}</label><input value={f[k]} onChange={e=>setF(p=>({...p,[k]:e.target.value}))} className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 focus:outline-none"/></div>)}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Source</label><select value={f.source} onChange={e=>setF(p=>({...p,source:e.target.value}))} className="admin-select w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200">{SRC.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Est. Value (£/mo)</label><input type="number" value={f.est_value} onChange={e=>setF(p=>({...p,est_value:+e.target.value}))} className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 focus:outline-none"/></div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 rounded-lg text-xs text-gray-400 bg-gray-800">Cancel</button><button onClick={()=>onCreate(f)} className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600">Create</button></div>
    </div></div>
  )
}
