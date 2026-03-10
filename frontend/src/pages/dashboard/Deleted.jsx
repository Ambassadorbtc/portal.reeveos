/**
 * Deleted.jsx — Recovery & Audit Trail
 * 4 tabs: Deleted Products, Deleted Services, Deleted Appointments, Archive
 */
import { useState, useEffect, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import AppLoader from '../../components/shared/AppLoader'
import { Package, Scissors, CalendarX2, Archive, RotateCcw, Trash2 } from 'lucide-react'

const TABS = [
  { id: 'products', label: 'Deleted Products', Icon: Package },
  { id: 'services', label: 'Deleted Services', Icon: Scissors },
  { id: 'appointments', label: 'Deleted Appointments', Icon: CalendarX2 },
  { id: 'archive', label: 'Archive', Icon: Archive },
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
  const [services, setServices] = useState([])
  const [bookings, setBookings] = useState([])
  const [archived, setArchived] = useState([])
  const [restoring, setRestoring] = useState(null)

  const load = useCallback(async () => {
    if (!bid) { setLoading(false); return }
    try {
      const [prodRes, bookRes, svcRes] = await Promise.allSettled([
        api.get(`/shop/business/${bid}/products?include_deleted=true`),
        api.get(`/bookings/business/${bid}?status=cancelled&limit=100`),
        api.get(`/services-v2/business/${bid}`),
      ])
      if (prodRes.status === 'fulfilled') {
        const allProds = prodRes.value?.products || prodRes.value || []
        setProducts(allProds.filter(p => p.status === 'archived' || p.status === 'deleted' || p.deleted === true))
      }
      if (bookRes.status === 'fulfilled') {
        setBookings((bookRes.value?.bookings || bookRes.value || []).filter(b => b.status === 'cancelled'))
      }
      if (svcRes.status === 'fulfilled') {
        const cats = svcRes.value?.categories || []
        const allSvcs = cats.flatMap(c => (c.services || []).map(s => ({ ...s, category: c.name })))
        setServices(allSvcs.filter(s => s.status === 'archived' || s.status === 'deleted' || s.active === false))
      }
      // Archive = everything combined
      const allArchived = [
        ...(prodRes.status === 'fulfilled' ? (prodRes.value?.products || prodRes.value || []).filter(p => p.status === 'archived' || p.deleted === true).map(p => ({ ...p, _type: 'product' })) : []),
        ...(bookRes.status === 'fulfilled' ? (bookRes.value?.bookings || bookRes.value || []).filter(b => b.status === 'cancelled').map(b => ({ ...b, _type: 'booking' })) : []),
      ]
      setArchived(allArchived)
    } catch (e) { console.error('Deleted load error:', e) }
    setLoading(false)
  }, [bid])

  useEffect(() => { load() }, [load])

  const restoreProduct = async (id) => {
    setRestoring(id)
    try {
      await api.put(`/shop/business/${bid}/products/${id}`, { status: 'active', deleted: false })
      load()
    } catch (e) { console.error('Restore error:', e) }
    setRestoring(null)
  }

  if (loading) return <AppLoader message="Loading deleted items..." />

  const EmptyState = ({ Icon: EIcon, title, desc }) => (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <EIcon size={24} color="#CCC" />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#888' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#BBB', marginTop: 4 }}>{desc}</div>
    </div>
  )

  const ItemRow = ({ icon: RIcon, iconBg, iconColor, title, sub, detail, badge, badgeColor, action }) => (
    <div style={{ background: '#FAFAFA', borderRadius: 12, padding: 16, border: '1px solid #EBEBEB', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <RIcon size={18} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#888' }}>{sub}</div>
        {detail && <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>{detail}</div>}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: badgeColor + '15', color: badgeColor, flexShrink: 0 }}>{badge}</span>
      {action}
    </div>
  )

  const RestoreBtn = ({ onClick, loading: ld }) => (
    <button onClick={onClick} disabled={ld} style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8,
      border: '1px solid #E5E5E5', background: '#fff', fontSize: 11, fontWeight: 600,
      color: '#111', cursor: 'pointer', fontFamily: "'Figtree', sans-serif",
      opacity: ld ? 0.5 : 1, flexShrink: 0,
    }}>
      <RotateCcw size={12} /> {ld ? 'Restoring...' : 'Restore'}
    </button>
  )

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
            <div style={{ fontSize: 12, color: '#888' }}>Recover deleted items and view audit trail</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              border: 'none', borderBottom: tab === t.id ? '2px solid #111' : '2px solid transparent',
              background: 'none', color: tab === t.id ? '#111' : '#999',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif",
              transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}>
              <t.Icon size={14} /> {t.label}
              <span style={{
                fontSize: 9, fontWeight: 700, borderRadius: 6, padding: '1px 6px',
                background: tab === t.id ? '#111' : '#E5E5E5',
                color: tab === t.id ? '#fff' : '#888',
              }}>
                {t.id === 'products' ? products.length : t.id === 'services' ? services.length : t.id === 'appointments' ? bookings.length : archived.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* DELETED PRODUCTS */}
        {tab === 'products' && (
          products.length === 0
            ? <EmptyState Icon={Package} title="No deleted products" desc="When you archive a product from the Shop, it will appear here for recovery." />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {products.map(p => (
                  <ItemRow key={p.id || p._id}
                    icon={Package} iconBg="#F5F5F5" iconColor="#888"
                    title={p.name} sub={`${p.category || 'Uncategorised'} · £${(p.price || 0).toFixed(2)}`}
                    detail={p.updated_at ? `Archived ${fmtDate(p.updated_at)}` : null}
                    badge="Archived" badgeColor="#9CA3AF"
                    action={<RestoreBtn onClick={() => restoreProduct(p.id || p._id)} loading={restoring === (p.id || p._id)} />}
                  />
                ))}
              </div>
        )}

        {/* DELETED SERVICES */}
        {tab === 'services' && (
          services.length === 0
            ? <EmptyState Icon={Scissors} title="No deleted services" desc="When you deactivate or archive a service, it will appear here." />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {services.map((s, i) => (
                  <ItemRow key={s.id || s._id || i}
                    icon={Scissors} iconBg="#FDF2F8" iconColor="#EC4899"
                    title={s.name} sub={`${s.category || 'Uncategorised'} · ${s.duration || s.duration_minutes || '—'} min`}
                    detail={s.price ? `£${(s.price || 0).toFixed(2)}` : null}
                    badge="Inactive" badgeColor="#F59E0B"
                  />
                ))}
              </div>
        )}

        {/* DELETED APPOINTMENTS */}
        {tab === 'appointments' && (
          bookings.length === 0
            ? <EmptyState Icon={CalendarX2} title="No cancelled appointments" desc="Cancelled bookings will appear here as an audit trail." />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bookings.map(b => (
                  <ItemRow key={b.id || b._id}
                    icon={CalendarX2} iconBg="#FEF2F2" iconColor="#EF4444"
                    title={b.customer_name || b.customerName || 'Unknown'}
                    sub={`${b.service_name || b.service || b.serviceName || 'Service'} · ${fmtDate(b.date || b.booking_date)}`}
                    detail={b.staff_name || b.staffName ? `Staff: ${b.staff_name || b.staffName}` : null}
                    badge="Cancelled" badgeColor="#EF4444"
                  />
                ))}
              </div>
        )}

        {/* ARCHIVE — everything */}
        {tab === 'archive' && (
          archived.length === 0
            ? <EmptyState Icon={Archive} title="Archive is empty" desc="All archived and deleted items across products and bookings appear here." />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {archived.map((item, i) => (
                  <ItemRow key={item.id || item._id || i}
                    icon={item._type === 'product' ? Package : CalendarX2}
                    iconBg={item._type === 'product' ? '#F5F5F5' : '#FEF2F2'}
                    iconColor={item._type === 'product' ? '#888' : '#EF4444'}
                    title={item._type === 'product' ? item.name : (item.customer_name || item.customerName || 'Unknown')}
                    sub={item._type === 'product'
                      ? `Product · £${(item.price || 0).toFixed(2)}`
                      : `Appointment · ${item.service_name || item.service || item.serviceName || 'Service'}`}
                    detail={fmtDate(item.updated_at || item.date || item.booking_date)}
                    badge={item._type === 'product' ? 'Product' : 'Booking'}
                    badgeColor={item._type === 'product' ? '#6366F1' : '#EF4444'}
                    action={item._type === 'product'
                      ? <RestoreBtn onClick={() => restoreProduct(item.id || item._id)} loading={restoring === (item.id || item._id)} />
                      : null}
                  />
                ))}
              </div>
        )}
      </div>
    </div>
  )
}
