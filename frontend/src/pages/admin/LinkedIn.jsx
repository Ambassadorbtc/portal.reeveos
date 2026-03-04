/**
 * LinkedIn AI Autopilot — Content engine following Lara Acosta's playbook
 * 4-3-2-1 system: 4 posts/week, 3 pillars, 2 frameworks, 1 brand voice
 */
import { useState, useEffect, useCallback } from 'react'
import api from '../../utils/api'

const PILLARS = {
  growth: { label: 'Growth', color: '#111111', bg: '#d1fae5', desc: 'Rezvo-specific stories' },
  tam: { label: 'TAM', color: '#1e40af', bg: '#dbeafe', desc: 'Broad industry content' },
  sales: { label: 'Sales', color: '#9333ea', bg: '#f3e8ff', desc: 'Direct pitch / CTA' },
}

const FRAMEWORKS = {
  slay: { label: 'SLAY', desc: 'Story → Lesson → Actionable → You' },
  pas: { label: 'PAS', desc: 'Problem → Agitate → Solution' },
}

const TONES = [
  { value: 'default', label: 'Default', icon: '—' },
  { value: 'bold', label: 'Bold', icon: '—' },
  { value: 'vulnerable', label: 'Vulnerable', icon: '—' },
  { value: 'data-driven', label: 'Data-Driven', icon: '—' },
  { value: 'story-heavy', label: 'Story-Heavy', icon: '—' },
]

const TABS = [
  { id: 'calendar', label: 'Content Calendar', icon: 'fa-calendar-week' },
  { id: 'generate', label: 'Generate Post', icon: 'fa-wand-magic-sparkles' },
  { id: 'trends', label: 'Trend Scanner', icon: 'fa-bolt' },
  { id: 'posts', label: 'All Posts', icon: 'fa-layer-group' },
  { id: 'analytics', label: 'Analytics', icon: 'fa-chart-bar' },
]

const LinkedIn = () => {
  const [tab, setTab] = useState('calendar')
  const [posts, setPosts] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [trends, setTrends] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [copied, setCopied] = useState(null)
  const [editingPost, setEditingPost] = useState(null)
  const [editText, setEditText] = useState('')

  // Generate form state
  const [genPillar, setGenPillar] = useState('tam')
  const [genFramework, setGenFramework] = useState('slay')
  const [genTone, setGenTone] = useState('default')
  const [genTopic, setGenTopic] = useState('')
  const [genResult, setGenResult] = useState(null)

  // Trend jack state
  const [trendTopic, setTrendTopic] = useState('')

  const fetchPosts = useCallback(async () => {
    try {
      const res = await api.get('/linkedin/posts?limit=50')
      setPosts(res.posts || [])
    } catch (e) {
      console.error('Failed to fetch posts:', e)
    }
  }, [])

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await api.get('/linkedin/analytics')
      setAnalytics(res)
    } catch (e) {
      console.error('Failed to fetch analytics:', e)
    }
  }, [])

  useEffect(() => {
    fetchPosts()
    fetchAnalytics()
  }, [fetchPosts, fetchAnalytics])

  // ─── Generate full week ─── //
  const generateWeek = async () => {
    setGenerating(true)
    try {
      const res = await api.post('/linkedin/generate-week', {})
      await fetchPosts()
      setTab('calendar')
    } catch (e) {
      console.error('Failed to generate week:', e)
    }
    setGenerating(false)
  }

  // ─── Generate single post ─── //
  const generateSingle = async () => {
    setGenerating(true)
    setGenResult(null)
    try {
      const res = await api.post('/linkedin/generate', {
        pillar: genPillar,
        framework: genFramework,
        tone: genTone,
        topic: genTopic || null,
      })
      setGenResult(res.post)
      await fetchPosts()
    } catch (e) {
      console.error('Failed to generate:', e)
    }
    setGenerating(false)
  }

  // ─── Trend jack ─── //
  const trendJack = async (topic) => {
    setGenerating(true)
    try {
      const res = await api.post('/linkedin/trend-jack', {
        trend_topic: topic || trendTopic,
      })
      setGenResult(res.post)
      setTab('generate')
      await fetchPosts()
    } catch (e) {
      console.error('Failed to trend jack:', e)
    }
    setGenerating(false)
  }

  // ─── Scan trends ─── //
  const scanTrends = async () => {
    setLoading(true)
    try {
      const res = await api.post('/linkedin/scan-trends')
      setTrends(res.trends || [])
    } catch (e) {
      console.error('Failed to scan trends:', e)
    }
    setLoading(false)
  }

  // ─── Copy to clipboard ─── //
  const copyPost = (post) => {
    const text = post?.content?.full_post || post?.full_post || ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(post._id || post.id || 'temp')
      setTimeout(() => setCopied(null), 2000)
    })
  }

  // ─── Update post status ─── //
  const updateStatus = async (postId, status) => {
    try {
      await api.put(`/linkedin/posts/${postId}`, { post_id: postId, status })
      await fetchPosts()
    } catch (e) {
      console.error('Failed to update:', e)
    }
  }

  // ─── Save edited post ─── //
  const saveEdit = async (postId) => {
    try {
      await api.put(`/linkedin/posts/${postId}`, { post_id: postId, full_post: editText })
      setEditingPost(null)
      setEditText('')
      await fetchPosts()
    } catch (e) {
      console.error('Failed to save edit:', e)
    }
  }

  // ─── Regenerate ─── //
  const regeneratePost = async (postId) => {
    setGenerating(true)
    try {
      await api.post(`/linkedin/posts/${postId}/regenerate`)
      await fetchPosts()
    } catch (e) {
      console.error('Failed to regenerate:', e)
    }
    setGenerating(false)
  }

  // ─── Delete ─── //
  const deletePost = async (postId) => {
    if (!window.confirm('Delete this post?')) return
    try {
      await api.delete(`/linkedin/posts/${postId}`)
      await fetchPosts()
    } catch (e) {
      console.error('Failed to delete:', e)
    }
  }

  // ─── Helper: get content text ─── //
  const getPostText = (post) => post?.content?.full_post || post?.content?.hook || ''
  const getPostHook = (post) => post?.content?.hook || getPostText(post).split('\n')[0] || 'Untitled'

  // ─── Group posts by week ─── //
  const weeklyPosts = posts.filter(p => p.type === 'weekly')
  const draftPosts = posts.filter(p => p.status === 'draft')
  const approvedPosts = posts.filter(p => p.status === 'approved')
  const postedPosts = posts.filter(p => p.status === 'posted')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <i className="fa-brands fa-linkedin text-[#0A66C2]" />
              LinkedIn Autopilot
            </h1>
            <p className="text-gray-500 mt-1">AI-powered content engine • 4 posts/week • Zero effort</p>
          </div>
          <button
            onClick={generateWeek}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold transition-all"
            style={{ background: generating ? '#94a3b8' : '#0A66C2' }}
          >
            {generating ? (
              <><i className="fa-solid fa-spinner fa-spin" /> Generating...</>
            ) : (
              <><i className="fa-solid fa-calendar-plus" /> Generate This Week</>
            )}
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {[
            { label: 'Drafts', value: draftPosts.length, icon: 'fa-pen' },
            { label: 'Approved', value: approvedPosts.length, icon: 'fa-check' },
            { label: 'Posted', value: postedPosts.length, icon: 'fa-paper-plane' },
            { label: 'Total Impressions', value: analytics?.performance?.total_impressions?.toLocaleString() || '0', icon: 'fa-eye' },
          ].map((s, i) => (
            <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(201,168,76,0.1)' }}>
                <i className={`fa-solid ${s.icon} text-sm`} style={{ color: '#C9A84C' }} />
              </div>
              <div>
                <div className="text-lg font-bold text-white">{s.value}</div>
                <div className="text-[10px] text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-xl p-1 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); if (t.id === 'analytics') fetchAnalytics(); if (t.id === 'posts') fetchPosts(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <i className={`fa-solid ${t.icon}`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* CONTENT CALENDAR TAB */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'calendar' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">This Week's Content</h2>
            <div className="flex gap-2">
              {Object.entries(PILLARS).map(([k, v]) => (
                <span key={k} className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: v.bg, color: v.color }}>
                  {v.label}
                </span>
              ))}
            </div>
          </div>

          {draftPosts.length === 0 && approvedPosts.length === 0 ? (
            <div className="bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-700 p-8 text-center">
              <i className="fa-solid fa-calendar-plus text-3xl text-gray-500 mb-3" />
              <h3 className="text-sm font-semibold text-gray-300 mb-1">No posts queued yet</h3>
              <p className="text-xs text-gray-500 mb-4">Hit "Generate This Week" to create 4 posts following the proven 4-3-2-1 system</p>
              <button
                onClick={generateWeek}
                disabled={generating}
                className="px-5 py-2.5 rounded-lg text-white font-semibold"
                style={{ background: '#0A66C2' }}
              >
                {generating ? 'Generating...' : 'Generate This Week'}
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {['monday', 'tuesday', 'thursday', 'friday'].map((day) => {
                const dayPost = posts.find(p => p.day === day && (p.status === 'draft' || p.status === 'approved'))
                if (!dayPost) return (
                  <div key={day} className="bg-gray-900 rounded-xl border border-gray-800 p-5 opacity-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                        <i className="fa-regular fa-calendar text-gray-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-400 capitalize">{day}</div>
                        <div className="text-sm text-gray-400">No post generated</div>
                      </div>
                    </div>
                  </div>
                )

                const pillar = PILLARS[dayPost.pillar] || PILLARS.tam
                const hook = getPostHook(dayPost)
                const isEditing = editingPost === dayPost._id

                return (
                  <div key={day} className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Day + Pillar + Framework badges */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-semibold text-white capitalize">{day}</span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: pillar.bg, color: pillar.color }}>
                            {pillar.label}
                          </span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                            {(dayPost.framework || 'slay').toUpperCase()}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            dayPost.status === 'approved' ? 'bg-green-900/20 text-green-400' : 'bg-amber-900/30 text-amber-400'
                          }`}>
                            {dayPost.status}
                          </span>
                        </div>

                        {/* Hook */}
                        <div className="font-bold text-white text-lg mb-2">{hook}</div>

                        {/* Preview / Edit */}
                        {isEditing ? (
                          <div>
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full h-64 p-3 rounded-lg border border-gray-700 text-sm font-mono text-gray-200 bg-gray-800 resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => saveEdit(dayPost._id)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium">Save</button>
                              <button onClick={() => setEditingPost(null)} className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-300 text-sm font-medium">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="text-sm text-gray-400 whitespace-pre-line line-clamp-4 cursor-pointer hover:text-gray-200"
                            onClick={() => setSelectedPost(dayPost)}
                          >
                            {getPostText(dayPost).substring(0, 300)}...
                          </div>
                        )}

                        {/* Reasoning */}
                        {dayPost.content?.reasoning && (
                          <div className="mt-2 text-xs text-gray-400 italic">
                            <i className="fa-solid fa-lightbulb mr-1" />
                            {dayPost.content.reasoning}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => copyPost(dayPost)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                          style={{ background: copied === dayPost._id ? '#10b981' : '#0A66C2', color: 'white' }}
                        >
                          <i className={`fa-solid ${copied === dayPost._id ? 'fa-check' : 'fa-copy'}`} />
                          {copied === dayPost._id ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                          onClick={() => updateStatus(dayPost._id, dayPost.status === 'approved' ? 'draft' : 'approved')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/20 text-green-400 text-sm font-medium hover:bg-green-900/30"
                        >
                          <i className="fa-solid fa-check" />
                          {dayPost.status === 'approved' ? 'Unapprove' : 'Approve'}
                        </button>
                        <button
                          onClick={() => { setEditingPost(dayPost._id); setEditText(getPostText(dayPost)) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700"
                        >
                          <i className="fa-solid fa-pen" /> Edit
                        </button>
                        <button
                          onClick={() => regeneratePost(dayPost._id)}
                          disabled={generating}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/20 text-amber-400 text-sm font-medium hover:bg-amber-900/30"
                        >
                          <i className={`fa-solid ${generating ? 'fa-spinner fa-spin' : 'fa-rotate'}`} /> Regen
                        </button>
                        <button
                          onClick={() => deletePost(dayPost._id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/20 text-red-400 text-sm font-medium hover:bg-red-900/30"
                        >
                          <i className="fa-solid fa-trash" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Posting Guide */}
          <div className="mt-6 bg-blue-900/20 rounded-xl p-5 border border-blue-700/40">
            <h3 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
              <i className="fa-solid fa-lightbulb" /> Posting Playbook
            </h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm text-blue-400">
              <div><strong>When to post:</strong> 12:00 PM GMT (lunchtime gets highest engagement)</div>
              <div><strong>After posting:</strong> Spend 30 mins engaging with comments</div>
              <div><strong>Copy → paste to LinkedIn:</strong> Hit the blue Copy button, open LinkedIn, paste, post</div>
              <div><strong>Track results:</strong> After 48h, come back and log impressions/likes</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* GENERATE SINGLE POST TAB */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'generate' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Controls */}
          <div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold text-white mb-4">Generate a Post</h3>

              {/* Pillar */}
              <label className="block text-sm font-medium text-gray-300 mb-2">Content Pillar</label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {Object.entries(PILLARS).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setGenPillar(k)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      genPillar === k ? 'border-current bg-gray-800' : 'border-gray-700 hover:border-gray-600'
                    }`}
                    style={genPillar === k ? { borderColor: v.color, background: v.bg } : {}}
                  >
                    <div className="font-semibold text-sm" style={{ color: genPillar === k ? v.color : '#374151' }}>{v.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{v.desc}</div>
                  </button>
                ))}
              </div>

              {/* Framework */}
              <label className="block text-sm font-medium text-gray-300 mb-2">Framework</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(FRAMEWORKS).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setGenFramework(k)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      genFramework === k ? 'border-emerald-500 bg-emerald-900/20' : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="font-semibold text-sm">{v.label}</div>
                    <div className="text-xs text-gray-500">{v.desc}</div>
                  </button>
                ))}
              </div>

              {/* Tone */}
              <label className="block text-sm font-medium text-gray-300 mb-2">Tone</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {TONES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setGenTone(t.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      genTone === t.value ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Topic */}
              <label className="block text-sm font-medium text-gray-300 mb-2">Topic / Angle (optional)</label>
              <input
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                placeholder="e.g. Father-son building the EPOS system, Burg Burgers saving £36k/year..."
                className="w-full px-4 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-200 bg-gray-800 focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent mb-4"
              />

              {/* Generate button */}
              <button
                onClick={generateSingle}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-base transition-all"
                style={{ background: generating ? '#94a3b8' : '#0A66C2' }}
              >
                {generating ? (
                  <><i className="fa-solid fa-spinner fa-spin" /> Generating...</>
                ) : (
                  <><i className="fa-solid fa-wand-magic-sparkles" /> Generate Post</>
                )}
              </button>
            </div>

            {/* Topic Ideas */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mt-4">
              <h4 className="font-semibold text-white mb-3">Quick Topic Ideas</h4>
              <div className="flex flex-wrap gap-2">
                {[
                  'Deliveroo commission vs Rezvo flat fee',
                  'Building with my son — the EPOS play',
                  'Why I left payments consulting',
                  'Burg Burgers paying 48% to platforms',
                  'UK high street closures in 2026',
                  'Our AI chatbot went live last night',
                  'Micho testing the platform',
                  'Solo founder vs billion-dollar competitors',
                  'The maths: £29/mo vs £36k/year in commission',
                  'Save the High Street mission',
                ].map((topic, i) => (
                  <button
                    key={i}
                    onClick={() => setGenTopic(topic)}
                    className="text-xs px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-[#0A66C2] hover:text-white transition-all"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            {genResult ? (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Generated Post</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyPost(genResult)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                      style={{ background: copied === (genResult._id || 'temp') ? '#10b981' : '#0A66C2' }}
                    >
                      <i className={`fa-solid ${copied === (genResult._id || 'temp') ? 'fa-check' : 'fa-copy'}`} />
                      {copied === (genResult._id || 'temp') ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                    <button
                      onClick={generateSingle}
                      disabled={generating}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/20 text-amber-400 text-sm font-medium"
                    >
                      <i className="fa-solid fa-rotate" /> Regenerate
                    </button>
                  </div>
                </div>

                {/* Hook score */}
                {genResult.hook_score && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-gray-500">Hook Score:</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-5 h-2 rounded-full"
                          style={{ background: i < genResult.hook_score ? '#0A66C2' : '#e5e7eb' }}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-bold text-[#0A66C2]">{genResult.hook_score}/10</span>
                  </div>
                )}

                {/* LinkedIn preview mockup */}
                <div className="border border-gray-700 rounded-xl p-4 bg-gray-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-[#111111] flex items-center justify-center text-white font-bold text-lg">R</div>
                    <div>
                      <div className="font-semibold text-white text-sm">Rezvo Founder</div>
                      <div className="text-xs text-gray-500">Save the High Street • Building @Rezvo</div>
                    </div>
                  </div>
                  <div className="whitespace-pre-line text-sm text-gray-300 leading-relaxed">
                    {genResult.full_post || genResult.hook}
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {genResult.pillar && (
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: PILLARS[genResult.pillar]?.bg, color: PILLARS[genResult.pillar]?.color }}>
                      {PILLARS[genResult.pillar]?.label}
                    </span>
                  )}
                  {genResult.framework && (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400">
                      {genResult.framework.toUpperCase()}
                    </span>
                  )}
                  {genResult.estimated_impressions && (
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-900/20 text-purple-400">
                      Est: {genResult.estimated_impressions}
                    </span>
                  )}
                </div>

                {/* Reasoning */}
                {genResult.reasoning && (
                  <div className="mt-3 p-3 bg-blue-900/20 rounded-lg text-xs text-blue-400">
                    <strong>Why this works:</strong> {genResult.reasoning}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-700 p-12 text-center">
                <i className="fa-brands fa-linkedin text-5xl text-gray-200 mb-4" />
                <h3 className="text-lg font-semibold text-gray-400 mb-2">Your post will appear here</h3>
                <p className="text-gray-400 text-sm">Select your options and hit Generate</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TREND SCANNER TAB */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'trends' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Trend Scanner</h2>
              <p className="text-sm text-gray-500">Find trending topics and turn them into viral posts</p>
            </div>
            <button
              onClick={scanTrends}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium"
              style={{ background: loading ? '#94a3b8' : '#0A66C2' }}
            >
              {loading ? (
                <><i className="fa-solid fa-spinner fa-spin" /> Scanning...</>
              ) : (
                <><i className="fa-solid fa-radar" /> Scan for Trends</>
              )}
            </button>
          </div>

          {/* Manual trend jack */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
            <h3 className="font-semibold text-white mb-3">Quick Trend Jack</h3>
            <div className="flex gap-2">
              <input
                value={trendTopic}
                onChange={(e) => setTrendTopic(e.target.value)}
                placeholder="Paste a headline or trending topic..."
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-200 bg-gray-800"
              />
              <button
                onClick={() => trendJack()}
                disabled={generating || !trendTopic}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium"
                style={{ background: generating ? '#94a3b8' : '#0A66C2' }}
              >
                <i className="fa-solid fa-bolt" /> Jack It
              </button>
            </div>
          </div>

          {/* Trends grid */}
          {trends.length > 0 ? (
            <div className="grid gap-3">
              {trends.map((trend, i) => (
                <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          trend.urgency === 'high' ? 'bg-red-900/30 text-red-400' : trend.urgency === 'medium' ? 'bg-amber-900/30 text-amber-400' : 'bg-gray-800 text-gray-400'
                        }`}>
                          {trend.urgency?.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="font-bold text-white">{trend.topic}</h4>
                      <p className="text-sm text-gray-600 mt-1">{trend.why_trending}</p>
                      <p className="text-sm text-[#111111] mt-1 font-medium">{trend.rezvo_angle}</p>
                      {trend.suggested_hook && (
                        <div className="mt-2 p-2 bg-gray-800 rounded-lg text-sm font-medium text-gray-300">
                          Hook: "{trend.suggested_hook}"
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => trendJack(trend.topic)}
                      disabled={generating}
                      className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0A66C2] text-white text-sm font-medium"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles" /> Generate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-700 p-12 text-center">
              <i className="fa-solid fa-bolt text-4xl text-gray-200 mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No trends scanned yet</h3>
              <p className="text-gray-400 text-sm">Hit "Scan for Trends" to find hot topics in the restaurant/hospitality space</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ALL POSTS TAB */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'posts' && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">All Posts ({posts.length})</h2>
          {posts.length === 0 ? (
            <div className="bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-700 p-12 text-center">
              <p className="text-gray-400">No posts yet. Generate your first week!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map(post => {
                const pillar = PILLARS[post.pillar] || PILLARS.tam
                return (
                  <div key={post._id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-4">
                    <div className="w-2 h-12 rounded-full" style={{ background: pillar.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: pillar.bg, color: pillar.color }}>
                          {pillar.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          post.status === 'posted' ? 'bg-blue-900/20 text-blue-400' :
                          post.status === 'approved' ? 'bg-green-900/20 text-green-400' :
                          'bg-amber-900/30 text-amber-400'
                        }`}>
                          {post.status}
                        </span>
                        {post.type === 'trend' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/30 text-red-400">Trend Jack</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <div className="font-semibold text-white truncate">{getPostHook(post)}</div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => copyPost(post)} className="p-2 rounded-lg hover:bg-gray-800" title="Copy">
                        <i className={`fa-solid ${copied === post._id ? 'fa-check text-green-600' : 'fa-copy text-gray-400'}`} />
                      </button>
                      <button onClick={() => setSelectedPost(post)} className="p-2 rounded-lg hover:bg-gray-800" title="View">
                        <i className="fa-solid fa-eye text-gray-400" />
                      </button>
                      <button onClick={() => deletePost(post._id)} className="p-2 rounded-lg hover:bg-red-900/20" title="Delete">
                        <i className="fa-solid fa-trash text-gray-300 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ANALYTICS TAB */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'analytics' && analytics && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Performance Analytics</h2>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Impressions', value: analytics.performance?.total_impressions?.toLocaleString() || '0', icon: 'fa-eye' },
              { label: 'Total Likes', value: analytics.performance?.total_likes?.toLocaleString() || '0', icon: 'fa-thumbs-up' },
              { label: 'Total Comments', value: analytics.performance?.total_comments?.toLocaleString() || '0', icon: 'fa-comment' },
              { label: 'Leads Generated', value: analytics.performance?.total_leads?.toLocaleString() || '0', icon: 'fa-user-plus' },
            ].map((kpi, i) => (
              <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <i className={`fa-solid ${kpi.icon}`} style={{ color: '#C9A84C' }} />
                  <span className="text-xs text-gray-500">{kpi.label}</span>
                </div>
                <div className="text-2xl font-bold text-white">{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Averages */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
            <h3 className="font-semibold text-white mb-3">Per Post Averages</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#0A66C2]">{analytics.performance?.avg_impressions?.toLocaleString() || '0'}</div>
                <div className="text-xs text-gray-500">Avg Impressions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#0A66C2]">{analytics.performance?.avg_likes || '0'}</div>
                <div className="text-xs text-gray-500">Avg Likes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#0A66C2]">{analytics.performance?.avg_comments || '0'}</div>
                <div className="text-xs text-gray-500">Avg Comments</div>
              </div>
            </div>
          </div>

          {/* Best performing by pillar */}
          {Object.keys(analytics.pillar_performance || {}).length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
              <h3 className="font-semibold text-white mb-3">Performance by Pillar</h3>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(analytics.pillar_performance).map(([pillar, data]) => {
                  const p = PILLARS[pillar] || PILLARS.tam
                  return (
                    <div key={pillar} className="rounded-xl p-4" style={{ background: p.bg }}>
                      <div className="font-semibold text-sm" style={{ color: p.color }}>{p.label}</div>
                      <div className="text-2xl font-bold mt-1" style={{ color: p.color }}>{data.avg_impressions?.toLocaleString()}</div>
                      <div className="text-xs" style={{ color: p.color }}>avg impressions • {data.total_posts} posts</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Best posts */}
          {analytics.best_posts?.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold text-white mb-3">Top Performing Posts</h3>
              <div className="space-y-3">
                {analytics.best_posts.map((post, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-[#0A66C2] text-white flex items-center justify-center font-bold text-sm">
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{post.hook}</div>
                      <div className="text-xs text-gray-500">{post.impressions?.toLocaleString()} impressions • {post.likes} likes • {post.comments} comments</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* POST DETAIL MODAL */}
      {/* ═══════════════════════════════════════ */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPost(null)}>
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-white">Post Preview</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => copyPost(selectedPost)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: copied === selectedPost._id ? '#10b981' : '#0A66C2' }}
                >
                  <i className={`fa-solid ${copied === selectedPost._id ? 'fa-check' : 'fa-copy'}`} />
                  {copied === selectedPost._id ? 'Copied!' : 'Copy to LinkedIn'}
                </button>
                <button onClick={() => setSelectedPost(null)} className="p-2 rounded-lg hover:bg-gray-800">
                  <i className="fa-solid fa-xmark text-gray-500" />
                </button>
              </div>
            </div>

            {/* LinkedIn mockup */}
            <div className="border border-gray-700 rounded-xl p-5 bg-gray-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full bg-[#111111] flex items-center justify-center text-white font-bold text-xl">R</div>
                <div>
                  <div className="font-semibold text-white">Rezvo Founder</div>
                  <div className="text-xs text-gray-500">Save the High Street • Building @Rezvo • Nottingham, UK</div>
                  <div className="text-xs text-gray-400">Just now • <i className="fa-solid fa-earth-americas" /></div>
                </div>
              </div>
              <div className="whitespace-pre-line text-sm text-gray-300 leading-relaxed">
                {getPostText(selectedPost)}
              </div>
              <div className="flex items-center gap-6 mt-4 pt-3 border-t border-gray-800 text-xs text-gray-500">
                <span><i className="fa-regular fa-thumbs-up mr-1" /> Like</span>
                <span><i className="fa-regular fa-comment mr-1" /> Comment</span>
                <span><i className="fa-solid fa-retweet mr-1" /> Repost</span>
                <span><i className="fa-regular fa-paper-plane mr-1" /> Send</span>
              </div>
            </div>

            {/* Meta */}
            {selectedPost.content?.reasoning && (
              <div className="mt-4 p-3 bg-blue-900/20 rounded-lg text-sm text-blue-400">
                <strong>Strategy:</strong> {selectedPost.content.reasoning}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default LinkedIn
