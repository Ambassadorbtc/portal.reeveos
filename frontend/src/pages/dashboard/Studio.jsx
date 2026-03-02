/**
 * Studio — Website Screenshot Capture Tool
 * ==========================================
 * Paste a URL → pick viewport → capture → see retina screenshot
 * Live progress feed, result preview, job history grid.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../utils/api'

/* ─── SVG Icons (inline, no deps) ─── */
const Icon = ({ name, size = 18, className = '' }) => {
  const icons = {
    camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
    monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
    tablet: <><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>,
    phone: <><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    trash: <><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></>,
    check: <><polyline points="20,6 9,17 4,12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    loader: <><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></>,
    globe: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
    zap: <><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    refresh: <><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    type: <><polyline points="4,7 4,4 20,4 20,7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></>,
    palette: <><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5.5-4.5-9.9-10-9.9z"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name]}
    </svg>
  )
}

/* ─── Viewport presets ─── */
const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', icon: 'monitor', w: 1440, h: 900 },
  { id: 'tablet', label: 'Tablet', icon: 'tablet', w: 768, h: 1024 },
  { id: 'mobile', label: 'Mobile', icon: 'phone', w: 375, h: 812 },
]

/* ─── Helpers ─── */
const fmtTime = (s) => s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`
const fmtSize = (mb) => mb < 1 ? `${(mb * 1024).toFixed(0)} KB` : `${mb.toFixed(2)} MB`
const fmtDate = (iso) => {
  const d = new Date(iso)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/* ─── Step indicator dot ─── */
const StepDot = ({ status }) => {
  if (status === 'done') return <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><Icon name="check" size={12} className="text-white" /></div>
  if (status === 'error') return <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"><Icon name="x" size={12} className="text-white" /></div>
  if (status === 'active') return <div className="w-5 h-5 rounded-full bg-primary border-2 border-primary animate-pulse" />
  return <div className="w-5 h-5 rounded-full bg-gray-200" />
}

/* ═══════════════════════════════════════════ */
/*                  STUDIO                     */
/* ═══════════════════════════════════════════ */

const Studio = () => {
  const [url, setUrl] = useState('')
  const [viewport, setViewport] = useState('desktop')
  const [capturing, setCapturing] = useState(false)
  const [currentJob, setCurrentJob] = useState(null)
  const [jobs, setJobs] = useState([])
  const [activeTab, setActiveTab] = useState('capture') // 'capture' | 'history'
  const [previewJob, setPreviewJob] = useState(null)
  const [cookieDismiss, setCookieDismiss] = useState(true)
  const [hideOverlays, setHideOverlays] = useState(true)
  const progressRef = useRef(null)

  /* Load job history on mount */
  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/studio/jobs`)
      if (res.ok) {
        const data = await res.json()
        setJobs(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
      }
    } catch (e) {
      console.error('Failed to load jobs:', e)
    }
  }

  /* Capture */
  const startCapture = async () => {
    if (!url.trim() || capturing) return

    let cleanUrl = url.trim()
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'https://' + cleanUrl

    setCapturing(true)
    setCurrentJob(null)
    setActiveTab('capture')

    try {
      const res = await fetch(`${API_BASE}/api/studio/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: cleanUrl,
          viewport,
          cookie_dismiss: cookieDismiss,
          hide_overlays: hideOverlays,
        }),
      })
      const data = await res.json()
      setCurrentJob(data)
      setCapturing(false)
      loadJobs()
    } catch (e) {
      setCurrentJob({ status: 'error', error: e.message, steps: [] })
      setCapturing(false)
    }
  }

  /* Delete job */
  const deleteJob = async (jobId) => {
    try {
      await fetch(`${API_BASE}/api/studio/jobs/${jobId}`, { method: 'DELETE' })
      setJobs((prev) => prev.filter((j) => j.job_id !== jobId))
      if (previewJob?.job_id === jobId) setPreviewJob(null)
      if (currentJob?.job_id === jobId) setCurrentJob(null)
    } catch (e) {
      console.error('Delete failed:', e)
    }
  }

  /* Auto-scroll progress feed */
  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight
    }
  }, [currentJob?.steps])

  const displayJob = previewJob || currentJob

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-6">

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <Icon name="camera" size={18} className="text-white" />
              </div>
              Studio
            </h1>
            <p className="text-sm text-gray-500 mt-1">Capture high-resolution website screenshots at 3× retina quality</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab('capture'); setPreviewJob(null) }}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'capture' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Icon name="camera" size={14} className="inline mr-1.5 -mt-0.5" />
              Capture
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'history' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Icon name="grid" size={14} className="inline mr-1.5 -mt-0.5" />
              History
              {jobs.length > 0 && <span className="ml-1.5 text-xs opacity-70">{jobs.length}</span>}
            </button>
          </div>
        </div>

        {/* ═══ CAPTURE TAB ═══ */}
        {activeTab === 'capture' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ─── Left: Input Panel ─── */}
            <div className="lg:col-span-2 space-y-4">

              {/* URL Input */}
              <div className="bg-white rounded-2xl border border-border p-5 space-y-4 shadow-sm">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Website URL</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Icon name="globe" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && startCapture()}
                      placeholder="example.com"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                {/* Viewport selector */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Viewport</label>
                  <div className="flex gap-2">
                    {VIEWPORTS.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setViewport(v.id)}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                          viewport === v.id
                            ? 'border-primary bg-gray-50 text-primary'
                            : 'border-transparent bg-gray-50 text-gray-400 hover:border-gray-200 hover:text-gray-600'
                        }`}
                      >
                        <Icon name={v.icon} size={20} />
                        <span className="text-xs font-bold">{v.label}</span>
                        <span className="text-[10px] font-medium opacity-60">{v.w}×{v.h}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cookieDismiss} onChange={(e) => setCookieDismiss(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <span className="text-xs font-medium text-gray-600">Dismiss cookies</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hideOverlays} onChange={(e) => setHideOverlays(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <span className="text-xs font-medium text-gray-600">Hide overlays</span>
                  </label>
                </div>

                {/* Capture button */}
                <button
                  onClick={startCapture}
                  disabled={!url.trim() || capturing}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    !url.trim() || capturing
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99]'
                  }`}
                >
                  {capturing ? (
                    <>
                      <Icon name="loader" size={16} className="animate-spin" />
                      Capturing…
                    </>
                  ) : (
                    <>
                      <Icon name="zap" size={16} />
                      Capture Screenshot
                    </>
                  )}
                </button>
              </div>

              {/* Progress Feed */}
              {(capturing || currentJob) && (
                <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Progress</h3>
                    {currentJob?.status === 'complete' && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Icon name="check" size={12} /> Complete
                      </span>
                    )}
                    {currentJob?.status === 'error' && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Icon name="x" size={12} /> Error
                      </span>
                    )}
                  </div>
                  <div ref={progressRef} className="space-y-2 max-h-48 overflow-y-auto">
                    {capturing && !currentJob && (
                      <div className="flex items-center gap-3 py-1.5">
                        <StepDot status="active" />
                        <span className="text-sm text-gray-600 font-medium">Sending capture request…</span>
                      </div>
                    )}
                    {currentJob?.steps?.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 py-1">
                        <div className="mt-0.5">
                          <StepDot status={step.msg.startsWith('ERROR') ? 'error' : 'done'} />
                        </div>
                        <span className={`text-sm font-medium ${step.msg.startsWith('ERROR') ? 'text-red-600' : 'text-gray-600'}`}>
                          {step.msg.replace('ERROR: ', '')}
                        </span>
                      </div>
                    ))}
                  </div>
                  {currentJob?.duration_seconds && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400 font-medium">
                      <Icon name="clock" size={12} />
                      Completed in {fmtTime(currentJob.duration_seconds)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─── Right: Result Panel ─── */}
            <div className="lg:col-span-3">
              {displayJob?.status === 'complete' ? (
                <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                  {/* Screenshot preview */}
                  <div className="bg-[#f8f8f8] border-b border-border p-4">
                    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-white">
                      <img
                        src={`${API_BASE}${displayJob.screenshot_path}`}
                        alt={displayJob.page_title || 'Screenshot'}
                        className="w-full h-auto"
                        style={{ maxHeight: '500px', objectFit: 'contain', objectPosition: 'top' }}
                      />
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="p-5 space-y-4">
                    {/* Title + URL */}
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{displayJob.page_title || 'Untitled'}</h3>
                      <a href={displayJob.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-primary transition-colors truncate block">
                        {displayJob.url}
                      </a>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Resolution', value: `${displayJob.capture?.pixel_width}×${displayJob.capture?.pixel_height}`, icon: 'image' },
                        { label: 'File size', value: fmtSize(displayJob.capture?.file_size_mb || 0), icon: 'download' },
                        { label: 'Capture time', value: fmtTime(displayJob.duration_seconds || 0), icon: 'clock' },
                        { label: 'HTTP', value: displayJob.http_status, icon: 'globe' },
                      ].map((s) => (
                        <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Icon name={s.icon} size={12} className="text-gray-400" />
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900">{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Page meta */}
                    {displayJob.page_meta && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {displayJob.page_meta.fonts?.length > 0 && (
                          <div className="bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Icon name="type" size={12} className="text-gray-400" />
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fonts</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {displayJob.page_meta.fonts.slice(0, 4).map((f, i) => (
                                <span key={i} className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-0.5 font-medium text-gray-600 truncate max-w-[160px]">
                                  {f.replace(/"/g, '')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {displayJob.page_meta.description && (
                          <div className="bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Icon name="eye" size={12} className="text-gray-400" />
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Meta Description</span>
                            </div>
                            <p className="text-xs text-gray-600 line-clamp-2">{displayJob.page_meta.description}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <a
                        href={`${API_BASE}${displayJob.screenshot_path}`}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-sm"
                      >
                        <Icon name="download" size={15} />
                        Download Full-Res
                      </a>
                      <button
                        onClick={() => {
                          setUrl(displayJob.url)
                          setCurrentJob(null)
                          setPreviewJob(null)
                        }}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                      >
                        <Icon name="refresh" size={15} />
                        Re-capture
                      </button>
                    </div>
                  </div>
                </div>
              ) : displayJob?.status === 'error' ? (
                <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
                    <Icon name="x" size={24} className="text-red-500" />
                  </div>
                  <h3 className="font-bold text-gray-900">Capture Failed</h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">{displayJob.error}</p>
                  <button
                    onClick={() => { setCurrentJob(null); setPreviewJob(null) }}
                    className="text-sm font-bold text-primary hover:underline mt-2"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                /* Empty state */
                <div className="bg-white rounded-2xl border border-border p-12 text-center space-y-4 shadow-sm">
                  <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center mx-auto">
                    <Icon name="camera" size={32} className="text-gray-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Ready to capture</h3>
                    <p className="text-sm text-gray-400 mt-1">Enter a URL and hit capture to get a pixel-perfect<br />retina screenshot in seconds</p>
                  </div>
                  <div className="flex items-center justify-center gap-6 pt-2">
                    {[
                      { icon: 'zap', text: '3× Retina' },
                      { icon: 'eye', text: 'Cookie dismissal' },
                      { icon: 'image', text: 'Auto-stitch' },
                    ].map((f) => (
                      <div key={f.text} className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                        <Icon name={f.icon} size={13} />
                        {f.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {activeTab === 'history' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">{jobs.length} capture{jobs.length !== 1 ? 's' : ''}</p>
              <button onClick={loadJobs} className="text-sm text-gray-400 hover:text-primary font-medium flex items-center gap-1 transition-colors">
                <Icon name="refresh" size={14} /> Refresh
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-border p-12 text-center">
                <Icon name="image" size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No captures yet</p>
                <button onClick={() => setActiveTab('capture')} className="text-sm text-primary font-bold mt-2 hover:underline">
                  Capture your first screenshot →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobs.map((job) => (
                  <div
                    key={job.job_id}
                    className="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-md transition-all group cursor-pointer"
                    onClick={() => { setPreviewJob(job); setActiveTab('capture') }}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-gray-50 overflow-hidden relative">
                      {job.status === 'complete' && job.thumbnail_path ? (
                        <img
                          src={`${API_BASE}${job.thumbnail_path}`}
                          alt={job.page_title || 'Capture'}
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : job.status === 'error' ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="x" size={24} className="text-red-400" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="loader" size={24} className="text-gray-300 animate-spin" />
                        </div>
                      )}
                      {/* Viewport badge */}
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase">
                        {job.viewport || 'desktop'}
                      </div>
                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteJob(job.job_id) }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 backdrop-blur-sm text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h4 className="font-bold text-gray-900 text-sm truncate">{job.page_title || job.url}</h4>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-gray-400 font-medium">{fmtDate(job.created_at)}</span>
                        {job.status === 'complete' ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {job.capture?.pixel_width}×{job.capture?.pixel_height}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                            Failed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Studio
