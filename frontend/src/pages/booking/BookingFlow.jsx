/**
 * Main booking flow wrapper — detects business type, manages steps
 * Steps handle their own layout (max-w-xl, px-5)
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getBookingPage, createBooking } from '../../utils/bookingApi'
import AppLoader from '../../components/shared/AppLoader'
import PickService from './steps/services/PickService'
import EnhanceTreatment from './steps/services/EnhanceTreatment'
import PickDateTime from './steps/services/PickDateTime'
import YourDetails from './steps/services/YourDetails'
import PickGuestsDate from './steps/restaurant/PickGuestsDate'
import PickTimeSlot from './steps/restaurant/PickTimeSlot'
import YourDetailsRestaurant from './steps/restaurant/YourDetailsRestaurant'

const SERVICES_STEPS = [
  { id: 'pick-service', component: PickService },
  { id: 'enhance-treatment', component: EnhanceTreatment },
  { id: 'pick-datetime', component: PickDateTime },
  { id: 'your-details', component: YourDetails },
]

const RESTAURANT_STEPS = [
  { id: 'pick-guests-date', component: PickGuestsDate },
  { id: 'pick-time', component: PickTimeSlot },
  { id: 'your-details', component: YourDetailsRestaurant },
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
        setFlowData({
          business: res.business,
          services: res.services,
          staff: res.staff,
          categories: res.categories,
          settings: res.settings,
          slug: businessSlug,
        })
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
    const bizType = data?.business?.type || 'services'
    const maxStep = (bizType === 'restaurant' ? RESTAURANT_STEPS : SERVICES_STEPS).length - 1
    setStep((s) => Math.min(s + 1, maxStep))
    // Scroll to top on step change
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCreate = async (payload) => {
    return createBooking(businessSlug, payload)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FEFBF4]">
        <AppLoader message="Loading booking..." />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FEFBF4] px-5">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
          <span className="text-red-500 text-xl">!</span>
        </div>
        <p className="text-lg font-semibold text-[#111111]">{error || 'Business not found'}</p>
        <p className="text-sm text-gray-500 mt-1">This booking page isn't available right now</p>
      </div>
    )
  }

  const bizType = data.business?.type || 'services'
  const steps = bizType === 'restaurant' ? RESTAURANT_STEPS : SERVICES_STEPS
  const StepComponent = steps[step]?.component

  if (!StepComponent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FEFBF4] px-5">
        <p className="text-gray-500">Something went wrong</p>
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
    <div className="min-h-screen bg-[#FEFBF4] overflow-x-hidden flex items-start justify-center" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Phone-frame on desktop, full-width on mobile */}
      <div className="w-full sm:max-w-[400px] sm:my-6 sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-xl sm:bg-[#FEFBF4] sm:overflow-hidden min-h-screen sm:min-h-0">
        <StepComponent
          data={stepData}
          onContinue={handleContinue}
          onBack={handleBack}
          onCreate={handleCreate}
        />
        <p className="text-center text-xs text-gray-400 pb-4 pt-2">Powered by <a href="https://reeveos.app" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#111111] hover:underline">ReeveOS</a></p>
      </div>
    </div>
  )
}

export default BookingFlow
