import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Run 6: Online Booking Editor — split-screen, live preview
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Image, Lock, Phone, Mail, MessageCircle, X, Store } from 'lucide-react'
import ImageCropModal from '../../components/shared/ImageCropModal'
import { useBusiness } from '../../contexts/BusinessContext'
import api, { API_BASE_URL } from '../../utils/api'
import { getDomainConfig } from '../../utils/domain'
import { isFeatureUnlocked } from '../../config/tiers'
import { TIERS } from '../../config/tiers'
import UpgradeModal from '../../components/layout/UpgradeModal'

const ADVANCE_OPTS = [7, 14, 30, 60, 90]
const INTERVAL_OPTS = [15, 30, 45, 60]
const BUFFER_OPTS = [0, 5, 10, 15, 30]
const CANCELLATION_OPTS = [0, 2, 6, 12, 24, 48]

const OnlineBooking = () => {
  const { business, tier } = useBusiness()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [toast, setToast] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [cropModal, setCropModal] = useState({ open: false, src: null, type: null })
  const [previewMode, setPreviewMode] = useState('mobile')
  const [embedModal, setEmbedModal] = useState(false)
  const [upgradeModal, setUpgradeModal] = useState(null)
  const saveTimeout = useRef(null)
  const draftRef = useRef(draft)

  const imageBase = API_BASE_URL
  const slug = business?.slug || data?.share?.slug || 'your-business'
  const { baseUrl } = getDomainConfig()
  const bookingUrl = `${baseUrl}/book/${slug}`

  const hasDeposits = isFeatureUnlocked(tier, 'growth')
  const hasIntegrations = isFeatureUnlocked(tier, 'scale')

  const fetchData = useCallback(async () => {
    if (!business?.id) return
    try {
      const [pageRes, svcRes] = await Promise.all([
        api.get(`/booking-page/${business.id}`),
        api.get(`/services-v2/business/${business.id}`).catch(() => ({ categories: [] })),
      ])
      setData(pageRes)
      setDraft({
        branding: { ...pageRes.branding },
        settings: { ...pageRes.settings },
        integrations: { ...pageRes.integrations },
      })
      const flat = (svcRes.categories || []).flatMap((c) => c.services || [])
      setServices(flat)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [business?.id])

  useEffect(() => { fetchData() }, [fetchData])

  const isDirty = draft && data && JSON.stringify(draft) !== JSON.stringify({ branding: data.branding, settings: data.settings, integrations: data.integrations })
  useEffect(() => {
    const handler = (e) => { if (isDirty) e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  draftRef.current = draft

  const updateDraft = (section, key, value) => {
    setDraft((d) => ({
      ...d,
      [section]: { ...d[section], [key]: value },
    }))
  }

  const debouncedSave = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      const d = draftRef.current
      if (!business?.id || !d) return
      setSaving(true)
      try {
        await api.put(`/booking-page/${business.id}`, d)
        setData((prev) => ({ ...prev, ...d }))
        setSavedAt(Date.now())
        setToast('Saved ✓')
        setTimeout(() => setToast(null), 2000)
      } catch (err) {
        setToast(err.message || 'Save failed')
      } finally {
        setSaving(false)
      }
    }, 1000)
  }, [business?.id])

  const handleBlur = () => debouncedSave()

  const handleSave = async () => {
    if (!business?.id || !draft) return
    setSaving(true)
    try {
      await api.put(`/booking-page/${business.id}`, draft)
      setData((prev) => ({ ...prev, ...draft }))
      setSavedAt(Date.now())
      setToast('Saved ✓')
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      setToast(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e?.target?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropModal({ open: true, src: reader.result, type: 'logo' })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCoverUpload = async (e) => {
    const file = e?.target?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropModal({ open: true, src: reader.result, type: 'cover' })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCropSave = async (blob) => {
    if (!business?.id) return
    const file = new File([blob], `${cropModal.type}.jpg`, { type: 'image/jpeg' })
    try {
      if (cropModal.type === 'logo') {
        const res = await api.upload(`/booking-page/${business.id}/logo`, file)
        updateDraft('branding', 'logo', res.url)
      } else {
        const res = await api.upload(`/booking-page/${business.id}/cover`, file)
        updateDraft('branding', 'coverPhoto', res.url)
      }
      setCropModal({ open: false, src: null, type: null })
    } catch (err) {
      setToast(err.message || 'Upload failed')
    }
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(bookingUrl)
    setToast('Copied!')
    setTimeout(() => setToast(null), 1500)
  }

  const handleCopyEmbed = (code) => {
    navigator.clipboard.writeText(code)
    setToast('Copied!')
    setTimeout(() => setToast(null), 1500)
  }

  const handleDownloadQr = async () => {
    try {
      const token = localStorage.getItem('token')
      const r = await fetch(`${API_BASE_URL}/booking-page/${business.id}/qr`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `booking-qr-${slug}.png`
      a.click()
    } catch (err) {
      setToast(err.message || 'Download failed')
    }
  }

  const b = draft?.branding || {}
  const s = draft?.settings || {}

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RezvoLoader message="Loading..." />
      </div>
    )
  }

  const toImageUrl = (path) => (path?.startsWith('/') ? `${imageBase}${path}` : path)
  const previewBusiness = {
    name: business?.name || 'Your Business',
    logo: toImageUrl(b.logo),
    coverPhoto: toImageUrl(b.coverPhoto),
    description: b.description,
    accentColour: b.accentColour || '#1B4332',
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-0">
      {/* Editor */}
      <div className="lg:w-1/2 space-y-6 overflow-y-auto pr-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-heading font-bold">Online Booking</h1>
          <div className="flex items-center gap-2">
            {toast && <span className="text-sm text-gray-500">{toast}</span>}
            <button onClick={handleSave} disabled={saving}
              className="bg-primary text-white font-bold text-sm px-4 py-2 rounded-lg shadow-lg hover:bg-primary-hover transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white border border-border rounded-xl shadow-sm p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Branding</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold text-primary mb-2">Logo</p>
              <label
                className="flex items-center gap-4 cursor-pointer"
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-primary/30') }}
                onDragLeave={e => e.currentTarget.classList.remove('ring-2', 'ring-primary/30')}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('ring-2', 'ring-primary/30'); const file = e.dataTransfer?.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => setCropModal({ open: true, src: reader.result, type: 'logo' }); reader.readAsDataURL(file) } }}
              >
                <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-dashed border-primary/30 flex items-center justify-center overflow-hidden shrink-0">
                  {b.logo ? (
                    <img src={toImageUrl(b.logo)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-primary/50" />
                  )}
                </div>
                <span className="text-sm text-gray-500">Click or drag to upload</span>
                <input type="file" accept=".jpg,.jpeg,.png,.webp,.svg" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
            <div>
              <p className="text-sm font-bold text-primary mb-2">Cover Photo</p>
              <label
                className="block aspect-video rounded-lg bg-primary/10 border-2 border-dashed border-primary/30 flex items-center justify-center cursor-pointer overflow-hidden"
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-primary/30') }}
                onDragLeave={e => e.currentTarget.classList.remove('ring-2', 'ring-primary/30')}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('ring-2', 'ring-primary/30'); const file = e.dataTransfer?.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => setCropModal({ open: true, src: reader.result, type: 'cover' }); reader.readAsDataURL(file) } }}
              >
                {b.coverPhoto ? (
                  <img src={toImageUrl(b.coverPhoto)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Image className="w-8 h-8 text-primary/50" />
                )}
                <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleCoverUpload} />
              </label>
            </div>
            <div>
              <label className="block text-sm font-bold text-primary mb-2">Description</label>
              <textarea
                value={b.description || ''}
                onChange={(e) => updateDraft('branding', 'description', e.target.value.slice(0, 500))}
                onBlur={handleBlur}
                rows={3}
                placeholder="Tell customers about your business..."
                className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white appearance-none cursor-pointer"
              />
            </div>
            <p className="text-xs text-muted">{(b.description || '').length}/500</p>
            <div>
              <label className="block text-sm font-bold text-primary mb-2">Accent Colour</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={b.accentColour || '#1B4332'}
                  onChange={(e) => updateDraft('branding', 'accentColour', e.target.value)}
                  onBlur={handleBlur}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={b.accentColour || '#1B4332'}
                  onChange={(e) => updateDraft('branding', 'accentColour', e.target.value)}
                  onBlur={handleBlur}
                  className="flex-1 max-w-[120px] px-3 py-2.5 border border-border rounded-lg text-sm font-mono text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Booking Settings */}
        <div className="bg-white border border-border rounded-xl shadow-sm p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Booking Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-primary mb-1">Advance booking window</label>
              <select
                className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white appearance-none cursor-pointer"
                value={s.advanceBookingDays ?? 60}
                onChange={(e) => { updateDraft('settings', 'advanceBookingDays', +e.target.value); handleBlur() }}
              >
                {ADVANCE_OPTS.map((n) => (
                  <option key={n} value={n}>{n} days</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-primary mb-1">Booking intervals</label>
              <select
                className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white appearance-none cursor-pointer"
                value={s.bookingIntervalMinutes ?? 30}
                onChange={(e) => { updateDraft('settings', 'bookingIntervalMinutes', +e.target.value); handleBlur() }}
              >
                {INTERVAL_OPTS.map((n) => (
                  <option key={n} value={n}>{n} min</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={s.autoConfirm !== false}
                onChange={(e) => { updateDraft('settings', 'autoConfirm', e.target.checked); handleBlur() }}
              />
              <span className="text-sm">Auto-confirm bookings</span>
            </label>
            <div>
              <label className="block text-sm font-bold text-primary mb-1">Buffer between bookings</label>
              <select
                className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white appearance-none cursor-pointer"
                value={s.bufferMinutes ?? 15}
                onChange={(e) => { updateDraft('settings', 'bufferMinutes', +e.target.value); handleBlur() }}
              >
                {BUFFER_OPTS.map((n) => (
                  <option key={n} value={n}>{n === 0 ? 'None' : `${n} min`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-primary mb-1">Cancellation notice</label>
              <select
                className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white appearance-none cursor-pointer"
                value={s.cancellationNoticeHours ?? 24}
                onChange={(e) => { updateDraft('settings', 'cancellationNoticeHours', +e.target.value); handleBlur() }}
              >
                {CANCELLATION_OPTS.map((n) => (
                  <option key={n} value={n}>{n === 0 ? 'None' : `${n} hours`}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Deposits - Growth+ */}
        <div className="bg-white border border-border rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-lg">Deposits</h2>
            {!hasDeposits && (
              <button
                type="button"
                onClick={() => setUpgradeModal('growth')}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Lock className="w-3 h-3" /> Upgrade
              </button>
            )}
          </div>
          {hasDeposits ? (
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.depositEnabled === true}
                  onChange={(e) => { updateDraft('settings', 'depositEnabled', e.target.checked); handleBlur() }}
                />
                <span className="text-sm">Enable deposits</span>
              </label>
              {s.depositEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-primary mb-1">Amount (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-sm font-medium text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white appearance-none cursor-pointer"
                      value={(s.depositAmount || 0) / 100}
                      onChange={(e) => updateDraft('settings', 'depositAmount', Math.round(parseFloat(e.target.value || 0) * 100))}
                      onBlur={handleBlur}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Deposits available on Growth plan.</p>
          )}
        </div>

        {/* Share */}
        <div className="bg-white border border-border rounded-xl shadow-sm p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Share Your Booking Page</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-primary mb-1">Booking URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={bookingUrl}
                  className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                />
                <button onClick={handleCopyUrl} className="px-3 py-2 bg-white border border-border rounded-lg text-sm font-bold text-primary hover:bg-gray-50 shadow-sm">Copy</button>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-primary mb-2">QR Code</p>
              <div className="flex flex-col items-start gap-2">
                <QrPreview businessId={business?.id} />
                <button type="button" onClick={handleDownloadQr} className="text-sm text-primary hover:underline">
                  Download QR
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <a
                href={`https://wa.me/?text=${encodeURIComponent('Book with us: ' + bookingUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-[#25D366] text-white text-sm hover:opacity-90"
              >
                <span className="mr-2">💬</span> WhatsApp
              </a>
              <a
                href={`mailto:?subject=Book with us&body=${encodeURIComponent(bookingUrl)}`}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-90"
              >
                <Mail className="w-4 h-4 mr-2" /> Email
              </a>
              <a
                href={`sms:?body=${encodeURIComponent(bookingUrl)}`}
                className="px-4 py-2 rounded-lg bg-gray-600 text-white text-sm hover:opacity-90"
              >
                <MessageCircle className="w-4 h-4 mr-2" /> SMS
              </a>
              <button
                type="button"
                onClick={() => { handleCopyUrl(); setToast('Link copied!') }}
                className="px-4 py-2 rounded-lg bg-[#E4405F] text-white text-sm hover:opacity-90"
              >
                <span className="mr-2">📸</span> Instagram
              </button>
              <button
                type="button"
                onClick={() => { handleCopyUrl(); setToast('Link copied!') }}
                className="px-4 py-2 rounded-lg bg-[#1877F2] text-white text-sm hover:opacity-90"
              >
                <span className="mr-2">👤</span> Facebook
              </button>
            </div>
          </div>
        </div>

        {/* Integrations - Scale */}
        <div className="bg-white border border-border rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-lg">Integrations</h2>
            {!hasIntegrations && (
              <button
                type="button"
                onClick={() => setUpgradeModal('scale')}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Lock className="w-3 h-3" /> Upgrade
              </button>
            )}
          </div>
          {hasIntegrations ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Google Reserve</span>
                <span className="text-xs text-muted">Not connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Instagram</span>
                <span className="text-xs text-muted">Not connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Facebook</span>
                <span className="text-xs text-muted">Not connected</span>
              </div>
              <button onClick={() => setEmbedModal(true)} className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-bold text-primary hover:bg-gray-50 shadow-sm">
                Get Embed Code
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Integrations available on Scale plan.</p>
          )}
        </div>
      </div>

      {/* Preview - desktop */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center sticky top-6 self-start">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setPreviewMode('mobile')}
            className={`px-3 py-1.5 rounded text-sm ${previewMode === 'mobile' ? 'bg-primary text-white' : 'bg-border text-muted'}`}
          >
            Mobile
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('desktop')}
            className={`px-3 py-1.5 rounded text-sm ${previewMode === 'desktop' ? 'bg-primary text-white' : 'bg-border text-muted'}`}
          >
            Desktop
          </button>
        </div>
        <p className="text-xs text-muted mb-2">Preview updates as you edit</p>
        <div
          className={`rounded-2xl border-2 border-border overflow-hidden bg-white shadow-lg ${
            previewMode === 'mobile' ? 'w-[375px]' : 'w-full max-w-full'
          }`}
        >
          <BookingPreview business={previewBusiness} services={services} accentColour={previewBusiness.accentColour} />
        </div>
      </div>

      {/* Mobile: floating preview button */}
      <button
        type="button"
        onClick={() => setShowPreview(true)}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center z-40"
      >
        <Phone className="w-5 h-5" />
      </button>

      {showPreview && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex justify-between items-center p-4 border-b">
            <span className="font-semibold">Preview</span>
            <button onClick={() => setShowPreview(false)} className="p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="w-[375px] mx-auto rounded-2xl border-2 border-border overflow-hidden">
              <BookingPreview business={previewBusiness} services={services} accentColour={previewBusiness.accentColour} />
            </div>
          </div>
        </div>
      )}

      {embedModal && (
        <EmbedModal
          businessId={business?.id}
          accentColour={b.accentColour}
          onClose={() => setEmbedModal(false)}
          onCopy={handleCopyEmbed}
        />
      )}

      {upgradeModal && (
        <UpgradeModal
          tierName={TIERS[upgradeModal]?.label || upgradeModal}
          onClose={() => setUpgradeModal(null)}
          onViewPlans={() => setUpgradeModal(null)}
        />
      )}

      {/* Image Crop Modal */}
      <ImageCropModal
        isOpen={cropModal.open}
        onClose={() => setCropModal({ open: false, src: null, type: null })}
        onSave={handleCropSave}
        imageSrc={cropModal.src}
        aspect={cropModal.type === 'logo' ? 1 : 16 / 9}
        cropShape={cropModal.type === 'logo' ? 'round' : 'rect'}
        title={cropModal.type === 'logo' ? 'Adjust Logo' : 'Adjust Cover Photo'}
      />
    </div>
  )
}

const QrPreview = ({ businessId }) => {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    if (!businessId) return
    const token = localStorage.getItem('token')
    fetch(`${API_BASE_URL}/booking-page/${businessId}/qr`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.blob())
      .then((blob) => setSrc(URL.createObjectURL(blob)))
      .catch(() => {})
  }, [businessId])
  return (
    <div className="w-[120px] h-[120px] rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
      {src ? <img src={src} alt="QR" className="w-full h-full object-contain" /> : <div className="animate-pulse w-16 h-16 bg-gray-300 rounded" />}
    </div>
  )
}

const EmbedModal = ({ businessId, accentColour, onClose, onCopy }) => {
  const [embed, setEmbed] = useState(null)
  useEffect(() => {
    if (!businessId) return
    api.get(`/booking-page/${businessId}/embed`).then(setEmbed)
  }, [businessId])
  const { baseUrl: base } = getDomainConfig()
  const iframeCode = embed?.embedCode || `<iframe src="${base}/book/your-business" width="100%" height="600" frameborder="0"></iframe>`
  const buttonCode = embed?.buttonCode || `<a href="${base}/book/your-business" style="background:${accentColour};color:#FEFBF4;padding:12px 24px;border-radius:10px;">Book Now</a>`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading font-bold text-lg mb-4">Embed Code</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-primary mb-1">Iframe</label>
            <div className="flex gap-2">
              <textarea readOnly value={iframeCode} className="flex-1 px-3 py-2.5 border border-border rounded-lg text-xs font-mono text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white h-20" />
              <button onClick={() => onCopy(iframeCode)} className="px-3 py-1.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-hover">Copy</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-primary mb-1">Button</label>
            <div className="flex gap-2">
              <textarea readOnly value={buttonCode} className="flex-1 px-3 py-2.5 border border-border rounded-lg text-xs font-mono text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white h-20" />
              <button onClick={() => onCopy(buttonCode)} className="px-3 py-1.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-hover">Copy</button>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="mt-4 w-full px-4 py-2 bg-white border border-border rounded-lg text-sm font-bold text-primary hover:bg-gray-50">Close</button>
      </div>
    </div>
  )
}

const BookingPreview = ({ business, services, accentColour }) => {
  return (
    <div className="min-h-[400px]" style={{ '--accent': accentColour || '#1B4332' }}>
      {business.coverPhoto ? (
        <div className="h-24 bg-cover bg-center" style={{ backgroundImage: `url(${business.coverPhoto})` }} />
      ) : (
        <div className="h-24 bg-primary/20" />
      )}
      <div className="p-4 -mt-8 relative flex items-end gap-3">
        {business.logo ? (
          <img src={business.logo} alt="" className="w-14 h-14 rounded-xl border-2 border-white shadow object-cover bg-white shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-xl border-2 border-white shadow bg-primary flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0 pb-1">
          <h2 className="font-heading font-bold text-lg truncate" style={{ color: accentColour }}>{business.name}</h2>
          {business.description && <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{business.description}</p>}
        </div>
      </div>
      <div className="p-4 pt-2 space-y-2">
        {services.slice(0, 4).map((svc) => (
          <div key={svc.id} className="p-3 rounded-xl border border-border flex justify-between items-center">
            <span className="font-medium text-sm">{svc.name}</span>
            <span className="text-xs text-muted">{svc.duration} min · £{((svc.price || 0) / 100).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default OnlineBooking
