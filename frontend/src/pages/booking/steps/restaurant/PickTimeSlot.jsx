/**
 * Restaurant Step 2 — Pick a time slot
 * Shows available times for the selected date and party size
 */

import { useState, useEffect } from 'react'
import { Clock, Users, Calendar, ArrowLeft, Loader2 } from 'lucide-react'
import BookingHeader from '../../components/BookingHeader'
import StepIndicator from '../../components/StepIndicator'
import StickyFooter from '../../components/StickyFooter'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Generate time slots based on business hours
const generateSlots = (settings, date) => {
  const dayOfWeek = new Date(date).getDay()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayName = dayNames[dayOfWeek]

  // Check if business has hours defined
  const hours = settings?.hours?.[dayName]
  if (!hours || hours.closed) return []

  const openH = parseInt(hours.open?.split(':')[0] || '11')
  const openM = parseInt(hours.open?.split(':')[1] || '0')
  const closeH = parseInt(hours.close?.split(':')[0] || '22')
  const closeM = parseInt(hours.close?.split(':')[1] || '0')

  const slots = []
  for (let h = openH; h <= closeH; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === openH && m < openM) continue
      if (h === closeH && m > closeM - 30) continue
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      slots.push(time)
    }
  }

  // If no hours configured, return sensible defaults
  if (slots.length === 0) {
    const defaults = []
    for (let h = 11; h <= 21; h++) {
      defaults.push(`${h.toString().padStart(2, '0')}:00`)
      defaults.push(`${h.toString().padStart(2, '0')}:30`)
    }
    return defaults
  }

  return slots
}

// Group slots into periods
const groupSlots = (slots) => {
  const groups = { 'Lunch': [], 'Afternoon': [], 'Evening': [] }
  slots.forEach((slot) => {
    const h = parseInt(slot.split(':')[0])
    if (h < 15) groups['Lunch'].push(slot)
    else if (h < 17) groups['Afternoon'].push(slot)
    else groups['Evening'].push(slot)
  })
  return groups
}

const PickTimeSlot = ({ data, onContinue, onBack }) => {
  const { business, guests, date, settings } = data
  const [selectedTime, setSelectedTime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState([])

  const dateObj = new Date(date + 'T00:00:00')
  const dateLabel = `${DAY_NAMES[dateObj.getDay()]} ${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()]}`

  useEffect(() => {
    // Simulate loading (in production this would call an availability API)
    setLoading(true)
    const timer = setTimeout(() => {
      const generated = generateSlots(settings, date)
      setSlots(generated)
      setLoading(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [date, settings])

  const grouped = groupSlots(slots)
  const canContinue = !!selectedTime

  const formatTime = (t) => {
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    if (hour < 12) return `${hour}:${m} am`
    if (hour === 12) return `12:${m} pm`
    return `${hour - 12}:${m} pm`
  }

  return (
    <div className="max-w-xl mx-auto px-5 pt-6">
      <BookingHeader business={business} />
      <StepIndicator step={2} total={3} />

      {/* Back + date summary */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1B4332] mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center gap-3 p-3 bg-[#1B4332]/[0.03] rounded-xl border border-[#1B4332]/10 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm text-[#1B4332]">
            <Users className="w-4 h-4" />
            <span className="font-medium">{guests} {guests === 1 ? 'guest' : 'guests'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-[#1B4332]">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">{dateLabel}</span>
          </div>
        </div>
      </div>

      <h2 className="text-base font-semibold text-[#1B4332] mb-4">Choose a time</h2>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#1B4332] animate-spin" />
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No availability on this date</p>
          <button
            onClick={onBack}
            className="text-sm text-[#1B4332] font-medium mt-2 underline"
          >
            Pick a different date
          </button>
        </div>
      ) : (
        <div className="space-y-6 pb-28">
          {Object.entries(grouped).map(([period, times]) => {
            if (times.length === 0) return null
            return (
              <div key={period}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{period}</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {times.map((time) => {
                    const sel = selectedTime === time
                    return (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                          sel
                            ? 'bg-[#1B4332] text-white shadow-sm'
                            : 'bg-white text-gray-700 border border-gray-200 hover:border-[#1B4332]/30'
                        }`}
                      >
                        {formatTime(time)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <StickyFooter>
        <button
          onClick={() => canContinue && onContinue({ time: selectedTime })}
          disabled={!canContinue}
          className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all ${
            canContinue
              ? 'bg-[#1B4332] text-white hover:bg-[#1B4332]/90 shadow-sm'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </StickyFooter>
    </div>
  )
}

export default PickTimeSlot
