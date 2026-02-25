/**
 * Booking confirmed — reference, summary, calendar links
 * Mobile-first, polished
 */

import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle, Copy, Calendar, MapPin, Mail, Clock } from 'lucide-react'
import RezvoLoader from '../../components/shared/RezvoLoader'
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
        <RezvoLoader message="Loading confirmation..." />
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
    <div className="min-h-screen bg-[#FEFBF4] px-5 pt-10 pb-12 max-w-md mx-auto">
      {/* Success icon */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-semibold text-[#1B4332]">Booking Confirmed</h1>
        <p className="text-sm text-gray-500 mt-1">
          We've sent a confirmation to {booking.customer?.email}
        </p>

        {/* Reference code */}
        <div className="mt-4 inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2">
          <span className="font-mono text-lg font-bold text-[#1B4332] tracking-wider">{booking.reference}</span>
          <button
            onClick={handleCopy}
            className="p-1 text-gray-400 hover:text-[#1B4332] transition-colors"
            aria-label="Copy reference"
          >
            <Copy className="w-4 h-4" />
          </button>
          {copied && <span className="text-xs text-emerald-600">Copied</span>}
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="font-semibold text-[#1B4332] mb-3">{biz.name}</h3>
        <div className="space-y-2 text-sm">
          {booking.service?.name && (
            <div className="flex items-start gap-2 text-gray-600">
              <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <span>{booking.service.name} · {booking.service?.duration || 60} min</span>
            </div>
          )}
          <div className="flex items-start gap-2 text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <span>{formatDate(booking.date)} at {booking.time}</span>
          </div>
          {booking.staff?.name && (
            <div className="flex items-start gap-2 text-gray-600">
              <span className="w-4 h-4 text-gray-400 mt-0.5 shrink-0 text-center text-xs">👤</span>
              <span>{booking.staff.name}</span>
            </div>
          )}
          {biz.address && (
            <div className="flex items-start gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <span>{biz.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2.5">
        {booking.calendarLinks?.google && (
          <a
            href={booking.calendarLinks.google}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#1B4332] text-[#1B4332] font-medium text-[15px] hover:bg-[#1B4332] hover:text-white transition-all"
          >
            <Calendar className="w-4 h-4" />
            Add to Calendar
          </a>
        )}
        {biz.address && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-gray-200 text-gray-700 font-medium text-[15px] hover:bg-gray-50 transition-all"
          >
            <MapPin className="w-4 h-4" />
            Get Directions
          </a>
        )}
        <Link
          to={`/book/${businessSlug}/manage/${bookingId}`}
          className="block w-full py-3 text-center text-sm text-gray-500 hover:text-[#1B4332] transition-colors"
        >
          Modify or Cancel Booking
        </Link>
      </div>

      <p className="text-center text-xs text-gray-400 mt-10">Powered by Rezvo</p>
    </div>
  )
}

export default BookingConfirmation
