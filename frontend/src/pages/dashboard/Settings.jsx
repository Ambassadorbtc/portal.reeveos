import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Run 13: Settings — Business, Opening Hours, Notifications, Integrations, Subscription, Team, Danger Zone
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBusiness } from '../../contexts/BusinessContext'
import api, { API_BASE_URL } from '../../utils/api'
import { isFeatureUnlocked } from '../../config/tiers'
import { getDomainConfig } from '../../utils/domain'

const TABS = [
  { id: 'business', label: 'Business' },
  { id: 'hours', label: 'Opening Hours' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'team', label: 'Team Permissions' },
]

const BUSINESS_TYPES = [
  'Salon', 'Barber', 'Spa', 'Beauty Clinic', 'Restaurant', 'Café',
  'Nail Bar', 'Lash Bar', 'Wax Specialist', 'Other'
]

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const TIME_OPTIONS = []
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    TIME_OPTIONS.push(t)
  }
}

const NOTIFICATION_EVENTS = [
  { key: 'newBooking', label: 'New booking' },
  { key: 'bookingCancelled', label: 'Booking cancelled' },
  { key: 'bookingModified', label: 'Booking modified' },
  { key: 'newReview', label: 'New review' },
  { key: 'paymentReceived', label: 'Payment received' },
  { key: 'noShow', label: 'No-show' },
  { key: 'dailySummary', label: 'Daily summary' },
  { key: 'newOrder', label: 'New order (restaurant)' },
]

const INTEGRATIONS = [
  { type: 'stripe', name: 'Stripe Connect', desc: 'Payment processing', tier: 'free' },
  { type: 'googleBusiness', name: 'Google Business Profile', desc: 'Reviews sync', tier: 'growth' },
  { type: 'customEmailDomain', name: 'Custom Email Domain', desc: 'Send from your domain', tier: 'growth' },
  { type: 'uberDirect', name: 'Uber Direct', desc: 'Delivery dispatch', tier: 'scale' },
  { type: 'zapier', name: 'Zapier', desc: 'Connect to 5000+ apps', tier: 'scale' },
  { type: 'googleAnalytics', name: 'Google Analytics', desc: 'Website tracking', tier: 'scale' },
]

const PLANS = [
  { tier: 'free', name: 'Free', price: 0 },
  { tier: 'starter', name: 'Starter', price: 8.99 },
  { tier: 'pro', name: 'Growth', price: 29 },
  { tier: 'premium', name: 'Scale', price: 59 },
  { tier: 'enterprise', name: 'Enterprise', price: null },
]

const toImageUrl = (path) => path?.startsWith('/') ? `${API_BASE_URL}${path}` : path

const Settings = () => {
  const navigate = useNavigate()
  const { business, businessType, tier } = useBusiness()
  const [settings, setSettings] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('business')
  const [toast, setToast] = useState(null)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [specialHoursForm, setSpecialHoursForm] = useState({ date: '', open: true, start: '09:00', end: '17:00', label: '' })

  const bizId = business?.id ?? business?._id

  const fetchSettings = useCallback(async () => {
    if (!bizId) return
    try {
      const [s, sub] = await Promise.all([
        api.get(`/settings-v2/business/${bizId}`),
        api.get(`/settings-v2/subscription/${bizId}`).catch(() => null),
      ])
      setSettings(s)
      setSubscription(sub)
    } catch (err) {
      console.error(err)
      setToast(err.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [bizId])

  const fetchStaff = useCallback(async () => {
    if (!bizId || activeTab !== 'team') return
    try {
      const res = await api.get(`/staff-v2/business/${bizId}`).catch(() => ({ staff: [] }))
      setStaff(res?.staff ?? [])
    } catch {
      setStaff([])
    }
  }, [bizId, activeTab])

  useEffect(() => { fetchSettings() }, [fetchSettings])
  useEffect(() => { fetchStaff() }, [fetchStaff])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const updateBusiness = (key, value) => {
    setSettings((s) => ({
      ...s,
      business: { ...s?.business, [key]: value },
    }))
  }

  const saveBusiness = async () => {
    if (!bizId || !settings?.business) return
    setSaving(true)
    try {
      await api.put(`/settings-v2/business/${bizId}`, { business: settings.business })
      showToast('Saved ✓')
    } catch (err) {
      showToast(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveHours = async () => {
    if (!bizId || !settings?.openingHours) return
    setSaving(true)
    try {
      await api.put(`/settings-v2/business/${bizId}/hours`, { openingHours: settings.openingHours })
      showToast('Hours saved ✓')
    } catch (err) {
      showToast(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const copyToAllHours = () => {
    const firstOpen = DAYS.find((d) => settings?.openingHours?.[d.key]?.open)
    const template = firstOpen ? settings.openingHours[firstOpen.key] : { open: true, start: '09:00', end: '17:00' }
    setSettings((s) => ({
      ...s,
      openingHours: Object.fromEntries(
        DAYS.map((d) => [
          d.key,
          s.openingHours[d.key]?.open ? { ...template, open: true } : { ...s.openingHours[d.key], open: false },
        ])
      ),
    }))
    showToast('Copied to all open days')
  }

  const addSpecialHours = async () => {
    if (!bizId || !specialHoursForm.date) return
    setSaving(true)
    try {
      const res = await api.post(`/settings-v2/business/${bizId}/special-hours`, specialHoursForm)
      setSettings((s) => ({
        ...s,
        specialHours: [...(s.specialHours || []), res],
      }))
      setSpecialHoursForm({ date: '', open: true, start: '09:00', end: '17:00', label: '' })
      showToast('Special hours added ✓')
    } catch (err) {
      showToast(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const removeSpecialHours = async (id) => {
    if (!bizId) return
    setSaving(true)
    try {
      await api.delete(`/settings-v2/business/${bizId}/special-hours/${id}`)
      setSettings((s) => ({
        ...s,
        specialHours: (s.specialHours || []).filter((sh) => sh.id !== id),
      }))
      showToast('Removed')
    } catch (err) {
      showToast(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const updateNotification = (eventKey, channel, value) => {
    setSettings((s) => {
      const ev = s.notifications?.[eventKey] || {}
      if (eventKey === 'dailySummary') {
        return { ...s, notifications: { ...s.notifications, dailySummary: { ...ev, [channel]: value } } }
      }
      return {
        ...s,
        notifications: {
          ...s.notifications,
          [eventKey]: { ...ev, [channel]: value },
        },
      }
    })
  }

  const saveNotifications = async () => {
    if (!bizId || !settings?.notifications) return
    setSaving(true)
    try {
      await api.put(`/settings-v2/business/${bizId}/notifications`, settings.notifications)
      showToast('Notifications saved ✓')
    } catch (err) {
      showToast(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const connectStripe = async () => {
    if (!bizId) return
    setSaving(true)
    try {
      const res = await api.post(`/settings-v2/business/${bizId}/integrations/stripe/connect`)
      if (res?.url) window.location.href = res.url
      else showToast('Connect flow not available')
    } catch (err) {
      showToast(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const disconnectStripe = async () => {
    if (!bizId || !window.confirm('Disconnect Stripe? You will not be able to accept payments.')) return
    setSaving(true)
    try {
      await api.delete(`/settings-v2/business/${bizId}/integrations/stripe/disconnect`)
      await fetchSettings()
      showToast('Stripe disconnected')
    } catch (err) {
      showToast(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e?.target?.files?.[0]
    if (!file || !bizId) return
    try {
      const res = await api.upload(`/booking-page/${bizId}/logo`, file)
      updateBusiness('logo', res.url)
      showToast('Logo uploaded ✓')
    } catch (err) {
      showToast(err.message || 'Upload failed')
    }
  }

  const handleCoverUpload = async (e) => {
    const file = e?.target?.files?.[0]
    if (!file || !bizId) return
    try {
      const res = await api.upload(`/booking-page/${bizId}/cover`, file)
      updateBusiness('coverPhoto', res.url)
      showToast('Cover uploaded ✓')
    } catch (err) {
      showToast(err.message || 'Upload failed')
    }
  }

  const changePlan = async (newTier) => {
    if (!bizId) return
    if (!window.confirm(`Change plan to ${PLANS.find((p) => p.tier === newTier)?.name || newTier}?`)) return
    setSaving(true)
    try {
      await api.post(`/settings-v2/subscription/${bizId}/change`, { tier: newTier })
      await fetchSettings()
      showToast('Plan updated ✓')
    } catch (err) {
      showToast(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const cancelSubscription = async () => {
    if (!bizId || !window.confirm('Cancel subscription? You will move to Free at end of billing period.')) return
    setSaving(true)
    try {
      await api.post(`/settings-v2/subscription/${bizId}/cancel`)
      await fetchSettings()
      showToast('Subscription cancelled')
    } catch (err) {
      showToast(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const exportData = async () => {
    if (!bizId) return
    try {
      const token = localStorage.getItem('token')
      const r = await fetch(`${API_BASE_URL}/settings-v2/business/${bizId}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!r.ok) throw new Error('Export failed')
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'rezvo-export.zip'
      a.click()
      showToast('Export downloaded ✓')
    } catch (err) {
      showToast(err.message || 'Export failed')
    }
  }

  const deleteBusiness = async () => {
    if (!bizId || deleteConfirmName !== business?.name) {
      showToast('Type the exact business name to confirm')
      return
    }
    setSaving(true)
    try {
      await api.delete(`/settings-v2/business/${bizId}?confirmName=${encodeURIComponent(deleteConfirmName)}`)
      showToast('Business scheduled for deletion')
      setDeleteModal(false)
      setDeleteConfirmName('')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      showToast(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !settings) {
    return (
      <div className="text-center py-12">
        <RezvoLoader message="Loading settings..." />
        <p className="mt-4 text-gray-500">Loading settings...</p>
      </div>
    )
  }

  const biz = settings?.business || {}
  const hours = settings?.openingHours || {}
  const notifications = settings?.notifications || {}
  const integrations = settings?.integrations || {}
  const stripeConnected = integrations?.stripe?.connected

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Settings</h1>
          <p className="text-gray-500">Configure your business</p>
        </div>
        {toast && (
          <span className="text-sm px-3 py-1 bg-forest/10 text-forest rounded-full">{toast}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-6 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-t-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'bg-forest text-white'
                : 'bg-transparent hover:bg-border/50 text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'business' && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
            <h2 className="text-xl font-heading font-semibold mb-4">Business Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">Business name</label>
                  <input type="text" value={biz.name || ''} onChange={(e) => updateBusiness('name', e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
              <div>
                <label className="block text-sm font-bold text-primary mb-1.5">Business type</label>
                <select
                  value={biz.businessType || 'Salon'}
                  onChange={(e) => updateBusiness('businessType', e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-bold text-primary mb-1.5">Description (max 500)</label>
              <textarea
                value={biz.description || ''}
                onChange={(e) => updateBusiness('description', e.target.value.slice(0, 500))}
                rows={3}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">{(biz.description || '').length}/500</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">Phone</label>
                  <input type="text" value={biz.phone || ''} onChange={(e) => updateBusiness('phone', e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
              <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">Email</label>
                  <input type="email" value={biz.email || ''} onChange={(e) => updateBusiness('email', e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">Address line 1</label>
                  <input type="text" value={biz.addressLine1 || biz.address || ''} onChange={(e) => updateBusiness('addressLine1', e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
              <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">Address line 2</label>
                  <input type="text" value={biz.addressLine2 || ''} onChange={(e) => updateBusiness('addressLine2', e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">City</label>
                  <input type="text" value={biz.city || ''} onChange={(e) => updateBusiness('city', e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
              <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">Postcode</label>
                  <input type="text" value={biz.postcode || ''} onChange={(e) => updateBusiness('postcode', e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-bold text-primary mb-1.5">Logo</label>
              <label className="flex items-center gap-4 cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-border flex items-center justify-center overflow-hidden shrink-0 border-2 border-dashed">
                  {biz.logo ? (
                    <img src={toImageUrl(biz.logo)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <i className="fa-solid fa-camera text-gray-500 text-2xl" />
                  )}
                </div>
                <span className="text-sm text-gray-500">Click to upload</span>
                <input type="file" accept=".jpg,.jpeg,.png,.webp,.svg" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-bold text-primary mb-1.5">Cover photo</label>
              <label className="block aspect-video max-w-md rounded-lg bg-border border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden">
                {biz.coverPhoto ? (
                  <img src={toImageUrl(biz.coverPhoto)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <i className="fa-solid fa-image text-gray-500 text-3xl" />
                )}
                <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleCoverUpload} />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-500">Currency:</span>
              <span>{biz.currency || 'GBP'}</span>
              <span className="text-sm text-gray-500 ml-4">Timezone:</span>
              <span>{biz.timezone || 'Europe/London'}</span>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-bold text-primary mb-1.5">Booking page URL</label>
              <p className="text-sm text-gray-500 mb-1">{getDomainConfig().baseUrl}/book/</p>
              <input value={biz.slug || ""}
                onChange={(e) => updateBusiness("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                placeholder="your-business"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white" />
            </div>
            <div className="mt-6">
              <button onClick={saveBusiness}
              className="bg-[#111111] text-white font-bold text-xs px-5 py-2 rounded-full shadow-lg shadow-[#111111]/20 hover:bg-[#1a1a1a] transition-colors">
              Save
            </button>
            </div>
          </div>
        )}

        {activeTab === 'hours' && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
            <h2 className="text-xl font-heading font-semibold mb-4">Opening Hours</h2>
            <div className="flex justify-end mb-4">
              <button onClick={copyToAllHours}
              className="bg-primary text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg hover:bg-primary-hover transition-colors">
              Copy to all
            </button>
            </div>
            <div className="space-y-3">
              {DAYS.map((d) => (
                <div key={d.key} className="flex flex-wrap items-center gap-4 py-2 border-b border-border/50 last:border-0">
                  <span className="w-24 font-medium">{d.label}</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!hours[d.key]?.open}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          openingHours: {
                            ...s.openingHours,
                            [d.key]: { ...s.openingHours[d.key], open: e.target.checked, start: '09:00', end: '17:00' },
                          },
                        }))
                      }
                    />
                    Open
                  </label>
                  {hours[d.key]?.open && (
                    <>
                      <select
                        value={hours[d.key]?.start || '09:00'}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            openingHours: {
                              ...s.openingHours,
                              [d.key]: { ...s.openingHours[d.key], start: e.target.value },
                            },
                          }))
                        }
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white w-24"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <span className="text-gray-500">–</span>
                      <select
                        value={hours[d.key]?.end || '17:00'}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            openingHours: {
                              ...s.openingHours,
                              [d.key]: { ...s.openingHours[d.key], end: e.target.value },
                            },
                          }))
                        }
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white w-24"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              ))}
            </div>
            <h3 className="text-lg font-semibold mt-8 mb-3">Special hours</h3>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">Date</label>
                  <input type="date" value={specialHoursForm.date} onChange={(e) => setSpecialHoursForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={specialHoursForm.open} onChange={(e) => setSpecialHoursForm((f) => ({ ...f, open: e.target.checked }))} />
                Open
              </label>
              {specialHoursForm.open && (
                <>
                  <select value={specialHoursForm.start} onChange={(e) => setSpecialHoursForm((f) => ({ ...f, start: e.target.value }))} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white w-24">
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select value={specialHoursForm.end} onChange={(e) => setSpecialHoursForm((f) => ({ ...f, end: e.target.value }))} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white w-24">
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </>
              )}
              <div>
                  <label className="block text-sm font-bold text-primary mb-1.5">Label</label>
                  <input type="text" value={specialHoursForm.label} onChange={(e) => setSpecialHoursForm((f) => ({ ...f, label: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
              <button onClick={addSpecialHours} disabled={!specialHoursForm.date || saving}
              className="bg-primary text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg hover:bg-primary-hover transition-colors">
              Add
            </button>
            </div>
            <ul className="mt-4 space-y-2">
              {(settings?.specialHours || []).map((sh) => (
                <li key={sh.id} className="flex justify-between items-center py-2 px-3 bg-border/30 rounded">
                  <span>{sh.date} {sh.label && `— ${sh.label}`} {sh.open ? `${sh.start}–${sh.end}` : 'Closed'}</span>
                  <button type="button" onClick={() => removeSpecialHours(sh.id)} className="text-red-500 text-sm hover:underline">Remove</button>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <button onClick={saveHours}
              className="bg-[#111111] text-white font-bold text-xs px-5 py-2 rounded-full shadow-lg shadow-[#111111]/20 hover:bg-[#1a1a1a] transition-colors">
              Save Hours
            </button>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
            <h2 className="text-xl font-heading font-semibold mb-4">Notification Preferences</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Event</th>
                    <th className="text-center py-2 font-medium">Email</th>
                    <th className="text-center py-2 font-medium">Push</th>
                    <th className="text-center py-2 font-medium">SMS</th>
                  </tr>
                </thead>
                <tbody>
                  {NOTIFICATION_EVENTS.filter((e) => e.key !== 'dailySummary').map((ev) => (
                    <tr key={ev.key} className="border-b border-border/50">
                      <td className="py-2">{ev.label}</td>
                      <td className="text-center">
                        <input type="checkbox" checked={!!notifications[ev.key]?.email} onChange={(e) => updateNotification(ev.key, 'email', e.target.checked)} />
                      </td>
                      <td className="text-center">
                        <input type="checkbox" checked={!!notifications[ev.key]?.push} onChange={(e) => updateNotification(ev.key, 'push', e.target.checked)} />
                      </td>
                      <td className="text-center">
                        <input type="checkbox" checked={!!notifications[ev.key]?.sms} onChange={(e) => updateNotification(ev.key, 'sms', e.target.checked)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!notifications.dailySummary?.enabled} onChange={(e) => updateNotification('dailySummary', 'enabled', e.target.checked)} />
                Daily summary email
              </label>
              {notifications.dailySummary?.enabled && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">at</span>
                  <select
                    value={notifications.dailySummary?.time || '07:00'}
                    onChange={(e) => updateNotification('dailySummary', 'time', e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white w-24"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="mt-6">
              <button onClick={saveNotifications}
              className="bg-[#111111] text-white font-bold text-xs px-5 py-2 rounded-full shadow-lg shadow-[#111111]/20 hover:bg-[#1a1a1a] transition-colors">
              Save Notifications
            </button>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
            <h2 className="text-xl font-heading font-semibold mb-4">Integrations</h2>
            <div className="space-y-4">
              {INTEGRATIONS.map((int) => {
                const locked = !isFeatureUnlocked(tier, int.tier)
                const connected = int.type === 'stripe' ? stripeConnected : integrations[int.type]?.connected
                return (
                  <div key={int.type} className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-border/20">
                    <div>
                      <h3 className="font-medium">{int.name}</h3>
                      <p className="text-sm text-gray-500">{int.desc}</p>
                      {locked && <span className="text-xs text-amber-600">({int.tier} tier)</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {connected ? (
                        <span className="text-green-600 text-sm font-medium">Connected ✓</span>
                      ) : null}
                      {int.type === 'stripe' ? (
                        connected ? (
                          <>
                            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="text-sm text-forest hover:underline">Open Stripe Dashboard</a>
                            <button onClick={disconnectStripe} disabled={saving || locked}
              className="bg-primary text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg hover:bg-primary-hover transition-colors">
              Disconnect
            </button>
                          </>
                        ) : (
                          <button onClick={connectStripe} disabled={saving || locked}
              className="bg-primary text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg hover:bg-primary-hover transition-colors">
              Connect with Stripe
            </button>
                        )
                      ) : (
                        <button disabled={locked}
              className="bg-primary text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg hover:bg-primary-hover transition-colors">
              {connected ? 'Disconnect' : 'Connect'}
            </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'subscription' && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
            <h2 className="text-xl font-heading font-semibold mb-4">Subscription</h2>
            <div className="p-4 rounded-lg bg-forest/5 border border-forest/20 mb-6">
              <h3 className="font-semibold text-lg">{subscription?.plan || 'Free'}</h3>
              <p className="text-gray-500">
                {subscription?.price != null ? `£${subscription.price}/month` : 'Custom pricing'}
              </p>
              <p className="text-sm text-gray-500 mt-2">Next billing: {subscription?.nextBillingDate || '—'}</p>
              <p className="text-sm text-gray-500">Payment method: {subscription?.paymentMethod || '—'}</p>
              <div className="flex gap-3 mt-3">
                <button
              className="bg-primary text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg hover:bg-primary-hover transition-colors">
              Update payment method
            </button>
                <button type="button" onClick={cancelSubscription} className="text-sm text-gray-500 hover:text-red-500">Cancel subscription</button>
              </div>
            </div>
            <h3 className="font-semibold mb-3">Plans</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PLANS.map((p) => (
                <div
                  key={p.tier}
                  className={`p-4 rounded-lg border ${
                    subscription?.tier === p.tier ? 'border-forest bg-forest/5' : 'border-border'
                  }`}
                >
                  <h4 className="font-medium">{p.name}</h4>
                  <p className="text-gray-500">{p.price != null ? `£${p.price}/mo` : 'Contact us'}</p>
                  {subscription?.tier !== p.tier && (
                    <button
                      className="bg-primary text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg hover:bg-primary-hover transition-colors mt-2"
                      onClick={() => changePlan(p.tier)}
                    >
                      {PLANS.findIndex((x) => x.tier === p.tier) > PLANS.findIndex((x) => x.tier === subscription?.tier) ? 'Upgrade' : 'Downgrade'}
            </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
            <h2 className="text-xl font-heading font-semibold mb-4">Team Permissions</h2>
            <p className="text-gray-500 text-sm mb-4">Quick summary. Use Staff page for full management.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Name</th>
                    <th className="text-left py-2 font-medium">Email</th>
                    <th className="text-left py-2 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.slice(0, 10).map((s) => (
                    <tr key={s.id || s._id} className="border-b border-border/50">
                      <td className="py-2">{s.name || s.displayName || '—'}</td>
                      <td>{s.email || '—'}</td>
                      <td>{s.role || 'Staff'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {staff.length === 0 && (
                <p className="py-4 text-gray-500 text-sm">No staff yet. Add staff on the Staff page.</p>
              )}
            </div>
            <div className="mt-4">
              <button
              onClick={() => navigate('/dashboard/staff')}
              className="bg-[#111111] text-white font-bold text-xs px-5 py-2 rounded-full shadow-lg shadow-[#111111]/20 hover:bg-[#1a1a1a] transition-colors">
              Manage Team
            </button>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6 mt-8 border-red-500/30 bg-red-500/5">
        <h2 className="text-lg font-extrabold text-red-500 mb-4">Danger Zone</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">Export all data</p>
              <p className="text-sm text-gray-500">Download a ZIP of clients, bookings, services</p>
            </div>
            <button onClick={exportData}
              className="bg-[#111111] text-white font-bold text-xs px-5 py-2 rounded-full shadow-lg shadow-[#111111]/20 hover:bg-[#1a1a1a] transition-colors">
              Export
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-red-500/20">
            <div>
              <p className="font-medium">Delete business</p>
              <p className="text-sm text-gray-500">Permanently remove your business. 30-day grace period.</p>
            </div>
            <button onClick={() => setDeleteModal(true)}
              className="px-4 py-2 border border-red-500 text-red-500 font-bold text-sm rounded-lg hover:bg-red-500/10 transition-colors">
              Delete business
            </button>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-red-500 mb-2">Delete business</h3>
            <p className="text-gray-500 text-sm mb-4">Type your business name to confirm: <strong>{business?.name}</strong></p>
            <div>
                  <label className="block text-sm font-bold text-primary mb-1.5"></label>
                  <input type="text" value={deleteConfirmName} onChange={(e) => setDeleteConfirmName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setDeleteModal(false)}
              className="bg-white border border-border text-primary font-bold text-sm px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm">
              Cancel
            </button>
              <button onClick={deleteBusiness}
              className="bg-red-500 text-white font-bold text-sm px-4 py-2 rounded-lg shadow-lg hover:bg-red-600 transition-colors">
              Delete
            </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Settings
