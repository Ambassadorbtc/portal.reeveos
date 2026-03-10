/**
 * Notifications — wired to real backend
 * GET /notifications/business/{bid}
 * PUT /{id}/read, PUT /business/{bid}/read-all, PUT /{id}/dismiss
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import { Bell, CheckCheck, Search, AlertTriangle, Clock, Receipt, Star, MessageSquare, Calendar, Loader2, Trash2 } from 'lucide-react'

const CATEGORY_ICONS = {
  bookings:  { Icon: Calendar,       iconBg: 'bg-blue-100 text-blue-600' },
  orders:    { Icon: Receipt,         iconBg: 'bg-green-100 text-green-600' },
  reviews:   { Icon: Star,            iconBg: 'bg-yellow-100 text-yellow-600' },
  system:    { Icon: AlertTriangle,   iconBg: 'bg-gray-100 text-gray-600' },
  payments:  { Icon: Receipt,         iconBg: 'bg-emerald-100 text-emerald-600' },
  waitlist:  { Icon: Clock,           iconBg: 'bg-purple-100 text-purple-600' },
}

const PRIORITY_BAR = {
  urgent: 'bg-red-500',
  normal: 'bg-[#C9A84C]',
  low:    'bg-gray-300',
}

const Notifications = () => {
  const navigate = useNavigate()
  const { business, loading: bizLoading } = useBusiness()
  const bid = business?.id ?? business?._id
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [dismissed, setDismissed] = useState(new Set())

  const fetchNotifications = useCallback(async (showLoader = true) => {
    if (!bid) return
    if (showLoader) setLoading(true)
    try {
      const data = await api.get(`/notifications/business/${bid}?limit=100&hours_back=4320`)
      let notifs = data.notifications || []
      
      // If no notifications exist, generate from recent bookings
      if (notifs.length === 0) {
        try {
          const bkData = await api.get(`/bookings/business/${bid}?limit=50&status=all`)
          const bks = bkData.bookings || []
          notifs = bks.map(b => ({
            id: b.id || b._id,
            category: 'bookings',
            title: `Booking ${b.status || 'confirmed'}`,
            message: `${b.customerName || b.customer_name || 'Client'} — ${b.service || b.serviceName || b.service_name || 'Appointment'}`,
            created_at: b.createdAt || b.created_at || b.date,
            read: b.status === 'completed' || b.status === 'cancelled',
            priority: b.status === 'pending' ? 'urgent' : 'normal',
          }))
        } catch {}
      }
      
      setNotifications(notifs)
      setUnreadCount(data.unread_count || notifs.filter(n => !n.read).length)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
    setLoading(false)
  }, [bid])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])
  // Poll every 30s
  useEffect(() => {
    if (!bid) return
    const interval = setInterval(() => fetchNotifications(false), 30000)
    return () => clearInterval(interval)
  }, [bid, fetchNotifications])

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {}
  }

  const markAllRead = async () => {
    if (!bid) return
    try {
      await api.put(`/notifications/business/${bid}/read-all`)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {}
  }

  const dismiss = async (id) => {
    try {
      await api.put(`/notifications/${id}/dismiss`)
      setDismissed(prev => new Set([...prev, id]))
    } catch {}
  }

  // Group by day
  const groupByDay = (items) => {
    const groups = {}
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    for (const n of items) {
      if (dismissed.has(n._id)) continue
      const d = new Date(n.created_at).toDateString()
      const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : new Date(n.created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
      if (!groups[label]) groups[label] = []
      groups[label].push(n)
    }
    return groups
  }

  const filtered = activeTab === 'all' ? notifications
    : activeTab === 'unread' ? notifications.filter(n => !n.read)
    : notifications.filter(n => n.category === activeTab)

  const grouped = groupByDay(filtered)
  const tabs = [
    { id: 'all', label: 'All', count: notifications.filter(n => !dismissed.has(n._id)).length },
    { id: 'unread', label: 'Unread', count: unreadCount },
    { id: 'bookings', label: 'Bookings' },
    { id: 'orders', label: 'Orders' },
    { id: 'system', label: 'System' },
  ]

  if (bizLoading || !business) {
    return (
      <div className="flex items-center justify-center h-64" style={{ fontFamily: "'Figtree', sans-serif" }}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-gray-900" />
          <h2 className="text-lg font-extrabold text-gray-900">Notifications</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all">
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${
              activeTab === t.id ? 'bg-[#111111] text-white shadow-lg shadow-[#111111]/20' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}>
            {t.label}{t.count != null ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && Object.keys(grouped).length === 0 && (
        <div className="text-center py-20">
          <Bell className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-semibold text-sm">
            {activeTab === 'unread' ? 'All caught up — no unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-gray-300 text-xs mt-1">Booking confirmations, order alerts, and system events will appear here</p>
        </div>
      )}

      {/* Notification Groups */}
      {!loading && Object.entries(grouped).map(([day, items]) => (
        <div key={day}>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{day}</h3>
          <div className="space-y-2">
            {items.map(n => {
              const cat = CATEGORY_ICONS[n.category] || CATEGORY_ICONS.system
              const CatIcon = cat.Icon
              const bar = PRIORITY_BAR[n.priority] || PRIORITY_BAR.normal
              const timeAgo = getTimeAgo(n.created_at)

              return (
                <div key={n._id}
                  onClick={() => { if (!n.read) markRead(n._id); if (n.link) navigate(n.link) }}
                  className={`relative flex gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                    n.read ? 'bg-white border-gray-100' : 'bg-blue-50/30 border-blue-100 shadow-sm'
                  } hover:shadow-md`}>
                  {/* Priority bar */}
                  <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${bar}`} />

                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cat.iconBg}`}>
                    <CatIcon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-bold ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>{n.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[11px] font-medium ${n.read ? 'text-gray-400' : 'text-blue-600'}`}>{timeAgo}</span>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                      </div>
                    </div>
                    {n.body && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}

                    {/* Priority badge */}
                    {n.priority === 'urgent' && (
                      <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 rounded-full">Urgent</span>
                    )}
                  </div>

                  {/* Dismiss */}
                  <button onClick={(e) => { e.stopPropagation(); dismiss(n._id) }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-gray-100 transition-all self-start">
                    <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function getTimeAgo(dateStr) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMin = Math.floor((now - then) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}

export default Notifications
