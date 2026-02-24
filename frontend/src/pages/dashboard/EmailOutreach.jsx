import { useState, useEffect, useCallback } from 'react'
import api from '../../utils/api'

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'fa-gauge-high' },
  { id: 'campaigns', label: 'Campaigns', icon: 'fa-paper-plane' },
  { id: 'inbox', label: 'Inbox', icon: 'fa-inbox' },
  { id: 'accounts', label: 'Accounts & Health', icon: 'fa-server' },
  { id: 'templates', label: 'Templates', icon: 'fa-file-lines' },
  { id: 'analytics', label: 'Analytics', icon: 'fa-chart-pie' },
]

const ANGLES = [
  { id: 'commission_pain', label: 'Commission Pain', desc: 'Save on delivery fees', icon: 'fa-percent' },
  { id: 'booking_friction', label: 'Booking Friction', desc: 'Free booking page', icon: 'fa-calendar-check' },
  { id: 'epos_upgrade', label: 'EPOS Upgrade', desc: 'Modern restaurant tech', icon: 'fa-cash-register' },
  { id: 'visibility_gap', label: 'Visibility Gap', desc: 'Get found on Rezvo', icon: 'fa-eye' },
]

const CLASSIFICATION_STYLES = {
  interested: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: 'fa-face-smile', label: 'INTERESTED' },
  question: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: 'fa-circle-question', label: 'QUESTION' },
  not_interested: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: 'fa-xmark', label: 'NOT INTERESTED' },
  out_of_office: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', icon: 'fa-plane', label: 'OOO' },
  unsubscribe: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: 'fa-ban', label: 'UNSUBSCRIBE' },
  unknown: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', icon: 'fa-question', label: 'UNKNOWN' },
}

export default function EmailOutreach() {
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [replies, setReplies] = useState([])
  const [domains, setDomains] = useState([])
  const [templates, setTemplates] = useState([])
  const [funnel, setFunnel] = useState([])
  const [daily, setDaily] = useState([])
  const [sentiment, setSentiment] = useState(null)
  const [loading, setLoading] = useState(true)

  // Inbox state
  const [selectedReply, setSelectedReply] = useState(null)
  const [thread, setThread] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // Campaign modal
  const [showNewCampaign, setShowNewCampaign] = useState(false)
  const [newCampaign, setNewCampaign] = useState({
    name: '', city: 'Nottingham', cuisine: '', angle: 'commission_pain',
    ai_personalisation: true, assigned_domains: [],
  })
  const [creating, setCreating] = useState(false)

  // ─── Data Loading ─── //

  const loadStats = useCallback(async () => {
    try {
      const data = await api.get('/outreach/stats')
      setStats(data)
    } catch (err) {
      console.error('Failed to load outreach stats:', err)
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      await loadStats()

      if (tab === 'campaigns' || tab === 'overview') {
        const data = await api.get('/outreach/campaigns')
        setCampaigns(data.campaigns || [])
      }
      if (tab === 'inbox' || tab === 'overview') {
        const data = await api.get('/outreach/inbox?limit=20')
        setReplies(data.replies || [])
      }
      if (tab === 'accounts') {
        const data = await api.get('/outreach/domains')
        setDomains(data.domains || [])
      }
      if (tab === 'templates') {
        const data = await api.get('/outreach/templates')
        setTemplates(data.templates || [])
      }
      if (tab === 'analytics') {
        const [f, d, s] = await Promise.all([
          api.get('/outreach/analytics/funnel'),
          api.get('/outreach/analytics/daily'),
          api.get('/outreach/analytics/sentiment'),
        ])
        setFunnel(f.funnel || [])
        setDaily(d.daily || [])
        setSentiment(s)
      }
    } catch (err) {
      console.error('Load error:', err)
    }
    setLoading(false)
  }, [tab, loadStats])

  useEffect(() => { loadData() }, [loadData])

  // ─── Actions ─── //

  const createCampaign = async () => {
    setCreating(true)
    try {
      await api.post('/outreach/campaigns', newCampaign)
      setShowNewCampaign(false)
      setNewCampaign({ name: '', city: 'Nottingham', cuisine: '', angle: 'commission_pain', ai_personalisation: true, assigned_domains: [] })
      const data = await api.get('/outreach/campaigns')
      setCampaigns(data.campaigns || [])
    } catch (err) {
      alert('Failed to create campaign: ' + err.message)
    }
    setCreating(false)
  }

  const launchCampaign = async (id) => {
    try {
      const result = await api.post(`/outreach/campaigns/${id}/launch`)
      alert(result.message || 'Campaign launched')
      const data = await api.get('/outreach/campaigns')
      setCampaigns(data.campaigns || [])
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const pauseCampaign = async (id) => {
    try {
      await api.post(`/outreach/campaigns/${id}/pause`)
      const data = await api.get('/outreach/campaigns')
      setCampaigns(data.campaigns || [])
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const resumeCampaign = async (id) => {
    try {
      await api.post(`/outreach/campaigns/${id}/resume`)
      const data = await api.get('/outreach/campaigns')
      setCampaigns(data.campaigns || [])
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const selectReply = async (reply) => {
    setSelectedReply(reply)
    try {
      const data = await api.get(`/outreach/inbox/${reply._id}`)
      setThread(data)
    } catch (err) {
      console.error('Failed to load thread:', err)
    }
  }

  const sendReplyMessage = async () => {
    if (!replyText.trim() || !selectedReply) return
    setSendingReply(true)
    try {
      const accounts = domains.flatMap(d => d.accounts || []).filter(a => a.status === 'active')
      const fromAccount = accounts[0]?.email || ''
      await api.post(`/outreach/inbox/${selectedReply._id}/reply`, {
        body: replyText,
        from_account: fromAccount,
      })
      setReplyText('')
      await selectReply(selectedReply)
    } catch (err) {
      alert('Failed to send: ' + err.message)
    }
    setSendingReply(false)
  }

  const moveToP = async (replyId) => {
    try {
      await api.post(`/outreach/inbox/${replyId}/move-to-pipeline`)
      alert('Lead moved to sales pipeline')
      const data = await api.get('/outreach/inbox?limit=20')
      setReplies(data.replies || [])
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const seedTemplates = async () => {
    try {
      const result = await api.post('/outreach/seed-templates')
      alert(result.message || 'Templates seeded')
      const data = await api.get('/outreach/templates')
      setTemplates(data.templates || [])
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const triggerWarmup = async () => {
    try {
      const result = await api.post('/outreach/warmup/run')
      alert(`Warmup: ${result.total_sent || 0} emails sent`)
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const triggerProcess = async () => {
    try {
      const result = await api.post('/outreach/process')
      alert(`Processed ${result.campaigns_processed || 0} campaigns`)
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  // ─── Sub-Components ─── //

  const MetricCard = ({ label, value, icon, color = '#1B4332', subtitle }) => (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: color }}>
          <i className={`fas ${icon} text-xs`} />
        </div>
      </div>
      <div className="text-2xl font-extrabold text-gray-900">{value}</div>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )

  const StatusBadge = ({ status }) => {
    const styles = {
      active: 'bg-green-50 text-green-700 border-green-200',
      warming: 'bg-amber-50 text-amber-700 border-amber-200',
      draft: 'bg-gray-100 text-gray-500 border-gray-200',
      paused: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      complete: 'bg-blue-50 text-blue-700 border-blue-200',
    }
    return (
      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[status] || styles.draft}`}>
        {status?.toUpperCase()}
      </span>
    )
  }

  const ClassBadge = ({ classification }) => {
    const s = CLASSIFICATION_STYLES[classification] || CLASSIFICATION_STYLES.unknown
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${s.bg} ${s.text}`}>
        <i className={`fas ${s.icon}`} /> {s.label}
      </span>
    )
  }

  const HealthScore = ({ score }) => {
    const color = score >= 85 ? 'text-green-600' : score >= 60 ? 'text-amber-500' : 'text-red-600'
    return <span className={`text-lg font-black ${color}`}>{score}</span>
  }

  const EmptyState = ({ icon, title, subtitle, action, actionLabel }) => (
    <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
      <i className={`fas ${icon} text-5xl text-gray-200 mb-4`} />
      <h3 className="text-lg font-bold text-gray-400">{title}</h3>
      {subtitle && <p className="text-sm text-gray-400 mt-2">{subtitle}</p>}
      {action && (
        <button onClick={action} className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800">
          {actionLabel}
        </button>
      )}
    </div>
  )

  // ─── RENDER ─── //
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-600 flex items-center justify-center text-white">
              <i className="fas fa-paper-plane text-lg" />
            </span>
            Email Outreach Engine
          </h1>
          <p className="text-sm text-gray-500 mt-1">AI-powered cold outreach • Warmup engine • Unified inbox</p>
        </div>
        <div className="flex items-center gap-3">
          {stats?.warming_accounts > 0 && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> {stats.warming_accounts} Warming
            </span>
          )}
          {stats?.unread_replies > 0 && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
              <i className="fas fa-inbox" /> {stats.unread_replies} Unread
            </span>
          )}
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Engine Active
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className={`fas ${t.icon} text-xs`} /> {t.label}
            {t.id === 'inbox' && stats?.unread_replies > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">{stats.unread_replies}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════ OVERVIEW ═══════════════════════════ */}
      {tab === 'overview' && (
        <div>
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <MetricCard label="Sent Today" value={stats?.sent_today || 0} icon="fa-paper-plane" color="#3b82f6" />
            <MetricCard label="Delivery Rate" value={`${((stats?.delivery_rate || 0) * 100).toFixed(1)}%`} icon="fa-check-double" color="#22c55e" />
            <MetricCard label="Reply Rate" value={`${((stats?.reply_rate || 0) * 100).toFixed(1)}%`} icon="fa-reply" color="#8b5cf6" />
            <MetricCard label="Warm Leads" value={stats?.warm_leads_this_week || 0} icon="fa-fire" color="#f97316" subtitle="This week" />
            <MetricCard label="Bounce Rate" value={`${((stats?.bounce_rate || 0) * 100).toFixed(1)}%`} icon="fa-exclamation"
              color={(stats?.bounce_rate || 0) > 0.02 ? '#dc2626' : '#22c55e'}
              subtitle={(stats?.bounce_rate || 0) <= 0.02 ? '✓ Under 2% limit' : '⚠ Above threshold'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Campaigns */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg text-gray-900">Active Campaigns</h2>
                <button onClick={() => setShowNewCampaign(true)} className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800">
                  <i className="fas fa-plus mr-1" /> New Campaign
                </button>
              </div>
              <div className="space-y-3">
                {campaigns.filter(c => ['active', 'warming'].includes(c.status)).map((c, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={c.status} />
                        <h3 className="font-bold text-gray-900 text-sm">{c.name}</h3>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center"><span className="font-bold text-gray-900">{c.total_sent || 0}</span><span className="text-xs text-gray-400 ml-1">sent</span></div>
                        <div className="text-center"><span className="font-bold text-gray-900">{((c.open_rate || 0) * 100).toFixed(0)}%</span><span className="text-xs text-gray-400 ml-1">opens</span></div>
                        <div className="text-center"><span className="font-bold text-green-600">{((c.reply_rate || 0) * 100).toFixed(1)}%</span><span className="text-xs text-gray-400 ml-1">replies</span></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className={`h-full rounded-full ${c.status === 'warming' ? 'bg-amber-400' : 'bg-green-500'}`}
                          style={{ width: `${c.total_leads > 0 ? Math.round((c.leads_contacted || 0) / c.total_leads * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{c.total_leads > 0 ? Math.round((c.leads_contacted || 0) / c.total_leads * 100) : 0}%</span>
                    </div>
                  </div>
                ))}
                {campaigns.filter(c => ['active', 'warming'].includes(c.status)).length === 0 && (
                  <EmptyState icon="fa-paper-plane" title="No active campaigns" subtitle="Create your first campaign to start reaching restaurants" action={() => setShowNewCampaign(true)} actionLabel="Create Campaign" />
                )}
              </div>
            </div>

            {/* Right sidebar: Recent Replies + Monthly Stats */}
            <div className="space-y-6">
              {/* Recent Replies */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900 text-sm">Recent Replies</h3>
                  <button onClick={() => setTab('inbox')} className="text-xs font-bold text-emerald-700 hover:underline">VIEW ALL</button>
                </div>
                <div className="space-y-3">
                  {replies.slice(0, 4).map((r, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => { setTab('inbox'); setSelectedReply(r); selectReply(r); }}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${CLASSIFICATION_STYLES[r.classification]?.bg} ${CLASSIFICATION_STYLES[r.classification]?.text}`}>
                        <i className={`fas ${CLASSIFICATION_STYLES[r.classification]?.icon}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-gray-900 truncate">{r.from_name || r.from_email}</p>
                          <ClassBadge classification={r.classification} />
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-1">{r.body_text?.substring(0, 80)}</p>
                      </div>
                    </div>
                  ))}
                  {replies.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No replies yet</p>}
                </div>
              </div>

              {/* Monthly Stats */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">This Month</h3>
                <div className="space-y-3">
                  {[
                    ['Total Sent', stats?.monthly_sent || 0],
                    ['Unique Leads', stats?.unique_leads_contacted || 0],
                    ['Positive Replies', stats?.positive_replies || 0, 'text-green-600'],
                    ['Active Campaigns', stats?.active_campaigns || 0],
                  ].map(([label, value, cls], i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{label}</span>
                      <span className={`font-bold ${cls || 'text-gray-900'}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button onClick={triggerProcess} className="w-full py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50">
                    <i className="fas fa-play mr-2" />Process Campaign Sends
                  </button>
                  <button onClick={triggerWarmup} className="w-full py-2 rounded-lg border border-amber-200 text-xs font-bold text-amber-700 hover:bg-amber-50">
                    <i className="fas fa-temperature-half mr-2" />Run Warmup Cycle
                  </button>
                  <button onClick={seedTemplates} className="w-full py-2 rounded-lg border border-purple-200 text-xs font-bold text-purple-700 hover:bg-purple-50">
                    <i className="fas fa-sparkles mr-2" />Seed Default Templates
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════ CAMPAIGNS ═══════════════════════════ */}
      {tab === 'campaigns' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-lg text-gray-900">All Campaigns</h2>
            <button onClick={() => setShowNewCampaign(true)} className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800">
              <i className="fas fa-plus mr-1" /> New Campaign
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map((c, i) => (
              <div key={i} className={`bg-white rounded-2xl border p-6 ${c.status === 'draft' ? 'border-dashed border-gray-300' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <StatusBadge status={c.status} />
                  <span className="text-xs text-gray-400">{c.started_at ? new Date(c.started_at).toLocaleDateString() : 'Draft'}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{c.name}</h3>
                <p className="text-xs text-gray-400 mb-4">{c.city} • {c.angle?.replace('_', ' ')} • {c.total_leads || 0} leads</p>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    ['Leads', c.total_leads || 0],
                    ['Sent', c.total_sent || 0],
                    ['Opens', c.total_sent > 0 ? `${((c.open_rate || 0) * 100).toFixed(0)}%` : '—'],
                    ['Replies', c.total_sent > 0 ? `${((c.reply_rate || 0) * 100).toFixed(1)}%` : '—'],
                  ].map(([label, val], j) => (
                    <div key={j} className="text-center">
                      <div className={`text-lg font-bold ${j === 3 && c.total_sent > 0 ? 'text-green-600' : 'text-gray-900'}`}>{val}</div>
                      <div className="text-[10px] text-gray-400">{label}</div>
                    </div>
                  ))}
                </div>
                {c.status === 'warming' && (
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                    <div className="bg-amber-400 h-full rounded-full" style={{ width: '21%' }} />
                  </div>
                )}
                <div className="flex gap-2">
                  {c.status === 'draft' && (
                    <>
                      <button className="flex-1 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50">EDIT</button>
                      <button onClick={() => launchCampaign(c._id)} className="flex-1 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800">LAUNCH</button>
                    </>
                  )}
                  {c.status === 'active' && (
                    <>
                      <button onClick={() => pauseCampaign(c._id)} className="flex-1 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50">PAUSE</button>
                      <button className="flex-1 py-2 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-50">DETAILS</button>
                    </>
                  )}
                  {c.status === 'paused' && (
                    <button onClick={() => resumeCampaign(c._id)} className="flex-1 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800">RESUME</button>
                  )}
                </div>
              </div>
            ))}

            {/* Create placeholder */}
            <div onClick={() => setShowNewCampaign(true)} className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center min-h-[260px] cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all">
              <div className="w-12 h-12 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center mb-3">
                <i className="fas fa-plus text-lg" />
              </div>
              <p className="text-sm font-medium text-gray-500">Create New Campaign</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════ INBOX ═══════════════════════════ */}
      {tab === 'inbox' && (
        <div className="flex gap-6" style={{ height: 'calc(100vh - 280px)' }}>
          {/* Reply List */}
          <div className="w-96 shrink-0 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-gray-900">Unified Inbox</h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-2">
              {replies.map((r, i) => (
                <div
                  key={i}
                  onClick={() => selectReply(r)}
                  className={`rounded-xl p-4 cursor-pointer transition-all border-l-4 ${
                    selectedReply?._id === r._id
                      ? 'bg-white shadow-sm border-emerald-600'
                      : 'bg-white hover:bg-gray-50 border-transparent'
                  } ${['out_of_office', 'not_interested', 'unsubscribe'].includes(r.classification) ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-gray-900 truncate">{r.restaurant_name || r.from_name || r.from_email}</p>
                    <span className="text-[10px] text-gray-400 shrink-0">{r.received_at ? new Date(r.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2 mb-2">{r.body_text?.substring(0, 100)}</p>
                  <ClassBadge classification={r.classification} />
                </div>
              ))}
              {replies.length === 0 && <EmptyState icon="fa-inbox" title="No replies yet" subtitle="Replies to your outreach will appear here" />}
            </div>
          </div>

          {/* Thread View */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden">
            {selectedReply && thread ? (
              <>
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedReply.restaurant_name || selectedReply.from_name}</h3>
                    <p className="text-xs text-gray-400">{selectedReply.from_email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ClassBadge classification={selectedReply.classification} />
                    {selectedReply.classification === 'interested' && !selectedReply.moved_to_pipeline && (
                      <button onClick={() => moveToP(selectedReply._id)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                        <i className="fas fa-crosshairs mr-1" />Move to Pipeline
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {/* Our sends */}
                  {thread.thread_sends?.map((s, i) => (
                    <div key={`send-${i}`} className="flex justify-end">
                      <div className="max-w-[70%]">
                        <div className="bg-gray-900 text-white p-4 rounded-2xl rounded-br-sm text-sm leading-relaxed whitespace-pre-line">{s.body_text || s.body_html?.replace(/<[^>]+>/g, '')}</div>
                        <p className="text-[10px] text-gray-400 text-right mt-1">via {s.account_email} • {s.sent_at ? new Date(s.sent_at).toLocaleString() : ''}</p>
                      </div>
                    </div>
                  ))}
                  {/* Their replies */}
                  {thread.thread_replies?.map((r, i) => (
                    <div key={`reply-${i}`}>
                      <div className="flex justify-start">
                        <div className="max-w-[70%]">
                          <div className="bg-gray-100 text-gray-900 p-4 rounded-2xl rounded-bl-sm text-sm leading-relaxed whitespace-pre-line">{r.body_text}</div>
                          <p className="text-[10px] text-gray-400 mt-1">{r.from_name || r.from_email} • {r.received_at ? new Date(r.received_at).toLocaleString() : ''}</p>
                        </div>
                      </div>
                      {/* AI note */}
                      {r.classification_reasoning && (
                        <div className="flex justify-center my-3">
                          <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-2 flex items-center gap-2 max-w-md">
                            <i className="fas fa-sparkles text-purple-500 text-xs" />
                            <p className="text-xs text-purple-700"><strong>AI:</strong> {r.classification_reasoning}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Reply composer */}
                <div className="p-4 border-t border-gray-100 shrink-0">
                  <div className="flex gap-3">
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      rows={3}
                      placeholder="Type your reply..."
                      className="flex-1 border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <button
                      onClick={sendReplyMessage}
                      disabled={sendingReply || !replyText.trim()}
                      className="px-5 py-2 self-end rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 disabled:bg-gray-300"
                    >
                      {sendingReply ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane mr-1" /> Send</>}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <i className="fas fa-inbox text-4xl mb-3" />
                  <p className="text-sm">Select a reply to view the conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════ ACCOUNTS & HEALTH ═══════════════════════════ */}
      {tab === 'accounts' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-lg text-gray-900">Sending Domains & Account Health</h2>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {domains.map((d, i) => (
              <div key={i} className={`bg-white rounded-2xl border p-6 ${d.status === 'warming' ? 'border-amber-200 border-2' : 'border-gray-100'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{d.domain}</h3>
                    <p className="text-xs text-gray-400">{d.status === 'warming' ? `Warming — Day ${d.warmup_day || 0}` : 'Verified'}</p>
                  </div>
                  <StatusBadge status={d.status === 'active' ? 'active' : d.status} />
                </div>

                {/* DNS */}
                <div className="space-y-2 mb-5">
                  {[['SPF', d.spf_verified], ['DKIM', d.dkim_verified], ['DMARC', d.dmarc_verified]].map(([name, ok], j) => (
                    <div key={j} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <i className={`fas ${ok ? 'fa-check-circle text-green-500' : 'fa-times-circle text-red-400'}`} /> {name}
                      </span>
                      <span className={ok ? 'text-green-600 font-medium' : 'text-red-400'}>
                        {ok ? 'Verified' : 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Accounts */}
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">ACCOUNTS ({d.accounts?.length || 0})</p>
                <div className="space-y-2">
                  {(d.accounts || []).map((a, j) => (
                    <div key={j} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-gray-900">{a.email}</p>
                        <p className="text-[10px] text-gray-400">{a.sent_today || 0}/{a.daily_limit || 30} sent today</p>
                      </div>
                      <HealthScore score={a.health_score || 50} />
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-400">{d.sent_today || 0} / {d.max_daily_limit || 150} daily capacity</p>
                </div>
              </div>
            ))}

            {domains.length === 0 && (
              <div className="xl:col-span-3">
                <EmptyState icon="fa-server" title="No outreach domains configured" subtitle="Add your first domain and accounts to start sending" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════ TEMPLATES ═══════════════════════════ */}
      {tab === 'templates' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-lg text-gray-900">Email Templates</h2>
            <div className="flex gap-2">
              <button onClick={seedTemplates} className="px-4 py-2 rounded-xl text-xs font-bold border border-purple-200 text-purple-700 hover:bg-purple-50">
                <i className="fas fa-sparkles mr-1" /> Seed Defaults
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {templates.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{t.name}</h3>
                    <p className="text-xs text-gray-400">{t.category} • Step {t.step_number}</p>
                  </div>
                  <div className="flex gap-2">
                    {t.reply_rate > 0 && (
                      <span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded">{(t.reply_rate * 100).toFixed(1)}% reply</span>
                    )}
                    {t.open_rate > 0 && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded">{(t.open_rate * 100).toFixed(0)}% open</span>
                    )}
                    {t.angle && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded">{t.angle.replace('_', ' ')}</span>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 leading-relaxed font-mono">
                  <p className="text-gray-400 mb-2">Subject: {t.subject}</p>
                  <p className="whitespace-pre-line line-clamp-6">{t.body_text || t.body_html?.replace(/<[^>]+>/g, '')}</p>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {(t.variables || []).slice(0, 5).map((v, j) => (
                    <span key={j} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded font-mono">{`{${v}}`}</span>
                  ))}
                  {(t.variables || []).length > 5 && <span className="text-[10px] text-gray-400">+{t.variables.length - 5} more</span>}
                </div>
              </div>
            ))}

            {templates.length === 0 && (
              <div className="lg:col-span-2">
                <EmptyState icon="fa-file-lines" title="No templates yet" subtitle="Seed defaults to get started with proven outreach sequences" action={seedTemplates} actionLabel="Seed Default Templates" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════ ANALYTICS ═══════════════════════════ */}
      {tab === 'analytics' && (
        <div>
          <h2 className="font-bold text-lg text-gray-900 mb-6">Outreach Analytics</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Funnel */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Outreach Funnel — 30 Days</h3>
              <div className="space-y-2">
                {funnel.map((f, i) => {
                  const maxCount = Math.max(...funnel.map(x => x.count), 1)
                  const pct = (f.count / maxCount) * 100
                  const colors = ['#e5e7eb', '#e5e7eb', '#e5e7eb', '#9ca3af', '#6b7280', '#1B4332', '#22c55e', '#22c55e']
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-28 text-right shrink-0">{f.stage}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                        <div className="h-full rounded-full flex items-center px-3" style={{ width: `${Math.max(pct, 8)}%`, background: colors[i] || '#e5e7eb' }}>
                          <span className="text-[10px] font-bold text-white">{f.count.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Sentiment */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Reply Sentiment</h3>
              {sentiment ? (
                <div className="space-y-3">
                  <div className="text-center mb-4">
                    <span className="text-4xl font-black text-gray-900">{sentiment.total_replies || 0}</span>
                    <span className="text-sm text-gray-400 ml-2">total replies</span>
                  </div>
                  {Object.entries(sentiment.sentiment || {}).map(([cls, count], i) => {
                    const s = CLASSIFICATION_STYLES[cls] || CLASSIFICATION_STYLES.unknown
                    const pct = sentiment.percentages?.[cls] || 0
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`text-xs font-bold w-28 text-right ${s.text}`}>{s.label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-5">
                          <div className={`h-full rounded-full ${s.bg} flex items-center px-2`} style={{ width: `${Math.max(pct, 5)}%` }}>
                            <span className={`text-[10px] font-bold ${s.text}`}>{count}</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 w-10">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
              )}
            </div>
          </div>

          {/* Daily Performance */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Daily Performance — 14 Days</h3>
            {daily.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Date', 'Sent', 'Delivered', 'Opened', 'Replied', 'Bounced'].map((h, i) => (
                        <th key={i} className="py-2 px-3 text-xs font-bold text-gray-400 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((d, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-xs text-gray-600">{d.date}</td>
                        <td className="py-2 px-3 font-bold">{d.sent}</td>
                        <td className="py-2 px-3 text-green-600">{d.delivered}</td>
                        <td className="py-2 px-3 text-blue-600">{d.opened}</td>
                        <td className="py-2 px-3 text-emerald-600 font-bold">{d.replied}</td>
                        <td className="py-2 px-3 text-red-500">{d.bounced}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No send data yet</p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════ NEW CAMPAIGN MODAL ═══════════════════════════ */}
      {showNewCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowNewCampaign(false)}>
          <div className="bg-white rounded-2xl w-full max-w-xl mx-4 max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-900">New Outreach Campaign</h2>
              <button onClick={() => setShowNewCampaign(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
                <i className="fas fa-xmark text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Campaign Name</label>
                <input type="text" value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="e.g. Nottingham Curry Houses Q1"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              {/* City + Cuisine */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">City</label>
                  <select value={newCampaign.city} onChange={e => setNewCampaign({ ...newCampaign, city: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {['Nottingham', 'Birmingham', 'Manchester', 'London', 'Sheffield', 'Cardiff'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Cuisine (optional)</label>
                  <select value={newCampaign.cuisine} onChange={e => setNewCampaign({ ...newCampaign, cuisine: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">All Cuisines</option>
                    {['Indian', 'Italian', 'Turkish', 'Chinese', 'British', 'Thai', 'Mexican'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {/* Angle */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Outreach Angle</label>
                <div className="grid grid-cols-2 gap-3">
                  {ANGLES.map(a => (
                    <label key={a.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                      newCampaign.angle === a.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="radio" name="angle" checked={newCampaign.angle === a.id} onChange={() => setNewCampaign({ ...newCampaign, angle: a.id })} className="accent-emerald-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.label}</p>
                        <p className="text-[10px] text-gray-400">{a.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {/* AI personalisation */}
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <i className="fas fa-sparkles text-purple-500" />
                  <div>
                    <p className="text-sm font-medium text-purple-800">AI Personalisation</p>
                    <p className="text-xs text-purple-600">Claude writes unique emails per lead using Google Places data</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={newCampaign.ai_personalisation} onChange={e => setNewCampaign({ ...newCampaign, ai_personalisation: e.target.checked })} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-200 peer-checked:bg-purple-500 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-between items-center sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setShowNewCampaign(false)} className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={createCampaign} disabled={creating || !newCampaign.name.trim()} className="px-6 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-bold hover:bg-emerald-800 disabled:bg-gray-300">
                {creating ? <><i className="fas fa-spinner fa-spin mr-2" />Creating...</> : <><i className="fas fa-rocket mr-1" /> Create Campaign</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
