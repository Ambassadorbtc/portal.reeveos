/**
 * TenantErrorBoundary
 * ====================
 * Wraps all dashboard content. If ANY component crashes, this shows a 
 * safe, generic fallback page instead of potentially rendering another 
 * tenant's data from corrupted state.
 * 
 * CRITICAL: The fallback shows NO business names, NO data, NO error details.
 * Just a safe loading/error screen with a reference ID for support.
 */
import { Component } from 'react'

class TenantErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { 
      hasError: false, 
      errorRef: null,
    }
  }

  static getDerivedStateFromError(error) {
    // Generate opaque reference ID for support
    const ref = Math.random().toString(36).substring(2, 10).toUpperCase()
    return { hasError: true, errorRef: ref }
  }

  componentDidCatch(error, errorInfo) {
    // Log error but NEVER expose to UI
    console.error(
      `[TenantErrorBoundary] ref=${this.state.errorRef}`,
      error,
      errorInfo
    )
    
    // TODO: Send to error monitoring (Sentry, etc.)
    // Sentry.captureException(error, { extra: { errorRef: this.state.errorRef } })
  }

  handleReset = () => {
    // Clear ALL state and reload — prevents stale tenant data
    sessionStorage.clear()
    this.setState({ hasError: false, errorRef: null })
    window.location.href = '/dashboard'
  }

  handleLogout = () => {
    // Nuclear option — clear everything and go to login
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    sessionStorage.clear()
    window.location.href = '/login'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#F8F9FA',
          fontFamily: 'Figtree, system-ui, sans-serif',
          padding: '2rem',
        }}>
          {/* ReeveOS branded loading/error state */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '3rem',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}>
            {/* Safe ReeveOS logo — no tenant data */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#111111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: '20px' }}>R</span>
            </div>

            <h2 style={{ 
              color: '#111111', 
              fontSize: '1.25rem', 
              fontWeight: 600, 
              margin: '0 0 0.75rem' 
            }}>
              Something went wrong
            </h2>
            
            <p style={{ 
              color: '#6B7280', 
              fontSize: '0.9rem', 
              margin: '0 0 2rem',
              lineHeight: 1.5,
            }}>
              We hit a snag loading this page. Your data is safe — 
              this is just a display issue.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  background: '#111111',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleLogout}
                style={{
                  background: 'white',
                  color: '#6B7280',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Log Out
              </button>
            </div>

            {/* Opaque reference ID — no stack traces, no data */}
            <p style={{ 
              color: '#9CA3AF', 
              fontSize: '0.7rem', 
              margin: '1.5rem 0 0',
            }}>
              Reference: {this.state.errorRef}
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default TenantErrorBoundary
