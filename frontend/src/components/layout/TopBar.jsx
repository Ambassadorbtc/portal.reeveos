/**
 * Run 1: Top bar — page title, date, notifications, avatar, dev toggle, hamburger
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useBusiness } from '../../contexts/BusinessContext'
import { getNavItems } from '../../config/navigation'

const PAGE_TITLES = {
  '/dashboard': 'Home Dashboard',
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

  const baseTitles = { ...PAGE_TITLES }
  if (businessType === 'restaurant') {
    baseTitles['/dashboard/calendar'] = 'Reservations Planner'
    baseTitles['/dashboard/services'] = 'Menu'
  }
  const pageTitle = baseTitles[location.pathname] || 'Dashboard'
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <header className="h-16 bg-white border-b border-border sticky top-0 z-10 flex items-center justify-between px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-4">
        {/* Hamburger (mobile) */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-primary hover:bg-border rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          <i className={`fa-solid ${sidebarOpen ? 'fa-xmark' : 'fa-bars'} text-lg`} />
        </button>

        <div>
          <h1 className="font-heading text-[22px] font-bold text-primary">
            {pageTitle}
          </h1>
          <p className="font-body text-xs text-muted">{today}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Dev toggle — remove before launch */}
        {import.meta.env.DEV && (
          <div className="hidden sm:flex items-center gap-2 pr-3 border-r border-border">
            <button
              onClick={() => setBusinessType(businessType === 'restaurant' ? 'services' : 'restaurant')}
              className="text-xs px-2 py-1 rounded bg-border text-muted hover:bg-primary hover:text-white transition-colors"
            >
              {businessType === 'restaurant' ? '🍴' : '✂️'} {businessType}
            </button>
            <button
              onClick={cycleTier}
              className="text-xs px-2 py-1 rounded bg-border text-muted hover:bg-primary hover:text-white transition-colors"
            >
              Tier: {tier}
            </button>
          </div>
        )}

        <button
          className="relative p-2 text-muted hover:text-primary hover:bg-border rounded-lg transition-colors"
          aria-label="Notifications"
        >
          <i className="fa-solid fa-bell text-lg" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3 pl-2 border-l border-border">
          <div className="w-[34px] h-[34px] rounded-full bg-primary flex items-center justify-center text-background font-semibold text-sm">
            {initials}
          </div>
          <button
            onClick={() => {
              logout?.()
              navigate('/login')
            }}
            className="hidden sm:block text-sm text-muted hover:text-primary"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopBar
