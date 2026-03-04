/**
 * Login — Restaurant Sign In page
 * Matching UXPilot 2-Design App - Sign In.html
 * Split layout: testimonial hero (left) + login form (right)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle, Star } from 'lucide-react'

const Login = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    const result = await login(email, password)
    
    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error || 'Invalid email or password')
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Left: Brand Hero */}
      <section className="hidden lg:flex lg:w-1/2 xl:w-7/12 bg-[#111111] relative overflow-hidden flex-col justify-between p-12 text-white h-screen">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/80 to-[#111111]/40" />
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full border border-white/5" />
          <div className="absolute bottom-40 left-10 w-48 h-48 rounded-full border border-white/5" />
        </div>

        {/* Logo */}
        <a href="https://reeveos.app" className="relative z-10 flex items-center gap-3 no-underline">
          <div className="w-11 h-11 bg-[#D4A373] rounded-xl flex items-center justify-center shadow-md">
            <span className="text-[#111111] font-bold text-xl">R.</span>
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-white">ReeveOS</span>
        </a>

        {/* Testimonial */}
        <div className="relative z-10 max-w-xl mb-12">
          <div className="flex gap-1 mb-6 text-yellow-400">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-current" />)}
          </div>
          <h2 className="text-4xl xl:text-5xl font-extrabold leading-tight mb-6">
            "ReeveOS transformed how we manage our restaurant. Bookings are up 40% and we've saved thousands in commissions."
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#D4A373]/30 flex items-center justify-center text-white font-bold text-lg">MB</div>
            <div>
              <p className="font-bold text-lg">Michael Brooks</p>
              <p className="text-white/70 text-sm">Owner, The Oak & Vine</p>
            </div>
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={() => navigate('/login/restaurant')}
          className="relative z-10 w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white/70 hover:text-white hover:border-white/60 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </section>

      {/* Right: Login Form */}
      <section className="w-full lg:w-1/2 xl:w-5/12 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-24 bg-[#FEFBF4] h-screen overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#D4A373] rounded-xl flex items-center justify-center shadow-md">
                <span className="text-[#111111] font-bold text-lg">R.</span>
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-[#111111]">ReeveOS</span>
            </div>
          </div>

          <div className="text-center lg:text-left space-y-2">
            <h1 className="text-3xl font-extrabold text-[#111111]">Welcome back</h1>
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
                  placeholder="name@restaurant.com" />
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
                <>
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white mr-2" />
                  Signing in...
                </>
              ) : 'Sign in'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-[#FEFBF4] text-gray-500">Or continue with</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-200 rounded-lg shadow-sm bg-white text-sm font-medium text-[#111111] hover:bg-gray-50 transition-colors gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
            <button className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-200 rounded-lg shadow-sm bg-white text-sm font-medium text-[#111111] hover:bg-gray-50 transition-colors gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              Apple
            </button>
          </div>

          <p className="text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <a href="/register" className="font-bold text-[#111111] hover:underline">Create one free</a>
          </p>
        </div>
      </section>
    </div>
  )
}

export default Login
