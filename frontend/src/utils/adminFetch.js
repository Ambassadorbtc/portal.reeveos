/**
 * Authenticated fetch for admin panel.
 * Drop-in replacement for fetch() — adds JWT auth header.
 */
export default async function adminFetch(url, options = {}) {
  const token = localStorage.getItem('token')
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

  // If 401, redirect to login
  if (response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  return response
}
