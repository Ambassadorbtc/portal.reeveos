/**
 * Login — Hospitality / Local Services choice + Sign In
 * Split layout: testimonial hero (left) + login form (right)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle, Star, UtensilsCrossed, Scissors } from 'lucide-react'

const MODES = {
  hospitality: {
    quote: "ReeveOS transformed how we manage our restaurant. Bookings are up 40% and we've saved thousands in commissions.",
    name: "Michael Brooks", initials: "MB", role: "Owner, The Oak & Vine",
    placeholder: "name@restaurant.com",
  },
  services: {
    quote: "I left Fresha and finally own my client data. The consultation forms alone saved me hours every week.",
    name: "Natalie Price", initials: "NP", role: "Owner, Rejuvenate Skin Experts",
    placeholder: "name@yourbusiness.com",
  },
}

const Login = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState(null) // null = choose, 'hospitality' | 'services'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const t = MODES[mode] || MODES.hospitality

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    if (result.success) {
      // Store selected business type for TierContext to filter
      sessionStorage.setItem('login_business_type', mode)
      navigate('/dashboard')
    }
    else { setError(result.error || 'Invalid email or password') }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Left: Brand Hero */}
      <section className="hidden lg:flex lg:w-1/2 xl:w-7/12 bg-[#111111] relative overflow-hidden flex-col justify-between p-12 text-white h-screen">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/80 to-[#111111]/40" />
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full border border-white/5" />
          <div className="absolute bottom-40 left-10 w-48 h-48 rounded-full border border-white/5" />
        </div>

        <a href="https://reeveos.app" className="relative z-10 flex items-center gap-3 no-underline">
          <div className="w-11 h-11 bg-[#C9A84C] rounded-xl flex items-center justify-center shadow-md">
            <span className="text-[#111111] font-bold text-xl">R.</span>
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-white">ReeveOS</span>
        </a>

        {mode && (
          <div className="relative z-10 max-w-xl mb-12">
            <div className="flex gap-1 mb-6 text-yellow-400">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-current" />)}
            </div>
            <h2 className="text-4xl xl:text-5xl font-extrabold leading-tight mb-6">
              "{t.quote}"
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#C9A84C]/30 flex items-center justify-center text-white font-bold text-lg">{t.initials}</div>
              <div>
                <p className="font-bold text-lg">{t.name}</p>
                <p className="text-white/70 text-sm">{t.role}</p>
              </div>
            </div>
          </div>
        )}

        {!mode && (
          <div className="relative z-10 max-w-xl mb-12">
            <h2 className="text-5xl xl:text-6xl font-extrabold leading-tight mb-4">
              Welcome back.
            </h2>
            <p className="text-white/60 text-lg">Choose your business type to sign in.</p>
          </div>
        )}

        <a href="https://reeveos.app" className="relative z-10 w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white/70 hover:text-white hover:border-white/60 transition-all no-underline">
          <ArrowLeft className="w-4 h-4" />
        </a>
      </section>

      {/* Right */}
      <section className="w-full lg:w-1/2 xl:w-5/12 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-24 bg-[#FEFBF4] h-screen overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#C9A84C] rounded-xl flex items-center justify-center shadow-md">
                <span className="text-[#111111] font-bold text-lg">R.</span>
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-[#111111]">ReeveOS</span>
            </div>
          </div>

          {/* STEP 1: Choose business type */}
          {!mode && (
            <div className="space-y-6">
              <div className="text-center lg:text-left space-y-2">
                <h1 className="text-3xl font-extrabold text-[#111111]">Welcome back</h1>
                <p className="text-gray-500">Select your business type to sign in.</p>
              </div>

              <button onClick={() => setMode('hospitality')}
                className="w-full bg-white rounded-2xl border-2 border-gray-100 hover:border-[#111111] p-6 flex items-center gap-5 transition-all duration-300 shadow-sm hover:shadow-lg text-left group">
                <div className="w-14 h-14 rounded-2xl bg-[#111111]/10 text-[#111111] flex items-center justify-center group-hover:bg-[#111111] group-hover:text-white transition-all duration-300 shrink-0">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#111111]">Hospitality</h3>
                  <p className="text-sm text-gray-500">Restaurants, bars & pubs</p>
                </div>
                <div className="ml-auto text-gray-300 group-hover:text-[#111111] transition-colors">→</div>
              </button>

              <button onClick={() => setMode('services')}
                className="w-full bg-white rounded-2xl border-2 border-gray-100 hover:border-[#111111] p-6 flex items-center gap-5 transition-all duration-300 shadow-sm hover:shadow-lg text-left group">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-[#111111] group-hover:text-white transition-all duration-300 shrink-0">
                  <Scissors className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#111111]">Local Services</h3>
                  <p className="text-sm text-gray-500">Salons, barbers, spas, clinics & more</p>
                </div>
                <div className="ml-auto text-gray-300 group-hover:text-[#111111] transition-colors">→</div>
              </button>

              <p className="text-center text-sm text-gray-500">
                Don't have an account?{' '}
                <a href="/signup" className="font-bold text-[#111111] hover:underline">Create one free</a>
              </p>
            </div>
          )}

          {/* STEP 2: Login form */}
          {mode && (
            <>
              <div className="text-center lg:text-left space-y-2">
                <button onClick={() => setMode(null)} className="text-sm text-gray-400 hover:text-[#111111] flex items-center gap-1 mb-2 transition-colors" style={{ fontFamily: "'Figtree', sans-serif" }}>
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
                <h1 className="text-3xl font-extrabold text-[#111111]">Sign in</h1>
                <p className="text-gray-500">Enter your details to access your dashboard.</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#111111]">Email address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-gray-400" />
                    </div>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg bg-white text-[#111111] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/20 focus:border-[#111111] transition-all text-base"
                      placeholder={t.placeholder} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-[#111111]">Password</label>
                    <a href="#" className="text-sm font-medium text-[#111111] hover:underline">Forgot password?</a>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-gray-400" />
                    </div>
                    <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg bg-white text-[#111111] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/20 focus:border-[#111111] transition-all text-base"
                      placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#111111] transition-colors">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                    className="h-4 w-4 text-[#111111] border-gray-200 rounded cursor-pointer accent-[#111111]" />
                  <label className="ml-2 block text-sm text-gray-500 cursor-pointer select-none">Remember me for 30 days</label>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-lg text-sm font-bold text-white bg-[#111111] hover:bg-[#1a1a1a] transition-all disabled:opacity-50">
                  {loading ? (
                    <><span className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white mr-2" /> Signing in...</>
                  ) : 'Sign in'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500">
                Don't have an account?{' '}
                <a href="/signup" className="font-bold text-[#111111] hover:underline">Create one free</a>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export default Login
