/**
 * Help Center — styled to match 10-Brand Design - Settings & Help.html
 * FAQ accordion, setup guides, contact form, knowledge base search
 */

import { useState } from 'react'

const FAQS = [
  { q: 'How do I set up online bookings?', a: 'Navigate to Settings > Online Booking to configure your booking page. You can customise your services, staff availability, and booking rules. Once enabled, share your booking link with clients or embed it on your website.' },
  { q: 'How do deposits work?', a: 'When enabled, clients are required to pay a deposit when booking. The deposit is automatically deducted from the final bill. You can configure the deposit percentage and minimum threshold in Settings > Payments.' },
  { q: 'Can I connect my Google Business profile?', a: 'Yes! Go to Booking Link > Booking Channels and click "Connect" next to Reserve with Google. This allows clients to book directly from Google Search and Maps.' },
  { q: 'How do I manage staff availability?', a: 'Go to Settings > Team Permissions to add staff members. Each staff member can set their own working hours and services they offer. You can also manage this from the Calendar view.' },
  { q: 'What payment methods are supported?', a: 'Rezvo uses Stripe Connect to process payments. This supports all major credit/debit cards (Visa, Mastercard, Amex), Apple Pay, and Google Pay. Payouts are sent directly to your bank account.' },
  { q: 'How do I handle no-shows?', a: 'Enable No-Show Protection in Payments > Settings. This captures card details at booking time and allows you to charge a cancellation fee for late cancellations or no-shows.' },
  { q: 'Can I import my existing client list?', a: 'Yes, you can import clients via CSV from the Clients page. Click the "Import" button and follow the steps to map your columns. We support bulk imports of up to 10,000 clients.' },
  { q: 'How do I customise my booking page?', a: 'Go to Online Booking settings to upload your logo, cover image, and set your accent colour. You can also write a short business description that appears on your booking page.' },
]

const GUIDES = [
  { icon: 'fa-rocket', title: 'Getting Started', desc: 'Set up your business in 5 minutes', color: 'bg-primary/10 text-primary' },
  { icon: 'fa-credit-card', title: 'Payment Setup', desc: 'Connect Stripe and configure deposits', color: 'bg-purple-100 text-purple-600' },
  { icon: 'fa-calendar-check', title: 'Booking Rules', desc: 'Configure availability and policies', color: 'bg-blue-100 text-blue-600' },
  { icon: 'fa-users', title: 'Team Management', desc: 'Add staff and set permissions', color: 'bg-amber-100 text-amber-600' },
  { icon: 'fa-chart-line', title: 'Analytics Guide', desc: 'Understand your business metrics', color: 'bg-green-100 text-green-600' },
  { icon: 'fa-globe', title: 'Online Presence', desc: 'Connect Google, Instagram & more', color: 'bg-pink-100 text-pink-600' },
]

const Help = () => {
  const [openFaq, setOpenFaq] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredFaqs = searchQuery
    ? FAQS.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : FAQS

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-circle-question text-primary text-2xl" />
        </div>
        <h1 className="text-3xl font-heading font-bold text-primary">Help Center</h1>
        <p className="text-gray-500 mt-2">Find answers, guides, and support for your Rezvo account.</p>
      </div>

      {/* Search */}
      <div className="relative max-w-xl mx-auto">
        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search for help..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-border rounded-xl bg-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm" />
      </div>

      {/* Quick Setup Guides */}
      <div>
        <h2 className="font-heading font-bold text-lg text-primary mb-4">Setup Guides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GUIDES.map(g => (
            <div key={g.title} className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
              <div className={`w-10 h-10 rounded-lg ${g.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <i className={`fa-solid ${g.icon}`} />
              </div>
              <h3 className="font-bold text-primary mb-1">{g.title}</h3>
              <p className="text-xs text-gray-500">{g.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Accordion */}
      <div>
        <h2 className="font-heading font-bold text-lg text-primary mb-4">Frequently Asked Questions</h2>
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden divide-y divide-border">
          {filteredFaqs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No matching questions found. Try different search terms.</div>
          ) : filteredFaqs.map((faq, i) => (
            <div key={i}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                <span className="font-bold text-sm text-primary">{faq.q}</span>
                <i className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && (
                <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="bg-white border border-border rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-white shrink-0">
            <i className="fa-solid fa-headset text-xl" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-lg text-primary">Need more help?</h3>
            <p className="text-sm text-gray-500 mt-1">Our support team is available Monday to Friday, 9am – 6pm GMT.</p>
            <div className="flex flex-wrap gap-3 mt-4">
              <a href="mailto:support@rezvo.co.uk" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-hover transition-colors flex items-center gap-2 shadow-sm">
                <i className="fa-solid fa-envelope" /> Email Support
              </a>
              <button className="px-4 py-2 bg-white border border-border text-primary rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm">
                <i className="fa-solid fa-comment-dots" /> Live Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Help
