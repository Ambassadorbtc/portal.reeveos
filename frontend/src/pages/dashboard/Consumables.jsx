/**
 * Consumables — Treatment consumable stock management
 * Add, adjust, link to services, track usage and low-stock alerts
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import AppLoader from '../../components/shared/AppLoader'
import {
  Package, Plus, Edit2, Trash2, AlertTriangle, TrendingDown,
  Link, BarChart3, X, CheckCircle, Minus, Search, Filter,
} from 'lucide-react'

const CATEGORIES = [
  { value: 'skincare', label: 'Skincare' },
  { value: 'haircare', label: 'Haircare' },
  { value: 'nails', label: 'Nails' },
  { value: 'injectables', label: 'Injectables' },
  { value: 'wax', label: 'Wax' },
  { value: 'tools', label: 'Tools' },
  { value: 'other', label: 'Other' },
]

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

const font = { fontFamily: "'Figtree', sans-serif" }

/* ── Toast ─────────────────────────────────────────── */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up"
      style={{
        ...font,
        backgroundColor: type === 'error' ? '#FEE2E2' : '#F0FDF4',
        color: type === 'error' ? '#991B1B' : '#166534',
        border: `1px solid ${type === 'error' ? '#FECACA' : '#BBF7D0'}`,
      }}
    >
      {type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
      {message}
    </div>
  )
}

/* ── Custom Dropdown ───────────────────────────────── */
function CustomSelect({ value, onChange, options, placeholder, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-left hover:border-gray-300 transition-colors"
        style={font}
      >
        <span className={selected ? 'text-[#111]' : 'text-gray-400'}>
          {selected ? selected.label : placeholder || 'Select...'}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg py-1 max-h-56 overflow-y-auto">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${value === o.value ? 'bg-gray-50 font-semibold text-[#111]' : 'text-gray-700'}`}
              style={font}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Modal Wrapper ─────────────────────────────────── */
function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        style={font}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[#111]">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── Confirm Dialog ────────────────────────────────── */
function ConfirmDialog({ open, onClose, onConfirm, title, message }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" style={font}>
        <h3 className="text-base font-bold text-[#111] mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

/* ── Stock Bar ─────────────────────────────────────── */
function StockBar({ current, minimum }) {
  const max = Math.max(current, minimum * 2, 1)
  const pct = Math.min((current / max) * 100, 100)
  const isLow = current <= minimum
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          backgroundColor: isLow ? '#C9A84C' : '#22C55E',
        }}
      />
    </div>
  )
}

/* ════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                     */
/* ════════════════════════════════════════════════════ */
export default function Consumables() {
  const { business } = useBusiness()
  const bid = business?.id

  /* ── State ──────────────────────────────────────── */
  const [items, setItems] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const filterRef = useRef(null)

  // Modals
  const [itemModal, setItemModal] = useState({ open: false, editing: null })
  const [adjustModal, setAdjustModal] = useState({ open: false, item: null })
  const [linkModal, setLinkModal] = useState({ open: false, item: null })
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, item: null })

  // Usage report
  const [reportOpen, setReportOpen] = useState(false)
  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Toast
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => setToast({ message, type })

  /* ── Close filter dropdown on outside click ─────── */
  useEffect(() => {
    const handler = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterDropdown(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ── Fetch ──────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!bid) return
    setLoading(true)
    try {
      const [itemsRes, alertsRes] = await Promise.all([
        api.get(`/consumables/business/${bid}`),
        api.get(`/consumables/business/${bid}/alerts`),
      ])
      setItems(itemsRes.data?.consumables || itemsRes.data || [])
      setAlerts(alertsRes.data?.alerts || alertsRes.data || [])
    } catch (e) {
      showToast(e.response?.data?.detail || 'Failed to load consumables', 'error')
    } finally {
      setLoading(false)
    }
  }, [bid])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── Filtering ──────────────────────────────────── */
  const filtered = items.filter(i => {
    if (catFilter !== 'all' && i.category !== catFilter) return false
    if (showLowOnly && (i.current_stock || 0) > (i.minimum_stock || 0)) return false
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const lowCount = items.filter(i => (i.current_stock || 0) <= (i.minimum_stock || 0)).length

  /* ── Add / Edit ─────────────────────────────────── */
  const emptyForm = { name: '', category: 'skincare', unit: '', cost_per_unit: '', current_stock: '', minimum_stock: '', supplier: '' }
  const [form, setForm] = useState(emptyForm)
  const [formSaving, setFormSaving] = useState(false)

  const openAddModal = () => {
    setForm(emptyForm)
    setItemModal({ open: true, editing: null })
  }

  const openEditModal = (item) => {
    setForm({
      name: item.name || '',
      category: item.category || 'other',
      unit: item.unit || '',
      cost_per_unit: item.cost_per_unit ?? '',
      current_stock: item.current_stock ?? '',
      minimum_stock: item.minimum_stock ?? '',
      supplier: item.supplier || '',
    })
    setItemModal({ open: true, editing: item })
  }

  const saveItem = async () => {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return }
    setFormSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit.trim(),
        cost_per_unit: parseFloat(form.cost_per_unit) || 0,
        current_stock: parseFloat(form.current_stock) || 0,
        minimum_stock: parseFloat(form.minimum_stock) || 0,
        supplier: form.supplier.trim(),
      }
      if (itemModal.editing) {
        await api.patch(`/consumables/business/${bid}/${itemModal.editing.id}/adjust`, {
          quantity: payload.current_stock - (itemModal.editing.current_stock || 0),
          reason: 'Manual edit',
        })
        showToast('Consumable updated')
      } else {
        await api.post(`/consumables/business/${bid}`, payload)
        showToast('Consumable added')
      }
      setItemModal({ open: false, editing: null })
      fetchData()
    } catch (e) {
      showToast(e.response?.data?.detail || 'Save failed', 'error')
    } finally {
      setFormSaving(false)
    }
  }

  /* ── Adjust Stock ───────────────────────────────── */
  const [adjustQty, setAdjustQty] = useState(0)
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)

  const openAdjust = (item) => {
    setAdjustQty(0)
    setAdjustReason('')
    setAdjustModal({ open: true, item })
  }

  const submitAdjust = async () => {
    if (adjustQty === 0) { showToast('Quantity cannot be zero', 'error'); return }
    if (!adjustReason.trim()) { showToast('Reason is required', 'error'); return }
    setAdjustSaving(true)
    try {
      await api.patch(`/consumables/business/${bid}/${adjustModal.item.id}/adjust`, {
        quantity: adjustQty,
        reason: adjustReason.trim(),
      })
      showToast('Stock adjusted')
      setAdjustModal({ open: false, item: null })
      fetchData()
    } catch (e) {
      showToast(e.response?.data?.detail || 'Adjust failed', 'error')
    } finally {
      setAdjustSaving(false)
    }
  }

  /* ── Link to Service ────────────────────────────── */
  const [linkServiceId, setLinkServiceId] = useState('')
  const [linkQty, setLinkQty] = useState(1)
  const [linkSaving, setLinkSaving] = useState(false)

  const openLink = (item) => {
    setLinkServiceId('')
    setLinkQty(1)
    setLinkModal({ open: true, item })
  }

  const submitLink = async () => {
    if (!linkServiceId.trim()) { showToast('Service ID is required', 'error'); return }
    setLinkSaving(true)
    try {
      await api.post(`/consumables/business/${bid}/link-service`, {
        consumable_id: linkModal.item.id,
        service_id: linkServiceId.trim(),
        qty_per_use: parseFloat(linkQty) || 1,
      })
      showToast('Linked to service')
      setLinkModal({ open: false, item: null })
    } catch (e) {
      showToast(e.response?.data?.detail || 'Link failed', 'error')
    } finally {
      setLinkSaving(false)
    }
  }

  /* ── Delete ─────────────────────────────────────── */
  const confirmDelete = async () => {
    try {
      await api.delete(`/consumables/business/${bid}/${deleteConfirm.item.id}`)
      showToast('Consumable deleted')
      setDeleteConfirm({ open: false, item: null })
      fetchData()
    } catch (e) {
      showToast(e.response?.data?.detail || 'Delete failed', 'error')
    }
  }

  /* ── Usage Report ───────────────────────────────── */
  const fetchReport = async () => {
    if (!reportFrom || !reportTo) { showToast('Select date range', 'error'); return }
    setReportLoading(true)
    try {
      const res = await api.get(`/consumables/business/${bid}/usage-report?from=${reportFrom}&to=${reportTo}`)
      setReportData(res.data)
    } catch (e) {
      showToast(e.response?.data?.detail || 'Report failed', 'error')
    } finally {
      setReportLoading(false)
    }
  }

  /* ── Render ─────────────────────────────────────── */
  if (loading) {
    return (
      <div className="-m-6 lg:-m-8 min-h-screen flex items-center justify-center" style={font}>
        <AppLoader message="Loading consumables..." />
      </div>
    )
  }

  return (
    <div className="-m-6 lg:-m-8 min-h-screen bg-gray-50/50" style={font}>
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-6 lg:py-8">

        {/* ── Header ─────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2.5 bg-[#111] rounded-xl">
              <Package size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[#111]">Consumables</h1>
                {alerts.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full" style={{ backgroundColor: '#C9A84C', color: '#fff' }}>
                    {alerts.length}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{items.length} items tracked</p>
            </div>
          </div>

          {/* Search + Filter + Add */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items..."
                className="pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#C9A84C] w-48 transition-colors"
                style={font}
              />
            </div>

            {/* Category filter */}
            <div ref={filterRef} className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border rounded-xl transition-colors ${catFilter !== 'all' ? 'border-[#C9A84C] bg-[#FEF9E7] text-[#111]' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <Filter size={15} />
                {catFilter !== 'all' ? CATEGORY_MAP[catFilter] : 'Category'}
              </button>
              {showFilterDropdown && (
                <div className="absolute right-0 z-50 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[160px]">
                  <button
                    onClick={() => { setCatFilter('all'); setShowFilterDropdown(false) }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${catFilter === 'all' ? 'font-semibold text-[#111]' : 'text-gray-700'}`}
                  >
                    All Categories
                  </button>
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      onClick={() => { setCatFilter(c.value); setShowFilterDropdown(false) }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${catFilter === c.value ? 'font-semibold text-[#111]' : 'text-gray-700'}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-[#111111] hover:bg-[#222] rounded-xl transition-colors"
            >
              <Plus size={16} />
              Add Item
            </button>
          </div>
        </div>

        {/* ── Alerts Banner ──────────────────────── */}
        {lowCount > 0 && (
          <button
            onClick={() => setShowLowOnly(!showLowOnly)}
            className="w-full mb-6 flex items-center gap-3 px-5 py-3.5 rounded-2xl border text-left transition-colors"
            style={{
              backgroundColor: showLowOnly ? '#FDF2D1' : '#FEF9E7',
              borderColor: '#F9E79F',
            }}
          >
            <AlertTriangle size={18} style={{ color: '#C9A84C' }} />
            <span className="text-sm font-medium text-[#111]">
              {lowCount} item{lowCount !== 1 ? 's' : ''} below minimum stock level
            </span>
            <span className="ml-auto text-xs font-medium" style={{ color: '#C9A84C' }}>
              {showLowOnly ? 'Show all' : 'Show low stock only'}
            </span>
          </button>
        )}

        {/* ── Inventory Grid ─────────────────────── */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-12 text-center">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-400">
              {items.length === 0 ? 'No consumables yet. Add your first item.' : 'No items match your filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {filtered.map(item => {
              const isLow = (item.current_stock || 0) <= (item.minimum_stock || 0)
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-5 flex flex-col"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-[#111] truncate">{item.name}</h3>
                      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                        {CATEGORY_MAP[item.category] || item.category}
                      </span>
                    </div>
                    {isLow && (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full" style={{ backgroundColor: '#FEF9E7', color: '#C9A84C' }}>
                        <TrendingDown size={12} />
                        Low
                      </span>
                    )}
                  </div>

                  {/* Stock info */}
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-2xl font-bold text-[#111]">{item.current_stock ?? 0}</span>
                    <span className="text-xs text-gray-400">/ {item.minimum_stock ?? 0} min</span>
                    {item.unit && <span className="text-xs text-gray-400 ml-1">{item.unit}</span>}
                  </div>

                  <StockBar current={item.current_stock || 0} minimum={item.minimum_stock || 0} />

                  {/* Details row */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    {item.cost_per_unit != null && (
                      <span>Cost: {'\u00A3'}{Number(item.cost_per_unit).toFixed(2)}/{item.unit || 'unit'}</span>
                    )}
                    {item.supplier && <span className="truncate">Supplier: {item.supplier}</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => openAdjust(item)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#111] bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Plus size={13} />
                      <Minus size={13} />
                      Adjust
                    </button>
                    <button
                      onClick={() => openLink(item)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#111] bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Link size={13} />
                      Link
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 text-gray-400 hover:text-[#111] hover:bg-gray-100 rounded-lg transition-colors ml-auto"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ open: true, item })}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Usage Report ────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
          <button
            onClick={() => setReportOpen(!reportOpen)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left"
          >
            <BarChart3 size={18} className="text-[#111]" />
            <span className="text-sm font-bold text-[#111]">Usage Report</span>
            <svg
              className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${reportOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {reportOpen && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4">
              <div className="flex flex-wrap items-end gap-3 mb-5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">From</label>
                  <input
                    type="date"
                    value={reportFrom}
                    onChange={e => setReportFrom(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C9A84C]"
                    style={font}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">To</label>
                  <input
                    type="date"
                    value={reportTo}
                    onChange={e => setReportTo(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C9A84C]"
                    style={font}
                  />
                </div>
                <button
                  onClick={fetchReport}
                  disabled={reportLoading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#111111] hover:bg-[#222] rounded-xl transition-colors disabled:opacity-50"
                >
                  {reportLoading ? 'Loading...' : 'Generate'}
                </button>
              </div>

              {reportData && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Item</th>
                        <th className="text-right py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Deducted</th>
                        <th className="text-right py-2 pl-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData.items || reportData.usage || []).map((row, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2.5 pr-4 font-medium text-[#111]">{row.name || row.item_name}</td>
                          <td className="py-2.5 px-4 text-right text-gray-600">{row.total_deducted ?? row.quantity ?? 0}</td>
                          <td className="py-2.5 pl-4 text-right text-gray-600">{'\u00A3'}{Number(row.total_cost ?? row.cost ?? 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200">
                        <td className="py-2.5 pr-4 font-bold text-[#111]">Total</td>
                        <td className="py-2.5 px-4 text-right font-bold text-[#111]">
                          {(reportData.items || reportData.usage || []).reduce((s, r) => s + (r.total_deducted ?? r.quantity ?? 0), 0)}
                        </td>
                        <td className="py-2.5 pl-4 text-right font-bold text-[#111]">
                          {'\u00A3'}{(reportData.items || reportData.usage || []).reduce((s, r) => s + (r.total_cost ?? r.cost ?? 0), 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ═══════════ MODALS ═══════════════════════ */}

      {/* Add / Edit Modal */}
      <Modal
        open={itemModal.open}
        onClose={() => setItemModal({ open: false, editing: null })}
        title={itemModal.editing ? 'Edit Consumable' : 'Add Consumable'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Hyaluronic Serum"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C9A84C]"
              style={font}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Category</label>
            <CustomSelect
              value={form.category}
              onChange={v => setForm({ ...form, category: v })}
              options={CATEGORIES}
              placeholder="Select category"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                placeholder="ml, pcs, g..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C9A84C]"
                style={font}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Cost per Unit</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.cost_per_unit}
                onChange={e => setForm({ ...form, cost_per_unit: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C9A84C]"
                style={font}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Current Stock</label>
              <input
                type="number"
                min="0"
                value={form.current_stock}
                onChange={e => setForm({ ...form, current_stock: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C9A84C]"
                style={font}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Minimum Stock</label>
              <input
                type="number"
                min="0"
                value={form.minimum_stock}
                onChange={e => setForm({ ...form, minimum_stock: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C9A84C]"
                style={font}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Supplier</label>
            <input
              type="text"
              value={form.supplier}
              onChange={e => setForm({ ...form, supplier: e.target.value })}
              placeholder="Optional"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C9A84C]"
              style={font}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setItemModal({ open: false, editing: null })}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveItem}
              disabled={formSaving}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#111111] hover:bg-[#222] rounded-xl transition-colors disabled:opacity-50"
            >
              {formSaving ? 'Saving...' : itemModal.editing ? 'Update' : 'Add Item'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        open={adjustModal.open}
        onClose={() => setAdjustModal({ open: false, item: null })}
        title={`Adjust Stock: ${adjustModal.item?.name || ''}`}
      >
        <div className="space-y-4">
          <div className="text-center py-3">
            <p className="text-sm text-gray-500 mb-3">
              Current stock: <span className="font-bold text-[#111]">{adjustModal.item?.current_stock ?? 0}</span> {adjustModal.item?.unit || ''}
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setAdjustQty(q => q - 1)}
                className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <Minus size={18} className="text-[#111]" />
              </button>
              <input
                type="number"
                value={adjustQty}
                onChange={e => setAdjustQty(parseInt(e.target.value) || 0)}
                className="w-24 text-center text-2xl font-bold text-[#111] border border-gray-200 rounded-xl py-2 focus:outline-none focus:border-[#C9A84C]"
                style={font}
              />
              <button
                onClick={() => setAdjustQty(q => q + 1)}
                className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <Plus size={18} className="text-[#111]" />
              </button>
            </div>
            {adjustQty !== 0 && (
              <p className="text-sm mt-2" style={{ color: adjustQty > 0 ? '#22C55E' : '#EF4444' }}>
                New stock: {(adjustModal.item?.current_stock || 0) + adjustQty}
              </p>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Reason</label>
            <input
              type="text"
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              placeholder="e.g. Restocked from supplier, Used for walk-in..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C9A84C]"
              style={font}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setAdjustModal({ open: false, item: null })}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submitAdjust}
              disabled={adjustSaving || adjustQty === 0}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#111111] hover:bg-[#222] rounded-xl transition-colors disabled:opacity-50"
            >
              {adjustSaving ? 'Saving...' : 'Adjust Stock'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Link to Service Modal */}
      <Modal
        open={linkModal.open}
        onClose={() => setLinkModal({ open: false, item: null })}
        title={`Link to Service: ${linkModal.item?.name || ''}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Service ID</label>
            <input
              type="text"
              value={linkServiceId}
              onChange={e => setLinkServiceId(e.target.value)}
              placeholder="Enter service ID"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C9A84C]"
              style={font}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Quantity per Use</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={linkQty}
              onChange={e => setLinkQty(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C9A84C]"
              style={font}
            />
            <p className="text-xs text-gray-400 mt-1">
              Amount of {linkModal.item?.unit || 'units'} used per appointment
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setLinkModal({ open: false, item: null })}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submitLink}
              disabled={linkSaving}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#111111] hover:bg-[#222] rounded-xl transition-colors disabled:opacity-50"
            >
              {linkSaving ? 'Linking...' : 'Link Service'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, item: null })}
        onConfirm={confirmDelete}
        title="Delete Consumable"
        message={`Are you sure you want to delete "${deleteConfirm.item?.name || ''}"? This action can be undone by an administrator.`}
      />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Animation keyframes */}
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </div>
  )
}
