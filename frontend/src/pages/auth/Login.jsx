/**
 * Login — styled to match 1-Brand Design - Sign In.html
 * Split layout: hero image (left) + login form (right)
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

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
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* Left: Brand Hero */}
      <section className="hidden lg:flex lg:w-1/2 xl:w-7/12 bg-primary relative overflow-hidden flex-col justify-between p-12 text-white h-screen">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-[#1B4332] via-[#1B4332]/80 to-[#1B4332]/40" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 bg-[#52B788] rounded-xl flex items-center justify-center">
            <span className="text-[#D4A017] font-extrabold text-2xl" style={{fontFamily:'Figtree,sans-serif'}}>R</span>
          </div>
          <span className="font-heading font-extrabold text-2xl tracking-tight">Rezvo</span>
        </div>
        <div className="relative z-10 max-w-xl mb-12">
          <div className="flex gap-1 mb-6 text-yellow-400">
            {[1,2,3,4,5].map(i => <i key={i} className="fa-solid fa-star" />)}
          </div>
          <h2 className="font-heading text-4xl xl:text-5xl font-bold leading-tight mb-6">
            "Rezvo transformed how we manage our salon. Bookings are up 40% and I finally have my weekends back."
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">SJ</div>
            <div>
              <p className="font-bold text-lg">Sarah Jenkins</p>
              <p className="text-white/70 text-sm">Owner, The Green Room Spa</p>
            </div>
          </div>
        </div>
      </section>

      {/* Right: Login Form */}
      <section className="w-full lg:w-1/2 xl:w-5/12 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-24 bg-background h-screen overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex items-center gap-2 text-primary">
              <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center">
                <i className="fa-solid fa-calendar-check text-xl" />
              </div>
              <span className="font-heading font-bold text-2xl tracking-tight">Rezvo</span>
            </div>
          </div>

          <div className="text-center lg:text-left space-y-2">
            <h1 className="font-heading text-3xl font-bold text-primary">Welcome back</h1>
            <p className="text-gray-500">Enter your details to access your dashboard.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation" /> {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-primary">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><i className="fa-regular fa-envelope text-gray-400" /></div>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-border rounded-lg bg-white text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-base"
                  placeholder="name@company.com" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-primary">Password</label>
                <a href="#" className="text-sm font-medium text-primary hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><i className="fa-solid fa-lock text-gray-400" /></div>
                <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-border rounded-lg bg-white text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-base"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-primary transition-colors">
                  <i className={`fa-regular ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                className="h-4 w-4 text-primary border-border rounded cursor-pointer" />
              <label className="ml-2 block text-sm text-gray-500 cursor-pointer select-none">Remember me for 30 days</label>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-lg shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary-hover transition-all disabled:opacity-50">
              {loading ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" /> Signing in...</> : 'Sign in'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-background text-gray-500">Or continue with</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-border rounded-lg shadow-sm bg-white text-sm font-medium text-primary hover:bg-gray-50 transition-colors">
              <i className="fa-brands fa-google mr-2 text-lg" /> Google
            </button>
            <button className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-border rounded-lg shadow-sm bg-white text-sm font-medium text-primary hover:bg-gray-50 transition-colors">
              <i className="fa-brands fa-apple mr-2 text-lg" /> Apple
            </button>
          </div>

          <p className="text-center text-sm text-gray-500">
            Don't have an account? <a href="/register" className="font-bold text-primary hover:underline">Create one free</a>
          </p>
        </div>
      </section>
    </div>
  )
}

export default Login
