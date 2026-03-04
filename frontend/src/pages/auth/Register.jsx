/**
 * Register — split layout matching Login page design
 * Left: brand hero / Right: signup form
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Eye, EyeOff, UtensilsCrossed, User, Building2, ArrowRight } from 'lucide-react'

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'owner'
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()

  const update = (key, val) => setFormData((p) => ({ ...p, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role
    })

    if (result.success) {
      navigate(formData.role === 'owner' ? '/onboarding' : '/dashboard')
    } else {
      setError(result.error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* Left: Brand Hero */}
      <section className="hidden lg:flex lg:w-1/2 xl:w-7/12 bg-primary relative overflow-hidden flex-col justify-between p-12 text-white h-screen">
        <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/80 to-[#111111]/40 z-0" />

        {/* Logo */}
        <a href="/" className="relative z-10 flex items-center gap-3 no-underline">
          <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-[#D4A017] font-extrabold text-2xl" style={{fontFamily:'Figtree,sans-serif'}}>R</span>
          </div>
          <span className="font-heading font-extrabold text-2xl tracking-tight text-white">ReeveOS</span>
        </a>

        {/* Testimonial */}
        <div className="relative z-10 max-w-xl mb-12">
          <div className="flex gap-1 mb-6 text-yellow-400">
            {[1,2,3,4,5].map(i => <i key={i} className="fa-solid fa-star" />)}
          </div>
          <h2 className="font-heading text-4xl xl:text-5xl font-bold leading-tight mb-6">
            "We switched from OpenTable and saved over £800 a month. Setup took 5 minutes."
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">MK</div>
            <div>
              <p className="font-bold text-lg">Marcus Kennedy</p>
              <p className="text-white/70 text-sm">Owner, The Kitchen Nottingham</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-6">
          {[
            { num: '2,400+', label: 'Businesses' },
            { num: '£0', label: 'Commission' },
            { num: '5 min', label: 'Setup' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-extrabold">{s.num}</div>
              <div className="text-white/50 text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Back button - bottom left */}
        <a href="/" className="relative z-10 w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white/70 hover:text-white hover:border-white/60 transition-all no-underline">
          <i className="fa-solid fa-arrow-left text-sm" />
        </a>
      </section>

      {/* Right: Register Form */}
      <section className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-background font-heading font-bold text-sm">R</span>
            </div>
            <span className="font-heading font-bold text-primary text-xl">ReeveOS</span>
          </div>

          <h1 className="text-3xl font-heading font-extrabold text-primary mb-1">Create your account</h1>
          <p className="text-gray-500 mb-8 font-body text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">Log in</Link>
          </p>

          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role selector */}
            <div>
              <label className="block text-sm font-bold text-primary mb-2">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'owner', label: 'Business Owner', desc: 'Manage bookings', Icon: Building2 },
                  { value: 'diner', label: 'Diner', desc: 'Book venues', Icon: User },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update('role', opt.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                      formData.role === opt.value
                        ? 'border-primary bg-primary/[0.04]'
                        : 'border-border bg-white hover:border-primary/30'
                    }`}
                  >
                    <opt.Icon size={20} className={formData.role === opt.value ? 'text-primary' : 'text-gray-400'} />
                    <p className="font-bold text-primary text-sm mt-2">{opt.label}</p>
                    <p className="text-gray-400 text-xs">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-primary mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="John Smith"
                className="w-full px-4 py-3 border border-border rounded-xl text-sm font-medium text-primary bg-white focus:ring-2 focus:ring-primary/15 focus:border-primary outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-primary mb-1.5">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-border rounded-xl text-sm font-medium text-primary bg-white focus:ring-2 focus:ring-primary/15 focus:border-primary outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-primary mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-3 border border-border rounded-xl text-sm font-medium text-primary bg-white focus:ring-2 focus:ring-primary/15 focus:border-primary outline-none transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-primary mb-1.5">Confirm Password</label>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                placeholder="Repeat your password"
                className="w-full px-4 py-3 border border-border rounded-xl text-sm font-medium text-primary bg-white focus:ring-2 focus:ring-primary/15 focus:border-primary outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-all shadow-lg disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                <>Create Account <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-6 text-center font-body">
            By signing up you agree to our{' '}
            <a href="/terms.html" className="underline hover:text-primary" target="_blank" rel="noreferrer">Terms</a>
            {' '}and{' '}
            <a href="/privacy.html" className="underline hover:text-primary" target="_blank" rel="noreferrer">Privacy Policy</a>
          </p>
        </div>
      </section>
    </div>
  )
}

export default Register
