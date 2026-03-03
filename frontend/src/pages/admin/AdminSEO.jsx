import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, Globe, CheckCircle2, Clock, AlertTriangle, Plus, ExternalLink, TrendingUp, FileText, X } from 'lucide-react'
import adminFetch from '../../utils/adminFetch'

const API = import.meta.env.VITE_API_URL || ''
const STATUS_C = { indexed:'#10B981', pending:'#F59E0B', error:'#EF4444', draft:'#6B7280' }

export default function AdminSEO() {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total:0, indexed:0, pending:0 })
  const [showGenerate, setShowGenerate] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await adminFetch(`${API}/admin/seo/pages`)
      if (r.ok) { const d = await r.json(); setPages(d.pages||[]); setStats(d.stats||{total:0,indexed:0,pending:0}) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const generatePages = async (data) => {
    try { await adminFetch(`${API}/admin/seo/generate`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }); setShowGenerate(false); load() } catch(e) { console.error(e) }
  }

  const requestIndex = async (id) => {
    try { await adminFetch(`${API}/admin/seo/pages/${id}/index`, { method:'POST' }); load() } catch(e) { console.error(e) }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center"><Globe size={18} className="text-cyan-400"/></div>
            <div><h1 className="text-lg font-bold text-white">SEO Pages</h1><p className="text-[11px] text-gray-500">{stats.total} pages · {stats.indexed} indexed · {stats.pending} pending</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setShowGenerate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/25"><Plus size={13}/>Generate Pages</button>
            <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><RefreshCw size={14}/></button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            {label:'Total Pages',value:stats.total,icon:FileText,color:'#6B7280'},
            {label:'Indexed',value:stats.indexed,icon:CheckCircle2,color:'#10B981'},
            {label:'Pending',value:stats.pending,icon:Clock,color:'#F59E0B'},
            {label:'Errors',value:stats.errors||0,icon:AlertTriangle,color:'#EF4444'},
          ].map((s,i)=>(
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2"><s.icon size={14} style={{color:s.color}}/><span className="text-[10px] text-gray-500 uppercase font-semibold">{s.label}</span></div>
              <p className="text-xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <table className="w-full">
          <thead><tr className="text-[10px] uppercase tracking-wider text-gray-600 border-b border-gray-800">
            {['Page','URL','City','Cuisine','Status','Actions'].map(h=><th key={h} className="text-left py-2 px-2 font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>
            {pages.length===0&&<tr><td colSpan={6} className="py-12 text-center text-sm text-gray-600">No SEO pages generated yet. Generate city+cuisine landing pages to drive organic traffic.</td></tr>}
            {pages.map(p=>(
              <tr key={p._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2.5 px-2 text-xs text-gray-200 font-medium">{p.title||`${p.cuisine} in ${p.city}`}</td>
                <td className="py-2.5 px-2 text-[10px] text-gray-500 font-mono">{p.slug||'—'}</td>
                <td className="py-2.5 px-2 text-xs text-gray-400">{p.city}</td>
                <td className="py-2.5 px-2 text-xs text-gray-400">{p.cuisine}</td>
                <td className="py-2.5 px-2"><span className="text-[10px] px-2 py-0.5 rounded font-bold capitalize" style={{color:STATUS_C[p.status||'draft'],backgroundColor:`${STATUS_C[p.status||'draft']}15`}}>{p.status||'draft'}</span></td>
                <td className="py-2.5 px-2 flex gap-1">
                  <button onClick={()=>requestIndex(p._id)} className="text-[10px] px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 font-semibold">Index</button>
                  {p.url&&<a href={p.url} target="_blank" rel="noopener" className="text-[10px] px-2 py-1 rounded bg-gray-800 text-gray-400"><ExternalLink size={10}/></a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showGenerate&&<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={()=>setShowGenerate(false)}><div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-5" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between mb-4"><h2 className="text-sm font-bold text-white">Generate SEO Pages</h2><button onClick={()=>setShowGenerate(false)} className="text-gray-500"><X size={16}/></button></div>
        <div className="space-y-3">
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">City</label><input defaultValue="Nottingham" id="seo-city" className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 focus:outline-none"/></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Cuisines (comma separated)</label><input defaultValue="Italian, Indian, Chinese, Thai, Mexican, Japanese, Turkish, American" id="seo-cuisines" className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 focus:outline-none"/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={()=>setShowGenerate(false)} className="px-4 py-2 rounded-lg text-xs text-gray-400 bg-gray-800">Cancel</button><button onClick={()=>generatePages({city:document.getElementById('seo-city').value,cuisines:document.getElementById('seo-cuisines').value})} className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-cyan-600">Generate</button></div>
      </div></div>}
    </div>
  )
}
