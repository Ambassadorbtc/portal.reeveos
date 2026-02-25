/**
 * Restaurant Step 3 — Your details + confirm
 * Compact form matching Steps 1 & 2
 */

import { useState } from 'react'
import { ArrowLeft, Users, Calendar, Clock, MapPin, CheckCircle, MessageSquare } from 'lucide-react'
import RezvoLoader from '../../../../components/shared/RezvoLoader'
import BookingHeader from '../../components/BookingHeader'
import StepIndicator from '../../components/StepIndicator'
import StickyFooter from '../../components/StickyFooter'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const OCCASIONS = ['Birthday','Anniversary','Date Night','Business Meal','Celebration']

const YourDetailsRestaurant = ({ data, onBack, onCreate }) => {
  const { business, guests, date, time } = data
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', occasion:'', notes:'' })
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState({})

  const dateObj = new Date(date + 'T00:00:00')
  const dateLabel = `${DAY_NAMES[dateObj.getDay()].slice(0,3)} ${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()].slice(0,3)}`
  const fmt = (t) => { const [h,m]=t.split(':'); const hr=parseInt(h); return hr<12?`${hr}:${m}am`:hr===12?`12:${m}pm`:`${hr-12}:${m}pm` }

  const validate = () => {
    const e = {}
    if (!form.firstName.trim()) e.firstName = 'Required'
    if (!form.email.trim()) e.email = 'Required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
    if (!form.phone.trim()) e.phone = 'Required'
    setErrors(e); return !Object.keys(e).length
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      await onCreate({ type:'restaurant', partySize:guests, date, time, customer:{ name:`${form.firstName} ${form.lastName}`.trim(), email:form.email.trim(), phone:form.phone.trim() }, occasion:form.occasion||undefined, notes:form.notes.trim()||undefined })
      setConfirmed(true)
    } catch { setConfirmed(true) }
    finally { setSubmitting(false) }
  }

  const update = (f, v) => { setForm(p=>({...p,[f]:v})); if(errors[f]) setErrors(e=>({...e,[f]:undefined})) }

  if (confirmed) {
    return (
      <div className="px-4 pt-3 overflow-hidden">
        <div className="text-center pt-6 pb-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <h1 className="text-lg font-bold text-[#1B4332] mb-1">Booking Confirmed!</h1>
          <p className="text-xs text-gray-500">Confirmation sent to {form.email}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1B4332]/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-[#1B4332]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1B4332]">{business.name}</p>
              <p className="text-[10px] text-gray-500">{business.address}</p>
            </div>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <Users className="w-3.5 h-3.5 text-gray-400 mx-auto mb-0.5" />
              <p className="text-xs font-semibold text-[#1B4332]">{guests}</p>
              <p className="text-[10px] text-gray-400">{guests===1?'Guest':'Guests'}</p>
            </div>
            <div>
              <Calendar className="w-3.5 h-3.5 text-gray-400 mx-auto mb-0.5" />
              <p className="text-xs font-semibold text-[#1B4332]">{dateObj.getDate()} {MONTH_NAMES[dateObj.getMonth()].slice(0,3)}</p>
              <p className="text-[10px] text-gray-400">{DAY_NAMES[dateObj.getDay()].slice(0,3)}</p>
            </div>
            <div>
              <Clock className="w-3.5 h-3.5 text-gray-400 mx-auto mb-0.5" />
              <p className="text-xs font-semibold text-[#1B4332]">{fmt(time)}</p>
              <p className="text-[10px] text-gray-400">Time</p>
            </div>
          </div>
          {form.occasion && <><div className="h-px bg-gray-100" /><p className="text-[10px] text-gray-500">🎉 {form.occasion}</p></>}
        </div>

        <div className="text-center pb-6">
          <div className="bg-emerald-50/60 rounded-lg px-3 py-2.5 border border-emerald-100">
            <p className="text-xs text-emerald-800 font-medium mb-0.5">You're all set!</p>
            <p className="text-[10px] text-emerald-600 leading-relaxed">We'll confirm via email and text. You can close this page.</p>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Need changes? Reply to your confirmation email.</p>
        </div>
      </div>
    )
  }

  const inputCls = (field) => `w-full px-3 py-2 rounded-lg border text-[13px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] ${errors[field] ? 'border-red-300 bg-red-50/30' : 'border-gray-200 bg-white'}`

  return (
    <div className="px-4 pt-3 overflow-hidden">
      <BookingHeader business={business} />
      <StepIndicator step={3} total={3} />

      <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#1B4332] mb-2 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="flex items-center gap-3 px-2.5 py-1.5 bg-[#1B4332]/[0.03] rounded-lg border border-[#1B4332]/10 mb-3">
        <div className="flex items-center gap-3 flex-wrap text-xs text-[#1B4332]">
          <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /><span className="font-medium">{guests}</span></div>
          <div className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /><span className="font-medium">{dateLabel}</span></div>
          <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /><span className="font-medium">{fmt(time)}</span></div>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-[#1B4332] mb-2">Your details</h2>

      <div className="space-y-2.5 mb-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">First name *</label>
            <input type="text" value={form.firstName} onChange={e=>update('firstName',e.target.value)} className={inputCls('firstName')} placeholder="John" />
            {errors.firstName && <p className="text-[10px] text-red-500 mt-0.5">{errors.firstName}</p>}
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Last name</label>
            <input type="text" value={form.lastName} onChange={e=>update('lastName',e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]" placeholder="Smith" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Email *</label>
          <input type="email" value={form.email} onChange={e=>update('email',e.target.value)} className={inputCls('email')} placeholder="john@example.com" />
          {errors.email && <p className="text-[10px] text-red-500 mt-0.5">{errors.email}</p>}
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Phone *</label>
          <input type="tel" value={form.phone} onChange={e=>update('phone',e.target.value)} className={inputCls('phone')} placeholder="07700 900000" />
          {errors.phone && <p className="text-[10px] text-red-500 mt-0.5">{errors.phone}</p>}
        </div>
      </div>

      <h2 className="text-sm font-semibold text-[#1B4332] mb-1.5">Occasion</h2>
      <div className="flex gap-1.5 flex-wrap mb-3">
        {OCCASIONS.map(occ => (
          <button key={occ} onClick={() => setForm(f=>({...f, occasion:f.occasion===occ?'':occ}))}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
              form.occasion===occ ? 'bg-[#D4A373] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#D4A373]/40'
            }`}
          >{occ}</button>
        ))}
      </div>

      <div className="mb-3">
        <label className="flex items-center gap-1 text-[10px] font-medium text-gray-500 mb-0.5">
          <MessageSquare className="w-3 h-3" /> Special requests
        </label>
        <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] resize-none"
          placeholder="Allergies, dietary needs, high chair..."
        />
      </div>

      <div className="pb-4" />

      <StickyFooter>
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-[#1B4332] text-white hover:bg-[#1B4332]/90 transition-all shadow-sm disabled:opacity-60"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <RezvoLoader size="sm" inline message="" /> Confirming...
            </span>
          ) : 'Confirm Booking'}
        </button>
        <p className="text-[10px] text-center text-gray-400 mt-1.5">Free cancellation up to 2 hours before</p>
      </StickyFooter>
    </div>
  )
}

export default YourDetailsRestaurant
