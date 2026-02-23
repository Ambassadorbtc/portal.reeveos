/**
 * Booking Link — styled to match 6-Brand Design - Booking Link.html
 * Link management, booking channels, widget embed, conversion tracking, mobile preview
 */

import { useState } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'

const BookingLink = () => {
  const { business } = useBusiness()
  const [copied, setCopied] = useState(false)
  const [activeChannelTab, setActiveChannelTab] = useState('channels')
  const slug = business?.slug || 'your-business'
  const bookingUrl = `https://rezvo.co.uk/book/${slug}`

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const channels = [
    { name: 'Reserve with Google', icon: 'fa-google', brand: 'fa-brands', desc: 'Allow clients to book directly from Google Search and Maps. Increase visibility by up to 30%.', connected: false, color: 'bg-red-50 text-red-600' },
    { name: 'Instagram Book Button', icon: 'fa-instagram', brand: 'fa-brands', desc: 'Add a "Book Now" button to your Instagram profile. Syncs directly with your calendar.', connected: true, color: 'bg-pink-50 text-pink-600' },
    { name: 'Facebook Page', icon: 'fa-facebook-f', brand: 'fa-brands', desc: 'Turn your Facebook page followers into bookings with an integrated action button.', connected: false, color: 'bg-blue-50 text-blue-700' },
    { name: 'WhatsApp Business', icon: 'fa-whatsapp', brand: 'fa-brands', desc: 'Enable customers to book via WhatsApp with a quick-reply booking link.', connected: false, color: 'bg-green-50 text-green-600' },
  ]

  const stats = [
    { label: 'Page Views', value: '1,248', trend: '12%', trendUp: true, sub: 'Last 30 days', icon: 'fa-eye' },
    { label: 'Click Through', value: '42.5%', trend: '3.2%', trendUp: true, sub: 'Avg. session 2m 15s', icon: 'fa-mouse-pointer' },
    { label: 'Bookings', value: '156', trend: '8%', trendUp: true, sub: 'Conversion rate 12.5%', icon: 'fa-calendar-check' },
  ]

  const embedCode = `<iframe src="${bookingUrl}" width="100%" height="600" frameborder="0"></iframe>`

  return (
    <div className="space-y-6">
      {/* Booking Link Card */}
      <div className="bg-white rounded-xl border border-border p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-bl-full -mr-12 -mt-12" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-heading font-bold text-lg text-primary">Your Booking Link</h3>
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-bold text-green-600">Live</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">Share this link with clients to let them book online. It works on all devices.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center bg-gray-50 border border-border rounded-lg px-4 py-2.5 group hover:border-primary/50 transition-colors">
              <i className="fa-solid fa-link text-gray-400 mr-3" />
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary truncate flex-1 hover:underline">{bookingUrl}</a>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="bg-primary text-white font-bold text-sm px-5 py-2.5 rounded-lg shadow-lg hover:bg-primary-hover transition-colors flex items-center gap-2">
                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} /> {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button className="bg-white text-primary border border-border font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                <i className="fa-solid fa-qrcode" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{s.label}</p>
                <h3 className="text-2xl font-heading font-bold text-primary mt-1">{s.value}</h3>
              </div>
              <div className="p-2 bg-primary/5 rounded-lg text-primary"><i className={`fa-solid ${s.icon}`} /></div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold flex items-center gap-1 ${s.trendUp ? 'text-green-600' : 'text-red-500'}`}>
                <i className={`fa-solid ${s.trendUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`} /> {s.trend}
              </span>
              <span className="text-xs text-gray-500">{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Channels & Widget Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Booking Channels */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="border-b border-border">
            <nav className="flex -mb-px">
              <button onClick={() => setActiveChannelTab('channels')}
                className={`flex-1 py-4 px-4 text-sm font-bold text-center border-b-2 transition-colors ${activeChannelTab === 'channels' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-primary'}`}>
                <i className="fa-solid fa-globe mr-2" />Booking Channels
              </button>
              <button onClick={() => setActiveChannelTab('widget')}
                className={`flex-1 py-4 px-4 text-sm font-bold text-center border-b-2 transition-colors ${activeChannelTab === 'widget' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-primary'}`}>
                <i className="fa-solid fa-code mr-2" />Widget Embed
              </button>
            </nav>
          </div>

          {activeChannelTab === 'channels' ? (
            <div className="p-6 space-y-4">
              {channels.map((ch, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all">
                  <div className={`w-10 h-10 rounded-lg ${ch.color} flex items-center justify-center shrink-0`}>
                    <i className={`${ch.brand} ${ch.icon} text-lg`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-primary">{ch.name}</h4>
                      {ch.connected && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">Connected</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{ch.desc}</p>
                  </div>
                  <button className={`text-sm font-bold px-4 py-2 rounded-lg shrink-0 transition-colors ${ch.connected ? 'text-gray-500 bg-gray-100 hover:bg-gray-200' : 'text-white bg-primary hover:bg-primary-hover shadow-md'}`}>
                    {ch.connected ? 'Manage' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Add this code to your website to embed a booking widget. It automatically adapts to your site's design.</p>
              <div className="bg-gray-50 border border-border rounded-lg p-4 font-mono text-xs text-primary overflow-x-auto">
                {embedCode}
              </div>
              <div className="flex gap-3">
                <button onClick={() => navigator.clipboard.writeText(embedCode)} className="text-sm font-bold text-primary border border-border px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2 shadow-sm">
                  <i className="fa-solid fa-copy" /> Copy Code
                </button>
                <button className="text-sm font-bold text-gray-500 border border-border px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <i className="fa-solid fa-palette" /> Customise
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Preview */}
        <div className="bg-white rounded-xl border border-border p-6 shadow-sm flex flex-col items-center">
          <h3 className="font-heading font-bold text-lg text-primary mb-4 self-start">Mobile Preview</h3>
          <div className="w-[220px] h-[420px] bg-gray-900 rounded-[2rem] p-2 shadow-xl">
            <div className="w-full h-full bg-white rounded-[1.5rem] overflow-hidden flex flex-col">
              <div className="bg-primary p-4 text-center">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <i className="fa-solid fa-calendar-check text-white text-sm" />
                </div>
                <h4 className="text-white font-bold text-sm">{business?.name || 'Your Business'}</h4>
                <p className="text-white/70 text-[10px] mt-0.5">Book your appointment</p>
              </div>
              <div className="flex-1 p-3 space-y-2">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] font-bold text-primary">Select Service</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] font-bold text-primary">Pick a Date</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] font-bold text-primary">Choose Time</p>
                </div>
                <div className="mt-auto">
                  <div className="bg-primary rounded-lg py-2 text-center">
                    <span className="text-white font-bold text-[10px]">Confirm Booking</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button className="mt-4 text-sm font-bold text-primary hover:underline flex items-center gap-2">
            <i className="fa-solid fa-arrow-up-right-from-square text-xs" /> Open Full Preview
          </button>
        </div>
      </div>
    </div>
  )
}

export default BookingLink
