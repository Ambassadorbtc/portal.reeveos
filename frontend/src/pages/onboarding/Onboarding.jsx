/**
 * Onboarding wizard — polished, 5-step setup for new business owners
 * Uses UX Pilot design system
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../utils/api'
import {
  UtensilsCrossed, Scissors, Sparkles, Heart,
  ArrowRight, ArrowLeft, Check, MapPin, Phone, Mail,
  Clock, Building2, Rocket, ChevronRight,
  Coffee, Beer, Pizza, Stethoscope, Eye, Dog, Dumbbell,
  Camera, Paintbrush, Music, Wrench, Flower2, Baby, GraduationCap
} from 'lucide-react'

const STEPS = ['Business Type', 'Details', 'Hours', 'Plan', 'Services', 'Team', 'Ready!']

const BUSINESS_TYPES = [
  // Food & Drink
  { value: 'restaurant', label: 'Restaurant', desc: 'Fine dining, casual, family restaurants', Icon: UtensilsCrossed, color: 'bg-orange-50 text-orange-600', group: 'Food & Drink' },
  { value: 'cafe', label: 'Café / Coffee Shop', desc: 'Cafés, coffee shops, bakeries', Icon: Coffee, color: 'bg-amber-50 text-amber-700', group: 'Food & Drink' },
  { value: 'bar', label: 'Bar / Pub', desc: 'Bars, pubs, cocktail lounges', Icon: Beer, color: 'bg-yellow-50 text-yellow-700', group: 'Food & Drink' },
  { value: 'takeaway', label: 'Takeaway / Fast Food', desc: 'Takeaways, fast food, delivery', Icon: Pizza, color: 'bg-red-50 text-red-600', group: 'Food & Drink' },
  // Hair & Grooming
  { value: 'salon', label: 'Hair Salon', desc: 'Hair styling, colouring, treatments', Icon: Scissors, color: 'bg-pink-50 text-pink-600', group: 'Hair & Grooming' },
  { value: 'barber', label: 'Barber Shop', desc: "Men's grooming & barber services", Icon: Scissors, color: 'bg-blue-50 text-blue-600', group: 'Hair & Grooming' },
  // Beauty & Aesthetics
  { value: 'beauty', label: 'Beauty Salon', desc: 'Makeup, lashes, brows, tanning', Icon: Sparkles, color: 'bg-pink-50 text-pink-500', group: 'Beauty & Aesthetics' },
  { value: 'aesthetics', label: 'Aesthetics Clinic', desc: 'Skin treatments, injectables, peels', Icon: Heart, color: 'bg-rose-50 text-rose-600', group: 'Beauty & Aesthetics' },
  { value: 'nails', label: 'Nail Salon', desc: 'Manicures, pedicures, nail art', Icon: Paintbrush, color: 'bg-fuchsia-50 text-fuchsia-600', group: 'Beauty & Aesthetics' },
  { value: 'tattoo', label: 'Tattoo & Piercing', desc: 'Tattoo studios, piercings', Icon: Paintbrush, color: 'bg-gray-100 text-gray-700', group: 'Beauty & Aesthetics' },
  // Wellness & Fitness
  { value: 'spa', label: 'Spa & Wellness', desc: 'Massage, facials, holistic treatments', Icon: Sparkles, color: 'bg-purple-50 text-purple-600', group: 'Wellness & Fitness' },
  { value: 'massage', label: 'Massage Therapy', desc: 'Sports, deep tissue, relaxation', Icon: Heart, color: 'bg-teal-50 text-teal-600', group: 'Wellness & Fitness' },
  { value: 'personal_trainer', label: 'Personal Trainer', desc: 'PT sessions, fitness coaching', Icon: Dumbbell, color: 'bg-green-50 text-green-600', group: 'Wellness & Fitness' },
  { value: 'yoga', label: 'Yoga / Pilates', desc: 'Yoga, pilates, meditation classes', Icon: Flower2, color: 'bg-indigo-50 text-indigo-500', group: 'Wellness & Fitness' },
  { value: 'gym', label: 'Gym / Fitness Studio', desc: 'Gyms, CrossFit, spin studios', Icon: Dumbbell, color: 'bg-slate-100 text-slate-700', group: 'Wellness & Fitness' },
  // Health
  { value: 'physiotherapy', label: 'Physiotherapy', desc: 'Physio, chiropractic, osteopathy', Icon: Stethoscope, color: 'bg-cyan-50 text-cyan-600', group: 'Health' },
  { value: 'dental', label: 'Dental Practice', desc: 'Dentists, hygienists, orthodontics', Icon: Stethoscope, color: 'bg-sky-50 text-sky-600', group: 'Health' },
  { value: 'optician', label: 'Optician', desc: 'Eye tests, glasses, contact lenses', Icon: Eye, color: 'bg-blue-50 text-blue-500', group: 'Health' },
  { value: 'vet', label: 'Veterinary', desc: 'Vets, pet grooming, animal care', Icon: Dog, color: 'bg-emerald-50 text-emerald-600', group: 'Health' },
  // Other Services
  { value: 'photography', label: 'Photography', desc: 'Studios, weddings, events', Icon: Camera, color: 'bg-violet-50 text-violet-600', group: 'Other Services' },
  { value: 'tutoring', label: 'Tutoring / Classes', desc: 'Music lessons, tutoring, workshops', Icon: GraduationCap, color: 'bg-amber-50 text-amber-600', group: 'Other Services' },
  { value: 'other', label: 'Other', desc: 'Any service-based business', Icon: Building2, color: 'bg-gray-50 text-gray-600', group: 'Other Services' },
]

const PLANS = [
  { tier: 'free', name: 'Free', price: '£0', period: '/mo', desc: 'Get started', features: ['1 staff login', '100 bookings/mo', 'Basic listing', 'Email support'], cta: 'Start Free' },
  { tier: 'starter', name: 'Starter', price: '£8.99', period: '/mo', desc: 'Small teams', features: ['3 staff logins', '500 bookings/mo', 'Online booking page', 'SMS reminders'], cta: 'Choose Starter', popular: false },
  { tier: 'growth', name: 'Growth', price: '£29', period: '/mo', desc: 'Growing businesses', features: ['5 staff logins', 'Unlimited bookings', 'Deposit collection', 'CRM & analytics', 'Priority support'], cta: 'Choose Growth', popular: true },
  { tier: 'scale', name: 'Scale', price: '£59', period: '/mo', desc: 'Full power', features: ['Unlimited staff', 'Floor plan', 'White-label page', 'API access', 'Dedicated manager'], cta: 'Choose Scale' },
]

const DEFAULT_HOURS = {
  mon: { open: '09:00', close: '17:00', closed: false },
  tue: { open: '09:00', close: '17:00', closed: false },
  wed: { open: '09:00', close: '17:00', closed: false },
  thu: { open: '09:00', close: '17:00', closed: false },
  fri: { open: '09:00', close: '17:00', closed: false },
  sat: { open: '10:00', close: '16:00', closed: false },
  sun: { open: '10:00', close: '16:00', closed: true },
}

const DAY_LABELS = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdBusinessId, setCreatedBusinessId] = useState(null)
  const [newServices, setNewServices] = useState([{ name: '', duration: 60, price: 0 }])
  const [newStaff, setNewStaff] = useState([{ name: '', email: '', role: 'staff' }])
  const [form, setForm] = useState({
    category: '',
    name: '',
    address: '',
    city: '',
    postcode: '',
    phone: '',
    email: user?.email || '',
    hours: { ...DEFAULT_HOURS },
    tier: 'free',
  })

  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }))
  const updateHour = (day, field, val) => {
    setForm((p) => ({
      ...p,
      hours: { ...p.hours, [day]: { ...p.hours[day], [field]: val } },
    }))
  }

  const isRestaurant = ['restaurant', 'cafe', 'bar', 'pub', 'takeaway'].includes(form.category)

  const canProceed = () => {
    if (step === 0) return !!form.category
    if (step === 1) return form.name && form.address && form.city && form.postcode && form.phone
    return true
  }

  const saveServices = async () => {
    if (!createdBusinessId) return
    setLoading(true)
    try {
      const valid = newServices.filter(s => s.name.trim())
      for (const svc of valid) {
        await api.post(`/services/business/${createdBusinessId}/services`, {
          name: svc.name.trim(),
          duration_minutes: parseInt(svc.duration) || 60,
          price: parseFloat(svc.price) || 0,
          category: 'General',
          active: true,
        })
      }
    } catch (err) {
      console.error('Service save error:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveStaff = async () => {
    if (!createdBusinessId) return
    setLoading(true)
    try {
      const valid = newStaff.filter(s => s.name.trim())
      for (const member of valid) {
        await api.post(`/staff/business/${createdBusinessId}/staff`, {
          name: member.name.trim(),
          email: member.email.trim(),
          role: member.role || 'staff',
        })
      }
    } catch (err) {
      console.error('Staff save error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    setLoading(true)
    try {
      // Map frontend tier to backend tier
      const tierMap = { free: 'solo', starter: 'team', growth: 'venue', scale: 'venue' }
      
      // Build opening_hours in the format the backend expects
      const openingHours = {}
      const dayMap = { mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday' }
      Object.entries(form.hours).forEach(([key, val]) => {
        openingHours[dayMap[key]] = val.closed 
          ? { open: '', close: '', closed: true }
          : { open: val.open, close: val.close, closed: false }
      })

      const payload = {
        name: form.name,
        category: form.category,
        address: form.address,
        city: form.city,
        postcode: form.postcode,
        phone: form.phone,
        email: form.email,
        tier: tierMap[form.tier] || 'solo',
        opening_hours: openingHours,
      }

      const created = await api.post('/businesses/', payload)
      
      // Store created business ID for services/staff steps
      const bizId = created.id || created._id
      setCreatedBusinessId(bizId)
      
      // Refresh user data so business_ids is populated
      const updatedUser = await api.get('/users/me')
      localStorage.setItem('user', JSON.stringify(updatedUser))
      
      setStep(4) // Move to Add Services step
    } catch (err) {
      console.error('Business creation failed:', err)
      setError(err.message || 'Failed to create business. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const next = async () => {
    if (step === 3) return handleComplete()
    if (step === 4) { await saveServices(); setStep(5); return }
    if (step === 5) { await saveStaff(); setStep(6); return }
    setStep((s) => Math.min(s + 1, 6))
  }
  const back = () => { if (step <= 3) setStep((s) => Math.max(s - 1, 0)) }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-16 bg-white border-b border-border flex items-center px-6 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-background font-heading font-bold text-sm">R.</span>
          </div>
          <span className="font-heading font-bold text-primary text-lg">ReeveOS</span>
        </div>
        {step < 6 && (
          <div className="ml-auto text-sm text-gray-400">
            Step {step + 1} of 6
          </div>
        )}
      </header>

      {/* Progress bar */}
      {step < 6 && (
        <div className="h-1 bg-border">
          <div
            className="h-full bg-primary rounded-r-full transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / 6) * 100}%` }}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">

          {/* Error message */}
          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium text-center">
              {error}
            </div>
          )}

          {/* ─── Step 0: Business Type ─── */}
          {step === 0 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-primary mb-2">
                  What type of business do you run?
                </h1>
                <p className="text-gray-500 font-body">We'll customise your setup based on this</p>
              </div>

              <div>
                {[...new Set(BUSINESS_TYPES.map(b=>b.group))].map(group=>(
                  <div key={group} className="mb-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{group}</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {BUSINESS_TYPES.filter(b=>b.group===group).map((bt) => {
                        const isSelected = form.category === bt.value
                        return (
                          <button
                            key={bt.value}
                            onClick={() => update('category', bt.value)}
                            className={`relative p-3 rounded-lg border-2 text-left transition-all duration-200 ${
                              isSelected
                                ? 'border-primary bg-primary/[0.04] shadow-sm'
                                : 'border-border bg-white hover:border-primary/30'
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                <Check size={10} className="text-white" />
                              </div>
                            )}
                            <div className={`w-8 h-8 rounded-md ${bt.color} flex items-center justify-center mb-1.5`}>
                              <bt.Icon size={14} />
                            </div>
                            <h3 className="font-heading font-bold text-primary text-xs leading-tight">{bt.label}</h3>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Step 1: Business Details ─── */}
          {step === 1 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-3xl font-heading font-extrabold text-primary mb-2">
                  Tell us about your business
                </h1>
                <p className="text-gray-500 font-body">This info appears on your public listing</p>
              </div>

              <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 space-y-5">
                <Field label="Business Name" required>
                  <input
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="e.g. Burg Burgers Nottingham"
                    className="input-field"
                  />
                </Field>
                <Field label="Street Address" required>
                  <input
                    value={form.address}
                    onChange={(e) => update('address', e.target.value)}
                    placeholder="123 High Street"
                    className="input-field"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="City" required>
                    <input
                      value={form.city}
                      onChange={(e) => update('city', e.target.value)}
                      placeholder="Nottingham"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Postcode" required>
                    <input
                      value={form.postcode}
                      onChange={(e) => update('postcode', e.target.value)}
                      placeholder="NG1 1AB"
                      className="input-field"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Phone">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      placeholder="0115 123 4567"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      placeholder="hello@yourbusiness.com"
                      className="input-field"
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Opening Hours ─── */}
          {step === 2 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-3xl font-heading font-extrabold text-primary mb-2">
                  Set your opening hours
                </h1>
                <p className="text-gray-500 font-body">You can change these anytime in Settings</p>
              </div>

              <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 space-y-3">
                {Object.entries(DAY_LABELS).map(([key, label]) => {
                  const day = form.hours[key]
                  return (
                    <div key={key} className="flex items-center gap-4 py-2">
                      <div className="w-24 shrink-0">
                        <span className="text-sm font-bold text-primary">{label}</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={!day.closed}
                          onChange={() => updateHour(key, 'closed', !day.closed)}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                        />
                        <span className="text-xs text-gray-500">{day.closed ? 'Closed' : 'Open'}</span>
                      </label>
                      {!day.closed && (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            value={day.open}
                            onChange={(e) => updateHour(key, 'open', e.target.value)}
                            className="input-field !py-2 text-center flex-1"
                          />
                          <span className="text-gray-400 text-sm">to</span>
                          <input
                            type="time"
                            value={day.close}
                            onChange={(e) => updateHour(key, 'close', e.target.value)}
                            className="input-field !py-2 text-center flex-1"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── Step 3: Choose Plan ─── */}
          {step === 3 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-10">
                <h1 className="text-3xl font-heading font-extrabold text-primary mb-2">
                  Choose your plan
                </h1>
                <p className="text-gray-500 font-body">Start free, upgrade anytime. No contracts.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PLANS.map((plan) => {
                  const isSelected = form.tier === plan.tier
                  return (
                    <button
                      key={plan.tier}
                      onClick={() => update('tier', plan.tier)}
                      className={`relative p-6 rounded-2xl border-2 text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-primary bg-primary/[0.04] shadow-md'
                          : 'border-border bg-white hover:border-primary/30 hover:shadow-sm'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-2.5 right-4 px-3 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                          Popular
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check size={14} className="text-white" />
                        </div>
                      )}
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-2xl font-extrabold text-primary">{plan.price}</span>
                        <span className="text-gray-400 text-sm">{plan.period}</span>
                      </div>
                      <h3 className="font-heading font-bold text-primary">{plan.name}</h3>
                      <p className="text-gray-500 text-xs mt-1 mb-3 font-body">{plan.desc}</p>
                      <ul className="space-y-1.5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-xs text-gray-500">
                            <Check size={12} className="text-green-500 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── Step 4: Add Services ─── */}
          {step === 4 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Scissors className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-3xl font-heading font-extrabold text-primary mb-2">
                  {isRestaurant ? 'Add your menu items' : 'Add your services'}
                </h1>
                <p className="text-gray-500 font-body text-sm">You can always add more later from your dashboard</p>
              </div>

              <div className="space-y-3 max-w-lg mx-auto">
                {newServices.map((svc, i) => (
                  <div key={i} className="bg-white rounded-xl border border-border p-4">
                    <div className="flex gap-3 mb-3">
                      <input value={svc.name} onChange={e => { const s = [...newServices]; s[i].name = e.target.value; setNewServices(s) }}
                        placeholder={isRestaurant ? 'e.g. Margherita Pizza' : 'e.g. Microneedling Facial'}
                        className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary bg-white focus:ring-2 focus:ring-primary/15 focus:border-primary outline-none" />
                      {newServices.length > 1 && (
                        <button onClick={() => setNewServices(s => s.filter((_, j) => j !== i))}
                          className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200">×</button>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-gray-400 mb-1 block">{isRestaurant ? 'Prep time (min)' : 'Duration (min)'}</label>
                        <input type="number" value={svc.duration} onChange={e => { const s = [...newServices]; s[i].duration = e.target.value; setNewServices(s) }}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm text-primary outline-none focus:border-primary" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-bold text-gray-400 mb-1 block">Price (£)</label>
                        <input type="number" step="0.01" value={svc.price} onChange={e => { const s = [...newServices]; s[i].price = e.target.value; setNewServices(s) }}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm text-primary outline-none focus:border-primary" />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => setNewServices(s => [...s, { name: '', duration: 60, price: 0 }])}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/30 text-sm font-medium text-gray-400 hover:text-primary transition-all">
                  + Add another {isRestaurant ? 'item' : 'service'}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 5: Add Staff ─── */}
          {step === 5 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-3xl font-heading font-extrabold text-primary mb-2">
                  Add your team
                </h1>
                <p className="text-gray-500 font-body text-sm">Invite staff so they can manage bookings and view their schedule</p>
              </div>

              <div className="space-y-3 max-w-lg mx-auto">
                {newStaff.map((member, i) => (
                  <div key={i} className="bg-white rounded-xl border border-border p-4">
                    <div className="flex gap-3 mb-3">
                      <input value={member.name} onChange={e => { const s = [...newStaff]; s[i].name = e.target.value; setNewStaff(s) }}
                        placeholder="Full name"
                        className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm font-medium text-primary bg-white focus:ring-2 focus:ring-primary/15 focus:border-primary outline-none" />
                      {newStaff.length > 1 && (
                        <button onClick={() => setNewStaff(s => s.filter((_, j) => j !== i))}
                          className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200">×</button>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-gray-400 mb-1 block">Email</label>
                        <input type="email" value={member.email} onChange={e => { const s = [...newStaff]; s[i].email = e.target.value; setNewStaff(s) }}
                          placeholder="staff@example.com"
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm text-primary outline-none focus:border-primary" />
                      </div>
                      <div className="w-36">
                        <label className="text-xs font-bold text-gray-400 mb-1 block">Role</label>
                        <select value={member.role} onChange={e => { const s = [...newStaff]; s[i].role = e.target.value; setNewStaff(s) }}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm text-primary outline-none focus:border-primary bg-white">
                          <option value="staff">{isRestaurant ? 'Server' : 'Therapist'}</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => setNewStaff(s => [...s, { name: '', email: '', role: 'staff' }])}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/30 text-sm font-medium text-gray-400 hover:text-primary transition-all">
                  + Add another team member
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 6: Success ─── */}
          {step === 6 && (
            <div className="animate-fadeIn text-center">
              <div className="w-20 h-20 rounded-3xl bg-green-50 flex items-center justify-center mx-auto mb-6">
                <Rocket className="w-9 h-9 text-green-600" />
              </div>
              <h1 className="text-4xl font-heading font-extrabold text-primary mb-3">
                You're all set!
              </h1>
              <p className="text-gray-500 text-lg mb-2 font-body">
                <strong className="text-primary">{form.name || 'Your business'}</strong> is now live on ReeveOS.
              </p>
              <p className="text-gray-400 text-sm mb-10 font-body">
                Your {isRestaurant ? 'menu' : 'services'} and team are ready. Head to your dashboard to start taking bookings.
              </p>

              <div className="bg-white rounded-2xl border border-border p-6 max-w-md mx-auto mb-8">
                <div className="space-y-3 text-left">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Check size={16} className="text-green-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-600">Business created</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Check size={16} className="text-green-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-600">{newServices.filter(s => s.name.trim()).length > 0 ? `${newServices.filter(s => s.name.trim()).length} ${isRestaurant ? 'menu items' : 'services'} added` : `${isRestaurant ? 'Menu' : 'Services'} — add later`}</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Check size={16} className="text-green-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-600">{newStaff.filter(s => s.name.trim()).length > 0 ? `${newStaff.filter(s => s.name.trim()).length} team members invited` : 'Team — invite later'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  window.location.href = '/dashboard'
                }}
                className="px-8 py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-all shadow-lg text-sm"
              >
                Go to Dashboard <ArrowRight className="inline ml-2 w-4 h-4" />
              </button>
            </div>
          )}

          {/* Navigation buttons */}
          {step < 6 && (
            <div className="flex items-center justify-between mt-8">
              {step > 0 && step <= 3 ? (
                <button
                  onClick={back}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-500 hover:text-primary rounded-xl hover:bg-white transition-all"
                >
                  <ArrowLeft size={16} /> Back
                </button>
              ) : step >= 4 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-400 hover:text-primary rounded-xl hover:bg-white transition-all"
                >
                  Skip for now
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={next}
                disabled={!canProceed() || loading}
                className="flex items-center gap-2 px-7 py-3 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary-hover transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {step === 3 ? 'Creating...' : 'Saving...'}
                  </span>
                ) : step === 3 ? (
                  <>Complete Setup <Check size={16} /></>
                ) : step === 4 || step === 5 ? (
                  <>Save & Continue <ArrowRight size={16} /></>
                ) : (
                  <>Continue <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .input-field {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #E8E0D4;
          border-radius: 12px;
          font-size: 14px;
          font-family: 'Figtree', sans-serif;
          color: #111111;
          background: white;
          outline: none;
          transition: all 200ms;
        }
        .input-field:focus {
          border-color: #111111;
          box-shadow: 0 0 0 3px rgba(17,17,17,0.08);
        }
        .input-field::placeholder {
          color: #9CA3AF;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 400ms cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
        }
      `}</style>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-bold text-primary mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}
