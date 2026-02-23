/**
 * Services / Menu — styled to match 7-Brand Design - Services/Menu.html
 * Two-pane: categorized service list (left) + editor form (right)
 */

import { useState, useEffect } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const COLORS = ['#FFD166', '#06D6A0', '#118AB2', '#EF476F', '#073B4C', '#F77F00']

const Services = () => {
  const { business, businessType, isDemo } = useBusiness()
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [editing, setEditing] = useState({})

  const bid = business?.id ?? business?._id
  const isFood = businessType === 'food'

  useEffect(() => {
    if (!bid || isDemo) { setLoading(false); return }
    const fetchServices = async () => {
      try { const res = await api.get(`/services/business/${bid}`); setServices(res.services || []); setCategories(res.categories || []) }
      catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchServices()
  }, [bid])

  const demoCategories = isFood
    ? [{ id: 'cat1', name: 'Starters', color: '#FFD166', count: 4 }, { id: 'cat2', name: 'Mains', color: '#06D6A0', count: 6 }, { id: 'cat3', name: 'Desserts', color: '#EF476F', count: 3 }]
    : [{ id: 'cat1', name: 'Hair Styling', color: '#FFD166', count: 5 }, { id: 'cat2', name: 'Colouring', color: '#EF476F', count: 3 }, { id: 'cat3', name: 'Treatments', color: '#118AB2', count: 2 }]

  const demoServices = isFood
    ? [
        { id: 's1', name: 'Garlic Bread', category: 'cat1', price: 5.50, duration: null, staff: null, color: '#FFD166', active: true },
        { id: 's2', name: 'Soup of the Day', category: 'cat1', price: 6.50, duration: null, staff: null, color: '#FFD166', active: true },
        { id: 's3', name: 'Grilled Salmon', category: 'cat2', price: 18.50, duration: null, staff: null, color: '#06D6A0', active: true },
        { id: 's4', name: 'Ribeye Steak', category: 'cat2', price: 24.00, duration: null, staff: null, color: '#06D6A0', active: true },
        { id: 's5', name: 'Chocolate Fondant', category: 'cat3', price: 8.50, duration: null, staff: null, color: '#EF476F', active: true },
      ]
    : [
        { id: 's1', name: 'Ladies Cut & Blow Dry', category: 'cat1', price: 45.00, duration: '45 mins', staff: 'All', color: '#FFD166', active: true },
        { id: 's2', name: 'Blow Dry', category: 'cat1', price: 30.00, duration: '30 mins', staff: 'Sarah, John', color: '#FFD166', active: true },
        { id: 's3', name: 'Gents Cut', category: 'cat1', price: 25.00, duration: '30 mins', staff: 'All', color: '#FFD166', active: true },
        { id: 's4', name: 'Full Head Colour', category: 'cat2', price: 85.00, duration: '120 mins', staff: 'Sarah', color: '#EF476F', active: true },
        { id: 's5', name: 'Balayage (Seasonal)', category: 'cat2', price: 120.00, duration: '180 mins', staff: 'Sarah', color: '#EF476F', active: false },
      ]

  const displayCategories = categories.length > 0 ? categories : demoCategories
  const displayServices = services.length > 0 ? services : demoServices

  const filtered = displayServices.filter(s => {
    if (activeCategory !== 'all' && s.category !== activeCategory) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const grouped = displayCategories.map(cat => ({
    ...cat,
    items: filtered.filter(s => s.category === cat.id)
  })).filter(g => g.items.length > 0 || activeCategory === 'all')

  const handleSelect = (service) => {
    setSelected(service)
    setEditing({ ...service })
  }

  return (
    <div className="-m-6 lg:-m-8 flex h-[calc(100vh-4rem)]">
      {/* Left Pane: Service List */}
      <div className="flex-1 lg:w-1/2 flex flex-col h-full border-r border-border bg-white overflow-hidden">
        {/* Search & Filters */}
        <div className="p-4 border-b border-border bg-white shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input type="text" placeholder={`Search ${isFood ? 'menu items' : 'services'}...`} value={search} onChange={e => setSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-gray-50 text-sm text-primary font-medium focus:ring-primary focus:border-primary focus:bg-white transition-colors" />
            </div>
            <button className="lg:hidden px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-sm"><i className="fa-solid fa-plus mr-1" /> Add</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setActiveCategory('all')} className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap border transition-colors ${activeCategory === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-border hover:border-primary hover:text-primary'}`}>
              All {isFood ? 'Items' : 'Services'}
            </button>
            {displayCategories.map(c => (
              <button key={c.id} onClick={() => setActiveCategory(c.id)}
                className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap border transition-colors ${activeCategory === c.id ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-border hover:border-primary hover:text-primary'}`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-12"><p className="text-gray-500">No {isFood ? 'menu items' : 'services'} found</p></div>
          ) : grouped.map(cat => (
            <div key={cat.id}>
              <div className="flex items-center justify-between mb-3 px-2 group cursor-pointer hover:bg-gray-50 rounded py-1">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-grip-vertical text-gray-300 text-xs opacity-0 group-hover:opacity-100" />
                  <h3 className="font-heading font-bold text-lg text-primary">{cat.name}</h3>
                  <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-gray-200">{cat.items.length} items</span>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="text-gray-400 hover:text-primary p-1"><i className="fa-solid fa-pen text-xs" /></button>
                </div>
              </div>
              <div className="space-y-2">
                {cat.items.map(s => (
                  <div key={s.id} onClick={() => handleSelect(s)}
                    className={`${selected?.id === s.id ? 'bg-primary/5 border-primary shadow-sm' : s.active === false ? 'bg-gray-50 border-border opacity-75' : 'bg-white border-border hover:border-primary/50 hover:shadow-md'} border rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-all group relative`}>
                    <div className="text-gray-300 group-hover:text-primary p-1"><i className="fa-solid fa-grip-vertical" /></div>
                    <div className="w-3 h-10 rounded" style={{ backgroundColor: s.color || cat.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className={`font-bold text-sm truncate ${s.active === false ? 'text-gray-500' : 'text-primary'}`}>{s.name}</h4>
                        <span className={`text-sm font-bold ${s.active === false ? 'text-gray-500' : 'text-primary'}`}>£{s.price?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <span className="text-xs text-gray-500">{s.duration ? `${s.duration} • Staff: ${s.staff}` : ''}</span>
                        {s.active === false ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-200 px-1.5 rounded"><i className="fa-solid fa-eye-slash" /> HIDDEN</span>
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                        )}
                      </div>
                    </div>
                    {selected?.id === s.id && <div className="absolute -right-1 -top-1 w-3 h-3 bg-primary rounded-full border-2 border-white" />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Add Button */}
        <div className="p-4 border-t border-border lg:hidden bg-white shrink-0">
          <button className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2">
            <i className="fa-solid fa-plus" /> Add {isFood ? 'Menu Item' : 'Service'}
          </button>
        </div>
      </div>

      {/* Right Pane: Editor */}
      <div className="hidden lg:flex flex-1 lg:w-1/2 bg-gray-50 h-full overflow-y-auto p-8">
        {selected ? (
          <div className="max-w-2xl mx-auto w-full">
            <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-xl font-heading font-bold text-primary">Edit {isFood ? 'Menu Item' : 'Service'}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Update details and pricing.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary uppercase">{selected.active !== false ? 'Online' : 'Hidden'}</span>
                  <div className={`w-9 h-5 rounded-full relative cursor-pointer ${selected.active !== false ? 'bg-primary' : 'bg-gray-200'}`}>
                    <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-all ${selected.active !== false ? 'right-[2px]' : 'left-[2px]'}`} />
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">{isFood ? 'Item' : 'Service'} Name <span className="text-red-500">*</span></label>
                  <input type="text" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">Category</label>
                  <div className="relative">
                    <select className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none bg-white">
                      {displayCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400"><i className="fa-solid fa-chevron-down text-xs" /></div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">Description</label>
                  <textarea rows="3" value={editing.description || ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" placeholder="Describe this item..." />
                  <p className="text-[10px] text-gray-400 mt-1 text-right">0/300 characters</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-border">
                  <div>
                    <label className="block text-sm font-bold text-primary mb-1.5">Price (£) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-gray-400 font-bold text-sm">£</span></div>
                      <input type="number" value={editing.price || ''} step="0.01" onChange={e => setEditing(p => ({ ...p, price: parseFloat(e.target.value) }))}
                        className="w-full pl-8 pr-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                  </div>
                  {!isFood && (
                    <div>
                      <label className="block text-sm font-bold text-primary mb-1.5">Duration</label>
                      <select className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none bg-white">
                        {['15 mins','30 mins','45 mins','1 hour','1 hr 15 mins','1 hr 30 mins','2 hours','3 hours'].map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Calendar Color */}
                <div className="pt-4 border-t border-border">
                  <label className="block text-sm font-bold text-primary mb-3">Calendar Color</label>
                  <div className="flex flex-wrap gap-3">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setEditing(p => ({ ...p, color: c }))}
                        className={`w-8 h-8 rounded-full transition-all ${editing.color === c ? 'ring-2 ring-offset-2 ring-primary' : 'hover:ring-2 hover:ring-offset-2 hover:ring-gray-300'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-border flex items-center justify-between">
                <button className="text-sm font-bold text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">Delete</button>
                <div className="flex gap-3">
                  <button onClick={() => setSelected(null)} className="text-sm font-bold text-primary bg-white border border-border px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm">Cancel</button>
                  <button className="text-sm font-bold text-white bg-primary px-6 py-2 rounded-lg hover:bg-primary-hover shadow-md">Save Changes</button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="shrink-0"><i className="fa-solid fa-circle-info text-blue-500 mt-0.5" /></div>
              <div>
                <h4 className="text-sm font-bold text-primary">Pro Tip: {isFood ? 'Menu Combos' : 'Service Bundles'}</h4>
                <p className="text-xs text-gray-500 mt-1">{isFood ? 'Create meal deals by grouping multiple items together to increase average order value.' : 'Create service packages by grouping multiple services together to encourage larger bookings.'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className={`fa-solid ${isFood ? 'fa-utensils' : 'fa-scissors'} text-gray-300 text-3xl`} />
              </div>
              <h3 className="font-heading font-bold text-lg text-primary mb-2">Select a {isFood ? 'menu item' : 'service'}</h3>
              <p className="text-sm text-gray-500">Click on any item from the list to edit its details.</p>
              <button className="mt-4 px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-md hover:bg-primary-hover">
                <i className="fa-solid fa-plus mr-2" /> Add New
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Services
