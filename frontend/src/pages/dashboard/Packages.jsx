import { useState, useEffect, useRef } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import AppLoader from '../../components/shared/AppLoader'
import { Package, Plus, Edit2, Trash2, Clock, Users, ChevronDown, X, AlertTriangle, CheckCircle } from 'lucide-react'

const font = "'Figtree', sans-serif"

// ── Toast ────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  const bg = type === 'error' ? '#FEE2E2' : type === 'success' ? '#D1FAE5' : '#FEF3C7'
  const border = type === 'error' ? '#FCA5A5' : type === 'success' ? '#6EE7B7' : '#FCD34D'
  const color = type === 'error' ? '#991B1B' : type === 'success' ? '#065F46' : '#92400E'
  const Icon = type === 'error' ? AlertTriangle : CheckCircle

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: bg, border: `1px solid ${border}`, color,
      borderRadius: 12, padding: '12px 20px', fontFamily: font, fontSize: 14,
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxWidth: 380,
    }}>
      <Icon size={18} />
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color, padding: 0 }}>
        <X size={16} />
      </button>
    </div>
  )
}

// ── Custom Select ────────────────────────────────────────────────────
function CustomSelect({ value, onChange, options, placeholder, style }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '10px 14px', fontFamily: font, fontSize: 14,
          border: '1px solid #E5E7EB', borderRadius: 10, background: '#fff',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', color: selected ? '#111' : '#9CA3AF',
        }}
      >
        <span>{selected ? selected.label : (placeholder || 'Select...')}</span>
        <ChevronDown size={16} style={{ color: '#9CA3AF', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          marginTop: 4, background: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {options.map(o => (
            <div
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 14, fontFamily: font,
                background: o.value === value ? '#F9FAFB' : '#fff',
                color: '#111',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
              onMouseLeave={e => e.currentTarget.style.background = o.value === value ? '#F9FAFB' : '#fff'}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal Wrapper ────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, width }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, padding: 28,
          width: width || 520, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 8px 40px rgba(0,0,0,0.15)', fontFamily: font,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} color="#6B7280" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Confirm Dialog ───────────────────────────────────────────────────
function ConfirmDialog({ open, onClose, onConfirm, title, message }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}>
      <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{
          padding: '10px 20px', borderRadius: 10, border: 'none', background: '#F3F4F6',
          fontSize: 14, fontFamily: font, cursor: 'pointer', fontWeight: 600, color: '#111',
        }}>Cancel</button>
        <button onClick={onConfirm} style={{
          padding: '10px 20px', borderRadius: 10, border: 'none', background: '#DC2626',
          color: '#fff', fontSize: 14, fontFamily: font, cursor: 'pointer', fontWeight: 600,
        }}>Delete</button>
      </div>
    </Modal>
  )
}

// ── Field helpers ────────────────────────────────────────────────────
const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block', fontFamily: font }
const inputStyle = {
  width: '100%', padding: '10px 14px', fontFamily: font, fontSize: 14,
  border: '1px solid #E5E7EB', borderRadius: 10, outline: 'none', color: '#111',
  boxSizing: 'border-box',
}

// ── Type Badge ───────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const isCommitment = type === 'commitment'
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11,
      fontWeight: 700, fontFamily: font, letterSpacing: 0.3,
      background: isCommitment ? '#C9A84C' : '#F3F4F6',
      color: isCommitment ? '#fff' : '#6B7280',
    }}>
      {isCommitment ? 'Commitment' : 'Time Limited'}
    </span>
  )
}

// ── Status Badge ─────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    active: { bg: '#D1FAE5', color: '#065F46' },
    expired: { bg: '#FEE2E2', color: '#991B1B' },
    completed: { bg: '#DBEAFE', color: '#1E40AF' },
  }
  const s = map[status] || map.active
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11,
      fontWeight: 700, fontFamily: font, background: s.bg, color: s.color,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  )
}

// ── Progress Bar ─────────────────────────────────────────────────────
function ProgressBar({ used, total }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? '#3B82F6' : '#C9A84C', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', fontFamily: font, whiteSpace: 'nowrap' }}>
        {used}/{total}
      </span>
    </div>
  )
}

// ── Card wrapper ─────────────────────────────────────────────────────
const cardStyle = {
  background: '#fff', borderRadius: 16, border: '1px solid #F3F4F6',
  boxShadow: '0 2px 10px rgba(0,0,0,0.03)', padding: 20,
}

// ════════════════════════════════════════════════════════════════════
// ── Main Component ─────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════

const EMPTY_TEMPLATE = {
  name: '', type: 'time_limited', total_sessions: 1, price: 0,
  allowed_services: '', validity_days: 30, force_book_all_upfront: false,
}

export default function Packages() {
  const { business, loading: bizLoading } = useBusiness()
  const bid = business?.id ?? business?._id

  const [tab, setTab] = useState('templates')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  // Templates
  const [templates, setTemplates] = useState([])
  const [templateModal, setTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_TEMPLATE })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Client packages
  const [clientPackages, setClientPackages] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [redeemModal, setRedeemModal] = useState(null)
  const [redeemService, setRedeemService] = useState('')
  const [redeeming, setRedeeming] = useState(false)

  const showToast = (message, type = 'success') => setToast({ message, type })

  // ── Fetch Templates ─────────────────────────────────────────────
  const fetchTemplates = async () => {
    if (!bid) return
    try {
      const res = await api.get(`/packages/business/${bid}/templates`)
      setTemplates(res.templates || res || [])
    } catch {
      setTemplates([])
    }
  }

  // ── Fetch Client Packages ──────────────────────────────────────
  const fetchClientPackages = async () => {
    if (!bid) return
    try {
      const res = await api.get(`/packages/business/${bid}/active`)
      setClientPackages(res.packages || res || [])
    } catch {
      setClientPackages([])
    }
  }

  useEffect(() => {
    if (!bid) { setLoading(false); return }
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchTemplates(), fetchClientPackages()])
      setLoading(false)
    }
    init()
  }, [bid])

  // ── Template CRUD ──────────────────────────────────────────────
  const openCreateTemplate = () => {
    setEditingTemplate(null)
    setForm({ ...EMPTY_TEMPLATE })
    setTemplateModal(true)
  }

  const openEditTemplate = (t) => {
    setEditingTemplate(t)
    setForm({
      name: t.name || '',
      type: t.type || 'time_limited',
      total_sessions: t.total_sessions || 1,
      price: t.price || 0,
      allowed_services: Array.isArray(t.allowed_services) ? t.allowed_services.join(', ') : (t.allowed_services || ''),
      validity_days: t.validity_days || 30,
      force_book_all_upfront: !!t.force_book_all_upfront,
    })
    setTemplateModal(true)
  }

  const handleSaveTemplate = async () => {
    if (!form.name.trim()) { showToast('Template name is required', 'error'); return }
    setSaving(true)
    const payload = {
      ...form,
      total_sessions: Number(form.total_sessions),
      price: Number(form.price),
      validity_days: Number(form.validity_days),
      allowed_services: form.allowed_services
        ? form.allowed_services.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    }
    try {
      if (editingTemplate) {
        const id = editingTemplate.id || editingTemplate._id
        await api.patch(`/packages/business/${bid}/templates/${id}`, payload)
        showToast('Template updated')
      } else {
        await api.post(`/packages/business/${bid}/templates`, payload)
        showToast('Template created')
      }
      setTemplateModal(false)
      await fetchTemplates()
    } catch (e) {
      showToast(e.message || 'Failed to save template', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!deleteConfirm) return
    const id = deleteConfirm.id || deleteConfirm._id
    try {
      await api.delete(`/packages/business/${bid}/templates/${id}`)
      showToast('Template deleted')
      setDeleteConfirm(null)
      await fetchTemplates()
    } catch (e) {
      showToast(e.message || 'Failed to delete template', 'error')
      setDeleteConfirm(null)
    }
  }

  // ── Redeem Session ─────────────────────────────────────────────
  const handleRedeem = async () => {
    if (!redeemModal || !redeemService.trim()) { showToast('Select a service to redeem', 'error'); return }
    setRedeeming(true)
    const pkgId = redeemModal.id || redeemModal._id
    try {
      await api.post(`/packages/business/${bid}/redeem/${pkgId}`, { service: redeemService })
      showToast('Session redeemed')
      setRedeemModal(null)
      setRedeemService('')
      await fetchClientPackages()
    } catch (e) {
      showToast(e.message || 'Failed to redeem session', 'error')
    } finally {
      setRedeeming(false)
    }
  }

  // ── Filtered client packages ───────────────────────────────────
  const filteredPackages = statusFilter === 'all'
    ? clientPackages
    : clientPackages.filter(p => p.status === statusFilter)

  // ── Loading / No business ──────────────────────────────────────
  if (bizLoading || loading) {
    return (
      <div className="-m-6 lg:-m-8" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}>
        <AppLoader message="Loading packages..." />
      </div>
    )
  }

  if (!bid) {
    return (
      <div className="-m-6 lg:-m-8" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}>
        <p style={{ color: '#6B7280', fontSize: 15 }}>No business found.</p>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // ── RENDER ─────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="-m-6 lg:-m-8" style={{ minHeight: '100vh', fontFamily: font, background: '#FAFAFA', padding: '28px 24px 60px' }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Package size={22} color="#111" />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>Packages</h1>
        </div>
        {tab === 'templates' && (
          <button onClick={openCreateTemplate} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 12, border: 'none',
            background: '#111', color: '#fff', fontSize: 14, fontWeight: 600,
            fontFamily: font, cursor: 'pointer',
          }}>
            <Plus size={16} /> New Template
          </button>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#F3F4F6', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {[{ key: 'templates', label: 'Templates' }, { key: 'clients', label: 'Client Packages' }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '9px 22px', borderRadius: 10, border: 'none',
              background: tab === t.key ? '#fff' : 'transparent',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              color: tab === t.key ? '#111' : '#6B7280',
              fontWeight: 600, fontSize: 14, fontFamily: font, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ── TEMPLATES TAB ──────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════ */}
      {tab === 'templates' && (
        <>
          {templates.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '60px 20px' }}>
              <Package size={40} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111', margin: '0 0 6px' }}>No templates yet</p>
              <p style={{ fontSize: 14, color: '#9CA3AF', margin: '0 0 20px' }}>Create a package template to get started</p>
              <button onClick={openCreateTemplate} style={{
                padding: '10px 24px', borderRadius: 12, border: 'none',
                background: '#111', color: '#fff', fontSize: 14, fontWeight: 600,
                fontFamily: font, cursor: 'pointer',
              }}>
                <Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Create Template
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {templates.map(t => {
                const tid = t.id || t._id
                return (
                  <div key={tid} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>{t.name}</h3>
                        <TypeBadge type={t.type} />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEditTemplate(t)} style={{
                          width: 34, height: 34, borderRadius: 8, border: '1px solid #E5E7EB',
                          background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Edit2 size={14} color="#6B7280" />
                        </button>
                        <button onClick={() => setDeleteConfirm(t)} style={{
                          width: 34, height: 34, borderRadius: 8, border: '1px solid #E5E7EB',
                          background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Trash2 size={14} color="#EF4444" />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: 13, color: '#6B7280' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: '#374151' }}>Sessions</span>
                        <div>{t.total_sessions}</div>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: '#374151' }}>Price</span>
                        <div style={{ fontWeight: 700, color: '#111' }}>{typeof t.price === 'number' ? `$${t.price.toFixed(2)}` : t.price}</div>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: '#374151' }}>Validity</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> {t.validity_days} days
                        </div>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: '#374151' }}>Upfront Booking</span>
                        <div>{t.force_book_all_upfront ? 'Yes' : 'No'}</div>
                      </div>
                    </div>

                    {t.allowed_services && (Array.isArray(t.allowed_services) ? t.allowed_services : [t.allowed_services]).length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Allowed Services</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {(Array.isArray(t.allowed_services) ? t.allowed_services : [t.allowed_services]).map((s, i) => (
                            <span key={i} style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 6,
                              background: '#F3F4F6', color: '#6B7280',
                            }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* ── CLIENT PACKAGES TAB ────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════ */}
      {tab === 'clients' && (
        <>
          {/* Status filter */}
          <div style={{ marginBottom: 20 }}>
            <CustomSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'active', label: 'Active' },
                { value: 'expired', label: 'Expired' },
                { value: 'completed', label: 'Completed' },
              ]}
              style={{ width: 200 }}
            />
          </div>

          {filteredPackages.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '60px 20px' }}>
              <Users size={40} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111', margin: '0 0 6px' }}>No client packages found</p>
              <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>
                {statusFilter !== 'all' ? 'Try changing the status filter' : 'Purchase a package for a client to see it here'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredPackages.map(pkg => {
                const pkgId = pkg.id || pkg._id
                const sessionsUsed = pkg.sessions_used || 0
                const totalSessions = pkg.total_sessions || 0
                const isActive = pkg.status === 'active'

                return (
                  <div key={pkgId} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: 0 }}>
                            {pkg.client_name || 'Unknown Client'}
                          </h3>
                          <StatusBadge status={pkg.status || 'active'} />
                        </div>
                        <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                          {pkg.template_name || pkg.package_name || 'Package'}
                        </p>
                      </div>
                      {isActive && sessionsUsed < totalSessions && (
                        <button
                          onClick={() => { setRedeemModal(pkg); setRedeemService('') }}
                          style={{
                            padding: '8px 18px', borderRadius: 10, border: 'none',
                            background: '#C9A84C', color: '#fff', fontSize: 13,
                            fontWeight: 600, fontFamily: font, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          <CheckCircle size={14} /> Redeem
                        </button>
                      )}
                    </div>

                    <ProgressBar used={sessionsUsed} total={totalSessions} />

                    <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 12, color: '#9CA3AF', flexWrap: 'wrap' }}>
                      {pkg.purchase_date && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          <span>Purchased: {new Date(pkg.purchase_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {pkg.expiry_date && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={12} />
                          <span>Expires: {new Date(pkg.expiry_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* ── MODALS ─────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════ */}

      {/* Template Create/Edit Modal */}
      <Modal
        open={templateModal}
        onClose={() => setTemplateModal(false)}
        title={editingTemplate ? 'Edit Template' : 'Create Template'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 10-Session Facial Package"
            />
          </div>

          <div>
            <label style={labelStyle}>Type</label>
            <CustomSelect
              value={form.type}
              onChange={v => setForm(f => ({ ...f, type: v }))}
              options={[
                { value: 'time_limited', label: 'Time Limited' },
                { value: 'commitment', label: 'Commitment' },
              ]}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Total Sessions</label>
              <input
                type="number"
                min="1"
                style={inputStyle}
                value={form.total_sessions}
                onChange={e => setForm(f => ({ ...f, total_sessions: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                style={inputStyle}
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Validity (days)</label>
            <input
              type="number"
              min="1"
              style={inputStyle}
              value={form.validity_days}
              onChange={e => setForm(f => ({ ...f, validity_days: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Allowed Services</label>
            <input
              style={inputStyle}
              value={form.allowed_services}
              onChange={e => setForm(f => ({ ...f, allowed_services: e.target.value }))}
              placeholder="Comma-separated service names"
            />
            <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, display: 'block' }}>
              Leave empty to allow all services
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              id="force_upfront"
              checked={form.force_book_all_upfront}
              onChange={e => setForm(f => ({ ...f, force_book_all_upfront: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: '#C9A84C', cursor: 'pointer' }}
            />
            <label htmlFor="force_upfront" style={{ fontSize: 14, color: '#374151', cursor: 'pointer', fontFamily: font }}>
              Force book all sessions upfront
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setTemplateModal(false)} style={{
              padding: '10px 22px', borderRadius: 10, border: 'none', background: '#F3F4F6',
              fontSize: 14, fontFamily: font, cursor: 'pointer', fontWeight: 600, color: '#111',
            }}>Cancel</button>
            <button onClick={handleSaveTemplate} disabled={saving} style={{
              padding: '10px 22px', borderRadius: 10, border: 'none', background: '#111',
              color: '#fff', fontSize: 14, fontFamily: font, cursor: 'pointer', fontWeight: 600,
              opacity: saving ? 0.6 : 1,
            }}>
              {saving ? 'Saving...' : (editingTemplate ? 'Update' : 'Create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteTemplate}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone. Existing client packages using this template will not be affected.`}
      />

      {/* Redeem Modal */}
      <Modal
        open={!!redeemModal}
        onClose={() => setRedeemModal(null)}
        title="Redeem Session"
        width={440}
      >
        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 6px' }}>
            Client: <strong style={{ color: '#111' }}>{redeemModal?.client_name}</strong>
          </p>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 16px' }}>
            Package: <strong style={{ color: '#111' }}>{redeemModal?.template_name || redeemModal?.package_name}</strong>
            {' '} ({redeemModal?.sessions_used || 0}/{redeemModal?.total_sessions || 0} used)
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Service</label>
          {redeemModal?.allowed_services && Array.isArray(redeemModal.allowed_services) && redeemModal.allowed_services.length > 0 ? (
            <CustomSelect
              value={redeemService}
              onChange={setRedeemService}
              options={redeemModal.allowed_services.map(s => ({ value: s, label: s }))}
              placeholder="Select a service..."
            />
          ) : (
            <input
              style={inputStyle}
              value={redeemService}
              onChange={e => setRedeemService(e.target.value)}
              placeholder="Enter service name"
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setRedeemModal(null)} style={{
            padding: '10px 22px', borderRadius: 10, border: 'none', background: '#F3F4F6',
            fontSize: 14, fontFamily: font, cursor: 'pointer', fontWeight: 600, color: '#111',
          }}>Cancel</button>
          <button onClick={handleRedeem} disabled={redeeming} style={{
            padding: '10px 22px', borderRadius: 10, border: 'none', background: '#C9A84C',
            color: '#fff', fontSize: 14, fontFamily: font, cursor: 'pointer', fontWeight: 600,
            opacity: redeeming ? 0.6 : 1,
          }}>
            {redeeming ? 'Redeeming...' : 'Confirm Redeem'}
          </button>
        </div>
      </Modal>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
