/**
 * Authenticated fetch for admin panel.
 * Drop-in replacement for fetch() — adds JWT auth header.
 * Admin panel stores token in sessionStorage as 'reeveos_admin_token'.
 */
export default async function adminFetch(url, options = {}) {
  const token = sessionStorage.getItem('reeveos_admin_token')
  const headers = {
    ...options.headers,
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  // Add content-type for POST/PUT/PATCH if body exists
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, { ...options, headers })

  // If 401, session expired — clear and reload to show login
  if (response.status === 401) {
    sessionStorage.removeItem('reeveos_admin_token')
    sessionStorage.removeItem('reeveos_admin_user')
    window.location.reload()
    throw new Error('Session expired')
  }

  return response
}
