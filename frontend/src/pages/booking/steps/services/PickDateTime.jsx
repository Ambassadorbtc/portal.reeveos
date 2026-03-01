/**
 * Step 2 — Pick date & time
 * Mobile-first, horizontal date strip, grouped time slots
 */

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import RezvoLoader from '../../../../components/shared/RezvoLoader'
import BookingHeader from '../../components/BookingHeader'
import StepIndicator from '../../components/StepIndicator'
import StickyFooter from '../../components/StickyFooter'
import { getAvailableDates, getAvailability } from '../../../../utils/bookingApi'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const PickDateTime = ({ data, onContinue, onBack }) => {
  const { business, serviceId, slug, service } = data
  const [dates, setDates] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [slots, setSlots] = useState([])
  const [selectedTime, setSelectedTime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    getAvailableDates(slug, { serviceId, days: 30 })
      .then((r) => {
        setDates(r.dates || {})
        // Auto-select first available date
        const first = Object.entries(r.dates || {}).find(([, v]) => v)
        if (first) setSelectedDate(first[0])
      })
      .catch(() => setDates({}))
      .finally(() => setLoading(false))
  }, [slug, serviceId])

  useEffect(() => {
    if (!selectedDate) { setSlots([]); return }
    setSlotsLoading(true)
    setSelectedTime(null)
    getAvailability(slug, { date: selectedDate, serviceId })
      .then((r) => setSlots(r.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [slug, serviceId, selectedDate])

  const dateKeys = Object.keys(dates).slice(0, 30)

  const groupSlots = (arr) => {
    const groups = { morning: [], afternoon: [], evening: [] }
    arr.forEach((s) => {
      const h = parseInt(s.time.split(':')[0], 10)
      if (h < 12) groups.morning.push(s)
      else if (h < 17) groups.afternoon.push(s)
      else groups.evening.push(s)
    })
    return groups
  }

  const grouped = groupSlots(slots)

  return (
    <div className="px-4 pt-3 overflow-hidden">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#111111] mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <BookingHeader business={business} />
      <StepIndicator step={2} total={3} />

      {/* Selected service reminder */}
      {service && (
        <div className="text-sm text-gray-500 mb-4 bg-white rounded-lg px-3 py-2 border border-gray-100">
          <span className="font-medium text-gray-700">{service.name}</span>
          <span className="mx-1.5 text-gray-300">·</span>
          <span>{service.duration} min</span>
          <span className="mx-1.5 text-gray-300">·</span>
          <span>£{(service.price / 100).toFixed(2)}</span>
        </div>
      )}

      <h2 className="text-sm font-semibold text-[#111111] mb-3">Pick a date</h2>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RezvoLoader size="sm" message="" />
        </div>
      ) : (
        <>
          {/* Date strip — horizontal scroll */}
          <div
            ref={scrollRef}
            className="flex gap-2 flex-wrap pb-4"
          >
            {dateKeys.map((d) => {
              const dt = new Date(d + 'T12:00:00')
              const dayName = DAY_NAMES[dt.getDay()]
              const dayNum = dt.getDate()
              const isAvailable = dates[d]
              const isSelected = selectedDate === d
              const isToday = d === new Date().toISOString().slice(0, 10)

              return (
                <button
                  key={d}
                  onClick={() => isAvailable && setSelectedDate(d)}
                  disabled={!isAvailable}
                  className={`shrink-0 w-[52px] py-2.5 rounded-xl text-center transition-all ${
                    isSelected
                      ? 'bg-[#111111] text-white shadow-sm'
                      : isAvailable
                        ? 'bg-white border border-gray-200 hover:border-[#111111]/40 text-gray-700'
                        : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <span className={`block text-[11px] font-medium ${isSelected ? 'text-white/80' : isAvailable ? 'text-gray-400' : 'text-gray-300'}`}>
                    {dayName}
                  </span>
                  <span className={`block text-base font-semibold mt-0.5 ${isSelected ? 'text-white' : ''}`}>
                    {dayNum}
                  </span>
                  {isToday && !isSelected && (
                    <span className="block w-1 h-1 rounded-full bg-[#D4A373] mx-auto mt-1" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="mt-2 pb-6">
              {slotsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[#111111] animate-spin" />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No available times for this date</p>
              ) : (
                <>
                  {['morning', 'afternoon', 'evening'].map((group) => {
                    const arr = grouped[group]
                    if (!arr?.length) return null
                    const label = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }[group]
                    return (
                      <div key={group} className="mb-5">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{label}</p>
                        <div className="flex flex-wrap gap-2">
                          {arr.map((s) => (
                            <button
                              key={s.time}
                              onClick={() => s.available && setSelectedTime(s.time)}
                              disabled={!s.available}
                              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                                selectedTime === s.time
                                  ? 'bg-[#111111] text-white shadow-sm'
                                  : s.available
                                    ? 'bg-white border border-gray-200 text-gray-700 hover:border-[#111111]/40'
                                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                              }`}
                            >
                              {s.time}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Contained CTA */}
      <StickyFooter>
        <button
          onClick={() => selectedDate && selectedTime && onContinue({ date: selectedDate, time: selectedTime })}
          disabled={!selectedDate || !selectedTime}
          className={`w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
            selectedDate && selectedTime
              ? 'bg-[#111111] text-white hover:bg-[#0a0a0a] shadow-sm'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Continue
          {selectedDate && selectedTime && <ChevronRight className="w-4 h-4" />}
        </button>
      </StickyFooter>
    </div>
  )
}

export default PickDateTime
