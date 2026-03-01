import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Rezvo Email Marketing Suite — V10 FULLY AUTO
 * ================================================
 * Campaign Monitor killer built into Rezvo dashboard.
 *
 * Tabs: Overview | Campaigns | Automations | Templates | Sequences | Audience | Analytics
 *
 * V10 Features:
 * - AI Campaign Generator (pick goal → AI writes campaign)
 * - Auto-Campaigns (10 pre-built, toggle on/off, fire-and-forget)
 * - A/B Testing (split test subject lines)
 * - Analytics Dashboard (timeline charts, heatmap, top campaigns)
 * - Smart Send Times (best time recommendations)
 * - Visual Email Composer with live phone preview
 * - Template Library (8 templates)
 * - Drip Sequence Builder with timeline
 * - Audience Segmentation with breakdown chart
 * - Revenue Attribution per campaign
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

/* ─── SVG Icon ─── */
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
    robot: <><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="3" /><line x1="12" y1="8" x2="12" y2="11" /><circle cx="8" cy="16" r="1" /><circle cx="16" cy="16" r="1" /></>,
    toggle: <><rect x="1" y="5" width="22" height="14" rx="7" /><circle cx="16" cy="12" r="3" /></>,
    target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
    split: <><path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" /></>,
    trending: <><polyline points="23,6 13.5,15.5 8.5,10.5 1,18" /><polyline points="17,6 23,6 23,12" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
    award: <><circle cx="12" cy="8" r="7" /><polyline points="8.21,13.89 7,23 12,20 17,23 15.79,13.88" /></>,
    msgCircle: <><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></>,
    sparkle: <><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" /></>,
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

const BLOCK_TYPES = [
  { type: 'heading', label: 'Heading', icon: 'type' },
  { type: 'text', label: 'Text', icon: 'edit' },
  { type: 'button', label: 'Button', icon: 'link' },
  { type: 'image', label: 'Image', icon: 'image' },
  { type: 'divider', label: 'Divider', icon: 'divider' },
  { type: 'spacer', label: 'Spacer', icon: 'down' },
]

const TRIGGERS = [
  { id: 'post_booking', label: 'After Booking', desc: 'When a booking is made', icon: 'mail' },
  { id: 'post_visit', label: 'After Visit', desc: 'After the appointment', icon: 'check' },
  { id: 'new_client', label: 'New Customer', desc: 'First-time booking', icon: 'star' },
  { id: 'inactive_30', label: 'Inactive 30d', desc: 'No visit in 30 days', icon: 'clock' },
  { id: 'inactive_60', label: 'Inactive 60d', desc: 'No visit in 60 days', icon: 'clock' },
  { id: 'inactive_90', label: 'Inactive 90d', desc: 'No visit in 90 days', icon: 'clock' },
]

const AI_GOALS = [
  { id: 'win_back', label: 'Win Back Customers', desc: 'Re-engage people who haven\'t visited', icon: 'heart', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  { id: 'flash_sale', label: 'Flash Sale', desc: 'Create urgency with a limited offer', icon: 'zap', cls: 'border-red-200 bg-red-50 text-red-700' },
  { id: 'thank_loyal', label: 'Thank VIPs', desc: 'Reward your most loyal customers', icon: 'award', cls: 'border-purple-200 bg-purple-50 text-purple-700' },
  { id: 'new_launch', label: 'New Launch', desc: 'Announce something new', icon: 'sparkle', cls: 'border-blue-200 bg-blue-50 text-blue-700' },
  { id: 'seasonal', label: 'Seasonal Promo', desc: 'Seasonal or holiday promotion', icon: 'gift', cls: 'border-green-200 bg-green-50 text-green-700' },
  { id: 'review_ask', label: 'Get Reviews', desc: 'Ask customers for reviews', icon: 'star', cls: 'border-teal-200 bg-teal-50 text-teal-700' },
  { id: 'referral', label: 'Referral Program', desc: 'Drive word-of-mouth growth', icon: 'users', cls: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  { id: 'event', label: 'Event Invite', desc: 'Promote an upcoming event', icon: 'calendar', cls: 'border-pink-200 bg-pink-50 text-pink-700' },
]

const TEMPLATES = [
  { id: 'welcome_back', name: 'Welcome Back', cat: 'Re-engagement', aud: 'inactive', icon: 'refresh', subject: 'We miss you at {business_name}! 💛', cta: 'Book Your Visit', body: "Hi {client_name},\n\nIt's been a while since your last visit to {business_name} and we'd love to see you again!\n\nBook your next visit today.", cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  { id: 'thank_you', name: 'Thank You', cat: 'Post-Visit', aud: 'recent', icon: 'gift', subject: 'Thanks for visiting {business_name}!', cta: 'Leave Feedback', body: "Hi {client_name},\n\nThank you for visiting {business_name}! We hope you had a wonderful experience.", cls: 'bg-green-50 border-green-200 text-green-700' },
  { id: 'seasonal', name: 'Seasonal Offer', cat: 'Promotion', aud: 'all', icon: 'gift', subject: 'Something special from {business_name} 🎉', cta: 'Grab the Offer', body: "Hi {client_name},\n\nWe've got something special just for you at {business_name}!\n\n[Describe your offer here]", cls: 'bg-purple-50 border-purple-200 text-purple-700' },
  { id: 'vip_reward', name: 'VIP Reward', cat: 'Loyalty', aud: 'vip', icon: 'star', subject: 'A special thank you ⭐', cta: 'Claim Reward', body: "Hi {client_name},\n\nYou've been incredible at {business_name} and we want to show our appreciation!", cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  { id: 'new_item', name: 'New Offering', cat: 'Announcement', aud: 'all', icon: 'zap', subject: 'Something new at {business_name}! 🆕', cta: 'Check It Out', body: "Hi {client_name},\n\nExciting news — something brand new at {business_name}!", cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  { id: 'last_minute', name: 'Last-Minute', cat: 'Urgency', aud: 'all', icon: 'clock', subject: 'Last-minute availability! 🕐', cta: 'Book Now', body: "Hi {client_name},\n\nCancellations = your chance! Spots available today at {business_name}.", cls: 'bg-red-50 border-red-200 text-red-700' },
  { id: 'referral', name: 'Refer a Friend', cat: 'Growth', aud: 'returning', icon: 'users', subject: 'Know someone who\'d love {business_name}?', cta: 'Refer a Friend', body: "Hi {client_name},\n\nLoving {business_name}? Spread the word and you'll both get rewarded.", cls: 'bg-teal-50 border-teal-200 text-teal-700' },
  { id: 'birthday', name: 'Birthday Treat', cat: 'Personal', aud: 'all', icon: 'gift', subject: 'Happy Birthday! 🎂', cta: 'Claim Birthday Treat', body: "Hi {client_name},\n\nHappy Birthday from {business_name}! We'd love to treat you.", cls: 'bg-pink-50 border-pink-200 text-pink-700' },
]

const mkBlocks = (subject, body) => [
  { id: 'b1', type: 'heading', content: subject || 'Hi {client_name}! 👋', styles: { fontSize: '22px', fontWeight: '700', color: '#111111' } },
  { id: 'b2', type: 'text', content: body || 'We have something special for you at {business_name}.', styles: {} },
  { id: 'b3', type: 'button', content: 'Book Now', url: '{booking_link}', styles: { bg: '#111111', fg: '#fff', radius: '8px' } },
]

/* ─── Mini Bar Chart ─── */
const MiniChart = ({ data, height = 48, color = '#111111' }) => {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const w = 100 / data.length
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {data.map((v, i) => (
        <rect key={i} x={i * w + w * 0.15} y={height - (v / max) * height} width={w * 0.7} height={(v / max) * height} fill={color} rx="1" opacity={0.7 + (i / data.length) * 0.3} />
      ))}
    </svg>
  )
}

/* ─── Sub-components ─── */
const Badge = ({ status }) => {
  const s = { draft: 'bg-gray-100 text-gray-600 border-gray-200', scheduled: 'bg-blue-50 text-blue-600 border-blue-200', sending: 'bg-amber-50 text-amber-600 border-amber-200', sent: 'bg-green-50 text-green-600 border-green-200', active: 'bg-green-50 text-green-600 border-green-200', paused: 'bg-amber-50 text-amber-600 border-amber-200' }
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${s[status] || s.draft}`}>
    {status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
    {status === 'sending' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
}

const Stat = ({ label, value, sub, icon, color = 'primary', chart }) => {
  const c = { primary: 'bg-primary/5 text-primary', green: 'bg-green-50 text-green-600', blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-500' }
  return <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-card transition-shadow">
    <div className="flex justify-between items-start">
      <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p><h3 className="text-2xl font-bold text-primary mt-1.5">{value}</h3>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>
      <div className={`p-2.5 rounded-xl ${c[color]}`}><I name={icon} size={18} /></div>
    </div>
    {chart && <div className="mt-3 -mx-1"><MiniChart data={chart} height={32} color={color === 'green' ? '#22C55E' : color === 'blue' ? '#3B82F6' : '#111111'} /></div>}
  </div>
}

/* ─── Toggle Switch ─── */
const Toggle = ({ on, onChange, loading }) => (
  <button onClick={onChange} disabled={loading}
    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${on ? 'bg-primary' : 'bg-gray-200'} ${loading ? 'opacity-50' : ''}`}>
    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${on ? 'left-[22px]' : 'left-0.5'}`} />
  </button>
)

/* ─── Block Editor ─── */
const Editor = ({ blocks, onChange }) => {
  const move = (i, dir) => { const n = [...blocks]; const j = i + dir; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n) }
  const upd = (i, u) => { const n = [...blocks]; n[i] = { ...n[i], ...u }; onChange(n) }
  const del = (i) => onChange(blocks.filter((_, j) => j !== i))
  const add = (type) => {
    const defs = { heading: { content: 'Your heading', styles: { fontSize: '22px', fontWeight: '700', color: '#111111' } }, text: { content: 'Write your message. Use {client_name} and {business_name}.', styles: {} }, button: { content: 'Book Now', url: '{booking_link}', styles: { bg: '#111111', fg: '#fff', radius: '8px' } }, image: { content: '', url: '', styles: {} }, divider: { content: '', styles: { color: '#e5e7eb' } }, spacer: { content: '', styles: { height: '24px' } } }
    onChange([...blocks, { id: `b${Date.now()}`, type, ...(defs[type] || {}) }])
  }
  return <div className="space-y-3">
    {blocks.map((b, i) => (
      <div key={b.id} className="group relative bg-white border border-border rounded-xl p-4 hover:border-primary/30 transition-all">
        <div className="absolute -right-1 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5 bg-white border border-border rounded-lg shadow-sm p-0.5 z-10">
          <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><I name="up" size={12} /></button>
          <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><I name="down" size={12} /></button>
          <button onClick={() => del(i)} className="p-1 hover:bg-red-50 text-red-400 rounded"><I name="trash" size={12} /></button>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded mb-2 inline-block">{b.type}</span>
        {b.type === 'heading' && <input value={b.content} onChange={e => upd(i, { content: e.target.value })} className="w-full text-lg font-bold text-primary border-0 border-b border-transparent focus:border-primary/20 outline-none bg-transparent pb-1" />}
        {b.type === 'text' && <textarea value={b.content} onChange={e => upd(i, { content: e.target.value })} rows={3} className="w-full text-sm text-gray-700 border-0 border-b border-transparent focus:border-primary/20 outline-none bg-transparent resize-none leading-relaxed" />}
        {b.type === 'button' && <div className="flex gap-3"><input value={b.content} onChange={e => upd(i, { content: e.target.value })} className="flex-1 text-sm font-semibold border border-border rounded-lg px-3 py-2 focus:border-primary/30 outline-none" /><input value={b.url || ''} onChange={e => upd(i, { url: e.target.value })} className="flex-1 text-sm text-gray-500 border border-border rounded-lg px-3 py-2 focus:border-primary/30 outline-none" placeholder="{booking_link}" /></div>}
        {b.type === 'image' && <input value={b.url || ''} onChange={e => upd(i, { url: e.target.value })} className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:border-primary/30 outline-none" placeholder="Image URL..." />}
        {b.type === 'divider' && <div className="border-t-2 border-dashed border-gray-200 my-2" />}
        {b.type === 'spacer' && <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Height:</span><input type="range" min="8" max="64" value={parseInt(b.styles?.height) || 24} onChange={e => upd(i, { styles: { ...b.styles, height: `${e.target.value}px` } })} className="flex-1 accent-primary" /><span className="text-xs text-gray-500 w-10 text-right">{parseInt(b.styles?.height) || 24}px</span></div>}
      </div>
    ))}
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-primary/30 transition-colors">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 text-center">Add Block</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {BLOCK_TYPES.map(bt => <button key={bt.type} onClick={() => add(bt.type)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-gray-600 hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all"><I name={bt.icon} size={12} /> {bt.label}</button>)}
      </div>
    </div>
  </div>
}

/* ─── Live Preview ─── */
const Preview = ({ blocks, subject, biz }) => {
  const rv = (t) => (t || '').replace(/\{client_name\}/g, 'Sarah').replace(/\{business_name\}/g, biz).replace(/\{booking_link\}/g, '#').replace(/\{email\}/g, 'sarah@example.com')
  return <div className="flex flex-col items-center">
    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Live Preview</p>
    <div className="w-[320px] bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
      <div className="bg-gray-900 rounded-t-[2rem] pt-3 pb-2 px-4"><div className="flex justify-center"><div className="w-20 h-5 bg-gray-800 rounded-full" /></div></div>
      <div className="bg-white rounded-[1.75rem] overflow-hidden" style={{ maxHeight: '520px', overflowY: 'auto' }}>
        <div className="bg-primary px-5 py-4">
          <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider">From: {biz} via Rezvo</p>
          <p className="text-white font-bold text-sm mt-1">{rv(subject) || 'Email subject'}</p>
        </div>
        <div className="px-5 py-5 space-y-4">
          {blocks.length === 0 && <p className="text-gray-300 text-sm text-center py-8 italic">Add blocks to preview</p>}
          {blocks.map(b => <div key={b.id}>
            {b.type === 'heading' && <h2 style={{ fontSize: b.styles?.fontSize || '22px', fontWeight: b.styles?.fontWeight || '700', color: b.styles?.color || '#111111', margin: 0, lineHeight: 1.3 }}>{rv(b.content)}</h2>}
            {b.type === 'text' && <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#374151', margin: 0, whiteSpace: 'pre-line' }}>{rv(b.content)}</p>}
            {b.type === 'button' && <div style={{ textAlign: 'center', padding: '4px 0' }}><span style={{ display: 'inline-block', padding: '10px 24px', borderRadius: b.styles?.radius || '8px', backgroundColor: b.styles?.bg || '#111111', color: b.styles?.fg || '#fff', fontWeight: 600, fontSize: '14px' }}>{rv(b.content)}</span></div>}
            {b.type === 'image' && !b.url && <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center"><I name="image" size={24} className="text-gray-300" /></div>}
            {b.type === 'divider' && <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />}
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
          <div className="flex-1 bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                <I name="clock" size={14} className="text-gray-400" />
                {i === 0 ? <span className="text-xs font-bold text-primary">Immediately</span> : <div className="flex items-center gap-1.5"><span className="text-xs text-gray-500">Wait</span><input type="number" min="1" max="365" value={s.delay_days} onChange={e => upd(i, { delay_days: parseInt(e.target.value) || 1 })} className="w-12 text-center text-xs font-bold text-primary border border-border rounded px-1 py-0.5 outline-none focus:border-primary/30" /><span className="text-xs text-gray-500">days</span></div>}
              </div>
              <button onClick={() => del(i)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><I name="trash" size={14} /></button>
            </div>
            <input value={s.subject} onChange={e => upd(i, { subject: e.target.value })} placeholder="Subject line..." className="w-full text-sm font-semibold border-0 border-b border-border pb-2 mb-3 outline-none focus:border-primary/30 bg-transparent placeholder:text-gray-300" />
            <textarea value={s.body} onChange={e => upd(i, { body: e.target.value })} rows={4} placeholder="Email body — use {client_name}, {business_name}, {booking_link}..." className="w-full text-sm text-gray-600 border border-border rounded-lg p-3 outline-none focus:border-primary/30 resize-none bg-gray-50/50 leading-relaxed placeholder:text-gray-300" />
          </div>
        </div>
      </div>
    ))}
    <div className="flex justify-center pt-2">
      <button onClick={add} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-primary/20 text-primary font-semibold text-sm hover:border-primary/40 hover:bg-primary/5 transition-all"><I name="plus" size={16} /> Add Step</button>
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
  const [autoCamps, setAutoCamps] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [heatmap, setHeatmap] = useState(null)
  const [topCamps, setTopCamps] = useState([])
  const [togglingAuto, setTogglingAuto] = useState({})

  // Composer
  const [composing, setComposing] = useState(false)
  const [editId, setEditId] = useState(null)
  const [comp, setComp] = useState({ name: '', subject: '', audience: 'all', blocks: mkBlocks(), abEnabled: false, subjectB: '' })

  // AI Generator
  const [aiOpen, setAiOpen] = useState(false)
  const [aiGoal, setAiGoal] = useState('')
  const [aiOffer, setAiOffer] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiResult, setAiResult] = useState(null)

  // Sequence creator
  const [creatingSeq, setCreatingSeq] = useState(false)
  const [seq, setSeq] = useState({ name: '', trigger: 'post_booking', steps: [] })

  // Test
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)
  const [testRes, setTestRes] = useState(null)

  const fetch_ = useCallback(async () => {
    try {
      const [c, s, ac] = await Promise.all([
        api.get('/marketing/campaigns').catch(() => []),
        api.get('/marketing/stats?days=30').catch(() => null),
        api.get('/marketing/auto-campaigns').catch(() => []),
      ])
      setCamps(Array.isArray(c) ? c : [])
      setStats(s)
      setAutoCamps(Array.isArray(ac) ? ac : [])
      const sq = await api.get('/marketing/drips').catch(() => [])
      setSeqs(Array.isArray(sq) ? sq : [])
      const ct = {}
      for (const seg of SEGS) { try { const r = await api.get(`/marketing/audience/count?audience=${seg.id}`); ct[seg.id] = r.count || 0 } catch { ct[seg.id] = 0 } }
      setCounts(ct)
      // Analytics
      const [tl, hm, tc] = await Promise.all([
        api.get('/marketing/analytics/timeline?days=30').catch(() => null),
        api.get('/marketing/analytics/send-time-heatmap').catch(() => null),
        api.get('/marketing/analytics/top-campaigns').catch(() => null),
      ])
      setAnalytics(tl)
      setHeatmap(hm)
      setTopCamps(tc?.campaigns || [])
    } catch (e) { console.error('Marketing fetch:', e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  // Campaign actions
  const save = async () => {
    const body = comp.blocks.map(b => { if (b.type === 'heading') return `## ${b.content}`; if (b.type === 'text') return b.content; if (b.type === 'button') return `[${b.content}](${b.url || '{booking_link}'})`; if (b.type === 'divider') return '---'; return '' }).join('\n\n')
    const payload = { name: comp.name || 'Untitled', subject: comp.subject || comp.name, body, audience: comp.audience, type: 'email' }
    try {
      let id = editId
      if (editId) { await api.patch(`/marketing/campaigns/${editId}`, payload) }
      else { const r = await api.post('/marketing/campaigns', payload); id = r.id }
      // A/B test setup
      if (comp.abEnabled && comp.subjectB && id) {
        await api.post(`/marketing/campaigns/${id}/ab-test`, { subject_b: comp.subjectB }).catch(() => {})
      }
      setComposing(false); setEditId(null); setComp({ name: '', subject: '', audience: 'all', blocks: mkBlocks(), abEnabled: false, subjectB: '' }); fetch_()
    } catch (e) { alert(e.message) }
  }
  const sendCamp = async (id) => { if (!confirm('Send this campaign? This cannot be undone.')) return; try { const r = await api.post(`/marketing/campaigns/${id}/send`); alert(`Sending to ${r.recipient_count} recipients`); fetch_() } catch (e) { alert(e.message) } }
  const delCamp = async (id) => { if (!confirm('Delete this draft?')) return; try { await api.delete(`/marketing/campaigns/${id}`); fetch_() } catch (e) { alert(e.message) } }
  const testSend = async (id) => { if (!testEmail) return; setTesting(true); setTestRes(null); try { await api.post(`/marketing/campaigns/${id}/test?test_email=${encodeURIComponent(testEmail)}`); setTestRes({ ok: true, msg: 'Test sent!' }) } catch (e) { setTestRes({ ok: false, msg: e.message }) } finally { setTesting(false) } }

  // AI Generation
  const generateAI = async () => {
    if (!aiGoal) return
    setAiGenerating(true); setAiResult(null)
    try {
      const r = await api.post('/marketing/ai/generate', { type: aiGoal, offer: aiOffer })
      setAiResult(r)
    } catch (e) { alert(e.message) } finally { setAiGenerating(false) }
  }
  const useAiResult = () => {
    if (!aiResult) return
    setComp({
      name: aiResult.goal || 'AI Campaign',
      subject: aiResult.subject,
      audience: aiResult.audience || 'all',
      blocks: mkBlocks(aiResult.subject.replace(/ [🎉💛⭐🆕🕐🎂👀🔥🙏❤️]/g, ''), aiResult.body),
      abEnabled: !!aiResult.subject_b,
      subjectB: aiResult.subject_b || '',
    })
    setAiOpen(false); setAiResult(null); setAiGoal(''); setAiOffer('')
    setComposing(true); setTab('campaigns')
  }

  // Auto-campaign toggle
  const toggleAuto = async (type) => {
    setTogglingAuto(prev => ({ ...prev, [type]: true }))
    try { await api.post(`/marketing/auto-campaigns/${type}/toggle`); fetch_() } catch (e) { alert(e.message) }
    finally { setTogglingAuto(prev => ({ ...prev, [type]: false })) }
  }

  // Sequence actions
  const saveSeq = async () => { try { await api.post('/marketing/drips', seq); setCreatingSeq(false); fetch_() } catch (e) { alert(e.message) } }
  const toggleSeq = async (id) => { try { await api.post(`/marketing/drips/${id}/toggle`); fetch_() } catch (e) { alert(e.message) } }
  const delSeq = async (id) => { if (!confirm('Delete?')) return; try { await api.delete(`/marketing/drips/${id}`); fetch_() } catch (e) { alert(e.message) } }

  const useTpl = (t) => {
    setComp({ name: t.name, subject: t.subject, audience: t.aud || 'all', blocks: mkBlocks(t.subject.replace(/ [🎉💛⭐🆕🕐🎂]/g, ''), t.body), abEnabled: false, subjectB: '' })
    setComposing(true); setTab('campaigns')
  }

  // Analytics data
  const timelineData = useMemo(() => analytics?.timeline?.map(d => d.sent) || [], [analytics])
  const openData = useMemo(() => analytics?.timeline?.map(d => d.opened) || [], [analytics])
  const clickData = useMemo(() => analytics?.timeline?.map(d => d.clicked) || [], [analytics])
  const enabledAutoCount = autoCamps.filter(a => a.enabled).length

  if (loading) return <RezvoLoader message="Loading marketing suite..." />

  /* ─── AI GENERATOR MODAL ─── */
  const AIModal = () => aiOpen ? (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAiOpen(false)}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-sage text-white"><I name="sparkle" size={20} /></div>
              <div><h2 className="text-lg font-bold text-primary">AI Campaign Generator</h2><p className="text-xs text-gray-400">Pick a goal — AI writes the campaign</p></div>
            </div>
            <button onClick={() => setAiOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg"><I name="x" size={18} className="text-gray-400" /></button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Step 1: Pick goal */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">What's your goal?</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {AI_GOALS.map(g => (
                <button key={g.id} onClick={() => setAiGoal(g.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5 ${aiGoal === g.id ? 'ring-2 ring-primary ring-offset-2 ' + g.cls : g.cls + ' opacity-70 hover:opacity-100'}`}>
                  <I name={g.icon} size={18} className="mb-2" />
                  <p className="text-xs font-bold">{g.label}</p>
                </button>
              ))}
            </div>
          </div>
          {/* Step 2: Optional details */}
          {aiGoal && <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Add details <span className="font-normal text-gray-400">(optional)</span></p>
            <input value={aiOffer} onChange={e => setAiOffer(e.target.value)}
              placeholder="e.g. 20% off all mains, Free dessert with every booking, New cocktail menu..."
              className="w-full px-4 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary/30" />
          </div>}
          {/* Generate button */}
          {aiGoal && <button onClick={generateAI} disabled={aiGenerating}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-sage text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {aiGenerating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</> : <><I name="sparkle" size={16} /> Generate Campaign</>}
          </button>}
          {/* Result */}
          {aiResult && <div className="bg-gray-50 rounded-xl p-5 border border-border space-y-3">
            <div className="flex items-center gap-2"><I name="check" size={16} className="text-green-600" /><span className="text-sm font-bold text-primary">Campaign Generated!</span></div>
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Subject A</p><p className="text-sm font-semibold text-primary">{aiResult.subject}</p></div>
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Subject B (A/B Test)</p><p className="text-sm text-gray-600">{aiResult.subject_b}</p></div>
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Audience</p><p className="text-sm text-gray-600 capitalize">{aiResult.audience}</p></div>
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Preview</p><p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{aiResult.body?.substring(0, 200)}...</p></div>
            <button onClick={useAiResult} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-hover transition-colors">
              Use This Campaign →
            </button>
          </div>}
        </div>
      </div>
    </div>
  ) : null

  /* ─── COMPOSER VIEW ─── */
  if (composing) return <div className="space-y-6">
    <AIModal />
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={() => { setComposing(false); setEditId(null) }} className="p-2 hover:bg-gray-100 rounded-lg"><I name="x" size={18} className="text-gray-500" /></button>
        <div><h2 className="text-lg font-bold text-primary">{editId ? 'Edit' : 'New'} Campaign</h2><p className="text-xs text-gray-400">Design your email and send it</p></div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setAiOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#111111] to-[#1a1a1a] text-white text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-[#111111]/20"><I name="sparkle" size={14} /> AI Generate</button>
        <button onClick={save} className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm">Save Draft</button>
      </div>
    </div>
    <div className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Campaign Name</label><input value={comp.name} onChange={e => setComp(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Summer Special" className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-primary/30" /></div>
        <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Subject Line</label><input value={comp.subject} onChange={e => setComp(c => ({ ...c, subject: e.target.value }))} placeholder="What your customers see" className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-primary/30" /></div>
      </div>
      {/* A/B Testing */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-2">
          <Toggle on={comp.abEnabled} onChange={() => setComp(c => ({ ...c, abEnabled: !c.abEnabled }))} />
          <div><p className="text-xs font-bold text-primary">A/B Test</p><p className="text-[10px] text-gray-400">Split test subject lines</p></div>
        </div>
        {comp.abEnabled && <div className="flex-1"><input value={comp.subjectB} onChange={e => setComp(c => ({ ...c, subjectB: e.target.value }))} placeholder="Subject B variant..." className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary/30" /></div>}
      </div>
      <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Send To</label>
        <div className="flex flex-wrap gap-2">
          {SEGS.map(s => <button key={s.id} onClick={() => setComp(c => ({ ...c, audience: s.id }))} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${comp.audience === s.id ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-border text-gray-500 hover:border-primary/20'}`}><I name={s.icon} size={12} /> {s.label} <span className="text-[10px] font-normal text-gray-400">({counts[s.id] || 0})</span></button>)}
        </div>
      </div>
      {/* Smart Send Time */}
      {heatmap?.best_time && <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
        <I name="clock" size={16} className="text-green-600" />
        <div><p className="text-xs font-bold text-green-700">Recommended send time: {heatmap.best_time}</p><p className="text-[10px] text-green-600">Based on when your customers open emails</p></div>
      </div>}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Email Content</p><Editor blocks={comp.blocks} onChange={blocks => setComp(c => ({ ...c, blocks }))} /></div>
      <div className="sticky top-6">
        <Preview blocks={comp.blocks} subject={comp.subject} biz={biz} />
        <div className="mt-6 bg-white rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Send Test Email</p>
          <div className="flex gap-2">
            <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="your@email.com" className="flex-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary/30" />
            <button onClick={() => editId && testSend(editId)} disabled={testing || !testEmail || !editId} className="px-4 py-1.5 bg-[#111111] text-white rounded-full text-xs font-bold disabled:opacity-40 hover:bg-[#1a1a1a] shadow-lg shadow-[#111111]/20">{testing ? '...' : 'Send Test'}</button>
          </div>
          {!editId && <p className="text-[10px] text-gray-400 mt-1.5">Save first to send a test</p>}
          {testRes && <p className={`text-xs mt-2 font-semibold ${testRes.ok ? 'text-green-600' : 'text-red-500'}`}>{testRes.msg}</p>}
        </div>
      </div>
    </div>
  </div>

  /* ─── SEQUENCE CREATOR ─── */
  if (creatingSeq) return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3"><button onClick={() => setCreatingSeq(false)} className="p-2 hover:bg-gray-100 rounded-lg"><I name="x" size={18} className="text-gray-500" /></button><div><h2 className="text-lg font-bold text-primary">New Sequence</h2><p className="text-xs text-gray-400">Automated emails on autopilot</p></div></div>
      <button onClick={saveSeq} className="px-5 py-2.5 rounded-full bg-[#111111] text-white text-xs font-bold shadow-lg shadow-[#111111]/20 hover:bg-primary-hover shadow-sm">Save Sequence</button>
    </div>
    <div className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-4">
      <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Name</label><input value={seq.name} onChange={e => setSeq(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Post-Booking Follow Up" className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-primary/30" /></div>
      <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Trigger</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TRIGGERS.map(t => <button key={t.id} onClick={() => setSeq(s => ({ ...s, trigger: t.id }))} className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${seq.trigger === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/20'}`}>
            <div className={`p-2 rounded-lg ${seq.trigger === t.id ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-400'}`}><I name={t.icon} size={14} /></div>
            <div><p className={`text-sm font-bold ${seq.trigger === t.id ? 'text-primary' : 'text-gray-700'}`}>{t.label}</p><p className="text-[11px] text-gray-400 mt-0.5">{t.desc}</p></div>
          </button>)}
        </div>
      </div>
    </div>
    <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Email Steps</p><StepBuilder steps={seq.steps} onChange={steps => setSeq(s => ({ ...s, steps }))} /></div>
  </div>

  /* ════════════════════════════════════════════════════════
     MAIN TABS VIEW
     ════════════════════════════════════════════════════════ */
  const TABS = [
    ['overview', 'Overview', 'chart'],
    ['campaigns', 'Campaigns', 'mail'],
    ['automations', 'Automations', 'zap'],
    ['templates', 'Templates', 'template'],
    ['sequences', 'Sequences', 'refresh'],
    ['audience', 'Audience', 'users'],
    ['analytics', 'Analytics', 'trending'],
  ]

  return <div className="space-y-6">
    <AIModal />
    {/* Header */}
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div><h1 className="text-xl font-bold text-primary">Email Marketing</h1><p className="text-sm text-gray-400 mt-0.5">Your fully automated marketing engine</p></div>
      <div className="flex items-center gap-2">
        <button onClick={() => setAiOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#111111] to-[#1a1a1a] text-white text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-[#111111]/20"><I name="sparkle" size={14} /> AI Generate</button>
        <button onClick={() => { setComposing(true); setEditId(null); setComp({ name: '', subject: '', audience: 'all', blocks: mkBlocks(), abEnabled: false, subjectB: '' }) }} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#111111] text-white text-xs font-bold shadow-lg shadow-[#111111]/20 hover:bg-primary-hover shadow-sm"><I name="plus" size={16} /> New Campaign</button>
      </div>
    </div>

    {/* Tabs */}
    <div className="border-b border-border overflow-x-auto"><nav className="flex gap-1 -mb-px min-w-max">
      {TABS.map(([id, label, icon]) =>
        <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-bold transition-all whitespace-nowrap ${tab === id ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'}`}>
          <I name={icon} size={14} />{label}
          {id === 'automations' && enabledAutoCount > 0 && <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 text-[10px] font-bold flex items-center justify-center">{enabledAutoCount}</span>}
        </button>
      )}
    </nav></div>

    {/* ─── OVERVIEW ─── */}
    {tab === 'overview' && <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Emails Sent" value={stats?.total_emails_sent?.toLocaleString() || '0'} sub="Last 30 days" icon="send" color="primary" chart={timelineData} />
        <Stat label="Open Rate" value={`${stats?.open_rate || 0}%`} sub="Industry avg: 35%" icon="eye" color="green" chart={openData} />
        <Stat label="Click Rate" value={`${stats?.click_rate || 0}%`} sub="Industry avg: 2.5%" icon="click" color="blue" chart={clickData} />
        <Stat label="Automations" value={`${enabledAutoCount}/${autoCamps.length}`} sub={`${stats?.active_drip_enrollments || 0} enrolled`} icon="zap" color="amber" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: 'sparkle', title: 'AI Generate', desc: 'AI writes your campaign', fn: () => setAiOpen(true), gradient: true },
          { icon: 'mail', title: 'Manual Campaign', desc: 'Build from scratch', fn: () => { setComposing(true); setEditId(null) } },
          { icon: 'template', title: 'Use Template', desc: 'Start from a design', fn: () => setTab('templates') },
          { icon: 'zap', title: 'Automations', desc: `${enabledAutoCount} active`, fn: () => setTab('automations') },
        ].map((a, i) => <button key={i} onClick={a.fn} className={`flex items-center gap-4 p-5 rounded-xl border shadow-sm hover:shadow-card hover:border-primary/20 transition-all text-left group ${a.gradient ? 'bg-gradient-to-br from-primary/5 to-sage/5 border-primary/20' : 'bg-white border-border'}`}>
          <div className={`p-3 rounded-2xl transition-colors ${a.gradient ? 'bg-gradient-to-br from-primary to-sage text-white' : 'bg-primary/5 text-primary group-hover:bg-primary/10'}`}><I name={a.icon} size={20} /></div>
          <div><h3 className="font-bold text-sm text-primary">{a.title}</h3><p className="text-xs text-gray-400 mt-0.5">{a.desc}</p></div>
        </button>)}
      </div>

      {/* Smart insights */}
      {heatmap?.best_time && <div className="bg-gradient-to-r from-primary/5 to-sage/5 rounded-xl border border-primary/10 p-5 flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-primary/10"><I name="target" size={20} className="text-primary" /></div>
        <div className="flex-1">
          <h3 className="font-bold text-sm text-primary">Smart Insight</h3>
          <p className="text-xs text-gray-600 mt-0.5">Your customers are most likely to open emails on <strong>{heatmap.best_time}</strong>. Schedule your next campaign accordingly for maximum impact.</p>
        </div>
      </div>}

      {/* Recent */}
      {camps.length > 0 && <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex justify-between"><h3 className="font-bold text-sm text-primary">Recent Campaigns</h3><button onClick={() => setTab('campaigns')} className="text-xs text-gray-400 hover:text-primary font-semibold">View All →</button></div>
        <div className="divide-y divide-border">
          {camps.slice(0, 5).map(c => <div key={c.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
            <div className="flex items-center gap-4"><div className="p-2 rounded-lg bg-primary/5"><I name="mail" size={16} className="text-primary" /></div><div><p className="text-sm font-bold text-primary">{c.name}</p><p className="text-xs text-gray-400">{c.audience} · {new Date(c.created_at).toLocaleDateString()}</p></div></div>
            <div className="flex items-center gap-3">{c.status === 'sent' && <div className="text-right"><p className="text-xs font-bold text-primary">{c.stats?.total_recipients || 0} sent</p><p className="text-[10px] text-gray-400">{c.stats?.opened || 0} opened</p></div>}<Badge status={c.status} /></div>
          </div>)}
        </div>
      </div>}
    </div>}

    {/* ─── CAMPAIGNS ─── */}
    {tab === 'campaigns' && <div>
      {camps.length === 0 ? <div className="bg-white rounded-xl border border-border p-12 shadow-sm text-center"><I name="inbox" size={40} className="text-gray-200 mx-auto mb-4" /><h3 className="font-bold text-lg text-primary mb-2">No campaigns</h3><p className="text-sm text-gray-400 mb-4">Create your first campaign or let AI do it for you</p><div className="flex gap-3 justify-center"><button onClick={() => setAiOpen(true)} className="px-5 py-2.5 rounded-full bg-[#111111] text-white text-xs font-bold shadow-lg shadow-[#111111]/20"><I name="sparkle" size={14} className="inline mr-1" />AI Generate</button><button onClick={() => { setComposing(true); setEditId(null) }} className="px-5 py-2.5 rounded-full bg-[#111111] text-white text-xs font-bold shadow-lg shadow-[#111111]/20">Manual</button></div></div>
      : <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left min-w-[800px]">
        <thead><tr className="bg-gray-50/80 border-b border-border">
          {['Campaign','Audience','Status','Sent','Opened','Clicked',''].map((h,i) => <th key={i} className={`px-5 py-3 text-[10px] uppercase tracking-wider font-bold text-gray-400 ${i === 6 ? 'text-right' : ''}`}>{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-border">
          {camps.map(c => <tr key={c.id} className="hover:bg-gray-50/50">
            <td className="px-5 py-4"><p className="text-sm font-bold text-primary">{c.name}</p><p className="text-[11px] text-gray-400 mt-0.5">{c.subject}{c.ab_test?.enabled && <span className="ml-2 px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-bold rounded">A/B</span>}</p></td>
            <td className="px-5 py-4 text-xs font-semibold text-gray-500 capitalize">{c.audience}</td>
            <td className="px-5 py-4"><Badge status={c.status} /></td>
            <td className="px-5 py-4 text-sm font-bold text-primary">{c.stats?.total_recipients || 0}</td>
            <td className="px-5 py-4 text-sm text-gray-600">{c.stats?.opened || 0}</td>
            <td className="px-5 py-4 text-sm text-gray-600">{c.stats?.clicked || 0}</td>
            <td className="px-5 py-4"><div className="flex items-center gap-1 justify-end">
              {c.status === 'draft' && <><button onClick={() => sendCamp(c.id)} className="p-2 hover:bg-green-50 rounded-lg text-gray-400 hover:text-green-600"><I name="send" size={14} /></button><button onClick={() => delCamp(c.id)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><I name="trash" size={14} /></button></>}
            </div></td>
          </tr>)}
        </tbody>
      </table></div></div>}
    </div>}

    {/* ─── AUTOMATIONS (V10) ─── */}
    {tab === 'automations' && <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary/5 to-sage/5 rounded-xl border border-primary/10 p-5">
        <div className="flex items-center gap-3 mb-2"><I name="zap" size={20} className="text-primary" /><h3 className="font-bold text-primary">Fire & Forget Automations</h3></div>
        <p className="text-sm text-gray-600">Toggle on, and these run forever. New customer signs up? Welcome email. No visit in 30 days? Win-back sent. Fully automatic.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {autoCamps.map(ac => (
          <div key={ac.type} className={`bg-white rounded-xl border p-5 shadow-sm transition-all ${ac.enabled ? 'border-green-200 bg-green-50/20' : 'border-border'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${ac.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  <I name="zap" size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-primary">{ac.name}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">{ac.description}</p>
                </div>
              </div>
              <Toggle on={ac.enabled} onChange={() => toggleAuto(ac.type)} loading={togglingAuto[ac.type]} />
            </div>
            <div className="flex items-center gap-4 text-[11px] text-gray-400">
              <span>Trigger: <strong className="text-gray-600">{TRIGGERS.find(t => t.id === ac.trigger)?.label || ac.trigger}</strong></span>
              <span>{ac.steps?.length || 0} emails</span>
              {ac.enrolled > 0 && <span className="text-green-600 font-bold">{ac.enrolled} enrolled</span>}
              {ac.sent > 0 && <span>{ac.sent} sent</span>}
            </div>
            {/* Step preview */}
            <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1">
              {(ac.steps || []).slice(0, 5).map((step, i) => (
                <div key={i} className="flex items-center gap-1.5 flex-shrink-0">
                  {i > 0 && <><div className="w-4 h-px bg-primary/20" /><span className="text-[8px] font-bold text-gray-400">{step.delay_days}d</span><div className="w-4 h-px bg-primary/20" /></>}
                  <div className="px-2 py-1 bg-primary/5 rounded border border-primary/10 max-w-[120px]">
                    <p className="text-[9px] font-bold text-primary truncate">{step.subject?.replace('{business_name}', biz)?.substring(0, 30) || `Step ${i + 1}`}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {autoCamps.length === 0 && <div className="bg-white rounded-xl border border-border p-12 text-center">
        <I name="zap" size={40} className="text-gray-200 mx-auto mb-4" />
        <p className="text-sm text-gray-400">Automations will appear here once the backend is connected.</p>
      </div>}
    </div>}

    {/* ─── TEMPLATES ─── */}
    {tab === 'templates' && <div className="space-y-4">
      <p className="text-sm text-gray-400">Click any template to start building</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {TEMPLATES.map(t => <button key={t.id} onClick={() => useTpl(t)} className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-card hover:-translate-y-0.5 ${t.cls}`}>
          <div className="flex items-center gap-2 mb-3"><div className="p-2 rounded-lg bg-white/60"><I name={t.icon} size={16} /></div><span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{t.cat}</span></div>
          <h4 className="font-bold text-sm mb-1.5">{t.name}</h4>
          <p className="text-[11px] opacity-70 leading-relaxed line-clamp-2">{t.body.split('\n')[2] || t.body}</p>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold opacity-60"><I name="users" size={10} />{SEGS.find(s => s.id === t.aud)?.label || 'All'}</div>
        </button>)}
      </div>
    </div>}

    {/* ─── SEQUENCES ─── */}
    {tab === 'sequences' && <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Custom drip sequences</p>
        <button onClick={() => { setCreatingSeq(true); setSeq({ name: '', trigger: 'post_booking', steps: [{ delay_days: 0, subject: 'Thanks for booking!', body: 'Hi {client_name},\n\nThanks for your booking at {business_name}!' }, { delay_days: 7, subject: 'How was your visit?', body: "Hi {client_name},\n\nWe'd love your feedback!" }] }) }} className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#111111] text-white text-xs font-bold shadow-lg shadow-[#111111]/20 hover:bg-primary-hover"><I name="plus" size={14} /> New Sequence</button>
      </div>
      {seqs.length === 0 ? <div className="bg-white rounded-xl border border-border p-12 text-center"><I name="refresh" size={40} className="text-gray-200 mx-auto mb-4" /><h3 className="font-bold text-lg text-primary mb-2">No custom sequences</h3><p className="text-sm text-gray-400 mb-4">Use Automations for pre-built sequences, or create custom ones here.</p><button onClick={() => setCreatingSeq(true)} className="px-6 py-2.5 rounded-full bg-[#111111] text-white text-xs font-bold shadow-lg shadow-[#111111]/20">Create Sequence</button></div>
      : <div className="space-y-3">{seqs.map(s => <div key={s.id} className="bg-white rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4"><div className={`p-2.5 rounded-xl ${s.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}><I name="refresh" size={18} /></div><div><h4 className="font-bold text-sm text-primary">{s.name}</h4><div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400"><span>{TRIGGERS.find(t => t.id === s.trigger)?.label || s.trigger}</span><span>·</span><span>{s.steps?.length || 0} steps</span></div></div></div>
          <div className="flex items-center gap-2"><Badge status={s.is_active ? 'active' : 'paused'} /><button onClick={() => toggleSeq(s.id)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-primary"><I name={s.is_active ? 'pause' : 'play'} size={14} /></button><button onClick={() => delSeq(s.id)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><I name="trash" size={14} /></button></div>
        </div>
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">{(s.steps || []).map((st, i) => <div key={i} className="flex items-center gap-2 flex-shrink-0">{i > 0 && <><div className="w-6 h-px bg-primary/20" /><span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">{st.delay_days}d</span><div className="w-6 h-px bg-primary/20" /></>}<div className="px-3 py-2 bg-primary/5 rounded-lg border border-primary/10 max-w-[160px]"><p className="text-[10px] font-bold text-primary truncate">{st.subject || `Step ${i + 1}`}</p></div></div>)}</div>
      </div>)}</div>}
    </div>}

    {/* ─── AUDIENCE ─── */}
    {tab === 'audience' && <div className="space-y-6">
      <p className="text-sm text-gray-400">Your customer segments</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SEGS.map(s => <div key={s.id} className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-card transition-shadow">
          <div className="flex items-start justify-between mb-3"><div className={`p-2.5 rounded-xl ${s.cls}`}><I name={s.icon} size={18} /></div><span className="text-2xl font-bold text-primary">{counts[s.id]?.toLocaleString() || '0'}</span></div>
          <h4 className="font-bold text-sm text-primary">{s.label}</h4><p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
          <button onClick={() => { setComp(c => ({ ...c, audience: s.id })); setComposing(true) }} className="mt-4 w-full py-2 rounded-lg border border-border text-xs font-bold text-gray-500 hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all">Send Campaign →</button>
        </div>)}
      </div>
      <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between"><div><h3 className="font-bold text-sm text-primary">Total Contacts</h3><p className="text-xs text-gray-400 mt-0.5">Unique emails</p></div><div className="text-right"><p className="text-3xl font-bold text-primary">{counts.all?.toLocaleString() || '0'}</p><p className="text-xs text-gray-400">Unsubscribed: {stats?.total_unsubscribes || 0}</p></div></div>
        {counts.all > 0 && <><div className="mt-4 flex rounded-full overflow-hidden h-3 bg-gray-100">{[['vip','bg-amber-400'],['returning','bg-green-400'],['recent','bg-purple-400'],['new','bg-blue-400'],['inactive','bg-red-300']].map(([id,bg]) => { const pct = ((counts[id] || 0) / Math.max(counts.all, 1)) * 100; return pct >= 1 ? <div key={id} className={`${bg} transition-all duration-500`} style={{ width: `${pct}%` }} /> : null })}</div>
          <div className="flex flex-wrap gap-4 mt-3">{[['vip','bg-amber-400','VIP'],['returning','bg-green-400','Returning'],['recent','bg-purple-400','Recent'],['new','bg-blue-400','New'],['inactive','bg-red-300','Inactive']].map(([id,bg,l]) => <div key={id} className="flex items-center gap-1.5"><div className={`w-2.5 h-2.5 rounded-full ${bg}`} /><span className="text-[11px] text-gray-500">{l}</span></div>)}</div></>}
      </div>
    </div>}

    {/* ─── ANALYTICS (V10) ─── */}
    {tab === 'analytics' && <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Sent" value={stats?.total_emails_sent?.toLocaleString() || '0'} icon="send" color="primary" />
        <Stat label="Total Opened" value={stats?.total_opened?.toLocaleString() || '0'} sub={`${stats?.open_rate || 0}% rate`} icon="eye" color="green" />
        <Stat label="Total Clicked" value={stats?.total_clicked?.toLocaleString() || '0'} sub={`${stats?.click_rate || 0}% rate`} icon="click" color="blue" />
        <Stat label="Unsubscribes" value={stats?.total_unsubscribes || 0} icon="x" color="red" />
      </div>

      {/* Timeline chart */}
      <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
        <h3 className="font-bold text-sm text-primary mb-4">Email Activity (30 days)</h3>
        {analytics?.timeline?.length > 0 ? (
          <div className="space-y-3">
            <div className="flex gap-4 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Sent</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Opened</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Clicked</span>
            </div>
            <div className="h-32"><MiniChart data={timelineData} height={128} color="#111111" /></div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="h-16"><p className="text-[10px] text-gray-400 mb-1">Opens</p><MiniChart data={openData} height={48} color="#22C55E" /></div>
              <div className="h-16"><p className="text-[10px] text-gray-400 mb-1">Clicks</p><MiniChart data={clickData} height={48} color="#3B82F6" /></div>
            </div>
          </div>
        ) : <p className="text-sm text-gray-400 text-center py-8">Send your first campaign to see analytics</p>}
      </div>

      {/* Best send time + Top campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Heatmap insight */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h3 className="font-bold text-sm text-primary mb-3">Best Send Time</h3>
          {heatmap?.best_time ? (
            <div className="space-y-3">
              <div className="p-4 bg-gradient-to-r from-primary/5 to-sage/5 rounded-xl text-center">
                <p className="text-2xl font-bold text-primary">{heatmap.best_time}</p>
                <p className="text-xs text-gray-400 mt-1">When your customers open emails most</p>
              </div>
              {/* Mini day-of-week chart */}
              <div className="flex justify-between gap-1">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, i) => {
                  const dayNum = i + 1
                  const count = Object.entries(heatmap.heatmap || {}).filter(([k]) => k.startsWith(`${dayNum}-`)).reduce((sum, [, v]) => sum + v, 0)
                  const maxCount = Math.max(...[1,2,3,4,5,6,7].map(d => Object.entries(heatmap.heatmap || {}).filter(([k]) => k.startsWith(`${d}-`)).reduce((s, [, v]) => s + v, 0)), 1)
                  return <div key={day} className="flex flex-col items-center gap-1 flex-1">
                    <div className="w-full rounded" style={{ height: '40px', backgroundColor: count > 0 ? `rgba(17,17,17,${0.15 + (count / maxCount) * 0.85})` : '#f3f4f6' }} />
                    <span className="text-[9px] text-gray-400">{day}</span>
                  </div>
                })}
              </div>
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-8">Data builds as customers open emails</p>}
        </div>

        {/* Top campaigns */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h3 className="font-bold text-sm text-primary mb-3">Top Campaigns</h3>
          {topCamps.length > 0 ? (
            <div className="space-y-3">
              {topCamps.slice(0, 5).map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-primary truncate">{c.name}</p>
                    <p className="text-[10px] text-gray-400">{c.total_recipients} sent</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">{c.open_rate}%</p>
                    <p className="text-[10px] text-gray-400">open rate</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-8">Campaign performance shows here</p>}
        </div>
      </div>
    </div>}
  </div>
}

export default Marketing
