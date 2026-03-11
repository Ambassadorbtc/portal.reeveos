/**
 * Step 1.5 — Enhance your treatment (add-ons)
 * Shown after service selection if the service has add-ons
 */

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, ChevronRight } from 'lucide-react'
import BookingHeader from '../../components/BookingHeader'
import StepIndicator from '../../components/StepIndicator'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const EnhanceTreatment = ({ data, onContinue, onBack }) => {
  const { business, service, serviceId } = data
  const bid = business?.id || business?._id
  const sid = serviceId || service?.id

  const [addOns, setAddOns] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState([])
  const [pricing, setPricing] = useState(null)
  const [pricingLoading, setPricingLoading] = useState(false)

  const basePrice = service?.price || 0
  const basePriceDisplay = basePrice > 0 ? (basePrice / 100).toFixed(2) : '0.00'

  // Fetch add-ons for this service
  useEffect(() => {
    if (!bid || !sid) { setLoading(false); return }
    fetch(`${API_BASE}/addons/business/${bid}/service/${sid}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(res => {
        setAddOns(res.add_ons || [])
      })
      .catch(() => setAddOns([]))
      .finally(() => setLoading(false))
  }, [bid, sid])

  // Calculate pricing when selection changes
  const calculatePricing = useCallback(async (ids) => {
    if (!bid || ids.length === 0) {
      setPricing(null)
      return
    }
    setPricingLoading(true)
    try {
      const r = await fetch(`${API_BASE}/addons/business/${bid}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: sid, selected_addon_ids: ids }),
      })
      if (r.ok) {
        const result = await r.json()
        setPricing(result)
      }
    } catch {
      // Fallback: sum individual prices
      const sum = addOns.filter(a => ids.includes(a.id)).reduce((t, a) => t + (parseFloat(a.price) || 0), 0)
      setPricing({ addon_total: sum, tier_price: null, savings: 0, total: (basePrice / 100) + sum })
    }
    setPricingLoading(false)
  }, [bid, sid, addOns, basePrice])

  useEffect(() => {
    if (selectedIds.length > 0) {
      calculatePricing(selectedIds)
    } else {
      setPricing(null)
    }
  }, [selectedIds, calculatePricing])

  const toggleAddon = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleContinue = () => {
    onContinue({
      selectedAddonIds: selectedIds,
      addonPricing: pricing,
    })
  }

  const handleSkip = () => {
    onContinue({
      selectedAddonIds: [],
      addonPricing: null,
    })
  }

  if (loading) {
    return (
      <div className="px-4 pt-3">
        <BookingHeader business={business} />
        <StepIndicator step={2} total={4} />
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  // If no add-ons, auto-skip
  if (addOns.length === 0) {
    // Use effect-like auto-skip via immediate continue
    handleSkip()
    return null
  }

  const addonTotal = pricing?.addon_total ?? 0
  const tierPrice = pricing?.tier_price ?? null
  const savings = pricing?.savings ?? 0
  const displayTotal = pricing?.total ?? parseFloat(basePriceDisplay)

  return (
    <div className="px-4 pt-3 pb-28 overflow-hidden" style={{ fontFamily: "'Figtree', sans-serif" }}>
      <BookingHeader business={business} />
      <StepIndicator step={2} total={4} />

      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={16} className="text-[#C9A84C]" />
        <h2 className="text-sm font-semibold text-[#111111]">Enhance your treatment</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4">Add extras to your {service?.name || 'treatment'}</p>

      {/* Add-on toggle chips */}
      <div className="space-y-2.5 mb-6">
        {addOns.map((addon) => {
          const isActive = selectedIds.includes(addon.id)
          const price = parseFloat(addon.price) || 0
          return (
            <button
              key={addon.id}
              onClick={() => toggleAddon(addon.id)}
              className={`w-full text-left p-3.5 rounded-xl transition-all ${
                isActive
                  ? 'border-2 border-[#111111] bg-gray-50'
                  : 'border-2 border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-[13px] ${isActive ? 'text-[#111111]' : 'text-gray-900'}`}>
                    {addon.name}
                  </p>
                  {addon.duration > 0 && (
                    <p className="text-[11px] text-gray-400 mt-0.5">+{addon.duration} mins</p>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold text-[#111111]">{'\u00A3'}{price.toFixed(2)}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isActive ? 'border-[#111111] bg-[#111111]' : 'border-gray-300'
                  }`}>
                    {isActive && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Skip link */}
      <div className="text-center mb-4">
        <button onClick={handleSkip} className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors underline underline-offset-2">
          Skip add-ons
        </button>
      </div>

      {/* Sticky bottom bar with running total */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <div className="w-full sm:max-w-[400px] pointer-events-auto">
          <div className="bg-white border-t-2 border-[#C9A84C] px-4 pt-3 pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
            {/* Price breakdown */}
            {selectedIds.length > 0 && (
              <div className="mb-3 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{service?.name || 'Service'}</span>
                  <span>{'\u00A3'}{basePriceDisplay}</span>
                </div>
                {tierPrice !== null ? (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{selectedIds.length} add-on{selectedIds.length > 1 ? 's' : ''} (tier price)</span>
                    <span>{'\u00A3'}{Number(tierPrice).toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{selectedIds.length} add-on{selectedIds.length > 1 ? 's' : ''}</span>
                    <span>{'\u00A3'}{Number(addonTotal).toFixed(2)}</span>
                  </div>
                )}
                {savings > 0 && (
                  <div className="flex justify-between text-xs font-semibold text-[#C9A84C]">
                    <span>You save</span>
                    <span>-{'\u00A3'}{Number(savings).toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-1 flex justify-between text-sm font-bold text-[#111111]">
                  <span>Total</span>
                  <span>{pricingLoading ? '...' : `\u00A3${Number(displayTotal).toFixed(2)}`}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleContinue}
              className="w-full py-3 rounded-xl font-medium text-[13px] transition-all flex items-center justify-center gap-2 bg-[#111111] text-white hover:bg-[#0a0a0a] shadow-sm"
            >
              {selectedIds.length > 0 ? 'Continue with add-ons' : 'Continue'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnhanceTreatment
