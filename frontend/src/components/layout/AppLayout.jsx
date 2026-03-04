import AppLoader from "../shared/AppLoader"
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTier } from '../../contexts/TierContext'
import { useEffect } from 'react'
import { isPortalDomain } from '../../utils/domain'

const AppLayout = () => {
  const { user, logout } = useAuth()
  const { business, hasFeature, loading } = useTier()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!user) {
      navigate('/login')
    } else if (!isPortalDomain() && !['business_owner', 'staff', 'platform_admin', 'super_admin'].includes(user.role)) {
      navigate('/') // portal: diners go to directory
    }
  }, [user, navigate])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'home', show: true },
    { path: '/dashboard/bookings', label: 'Bookings', icon: 'calendar', show: true },
    { path: '/dashboard/calendar', label: 'Calendar', icon: 'calendar-days', show: hasFeature('calendar') },
    { path: '/dashboard/floor-plan', label: 'Floor Plan', icon: 'layout', show: hasFeature('floor_plan') },
    { path: '/dashboard/staff', label: 'Staff', icon: 'users', show: hasFeature('staff') },
    { path: '/dashboard/services', label: 'Services', icon: 'list', show: true },
    { path: '/dashboard/reviews', label: 'Reviews', icon: 'star', show: hasFeature('reviews') },
    { path: '/dashboard/analytics', label: 'Analytics', icon: 'chart', show: hasFeature('analytics') },
    { path: '/dashboard/settings', label: 'Settings', icon: 'settings', show: true }
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <AppLoader message="Loading ReeveOS..." size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-cream">
      <aside className="w-64 bg-white border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <Link to="/dashboard" className="flex items-center">
            <span className="text-2xl font-heading font-bold text-forest">ReeveOS</span>
          </Link>
          {business && (
            <div className="mt-4">
              <p className="text-sm text-text-secondary">Business</p>
              <p className="font-medium text-text">{business.name}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.filter(item => item.show).map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-forest text-white'
                    : 'text-text hover:bg-off'
                }`}
              >
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-forest-30 flex items-center justify-center">
              <span className="text-forest font-semibold">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-text">{user?.name}</p>
              <p className="text-sm text-text-secondary">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full btn-secondary text-sm"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default AppLayout
