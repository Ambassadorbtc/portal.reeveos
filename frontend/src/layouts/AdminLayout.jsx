import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Send, Bot, Users, BarChart3, Activity,
  Globe, FileText, Settings, LogOut, ChevronLeft, ChevronRight,
  Building2, CalendarCheck, MessageSquare, Star, AlertTriangle,
  CreditCard, ScrollText, Bug, Megaphone, ShieldCheck, Linkedin,
  TrendingUp, Search, Crosshair, BookOpen, Wallet, Sun, Moon
} from 'lucide-react'

const NAV_SECTIONS = [
  {
    label: 'Operations',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/admin' },
      { id: 'command-centre', label: 'Command Centre', icon: Crosshair, path: '/admin/command-centre' },
      { id: 'ai-ops', label: 'AI Ops Centre', icon: Bot, path: '/admin/ai-ops' },
      { id: 'outreach', label: 'Email Outreach', icon: Send, path: '/admin/outreach' },
      { id: 'pipeline', label: 'Sales Pipeline', icon: TrendingUp, path: '/admin/pipeline' },
      { id: 'crm', label: 'Dojo CRM', icon: Wallet, path: '/admin/crm' },
      { id: 'library', label: 'Knowledge Library', icon: BookOpen, path: '/admin/library' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { id: 'businesses', label: 'Businesses', icon: Building2, path: '/admin/businesses' },
      { id: 'bookings', label: 'All Bookings', icon: CalendarCheck, path: '/admin/bookings' },
      { id: 'users', label: 'Users & Accounts', icon: Users, path: '/admin/users' },
      { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard, path: '/admin/subscriptions' },
      { id: 'directory', label: 'Directory', icon: Search, path: '/admin/directory' },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { id: 'support', label: 'Support Tickets', icon: MessageSquare, path: '/admin/support' },
      { id: 'reviews', label: 'Reviews & Mod', icon: Star, path: '/admin/reviews' },
      { id: 'churn', label: 'Churn Risk', icon: AlertTriangle, path: '/admin/churn' },
      { id: 'email-marketing', label: 'Email Marketing', icon: Megaphone, path: '/admin/email-marketing' },
      { id: 'linkedin', label: 'LinkedIn AI', icon: Linkedin, path: '/admin/linkedin' },
    ],
  },
  {
    label: 'Content & SEO',
    items: [
      { id: 'seo', label: 'SEO Pages', icon: Globe, path: '/admin/seo' },
      { id: 'content', label: 'Content Engine', icon: FileText, path: '/admin/content' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'security', label: 'Security', icon: ShieldCheck, path: '/admin/security' },
      { id: 'analytics', label: 'Platform Analytics', icon: BarChart3, path: '/admin/analytics' },
      { id: 'health', label: 'System Health', icon: Activity, path: '/admin/health' },
      { id: 'audit', label: 'Activity Log', icon: ScrollText, path: '/admin/audit' },
      { id: 'errors', label: 'Error Logs', icon: Bug, path: '/admin/errors' },
      { id: 'settings', label: 'Admin Settings', icon: Settings, path: '/admin/settings' },
    ],
  },
]

/* ══════════════════════════════════════════════════════
   LIGHT MODE CSS OVERRIDES
   Remaps ALL dark Tailwind classes used in admin pages
   to light equivalents — ZERO changes to page files.
   ══════════════════════════════════════════════════════ */
const LIGHT_OVERRIDES = `
/* ── Backgrounds ── */
.admin-light .bg-gray-950 { background-color: #F8F7F4 !important; }
.admin-light .bg-gray-900 { background-color: #FFFFFF !important; }
.admin-light .bg-gray-900\\/60 { background-color: rgba(255,255,255,0.85) !important; }
.admin-light .bg-gray-900\\/50 { background-color: rgba(255,255,255,0.75) !important; }
.admin-light .bg-gray-900\\/40 { background-color: rgba(255,255,255,0.65) !important; }
.admin-light .bg-gray-800 { background-color: #F0EDE7 !important; }
.admin-light .bg-gray-800\\/60 { background-color: rgba(240,237,231,0.7) !important; }
.admin-light .bg-gray-800\\/50 { background-color: rgba(240,237,231,0.6) !important; }
.admin-light .bg-gray-800\\/40 { background-color: rgba(240,237,231,0.5) !important; }
.admin-light .bg-gray-700 { background-color: #E8E4DD !important; }
.admin-light .bg-gray-700\\/50 { background-color: rgba(232,228,221,0.5) !important; }
.admin-light .bg-black\\/60 { background-color: rgba(0,0,0,0.25) !important; }
.admin-light .bg-black\\/50 { background-color: rgba(0,0,0,0.2) !important; }

/* ── Borders ── */
.admin-light .border-gray-800 { border-color: #E8E4DD !important; }
.admin-light .border-gray-700 { border-color: #E0DCD5 !important; }
.admin-light .border-gray-700\\/50 { border-color: rgba(224,220,213,0.5) !important; }
.admin-light .border-gray-600 { border-color: #D5D0C8 !important; }

/* ── Text ── */
.admin-light .text-white { color: #111111 !important; }
.admin-light .text-gray-200 { color: #2C2C2A !important; }
.admin-light .text-gray-300 { color: #3D3D3A !important; }
.admin-light .text-gray-400 { color: #5A5750 !important; }
.admin-light .text-gray-500 { color: #7A776F !important; }
.admin-light .text-gray-600 { color: #9A9790 !important; }
.admin-light .text-gray-700 { color: #AEABA5 !important; }
.admin-light .placeholder-gray-600::placeholder { color: #AEABA5 !important; }

/* ── Accent: emerald → gold ── */
.admin-light .text-emerald-400 { color: #C9A84C !important; }
.admin-light .text-emerald-500 { color: #B8943F !important; }
.admin-light .bg-emerald-600 { background-color: #C9A84C !important; }
.admin-light .bg-emerald-700 { background-color: #B8943F !important; }
.admin-light .bg-emerald-800 { background-color: #A6832E !important; }
.admin-light .bg-emerald-600\\/15 { background-color: rgba(201,168,76,0.12) !important; }
.admin-light .bg-emerald-500\\/15 { background-color: rgba(201,168,76,0.12) !important; }
.admin-light .bg-emerald-500\\/25 { background-color: rgba(201,168,76,0.2) !important; }
.admin-light .bg-emerald-500\\/10 { background-color: rgba(201,168,76,0.08) !important; }
.admin-light .bg-emerald-500\\/5 { background-color: rgba(201,168,76,0.05) !important; }
.admin-light .bg-emerald-900\\/20 { background-color: rgba(201,168,76,0.08) !important; }
.admin-light .border-emerald-400 { border-color: #C9A84C !important; }
.admin-light .ring-emerald-500\\/40 { --tw-ring-color: rgba(201,168,76,0.4) !important; }
.admin-light .ring-emerald-500\\/20 { --tw-ring-color: rgba(201,168,76,0.2) !important; }
.admin-light .focus\\:ring-emerald-500\\/40:focus { --tw-ring-color: rgba(201,168,76,0.4) !important; }
.admin-light .focus\\:border-emerald-500:focus { border-color: #C9A84C !important; }

/* ── Accent backgrounds for status cards ── */
.admin-light .bg-blue-900\\/20 { background-color: rgba(59,130,246,0.06) !important; }
.admin-light .bg-red-900\\/20 { background-color: rgba(239,68,68,0.06) !important; }
.admin-light .bg-red-500\\/10 { background-color: rgba(239,68,68,0.06) !important; }
.admin-light .bg-red-500\\/5 { background-color: rgba(239,68,68,0.04) !important; }
.admin-light .bg-amber-900\\/30 { background-color: rgba(201,168,76,0.1) !important; }
.admin-light .bg-amber-500\\/10 { background-color: rgba(201,168,76,0.08) !important; }
.admin-light .bg-blue-500\\/10 { background-color: rgba(59,130,246,0.06) !important; }
.admin-light .bg-blue-500\\/15 { background-color: rgba(59,130,246,0.08) !important; }

/* ── Hover overrides ── */
.admin-light .hover\\:bg-gray-800:hover { background-color: #F0EDE7 !important; }
.admin-light .hover\\:bg-gray-800\\/60:hover { background-color: rgba(240,237,231,0.7) !important; }
.admin-light .hover\\:bg-gray-700:hover { background-color: #E8E4DD !important; }
.admin-light .hover\\:text-gray-200:hover { color: #2C2C2A !important; }
.admin-light .hover\\:text-gray-300:hover { color: #3D3D3A !important; }
.admin-light .hover\\:border-gray-600:hover { border-color: #D5D0C8 !important; }
.admin-light .hover\\:border-gray-700:hover { border-color: #E0DCD5 !important; }
.admin-light .hover\\:bg-emerald-500\\/25:hover { background-color: rgba(201,168,76,0.2) !important; }
.admin-light .hover\\:bg-emerald-700:hover { background-color: #B8943F !important; }

/* ── Focus overrides ── */
.admin-light .focus\\:border-gray-600:focus { border-color: #C9A84C !important; }
.admin-light .focus\\:ring-amber-500\\/40:focus { --tw-ring-color: rgba(201,168,76,0.4) !important; }
.admin-light .focus\\:border-amber-500:focus { border-color: #C9A84C !important; }

/* ── Input/select in light mode ── */
.admin-light input,
.admin-light textarea,
.admin-light select {
  color: #111 !important;
}
.admin-light input::placeholder,
.admin-light textarea::placeholder {
  color: #AEABA5 !important;
}
.admin-light .admin-select {
  color: #111 !important;
  background-color: #F0EDE7 !important;
  border-color: #E0DCD5 !important;
}

/* ── Scrollbar ── */
.admin-light ::-webkit-scrollbar { width: 6px; }
.admin-light ::-webkit-scrollbar-track { background: transparent; }
.admin-light ::-webkit-scrollbar-thumb { background: #D5D0C8; border-radius: 3px; }
.admin-light ::-webkit-scrollbar-thumb:hover { background: #C0BBB3; }

/* ── Gradient overrides (used in some cards) ── */
.admin-light .from-emerald-500 { --tw-gradient-from: #C9A84C !important; }
.admin-light .to-emerald-700 { --tw-gradient-to: #B8943F !important; }
.admin-light .bg-gradient-to-br { background-image: linear-gradient(to bottom right, var(--tw-gradient-from, #C9A84C), var(--tw-gradient-to, #B8943F)) !important; }
`

/* ══════════════════════════════════════════════════════
   DARK MODE CSS OVERRIDES
   Remaps emerald → gold in dark mode so ALL pages
   match the new ReeveOS branding.
   ══════════════════════════════════════════════════════ */
const DARK_OVERRIDES = `
/* ── Accent: emerald → gold (dark mode) ── */
.admin-dark .text-emerald-400 { color: #C9A84C !important; }
.admin-dark .text-emerald-500 { color: #B8943F !important; }
.admin-dark .text-emerald-300 { color: #D4B85E !important; }
.admin-dark .bg-emerald-600 { background-color: #C9A84C !important; }
.admin-dark .bg-emerald-700 { background-color: #B8943F !important; }
.admin-dark .bg-emerald-800 { background-color: #A6832E !important; }
.admin-dark .bg-emerald-600\\/15 { background-color: rgba(201,168,76,0.15) !important; }
.admin-dark .bg-emerald-500\\/15 { background-color: rgba(201,168,76,0.15) !important; }
.admin-dark .bg-emerald-500\\/25 { background-color: rgba(201,168,76,0.25) !important; }
.admin-dark .bg-emerald-500\\/10 { background-color: rgba(201,168,76,0.1) !important; }
.admin-dark .bg-emerald-500\\/5 { background-color: rgba(201,168,76,0.05) !important; }
.admin-dark .bg-emerald-900\\/20 { background-color: rgba(201,168,76,0.1) !important; }
.admin-dark .border-emerald-400 { border-color: #C9A84C !important; }
.admin-dark .border-emerald-500 { border-color: #C9A84C !important; }
.admin-dark .border-emerald-600 { border-color: #B8943F !important; }
.admin-dark .ring-emerald-500\\/40 { --tw-ring-color: rgba(201,168,76,0.4) !important; }
.admin-dark .ring-emerald-500\\/20 { --tw-ring-color: rgba(201,168,76,0.2) !important; }
.admin-dark .focus\\:ring-emerald-500\\/40:focus { --tw-ring-color: rgba(201,168,76,0.4) !important; }
.admin-dark .focus\\:border-emerald-500:focus { border-color: #C9A84C !important; }
.admin-dark .hover\\:bg-emerald-500\\/25:hover { background-color: rgba(201,168,76,0.25) !important; }
.admin-dark .hover\\:bg-emerald-700:hover { background-color: #B8943F !important; }
.admin-dark .hover\\:bg-emerald-600:hover { background-color: #C9A84C !important; }

/* ── Gradient overrides (dark) ── */
.admin-dark .from-emerald-500 { --tw-gradient-from: #C9A84C !important; }
.admin-dark .to-emerald-700 { --tw-gradient-to: #B8943F !important; }
.admin-dark .bg-gradient-to-br { background-image: linear-gradient(to bottom right, var(--tw-gradient-from, #C9A84C), var(--tw-gradient-to, #B8943F)) !important; }
`

/* ── Theme tokens for sidebar/shell (inline styles) ── */
const LIGHT = {
  bg: '#F8F7F4',
  sidebar: '#FFFFFF',
  sidebarBorder: '#E8E4DD',
  sectionLabel: '#9A9790',
  navText: '#7A776F',
  navTextHover: '#2C2C2A',
  navHoverBg: 'rgba(232,228,221,0.5)',
  navActiveText: '#111111',
  navActiveBg: 'rgba(17,17,17,0.06)',
  navActiveIcon: '#111111',
  navIcon: '#9A9790',
  brandText: '#111111',
  brandSub: '#9A9790',
  userEmail: '#7A776F',
  userRole: '#C9A84C',
  logoutText: '#9A9790',
  logoutHover: '#EF4444',
  collapseIcon: '#9A9790',
}

const DARK = {
  bg: '#0a0a0a',
  sidebar: '#111111',
  sidebarBorder: '#1f1f1f',
  sectionLabel: '#555',
  navText: '#888',
  navTextHover: '#ccc',
  navHoverBg: 'rgba(255,255,255,0.05)',
  navActiveText: '#C9A84C',
  navActiveBg: 'rgba(201,168,76,0.1)',
  navActiveIcon: '#C9A84C',
  navIcon: '#555',
  brandText: '#FFFFFF',
  brandSub: '#666',
  userEmail: '#888',
  userRole: '#C9A84C',
  logoutText: '#666',
  logoutHover: '#EF4444',
  collapseIcon: '#555',
}

const ADMIN_API = import.meta.env.VITE_API_URL || ''
const FIG = "'Figtree', system-ui, sans-serif"

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('admin_theme') === 'dark' } catch { return false }
  })
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem('rezvo_admin_token'))
  const [adminUser, setAdminUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('rezvo_admin_user') || 'null') } catch { return null }
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const t = dark ? DARK : LIGHT

  useEffect(() => {
    try { localStorage.setItem('admin_theme', dark ? 'dark' : 'light') } catch {}
  }, [dark])

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    setLoggingIn(true)
    try {
      const res = await fetch(`${ADMIN_API}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLoginError(data.detail || 'Login failed')
        return
      }
      sessionStorage.setItem('rezvo_admin_token', data.access_token)
      sessionStorage.setItem('rezvo_admin_user', JSON.stringify(data.user))
      setAdminUser(data.user)
      setAuthed(true)
    } catch (err) {
      setLoginError('Network error — please try again')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('rezvo_admin_token')
    sessionStorage.removeItem('rezvo_admin_user')
    setAuthed(false)
    setAdminUser(null)
    setEmail('')
    setPassword('')
  }

  /* ─── Login Gate ─── */
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FIG }}>
        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 380, padding: '0 16px' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#222', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <span style={{ color: '#C9A84C', fontSize: 22, fontWeight: 900, fontFamily: FIG }}>R<span style={{ fontSize: 8 }}>.</span></span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FFF', margin: '0 0 4px' }}>Reeve<span style={{ color: '#C9A84C' }}>OS</span></h1>
            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>Admin Panel</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Email</label>
              <input
                type="email" value={email} onChange={e => { setEmail(e.target.value); setLoginError('') }}
                placeholder="admin@rezvo.co.uk" autoFocus autoComplete="email"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #333', background: '#1a1a1a', color: '#FFF', fontSize: 14, fontFamily: FIG, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'} onBlur={e => e.target.style.borderColor = '#333'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Password</label>
              <input
                type="password" value={password} onChange={e => { setPassword(e.target.value); setLoginError('') }}
                placeholder="••••••••" autoComplete="current-password"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #333', background: '#1a1a1a', color: '#FFF', fontSize: 14, fontFamily: FIG, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'} onBlur={e => e.target.style.borderColor = '#333'}
              />
            </div>
            {loginError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <ShieldCheck size={14} style={{ color: '#EF4444', flexShrink: 0 }} />
                <span style={{ color: '#EF4444', fontSize: 12 }}>{loginError}</span>
              </div>
            )}
            <button type="submit" disabled={loggingIn || !email || !password}
              style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', background: '#C9A84C', color: '#111', fontSize: 14, fontWeight: 700, fontFamily: FIG, cursor: loggingIn || !email || !password ? 'not-allowed' : 'pointer', opacity: loggingIn || !email || !password ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 200ms' }}>
              {loggingIn ? (<><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />Signing in...</>) : 'Sign In'}
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, color: '#555', marginTop: 24 }}>Authorized personnel only</p>
        </form>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  /* ─── Admin Shell ─── */
  return (
    <div className={dark ? 'admin-dark' : 'admin-light'} style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: FIG, background: t.bg, transition: 'background 300ms' }}>
      {/* Inject theme CSS overrides */}
      <style>{LIGHT_OVERRIDES}</style>
      <style>{DARK_OVERRIDES}</style>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 64 : 240, minWidth: collapsed ? 64 : 240,
        background: t.sidebar, borderRight: `1px solid ${t.sidebarBorder}`,
        display: 'flex', flexDirection: 'column', transition: 'all 300ms', flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: `1px solid ${t.sidebarBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#C9A84C', fontSize: 14, fontWeight: 900, fontFamily: FIG }}>R<span style={{ fontSize: 6 }}>.</span></span>
            </div>
            {!collapsed && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.brandText, lineHeight: 1.2 }}>Reeve<span style={{ color: '#C9A84C' }}>OS</span></div>
                <div style={{ fontSize: 10, color: t.brandSub, letterSpacing: '0.05em' }}>ADMIN PANEL</div>
              </div>
            )}
          </div>
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.collapseIcon, display: 'flex', alignItems: 'center', padding: 4 }}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} style={{ marginBottom: 4 }}>
              {!collapsed && (
                <div style={{ padding: '12px 16px 4px', fontSize: 10, fontWeight: 700, color: t.sectionLabel, textTransform: 'uppercase', letterSpacing: '0.1em', userSelect: 'none' }}>{section.label}</div>
              )}
              {collapsed && si > 0 && <div style={{ margin: '4px 12px', borderTop: `1px solid ${t.sidebarBorder}` }} />}
              {section.items.map(item => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.path)}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: collapsed ? '9px 0' : '9px 12px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      marginLeft: collapsed ? 0 : 4, marginRight: collapsed ? 0 : 4,
                      width: collapsed ? '100%' : 'calc(100% - 8px)',
                      borderRadius: 10, border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: active ? 600 : 500, fontFamily: FIG,
                      color: active ? t.navActiveText : t.navText,
                      background: active ? t.navActiveBg : 'transparent',
                      transition: 'all 180ms', whiteSpace: 'nowrap', textAlign: 'left',
                      borderLeft: active && !collapsed ? '3px solid #C9A84C' : '3px solid transparent',
                    }}
                    onMouseOver={e => { if (!active) { e.currentTarget.style.background = t.navHoverBg; e.currentTarget.style.color = t.navTextHover } }}
                    onMouseOut={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.navText } }}
                  >
                    <Icon size={16} strokeWidth={active ? 2.2 : 1.5} style={{ flexShrink: 0, color: active ? t.navActiveIcon : t.navIcon, transition: 'color 180ms' }} />
                    {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: 8, borderTop: `1px solid ${t.sidebarBorder}` }}>
          {/* Theme toggle */}
          {!collapsed && (
            <div onClick={() => setDark(!dark)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4, borderRadius: 10, cursor: 'pointer', transition: 'background 150ms' }}
              onMouseOver={e => e.currentTarget.style.background = t.navHoverBg}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
                background: dark ? '#C9A84C' : '#E8E4DD', transition: 'background 300ms',
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', position: 'absolute', top: 2,
                  left: dark ? 18 : 2, background: '#FFF', transition: 'left 300ms',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }}>
                  {dark ? <Moon size={8} style={{ color: '#C9A84C' }} /> : <Sun size={8} style={{ color: '#C9A84C' }} />}
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: t.navText }}>{dark ? 'Dark' : 'Light'}</span>
            </div>
          )}
          {collapsed && (
            <button onClick={() => setDark(!dark)} title={dark ? 'Dark mode' : 'Light mode'}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', color: t.navText }}>
              {dark ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          )}

          {/* User info */}
          {!collapsed && adminUser && (
            <div style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.userEmail, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminUser.email}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.userRole, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin</div>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign Out' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '8px 0' : '8px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500, fontFamily: FIG,
              color: t.logoutText, background: 'transparent', transition: 'all 150ms',
            }}
            onMouseOver={e => { e.currentTarget.style.color = t.logoutHover; e.currentTarget.style.background = t.navHoverBg }}
            onMouseOut={e => { e.currentTarget.style.color = t.logoutText; e.currentTarget.style.background = 'transparent' }}
          >
            <LogOut size={15} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', background: t.bg, transition: 'background 300ms' }}>
        <Outlet context={{ dark, theme: t }} />
      </main>
    </div>
  )
}
