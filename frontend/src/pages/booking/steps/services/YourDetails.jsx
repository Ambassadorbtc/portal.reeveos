/**
 * Step 3 — Your details + booking summary + confirm
 * Mobile-first, form with validation, contained CTA
 */

import { useState } from 'react'
import { ArrowLeft, Calendar, Clock, User, Loader2 } from 'lucide-react'
import BookingHeader from '../../components/BookingHeader'
import StepIndicator from '../../components/StepIndicator'
import StickyFooter from '../../components/StickyFooter'

const YourDetails = ({ data, onCreate, onBack }) => {
  const { business, service, staff, date, time, slug, services } = data
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const svc = service || services?.find((s) => s.id === data.serviceId)

  // Format date nicely
  const formatDate = (d) => {
    if (!d) return ''
    const dt = new Date(d + 'T12:00:00')
    return dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError('Please fill in all required fields')
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await onCreate({
        serviceId: data.serviceId,
        staffId: data.staffId,
        date: data.date,
        time: data.time,
        customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
        notes: notes.trim() || undefined,
      })
      if (res?.booking?.id) {
        window.location.href = `/book/${slug}/confirm/${res.booking.id}`
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 pt-3 overflow-hidden">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1B4332] mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <BookingHeader business={business} />
      <StepIndicator step={3} total={3} />

      {/* Booking summary card */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
        <h3 className="text-sm font-semibold text-[#1B4332] mb-2">Booking Summary</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-medium text-gray-800">{svc?.name || 'Service'}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>{formatDate(date)}</span>
            <span className="text-gray-300">·</span>
            <span>{time}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>{svc?.duration || 60} minutes</span>
          </div>
        </div>
        {svc?.price > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
            <span className="text-sm text-gray-500">Total</span>
            <span className="font-semibold text-[#1B4332]">£{((svc.price || 0) / 100).toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Form */}
      <h2 className="text-sm font-semibold text-[#1B4332] mb-3">Your details</h2>

      <form onSubmit={handleSubmit} className="space-y-3.5 pb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-[13px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] transition-all"
            placeholder="Your full name"
            required
            autoComplete="name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-[13px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] transition-all"
            placeholder="07xxx xxxxxx"
            required
            autoComplete="tel"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-[13px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] transition-all"
            placeholder="you@email.com"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-[13px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] transition-all min-h-[80px] resize-none"
            placeholder="Anything we should know?"
            rows={3}
          />
        </div>
        {error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
      </form>

      {/* Contained CTA */}
      <StickyFooter>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
            loading
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-[#1B4332] text-white hover:bg-[#143326] shadow-sm'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Booking...
            </>
          ) : (
            'Confirm Booking'
          )}
        </button>
      </StickyFooter>
    </div>
  )
}

export default YourDetails
