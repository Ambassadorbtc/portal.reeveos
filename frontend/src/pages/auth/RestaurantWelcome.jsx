/**
 * RestaurantWelcome — matching UXPilot 12-Design App - Welcome.html
 * Split layout: Brand hero (left) + Welcome options (right)
 * Options: Create Account, Sign In
 */
import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed, ArrowRight, ArrowLeft, CalendarCheck, Users, BarChart3, Star } from 'lucide-react'

const FEATURES = [
  { icon: <CalendarCheck className="w-5 h-5" />, title: 'Smart Reservations', desc: 'Automated booking management with real-time table availability' },
  { icon: <Users className="w-5 h-5" />, title: 'Guest CRM', desc: 'Build lasting relationships with detailed guest profiles' },
  { icon: <BarChart3 className="w-5 h-5" />, title: 'Analytics', desc: 'Track covers, revenue, and growth at a glance' },
  { icon: <Star className="w-5 h-5" />, title: 'Zero Commission', desc: 'Keep 100% of your revenue — no hidden platform fees' },
]

const RestaurantWelcome = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Left: Brand Hero */}
      <section className="hidden lg:flex lg:w-1/2 xl:w-7/12 bg-[#111111] relative overflow-hidden flex-col justify-between p-12 text-white h-screen">
        {/* Background pattern */}
        <div className="absolute inset-0 z-0 opacity-10">
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full border border-white/20" />
          <div className="absolute bottom-40 left-10 w-48 h-48 rounded-full border border-white/10" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-[#D4A373]/20" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 bg-[#D4A373] rounded-xl flex items-center justify-center shadow-md">
            <span className="text-[#111111] font-bold text-xl">R.</span>
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-white">ReeveOS</span>
        </div>

        {/* Features */}
        <div className="relative z-10 max-w-lg space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#D4A373]/20 rounded-full text-[#D4A373] text-sm font-bold mb-6">
              <UtensilsCrossed className="w-4 h-4" /> For Restaurants
            </div>
            <h2 className="text-4xl xl:text-5xl font-extrabold leading-tight mb-4">
              Champion your<br />high street
            </h2>
            <p className="text-white/70 text-lg">
              The zero-commission platform built to help independent restaurants thrive.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-[#D4A373]/20 text-[#D4A373] flex items-center justify-center mb-2">
                  {f.icon}
                </div>
                <h4 className="font-bold text-sm mb-1">{f.title}</h4>
                <p className="text-white/60 text-xs">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={() => navigate('/get-started')}
          className="relative z-10 w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white/70 hover:text-white hover:border-white/60 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </section>

      {/* Right: Welcome options */}
      <section className="w-full lg:w-1/2 xl:w-5/12 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-24 bg-[#FEFBF4] h-screen overflow-y-auto">
        <div className="w-full max-w-md space-y-10">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#D4A373] rounded-xl flex items-center justify-center shadow-md">
                <span className="text-[#111111] font-bold text-lg">R.</span>
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-[#111111]">ReeveOS</span>
            </div>
          </div>

          {/* Welcome text */}
          <div className="text-center lg:text-left space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#111111]/10 rounded-full text-[#111111] text-sm font-bold lg:hidden">
              <UtensilsCrossed className="w-4 h-4" /> For Restaurants
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111111]">
              Welcome to ReeveOS
            </h1>
            <p className="text-gray-500 text-lg">
              Get your restaurant online in minutes. No contracts, no commission.
            </p>
          </div>

          {/* Action Cards */}
          <div className="space-y-4">
            {/* Create Account */}
            <button
              onClick={() => navigate('/register')}
              className="w-full bg-[#111111] text-white rounded-2xl p-6 flex items-center gap-4 hover:bg-[#1a1a1a] transition-all shadow-lg group text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">Create an Account</h3>
                <p className="text-white/70 text-sm">Set up your restaurant in 5 minutes — completely free</p>
              </div>
              <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
            </button>

            {/* Sign In */}
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-white text-[#111111] rounded-2xl p-6 flex items-center gap-4 border-2 border-gray-100 hover:border-[#111111]/30 transition-all shadow-sm group text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-[#111111]/10 flex items-center justify-center shrink-0 group-hover:bg-[#111111]/20 transition-colors">
                <ArrowRight className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">Sign In</h3>
                <p className="text-gray-500 text-sm">Already have an account? Welcome back!</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-[#111111] group-hover:translate-x-1 transition-all shrink-0" />
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              Free forever plan
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              No credit card
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              Cancel anytime
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}

export default RestaurantWelcome
