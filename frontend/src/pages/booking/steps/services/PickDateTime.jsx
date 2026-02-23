/**
 * Run 2: Step 2 — Pick date & time (Services flow)
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import BookingHeader from '../../components/BookingHeader'
import StepIndicator from '../../components/StepIndicator'
import { getAvailableDates, getAvailability } from '../../../../utils/bookingApi'

const PickDateTime = ({ data, onContinue }) => {
  const { business, serviceId, slug } = data
  const [dates, setDates] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [slots, setSlots] = useState([])
  const [selectedTime, setSelectedTime] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAvailableDates(slug, { serviceId, days: 30 })
      .then((r) => setDates(r.dates || {}))
      .catch(() => setDates({}))
      .finally(() => setLoading(false))
  }, [slug, serviceId])

  useEffect(() => {
    if (!selectedDate) {
      setSlots([])
      return
    }
    setLoading(true)
    getAvailability(slug, { date: selectedDate, serviceId })
      .then((r) => setSlots(r.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false))
  }, [slug, serviceId, selectedDate])

  const dateKeys = Object.keys(dates).slice(0, 30)
  const today = new Date().toISOString().slice(0, 10)

  const groupSlots = (arr) => {
    const morning = [], afternoon = [], evening = []
    arr.forEach((s) => {
      const [h] = s.time.split(':').map(Number)
      if (h < 12) morning.push(s)
      else if (h < 17) afternoon.push(s)
      else evening.push(s)
    })
    return { morning, afternoon, evening }
  }

  const grouped = groupSlots(slots)

  return (
    <div className="max-w-lg mx-auto">
      <Link to={`/book/${slug}`} className="inline-flex items-center gap-2 text-muted hover:text-primary mb-4">
        <i className="fa-solid fa-arrow-left" />
        Back
      </Link>
      <BookingHeader business={business} />
      <StepIndicator step={2} total={3} />

      {/* Date strip */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-4">
        {dateKeys.map((d) => {
          const isAvailable = dates[d]
          const day = new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
          return (
            <button
              key={d}
              onClick={() => isAvailable && setSelectedDate(d)}
              disabled={!isAvailable}
              className={`shrink-0 w-16 py-3 rounded-xl text-center transition-colors ${
                selectedDate === d
                  ? 'bg-primary text-white'
                  : isAvailable
                    ? 'bg-border hover:bg-primary/20'
                    : 'bg-border/50 text-muted cursor-not-allowed'
              }`}
            >
              <span className="block text-xs font-medium">{day.split(' ')[0]}</span>
              <span className="block text-lg font-bold">{day.split(' ')[1]}</span>
            </button>
          )
        })}
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className="mb-24">
          {loading ? (
            <p className="text-muted">Loading times...</p>
          ) : (
            <>
              {['morning', 'afternoon', 'evening'].map((group) => {
                const arr = grouped[group]
                if (!arr?.length) return null
                const label = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }[group]
                return (
                  <div key={group} className="mb-4">
                    <p className="text-sm font-medium text-muted mb-2">{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {arr.map((s) => (
                        <button
                          key={s.time}
                          onClick={() => setSelectedTime(s.time)}
                          disabled={!s.available}
                          className={`px-4 py-2 rounded-lg text-sm font-medium ${
                            selectedTime === s.time
                              ? 'bg-primary text-white'
                              : s.available
                                ? 'bg-border hover:bg-primary/20'
                                : 'bg-border/50 text-muted cursor-not-allowed'
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

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <button
          onClick={() => selectedDate && selectedTime && onContinue({ date: selectedDate, time: selectedTime })}
          disabled={!selectedDate || !selectedTime}
          className="w-full py-3 rounded-xl bg-primary text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export default PickDateTime
