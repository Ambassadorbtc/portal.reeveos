/**
 * WelcomeBanner — slides in from the right on login, auto-dismisses
 * Shows once per session. Slick glassmorphic design.
 */
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useBusiness } from '../../contexts/BusinessContext'

const SESSION_KEY = 'reeveos_welcome_shown'

const WelcomeBanner = () => {
  const { user } = useAuth()
  const { business } = useBusiness()
  const [phase, setPhase] = useState('hidden') // hidden → entering → visible → exiting → gone

  useEffect(() => {
    // Only show once per session
    if (sessionStorage.getItem(SESSION_KEY)) return
    if (!user) return

    sessionStorage.setItem(SESSION_KEY, '1')

    // Small delay so the dashboard loads first
    const enterTimer = setTimeout(() => setPhase('entering'), 600)

    return () => clearTimeout(enterTimer)
  }, [user])

  useEffect(() => {
    if (phase === 'entering') {
      const visibleTimer = setTimeout(() => setPhase('visible'), 50)
      return () => clearTimeout(visibleTimer)
    }
    if (phase === 'visible') {
      const exitTimer = setTimeout(() => setPhase('exiting'), 4000)
      return () => clearTimeout(exitTimer)
    }
    if (phase === 'exiting') {
      const goneTimer = setTimeout(() => setPhase('gone'), 700)
      return () => clearTimeout(goneTimer)
    }
  }, [phase])

  if (phase === 'hidden' || phase === 'gone') return null

  const firstName = (user?.name || user?.full_name || 'there').split(' ')[0]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const isVisible = phase === 'visible'
  const isExiting = phase === 'exiting'

  return (
    <div
      onClick={() => setPhase('exiting')}
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 10000,
        width: 380,
        maxWidth: 'calc(100vw - 48px)',
        padding: '20px 24px',
        borderRadius: 16,
        background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
        boxShadow: '0 20px 60px rgba(17, 17, 17, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset',
        cursor: 'pointer',
        transform: isVisible
          ? 'translateX(0)'
          : isExiting
          ? 'translateX(calc(100% + 40px))'
          : 'translateX(calc(100% + 40px))',
        opacity: isVisible ? 1 : isExiting ? 0 : 0,
        transition: isExiting
          ? 'transform 0.6s cubic-bezier(0.6, -0.05, 0.35, 1), opacity 0.5s ease'
          : 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease',
        fontFamily: "'Figtree', system-ui, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Subtle shimmer effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '-100%',
        width: '200%',
        height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
        animation: isVisible ? 'welcomeShimmer 3s ease-in-out 0.5s' : 'none',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
        {/* R. logo */}
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: '#D4A373',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 20, color: '#111111',
          fontFamily: "'Georgia', serif",
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          R.
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 17, fontWeight: 700, color: '#fff',
            lineHeight: 1.3,
          }}>
            {greeting}, {firstName} 👋
          </div>
          <div style={{
            fontSize: 12, color: '#B7E4C7', marginTop: 3,
            fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {business?.name || 'Your dashboard is ready'}
          </div>
        </div>
      </div>

      {/* Progress dots animation */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        background: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          background: '#D4A373',
          width: isVisible ? '100%' : '0%',
          transition: 'width 4s linear',
          borderRadius: 2,
        }} />
      </div>

      <style>{`
        @keyframes welcomeShimmer {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(50%); }
        }
      `}</style>
    </div>
  )
}

export default WelcomeBanner
