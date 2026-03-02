/**
 * Domain config for Rezvo.app portal.
 * Booking URLs now live on book.rezvo.app (clean subdomain).
 * Old portal.rezvo.app/book/ URLs redirect automatically.
 */

export const isRezvoApp = () => true
export const isRezvoCoUk = () => false

/** Are we running on the dedicated booking subdomain? */
export const isBookingDomain = () =>
  typeof window !== 'undefined' && window.location.hostname === 'book.rezvo.app'

export const getDomainConfig = () => ({
  domain: 'rezvo.app',
  baseUrl: 'https://portal.rezvo.app',
  bookingBaseUrl: 'https://book.rezvo.app',
  supportEmail: 'support@rezvo.app',
  bookingPathPrefix: isBookingDomain() ? '/' : '/book/',
})

/** Build the public booking URL for a business slug */
export const getBookingUrl = (slug) => `https://book.rezvo.app/${slug}`
