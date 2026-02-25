/**
 * Restaurant Step 2 — Pick a time slot
 * Compact layout matching Step 1
 */

import { useState, useEffect } from 'react'
import { Clock, Users, Calendar, ArrowLeft } from 'lucide-react'
import RezvoLoader from '../../../../components/shared/RezvoLoader'
import BookingHeader from '../../components/BookingHeader'
import StepIndicator from '../../components/StepIndicator'
import StickyFooter from '../../components/StickyFooter'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const generateSlots = (settings, date) => {
  const dayOfWeek = new Date(date).getDay()
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const hours = settings?.hours?.[dayNames[dayOfWeek]]
  if (hours?.closed) return []
  if (!hours || !hours.open) {
    const d = []
    for (let h = 12; h <= 14; h++) { d.push(`${h}:00`); d.push(`${h}:30`) }
    for (let h = 17; h <= 21; h++) { d.push(`${h}:00`); d.push(`${h}:30`) }
    return d
  }
  const oH = parseInt(hours.open?.split(':')[0]||'11'), oM = parseInt(hours.open?.split(':')[1]||'0')
  const cH = parseInt(hours.close?.split(':')[0]||'22'), cM = parseInt(hours.close?.split(':')[1]||'0')
  const s = []
  for (let h = oH; h <= cH; h++) for (let m = 0; m < 60; m += 30) {
    if (h===oH && m<oM) continue; if (h===cH && m>cM-30) continue
    s.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
  }
  return s.length ? s : Array.from({length:22},(_,i)=>`${String(Math.floor(i/2)+11).padStart(2,'0')}:${i%2?'30':'00'}`)
}

const groupSlots = (slots) => {
  const g = { Lunch:[], Afternoon:[], Evening:[] }
  slots.forEach(s => { const h=parseInt(s); (h<15?g.Lunch:h<17?g.Afternoon:g.Evening).push(s) })
  return g
}

const PickTimeSlot = ({ data, onContinue, onBack }) => {
  const { business, guests, date, settings } = data
  const [selectedTime, setSelectedTime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState([])

  const dateObj = new Date(date + 'T00:00:00')
  const dateLabel = `${DAY_NAMES[dateObj.getDay()].slice(0,3)} ${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()].slice(0,3)}`

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => { setSlots(generateSlots(settings, date)); setLoading(false) }, 400)
    return () => clearTimeout(t)
  }, [date, settings])

  const grouped = groupSlots(slots)
  const canContinue = !!selectedTime
  const fmt = (t) => { const [h,m]=t.split(':'); const hr=parseInt(h); return hr<12?`${hr}:${m}am`:hr===12?`12:${m}pm`:`${hr-12}:${m}pm` }

  return (
    <div className="max-w-md mx-auto px-4 pt-3 overflow-hidden">
      <BookingHeader business={business} />
      <StepIndicator step={2} total={3} />

      <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#1B4332] mb-2 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="flex items-center gap-3 px-2.5 py-1.5 bg-[#1B4332]/[0.03] rounded-lg border border-[#1B4332]/10 mb-3">
        <div className="flex items-center gap-1 text-xs text-[#1B4332]">
          <Users className="w-3.5 h-3.5" />
          <span className="font-medium">{guests}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-[#1B4332]">
          <Calendar className="w-3.5 h-3.5" />
          <span className="font-medium">{dateLabel}</span>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-[#1B4332] mb-2">Choose a time</h2>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RezvoLoader size="sm" message="" />
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500">No availability on this date</p>
          <button onClick={onBack} className="text-xs text-[#1B4332] font-medium mt-1 underline">Pick a different date</button>
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {Object.entries(grouped).map(([period, times]) => {
            if (!times.length) return null
            return (
              <div key={period}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{period}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {times.map(time => (
                    <button key={time} onClick={() => setSelectedTime(time)}
                      className={`py-2 rounded-lg text-xs font-medium transition-all ${
                        selectedTime===time ? 'bg-[#1B4332] text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:border-[#1B4332]/30'
                      }`}
                    >{fmt(time)}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <StickyFooter>
        <button onClick={() => canContinue && onContinue({ time: selectedTime })} disabled={!canContinue}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${canContinue ? 'bg-[#1B4332] text-white hover:bg-[#1B4332]/90 shadow-sm' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
        >Continue</button>
      </StickyFooter>
    </div>
  )
}

export default PickTimeSlot
