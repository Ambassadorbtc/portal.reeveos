/**
 * Client CRM — matching UXPilot Client Profile + Detail Panel designs
 * Card grid list + full profile view with activity timeline, preferences, spend insights
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, X, Phone, Mail, MapPin, Calendar, Clock, Star,
  ChevronRight, Edit3, Send, Check, AlertTriangle,
  Utensils, ArrowLeft, Users, UserPlus, Heart, Package, History, Trash2
} from 'lucide-react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import AppLoader from '../../components/shared/AppLoader'

const AVATAR_COLORS = [
  'from-[#111111] to-[#1a1a1a]', 'from-purple-600 to-purple-800',
  'from-blue-600 to-blue-800', 'from-amber-500 to-amber-700',
  'from-pink-500 to-pink-700', 'from-emerald-500 to-emerald-700',
]
const getInitials = (n) => n ? n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??'
const getColor = (n) => { let h = 0; for (let i = 0; i < (n || '').length; i++) h = n.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }

const TAG_STYLES = {
  VIP: 'bg-purple-100 text-purple-800 border-purple-200',
  Regular: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Loyal: 'bg-green-100 text-green-800 border-green-200',
  New: 'bg-blue-100 text-blue-700 border-blue-200',
  'At Risk': 'bg-red-100 text-red-700 border-red-200',
  'No-Show Risk': 'bg-red-100 text-red-800 border-red-200',
  'High Value': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Wine Lover': 'bg-purple-50 text-purple-700 border-purple-200',
  'Low Risk': 'bg-green-50 text-green-700 border-green-200',
}

const FILTER_TABS = [
  { id: 'all', label: 'All Clients' },
  { id: 'vip', label: 'VIP' },
  { id: 'regular', label: 'Regular' },
  { id: 'new', label: 'New' },
  { id: 'at-risk', label: 'At Risk' },
]

const Clients = () => {
  const navigate = useNavigate()
  const { business, businessType, loading: bizLoading } = useBusiness()
  const isRestaurant = businessType === 'restaurant'
  const bid = business?.id ?? business?._id
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedGuest, setSelectedGuest] = useState(null)
  const [activityFilter, setActivityFilter] = useState('all')
  const [showAddTag, setShowAddTag] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [addGuestModal, setAddGuestModal] = useState(false)
  const [profileTab, setProfileTab] = useState('overview')
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertForm, setAlertForm] = useState({ category: '', text: '' })
  const [showAlertForm, setShowAlertForm] = useState(false)
  const [alertCategoryOpen, setAlertCategoryOpen] = useState(false)
  const [packages, setPackages] = useState([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [treatmentHistory, setTreatmentHistory] = useState([])
  const [treatmentLoading, setTreatmentLoading] = useState(false)
  const [therapistPref, setTherapistPref] = useState(null)
  const [showTherapistDropdown, setShowTherapistDropdown] = useState(false)
  const [staffList, setStaffList] = useState([])
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!bid) { setLoading(false); return }
    const load = async () => {
      try {
        const res = await api.get(`/clients-v2/business/${bid}`)
        const c = (res.clients || []).map(c => ({
          id: c.id || c._id, name: c.name || c.customerName || 'Unknown',
          email: c.email || '', phone: c.phone || '', location: c.location || '',
          since: c.createdAt || c.firstVisit || '', tags: c.tags || [],
          stats: { visits: c.totalVisits || 0, spend: c.totalSpend || 0, avgSpend: c.avgSpend || 0, noShows: c.noShows || 0 },
          riskLevel: c.noShows >= 2 ? 'At Risk' : 'Low Risk',
          riskTag: c.noShows >= 2 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700',
          preferences: c.preferences || [], notes: c.notes || '', lastVisit: c.lastVisit || '',
          activity: c.activity || [], upcoming: c.upcoming || [],
          marketing: c.marketing || { emailOptIn: false, smsOptIn: false },
        }))
        setGuests(c)
      } catch { setGuests([]) }
      setLoading(false)
    }
    load()
  }, [bid])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Fetch alerts when Alerts tab is selected
  useEffect(() => {
    if (!bid || !selectedGuest || profileTab !== 'alerts') return
    const fetchAlerts = async () => {
      setAlertsLoading(true)
      try {
        const res = await api.get(`/notes/business/${bid}/client/${selectedGuest.id}/alerts`)
        setAlerts(res.alerts || [])
      } catch { setAlerts([]) }
      setAlertsLoading(false)
    }
    fetchAlerts()
  }, [bid, selectedGuest?.id, profileTab])

  // Fetch packages when Packages tab is selected
  useEffect(() => {
    if (!bid || !selectedGuest || profileTab !== 'packages') return
    const fetchPackages = async () => {
      setPackagesLoading(true)
      try {
        const res = await api.get(`/packages/business/${bid}/active?client_id=${selectedGuest.id}`)
        setPackages(res.packages || [])
      } catch { setPackages([]) }
      setPackagesLoading(false)
    }
    fetchPackages()
  }, [bid, selectedGuest?.id, profileTab])

  // Fetch treatment history when Treatment History tab is selected
  useEffect(() => {
    if (!bid || !selectedGuest || profileTab !== 'treatment-history') return
    const fetchHistory = async () => {
      setTreatmentLoading(true)
      try {
        const res = await api.get(`/clinical/business/${bid}/client/${selectedGuest.id}/treatment-history`)
        setTreatmentHistory(res.treatments || [])
      } catch { setTreatmentHistory([]) }
      setTreatmentLoading(false)
    }
    fetchHistory()
  }, [bid, selectedGuest?.id, profileTab])

  // Fetch therapist preference + staff list on profile load
  useEffect(() => {
    if (!bid || !selectedGuest) { setTherapistPref(null); return }
    const fetchPref = async () => {
      try {
        const res = await api.get(`/clinical/business/${bid}/client/${selectedGuest.id}/therapist-preference`)
        setTherapistPref(res.preferred_staff_id || null)
      } catch { setTherapistPref(null) }
    }
    const fetchStaff = async () => {
      try {
        const res = await api.get(`/staff/business/${bid}`)
        setStaffList(res.staff || [])
      } catch { setStaffList([]) }
    }
    fetchPref()
    fetchStaff()
  }, [bid, selectedGuest?.id])

  const handleAddAlert = async () => {
    if (!alertForm.category || !alertForm.text.trim()) return
    try {
      const res = await api.post(`/notes/business/${bid}/client/${selectedGuest.id}/alert`, { category: alertForm.category, text: alertForm.text })
      setAlerts(prev => [...prev, res.alert || { id: `temp-${Date.now()}`, category: alertForm.category, text: alertForm.text, created_at: new Date().toISOString() }])
      setAlertForm({ category: '', text: '' })
      setShowAlertForm(false)
      showToast('Alert added')
    } catch { showToast('Failed to add alert', 'error') }
  }

  const handleDismissAlert = async (alertId) => {
    try {
      await api.delete(`/notes/business/${bid}/client/${selectedGuest.id}/alert/${alertId}`)
      setAlerts(prev => prev.filter(a => (a.id || a._id) !== alertId))
      showToast('Alert dismissed')
    } catch { showToast('Failed to dismiss alert', 'error') }
  }

  const handleSetTherapistPref = async (staffId) => {
    try {
      await api.patch(`/clinical/business/${bid}/client/${selectedGuest.id}/therapist-preference`, { preferred_staff_id: staffId, mode: 'preferred' })
      setTherapistPref(staffId)
      setShowTherapistDropdown(false)
      showToast('Therapist preference saved')
    } catch { showToast('Failed to save preference', 'error') }
  }

  const handleClearTherapistPref = async () => {
    try {
      await api.patch(`/clinical/business/${bid}/client/${selectedGuest.id}/therapist-preference`, { preferred_staff_id: null, mode: 'none' })
      setTherapistPref(null)
      setShowTherapistDropdown(false)
      showToast('Therapist preference cleared')
    } catch { showToast('Failed to clear preference', 'error') }
  }

  const ALERT_CATEGORY_STYLES = {
    preference: 'bg-blue-100 text-blue-700 border-blue-200',
    medical: 'bg-red-100 text-red-700 border-red-200',
    operational: 'bg-[#C9A84C]/20 text-[#8B7333] border-[#C9A84C]/40',
  }

  const SERVICE_BORDER_COLORS = {
    facial: 'border-l-pink-400',
    massage: 'border-l-emerald-400',
    laser: 'border-l-purple-400',
    body: 'border-l-blue-400',
    nails: 'border-l-rose-400',
    hair: 'border-l-amber-400',
  }

  const filteredGuests = guests.filter(g => {
    if (search && !g.name.toLowerCase().includes(search.toLowerCase()) && !(g.email||'').toLowerCase().includes(search.toLowerCase())) return false
    if (activeFilter === 'vip') return g.tags.includes('VIP')
    if (activeFilter === 'regular') return g.tags.includes('Regular')
    if (activeFilter === 'new') return g.tags.includes('New')
    if (activeFilter === 'at-risk') return g.tags.includes('At Risk') || g.stats.noShows >= 2
    return true
  })

  const handleAddTag = () => {
    if (!newTag.trim() || !selectedGuest) return
    setGuests(prev => prev.map(g => g.id === selectedGuest.id ? { ...g, tags: [...g.tags, newTag.trim()] } : g))
    setSelectedGuest(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }))
    setNewTag(''); setShowAddTag(false)
  }

  const handleRemoveTag = (tag) => {
    if (!selectedGuest) return
    setGuests(prev => prev.map(g => g.id === selectedGuest.id ? { ...g, tags: g.tags.filter(t => t !== tag) } : g))
    setSelectedGuest(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))
  }

  const filteredActivity = (selectedGuest?.activity || []).filter(a => {
    if (activityFilter === 'all') return true
    if (activityFilter === 'visits') return a.type === 'visit'
    if (activityFilter === 'comms') return a.type === 'comms'
    if (activityFilter === 'reviews') return a.type === 'review'
    if (activityFilter === 'no-shows') return a.type === 'no_show'
    return true
  })

  if (loading) return <AppLoader message="Loading clients..." />

  /* ── GUEST PROFILE VIEW ── */
  if (selectedGuest) {
    const g = selectedGuest
    return (
      <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)] overflow-y-auto" style={{ fontFamily: "'Figtree', sans-serif" }}>
        <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full space-y-6 pb-12">

          {/* Back */}
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedGuest(null); setEditMode(false); setProfileTab('overview') }} className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary transition-all shadow-sm">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="hover:text-primary cursor-pointer" onClick={() => { setSelectedGuest(null); setProfileTab('overview') }}>Clients</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-primary font-semibold">{g.name}</span>
            </div>
          </div>

          {/* Profile Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex items-start gap-4 flex-1">
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getColor(g.name)} flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-lg`}>
                  {getInitials(g.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h2 className="text-2xl font-extrabold text-primary">{g.name}</h2>
                    {g.tags.slice(0, 2).map(tag => (
                      <span key={tag} className={`px-3 py-1 rounded-full text-xs font-bold border ${TAG_STYLES[tag] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>{tag}</span>
                    ))}
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${g.riskTag}`}>
                      {g.riskLevel === 'Low Risk' ? <Check className="w-3 h-3" /> : g.riskLevel === 'At Risk' ? <AlertTriangle className="w-3 h-3" /> : null}
                      {g.riskLevel}
                    </span>
                  </div>
                  <div className="space-y-1 mb-2">
                    {g.phone && <div className="flex items-center gap-2 text-sm text-gray-500"><Phone className="w-3.5 h-3.5" />{g.phone}</div>}
                    {g.email && <div className="flex items-center gap-2 text-sm text-gray-500"><Mail className="w-3.5 h-3.5" />{g.email}</div>}
                    {g.location && <div className="flex items-center gap-2 text-sm text-gray-500"><MapPin className="w-3.5 h-3.5" />{g.location}</div>}
                  </div>
                  {g.since && <p className="text-xs text-gray-400">Guest since {new Date(g.since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total Visits', value: g.stats.visits, color: 'text-primary' },
                  { label: 'Lifetime Spend', value: `£${g.stats.spend.toLocaleString()}`, color: 'text-primary' },
                  { label: 'Avg per Visit', value: `£${g.stats.avgSpend.toFixed(2)}`, color: 'text-primary' },
                  { label: 'No Shows', value: g.stats.noShows, color: g.stats.noShows > 0 ? 'text-red-600' : 'text-primary' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-center">
                    <p className={`text-2xl font-extrabold ${s.color} mb-0.5`}>{s.value}</p>
                    <p className="text-[11px] text-gray-500 font-semibold">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 lg:ml-2">
                <button onClick={() => setEditMode(!editMode)} className="px-5 py-2.5 border-2 border-primary text-primary rounded-full font-semibold text-sm hover:bg-primary/5 transition-colors whitespace-nowrap flex items-center gap-2">
                  <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                </button>
                <button className="px-5 py-2.5 bg-[#D4A373] text-white rounded-full font-semibold text-sm hover:bg-[#C4935F] transition-colors whitespace-nowrap flex items-center gap-2">
                  <Send className="w-3.5 h-3.5" /> Send Message
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowTherapistDropdown(!showTherapistDropdown)}
                    className="px-5 py-2.5 border-2 border-gray-200 rounded-full font-semibold text-sm hover:border-red-300 transition-colors whitespace-nowrap flex items-center gap-2"
                    title={therapistPref ? 'Preferred therapist set' : 'Set preferred therapist'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${therapistPref ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} />
                    <span className={therapistPref ? 'text-red-600' : 'text-gray-500'}>
                      {therapistPref ? (staffList.find(s => (s.id || s._id) === therapistPref)?.name || 'Preferred') : 'Set Therapist'}
                    </span>
                  </button>
                  {showTherapistDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-30">
                      {therapistPref && (
                        <button
                          onClick={handleClearTherapistPref}
                          className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
                        >
                          <X className="w-3.5 h-3.5" /> Clear preference
                        </button>
                      )}
                      {staffList.map(s => (
                        <button
                          key={s.id || s._id}
                          onClick={() => handleSetTherapistPref(s.id || s._id)}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 font-medium ${(s.id || s._id) === therapistPref ? 'text-red-600 bg-red-50/50' : 'text-[#111111]'}`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${(s.id || s._id) === therapistPref ? 'fill-red-500 text-red-500' : 'text-gray-300'}`} />
                          {s.name}
                        </button>
                      ))}
                      {staffList.length === 0 && <p className="px-4 py-2 text-sm text-gray-400">No staff found</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {g.tags.map(tag => (
              <span key={tag} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${TAG_STYLES[tag] || 'bg-gray-100 text-gray-700 border-gray-200'} flex items-center gap-1.5`}>
                {tag}
                {editMode && <button onClick={() => handleRemoveTag(tag)} className="text-current opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>}
              </span>
            ))}
            {(g.preferences || []).map(pref => (
              <span key={pref} className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold whitespace-nowrap">{pref}</span>
            ))}
            {showAddTag ? (
              <div className="flex items-center gap-1">
                <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag()} placeholder="Tag name..." className="px-3 py-1.5 border border-primary rounded-full text-xs w-28 focus:outline-none focus:ring-2 focus:ring-primary/20" autoFocus />
                <button onClick={handleAddTag} className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center"><Check className="w-3 h-3" /></button>
                <button onClick={() => { setShowAddTag(false); setNewTag('') }} className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <button onClick={() => setShowAddTag(true)} className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-full text-xs font-semibold hover:border-primary hover:text-primary transition-colors whitespace-nowrap flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Tag
              </button>
            )}
          </div>

          {/* Profile Tab Navigation */}
          <div className="flex items-center gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5">
            {[
              { id: 'overview', label: 'Overview', icon: null },
              { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
              { id: 'packages', label: 'Packages', icon: Package },
              { id: 'treatment-history', label: 'Treatment History', icon: History },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setProfileTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  profileTab === tab.id
                    ? 'bg-[#111111] text-white shadow-lg shadow-[#111111]/20'
                    : 'text-gray-400 hover:text-[#111111] hover:bg-gray-50'
                }`}
              >
                {tab.icon && <tab.icon className="w-4 h-4" />}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content: Overview */}
          {profileTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Activity Timeline — 3 cols */}
            <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-primary">Activity Timeline</h2>
                <div className="flex gap-1.5 overflow-x-auto">
                  {[{ id: 'all', label: 'All' },{ id: 'visits', label: 'Visits' },{ id: 'comms', label: 'Comms' },{ id: 'reviews', label: 'Reviews' },{ id: 'no-shows', label: 'No Shows' }].map(f => (
                    <button key={f.id} onClick={() => setActivityFilter(f.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${activityFilter === f.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{f.label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-0 relative before:absolute before:left-3 before:top-6 before:bottom-6 before:w-0.5 before:bg-gray-100">
                {filteredActivity.length > 0 ? filteredActivity.map(a => (
                  <div key={a.id} className="flex gap-4 pl-1 py-4 border-b border-gray-50 last:border-0 relative">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${a.type === 'visit' ? 'bg-emerald-100 text-emerald-600' : a.type === 'review' ? 'bg-yellow-100 text-yellow-600' : a.type === 'comms' ? 'bg-blue-100 text-blue-600' : a.type === 'no_show' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                      {a.type === 'visit' ? <Utensils className="w-3 h-3" /> : a.type === 'review' ? <Star className="w-3 h-3" /> : a.type === 'comms' ? <Mail className="w-3 h-3" /> : a.type === 'no_show' ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-semibold text-primary">{a.title}</p>
                        <span className="text-xs text-gray-400 shrink-0 ml-2">{new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      <p className="text-sm text-gray-500">{a.desc}</p>
                      {a.rating && <div className="flex gap-0.5 mt-1">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= a.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />)}</div>}
                    </div>
                  </div>
                )) : <div className="py-8 text-center text-sm text-gray-400">No activity matching this filter</div>}
              </div>
            </div>

            {/* Sidebar — 2 cols */}
            <div className="lg:col-span-2 space-y-6">
              {/* Upcoming */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-primary mb-4">Upcoming</h3>
                {g.upcoming?.length > 0 ? g.upcoming.map((u, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-2 last:mb-0">
                    <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary">{new Date(u.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                      <p className="text-xs text-gray-500">{u.time} · {u.guests} guests{u.table ? ` · ${u.table}` : ''}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                )) : <p className="text-sm text-gray-400">No upcoming bookings</p>}
              </div>

              {/* Marketing */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-primary mb-4">Marketing & Engagement</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Email opt-in', val: g.marketing?.emailOptIn, isToggle: true },
                    { label: 'SMS opt-in', val: g.marketing?.smsOptIn, isToggle: true },
                    { label: 'Campaigns sent', val: g.marketing?.campaignsSent || 0 },
                    { label: 'Opened', val: g.marketing?.opened || 0 },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{r.label}</span>
                      {r.isToggle !== undefined && r.isToggle ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.val ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.val ? 'Active' : 'Inactive'}</span>
                      ) : (
                        <span className="text-sm font-bold text-primary">{r.val}</span>
                      )}
                    </div>
                  ))}
                  {g.marketing?.lastCampaign && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Last campaign</span>
                      <span className="text-xs text-gray-500">{new Date(g.marketing.lastCampaign).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Spend Insights */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-primary mb-4">Spend Insights</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-gray-600">Lifetime spend</span>
                    <span className="text-lg font-extrabold text-primary">£{g.stats.spend.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-gradient-to-r from-primary to-emerald-400 h-2 rounded-full" style={{ width: `${Math.min(100, (g.stats.spend / 3000) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400"><span>£0</span><span>£3,000 target</span></div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-primary">{g.stats.visits}</p>
                      <p className="text-[10px] text-gray-500 font-semibold">Total Visits</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-primary">£{g.stats.avgSpend.toFixed(0)}</p>
                      <p className="text-[10px] text-gray-500 font-semibold">Avg Spend</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {g.notes && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-lg font-bold text-primary mb-3">Notes</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{g.notes}</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Tab Content: Alerts */}
          {profileTab === 'alerts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#111111]">Staff Alerts</h2>
              <button
                onClick={() => setShowAlertForm(!showAlertForm)}
                className="px-4 py-2 bg-[#111111] text-white rounded-full text-xs font-bold flex items-center gap-2 hover:bg-[#1a1a1a] transition-colors shadow-lg shadow-[#111111]/20"
              >
                <Plus className="w-3.5 h-3.5" /> Add Alert
              </button>
            </div>

            {showAlertForm && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-bold text-[#111111] mb-4">New Alert</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <button
                      onClick={() => setAlertCategoryOpen(!alertCategoryOpen)}
                      className="w-full sm:w-48 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#111111]/15"
                    >
                      <span className={alertForm.category ? 'text-[#111111]' : 'text-gray-400'}>
                        {alertForm.category ? alertForm.category.charAt(0).toUpperCase() + alertForm.category.slice(1) : 'Select category'}
                      </span>
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${alertCategoryOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {alertCategoryOpen && (
                      <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-30">
                        {['preference', 'medical', 'operational'].map(cat => (
                          <button
                            key={cat}
                            onClick={() => { setAlertForm(prev => ({ ...prev, category: cat })); setAlertCategoryOpen(false) }}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-gray-50 flex items-center gap-2 text-[#111111]"
                          >
                            <span className={`w-2.5 h-2.5 rounded-full ${cat === 'preference' ? 'bg-blue-500' : cat === 'medical' ? 'bg-red-500' : 'bg-[#C9A84C]'}`} />
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={alertForm.text}
                    onChange={e => setAlertForm(prev => ({ ...prev, text: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddAlert()}
                    placeholder="Alert text..."
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#111111]/15 focus:border-[#111111]/30"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleAddAlert} className="px-5 py-2.5 bg-[#111111] text-white rounded-xl text-sm font-bold hover:bg-[#1a1a1a] transition-colors">Save</button>
                    <button onClick={() => { setShowAlertForm(false); setAlertForm({ category: '', text: '' }) }} className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {alertsLoading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading alerts...</div>
            ) : alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map(alert => (
                  <div key={alert.id || alert._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${ALERT_CATEGORY_STYLES[alert.category] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {alert.category ? alert.category.charAt(0).toUpperCase() + alert.category.slice(1) : 'General'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#111111] font-medium">{alert.text}</p>
                      {alert.created_at && (
                        <p className="text-xs text-gray-400 mt-1">{new Date(alert.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDismissAlert(alert.id || alert._id)}
                      className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      title="Dismiss alert"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <AlertTriangle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">No alerts for this client</p>
              </div>
            )}
          </div>
          )}

          {/* Tab Content: Packages */}
          {profileTab === 'packages' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#111111]">Active Packages</h2>
            {packagesLoading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading packages...</div>
            ) : packages.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packages.map(pkg => {
                  const pctUsed = pkg.total_sessions > 0 ? (pkg.sessions_used / pkg.total_sessions) * 100 : 0
                  const statusStyle = pkg.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : pkg.status === 'expired' ? 'bg-red-50 text-red-700 border-red-200' : pkg.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                  return (
                    <div key={pkg.id || pkg._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-base font-bold text-[#111111]">{pkg.template_name || pkg.name || 'Package'}</h3>
                          {pkg.expiry_date && (
                            <p className="text-xs text-gray-400 mt-1">Expires {new Date(pkg.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusStyle}`}>
                          {pkg.status ? pkg.status.charAt(0).toUpperCase() + pkg.status.slice(1) : 'Unknown'}
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-gray-500">Sessions</span>
                          <span className="text-xs font-bold text-[#111111]">{pkg.sessions_used || 0} / {pkg.total_sessions || 0}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${pctUsed > 80 ? 'bg-[#C9A84C]' : 'bg-[#111111]'}`}
                            style={{ width: `${Math.min(100, pctUsed)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">No active packages</p>
              </div>
            )}
          </div>
          )}

          {/* Tab Content: Treatment History */}
          {profileTab === 'treatment-history' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#111111]">Treatment History</h2>
            {treatmentLoading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading treatment history...</div>
            ) : treatmentHistory.length > 0 ? (
              <div className="space-y-3">
                {treatmentHistory.map((t, idx) => {
                  const serviceKey = (t.service_type || '').toLowerCase()
                  const borderColor = SERVICE_BORDER_COLORS[serviceKey] || 'border-l-gray-300'
                  return (
                    <div key={t.id || t._id || idx} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 border-l-4 ${borderColor}`}>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs font-bold text-gray-400">
                              {t.date ? new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                            </span>
                            <span className="px-2.5 py-0.5 bg-gray-100 text-[#111111] rounded-full text-xs font-bold">
                              {t.service_type || 'General'}
                            </span>
                          </div>
                          {t.areas_treated && (
                            <p className="text-sm text-[#111111] font-medium mb-1">
                              {Array.isArray(t.areas_treated) ? t.areas_treated.join(', ') : t.areas_treated}
                            </p>
                          )}
                          {t.comfort_level != null && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-xs text-gray-500 mr-1">Comfort</span>
                              {[1, 2, 3, 4, 5].map(d => (
                                <span
                                  key={d}
                                  className={`w-2 h-2 rounded-full ${d <= t.comfort_level ? 'bg-[#111111]' : 'bg-gray-200'}`}
                                />
                              ))}
                            </div>
                          )}
                          {t.notes && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">No treatment history</p>
              </div>
            )}
          </div>
          )}

          {/* Toast notification */}
          {toast && (
            <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-2 transition-all ${
              toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-[#111111] text-white'
            }`}>
              {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              {toast.msg}
            </div>
          )}

        </div>
      </div>
    )
  }

  /* ── GUEST LIST VIEW ── */
  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
      <div className="p-4 lg:p-8 flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-primary">Client CRM</h1>
              <p className="text-sm text-gray-500">{filteredGuests.length} {isRestaurant ? 'guest' : 'client'}{filteredGuests.length !== 1 ? 's' : ''} in your database</p>
            </div>
            <button onClick={() => setAddGuestModal(true)} className="bg-[#111111] text-white font-bold text-xs px-5 py-2 rounded-full shadow-lg shadow-[#111111]/20 hover:bg-[#1a1a1a] transition-all flex items-center gap-2" style={{ fontFamily: "'Figtree', sans-serif" }}>
              <UserPlus className="w-4 h-4" /> Add Client
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTER_TABS.map(t => (
                <button key={t.id} onClick={() => setActiveFilter(t.id)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeFilter === t.id ? 'bg-[#111111] text-white shadow-lg shadow-[#111111]/20' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`} style={{ fontFamily: "'Figtree', sans-serif" }}>{t.label}</button>
              ))}
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#111111]/15 focus:border-[#111111]/30 shadow-sm transition-all" style={{ fontFamily: "'Figtree', sans-serif" }} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredGuests.map(g => (
              <div key={g.id} onClick={() => setSelectedGuest(g)} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getColor(g.name)} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow`}>{getInitials(g.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-primary text-sm truncate group-hover:text-emerald-700 transition-colors">{g.name}</h3>
                      {g.tags.includes('VIP') && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold border border-purple-200">VIP</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{g.email || g.phone || 'No contact'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors shrink-0 mt-1" />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { v: g.stats.visits, l: 'Visits', c: 'text-primary' },
                    { v: `£${g.stats.spend}`, l: 'Spend', c: 'text-primary' },
                    { v: g.stats.noShows, l: 'No Shows', c: g.stats.noShows > 0 ? 'text-red-600' : 'text-primary' },
                  ].map(s => (
                    <div key={s.l} className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                      <p className={`text-sm font-extrabold ${s.c}`}>{s.v}</p>
                      <p className="text-[10px] text-gray-400">{s.l}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {g.tags.slice(0, 3).map(tag => (
                    <span key={tag} className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TAG_STYLES[tag] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{tag}</span>
                  ))}
                  {g.tags.length > 3 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">+{g.tags.length - 3}</span>}
                </div>
                {g.lastVisit && <p className="text-[11px] text-gray-400 mt-2">Last visit: {new Date(g.lastVisit).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
              </div>
            ))}
          </div>

          {filteredGuests.length === 0 && (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No clients found</p>
              <p className="text-sm text-gray-400 mt-1">Clients will appear here as they make bookings</p>
            </div>
          )}
        </div>
      </div>

      {addGuestModal && <AddGuestModal onClose={() => setAddGuestModal(false)} onAdd={(guest) => { setGuests(prev => [guest, ...prev]); setAddGuestModal(false) }} />}
    </div>
  )
}

const AddGuestModal = ({ onClose, onAdd }) => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()} style={{ fontFamily: "'Figtree', sans-serif" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-lg text-primary">Add Client</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Full Name *', key: 'name', type: 'text', ph: 'e.g. John Smith' },
            { label: 'Email', key: 'email', type: 'email', ph: 'john@example.com' },
            { label: 'Phone', key: 'phone', type: 'tel', ph: '+44 7xxx xxx xxx' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-bold text-primary mb-1.5">{f.label}</label>
              <input type={f.type} value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder={f.ph} />
            </div>
          ))}
          <div>
            <label className="block text-sm font-bold text-primary mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" rows={2} placeholder="Treatment preferences, notes..." />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={() => { if (!form.name.trim()) return; onAdd({ id: `new-${Date.now()}`, name: form.name, email: form.email, phone: form.phone, location: '', since: new Date().toISOString(), tags: ['New'], stats: { visits: 0, spend: 0, avgSpend: 0, noShows: 0 }, riskLevel: 'New Client', riskTag: 'bg-blue-50 text-blue-700', preferences: [], notes: form.notes, lastVisit: '', activity: [], upcoming: [], marketing: { emailOptIn: false, smsOptIn: false } }) }} className="flex-1 px-4 py-2 bg-[#111111] text-white rounded-full text-xs font-bold hover:bg-[#1a1a1a] shadow-lg shadow-[#111111]/20">Add Client</button>
        </div>
      </div>
    </div>
  )
}

export default Clients
