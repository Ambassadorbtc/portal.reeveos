export const CATEGORIES = {
  restaurant: {
    name: 'Restaurants',
    slug: 'restaurants',
    icon: 'utensils'
  },
  barber: {
    name: 'Barbers',
    slug: 'barbers',
    icon: 'scissors'
  },
  salon: {
    name: 'Salons',
    slug: 'salons',
    icon: 'sparkles'
  },
  spa: {
    name: 'Spas',
    slug: 'spas',
    icon: 'spa'
  }
}

export const TIERS = {
  solo: {
    name: 'Solo',
    description: 'Perfect for independent professionals',
    features: ['Calendar', 'Basic CRM', 'Profile']
  },
  team: {
    name: 'Team',
    description: 'For businesses with multiple staff',
    features: ['Staff management', 'Chair assignments', 'All Solo features']
  },
  venue: {
    name: 'Venue',
    description: 'For restaurants and large establishments',
    features: ['Floor plan', 'Table management', 'All Team features']
  }
}

export const REEVEOS_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    features: ['Directory listing', 'Basic profile', 'Customer reviews']
  },
  pro: {
    name: 'Pro',
    price: 20,
    features: ['Online booking', 'Table/chair management', 'CRM', 'Analytics']
  },
  premium: {
    name: 'Premium',
    price: 50,
    features: ['Promoted listings', 'Google Review Booster', 'Priority support']
  }
}

export const RESERVATION_STATUS = {
  pending: { label: 'Pending', color: 'gray' },
  confirmed: { label: 'Confirmed', color: 'green' },
  seated: { label: 'Seated', color: 'blue' },
  completed: { label: 'Completed', color: 'green' },
  no_show: { label: 'No Show', color: 'red' },
  cancelled: { label: 'Cancelled', color: 'red' }
}

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
]
