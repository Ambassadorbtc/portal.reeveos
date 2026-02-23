/**
 * Run 2: Step 1 — Pick a service (Services flow)
 */

import { useState } from 'react'
import BookingHeader from '../../components/BookingHeader'
import StepIndicator from '../../components/StepIndicator'

const PickService = ({ data, onContinue }) => {
  const [selectedId, setSelectedId] = useState(null)
  const [category, setCategory] = useState('All')

  const { business, services = [], categories = [] } = data
  const filtered = category === 'All'
    ? services
    : services.filter((s) => s.category === category)

  return (
    <div className="max-w-lg mx-auto">
      <BookingHeader business={business} />
      <StepIndicator step={1} total={3} />

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
        {(categories || ['All']).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              category === cat
                ? 'bg-primary text-white'
                : 'bg-border text-muted hover:bg-border/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Service cards */}
      <div className="space-y-2 mb-24">
        {filtered.map((svc) => {
          const selected = selectedId === svc.id
          return (
            <button
              key={svc.id}
              onClick={() => setSelectedId(svc.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-heading font-semibold text-primary">{svc.name}</p>
                  <p className="text-sm text-muted mt-0.5">
                    {svc.duration} min · £{(svc.price / 100).toFixed(2)}
                  </p>
                </div>
                {selected && (
                  <i className="fa-solid fa-check text-primary" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <button
          onClick={() => selectedId && onContinue({ serviceId: selectedId })}
          disabled={!selectedId}
          className="w-full py-3 rounded-xl bg-primary text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export default PickService
