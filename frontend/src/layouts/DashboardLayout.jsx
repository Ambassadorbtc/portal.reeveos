/**
 * Run 1: Dashboard shell — sidebar + top bar + content
 */

import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useBusiness } from '../contexts/BusinessContext'
import { isFeatureUnlocked } from '../config/tiers'
import { getNavItems } from '../config/navigation'
import Sidebar from '../components/layout/Sidebar'
import TopBar from '../components/layout/TopBar'
import UpgradeModal from '../components/layout/UpgradeModal'
import { TIERS } from '../config/tiers'
import { useEffect } from 'react'

const DashboardLayout = () => {
  const { user } = useAuth()
  const { business, businessType, tier, loading } = useBusiness()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [upgradeModal, setUpgradeModal] = useState(null)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
  }, [user, navigate])

  // Route protection: if user navigates directly to a locked page
  useEffect(() => {
    const nav = getNavItems(businessType)
    const allItems = [
      ...(nav.main || []),
      ...(nav.management || []),
      ...(nav.business || []),
      ...(nav.advanced || []),
      ...(nav.system || []),
    ]
    const current = allItems.find((item) => item.path === location.pathname)
    if (current && !isFeatureUnlocked(tier, current.minTier)) {
      navigate('/dashboard')
      setUpgradeModal(TIERS[current.minTier]?.label || current.minTier)
    }
  }, [location.pathname, businessType, tier, navigate])

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B4332] mx-auto" />
          <p className="mt-4 text-[#7A776F]">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#FAF7F2]">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]">
        <TopBar
          onMenuClick={() => setSidebarOpen((o) => !o)}
          sidebarOpen={sidebarOpen}
        />
        <main className="flex-1 overflow-hidden">
          {location.pathname === '/dashboard/calendar' ? (
            <Outlet />
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="max-w-7xl mx-auto p-6 lg:p-8">
                <Outlet />
              </div>
            </div>
          )}
        </main>
      </div>

      {upgradeModal && (
        <UpgradeModal
          tierName={upgradeModal}
          onClose={() => setUpgradeModal(null)}
          onViewPlans={() => setUpgradeModal(null)}
        />
      )}
    </div>
  )
}

export default DashboardLayout
