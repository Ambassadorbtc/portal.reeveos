import { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  // Restore cached user for instant render, then validate with API
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('user')
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(localStorage.getItem('token'))

  useEffect(() => {
    if (token) {
      fetchCurrentUser()
    } else {
      setUser(null)
      setLoading(false)
    }
  }, [token])

  const fetchCurrentUser = async () => {
    try {
      const userData = await api.get('/users/me')
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
    } catch (error) {
      console.error('Failed to fetch user:', error)
      // Only logout if token is actually invalid (401)
      // Don't logout on network errors, 500s, etc.
      const msg = error.message || ''
      if (msg.startsWith('401') || msg.includes('Could not validate') || msg.includes('Not authenticated')) {
        logout()
      }
      // Otherwise keep the cached user — API might just be temporarily down
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      const { access_token, refresh_token, user: userData } = response
      
      localStorage.setItem('token', access_token)
      if (refresh_token) localStorage.setItem('refresh_token', refresh_token)
      localStorage.setItem('user', JSON.stringify(userData))
      setToken(access_token)
      setUser(userData)
      
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Login failed'
      }
    }
  }

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData)
      const { access_token, refresh_token, user: newUser } = response
      
      localStorage.setItem('token', access_token)
      if (refresh_token) localStorage.setItem('refresh_token', refresh_token)
      localStorage.setItem('user', JSON.stringify(newUser))
      setToken(access_token)
      setUser(newUser)
      
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Registration failed'
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
