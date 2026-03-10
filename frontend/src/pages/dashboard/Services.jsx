import AppLoader from "../../components/shared/AppLoader"
/**
 * Services / Menu — styled to match 7-Brand Design - Services/Menu.html
 * Two-pane: categorized service list (left) + editor form (right)
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import { Trash2, Archive } from 'lucide-react'

const COLORS = ['#FFD166', '#06D6A0', '#118AB2', '#EF476F', '#073B4C', '#F77F00']
const DURATIONS = ['15 mins', '30 mins', '45 mins', '1 hour', '1 hr 15 mins', '1 hr 30 mins', '2 hours', '2 hr 30 mins', '3 hours']
const BUFFER_TIMES = ['None', '5 mins', '10 mins', '15 mins', '30 mins']

const Services = () => {
  const { business, businessType, loading: bizLoading } = useBusiness()
  const navigate = useNavigate()
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [editing, setEditing] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteToast, setDeleteToast] = useState(null)

  const bid = business?.id ?? business?._id
  const isFood = businessType === 'food' || businessType === 'restaurant'

  useEffect(() => {
    if (!bid) { setLoading(false); return }
    const fetchServices = async () => {
      try {
        // Try v2 first (where data is stored via calendar/onboarding)
        const res = await api.get(`/services-v2/business/${bid}`)
        const cats = res.categories || []
        const allServices = cats.flatMap(c => (c.services || []).map(s => ({ ...s, category: c.name || c.id })))
        setServices(allServices)
        setCategories(cats.map(c => c.name || c.id))
        if (allServices.length === 0) {
          // Fallback to v1 in case data is there instead
          const v1 = await api.get(`/services/business/${bid}`).catch(() => ({}))
          if ((v1.services || []).length > 0) {
            setServices(v1.services)
            setCategories(v1.categories || [])
          }
        }
      } catch (e) {
        // Fallback to v1
        try {
          const v1 = await api.get(`/services/business/${bid}`)
          setServices(v1.services || [])
          setCategories(v1.categories || [])
        } catch { console.error('Services load failed') }
      }
      finally { setLoading(false) }
    }
    fetchServices()
  }, [bid])

  const displayServices = services
  const displayCategories = categories

  const filtered = displayServices.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    if (activeCategory !== 'all' && s.category !== activeCategory) return false
    return true
  })

  const grouped = displayCategories.reduce((acc, cat) => {
    const items = filtered.filter(s => s.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})
  const ungrouped = filtered.filter(s => !displayCategories.includes(s.category))
  if (ungrouped.length > 0) grouped['Other'] = ungrouped

  const selectService = (s) => {
    setSelected(s)
    setEditing({
      name: s.name || '', category: s.category || '', description: s.description || '',
      price: s.price || 0, duration: s.duration || '30 mins', buffer: 'None',
      color: s.color || COLORS[0], active: s.active !== false,
    })
  }

  const handleSave = async () => {
    if (!bid || !selected) return
    setSaving(true)
    try {
      await api.patch(`/services/business/${bid}/${selected.id}`, editing)
      setServices(prev => prev.map(s => s.id === selected.id ? { ...s, ...editing } : s))
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleArchiveService = async () => {
    if (!bid || !deleteConfirm) return
    const sid = deleteConfirm.id || deleteConfirm._id
    const name = deleteConfirm.name || 'Service'
    setDeleteConfirm(null)
    setDeletingId(sid)
    await new Promise(r => setTimeout(r, 500))
    try {
      await api.patch(`/services/business/${bid}/${sid}`, { active: false, status: 'archived' }).catch(() => null)
      setServices(prev => prev.filter(s => (s.id || s._id) !== sid))
      setSelected(null)
      setDeleteToast({ name, action: 'archived' })
      setTimeout(() => setDeleteToast(null), 4000)
    } catch (e) {
      alert('Failed to archive service.')
    }
    setDeletingId(null)
  }

  const handleDeleteService = async () => {
    if (!bid || !deleteConfirm) return
    const sid = deleteConfirm.id || deleteConfirm._id
    const name = deleteConfirm.name || 'Service'
    setDeleteConfirm(null)
    setDeletingId(sid)
    await new Promise(r => setTimeout(r, 500))
    try {
      await api.delete(`/services-v2/business/${bid}/${sid}`)
      setServices(prev => prev.filter(s => (s.id || s._id) !== sid))
      setSelected(null)
      setDeleteToast({ name, action: 'deleted' })
      setTimeout(() => setDeleteToast(null), 4000)
    } catch {
      try {
        await api.delete(`/services/business/${bid}/${sid}`)
        setServices(prev => prev.filter(s => (s.id || s._id) !== sid))
        setSelected(null)
        setDeleteToast({ name, action: 'deleted' })
        setTimeout(() => setDeleteToast(null), 4000)
      } catch (e2) {
        alert('Failed to delete service.')
      }
    }
    setDeletingId(null)
  }

  if (loading) {
    return <AppLoader message="Loading menu..." />
  }

  return (
    <div data-tour="services" className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* Left Pane: Categories & List */}
        <div className="flex-1 lg:w-1/2 flex flex-col h-full border-r border-border bg-white overflow-hidden">
          <div className="p-4 border-b border-border bg-white shrink-0">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input type="text" placeholder={isFood ? 'Search menu items...' : 'Search services...'} value={search} onChange={e => setSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-gray-50 text-sm text-primary font-medium focus:ring-primary focus:border-primary focus:bg-white transition-colors" />
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              <button onClick={() => setActiveCategory('all')}
                className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap border transition-colors ${activeCategory === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-border hover:border-primary hover:text-primary'}`}>
                All {isFood ? 'Items' : 'Services'}
              </button>
              {displayCategories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap border transition-colors ${activeCategory === cat ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-border hover:border-primary hover:text-primary'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {Object.entries(grouped).length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className={`fa-solid ${isFood ? 'fa-utensils' : 'fa-scissors'} text-gray-400 text-xl`} />
                </div>
                <h3 className="font-heading font-bold text-lg text-primary mb-2">No {isFood ? 'menu items' : 'services'} yet</h3>
                <p className="text-sm text-gray-500">Add your first {isFood ? 'menu item' : 'service'} to get started.</p>
              </div>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <div className="flex items-center justify-between mb-3 px-2 group cursor-pointer hover:bg-gray-50 rounded py-1">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-grip-vertical text-gray-300 text-xs opacity-0 group-hover:opacity-100" />
                      <h3 className="font-heading font-bold text-lg text-primary">{category}</h3>
                      <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-gray-200">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-gray-400 hover:text-primary p-1"><i className="fa-solid fa-pen text-xs" /></button>
                      <button className="text-gray-400 hover:text-red-500 p-1"><i className="fa-solid fa-trash text-xs" /></button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {items.map(s => {
                      const isSel = selected?.id === s.id
                      const isHidden = s.active === false
                      return (
                        <div key={s.id} onClick={() => selectService(s)}
                          style={{
                            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            ...(deletingId === (s.id || s._id) ? {
                              opacity: 0, transform: 'scale(0.85) translateX(-30px)',
                              filter: 'blur(3px)', maxHeight: 0, padding: 0, margin: 0,
                              overflow: 'hidden',
                            } : {}),
                          }}
                          className={`rounded-lg p-3 flex items-center gap-3 cursor-pointer group transition-all relative ${isSel ? 'bg-primary/5 border border-primary shadow-sm' : isHidden ? 'bg-gray-50 border border-border opacity-75 hover:border-primary/50' : 'bg-white border border-border hover:border-primary/50 hover:shadow-md'}`}>
                          <div className="text-gray-300 group-hover:text-primary p-1"><i className="fa-solid fa-grip-vertical" /></div>
                          <div className="w-3 h-10 rounded" style={{ backgroundColor: s.color || COLORS[0] }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <h4 className={`font-bold text-sm truncate ${isHidden ? 'text-gray-500' : 'text-primary'}`}>{s.name}</h4>
                              <span className={`text-sm font-bold ${isHidden ? 'text-gray-500' : 'text-primary'}`}>£{Number(s.price).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-0.5">
                              <span className="text-xs text-gray-500">{s.duration}{s.staff?.length ? ` • Staff: ${s.staff.join(', ')}` : ''}</span>
                              {isHidden ? (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-200 px-1.5 rounded"><i className="fa-solid fa-eye-slash" /> HIDDEN</div>
                              ) : <div className="w-2 h-2 rounded-full bg-green-500" />}
                            </div>
                          </div>
                          {isSel && <div className="absolute -right-1 -top-1 w-3 h-3 bg-primary rounded-full border-2 border-white" />}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-border lg:hidden bg-white shrink-0">
            <button className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2">
              <i className="fa-solid fa-plus" /> Add {isFood ? 'Item' : 'Service'}
            </button>
          </div>
        </div>

        {/* Right Pane: Editor Form */}
        <div className="flex-1 lg:w-1/2 bg-gray-50 h-full overflow-y-auto p-4 lg:p-8">
          {!selected ? (
            <div className="max-w-2xl mx-auto flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <i className={`fa-solid ${isFood ? 'fa-utensils' : 'fa-scissors'} text-gray-400 text-2xl`} />
              </div>
              <h2 className="font-heading font-bold text-xl text-primary mb-2">Select a {isFood ? 'menu item' : 'service'}</h2>
              <p className="text-sm text-gray-500 max-w-sm">Choose an item from the list to edit its details, pricing, and availability.</p>
            </div>
          ) : (
            <>
              <div className="max-w-2xl mx-auto bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-white">
                  <div>
                    <h2 className="text-xl font-heading font-bold text-primary">Edit {isFood ? 'Item' : 'Service'}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Update details and pricing.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditing(e => ({ ...e, active: !e.active }))}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${editing.active ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${editing.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-xs font-bold text-primary uppercase">{editing.active ? 'Online' : 'Hidden'}</span>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-primary mb-1.5">{isFood ? 'Item' : 'Service'} Name <span className="text-red-500">*</span></label>
                      <input type="text" value={editing.name || ''} onChange={e => setEditing(d => ({ ...d, name: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-primary mb-1.5">Category</label>
                      <div className="relative">
                        <select value={editing.category || ''} onChange={e => setEditing(d => ({ ...d, category: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none bg-white">
                          {displayCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400"><i className="fa-solid fa-chevron-down text-xs" /></div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-primary mb-1.5">Description</label>
                      <textarea rows="3" value={editing.description || ''} onChange={e => setEditing(d => ({ ...d, description: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none" placeholder="Describe this service..." />
                      <p className="text-[10px] text-gray-400 mt-1 text-right">{(editing.description || '').length}/300 characters</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div>
                      <label className="block text-sm font-bold text-primary mb-1.5">Price (£) <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-gray-400 font-bold text-sm">£</span></div>
                        <input type="number" step="0.01" value={editing.price || ''} onChange={e => setEditing(d => ({ ...d, price: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-8 pr-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                      </div>
                    </div>
                    {!isFood && (
                      <div>
                        <label className="block text-sm font-bold text-primary mb-1.5">Duration</label>
                        <div className="relative">
                          <select value={editing.duration || '30 mins'} onChange={e => setEditing(d => ({ ...d, duration: e.target.value }))}
                            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none bg-white">
                            {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400"><i className="fa-solid fa-clock text-xs" /></div>
                        </div>
                      </div>
                    )}
                    {!isFood && (
                      <div>
                        <label className="block text-sm font-bold text-primary mb-1.5">Buffer Time (After)</label>
                        <div className="relative">
                          <select value={editing.buffer || 'None'} onChange={e => setEditing(d => ({ ...d, buffer: e.target.value }))}
                            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none bg-white">
                            {BUFFER_TIMES.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400"><i className="fa-solid fa-hourglass-end text-xs" /></div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Extra time for cleaning/prep.</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border">
                    <label className="block text-sm font-bold text-primary mb-3">Calendar Color</label>
                    <div className="flex flex-wrap gap-3">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => setEditing(d => ({ ...d, color: c }))}
                          className={`w-8 h-8 rounded-full transition-all ${editing.color === c ? 'ring-2 ring-offset-2 ring-primary' : 'hover:ring-2 hover:ring-offset-2 hover:ring-gray-300'}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-border flex items-center justify-between">
                  <button onClick={() => setDeleteConfirm(selected)} className="text-sm font-bold text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">Delete {isFood ? 'Item' : 'Service'}</button>
                  <div className="flex gap-3">
                    <button onClick={() => { setSelected(null); setEditing({}) }} className="text-sm font-bold text-primary bg-white border border-border px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="text-sm font-bold text-white bg-primary px-6 py-2 rounded-lg hover:bg-primary-hover transition-colors shadow-md disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
                  </div>
                </div>
              </div>

              <div className="max-w-2xl mx-auto mt-6 flex gap-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="shrink-0"><i className="fa-solid fa-circle-info text-blue-500 mt-0.5" /></div>
                <div>
                  <h4 className="text-sm font-bold text-primary">Pro Tip: {isFood ? 'Menu Bundles' : 'Service Bundles'}</h4>
                  <p className="text-xs text-gray-500 mt-1">{isFood ? 'Create meal deals by grouping items together. This encourages larger orders and increases average order value.' : 'Create service packages by grouping multiple services together. This encourages clients to book more treatments in a single visit.'}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete / Archive Service Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }} onClick={() => setDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', fontFamily: "'Figtree', sans-serif" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>Remove Service</div>
            </div>
            <div style={{ fontSize: 13, color: '#666', lineHeight: '20px', marginBottom: 8 }}>
              What would you like to do with <strong style={{ color: '#111' }}>{deleteConfirm.name || 'this service'}</strong>?
            </div>
            <div style={{ fontSize: 12, color: '#999', lineHeight: '18px', marginBottom: 24, padding: 12, background: '#FAFAFA', borderRadius: 10, border: '1px solid #F0F0F0' }}>
              <strong style={{ color: '#666' }}>Archive</strong> — hides from booking, can be restored later<br/>
              <strong style={{ color: '#666' }}>Delete</strong> — permanently removes the service
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #E5E5E5', background: '#fff', fontSize: 13, fontWeight: 600, color: '#333', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>Cancel</button>
              <button onClick={handleArchiveService} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #111', background: '#fff', fontSize: 13, fontWeight: 600, color: '#111', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>Archive</button>
              <button onClick={handleDeleteService} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: '#EF4444', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete/Archive Toast */}
      {deleteToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px',
          background: '#111', color: '#fff', borderRadius: 14,
          boxShadow: '0 12px 40px rgba(17,17,17,0.35)', zIndex: 200,
          animation: 'svcToastUp 0.3s ease-out', fontSize: 13, fontWeight: 600,
          fontFamily: "'Figtree', sans-serif",
        }}>
          <Trash2 size={16} color="#EF4444" />
          <span>{deleteToast.name} {deleteToast.action}</span>
          <button onClick={() => navigate('/dashboard/deleted')} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.1)', color: '#C9A84C',
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
            fontFamily: "'Figtree', sans-serif",
          }}>
            <Archive size={12} /> View in Deleted Items
          </button>
        </div>
      )}

      <style>{`
        @keyframes svcToastUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default Services
