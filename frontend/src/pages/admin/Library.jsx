/**
 * Library / Knowledge Base — /admin/library
 * Stores all project research, chat transcripts, decisions, code summaries.
 * Upload JSON/MD exports, browse, search, tag, manage.
 */
import adminFetch from '../../utils/adminFetch'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BookOpen, Search, Upload, Plus, Filter, X, Tag, Clock,
  FileText, Trash2, Edit3, ChevronDown, ChevronRight, Eye,
  Download, RefreshCw, Zap, MessageSquare, GitBranch,
  Code, Palette, Target, Shield, BarChart3, Archive,
  CheckCircle2, AlertTriangle, ExternalLink, Copy
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

const CATEGORY_META = {
  'research':        { icon: Search,        color: '#3B82F6', label: 'Research' },
  'design':          { icon: Palette,       color: '#EC4899', label: 'Design' },
  'decision':        { icon: CheckCircle2,  color: '#10B981', label: 'Decision' },
  'code-summary':    { icon: Code,          color: '#8B5CF6', label: 'Code Summary' },
  'competitor':      { icon: Target,        color: '#F97316', label: 'Competitor' },
  'meeting-note':    { icon: MessageSquare, color: '#6366F1', label: 'Meeting Note' },
  'specification':   { icon: FileText,      color: '#14B8A6', label: 'Specification' },
  'iteration':       { icon: GitBranch,     color: '#F59E0B', label: 'Iteration' },
  'chat-transcript': { icon: MessageSquare, color: '#6B7280', label: 'Chat Transcript' },
  'strategy':        { icon: Zap,           color: '#C9A84C', label: 'Strategy' },
  'bug-fix':         { icon: AlertTriangle, color: '#EF4444', label: 'Bug Fix' },
  'feature-request': { icon: Plus,          color: '#22D3EE', label: 'Feature Request' },
  'architecture':    { icon: GitBranch,     color: '#A855F7', label: 'Architecture' },
  'brand':           { icon: Palette,       color: '#E11D48', label: 'Brand' },
}

const STATUS_COLORS = {
  current: '#10B981',
  superseded: '#F59E0B',
  archived: '#6B7280',
}

/* ─── Small Components ─── */
const Badge = ({ text, color }) => (
  <span
    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
    style={{ color, backgroundColor: `${color}18` }}
  >
    {text}
  </span>
)

const TagPill = ({ tag, onRemove, onClick }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-800 text-gray-300 cursor-pointer hover:bg-gray-700 transition-colors"
    onClick={onClick}
  >
    {tag}
    {onRemove && (
      <X size={10} className="hover:text-red-400" onClick={e => { e.stopPropagation(); onRemove(tag) }} />
    )}
  </span>
)

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
      <Icon size={14} style={{ color }} />
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
  </div>
)

/* ═══════════════════════════════════════════════════════════ */
export default function Library() {
  const [view, setView] = useState('browse') // browse | detail | create | upload
  const [documents, setDocuments] = useState([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  const [tags, setTags] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [activeStatus, setActiveStatus] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const fileRef = useRef(null)

  // New document form
  const [form, setForm] = useState({
    title: '', category: 'research', tags: [], content: '', status: 'current', source: 'manual'
  })
  const [tagInput, setTagInput] = useState('')

  /* ─── Fetch ─── */
  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)
      if (activeCategory) params.set('category', activeCategory)
      if (activeTag) params.set('tag', activeTag)
      if (activeStatus) params.set('status', activeStatus)
      params.set('sort', sortBy)
      params.set('limit', '100')

      const r = await adminFetch(`${API}/admin/library/documents?${params}`)
      const data = await r.json()
      setDocuments(data.documents || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error('Failed to fetch library:', e)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, activeCategory, activeTag, activeStatus, sortBy])

  const fetchStats = async () => {
    try {
      const [statsRes, tagsRes, catsRes] = await Promise.all([
        adminFetch(`${API}/admin/library/stats`).then(r => r.json()),
        adminFetch(`${API}/admin/library/tags`).then(r => r.json()),
        adminFetch(`${API}/admin/library/categories`).then(r => r.json()),
      ])
      setStats(statsRes)
      setTags(tagsRes.tags || [])
      setCategories(catsRes.categories || [])
    } catch (e) {
      console.error('Failed to fetch stats:', e)
    }
  }

  useEffect(() => { fetchDocs() }, [fetchDocs])
  useEffect(() => { fetchStats() }, [])

  /* ─── Create Document ─── */
  const handleCreate = async () => {
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const r = await adminFetch(`${API}/admin/library/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (r.ok) {
        setView('browse')
        setForm({ title: '', category: 'research', tags: [], content: '', status: 'current', source: 'manual' })
        fetchDocs()
        fetchStats()
      }
    } catch (e) {
      console.error('Create failed:', e)
    } finally {
      setCreating(false)
    }
  }

  /* ─── Delete Document ─── */
  const handleDelete = async (id) => {
    if (!confirm('Delete this document?')) return
    try {
      await adminFetch(`${API}/admin/library/documents/${id}`, { method: 'DELETE' })
      if (selectedDoc?.id === id) { setSelectedDoc(null); setView('browse') }
      fetchDocs()
      fetchStats()
    } catch (e) {
      console.error('Delete failed:', e)
    }
  }

  /* ─── File Upload ─── */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const r = await adminFetch(`${API}/admin/library/import/file`, {
        method: 'POST',
        body: formData,
      })
      const data = await r.json()
      if (r.ok) {
        setUploadResult({ success: true, count: data.imported, docs: data.documents })
        fetchDocs()
        fetchStats()
      } else {
        setUploadResult({ success: false, error: data.detail || 'Upload failed' })
      }
    } catch (e) {
      setUploadResult({ success: false, error: e.message })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /* ─── Add tag to form ─── */
  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !form.tags.includes(t)) {
      setForm({ ...form, tags: [...form.tags, t] })
    }
    setTagInput('')
  }

  /* ═══════════════ RENDER ═══════════════ */
  const catMeta = (cat) => CATEGORY_META[cat] || { icon: FileText, color: '#6B7280', label: cat }

  return (
    <div className="p-6 max-w-[1400px] mx-auto" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
            <BookOpen size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Knowledge Library</h1>
            <p className="text-xs text-gray-500">{total} documents stored · Search everything</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('upload')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 text-xs font-semibold hover:bg-gray-700 transition-colors"
          >
            <Upload size={13} /> Import
          </button>
          <button
            onClick={() => setView('create')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors"
          >
            <Plus size={13} /> New Document
          </button>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Docs" value={stats.total} icon={BookOpen} color="#C9A84C" />
          <StatCard label="Categories" value={stats.by_category?.length || 0} icon={Filter} color="#3B82F6" />
          <StatCard label="Tags Used" value={tags.length} icon={Tag} color="#10B981" />
          <StatCard label="Sources" value={stats.by_source?.length || 0} icon={Download} color="#8B5CF6" />
        </div>
      )}

      {/* ═══════ UPLOAD VIEW ═══════ */}
      {view === 'upload' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Import Chats & Documents</h2>
            <button onClick={() => { setView('browse'); setUploadResult(null) }} className="text-gray-500 hover:text-gray-300">
              <X size={16} />
            </button>
          </div>

          {/* Drag & Drop Zone */}
          <div
            className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center hover:border-amber-500/50 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-400 mb-1">Drop JSON, Markdown, or Text files here</p>
            <p className="text-[10px] text-gray-600">Export from AI Chat Exporter → Upload here → Auto-tagged and searchable</p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.md,.txt,.text"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {uploading && (
            <div className="mt-4 flex items-center gap-2 text-amber-400 text-xs">
              <RefreshCw size={12} className="animate-spin" /> Importing and auto-tagging...
            </div>
          )}

          {uploadResult && (
            <div className={`mt-4 p-3 rounded-lg border text-xs ${
              uploadResult.success
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {uploadResult.success ? (
                <div>
                  <p className="font-bold mb-1">✓ Imported {uploadResult.count} document{uploadResult.count > 1 ? 's' : ''}</p>
                  {uploadResult.docs?.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 mt-1">
                      <span className="text-emerald-500">→</span>
                      <span className="font-semibold">{d.title}</span>
                      <span className="text-gray-500">({d.category})</span>
                      {d.tags?.map(t => <TagPill key={t} tag={t} />)}
                    </div>
                  ))}
                </div>
              ) : (
                <p>✗ {uploadResult.error}</p>
              )}
            </div>
          )}

          {/* API Endpoint Info */}
          <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Chrome Extension Auto-Populate API</p>
            <div className="flex items-center gap-2 bg-gray-950 rounded-lg px-3 py-2">
              <code className="text-[11px] text-amber-400 flex-1 font-mono">POST {window.location.origin}/api/admin/library/auto-populate</code>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/admin/library/auto-populate`)}
                className="text-gray-500 hover:text-gray-300"
              >
                <Copy size={12} />
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">When the exporter is ready, point it at this endpoint. Chats auto-import with tags.</p>
          </div>
        </div>
      )}

      {/* ═══════ CREATE VIEW ═══════ */}
      {view === 'create' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">New Document</h2>
            <button onClick={() => setView('browse')} className="text-gray-500 hover:text-gray-300">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Title</label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Uber Direct integration decision"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40 appearance-none"
                >
                  {Object.entries(CATEGORY_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40 appearance-none"
                >
                  <option value="current">Current</option>
                  <option value="superseded">Superseded</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Source</label>
                <select
                  value={form.source}
                  onChange={e => setForm({ ...form, source: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40 appearance-none"
                >
                  <option value="manual">Manual</option>
                  <option value="chat-session">Chat Session</option>
                  <option value="design-file">Design File</option>
                  <option value="auto-generated">Auto Generated</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Tags</label>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {form.tags.map(t => (
                  <TagPill key={t} tag={t} onRemove={tag => setForm({ ...form, tags: form.tags.filter(x => x !== tag) })} />
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add tag..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                />
                <button onClick={addTag} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white">
                  <Plus size={12} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Content</label>
              <textarea
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                placeholder="Document content, notes, decisions..."
                rows={12}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40 font-mono text-xs leading-relaxed"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={creating || !form.title.trim()}
              className="px-4 py-2.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {creating ? 'Saving...' : 'Save Document'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════ DETAIL VIEW ═══════ */}
      {view === 'detail' && selectedDoc && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <button onClick={() => { setView('browse'); setSelectedDoc(null) }} className="text-gray-500 hover:text-gray-300">
                ← Back
              </button>
              <Badge text={catMeta(selectedDoc.category).label} color={catMeta(selectedDoc.category).color} />
              <Badge text={selectedDoc.status} color={STATUS_COLORS[selectedDoc.status] || '#6B7280'} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleDelete(selectedDoc.id)} className="p-2 text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="p-6">
            <h2 className="text-lg font-bold text-white mb-2">{selectedDoc.title}</h2>
            <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-4">
              <span className="flex items-center gap-1"><Clock size={10} /> {new Date(selectedDoc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span>Source: {selectedDoc.source}</span>
              {selectedDoc.metadata?.message_count && <span>{selectedDoc.metadata.message_count} messages</span>}
            </div>
            <div className="flex flex-wrap gap-1 mb-4">
              {selectedDoc.tags?.map(t => <TagPill key={t} tag={t} onClick={() => { setActiveTag(t); setView('browse') }} />)}
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{selectedDoc.content}</pre>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ BROWSE VIEW ═══════ */}
      {view === 'browse' && (
        <>
          {/* Search + Filters */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search everything..."
                className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  <X size={12} />
                </button>
              )}
            </div>
            <select
              value={activeCategory}
              onChange={e => setActiveCategory(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-xs text-gray-400 focus:outline-none appearance-none"
            >
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              value={activeStatus}
              onChange={e => setActiveStatus(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-xs text-gray-400 focus:outline-none appearance-none"
            >
              <option value="">All Statuses</option>
              <option value="current">Current</option>
              <option value="superseded">Superseded</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-xs text-gray-400 focus:outline-none appearance-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="updated">Recently Updated</option>
              <option value="alpha">Alphabetical</option>
            </select>
          </div>

          {/* Active Tag Filter */}
          {activeTag && (
            <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
              <Tag size={11} /> Filtering by tag:
              <TagPill tag={activeTag} onRemove={() => setActiveTag('')} />
            </div>
          )}

          {/* Tag Cloud */}
          {tags.length > 0 && !activeTag && (
            <div className="flex flex-wrap gap-1 mb-4">
              {tags.slice(0, 25).map(t => (
                <button
                  key={t.name}
                  onClick={() => setActiveTag(t.name)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-900 border border-gray-800 text-gray-500 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
                >
                  {t.name} <span className="text-gray-700">{t.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Documents List */}
          {loading ? (
            <div className="text-center py-12 text-gray-600 text-sm">Loading library...</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen size={40} className="text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-semibold mb-1">Library is empty</p>
              <p className="text-xs text-gray-600 mb-4">Import your first chat transcript or create a document</p>
              <button
                onClick={() => setView('upload')}
                className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors"
              >
                <Upload size={12} className="inline mr-1" /> Import First Document
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => {
                const cm = catMeta(doc.category)
                const CatIcon = cm.icon
                return (
                  <div
                    key={doc.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors cursor-pointer group"
                    onClick={() => { setSelectedDoc(doc); setView('detail') }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${cm.color}18` }}
                      >
                        <CatIcon size={14} style={{ color: cm.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors">{doc.title}</h3>
                          <Badge text={cm.label} color={cm.color} />
                          <Badge text={doc.status} color={STATUS_COLORS[doc.status] || '#6B7280'} />
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                          {doc.content?.substring(0, 200)}...
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-600 flex items-center gap-1">
                            <Clock size={9} /> {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                          <span className="text-[10px] text-gray-600">{doc.source}</span>
                          {doc.metadata?.message_count && (
                            <span className="text-[10px] text-gray-600">{doc.metadata.message_count} msgs</span>
                          )}
                          <div className="flex gap-1 ml-auto">
                            {doc.tags?.slice(0, 4).map(t => <TagPill key={t} tag={t} onClick={e => { e.stopPropagation(); setActiveTag(t) }} />)}
                            {doc.tags?.length > 4 && <span className="text-[10px] text-gray-600">+{doc.tags.length - 4}</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(doc.id) }}
                        className="p-1.5 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
