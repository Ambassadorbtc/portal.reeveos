import { useState, useEffect } from 'react'
import { Users, Search, RefreshCw, Shield, User, ChefHat, Mail, Clock } from 'lucide-react'

const api = (path) => { const t = sessionStorage.getItem('rezvo_admin_token'); return fetch(`/api${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} }).then(r => r.ok ? r.json() : null).catch(() => null) }

export default function AdminUsers() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (roleFilter) params.set('role', roleFilter)
    const res = await api(`/admin/users?${params}`)
    setData(res)
    setLoading(false)
  }

  useEffect(() => { load() }, [roleFilter])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Users & Accounts</h1>
          <p className="text-xs text-gray-500 mt-0.5">All user accounts across the platform</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 text-xs hover:bg-gray-700">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: data?.total ?? '—', icon: Users, color: 'emerald' },
          { label: 'Owners', value: data?.stats?.owners ?? '—', icon: Shield, color: 'blue' },
          { label: 'Staff', value: data?.stats?.staff ?? '—', icon: ChefHat, color: 'purple' },
          { label: 'Diners', value: data?.stats?.diners ?? '—', icon: User, color: 'amber' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon size={14} className={`text-${s.color}-400`} />
              </div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Search + filters */}
      <div className="flex gap-2 flex-wrap">
        <form onSubmit={e => { e.preventDefault(); load() }} className="flex gap-2 flex-1 min-w-[200px]">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">Search</button>
        </form>
        <div className="flex gap-1">
          {['', 'owner', 'staff', 'diner'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                roleFilter === r ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {r || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* User list */}
      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-emerald-500" size={20} /></div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">User</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Email</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 hidden md:table-cell">Role</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 hidden lg:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data?.users?.length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-gray-500 text-sm">No users found</td></tr>
              )}
              {data?.users?.map((u, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
                        {(u.name || u.email || '?')[0].toUpperCase()}
                      </div>
                      <span className="text-white font-medium truncate">{u.name || 'No name'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-400 truncate max-w-[200px]">
                    <span className="flex items-center gap-1"><Mail size={11} />{u.email}</span>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      u.role === 'owner' ? 'bg-blue-500/10 text-blue-400' :
                      u.role === 'staff' ? 'bg-purple-500/10 text-purple-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {u.role || 'diner'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs hidden lg:table-cell">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
