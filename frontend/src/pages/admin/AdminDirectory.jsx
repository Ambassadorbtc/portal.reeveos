import { useState, useEffect } from 'react'
import { Search, RefreshCw, MapPin, CheckCircle, AlertCircle, Globe, ExternalLink } from 'lucide-react'

const api = (path) => { const t = sessionStorage.getItem('rezvo_admin_token'); return fetch(`/api${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} }).then(r => r.ok ? r.json() : null).catch(() => null) }

export default function AdminDirectory() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [claimedFilter, setClaimedFilter] = useState('')

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (claimedFilter) params.set('claimed', claimedFilter)
    const res = await api(`/admin/directory?${params}`)
    setData(res)
    setLoading(false)
  }

  useEffect(() => { load() }, [claimedFilter])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Directory Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">Google Places pre-population, unclaimed listings & growth flywheel</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 text-xs hover:bg-gray-700">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{data?.total ?? '—'}</p>
          <p className="text-xs text-gray-500">Total Listings</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle size={12} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{data?.claimed ?? '—'}</p>
          <p className="text-xs text-gray-500">Claimed</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle size={12} className="text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">{data?.unclaimed ?? '—'}</p>
          <p className="text-xs text-gray-500">Unclaimed</p>
        </div>
      </div>

      {/* Flywheel explanation */}
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
        <p className="text-xs text-emerald-400 font-medium mb-1">Growth Flywheel</p>
        <p className="text-xs text-gray-400">
          Google Places → Pre-populate directory → Diners find listings → Organic traffic → 
          "Is this your business?" CTA → Owner claims → Free tier → Upsell to Growth tier → Revenue
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex gap-2 flex-wrap">
        <form onSubmit={e => { e.preventDefault(); load() }} className="flex gap-2 flex-1 min-w-[200px]">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search directory..."
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">Search</button>
        </form>
        <div className="flex gap-1">
          {[
            { val: '', label: 'All' },
            { val: 'true', label: 'Claimed' },
            { val: 'false', label: 'Unclaimed' },
          ].map(f => (
            <button
              key={f.val}
              onClick={() => setClaimedFilter(f.val)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                claimedFilter === f.val ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listings */}
      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-emerald-500" size={20} /></div>
      ) : (
        <div className="space-y-2">
          {data?.listings?.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">No listings found</div>
          )}
          {data?.listings?.map((l, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    l.is_claimed ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                  }`}>
                    {l.is_claimed ? <CheckCircle size={16} className="text-emerald-400" /> : <AlertCircle size={16} className="text-amber-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{l.name}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      {l.business_type && <span className="capitalize">{l.business_type}</span>}
                      {(l.city || l.address) && <span className="flex items-center gap-1"><MapPin size={10} />{l.city || l.address}</span>}
                      {l.google_place_id && <span className="flex items-center gap-1"><Globe size={10} />Google Places</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    l.is_claimed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {l.is_claimed ? 'Claimed' : 'Unclaimed'}
                  </span>
                  {l.slug && (
                    <a href={`https://book.rezvo.app/${l.slug}`} target="_blank" rel="noopener" className="text-gray-600 hover:text-gray-400">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
