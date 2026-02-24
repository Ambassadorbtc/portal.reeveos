import { useState, useEffect } from 'react'
import { Building2, Search, RefreshCw, MapPin, Calendar, Users, ChevronRight, Globe, Star, ExternalLink } from 'lucide-react'

const api = (path) => fetch(`/api${path}`).then(r => r.ok ? r.json() : null).catch(() => null)

export default function AdminBusinesses() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const load = async () => {
    setLoading(true)
    const res = await api(`/admin/businesses?search=${encodeURIComponent(search)}`)
    setData(res)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Businesses</h1>
          <p className="text-xs text-gray-500 mt-0.5">All registered businesses on the platform</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 text-xs hover:bg-gray-700">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: data?.total ?? '—', color: 'emerald' },
          { label: 'Claimed', value: data?.businesses?.filter(b => b.claimed || b.owner_id).length ?? '—', color: 'blue' },
          { label: 'Unclaimed', value: data?.businesses?.filter(b => !b.claimed && !b.owner_id).length ?? '—', color: 'amber' },
          { label: 'With Bookings', value: data?.businesses?.filter(b => b.booking_count > 0).length ?? '—', color: 'purple' },
        ].map((s, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search businesses..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
        </div>
        <button type="submit" className="px-4 py-2.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">Search</button>
      </form>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-emerald-500" size={20} /></div>
      ) : (
        <div className="space-y-2">
          {data?.businesses?.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">No businesses found</div>
          )}
          {data?.businesses?.map((b, i) => (
            <div
              key={i}
              onClick={() => setSelected(selected === i ? null : i)}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{b.name || 'Unnamed'}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      {b.business_type && <span className="capitalize">{b.business_type}</span>}
                      {b.city && <span className="flex items-center gap-1"><MapPin size={10} />{b.city}</span>}
                      <span className="flex items-center gap-1"><Calendar size={10} />{b.booking_count} bookings</span>
                      <span className="flex items-center gap-1"><Users size={10} />{b.staff_count} staff</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    b.tier === 'free' ? 'bg-gray-800 text-gray-400' :
                    b.tier === 'starter' ? 'bg-blue-500/10 text-blue-400' :
                    b.tier === 'growth' ? 'bg-emerald-500/10 text-emerald-400' :
                    b.tier === 'scale' ? 'bg-purple-500/10 text-purple-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {b.tier || 'free'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    (b.claimed || b.owner_id) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {(b.claimed || b.owner_id) ? 'Claimed' : 'Unclaimed'}
                  </span>
                  <ChevronRight size={14} className={`text-gray-600 transition-transform ${selected === i ? 'rotate-90' : ''}`} />
                </div>
              </div>

              {/* Expanded details */}
              {selected === i && (
                <div className="mt-4 pt-4 border-t border-gray-800 grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Details</p>
                    {b.email && <p className="text-xs text-gray-300">Email: {b.email}</p>}
                    {b.phone && <p className="text-xs text-gray-300">Phone: {b.phone}</p>}
                    {b.address && <p className="text-xs text-gray-300">Address: {b.address}</p>}
                    {b.website && (
                      <a href={b.website} target="_blank" rel="noopener" className="text-xs text-emerald-400 flex items-center gap-1 hover:underline">
                        <Globe size={10} /> {b.website}
                      </a>
                    )}
                    {b.slug && (
                      <a href={`/book/${b.slug}`} target="_blank" rel="noopener" className="text-xs text-emerald-400 flex items-center gap-1 hover:underline">
                        <ExternalLink size={10} /> /book/{b.slug}
                      </a>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Activity</p>
                    <p className="text-xs text-gray-300">ID: {b._id}</p>
                    <p className="text-xs text-gray-300">Created: {b.created_at ? new Date(b.created_at).toLocaleDateString('en-GB') : 'Unknown'}</p>
                    <p className="text-xs text-gray-300">Tier: {b.tier || 'free'}</p>
                    <p className="text-xs text-gray-300">Bookings: {b.booking_count}</p>
                    <p className="text-xs text-gray-300">Staff: {b.staff_count}</p>
                    {b.google_rating && <p className="text-xs text-gray-300 flex items-center gap-1"><Star size={10} className="text-amber-400" /> {b.google_rating} Google</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
