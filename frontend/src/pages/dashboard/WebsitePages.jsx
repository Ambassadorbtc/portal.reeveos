/**
 * WebsitePages — pages list/management view for the website builder.
 * Landing page at /dashboard/website.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

/* ─── Relative time helper ─── */
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const now = new Date()
  const then = new Date(dateStr)
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

/* ─── Slug helper ─── */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/* ─── Inline SVG Icons (monochrome) ─── */
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />
  </svg>
)

const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const IconTemplate = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
  </svg>
)

const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const IconDuplicate = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const IconGrip = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" />
  </svg>
)

const IconUpload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

/* ─── Font options ─── */
const FONT_OPTIONS = [
  'Inter', 'Figtree', 'DM Sans', 'Poppins', 'Playfair Display', 'Cormorant Garamond'
]

/* ─── Shared styles ─── */
const btnPrimary = {
  background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 16px', fontFamily: 'Figtree, sans-serif', fontWeight: 600,
  fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
const btnSecondary = {
  background: '#111', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 16px', fontFamily: 'Figtree, sans-serif', fontWeight: 600,
  fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
const btnOutline = {
  background: '#fff', color: '#111', border: '1px solid #E5E5E5', borderRadius: 8,
  padding: '8px 16px', fontFamily: 'Figtree, sans-serif', fontWeight: 500,
  fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
const inputStyle = {
  width: '100%', padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: 8,
  fontFamily: 'Figtree, sans-serif', fontSize: 14, color: '#111', outline: 'none',
  boxSizing: 'border-box',
}
const labelStyle = {
  display: 'block', fontFamily: 'Figtree, sans-serif', fontSize: 13,
  fontWeight: 600, color: '#111', marginBottom: 4,
}
const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
}

/* ─── Delete Confirm Dialog ─── */
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={modalOverlay} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: 32, maxWidth: 400, width: '100%',
        fontFamily: 'Figtree, sans-serif',
      }}>
        <p style={{ fontSize: 15, color: '#111', margin: '0 0 24px', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnOutline}>Cancel</button>
          <button onClick={onConfirm} style={{ ...btnSecondary, background: '#dc2626' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   SETTINGS MODAL
   ═══════════════════════════════════════════════ */
function SettingsModal({ bid, settings: initialSettings, pages, onClose, onSaved }) {
  const [settings, setSettings] = useState(initialSettings || {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [settingsTab, setSettingsTab] = useState('general') // general | integrations
  const [subdomainStatus, setSubdomainStatus] = useState(null) // null | 'checking' | 'available' | 'taken'
  const [navItems, setNavItems] = useState([])
  const dragItem = useRef(null)
  const dragOver = useRef(null)

  useEffect(() => {
    // Build nav items from pages + settings
    const navPages = (settings.navigation || []).map(n => ({
      slug: n.slug,
      name: (pages || []).find(p => p.slug === n.slug)?.title || n.slug,
      showInNav: n.show_in_nav !== false,
    }))
    // Add pages not in nav
    const navSlugs = new Set(navPages.map(n => n.slug))
    const extra = (pages || []).filter(p => !navSlugs.has(p.slug)).map(p => ({
      slug: p.slug, name: p.title, showInNav: false,
    }))
    setNavItems([...navPages, ...extra])
  }, [settings.navigation, pages])

  const update = (key, val) => setSettings(prev => ({ ...prev, [key]: val }))
  const updateBrand = (key, val) => setSettings(prev => ({
    ...prev, brand: { ...(prev.brand || {}), [key]: val }
  }))
  const updateTypography = (key, val) => setSettings(prev => ({
    ...prev, typography: { ...(prev.typography || {}), [key]: val }
  }))
  const updateFooter = (key, val) => setSettings(prev => ({
    ...prev, footer: { ...(prev.footer || {}), [key]: val }
  }))
  const updateSocial = (key, val) => setSettings(prev => ({
    ...prev, footer: { ...(prev.footer || {}), social: { ...((prev.footer || {}).social || {}), [key]: val } }
  }))
  const updateDomain = (key, val) => setSettings(prev => ({
    ...prev, domain: { ...(prev.domain || {}), [key]: val }
  }))
  const updateIntegrations = (key, val) => setSettings(prev => ({
    ...prev, integrations: { ...(prev.integrations || {}), [key]: val }
  }))

  const checkSubdomain = async (subdomain) => {
    if (!subdomain || subdomain.length < 3) { setSubdomainStatus(null); return }
    setSubdomainStatus('checking')
    try {
      const res = await api.post(`/website/business/${bid}/settings/check-subdomain`, { subdomain })
      setSubdomainStatus(res.available ? 'available' : 'taken')
    } catch {
      setSubdomainStatus(null)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await api.upload(`/website/business/${bid}/settings/logo`, file)
      updateBrand('logo_url', res.url)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleFaviconUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await api.upload(`/website/business/${bid}/settings/favicon`, file)
      updateBrand('favicon_url', res.url)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDragStart = (idx) => { dragItem.current = idx }
  const handleDragEnter = (idx) => { dragOver.current = idx }
  const handleDragEnd = () => {
    const items = [...navItems]
    const dragged = items.splice(dragItem.current, 1)[0]
    items.splice(dragOver.current, 0, dragged)
    setNavItems(items)
    dragItem.current = null
    dragOver.current = null
  }

  const toggleNavVisibility = (idx) => {
    setNavItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, showInNav: !item.showInNav } : item
    ))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...settings,
        navigation: navItems.map(n => ({ slug: n.slug, show_in_nav: n.showInNav })),
      }
      await api.put(`/website/business/${bid}/settings`, payload)
      onSaved(payload)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const sectionTitle = (text) => (
    <h3 style={{ fontFamily: 'Figtree, sans-serif', fontSize: 15, fontWeight: 700, color: '#111', margin: '24px 0 12px', borderBottom: '1px solid #E5E5E5', paddingBottom: 8 }}>{text}</h3>
  )

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, maxWidth: 580, width: '100%', maxHeight: '90vh',
        overflow: 'auto', padding: 32, position: 'relative', fontFamily: 'Figtree, sans-serif',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111' }}>Website Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}><IconClose /></button>
        </div>

        {/* Settings Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E5E5E5', marginBottom: 20 }}>
          {[{ key: 'general', label: 'General' }, { key: 'integrations', label: 'Integrations' }].map(t => (
            <button key={t.key} onClick={() => setSettingsTab(t.key)} style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', fontFamily: 'Figtree, sans-serif',
              borderBottom: settingsTab === t.key ? '2px solid #C9A84C' : '2px solid transparent',
              color: settingsTab === t.key ? '#111' : '#999',
            }}>{t.label}</button>
          ))}
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {settingsTab === 'general' && <>
        {/* Site Info */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Site Title</label>
          <input style={inputStyle} value={settings.site_title || ''} onChange={e => update('site_title', e.target.value)} placeholder="My Business" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Tagline</label>
          <input style={inputStyle} value={settings.tagline || ''} onChange={e => update('tagline', e.target.value)} placeholder="A short description of your business" />
        </div>

        {/* Brand */}
        {sectionTitle('Brand')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Primary Colour</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={(settings.brand || {}).primary_color || '#C9A84C'} onChange={e => updateBrand('primary_color', e.target.value)}
                style={{ width: 36, height: 36, border: '1px solid #E5E5E5', borderRadius: 6, padding: 2, cursor: 'pointer' }} />
              <input style={{ ...inputStyle, flex: 1 }} value={(settings.brand || {}).primary_color || '#C9A84C'} onChange={e => updateBrand('primary_color', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Secondary Colour</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={(settings.brand || {}).secondary_color || '#111111'} onChange={e => updateBrand('secondary_color', e.target.value)}
                style={{ width: 36, height: 36, border: '1px solid #E5E5E5', borderRadius: 6, padding: 2, cursor: 'pointer' }} />
              <input style={{ ...inputStyle, flex: 1 }} value={(settings.brand || {}).secondary_color || '#111111'} onChange={e => updateBrand('secondary_color', e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Logo</label>
            {(settings.brand || {}).logo_url && (
              <img src={settings.brand.logo_url} alt="Logo" style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 8, border: '1px solid #E5E5E5', marginBottom: 8, display: 'block' }} />
            )}
            <label style={{ ...btnOutline, cursor: 'pointer', display: 'inline-flex' }}>
              <IconUpload /> Upload
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
            </label>
          </div>
          <div>
            <label style={labelStyle}>Favicon</label>
            {(settings.brand || {}).favicon_url && (
              <img src={settings.brand.favicon_url} alt="Favicon" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, border: '1px solid #E5E5E5', marginBottom: 8, display: 'block' }} />
            )}
            <label style={{ ...btnOutline, cursor: 'pointer', display: 'inline-flex' }}>
              <IconUpload /> Upload
              <input type="file" accept="image/*" onChange={handleFaviconUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Typography */}
        {sectionTitle('Typography')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Body Font</label>
            <select style={inputStyle} value={(settings.typography || {}).body_font || 'Figtree'} onChange={e => updateTypography('body_font', e.target.value)}>
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Heading Font</label>
            <select style={inputStyle} value={(settings.typography || {}).heading_font || 'Figtree'} onChange={e => updateTypography('heading_font', e.target.value)}>
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* Navigation */}
        {sectionTitle('Navigation')}
        <div style={{ marginBottom: 16 }}>
          {navItems.length === 0 && <p style={{ color: '#666', fontSize: 13, margin: 0 }}>No pages available. Create pages first.</p>}
          {navItems.map((item, idx) => (
            <div key={item.slug}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                border: '1px solid #E5E5E5', borderRadius: 8, marginBottom: 4,
                background: '#fff', cursor: 'grab', userSelect: 'none',
              }}>
              <span style={{ color: '#999' }}><IconGrip /></span>
              <span style={{ flex: 1, fontSize: 14, color: '#111' }}>{item.name}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666', cursor: 'pointer' }}>
                <input type="checkbox" checked={item.showInNav} onChange={() => toggleNavVisibility(idx)} style={{ accentColor: '#C9A84C' }} />
                Show in nav
              </label>
            </div>
          ))}
        </div>

        {/* Footer */}
        {sectionTitle('Footer')}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Footer Text</label>
          <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={(settings.footer || {}).text || ''} onChange={e => updateFooter('text', e.target.value)} placeholder="Copyright notice or footer message" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Instagram URL</label>
            <input style={inputStyle} value={((settings.footer || {}).social || {}).instagram || ''} onChange={e => updateSocial('instagram', e.target.value)} placeholder="https://instagram.com/..." />
          </div>
          <div>
            <label style={labelStyle}>Facebook URL</label>
            <input style={inputStyle} value={((settings.footer || {}).social || {}).facebook || ''} onChange={e => updateSocial('facebook', e.target.value)} placeholder="https://facebook.com/..." />
          </div>
          <div>
            <label style={labelStyle}>TikTok URL</label>
            <input style={inputStyle} value={((settings.footer || {}).social || {}).tiktok || ''} onChange={e => updateSocial('tiktok', e.target.value)} placeholder="https://tiktok.com/@..." />
          </div>
          <div>
            <label style={labelStyle}>X / Twitter URL</label>
            <input style={inputStyle} value={((settings.footer || {}).social || {}).twitter || ''} onChange={e => updateSocial('twitter', e.target.value)} placeholder="https://x.com/..." />
          </div>
        </div>

        {/* Domain */}
        {sectionTitle('Domain')}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Subdomain</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <input style={{ ...inputStyle, borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }}
              value={(settings.domain || {}).subdomain || ''}
              onChange={e => {
                const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                updateDomain('subdomain', v)
                checkSubdomain(v)
              }}
              placeholder="my-business" />
            <span style={{
              padding: '8px 12px', background: '#f5f5f5', border: '1px solid #E5E5E5',
              borderLeft: 'none', borderTopRightRadius: 8, borderBottomRightRadius: 8,
              fontSize: 14, color: '#666', fontFamily: 'Figtree, sans-serif', whiteSpace: 'nowrap',
            }}>.rezvo.site</span>
          </div>
          {subdomainStatus === 'checking' && <span style={{ fontSize: 12, color: '#666', marginTop: 4, display: 'block' }}>Checking availability...</span>}
          {subdomainStatus === 'available' && <span style={{ fontSize: 12, color: '#16a34a', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconCheck /> Available</span>}
          {subdomainStatus === 'taken' && <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4, display: 'block' }}>This subdomain is already taken</span>}
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Custom Domain</label>
          <input style={inputStyle} value={(settings.domain || {}).custom_domain || ''} onChange={e => updateDomain('custom_domain', e.target.value)} placeholder="www.mybusiness.com" />
          {(settings.domain || {}).custom_domain && (
            <div style={{ marginTop: 8, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #E5E5E5' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#111', margin: '0 0 4px' }}>DNS Instructions</p>
              <p style={{ fontSize: 12, color: '#666', margin: '0 0 2px' }}>Add a CNAME record pointing to your subdomain:</p>
              <code style={{ fontSize: 12, color: '#111', background: '#eee', padding: '2px 6px', borderRadius: 4 }}>
                CNAME {(settings.domain || {}).custom_domain} &rarr; {(settings.domain || {}).subdomain || 'your-subdomain'}.rezvo.site
              </code>
            </div>
          )}
        </div>

        </>}

        {settingsTab === 'integrations' && <>
          {/* Tracking */}
          {sectionTitle('Tracking & Analytics')}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Google Analytics 4 (Measurement ID)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={(settings.integrations || {}).ga4_id || ''} onChange={e => updateIntegrations('ga4_id', e.target.value)} placeholder="G-XXXXXXXXXX" />
              <button style={btnOutline} onClick={() => {
                const v = (settings.integrations || {}).ga4_id || ''
                if (/^G-[A-Z0-9]{6,}$/i.test(v)) setError(null) || alert('Valid GA4 ID')
                else setError('GA4 ID must match format G-XXXXXXXXXX')
              }}>Test</button>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Meta Pixel ID</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={(settings.integrations || {}).meta_pixel_id || ''} onChange={e => updateIntegrations('meta_pixel_id', e.target.value)} placeholder="123456789012345" />
              <button style={btnOutline} onClick={() => {
                const v = (settings.integrations || {}).meta_pixel_id || ''
                if (/^\d{10,}$/.test(v)) setError(null) || alert('Valid Pixel ID')
                else setError('Meta Pixel ID must be numeric (10+ digits)')
              }}>Test</button>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>TikTok Pixel ID</label>
            <input style={inputStyle} value={(settings.integrations || {}).tiktok_pixel_id || ''} onChange={e => updateIntegrations('tiktok_pixel_id', e.target.value)} placeholder="Pixel ID" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Google Tag Manager ID</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={(settings.integrations || {}).gtm_id || ''} onChange={e => updateIntegrations('gtm_id', e.target.value)} placeholder="GTM-XXXXXXX" />
              <button style={btnOutline} onClick={() => {
                const v = (settings.integrations || {}).gtm_id || ''
                if (/^GTM-[A-Z0-9]{4,}$/i.test(v)) setError(null) || alert('Valid GTM ID')
                else setError('GTM ID must match format GTM-XXXXXXX')
              }}>Test</button>
            </div>
          </div>

          {/* Communication */}
          {sectionTitle('Communication')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>WhatsApp Number</label>
              <input style={inputStyle} value={(settings.integrations || {}).whatsapp || ''} onChange={e => updateIntegrations('whatsapp', e.target.value)} placeholder="+44 7700 900000" />
            </div>
            <div>
              <label style={labelStyle}>Contact Email</label>
              <input style={inputStyle} type="email" value={(settings.integrations || {}).contact_email || ''} onChange={e => updateIntegrations('contact_email', e.target.value)} placeholder="hello@business.com" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Instagram Handle</label>
              <input style={inputStyle} value={(settings.integrations || {}).instagram || ''} onChange={e => updateIntegrations('instagram', e.target.value)} placeholder="@yourbusiness" />
            </div>
            <div>
              <label style={labelStyle}>TikTok Handle</label>
              <input style={inputStyle} value={(settings.integrations || {}).tiktok_handle || ''} onChange={e => updateIntegrations('tiktok_handle', e.target.value)} placeholder="@yourbusiness" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Facebook URL</label>
              <input style={inputStyle} value={(settings.integrations || {}).facebook || ''} onChange={e => updateIntegrations('facebook', e.target.value)} placeholder="https://facebook.com/..." />
            </div>
            <div>
              <label style={labelStyle}>WhatsApp Toggle</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={(settings.integrations || {}).whatsapp_enabled || false} onChange={e => updateIntegrations('whatsapp_enabled', e.target.checked)} style={{ accentColor: '#C9A84C' }} />
                <span style={{ fontSize: 13, color: '#333' }}>Show WhatsApp button on site</span>
              </label>
            </div>
          </div>

          {/* Business */}
          {sectionTitle('Business Links')}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Google Business Profile (Place ID)</label>
            <input style={inputStyle} value={(settings.integrations || {}).google_place_id || ''} onChange={e => updateIntegrations('google_place_id', e.target.value)} placeholder="ChIJ..." />
            <span style={{ fontSize: 11, color: '#999', marginTop: 2, display: 'block' }}>Find your Place ID at Google's Place ID Finder tool</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Booking Link</label>
              <input style={inputStyle} value={(settings.integrations || {}).booking_link || ''} onChange={e => updateIntegrations('booking_link', e.target.value)} placeholder="https://book.rezvo.app/..." />
            </div>
            <div>
              <label style={labelStyle}>Google Review URL</label>
              <input style={inputStyle} value={(settings.integrations || {}).google_review_url || ''} onChange={e => updateIntegrations('google_review_url', e.target.value)} placeholder="https://g.page/..." />
            </div>
          </div>
        </>}

        <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: saving ? 0.6 : 1, marginTop: 16 }}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TEMPLATE PICKER MODAL
   ═══════════════════════════════════════════════ */
function TemplatePickerModal({ bid, onClose, onApplied }) {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(null)
  const [error, setError] = useState(null)
  const [filterIndustry, setFilterIndustry] = useState('')
  const [confirmTemplate, setConfirmTemplate] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const url = filterIndustry ? `/website/templates?industry=${filterIndustry}` : '/website/templates'
        const res = await api.get(url)
        setTemplates(res.templates || res || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    setLoading(true)
    load()
  }, [filterIndustry])

  const applyTemplate = async (templateId) => {
    setApplying(templateId)
    setError(null)
    setConfirmTemplate(null)
    try {
      await api.post(`/website/business/${bid}/apply-template`, { template_id: templateId })
      onApplied()
      onClose()
      navigate('/dashboard/website/edit/home')
    } catch (err) {
      setError(err.message)
      setApplying(null)
    }
  }

  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
    'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    'linear-gradient(135deg, #f5576c 0%, #ff6b81 100%)',
  ]

  const industries = [
    { value: '', label: 'All Industries' },
    { value: 'aesthetics', label: 'Aesthetics' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'barber', label: 'Barber' },
    { value: 'salon', label: 'Hair Salon' },
    { value: 'spa', label: 'Spa' },
    { value: 'nails', label: 'Nail Tech' },
    { value: 'tattoo', label: 'Tattoo' },
    { value: 'personal_trainer', label: 'Personal Trainer' },
    { value: 'generic', label: 'Generic' },
  ]

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, maxWidth: 860, width: '100%', maxHeight: '90vh',
        overflow: 'auto', padding: 32, position: 'relative', fontFamily: 'Figtree, sans-serif',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111' }}>Choose a Template</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>Pick a starting point for your website</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}><IconClose /></button>
        </div>

        {/* Industry filter */}
        <div style={{ marginBottom: 20 }}>
          <select
            value={filterIndustry}
            onChange={e => setFilterIndustry(e.target.value)}
            style={{
              ...inputStyle, maxWidth: 240,
            }}
          >
            {industries.map(ind => (
              <option key={ind.value} value={ind.value}>{ind.label}</option>
            ))}
          </select>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#666', fontSize: 14 }}>Loading templates...</div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#666', fontSize: 14 }}>No templates available{filterIndustry ? ' for this industry' : ' yet'}.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {templates.map((tmpl, idx) => {
              const tid = tmpl.id || tmpl._id
              return (
                <div key={tid || idx} style={{
                  border: '1px solid #E5E5E5', borderRadius: 10, overflow: 'hidden', background: '#fff',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                  <div style={{
                    height: 130, background: tmpl.thumbnail_url ? `url(${tmpl.thumbnail_url}) center/cover` : gradients[idx % gradients.length],
                  }} />
                  <div style={{ padding: 12 }}>
                    <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#111' }}>{tmpl.name}</h4>
                    {tmpl.description && (
                      <p style={{ margin: '0 0 6px', fontSize: 12, color: '#888', lineHeight: 1.4 }}>{tmpl.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
                      {tmpl.industry && (
                        <span style={{
                          display: 'inline-block', fontSize: 11, color: '#666', background: '#f5f5f5',
                          padding: '2px 8px', borderRadius: 100,
                        }}>{tmpl.industry}</span>
                      )}
                      {tmpl.page_count && (
                        <span style={{ fontSize: 11, color: '#999' }}>{tmpl.page_count} pages</span>
                      )}
                    </div>
                    <button
                      onClick={() => setConfirmTemplate(tmpl)}
                      disabled={applying !== null}
                      style={{ ...btnPrimary, width: '100%', justifyContent: 'center', fontSize: 13, padding: '6px 12px', opacity: applying === tid ? 0.6 : 1 }}>
                      {applying === tid ? 'Applying...' : 'Use Template'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Confirmation dialog */}
        {confirmTemplate && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1001,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }} onClick={() => setConfirmTemplate(null)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#fff', borderRadius: 12, padding: 32, maxWidth: 420, width: '100%',
            }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: '#111' }}>Apply "{confirmTemplate.name}"?</h3>
              <p style={{ margin: '0 0 20px', fontSize: 14, color: '#666', lineHeight: 1.5 }}>
                This will create {confirmTemplate.page_count || 5} draft pages. Existing drafts with the same slugs will be overwritten.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmTemplate(null)} style={btnOutline}>Cancel</button>
                <button
                  onClick={() => applyTemplate(confirmTemplate.id || confirmTemplate._id)}
                  disabled={applying !== null}
                  style={{ ...btnPrimary, opacity: applying ? 0.6 : 1 }}>
                  {applying ? 'Applying...' : 'Apply Template'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   QR CODE MODAL
   ═══════════════════════════════════════════════ */
function QRCodeModal({ bid, slug, subdomain, onClose }) {
  const [size, setSize] = useState(300)
  const [loading, setLoading] = useState(true)

  const qrUrl = `/api/website/business/${bid}/qr/${slug}?size=${size}`

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, maxWidth: 400, width: '100%', padding: 32,
        fontFamily: 'Figtree, sans-serif', textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111' }}>QR Code</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}><IconClose /></button>
        </div>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>Scan to visit /{slug}</p>
        <div style={{ marginBottom: 16, minHeight: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading && <span style={{ color: '#999', fontSize: 13 }}>Generating...</span>}
          <img
            src={qrUrl}
            alt={`QR code for /${slug}`}
            style={{ maxWidth: '100%', display: loading ? 'none' : 'block', borderRadius: 8 }}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
          {[200, 300, 500].map(s => (
            <button key={s} onClick={() => { setSize(s); setLoading(true) }} style={{
              ...btnOutline, fontSize: 12, padding: '4px 10px',
              ...(size === s ? { borderColor: '#C9A84C', color: '#C9A84C', background: '#FBF6E9' } : {}),
            }}>{s}px</button>
          ))}
        </div>
        <a href={qrUrl} download={`qr-${slug}.png`} style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-flex', justifyContent: 'center' }}>
          Download PNG
        </a>
      </div>
    </div>
  )
}

const IconQR = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" />
    <rect x="2" y="14" width="8" height="8" rx="1" /><rect x="14" y="14" width="4" height="4" />
    <line x1="22" y1="14" x2="22" y2="22" /><line x1="14" y1="22" x2="22" y2="22" />
  </svg>
)

/* ═══════════════════════════════════════════════
   NEW PAGE MODAL
   ═══════════════════════════════════════════════ */
function NewPageModal({ bid, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  const handleTitleChange = (val) => {
    setTitle(val)
    if (!slugEdited) setSlug(slugify(val))
  }

  const handleSlugChange = (val) => {
    setSlugEdited(true)
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  const handleCreate = async () => {
    if (!title.trim() || !slug.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await api.post(`/website/business/${bid}/pages`, { title: title.trim(), slug: slug.trim() })
      onCreated(res)
    } catch (err) {
      setError(err.message)
      setCreating(false)
    }
  }

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, maxWidth: 448, width: '100%', padding: 32,
        fontFamily: 'Figtree, sans-serif',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111' }}>Create New Page</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}><IconClose /></button>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Page Title</label>
          <input style={inputStyle} value={title} onChange={e => handleTitleChange(e.target.value)} placeholder="e.g. About Us" autoFocus />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Slug</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <span style={{
              padding: '8px 10px', background: '#f5f5f5', border: '1px solid #E5E5E5',
              borderRight: 'none', borderTopLeftRadius: 8, borderBottomLeftRadius: 8,
              fontSize: 14, color: '#666', fontFamily: 'monospace',
            }}>/</span>
            <input
              style={{ ...inputStyle, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, fontFamily: 'monospace' }}
              value={slug}
              onChange={e => handleSlugChange(e.target.value)}
              placeholder="about-us" />
          </div>
        </div>

        <button onClick={handleCreate} disabled={creating || !title.trim() || !slug.trim()}
          style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: (creating || !title.trim() || !slug.trim()) ? 0.6 : 1 }}>
          {creating ? 'Creating...' : 'Create Page'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function WebsitePages() {
  const { business } = useBusiness()
  const navigate = useNavigate()
  const bid = business?.id

  const [pages, setPages] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showSettings, setShowSettings] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showNewPage, setShowNewPage] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // slug to delete
  const [duplicating, setDuplicating] = useState(null) // slug being duplicated
  const [qrSlug, setQrSlug] = useState(null) // slug for QR modal

  const fetchPages = useCallback(async () => {
    if (!bid) return
    try {
      const res = await api.get(`/website/business/${bid}/pages`)
      setPages(res.pages || res || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [bid])

  const fetchSettings = useCallback(async () => {
    if (!bid) return
    try {
      const res = await api.get(`/website/business/${bid}/settings`)
      setSettings(res)
    } catch {
      // Settings may not exist yet
      setSettings({})
    }
  }, [bid])

  useEffect(() => {
    if (!bid) return
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchPages(), fetchSettings()])
      setLoading(false)
    }
    load()
  }, [bid, fetchPages, fetchSettings])

  const handleDelete = async (slug) => {
    try {
      await api.delete(`/website/business/${bid}/pages/${slug}`)
      setDeleteConfirm(null)
      fetchPages()
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(null)
    }
  }

  const handleDuplicate = async (slug) => {
    setDuplicating(slug)
    try {
      await api.post(`/website/business/${bid}/pages/${slug}/duplicate`)
      fetchPages()
    } catch (err) {
      setError(err.message)
    } finally {
      setDuplicating(null)
    }
  }

  const handlePageCreated = (newPage) => {
    fetchPages()
    setShowNewPage(false)
    const pageSlug = newPage?.slug || newPage?.page?.slug
    if (pageSlug) navigate(`/dashboard/website/edit/${pageSlug}`)
  }

  const handleTemplateApplied = () => {
    fetchPages()
    fetchSettings()
  }

  if (!business) {
    return (
      <div style={{ padding: 32, fontFamily: 'Figtree, sans-serif', color: '#666', fontSize: 14 }}>
        Loading business...
      </div>
    )
  }

  return (
    <div style={{ padding: 32, fontFamily: 'Figtree, sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: '#111', fontFamily: 'Figtree, sans-serif' }}>Website</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#666' }}>Manage your pages, templates, and website settings</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowSettings(true)} style={btnOutline}>
            <IconSettings /> Website Settings
          </button>
          <button onClick={() => setShowTemplatePicker(true)} style={btnSecondary}>
            <IconTemplate /> Apply Template
          </button>
          <button onClick={() => setShowNewPage(true)} style={btnPrimary}>
            <IconPlus /> Create New Page
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: '#666', fontSize: 14 }}>Loading pages...</div>
      ) : pages.length === 0 ? (
        /* Empty state */
        <div style={{
          textAlign: 'center', padding: '64px 32px', border: '1px solid #E5E5E5',
          borderRadius: 12, background: '#fff',
        }}>
          <div style={{
            width: 80, height: 80, margin: '0 auto 20px', borderRadius: 16,
            background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="12" x2="12" y2="18" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#111', margin: '0 0 6px' }}>No pages yet</p>
          <p style={{ fontSize: 14, color: '#666', margin: '0 0 20px' }}>Create your first page to get started.</p>
          <button onClick={() => setShowNewPage(true)} style={btnPrimary}>
            <IconPlus /> Create New Page
          </button>
        </div>
      ) : (
        /* Pages table */
        <div style={{ border: '1px solid #E5E5E5', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Figtree, sans-serif' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
                {['Page Name', 'Slug', 'Status', 'Last Updated', 'Actions'].map(col => (
                  <th key={col} style={{
                    textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600,
                    color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => {
                const slug = page.slug
                const isPublished = page.status === 'published'
                return (
                  <tr key={slug} style={{ borderBottom: '1px solid #f0f0f0' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: '#111' }}>
                      {page.title}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontFamily: 'monospace', fontSize: 13, color: '#666',
                        background: '#f5f5f5', padding: '2px 8px', borderRadius: 4,
                      }}>/{slug}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', fontSize: 12, fontWeight: 600, padding: '3px 10px',
                        borderRadius: 100,
                        background: isPublished ? '#dcfce7' : '#f3f4f6',
                        color: isPublished ? '#166534' : '#4b5563',
                      }}>
                        {isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#666' }}>
                      {timeAgo(page.updated_at || page.updatedAt)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => navigate(`/dashboard/website/edit/${slug}`)}
                          title="Edit"
                          style={{
                            background: '#f5f5f5', border: 'none', borderRadius: 6,
                            padding: '6px 8px', cursor: 'pointer', color: '#111',
                            display: 'inline-flex', alignItems: 'center',
                          }}>
                          <IconEdit />
                        </button>
                        <button
                          onClick={() => handleDuplicate(slug)}
                          disabled={duplicating === slug}
                          title="Duplicate"
                          style={{
                            background: '#f5f5f5', border: 'none', borderRadius: 6,
                            padding: '6px 8px', cursor: 'pointer', color: '#111',
                            display: 'inline-flex', alignItems: 'center',
                            opacity: duplicating === slug ? 0.5 : 1,
                          }}>
                          <IconDuplicate />
                        </button>
                        <button
                          onClick={() => setQrSlug(slug)}
                          title="QR Code"
                          style={{
                            background: '#f5f5f5', border: 'none', borderRadius: 6,
                            padding: '6px 8px', cursor: 'pointer', color: '#111',
                            display: 'inline-flex', alignItems: 'center',
                          }}>
                          <IconQR />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(slug)}
                          title="Delete"
                          style={{
                            background: '#f5f5f5', border: 'none', borderRadius: 6,
                            padding: '6px 8px', cursor: 'pointer', color: '#dc2626',
                            display: 'inline-flex', alignItems: 'center',
                          }}>
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showSettings && (
        <SettingsModal
          bid={bid}
          settings={settings}
          pages={pages}
          onClose={() => setShowSettings(false)}
          onSaved={(s) => setSettings(s)}
        />
      )}
      {showTemplatePicker && (
        <TemplatePickerModal
          bid={bid}
          onClose={() => setShowTemplatePicker(false)}
          onApplied={handleTemplateApplied}
        />
      )}
      {showNewPage && (
        <NewPageModal
          bid={bid}
          onClose={() => setShowNewPage(false)}
          onCreated={handlePageCreated}
        />
      )}
      {deleteConfirm && (
        <ConfirmDialog
          message={`Are you sure you want to delete the page "/${deleteConfirm}"? This action cannot be undone.`}
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
      {qrSlug && (
        <QRCodeModal
          bid={bid}
          slug={qrSlug}
          subdomain={settings?.subdomain}
          onClose={() => setQrSlug(null)}
        />
      )}
    </div>
  )
}
