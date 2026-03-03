import adminFetch from '../../utils/adminFetch'
import { useState, useEffect, useCallback } from 'react'
import { Mail, RefreshCw, Plus, Send, Users, BarChart3, Clock, CheckCircle2, X, TrendingUp } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

export default function AdminEmailMarketing() {
  const [campaigns, setCampaigns] = useState([])
  const [subscribers, setSubscribers] = useState({ total:0, active:0, unsubscribed:0 })
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await adminFetch(`${API}/admin/email-marketing/overview`)
      if (r.ok) { const d = await r.json(); setCampaigns(d.campaigns||[]); setSubscribers(d.subscribers||{total:0,active:0,unsubscribed:0}) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createCampaign = async (data) => {
    try { await adminFetch(`${API}/admin/email-marketing/campaigns`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }); setShowCreate(false); load() } catch(e) { console.error(e) }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center"><Mail size={18} className="text-purple-400"/></div>
            <div><h1 className="text-lg font-bold text-white">Email Marketing</h1><p className="text-[11px] text-gray-500">{subscribers.total} subscribers · {subscribers.active} active · {campaigns.length} campaigns</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 text-xs font-semibold hover:bg-purple-500/25"><Plus size={13}/>New Campaign</button>
            <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><RefreshCw size={14}/></button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            {label:'Total Subscribers',value:subscribers.total,icon:Users,color:'purple'},
            {label:'Active',value:subscribers.active,icon:CheckCircle2,color:'emerald'},
            {label:'Avg Open Rate',value:campaigns.length?`${Math.round(campaigns.reduce((s,c)=>s+(c.open_rate||0),0)/campaigns.length*100)}%`:'—',icon:BarChart3,color:'blue'},
            {label:'Campaigns Sent',value:campaigns.filter(c=>c.status==='sent').length,icon:Send,color:'amber'},
          ].map((s,i)=>(
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2"><s.icon size={14} className={`text-${s.color}-400`}/><span className="text-[10px] text-gray-500 uppercase font-semibold">{s.label}</span></div>
              <p className="text-xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {campaigns.length===0&&<div className="text-center py-12"><div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-3"><Mail size={20} className="text-purple-400"/></div><p className="text-sm text-gray-400 font-medium mb-1">No campaigns yet</p><p className="text-xs text-gray-600">Create your first email campaign to engage restaurant owners and diners.</p></div>}
        {campaigns.map(c=>(
          <div key={c._id} className="p-4 rounded-xl border border-gray-800 bg-gray-900/60">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-white">{c.name}</h3>
              <span className={`text-[9px] px-2 py-0.5 rounded font-bold capitalize ${c.status==='sent'?'text-emerald-400 bg-emerald-500/15':c.status==='draft'?'text-gray-400 bg-gray-800':'text-amber-400 bg-amber-500/15'}`}>{c.status}</span>
            </div>
            <p className="text-[10px] text-gray-500 mb-3">{c.subject||'No subject'} · {c.recipients||0} recipients</p>
            <div className="grid grid-cols-4 gap-3">
              {[{l:'Sent',v:c.sent||0},{l:'Opened',v:c.opened||0},{l:'Clicked',v:c.clicked||0},{l:'Open Rate',v:c.sent?`${Math.round(c.opened/c.sent*100)}%`:'—'}].map((m,i)=>(
                <div key={i} className="text-center"><p className="text-sm font-bold text-white">{m.v}</p><p className="text-[9px] text-gray-500">{m.l}</p></div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {showCreate&&<CreateCampaignModal onClose={()=>setShowCreate(false)} onCreate={createCampaign}/>}
    </div>
  )
}

function CreateCampaignModal({onClose,onCreate}){
  const [f,setF]=useState({name:'',subject:'',type:'newsletter',audience:'all'})
  return(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}><div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-5" onClick={e=>e.stopPropagation()}>
      <div className="flex justify-between mb-4"><h2 className="text-sm font-bold text-white">New Campaign</h2><button onClick={onClose} className="text-gray-500"><X size={16}/></button></div>
      <div className="space-y-3">
        {[['Campaign Name','name'],['Subject Line','subject']].map(([l,k])=><div key={k}><label className="text-[10px] text-gray-500 uppercase font-semibold">{l}</label><input value={f[k]} onChange={e=>setF(p=>({...p,[k]:e.target.value}))} className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 focus:outline-none"/></div>)}
        <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Type</label><select value={f.type} onChange={e=>setF(p=>({...p,type:e.target.value}))} className="admin-select w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200"><option value="newsletter">Newsletter</option><option value="promo">Promotion</option><option value="winback">Win-back</option><option value="onboarding">Onboarding</option></select></div>
        <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Audience</label><select value={f.audience} onChange={e=>setF(p=>({...p,audience:e.target.value}))} className="admin-select w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200"><option value="all">All Subscribers</option><option value="owners">Restaurant Owners</option><option value="diners">Diners</option></select></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 rounded-lg text-xs text-gray-400 bg-gray-800">Cancel</button><button onClick={()=>onCreate(f)} className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-purple-600">Create Campaign</button></div>
    </div></div>
  )
}
