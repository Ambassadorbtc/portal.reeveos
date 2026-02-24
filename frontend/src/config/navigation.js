/**
 * Run 1: Navigation config — sections, icons, paths, minTier
 * Business type switches labels and visible items
 */

export const getNavItems = (businessType) => {
  const isRestaurant = businessType === 'restaurant'

  return {
    main: [
      { id: 'home', label: 'Home Dashboard', icon: 'fa-house', path: '/dashboard', minTier: 'free' },
      { id: 'calendar', label: 'Calendar', icon: 'fa-calendar-days', path: '/dashboard/calendar', minTier: 'free' },
      { id: 'bookings', label: 'Bookings', icon: 'fa-clipboard-list', path: '/dashboard/bookings', minTier: 'free' },
      { id: 'booking-link', label: 'Booking Link', icon: 'fa-link', path: '/dashboard/booking-link', minTier: 'free' },
      { id: 'services', label: isRestaurant ? 'Menu' : 'Services', icon: isRestaurant ? 'fa-utensils' : 'fa-scissors', path: '/dashboard/services', minTier: 'free' },
    ],
    management: [
      { id: 'staff', label: 'Staff', icon: 'fa-users', path: '/dashboard/staff', minTier: 'starter' },
      { id: 'online-booking', label: 'Online Booking', icon: 'fa-globe', path: '/dashboard/online-booking', minTier: 'starter' },
    ],
    business: [
      ...(isRestaurant ? [{ id: 'orders', label: 'Orders', icon: 'fa-bag-shopping', path: '/dashboard/orders', minTier: 'growth' }] : []),
      { id: 'clients', label: 'Clients', icon: 'fa-address-book', path: '/dashboard/clients', minTier: 'growth' },
      { id: 'reviews', label: 'Reviews', icon: 'fa-star', path: '/dashboard/reviews', minTier: 'growth' },
      { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line', path: '/dashboard/analytics', minTier: 'growth' },
      { id: 'payments', label: 'Payments', icon: 'fa-credit-card', path: '/dashboard/payments', minTier: 'growth' },
    ],
    advanced: [
      ...(isRestaurant ? [{ id: 'floor-plan', label: 'Floor Plan', icon: 'fa-table-cells-large', path: '/dashboard/floor-plan', minTier: 'scale' }] : []),
      { id: 'marketing', label: 'Marketing', icon: 'fa-bullhorn', path: '/dashboard/marketing', minTier: 'growth' },
      { id: 'linkedin', label: 'LinkedIn AI', icon: 'fa-linkedin', path: '/dashboard/linkedin', minTier: 'growth' },
      { id: 'ai-ops', label: 'AI Ops Centre', icon: 'fa-robot', path: '/dashboard/ai-ops', minTier: 'growth' },
      { id: 'email-outreach', label: 'Email Outreach', icon: 'fa-paper-plane', path: '/dashboard/email-outreach', minTier: 'growth' },
    ],
    system: [
      { id: 'settings', label: 'Settings', icon: 'fa-gear', path: '/dashboard/settings', minTier: 'free' },
      { id: 'help', label: 'Help Center', icon: 'fa-circle-question', path: '/dashboard/help', minTier: 'free' },
    ],
  }
}
