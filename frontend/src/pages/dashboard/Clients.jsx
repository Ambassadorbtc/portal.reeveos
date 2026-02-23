/**
 * Clients (CRM) — styled to match 8-Brand Design - Clients (CRM).html
 * Searchable table with filter pills, client detail panel, profile, notes, activity timeline
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
  VIP: 'bg-purple-100 text-purple-800', Loyal: 'bg-green-100 text-green-800', Regular: 'bg-blue-100 text-blue-800',
  New: 'bg-yellow-100 text-yellow-800', 'No-Show Risk': 'bg-red-100 text-red-800'
}

const Clients = () => {
  const { business, isDemo } = useBusiness()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const bid = business?.id ?? business?._id

  useEffect(() => {
    if (!bid || isDemo) { setLoading(false); return }
    const fetchClients = async () => {
      try { const res = await api.get(`/clients/business/${bid}`); setClients(res.clients || []) }
      catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchClients()
  }, [bid])

  const demoClients = [
    { id: 'c1', name: 'Emma Stone', email: 'emma.stone@example.com', phone: '+44 7700 900000', since: 'Jan 2023', tags: ['VIP', 'Loyal'], spend: '£1,245.00', visits: 12, lastVisit: '2 days ago', nextBooking: 'Oct 24', noShows: 0 },
    { id: 'c2', name: 'James Rodriguez', email: 'j.rodriguez@example.com', phone: '+44 7700 900123', since: 'Mar 2023', tags: ['Regular'], spend: '£450.00', visits: 8, lastVisit: '1 week ago', nextBooking: null, noShows: 0 },
    { id: 'c3', name: 'Anna Lee', email: 'anna.lee@test.com', phone: '+44 7700 900456', since: 'Aug 2023', tags: ['New'], spend: '£85.00', visits: 1, lastVisit: 'Yesterday', nextBooking: null, noShows: 0 },
    { id: 'c4', name: 'Michael Jordan', email: 'mj@basket.com', phone: '+44 7700 900789', since: 'Feb 2022', tags: ['No-Show Risk'], spend: '£220.00', visits: 4, lastVisit: '3 months ago', nextBooking: null, noShows: 2 },
    { id: 'c5', name: 'Sarah Rose', email: 'sarah.r@test.com', phone: '+44 7700 900999', since: 'Dec 2022', tags: [], spend: '£150.00', visits: 3, lastVisit: '1 month ago', nextBooking: null, noShows: 0 },
  ]

  const displayClients = (clients.length > 0 || !isDemo) ? clients : demoClients
  const filters = ['all', 'VIP', 'New', 'Regular', 'No-Show Risk']

  const filtered = displayClients.filter(c => {
    if (filter !== 'all' && !(c.tags || []).includes(filter)) return false
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase()) && !c.email?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const activity = [
    { type: 'upcoming', label: 'UPCOMING', service: 'Full Head Colour', date: 'Oct 24, 10:00 AM • with Sarah', price: '£85.00' },
    { type: 'completed', label: 'COMPLETED', service: 'Ladies Cut & Blow Dry', date: 'Oct 2, 2:30 PM • with John', price: '£45.00' },
    { type: 'completed', label: 'COMPLETED', service: 'Balayage', date: 'Aug 15, 11:00 AM • with Sarah', price: '£120.00' },
  ]

  return (
    <div className="-m-6 lg:-m-8 flex h-[calc(100vh-4rem)]">
      {/* Client List */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Search & Filters */}
        <div className="p-4 border-b border-border bg-white space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input type="text" placeholder="Search by name, email, or phone..." value={search} onChange={e => setSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-gray-50 text-sm text-primary font-medium focus:ring-primary focus:border-primary focus:bg-white transition-colors" />
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-sm hover:bg-primary-hover transition-colors flex items-center gap-2">
                <i className="fa-solid fa-plus" /> Add Client
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap border transition-colors ${filter === f ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-border hover:border-primary hover:text-primary'}`}>
                {f === 'all' ? 'All Clients' : f}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-10"><input type="checkbox" className="w-4 h-4 rounded" /></th>
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
                  return (
                    <tr key={c.id} onClick={() => setSelected(c)} className={`cursor-pointer transition-colors ${selected?.id === c.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}>
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}><input type="checkbox" className="w-4 h-4 rounded" /></td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`h-10 w-10 rounded-full ${av.bg} flex items-center justify-center ${av.text} font-bold text-sm mr-3 border ${av.border}`}>{getInitials(c.name)}</div>
                          <div><div className="text-sm font-bold text-primary">{c.name}</div><div className="text-xs text-gray-500">Since {c.since}</div></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell"><div className="text-sm text-gray-700">{c.email}</div><div className="text-xs text-gray-500">{c.phone}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                        {(c.tags || []).map(t => <span key={t} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-1 ${TAG_STYLES[t] || 'bg-gray-100 text-gray-600'}`}>{t}</span>)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right"><div className="text-sm font-bold text-primary">{c.spend}</div><div className="text-xs text-gray-500">{c.visits} visits</div></td>
                      <td className="px-6 py-4 whitespace-nowrap text-right hidden sm:table-cell">
                        <div className="text-sm text-gray-700">{c.lastVisit}</div>
                        {c.nextBooking ? <div className="text-xs text-green-600 font-medium">Booked next: {c.nextBooking}</div> : c.noShows > 0 ? <div className="text-xs text-red-500 font-medium">Last {c.noShows} cancelled</div> : <div className="text-xs text-gray-500">No future bookings</div>}
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
          <p className="text-sm text-gray-500">Showing <span className="font-bold text-primary">1</span> to <span className="font-bold text-primary">{filtered.length}</span> of <span className="font-bold text-primary">{displayClients.length}</span></p>
          <div className="flex gap-1">
            <button className="px-3 py-1.5 border border-border bg-white rounded text-xs font-medium text-gray-400" disabled><i className="fa-solid fa-chevron-left text-xs" /></button>
            <button className="px-3 py-1.5 border border-primary bg-primary/5 rounded text-xs font-bold text-primary">1</button>
            <button className="px-3 py-1.5 border border-border bg-white rounded text-xs font-medium text-gray-500 hover:bg-gray-50">2</button>
            <button className="px-3 py-1.5 border border-border bg-white rounded text-xs font-medium text-gray-400"><i className="fa-solid fa-chevron-right text-xs" /></button>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <div className={`${selected ? 'hidden lg:flex' : 'hidden'} flex-col w-[400px] xl:w-[450px] bg-white border-l border-border h-full overflow-y-auto`}>
        {selected && (
          <>
            {/* Panel Header */}
            <div className="px-6 py-5 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-heading font-bold text-primary">Client Profile</h2>
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-primary rounded-full hover:bg-gray-50"><i className="fa-solid fa-pen text-sm" /></button>
                <button className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"><i className="fa-solid fa-trash text-sm" /></button>
              </div>
            </div>

            {/* Profile Header */}
            <div className="p-6 text-center border-b border-border bg-gray-50/50">
              {(() => { const av = getColor(selected.name); return (
                <div className="relative inline-block">
                  <div className={`w-24 h-24 rounded-full ${av.bg} flex items-center justify-center ${av.text} font-heading font-bold text-3xl border-2 border-white shadow-md mx-auto mb-3`}>{getInitials(selected.name)}</div>
                  <span className="absolute bottom-3 right-0 w-5 h-5 bg-green-500 border-2 border-white rounded-full" />
                </div>
              ) })()}
              <h3 className="text-xl font-heading font-bold text-primary">{selected.name}</h3>
              <p className="text-sm text-gray-500 mb-4">Member since {selected.since}</p>
              <div className="flex justify-center gap-3 mb-4">
                <button className="bg-primary text-white text-sm font-bold px-6 py-2 rounded-lg shadow-md hover:bg-primary-hover flex items-center gap-2"><i className="fa-regular fa-calendar-plus" /> Book</button>
                <button className="bg-white text-primary border border-border text-sm font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2"><i className="fa-regular fa-envelope" /> Message</button>
              </div>
              <div className="flex justify-center gap-2 flex-wrap">
                {(selected.tags || []).map(t => <span key={t} className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${t === 'VIP' ? 'bg-purple-100 text-purple-800 border-purple-200' : t === 'Loyal' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{t}</span>)}
                <button className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-white text-gray-500 border border-dashed border-gray-300 hover:border-primary hover:text-primary"><i className="fa-solid fa-plus mr-1" /> Add Tag</button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-white">
              <div className="p-4 text-center"><div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Visits</div><div className="text-xl font-heading font-bold text-primary">{selected.visits}</div></div>
              <div className="p-4 text-center"><div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">No-Shows</div><div className={`text-xl font-heading font-bold ${selected.noShows === 0 ? 'text-green-600' : 'text-red-500'}`}>{selected.noShows}</div></div>
              <div className="p-4 text-center"><div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Spend</div><div className="text-xl font-heading font-bold text-primary">{selected.spend}</div></div>
            </div>

            {/* Contact */}
            <div className="p-6 border-b border-border">
              <h4 className="text-sm font-bold text-primary mb-3 uppercase tracking-wider">Contact Details</h4>
              <div className="space-y-3">
                {[{ icon: 'fa-phone', value: selected.phone },{ icon: 'fa-envelope', value: selected.email }].map(c => (
                  <div key={c.icon} className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"><i className={`fa-solid ${c.icon} text-xs`} /></div>
                    <span className="text-gray-700 font-medium">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="p-6 border-b border-border bg-yellow-50/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Notes</h4>
                <button className="text-xs font-bold text-primary hover:underline">Edit</button>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-primary/80 italic relative">
                <i className="fa-solid fa-quote-left text-yellow-300 absolute top-2 left-2 opacity-50" />
                <p className="pl-4">Click edit to add client notes, preferences, and important details.</p>
              </div>
            </div>

            {/* Activity */}
            <div className="p-6 pb-20">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Recent Activity</h4>
                <button className="text-xs font-bold text-primary hover:underline">View All</button>
              </div>
              <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[17px] before:w-0.5 before:bg-border">
                {activity.map((a, i) => (
                  <div key={i} className="relative z-10 pl-10">
                    <div className={`absolute left-0 top-1 w-9 h-9 rounded-full bg-white border-2 flex items-center justify-center ${a.type === 'upcoming' ? 'border-primary' : 'border-border'}`}>
                      <i className={`${a.type === 'upcoming' ? 'fa-regular fa-calendar text-primary' : 'fa-solid fa-check text-green-500'} text-xs`} />
                    </div>
                    <div className={`${a.type === 'upcoming' ? 'bg-white border border-border shadow-sm' : 'bg-gray-50 border border-border'} rounded-lg p-3`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs font-bold ${a.type === 'upcoming' ? 'text-primary bg-primary/10 px-2 py-0.5 rounded' : 'text-green-600'}`}>{a.label}</span>
                        <span className={`text-xs font-bold ${a.type === 'upcoming' ? 'text-primary' : 'text-gray-500'}`}>{a.price}</span>
                      </div>
                      <div className={`text-sm font-bold ${a.type === 'upcoming' ? 'text-primary' : 'text-gray-700'}`}>{a.service}</div>
                      <div className="text-xs text-gray-500 mt-1"><i className="fa-regular fa-clock mr-1" />{a.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile Detail Overlay */}
      {selected && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 sticky top-0 bg-white z-10">
            <button onClick={() => setSelected(null)} className="text-primary"><i className="fa-solid fa-arrow-left" /></button>
            <h2 className="font-heading font-bold text-primary">Client Profile</h2>
          </div>
          <div className="p-6 text-center">
            {(() => { const av = getColor(selected.name); return <div className={`w-20 h-20 rounded-full ${av.bg} flex items-center justify-center ${av.text} font-heading font-bold text-2xl border-2 border-white shadow-md mx-auto mb-3`}>{getInitials(selected.name)}</div> })()}
            <h3 className="text-xl font-heading font-bold text-primary">{selected.name}</h3>
            <p className="text-sm text-gray-500">{selected.email}</p>
            <p className="text-sm text-gray-500">{selected.phone}</p>
            <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg mt-4">
              <div className="p-3 text-center"><div className="text-xs text-gray-500">Visits</div><div className="font-bold text-primary">{selected.visits}</div></div>
              <div className="p-3 text-center"><div className="text-xs text-gray-500">Spend</div><div className="font-bold text-primary">{selected.spend}</div></div>
              <div className="p-3 text-center"><div className="text-xs text-gray-500">No-Shows</div><div className="font-bold text-primary">{selected.noShows}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Clients
