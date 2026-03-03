import { useState, useEffect, useCallback } from 'react'
import { FileText, RefreshCw, Plus, Calendar, Eye, Edit3, Trash2, Clock, CheckCircle2, X, Zap } from 'lucide-react'
import adminFetch from '../../utils/adminFetch'

const API = import.meta.env.VITE_API_URL || ''
const STATUS_C = { published:'#10B981', draft:'#6B7280', scheduled:'#3B82F6' }

export default function AdminContent() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await adminFetch(`${API}/admin/content/posts`)
      if (r.ok) { const d = await r.json(); setPosts(d.posts||[]) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createPost = async (data) => {
    try { await adminFetch(`${API}/admin/content/posts`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }); setShowCreate(false); load() } catch(e) { console.error(e) }
  }

  const deletePost = async (id) => {
    if (!confirm('Delete this post?')) return
    try { await adminFetch(`${API}/admin/content/posts/${id}`, { method:'DELETE' }); load() } catch(e) { console.error(e) }
  }

  const stats = { total:posts.length, published:posts.filter(p=>p.status==='published').length, draft:posts.filter(p=>p.status==='draft').length, scheduled:posts.filter(p=>p.status==='scheduled').length }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center"><FileText size={18} className="text-indigo-400"/></div>
            <div><h1 className="text-lg font-bold text-white">Content Engine</h1><p className="text-[11px] text-gray-500">{stats.total} posts · {stats.published} published · {stats.draft} drafts</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 text-xs font-semibold hover:bg-indigo-500/25"><Plus size={13}/>New Post</button>
            <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><RefreshCw size={14}/></button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {posts.length===0&&<div className="text-center py-12"><div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-3"><Zap size={20} className="text-indigo-400"/></div><p className="text-sm text-gray-400 font-medium mb-1">No content yet</p><p className="text-xs text-gray-600">Create blog posts, guides, and marketing content to drive organic traffic.</p></div>}
        {posts.map(p=>(
          <div key={p._id} className="p-4 rounded-xl border border-gray-800 bg-gray-900/60 flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xs font-semibold text-white">{p.title}</h3>
                <span className="text-[9px] px-2 py-0.5 rounded font-bold capitalize" style={{color:STATUS_C[p.status||'draft'],backgroundColor:`${STATUS_C[p.status||'draft']}15`}}>{p.status||'draft'}</span>
              </div>
              <p className="text-[10px] text-gray-500 mb-2">{p.category||'Uncategorised'} · {p.created_at?new Date(p.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):''}</p>
              <p className="text-[11px] text-gray-400 line-clamp-2">{p.excerpt||p.body?.substring(0,150)||'No content'}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-800"><Edit3 size={13}/></button>
              <button onClick={()=>deletePost(p._id)} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-gray-800"><Trash2 size={13}/></button>
            </div>
          </div>
        ))}
      </div>
      {showCreate&&<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={()=>setShowCreate(false)}><div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg p-5 max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between mb-4"><h2 className="text-sm font-bold text-white">New Post</h2><button onClick={()=>setShowCreate(false)} className="text-gray-500"><X size={16}/></button></div>
        <div className="space-y-3">
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Title</label><input id="cp-title" className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 focus:outline-none"/></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Category</label><select id="cp-cat" className="admin-select w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200"><option>Restaurant Tips</option><option>Platform Updates</option><option>Industry Insights</option><option>Case Studies</option></select></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Content</label><textarea id="cp-body" rows={8} className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 focus:outline-none resize-none"/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={()=>setShowCreate(false)} className="px-4 py-2 rounded-lg text-xs text-gray-400 bg-gray-800">Cancel</button><button onClick={()=>createPost({title:document.getElementById('cp-title').value,category:document.getElementById('cp-cat').value,body:document.getElementById('cp-body').value,status:'draft'})} className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600">Create Draft</button></div>
      </div></div>}
    </div>
  )
}
