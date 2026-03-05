import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'

const API = '/api'

// ═══════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════
const apiFetch = async (path, opts = {}) => {
  const token = sessionStorage.getItem('client_token')
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const res = await fetch(`${API}${path}`, { ...opts, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ═══════════════════════════════════════════════════════════════
// CONTRAINDICATION ENGINE (client-side mirror)
// ═══════════════════════════════════════════════════════════════
const DEFAULT_CONTRA = {
  pregnant: { microneedling: 'BLOCK', peel: 'BLOCK', rf: 'BLOCK', polynucleotides: 'BLOCK', lymphatic: 'FLAG' },
  pacemaker: { rf: 'BLOCK', microneedling: 'FLAG' },
  metalImplants: { rf: 'BLOCK' },
  bloodClotting: { microneedling: 'BLOCK', peel: 'FLAG', rf: 'FLAG', polynucleotides: 'FLAG' },
  activeCancer: { microneedling: 'BLOCK', peel: 'BLOCK', rf: 'BLOCK', polynucleotides: 'BLOCK', lymphatic: 'BLOCK' },
  keloid: { microneedling: 'BLOCK', rf: 'FLAG', peel: 'FLAG', polynucleotides: 'FLAG' },
  skinInfection: { microneedling: 'BLOCK', peel: 'BLOCK', rf: 'BLOCK', polynucleotides: 'BLOCK', lymphatic: 'BLOCK' },
  autoimmune: { microneedling: 'BLOCK', peel: 'FLAG', rf: 'FLAG', polynucleotides: 'FLAG' },
  epilepsy: { microneedling: 'FLAG', peel: 'FLAG', rf: 'FLAG', polynucleotides: 'FLAG', lymphatic: 'FLAG' },
  herpes: { microneedling: 'FLAG', peel: 'FLAG' },
  roaccutane: { microneedling: 'BLOCK', peel: 'BLOCK', rf: 'BLOCK', polynucleotides: 'FLAG' },
  bloodThinners: { microneedling: 'BLOCK', rf: 'FLAG', polynucleotides: 'FLAG' },
  retinoids: { peel: 'BLOCK', microneedling: 'FLAG' },
  photosensitising: { peel: 'BLOCK', microneedling: 'FLAG' },
  immunosuppressants: { microneedling: 'BLOCK', peel: 'FLAG', rf: 'FLAG', polynucleotides: 'FLAG' },
  sunburn: { microneedling: 'BLOCK', peel: 'BLOCK', rf: 'BLOCK', polynucleotides: 'FLAG' },
  sunbed: { peel: 'BLOCK', microneedling: 'FLAG', rf: 'FLAG' },
  fishAllergy: { polynucleotides: 'BLOCK' },
  fillersRecent: { rf: 'BLOCK', polynucleotides: 'FLAG' },
}
const TX_LABELS = { microneedling: 'Microneedling', peel: 'Chemical Peels', rf: 'RF Needling', polynucleotides: 'Polynucleotides', lymphatic: 'Lymphatic Lift' }

function getAlerts(d, matrix) {
  const m = matrix || DEFAULT_CONTRA
  const blocks = [], flags = []
  Object.entries(m).forEach(([k, txs]) => {
    if (d[k] === 'yes') Object.entries(txs).forEach(([tx, lv]) => {
      const entry = { condition: k, treatment: TX_LABELS[tx] || tx }
      lv === 'BLOCK' ? blocks.push(entry) : flags.push(entry)
    })
  })
  return { blocks, flags }
}

// ═══════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════════════════════════════
const STEPS = ['Personal', 'Medical', 'Medications', 'Skin', 'Lifestyle', 'Consent']

const YesNo = ({ label, name, value, onChange, detail, detailLabel, detailValue, onDetailChange, sublabel, accent }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#E5E5E5', marginBottom: 4 }}>{label}</label>
    {sublabel && <p style={{ fontSize: 10, color: '#8B8570', margin: '-2px 0 4px', lineHeight: 1.3 }}>{sublabel}</p>}
    <div style={{ display: 'flex', gap: 8 }}>
      <button type="button" onClick={() => onChange(name, 'yes')}
        style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, border: value === 'yes' ? `2px solid ${accent}` : '2px solid #2A2520', background: value === 'yes' ? accent + '20' : '#141414', color: value === 'yes' ? accent : '#666', cursor: 'pointer' }}>Yes</button>
      <button type="button" onClick={() => onChange(name, 'no')}
        style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, border: value === 'no' ? '2px solid #34d399' : '2px solid #2A2520', background: value === 'no' ? '#05261A' : '#141414', color: value === 'no' ? '#34d399' : '#666', cursor: 'pointer' }}>No</button>
    </div>
    {value === 'yes' && detail && (
      <input type="text" placeholder={detailLabel || 'Please provide details...'} value={detailValue || ''}
        onChange={e => onDetailChange(name + 'Detail', e.target.value)}
        style={{ marginTop: 6, width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #2A2520', fontSize: 11, outline: 'none', boxSizing: 'border-box', background: '#141414', color: '#E5E5E5' }} />
    )}
  </div>
)

const Input = ({ label, type = 'text', name, value, onChange, placeholder }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#C9A84C', marginBottom: 4 }}>{label}</label>
    <input type={type} value={value || ''} placeholder={placeholder} onChange={e => onChange(name, e.target.value)}
      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #2A2520', fontSize: 11, outline: 'none', background: '#141414', color: '#E5E5E5', boxSizing: 'border-box' }} />
  </div>
)

const Tick = ({ label, checked, onChange, accent }) => (
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
    onMouseEnter={e => e.currentTarget.style.background = '#1E1E1E'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
    <div style={{ width: 16, height: 16, marginTop: 2, borderRadius: 4, border: checked ? 'none' : '2px solid #3A3530', background: checked ? accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={3} strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>}
    </div>
    <span style={{ fontSize: 11, color: '#B0A890', lineHeight: 1.4 }}>{label}</span>
  </label>
)

const AlertBanner = ({ blocks, flags, accent }) => {
  if (!blocks.length && !flags.length) return null
  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {blocks.length > 0 && (
        <div style={{ background: '#2A1215', border: '1px solid #5C2020', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><span style={{ fontSize: 13 }}>&#128683;</span><span style={{ fontSize: 11, fontWeight: 700, color: '#F87171' }}>Treatments Blocked</span></div>
          {blocks.map((b, i) => <p key={i} style={{ fontSize: 10, color: '#FCA5A5', marginLeft: 24, margin: '2px 0 2px 24px' }}>{b.treatment} — {b.condition.replace(/([A-Z])/g, ' $1').toLowerCase()}</p>)}
        </div>
      )}
      {flags.length > 0 && (
        <div style={{ background: '#2A2210', border: `1px solid ${accent}40`, borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><span style={{ fontSize: 13 }}>&#9888;&#65039;</span><span style={{ fontSize: 11, fontWeight: 700, color: accent }}>Therapist Review Required</span></div>
          {flags.map((f, i) => <p key={i} style={{ fontSize: 10, color: '#D4B96A', marginLeft: 24, margin: '2px 0 2px 24px' }}>{f.treatment} — {f.condition.replace(/([A-Z])/g, ' $1').toLowerCase()}</p>)}
        </div>
      )}
    </div>
  )
}

const SignaturePad = ({ onSign, bg }) => {
  const ref = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [signed, setSigned] = useState(false)
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top } }
  const start = (e) => { e.preventDefault(); setDrawing(true); const ctx = ref.current.getContext('2d'); ctx.beginPath(); const p = pos(e); ctx.moveTo(p.x, p.y) }
  const draw = (e) => { if (!drawing) return; e.preventDefault(); const ctx = ref.current.getContext('2d'); ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setSigned(true) }
  const stop = () => { setDrawing(false); if (signed) onSign(true) }
  const clear = () => { ref.current.getContext('2d').clearRect(0, 0, ref.current.width, ref.current.height); setSigned(false); onSign(false) }
  return (
    <div>
      <div style={{ position: 'relative', border: '2px dashed #2A2520', borderRadius: 12, overflow: 'hidden', background: '#141414' }}>
        <canvas ref={ref} width={320} height={100} style={{ width: '100%', touchAction: 'none' }} onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop} onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
        {!signed && <p style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3A3530', fontSize: 11, pointerEvents: 'none' }}>Sign here</p>}
      </div>
      {signed && <button type="button" onClick={clear} style={{ marginTop: 4, fontSize: 10, color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN PORTAL COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ClientPortal() {
  const { slug } = useParams()
  const [view, setView] = useState('loading') // loading, auth, home, form, submitted
  const [authMode, setAuthMode] = useState('login') // login, signup
  const [biz, setBiz] = useState(null)
  const [user, setUser] = useState(null)
  const [myData, setMyData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [winW, setWinW] = useState(typeof window !== 'undefined' ? window.innerWidth : 390)

  // Form state
  const [step, setStep] = useState(0)
  const [fd, setFd] = useState({})
  const topRef = useRef(null)

  const isDesktop = winW >= 768

  useEffect(() => {
    const onResize = () => setWinW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const accent = biz?.accent_color || '#C9A84C'
  const bg = biz?.bg_color || '#111111'

  const set = (k, v) => setFd(p => ({ ...p, [k]: v }))
  const alerts = getAlerts(fd)

  // Load business info
  useEffect(() => {
    if (!slug) return
    apiFetch(`/client/${slug}/info`)
      .then(data => {
        setBiz(data)
        const token = sessionStorage.getItem('client_token')
        if (token) {
          apiFetch('/client/auth/me')
            .then(u => { setUser(u); setView('home') })
            .catch(() => { sessionStorage.removeItem('client_token'); setView('auth') })
        } else {
          setView('auth')
        }
      })
      .catch(() => setView('not_found'))
  }, [slug])

  // Load consumer data when authenticated
  useEffect(() => {
    if (user && slug && view === 'home') {
      apiFetch(`/client/${slug}/my-data`).then(setMyData).catch(() => {})
    }
  }, [user, slug, view])

  useEffect(() => { topRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [step])

  // ─── AUTH HANDLERS ───
  const handleAuth = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const endpoint = authMode === 'signup' ? '/client/auth/signup' : '/client/auth/login'
      const body = authMode === 'signup'
        ? { name: fd.authName, email: fd.authEmail, phone: fd.authPhone, password: fd.authPassword, business_id: biz.business_id }
        : { email: fd.authEmail, password: fd.authPassword }
      const data = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) })
      sessionStorage.setItem('client_token', data.token)
      setUser(data.user)
      setView('home')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    sessionStorage.removeItem('client_token')
    setUser(null)
    setMyData(null)
    setView('auth')
    setFd({})
    setStep(0)
  }

  // ─── FORM SUBMIT ───
  const submitForm = async () => {
    setLoading(true)
    try {
      const result = await apiFetch(`/consultation/public/${slug}/submit`, {
        method: 'POST',
        body: JSON.stringify({ form_data: fd }),
      })
      setView('submitted')
      // Refresh data
      if (user) apiFetch(`/client/${slug}/my-data`).then(setMyData).catch(() => {})
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    if (step === 0) return fd.fullName && fd.dob && fd.mobile && fd.email && fd.emergencyName && fd.emergencyPhone && fd.gpName
    if (step === 5) return fd.consent1 && fd.consent2 && fd.consent3 && fd.consent4 && fd.consent5 && fd.consent6 && fd.consent7 && fd.consent8 && fd.signed
    return true
  }

  // ─── BRANDED HEADER ───
  const Header = ({ title, showBack, onBack }) => (
    <div style={{ background: bg, position: 'relative', overflow: 'hidden' }}>
      {biz?.banner_url && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <img src={biz.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${bg}99 0%, ${bg}DD 60%, ${bg} 100%)` }} />
        </div>
      )}
      <div style={{ position: 'relative', padding: '32px 16px 24px', textAlign: 'center' }}>
        {showBack && (
          <button onClick={onBack} style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#999', fontSize: 11, cursor: 'pointer' }}>
            ← Back
          </button>
        )}
        <div style={{ width: 48, height: 48, borderRadius: 16, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 18, fontWeight: 700, color: bg, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {biz?.name?.charAt(0) || 'R'}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: accent, letterSpacing: '-0.02em', margin: 0 }}>{biz?.name || ''}</h1>
        {biz?.subtitle && <p style={{ fontSize: 10, color: '#999', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '2px 0 0' }}>{biz.subtitle}</p>}
        {title && (
          <div style={{ display: 'inline-block', marginTop: 12, padding: '6px 16px', borderRadius: 20, background: accent + '20' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: accent, margin: 0 }}>{title}</p>
          </div>
        )}
      </div>
    </div>
  )

  const shell = { minHeight: '100vh', background: '#0D0D0D', fontFamily: "'Figtree', sans-serif" }
  const card = { background: '#1A1A1A', borderRadius: 16, border: '1px solid #2A2520', padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
  const btn = (primary) => ({
    width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    background: primary ? accent : '#1A1A1A', color: primary ? bg : '#999', boxShadow: primary ? `0 2px 8px ${accent}40` : 'none',
    ...(primary ? {} : { border: '1px solid #2A2520' }),
  })

  // ═══════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════
  if (view === 'loading') return (
    <div style={{ ...shell, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 16, fontWeight: 700, color: '#111' }}>R</div>
        <p style={{ fontSize: 12, color: '#666' }}>Loading...</p>
      </div>
    </div>
  )

  if (view === 'not_found') return (
    <div style={{ ...shell, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ textAlign: 'center', padding: 24 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#E5E5E5' }}>Business not found</p>
        <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Check the link and try again</p>
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // AUTH — LOGIN / SIGNUP
  // ═══════════════════════════════════════════════════════════════
  if (view === 'auth') return (
    <div style={shell}>
      <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      {isDesktop ? (
        /* ═══ DESKTOP: split layout ═══ */
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          {/* Left — banner */}
          <div style={{ width: '55%', position: 'relative', overflow: 'hidden', background: bg }}>
            {biz?.banner_url && <img src={biz.banner_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${bg}CC 0%, ${bg}EE 50%, ${bg}DD 100%)` }} />
            <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: bg, boxShadow: `0 8px 32px ${accent}40`, marginBottom: 20 }}>
                {biz?.name?.charAt(0) || 'R'}
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 800, color: accent, letterSpacing: '-0.03em', margin: 0 }}>{biz?.name || ''}</h1>
              {biz?.subtitle && <p style={{ fontSize: 13, color: '#888', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 6 }}>{biz.subtitle}</p>}
              {biz?.address && <p style={{ fontSize: 12, color: '#666', marginTop: 16 }}>{biz.address}</p>}
            </div>
          </div>
          {/* Right — form */}
          <div style={{ width: '45%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, background: '#141414' }}>
            <div style={{ maxWidth: 380, width: '100%' }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#E5E5E5', marginBottom: 4 }}>{authMode === 'signup' ? 'Create Your Account' : 'Welcome Back'}</h2>
              <p style={{ fontSize: 12, color: '#8B8570', marginBottom: 24 }}>{authMode === 'signup' ? `Join ${biz?.name || ''} to manage your bookings and treatments` : `Sign in to your ${biz?.name || ''} account`}</p>
              {authMode === 'signup' && <Input label="Full Name" name="authName" value={fd.authName} onChange={set} placeholder="Your name" />}
              <Input label="Email" type="email" name="authEmail" value={fd.authEmail} onChange={set} placeholder="you@email.com" />
              {authMode === 'signup' && <Input label="Phone" type="tel" name="authPhone" value={fd.authPhone} onChange={set} placeholder="07..." />}
              <Input label="Password" type="password" name="authPassword" value={fd.authPassword} onChange={set} placeholder={authMode === 'signup' ? 'Min 8 characters' : 'Your password'} />
              {error && <p style={{ fontSize: 11, color: '#F87171', marginBottom: 12, padding: '8px 12px', background: '#2A1215', borderRadius: 8 }}>{error}</p>}
              <button onClick={handleAuth} disabled={loading} style={{ ...btn(true), opacity: loading ? 0.6 : 1, marginBottom: 16 }}>
                {loading ? '...' : authMode === 'signup' ? 'Create Account' : 'Log In'}
              </button>
              <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
                {authMode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
                <button onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setError('') }}
                  style={{ background: 'none', border: 'none', color: accent, fontWeight: 600, cursor: 'pointer', fontSize: 11 }}>
                  {authMode === 'signup' ? 'Log in' : 'Sign up'}
                </button>
              </p>
              <p style={{ fontSize: 10, color: '#3A3530', textAlign: 'center', marginTop: 32 }}>Powered by <span style={{ fontWeight: 700, color: accent }}>ReeveOS</span></p>
            </div>
          </div>
        </div>
      ) : (
        /* ═══ MOBILE: stacked layout ═══ */
        <>
        <Header title={authMode === 'signup' ? 'Create Your Account' : 'Welcome Back'} />
        <div style={{ maxWidth: 400, margin: '0 auto', padding: '16px 16px 32px' }}>
          <div style={card}>
            {authMode === 'signup' && <Input label="Full Name" name="authName" value={fd.authName} onChange={set} placeholder="Your name" />}
            <Input label="Email" type="email" name="authEmail" value={fd.authEmail} onChange={set} placeholder="you@email.com" />
            {authMode === 'signup' && <Input label="Phone" type="tel" name="authPhone" value={fd.authPhone} onChange={set} placeholder="07..." />}
            <Input label="Password" type="password" name="authPassword" value={fd.authPassword} onChange={set} placeholder={authMode === 'signup' ? 'Min 8 characters' : 'Your password'} />
            {error && <p style={{ fontSize: 11, color: '#F87171', marginBottom: 12, padding: '8px 12px', background: '#2A1215', borderRadius: 8 }}>{error}</p>}
            <button onClick={handleAuth} disabled={loading} style={{ ...btn(true), opacity: loading ? 0.6 : 1, marginBottom: 12 }}>
              {loading ? '...' : authMode === 'signup' ? 'Create Account' : 'Log In'}
            </button>
            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
              {authMode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
              <button onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setError('') }}
                style={{ background: 'none', border: 'none', color: accent, fontWeight: 600, cursor: 'pointer', fontSize: 11 }}>
                {authMode === 'signup' ? 'Log in' : 'Sign up'}
              </button>
            </p>
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, color: '#3A3530', marginTop: 24 }}>Powered by <span style={{ fontWeight: 700, color: accent }}>ReeveOS</span></p>
        </div>
        </>
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // HOME — consumer dashboard
  // ═══════════════════════════════════════════════════════════════
  if (view === 'home') {
    const cs = myData?.consultation
    const hasForm = cs && cs.status !== 'expired'
    const upcoming = myData?.upcoming_bookings || []
    const isSalon = biz?.type === 'salon' || biz?.type === 'local_service' || biz?.category === 'salon'

    return (
      <div style={shell}>
        <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <div style={{ background: bg, padding: '24px 16px 20px' }}>
          <div style={{ maxWidth: isDesktop ? 960 : 400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, ${accent}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                {(user?.name || '?').charAt(0)}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: accent, margin: 0 }}>Hi {(user?.name || '').split(' ')[0]}</p>
                <p style={{ fontSize: 10, color: '#999', margin: 0 }}>{biz?.name}</p>
              </div>
            </div>
            <button onClick={logout} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#999', fontSize: 10, cursor: 'pointer' }}>Log out</button>
          </div>
        </div>

        <div style={{ maxWidth: isDesktop ? 960 : 400, margin: '0 auto', padding: isDesktop ? '24px 24px 32px' : '16px 16px 32px' }}>
          <div style={isDesktop ? { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 } : {}}>
          <div>
          {/* Consultation form status — salon/local services only */}
          {isSalon && (
          <div style={{ ...card, marginBottom: 12, border: hasForm ? '1px solid #1A3A20' : `1px solid ${accent}40`, background: hasForm ? '#0D1F12' : '#1A1810' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: hasForm ? '#22c55e' : accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {hasForm
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="M9 15h6" /></svg>}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: hasForm ? '#4ADE80' : accent, margin: 0 }}>
                  {hasForm ? 'Consultation Form Complete' : 'Consultation Form Required'}
                </p>
                <p style={{ fontSize: 10, color: hasForm ? '#34D399' : '#8B8570', margin: '2px 0 0' }}>
                  {hasForm ? `Valid until ${new Date(cs.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Please complete before your appointment'}
                </p>
              </div>
            </div>
            {!hasForm && (
              <button onClick={() => { setStep(0); setView('form') }} style={{ ...btn(true), marginTop: 12, fontSize: 11 }}>
                Complete Consultation Form
              </button>
            )}
          </div>
          )}

          {/* Alerts from form */}
          {isSalon && cs?.alerts?.blocks?.length > 0 && (
            <div style={{ ...card, marginBottom: 12, background: '#2A1215', border: '1px solid #5C2020' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#F87171', marginBottom: 4 }}>&#128683; Blocked Treatments</p>
              {cs.alerts.blocks.map((b, i) => <p key={i} style={{ fontSize: 10, color: '#FCA5A5', margin: '2px 0' }}>{b.label} — {b.condition}</p>)}
            </div>
          )}

          {/* Upcoming bookings */}
          {upcoming.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#C9A84C', marginBottom: 8 }}>Upcoming</p>
              {upcoming.map((b, i) => (
                <div key={i} style={{ ...card, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#E5E5E5', margin: 0 }}>{b.service}</p>
                    <p style={{ fontSize: 10, color: '#8B8570', margin: '2px 0 0' }}>{b.date} · {b.time}{b.staff ? ` · ${b.staff}` : ''}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: hasForm ? '#22c55e' : '#eab308' }} />
                    <span style={{ fontSize: 9, color: hasForm ? '#16a34a' : '#ca8a04' }}>{hasForm ? 'Ready' : 'Form needed'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>{/* end left column */}

          <div>{/* right column */}
          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { icon: '&#128197;', label: 'Book Appointment', action: () => window.open(`/${slug}`, '_blank'), show: true },
              { icon: '&#128203;', label: hasForm ? 'View Form' : 'Fill Form', action: () => { setStep(0); setView('form') }, show: isSalon },
              { icon: '&#128100;', label: 'My Profile', action: () => {}, show: true },
              { icon: '&#128172;', label: 'Message Us', action: () => {}, show: true },
            ].filter(a => a.show).map((a, i) => (
              <button key={i} onClick={a.action} style={{ ...card, cursor: 'pointer', textAlign: 'center', padding: 16, border: '1px solid #2A2520' }}>
                <span style={{ fontSize: 20 }} dangerouslySetInnerHTML={{ __html: a.icon }} />
                <p style={{ fontSize: 10, fontWeight: 600, color: '#E5E5E5', margin: '8px 0 0' }}>{a.label}</p>
              </button>
            ))}
          </div>

          {/* Past treatments */}
          {myData?.past_bookings?.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#C9A84C', marginBottom: 8 }}>Treatment History</p>
              {myData.past_bookings.slice(0, 5).map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1E1E1E' }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#E5E5E5', margin: 0 }}>{b.service}</p>
                    <p style={{ fontSize: 10, color: '#666', margin: 0 }}>{b.date}{b.staff ? ` · ${b.staff}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>{/* end right column */}
          </div>{/* end grid */}
          <p style={{ textAlign: 'center', fontSize: 10, color: '#3A3530', marginTop: 24 }}>Powered by <span style={{ fontWeight: 700, color: accent }}>ReeveOS</span></p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // FORM SUBMITTED
  // ═══════════════════════════════════════════════════════════════
  if (view === 'submitted') return (
    <div style={{ ...shell, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ ...card, maxWidth: 380, width: '100%', textAlign: 'center', padding: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: accent + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#E5E5E5', marginBottom: 4 }}>Form Submitted</h2>
        <p style={{ fontSize: 11, color: '#8B8570', marginBottom: 16 }}>Thank you, {fd.fullName}. Your consultation form has been received by {biz?.name}.</p>
        {(alerts.blocks.length > 0 || alerts.flags.length > 0) && (
          <div style={{ textAlign: 'left', marginBottom: 16 }}><AlertBanner blocks={alerts.blocks} flags={alerts.flags} accent={accent} /></div>
        )}
        <p style={{ fontSize: 10, color: '#8B8570', marginBottom: 16 }}>Your therapist will review before your appointment.</p>
        <button onClick={() => setView('home')} style={btn(true)}>Back to Home</button>
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // CONSULTATION FORM — 6 step flow
  // ═══════════════════════════════════════════════════════════════
  if (view === 'form') return (
    <div style={shell}>
      <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div ref={topRef} />
      {!isDesktop && <Header title="Client Consultation Form" showBack onBack={() => setView('home')} />}

      {/* Desktop: compact branded strip */}
      {isDesktop && (
        <div style={{ background: bg, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: bg }}>{biz?.name?.charAt(0) || 'R'}</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: accent, margin: 0 }}>{biz?.name}</p>
              {biz?.subtitle && <p style={{ fontSize: 9, color: '#888', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{biz.subtitle}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ padding: '5px 14px', borderRadius: 16, background: accent + '20' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: accent }}>Client Consultation Form</span>
            </div>
            <button onClick={() => setView('home')} style={{ background: '#1A1A1A', border: '1px solid #2A2520', borderRadius: 8, padding: '6px 14px', color: '#8B8570', fontSize: 11, cursor: 'pointer' }}>← Back</button>
          </div>
        </div>
      )}

      {/* Progress */}
      <div style={{ background: '#141414', borderBottom: '1px solid #2A2520', padding: '10px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: isDesktop ? 640 : 400, margin: '0 auto' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: isDesktop ? 28 : 24, height: isDesktop ? 28 : 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isDesktop ? 11 : 10, fontWeight: 700,
                  background: i < step ? '#22c55e' : i === step ? accent : '#1E1E1E',
                  color: i < step ? '#fff' : i === step ? bg : '#555',
                }}>{i < step ? '✓' : i + 1}</div>
                {isDesktop && <span style={{ fontSize: 9, color: i === step ? accent : '#555', fontWeight: i === step ? 700 : 400, marginTop: 3 }}>{s}</span>}
              </div>
              {i < STEPS.length - 1 && <div style={{ width: isDesktop ? 32 : 12, height: 1, margin: `0 ${isDesktop ? 4 : 2}px`, background: i < step ? '#22c55e' : '#2A2520' }} />}
            </div>
          ))}
        </div>
        {!isDesktop && <p style={{ textAlign: 'center', fontSize: 10, color: '#666', marginTop: 4, fontWeight: 600 }}>Step {step + 1}: {STEPS[step]}</p>}
      </div>

      {/* Form body */}
      <div style={{ maxWidth: isDesktop ? 640 : 400, margin: '0 auto', padding: isDesktop ? '24px 16px 0' : '16px 16px 0' }}>
        <div style={{ ...card, padding: isDesktop ? 24 : 16 }}>

          {/* Step 0: Personal */}
          {step === 0 && (<div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#E5E5E5', marginBottom: 2 }}>Personal Details</h2>
            <p style={{ fontSize: 10, color: '#8B8570', marginBottom: 16 }}>Used for your treatment records</p>
            <Input label="Full Name *" name="fullName" value={fd.fullName} onChange={set} placeholder="Your full name" />
            <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 8 }}>
              <Input label="Date of Birth *" type="date" name="dob" value={fd.dob} onChange={set} />
              <Input label="Address" name="address" value={fd.address} onChange={set} placeholder="Full address" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input label="Mobile *" type="tel" name="mobile" value={fd.mobile} onChange={set} placeholder="07..." />
              <Input label="Email *" type="email" name="email" value={fd.email} onChange={set} placeholder="you@email.com" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input label="Emergency Contact *" name="emergencyName" value={fd.emergencyName} onChange={set} placeholder="Name" />
              <Input label="Their Number *" type="tel" name="emergencyPhone" value={fd.emergencyPhone} onChange={set} placeholder="07..." />
            </div>
            <Input label="GP Name *" name="gpName" value={fd.gpName} onChange={set} placeholder="Dr..." />
            <Input label="GP Surgery" name="gpAddress" value={fd.gpAddress} onChange={set} placeholder="Optional" />
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#C9A84C', marginBottom: 4 }}>How did you hear about us?</label>
              <select value={fd.referral || ''} onChange={e => set('referral', e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #2A2520', fontSize: 11, background: '#141414', color: '#E5E5E5', boxSizing: 'border-box' }}>
                <option value="">Select...</option>
                {['Instagram', 'TikTok', 'Google', 'Friend / Referral', 'Returning Client', 'Other'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ background: '#141414', borderRadius: 12, padding: 12, marginTop: 12, border: '1px solid #2A2520' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#C9A84C', marginBottom: 8 }}>Photo Consent</p>
              <Tick label="Treatment records (clinical use only)" checked={fd.photoRecords} onChange={() => set('photoRecords', !fd.photoRecords)} accent={accent} />
              <Tick label="Training purposes" checked={fd.photoTraining} onChange={() => set('photoTraining', !fd.photoTraining)} accent={accent} />
              <Tick label="Marketing & social media" checked={fd.photoMarketing} onChange={() => set('photoMarketing', !fd.photoMarketing)} accent={accent} />
            </div>
          </div>)}

          {/* Step 1: Medical */}
          {step === 1 && (<div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#E5E5E5', marginBottom: 2 }}>Medical History</h2>
            <p style={{ fontSize: 10, color: '#8B8570', marginBottom: 16 }}>Determines which treatments are safe for you</p>
            <YesNo label="Pregnant, breastfeeding, or trying to conceive?" name="pregnant" value={fd.pregnant} onChange={set} accent={accent} />
            <YesNo label="Heart condition or high blood pressure?" name="heartCondition" value={fd.heartCondition} onChange={set} accent={accent} detail detailLabel="Controlled or uncontrolled?" detailValue={fd.heartConditionDetail} onDetailChange={set} />
            <YesNo label="Pacemaker or electronic implant?" name="pacemaker" value={fd.pacemaker} onChange={set} accent={accent} />
            <YesNo label="Metal implants, plates, or screws?" name="metalImplants" value={fd.metalImplants} onChange={set} accent={accent} detail detailLabel="Where?" detailValue={fd.metalImplantsDetail} onDetailChange={set} />
            <YesNo label="Diabetes?" name="diabetes" value={fd.diabetes} onChange={set} accent={accent} detail detailLabel="Type 1/2? Controlled?" detailValue={fd.diabetesDetail} onDetailChange={set} />
            <YesNo label="Epilepsy?" name="epilepsy" value={fd.epilepsy} onChange={set} accent={accent} />
            <YesNo label="Autoimmune disorder?" name="autoimmune" value={fd.autoimmune} onChange={set} accent={accent} detail detailLabel="e.g. Lupus, scleroderma..." detailValue={fd.autoimmuneDetail} onDetailChange={set} />
            <YesNo label="Blood clotting disorder?" name="bloodClotting" value={fd.bloodClotting} onChange={set} accent={accent} />
            <YesNo label="Cancer history?" name="activeCancer" value={fd.activeCancer} onChange={set} accent={accent} detail detailLabel="Type, when, status..." detailValue={fd.activeCancerDetail} onDetailChange={set} />
            <YesNo label="HIV/AIDS or hepatitis?" name="hivHepatitis" value={fd.hivHepatitis} onChange={set} accent={accent} />
            <YesNo label="Liver or kidney disease?" name="liverKidney" value={fd.liverKidney} onChange={set} accent={accent} />
            <YesNo label="History of cold sores (herpes simplex)?" name="herpes" value={fd.herpes} onChange={set} accent={accent} />
            <YesNo label="History of keloid or raised scarring?" name="keloid" value={fd.keloid} onChange={set} accent={accent} />
            <AlertBanner blocks={alerts.blocks} flags={alerts.flags} accent={accent} />
          </div>)}

          {/* Step 2: Medications */}
          {step === 2 && (<div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#E5E5E5', marginBottom: 2 }}>Current Medications</h2>
            <p style={{ fontSize: 10, color: '#8B8570', marginBottom: 16 }}>Medication interactions are the #1 cause of adverse events</p>
            <YesNo label="Roaccutane / Isotretinoin?" name="roaccutane" value={fd.roaccutane} onChange={set} accent={accent} sublabel="Must be 6+ months clear before treatment" detail detailLabel="Still taking? Or stop date..." detailValue={fd.roaccutaneDetail} onDetailChange={set} />
            <YesNo label="Blood thinners?" name="bloodThinners" value={fd.bloodThinners} onChange={set} accent={accent} sublabel="Warfarin, heparin, clopidogrel, daily aspirin" detail detailLabel="Which?" detailValue={fd.bloodThinnersDetail} onDetailChange={set} />
            <YesNo label="Photosensitising medications?" name="photosensitising" value={fd.photosensitising} onChange={set} accent={accent} sublabel="Tetracyclines, doxycycline, St John's Wort" detail detailLabel="Which?" detailValue={fd.photosensitivesDetail} onDetailChange={set} />
            <YesNo label="Topical retinoids?" name="retinoids" value={fd.retinoids} onChange={set} accent={accent} sublabel="Retin-A, Tretinoin, Differin, Epiduo" detail detailLabel="Product and last used?" detailValue={fd.retinoidsDetail} onDetailChange={set} />
            <YesNo label="Steroids (oral or topical)?" name="steroids" value={fd.steroids} onChange={set} accent={accent} detail detailLabel="Which?" detailValue={fd.steroidsDetail} onDetailChange={set} />
            <YesNo label="Immunosuppressants?" name="immunosuppressants" value={fd.immunosuppressants} onChange={set} accent={accent} />
            <YesNo label="Herbal supplements?" name="herbalSupps" value={fd.herbalSupps} onChange={set} accent={accent} sublabel="Garlic, ginkgo, fish oils affect bleeding" detail detailLabel="Which?" detailValue={fd.herbalSuppsDetail} onDetailChange={set} />
            <YesNo label="Fish or salmon allergy?" name="fishAllergy" value={fd.fishAllergy} onChange={set} accent={accent} sublabel="Important for polynucleotide treatments" />
            <Input label="Any other medications?" name="otherMeds" value={fd.otherMeds} onChange={set} placeholder="List any others..." />
            <AlertBanner blocks={alerts.blocks} flags={alerts.flags} accent={accent} />
          </div>)}

          {/* Step 3: Skin */}
          {step === 3 && (<div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#E5E5E5', marginBottom: 2 }}>Skin History</h2>
            <p style={{ fontSize: 10, color: '#8B8570', marginBottom: 16 }}>Helps tailor your treatment plan</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#C9A84C', marginBottom: 6 }}>Fitzpatrick Skin Type</label>
              <p style={{ fontSize: 10, color: '#8B8570', marginBottom: 8 }}>How does your skin respond to sun?</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {[
                  { v: 'I', bg: '#FDEBD0', x: 'Always burns' }, { v: 'II', bg: '#F5CBA7', x: 'Usually burns' },
                  { v: 'III', bg: '#E0B88A', x: 'Sometimes' }, { v: 'IV', bg: '#C4956A', x: 'Rarely burns' },
                  { v: 'V', bg: '#8B6914', x: 'Very rarely' }, { v: 'VI', bg: '#5C4033', x: 'Never burns' },
                ].map(t => (
                  <button key={t.v} type="button" onClick={() => set('fitzpatrick', t.v)}
                    style={{ padding: 6, borderRadius: 8, border: fd.fitzpatrick === t.v ? `2px solid ${accent}` : '2px solid #2A2520', background: '#1A1A1A', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ width: isDesktop ? 36 : 24, height: isDesktop ? 36 : 24, borderRadius: '50%', margin: '0 auto 4px', background: t.bg }} />
                    <p style={{ fontSize: isDesktop ? 11 : 10, fontWeight: 700, color: '#E5E5E5', margin: 0 }}>{t.v}</p>
                    {isDesktop && <p style={{ fontSize: 8, color: '#8B8570', margin: '2px 0 0' }}>{t.x}</p>}
                  </button>
                ))}
              </div>
            </div>
            <YesNo label="Active acne, eczema, psoriasis, or dermatitis?" name="skinCondition" value={fd.skinCondition} onChange={set} accent={accent} detail detailLabel="Which and where?" detailValue={fd.skinConditionDetail} onDetailChange={set} />
            <YesNo label="Active skin infection?" name="skinInfection" value={fd.skinInfection} onChange={set} accent={accent} />
            <YesNo label="Raised moles or warts in treatment area?" name="molesWarts" value={fd.molesWarts} onChange={set} accent={accent} />
            <YesNo label="Tattoos or permanent makeup in treatment area?" name="tattoos" value={fd.tattoos} onChange={set} accent={accent} />
            <YesNo label="Previous adverse reactions to skin treatments?" name="adverseReactions" value={fd.adverseReactions} onChange={set} accent={accent} detail detailLabel="What happened?" detailValue={fd.adverseReactionsDetail} onDetailChange={set} />
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#C9A84C', marginBottom: 8 }}>Skin concerns</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Acne', 'Scarring', 'Pigmentation', 'Rosacea', 'Fine lines', 'Texture', 'Pores', 'Dullness', 'Sagging'].map(c => (
                  <button key={c} type="button" onClick={() => { const cs = fd.concerns || []; set('concerns', cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]) }}
                    style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, border: (fd.concerns || []).includes(c) ? `2px solid ${accent}` : '2px solid #2A2520', background: (fd.concerns || []).includes(c) ? accent + '20' : '#141414', color: (fd.concerns || []).includes(c) ? accent : '#666', cursor: 'pointer' }}>{c}</button>
                ))}
              </div>
            </div>
            <AlertBanner blocks={alerts.blocks} flags={alerts.flags} accent={accent} />
          </div>)}

          {/* Step 4: Lifestyle */}
          {step === 4 && (<div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#E5E5E5', marginBottom: 2 }}>Lifestyle</h2>
            <p style={{ fontSize: 10, color: '#8B8570', marginBottom: 16 }}>Sun exposure affects treatment safety</p>
            <YesNo label="Significant sun exposure in the last 2 weeks?" name="sunburn" value={fd.sunburn} onChange={set} accent={accent} />
            <YesNo label="Sunbed use in the last 4 weeks?" name="sunbed" value={fd.sunbed} onChange={set} accent={accent} />
            <YesNo label="Currently have a tan (natural or self-tan)?" name="tan" value={fd.tan} onChange={set} accent={accent} />
            <YesNo label="Planned sun exposure in the next 4 weeks?" name="plannedSun" value={fd.plannedSun} onChange={set} accent={accent} sublabel="Holiday, outdoor event etc." />
            <YesNo label="Do you smoke?" name="smoker" value={fd.smoker} onChange={set} accent={accent} />
            <AlertBanner blocks={alerts.blocks} flags={alerts.flags} accent={accent} />
          </div>)}

          {/* Step 5: Consent */}
          {step === 5 && (<div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#E5E5E5', marginBottom: 2 }}>Consent & Signature</h2>
            <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 12 }}>Read each statement and tick to confirm</p>
            {alerts.blocks.length > 0 && <AlertBanner blocks={alerts.blocks} flags={alerts.flags} accent={accent} />}
            <div style={{ background: '#141414', borderRadius: 12, padding: 6, marginTop: 12, ...(isDesktop ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 } : {}) }}>
              <Tick label="The information I've provided is accurate and complete." checked={fd.consent1} onChange={() => set('consent1', !fd.consent1)} accent={accent} />
              <Tick label="Withholding information may cause adverse reactions I accept liability for." checked={fd.consent2} onChange={() => set('consent2', !fd.consent2)} accent={accent} />
              <Tick label="I will inform my therapist if my medical circumstances change." checked={fd.consent3} onChange={() => set('consent3', !fd.consent3)} accent={accent} />
              <Tick label="I understand the risks and nature of the treatments discussed." checked={fd.consent4} onChange={() => set('consent4', !fd.consent4)} accent={accent} />
              <Tick label="I agree to follow pre- and post-treatment care instructions." checked={fd.consent5} onChange={() => set('consent5', !fd.consent5)} accent={accent} />
              <Tick label="I understand the 72-hour cancellation policy for advanced treatments." checked={fd.consent6} onChange={() => set('consent6', !fd.consent6)} accent={accent} />
              <Tick label="I consent to my data being stored securely under UK GDPR." checked={fd.consent7} onChange={() => set('consent7', !fd.consent7)} accent={accent} />
              <Tick label="Results vary and no specific outcome is guaranteed." checked={fd.consent8} onChange={() => set('consent8', !fd.consent8)} accent={accent} />
            </div>
            <div style={{ marginTop: 16, maxWidth: isDesktop ? 480 : '100%' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#C9A84C', marginBottom: 6 }}>Your Signature *</label>
              <SignaturePad onSign={s => set('signed', s)} bg={bg} />
            </div>
            <p style={{ fontSize: 10, color: '#666', marginTop: 12, textAlign: 'center' }}>Valid for 6 months. You'll be prompted to re-sign before expiry.</p>
          </div>)}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingBottom: 24, maxWidth: isDesktop ? 300 : '100%', marginLeft: isDesktop ? 'auto' : 0 }}>
          {step > 0 && <button onClick={() => setStep(step - 1)} style={{ ...btn(false), flex: 1 }}>Back</button>}
          {step < STEPS.length - 1 ? (
            <button onClick={() => canProceed() && setStep(step + 1)} disabled={!canProceed()}
              style={{ ...btn(true), flex: 1, opacity: canProceed() ? 1 : 0.4, cursor: canProceed() ? 'pointer' : 'not-allowed', background: canProceed() ? accent : '#1E1E1E', color: canProceed() ? bg : '#555', boxShadow: 'none' }}>Continue</button>
          ) : (
            <button onClick={() => canProceed() && submitForm()} disabled={!canProceed() || loading}
              style={{ ...btn(true), flex: 1, opacity: canProceed() && !loading ? 1 : 0.4, cursor: canProceed() ? 'pointer' : 'not-allowed' }}>
              {loading ? 'Submitting...' : 'Submit Form'}
            </button>
          )}
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, color: '#3A3530', paddingBottom: 16 }}>Powered by <span style={{ fontWeight: 700, color: accent }}>ReeveOS</span></p>
      </div>
    </div>
  )

  return null
}
