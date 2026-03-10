/**
 * ShopManager.jsx — Full ecommerce management for business owners
 * Products, Orders, Discounts, Vouchers — all self-service like Shopify admin
 */
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import AppLoader from '../../components/shared/AppLoader'
import {
  Package, ShoppingBag, Tag, Gift, Plus, Search, ArrowLeft,
  Edit3, Trash2, AlertTriangle, Check, Truck, Archive, X,
  Eye, EyeOff, DollarSign, BarChart3
} from 'lucide-react'

const GOLD = '#C9A84C'
const TABS = [
  { id: 'products', label: 'Products', Icon: Package },
  { id: 'orders', label: 'Orders', Icon: ShoppingBag },
  { id: 'discounts', label: 'Discounts', Icon: Tag },
  { id: 'vouchers', label: 'Gift Vouchers', Icon: Gift },
]

const STATUS_COLORS = {
  active: '#10B981', draft: '#F59E0B', archived: '#9CA3AF', out_of_stock: '#EF4444',
  pending: '#F59E0B', confirmed: '#3B82F6', processing: '#8B5CF6', shipped: '#10B981',
  delivered: '#059669', cancelled: '#EF4444', refunded: '#6B7280', disabled: '#9CA3AF',
}

const fmtPrice = (v) => `£${(v || 0).toFixed(2)}`
const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) } catch { return '—' } }

const Label = ({ children }) => (
  <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{children}</label>
)
const Input = ({ value, onChange, type = 'text', placeholder = '', ...rest }) => (
  <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 10, fontSize: 13, outline: 'none', fontFamily: "'Figtree', sans-serif", boxSizing: 'border-box', ...rest.style }} />
)
const TextArea = ({ value, onChange, placeholder = '', rows = 3 }) => (
  <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 10, fontSize: 13, outline: 'none', fontFamily: "'Figtree', sans-serif", resize: 'vertical', boxSizing: 'border-box' }} />
)
const Pill = ({ active, children, onClick }) => (
  <button onClick={onClick} style={{ padding: '5px 14px', borderRadius: 8, border: active ? '2px solid #111' : '1px solid #E5E5E5', background: active ? '#111' : '#fff', color: active ? '#fff' : '#555', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>{children}</button>
)
const StatusBadge = ({ status }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${STATUS_COLORS[status] || '#999'}15`, color: STATUS_COLORS[status] || '#999', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{(status || '').replace(/_/g, ' ')}</span>
)

export default function ShopManager() {
  const { business } = useBusiness()
  const bid = business?.id ?? business?._id
  const [searchParams, setSearchParams] = useSearchParams()
  const urlTab = searchParams.get('tab') || 'products'
  const [tab, setTabState] = useState(urlTab)
  const setTab = (t) => { setTabState(t); setSearchParams({ tab: t }) }
  useEffect(() => { if (urlTab !== tab) setTabState(urlTab) }, [urlTab])
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [discounts, setDiscounts] = useState([])
  const [vouchers, setVouchers] = useState([])
  const [stats, setStats] = useState(null)
  const [search, setSearch] = useState('')
  const [panel, setPanel] = useState(null) // { type: 'product'|'discount', data: {...} }
  const [error, setError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { id, name }

  const load = useCallback(async () => {
    if (!bid) { setLoading(false); return }
    try {
      const [p, o, d, v, s] = await Promise.all([
        api.get(`/shop/business/${bid}/products`).catch(() => ({ products: [] })),
        api.get(`/shop/business/${bid}/orders`).catch(() => ({ orders: [] })),
        api.get(`/shop/business/${bid}/discounts`).catch(() => ({ discounts: [] })),
        api.get(`/shop/business/${bid}/vouchers`).catch(() => ({ vouchers: [] })),
        api.get(`/shop/business/${bid}/stats`).catch(() => null),
      ])
      setProducts(p.products || [])
      setOrders(o.orders || [])
      setDiscounts(d.discounts || [])
      setVouchers(v.vouchers || [])
      setStats(s)
      setError(null)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [bid])

  useEffect(() => { load() }, [load])

  const saveProduct = async (data) => {
    if (data.id) {
      await api.put(`/shop/business/${bid}/products/${data.id}`, data)
    } else {
      await api.post(`/shop/business/${bid}/products`, data)
    }
    setPanel(null)
    load()
  }

  const archiveProduct = async (id) => {
    try {
      await api.patch(`/shop/business/${bid}/products/${id}`, { status: 'archived' })
      setDeleteConfirm(null)
      load()
    } catch (e) {
      console.error('Archive failed:', e)
      alert('Failed to archive product. Please try again.')
    }
  }

  const deleteProduct = async (id) => {
    try {
      await api.delete(`/shop/business/${bid}/products/${id}`)
      setDeleteConfirm(null)
      load()
    } catch (e) {
      console.error('Delete failed:', e)
      // Fallback: try archive instead
      try {
        await api.patch(`/shop/business/${bid}/products/${id}`, { status: 'archived' })
        setDeleteConfirm(null)
        load()
      } catch (e2) {
        alert('Failed to delete product. Please try again.')
      }
    }
  }

  const updateOrder = async (orderId, status) => {
    await api.patch(`/shop/business/${bid}/orders/${orderId}`, { status })
    load()
  }

  const saveDiscount = async (data) => {
    await api.post(`/shop/business/${bid}/discounts`, data)
    setPanel(null)
    load()
  }

  if (loading) return <AppLoader message="Loading shop..." />
  if (error) return (
    <div data-tour="shop" style={{ padding: 40, textAlign: 'center', fontFamily: "'Figtree', sans-serif" }}>
      <p style={{ color: '#EF4444', fontWeight: 700 }}>Shop Error</p>
      <p style={{ color: '#666', fontSize: 13, marginTop: 8 }}>{error}</p>
      <button onClick={() => { setError(null); setLoading(true); load() }} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, border: '1px solid #DDD', background: '#fff', cursor: 'pointer', fontFamily: "'Figtree', sans-serif", fontWeight: 600 }}>Retry</button>
    </div>
  )

  return (
    <div style={{ fontFamily: "'Figtree', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', background: '#FAFAF8' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #EBEBEB', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none',
              background: tab === t.id ? '#111' : 'transparent', color: tab === t.id ? '#fff' : '#666',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif",
            }}>
              <t.Icon size={15} /> {t.label}
              {t.id === 'orders' && (stats?.pending_orders || 0) > 0 && (
                <span style={{ background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8 }}>{stats.pending_orders}</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stats && <span style={{ fontSize: 11, color: '#888' }}>{stats.total_products} products · {stats.total_orders} orders · {fmtPrice(stats.total_revenue)} revenue</span>}
          {tab === 'products' && (
            <button onClick={() => setPanel({ type: 'product', data: { name: '', price: '', stock: '', category: '', description: '', status: 'active', type: 'physical', track_stock: true, visible_online: true, shipping_required: true, tags: '' } })}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>
              <Plus size={14} /> Add Product
            </button>
          )}
          {tab === 'discounts' && (
            <button onClick={() => setPanel({ type: 'discount', data: { code: '', type: 'percentage', value: '', min_spend: '', max_uses: '', status: 'active', applies_to: 'all' } })}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>
              <Plus size={14} /> Create Code
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {tab === 'products' && <ProductsView products={products} search={search} setSearch={setSearch} onEdit={p => setPanel({ type: 'product', data: { ...p, tags: (p.tags || []).join(', ') } })} onDelete={(id, name) => setDeleteConfirm({ id, name })} />}
        {tab === 'orders' && <OrdersView orders={orders} onUpdate={updateOrder} />}
        {tab === 'discounts' && <DiscountsView discounts={discounts} />}
        {tab === 'vouchers' && <VouchersView vouchers={vouchers} />}
      </div>

      {/* Slide Panels */}
      {panel?.type === 'product' && <ProductPanel data={panel.data} onSave={saveProduct} onClose={() => setPanel(null)} />}
      {panel?.type === 'discount' && <DiscountPanel data={panel.data} onSave={saveDiscount} onClose={() => setPanel(null)} />}

      {/* Delete / Archive Confirmation Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }} onClick={() => setDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', fontFamily: "'Figtree', sans-serif" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={20} color="#EF4444" /></div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>Remove Product</div>
            </div>
            <div style={{ fontSize: 13, color: '#666', lineHeight: '20px', marginBottom: 8 }}>
              What would you like to do with <strong style={{ color: '#111' }}>{deleteConfirm.name || 'this product'}</strong>?
            </div>
            <div style={{ fontSize: 12, color: '#999', lineHeight: '18px', marginBottom: 24, padding: 12, background: '#FAFAFA', borderRadius: 10, border: '1px solid #F0F0F0' }}>
              <strong style={{ color: '#666' }}>Archive</strong> — hides from shop, can be restored later from Deleted Items<br/>
              <strong style={{ color: '#666' }}>Delete</strong> — permanently removes the product
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #E5E5E5', background: '#fff', fontSize: 13, fontWeight: 600, color: '#333', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>Cancel</button>
              <button onClick={() => archiveProduct(deleteConfirm.id || deleteConfirm._id)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #111', background: '#fff', fontSize: 13, fontWeight: 600, color: '#111', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>Archive</button>
              <button onClick={() => deleteProduct(deleteConfirm.id || deleteConfirm._id)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: '#EF4444', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTS VIEW
// ═══════════════════════════════════════════════════════════════
function ProductsView({ products, search, setSearch, onEdit, onDelete }) {
  const filtered = products.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ marginBottom: 12, maxWidth: 300, position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#999' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
          style={{ width: '100%', paddingLeft: 32, padding: '8px 12px 8px 32px', border: '1px solid #E5E5E5', borderRadius: 10, fontSize: 13, outline: 'none', fontFamily: "'Figtree', sans-serif" }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {filtered.map(p => (
          <div key={p.id || p._id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #EBEBEB', padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{p.category}{p.subcategory ? ` · ${p.subcategory}` : ''}</div>
              </div>
              <StatusBadge status={p.status} />
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>{fmtPrice(p.price)}</span>
              {p.compare_at_price > 0 && <span style={{ fontSize: 12, color: '#999', textDecoration: 'line-through' }}>{fmtPrice(p.compare_at_price)}</span>}
            </div>

            {p.track_stock && (
              <div style={{ fontSize: 11, color: p.stock <= (p.low_stock_threshold || 5) ? '#EF4444' : '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
                {p.stock <= (p.low_stock_threshold || 5) && <AlertTriangle size={11} />}
                {p.stock} in stock
              </div>
            )}
            {!p.track_stock && <div style={{ fontSize: 11, color: '#888' }}>Unlimited stock</div>}

            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {(p.tags || []).slice(0, 4).map(t => <span key={t} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#F3F4F6', color: '#666' }}>{t}</span>)}
              {p.type !== 'physical' && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#EDE9FE', color: '#7C3AED' }}>{p.type}</span>}
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #F5F5F5' }}>
              <button onClick={() => onEdit(p)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6, borderRadius: 8, border: '1px solid #E5E5E5', background: '#fff', fontSize: 11, fontWeight: 600, color: '#333', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>
                <Edit3 size={12} /> Edit
              </button>
              <button onClick={() => onDelete(p.id || p._id, p.name)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Archive size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <div style={{ padding: 60, textAlign: 'center', color: '#999', fontSize: 13 }}>No products found. Click "Add Product" to get started.</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ORDERS VIEW
// ═══════════════════════════════════════════════════════════════
function OrdersView({ orders, onUpdate }) {
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const nextStatus = { pending: 'confirmed', confirmed: 'processing', processing: 'shipped', shipped: 'delivered' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: filter === s ? '#111' : '#F5F5F5', color: filter === s ? '#fff' : '#666', fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', fontFamily: "'Figtree', sans-serif" }}>
            {s === 'all' ? `All (${orders.length})` : `${s} (${orders.filter(o => o.status === s).length})`}
          </button>
        ))}
      </div>

      {filtered.map(o => (
        <div key={o.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #EBEBEB', padding: 16, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{o.order_number}</span>
              <span style={{ fontSize: 11, color: '#999' }}>{fmtDate(o.created_at)}</span>
            </div>
            <StatusBadge status={o.status} />
          </div>
          <div style={{ fontSize: 13, color: '#333' }}>{o.customer?.name || 'Unknown'} · <span style={{ color: '#888' }}>{o.customer?.email}</span></div>
          <div style={{ fontSize: 12, color: '#888', margin: '4px 0 8px' }}>{(o.items || []).length} items · <strong style={{ color: '#111' }}>{fmtPrice(o.total)}</strong>{o.discount > 0 && <span style={{ color: '#10B981' }}> (−{fmtPrice(o.discount)} discount)</span>}</div>

          <div style={{ marginBottom: 8 }}>
            {(o.items || []).map((item, i) => (
              <div key={i} style={{ fontSize: 12, color: '#555', padding: '2px 0' }}>{item.quantity}× {item.name} — {fmtPrice(item.price * item.quantity)}</div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '1px solid #F5F5F5' }}>
            {nextStatus[o.status] && (
              <button onClick={() => onUpdate(o.id, nextStatus[o.status])}
                style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: STATUS_COLORS[nextStatus[o.status]] || '#111', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', fontFamily: "'Figtree', sans-serif" }}>
                Mark {nextStatus[o.status]}
              </button>
            )}
            {o.status !== 'cancelled' && o.status !== 'delivered' && (
              <button onClick={() => onUpdate(o.id, 'cancelled')}
                style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#EF4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>Cancel</button>
            )}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div style={{ padding: 60, textAlign: 'center', color: '#999', fontSize: 13 }}>No orders{filter !== 'all' ? ` with status "${filter}"` : ''} yet.</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DISCOUNTS VIEW
// ═══════════════════════════════════════════════════════════════
function DiscountsView({ discounts }) {
  return (
    <div>
      {discounts.map(d => (
        <div key={d.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #EBEBEB', padding: 16, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ padding: '8px 14px', borderRadius: 10, background: '#F5F5F3', fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#111', letterSpacing: 1 }}>{d.code}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>
              {d.type === 'percentage' ? `${d.value}% off` : fmtPrice(d.value) + ' off'}
              {d.min_spend ? ` · Min spend ${fmtPrice(d.min_spend)}` : ''}
            </div>
            <div style={{ fontSize: 11, color: '#888' }}>{d.used || 0} used{d.max_uses ? ` / ${d.max_uses}` : ''} · {d.applies_to === 'all' ? 'All products' : d.category || 'Specific'}</div>
          </div>
          <StatusBadge status={d.status} />
        </div>
      ))}
      {discounts.length === 0 && <div style={{ padding: 60, textAlign: 'center', color: '#999', fontSize: 13 }}>No discount codes yet.</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// VOUCHERS VIEW
// ═══════════════════════════════════════════════════════════════
function VouchersView({ vouchers }) {
  return (
    <div>
      {vouchers.map(v => (
        <div key={v.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #EBEBEB', padding: 16, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ padding: '8px 14px', borderRadius: 10, background: '#FEF3C7', fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: GOLD, letterSpacing: 1 }}>{v.code}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{fmtPrice(v.original_amount)} voucher</div>
            <div style={{ fontSize: 11, color: '#888' }}>Remaining: {fmtPrice(v.remaining_amount)} · From: {v.purchased_by?.name || '—'} · To: {v.recipient?.name || '—'}</div>
            <div style={{ fontSize: 10, color: '#BBB' }}>Expires: {fmtDate(v.expires_at)}</div>
          </div>
          <StatusBadge status={v.status} />
        </div>
      ))}
      {vouchers.length === 0 && <div style={{ padding: 60, textAlign: 'center', color: '#999', fontSize: 13 }}>No gift vouchers purchased yet.</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT EDITOR — animated slide panel
// ═══════════════════════════════════════════════════════════════
function ProductPanel({ data, onSave, onClose }) {
  const [form, setForm] = useState({ ...data })
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { requestAnimationFrame(() => setShow(true)) }, [])
  const handleClose = () => { setShow(false); setTimeout(onClose, 250) }

  const handleSave = async () => {
    if (!form.name?.trim()) return alert('Product name required')
    setSaving(true)
    try {
      await onSave({
        ...form,
        price: parseFloat(form.price) || 0,
        compare_at_price: parseFloat(form.compare_at_price) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        stock: parseInt(form.stock) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
        tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags || [],
      })
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: show ? 'rgba(0,0,0,0.2)' : 'transparent', zIndex: 300, transition: 'background 0.25s' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, maxWidth: '95vw',
        background: '#fff', zIndex: 301, boxShadow: '-4px 0 30px rgba(0,0,0,0.1)',
        fontFamily: "'Figtree', sans-serif", display: 'flex', flexDirection: 'column',
        transform: show ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.25s ease-out',
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #EBEBEB', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={handleClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #EBEBEB', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={16} color="#666" />
          </button>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0 }}>{data.id ? 'Edit Product' : 'Add Product'}</h3>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><Label>Product Name</Label><Input value={form.name} onChange={v => set('name', v)} placeholder="e.g. Dermalogica Daily Microfoliant" /></div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><Label>Price (£)</Label><Input type="number" value={form.price} onChange={v => set('price', v)} placeholder="0.00" /></div>
            <div><Label>Compare At (£)</Label><Input type="number" value={form.compare_at_price || ''} onChange={v => set('compare_at_price', v)} placeholder="Was price" /></div>
          </div>

          <div><Label>Description</Label><TextArea value={form.description} onChange={v => set('description', v)} placeholder="Product description..." rows={3} /></div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><Label>Category</Label><Input value={form.category} onChange={v => set('category', v)} placeholder="e.g. Skincare" /></div>
            <div><Label>Subcategory</Label><Input value={form.subcategory || ''} onChange={v => set('subcategory', v)} placeholder="e.g. Serums" /></div>
          </div>

          <div><Label>Type</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['physical', 'digital', 'voucher', 'package', 'course'].map(t => (
                <Pill key={t} active={form.type === t} onClick={() => set('type', t)}>{t}</Pill>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={v => set('stock', v)} placeholder="0" /></div>
            <div><Label>Low Stock Alert</Label><Input type="number" value={form.low_stock_threshold || 5} onChange={v => set('low_stock_threshold', v)} /></div>
            <div><Label>Cost Price (£)</Label><Input type="number" value={form.cost_price || ''} onChange={v => set('cost_price', v)} placeholder="0.00" /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><Label>SKU</Label><Input value={form.sku || ''} onChange={v => set('sku', v)} placeholder="SKU-001" /></div>
            <div><Label>Barcode</Label><Input value={form.barcode || ''} onChange={v => set('barcode', v)} placeholder="EAN / UPC" /></div>
          </div>

          <div><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={v => set('tags', v)} placeholder="skincare, serum, bestseller" /></div>

          <div><Label>Status</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['active', 'draft', 'archived'].map(s => (
                <Pill key={s} active={form.status === s} onClick={() => set('status', s)}>{s}</Pill>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.track_stock} onChange={e => set('track_stock', e.target.checked)} /> Track stock
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.visible_online} onChange={e => set('visible_online', e.target.checked)} /> Visible online
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.shipping_required} onChange={e => set('shipping_required', e.target.checked)} /> Needs shipping
            </label>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #EBEBEB', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={handleClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5E5', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif", color: '#555' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif", opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : data.id ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// DISCOUNT EDITOR — animated slide panel
// ═══════════════════════════════════════════════════════════════
function DiscountPanel({ data, onSave, onClose }) {
  const [form, setForm] = useState({ ...data })
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { requestAnimationFrame(() => setShow(true)) }, [])
  const handleClose = () => { setShow(false); setTimeout(onClose, 250) }

  const handleSave = async () => {
    if (!form.code?.trim()) return alert('Discount code required')
    if (!form.value) return alert('Discount value required')
    setSaving(true)
    try {
      await onSave({
        ...form,
        code: form.code.toUpperCase().replace(/\s/g, ''),
        value: parseFloat(form.value) || 0,
        min_spend: parseFloat(form.min_spend) || null,
        max_uses: parseInt(form.max_uses) || null,
      })
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: show ? 'rgba(0,0,0,0.2)' : 'transparent', zIndex: 300, transition: 'background 0.25s' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '95vw',
        background: '#fff', zIndex: 301, boxShadow: '-4px 0 30px rgba(0,0,0,0.1)',
        fontFamily: "'Figtree', sans-serif", display: 'flex', flexDirection: 'column',
        transform: show ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.25s ease-out',
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #EBEBEB', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={handleClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #EBEBEB', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={16} color="#666" />
          </button>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0 }}>Create Discount Code</h3>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><Label>Discount Code</Label><Input value={form.code} onChange={v => set('code', v)} placeholder="e.g. SUMMER20" style={{ fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1 }} /></div>

          <div><Label>Type</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              <Pill active={form.type === 'percentage'} onClick={() => set('type', 'percentage')}>Percentage (%)</Pill>
              <Pill active={form.type === 'fixed'} onClick={() => set('type', 'fixed')}>Fixed Amount (£)</Pill>
            </div>
          </div>

          <div><Label>{form.type === 'percentage' ? 'Percentage Off' : 'Amount Off (£)'}</Label>
            <Input type="number" value={form.value} onChange={v => set('value', v)} placeholder={form.type === 'percentage' ? 'e.g. 15' : 'e.g. 10.00'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><Label>Min Spend (£)</Label><Input type="number" value={form.min_spend} onChange={v => set('min_spend', v)} placeholder="No minimum" /></div>
            <div><Label>Max Uses</Label><Input type="number" value={form.max_uses} onChange={v => set('max_uses', v)} placeholder="Unlimited" /></div>
          </div>

          <div><Label>Applies To</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              <Pill active={form.applies_to === 'all'} onClick={() => set('applies_to', 'all')}>All Products</Pill>
              <Pill active={form.applies_to === 'category'} onClick={() => set('applies_to', 'category')}>Category</Pill>
            </div>
          </div>

          {form.applies_to === 'category' && (
            <div><Label>Category Name</Label><Input value={form.category || ''} onChange={v => set('category', v)} placeholder="e.g. Amatus Skincare" /></div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #EBEBEB', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={handleClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5E5', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif", color: '#555' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif", opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Creating...' : 'Create Discount'}
          </button>
        </div>
      </div>
    </>
  )
}
