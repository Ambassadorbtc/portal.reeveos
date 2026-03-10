/**
 * Deleted.jsx — Archived products + Cancelled bookings audit trail
 * Two tabs: Archived Products (with Restore) and Cancelled Bookings
 */
import { useState, useEffect, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import AppLoader from '../../components/shared/AppLoader'
import { Package, CalendarX2, RotateCcw, Trash2 } from 'lucide-react'

const TABS = [
  { id: 'products', label: 'Archived Products', Icon: Package },
  { id: 'bookings', label: 'Cancelled Bookings', Icon: CalendarX2 },
]

const fmtDate = (d) => {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) }
  catch { return '—' }
}

export default function Deleted() {
  const { business } = useBusiness()
  const bid = business?.id ?? business?._id
  const [tab, setTab] = useState('products')
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [bookings, setBookings] = useState([])
  const [restoring, setRestoring] = useState(null)

  const load = useCallback(async () => {
    if (!bid) { setLoading(false); return }
    try {
      const [prodRes, bookRes] = await Promise.allSettled([
        api.get(`/shop/business/${bid}/products?include_deleted=true&status=archived`),
        api.get(`/bookings/business/${bid}?status=cancelled&limit=100`),
      ])
      if (prodRes.status === 'fulfilled') setProducts((prodRes.value?.products || prodRes.value || []).filter(p => p.status === 'archived'))
      if (bookRes.status === 'fulfilled') setBookings(bookRes.value?.bookings || bookRes.value || [])
    } catch (e) { console.error('Deleted load error:', e) }
    setLoading(false)
  }, [bid])

  useEffect(() => { load() }, [load])

  const restoreProduct = async (id) => {
    setRestoring(id)
    try {
      await api.patch(`/shop/business/${bid}/products/${id}`, { status: 'active' })
      load()
    } catch (e) { console.error('Restore error:', e) }
    setRestoring(null)
  }

  if (loading) return <AppLoader message="Loading deleted items..." />

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Figtree', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', borderBottom: '1px solid #EBEBEB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={18} color="#888" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>Deleted Items</div>
            <div style={{ fontSize: 12, color: '#888' }}>Archived products and cancelled bookings</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
              border: 'none', borderBottom: tab === t.id ? '2px solid #111' : '2px solid transparent',
              background: 'none', color: tab === t.id ? '#111' : '#999',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif",
              transition: 'all 0.2s',
            }}>
              <t.Icon size={14} /> {t.label}
              <span style={{ fontSize: 10, fontWeight: 700, background: tab === t.id ? '#111' : '#E5E5E5', color: tab === t.id ? '#fff' : '#888', borderRadius: 6, padding: '1px 6px', marginLeft: 2 }}>
                {t.id === 'products' ? products.length : bookings.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {tab === 'products' && (
          products.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Package size={24} color="#CCC" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#888' }}>No archived products</div>
              <div style={{ fontSize: 12, color: '#BBB', marginTop: 4 }}>When you archive a product from the Shop, it will appear here for recovery.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {products.map(p => (
                <div key={p.id || p._id} style={{ background: '#FAFAFA', borderRadius: 12, padding: 16, border: '1px solid #EBEBEB', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{p.name}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#F3F4F6', color: '#9CA3AF' }}>Archived</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>{p.category}{p.subcategory ? ` · ${p.subcategory}` : ''}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>£{(p.price || 0).toFixed(2)}</div>
                  {p.updated_at && <div style={{ fontSize: 11, color: '#AAA' }}>Archived {fmtDate(p.updated_at)}</div>}
                  <button onClick={() => restoreProduct(p.id || p._id)} disabled={restoring === (p.id || p._id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 8, border: '1px solid #E5E5E5', background: '#fff', fontSize: 12, fontWeight: 600, color: '#111', cursor: 'pointer', fontFamily: "'Figtree', sans-serif", marginTop: 4, opacity: restoring === (p.id || p._id) ? 0.5 : 1 }}>
                    <RotateCcw size={13} /> {restoring === (p.id || p._id) ? 'Restoring...' : 'Restore Product'}
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'bookings' && (
          bookings.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <CalendarX2 size={24} color="#CCC" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#888' }}>No cancelled bookings</div>
              <div style={{ fontSize: 12, color: '#BBB', marginTop: 4 }}>Cancelled bookings will appear here as an audit trail.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bookings.map(b => (
                <div key={b.id || b._id} style={{ background: '#FAFAFA', borderRadius: 12, padding: 16, border: '1px solid #EBEBEB', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CalendarX2 size={18} color="#EF4444" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{b.customer_name || b.customerName || 'Unknown'}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{b.service_name || b.service || 'Service'} · {fmtDate(b.date || b.booking_date)}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#FEF2F2', color: '#EF4444', flexShrink: 0 }}>Cancelled</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
