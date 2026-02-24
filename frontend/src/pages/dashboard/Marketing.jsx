/**
 * Rezvo Email Marketing Suite
 * ============================
 * Full Campaign Monitor-style email marketing built into the Rezvo dashboard.
 * Tabs: Overview | Campaigns | Templates | Sequences | Audience
 * Features: Visual composer, live preview, drip builder, audience segments, analytics
 */

import { useState, useEffect, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

/* ─── Inline SVG Icon component ─── */
const I = ({ name, size = 16, className = '' }) => {
  const d = {
    send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />,
    mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
    click: <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
    trash: <><polyline points="3,6 5,6 21,6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    play: <polygon points="5,3 19,12 5,21" />,
    pause: <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    template: <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></>,
    zap: <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21,15 16,10 5,21" /></>,
    type: <><polyline points="4,7 4,4 20,4 20,7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></>,
    divider: <line x1="2" y1="12" x2="22" y2="12" />,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
    up: <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5,12 12,5 19,12" /></>,
    down: <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19,12 12,19 5,12" /></>,
    inbox: <><polyline points="22,12 16,12 14,15 10,15 8,12 2,12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
    gift: <><polyline points="20,12 20,22 4,22 4,12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>,
    star: <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />,
    refresh: <><polyline points="23,4 23,10 17,10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>,
    check: <polyline points="20,6 9,17 4,12" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>{d[name]}</svg>
}

/* ─── Constants ─── */
const SEGS = [
  { id: 'all', label: 'All Customers', desc: 'Everyone in your database', icon: 'users', cls: 'bg-primary/10 text-primary' },
  { id: 'new', label: 'New Customers', desc: '1 visit only', icon: 'star', cls: 'bg-blue-50 text-blue-600' },
  { id: 'returning', label: 'Returning', desc: '2+ visits', icon: 'refresh', cls: 'bg-green-50 text-green-600' },
  { id: 'vip', label: 'VIP', desc: '5+ visits', icon: 'gift', cls: 'bg-amber-50 text-amber-600' },
  { id: 'inactive', label: 'Inactive', desc: 'No visit in 90 days', icon: 'clock', cls: 'bg-red-50 text-red-500' },
  { id: 'recent', label: 'Recent', desc: 'Last 30 days', icon: 'zap', cls: 'bg-purple-50 text-purple-600' },
]

const BLOCKS = [
  { type: 'heading', label: 'Heading', icon: 'type' },
  { type: 'text', label: 'Text', icon: 'edit' },
  { type: 'button', label: 'Button', icon: 'link' },
  { type: 'image', label: 'Image', icon: 'image' },
  { type: 'divider', label: 'Divider', icon: 'divider' },
  { type: 'spacer', label: 'Spacer', icon: 'down' },
]

const TRIGGERS = [
  { id: 'post_booking', label: 'After Booking', desc: 'When a new booking is made', icon: 'mail' },
  { id: 'post_visit', label: 'After Visit', desc: 'After the appointment', icon: 'check' },
  { id: 'new_client', label: 'New Customer', desc: 'First-time booking', icon: 'star' },
  { id: 'inactive_30', label: 'Inactive 30d', desc: 'No visit in 30 days', icon: 'clock' },
  { id: 'inactive_60', label: 'Inactive 60d', desc: 'No visit in 60 days', icon: 'clock' },
  { id: 'inactive_90', label: 'Inactive 90d', desc: 'No visit in 90 days', icon: 'clock' },
]

const TEMPLATES = [
  { id: 'welcome_back', name: 'Welcome Back', cat: 'Re-engagement', aud: 'inactive', icon: 'refresh',
    subject: 'We miss you at {business_name}! 💛', cta: 'Book Your Visit',
    body: "Hi {client_name},\n\nIt's been a while since your last visit to {business_name} and we'd love to see you again!\n\nBook your next visit today — we've got some great things in store for you.",
    cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  { id: 'thank_you', name: 'Thank You', cat: 'Post-Visit', aud: 'recent', icon: 'gift',
    subject: 'Thanks for visiting {business_name}!', cta: 'Leave Feedback',
    body: "Hi {client_name},\n\nThank you for visiting {business_name}! We hope you had a wonderful experience.\n\nWe'd love to hear your thoughts — your feedback helps us improve.",
    cls: 'bg-green-50 border-green-200 text-green-700' },
  { id: 'seasonal', name: 'Seasonal Offer', cat: 'Promotion', aud: 'all', icon: 'gift',
    subject: 'Something special from {business_name} 🎉', cta: 'Grab the Offer',
    body: "Hi {client_name},\n\nWe've got something special just for you at {business_name}!\n\n[Describe your offer here]\n\nLimited time — don't miss out!",
    cls: 'bg-purple-50 border-purple-200 text-purple-700' },
  { id: 'vip_reward', name: 'VIP Reward', cat: 'Loyalty', aud: 'vip', icon: 'star',
    subject: 'A special thank you ⭐', cta: 'Claim Reward',
    body: "Hi {client_name},\n\nYou've been an incredible supporter of {business_name} and we want to show our appreciation!\n\n[Add your reward here]\n\nThank you for your loyalty.",
    cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  { id: 'new_item', name: 'New Offering', cat: 'Announcement', aud: 'all', icon: 'zap',
    subject: 'Something new at {business_name}! 🆕', cta: 'Check It Out',
    body: "Hi {client_name},\n\nExciting news — we've just added something brand new to {business_name}!\n\n[Describe your new offering]\n\nBe one of the first to try it!",
    cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  { id: 'last_minute', name: 'Last-Minute', cat: 'Urgency', aud: 'all', icon: 'clock',
    subject: 'Last-minute availability! 🕐', cta: 'Book Now',
    body: "Hi {client_name},\n\nWe've just had cancellations and have spots available!\n\n[Add times/dates]\n\nGrab a spot before they're gone!",
    cls: 'bg-red-50 border-red-200 text-red-700' },
  { id: 'referral', name: 'Refer a Friend', cat: 'Growth', aud: 'returning', icon: 'users',
    subject: 'Know someone who\'d love {business_name}?', cta: 'Refer a Friend',
    body: "Hi {client_name},\n\nLoving your visits to {business_name}? Spread the word!\n\nRefer a friend and you'll both get [your incentive].",
    cls: 'bg-teal-50 border-teal-200 text-teal-700' },
  { id: 'birthday', name: 'Birthday Treat', cat: 'Personal', aud: 'all', icon: 'gift',
    subject: 'Happy Birthday! 🎂', cta: 'Claim Birthday Treat',
    body: "Hi {client_name},\n\nHappy Birthday! 🎂\n\nTo celebrate, we'd love to treat you to something special at {business_name}.\n\n[Add your birthday offer]",
    cls: 'bg-pink-50 border-pink-200 text-pink-700' },
]

const mkBlocks = () => [
  { id: 'b1', type: 'heading', content: 'Hi {client_name}! 👋', styles: { fontSize: '22px', fontWeight: '700', color: '#1B4332' } },
  { id: 'b2', type: 'text', content: 'We have something special for you at {business_name}.', styles: {} },
  { id: 'b3', type: 'button', content: 'Book Now', url: '{booking_link}', styles: { bg: '#1B4332', fg: '#fff', radius: '8px' } },
]

/* ─── Sub-components ─── */
const Badge = ({ status }) => {
  const s = { draft: 'bg-gray-100 text-gray-600 border-gray-200', scheduled: 'bg-blue-50 text-blue-600 border-blue-200', sending: 'bg-amber-50 text-amber-600 border-amber-200', sent: 'bg-green-50 text-green-600 border-green-200', active: 'bg-green-50 text-green-600 border-green-200', paused: 'bg-amber-50 text-amber-600 border-amber-200' }
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${s[status] || s.draft}`}>
    {status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
    {status === 'sending' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
}

const Stat = ({ label, value, sub, icon, color = 'primary' }) => {
  const c = { primary: 'bg-primary/5 text-primary', green: 'bg-green-50 text-green-600', blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600' }
  return <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-card transition-shadow">
    <div className="flex justify-between items-start">
      <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p><h3 className="text-2xl font-bold text-primary mt-1.5">{value}</h3>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>
      <div className={`p-2.5 rounded-xl ${c[color]}`}><I name={icon} size={18} /></div>
    </div>
  </div>
}

/* ─── Block Editor ─── */
const Editor = ({ blocks, onChange }) => {
  const move = (i, dir) => { const n = [...blocks]; const j = i + dir; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n) }
  const upd = (i, u) => { const n = [...blocks]; n[i] = { ...n[i], ...u }; onChange(n) }
  const del = (i) => onChange(blocks.filter((_, j) => j !== i))
  const add = (type) => {
    const defs = {
      heading: { content: 'Your heading here', styles: { fontSize: '22px', fontWeight: '700', color: '#1B4332' } },
      text: { content: 'Write your message here. Use {client_name} and {business_name} as placeholders.', styles: {} },
      button: { content: 'Book Now', url: '{booking_link}', styles: { bg: '#1B4332', fg: '#fff', radius: '8px' } },
      image: { content: '', url: '', alt: 'Image', styles: {} },
      divider: { content: '', styles: { color: '#e5e7eb' } },
      spacer: { content: '', styles: { height: '24px' } },
    }
    onChange([...blocks, { id: `b${Date.now()}`, type, ...(defs[type] || {}) }])
  }

  return <div className="space-y-3">
    {blocks.map((b, i) => (
      <div key={b.id} className="group relative bg-white border border-border rounded-xl p-4 hover:border-primary/30 transition-all">
        <div className="absolute -right-1 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5 bg-white border border-border rounded-lg shadow-sm p-0.5 z-10">
          <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><I name="up" size={12} /></button>
          <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><I name="down" size={12} /></button>
          <button onClick={() => del(i)} className="p-1 hover:bg-red-50 text-red-400 hover:text-red-600 rounded"><I name="trash" size={12} /></button>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded mb-2 inline-block">{b.type}</span>
        {b.type === 'heading' && <input value={b.content} onChange={e => upd(i, { content: e.target.value })} className="w-full text-lg font-bold text-primary border-0 border-b border-transparent focus:border-primary/20 outline-none bg-transparent pb-1" placeholder="Heading..." />}
        {b.type === 'text' && <textarea value={b.content} onChange={e => upd(i, { content: e.target.value })} rows={3} className="w-full text-sm text-gray-700 border-0 border-b border-transparent focus:border-primary/20 outline-none bg-transparent resize-none leading-relaxed" placeholder="Content..." />}
        {b.type === 'button' && <div className="flex gap-3"><input value={b.content} onChange={e => upd(i, { content: e.target.value })} className="flex-1 text-sm font-semibold border border-border rounded-lg px-3 py-2 focus:border-primary/30 outline-none" placeholder="Button text" /><input value={b.url || ''} onChange={e => upd(i, { url: e.target.value })} className="flex-1 text-sm text-gray-500 border border-border rounded-lg px-3 py-2 focus:border-primary/30 outline-none" placeholder="{booking_link}" /></div>}
        {b.type === 'image' && <input value={b.url || ''} onChange={e => upd(i, { url: e.target.value })} className="w-full text-sm text-gray-500 border border-border rounded-lg px-3 py-2 focus:border-primary/30 outline-none" placeholder="Image URL..." />}
        {b.type === 'divider' && <div className="border-t-2 border-dashed border-gray-200 my-2" />}
        {b.type === 'spacer' && <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Height:</span><input type="range" min="8" max="64" value={parseInt(b.styles?.height) || 24} onChange={e => upd(i, { styles: { ...b.styles, height: `${e.target.value}px` } })} className="flex-1 accent-primary" /><span className="text-xs text-gray-500 w-10 text-right">{parseInt(b.styles?.height) || 24}px</span></div>}
      </div>
    ))}
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-primary/30 transition-colors">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 text-center">Add Block</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {BLOCKS.map(bt => <button key={bt.type} onClick={() => add(bt.type)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-gray-600 hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all"><I name={bt.icon} size={12} /> {bt.label}</button>)}
      </div>
    </div>
  </div>
}

/* ─── Live Preview ─── */
const Preview = ({ blocks, subject, biz }) => {
  const rv = (t) => (t || '').replace(/\{client_name\}/g, 'Sarah').replace(/\{business_name\}/g, biz || 'Your Business').replace(/\{booking_link\}/g, '#').replace(/\{email\}/g, 'sarah@example.com')
  return <div className="flex flex-col items-center">
    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Live Preview</p>
    <div className="w-[320px] bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
      <div className="bg-gray-900 rounded-t-[2rem] pt-3 pb-2 px-4"><div className="flex justify-center"><div className="w-20 h-5 bg-gray-800 rounded-full" /></div></div>
      <div className="bg-white rounded-[1.75rem] overflow-hidden" style={{ maxHeight: '520px', overflowY: 'auto' }}>
        <div className="bg-primary px-5 py-4">
          <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider">From: {biz || 'Your Business'} via Rezvo</p>
          <p className="text-white font-bold text-sm mt-1">{rv(subject) || 'Email subject'}</p>
        </div>
        <div className="px-5 py-5 space-y-4">
          {blocks.length === 0 && <p className="text-gray-300 text-sm text-center py-8 italic">Add blocks to see preview</p>}
          {blocks.map(b => <div key={b.id}>
            {b.type === 'heading' && <h2 style={{ fontSize: b.styles?.fontSize || '22px', fontWeight: b.styles?.fontWeight || '700', color: b.styles?.color || '#1B4332', margin: 0, lineHeight: 1.3 }}>{rv(b.content)}</h2>}
            {b.type === 'text' && <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#374151', margin: 0 }}>{rv(b.content)}</p>}
            {b.type === 'button' && <div style={{ textAlign: 'center', padding: '4px 0' }}><span style={{ display: 'inline-block', padding: '10px 24px', borderRadius: b.styles?.radius || '8px', backgroundColor: b.styles?.bg || '#1B4332', color: b.styles?.fg || '#fff', fontWeight: 600, fontSize: '14px' }}>{rv(b.content)}</span></div>}
            {b.type === 'image' && b.url && <img src={rv(b.url)} alt={b.alt || ''} style={{ width: '100%', borderRadius: '8px' }} />}
            {b.type === 'image' && !b.url && <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center"><I name="image" size={24} className="text-gray-300" /></div>}
            {b.type === 'divider' && <hr style={{ border: 'none', borderTop: `1px solid ${b.styles?.color || '#e5e7eb'}`, margin: '8px 0' }} />}
            {b.type === 'spacer' && <div style={{ height: b.styles?.height || '24px' }} />}
          </div>)}
        </div>
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400">Powered by Rezvo · <span className="underline">Unsubscribe</span></p>
        </div>
      </div>
    </div>
  </div>
}

/* ─── Sequence Step Builder ─── */
const StepBuilder = ({ steps, onChange }) => {
  const upd = (i, u) => { const n = [...steps]; n[i] = { ...n[i], ...u }; onChange(n) }
  const del = (i) => onChange(steps.filter((_, j) => j !== i))
  const add = () => onChange([...steps, { delay_days: steps.length === 0 ? 0 : 3, subject: '', body: '' }])

  return <div className="space-y-4">
    {steps.map((s, i) => (
      <div key={i} className="relative">
        {i > 0 && <div className="absolute left-7 -top-4 w-0.5 h-4 bg-primary/20" />}
        <div className="flex gap-4 items-start">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-primary text-white flex flex-col items-center justify-center shadow-sm">
              <span className="text-[10px] font-bold uppercase leading-none">Step</span>
              <span className="text-lg font-bold leading-none">{i + 1}</span>
            </div>
            {i < steps.length - 1 && <div className="w-0.5 flex-1 bg-primary/20 min-h-[16px] mt-1" />}
          </div>
          <div className="flex-1 bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-card transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                <I name="clock" size={14} className="text-gray-400" />
                {i === 0 ? <span className="text-xs font-bold text-primary">Immediately</span> : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Wait</span>
                    <input type="number" min="1" max="365" value={s.delay_days} onChange={e => upd(i, { delay_days: parseInt(e.target.value) || 1 })} className="w-12 text-center text-xs font-bold text-primary border border-border rounded px-1 py-0.5 outline-none focus:border-primary/30" />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                )}
              </div>
              <button onClick={() => del(i)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><I name="trash" size={14} /></button>
            </div>
            <input value={s.subject} onChange={e => upd(i, { subject: e.target.value })} placeholder="Subject line..." className="w-full text-sm font-semibold border-0 border-b border-border pb-2 mb-3 outline-none focus:border-primary/30 bg-transparent placeholder:text-gray-300" />
            <textarea value={s.body} onChange={e => upd(i, { body: e.target.value })} rows={4} placeholder="Email body — use {client_name}, {business_name}, {booking_link}..." className="w-full text-sm text-gray-600 border border-border rounded-lg p-3 outline-none focus:border-primary/30 resize-none bg-gray-50/50 leading-relaxed placeholder:text-gray-300" />
          </div>
        </div>
      </div>
    ))}
    <div className="flex justify-center pt-2">
      <button onClick={add} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-primary/20 text-primary font-semibold text-sm hover:border-primary/40 hover:bg-primary/5 transition-all">
        <I name="plus" size={16} /> Add Step
      </button>
    </div>
  </div>
}

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════ */
const Marketing = () => {
  const { business } = useBusiness()
  const biz = business?.name || 'Your Business'

  const [tab, setTab] = useState('overview')
  const [camps, setCamps] = useState([])
  const [seqs, setSeqs] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({})

  // Composer
  const [composing, setComposing] = useState(false)
  const [editId, setEditId] = useState(null)
  const [comp, setComp] = useState({ name: '', subject: '', audience: 'all', blocks: mkBlocks() })

  // Sequence creator
  const [creatingSeq, setCreatingSeq] = useState(false)
  const [seq, setSeq] = useState({ name: '', trigger: 'post_booking', steps: [
    { delay_days: 0, subject: 'Thanks for booking with {business_name}!', body: 'Hi {client_name},\n\nThanks for your booking! We look forward to seeing you.' },
    { delay_days: 7, subject: 'How was your visit?', body: "Hi {client_name},\n\nWe hope you enjoyed your visit! We'd love your feedback.\n\nBook again: {booking_link}" },
  ] })

  // Test
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)
  const [testRes, setTestRes] = useState(null)

  const fetch_ = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        api.get('/marketing/campaigns').catch(() => []),
        api.get('/marketing/stats?days=30').catch(() => null),
      ])
      setCamps(Array.isArray(c) ? c : [])
      setStats(s)
      const sq = await api.get('/marketing/drips').catch(() => [])
      setSeqs(Array.isArray(sq) ? sq : [])
      const ct = {}
      for (const seg of SEGS) { try { const r = await api.get(`/marketing/audience/count?audience=${seg.id}`); ct[seg.id] = r.count || 0 } catch { ct[seg.id] = 0 } }
      setCounts(ct)
    } catch (e) { console.error('Marketing fetch:', e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  // Actions
  const save = async () => {
    const body = comp.blocks.map(b => { if (b.type === 'heading') return `## ${b.content}`; if (b.type === 'text') return b.content; if (b.type === 'button') return `[${b.content}](${b.url || '{booking_link}'})`; if (b.type === 'divider') return '---'; return '' }).join('\n\n')
    const payload = { name: comp.name || 'Untitled', subject: comp.subject || comp.name, body, audience: comp.audience, type: 'email' }
    try { if (editId) await api.patch(`/marketing/campaigns/${editId}`, payload); else await api.post('/marketing/campaigns', payload); setComposing(false); setEditId(null); setComp({ name: '', subject: '', audience: 'all', blocks: mkBlocks() }); fetch_() } catch (e) { alert(e.message) }
  }

  const sendCamp = async (id) => { if (!confirm('Send this campaign? This cannot be undone.')) return; try { const r = await api.post(`/marketing/campaigns/${id}/send`); alert(`Sending to ${r.recipient_count} recipients`); fetch_() } catch (e) { alert(e.message) } }
  const delCamp = async (id) => { if (!confirm('Delete this draft?')) return; try { await api.delete(`/marketing/campaigns/${id}`); fetch_() } catch (e) { alert(e.message) } }
  const testSend = async (id) => { if (!testEmail) return; setTesting(true); setTestRes(null); try { await api.post(`/marketing/campaigns/${id}/test?test_email=${encodeURIComponent(testEmail)}`); setTestRes({ ok: true, msg: 'Test sent!' }) } catch (e) { setTestRes({ ok: false, msg: e.message }) } finally { setTesting(false) } }
  const saveSeq = async () => { try { await api.post('/marketing/drips', seq); setCreatingSeq(false); fetch_() } catch (e) { alert(e.message) } }
  const toggleSeq = async (id) => { try { await api.post(`/marketing/drips/${id}/toggle`); fetch_() } catch (e) { alert(e.message) } }
  const delSeq = async (id) => { if (!confirm('Delete?')) return; try { await api.delete(`/marketing/drips/${id}`); fetch_() } catch (e) { alert(e.message) } }

  const useTpl = (t) => {
    setComp({
      name: t.name, subject: t.subject, audience: t.aud || 'all',
      blocks: [
        { id: 'b1', type: 'heading', content: t.subject.replace(/ [🎉💛⭐🆕🕐🎂]/g, ''), styles: { fontSize: '22px', fontWeight: '700', color: '#1B4332' } },
        { id: 'b2', type: 'text', content: t.body, styles: {} },
        { id: 'b3', type: 'button', content: t.cta || 'Book Now', url: '{booking_link}', styles: { bg: '#1B4332', fg: '#fff', radius: '8px' } },
      ],
    })
    setComposing(true); setTab('campaigns')
  }

  if (loading) return <div className="flex items-center justify-center py-24"><div className="text-center"><div className="w-10 h-10 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /><p className="text-sm text-gray-400 mt-3">Loading marketing suite...</p></div></div>

  /* ─── COMPOSER VIEW ─── */
  if (composing) return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={() => { setComposing(false); setEditId(null) }} className="p-2 hover:bg-gray-100 rounded-lg"><I name="x" size={18} className="text-gray-500" /></button>
        <div><h2 className="text-lg font-bold text-primary">{editId ? 'Edit' : 'New'} Campaign</h2><p className="text-xs text-gray-400">Design your email and send it to your customers</p></div>
      </div>
      <button onClick={save} className="px-5 py-2.5 rounded-xl bg-white border border-border text-sm font-bold text-primary hover:bg-primary/5 transition-all shadow-sm">Save Draft</button>
    </div>
    <div className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Campaign Name</label><input value={comp.name} onChange={e => setComp(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Summer Special" className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-primary/30" /></div>
        <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Subject Line</label><input value={comp.subject} onChange={e => setComp(c => ({ ...c, subject: e.target.value }))} placeholder="e.g. Something special just for you!" className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-primary/30" /></div>
      </div>
      <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Send To</label>
        <div className="flex flex-wrap gap-2">
          {SEGS.map(s => <button key={s.id} onClick={() => setComp(c => ({ ...c, audience: s.id }))} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${comp.audience === s.id ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-border text-gray-500 hover:border-primary/20'}`}><I name={s.icon} size={12} /> {s.label} <span className="text-[10px] font-normal text-gray-400">({counts[s.id] || 0})</span></button>)}
        </div>
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Email Content</p><Editor blocks={comp.blocks} onChange={blocks => setComp(c => ({ ...c, blocks }))} /></div>
      <div className="sticky top-6">
        <Preview blocks={comp.blocks} subject={comp.subject} biz={biz} />
        <div className="mt-6 bg-white rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Send Test Email</p>
          <div className="flex gap-2">
            <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="your@email.com" className="flex-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary/30" />
            <button onClick={() => editId && testSend(editId)} disabled={testing || !testEmail || !editId} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-primary-hover transition-colors">{testing ? '...' : 'Send Test'}</button>
          </div>
          {!editId && <p className="text-[10px] text-gray-400 mt-1.5">Save the campaign first to send a test</p>}
          {testRes && <p className={`text-xs mt-2 font-semibold ${testRes.ok ? 'text-green-600' : 'text-red-500'}`}>{testRes.msg}</p>}
        </div>
      </div>
    </div>
  </div>

  /* ─── SEQUENCE CREATOR VIEW ─── */
  if (creatingSeq) return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={() => setCreatingSeq(false)} className="p-2 hover:bg-gray-100 rounded-lg"><I name="x" size={18} className="text-gray-500" /></button>
        <div><h2 className="text-lg font-bold text-primary">New Sequence</h2><p className="text-xs text-gray-400">Automated emails triggered by customer actions</p></div>
      </div>
      <button onClick={saveSeq} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors shadow-sm">Save Sequence</button>
    </div>
    <div className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-4">
      <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Name</label><input value={seq.name} onChange={e => setSeq(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Post-Booking Follow Up" className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-primary/30" /></div>
      <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Trigger</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TRIGGERS.map(t => <button key={t.id} onClick={() => setSeq(s => ({ ...s, trigger: t.id }))} className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${seq.trigger === t.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/20'}`}>
            <div className={`p-2 rounded-lg flex-shrink-0 ${seq.trigger === t.id ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-400'}`}><I name={t.icon} size={14} /></div>
            <div><p className={`text-sm font-bold ${seq.trigger === t.id ? 'text-primary' : 'text-gray-700'}`}>{t.label}</p><p className="text-[11px] text-gray-400 mt-0.5">{t.desc}</p></div>
          </button>)}
        </div>
      </div>
    </div>
    <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Email Steps</p><StepBuilder steps={seq.steps} onChange={steps => setSeq(s => ({ ...s, steps }))} /></div>
  </div>

  /* ─── MAIN TABS VIEW ─── */
  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div><h1 className="text-xl font-bold text-primary">Email Marketing</h1><p className="text-sm text-gray-400 mt-0.5">Engage your customers with beautiful emails</p></div>
      <button onClick={() => { setComposing(true); setEditId(null); setComp({ name: '', subject: '', audience: 'all', blocks: mkBlocks() }) }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors shadow-sm hover:shadow-md"><I name="plus" size={16} /> New Campaign</button>
    </div>

    <div className="border-b border-border"><nav className="flex gap-1 -mb-px">
      {[['overview','Overview','chart'],['campaigns','Campaigns','mail'],['templates','Templates','template'],['sequences','Sequences','zap'],['audience','Audience','users']].map(([id,label,icon]) =>
        <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-bold transition-all ${tab === id ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'}`}><I name={icon} size={14} />{label}</button>
      )}
    </nav></div>

    {/* OVERVIEW */}
    {tab === 'overview' && <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Emails Sent" value={stats?.total_emails_sent?.toLocaleString() || '0'} sub="Last 30 days" icon="send" color="primary" />
        <Stat label="Open Rate" value={`${stats?.open_rate || 0}%`} sub="Industry avg: 35%" icon="eye" color="green" />
        <Stat label="Click Rate" value={`${stats?.click_rate || 0}%`} sub="Industry avg: 2.5%" icon="click" color="blue" />
        <Stat label="Active Sequences" value={stats?.active_drips || 0} sub={`${stats?.active_drip_enrollments || 0} enrolled`} icon="zap" color="amber" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: 'mail', title: 'Send a Campaign', desc: 'Create and send an email blast', fn: () => { setComposing(true); setEditId(null) } },
          { icon: 'template', title: 'Use a Template', desc: 'Start from a pre-built design', fn: () => setTab('templates') },
          { icon: 'zap', title: 'Build a Sequence', desc: 'Automate follow-up emails', fn: () => setCreatingSeq(true) },
        ].map((a, i) => <button key={i} onClick={a.fn} className="flex items-center gap-4 p-5 bg-white rounded-xl border border-border shadow-sm hover:shadow-card hover:border-primary/20 transition-all text-left group">
          <div className="p-3 rounded-2xl bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors"><I name={a.icon} size={22} /></div>
          <div><h3 className="font-bold text-sm text-primary">{a.title}</h3><p className="text-xs text-gray-400 mt-0.5">{a.desc}</p></div>
        </button>)}
      </div>
      {camps.length > 0 ? <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex justify-between"><h3 className="font-bold text-sm text-primary">Recent Campaigns</h3><button onClick={() => setTab('campaigns')} className="text-xs text-gray-400 hover:text-primary font-semibold">View All →</button></div>
        <div className="divide-y divide-border">
          {camps.slice(0, 5).map(c => <div key={c.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
            <div className="flex items-center gap-4"><div className="p-2 rounded-lg bg-primary/5"><I name="mail" size={16} className="text-primary" /></div><div><p className="text-sm font-bold text-primary">{c.name}</p><p className="text-xs text-gray-400">{c.audience} · {new Date(c.created_at).toLocaleDateString()}</p></div></div>
            <div className="flex items-center gap-3">{c.status === 'sent' && <div className="text-right"><p className="text-xs font-bold text-primary">{c.stats?.total_recipients || 0} sent</p><p className="text-[10px] text-gray-400">{c.stats?.opened || 0} opened</p></div>}<Badge status={c.status} /></div>
          </div>)}
        </div>
      </div> : <div className="bg-white rounded-xl border border-border p-12 shadow-sm text-center">
        <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4"><I name="mail" size={28} className="text-primary/40" /></div>
        <h3 className="font-bold text-lg text-primary mb-2">No campaigns yet</h3>
        <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">Create your first email campaign — zero commission, all yours.</p>
        <button onClick={() => { setComposing(true); setEditId(null) }} className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors">Create First Campaign</button>
      </div>}
    </div>}

    {/* CAMPAIGNS */}
    {tab === 'campaigns' && <div>
      {camps.length === 0 ? <div className="bg-white rounded-xl border border-border p-12 shadow-sm text-center"><I name="inbox" size={40} className="text-gray-200 mx-auto mb-4" /><h3 className="font-bold text-lg text-primary mb-2">No campaigns</h3><button onClick={() => { setComposing(true); setEditId(null) }} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors mt-4">New Campaign</button></div>
      : <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left min-w-[800px]">
        <thead><tr className="bg-gray-50/80 border-b border-border">
          {['Campaign','Audience','Status','Sent','Opened','Clicked',''].map((h,i) => <th key={i} className={`px-5 py-3 text-[10px] uppercase tracking-wider font-bold text-gray-400 ${i === 6 ? 'text-right' : ''}`}>{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-border">
          {camps.map(c => <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
            <td className="px-5 py-4"><p className="text-sm font-bold text-primary">{c.name}</p><p className="text-[11px] text-gray-400 mt-0.5">{c.subject}</p></td>
            <td className="px-5 py-4 text-xs font-semibold text-gray-500 capitalize">{c.audience}</td>
            <td className="px-5 py-4"><Badge status={c.status} /></td>
            <td className="px-5 py-4 text-sm font-bold text-primary">{c.stats?.total_recipients || 0}</td>
            <td className="px-5 py-4 text-sm text-gray-600">{c.stats?.opened || 0}</td>
            <td className="px-5 py-4 text-sm text-gray-600">{c.stats?.clicked || 0}</td>
            <td className="px-5 py-4"><div className="flex items-center gap-1 justify-end">
              {c.status === 'draft' && <><button onClick={() => sendCamp(c.id)} title="Send" className="p-2 hover:bg-green-50 rounded-lg text-gray-400 hover:text-green-600 transition-colors"><I name="send" size={14} /></button><button onClick={() => delCamp(c.id)} title="Delete" className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><I name="trash" size={14} /></button></>}
            </div></td>
          </tr>)}
        </tbody>
      </table></div></div>}
    </div>}

    {/* TEMPLATES */}
    {tab === 'templates' && <div className="space-y-4">
      <p className="text-sm text-gray-400">Click any template to start building</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {TEMPLATES.map(t => <button key={t.id} onClick={() => useTpl(t)} className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-card hover:-translate-y-0.5 ${t.cls}`}>
          <div className="flex items-center gap-2 mb-3"><div className="p-2 rounded-lg bg-white/60"><I name={t.icon} size={16} /></div><span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{t.cat}</span></div>
          <h4 className="font-bold text-sm mb-1.5">{t.name}</h4>
          <p className="text-[11px] opacity-70 leading-relaxed line-clamp-2">{t.body.split('\n')[2] || t.body.split('\n')[0]}</p>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold opacity-60"><I name="users" size={10} />{SEGS.find(s => s.id === t.aud)?.label || 'All'}</div>
        </button>)}
      </div>
    </div>}

    {/* SEQUENCES */}
    {tab === 'sequences' && <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Automated emails on autopilot</p>
        <button onClick={() => { setCreatingSeq(true); setSeq({ name: '', trigger: 'post_booking', steps: [{ delay_days: 0, subject: 'Thanks for booking!', body: 'Hi {client_name},\n\nThanks for your booking at {business_name}!' }, { delay_days: 7, subject: 'How was your visit?', body: "Hi {client_name},\n\nWe'd love your feedback!\n\nBook again: {booking_link}" }] }) }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors"><I name="plus" size={14} /> New Sequence</button>
      </div>
      {seqs.length === 0 ? <div className="bg-white rounded-xl border border-border p-12 shadow-sm text-center">
        <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4"><I name="zap" size={28} className="text-primary/40" /></div>
        <h3 className="font-bold text-lg text-primary mb-2">No sequences yet</h3>
        <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">Automate booking confirmations, follow-ups, and win-back campaigns.</p>
        <button onClick={() => setCreatingSeq(true)} className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors">Create First Sequence</button>
      </div> : <div className="space-y-3">{seqs.map(s => <div key={s.id} className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-card transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${s.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}><I name="zap" size={18} /></div>
            <div><h4 className="font-bold text-sm text-primary">{s.name}</h4><div className="flex items-center gap-3 mt-1"><span className="text-[11px] text-gray-400">{TRIGGERS.find(t => t.id === s.trigger)?.label || s.trigger}</span><span className="text-[11px] text-gray-300">·</span><span className="text-[11px] text-gray-400">{s.steps?.length || 0} steps</span><span className="text-[11px] text-gray-300">·</span><span className="text-[11px] text-gray-400">{s.stats?.enrolled || 0} enrolled</span></div></div>
          </div>
          <div className="flex items-center gap-2">
            <Badge status={s.is_active ? 'active' : 'paused'} />
            <button onClick={() => toggleSeq(s.id)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-primary transition-colors"><I name={s.is_active ? 'pause' : 'play'} size={14} /></button>
            <button onClick={() => delSeq(s.id)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><I name="trash" size={14} /></button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
          {(s.steps || []).map((st, i) => <div key={i} className="flex items-center gap-2 flex-shrink-0">
            {i > 0 && <div className="flex items-center gap-1"><div className="w-6 h-px bg-primary/20" /><span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">{st.delay_days}d</span><div className="w-6 h-px bg-primary/20" /></div>}
            <div className="px-3 py-2 bg-primary/5 rounded-lg border border-primary/10 max-w-[160px]"><p className="text-[10px] font-bold text-primary truncate">{st.subject || `Step ${i + 1}`}</p></div>
          </div>)}
        </div>
      </div>)}</div>}
    </div>}

    {/* AUDIENCE */}
    {tab === 'audience' && <div className="space-y-6">
      <p className="text-sm text-gray-400">Your customer segments for targeted campaigns</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SEGS.map(s => <div key={s.id} className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-card transition-shadow">
          <div className="flex items-start justify-between mb-3"><div className={`p-2.5 rounded-xl ${s.cls}`}><I name={s.icon} size={18} /></div><span className="text-2xl font-bold text-primary">{counts[s.id]?.toLocaleString() || '0'}</span></div>
          <h4 className="font-bold text-sm text-primary">{s.label}</h4><p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
          <button onClick={() => { setComp(c => ({ ...c, audience: s.id })); setComposing(true) }} className="mt-4 w-full py-2 rounded-lg border border-border text-xs font-bold text-gray-500 hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all">Send Campaign →</button>
        </div>)}
      </div>
      <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div><h3 className="font-bold text-sm text-primary">Total Contacts</h3><p className="text-xs text-gray-400 mt-0.5">Unique emails across all bookings</p></div>
          <div className="text-right"><p className="text-3xl font-bold text-primary">{counts.all?.toLocaleString() || '0'}</p><p className="text-xs text-gray-400">Unsubscribed: {stats?.total_unsubscribes || 0}</p></div>
        </div>
        {counts.all > 0 && <>
          <div className="mt-4 flex rounded-full overflow-hidden h-3 bg-gray-100">
            {[['vip','bg-amber-400'],['returning','bg-green-400'],['recent','bg-purple-400'],['new','bg-blue-400'],['inactive','bg-red-300']].map(([id,bg]) => {
              const pct = ((counts[id] || 0) / Math.max(counts.all, 1)) * 100
              return pct >= 1 ? <div key={id} className={`${bg} transition-all duration-500`} style={{ width: `${pct}%` }} /> : null
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            {[['vip','bg-amber-400','VIP'],['returning','bg-green-400','Returning'],['recent','bg-purple-400','Recent'],['new','bg-blue-400','New'],['inactive','bg-red-300','Inactive']].map(([id,bg,label]) =>
              <div key={id} className="flex items-center gap-1.5"><div className={`w-2.5 h-2.5 rounded-full ${bg}`} /><span className="text-[11px] text-gray-500">{label}</span></div>
            )}
          </div>
        </>}
      </div>
    </div>}
  </div>
}

export default Marketing
