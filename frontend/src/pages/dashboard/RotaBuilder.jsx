/**
 * RotaBuilder — Staff rota/scheduling management
 * Templates, assignments, and weekly schedule viewer with overrides
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import AppLoader from '../../components/shared/AppLoader'
import {
  Calendar, Plus, Edit2, Clock, Users, ChevronLeft, ChevronRight,
  X, AlertTriangle, CheckCircle, Sun, Moon
} from 'lucide-react'

const FONT = "'Figtree', sans-serif"
const GOLD = '#C9A84C'
const BLACK = '#111111'
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const OVERRIDE_REASONS = ['sick', 'holiday', 'swapped', 'custom']
const OVERRIDE_COLORS = { sick: 'bg-red-50', holiday: 'bg-blue-50', off: 'bg-gray-50', working: 'bg-white' }

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function getDayName(d) {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()]
}

function formatShortDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// --- Toast ---
function Toast({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: FONT }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${t.type === 'error' ? '#FECACA' : '#BBF7D0'}`,
          borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 280, maxWidth: 400,
        }}>
          {t.type === 'error'
            ? <AlertTriangle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
            : <CheckCircle size={18} style={{ color: '#22C55E', flexShrink: 0 }} />}
          <span style={{ flex: 1, fontSize: 13, color: BLACK }}>{t.message}</span>
          <button onClick={() => onDismiss(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <X size={14} style={{ color: '#9CA3AF' }} />
          </button>
        </div>
      ))}
    </div>
  )
}

// --- Custom Select ---
function CustomSelect({ value, onChange, options, placeholder, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find(o => (typeof o === 'object' ? o.value : o) === value)
  const label = selected ? (typeof selected === 'object' ? selected.label : selected) : placeholder || 'Select...'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 10,
          border: '1px solid #E5E7EB', background: disabled ? '#F9FAFB' : '#fff',
          fontFamily: FONT, fontSize: 14, color: value ? BLACK : '#9CA3AF',
          cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>{label}</span>
        <ChevronRight size={14} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', color: '#9CA3AF' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto',
        }}>
          {options.map((o, i) => {
            const val = typeof o === 'object' ? o.value : o
            const lbl = typeof o === 'object' ? o.label : o
            return (
              <button key={i} type="button" onClick={() => { onChange(val); setOpen(false) }}
                style={{
                  width: '100%', padding: '9px 14px', border: 'none', background: val === value ? '#F9FAFB' : '#fff',
                  fontFamily: FONT, fontSize: 13, color: BLACK, cursor: 'pointer', textAlign: 'left',
                  borderBottom: i < options.length - 1 ? '1px solid #F3F4F6' : 'none',
                }}
                onMouseEnter={e => e.target.style.background = '#F9FAFB'}
                onMouseLeave={e => e.target.style.background = val === value ? '#F9FAFB' : '#fff'}
              >
                {lbl}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Modal Backdrop ---
function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', fontFamily: FONT,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 20, width: '90%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #F3F4F6' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: BLACK }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} style={{ color: '#9CA3AF' }} />
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

// Card wrapper
const Card = ({ children, style }) => (
  <div className="rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)]" style={{ background: '#fff', ...style }}>
    {children}
  </div>
)

const RotaBuilder = () => {
  const { business } = useBusiness()
  const bid = business?.id ?? business?._id

  // Data
  const [templates, setTemplates] = useState([])
  const [staffList, setStaffList] = useState([])
  const [assignments, setAssignments] = useState({}) // staffId -> { template_id, start_date }
  const [scheduleData, setScheduleData] = useState({}) // staffId -> [{ date, start, end, override_reason }]
  const [loading, setLoading] = useState(true)

  // UI
  const [toasts, setToasts] = useState([])
  const [templateModal, setTemplateModal] = useState(false)
  const [assignModal, setAssignModal] = useState(null) // staff object
  const [overrideModal, setOverrideModal] = useState(null) // { staffId, date }
  const [selectedWeek, setSelectedWeek] = useState(getMonday(new Date()))
  const [editingTemplate, setEditingTemplate] = useState(null)

  // Template form
  const [tplName, setTplName] = useState('')
  const [tplCycleLength, setTplCycleLength] = useState(1)
  const [tplWeeks, setTplWeeks] = useState({})
  const [tplActiveWeek, setTplActiveWeek] = useState(1)
  const [tplSaving, setTplSaving] = useState(false)

  // Assign form
  const [assignTemplateId, setAssignTemplateId] = useState('')
  const [assignStartDate, setAssignStartDate] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)

  // Override form
  const [overrideReason, setOverrideReason] = useState('sick')
  const [overrideStart, setOverrideStart] = useState('')
  const [overrideEnd, setOverrideEnd] = useState('')
  const [overrideCustomReason, setOverrideCustomReason] = useState('')
  const [overrideSaving, setOverrideSaving] = useState(false)

  const toastId = useRef(0)

  const addToast = useCallback((message, type = 'success') => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Init empty weeks object for template
  const buildEmptyWeeks = useCallback((cycleLen) => {
    const w = {}
    for (let i = 1; i <= cycleLen; i++) {
      w[i] = {}
      DAYS.forEach(d => {
        w[i][d] = { active: false, start: '', end: '' }
      })
    }
    return w
  }, [])

  // Fetch all data
  useEffect(() => {
    if (!bid) { setLoading(false); return }
    const load = async () => {
      try {
        const [tplRes, staffRes] = await Promise.all([
          api.get(`/rota/business/${bid}/templates`).catch(() => ({ templates: [] })),
          api.get(`/staff/business/${bid}`).catch(() => ({ staff: [] })),
        ])
        setTemplates(tplRes.templates || tplRes || [])
        const rawStaff = staffRes.staff || staffRes || []
        setStaffList(Array.isArray(rawStaff) ? rawStaff : [])
      } catch (e) {
        console.error('RotaBuilder load error:', e)
        addToast('Failed to load rota data', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [bid, addToast])

  // Fetch schedule for selected week
  useEffect(() => {
    if (!bid || !staffList.length) return
    const from = formatDate(selectedWeek)
    const to = formatDate(addDays(selectedWeek, 6))
    const fetchSchedules = async () => {
      const result = {}
      await Promise.all(staffList.map(async s => {
        const sid = s.id || s._id
        try {
          const res = await api.get(`/rota/business/${bid}/schedule?staff_id=${sid}&from=${from}&to=${to}`)
          result[sid] = res.schedule || res.days || res || []
        } catch {
          result[sid] = []
        }
      }))
      setScheduleData(result)
    }
    fetchSchedules()
  }, [bid, staffList, selectedWeek])

  // Build assignments map from staff + schedule
  useEffect(() => {
    const map = {}
    staffList.forEach(s => {
      const sid = s.id || s._id
      if (s.rota_template_id || s.rotaTemplateId) {
        map[sid] = {
          template_id: s.rota_template_id || s.rotaTemplateId,
          start_date: s.rota_start_date || s.rotaStartDate || '',
        }
      }
    })
    setAssignments(map)
  }, [staffList])

  // --- Template CRUD ---
  const openCreateTemplate = () => {
    setEditingTemplate(null)
    setTplName('')
    setTplCycleLength(1)
    setTplWeeks(buildEmptyWeeks(1))
    setTplActiveWeek(1)
    setTemplateModal(true)
  }

  const openEditTemplate = (tpl) => {
    setEditingTemplate(tpl)
    setTplName(tpl.name || '')
    setTplCycleLength(tpl.cycle_length || tpl.cycleLength || 1)
    setTplWeeks(tpl.weeks || buildEmptyWeeks(tpl.cycle_length || tpl.cycleLength || 1))
    setTplActiveWeek(1)
    setTemplateModal(true)
  }

  const handleCycleLengthChange = (val) => {
    const n = parseInt(val, 10)
    setTplCycleLength(n)
    setTplWeeks(prev => {
      const w = { ...prev }
      for (let i = 1; i <= n; i++) {
        if (!w[i]) {
          w[i] = {}
          DAYS.forEach(d => { w[i][d] = { active: false, start: '', end: '' } })
        }
      }
      // Remove excess weeks
      Object.keys(w).forEach(k => { if (parseInt(k, 10) > n) delete w[k] })
      return w
    })
    if (tplActiveWeek > n) setTplActiveWeek(n)
  }

  const updateDayInWeek = (week, day, field, value) => {
    setTplWeeks(prev => ({
      ...prev,
      [week]: {
        ...prev[week],
        [day]: { ...prev[week][day], [field]: value },
      },
    }))
  }

  const toggleDayActive = (week, day) => {
    setTplWeeks(prev => {
      const current = prev[week][day]
      return {
        ...prev,
        [week]: {
          ...prev[week],
          [day]: current.active
            ? { active: false, start: '', end: '' }
            : { active: true, start: '09:00', end: '17:00' },
        },
      }
    })
  }

  const saveTemplate = async () => {
    if (!tplName.trim()) { addToast('Template name is required', 'error'); return }
    setTplSaving(true)
    try {
      const payload = { name: tplName.trim(), cycle_length: tplCycleLength, weeks: tplWeeks }
      if (editingTemplate) {
        const tplId = editingTemplate.id || editingTemplate._id
        await api.put(`/rota/business/${bid}/templates/${tplId}`, payload)
        setTemplates(prev => prev.map(t => (t.id || t._id) === tplId ? { ...t, ...payload } : t))
        addToast('Template updated')
      } else {
        const res = await api.post(`/rota/business/${bid}/templates`, payload)
        setTemplates(prev => [...prev, res.template || res || { ...payload, id: Date.now() }])
        addToast('Template created')
      }
      setTemplateModal(false)
    } catch (e) {
      addToast(e.message || 'Failed to save template', 'error')
    } finally {
      setTplSaving(false)
    }
  }

  // --- Staff Assignment ---
  const openAssignModal = (staff) => {
    const sid = staff.id || staff._id
    setAssignModal(staff)
    setAssignTemplateId(assignments[sid]?.template_id || '')
    setAssignStartDate(assignments[sid]?.start_date || '')
  }

  const saveAssignment = async () => {
    if (!assignTemplateId) { addToast('Select a template', 'error'); return }
    if (!assignStartDate) { addToast('Start date is required', 'error'); return }
    // Validate start date is a Monday
    const d = new Date(assignStartDate)
    if (d.getDay() !== 1) { addToast('Start date must be a Monday', 'error'); return }

    setAssignSaving(true)
    try {
      const sid = assignModal.id || assignModal._id
      await api.post(`/rota/business/${bid}/assign`, {
        staff_id: sid,
        template_id: assignTemplateId,
        start_date: assignStartDate,
      })
      setAssignments(prev => ({ ...prev, [sid]: { template_id: assignTemplateId, start_date: assignStartDate } }))
      addToast('Template assigned to ' + (assignModal.name || 'staff'))
      setAssignModal(null)
    } catch (e) {
      addToast(e.message || 'Failed to assign template', 'error')
    } finally {
      setAssignSaving(false)
    }
  }

  // --- Override ---
  const openOverrideModal = (staffId, date) => {
    setOverrideModal({ staffId, date })
    setOverrideReason('sick')
    setOverrideStart('')
    setOverrideEnd('')
    setOverrideCustomReason('')
  }

  const saveOverride = async () => {
    setOverrideSaving(true)
    try {
      const payload = {
        staff_id: overrideModal.staffId,
        date: overrideModal.date,
        reason: overrideReason === 'custom' ? overrideCustomReason : overrideReason,
      }
      if (overrideStart && overrideEnd) {
        payload.start = overrideStart
        payload.end = overrideEnd
      }
      await api.patch(`/rota/business/${bid}/override`, payload)
      // Refresh schedule
      const sid = overrideModal.staffId
      const from = formatDate(selectedWeek)
      const to = formatDate(addDays(selectedWeek, 6))
      const res = await api.get(`/rota/business/${bid}/schedule?staff_id=${sid}&from=${from}&to=${to}`)
      setScheduleData(prev => ({ ...prev, [sid]: res.schedule || res.days || res || [] }))
      addToast('Override added')
      setOverrideModal(null)
    } catch (e) {
      addToast(e.message || 'Failed to add override', 'error')
    } finally {
      setOverrideSaving(false)
    }
  }

  // --- Week navigation ---
  const prevWeek = () => setSelectedWeek(prev => addDays(prev, -7))
  const nextWeek = () => setSelectedWeek(prev => addDays(prev, 7))
  const goToday = () => setSelectedWeek(getMonday(new Date()))

  // Helpers
  const getTemplateName = (tplId) => {
    const t = templates.find(t => (t.id || t._id) === tplId)
    return t?.name || 'Unknown'
  }

  const getCurrentWeekInRotation = (startDate) => {
    if (!startDate) return null
    const start = getMonday(new Date(startDate))
    const now = getMonday(new Date())
    const diffWeeks = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000))
    const tpl = templates.find(t => (t.id || t._id) === assignments[Object.keys(assignments).find(k => assignments[k].start_date === startDate)]?.template_id)
    const cycle = tpl?.cycle_length || tpl?.cycleLength || 1
    return (diffWeeks % cycle) + 1
  }

  const getScheduleForDay = (staffId, date) => {
    const dateStr = formatDate(date)
    const sched = scheduleData[staffId] || []
    if (Array.isArray(sched)) {
      return sched.find(d => d.date === dateStr)
    }
    return sched[dateStr] || null
  }

  const getDayCellColor = (dayData) => {
    if (!dayData) return OVERRIDE_COLORS.off
    if (dayData.override_reason === 'sick' || dayData.reason === 'sick') return OVERRIDE_COLORS.sick
    if (dayData.override_reason === 'holiday' || dayData.reason === 'holiday') return OVERRIDE_COLORS.holiday
    if (dayData.active === false || dayData.off) return OVERRIDE_COLORS.off
    return OVERRIDE_COLORS.working
  }

  // Week dates for schedule viewer
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i))

  if (loading) {
    return (
      <div style={{ fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <AppLoader message="Loading rota..." />
      </div>
    )
  }

  return (
    <div className="-m-6 lg:-m-8" style={{ fontFamily: FONT, minHeight: '100vh', background: '#FAFAFA' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: BLACK, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={24} style={{ color: GOLD }} />
            Rota Builder
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0' }}>
            Create templates, assign to staff, and manage weekly schedules
          </p>
        </div>

        {/* === SECTION 1: Templates === */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: BLACK, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} style={{ color: GOLD }} />
              Rota Templates
            </h2>
            <button onClick={openCreateTemplate} style={{
              background: BLACK, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px',
              fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Plus size={15} /> New Template
            </button>
          </div>

          {templates.length === 0 ? (
            <Card style={{ padding: 40, textAlign: 'center' }}>
              <Clock size={36} style={{ color: '#D1D5DB', marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>No templates yet. Create one to get started.</p>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340, 1fr))', gap: 16 }}>
              {templates.map(tpl => {
                const tplId = tpl.id || tpl._id
                const cycleLen = tpl.cycle_length || tpl.cycleLength || 1
                return (
                  <Card key={tplId} style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F3F4F6' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: BLACK }}>{tpl.name}</div>
                        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                          {cycleLen} week{cycleLen > 1 ? ' rotation' : ''} cycle
                        </div>
                      </div>
                      <button onClick={() => openEditTemplate(tpl)} style={{
                        background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
                      }}>
                        <Edit2 size={14} style={{ color: '#6B7280' }} />
                      </button>
                    </div>
                    <div style={{ padding: '12px 20px 16px' }}>
                      {/* Week preview tabs */}
                      {cycleLen > 1 && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                          {Array.from({ length: cycleLen }, (_, i) => i + 1).map(wk => (
                            <span key={wk} style={{
                              fontSize: 11, padding: '3px 8px', borderRadius: 6,
                              background: '#F3F4F6', color: '#6B7280', fontWeight: 500,
                            }}>
                              Wk {wk}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Show week 1 preview */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        {DAYS.map(day => {
                          const dData = tpl.weeks?.[1]?.[day]
                          const isActive = dData?.active
                          return (
                            <div key={day} style={{
                              flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 8,
                              background: isActive ? '#F0FDF4' : '#F9FAFB',
                              border: `1px solid ${isActive ? '#BBF7D0' : '#F3F4F6'}`,
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', marginBottom: 2 }}>{DAY_LABELS[day]}</div>
                              <div style={{ fontSize: 9, color: isActive ? '#16A34A' : '#D1D5DB', fontWeight: 500 }}>
                                {isActive ? `${dData.start || '?'}-${dData.end || '?'}` : 'OFF'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* === SECTION 2: Staff Assignments === */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: BLACK, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} style={{ color: GOLD }} />
            Staff Assignments
          </h2>

          {staffList.length === 0 ? (
            <Card style={{ padding: 40, textAlign: 'center' }}>
              <Users size={36} style={{ color: '#D1D5DB', marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>No staff members found.</p>
            </Card>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
                  <thead>
                    <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Staff Member</th>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Template</th>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</th>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rotation Week</th>
                      <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map(s => {
                      const sid = s.id || s._id
                      const assignment = assignments[sid]
                      const tplName = assignment ? getTemplateName(assignment.template_id) : null
                      return (
                        <tr key={sid} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: BLACK }}>{s.name || 'Unnamed'}</div>
                            {s.role && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{s.role}</div>}
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            {assignment ? (
                              <span style={{
                                fontSize: 12, fontWeight: 500, background: '#F0FDF4', color: '#16A34A',
                                padding: '4px 10px', borderRadius: 6, border: '1px solid #BBF7D0',
                              }}>{tplName}</span>
                            ) : (
                              <span style={{ fontSize: 12, color: '#D1D5DB' }}>Not assigned</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: 13, color: '#6B7280' }}>
                            {assignment?.start_date || '-'}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: 13, color: '#6B7280' }}>
                            {assignment?.start_date ? `Week ${getCurrentWeekInRotation(assignment.start_date) || '-'}` : '-'}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <button onClick={() => openAssignModal(s)} style={{
                              background: assignment ? '#F9FAFB' : BLACK,
                              color: assignment ? BLACK : '#fff',
                              border: assignment ? '1px solid #E5E7EB' : 'none',
                              borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600,
                              fontFamily: FONT, cursor: 'pointer',
                            }}>
                              {assignment ? 'Change' : 'Assign'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* === SECTION 3: Schedule Viewer === */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: BLACK, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} style={{ color: GOLD }} />
              Weekly Schedule
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={prevWeek} style={{
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
              }}>
                <ChevronLeft size={16} style={{ color: '#6B7280' }} />
              </button>
              <button onClick={goToday} style={{
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '7px 14px',
                fontFamily: FONT, fontSize: 12, fontWeight: 600, color: BLACK, cursor: 'pointer',
              }}>
                Today
              </button>
              <button onClick={nextWeek} style={{
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
              }}>
                <ChevronRight size={16} style={{ color: '#6B7280' }} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: BLACK, marginLeft: 8 }}>
                {formatShortDate(selectedWeek)} - {formatShortDate(addDays(selectedWeek, 6))}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Working', cls: 'bg-white border border-gray-200' },
              { label: 'Off', cls: 'bg-gray-50 border border-gray-100' },
              { label: 'Sick', cls: 'bg-red-50 border border-red-100' },
              { label: 'Holiday', cls: 'bg-blue-50 border border-blue-100' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}>
                <div className={l.cls} style={{ width: 14, height: 14, borderRadius: 4 }} />
                {l.label}
              </div>
            ))}
          </div>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, minWidth: 700 }}>
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: '#6B7280', minWidth: 140, position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 1 }}>
                      Staff
                    </th>
                    {weekDates.map(d => {
                      const isToday = formatDate(d) === formatDate(new Date())
                      return (
                        <th key={formatDate(d)} style={{
                          textAlign: 'center', padding: '12px 8px', fontSize: 12, fontWeight: 600,
                          color: isToday ? GOLD : '#6B7280',
                          borderBottom: isToday ? `2px solid ${GOLD}` : undefined,
                        }}>
                          <div>{DAY_LABELS[getDayName(d)]}</div>
                          <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>{formatShortDate(d)}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {staffList.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9CA3AF', fontSize: 14 }}>
                        No staff to display
                      </td>
                    </tr>
                  ) : (
                    staffList.map(s => {
                      const sid = s.id || s._id
                      return (
                        <tr key={sid} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: BLACK, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                            {s.name || 'Unnamed'}
                          </td>
                          {weekDates.map(d => {
                            const dateStr = formatDate(d)
                            const dayData = getScheduleForDay(sid, d)
                            const cellColor = getDayCellColor(dayData)
                            const hasOverride = dayData?.override_reason || dayData?.reason
                            const isOff = dayData?.active === false || dayData?.off || (!dayData?.start && !dayData?.end && !hasOverride)
                            return (
                              <td key={dateStr} style={{ padding: '6px 4px', textAlign: 'center' }}>
                                <button
                                  onClick={() => openOverrideModal(sid, dateStr)}
                                  className={cellColor}
                                  style={{
                                    width: '100%', padding: '8px 4px', borderRadius: 8,
                                    border: '1px solid transparent', cursor: 'pointer',
                                    fontFamily: FONT, fontSize: 11, fontWeight: 500,
                                    color: isOff ? '#9CA3AF' : BLACK,
                                    transition: 'border-color 0.15s',
                                  }}
                                  onMouseEnter={e => e.target.style.borderColor = '#D1D5DB'}
                                  onMouseLeave={e => e.target.style.borderColor = 'transparent'}
                                  title="Click to add override"
                                >
                                  {hasOverride ? (
                                    <div>
                                      <div style={{ fontSize: 10, textTransform: 'capitalize', color: dayData.override_reason === 'sick' || dayData.reason === 'sick' ? '#EF4444' : '#3B82F6' }}>
                                        {dayData.override_reason || dayData.reason}
                                      </div>
                                      {dayData.start && dayData.end && (
                                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>
                                          {dayData.start}-{dayData.end}
                                        </div>
                                      )}
                                    </div>
                                  ) : isOff ? (
                                    'OFF'
                                  ) : (
                                    <div>
                                      {dayData?.start && dayData?.end ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Sun size={9} style={{ color: GOLD }} />
                                            <span>{dayData.start}</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Moon size={9} style={{ color: '#6B7280' }} />
                                            <span>{dayData.end}</span>
                                          </div>
                                        </div>
                                      ) : '-'}
                                    </div>
                                  )}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* === MODALS === */}

      {/* Create/Edit Template Modal */}
      <Modal open={templateModal} onClose={() => setTemplateModal(false)} title={editingTemplate ? 'Edit Template' : 'Create Rota Template'} width={600}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: BLACK, display: 'block', marginBottom: 6 }}>Template Name</label>
            <input
              type="text" value={tplName} onChange={e => setTplName(e.target.value)}
              placeholder="e.g. Standard Week, Alternating Weekends"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB',
                fontFamily: FONT, fontSize: 14, color: BLACK, outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = GOLD}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* Cycle Length */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: BLACK, display: 'block', marginBottom: 6 }}>Rotation Cycle Length</label>
            <CustomSelect
              value={tplCycleLength}
              onChange={handleCycleLengthChange}
              options={[1, 2, 3, 4, 5, 6].map(n => ({ value: n, label: `${n} week${n > 1 ? 's' : ''}` }))}
            />
          </div>

          {/* Week Tabs */}
          {tplCycleLength > 1 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: tplCycleLength }, (_, i) => i + 1).map(wk => (
                <button key={wk} onClick={() => setTplActiveWeek(wk)} style={{
                  padding: '7px 16px', borderRadius: 8, border: '1px solid',
                  borderColor: tplActiveWeek === wk ? GOLD : '#E5E7EB',
                  background: tplActiveWeek === wk ? '#FFFBEB' : '#fff',
                  fontFamily: FONT, fontSize: 13, fontWeight: 600,
                  color: tplActiveWeek === wk ? GOLD : '#6B7280',
                  cursor: 'pointer',
                }}>
                  Week {wk}
                </button>
              ))}
            </div>
          )}

          {/* Day Schedule for Active Week */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DAYS.map(day => {
              const dData = tplWeeks[tplActiveWeek]?.[day] || { active: false, start: '', end: '' }
              return (
                <div key={day} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  borderRadius: 10, background: dData.active ? '#FAFAFA' : '#fff',
                  border: '1px solid #F3F4F6',
                }}>
                  <div style={{ width: 40, fontSize: 13, fontWeight: 600, color: BLACK }}>{DAY_LABELS[day]}</div>
                  <button
                    onClick={() => toggleDayActive(tplActiveWeek, day)}
                    style={{
                      width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                      background: dData.active ? '#16A34A' : '#D1D5DB', position: 'relative',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2, left: dData.active ? 20 : 2,
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }} />
                  </button>
                  {dData.active ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <input
                        type="time" value={dData.start || ''} onChange={e => updateDayInWeek(tplActiveWeek, day, 'start', e.target.value)}
                        style={{
                          padding: '6px 10px', borderRadius: 8, border: '1px solid #E5E7EB',
                          fontFamily: FONT, fontSize: 13, color: BLACK, outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: 13, color: '#9CA3AF' }}>to</span>
                      <input
                        type="time" value={dData.end || ''} onChange={e => updateDayInWeek(tplActiveWeek, day, 'end', e.target.value)}
                        style={{
                          padding: '6px 10px', borderRadius: 8, border: '1px solid #E5E7EB',
                          fontFamily: FONT, fontSize: 13, color: BLACK, outline: 'none',
                        }}
                      />
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: '#D1D5DB', fontWeight: 500 }}>OFF</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Save Button */}
          <button onClick={saveTemplate} disabled={tplSaving} style={{
            background: BLACK, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0',
            fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: tplSaving ? 'default' : 'pointer',
            opacity: tplSaving ? 0.6 : 1, marginTop: 4, width: '100%',
          }}>
            {tplSaving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </Modal>

      {/* Assign Template Modal */}
      <Modal open={!!assignModal} onClose={() => setAssignModal(null)} title={`Assign Template — ${assignModal?.name || ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: BLACK, display: 'block', marginBottom: 6 }}>Rota Template</label>
            <CustomSelect
              value={assignTemplateId}
              onChange={setAssignTemplateId}
              options={templates.map(t => ({ value: t.id || t._id, label: t.name }))}
              placeholder="Select a template..."
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: BLACK, display: 'block', marginBottom: 6 }}>Start Date (must be a Monday)</label>
            <input
              type="date" value={assignStartDate} onChange={e => setAssignStartDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB',
                fontFamily: FONT, fontSize: 14, color: BLACK, outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = GOLD}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
            {assignStartDate && new Date(assignStartDate).getDay() !== 1 && (
              <div style={{ fontSize: 12, color: '#EF4444', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} /> Selected date is not a Monday
              </div>
            )}
          </div>
          <button onClick={saveAssignment} disabled={assignSaving} style={{
            background: BLACK, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0',
            fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: assignSaving ? 'default' : 'pointer',
            opacity: assignSaving ? 0.6 : 1, width: '100%',
          }}>
            {assignSaving ? 'Assigning...' : 'Assign Template'}
          </button>
        </div>
      </Modal>

      {/* Override Modal */}
      <Modal open={!!overrideModal} onClose={() => setOverrideModal(null)} title="Add Day Override">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            Override for <strong>{staffList.find(s => (s.id || s._id) === overrideModal?.staffId)?.name || 'Staff'}</strong> on <strong>{overrideModal?.date}</strong>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: BLACK, display: 'block', marginBottom: 6 }}>Reason</label>
            <CustomSelect
              value={overrideReason}
              onChange={setOverrideReason}
              options={OVERRIDE_REASONS.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
            />
          </div>
          {overrideReason === 'custom' && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: BLACK, display: 'block', marginBottom: 6 }}>Custom Reason</label>
              <input
                type="text" value={overrideCustomReason} onChange={e => setOverrideCustomReason(e.target.value)}
                placeholder="Enter reason..."
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB',
                  fontFamily: FONT, fontSize: 14, color: BLACK, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: BLACK, display: 'block', marginBottom: 6 }}>Replacement Hours (optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="time" value={overrideStart} onChange={e => setOverrideStart(e.target.value)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB',
                  fontFamily: FONT, fontSize: 14, color: BLACK, outline: 'none',
                }}
              />
              <span style={{ fontSize: 13, color: '#9CA3AF' }}>to</span>
              <input
                type="time" value={overrideEnd} onChange={e => setOverrideEnd(e.target.value)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB',
                  fontFamily: FONT, fontSize: 14, color: BLACK, outline: 'none',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Leave empty to mark the entire day with this reason</div>
          </div>
          <button onClick={saveOverride} disabled={overrideSaving} style={{
            background: BLACK, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0',
            fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: overrideSaving ? 'default' : 'pointer',
            opacity: overrideSaving ? 0.6 : 1, width: '100%',
          }}>
            {overrideSaving ? 'Saving...' : 'Save Override'}
          </button>
        </div>
      </Modal>

      {/* Toasts */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default RotaBuilder
