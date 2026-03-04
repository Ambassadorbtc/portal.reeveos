/**
 * Manage booking — view details, reschedule, cancel
 * Mobile-first, Lucide icons
 */

import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MapPin, XCircle, RotateCcw } from 'lucide-react'
import AppLoader from '../../components/shared/AppLoader'
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
        <AppLoader message="Loading booking..." />
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
      <div className="min-h-screen bg-[#FEFBF4] flex items-start justify-center" style={{ fontFamily: "'Figtree', sans-serif" }}>
      <div className="w-full sm:max-w-[400px] sm:my-6 sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-xl sm:bg-[#FEFBF4] sm:overflow-hidden px-4 pt-12 pb-10 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <XCircle className="w-6 h-6 text-gray-400" />
        </div>
        <h1 className="text-lg font-semibold text-[#111111]">Booking Cancelled</h1>
        <p className="text-xs text-gray-500 mt-1.5">Your booking has been cancelled successfully.</p>
        <Link to={`/${businessSlug}`}
          className="inline-flex items-center gap-2 mt-4 px-5 py-2 rounded-xl bg-[#111111] text-white font-medium text-xs hover:bg-[#0a0a0a] transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Book again
        </Link>
      </div>
      </div>
    )
  }

  const biz = booking.business || {}

  return (
    <div className="min-h-screen bg-[#FEFBF4] flex items-start justify-center" style={{ fontFamily: "'Figtree', sans-serif" }}>
    <div className="w-full sm:max-w-[400px] sm:my-6 sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-xl sm:bg-[#FEFBF4] sm:overflow-hidden px-4 pt-4 pb-8">
      <Link to={`/${businessSlug}/confirm/${bookingId}`}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#111111] mb-4 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to confirmation
      </Link>

      <h1 className="text-base font-semibold text-[#111111] mb-3">Manage Booking</h1>

      {/* Booking details card */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-[#111111]">{biz.name}</h3>
          <span className="font-mono text-xs text-gray-500">{booking.reference}</span>
        </div>
        <div className="space-y-1.5 text-xs">
          {booking.service?.name && (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>{booking.service.name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{formatDate(booking.date)} at {booking.time}</span>
          </div>
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
        <Link to={`/${businessSlug}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[#111111] text-[#111111] font-medium text-xs hover:bg-[#111111] hover:text-white transition-all">
          <RotateCcw className="w-3.5 h-3.5" /> Reschedule Booking
        </Link>

        {!showConfirm ? (
          <button onClick={() => setShowConfirm(true)}
            className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 font-medium text-xs hover:bg-red-50 transition-all">
            Cancel Booking
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-xs text-red-700 mb-2">Are you sure you want to cancel?</p>
            <div className="flex gap-2">
              <button onClick={handleCancel} disabled={cancelling}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-all">
                {cancelling ? 'Cancelling...' : 'Yes, cancel'}
              </button>
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-all">
                Keep booking
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-4 pb-2">Powered by <a href="https://reeveos.app" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#111111] hover:underline">ReeveOS</a></p>
    </div>
    </div>
  )
}

export default BookingManage
