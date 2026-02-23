/**
 * TopBar — Clean minimal style matching sidebar
 * Rezvo locked brand tokens
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useBusiness } from '../../contexts/BusinessContext'
import { Bell, Menu, X, LogOut } from 'lucide-react'

const PAGE_TITLES = {
  '/dashboard': 'Overview',
  '/dashboard/calendar': 'Calendar',
  '/dashboard/bookings': 'Bookings',
  '/dashboard/booking-link': 'Booking Link',
  '/dashboard/services': 'Services',
  '/dashboard/staff': 'Staff',
  '/dashboard/online-booking': 'Online Booking',
  '/dashboard/orders': 'Orders',
  '/dashboard/clients': 'Clients',
  '/dashboard/reviews': 'Reviews',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/payments': 'Payments',
  '/dashboard/marketing': 'Marketing',
  '/dashboard/floor-plan': 'Floor Plan',
  '/dashboard/settings': 'Settings',
  '/dashboard/help': 'Help Center',
}

const TopBar = ({ onMenuClick, sidebarOpen }) => {
  const { user, logout } = useAuth()
  const { businessType, tier, setBusinessType, cycleTier } = useBusiness()
  const location = useLocation()
  const navigate = useNavigate()

  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard'
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <header className="h-16 bg-white border-b border-[#F0EDE7] sticky top-0 z-10 flex items-center justify-between px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-4">
        {/* Hamburger (mobile) */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[#7A776F] hover:text-[#1B4332] hover:bg-[#F0EDE7] transition-all"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div>
          <h1 className="text-[20px] font-bold text-[#2C2C2A] tracking-[-0.01em]">
            {pageTitle}
          </h1>
          <p className="text-[12px] text-[#7A776F] font-medium">{today}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Dev toggles */}
        {import.meta.env.DEV && (
          <div className="hidden sm:flex items-center gap-1.5 pr-3 border-r border-[#E8E4DD]">
            <button
              onClick={() => setBusinessType(businessType === 'restaurant' ? 'services' : 'restaurant')}
              className="text-[11px] px-2 py-1 rounded-md bg-[#F0EDE7] text-[#7A776F] hover:bg-[#1B4332] hover:text-[#FAF7F2] transition-colors font-medium"
            >
              {businessType === 'restaurant' ? '🍴' : '✂️'} {businessType}
            </button>
            <button
              onClick={cycleTier}
              className="text-[11px] px-2 py-1 rounded-md bg-[#F0EDE7] text-[#7A776F] hover:bg-[#1B4332] hover:text-[#FAF7F2] transition-colors font-medium"
            >
              {tier}
            </button>
          </div>
        )}

        <button
          className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#7A776F] hover:text-[#2C2C2A] hover:bg-[#F0EDE7] transition-all"
          aria-label="Notifications"
        >
          <Bell size={18} strokeWidth={1.5} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#991B1B] ring-2 ring-white" />
        </button>

        <button
          onClick={() => { logout?.(); navigate('/login') }}
          className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center text-[#7A776F] hover:text-[#2C2C2A] hover:bg-[#F0EDE7] transition-all"
          title="Log out"
        >
          <LogOut size={18} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  )
}

export default TopBar
