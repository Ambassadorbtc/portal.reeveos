/**
 * Booking Link — styled to match 6-Brand Design - Booking Link.html
 * Link management, booking channels, widget embed, conversion tracking, mobile preview
 */

import { useState } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'

const BookingLink = () => {
  const { business } = useBusiness()
  const [copied, setCopied] = useState(false)
  const slug = business?.slug || 'your-business'
  const bookingUrl = `https://rezvo.co.uk/book/${slug}`

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const channels = [
    { name: 'Reserve with Google', icon: 'fa-google', brand: 'fa-brands', desc: 'Allow clients to book directly from Google Search and Maps. Increase visibility by up to 30%.', connected: false },
    { name: 'Instagram Book Button', icon: 'fa-instagram', brand: 'fa-brands', desc: 'Add a "Book Now" button to your Instagram profile. Syncs directly with your calendar.', connected: true },
    { name: 'Facebook Page', icon: 'fa-facebook-f', brand: 'fa-brands', desc: 'Turn your Facebook page followers into bookings with an integrated action button.', connected: false },
  ]

  const stats = [
    { label: 'Page Views', value: '1,248', trend: '12%', sub: 'Last 30 days' },
    { label: 'Click Through', value: '42.5%', trend: '3.2%', sub: 'Avg. session duration 2m 15s' },
    { label: 'Bookings', value: '156', trend: '8%', sub: 'Conversion rate 12.5%' },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column */}
      <div className="lg:col-span-8 space-y-6">
        {/* Main Link Card */}
        <div className="bg-white border border-border rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-heading font-bold text-primary">Your Booking Link</h2>
              <p className="text-sm text-gray-500 mt-1">Share this link directly with clients to accept bookings 24/7.</p>
            </div>
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-green-50 text-green-700 border border-green-200">
              <i className="fa-solid fa-circle-check mr-1.5 text-[10px]" /> Active
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><i className="fa-solid fa-link text-gray-400 text-sm" /></div>
              <input type="text" readOnly value={bookingUrl} className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg bg-gray-50 text-sm text-primary font-medium" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-bold text-primary hover:bg-gray-50 hover:border-primary/50 transition-colors shadow-sm flex items-center gap-2">
                <i className={`fa-regular ${copied ? 'fa-circle-check' : 'fa-copy'}`} /><span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
              <button className="px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-bold text-primary hover:bg-gray-50 hover:border-primary/50 transition-colors shadow-sm flex items-center gap-2">
                <i className="fa-solid fa-qrcode" /><span>QR Code</span>
              </button>
            </div>
          </div>
        </div>

        {/* Booking Channels */}
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-heading font-bold text-primary">Booking Channels</h3>
            <p className="text-sm text-gray-500 mt-1">Connect your booking page to your social media and search profiles.</p>
          </div>
          <div className="divide-y divide-border">
            {channels.map(ch => (
              <div key={ch.name} className="p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-50 border border-border flex items-center justify-center shrink-0">
                  <i className={`${ch.brand} ${ch.icon} text-2xl text-gray-700`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-primary">{ch.name}</h4>
                    {ch.connected ? (
                      <button className="text-sm font-bold text-white bg-primary border border-primary rounded px-3 py-1 hover:bg-primary-hover transition-colors">
                        <i className="fa-solid fa-check mr-1 text-xs" /> Connected
                      </button>
                    ) : (
                      <button className="text-sm font-bold text-primary border border-primary rounded px-3 py-1 hover:bg-primary hover:text-white transition-colors">Connect</button>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{ch.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Website Widget */}
        <div className="bg-white border border-border rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-heading font-bold text-primary">Website Widget</h3>
              <p className="text-sm text-gray-500 mt-1">Embed a floating booking button on your existing website.</p>
            </div>
            <div className="px-3 py-1 bg-gray-100 rounded text-xs font-mono text-gray-500 border border-border hidden sm:block">v2.1.0</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 relative group">
            <button onClick={() => navigator.clipboard.writeText(`<script src="https://rezvo.co.uk/widget/v2.js"></script>\n<script>\n  Rezvo.init({\n    businessId: "${business?.id || 'biz_xxx'}",\n    color: "#1B4332",\n    position: "bottom-right"\n  });\n</script>`)} className="absolute top-2 right-2 p-2 bg-gray-800 text-gray-300 rounded hover:text-white hover:bg-gray-700 transition-colors" title="Copy Code">
              <i className="fa-regular fa-copy" />
            </button>
            <code className="text-xs text-gray-300 font-mono block leading-relaxed">
              {`<script src="https://rezvo.co.uk/widget/v2.js"></script>`}<br />
              {`<script>`}<br />
              {'  Rezvo.init({'}<br />
              {`    businessId: "${business?.id || 'biz_xxx'}",`}<br />
              {'    color: "#1B4332",'}<br />
              {'    position: "bottom-right"'}<br />
              {'  });'}<br />
              {'</script>'}
            </code>
          </div>
          <div className="mt-4 flex justify-end">
            <button className="text-sm font-bold text-blue-600 hover:underline">View Implementation Guide</button>
          </div>
        </div>

        {/* Conversion Tracking */}
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h3 className="text-lg font-heading font-bold text-primary">Conversion Tracking</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">GROWTH</span>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {stats.map(s => (
              <div key={s.label} className="p-4 rounded-lg bg-gray-50 border border-border">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{s.label}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-heading font-bold text-primary">{s.value}</span>
                  <span className="text-xs font-bold text-green-600 flex items-center"><i className="fa-solid fa-arrow-up text-[10px] mr-0.5" /> {s.trend}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column — Mobile Preview */}
      <div className="lg:col-span-4">
        <div className="sticky top-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Live Preview</h3>
            <button className="w-8 h-8 rounded bg-white border border-border flex items-center justify-center text-primary hover:bg-gray-50 transition-colors shadow-sm" title="Refresh">
              <i className="fa-solid fa-rotate-right text-xs" />
            </button>
          </div>

          {/* Phone Frame */}
          <div className="relative mx-auto max-w-[300px] bg-black rounded-[3rem] p-3 shadow-2xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-10" />
            <div className="rounded-[2.2rem] overflow-hidden bg-[#FEFBF4] h-[550px] flex flex-col">
              {/* Cover */}
              <div className="h-32 bg-gradient-to-br from-primary to-green-700 relative shrink-0">
                <div className="absolute -bottom-8 left-5 w-16 h-16 rounded-xl border-4 border-white shadow-md bg-white flex items-center justify-center">
                  <span className="font-heading font-bold text-primary text-lg">R</span>
                </div>
              </div>
              <div className="mt-10 px-5 pb-4 border-b border-border/50">
                <h2 className="text-base font-heading font-bold text-primary">{business?.name || 'Your Business'}</h2>
                <p className="text-[10px] text-gray-500 mt-0.5">Premium bookings powered by Rezvo</p>
                <div className="flex items-center gap-1 mt-2">
                  <i className="fa-solid fa-star text-amber-400 text-[10px]" /><span className="text-[10px] font-bold text-primary">4.9</span><span className="text-[9px] text-gray-400">(124)</span>
                </div>
              </div>
              <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1 pl-1">Popular Services</div>
                {['Ladies Cut & Blow Dry', 'Full Head Colour', 'Balayage'].map((s, i) => (
                  <div key={s} className="bg-white p-2.5 rounded-lg border border-border shadow-sm flex justify-between items-center">
                    <div><p className="text-xs font-bold text-primary">{s}</p><p className="text-[9px] text-gray-400 mt-0.5">{['45 mins • from £45', '2 hrs • from £120', '3 hrs • from £180'][i]}</p></div>
                    <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[8px]"><i className="fa-solid fa-plus" /></div>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-white border-t border-border">
                <button className="w-full bg-primary text-white font-bold py-2.5 rounded-lg text-xs shadow-lg">Book Now</button>
              </div>
            </div>
          </div>

          <div className="text-center mt-4">
            <a href="#" className="text-xs text-gray-500 hover:text-primary underline">Customize appearance in Online Booking settings</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BookingLink
