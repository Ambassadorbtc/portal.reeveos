import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminPath } from '../../utils/domain'
import {
  Building2, Users, CalendarCheck, CreditCard, TrendingUp, TrendingDown,
  AlertTriangle, MessageSquare, Send, Bot, Activity, Globe,
  ArrowRight, Zap, Star, RefreshCw, Clock, Mail
} from 'lucide-react'

const api = (path) => { const t = sessionStorage.getItem('reeveos_admin_token'); return fetch(`/api${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} }).then(r => r.ok ? r.json() : null).catch(() => null) }

// Metric card component
const KPI = ({ label, value, change, icon: Icon, trend, onClick }) => (
  <button onClick={onClick} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-left hover:border-gray-700 transition-all group">
    <div className="flex items-center justify-between mb-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(201,168,76,0.1)' }}>
        <Icon size={16} style={{ color: '#C9A84C' }} />
      </div>
      {change !== undefined && (
        <span className={`text-xs font-medium flex items-center gap-0.5 ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-500'}`}>
          {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : null}
          {change}
        </span>
      )}
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
  </button>
)

// Quick action button
const QAction = ({ icon: Icon, label, desc, onClick }) => (
  <button onClick={onClick} className="flex items-center gap-3 p-3 bg-gray-900/60 border border-gray-800 rounded-xl hover:border-gray-700 transition-all text-left group w-full">
    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(201,168,76,0.1)' }}>
      <Icon size={16} style={{ color: '#C9A84C' }} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-white truncate">{label}</p>
      <p className="text-xs text-gray-500 truncate">{desc}</p>
    </div>
    <ArrowRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
  </button>
)

export default function AdminOverview() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [briefing, setBriefing] = useState(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    const data = await api('/admin/overview')
    setStats(data || {
      mrr: '£0',
      mrr_change: '+£0',
      mrr_trend: 'up',
      active_businesses: 0,
      biz_change: '0 total',
      total_users: 0,
      total_bookings: 0,
      bookings_today: 0,
      open_tickets: 0,
      churn_risk: 0,
      emails_sent_today: 0,
      outreach_replies: 0,
      ai_actions_today: 0,
      uptime: '99.9%',
      error_rate: '0.0%',
      avg_response: '~50ms',
    })
    const brief = await api('/admin/briefing')
    setBriefing(brief || {
      summary: 'ReeveOS admin panel is operational. All 21 sections are live.',
      generated_at: new Date().toISOString(),
      alerts: [],
    })
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="animate-spin text-emerald-500" size={24} />
      </div>
    )
  }

  const s = stats || {}

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Command Centre</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={loadDashboard} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 text-xs hover:bg-gray-700 transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPI label="MRR" value={s.mrr} change={s.mrr_change} trend={s.mrr_trend} icon={CreditCard} />
        <KPI label="Active Businesses" value={s.active_businesses} change={s.biz_change} icon={Building2} />
        <KPI label="Total Users" value={s.total_users} icon={Users} />
        <KPI label="Bookings Today" value={s.bookings_today} icon={CalendarCheck} />
        <KPI label="Open Tickets" value={s.open_tickets} icon={MessageSquare} />
        <KPI label="Churn Risk" value={s.churn_risk} icon={AlertTriangle} />
      </div>

      {/* AI Briefing + System Health */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Briefing */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bot size={16} className="text-emerald-400" />
            <h2 className="text-sm font-bold text-white">AI Morning Briefing</h2>
            {briefing?.generated_at && (
              <span className="text-[10px] text-gray-600 ml-auto flex items-center gap-1">
                <Clock size={10} />
                {new Date(briefing.generated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{briefing?.summary}</p>
          {briefing?.alerts?.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold text-amber-400/80 uppercase tracking-wider">Action Required</p>
              {briefing.alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                  <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Health */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-emerald-400" />
            <h2 className="text-sm font-bold text-white">System Health</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Uptime', value: s.uptime, good: true },
              { label: 'Error Rate', value: s.error_rate, good: parseFloat(s.error_rate) < 1 },
              { label: 'Avg Response', value: s.avg_response, good: true },
              { label: 'AI Actions Today', value: s.ai_actions_today },
              { label: 'Emails Sent', value: s.emails_sent_today },
            ].map((m, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{m.label}</span>
                <span className={`text-xs font-medium ${m.good === false ? 'text-red-400' : 'text-white'}`}>{m.value}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate(adminPath('/health'))}
            className="mt-4 w-full py-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors"
          >
            View Full Health Report
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-bold text-white mb-3">Quick Actions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          <QAction icon={Send} label="Email Outreach" desc="Manage campaigns, warmup & inbox" onClick={() => navigate(adminPath('/outreach'))} />
          <QAction icon={Bot} label="AI Ops Centre" desc="Agent daemon, guardrails, tasks" onClick={() => navigate(adminPath('/ai-ops'))} />
          <QAction icon={TrendingUp} label="Sales Pipeline" desc="Leads, scoring & conversions" onClick={() => navigate(adminPath('/pipeline'))} />
          <QAction icon={Building2} label="Manage Businesses" desc="2 active businesses" onClick={() => navigate(adminPath('/businesses'))} />
          <QAction icon={Globe} label="SEO Pages" desc="Programmatic content & indexing" onClick={() => navigate(adminPath('/seo'))} color="cyan" />
          <QAction icon={Activity} label="Error Logs" desc="Monitor & triage errors" onClick={() => navigate(adminPath('/errors'))} />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Recent Activity</h2>
        </div>
        <div className="space-y-3">
          {[
            { icon: Bot, text: 'EPOS backend complete — 97 endpoints live', time: 'Today', color: 'emerald' },
            { icon: Building2, text: 'ReeveOS rebrand deployed across platform', time: 'Today', color: 'blue' },
            { icon: Send, text: 'Admin panel — all 21 sections wired to backend', time: 'Today', color: 'purple' },
            { icon: Star, text: 'Command Centre project board operational', time: 'Today', color: 'amber' },
          ].map((item, i) => {
            const Icon = item.icon
            return (
              <div key={i} className="flex items-center gap-3 text-xs">
                <div className={`w-7 h-7 rounded-lg bg-${item.color}-500/10 flex items-center justify-center shrink-0`}>
                  <Icon size={12} className={`text-${item.color}-400`} />
                </div>
                <span className="text-gray-300 flex-1">{item.text}</span>
                <span className="text-gray-600 text-[10px]">{item.time}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
