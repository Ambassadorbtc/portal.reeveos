import { useState, useEffect, useCallback } from 'react'
import api from '../../utils/api'

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'fa-gauge-high' },
  { id: 'tasks', label: 'Task Control', icon: 'fa-list-check' },
  { id: 'approvals', label: 'Approvals', icon: 'fa-shield-check' },
  { id: 'leads', label: 'Sales Pipeline', icon: 'fa-funnel-dollar' },
  { id: 'churn', label: 'Churn Risk', icon: 'fa-heart-pulse' },
  { id: 'seo', label: 'SEO Pages', icon: 'fa-file-lines' },
  { id: 'audit', label: 'Audit Log', icon: 'fa-scroll' },
  { id: 'ask', label: 'Ask Agent', icon: 'fa-brain' },
]

const TASK_NAMES = [
  { id: 'health_check', label: 'Health Check', icon: 'fa-heartbeat', desc: 'System health + error analysis' },
  { id: 'ticket_triage', label: 'Ticket Triage', icon: 'fa-ticket', desc: 'Auto-respond to support tickets' },
  { id: 'review_moderation', label: 'Review Mod', icon: 'fa-star', desc: 'Moderate pending reviews' },
  { id: 'daily_briefing', label: 'Daily Briefing', icon: 'fa-newspaper', desc: 'Generate + email ops report' },
  { id: 'churn_scoring', label: 'Churn Scoring', icon: 'fa-chart-line', desc: 'Score all businesses for risk' },
  { id: 'lead_discovery', label: 'Lead Discovery', icon: 'fa-magnifying-glass', desc: 'Find restaurants via Google Places' },
  { id: 'lead_research', label: 'Lead Research', icon: 'fa-flask', desc: 'AI research + draft outreach' },
  { id: 'dunning', label: 'Dunning', icon: 'fa-credit-card', desc: 'Payment failure recovery emails' },
  { id: 'seo_content', label: 'SEO Content', icon: 'fa-file-code', desc: 'Generate directory pages' },
  { id: 'onboarding_drip', label: 'Onboarding', icon: 'fa-envelope-open', desc: 'New restaurant drip emails' },
  { id: 'knowledge_learning', label: 'KB Learning', icon: 'fa-graduation-cap', desc: 'Learn from chat conversations' },
]

export default function AIOps() {
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [audit, setAudit] = useState([])
  const [approvals, setApprovals] = useState([])
  const [leads, setLeads] = useState([])
  const [churn, setChurn] = useState(null)
  const [seoPages, setSeoPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [runningTask, setRunningTask] = useState(null)
  const [taskResult, setTaskResult] = useState(null)
  const [askQuestion, setAskQuestion] = useState('')
  const [askResult, setAskResult] = useState(null)
  const [asking, setAsking] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/agent/stats')
      setStats(res.data)
    } catch (err) {
      console.error('Failed to load agent stats:', err)
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      await loadStats()
      
      if (tab === 'audit') {
        const res = await api.get('/agent/audit?limit=50')
        setAudit(res.data.logs || [])
      } else if (tab === 'approvals') {
        const res = await api.get('/agent/approvals')
        setApprovals(res.data.approvals || [])
      } else if (tab === 'leads') {
        const res = await api.get('/agent/leads?limit=50')
        setLeads(res.data.leads || [])
      } else if (tab === 'churn') {
        const res = await api.get('/agent/churn')
        setChurn(res.data)
      } else if (tab === 'seo') {
        const res = await api.get('/agent/seo-pages')
        setSeoPages(res.data.pages || [])
      }
    } catch (err) {
      console.error('Load error:', err)
    }
    setLoading(false)
  }, [tab, loadStats])

  useEffect(() => { loadData() }, [loadData])

  const runTask = async (taskId) => {
    setRunningTask(taskId)
    setTaskResult(null)
    try {
      const res = await api.post('/agent/run-task', { task: taskId })
      setTaskResult({ task: taskId, ...res.data })
      await loadStats()
    } catch (err) {
      setTaskResult({ task: taskId, error: err.response?.data?.detail || err.message })
    }
    setRunningTask(null)
  }

  const handleApproval = async (id, action) => {
    try {
      await api.post(`/agent/approvals/${id}`, { action })
      const res = await api.get('/agent/approvals')
      setApprovals(res.data.approvals || [])
      await loadStats()
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.detail || err.message))
    }
  }

  const askAgent = async () => {
    if (!askQuestion.trim()) return
    setAsking(true)
    setAskResult(null)
    try {
      const res = await api.post('/agent/ask', { question: askQuestion })
      setAskResult(res.data)
    } catch (err) {
      setAskResult({ result: 'Error: ' + (err.response?.data?.detail || err.message) })
    }
    setAsking(false)
  }

  const publishSeoPage = async (pageId) => {
    try {
      await api.put(`/agent/seo-pages/${pageId}/publish`)
      const res = await api.get('/agent/seo-pages')
      setSeoPages(res.data.pages || [])
    } catch (err) {
      alert('Failed to publish')
    }
  }

  // ─── Stat Card ─── //
  const StatCard = ({ label, value, icon, color = '#111111' }) => (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: color }}>
        <i className={`fas ${icon} text-sm`} />
      </div>
      <div>
        <div className="text-2xl font-extrabold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-600 flex items-center justify-center text-white">
              <i className="fas fa-robot text-lg" />
            </span>
            AI Ops Centre
          </h1>
          <p className="text-sm text-gray-500 mt-1">Autonomous platform management • 11 scheduled tasks • Three-tier guardrails</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Agent Active
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
            {t.id === 'approvals' && stats?.pending_approvals > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">{stats.pending_approvals}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {tab === 'overview' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Tasks (24h)" value={stats?.runs_24h || 0} icon="fa-bolt" color="#111111" />
            <StatCard label="Tasks (7d)" value={stats?.runs_7d || 0} icon="fa-chart-bar" color="#1a1a1a" />
            <StatCard label="Tokens (7d)" value={(stats?.tokens_7d || 0).toLocaleString()} icon="fa-microchip" color="#40916C" />
            <StatCard label="Cost (7d)" value={`$${(stats?.estimated_cost_7d_usd || 0).toFixed(2)}`} icon="fa-sterling-sign" color="#52B788" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Pending Approvals" value={stats?.pending_approvals || 0} icon="fa-shield-halved" color={stats?.pending_approvals > 0 ? '#dc2626' : '#6b7280'} />
            <StatCard label="Emails Sent (24h)" value={stats?.emails_sent_24h || 0} icon="fa-envelope" color="#0A66C2" />
            <StatCard label="Leads (7d)" value={stats?.leads_7d || 0} icon="fa-user-plus" color="#9333ea" />
            <StatCard label="Health" value="✓" icon="fa-heart" color="#10b981" />
          </div>

          {/* Task Breakdown */}
          {stats?.task_breakdown?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <h3 className="font-bold text-gray-900 mb-4">Task Breakdown (7 days)</h3>
              <div className="space-y-3">
                {stats.task_breakdown.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{t.task}</span>
                    <div className="flex items-center gap-4 text-gray-500">
                      <span>{t.runs} runs</span>
                      <span>{t.tokens.toLocaleString()} tokens</span>
                      <span>{t.avg_duration_sec}s avg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Latest Health */}
          {stats?.latest_health && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-3">Latest Health Check</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">{stats.latest_health}</p>
            </div>
          )}

          {/* Empty state */}
          {!stats?.runs_7d && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <i className="fas fa-robot text-5xl text-gray-200 mb-4" />
              <h3 className="text-lg font-bold text-gray-400">Agent hasn't run yet</h3>
              <p className="text-sm text-gray-400 mt-2">Go to Task Control and trigger your first task manually, or wait for the scheduler to kick in.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ TASK CONTROL ═══ */}
      {tab === 'tasks' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TASK_NAMES.map(task => {
              const schedule = stats?.task_schedule?.find(s => s.name === task.id)
              return (
                <div key={task.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <i className={`fas ${task.icon} text-emerald-700`} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{task.label}</h4>
                        <p className="text-xs text-gray-500">{task.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => runTask(task.id)}
                      disabled={runningTask === task.id}
                      className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all ${
                        runningTask === task.id ? 'bg-gray-400' : 'bg-emerald-700 hover:bg-emerald-800'
                      }`}
                    >
                      {runningTask === task.id ? (
                        <><i className="fas fa-spinner fa-spin mr-1" /> Running...</>
                      ) : (
                        <><i className="fas fa-play mr-1" /> Run Now</>
                      )}
                    </button>
                  </div>
                  {schedule && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                      <span>Every {schedule.interval_minutes} min</span>
                      {schedule.daily_only && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600">Daily at {schedule.run_at_hour}:00</span>}
                      {schedule.last_run && <span>Last: {new Date(schedule.last_run).toLocaleTimeString()}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Task Result */}
          {taskResult && (
            <div className={`mt-6 rounded-2xl border p-6 ${taskResult.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <h3 className="font-bold mb-2">{taskResult.task} — {taskResult.error ? '❌ Error' : '✅ Complete'}</h3>
              <pre className="text-sm whitespace-pre-wrap">{taskResult.error || JSON.stringify(taskResult.result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* ═══ APPROVALS ═══ */}
      {tab === 'approvals' && (
        <div>
          {approvals.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <i className="fas fa-shield-check text-5xl text-gray-200 mb-4" />
              <h3 className="text-lg font-bold text-gray-400">No pending approvals</h3>
              <p className="text-sm text-gray-400">The agent handles most things automatically. High-stakes actions land here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvals.map((a, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 mb-2">
                        ⚠️ Requires Approval
                      </span>
                      <h4 className="font-bold text-gray-900">{a.tool}</h4>
                      <p className="text-sm text-gray-500 mt-1">{a.task}</p>
                      <pre className="text-xs bg-gray-50 rounded-lg p-3 mt-3 overflow-x-auto">{JSON.stringify(a.input, null, 2)}</pre>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <button
                        onClick={() => handleApproval(a._id, 'approve')}
                        className="px-4 py-2 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => handleApproval(a._id, 'reject')}
                        className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">{a.created_at}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ SALES PIPELINE ═══ */}
      {tab === 'leads' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Sales Pipeline</h2>
            <button
              onClick={() => runTask('lead_discovery')}
              disabled={runningTask === 'lead_discovery'}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-700 text-white hover:bg-emerald-800"
            >
              {runningTask === 'lead_discovery' ? '⏳ Discovering...' : '🔍 Discover Leads'}
            </button>
          </div>

          {/* Pipeline stages */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
            {['new', 'researched', 'contacted', 'engaged', 'converted', 'dead'].map(status => {
              const count = leads.filter(l => l.status === status).length
              const colors = { new: 'blue', researched: 'purple', contacted: 'yellow', engaged: 'emerald', converted: 'green', dead: 'gray' }
              return (
                <div key={status} className={`bg-${colors[status]}-50 rounded-xl p-3 text-center border border-${colors[status]}-200`}>
                  <div className="text-xl font-extrabold">{count}</div>
                  <div className="text-xs text-gray-600 capitalize">{status}</div>
                </div>
              )
            })}
          </div>

          {/* Lead list */}
          <div className="space-y-3">
            {leads.map((lead, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 text-sm">{lead.name}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{lead.status}</span>
                    {lead.score > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        lead.score >= 60 ? 'bg-green-50 text-green-700' : lead.score >= 30 ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-500'
                      }`}>
                        Score: {lead.score}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{lead.address || lead.city}</p>
                  {lead.rating && <span className="text-xs text-gray-400">⭐ {lead.rating} ({lead.review_count} reviews)</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Website</a>}
                  {lead.phone && <span>{lead.phone}</span>}
                </div>
              </div>
            ))}
          </div>

          {leads.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <i className="fas fa-funnel-dollar text-5xl text-gray-200 mb-4" />
              <h3 className="text-lg font-bold text-gray-400">No leads yet</h3>
              <p className="text-sm text-gray-400">Hit "Discover Leads" to find restaurants via Google Places</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ CHURN RISK ═══ */}
      {tab === 'churn' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Churn Risk Dashboard</h2>
            <button
              onClick={() => runTask('churn_scoring')}
              disabled={runningTask === 'churn_scoring'}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-700 text-white"
            >
              {runningTask === 'churn_scoring' ? '⏳ Scoring...' : '🔄 Re-score All'}
            </button>
          </div>

          {churn && (
            <>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard label="Critical (80+)" value={churn.critical} icon="fa-skull-crossbones" color="#dc2626" />
                <StatCard label="High (60-79)" value={churn.high} icon="fa-exclamation-triangle" color="#f59e0b" />
                <StatCard label="Medium (40-59)" value={churn.medium} icon="fa-eye" color="#3b82f6" />
                <StatCard label="Low (<40)" value={churn.low} icon="fa-check-circle" color="#10b981" />
              </div>

              {churn.at_risk_businesses?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <h3 className="font-bold mb-4">At-Risk Businesses</h3>
                  <div className="space-y-3">
                    {churn.at_risk_businesses.map((biz, i) => (
                      <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                        <div>
                          <h4 className="font-bold text-sm">{biz.business_name || biz.business_id}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{biz.plan}</span>
                            {biz.signals?.map((s, j) => (
                              <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">{s}</span>
                            ))}
                          </div>
                        </div>
                        <div className={`text-2xl font-black ${
                          biz.score >= 80 ? 'text-red-600' : biz.score >= 60 ? 'text-amber-500' : 'text-blue-500'
                        }`}>
                          {biz.score}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ SEO PAGES ═══ */}
      {tab === 'seo' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Generated SEO Pages</h2>
            <button
              onClick={() => runTask('seo_content')}
              disabled={runningTask === 'seo_content'}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-700 text-white"
            >
              {runningTask === 'seo_content' ? '⏳ Generating...' : '✨ Generate Pages'}
            </button>
          </div>

          <div className="space-y-3">
            {seoPages.map((page, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{page.cuisine} restaurants in {page.city}</h4>
                    <p className="text-xs text-gray-400 mt-1">/{page.slug}</p>
                    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full mt-2 ${
                      page.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {page.status}
                    </span>
                  </div>
                  {page.status !== 'published' && (
                    <button
                      onClick={() => publishSeoPage(page._id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white"
                    >
                      Publish
                    </button>
                  )}
                </div>
                <details className="mt-3">
                  <summary className="text-xs text-blue-600 cursor-pointer">Preview content</summary>
                  <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{page.content?.substring(0, 500)}...</pre>
                </details>
              </div>
            ))}
          </div>

          {seoPages.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <i className="fas fa-file-lines text-5xl text-gray-200 mb-4" />
              <h3 className="text-lg font-bold text-gray-400">No SEO pages generated yet</h3>
              <p className="text-sm text-gray-400">Hit "Generate Pages" to create directory content</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ AUDIT LOG ═══ */}
      {tab === 'audit' && (
        <div>
          <h2 className="font-bold text-lg mb-4">Agent Audit Log</h2>
          <div className="space-y-2">
            {audit.map((log, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">{log.task_type}</span>
                    <span className="text-xs text-gray-400">{log.tokens_used} tokens • {log.duration_seconds}s</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{log.result}</p>
                {log.tool_calls_count > 0 && (
                  <span className="text-xs text-gray-400 mt-1 inline-block">{log.tool_calls_count} tool calls</span>
                )}
              </div>
            ))}
          </div>

          {audit.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <i className="fas fa-scroll text-5xl text-gray-200 mb-4" />
              <h3 className="text-lg font-bold text-gray-400">No audit logs yet</h3>
            </div>
          )}
        </div>
      )}

      {/* ═══ ASK AGENT ═══ */}
      {tab === 'ask' && (
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <h2 className="font-bold text-lg mb-2">Ask the Agent</h2>
            <p className="text-sm text-gray-500 mb-4">Ask anything about your platform. The agent can query bookings, revenue, support tickets, leads, and more.</p>
            <div className="flex gap-3">
              <input
                value={askQuestion}
                onChange={e => setAskQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && askAgent()}
                placeholder="e.g. What's our MRR and how many restaurants are at risk of churning?"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={askAgent}
                disabled={asking}
                className="px-6 py-3 rounded-xl bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800 disabled:bg-gray-400"
              >
                {asking ? <><i className="fas fa-spinner fa-spin mr-2" />Thinking...</> : <><i className="fas fa-brain mr-2" />Ask</>}
              </button>
            </div>

            {/* Quick questions */}
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                "What's our current MRR?",
                "How many open support tickets?",
                "Any system health issues?",
                "Which businesses are at risk?",
                "How many leads did we find this week?",
                "What's our email open rate?",
                "Generate today's briefing",
              ].map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setAskQuestion(q); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {askResult && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Agent Response</h3>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{askResult.tokens_used} tokens</span>
                  <span>{askResult.duration}s</span>
                  {askResult.tool_calls?.length > 0 && <span>{askResult.tool_calls.length} tool calls</span>}
                </div>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-line">{askResult.result}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
