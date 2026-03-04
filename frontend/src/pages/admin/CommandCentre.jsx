/**
 * Command Centre — /admin/command-centre
 * Lives inside existing AdminLayout. Dark theme. Full CRUD via API.
 */
import adminFetch from '../../utils/adminFetch'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Crosshair, Plus, Search, Filter, ChevronDown, ChevronRight, ChevronUp,
  X, Check, Circle, CheckCircle2, Clock, MessageSquare, History,
  ArrowRight, GripVertical, BarChart3, List, LayoutGrid, GitBranch,
  AlertTriangle, Zap, TrendingUp, Target, Shield, Edit3, Trash2,
  Send, ExternalLink, RefreshCw, ChevronLeft
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

/* ─── Constants ─── */
const STAGES = [
  { id: 'backlog', label: 'Backlog', icon: '—', color: '#6B7280' },
  { id: 'in_dev', label: 'In Dev', icon: '›', color: '#C9A84C' },
  { id: 'testing', label: 'Testing', icon: '~', color: '#F59E0B' },
  { id: 'staging', label: 'Staging', icon: '◇', color: '#3B82F6' },
  { id: 'live', label: 'Live', icon: '•', color: '#10B981' },
]

const PRIS = {
  P0: { label: 'Launch Blocker', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  P1: { label: 'Quick Win', color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  P2: { label: 'Growth', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  P3: { label: 'Comp. Moat', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
}

const CATS = {
  'E-Commerce': { icon: '○', c: '#10B981' },
  CRM: { icon: '○', c: '#6366F1' },
  Reviews: { icon: '○', c: '#F59E0B' },
  SEO: { icon: '○', c: '#3B82F6' },
  EPOS: { icon: '○', c: '#EC4899' },
  Payments: { icon: '○', c: '#14B8A6' },
  Platform: { icon: '○', c: '#8B5CF6' },
}

const EFF_C = { Low: '#10B981', Medium: '#F59E0B', High: '#EF4444' }
const REV_C = { 'Very High': '#C9A84C', High: '#10B981', Medium: '#3B82F6', Low: '#6B7280' }

/* ─── API Helpers ─── */
const api = {
  get: async (path) => {
    const r = await adminFetch(`${API}${path}`)
    if (!r.ok) throw new Error(`GET ${path} failed`)
    return r.json()
  },
  post: async (path, body) => {
    const r = await adminFetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) throw new Error(`POST ${path} failed`)
    return r.json()
  },
  put: async (path, body) => {
    const r = await adminFetch(`${API}${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) throw new Error(`PUT ${path} failed`)
    return r.json()
  },
  del: async (path) => {
    const r = await adminFetch(`${API}${path}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(`DELETE ${path} failed`)
    return r.json()
  },
}

/* ─── Small Components ─── */
const Badge = ({ text, color, bg }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide" style={{ color, backgroundColor: bg || `${color}18` }}>
    {text}
  </span>
)

const StagePill = ({ stage }) => {
  const s = STAGES.find(x => x.id === stage)
  if (!s) return null
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: s.color, backgroundColor: `${s.color}18` }}>
      <span>{s.icon}</span> {s.label}
    </span>
  )
}

const Progress = ({ checks }) => {
  if (!checks?.length) return null
  const done = checks.filter(c => c.d).length
  const pct = Math.round((done / checks.length) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#10B981' : pct > 50 ? '#C9A84C' : '#6B7280' }} />
      </div>
      <span className="text-[10px] text-gray-500 font-mono">{done}/{checks.length}</span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════ */
export default function CommandCentre() {
  const [features, setFeatures] = useState([])
  const [stats, setStats] = useState({ stage_counts: {}, pri_counts: {}, cat_counts: {}, progress: {} })
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban') // kanban | tree | list
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filters, setFilters] = useState({ pri: '', cat: '', search: '' })
  const [seeding, setSeeding] = useState(false)

  /* ─── Fetch ─── */
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filters.pri) params.set('pri', filters.pri)
      if (filters.cat) params.set('cat', filters.cat)
      if (filters.search) params.set('search', filters.search)
      const data = await api.get(`/admin/command-centre/features?${params}`)
      setFeatures(data.features || [])
      setStats({
        stage_counts: data.stage_counts || {},
        pri_counts: data.pri_counts || {},
        cat_counts: data.cat_counts || {},
        progress: data.progress || {},
        total: data.total || 0,
      })
    } catch (e) {
      console.error('Failed to load features:', e)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { load() }, [load])

  /* ─── Seed ─── */
  const handleSeed = async () => {
    setSeeding(true)
    try {
      await api.post('/admin/command-centre/seed', {})
      await load()
    } catch (e) {
      console.error('Seed failed:', e)
    }
    setSeeding(false)
  }

  /* ─── Move stage ─── */
  const moveStage = async (featureId, newStage) => {
    try {
      await api.post(`/admin/command-centre/features/${featureId}/move`, { stage: newStage })
      await load()
      if (selected?._id === featureId) {
        const updated = await api.get(`/admin/command-centre/features/${featureId}`)
        setSelected(updated)
      }
    } catch (e) { console.error(e) }
  }

  /* ─── Toggle check ─── */
  const toggleCheck = async (featureId, index, done) => {
    try {
      const updated = await api.post(`/admin/command-centre/features/${featureId}/check`, { index, done })
      setFeatures(prev => prev.map(f => f._id === featureId ? updated : f))
      if (selected?._id === featureId) setSelected(updated)
    } catch (e) { console.error(e) }
  }

  /* ─── Add note ─── */
  const addNote = async (featureId, text) => {
    try {
      const updated = await api.post(`/admin/command-centre/features/${featureId}/notes`, { text, author: 'Founder' })
      setFeatures(prev => prev.map(f => f._id === featureId ? updated : f))
      if (selected?._id === featureId) setSelected(updated)
    } catch (e) { console.error(e) }
  }

  /* ─── Add check item ─── */
  const addCheckItem = async (featureId, text) => {
    try {
      const updated = await api.post(`/admin/command-centre/features/${featureId}/check/add`, { t: text, d: false })
      setFeatures(prev => prev.map(f => f._id === featureId ? updated : f))
      if (selected?._id === featureId) setSelected(updated)
    } catch (e) { console.error(e) }
  }

  /* ─── Delete feature ─── */
  const deleteFeature = async (featureId) => {
    if (!confirm('Delete this feature?')) return
    try {
      await api.del(`/admin/command-centre/features/${featureId}`)
      setSelected(null)
      await load()
    } catch (e) { console.error(e) }
  }

  /* ─── Update feature ─── */
  const updateFeature = async (featureId, updates) => {
    try {
      const updated = await api.put(`/admin/command-centre/features/${featureId}`, updates)
      setFeatures(prev => prev.map(f => f._id === featureId ? updated : f))
      if (selected?._id === featureId) setSelected(updated)
    } catch (e) { console.error(e) }
  }

  /* ─── Create feature ─── */
  const createFeature = async (data) => {
    try {
      await api.post('/admin/command-centre/features', data)
      setShowAdd(false)
      await load()
    } catch (e) { console.error(e) }
  }

  /* ─── Filtered + grouped ─── */
  const grouped = useMemo(() => {
    const g = {}
    STAGES.forEach(s => { g[s.id] = [] })
    features.forEach(f => {
      if (g[f.stage]) g[f.stage].push(f)
    })
    return g
  }, [features])

  const treeData = useMemo(() => {
    const tree = {}
    features.forEach(f => {
      const cat = f.cat || 'Other'
      if (!tree[cat]) tree[cat] = []
      tree[cat].push(f)
    })
    return tree
  }, [features])

  /* ═══ RENDER ═══ */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="w-6 h-6 text-gray-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading Command Centre...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ─── Header ─── */}
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(201,168,76,0.15)' }}>
              <Target size={18} style={{ color: '#C9A84C' }} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Command Centre</h1>
              <p className="text-[11px] text-gray-500">
                {stats.total || 0} features · {stats.progress?.pct || 0}% complete · {stats.stage_counts?.live || 0} live
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {features.length === 0 && (
              <button onClick={handleSeed} disabled={seeding} className="px-4 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-colors disabled:opacity-50 animate-pulse">
                {seeding ? 'Seeding...' : 'Seed 35 Features'}
              </button>
            )}
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors">
              <Plus size={13} /> Add Feature
            </button>
            <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* ─── Stats Bar ─── */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
          {STAGES.map(s => (
            <button key={s.id} onClick={() => setFilters(f => ({ ...f, stage: f.stage === s.id ? '' : s.id }))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap" style={{ backgroundColor: `${s.color}12`, color: s.color, border: `1px solid ${s.color}25` }}>
              <span>{s.icon}</span>
              <span>{s.label}</span>
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${s.color}20` }}>
                {stats.stage_counts?.[s.id] || 0}
              </span>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800/50 text-gray-400 text-xs">
            <BarChart3 size={12} />
            <span>{stats.progress?.done_checks || 0}/{stats.progress?.total_checks || 0} tasks</span>
          </div>
        </div>

        {/* ─── Filters + View Toggle ─── */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Search features..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600"
            />
          </div>
          <select value={filters.pri} onChange={e => setFilters(f => ({ ...f, pri: e.target.value }))} className="admin-select px-2.5 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50 text-xs text-gray-300 focus:outline-none">
            <option value="">All Priorities</option>
            {Object.entries(PRIS).map(([k, v]) => <option key={k} value={k}>{k} — {v.label}</option>)}
          </select>
          <select value={filters.cat} onChange={e => setFilters(f => ({ ...f, cat: e.target.value }))} className="admin-select px-2.5 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50 text-xs text-gray-300 focus:outline-none">
            <option value="">All Categories</option>
            {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.icon} {k}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-0.5 bg-gray-800/60 rounded-lg p-0.5">
            {[{ id: 'kanban', icon: LayoutGrid, label: 'Board' }, { id: 'tree', icon: GitBranch, label: 'Tree' }, { id: 'list', icon: List, label: 'List' }].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${view === v.id ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                <v.icon size={12} /> {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Content Area ─── */}
      <div className="flex-1 overflow-hidden flex">
        <div className={`flex-1 overflow-auto ${selected ? 'pr-0' : ''}`}>
          {view === 'kanban' && <KanbanView grouped={grouped} onSelect={setSelected} onMove={moveStage} selected={selected} />}
          {view === 'tree' && <TreeView treeData={treeData} onSelect={setSelected} selected={selected} />}
          {view === 'list' && <ListView features={features} onSelect={setSelected} selected={selected} />}
        </div>

        {/* ─── Detail Panel ─── */}
        {selected && (
          <DetailPanel
            feature={selected}
            onClose={() => setSelected(null)}
            onToggleCheck={toggleCheck}
            onAddNote={addNote}
            onAddCheck={addCheckItem}
            onMove={moveStage}
            onUpdate={updateFeature}
            onDelete={deleteFeature}
          />
        )}
      </div>

      {/* ─── Add Feature Modal ─── */}
      {showAdd && <AddFeatureModal onClose={() => setShowAdd(false)} onCreate={createFeature} />}
    </div>
  )
}


/* ══════════════════════════════════════════════════════
   KANBAN VIEW
   ══════════════════════════════════════════════════════ */
function KanbanView({ grouped, onSelect, onMove, selected }) {
  return (
    <div className="flex gap-3 p-4 h-full overflow-x-auto">
      {STAGES.map(stage => (
        <div key={stage.id} className="flex flex-col w-64 min-w-[256px] shrink-0">
          {/* Column Header */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg mb-1" style={{ backgroundColor: `${stage.color}08` }}>
            <span className="text-sm">{stage.icon}</span>
            <span className="text-xs font-semibold" style={{ color: stage.color }}>{stage.label}</span>
            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${stage.color}15`, color: stage.color }}>
              {grouped[stage.id]?.length || 0}
            </span>
          </div>
          {/* Cards */}
          <div className="flex-1 overflow-y-auto space-y-2 pb-4 pr-1">
            {(grouped[stage.id] || []).map(f => (
              <FeatureCard key={f._id} feature={f} onClick={() => onSelect(f)} onMove={onMove} isSelected={selected?._id === f._id} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FeatureCard({ feature: f, onClick, onMove, isSelected }) {
  const pri = PRIS[f.pri]
  const cat = CATS[f.cat]
  const stageIdx = STAGES.findIndex(s => s.id === f.stage)

  return (
    <div onClick={onClick} className={`group p-3 rounded-lg border cursor-pointer transition-all hover:border-gray-600 ${isSelected ? 'border-amber-500/50 bg-gray-800/80 ring-1 ring-amber-500/20' : 'border-gray-800 bg-gray-900/60'}`}>
      {/* Top row: priority + category */}
      <div className="flex items-center justify-between mb-2">
        <Badge text={f.pri} color={pri?.color} bg={pri?.bg} />
        <span className="text-xs" title={f.cat}>{cat?.icon}</span>
      </div>
      {/* Name */}
      <h3 className="text-xs font-semibold text-gray-200 leading-snug mb-1.5 line-clamp-2">{f.name}</h3>
      {/* Progress */}
      <Progress checks={f.checks} />
      {/* Bottom row: effort + nav arrows */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ color: EFF_C[f.effort], backgroundColor: `${EFF_C[f.effort]}15` }}>
            {f.effort}
          </span>
          {f.notes?.length > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-gray-600">
              <MessageSquare size={9} /> {f.notes.length}
            </span>
          )}
        </div>
        {/* Stage arrows */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {stageIdx > 0 && (
            <button onClick={() => onMove(f._id, STAGES[stageIdx - 1].id)} className="p-0.5 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-700" title={`← ${STAGES[stageIdx - 1].label}`}>
              <ChevronLeft size={11} />
            </button>
          )}
          {stageIdx < STAGES.length - 1 && (
            <button onClick={() => onMove(f._id, STAGES[stageIdx + 1].id)} className="p-0.5 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-700" title={`→ ${STAGES[stageIdx + 1].label}`}>
              <ChevronRight size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


/* ══════════════════════════════════════════════════════
   TREE VIEW
   ══════════════════════════════════════════════════════ */
function TreeView({ treeData, onSelect, selected }) {
  const [expanded, setExpanded] = useState(() => Object.keys(treeData))
  const toggle = (cat) => setExpanded(e => e.includes(cat) ? e.filter(x => x !== cat) : [...e, cat])

  return (
    <div className="p-4 space-y-1">
      {Object.entries(treeData).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => {
        const catMeta = CATS[cat] || { icon: '○', c: '#6B7280' }
        const isOpen = expanded.includes(cat)
        const doneCount = items.reduce((sum, f) => sum + (f.checks?.filter(c => c.d).length || 0), 0)
        const totalCount = items.reduce((sum, f) => sum + (f.checks?.length || 0), 0)
        return (
          <div key={cat}>
            <button onClick={() => toggle(cat)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors group">
              {isOpen ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
              <span className="text-sm">{catMeta.icon}</span>
              <span className="text-xs font-semibold text-gray-300">{cat}</span>
              <span className="text-[10px] text-gray-600 ml-1">({items.length})</span>
              <span className="ml-auto text-[10px] text-gray-600 font-mono">{doneCount}/{totalCount}</span>
            </button>
            {isOpen && (
              <div className="ml-5 pl-3 border-l border-gray-800 space-y-0.5">
                {items.map(f => {
                  const pri = PRIS[f.pri]
                  return (
                    <button key={f._id} onClick={() => onSelect(f)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${selected?._id === f._id ? 'bg-gray-800 border border-amber-500/30' : 'hover:bg-gray-800/40'}`}>
                      <StagePill stage={f.stage} />
                      <span className="text-xs text-gray-300 flex-1 truncate">{f.name}</span>
                      <Badge text={f.pri} color={pri?.color} bg={pri?.bg} />
                      <Progress checks={f.checks} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


/* ══════════════════════════════════════════════════════
   LIST VIEW
   ══════════════════════════════════════════════════════ */
function ListView({ features, onSelect, selected }) {
  const [sort, setSort] = useState({ field: 'pri', dir: 'asc' })
  const sorted = useMemo(() => {
    const priOrder = { P0: 0, P1: 1, P2: 2, P3: 3 }
    return [...features].sort((a, b) => {
      if (sort.field === 'pri') return (priOrder[a.pri] || 99) - (priOrder[b.pri] || 99)
      if (sort.field === 'name') return a.name.localeCompare(b.name)
      if (sort.field === 'stage') return STAGES.findIndex(s => s.id === a.stage) - STAGES.findIndex(s => s.id === b.stage)
      return 0
    })
  }, [features, sort])

  return (
    <div className="p-4">
      <table className="w-full">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-gray-600 border-b border-gray-800">
            {[{ f: 'pri', l: 'Priority' }, { f: 'name', l: 'Feature' }, { f: 'cat', l: 'Category' }, { f: 'stage', l: 'Stage' }, { f: 'effort', l: 'Effort' }, { f: 'progress', l: 'Progress' }].map(col => (
              <th key={col.f} className="text-left py-2 px-2 font-semibold cursor-pointer hover:text-gray-400" onClick={() => setSort({ field: col.f, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}>
                {col.l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(f => {
            const pri = PRIS[f.pri]
            const cat = CATS[f.cat]
            return (
              <tr key={f._id} onClick={() => onSelect(f)} className={`cursor-pointer border-b border-gray-800/50 transition-colors ${selected?._id === f._id ? 'bg-gray-800/60' : 'hover:bg-gray-800/30'}`}>
                <td className="py-2 px-2"><Badge text={f.pri} color={pri?.color} bg={pri?.bg} /></td>
                <td className="py-2 px-2 text-xs text-gray-300 font-medium max-w-xs truncate">{f.name}</td>
                <td className="py-2 px-2 text-xs"><span>{cat?.icon} {f.cat}</span></td>
                <td className="py-2 px-2"><StagePill stage={f.stage} /></td>
                <td className="py-2 px-2"><span className="text-[10px] font-medium" style={{ color: EFF_C[f.effort] }}>{f.effort}</span></td>
                <td className="py-2 px-2 w-32"><Progress checks={f.checks} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}


/* ══════════════════════════════════════════════════════
   DETAIL PANEL (right sidebar)
   ══════════════════════════════════════════════════════ */
function DetailPanel({ feature: f, onClose, onToggleCheck, onAddNote, onAddCheck, onMove, onUpdate, onDelete }) {
  const [noteText, setNoteText] = useState('')
  const [newCheck, setNewCheck] = useState('')
  const [activeTab, setActiveTab] = useState('checks')
  const notesEndRef = useRef(null)

  const stageIdx = STAGES.findIndex(s => s.id === f.stage)
  const pri = PRIS[f.pri]
  const cat = CATS[f.cat]

  const handleAddNote = () => {
    if (!noteText.trim()) return
    onAddNote(f._id, noteText.trim())
    setNoteText('')
  }

  const handleAddCheck = () => {
    if (!newCheck.trim()) return
    onAddCheck(f._id, newCheck.trim())
    setNewCheck('')
  }

  return (
    <div className="w-96 shrink-0 border-l border-gray-800 bg-gray-900/50 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge text={f.pri} color={pri?.color} bg={pri?.bg} />
            <span className="text-xs text-gray-500">{cat?.icon} {f.cat}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onDelete(f._id)} className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors" title="Delete">
              <Trash2 size={13} />
            </button>
            <button onClick={onClose} className="p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
        <h2 className="text-sm font-bold text-white mb-1">{f.name}</h2>
        <p className="text-[11px] text-gray-400 leading-relaxed">{f.desc}</p>

        {/* Stage + Move */}
        <div className="mt-3 flex items-center gap-2">
          <StagePill stage={f.stage} />
          <div className="flex gap-1 ml-auto">
            {stageIdx > 0 && (
              <button onClick={() => onMove(f._id, STAGES[stageIdx - 1].id)} className="px-2 py-0.5 rounded text-[10px] font-medium text-gray-500 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors">
                ← {STAGES[stageIdx - 1].label}
              </button>
            )}
            {stageIdx < STAGES.length - 1 && (
              <button onClick={() => onMove(f._id, STAGES[stageIdx + 1].id)} className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-800 hover:bg-gray-700 transition-colors" style={{ color: STAGES[stageIdx + 1].color }}>
                {STAGES[stageIdx + 1].label} →
              </button>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400">
            Effort: <span style={{ color: EFF_C[f.effort] }}>{f.effort}</span>
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400">
            Revenue: <span style={{ color: REV_C[f.rev] }}>{f.rev}</span>
          </span>
          {f.comp?.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-500">
              {f.comp.length} competitors have this
            </span>
          )}
        </div>
        {f.comp?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {f.comp.map((c, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-500 border border-gray-700/50">{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {[{ id: 'checks', label: 'Checklist', icon: CheckCircle2, count: f.checks?.length }, { id: 'notes', label: 'Notes', icon: MessageSquare, count: f.notes?.length }, { id: 'history', label: 'History', icon: History, count: f.history?.length }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors border-b-2 ${activeTab === tab.id ? 'text-white border-amber-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
            <tab.icon size={12} />
            {tab.label}
            {tab.count > 0 && <span className="text-[9px] px-1 rounded bg-gray-800 ml-0.5">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* ─── Checklist ─── */}
        {activeTab === 'checks' && (
          <div className="space-y-1">
            {f.checks?.map((c, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5 group">
                <button onClick={() => onToggleCheck(f._id, i, !c.d)} className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${c.d ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-gray-600 hover:border-gray-400'}`}>
                  {c.d && <Check size={10} />}
                </button>
                <span className={`text-xs leading-snug ${c.d ? 'text-gray-600 line-through' : 'text-gray-300'}`}>{c.t}</span>
              </div>
            ))}
            {/* Add check */}
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-800/50">
              <input
                value={newCheck}
                onChange={e => setNewCheck(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCheck()}
                placeholder="Add checklist item..."
                className="flex-1 text-xs bg-transparent text-gray-300 placeholder-gray-600 focus:outline-none"
              />
              <button onClick={handleAddCheck} className="p-1 rounded text-gray-600 hover:text-emerald-400 transition-colors">
                <Plus size={13} />
              </button>
            </div>
          </div>
        )}

        {/* ─── Notes ─── */}
        {activeTab === 'notes' && (
          <div>
            <div className="space-y-3 mb-3">
              {(!f.notes || f.notes.length === 0) && (
                <p className="text-xs text-gray-600 text-center py-4">No notes yet. Add context, decisions, or meeting notes.</p>
              )}
              {f.notes?.map((n, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-gray-800/40 border border-gray-800">
                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{n.text}</p>
                  <div className="flex items-center gap-2 mt-2 text-[9px] text-gray-600">
                    <span>{n.author}</span>
                    <span>·</span>
                    <span>{n.at ? new Date(n.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                </div>
              ))}
              <div ref={notesEndRef} />
            </div>
            {/* Add note */}
            <div className="flex gap-2">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote() } }}
                placeholder="Add a note... (Enter to send)"
                rows={2}
                className="flex-1 text-xs bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none"
              />
              <button onClick={handleAddNote} className="self-end p-2 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors">
                <Send size={13} />
              </button>
            </div>
          </div>
        )}

        {/* ─── History ─── */}
        {activeTab === 'history' && (
          <div className="space-y-2">
            {f.history?.slice().reverse().map((h, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-gray-400">
                    {h.action === 'created' && <span>Created in <StagePill stage={h.stage} /></span>}
                    {h.action === 'moved' && <span>Moved from <StagePill stage={h.from} /> → <StagePill stage={h.to} /></span>}
                  </p>
                  <p className="text-[9px] text-gray-600 mt-0.5">
                    {h.by} · {h.at ? new Date(h.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


/* ══════════════════════════════════════════════════════
   ADD FEATURE MODAL
   ══════════════════════════════════════════════════════ */
function AddFeatureModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '', desc: '', cat: 'Platform', pri: 'P2', stage: 'backlog',
    effort: 'Medium', rev: 'Medium', comp: '', checks: '',
  })

  const handleSubmit = () => {
    if (!form.name.trim()) return
    const data = {
      name: form.name.trim(),
      desc: form.desc.trim(),
      cat: form.cat,
      pri: form.pri,
      stage: form.stage,
      effort: form.effort,
      rev: form.rev,
      comp: form.comp ? form.comp.split(',').map(s => s.trim()).filter(Boolean) : [],
      checks: form.checks ? form.checks.split('\n').map(s => s.trim()).filter(Boolean).map(t => ({ t, d: false })) : [],
    }
    onCreate(data)
  }

  const field = (label, key, type = 'text') => (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {type === 'text' && (
        <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 focus:outline-none focus:border-gray-500" />
      )}
      {type === 'textarea' && (
        <textarea value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 focus:outline-none focus:border-gray-500 resize-none" />
      )}
      {type === 'select' && null}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Add Feature</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {field('Feature Name', 'name')}
          {field('Description', 'desc', 'textarea')}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Priority</label>
              <select value={form.pri} onChange={e => setForm(f => ({ ...f, pri: e.target.value }))} className="admin-select w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200">
                {Object.entries(PRIS).map(([k, v]) => <option key={k} value={k}>{k} — {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Category</label>
              <select value={form.cat} onChange={e => setForm(f => ({ ...f, cat: e.target.value }))} className="admin-select w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200">
                {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.icon} {k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Stage</label>
              <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} className="admin-select w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200">
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Effort</label>
              <select value={form.effort} onChange={e => setForm(f => ({ ...f, effort: e.target.value }))} className="admin-select w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Revenue Impact</label>
            <select value={form.rev} onChange={e => setForm(f => ({ ...f, rev: e.target.value }))} className="admin-select w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200">
              <option value="Very High">Very High</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {field('Competitors (comma separated)', 'comp')}

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Checklist Items (one per line)</label>
            <textarea value={form.checks} onChange={e => setForm(f => ({ ...f, checks: e.target.value }))} rows={4} placeholder="Design the UI&#10;Build the API&#10;Write tests&#10;Deploy to staging" className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 focus:outline-none focus:border-gray-500 resize-none placeholder-gray-600" />
          </div>
        </div>
        <div className="p-5 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">Create Feature</button>
        </div>
      </div>
    </div>
  )
}
