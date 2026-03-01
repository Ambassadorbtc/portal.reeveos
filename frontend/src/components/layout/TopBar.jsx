/**
 * Run 1: Top bar — page title, date, notifications, avatar, dev toggle, hamburger
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useBusiness } from '../../contexts/BusinessContext'
import { getNavItems } from '../../config/navigation'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
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
    <header className="h-16 bg-white border-b border-border sticky top-0 z-50 flex items-center justify-between px-4 lg:px-6 pr-5 lg:pr-8 shrink-0">
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
          onClick={() => navigate('/dashboard/notifications')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error" aria-hidden="true" />
        </button>

        <div className="relative flex items-center gap-3 pl-2 border-l border-border">
          <div 
            onClick={() => {
              const dd = document.getElementById('profile-dropdown')
              dd.style.display = dd.style.display === 'none' ? 'block' : 'none'
            }}
            className="w-[34px] h-[34px] rounded-full bg-primary flex items-center justify-center text-background font-semibold text-sm cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
          >
            {initials}
          </div>
          <div id="profile-dropdown" style={{ display: 'none', position: 'absolute', top: '100%', right: 0, marginTop: 8, background: '#fff', border: '1px solid #EBEBEB', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 200, width: 200, padding: 8, fontFamily: "'Figtree', sans-serif" }}>
            <div style={{ padding: '8px 12px', fontSize: 14, fontWeight: 600, color: '#111111', borderBottom: '1px solid #F5F5F5', marginBottom: 4 }}>
              {user?.name || 'User'}
              <div style={{ fontSize: 11, fontWeight: 400, color: '#666', marginTop: 2 }}>{user?.email || ''}</div>
            </div>
            <button 
              onClick={() => navigate('/dashboard/settings')}
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, color: '#374151', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: "'Figtree', sans-serif" }}
              onMouseOver={e => e.currentTarget.style.background='#F5F5F5'}
              onMouseOut={e => e.currentTarget.style.background='transparent'}
            >
              ⚙️ Settings
            </button>
            <button 
              onClick={() => { logout?.(); navigate('/login') }}
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, color: '#EF4444', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: "'Figtree', sans-serif" }}
              onMouseOver={e => e.currentTarget.style.background='#FEF2F2'}
              onMouseOut={e => e.currentTarget.style.background='transparent'}
            >
              🚪 Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopBar
