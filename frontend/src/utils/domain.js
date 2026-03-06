/**
 * Domain config — ReeveOS + legacy Rezvo domains.
 *
 * PRIMARY (ReeveOS):
 *   adminportal.reeveos.app  = admin panel (Dojo-style, no /admin prefix)
 *   webportal.reeveos.app    = business dashboard
 *   book.reeveos.app         = booking subdomain
 *   reeveos.app              = marketing site
 *
 * LEGACY (Rezvo — staging / redirects):
 *   portaladmin.rezvo.app    = admin (legacy)
 *   portal.rezvo.app         = business dashboard (legacy)
 *   book.rezvo.app           = booking (legacy)
 *   staging.reeveos.app      = staging environment
 */

const host = typeof window !== 'undefined' ? window.location.hostname : ''

export const isPortalDomain = () => true
export const isDirectoryDomain = () => false

/** Are we running on a booking subdomain? */
export const isBookingDomain = () =>
  host === 'book.reeveos.app' || host === 'book.rezvo.app'

/** Are we running on the dedicated admin subdomain? */
export const isAdminDomain = () =>
  host === 'adminportal.reeveos.app' ||
  host === 'portaladmin.reeveos.app' ||
  host === 'portaladmin.rezvo.app' ||
  host === 'admin.rezvo.app'

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
  domain: 'reeveos.app',
  baseUrl: 'https://portal.reeveos.app',
  bookingBaseUrl: 'https://book.reeveos.app',
  adminBaseUrl: 'https://portaladmin.reeveos.app',
  supportEmail: 'support@reeveos.app',
  bookingPathPrefix: isBookingDomain() ? '/' : '/book/',
})

/** Build the public booking URL for a business slug */
export const getBookingUrl = (slug) => `https://book.reeveos.app/${slug}`
