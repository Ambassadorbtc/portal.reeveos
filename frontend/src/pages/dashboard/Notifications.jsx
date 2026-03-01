/**
 * Notifications — matching UXPilot 10-Design App - Notifications.html
 * Grouped by day, unread highlighting, action buttons, left colour bars
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Search, Calendar, ChevronDown, AlertTriangle, Clock, Receipt, Star, Server, MessageSquare, ArrowRight, Eye, Reply } from 'lucide-react'

const TABS = [
  { id: 'all', label: 'All', count: 12 },
  { id: 'unread', label: 'Unread', count: 3 },
  { id: 'bookings', label: 'Bookings' },
  { id: 'waitlist', label: 'Waitlist' },
  { id: 'system', label: 'System' },
]

const DEMO_NOTIFICATIONS = {
  today: [
    {
      id: 1, unread: true, priority: 'urgent',
      icon: <AlertTriangle className="w-5 h-5" />, iconBg: 'bg-red-100 text-red-600',
      barColor: 'bg-[#D4A373]',
      title: 'Urgent: Kitchen Printer Offline',
      body: 'The thermal printer in the main kitchen station is not responding. Orders may be delayed.',
      time: '2 min ago', timeColor: 'text-[#D4A373]',
      actions: [
        { label: 'Check Settings', style: 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20' },
        { label: 'Dismiss', style: 'text-gray-500 hover:text-gray-900' },
      ],
    },
    {
      id: 2, unread: true,
      avatar: 'SW',
      barColor: 'bg-emerald-500',
      title: 'New Reservation Request',
      body: <>
        <span className="font-semibold text-gray-800">Sarah Williams</span> requested a table for{' '}
        <span className="font-semibold text-gray-800">6 people</span> on{' '}
        <span className="font-semibold text-gray-800">Feb 28 at 7:00 PM</span>.
      </>,
      time: '15 min ago', timeColor: 'text-emerald-600',
      tags: [{ label: '🎂 Birthday', bg: 'bg-blue-50 text-blue-700 border-blue-100' }],
      actions: [
        { label: 'Accept', style: 'bg-[#111111] hover:bg-[#1a1a1a] text-white shadow-lg shadow-[#111111]/20' },
        { label: 'Decline', style: 'bg-white border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-500' },
      ],
    },
    {
      id: 3, unread: true,
      icon: <Clock className="w-5 h-5" />, iconBg: 'bg-blue-100 text-blue-600',
      title: 'Waitlist Alert: Table Ready',
      body: <>
        <span className="font-semibold text-gray-800">Table 05</span> is now available for the{' '}
        <span className="font-semibold text-gray-800">Miller Party (4 ppl)</span>. Wait time exceeded by 5 mins.
      </>,
      time: '24 min ago', timeColor: 'text-emerald-600',
      link: { label: 'View Waitlist', href: '/dashboard/bookings' },
    },
    {
      id: 4,
      icon: <Receipt className="w-5 h-5" />, iconBg: 'bg-green-100 text-green-600',
      title: 'Deposit Received',
      body: <>
        Payment of <span className="font-semibold text-gray-700">£50.00</span> received from{' '}
        <span className="font-semibold text-gray-700">James Anderson</span> for booking #8823.
      </>,
      time: '2 hours ago',
    },
  ],
  yesterday: [
    {
      id: 5,
      icon: <Star className="w-5 h-5" />, iconBg: 'bg-yellow-100 text-yellow-600',
      title: 'New 5-Star Review',
      body: '"Amazing service and the food was spectacular! Will definitely come back." — via Google Reviews',
      time: 'Yesterday, 9:30 PM',
    },
    {
      id: 6,
      icon: <Server className="w-5 h-5" />, iconBg: 'bg-gray-100 text-gray-600',
      title: 'System Maintenance Completed',
      body: 'Scheduled maintenance was successfully completed. Rezvo is now running the latest version.',
      time: 'Yesterday, 4:00 AM',
      link: { label: 'See Release Notes', href: '#' },
    },
    {
      id: 7,
      avatar: 'MR',
      title: 'Mentioned in Booking Note',
      body: <>
        <span className="font-semibold text-gray-700">Mike Ross</span> mentioned you in a note for{' '}
        <span className="font-semibold text-gray-700">Table 12</span>: "Please check if we can accommodate a high chair."
      </>,
      time: 'Yesterday, 2:15 PM',
      hoverAction: 'reply',
    },
  ],
}

const AVATAR_COLORS = ['bg-amber-100 text-amber-700', 'bg-purple-100 text-purple-700', 'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-pink-100 text-pink-600']

const Notifications = () => {
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)
  const [dismissed, setDismissed] = useState([])
  const [accepted, setAccepted] = useState([])
  const navigate = useNavigate()

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const handleAction = (notifId, action) => {
    switch (action) {
      case 'Check Settings': navigate('/dashboard/settings'); break
      case 'Dismiss': setDismissed(d => [...d, notifId]); showToast('Notification dismissed'); break
      case 'Accept': setAccepted(a => [...a, notifId]); showToast('Reservation accepted ✓'); break
      case 'Decline': setDismissed(d => [...d, notifId]); showToast('Reservation declined'); break
      default: showToast(`${action} clicked`); break
    }
  }

  const renderItem = (item) => {
    if (dismissed.includes(item.id)) return null
    const isAccepted = accepted.includes(item.id)
    return (
    <div
      key={item.id}
      className={`p-5 flex gap-4 cursor-pointer group relative overflow-hidden transition-all duration-200 hover:translate-x-1 ${
        item.unread ? 'bg-green-50/60 hover:bg-green-100/60' : 'opacity-75 hover:opacity-100'
      }`}
    >
      {item.barColor && <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.barColor}`} />}

      {/* Icon / Avatar */}
      <div className="shrink-0 pt-1">
        {item.avatar ? (
          <div className={`w-10 h-10 rounded-full ${AVATAR_COLORS[item.id % AVATAR_COLORS.length]} font-bold text-sm flex items-center justify-center`}>
            {item.avatar}
          </div>
        ) : (
          <div className={`w-10 h-10 rounded-full ${item.iconBg} flex items-center justify-center relative`}>
            {item.icon}
            {item.unread && <div className="absolute top-0 right-0 w-3 h-3 bg-[#D4A373] rounded-full border-2 border-white" />}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1">
          <p className={`text-sm font-bold ${item.unread ? 'text-gray-900' : 'text-gray-800'}`}>{item.title}</p>
          <span className={`text-xs font-medium whitespace-nowrap ml-3 ${item.timeColor || 'text-gray-400'}`}>{item.time}</span>
        </div>
        <p className="text-sm text-gray-600">{item.body}</p>

        {item.tags && (
          <div className="flex gap-2 mt-2">
            {item.tags.map(t => (
              <span key={t.label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${t.bg}`}>{t.label}</span>
            ))}
          </div>
        )}

        {item.actions && (
          <div className="flex items-center gap-2 mt-3">
            {item.actions.map(a => (
              <button key={a.label} onClick={() => handleAction(item.id, a.label)} className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${a.style}`}>{a.label}</button>
            ))}
          </div>
        )}

        {item.link && (
          <button onClick={() => navigate(item.link.href)} className="text-xs font-bold text-primary hover:underline mt-2 flex items-center gap-1">
            {item.link.label} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Unread dot */}
      {item.unread && (
        <div className="shrink-0 self-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D4A373]" />
        </div>
      )}

      {/* Hover actions for read items */}
      {!item.unread && !item.actions && (
        <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-primary hover:bg-gray-50 transition-all shadow-sm" title={item.hoverAction === 'reply' ? 'Reply' : 'View'}>
            {item.hoverAction === 'reply' ? <Reply className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  )
  }

  // Filter dismissed notifications
  const filterDismissed = (items) => items.filter(n => !dismissed.includes(n.id))

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#111111] text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-bold animate-[slideIn_0.3s_ease-out]">
          {toast}
        </div>
      )}
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-1.5 flex-wrap">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    activeTab === t.id
                      ? 'bg-[#111111] text-white shadow-lg shadow-[#111111]/20'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {t.label}
                  {t.count != null && (
                    <span className={`ml-1.5 ${activeTab === t.id ? 'opacity-70 text-[10px]' : t.id === 'unread' ? 'px-1.5 py-0.5 rounded-full bg-[#D4A373] text-white text-[10px]' : 'opacity-60 text-[10px]'}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:border-primary hover:text-primary transition-all shadow-sm">
              <Calendar className="w-4 h-4" /> Last 30 Days <ChevronDown className="w-3 h-3 ml-1" />
            </button>
          </div>

          {/* Notification List */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
            {/* Today */}
            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-3 sticky top-0 z-10 backdrop-blur-sm">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Today</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {filterDismissed(DEMO_NOTIFICATIONS.today).map(renderItem)}
            </div>

            {/* Yesterday */}
            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-3 sticky top-0 z-10 backdrop-blur-sm mt-px">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Yesterday</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {filterDismissed(DEMO_NOTIFICATIONS.yesterday).map(renderItem)}
            </div>
          </div>

          {/* Load More */}
          <div className="mt-6 text-center">
            <button className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:text-primary hover:border-primary hover:bg-gray-50 transition-all shadow-sm">
              Load Older Notifications
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Notifications
