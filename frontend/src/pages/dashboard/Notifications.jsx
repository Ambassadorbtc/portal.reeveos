/**
 * Notifications — Activity feed from bookings, orders, reviews, staff
 * Wired to /notifications/business/{bid}
 */
import { useState, useEffect, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import {
  Bell, Calendar, ShoppingBag, Star, User, XCircle, AlertTriangle,
  RefreshCw, Inbox, Check, ChevronDown
} from 'lucide-react'

const ICON_MAP = {
  calendar: { Icon: Calendar, bg: 'bg-blue-50', color: 'text-blue-600' },
  'shopping-bag': { Icon: ShoppingBag, bg: 'bg-purple-50', color: 'text-purple-600' },
  star: { Icon: Star, bg: 'bg-amber-50', color: 'text-amber-600' },
  user: { Icon: User, bg: 'bg-emerald-50', color: 'text-emerald-600' },
  'x-circle': { Icon: XCircle, bg: 'bg-red-50', color: 'text-red-600' },
  'alert-triangle': { Icon: AlertTriangle, bg: 'bg-orange-50', color: 'text-orange-600' },
}

const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'booking', label: 'Bookings' },
  { key: 'order', label: 'Orders' },
  { key: 'review', label: 'Reviews' },
  { key: 'staff', label: 'Staff' },
]

const Notifications = () => {
  const { business } = useBusiness()
  const bid = business?.id ?? business?._id
  const [notifications, setNotifications] = useState([])
  const [grouped, setGrouped] = useState({ today: [], yesterday: [], earlier: [] })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [dismissed, setDismissed] = useState(new Set())

  const load = useCallback(async () => {
    if (!bid) return
    try {
      setLoading(true)
      const res = await api.get(`/notifications/business/${bid}?days=14&limit=100`)
      setNotifications(res.notifications || [])
      setGrouped(res.grouped || { today: [], yesterday: [], earlier: [] })
    } catch (e) {
      console.error('Failed to load notifications:', e)
    } finally {
      setLoading(false)
    }
  }, [bid])

  useEffect(() => { load() }, [load])

  const dismiss = (id) => setDismissed(prev => new Set([...prev, id]))

  const filterNotifs = (list) => {
    let filtered = list.filter(n => !dismissed.has(n.id))
    if (filter !== 'all') filtered = filtered.filter(n => n.type === filter)
    return filtered
  }

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  const renderItem = (n) => {
    const iconCfg = ICON_MAP[n.icon] || ICON_MAP.calendar
    const IconComp = iconCfg.Icon
    return (
      <div key={n.id} className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-all group">
        <div className={`w-9 h-9 rounded-xl ${iconCfg.bg} flex items-center justify-center shrink-0`}>
          <IconComp size={16} className={iconCfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 font-medium leading-snug">{n.text}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{formatTime(n.time)}</p>
        </div>
        <button onClick={() => dismiss(n.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-gray-200 text-gray-400 transition-all">
          <Check size={14} />
        </button>
      </div>
    )
  }

  const renderSection = (title, items) => {
    const filtered = filterNotifs(items)
    if (filtered.length === 0) return null
    return (
      <div key={title} className="mb-6">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">{title}</h3>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] divide-y divide-gray-50">
          {filtered.map(renderItem)}
        </div>
      </div>
    )
  }

  if (loading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gray-200 border-t-[#111111] rounded-full" />
      </div>
    )
  }

  const totalVisible = filterNotifs(notifications).length

  return (
    <div className="space-y-6" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#111111]/5 flex items-center justify-center">
            <Bell size={18} className="text-[#111111]" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Notifications</h2>
            <p className="text-xs text-gray-400">{totalVisible} {filter === 'all' ? 'total' : filter} notification{totalVisible !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {TYPE_FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${
              filter === f.key
                ? 'bg-[#111111] text-white shadow-lg shadow-[#111111]/20'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {totalVisible === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Inbox size={48} className="text-gray-200 mb-4" />
          <p className="text-sm font-bold text-gray-400">No notifications</p>
          <p className="text-xs text-gray-300 mt-1">Activity from bookings, orders, and reviews will appear here</p>
        </div>
      )}

      {/* Grouped sections */}
      {renderSection('Today', grouped.today)}
      {renderSection('Yesterday', grouped.yesterday)}
      {renderSection('Earlier', grouped.earlier)}
    </div>
  )
}

export default Notifications
