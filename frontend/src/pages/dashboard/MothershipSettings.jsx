import AppLoader from "../../components/shared/AppLoader"
import { useState, useEffect, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const MothershipSettings = () => {
  const { business, refetchBusiness } = useBusiness()  const [enabled, setEnabled] = useState(false)
  const [settings, setSettings] = useState({
    commission_type: 'percentage', default_rate: 30, chair_rental: 200,
    settlement_frequency: 'instant', shared_booking: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const bid = business?.id ?? business?._id

  const fetchSettings = useCallback(async () => {
    if (!bid) { setLoading(false); return }
    try {
      const res = await api.get(`/mothership/business/${bid}/settings`)
      setEnabled(res.mothership_mode || false)
      if (res.settings) setSettings(prev => ({ ...prev, ...res.settings }))
    } catch { /* not enabled */ }
    finally { setLoading(false) }
  }, [bid])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const toggleMode = async () => {
    try {
      if (!enabled) {
        await api.post(`/mothership/business/${bid}/enable`, settings)
        setEnabled(true)
        if (refetchBusiness) await refetchBusiness()
        setToast('Self-Employed Mode enabled')
      } else {
        if (!confirm('Disable Self-Employed Mode? All operators will be paused.')) return
        await api.post(`/mothership/business/${bid}/disable`)
        setEnabled(false)
        if (refetchBusiness) await refetchBusiness()
        setToast('Self-Employed Mode disabled')
      }
    } catch (e) { setToast(e.message || 'Failed') }
    setTimeout(() => setToast(null), 4000)
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await api.post(`/mothership/business/${bid}/enable`, {
        commission_type: settings.commission_type,
        default_rate: settings.default_rate,
        chair_rental: settings.chair_rental,
        settlement_frequency: settings.settlement_frequency,
        shared_booking: settings.shared_booking,
      })
      setToast('Settings saved')
    } catch (e) { setToast(e.message || 'Failed') }
    finally { setSaving(false); setTimeout(() => setToast(null), 4000) }
  }

  if (loading) return <AppLoader message="Loading settings..." />

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]" style={{ fontFamily: "'Figtree',sans-serif" }}>
      <div className="px-6 md:px-8 pt-6 pb-4 shrink-0">
        <h1 className="text-2xl font-heading font-extrabold text-primary">Mothership Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure self-employed operator mode for your business.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-8 space-y-6">
        {/* Master toggle */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-primary">Self-Employed Mode</div>
              <div className="text-sm text-gray-400 mt-0.5">Operators manage their own clients privately. You track revenue, bookings, and performance.</div>
            </div>
            <button onClick={toggleMode}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`inline-block h-5.5 w-5.5 transform rounded-full bg-white transition-transform shadow ${enabled ? 'translate-x-5.5' : 'translate-x-0.5'}`}
                style={{ width: 22, height: 22, transform: enabled ? 'translateX(22px)' : 'translateX(2px)' }} />
            </button>
          </div>
        </div>

        {enabled && (
          <>
            {/* Commission */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6 space-y-4">
              <h2 className="text-lg font-bold text-primary">Commission Structure</h2>
              <p className="text-sm text-gray-400">How you earn from operators. Can be overridden per operator in the Team page.</p>

              <div className="flex gap-3">
                {['percentage', 'fixed'].map(t => (
                  <button key={t} onClick={() => setSettings(s => ({ ...s, commission_type: t }))}
                    className={`flex-1 py-3.5 rounded-xl text-sm font-bold border transition-all ${
                      settings.commission_type === t ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-200 hover:border-primary/30'
                    }`}>
                    {t === 'percentage' ? 'Percentage of Revenue' : 'Fixed Chair Rental'}
                  </button>
                ))}
              </div>

              {settings.commission_type === 'percentage' ? (
                <div>
                  <label className="block text-sm font-bold text-primary mb-2">Default Commission Rate</label>
                  <div className="flex flex-wrap gap-2">
                    {[10, 15, 20, 25, 30, 35, 40, 50].map(r => (
                      <button key={r} onClick={() => setSettings(s => ({ ...s, default_rate: r }))}
                        className={`px-5 py-2.5 rounded-full text-sm font-bold border transition-all ${
                          settings.default_rate === r ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-200 hover:border-primary/30'
                        }`}>{r}%</button>
                    ))}
                  </div>
                  <div className="mt-3 p-4 bg-[#FFFDF6] border border-[#C9A84C]/15 rounded-xl">
                    <div className="text-sm font-bold text-primary mb-1">How it works</div>
                    <div className="text-xs text-gray-500">Operator takes a £100 payment → You receive <span className="font-bold text-[#C9A84C]">£{settings.default_rate}</span> → They receive <span className="font-bold text-primary">£{100 - settings.default_rate}</span></div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-bold text-primary mb-2">Weekly Chair Rental</label>
                  <div className="relative max-w-[220px]">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">£</span>
                    <input type="number" value={settings.chair_rental || ''} onChange={e => setSettings(s => ({ ...s, chair_rental: Number(e.target.value) }))}
                      className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-sm font-bold text-primary outline-none focus:border-primary transition-all" placeholder="200" />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Fixed weekly charge regardless of how many bookings the operator takes.</p>
                </div>
              )}
            </div>

            {/* Settlement */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6 space-y-4">
              <h2 className="text-lg font-bold text-primary">Payment Settlement</h2>
              <p className="text-sm text-gray-400">How operators receive their cut after a client pays.</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'instant', label: 'Instant', icon: '⚡', desc: 'Stripe splits payment automatically. No action needed from you.' },
                  { id: 'weekly', label: 'Weekly', icon: '📅', desc: 'Review revenue each week and pay operators manually.' },
                  { id: 'monthly', label: 'Monthly', icon: '📆', desc: 'Monthly settlement reports. Operators paid once per month.' },
                ].map(f => (
                  <button key={f.id} onClick={() => setSettings(s => ({ ...s, settlement_frequency: f.id }))}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      settings.settlement_frequency === f.id ? 'border-primary bg-primary/5 shadow-md' : 'border-gray-200 hover:border-primary/30'
                    }`}>
                    <div className="text-sm font-bold text-primary mb-1">{f.label}</div>
                    <div className="text-xs text-gray-400 leading-relaxed">{f.desc}</div>
                  </button>
                ))}
              </div>

              {settings.settlement_frequency === 'instant' && (
                <div className="flex gap-2 p-3 bg-[#FFFDF6] border border-[#C9A84C]/20 rounded-xl text-xs text-[#C9A84C]">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  Each operator must connect their own Stripe account. Funds are split at payment time — you never touch their money.
                </div>
              )}
            </div>

            {/* Shared booking */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-primary">Shared Booking Page</div>
                  <div className="text-sm text-gray-400 mt-0.5">Clients see all available operators on one booking page. They choose who to book with.</div>
                </div>
                <button onClick={() => setSettings(s => ({ ...s, shared_booking: !s.shared_booking }))}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${settings.shared_booking ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className="inline-block rounded-full bg-white shadow" style={{ width: 22, height: 22, transform: settings.shared_booking ? 'translateX(22px)' : 'translateX(2px)', transition: 'transform 200ms' }} />
                </button>
              </div>
            </div>

            {/* Danger zone */}
            <div className="bg-white border border-red-100 rounded-xl p-6">
              <h2 className="text-lg font-bold text-red-600 mb-2">Danger Zone</h2>
              <p className="text-sm text-gray-400 mb-4">Disabling Self-Employed Mode will pause all operators. Their data is preserved but they lose portal access.</p>
              <button onClick={toggleMode} className="px-5 py-2.5 rounded-lg border-2 border-red-200 text-sm font-bold text-red-600 hover:bg-red-50 transition-all">
                Disable Self-Employed Mode
              </button>
            </div>

            {/* Save */}
            <div className="flex justify-end">
              <button onClick={saveSettings} disabled={saving}
                className="px-8 py-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover shadow-md disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-primary text-white rounded-xl shadow-xl text-sm font-semibold">{toast}</div>
      )}
    </div>
  )
}

export default MothershipSettings
