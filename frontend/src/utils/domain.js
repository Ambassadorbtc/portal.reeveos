/**
 * Domain config — ReeveOS platform on rezvo.app domains.
 *
 * PRODUCTION:
 *   portaladmin.rezvo.app  = admin panel (Dojo-style, no /admin prefix)
 *   portal.rezvo.app       = business dashboard
 *   book.rezvo.app         = booking subdomain
 *   rezvo.app              = marketing site
 *
 * FUTURE (reeveos.app — not yet active):
 *   adminportal.reeveos.app, webportal.reeveos.app, book.reeveos.app
 */

const host = typeof window !== 'undefined' ? window.location.hostname : ''

export const isPortalDomain = () => true
export const isDirectoryDomain = () => false

/** Are we running on a booking subdomain? */
export const isBookingDomain = () =>
  host === 'book.rezvo.app' || host === 'book.reeveos.app'

/** Are we running on the dedicated admin subdomain? */
export const isAdminDomain = () =>
  host === 'portaladmin.rezvo.app' ||
  host === 'admin.rezvo.app' ||
  host === 'adminportal.reeveos.app' ||
  host === 'portaladmin.reeveos.app'

/** Admin route prefix: empty on admin domain, '/admin' on portal domain */
export const ADMIN_BASE = isAdminDomain() ? '' : '/admin'

/**
 * Build an admin path.
 * On admin domain:  adminPath('/crm') → '/crm'
 * On portal domain: adminPath('/crm') → '/admin/crm'
 */
export const adminPath = (path) => {
  if (!path || path === '/') return ADMIN_BASE || '/'
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${ADMIN_BASE}${clean}`
}

export const getDomainConfig = () => ({
  domain: 'rezvo.app',
  baseUrl: 'https://portal.rezvo.app',
  bookingBaseUrl: 'https://book.rezvo.app',
  adminBaseUrl: 'https://portaladmin.rezvo.app',
  supportEmail: 'support@reeveos.app',
  bookingPathPrefix: isBookingDomain() ? '/' : '/book/',
})

/** Build the public booking URL for a business slug */
export const getBookingUrl = (slug) => `https://portal.rezvo.app/book/${slug}`
