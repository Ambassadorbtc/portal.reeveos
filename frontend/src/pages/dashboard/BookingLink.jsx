/**
 * Booking Link — styled to match 6-Brand Design - Booking Link.html
 * Link management, booking channels, widget embed, conversion tracking, mobile preview
 */

import { useState } from 'react'
import { Link2, Copy, Check, QrCode, Eye, MousePointer, CalendarCheck, TrendingUp, TrendingDown, Globe, Code, Palette, ExternalLink } from 'lucide-react'
import { useBusiness } from '../../contexts/BusinessContext'

const BookingLink = () => {
  const { business } = useBusiness()
  const [copied, setCopied] = useState(false)
  const [activeChannelTab, setActiveChannelTab] = useState('channels')
  const slug = business?.slug || 'your-business'
  const bookingUrl = `https://portal.rezvo.app/book/${slug}`

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const channels = [
    { name: 'Reserve with Google', icon: 'google', desc: 'Allow clients to book directly from Google Search and Maps. Increase visibility by up to 30%.', connected: false, color: 'bg-red-50' },
    { name: 'Instagram Book Button', icon: 'instagram', desc: 'Add a "Book Now" button to your Instagram profile. Syncs directly with your calendar.', connected: true, color: 'bg-pink-50' },
    { name: 'Facebook Page', icon: 'facebook', desc: 'Turn your Facebook page followers into bookings with an integrated action button.', connected: false, color: 'bg-blue-50' },
    { name: 'WhatsApp Business', icon: 'whatsapp', desc: 'Enable customers to book via WhatsApp with a quick-reply booking link.', connected: false, color: 'bg-green-50' },
  ]

  const BrandIcon = ({ type }) => {
    const icons = {
      google: <img src="/icons/google.svg" alt="Google" className="w-5 h-5" />,
      instagram: <img src="/icons/instagram.svg" alt="Instagram" className="w-5 h-5" />,
      facebook: <img src="/icons/facebook.svg" alt="Facebook" className="w-5 h-5" />,
      whatsapp: <img src="/icons/whatsapp.svg" alt="WhatsApp" className="w-5 h-5" />,
    }
    return icons[type] || null
  }

  const stats = [
    { label: 'Page Views', value: '1,248', trend: '12%', trendUp: true, sub: 'Last 30 days', icon: 'eye' },
    { label: 'Click Through', value: '42.5%', trend: '3.2%', trendUp: true, sub: 'Avg. session 2m 15s', icon: 'mouse' },
    { label: 'Bookings', value: '156', trend: '8%', trendUp: true, sub: 'Conversion rate 12.5%', icon: 'cal' },
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
            <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 group hover:border-[#1B4332]/30 transition-colors">
              <Link2 className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#1B4332] truncate flex-1 hover:underline">{bookingUrl}</a>
            </div>
            <div className="flex gap-2">
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="bg-white text-[#1B4332] border border-gray-200 font-bold text-xs px-5 py-2.5 rounded-full hover:bg-gray-50 transition-all flex items-center gap-2 no-underline shadow-sm">
                <Eye className="w-4 h-4" /> View
              </a>
              <button onClick={handleCopy} className="bg-[#1B4332] text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-lg shadow-[#1B4332]/20 hover:bg-[#2D6A4F] transition-all flex items-center gap-2" style={{ fontFamily: "'Figtree', sans-serif" }}>
                {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
              </button>
              <button className="bg-white text-[#1B4332] border border-gray-200 font-bold text-sm w-10 h-10 rounded-full hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center">
                <QrCode className="w-4 h-4" />
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
              <div className="p-2 bg-primary/5 rounded-lg text-primary">{s.icon === 'eye' ? <Eye className="w-4 h-4" /> : s.icon === 'mouse' ? <MousePointer className="w-4 h-4" /> : <CalendarCheck className="w-4 h-4" />}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold flex items-center gap-1 ${s.trendUp ? 'text-green-600' : 'text-red-500'}`}>
                {s.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {s.trend}
              </span>
              <span className="text-xs text-gray-500">{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Channels & Widget Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Booking Channels */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setActiveChannelTab('channels')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeChannelTab === 'channels'
                    ? 'bg-[#1B4332] text-white shadow-lg shadow-[#1B4332]/20'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`} style={{ fontFamily: "'Figtree', sans-serif" }}>
                <Globe className="w-3.5 h-3.5" />Booking Channels
              </button>
              <button onClick={() => setActiveChannelTab('widget')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeChannelTab === 'widget'
                    ? 'bg-[#1B4332] text-white shadow-lg shadow-[#1B4332]/20'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`} style={{ fontFamily: "'Figtree', sans-serif" }}>
                <Code className="w-3.5 h-3.5" />Widget Embed
              </button>
            </div>
          </div>

          {activeChannelTab === 'channels' ? (
            <div className="p-6 space-y-4">
              {channels.map((ch, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all">
                  <div className={`w-10 h-10 rounded-lg ${ch.color} flex items-center justify-center shrink-0`}>
                    <BrandIcon type={ch.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-primary">{ch.name}</h4>
                      {ch.connected && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">Connected</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{ch.desc}</p>
                  </div>
                  <button className={`text-xs font-bold px-4 py-1.5 rounded-full shrink-0 transition-all ${ch.connected ? 'text-gray-500 bg-gray-100 hover:bg-gray-200' : 'text-white bg-[#1B4332] hover:bg-[#2D6A4F] shadow-lg shadow-[#1B4332]/20'}`}
                    style={{ fontFamily: "'Figtree', sans-serif" }}>
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
                  <Copy className="w-3.5 h-3.5" /> Copy Code
                </button>
                <button className="text-sm font-bold text-gray-500 border border-border px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5" /> Customise
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
                  <CalendarCheck className="w-4 h-4 text-white" />
                </div>
                <h4 className="text-white font-bold text-sm">{business?.name || 'Your Business'}</h4>
                <p className="text-white/70 text-[10px] mt-0.5">Book a table</p>
              </div>
              <div className="flex-1 p-3 space-y-2">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] font-bold text-primary">Party Size</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] font-bold text-primary">Pick a Date</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] font-bold text-primary">Select Time Slot</p>
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
            <ExternalLink className="w-3.5 h-3.5" /> Open Full Preview
          </button>
        </div>
      </div>
    </div>
  )
}

export default BookingLink
