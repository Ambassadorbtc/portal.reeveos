/**
 * Run 2: Step 3 — Your details + confirm (Services flow)
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import BookingHeader from '../../components/BookingHeader'
import StepIndicator from '../../components/StepIndicator'

const YourDetails = ({ data, onCreate }) => {
  const { business, service, staff, date, time, slug } = data
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const svc = data.service || data.services?.find((s) => s.id === data.serviceId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError('Please fill in all required fields')
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
      setError(err.message || 'Booking failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link to={`/book/${slug}`} className="inline-flex items-center gap-2 text-muted hover:text-primary mb-4">
        <i className="fa-solid fa-arrow-left" />
        Back
      </Link>
      <BookingHeader business={business} />
      <StepIndicator step={3} total={3} />

      {/* Summary */}
      <div className="bg-border/30 rounded-xl p-4 mb-6">
        <p className="font-heading font-semibold text-primary">{svc?.name || 'Service'}</p>
        <p className="text-sm text-muted">
          {(data.staff?.find((s) => s.id === data.staffId)?.name || staff?.name) && `${data.staff?.find((s) => s.id === data.staffId)?.name || staff?.name} · `}
          {date} at {time} · {svc?.duration || 60} min
        </p>
        {svc?.price != null && (
          <p className="text-sm font-medium mt-1">£{((svc.price || 0) / 100).toFixed(2)}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 mb-24">
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Your name"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Phone *</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
            placeholder="07xxx xxxxxx"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@email.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input min-h-[80px]"
            placeholder="Anything we should know?"
            rows={3}
          />
        </div>
        {error && <p className="text-error text-sm">{error}</p>}
      </form>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-primary text-white font-medium disabled:opacity-50"
        >
          {loading ? 'Booking...' : 'Confirm Booking'}
        </button>
      </div>
    </div>
  )
}

export default YourDetails
