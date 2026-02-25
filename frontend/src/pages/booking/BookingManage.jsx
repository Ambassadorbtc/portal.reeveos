/**
 * Manage booking — view details, reschedule, cancel
 * Mobile-first, Lucide icons
 */

import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MapPin, XCircle, RotateCcw } from 'lucide-react'
import RezvoLoader from '../../components/shared/RezvoLoader'
import { getBooking, cancelBooking } from '../../utils/bookingApi'

const BookingManage = () => {
  const { businessSlug, bookingId } = useParams()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    getBooking(businessSlug, bookingId)
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoading(false))
  }, [businessSlug, bookingId])

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await cancelBooking(businessSlug, bookingId)
      setCancelled(true)
    } catch {
      alert('Cancellation failed. Please try again.')
    } finally {
      setCancelling(false)
      setShowConfirm(false)
    }
  }

  const formatDate = (d) => {
    if (!d) return ''
    const dt = new Date(d + 'T12:00:00')
    return dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FEFBF4]">
        <RezvoLoader message="Loading booking..." />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FEFBF4] px-5">
        <p className="text-gray-500">Booking not found</p>
      </div>
    )
  }

  if (cancelled) {
    return (
      <div className="min-h-screen bg-[#FEFBF4] px-5 pt-16 max-w-md mx-auto text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-7 h-7 text-gray-400" />
        </div>
        <h1 className="text-xl font-semibold text-[#1B4332]">Booking Cancelled</h1>
        <p className="text-sm text-gray-500 mt-2">Your booking has been cancelled successfully.</p>
        <Link
          to={`/book/${businessSlug}`}
          className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 rounded-xl bg-[#1B4332] text-white font-medium text-sm hover:bg-[#143326] transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Book again
        </Link>
      </div>
    )
  }

  const biz = booking.business || {}

  return (
    <div className="min-h-screen bg-[#FEFBF4] px-5 pt-6 pb-12 max-w-md mx-auto">
      <Link
        to={`/book/${businessSlug}/confirm/${bookingId}`}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1B4332] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to confirmation
      </Link>

      <h1 className="text-xl font-semibold text-[#1B4332] mb-5">Manage Booking</h1>

      {/* Booking details card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[#1B4332]">{biz.name}</h3>
          <span className="font-mono text-sm text-gray-500">{booking.reference}</span>
        </div>
        <div className="space-y-2 text-sm">
          {booking.service?.name && (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{booking.service.name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <span>{formatDate(booking.date)} at {booking.time}</span>
          </div>
          {biz.address && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{biz.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2.5">
        <Link
          to={`/book/${businessSlug}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#1B4332] text-[#1B4332] font-medium text-[15px] hover:bg-[#1B4332] hover:text-white transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          Reschedule Booking
        </Link>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-medium text-[15px] hover:bg-red-50 transition-all"
          >
            Cancel Booking
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700 mb-3">Are you sure you want to cancel this booking?</p>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                {cancelling ? 'Cancelling...' : 'Yes, cancel'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all"
              >
                Keep booking
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-10">Powered by Rezvo</p>
    </div>
  )
}

export default BookingManage
