/**
 * Run 2: Confirmation page after booking
 */

import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getBooking } from '../../utils/bookingApi'

const BookingConfirmation = () => {
  const { businessSlug, bookingId } = useParams()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getBooking(businessSlug, bookingId)
      .then(setBooking)
      .catch(() => setError('Booking not found'))
      .finally(() => setLoading(false))
  }, [businessSlug, bookingId])

  const handleCopyRef = () => {
    if (booking?.reference) {
      navigator.clipboard.writeText(booking.reference)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <p className="text-muted">{error || 'Booking not found'}</p>
      </div>
    )
  }

  const biz = booking.business || {}
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address || '')}`

  return (
    <div className="min-h-screen bg-background p-6 max-w-lg mx-auto">
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-check text-success text-2xl" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-primary">Booking Confirmed!</h1>
        <div className="mt-4 flex items-center justify-center gap-2">
          <code className="text-xl font-mono font-bold text-primary">{booking.reference}</code>
          <button
            onClick={handleCopyRef}
            className="p-2 text-muted hover:text-primary"
            aria-label="Copy reference"
          >
            <i className="fa-solid fa-copy" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 mb-6">
        <p className="font-heading font-semibold text-primary">{biz.name}</p>
        <p className="text-sm text-muted mt-1">
          {booking.service?.name && `${booking.service.name} · `}
          {booking.date} at {booking.time}
        </p>
        {booking.staff?.name && <p className="text-sm text-muted">{booking.staff.name}</p>}
        <p className="text-sm text-muted mt-2">{biz.address}</p>
        <p className="text-sm text-muted">Confirmation sent to {booking.customer?.email}</p>
      </div>

      <div className="space-y-3">
        <a
          href={booking.calendarLinks?.google}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 rounded-xl border-2 border-primary text-primary font-medium text-center hover:bg-primary hover:text-white transition-colors"
        >
          Add to Calendar
        </a>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 rounded-xl border-2 border-border text-primary font-medium text-center hover:bg-border transition-colors"
        >
          Get Directions
        </a>
        <Link
          to={`/book/${businessSlug}/manage/${bookingId}`}
          className="block w-full py-3 text-center text-sm text-muted hover:text-primary"
        >
          Modify or Cancel
        </Link>
      </div>

      <p className="text-center text-xs text-muted mt-8">Powered by Rezvo</p>
    </div>
  )
}

export default BookingConfirmation
