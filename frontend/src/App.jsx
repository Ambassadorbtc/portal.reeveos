import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { TierProvider } from './contexts/TierContext'
import { BusinessProvider } from './contexts/BusinessContext'
import ScrollToTop from './components/ScrollToTop'
import ChatWidget from './components/ChatWidget'

import DashboardLayout from './layouts/DashboardLayout'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

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
import Marketing from './pages/dashboard/Marketing'
import Payments from './pages/dashboard/Payments'
import Help from './pages/dashboard/Help'

import Onboarding from './pages/onboarding/Onboarding'

/* Booking flow (public, no auth) */
import BookingFlow from './pages/booking/BookingFlow'
import BookingConfirmation from './pages/booking/BookingConfirmation'
import BookingManage from './pages/booking/BookingManage'

const App = () => {
  return (
    <>
    <Router>
      <ScrollToTop />
      <AuthProvider>
        <TierProvider>
          <Routes>
            {/* Auth */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />

            {/* Onboarding */}
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Dashboard — owner portal */}
            <Route path="/dashboard" element={
              <BusinessProvider>
                <DashboardLayout />
              </BusinessProvider>
            }>
              <Route index element={<Dashboard />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="calendar" element={<Calendar />} />
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
              <Route path="settings" element={<Settings />} />
              <Route path="help" element={<Help />} />
            </Route>

            {/* Public booking flow */}
            <Route path="/book/:businessSlug" element={<BookingFlow />} />
            <Route path="/book/:businessSlug/confirm/:bookingId" element={<BookingConfirmation />} />
            <Route path="/book/:businessSlug/manage/:bookingId" element={<BookingManage />} />

            {/* Root → dashboard (marketing is served as static HTML by Nginx) */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </TierProvider>
      </AuthProvider>
    </Router>
    <ChatWidget />
    </>
  )
}

export default App
