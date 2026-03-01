/**
 * Run 5: Staff Management — team list, working hours, permissions, invites
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import { X, Camera, User, Clock, Plus } from 'lucide-react'



import { STAFF_TIER_LIMITS, PERMISSION_LABELS, DAY_LABELS, TIME_SLOTS } from '../../config/staff'
import { TIER_ORDER, TIERS } from '../../config/tiers'
import UpgradeModal from '../../components/layout/UpgradeModal'

const DEFAULT_HOURS = {
  mon: { active: true, start: '09:00', end: '17:00' },
  tue: { active: true, start: '09:00', end: '17:00' },
  wed: { active: true, start: '09:00', end: '17:00' },
  thu: { active: true, start: '09:00', end: '17:00' },
  fri: { active: true, start: '09:00', end: '17:00' },
  sat: { active: false },
  sun: { active: false },
}

const ROLES = ['Senior Stylist', 'Stylist', 'Junior Stylist', 'Receptionist', 'Manager', 'Custom']

const Staff = () => {
  const { business, tier } = useBusiness()
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [panel, setPanel] = useState(null) // { mode: 'add'|'edit', staff: {...} }
  const [upgradeModal, setUpgradeModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [addSuccess, setAddSuccess] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const filterRef = useRef(null)

  // Close filter dropdown on click outside
  useEffect(() => {
    const handler = e => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const staffLimit = STAFF_TIER_LIMITS[tier] ?? STAFF_TIER_LIMITS.free
  const atLimit = staff.length >= staffLimit
  const canAdd = !atLimit

  const filteredStaff = staff.filter(s => {
    if (filter === 'active' && !s.isWorkingToday) return false
    if (filter === 'pending' && s.inviteStatus !== 'pending') return false
    if (filter === 'holiday' && s.status !== 'holiday') return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (s.name || '').toLowerCase().includes(q) || (s.role || '').toLowerCase().includes(q)
    }
    return true
  })

  const handleExport = () => {
    const headers = ['Name', 'Role', 'Email', 'Status', 'Permissions']
    const rows = staff.map(s => [
      s.name || '', s.role || '', s.email || '',
      s.status === 'holiday' ? 'Holiday' : s.inviteStatus === 'pending' ? 'Pending' : s.isWorkingToday ? 'Active' : 'Off',
      s.permissions || ''
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `staff-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fetchStaff = async () => {
    if (!business?.id) return
    try {
      const res = await api.get(`/staff-v2/business/${business.id}`)
      setStaff(res.staff || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load staff')
      setStaff([])
    }
  }

  const fetchServices = async () => {
    if (!business?.id) return
    try {
      const res = await api.get(`/services-v2/business/${business.id}`).catch(() => ({ categories: [] }))
      const flat = (res.categories || []).flatMap((c) => (c.services || []).map((s) => ({ id: s.id, name: s.name, duration: s.duration })))
      setServices(flat)
    } catch {
      setServices([])
    }
  }

  useEffect(() => {
    if (business?.id) {
      setLoading(true)
      Promise.all([fetchStaff(), fetchServices()]).finally(() => setLoading(false))
    }
  }, [business?.id])

  const handleAddClick = () => {
    if (!canAdd) {
      const nextIdx = TIER_ORDER.indexOf(tier) + 1
      const nextTier = TIER_ORDER[nextIdx] || 'scale'
      const nextLimit = STAFF_TIER_LIMITS[nextTier] ?? 999
      setUpgradeModal({
        tierLabel: TIERS[nextTier]?.label || nextTier,
        limit: staffLimit,
        nextLimit,
      })
      return
    }
    setPanel({
      mode: 'add',
      staff: {
        name: '',
        email: '',
        phone: '',
        role: 'Stylist',
        permissions: 'staff',
        serviceIds: [],
        workingHours: { ...JSON.parse(JSON.stringify(DEFAULT_HOURS)) },
        timeOff: [],
        sendInvite: true,
      },
    })
    setAddSuccess(null)
  }

  const handleEditClick = (s) => {
    setPanel({
      mode: 'edit',
      staff: {
        ...s,
        workingHours: s.workingHours ? { ...s.workingHours } : { ...JSON.parse(JSON.stringify(DEFAULT_HOURS)) },
        timeOff: s.timeOff ? [...s.timeOff] : [],
      },
    })
  }

  const handleClosePanel = () => {
    setPanel(null)
    setAddSuccess(null)
  }

  const handleSave = async (formData) => {
    if (!business?.id) return
    setSaving(true)
    try {
      if (panel.mode === 'add') {
        const payload = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone?.trim() || '',
          role: formData.role || 'Staff',
          permissions: formData.permissions || 'staff',
          serviceIds: formData.serviceIds || [],
          workingHours: formData.workingHours || DEFAULT_HOURS,
          sendInvite: formData.sendInvite !== false,
        }
        await api.post(`/staff-v2/business/${business.id}`, payload)
        setAddSuccess(`Invite sent to ${formData.email}`)
        fetchStaff()
        setTimeout(() => {
          handleClosePanel()
        }, 1500)
      } else {
        await api.put(`/staff-v2/business/${business.id}/${formData.id}`, {
          name: formData.name.trim(),
          phone: formData.phone?.trim() || '',
          role: formData.role || 'Staff',
          permissions: formData.permissions || 'staff',
          serviceIds: formData.serviceIds || [],
          workingHours: formData.workingHours,
        })
        if (formData.inviteStatus !== 'accepted') {
          await api.put(`/staff-v2/business/${business.id}/${formData.id}`, { email: formData.email?.trim() })
        }
        fetchStaff()
        handleClosePanel()
      }
    } catch (err) {
      alert(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (s) => {
    if (!confirm(`Remove ${s.name}? They will no longer appear in the team.`)) return
    try {
      const res = await api.delete(`/staff-v2/business/${business.id}/${s.id}`)
      if (res?.futureBookings > 0) {
        const ok = confirm(res.warning + ' Continue anyway?')
        if (!ok) return
        await api.delete(`/staff-v2/business/${business.id}/${s.id}?confirm=true`)
      }
      fetchStaff()
    } catch (err) {
      alert(err.message || 'Delete failed')
    }
  }

  const handleReinvite = async (s) => {
    try {
      await api.post(`/staff-v2/business/${business.id}/${s.id}/reinvite`)
      fetchStaff()
    } catch (err) {
      alert(err.message || 'Resend failed')
    }
  }

  if (loading && !staff.length) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        <p className="mt-4 text-gray-500">Loading staff...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-1">Staff</h1>
          <p className="text-gray-500 text-sm">
            Manage your team members and their schedules
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="text-sm font-semibold text-gray-500 hover:text-primary border border-border rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-2">
            <i className="fa-solid fa-download text-xs" /> Export
          </button>
          <div className="relative" ref={filterRef}>
            <button onClick={() => setShowFilterMenu(!showFilterMenu)} className={`text-sm font-semibold border border-border rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-2 ${filter !== 'all' ? 'text-primary border-primary bg-primary/5' : 'text-gray-500 hover:text-primary'}`}>
              <i className="fa-solid fa-filter text-xs" /> Filter{filter !== 'all' && ` · ${filter}`}
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-xl py-1 z-50 min-w-[140px]">
                {[
                  { value: 'all', label: 'All Staff' },
                  { value: 'active', label: 'Active' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'holiday', label: 'On Holiday' },
                ].map(f => (
                  <button key={f.value} onClick={() => { setFilter(f.value); setShowFilterMenu(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${filter === f.value ? 'text-primary font-semibold' : 'text-gray-600'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleAddClick}
            disabled={!canAdd}
            className={`w-11 h-11 rounded-full bg-primary text-white shadow-lg hover:bg-primary-hover transition-all flex items-center justify-center ${!canAdd ? 'opacity-75 cursor-not-allowed' : 'hover:scale-105'}`}
            title={canAdd ? 'Add Staff Member' : 'Upgrade to add more staff'}
          >
            {!canAdd ? <i className="fa-solid fa-lock text-sm" /> : <i className="fa-solid fa-plus text-lg" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-white border border-red-500-200 rounded-xl shadow-sm p-6 mb-6 bg-red-500-50">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {staff.length === 0 ? (
        <div className="bg-white border border-border rounded-xl shadow-sm p-6">
          <p className="text-center text-gray-500 py-12">
            No staff members yet. Add your first team member!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {filteredStaff.map((s) => (
            <StaffCard
              key={s.id}
              staff={s}
              onEdit={() => handleEditClick(s)}
              onDelete={() => handleDelete(s)}
              onReinvite={() => handleReinvite(s)}
              onSchedule={() => navigate('/dashboard/calendar')}
            />
          ))}
        </div>
      )}

      {panel && (
        <StaffEditPanel
          mode={panel.mode}
          staff={panel.staff}
          services={services}
          businessId={business?.id}
          onSave={handleSave}
          onClose={handleClosePanel}
          saving={saving}
          addSuccess={addSuccess}
        />
      )}

      {upgradeModal && (
        <UpgradeModal
          tierName={upgradeModal.tierLabel}
          message={`Your plan allows ${upgradeModal.limit} staff. Upgrade for up to ${upgradeModal.nextLimit}.`}
          onClose={() => setUpgradeModal(null)}
          onViewPlans={() => setUpgradeModal(null)}
        />
      )}
    </div>
  )
}

const StaffCard = ({ staff, onEdit, onDelete, onReinvite, onSchedule }) => {
  const initials = (staff.name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const statusLabel =
    staff.status === 'holiday'
      ? 'On Holiday'
      : staff.inviteStatus === 'pending'
        ? 'Invite Pending'
        : staff.isWorkingToday
          ? 'Active'
          : 'Off Today'
  const statusDot =
    staff.status === 'holiday'
      ? 'text-blue-500'
      : staff.inviteStatus === 'pending'
        ? 'text-amber-500'
        : staff.isWorkingToday
          ? 'text-green-500'
          : 'text-gray-400'
  const statusBg =
    staff.status === 'holiday'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : staff.inviteStatus === 'pending'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : staff.isWorkingToday
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-gray-50 text-gray-600 border-gray-200'
  const hoursText = staff.todayHours
    ? `${staff.todayHours.start} - ${staff.todayHours.end}`
    : 'Not scheduled'

  return (
    <div className="bg-white border border-border rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      {/* Header: Avatar + Name/Role/Status */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-white shadow-sm">
          {staff.avatar ? (
            <img src={staff.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-primary">{initials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-bold text-lg text-primary truncate">{staff.name}</h3>
          <p className="text-sm text-gray-500 truncate">{staff.role}</p>
          <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBg}`}>
            <i className={`fa-solid fa-circle text-[6px] ${statusDot}`} />
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-500">
            <i className="fa-regular fa-clock text-xs w-4 text-center" /> Working Hours
          </span>
          <span className="font-semibold text-primary">{hoursText}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-500">
            <i className="fa-solid fa-calendar-check text-xs w-4 text-center" /> Bookings Today
          </span>
          <span className="font-semibold text-primary">{staff.bookingsToday ?? 0} appointments</span>
        </div>
      </div>

      {staff.inviteStatus === 'pending' && (
        <button onClick={onReinvite} className="text-sm text-primary hover:underline mb-3 block">
          Resend invite
        </button>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <button
          onClick={onEdit}
          className="flex-1 text-sm font-bold text-primary border border-border rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-pen-to-square text-xs" /> Edit
        </button>
        <button
          onClick={onSchedule}
          className="flex-1 text-sm font-bold text-primary border border-border rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <i className="fa-regular fa-calendar text-xs" /> Schedule
        </button>
        {staff.permissions !== 'owner' && (
          <button
            onClick={onDelete}
            className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 border border-border rounded-lg transition-colors shrink-0"
            title="Delete"
          >
            <i className="fa-solid fa-trash text-sm" />
          </button>
        )}
      </div>
    </div>
  )
}

const StaffEditPanel = ({ mode, staff, services, businessId, onSave, onClose, saving, addSuccess }) => {
  const [panelTab, setPanelTab] = useState('details')
  const [form, setForm] = useState(staff)
  const [timeOffForm, setTimeOffForm] = useState({ startDate: '', endDate: '', reason: '' })
  const [showTimeOffForm, setShowTimeOffForm] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef(null)

  useEffect(() => {
    setForm(staff)
  }, [staff])

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!businessId || !form.id) {
      // For new staff, just preview locally
      const reader = new FileReader()
      reader.onload = () => update('avatar', reader.result)
      reader.readAsDataURL(file)
      return
    }
    setAvatarUploading(true)
    try {
      const res = await api.upload(`/staff-v2/business/${businessId}/${form.id}/avatar`, file)
      update('avatar', res.url)
    } catch (err) {
      alert(err.message || 'Failed to upload photo')
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }
  const updateHours = (day, field, value) => {
    setForm((f) => {
      const wh = { ...(f.workingHours || {}), [day]: { ...(f.workingHours?.[day] || {}), [field]: value } }
      return { ...f, workingHours: wh }
    })
  }

  const copyToAllDays = () => {
    const firstActive = Object.entries(form.workingHours || {}).find(([, d]) => d?.active)
    if (!firstActive) return
    const [_, val] = firstActive
    const start = val?.start || '09:00'
    const end = val?.end || '17:00'
    const wh = {}
    for (const d of Object.keys(DAY_LABELS)) {
      wh[d] = { ...(form.workingHours?.[d] || {}), active: true, start, end }
    }
    update('workingHours', wh)
  }

  const toggleService = (id) => {
    const ids = form.serviceIds || []
    update('serviceIds', ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  }

  const addTimeOff = async () => {
    if (!timeOffForm.startDate || !timeOffForm.endDate) return
    if (!businessId || !form.id) return
    try {
      const updated = await api.post(
        `/staff-v2/business/${businessId}/${form.id}/time-off`,
        timeOffForm
      )
      setForm((f) => ({ ...f, timeOff: updated.timeOff || f.timeOff || [] }))
      setTimeOffForm({ startDate: '', endDate: '', reason: '' })
      setShowTimeOffForm(false)
    } catch (err) {
      alert(err.message || 'Failed to add time off')
    }
  }

  const removeTimeOff = async (toId) => {
    if (!businessId || !form.id) return
    try {
      const updated = await api.delete(
        `/staff-v2/business/${businessId}/${form.id}/time-off/${toId}`
      )
      setForm((f) => ({ ...f, timeOff: updated.timeOff || (f.timeOff || []).filter((t) => t.id !== toId) }))
    } catch (err) {
      alert(err.message || 'Failed to remove time off')
    }
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div
      className={`fixed inset-0 z-50 flex ${isMobile ? 'items-stretch' : 'items-center justify-end'}`}
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative bg-white shadow-xl overflow-y-auto ${
          isMobile ? 'w-full max-h-full' : 'w-full max-w-[400px] h-full max-h-screen'
        }`}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-extrabold text-gray-900" style={{ fontFamily: "'Figtree', sans-serif" }}>
              {mode === 'add' ? 'Add Staff Member' : 'Edit Staff Member'}
            </h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPanelTab('details')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${panelTab === 'details' ? 'bg-[#111111] text-white shadow-lg shadow-[#111111]/20' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              style={{ fontFamily: "'Figtree', sans-serif" }}
            >
              <span className="flex items-center gap-1.5"><User className="w-3 h-3" /> Details</span>
            </button>
            <button
              onClick={() => setPanelTab('schedule')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${panelTab === 'schedule' ? 'bg-[#111111] text-white shadow-lg shadow-[#111111]/20' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              style={{ fontFamily: "'Figtree', sans-serif" }}
            >
              <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Schedule</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {addSuccess && (
            <p className="text-green-600 text-sm font-medium">{addSuccess}</p>
          )}

          {panelTab === 'details' && (<>
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-[#111111]/10 flex items-center justify-center overflow-hidden relative">
              {avatarUploading ? (
                <span className="w-8 h-8 border-3 border-[#111111]/30 border-t-[#111111] rounded-full animate-spin" />
              ) : form.avatar ? (
                <img src={form.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-semibold text-[#111111]">
                  {(form.name || '?').slice(0, 2).toUpperCase()}
                </span>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-[#111111] text-white rounded-full flex items-center justify-center hover:bg-[#1a1a1a] transition-colors shadow-lg"
                title="Upload photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Details */}
          <div>
            <label className="block text-sm font-bold text-primary mb-1.5">Name</label>
            <input type="text" value={form.name || ''} onChange={(e) => update('name', e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-bold text-primary mb-1.5">Email</label>
            <input type="email" value={form.email || ''} onChange={(e) => update('email', e.target.value)}
              readOnly={form.inviteStatus === 'accepted'}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-bold text-primary mb-1.5">Phone</label>
            <input type="text" value={form.phone || ''} onChange={(e) => update('phone', e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-bold text-primary mb-1.5">Role</label>
            <select
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white appearance-none"
              value={form.role || ''}
              onChange={(e) => update('role', e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-primary mb-1.5">Permissions</label>
            <select
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white appearance-none"
              value={form.permissions || 'staff'}
              onChange={(e) => update('permissions', e.target.value)}
            >
              {Object.entries(PERMISSION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {mode === 'add' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.sendInvite !== false}
                onChange={(e) => update('sendInvite', e.target.checked)}
              />
              <span className="text-sm">Send email invite</span>
            </label>
          )}
          </>)}

          {panelTab === 'schedule' && (<>
          {/* Working Hours */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Working Hours</h3>
              <button
                type="button"
                onClick={copyToAllDays}
                className="text-sm text-primary hover:underline"
              >
                Copy to all days
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(DAY_LABELS).map(([key, label]) => {
                const d = form.workingHours?.[key] || {}
                const active = d.active !== false
                return (
                  <div key={key} className="flex items-center gap-2 flex-wrap">
                    <span className="w-24 text-sm">{label}</span>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => updateHours(key, 'active', e.target.checked)}
                      />
                      <span className="text-sm">On</span>
                    </label>
                    {active && (
                      <>
                        <select
                          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none py-1.5 text-sm flex-1 min-w-0"
                          value={d.start || '09:00'}
                          onChange={(e) => updateHours(key, 'start', e.target.value)}
                        >
                          {TIME_SLOTS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <span className="text-gray-500">–</span>
                        <select
                          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none py-1.5 text-sm flex-1 min-w-0"
                          value={d.end || '17:00'}
                          onChange={(e) => updateHours(key, 'end', e.target.value)}
                        >
                          {TIME_SLOTS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Services */}
          {services.length > 0 && (
            <div>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => update('serviceIds', services.map((s) => s.id))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => update('serviceIds', [])}
                >
                  Deselect All
                </button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {services.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(form.serviceIds || []).includes(s.id)}
                      onChange={() => toggleService(s.id)}
                    />
                    {s.name}
                    {s.duration && <span className="text-gray-500">({s.duration} min)</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Time Off (edit only - staff must exist first) */}
          {mode === 'edit' && form.id && (
          <div>
            <h3 className="font-semibold mb-2">Time Off</h3>
            {(form.timeOff || []).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <span className="text-sm">
                  {t.startDate} – {t.endDate}
                  {t.reason && ` (${t.reason})`}
                </span>
                <button
                  type="button"
                  onClick={() => removeTimeOff(t.id)}
                  className="text-red-500 hover:underline text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
            {showTimeOffForm ? (
              <div className="mt-2 p-3 border border-border rounded-lg space-y-2">
                <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">Start</label>
                  <input type="date" value={timeOffForm.startDate} onChange={(e) => setTimeOffForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">End</label>
                  <input type="date" value={timeOffForm.endDate} onChange={(e) => setTimeOffForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">Reason</label>
                  <input type="text" value={timeOffForm.reason} onChange={(e) => setTimeOffForm((f) => ({ ...f, reason: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={addTimeOff} className="px-3 py-1.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-hover">
                    Add
                  </button>
                  <button
                    type="button"
                    className="text-sm text-gray-500 hover:underline"
                    onClick={() => setShowTimeOffForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowTimeOffForm(true)}
                className="text-sm text-primary hover:underline mt-1"
              >
                + Add Time Off
              </button>
            )}
          </div>
          )}
          </>)}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3">
          <button onClick={() => onSave(form)} disabled={saving}
            className="bg-[#111111] text-white font-bold text-xs px-6 py-2 rounded-full shadow-lg shadow-[#111111]/20 hover:bg-[#1a1a1a] transition-all disabled:opacity-50" style={{ fontFamily: "'Figtree', sans-serif" }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-2 transition-colors" style={{ fontFamily: "'Figtree', sans-serif" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default Staff
