/**
 * Restaurant Step 2 — Pick a time slot
 * Reads real opening hours from settings.hours
 * Groups into LUNCH / EVENING based on actual open times
 */

import { useState, useEffect } from 'react'
import { Clock, Users, Calendar, ArrowLeft } from 'lucide-react'
import RezvoLoader from '../../../../components/shared/RezvoLoader'
import BookingHeader from '../../components/BookingHeader'
import StepIndicator from '../../components/StepIndicator'
import StickyFooter from '../../components/StickyFooter'
import { getAvailability } from '../../../../utils/bookingApi'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

const generateSlots = (settings, date) => {
  const dayOfWeek = new Date(date).getDay()
  const dayName = DAY_KEYS[dayOfWeek]
  const hours = settings?.hours?.[dayName]

  // Closed day
  if (hours?.closed) return []

  // If no hours data, use service periods or defaults
  if (!hours || !hours.open) {
    const slots = []
    const periods = settings?.servicePeriods || [
      { start: '12:00', end: '14:30' },
      { start: '18:00', end: '22:00' },
    ]
    for (const p of periods) {
      const [sH, sM] = (p.start || '12:00').split(':').map(Number)
      const [eH, eM] = (p.end || '22:00').split(':').map(Number)
      const startMin = sH * 60 + (sM || 0)
      const endMin = eH * 60 + (eM || 0) - 60
      for (let m = startMin; m <= endMin; m += 30) {
        const h = Math.floor(m / 60)
        const min = m % 60
        slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
      }
    }
    return slots
  }

  // Generate from real hours
  const [oH, oM] = hours.open.split(':').map(Number)
  let [cH, cM] = hours.close.split(':').map(Number)
  if (cH === 0 && cM === 0) { cH = 23; cM = 30 }

  // Last booking slot: 90 min before close for restaurants
  const closeMin = cH * 60 + (cM || 0)
  const lastSlotMin = closeMin - 90

  const slots = []
  for (let m = oH * 60 + (oM || 0); m <= lastSlotMin; m += 30) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return slots
}

const groupSlots = (slots) => {
  const groups = {}
  slots.forEach(s => {
    const timeStr = typeof s === 'string' ? s : s.time
    const h = parseInt(timeStr)
    const label = h < 15 ? 'Lunch' : h < 17 ? 'Afternoon' : 'Evening'
    if (!groups[label]) groups[label] = []
    groups[label].push(typeof s === 'string' ? { time: s, available: true, tablesLeft: 1 } : s)
  })
  return groups
}

const PickTimeSlot = ({ data, onContinue, onBack }) => {
  const { business, guests, date, settings } = data
  const [selectedTime, setSelectedTime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState([])

  const dateObj = new Date(date + 'T00:00:00')
  const dayName = DAY_KEYS[dateObj.getDay()]
  const dateLabel = `${DAY_NAMES[dateObj.getDay()].slice(0,3)} ${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()].slice(0,3)}`
  const hours = settings?.hours?.[dayName]
  const isClosed = hours?.closed

  useEffect(() => {
    setLoading(true)
    setSelectedTime(null)
    
    // Fetch REAL availability from backend (checks actual table conflicts)
    getAvailability(data.slug, { date, partySize: guests || 2 })
      .then(res => {
        // Backend returns { slots: [{time, available, tablesLeft}], turnTime }
        if (res.slots && res.slots.length > 0) {
          setSlots(res.slots)
        } else {
          // Fallback: generate from settings if API returns nothing
          setSlots(generateSlots(settings, date).map(t => ({ time: t, available: true, tablesLeft: 1 })))
        }
      })
      .catch(() => {
        // Fallback to client-side generation on API error
        setSlots(generateSlots(settings, date).map(t => ({ time: t, available: true, tablesLeft: 1 })))
      })
      .finally(() => setLoading(false))
  }, [date, settings, data.slug, guests])

  const grouped = groupSlots(slots)
  const canContinue = !!selectedTime
  const fmt = (t) => {
    const [h, m] = t.split(':')
    const hr = parseInt(h)
    return hr < 12 ? `${hr}:${m}am` : hr === 12 ? `12:${m}pm` : `${hr - 12}:${m}pm`
  }

  return (
    <div className="px-4 pt-3 overflow-hidden">
      <BookingHeader business={business} />
      <StepIndicator step={2} total={3} />

      <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#111111] mb-2 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="flex items-center gap-3 px-2.5 py-1.5 bg-[#111111]/[0.03] rounded-lg border border-[#111111]/10 mb-3">
        <div className="flex items-center gap-1 text-xs text-[#111111]">
          <Users className="w-3.5 h-3.5" />
          <span className="font-medium">{guests}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-[#111111]">
          <Calendar className="w-3.5 h-3.5" />
          <span className="font-medium">{dateLabel}</span>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-[#111111] mb-2">Choose a time</h2>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RezvoLoader size="sm" message="" />
        </div>
      ) : isClosed || slots.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-2">
            <Clock className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {isClosed ? `Closed on ${DAY_NAMES[dateObj.getDay()]}s` : 'No availability'}
          </p>
          <p className="text-xs text-gray-400 mb-3">
            {isClosed ? 'Please choose a different day' : 'No slots available on this date'}
          </p>
          <button onClick={onBack} className="text-xs text-[#111111] font-medium underline">Pick a different date</button>
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {Object.entries(grouped).map(([period, times]) => {
            if (!times.length) return null
            return (
              <div key={period}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{period}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {times.map(slot => (
                    <button key={slot.time} onClick={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`py-2 rounded-lg text-xs font-medium transition-all ${
                        !slot.available ? 'bg-gray-50 text-gray-300 cursor-not-allowed line-through' :
                        selectedTime === slot.time ? 'bg-[#111111] text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:border-[#111111]/30'
                      }`}
                    >{fmt(slot.time)}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <StickyFooter>
        <button onClick={() => canContinue && onContinue({ time: selectedTime })} disabled={!canContinue}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${canContinue ? 'bg-[#111111] text-white hover:bg-[#111111]/90 shadow-sm' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
        >Continue</button>
      </StickyFooter>
    </div>
  )
}

export default PickTimeSlot
