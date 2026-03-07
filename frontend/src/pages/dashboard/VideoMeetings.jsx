/**
 * VideoMeetings.jsx — Google Meet management for business owners
 * Connect Google account, view setup guide, manage upcoming meetings
 */
import { useState, useEffect, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import AppLoader from '../../components/shared/AppLoader'
import {
  Video, Link2, CheckCircle, AlertTriangle, ArrowLeft, ExternalLink,
  Calendar, Clock, Users, Settings, Trash2, RefreshCw, Shield, Zap
} from 'lucide-react'

const GOLD = '#C9A84C'

const fmtDate = (d) => {
  if (!d) return '—'
  try {
    const dt = new Date(d)
    return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' }) +
      ' at ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

export default function VideoMeetings() {
  const { business } = useBusiness()
  const bid = business?.id ?? business?._id
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState('')
  const [connectedAt, setConnectedAt] = useState('')
  const [meetings, setMeetings] = useState([])
  const [guide, setGuide] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!bid) { setLoading(false); return }
    try {
      const [status, meetingsRes, guideRes] = await Promise.all([
        api.get(`/meet/status/${bid}`).catch(() => ({ connected: false })),
        api.get(`/meet/business/${bid}/meetings`).catch(() => ({ meetings: [] })),
        api.get(`/meet/setup-guide`).catch(() => null),
      ])
      setConnected(status.connected || false)
      setGoogleEmail(status.email || '')
      setConnectedAt(status.connected_at || '')
      setMeetings(meetingsRes.meetings || [])
      setGuide(guideRes)
      setError(null)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [bid])

  useEffect(() => { load() }, [load])

  const connectGoogle = async () => {
    try {
      const r = await api.get(`/meet/connect/${bid}`)
      if (r.auth_url) window.location.href = r.auth_url
    } catch (e) { setError(e.message) }
  }

  const disconnectGoogle = async () => {
    if (!confirm('Disconnect Google? New meetings will no longer auto-generate Meet links.')) return
    try {
      await api.delete(`/meet/disconnect/${bid}`)
      setConnected(false)
      setGoogleEmail('')
    } catch (e) { setError(e.message) }
  }

  if (loading) return <AppLoader message="Loading video settings..." />

  return (
    <div style={{ fontFamily: "'Figtree', sans-serif", maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Video size={22} color={GOLD} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>Video Consultations</h1>
        </div>
        <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Connect your Google account to auto-generate Meet links for virtual appointments.</p>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} color="#EF4444" />
          <span style={{ fontSize: 13, color: '#EF4444' }}>{error}</span>
        </div>
      )}

      {/* Connection Status Card */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #EBEBEB', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: connected ? '#ECFDF5' : '#F5F5F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {connected ? <CheckCircle size={22} color="#10B981" /> : <Link2 size={22} color="#BBB" />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
                {connected ? 'Google Connected' : 'Google Not Connected'}
              </div>
              {connected && googleEmail && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{googleEmail} · Connected {fmtDate(connectedAt)}</div>
              )}
              {!connected && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Connect your Google account to enable video consultations</div>
              )}
            </div>
          </div>
          {connected ? (
            <button onClick={disconnectGoogle} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>Disconnect</button>
          ) : (
            <button onClick={connectGoogle} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>
              <Link2 size={14} /> Connect Google
            </button>
          )}
        </div>
      </div>

      {/* Features when connected */}
      {connected && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { Icon: Zap, label: 'Auto Meet Links', desc: 'Every virtual booking gets a link' },
            { Icon: Calendar, label: 'Calendar Sync', desc: 'Events on your Google Calendar' },
            { Icon: Shield, label: 'Encrypted', desc: 'Google handles video security' },
            { Icon: Users, label: 'No App Needed', desc: 'Clients join via browser' },
          ].map(f => (
            <div key={f.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #EBEBEB', padding: '14px 16px' }}>
              <f.Icon size={18} color={GOLD} style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{f.label}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming Meetings */}
      {connected && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #EBEBEB', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: 0 }}>Upcoming Video Meetings</h2>
            <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, border: '1px solid #E5E5E5', background: '#fff', fontSize: 11, fontWeight: 600, color: '#666', cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {meetings.length > 0 ? meetings.map(m => {
            const dt = m.start_time ? new Date(m.start_time) : null
            const isNow = dt && Math.abs(Date.now() - dt.getTime()) < 30 * 60 * 1000
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: isNow ? `${GOLD}15` : '#F5F5F3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Video size={16} color={isNow ? GOLD : '#BBB'} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{m.title || 'Virtual Consultation'}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {fmtDate(m.start_time)} · {m.client_name || 'Client'} · {m.duration_minutes || 30} min
                  </div>
                </div>
                {m.meet_link && (
                  <a href={m.meet_link} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 14px', borderRadius: 8, border: 'none', background: isNow ? GOLD : '#111', color: isNow ? '#111' : '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none', fontFamily: "'Figtree', sans-serif" }}>
                    <ExternalLink size={12} /> {isNow ? 'Join Now' : 'Open'}
                  </a>
                )}
              </div>
            )
          }) : (
            <p style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: 20 }}>No upcoming video meetings. They'll appear here when clients book virtual consultations.</p>
          )}
        </div>
      )}

      {/* Setup Guide (when NOT connected) */}
      {!connected && guide && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #EBEBEB', padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: '0 0 14px' }}>{guide.title || 'Setup Guide'}</h2>
          {(guide.steps || []).map(s => (
            <div key={s.step} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 99, background: `${GOLD}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: GOLD }}>{s.step}</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2, lineHeight: 1.5 }}>{s.description}</div>
                {s.action === 'connect' && (
                  <button onClick={connectGoogle} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>
                    <Link2 size={14} /> Connect Google
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* FAQ */}
          {(guide.faq || []).length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #EBEBEB' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#888', textTransform: 'uppercase', margin: '0 0 10px', letterSpacing: '0.5px' }}>FAQ</h3>
              {guide.faq.map((f, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{f.q}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{f.a}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
