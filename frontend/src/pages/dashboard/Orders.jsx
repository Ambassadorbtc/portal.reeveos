/**
 * Orders — Delivery/takeaway orders (Restaurant mode)
 * Fully branded with Rezvo UI — Lucide icons, pill tabs, pill buttons
 */
import { useState } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import { Package, Truck, ShoppingBag, MapPin, CircleDot, Flame, CheckCircle2, XCircle } from 'lucide-react'

const DEMO_ORDERS = [
  { id: 'ORD-001', customer: 'Alex M.', items: ['Smashed Burger x2', 'Loaded Fries'], total: 32.97, status: 'preparing', type: 'delivery', time: '12:30 PM', address: '14 High St, NG1 2EN' },
  { id: 'ORD-002', customer: 'Lisa K.', items: ['Double Stack', 'Milkshake'], total: 21.98, status: 'ready', type: 'collection', time: '12:45 PM' },
  { id: 'ORD-003', customer: 'Tom B.', items: ['Chicken Wings x2', 'Brownie Sundae'], total: 25.48, status: 'delivered', type: 'delivery', time: '11:15 AM', address: '8 Park Row, NG1 6GR' },
  { id: 'ORD-004', customer: 'Sarah P.', items: ['Smashed Burger', 'Loaded Fries', 'Milkshake'], total: 25.97, status: 'new', type: 'delivery', time: '12:55 PM', address: '22 Castle Blvd, NG7 1FB' },
]

const STATUS_MAP = {
  new: { label: 'New', Icon: CircleDot, pillBg: 'bg-blue-50 text-blue-700' },
  preparing: { label: 'Preparing', Icon: Flame, pillBg: 'bg-amber-50 text-amber-700' },
  ready: { label: 'Ready', Icon: CheckCircle2, pillBg: 'bg-emerald-50 text-emerald-700' },
  delivered: { label: 'Delivered', Icon: Package, pillBg: 'bg-gray-100 text-gray-500' },
  cancelled: { label: 'Cancelled', Icon: XCircle, pillBg: 'bg-red-50 text-red-600' },
}

const Orders = () => {
  const { businessType } = useBusiness()
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'all' ? DEMO_ORDERS : DEMO_ORDERS.filter(o => o.status === filter)

  return (
    <div className="space-y-6" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Filter Pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {['all', 'new', 'preparing', 'ready', 'delivered'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${
              filter === f
                ? 'bg-[#111111] text-white shadow-lg shadow-[#111111]/20'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}>
            {f === 'all' ? 'All Orders' : STATUS_MAP[f]?.label}
          </button>
        ))}
      </div>

      {/* Order Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(o => {
          const s = STATUS_MAP[o.status] || STATUS_MAP.new
          const StatusIcon = s.Icon
          return (
            <div key={o.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_-5px_rgba(17,17,17,0.08)] transition-all">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-gray-900">{o.id}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${s.pillBg}`}>
                      <StatusIcon className="w-3 h-3" /> {s.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-medium mt-1">{o.customer} · {o.time}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  o.type === 'delivery' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                }`}>
                  {o.type === 'delivery' ? <Truck className="w-3 h-3" /> : <ShoppingBag className="w-3 h-3" />}
                  {o.type === 'delivery' ? 'Delivery' : 'Collection'}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-3 mb-3">
                {o.items.map((item, i) => <p key={i} className="text-sm font-medium text-gray-700">{item}</p>)}
                {o.address && (
                  <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{o.address}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-extrabold text-gray-900">£{o.total.toFixed(2)}</span>
                {o.status === 'new' && (
                  <button className="px-4 py-1.5 text-xs font-bold text-white bg-[#111111] rounded-full hover:bg-[#1a1a1a] shadow-lg shadow-[#111111]/20 transition-all">Accept</button>
                )}
                {o.status === 'preparing' && (
                  <button className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-500 rounded-full hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all">Mark Ready</button>
                )}
                {o.status === 'ready' && (
                  <button className="px-4 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 shadow-sm transition-all">Complete</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Orders
