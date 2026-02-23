/**
 * Run 2: Main booking flow wrapper — detects business type, steps
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getBookingPage, createBooking } from '../../utils/bookingApi'
import PickService from './steps/services/PickService'
import PickDateTime from './steps/services/PickDateTime'
import YourDetails from './steps/services/YourDetails'

const SERVICES_STEPS = [
  { id: 'pick-service', component: PickService },
  { id: 'pick-datetime', component: PickDateTime },
  { id: 'your-details', component: YourDetails },
]

const BookingFlow = () => {
  const { businessSlug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [flowData, setFlowData] = useState({})

  useEffect(() => {
    getBookingPage(businessSlug)
      .then((res) => {
        setData(res)
        setFlowData({ ...flowData, business: res.business, services: res.services, staff: res.staff, categories: res.categories, settings: res.settings, slug: businessSlug })
      })
      .catch(() => setError('Business not found'))
      .finally(() => setLoading(false))
  }, [businessSlug])

  const handleContinue = (next) => {
    const merged = { ...flowData, ...next }
    if (next.serviceId) {
      merged.service = data.services?.find((s) => s.id === next.serviceId)
    }
    setFlowData(merged)
    setStep((s) => Math.min(s + 1, SERVICES_STEPS.length - 1))
  }

  const handleCreate = async (payload) => {
    return createBooking(businessSlug, payload)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="text-center">
          <i className="fa-solid fa-circle-exclamation text-4xl text-error mb-4" />
          <p className="text-lg font-heading font-semibold text-primary">{error || 'Business not found'}</p>
        </div>
      </div>
    )
  }

  const bizType = data.business?.type || 'services'
  const steps = bizType === 'restaurant' ? [] : SERVICES_STEPS
  const StepComponent = steps[step]?.component

  if (!StepComponent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <p className="text-muted">Restaurant booking flow coming soon.</p>
      </div>
    )
  }

  const stepData = {
    ...flowData,
    business: data.business,
    services: data.services,
    staff: data.staff,
    categories: data.categories,
    settings: data.settings,
    slug: businessSlug,
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <StepComponent
        data={stepData}
        onContinue={handleContinue}
        onCreate={handleCreate}
      />
    </div>
  )
}

export default BookingFlow
