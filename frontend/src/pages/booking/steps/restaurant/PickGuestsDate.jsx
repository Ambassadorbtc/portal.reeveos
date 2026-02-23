/**
 * Restaurant Step 1 — Pick party size and date
 * Mobile-first, matches salon flow patterns
 */

import { useState } from 'react'
import { Users, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import BookingHeader from '../../components/BookingHeader'
import StepIndicator from '../../components/StepIndicator'
import StickyFooter from '../../components/StickyFooter'

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const PickGuestsDate = ({ data, onContinue }) => {
  const { business } = data
  const [guests, setGuests] = useState(2)
  const [selectedDate, setSelectedDate] = useState(null)
  const [viewMonth, setViewMonth] = useState(new Date())

  // Generate calendar days for current month view
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = []
  // Pad start
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  const isDatePast = (day) => {
    if (!day) return true
    const date = new Date(year, month, day)
    return date < today
  }

  const isSelected = (day) => {
    if (!day || !selectedDate) return false
    return selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day
  }

  const isToday = (day) => {
    if (!day) return false
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  }

  const handleSelect = (day) => {
    if (!day || isDatePast(day)) return
    setSelectedDate(new Date(year, month, day))
  }

  const prevMonth = () => {
    const prev = new Date(year, month - 1, 1)
    if (prev >= new Date(today.getFullYear(), today.getMonth(), 1)) {
      setViewMonth(prev)
    }
  }

  const nextMonth = () => {
    setViewMonth(new Date(year, month + 1, 1))
  }

  const canContinue = guests > 0 && selectedDate

  return (
    <div className="max-w-xl mx-auto px-5 pt-6">
      <BookingHeader business={business} />
      <StepIndicator step={1} total={3} />

      {/* Guest count */}
      <h2 className="text-base font-semibold text-[#1B4332] mb-3">How many guests?</h2>
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-5 px-5 mb-6">
        {GUEST_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setGuests(n)}
            className={`w-12 h-12 rounded-xl text-sm font-semibold shrink-0 transition-all ${
              guests === n
                ? 'bg-[#1B4332] text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1B4332]/30'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => setGuests(9)}
          className={`px-4 h-12 rounded-xl text-sm font-medium shrink-0 transition-all ${
            guests >= 9
              ? 'bg-[#1B4332] text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1B4332]/30'
          }`}
        >
          9+
        </button>
      </div>

      {/* Calendar */}
      <h2 className="text-base font-semibold text-[#1B4332] mb-3">Pick a date</h2>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h3 className="text-sm font-semibold text-[#1B4332]">
            {MONTH_NAMES[month]} {year}
          </h3>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const past = isDatePast(day)
            const sel = isSelected(day)
            const tod = isToday(day)
            return (
              <button
                key={i}
                onClick={() => handleSelect(day)}
                disabled={!day || past}
                className={`aspect-square rounded-xl text-sm font-medium transition-all ${
                  !day ? '' :
                  sel ? 'bg-[#1B4332] text-white shadow-sm' :
                  past ? 'text-gray-300 cursor-not-allowed' :
                  tod ? 'bg-[#D4A373]/10 text-[#D4A373] font-semibold hover:bg-[#D4A373]/20' :
                  'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selection summary */}
      {selectedDate && (
        <div className="flex items-center gap-3 p-3 bg-[#1B4332]/[0.03] rounded-xl border border-[#1B4332]/10 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#1B4332]/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-[#1B4332]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1B4332]">
              {guests} {guests === 1 ? 'guest' : 'guests'}
            </p>
            <p className="text-xs text-gray-500">
              {DAY_NAMES[selectedDate.getDay()]} {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]}
            </p>
          </div>
        </div>
      )}

      <div className="pb-28" />

      <StickyFooter>
        <button
          onClick={() => canContinue && onContinue({ guests, date: selectedDate.toISOString().split('T')[0] })}
          disabled={!canContinue}
          className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all ${
            canContinue
              ? 'bg-[#1B4332] text-white hover:bg-[#1B4332]/90 shadow-sm'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Choose a time
        </button>
      </StickyFooter>
    </div>
  )
}

export default PickGuestsDate
