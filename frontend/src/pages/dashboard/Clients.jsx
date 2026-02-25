import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Guest CRM — matching UXPilot CRM designs
 * Guest list (left) + Detail drawer (right)
 * Wired to /clients/business/{bid} API
 */
import { useState, useEffect } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, X, ArrowLeft, Pencil, Trash2, CalendarPlus, Mail, Phone, Cake, Clock, Plus, CheckCircle2, XCircle, Star, AlertTriangle, TrendingUp, Users, PoundSterling, MapPin, MessageSquare } from 'lucide-react'

const AVATAR_COLORS = [
  { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
  { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
  { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
]
const getInitials = (n) => n ? n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??'
const getColor = (n) => { let h = 0; for (let i = 0; i < (n||'').length; i++) h = n.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }

const TAG_STYLES = {
  VIP: 'bg-purple-100 text-purple-800 border-purple-200',
  Loyal: 'bg-green-100 text-green-800 border-green-200',
  Regular: 'bg-blue-100 text-blue-800 border-blue-200',
  New: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'No-Show Risk': 'bg-red-100 text-red-800 border-red-200',
  'Birthday': 'bg-pink-100 text-pink-700 border-pink-200',
  'Allergies': 'bg-orange-100 text-orange-700 border-orange-200',
}

const Clients = () => {
  const { business, isDemo } = useBusiness()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [selectedClients, setSelectedClients] = useState([])

  const bid = business?.id ?? business?._id

  useEffect(() => {
    if (!bid || isDemo) { setLoading(false); return }
    const fetchClients = async () => {
      try { const res = await api.get(`/clients/business/${bid}`); setClients(res.clients || []) }
      catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchClients()
  }, [bid, isDemo])

  const demoClients = [
    {
      id: 'c1', name: 'Tim Henman', email: 'tim.h@example.com', phone: '+44 7700 900000', since: 'Dec 2023',
      tags: ['VIP', 'Loyal'], spend: 1245, visits: 12, avgSpend: 103.75, lastVisit: '2 days ago', noShows: 0,
      dob: 'Nov 6, 1974',
      preferences: { seating: 'Booth by window', wine: '2018 Malbec', dietary: 'No shellfish', occasion: 'Anniversary — March' },
      notes: 'Always requests booth by window. Prefers 2018 Malbec. Wife Sarah has shellfish allergy. Anniversary dinner every March.',
      consent: { email: true, sms: true, post: false },
      nextBooking: { date: 'Fri 28 Mar — 19:30', table: 'Table 1', guests: 2, notes: 'Anniversary dinner' },
      history: [
        { type: 'booking', status: 'completed', date: 'Fri 15 Mar 2025', desc: 'Table 1 · Party of 2 · 16:00-17:30', spend: 89.50, details: 'Mains: Steak, Sea Bass' },
        { type: 'email', date: 'Thu 14 Mar 2025', desc: 'Booking confirmation for Fri 15 Mar', status: 'Opened ✓' },
        { type: 'note', date: 'Wed 13 Mar 2025', desc: '"Called to request booth by window as usual. Mentioned it\'s Sarah\'s birthday next month."', author: 'Staff: Mike' },
        { type: 'no_show', date: 'Sat 14 Feb 2025', desc: 'Table 6 · Party of 2 · 19:00', spend: 40, details: 'Deposit charged' },
        { type: 'booking', status: 'completed', date: 'Wed 25 Dec 2024', desc: 'Table 8 · Party of 6 · Christmas Day dinner', spend: 380, tag: 'Christmas' },
        { type: 'booking', status: 'completed', date: 'Fri 15 Dec 2024', desc: 'Table 1 · Party of 2 · 19:00-20:30', spend: 78 },
      ],
    },
    { id: 'c2', name: 'Sarah Williams', email: 'sarah.w@example.com', phone: '+44 7700 900123', since: 'Mar 2024', tags: ['Regular'], spend: 450, visits: 8, avgSpend: 56.25, lastVisit: '1 week ago', noShows: 0, preferences: { seating: 'Garden terrace', dietary: 'Vegetarian' } },
    { id: 'c3', name: 'James Anderson', email: 'j.anderson@test.com', phone: '+44 7700 900456', since: 'Jan 2025', tags: ['New'], spend: 89, visits: 1, avgSpend: 89, lastVisit: 'Yesterday', noShows: 0 },
    { id: 'c4', name: 'Michael Brown', email: 'mbrown@test.com', phone: '+44 7700 900789', since: 'Feb 2024', tags: ['No-Show Risk'], spend: 220, visits: 4, avgSpend: 55, lastVisit: '3 months ago', noShows: 2, notes: 'Last 2 bookings were no-shows. Called both times — phone went to voicemail.' },
    { id: 'c5', name: 'Alice Miller', email: 'alice.m@test.com', phone: '+44 7700 900999', since: 'Jun 2024', tags: ['Loyal', 'Birthday'], spend: 680, visits: 9, avgSpend: 75.55, lastVisit: '5 days ago', noShows: 0, dob: 'Apr 12', preferences: { seating: 'Any', wine: 'Prosecco', dietary: 'Gluten-free' } },
  ]

  const displayClients = clients.length > 0 ? clients : (isDemo ? demoClients : [])
  const filters = ['All Guests', 'VIP', 'New', 'No-Show Risk', 'High Spenders']

  const filtered = displayClients.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.email?.toLowerCase().includes(search.toLowerCase()) && !c.phone?.includes(search)) return false
    if (activeFilter === 'VIP' && !c.tags?.includes('VIP')) return false
    if (activeFilter === 'New' && !c.tags?.includes('New')) return false
    if (activeFilter === 'No-Show Risk' && !c.tags?.includes('No-Show Risk')) return false
    if (activeFilter === 'High Spenders' && (c.spend || 0) < 500) return false
    return true
  })

  const toggleSelectAll = () => {
    if (selectedClients.length === filtered.length) setSelectedClients([])
    else setSelectedClients(filtered.map(c => c.id))
  }

  if (loading) return <RezvoLoader message="Loading guests..." />

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
      <div className="flex-1 flex flex-row overflow-hidden">

        {/* Guest List (Left) */}
        <div className={`flex-1 flex flex-col h-full overflow-hidden ${selected ? 'hidden lg:flex' : 'flex'} lg:w-2/3 xl:w-3/4`}>
          {/* Search & Filter Bar */}
          <div className="p-4 border-b border-gray-200 bg-white shrink-0 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search by name, email, or phone..." value={search} onChange={e => setSearch(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-[#1B4332] font-medium focus:ring-[#1B4332]/20 focus:border-[#1B4332] focus:bg-white transition-colors outline-none" />
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-500 font-bold hover:border-[#1B4332] hover:text-[#1B4332] flex items-center gap-2 whitespace-nowrap transition-colors">
                  <Filter className="w-3.5 h-3.5" /> Filters
                </button>
                <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-500 font-bold hover:border-[#1B4332] hover:text-[#1B4332] flex items-center gap-2 whitespace-nowrap transition-colors">
                  <ArrowUpDown className="w-3.5 h-3.5" /> Sort
                </button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filters.map(f => (
                <button key={f} onClick={() => setActiveFilter(f === 'All Guests' ? 'all' : f)}
                  className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap border transition-colors ${(activeFilter === 'all' && f === 'All Guests') || activeFilter === f ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-gray-500 border-gray-200 hover:border-[#1B4332] hover:text-[#1B4332]'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Guest Table */}
          <div className="flex-1 overflow-auto bg-white">
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><Users className="w-6 h-6 text-gray-400" /></div>
                <h3 className="font-bold text-lg text-[#1B4332] mb-2">No guests found</h3>
                <p className="text-sm text-gray-500">Try adjusting your search or filters.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-10"><input type="checkbox" checked={selectedClients.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded accent-[#1B4332]" /></th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Guest</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Contact</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Tags</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Lifetime Spend</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell text-right">Last Visit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(c => {
                    const av = getColor(c.name)
                    const isActive = selected?.id === c.id
                    return (
                      <tr key={c.id} onClick={() => setSelected(c)}
                        className={`cursor-pointer transition-colors ${isActive ? 'bg-[#1B4332]/5 border-l-4 border-l-[#1B4332]' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}>
                        <td className="px-6 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedClients.includes(c.id)} onChange={() => setSelectedClients(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])} className="w-4 h-4 rounded accent-[#1B4332]" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`h-10 w-10 rounded-full ${av.bg} flex items-center justify-center ${av.text} font-bold text-sm mr-3 border ${av.border}`}>{getInitials(c.name)}</div>
                            <div><div className="text-sm font-bold text-[#1B4332]">{c.name}</div><div className="text-xs text-gray-500">Since {c.since}</div></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                          <div className="text-sm text-[#1B4332]">{c.email}</div>
                          <div className="text-xs text-gray-500">{c.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                          <div className="flex gap-1 flex-wrap">
                            {c.tags?.map(t => <span key={t} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${TAG_STYLES[t] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{t}</span>)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-bold text-[#1B4332]">£{(c.spend || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                          <div className="text-xs text-gray-500">{c.visits || 0} visits</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right hidden sm:table-cell">
                          <div className="text-sm text-[#1B4332]">{c.lastVisit || '—'}</div>
                          {c.nextBooking && <div className="text-xs text-green-600 font-medium">Next: {typeof c.nextBooking === 'string' ? c.nextBooking : c.nextBooking.date?.split(' — ')[0]}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
            <p className="text-sm text-gray-500">Showing <span className="font-bold text-[#1B4332]">1</span> to <span className="font-bold text-[#1B4332]">{filtered.length}</span> of <span className="font-bold text-[#1B4332]">{filtered.length}</span></p>
            <div className="flex gap-0">
              <button className="px-2 py-2 rounded-l-md border border-gray-200 bg-white text-sm text-gray-400 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
              <button className="px-4 py-2 border border-[#1B4332] bg-[#1B4332]/5 text-sm font-bold text-[#1B4332]">1</button>
              <button className="px-2 py-2 rounded-r-md border border-gray-200 bg-white text-sm text-gray-400 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* Detail Panel (Right) */}
        <div className={`${selected ? 'flex' : 'hidden lg:flex'} flex-col w-full lg:w-[420px] xl:w-[460px] bg-white border-l border-gray-200 h-full overflow-y-auto absolute lg:static inset-0 z-30`}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 text-gray-400" /></div>
              <h3 className="font-bold text-lg text-[#1B4332] mb-2">Select a guest</h3>
              <p className="text-sm text-gray-500">Click on a guest to view their full profile and history.</p>
            </div>
          ) : (() => {
            const c = selected
            const av = getColor(c.name)
            return (
              <>
                {/* Panel Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 shrink-0">
                  <div className="flex items-center gap-3">
                    <button className="lg:hidden text-gray-500 hover:text-[#1B4332]" onClick={() => setSelected(null)}><ArrowLeft className="w-5 h-5" /></button>
                    <h2 className="text-lg font-bold text-[#1B4332]">Guest Profile</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-500 hover:text-[#1B4332] rounded-full hover:bg-gray-50"><Pencil className="w-4 h-4" /></button>
                    <button className="p-2 text-gray-500 hover:text-red-500 rounded-full hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    <button className="lg:hidden p-2 text-gray-500 hover:text-[#1B4332]" onClick={() => setSelected(null)}><X className="w-5 h-5" /></button>
                  </div>
                </div>

                {/* Profile Header */}
                <div className="p-6 text-center border-b border-gray-200 bg-gray-50/50">
                  <div className="relative inline-block">
                    <div className={`w-20 h-20 rounded-full ${av.bg} flex items-center justify-center ${av.text} font-bold text-2xl border-2 border-white shadow-md mx-auto mb-3`}>{getInitials(c.name)}</div>
                    <span className="absolute bottom-3 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                  </div>
                  <h3 className="text-xl font-bold text-[#1B4332] mb-0.5">{c.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">Guest since {c.since}</p>
                  <div className="flex justify-center gap-3 mb-4">
                    <button className="bg-[#1B4332] text-white text-sm font-bold px-5 py-2 rounded-lg shadow-md hover:bg-[#2D6A4F] transition-colors flex items-center gap-2"><CalendarPlus className="w-4 h-4" /> Book</button>
                    <button className="bg-white text-[#1B4332] border border-gray-200 text-sm font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-2"><Mail className="w-4 h-4" /> Message</button>
                  </div>
                  <div className="flex justify-center gap-2 flex-wrap">
                    {c.tags?.map(t => <span key={t} className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${TAG_STYLES[t] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{t}</span>)}
                    <button className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-white text-gray-500 border border-dashed border-gray-400 hover:border-[#1B4332] hover:text-[#1B4332] transition-colors gap-1"><Plus className="w-3 h-3" /> Add Tag</button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 divide-x divide-gray-200 border-b border-gray-200 bg-white">
                  <div className="p-3 text-center"><div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Visits</div><div className="text-lg font-bold text-[#1B4332]">{c.visits || 0}</div></div>
                  <div className="p-3 text-center"><div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Spend</div><div className="text-lg font-bold text-[#1B4332]">£{c.spend >= 1000 ? `${(c.spend / 1000).toFixed(1)}k` : c.spend || 0}</div></div>
                  <div className="p-3 text-center"><div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Avg</div><div className="text-lg font-bold text-[#1B4332]">£{(c.avgSpend || 0).toFixed(0)}</div></div>
                  <div className="p-3 text-center"><div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">No-Shows</div><div className={`text-lg font-bold ${(c.noShows || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>{c.noShows || 0}</div></div>
                </div>

                {/* Contact */}
                <div className="p-5 border-b border-gray-200">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Contact</h4>
                  <div className="space-y-2.5">
                    {c.phone && <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"><Phone className="w-3.5 h-3.5" /></div><span className="text-[#1B4332] font-medium">{c.phone}</span></div>}
                    {c.email && <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"><Mail className="w-3.5 h-3.5" /></div><span className="text-[#1B4332] font-medium">{c.email}</span></div>}
                    {c.dob && <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"><Cake className="w-3.5 h-3.5" /></div><span className="text-[#1B4332] font-medium">{c.dob}</span></div>}
                  </div>
                </div>

                {/* Preferences */}
                {c.preferences && (
                  <div className="p-5 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Preferences & Notes</h4>
                      <button className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-[#1B4332]"><Pencil className="w-3 h-3" /></button>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(c.preferences).map(([key, val]) => (
                        <div key={key} className="flex items-start gap-2">
                          <span className="text-xs font-bold text-gray-500 capitalize w-16 shrink-0 pt-0.5">{key}</span>
                          <span className="text-sm text-[#1B4332]">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {c.notes && (
                  <div className="p-5 border-b border-gray-200 bg-yellow-50/30">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Notes</h4>
                      <button className="text-xs font-bold text-[#1B4332] hover:underline">Edit</button>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-[#1B4332]/80 italic">
                      <p>{c.notes}</p>
                    </div>
                  </div>
                )}

                {/* Upcoming */}
                {c.nextBooking && typeof c.nextBooking === 'object' && (
                  <div className="p-5 border-b border-gray-200">
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Upcoming</h4>
                    <div className="bg-[#FEFBF4] rounded-xl p-4 border border-gray-200">
                      <p className="font-bold text-[#1B4332] text-sm mb-1">{c.nextBooking.date}</p>
                      <p className="text-xs text-gray-500">{c.nextBooking.table} · {c.nextBooking.guests} guests</p>
                      {c.nextBooking.notes && <p className="text-xs text-gray-500 mt-1">{c.nextBooking.notes}</p>}
                    </div>
                  </div>
                )}

                {/* Marketing Consent */}
                {c.consent && (
                  <div className="p-5 border-b border-gray-200">
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Marketing</h4>
                    <div className="flex gap-4">
                      {Object.entries(c.consent).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-1.5">
                          {val ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}
                          <span className={`text-sm ${val ? 'text-[#1B4332]' : 'text-gray-400'}`}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity Timeline */}
                <div className="p-5 pb-20">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">History</h4>
                    <button className="text-xs font-bold text-[#1B4332] hover:underline">View All</button>
                  </div>
                  {c.history?.length > 0 ? (
                    <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[15px] before:w-0.5 before:bg-gray-200">
                      {c.history.map((h, i) => {
                        const isNoShow = h.type === 'no_show'
                        const isNote = h.type === 'note'
                        const isEmail = h.type === 'email'
                        const iconColor = isNoShow ? 'border-red-300 bg-red-50' : isNote ? 'border-yellow-300 bg-yellow-50' : isEmail ? 'border-blue-300 bg-blue-50' : 'border-green-300 bg-green-50'
                        return (
                          <div key={i} className="relative z-10 pl-10">
                            <div className={`absolute left-0 top-1 w-8 h-8 rounded-full bg-white flex items-center justify-center border-2 ${iconColor}`}>
                              {isNoShow ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> :
                               isNote ? <MessageSquare className="w-3.5 h-3.5 text-yellow-600" /> :
                               isEmail ? <Mail className="w-3.5 h-3.5 text-blue-500" /> :
                               <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                            </div>
                            <div className={`${isNoShow ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} border rounded-lg p-3`}>
                              <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs font-bold ${isNoShow ? 'text-red-600' : 'text-[#1B4332]'}`}>
                                  {h.type === 'booking' ? 'Booking' : h.type === 'no_show' ? 'No Show' : h.type === 'note' ? 'Note' : 'Email'} — {h.date}
                                </span>
                                {h.tag && <span className="text-[10px] font-bold text-[#D4A373] bg-[#D4A373]/10 px-2 py-0.5 rounded-full">{h.tag}</span>}
                              </div>
                              <p className="text-sm text-gray-600">{h.desc}</p>
                              {h.spend > 0 && <p className={`text-sm font-bold mt-1 ${isNoShow ? 'text-red-600' : 'text-[#1B4332]'}`}>{isNoShow ? 'Deposit charged' : 'Spend'}: £{h.spend.toFixed(2)}</p>}
                              {h.details && <p className="text-xs text-gray-500 mt-0.5">{h.details}</p>}
                              {h.status && !h.spend && <span className="inline-block mt-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{h.status}</span>}
                              {h.author && <p className="text-xs text-gray-400 mt-1">{h.author}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No history yet.</p>
                  )}
                </div>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

export default Clients
