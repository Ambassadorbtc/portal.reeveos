import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Clients (CRM) — styled to match 8-Brand Design - Clients (CRM).html
 * List + Detail panel with profile, tags, stats, notes, activity timeline
 */

import { useState, useEffect } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

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
    const fetch = async () => {
      try { const res = await api.get(`/clients/business/${bid}`); setClients(res.clients || []) }
      catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetch()
  }, [bid, isDemo])

  const demoClients = [
    { id: 'c1', name: 'Emma Stone', email: 'emma.stone@example.com', phone: '+44 7700 900000', since: 'Jan 2023', tags: ['VIP', 'Loyal'], spend: 1245, visits: 12, lastVisit: '2 days ago', nextBooking: 'Oct 24', noShows: 0, dob: 'Nov 6, 1988', notes: 'Prefers quiet appointments. Allergic to lavender products. Likes tea with oat milk.', consent: { email: true, sms: true, post: false, photos: true }, history: [
      { type: 'upcoming', service: 'Full Head Colour', date: 'Oct 24, 10:00 AM', staff: 'Sarah', price: 85 },
      { type: 'completed', service: 'Ladies Cut & Blow Dry', date: 'Oct 2, 2:30 PM', staff: 'John', price: 45 },
      { type: 'completed', service: 'Balayage', date: 'Aug 15, 11:00 AM', staff: 'Sarah', price: 120 },
    ]},
    { id: 'c2', name: 'James Rodriguez', email: 'j.rodriguez@example.com', phone: '+44 7700 900123', since: 'Mar 2023', tags: ['Regular'], spend: 450, visits: 8, lastVisit: '1 week ago', noShows: 0 },
    { id: 'c3', name: 'Anna Lee', email: 'anna.lee@test.com', phone: '+44 7700 900456', since: 'Aug 2023', tags: ['New'], spend: 85, visits: 1, lastVisit: 'Yesterday', noShows: 0 },
    { id: 'c4', name: 'Michael Jordan', email: 'mj@basket.com', phone: '+44 7700 900789', since: 'Feb 2022', tags: ['No-Show Risk'], spend: 220, visits: 4, lastVisit: '3 months ago', lastNote: 'Last 2 cancelled', noShows: 2 },
    { id: 'c5', name: 'Sarah Rose', email: 'sarah.r@test.com', phone: '+44 7700 900999', since: 'Dec 2022', tags: [], spend: 150, visits: 3, lastVisit: '1 month ago', noShows: 0 },
  ]

  const displayClients = clients.length > 0 ? clients : (isDemo ? demoClients : [])
  const filters = ['All Clients', 'VIP', 'New Clients', 'Inactive (>90 days)', 'High Spenders']

  const filtered = displayClients.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.email?.toLowerCase().includes(search.toLowerCase())) return false
    if (activeFilter === 'VIP' && !c.tags?.includes('VIP')) return false
    if (activeFilter === 'New Clients' && !c.tags?.includes('New')) return false
    return true
  })

  const toggleSelectAll = () => {
    if (selectedClients.length === filtered.length) setSelectedClients([])
    else setSelectedClients(filtered.map(c => c.id))
  }

  if (loading) {
    return <RezvoLoader message="Loading clients..." />
  }

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-1 flex flex-row overflow-hidden">

        {/* Client List (Left) */}
        <div className="flex-1 flex flex-col h-full overflow-hidden lg:w-2/3 xl:w-3/4">
          {/* Search & Filter Bar */}
          <div className="p-4 border-b border-border bg-white shrink-0 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type="text" placeholder="Search by name, email, or phone..." value={search} onChange={e => setSearch(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-gray-50 text-sm text-primary font-medium focus:ring-primary focus:border-primary focus:bg-white transition-colors" />
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-2 bg-white border border-border rounded-lg text-sm text-gray-500 font-bold hover:border-primary hover:text-primary flex items-center gap-2 whitespace-nowrap">
                  <i className="fa-solid fa-filter" /> Filters
                </button>
                <button className="px-3 py-2 bg-white border border-border rounded-lg text-sm text-gray-500 font-bold hover:border-primary hover:text-primary flex items-center gap-2 whitespace-nowrap">
                  <i className="fa-solid fa-sort" /> Sort
                </button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filters.map(f => (
                <button key={f} onClick={() => setActiveFilter(f === 'All Clients' ? 'all' : f)}
                  className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap border transition-colors ${(activeFilter === 'all' && f === 'All Clients') || activeFilter === f ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-border hover:border-primary hover:text-primary'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Client Table */}
          <div className="flex-1 overflow-auto bg-white">
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fa-solid fa-users text-gray-400 text-xl" /></div>
                <h3 className="font-heading font-bold text-lg text-primary mb-2">No clients found</h3>
                <p className="text-sm text-gray-500">Try adjusting your search or filters.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-10"><input type="checkbox" checked={selectedClients.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="w-4 h-4 text-primary rounded" /></th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Client Name</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Contact</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Tags</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Lifetime Spend</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell text-right">Last Visit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(c => {
                    const av = getColor(c.name)
                    const isActive = selected?.id === c.id
                    return (
                      <tr key={c.id} onClick={() => setSelected(c)}
                        className={`cursor-pointer transition-colors ${isActive ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}>
                        <td className="px-6 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedClients.includes(c.id)} onChange={() => setSelectedClients(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])} className="w-4 h-4 text-primary rounded" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`h-10 w-10 rounded-full ${av.bg} flex items-center justify-center ${av.text} font-bold text-sm mr-3 border ${av.border}`}>{getInitials(c.name)}</div>
                            <div><div className="text-sm font-bold text-primary">{c.name}</div><div className="text-xs text-gray-500">Since {c.since}</div></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                          <div className="text-sm text-primary">{c.email}</div>
                          <div className="text-xs text-gray-500">{c.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                          <div className="flex gap-1 flex-wrap">
                            {c.tags?.map(t => <span key={t} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${TAG_STYLES[t] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{t}</span>)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-bold text-primary">£{(c.spend || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                          <div className="text-xs text-gray-500">{c.visits || 0} visits</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right hidden sm:table-cell">
                          <div className="text-sm text-primary">{c.lastVisit || '—'}</div>
                          {c.nextBooking && <div className="text-xs text-green-600 font-medium">Booked next: {c.nextBooking}</div>}
                          {c.lastNote && <div className="text-xs text-red-500 font-medium">{c.lastNote}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="bg-white border-t border-border px-6 py-3 flex items-center justify-between shrink-0">
            <p className="text-sm text-gray-500">Showing <span className="font-bold text-primary">1</span> to <span className="font-bold text-primary">{filtered.length}</span> of <span className="font-bold text-primary">{filtered.length}</span> results</p>
            <div className="flex gap-0">
              <button className="px-2 py-2 rounded-l-md border border-border bg-white text-sm text-gray-400 hover:bg-gray-50"><i className="fa-solid fa-chevron-left text-xs" /></button>
              <button className="px-4 py-2 border border-primary bg-primary/5 text-sm font-bold text-primary">1</button>
              <button className="px-2 py-2 rounded-r-md border border-border bg-white text-sm text-gray-400 hover:bg-gray-50"><i className="fa-solid fa-chevron-right text-xs" /></button>
            </div>
          </div>
        </div>

        {/* Detail Panel (Right) */}
        <div className={`${selected ? 'flex' : 'hidden lg:flex'} flex-col w-full lg:w-[400px] xl:w-[450px] bg-white border-l border-border h-full overflow-y-auto absolute lg:static inset-0 z-30`}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4"><i className="fa-solid fa-user text-gray-400 text-2xl" /></div>
              <h3 className="font-heading font-bold text-lg text-primary mb-2">Select a client</h3>
              <p className="text-sm text-gray-500">Click on a client to view their profile and history.</p>
            </div>
          ) : (() => {
            const c = selected
            const av = getColor(c.name)
            return (
              <>
                {/* Panel Header */}
                <div className="px-6 py-5 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10 shrink-0">
                  <div className="flex items-center gap-3">
                    <button className="lg:hidden text-gray-500 hover:text-primary" onClick={() => setSelected(null)}><i className="fa-solid fa-arrow-left" /></button>
                    <h2 className="text-lg font-heading font-bold text-primary">Client Profile</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-500 hover:text-primary rounded-full hover:bg-gray-50"><i className="fa-solid fa-pen text-sm" /></button>
                    <button className="p-2 text-gray-500 hover:text-red-500 rounded-full hover:bg-red-50"><i className="fa-solid fa-trash text-sm" /></button>
                    <button className="lg:hidden p-2 text-gray-500 hover:text-primary" onClick={() => setSelected(null)}><i className="fa-solid fa-xmark text-lg" /></button>
                  </div>
                </div>

                {/* Profile Header */}
                <div className="p-6 text-center border-b border-border bg-gray-50/50">
                  <div className="relative inline-block">
                    <div className={`w-24 h-24 rounded-full ${av.bg} flex items-center justify-center ${av.text} font-heading font-bold text-3xl border-2 border-white shadow-md mx-auto mb-3`}>{getInitials(c.name)}</div>
                    <span className="absolute bottom-3 right-0 w-5 h-5 bg-green-500 border-2 border-white rounded-full" />
                  </div>
                  <h3 className="text-xl font-heading font-bold text-primary">{c.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">Member since {c.since}</p>
                  <div className="flex justify-center gap-3 mb-4">
                    <button className="bg-primary text-white text-sm font-bold px-6 py-2 rounded-lg shadow-md hover:bg-primary-hover transition-colors flex items-center gap-2"><i className="fa-regular fa-calendar-plus" /> Book</button>
                    <button className="bg-white text-primary border border-border text-sm font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-2"><i className="fa-regular fa-envelope" /> Message</button>
                  </div>
                  <div className="flex justify-center gap-2 flex-wrap">
                    {c.tags?.map(t => <span key={t} className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${TAG_STYLES[t] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{t}</span>)}
                    <button className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-white text-gray-500 border border-dashed border-gray-400 hover:border-primary hover:text-primary transition-colors"><i className="fa-solid fa-plus mr-1" /> Add Tag</button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-white">
                  <div className="p-4 text-center"><div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Visits</div><div className="text-xl font-heading font-bold text-primary">{c.visits || 0}</div></div>
                  <div className="p-4 text-center"><div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">No-Shows</div><div className={`text-xl font-heading font-bold ${(c.noShows || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>{c.noShows || 0}</div></div>
                  <div className="p-4 text-center"><div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Spend</div><div className="text-xl font-heading font-bold text-primary">£{c.spend >= 1000 ? `${(c.spend / 1000).toFixed(1)}k` : c.spend}</div></div>
                </div>

                {/* Contact Info */}
                <div className="p-6 border-b border-border">
                  <h4 className="text-sm font-bold text-primary mb-3 uppercase tracking-wider">Contact Details</h4>
                  <div className="space-y-3">
                    {c.phone && <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"><i className="fa-solid fa-phone text-xs" /></div><span className="text-primary font-medium">{c.phone}</span></div>}
                    {c.email && <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"><i className="fa-solid fa-envelope text-xs" /></div><span className="text-primary font-medium">{c.email}</span></div>}
                    {c.dob && <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"><i className="fa-solid fa-cake-candles text-xs" /></div><span className="text-primary font-medium">{c.dob}</span></div>}
                  </div>
                </div>

                {/* Notes */}
                {c.notes && (
                  <div className="p-6 border-b border-border bg-yellow-50/30">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Notes</h4>
                      <button className="text-xs font-bold text-primary hover:underline">Edit</button>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-primary/80 italic relative">
                      <i className="fa-solid fa-quote-left text-yellow-300 absolute top-2 left-2 opacity-50" />
                      <p className="pl-4">{c.notes}</p>
                    </div>
                  </div>
                )}

                {/* Consent */}
                {c.consent && (
                  <div className="p-6 border-b border-border">
                    <h4 className="text-sm font-bold text-primary mb-3 uppercase tracking-wider">Marketing Consent</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(c.consent).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2">
                          <i className={`fa-solid ${val ? 'fa-circle-check text-green-500' : 'fa-circle-xmark text-gray-400'} text-sm`} />
                          <span className={`text-sm ${val ? 'text-primary' : 'text-gray-500'}`}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity Timeline */}
                <div className="p-6 pb-20">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Recent Activity</h4>
                    <button className="text-xs font-bold text-primary hover:underline">View All</button>
                  </div>
                  {c.history?.length > 0 ? (
                    <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[17px] before:w-0.5 before:bg-border">
                      {c.history.map((h, i) => (
                        <div key={i} className="relative z-10 pl-10">
                          <div className={`absolute left-0 top-1 w-9 h-9 rounded-full bg-white flex items-center justify-center border-2 ${h.type === 'upcoming' ? 'border-primary' : 'border-border'}`}>
                            <i className={`${h.type === 'upcoming' ? 'fa-regular fa-calendar text-primary' : 'fa-solid fa-check text-green-500'} text-xs`} />
                          </div>
                          <div className={`${h.type === 'upcoming' ? 'bg-white border-border shadow-sm' : 'bg-gray-50 border-border'} border rounded-lg p-3`}>
                            <div className="flex justify-between items-start mb-1">
                              <span className={`text-xs font-bold ${h.type === 'upcoming' ? 'text-primary bg-primary/10 px-2 py-0.5 rounded' : 'text-green-600'}`}>{h.type === 'upcoming' ? 'UPCOMING' : 'COMPLETED'}</span>
                              <span className={`text-xs font-bold ${h.type === 'upcoming' ? 'text-primary' : 'text-gray-500'}`}>£{h.price?.toFixed(2)}</span>
                            </div>
                            <div className={`text-sm font-bold ${h.type === 'upcoming' ? 'text-primary' : 'text-gray-700'}`}>{h.service}</div>
                            <div className="text-xs text-gray-500 mt-1"><i className="fa-regular fa-clock mr-1" />{h.date} • with {h.staff}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No activity yet.</p>
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
