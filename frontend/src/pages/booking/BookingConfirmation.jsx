/**
 * Booking confirmed — reference, summary, calendar links
 * Mobile-first, polished
 */

import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle, Copy, Calendar, MapPin, Mail, Clock } from 'lucide-react'
import AppLoader from '../../components/shared/AppLoader'
import { getBooking } from '../../utils/bookingApi'

const BookingConfirmation = () => {
  const { businessSlug, bookingId } = useParams()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getBooking(businessSlug, bookingId)
      .then(setBooking)
      .catch(() => setError('Booking not found'))
      .finally(() => setLoading(false))
  }, [businessSlug, bookingId])

  const handleCopy = () => {
    if (booking?.reference) {
      navigator.clipboard.writeText(booking.reference)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatDate = (d) => {
    if (!d) return ''
    const dt = new Date(d + 'T12:00:00')
    return dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FEFBF4]">
        <AppLoader message="Loading confirmation..." />
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FEFBF4] px-5">
        <p className="text-gray-500">{error || 'Booking not found'}</p>
      </div>
    )
  }

  const biz = booking.business || {}
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address || '')}`

  return (
    <div className="min-h-screen bg-[#FEFBF4] flex items-start justify-center" style={{ fontFamily: "'Figtree', sans-serif" }}>
    <div className="w-full sm:max-w-[400px] sm:my-6 sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-xl sm:bg-[#FEFBF4] sm:overflow-hidden px-4 pt-8 pb-10">
      {/* Success icon */}
      <div className="text-center mb-5">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="w-6 h-6 text-emerald-600" />
        </div>
        <h1 className="text-lg font-semibold text-[#111111]">Booking Confirmed</h1>
        <p className="text-xs text-gray-500 mt-1">
          Confirmation sent to {booking.customer?.email}
        </p>

        {/* Reference code */}
        <div className="mt-3 inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
          <span className="font-mono text-base font-bold text-[#111111] tracking-wider">{booking.reference}</span>
          <button
            onClick={handleCopy}
            className="p-1 text-gray-400 hover:text-[#111111] transition-colors"
            aria-label="Copy reference"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {copied && <span className="text-[10px] text-emerald-600">Copied</span>}
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
        <h3 className="font-semibold text-sm text-[#111111] mb-2">{biz.name}</h3>
        <div className="space-y-1.5 text-xs">
          {booking.service?.name && (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>{booking.service.name} · {booking.service?.duration || 60} min</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{formatDate(booking.date)} at {booking.time}</span>
          </div>
          {booking.staff?.name && (
            <div className="flex items-center gap-2 text-gray-600">
              <span className="w-3.5 h-3.5 text-gray-400 shrink-0 text-center text-[10px]">👤</span>
              <span>{booking.staff.name}</span>
            </div>
          )}
          {biz.address && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>{biz.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {booking.calendarLinks?.google && (
          <a href={booking.calendarLinks.google} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[#111111] text-[#111111] font-medium text-xs hover:bg-[#111111] hover:text-white transition-all">
            <Calendar className="w-3.5 h-3.5" /> Add to Calendar
          </a>
        )}
        {biz.address && (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium text-xs hover:bg-gray-50 transition-all">
            <MapPin className="w-3.5 h-3.5" /> Get Directions
          </a>
        )}
        <Link to={`/${businessSlug}/manage/${bookingId}`}
          className="block w-full py-2.5 text-center text-xs text-gray-500 hover:text-[#111111] transition-colors">
          Modify or Cancel Booking
        </Link>
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">Powered by <a href="https://reeveos.app" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#111111] hover:underline">ReeveOS</a></p>
    </div>
    </div>
  )
}

export default BookingConfirmation
