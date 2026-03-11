/**
 * Run 1: Navigation config — sections, icons, paths, minTier
 * Business type switches labels and visible items
 */

export const getNavItems = (businessType) => {
  const isRestaurant = businessType === 'restaurant'

  return {
    main: [
      { id: 'home', label: 'Home Dashboard', icon: 'fa-house', path: '/dashboard', minTier: 'free' },
      { id: 'calendar', label: isRestaurant ? 'Reservations Planner' : 'Calendar', icon: 'fa-calendar-days', path: '/dashboard/calendar', minTier: 'free' },
      { id: 'notifications', label: 'Notifications', icon: 'fa-bell', path: '/dashboard/notifications', minTier: 'free', badge: 3 },
      { id: 'bookings', label: 'Bookings', icon: 'fa-clipboard-list', path: '/dashboard/bookings', minTier: 'free' },
      { id: 'booking-link', label: 'Booking Link', icon: 'fa-link', path: '/dashboard/booking-link', minTier: 'free' },
      { id: 'services', label: isRestaurant ? 'Menu' : 'Services', icon: isRestaurant ? 'fa-utensils' : 'fa-scissors', path: '/dashboard/services', minTier: 'free' },
    ],
    management: [
      { id: 'staff', label: 'Staff', icon: 'fa-users', path: '/dashboard/staff', minTier: 'starter' },
      { id: 'online-booking', label: 'Online Booking', icon: 'fa-globe', path: '/dashboard/online-booking', minTier: 'starter' },
      { id: 'deleted', label: 'Deleted Items', icon: 'fa-trash-can', path: '/dashboard/deleted', minTier: 'free' },
    ],
    epos: isRestaurant ? [
      { id: 'epos-inventory', label: 'Inventory', icon: 'fa-boxes-stacked', path: '/dashboard/inventory', minTier: 'free' },
      { id: 'epos-kds', label: 'Kitchen Display', icon: 'fa-fire-burner', path: '/dashboard/kds', minTier: 'free' },
      { id: 'epos-labour', label: 'Labour & Rota', icon: 'fa-clock', path: '/dashboard/labour', minTier: 'free' },
      { id: 'epos-cash', label: 'Cash & Finance', icon: 'fa-cash-register', path: '/dashboard/cash', minTier: 'free' },
    ] : [],
    business: [
      ...(isRestaurant ? [{ id: 'orders', label: 'Orders', icon: 'fa-bag-shopping', path: '/dashboard/orders', minTier: 'growth' }] : []),
      ...(!isRestaurant ? [{ id: 'consultation-forms', label: 'Consultation Forms', icon: 'fa-file-medical', path: '/dashboard/consultation-forms', minTier: 'free' }, { id: 'client-messages', label: 'Client Messages', icon: 'fa-comments', path: '/dashboard/client-messages', minTier: 'free' }] : []),
      { id: 'clients', label: isRestaurant ? 'Guest CRM' : 'Clients', icon: 'fa-address-book', path: '/dashboard/clients', minTier: 'growth' },
      ...(!isRestaurant ? [{ id: 'packages', label: 'Packages', icon: 'fa-box', path: '/dashboard/packages', minTier: 'free' }] : []),
      { id: 'reviews', label: 'Reviews', icon: 'fa-star', path: '/dashboard/reviews', minTier: 'growth' },
      { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line', path: '/dashboard/analytics', minTier: 'growth' },
      ...(!isRestaurant ? [{ id: 'consumables', label: 'Consumables', icon: 'fa-flask', path: '/dashboard/consumables', minTier: 'free' }] : []),
      ...(!isRestaurant ? [{ id: 'rota', label: 'Staff Rota', icon: 'fa-calendar-check', path: '/dashboard/rota', minTier: 'free' }] : []),
      { id: 'payments', label: 'Payments', icon: 'fa-credit-card', path: '/dashboard/payments', minTier: 'growth' },
    ],
    advanced: [
      ...(isRestaurant ? [{ id: 'floor-plan', label: 'Floor Plan', icon: 'fa-table-cells-large', path: '/dashboard/floor-plan', minTier: 'scale' }] : []),
      { id: 'marketing', label: 'Marketing', icon: 'fa-bullhorn', path: '/dashboard/marketing', minTier: 'growth' },
    ],
    system: [
      { id: 'settings', label: 'Settings', icon: 'fa-gear', path: '/dashboard/settings', minTier: 'free' },
      { id: 'help', label: 'Help Center', icon: 'fa-circle-question', path: '/dashboard/help', minTier: 'free' },
    ],
  }
}
