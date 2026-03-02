import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { TierProvider } from './contexts/TierContext'
import { BusinessProvider } from './contexts/BusinessContext'
import ScrollToTop from './components/ScrollToTop'
import TenantErrorBoundary from './components/TenantErrorBoundary'

import DashboardLayout from './layouts/DashboardLayout'
import AdminLayout from './layouts/AdminLayout'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import BusinessTypeSelector from './pages/auth/BusinessTypeSelector'
import RestaurantWelcome from './pages/auth/RestaurantWelcome'

/* Customer dashboard pages */
import Dashboard from './pages/dashboard/Dashboard'
import Bookings from './pages/dashboard/Bookings'
import Calendar from './pages/dashboard/Calendar'
import FloorPlan from './pages/dashboard/FloorPlan'
import Staff from './pages/dashboard/Staff'
import Services from './pages/dashboard/Services'
import Reviews from './pages/dashboard/Reviews'
import Analytics from './pages/dashboard/Analytics'
import Settings from './pages/dashboard/Settings'
import BookingLink from './pages/dashboard/BookingLink'
import OnlineBooking from './pages/dashboard/OnlineBooking'
import Orders from './pages/dashboard/Orders'
import Clients from './pages/dashboard/Clients'
import Notifications from './pages/dashboard/Notifications'
import Marketing from './pages/dashboard/Marketing'
import Studio from './pages/dashboard/Studio'
import Payments from './pages/dashboard/Payments'
import Help from './pages/dashboard/Help'

/* EPOS pages — restaurant only */
import EposInventory from './pages/dashboard/EposInventory'
import EposKDS from './pages/dashboard/EposKDS'
import EposLabour from './pages/dashboard/EposLabour'
import EposCash from './pages/dashboard/EposCash'

/* Admin pages — internal ops only */
import AdminOverview from './pages/admin/AdminOverview'
import AdminAIOps from './pages/admin/AIOps'
import AdminOutreach from './pages/admin/EmailOutreach'
import AdminLinkedIn from './pages/admin/LinkedIn'
import AdminBusinesses from './pages/admin/AdminBusinesses'
import AdminUsers from './pages/admin/AdminUsers'
import AdminBookings from './pages/admin/AdminBookings'
import AdminDirectory from './pages/admin/AdminDirectory'
import AdminSubscriptions from './pages/admin/AdminSubscriptions'
import CommandCentre from './pages/admin/CommandCentre'
import AdminPipeline from './pages/admin/AdminPipeline'
import AdminSupport from './pages/admin/AdminSupport'
import AdminReviews from './pages/admin/AdminReviews'
import AdminChurn from './pages/admin/AdminChurn'
import AdminEmailMarketing from './pages/admin/AdminEmailMarketing'
import AdminSEO from './pages/admin/AdminSEO'
import AdminContent from './pages/admin/AdminContent'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import AdminHealth from './pages/admin/AdminHealth'
import AdminAudit from './pages/admin/AdminAudit'
import AdminErrors from './pages/admin/AdminErrors'
import AdminSettings from './pages/admin/AdminSettings'
import Library from './pages/admin/Library'

import Onboarding from './pages/onboarding/Onboarding'

/* Booking flow (public, no auth) */
import BookingFlow from './pages/booking/BookingFlow'
import BookingConfirmation from './pages/booking/BookingConfirmation'
import BookingManage from './pages/booking/BookingManage'
import { isBookingDomain } from './utils/domain'

/** Redirect old portal.rezvo.app/book/ URLs → book.rezvo.app */
const BookingRedirect = () => {
  const path = window.location.pathname.replace(/^\/book/, '')
  window.location.replace(`https://book.rezvo.app${path}`)
  return null
}

const App = () => {
  /* If we're on book.rezvo.app, render ONLY booking routes at root level */
  if (isBookingDomain()) {
    return (
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/:businessSlug" element={<BookingFlow />} />
          <Route path="/:businessSlug/confirm/:bookingId" element={<BookingConfirmation />} />
          <Route path="/:businessSlug/manage/:bookingId" element={<BookingManage />} />
          <Route path="/" element={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Figtree, sans-serif' }}>
              <p style={{ color: '#888' }}>Enter a restaurant name to book — e.g. book.rezvo.app/restaurant-name</p>
            </div>
          } />
        </Routes>
      </Router>
    )
  }

  return (
    <>
    <Router>
      <ScrollToTop />
      <AuthProvider>
        <TierProvider>
          <Routes>
            {/* Auth */}
            <Route path="/get-started" element={<BusinessTypeSelector />} />
            <Route path="/login/restaurant" element={<RestaurantWelcome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />

            {/* Onboarding */}
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Dashboard — owner portal */}
            <Route path="/dashboard" element={
              <TenantErrorBoundary>
                <BusinessProvider>
                  <DashboardLayout />
                </BusinessProvider>
              </TenantErrorBoundary>
            }>
              <Route index element={<Dashboard />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="booking-link" element={<BookingLink />} />
              <Route path="floor-plan" element={<FloorPlan />} />
              <Route path="staff" element={<Staff />} />
              <Route path="services" element={<Services />} />
              <Route path="online-booking" element={<OnlineBooking />} />
              <Route path="orders" element={<Orders />} />
              <Route path="clients" element={<Clients />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="payments" element={<Payments />} />
              <Route path="marketing" element={<Marketing />} />
              <Route path="studio" element={<Studio />} />
              <Route path="settings" element={<Settings />} />
              <Route path="help" element={<Help />} />
              {/* EPOS pages */}
              <Route path="inventory" element={<EposInventory />} />
              <Route path="kds" element={<EposKDS />} />
              <Route path="labour" element={<EposLabour />} />
              <Route path="cash" element={<EposCash />} />
            </Route>

            {/* Admin — internal ops portal (PIN protected) */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="command-centre" element={<CommandCentre />} />
              <Route path="ai-ops" element={<AdminAIOps />} />
              <Route path="outreach" element={<AdminOutreach />} />
              <Route path="linkedin" element={<AdminLinkedIn />} />
              <Route path="pipeline" element={<AdminPipeline />} />
              <Route path="businesses" element={<AdminBusinesses />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="subscriptions" element={<AdminSubscriptions />} />
              <Route path="directory" element={<AdminDirectory />} />
              <Route path="support" element={<AdminSupport />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="churn" element={<AdminChurn />} />
              <Route path="email-marketing" element={<AdminEmailMarketing />} />
              <Route path="seo" element={<AdminSEO />} />
              <Route path="content" element={<AdminContent />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="health" element={<AdminHealth />} />
              <Route path="audit" element={<AdminAudit />} />
              <Route path="errors" element={<AdminErrors />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="library" element={<Library />} />
            </Route>

            {/* Old /book/ routes → redirect to book.rezvo.app */}
            <Route path="/book/*" element={<BookingRedirect />} />

            {/* Root → dashboard (marketing is served as static HTML by Nginx) */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </TierProvider>
      </AuthProvider>
    </Router>
    </>
  )
}

export default App
