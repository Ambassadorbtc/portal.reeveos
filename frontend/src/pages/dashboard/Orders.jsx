/**
 * Orders — Delivery/takeaway orders (for restaurants using Uber Direct)
 */

import { useState } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'

const STATUS_STYLES = {
  new: { label: 'New', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  preparing: { label: 'Preparing', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  ready: { label: 'Ready', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  collected: { label: 'Collected', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  delivered: { label: 'Delivered', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

const Orders = () => {
  const { business, businessType } = useBusiness()
  const [filter, setFilter] = useState('all')

  const demoOrders = [
    { id: 'ORD-001', customer: 'John Smith', items: '2x Ribeye Steak, 1x Garlic Bread', total: '£56.50', type: 'Delivery', status: 'new', time: '2 mins ago' },
    { id: 'ORD-002', customer: 'Sarah Johnson', items: '1x Grilled Salmon, 1x Soup of the Day', total: '£25.00', type: 'Collection', status: 'preparing', time: '15 mins ago' },
    { id: 'ORD-003', customer: 'Mike Brown', items: '3x Chocolate Fondant', total: '£25.50', type: 'Delivery', status: 'ready', time: '22 mins ago' },
    { id: 'ORD-004', customer: 'Emma Wilson', items: '1x Ribeye Steak, 2x Garlic Bread', total: '£35.00', type: 'Delivery', status: 'delivered', time: '1 hour ago' },
  ]

  const filters = ['all', 'new', 'preparing', 'ready', 'delivered', 'cancelled']
  const filtered = filter === 'all' ? demoOrders : demoOrders.filter(o => o.status === filter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage delivery and collection orders.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-200 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Accepting Orders
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap border transition-colors ${filter === f ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-border hover:border-primary hover:text-primary'}`}>
            {f === 'all' ? 'All Orders' : STATUS_STYLES[f]?.label || f}
          </button>
        ))}
      </div>

      {/* Live Orders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(order => {
          const ss = STATUS_STYLES[order.status] || STATUS_STYLES.new
          return (
            <div key={order.id} className="bg-white border border-border rounded-xl shadow-sm p-5 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold text-gray-400">{order.id}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${ss.bg} ${ss.text} border ${ss.border}`}>{ss.label}</span>
              </div>
              <h3 className="font-bold text-primary mb-1">{order.customer}</h3>
              <p className="text-xs text-gray-500 mb-3">{order.items}</p>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${order.type === 'Delivery' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                    <i className={`fa-solid ${order.type === 'Delivery' ? 'fa-truck' : 'fa-bag-shopping'} mr-1`} />{order.type}
                  </span>
                  <span className="text-[10px] text-gray-400">{order.time}</span>
                </div>
                <span className="font-bold text-primary text-sm">{order.total}</span>
              </div>
              {(order.status === 'new' || order.status === 'preparing') && (
                <button className="w-full mt-3 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover transition-colors">
                  {order.status === 'new' ? 'Accept Order' : 'Mark Ready'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Orders
