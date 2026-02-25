/**
 * BusinessTypeSelector — first step in login flow
 * User chooses: Restaurants or Local Services
 * Then redirected to the appropriate welcome/sign-in page
 */
import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed, Scissors, ArrowLeft } from 'lucide-react'

const BusinessTypeSelector = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#FEFBF4] flex flex-col" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Top bar */}
      <div className="p-6 flex items-center justify-between">
        <a href="https://rezvo.app" className="flex items-center gap-3 no-underline">
          <div className="w-10 h-10 bg-[#D4A373] rounded-xl flex items-center justify-center shadow-md">
            <span className="text-[#1B4332] font-bold text-lg">R.</span>
          </div>
          <span className="font-extrabold text-xl tracking-tight text-[#1B4332]">Rezvo</span>
        </a>
        <a href="https://rezvo.app" className="text-sm text-gray-500 hover:text-[#1B4332] flex items-center gap-2 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to website
        </a>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-xl text-center space-y-10">
          {/* Heading */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1B4332]">
              What type of business are you?
            </h1>
            <p className="text-gray-500 text-lg">
              Choose your industry to get started with Rezvo
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Restaurants */}
            <button
              onClick={() => navigate('/login/restaurant')}
              className="group bg-white rounded-2xl border-2 border-gray-100 hover:border-[#1B4332] p-8 flex flex-col items-center gap-4 transition-all duration-300 shadow-sm hover:shadow-[0_10px_30px_-5px_rgba(27,67,50,0.15)] text-left"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#1B4332]/10 text-[#1B4332] flex items-center justify-center group-hover:bg-[#1B4332] group-hover:text-white transition-all duration-300">
                <UtensilsCrossed className="w-7 h-7" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-[#1B4332] mb-1">Restaurants</h3>
                <p className="text-sm text-gray-500">
                  Table bookings, floor plans, reservations & delivery
                </p>
              </div>
              <div className="mt-2 px-4 py-2 rounded-lg bg-[#1B4332]/5 text-[#1B4332] text-xs font-bold group-hover:bg-[#1B4332] group-hover:text-white transition-all">
                Get Started →
              </div>
            </button>

            {/* Local Services */}
            <button
              onClick={() => {/* navigate('/login/services') — coming later */}}
              className="group bg-white rounded-2xl border-2 border-gray-100 p-8 flex flex-col items-center gap-4 transition-all duration-300 shadow-sm opacity-60 cursor-not-allowed relative"
            >
              <div className="absolute top-3 right-3 px-2 py-1 bg-[#D4A373] text-white text-[10px] font-bold rounded-full">
                Coming Soon
              </div>
              <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <Scissors className="w-7 h-7" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-800 mb-1">Local Services</h3>
                <p className="text-sm text-gray-500">
                  Salons, barbers, spas, clinics & appointment booking
                </p>
              </div>
              <div className="mt-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-400 text-xs font-bold">
                Coming Soon
              </div>
            </button>
          </div>

          {/* Bottom link */}
          <p className="text-sm text-gray-500">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="font-bold text-[#1B4332] hover:underline">
              Sign in directly
            </button>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Rezvo · Save the High Street
      </div>
    </div>
  )
}

export default BusinessTypeSelector
