/**
 * Step 1 — Pick a service
 * Mobile-first, contained CTA, Lucide icons
 */

import { useState } from 'react'
import { Check, Clock, ChevronRight } from 'lucide-react'
import BookingHeader from '../../components/BookingHeader'
import StepIndicator from '../../components/StepIndicator'
import StickyFooter from '../../components/StickyFooter'

const PickService = ({ data, onContinue }) => {
  const [selectedId, setSelectedId] = useState(null)
  const [category, setCategory] = useState('All')

  const { business, services = [], categories = [] } = data
  const filtered = category === 'All'
    ? services
    : services.filter((s) => s.category === category)

  return (
    <div className="px-4 pt-3 overflow-hidden">
      <BookingHeader business={business} />
      <StepIndicator step={1} total={3} />

      <h2 className="text-sm font-semibold text-[#111111] mb-3">Choose a service</h2>

      {/* Category pills — horizontal scroll */}
      <div className="flex gap-2 flex-wrap mb-4">
        {(categories || ['All']).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-2.5 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              category === cat
                ? 'bg-[#111111] text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-[#111111]/30'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Service cards */}
      <div className="space-y-2.5 pb-6">
        {filtered.map((svc) => {
          const selected = selectedId === svc.id
          const price = svc.price > 0 ? `£${(svc.price / 100).toFixed(2)}` : 'Free'
          return (
            <button
              key={svc.id}
              onClick={() => setSelectedId(svc.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selected
                  ? 'border-[#111111] bg-[#111111]/[0.03] ring-1 ring-[#111111]/20'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-[13px] ${selected ? 'text-[#111111]' : 'text-gray-900'}`}>
                    {svc.name}
                  </p>
                  {svc.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{svc.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{svc.duration} min</span>
                    <span className="text-gray-300">·</span>
                    <span className="font-medium text-gray-700">{price}</span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                  selected ? 'border-[#111111] bg-[#111111]' : 'border-gray-300'
                }`}>
                  {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Contained CTA */}
      <StickyFooter>
        <button
          onClick={() => selectedId && onContinue({ serviceId: selectedId })}
          disabled={!selectedId}
          className={`w-full py-3 rounded-xl font-medium text-[13px] transition-all flex items-center justify-center gap-2 ${
            selectedId
              ? 'bg-[#111111] text-white hover:bg-[#0a0a0a] shadow-sm'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Continue
          {selectedId && <ChevronRight className="w-4 h-4" />}
        </button>
      </StickyFooter>
    </div>
  )
}

export default PickService
