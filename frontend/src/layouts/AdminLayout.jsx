import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Send, Bot, Users, BarChart3, Activity,
  Globe, FileText, Settings, LogOut, ChevronLeft, ChevronRight,
  Zap, Building2, CalendarCheck, MessageSquare, Star, AlertTriangle,
  CreditCard, ScrollText, Bug, Megaphone, ShieldCheck, Linkedin,
  Package, TrendingUp, Search, Crosshair, BookOpen, Wallet
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

const ADMIN_API = import.meta.env.VITE_API_URL || ''

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem('rezvo_admin_token'))
  const [adminUser, setAdminUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('rezvo_admin_user') || 'null') } catch { return null }
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

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

  // ─── Login Gate ─── //
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <form onSubmit={handleLogin} className="w-full max-w-sm mx-4">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #C9A84C, #B8943F)' }}>
              <span className="text-white text-xl font-black" style={{ fontFamily: "'Figtree', sans-serif" }}>R<span style={{fontSize:8}}>.</span></span>
            </div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Figtree', sans-serif" }}>Reeve<span style={{color:'#C9A84C'}}>OS</span></h1>
            <p className="text-sm text-gray-500 mt-1">Admin Panel</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setLoginError('') }}
                placeholder="admin@rezvo.co.uk"
                autoFocus
                autoComplete="email"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                style={{ fontFamily: "'Figtree', sans-serif" }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setLoginError('') }}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                style={{ fontFamily: "'Figtree', sans-serif" }}
              />
            </div>
            {loginError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <ShieldCheck size={14} className="text-red-400 shrink-0" />
                <p className="text-red-400 text-xs">{loginError}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loggingIn || !email || !password}
              className="w-full py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ fontFamily: "'Figtree', sans-serif", backgroundColor: '#C9A84C', color: '#111' }}
            >
              {loggingIn ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-600 mt-6">Authorized personnel only</p>
        </form>
      </div>
    )
  }

  // ─── Admin Shell ─── //
  return (
    <div className="admin-shell flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 shrink-0`}>
        {/* Brand */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #C9A84C, #B8943F)' }}>
              <span className="text-white text-xs font-black" style={{ fontFamily: "'Figtree', sans-serif" }}>R</span>
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-xs font-bold text-white leading-tight" style={{ fontFamily: "'Figtree', sans-serif" }}>Reeve<span style={{color:'#C9A84C'}}>OS</span></h1>
                <p className="text-[9px] text-gray-500">Admin Panel</p>
              </div>
            )}
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="text-gray-500 hover:text-gray-300 transition-colors">
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto scrollbar-thin">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} className="mb-1">
              {!collapsed && (
                <p className="px-4 pt-3 pb-1 text-[9px] font-bold text-gray-600 uppercase tracking-widest">{section.label}</p>
              )}
              {collapsed && si > 0 && <div className="mx-3 my-1 border-t border-gray-800" />}
              {section.items.map(item => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all ${
                      active
                        ? 'bg-amber-600/15 text-amber-400 border-r-2 border-amber-400'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={15} className={`shrink-0 ${active ? 'text-amber-400' : 'text-gray-500'}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-gray-800">
          {!collapsed && adminUser && (
            <div className="px-3 py-2 mb-1">
              <p className="text-[10px] font-bold text-gray-500 truncate">{adminUser.email}</p>
              <p className="text-[9px] text-amber-500 uppercase tracking-widest font-bold">Admin</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-gray-800/60 transition-all"
            title={collapsed ? 'Logout' : undefined}
          >
            <LogOut size={15} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <Outlet />
      </main>
    </div>
  )
}
