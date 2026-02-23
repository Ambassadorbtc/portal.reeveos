/**
 * Run 2: Modify or cancel existing booking
 */

import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getBooking, cancelBooking } from '../../utils/bookingApi'

const BookingManage = () => {
  const { businessSlug, bookingId } = useParams()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  useEffect(() => {
    getBooking(businessSlug, bookingId)
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoading(false))
  }, [businessSlug, bookingId])

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this booking?')) return
    setCancelling(true)
    try {
      await cancelBooking(businessSlug, bookingId)
      setCancelled(true)
    } catch {
      alert('Cancellation failed')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <p className="text-muted">Booking not found</p>
      </div>
    )
  }

  if (cancelled) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-lg mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-ban text-muted text-2xl" />
        </div>
        <h1 className="font-heading text-xl font-bold text-primary">Booking Cancelled</h1>
        <Link to={`/book/${businessSlug}`} className="mt-6 inline-block text-primary font-medium">
          Book again
        </Link>
      </div>
    )
  }

  const biz = booking.business || {}

  return (
    <div className="min-h-screen bg-background p-6 max-w-lg mx-auto">
      <h1 className="font-heading text-xl font-bold text-primary mb-4">Manage Booking</h1>

      <div className="bg-white rounded-xl border border-border p-4 mb-6">
        <p className="font-heading font-semibold text-primary">{biz.name}</p>
        <p className="text-sm text-muted mt-1">
          {booking.reference} · {booking.date} at {booking.time}
        </p>
        {booking.service?.name && <p className="text-sm text-muted">{booking.service.name}</p>}
      </div>

      <div className="space-y-3">
        <Link
          to={`/book/${businessSlug}`}
          className="block w-full py-3 rounded-xl border-2 border-primary text-primary font-medium text-center hover:bg-primary hover:text-white transition-colors"
        >
          Reschedule (book new time)
        </Link>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="block w-full py-3 rounded-xl border-2 border-error text-error font-medium hover:bg-error hover:text-white transition-colors disabled:opacity-50"
        >
          {cancelling ? 'Cancelling...' : 'Cancel Booking'}
        </button>
      </div>

      <p className="text-center text-xs text-muted mt-8">Powered by Rezvo</p>
    </div>
  )
}

export default BookingManage
