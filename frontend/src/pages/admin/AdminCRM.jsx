/**
 * AdminCRM.jsx — Multi-tenant Dojo CRM
 * 
 * Two separate profiles: Ambassador + Grant Woods
 * Each has own pipeline, leads, tier settings, residuals
 * Shared: Team ReeveOS signup target
 * 
 * Data stored in localStorage (per-user key).
 * Detects logged-in admin from sessionStorage('rezvo_admin_user').
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  LayoutDashboard, Columns3, Users2, Target, Plus, ArrowLeft, Search,
  Pencil, Trash2, ChevronDown, Check, Phone, Mail, FileText, Link2,
  Eye, StickyNote, LogOut, RefreshCw, UserCircle2
} from 'lucide-react'

/* ═══ Constants ═══ */
const STAGES = ['interested','demo_scheduled','trial_active','negotiating','won','lost']
const SL = {interested:'Interested',demo_scheduled:'Demo Scheduled',trial_active:'Trial Active',negotiating:'Negotiating',won:'Won',lost:'Lost'}
const SC = {interested:'#6B7280',demo_scheduled:'#3B82F6',trial_active:'#F59E0B',negotiating:'#8B5CF6',won:'#10B981',lost:'#EF4444'}
const LC = {visitor:'#6B7280',lead:'#3B82F6',engaged:'#F59E0B',demo_booked:'#8B5CF6',trial:'#EC4899',customer:'#10B981'}
const LL = {visitor:'Visitor',lead:'Lead',engaged:'Engaged',demo_booked:'Demo Booked',trial:'Trial',customer:'Customer'}
const BIZ_TYPES = ['Restaurant','Cafe','Barber','Salon','Retail','Takeaway','Convenience Store','Other']
const BIZ_FILTER = ['All',...BIZ_TYPES]
const SOURCES = ['Reeve Now','Referral','Walk-in','Grant','Website','Google Places','Inbound Content','Cold Call','Business Funding Client','Other']
const TIERS_OPT = [{v:'',l:'Not on ReeveOS'},{v:'starter',l:'Starter (£19/mo)'},{v:'growth',l:'Growth (£39/mo)'},{v:'pro',l:'Pro (£69/mo)'},{v:'enterprise',l:'Enterprise (£149/mo)'}]

const GOLD = '#C9A84C'
const TEAM_KEY = 'reeveos-crm-team'

/* ═══ User Profiles ═══ */
const PROFILES = {
  ambassador: {
    id:'ambassador', name:'Ambassador', initials:'A', color:GOLD,
    storageKey:'reeveos-crm-ambassador',
    defaults:{currentTier:2,existingMerchants:200,existingResidualMonthly:4000,tier1Target:20000,tier2Target:10000,tier1Pct:0.25,tier2Pct:0.20,payoutMultiplier:20,minLTR:300,ltrCommissionPct:0.35},
    seed:[
      {id:'a1',name:'Sadkine Krizilkaya',email:'sadkine@micho.co.uk',phone:'07912 345678',biz:{name:'Micho',type:'Restaurant',city:'Sheffield'},lc:'trial',score:82,src:'Walk-in',deal:{stage:'trial_active',val:29,created:'2026-02-14'},tags:['EPOS Interest','Multi-location'],monthlyCardVolume:25000,currentProvider:'Worldpay',hasSwitchingStatement:false,ltrAmount:0,dojoMID:'',fundingAmount:0,fundingCommission:0,reeveOSTier:'growth',dateSigned:'2026-02-28',dateLive:'',acts:[{t:'note',d:'Met at Micho. Unhappy with current EPOS. Wants floor plan + allergen compliance.',at:'2026-02-14T16:30:00',by:'Ambassador'}]},
      {id:'a2',name:'Marcus Chen',email:'marcus@burgburgers.co.uk',phone:'07834 567890',biz:{name:'Burg Burgers',type:'Restaurant',city:'Nottingham'},lc:'demo_booked',score:91,src:'Referral',deal:{stage:'negotiating',val:59,created:'2026-02-01'},tags:['High Volume','Delivery Priority','Uber Direct'],monthlyCardVolume:45000,currentProvider:'Barclaycard',hasSwitchingStatement:true,ltrAmount:450,dojoMID:'',fundingAmount:0,fundingCommission:0,reeveOSTier:'',dateSigned:'',dateLive:'',acts:[{t:'call',d:'Discussed delivery launch. Currently paying ~48% to platforms.',at:'2026-03-01T10:00:00',by:'Ambassador'}]},
      {id:'a3',name:'Natalie Brooks',email:'natalie@rejuvenatesalon.co.uk',phone:'07756 234567',biz:{name:'Rejuvenate',type:'Salon',city:'Nottingham'},lc:'lead',score:35,src:'Inbound Content',deal:{stage:'interested',val:8.99,created:'2026-03-01'},tags:['Salon','Friday Call'],monthlyCardVolume:8000,currentProvider:'',hasSwitchingStatement:false,ltrAmount:0,dojoMID:'',fundingAmount:0,fundingCommission:0,reeveOSTier:'',dateSigned:'',dateLive:'',acts:[{t:'content',d:'Downloaded: No-Show Reduction Toolkit',at:'2026-03-01T14:22:00'}]},
      {id:'a4',name:'James Okonkwo',email:'james@fadezone.co.uk',phone:'07891 678901',biz:{name:'Fade Zone',type:'Barber',city:'Nottingham'},lc:'engaged',score:58,src:'Google Places',deal:{stage:'demo_scheduled',val:8.99,created:'2026-02-22'},tags:['Barber'],monthlyCardVolume:12000,currentProvider:'SumUp',hasSwitchingStatement:false,ltrAmount:0,dojoMID:'',fundingAmount:0,fundingCommission:0,reeveOSTier:'',dateSigned:'',dateLive:'',acts:[]},
      {id:'a5',name:'Priya Sharma',email:'priya@thecurrylounge.co.uk',phone:'07923 456789',biz:{name:'The Curry Lounge',type:'Restaurant',city:'Nottingham'},lc:'lead',score:42,src:'Inbound Content',deal:{stage:'interested',val:29,created:'2026-02-26'},tags:['High Volume'],monthlyCardVolume:35000,currentProvider:'Worldpay',hasSwitchingStatement:false,ltrAmount:0,dojoMID:'',fundingAmount:0,fundingCommission:0,reeveOSTier:'',dateSigned:'',dateLive:'',acts:[]},
      {id:'a6',name:'Sophie Turner',email:'sophie@cutsabove.co.uk',phone:'07765 112233',biz:{name:'Cuts Above',type:'Barber',city:'Sheffield'},lc:'engaged',score:61,src:'Google Places',deal:{stage:'interested',val:8.99,created:'2026-02-18'},tags:['Barber'],monthlyCardVolume:10000,currentProvider:'Square',hasSwitchingStatement:false,ltrAmount:0,dojoMID:'',fundingAmount:0,fundingCommission:0,reeveOSTier:'',dateSigned:'',dateLive:'',acts:[]},
      {id:'a7',name:'Thangarajah Chellappah',email:'',phone:'',biz:{name:'Abi Mini Mart',type:'Convenience Store',city:'Liverpool'},lc:'customer',score:88,src:'Cold Call',deal:{stage:'won',val:0,created:'2025-08-01'},tags:['Switching Statement','High Volume'],monthlyCardVolume:25295,currentProvider:'Lloyds Cardnet',hasSwitchingStatement:true,ltrAmount:1047.25,dojoMID:'',fundingAmount:0,fundingCommission:0,reeveOSTier:'',dateSigned:'2025-09-01',dateLive:'2025-09-15',acts:[{t:'note',d:'Won from Lloyds Cardnet. 1.27% effective rate. LTR 1,047.25 at 35% = 366.54 commission.',at:'2025-09-01T10:00:00',by:'Ambassador'}]},
    ]
  },
  grant: {
    id:'grant', name:'Grant Woods', initials:'GW', color:'#3B82F6',
    storageKey:'reeveos-crm-grant',
    defaults:{currentTier:0,existingMerchants:0,existingResidualMonthly:0,tier1Target:20000,tier2Target:10000,tier1Pct:0.25,tier2Pct:0.20,payoutMultiplier:20,minLTR:300,ltrCommissionPct:0.35},
    seed:[]
  }
}

/* ═══ Helpers ═══ */
const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
const ago = d => { if (!d) return '-'; const ms = Date.now() - new Date(d).getTime(); if (isNaN(ms)) return '-'; const m = ms / 60000, h = m / 60, dy = h / 24; return dy > 1 ? `${Math.floor(dy)}d ago` : h > 1 ? `${Math.floor(h)}h ago` : `${Math.floor(m)}m ago` }
const fDate = d => { if (!d) return '-'; return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }
const fTime = d => { if (!d) return ''; return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }
const fCur = n => { const v = Number(n); return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(isNaN(v) ? 0 : v) }
const getMonthKey = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
const curMonthKey = () => getMonthKey(new Date())

const stSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
const stLoad = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch (e) { return null } }

const normLead = l => {
  if (!l || typeof l !== 'object') return { id: genId(), name: '', email: '', phone: '', biz: { name: 'Unknown', type: 'Other', city: '' }, lc: 'lead', score: 0, src: '', deal: { stage: 'interested', val: 0, created: new Date().toISOString() }, tags: [], acts: [], monthlyCardVolume: '', currentProvider: '', hasSwitchingStatement: false, ltrAmount: '', dojoMID: '', fundingAmount: '', fundingCommission: '', reeveOSTier: '', dateSigned: '', dateLive: '', dateAdded: new Date().toISOString() }
  const biz = l.biz || {}; const deal = l.deal || {}
  return { id: l.id || genId(), name: String(l.name || ''), email: String(l.email || ''), phone: String(l.phone || ''), biz: { name: String(biz.name || ''), type: String(biz.type || 'Other'), city: String(biz.city || '') }, lc: l.lc || 'lead', score: Number(l.score) || 0, src: String(l.src || ''), deal: { stage: deal.stage || 'interested', val: Number(deal.val) || 0, created: deal.created || new Date().toISOString() }, tags: Array.isArray(l.tags) ? l.tags : [], acts: Array.isArray(l.acts) ? l.acts : [], monthlyCardVolume: l.monthlyCardVolume != null ? l.monthlyCardVolume : '', currentProvider: String(l.currentProvider || ''), hasSwitchingStatement: !!l.hasSwitchingStatement, ltrAmount: l.ltrAmount != null ? l.ltrAmount : '', dojoMID: String(l.dojoMID || ''), fundingAmount: l.fundingAmount != null ? l.fundingAmount : '', fundingCommission: l.fundingCommission != null ? l.fundingCommission : '', reeveOSTier: String(l.reeveOSTier || ''), dateSigned: String(l.dateSigned || ''), dateLive: String(l.dateLive || ''), dateAdded: String(l.dateAdded || new Date().toISOString()) }
}

const actIcon = t => ({ email_open: Mail, email_click: Link2, page_visit: Eye, content: FileText, form: Pencil, call: Phone, note: StickyNote }[t] || StickyNote)

/* ═══ Branded Dropdown ═══ */
function Dropdown({ value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const sel = options.find(o => (typeof o === 'object' ? o.v : o) === value)
  const label = sel ? (typeof sel === 'object' ? sel.l : sel) : (placeholder || 'Select...')
  useEffect(() => { const c = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }; document.addEventListener('mousedown', c); return () => document.removeEventListener('mousedown', c) }, [])
  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(!open)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition-all ${open ? 'border-amber-600/60 ring-1 ring-amber-600/20' : 'border-gray-700/50 hover:border-gray-600'} bg-gray-800/60 text-left`}>
        <span className={`truncate ${sel ? 'text-gray-200' : 'text-gray-500'}`}>{label}</span>
        <ChevronDown size={12} className={`text-gray-500 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-52 overflow-auto py-1">
          {options.map((opt, i) => {
            const v = typeof opt === 'object' ? opt.v : opt
            const l = typeof opt === 'object' ? opt.l : opt
            const active = v === value
            return (
              <button key={i} type="button" onClick={() => { onChange(v); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${active ? 'text-amber-400 bg-amber-500/10' : 'text-gray-300 hover:bg-gray-800'}`}>
                <span>{l}</span>
                {active && <Check size={12} className="text-amber-400" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ═══ Branded Checkbox ═══ */
function BrandCheckbox({ checked, onChange, label }) {
  return (
    <div onClick={() => onChange(!checked)} className="flex items-center gap-2.5 cursor-pointer px-3 py-2.5 rounded-lg border border-gray-700/50 bg-gray-800/40 hover:border-gray-600 transition-colors">
      <div className={`w-4.5 h-4.5 rounded flex items-center justify-center border-2 transition-all shrink-0 ${checked ? 'border-amber-500 bg-amber-500' : 'border-gray-600'}`} style={{ width: 18, height: 18 }}>
        {checked && <Check size={11} className="text-gray-900" strokeWidth={3} />}
      </div>
      <span className="text-xs text-gray-300 font-medium">{label}</span>
    </div>
  )
}

/* ═══ Score Badge ═══ */
function ScoreBadge({ s }) {
  const c = s >= 70 ? '#10B981' : s >= 40 ? '#F59E0B' : '#EF4444'
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: c, backgroundColor: `${c}15` }}>{s}</span>
}

/* ═══ Progress Bar ═══ */
function Bar({ pct, color }) {
  return <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, pct || 0)}%`, backgroundColor: color }} /></div>
}

/* ═══ MAIN EXPORT ═══ */
export default function AdminCRM() {
  // Detect logged-in user from admin session
  const adminUser = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('rezvo_admin_user') || 'null') } catch { return null }
  }, [])

  const profileId = useMemo(() => {
    if (!adminUser) return 'ambassador'
    const e = (adminUser.email || '').toLowerCase()
    if (e.includes('grant')) return 'grant'
    return 'ambassador'
  }, [adminUser])

  const profile = PROFILES[profileId]
  const [view, setView] = useState('dashboard') // dashboard | pipeline | contacts | targets | detail | form
  const [leads, setLeads] = useState([])
  const [settings, setSettings] = useState(profile.defaults)
  const [teamData, setTeamData] = useState({ target: 20, ambassador: 0, grant: 0 })
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [filterBiz, setFilterBiz] = useState('All')
  const [editId, setEditId] = useState(null)
  const [toast, setToast] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const d = stLoad(profile.storageKey)
    if (d && Array.isArray(d.leads)) { setLeads(d.leads.map(normLead)); setSettings({ ...profile.defaults, ...(d.settings || {}) }) }
    else setLeads(profile.seed.map(normLead))
    const td = stLoad(TEAM_KEY); if (td) setTeamData(td)
    setLoaded(true)
  }, [profileId])

  const save = useCallback((nl, ns) => {
    const l = nl || leads; const s = ns || settings
    setLeads(l); if (ns) setSettings(s)
    stSave(profile.storageKey, { leads: l, settings: s })
    const wonThisMonth = l.filter(x => x.reeveOSTier && x.dateSigned && getMonthKey(x.dateSigned) === curMonthKey()).length
    const td = stLoad(TEAM_KEY) || { target: 20, ambassador: 0, grant: 0 }
    td[profileId] = wonThisMonth; stSave(TEAM_KEY, td); setTeamData(td)
  }, [leads, settings, profileId, profile.storageKey])

  const flash = useCallback(msg => { setToast(msg); setTimeout(() => setToast(null), 2500) }, [])

  const moveDeal = useCallback((id, stage) => {
    setLeads(prev => {
      const next = prev.map(l => {
        if (l.id !== id) return l
        const old = l.deal.stage; if (old === stage) return l
        let nlc = l.lc
        if (stage === 'demo_scheduled') nlc = 'demo_booked'
        if (stage === 'trial_active') nlc = 'trial'
        if (stage === 'won') nlc = 'customer'
        const u = { ...l, deal: { ...l.deal, stage }, lc: nlc, acts: [{ t: 'note', d: `Deal: ${SL[old]} to ${SL[stage]}`, at: new Date().toISOString(), by: profile.name }, ...(l.acts || [])] }
        if (stage === 'won' && !l.dateSigned) u.dateSigned = new Date().toISOString()
        return u
      })
      stSave(profile.storageKey, { leads: next, settings })
      return next
    })
    flash(`Moved to ${SL[stage]}`)
  }, [settings, flash, profile])

  const saveLead = useCallback(m => {
    if (editId) { save(leads.map(l => l.id === editId ? { ...l, ...m } : l)); flash('Updated') }
    else { save([...leads, normLead({ id: genId(), dateAdded: new Date().toISOString(), ...m })]); flash('Merchant added') }
    setEditId(null); setView('pipeline')
  }, [leads, editId, save, flash])

  const deleteLead = useCallback(id => { save(leads.filter(l => l.id !== id)); flash('Deleted') }, [leads, save, flash])

  const goAdd = () => { setEditId(null); setView('form') }
  const goEdit = id => { setEditId(id); setView('form') }
  const openDetail = l => { setSelected(l.id); setView('detail') }
  const editLead = editId ? leads.find(l => l.id === editId) : null
  const selLead = leads.find(l => l.id === selected)
  const filtered = leads.filter(l => {
    if (!l || !l.biz) return false
    if (search && !(l.name || '').toLowerCase().includes(search.toLowerCase()) && !(l.biz.name || '').toLowerCase().includes(search.toLowerCase())) return false
    if (filterBiz !== 'All' && (l.biz.type || '') !== filterBiz) return false
    return true
  })

  const stats = useMemo(() => {
    try {
      const cm = curMonthKey()
      const signed = leads.filter(l => l && l.dateSigned && getMonthKey(l.dateSigned) === cm)
      const monthLTR = signed.reduce((s, l) => s + (parseFloat(l.ltrAmount) || 0), 0)
      const live = leads.filter(l => l && l.deal && l.deal.stage === 'won')
      const newRes = live.reduce((s, l) => { const v = parseFloat(l.monthlyCardVolume) || 0; return s + ((v * 0.7 * 0.003) + (v * 0.3 * 0.007)) * settings.tier2Pct }, 0)
      const totalRes = settings.existingResidualMonthly + newRes
      const totalMerch = settings.existingMerchants + live.length
      const t1Res = totalRes * (settings.tier1Pct / settings.tier2Pct)
      const hot = leads.filter(l => l && l.score >= 70).length
      return { monthLTR, signedCount: signed.length, totalResidual: totalRes, totalMerchants: totalMerch, tier1Residual: t1Res, tier1Payout: t1Res * settings.payoutMultiplier, hot, total: leads.length }
    } catch (e) { return { monthLTR: 0, signedCount: 0, totalResidual: 0, totalMerchants: 0, tier1Residual: 0, tier1Payout: 0, hot: 0, total: 0 } }
  }, [leads, settings])

  const teamTotal = (teamData.ambassador || 0) + (teamData.grant || 0)

  if (!loaded) return <div className="flex items-center justify-center h-full text-gray-500 text-sm">Loading CRM...</div>

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pipeline', label: 'Pipeline', icon: Columns3 },
    { id: 'contacts', label: 'Contacts', icon: Users2 },
    { id: 'targets', label: 'Tier Targets', icon: Target },
  ]

  const viewTitle = { dashboard: 'Dashboard', pipeline: 'Pipeline', contacts: 'Contacts', targets: 'Tier Targets', detail: 'Contact Detail', form: editId ? 'Edit Merchant' : 'Add Merchant' }[view] || 'CRM'

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      {/* Header Bar */}
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${profile.color}20` }}>
              <span className="text-sm font-bold" style={{ color: profile.color }}>{profile.initials}</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{viewTitle}</h1>
              <p className="text-[11px] text-gray-500">Dojo CRM — {profile.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative max-w-[220px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-amber-600/40" />
            </div>
            <button onClick={goAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors" style={{ backgroundColor: `${GOLD}20`, color: GOLD }}><Plus size={13} />Add Merchant</button>
          </div>
        </div>
        {/* Sub-nav */}
        <div className="flex items-center gap-1">
          {NAV.map(n => {
            const active = view === n.id || (view === 'detail' && n.id === 'contacts') || (view === 'form' && n.id === 'pipeline')
            const Icon = n.icon
            return (
              <button key={n.id} onClick={() => { setView(n.id); setSelected(null); setEditId(null) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'}`}
                style={active ? { backgroundColor: `${GOLD}15` } : {}}>
                <Icon size={13} />{n.label}
              </button>
            )
          })}
          <div className="ml-auto flex items-center gap-2 text-[10px] text-gray-600">
            <span className="flex items-center gap-1"><Users2 size={10} />Team: <strong className={teamTotal >= teamData.target ? 'text-emerald-400' : 'text-amber-400'}>{teamTotal}/{teamData.target}</strong> ReeveOS</span>
          </div>
        </div>
      </div>

      {/* Stat Cards (on dashboard + pipeline) */}
      {(view === 'dashboard' || view === 'pipeline') && (
        <div className="shrink-0 flex gap-3 px-5 py-3">
          {[
            { label: 'This Month LTR', value: fCur(stats.monthLTR), sub: `${stats.signedCount} signed`, c: '#3B82F6' },
            { label: 'Hot Leads (70+)', value: String(stats.hot), sub: `of ${stats.total} total`, c: '#EF4444' },
            { label: 'Monthly Residuals', value: fCur(stats.totalResidual), sub: `${stats.totalMerchants} merchants`, c: '#10B981' },
            { label: 'Tier 1 Payout', value: fCur(stats.tier1Payout), sub: '20x after 6mo', c: GOLD },
          ].map((s, i) => (
            <div key={i} className="flex-1 p-3 rounded-xl border border-gray-800 bg-gray-900/60">
              <p className="text-[10px] text-gray-500 font-medium">{s.label}</p>
              <p className="text-xl font-extrabold text-white mt-1">{s.value}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'dashboard' && <DashboardView stats={stats} settings={settings} leads={leads} teamData={teamData} profileId={profileId} teamTotal={teamTotal} />}
        {view === 'pipeline' && <PipelineView leads={filtered} onSelect={openDetail} moveDeal={moveDeal} filterBiz={filterBiz} setFilterBiz={setFilterBiz} />}
        {view === 'contacts' && <ContactsView leads={filtered} onSelect={openDetail} onEdit={goEdit} onDelete={deleteLead} />}
        {view === 'targets' && <TargetsView stats={stats} settings={settings} leads={leads} />}
        {view === 'detail' && selLead && <DetailView lead={selLead} onBack={() => setView('pipeline')} moveDeal={moveDeal} onEdit={goEdit} profileName={profile.name} />}
        {view === 'form' && <FormView merchant={editLead} onSave={saveLead} onCancel={() => { setEditId(null); setView('pipeline') }} />}
      </div>

      {/* Toast */}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 px-5 py-2 rounded-lg text-xs font-bold z-50" style={{ backgroundColor: GOLD, color: '#111', boxShadow: `0 4px 20px ${GOLD}40` }}>{toast}</div>}

      {/* Reset button - tiny, bottom-right */}
      <button onClick={() => { localStorage.removeItem(profile.storageKey); setLeads(profile.seed.map(normLead)); setSettings(profile.defaults); flash('Data reset') }}
        className="fixed bottom-2 right-2 text-[9px] text-gray-700 hover:text-gray-500 transition-colors">Reset</button>
    </div>
  )
}

/* ═══════════════════════════════════════════
   FORM VIEW (in-page, no modal)
   ═══════════════════════════════════════════ */
function FormView({ merchant, onSave, onCancel }) {
  const [f, setF] = useState(() => normLead(merchant || { deal: { stage: 'interested', val: 8.99, created: new Date().toISOString() } }))
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const setBiz = (k, v) => setF(p => ({ ...p, biz: { ...p.biz, [k]: v } }))
  const setDeal = (k, v) => setF(p => ({ ...p, deal: { ...p.deal, [k]: v } }))
  const submit = () => { if (!(f.biz.name || '').trim()) return; onSave(f) }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700/50 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-600/40 focus:ring-1 focus:ring-amber-600/20'

  return (
    <div className="flex-1 overflow-auto px-5 py-4" style={{ maxWidth: 720 }}>
      <button onClick={onCancel} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-5 transition-colors"><ArrowLeft size={14} /> Back</button>

      <Section title="Business Details">
        <div className="grid grid-cols-2 gap-3">
          <Fld label="Business Name *"><input value={f.biz.name || ''} onChange={e => setBiz('name', e.target.value)} placeholder="e.g. Burg Burgers" className={inputCls} /></Fld>
          <Fld label="Business Type"><Dropdown value={f.biz.type} options={BIZ_TYPES} onChange={v => setBiz('type', v)} /></Fld>
          <Fld label="Contact Name"><input value={f.name || ''} onChange={e => set('name', e.target.value)} placeholder="Owner / decision maker" className={inputCls} /></Fld>
          <Fld label="City"><input value={f.biz.city || ''} onChange={e => setBiz('city', e.target.value)} placeholder="e.g. Nottingham" className={inputCls} /></Fld>
          <Fld label="Email"><input value={f.email || ''} onChange={e => set('email', e.target.value)} placeholder="email@business.co.uk" type="email" className={inputCls} /></Fld>
          <Fld label="Phone"><input value={f.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="07..." className={inputCls} /></Fld>
        </div>
      </Section>

      <Section title="Pipeline">
        <div className="grid grid-cols-3 gap-3">
          <Fld label="Deal Stage"><Dropdown value={f.deal.stage} options={STAGES.map(s => ({ v: s, l: SL[s] }))} onChange={v => setDeal('stage', v)} /></Fld>
          <Fld label="Deal Value (£/mo)"><input type="number" value={f.deal.val ?? ''} onChange={e => setDeal('val', parseFloat(e.target.value) || 0)} placeholder="8.99" className={inputCls} /></Fld>
          <Fld label="Lead Source"><Dropdown value={f.src} options={SOURCES.map(s => ({ v: s, l: s }))} onChange={v => set('src', v)} placeholder="Select source..." /></Fld>
        </div>
      </Section>

      <Section title="Dojo Processing">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Fld label="Monthly Card Volume"><input type="number" value={f.monthlyCardVolume ?? ''} onChange={e => set('monthlyCardVolume', e.target.value)} placeholder="e.g. 30000" className={inputCls} /></Fld>
          <Fld label="Current Provider"><input value={f.currentProvider || ''} onChange={e => set('currentProvider', e.target.value)} placeholder="e.g. Worldpay" className={inputCls} /></Fld>
          <Fld label="LTR Amount"><input type="number" value={f.ltrAmount ?? ''} onChange={e => set('ltrAmount', e.target.value)} placeholder="Min 300" className={inputCls} /></Fld>
          <Fld label="Dojo MID"><input value={f.dojoMID || ''} onChange={e => set('dojoMID', e.target.value)} className={inputCls} /></Fld>
        </div>
        <BrandCheckbox checked={f.hasSwitchingStatement} onChange={v => set('hasSwitchingStatement', v)} label="Has switching statement (higher LTR)" />
      </Section>

      <Section title="Business Funding" color="#3B82F6">
        <div className="grid grid-cols-2 gap-3">
          <Fld label="Funding Amount"><input type="number" value={f.fundingAmount ?? ''} onChange={e => set('fundingAmount', e.target.value)} placeholder="0" className={inputCls} /></Fld>
          <Fld label="Commission Earned"><input type="number" value={f.fundingCommission ?? ''} onChange={e => set('fundingCommission', e.target.value)} placeholder="0" className={inputCls} /></Fld>
        </div>
      </Section>

      <Section title="ReeveOS">
        <div className="max-w-[280px]"><Fld label="ReeveOS Tier"><Dropdown value={f.reeveOSTier} options={TIERS_OPT} onChange={v => set('reeveOSTier', v)} placeholder="Not on ReeveOS" /></Fld></div>
      </Section>

      <div className="flex gap-3 pt-3 border-t border-gray-800">
        <button onClick={submit} className="px-6 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: GOLD, color: '#111' }}>{merchant ? 'Save Changes' : 'Add Merchant'}</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs text-gray-400 bg-gray-800 hover:bg-gray-700">Cancel</button>
      </div>
    </div>
  )
}

function Fld({ label, children }) {
  return <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>{children}</div>
}

function Section({ title, color, children }) {
  return (
    <div className="mb-6">
      <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-gray-800" style={{ color: color || GOLD }}>{title}</div>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════ */
function DashboardView({ stats, settings, leads, teamData, profileId, teamTotal }) {
  return (
    <div className="flex-1 overflow-auto px-5 py-3 space-y-4">
      {/* Team Target */}
      <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Users2 size={15} className="text-amber-400" /><span className="text-sm font-bold text-white">Team ReeveOS Target</span></div>
          <span className="text-lg font-extrabold" style={{ color: teamTotal >= teamData.target ? '#10B981' : GOLD }}>{teamTotal} / {teamData.target}</span>
        </div>
        <Bar pct={(teamTotal / teamData.target) * 100} color={teamTotal >= teamData.target ? '#10B981' : GOLD} />
        <div className="flex gap-3 mt-3">
          <div className={`flex-1 p-3 rounded-lg text-center border ${profileId === 'ambassador' ? 'border-amber-600/30 bg-amber-500/5' : 'border-gray-800 bg-gray-800/40'}`}>
            <p className="text-[9px] text-gray-500 font-bold">AMBASSADOR</p>
            <p className="text-xl font-extrabold mt-1" style={{ color: GOLD }}>{teamData.ambassador || 0}</p>
          </div>
          <div className={`flex-1 p-3 rounded-lg text-center border ${profileId === 'grant' ? 'border-blue-600/30 bg-blue-500/5' : 'border-gray-800 bg-gray-800/40'}`}>
            <p className="text-[9px] text-gray-500 font-bold">GRANT</p>
            <p className="text-xl font-extrabold text-blue-400 mt-1">{teamData.grant || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Tier Progress */}
        <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/60">
          <p className="text-sm font-bold text-white mb-3">Tier Progress</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[10px] mb-1"><span className="font-bold" style={{ color: GOLD }}>TIER 2 MONTHLY</span><span className="text-gray-500">{fCur(stats.monthLTR)} / {fCur(settings.tier2Target)}</span></div>
              <Bar pct={(stats.monthLTR / settings.tier2Target) * 100} color={GOLD} />
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-1"><span className="font-bold text-blue-400">TIER 1 MONTHLY</span><span className="text-gray-500">{fCur(stats.monthLTR)} / {fCur(settings.tier1Target)}</span></div>
              <Bar pct={(stats.monthLTR / settings.tier1Target) * 100} color="#3B82F6" />
              <p className="text-[10px] text-gray-600 mt-1">Need {fCur(Math.max(0, settings.tier1Target - stats.monthLTR))} more</p>
            </div>
          </div>
        </div>

        {/* Payout */}
        <div className="p-4 rounded-xl border bg-gray-900/60 text-center" style={{ borderColor: `${GOLD}30` }}>
          <p className="text-[10px] font-bold tracking-widest" style={{ color: GOLD }}>TIER 1 PAYOUT</p>
          <p className="text-[10px] text-gray-600 mt-2">Hit Tier 1, maintain 6 months, 20x</p>
          <div className="border-t border-gray-800 mt-3 pt-3"><p className="text-2xl font-black" style={{ color: GOLD }}>{fCur(stats.tier1Payout)}</p></div>
          <div className="border-t border-gray-800 mt-3 pt-3"><p className="text-[10px] text-gray-600">Residual jump at Tier 1</p><p className="text-lg font-bold text-emerald-400 mt-1">+{fCur(stats.tier1Residual - stats.totalResidual)}/mo</p></div>
        </div>

        {/* Pipeline Summary */}
        <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/60">
          <p className="text-sm font-bold text-white mb-3">Pipeline</p>
          <div className="flex gap-2 flex-wrap">
            {STAGES.filter(s => s !== 'lost').map(s => {
              const n = leads.filter(l => l.deal.stage === s).length
              return <div key={s} className="text-center px-3 py-2 rounded-lg" style={{ backgroundColor: `${SC[s]}08`, border: `1px solid ${SC[s]}20` }}><p className="text-lg font-extrabold" style={{ color: SC[s] }}>{n}</p><p className="text-[9px]" style={{ color: SC[s], opacity: 0.7 }}>{SL[s]}</p></div>
            })}
          </div>
        </div>

        {/* Revenue */}
        <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/60">
          <p className="text-sm font-bold text-white mb-3">Revenue Streams</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { l: 'Dojo Residuals', v: stats.totalResidual, c: '#10B981', s: '/mo' },
              { l: 'ReeveOS Software', v: 0, c: GOLD, s: 'Not live' },
              { l: 'Funding Commission', v: leads.reduce((s, l) => s + (parseFloat(l && l.fundingCommission) || 0), 0), c: '#3B82F6', s: 'total' },
              { l: 'Combined Monthly', v: stats.totalResidual, c: '#FFF', s: '/mo', hl: true },
            ].map((r, i) => (
              <div key={i} className={`p-3 rounded-lg border ${r.hl ? 'border-amber-600/20 bg-amber-500/5' : 'border-gray-800 bg-gray-800/40'}`}>
                <p className="text-[10px] text-gray-500">{r.l}</p>
                <p className="text-base font-extrabold mt-1" style={{ color: r.c }}>{fCur(r.v)}</p>
                <p className="text-[9px] text-gray-600">{r.s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   PIPELINE KANBAN
   ═══════════════════════════════════════════ */
function PipelineView({ leads, onSelect, moveDeal, filterBiz, setFilterBiz }) {
  const [dragId, setDragId] = useState(null)
  const [overStage, setOverStage] = useState(null)
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-2 flex gap-1.5 flex-wrap shrink-0">
        {BIZ_FILTER.map(f => (
          <button key={f} onClick={() => setFilterBiz(f)} className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all ${filterBiz === f ? 'text-amber-400 border-amber-600/40 bg-amber-500/10' : 'text-gray-500 border-gray-800 hover:border-gray-600'}`}>{f}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto flex gap-3 px-5 pb-5">
        {STAGES.filter(s => s !== 'lost').map(stage => {
          const cards = leads.filter(l => l.deal.stage === stage)
          const val = cards.reduce((s, l) => s + (Number(l.deal.val) || 0), 0)
          const isOver = overStage === stage && dragId
          return (
            <div key={stage} className="flex flex-col min-w-[190px] flex-1"
              onDragOver={e => { e.preventDefault(); setOverStage(stage) }} onDragLeave={() => setOverStage(null)}
              onDrop={e => { e.preventDefault(); if (dragId) moveDeal(dragId, stage); setDragId(null); setOverStage(null) }}>
              <div className="flex items-center justify-between px-3 py-2 rounded-t-lg" style={{ backgroundColor: `${SC[stage]}08`, borderBottom: `2px solid ${isOver ? SC[stage] : SC[stage] + '30'}` }}>
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: SC[stage] }}>{SL[stage]}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: SC[stage], backgroundColor: `${SC[stage]}15` }}>{cards.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto py-2 space-y-2 min-h-[50px]">
                {cards.map(lead => (
                  <div key={lead.id} draggable onDragStart={e => { setDragId(lead.id); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { setDragId(null); setOverStage(null) }}
                    onClick={() => onSelect(lead)}
                    className={`p-3 rounded-lg border cursor-grab group transition-all ${dragId === lead.id ? 'opacity-40' : 'hover:border-gray-600'} border-gray-800 bg-gray-900/60`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-200 truncate">{lead.biz.name}</span>
                      <ScoreBadge s={lead.score} />
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">{lead.name}</p>
                    <div className="flex gap-1.5 mt-1">
                      <span className="text-[9px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{lead.biz.type}</span>
                      <span className="text-[9px] text-gray-600">{lead.biz.city}</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-[11px] font-bold text-emerald-400">{fCur(lead.deal.val)}/mo</span>
                      <span className="text-[9px] text-gray-600">{ago((lead.acts || [])[0]?.at)}</span>
                    </div>
                    {Number(lead.monthlyCardVolume) > 0 && <p className="text-[9px] mt-1" style={{ color: GOLD }}>Card vol: {fCur(lead.monthlyCardVolume)}/mo</p>}
                    {(lead.tags || []).length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {lead.tags.slice(0, 2).map((tag, i) => <span key={i} className="text-[7px] font-bold px-1.5 py-0.5 rounded" style={{ color: GOLD, backgroundColor: `${GOLD}12`, border: `1px solid ${GOLD}25` }}>{tag}</span>)}
                      </div>
                    )}
                  </div>
                ))}
                {cards.length === 0 && <div className="text-center text-[10px] text-gray-700 py-4">No deals</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   CONTACTS TABLE
   ═══════════════════════════════════════════ */
function ContactsView({ leads, onSelect, onEdit, onDelete }) {
  return (
    <div className="flex-1 overflow-auto px-5 py-3">
      <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
        <thead>
          <tr>{['Contact', 'Business', 'City', 'Score', 'Stage', 'Card Vol', 'LTR', ''].map(h => (
            <th key={h} className="text-left px-3 py-2 text-[9px] font-bold text-gray-600 uppercase tracking-wider">{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {leads.map(l => (
            <tr key={l.id} className="cursor-pointer group hover:bg-gray-800/40 transition-colors">
              <td onClick={() => onSelect(l)} className="px-3 py-2.5 rounded-l-lg"><p className="text-xs font-semibold text-gray-200">{l.name || '-'}</p><p className="text-[10px] text-gray-500">{l.email}</p></td>
              <td onClick={() => onSelect(l)} className="px-3 py-2.5"><p className="text-xs font-semibold text-gray-200">{l.biz.name}</p><p className="text-[9px] text-gray-600">{l.biz.type}</p></td>
              <td onClick={() => onSelect(l)} className="px-3 py-2.5 text-[11px] text-gray-400">{l.biz.city}</td>
              <td onClick={() => onSelect(l)} className="px-3 py-2.5"><ScoreBadge s={l.score} /></td>
              <td onClick={() => onSelect(l)} className="px-3 py-2.5"><span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ color: SC[l.deal.stage], backgroundColor: `${SC[l.deal.stage]}10` }}>{SL[l.deal.stage]}</span></td>
              <td onClick={() => onSelect(l)} className="px-3 py-2.5 text-[11px] font-semibold text-gray-300">{Number(l.monthlyCardVolume) ? fCur(l.monthlyCardVolume) : '-'}</td>
              <td onClick={() => onSelect(l)} className="px-3 py-2.5 text-[11px] font-bold text-emerald-400">{Number(l.ltrAmount) ? fCur(l.ltrAmount) : '-'}</td>
              <td className="px-3 py-2.5 rounded-r-lg">
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(l.id)} className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800"><Pencil size={12} /></button>
                  <button onClick={() => onDelete(l.id)} className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800"><Trash2 size={12} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ═══════════════════════════════════════════
   TARGETS VIEW
   ═══════════════════════════════════════════ */
function TargetsView({ stats, settings, leads }) {
  const months = []
  const now = new Date()
  for (let i = 0; i < 10; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const key = getMonthKey(d)
    const signed = leads.filter(l => l.dateSigned && getMonthKey(l.dateSigned) === key)
    const ltr = signed.reduce((s, l) => s + (parseFloat(l.ltrAmount) || 0), 0)
    months.push({ label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), key, count: signed.length, ltr, isCurrent: key === curMonthKey() })
  }
  return (
    <div className="flex-1 overflow-auto px-5 py-3 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/60"><p className="text-[10px] text-gray-500 tracking-wider">TIER 2 MONTHLY</p><p className="text-3xl font-extrabold mt-2" style={{ color: GOLD }}>{fCur(settings.tier2Target)}</p><Bar pct={(stats.monthLTR / settings.tier2Target) * 100} color={GOLD} /></div>
        <div className="p-4 rounded-xl border bg-gray-900/60" style={{ borderColor: `${GOLD}30` }}><p className="text-[10px] tracking-wider" style={{ color: GOLD }}>TIER 1 MONTHLY</p><p className="text-3xl font-extrabold mt-2" style={{ color: GOLD }}>{fCur(settings.tier1Target)}</p><Bar pct={(stats.monthLTR / settings.tier1Target) * 100} color={GOLD} /></div>
        <div className="p-4 rounded-xl border border-emerald-600/20 bg-gray-900/60"><p className="text-[10px] text-emerald-400 tracking-wider">TIER 1 PAYOUT</p><p className="text-3xl font-extrabold text-emerald-400 mt-2">{fCur(stats.tier1Payout)}</p><p className="text-[10px] text-gray-600 mt-1">20x after 6mo</p></div>
      </div>
      <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/60">
        <p className="text-sm font-bold text-white mb-3">Monthly LTR Tracker</p>
        <div className="grid grid-cols-5 gap-2">
          {months.map(m => (
            <div key={m.key} className={`p-3 rounded-lg text-center border ${m.isCurrent ? 'border-amber-600/30 bg-amber-500/5' : 'border-gray-800 bg-gray-800/40'}`}>
              <p className={`text-[10px] font-bold ${m.isCurrent ? 'text-amber-400' : 'text-gray-500'}`}>{m.label}</p>
              <p className="text-lg font-extrabold mt-1" style={{ color: m.ltr >= settings.tier1Target ? '#10B981' : m.ltr >= settings.tier2Target ? GOLD : '#EF4444' }}>{fCur(m.ltr)}</p>
              <p className="text-[9px] text-gray-600 mt-0.5">{m.count} signed</p>
              <Bar pct={(m.ltr / settings.tier1Target) * 100} color={m.ltr >= settings.tier1Target ? '#10B981' : GOLD} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   DETAIL VIEW
   ═══════════════════════════════════════════ */
function DetailView({ lead, onBack, moveDeal, onEdit, profileName }) {
  const [tab, setTab] = useState('timeline')
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 min-w-[288px] border-r border-gray-800 overflow-auto p-4 bg-gray-900/40">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-4 transition-colors"><ArrowLeft size={14} /> Back</button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ backgroundColor: `${LC[lead.lc]}20`, color: LC[lead.lc] }}>{(lead.name || '?')[0]}</div>
          <div><p className="text-sm font-bold text-white">{lead.name || '-'}</p><p className="text-[11px] text-gray-500">{lead.biz.name}</p></div>
        </div>
        <button onClick={() => onEdit(lead.id)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold mb-4 transition-colors" style={{ color: GOLD, backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}25` }}><Pencil size={11} /> Edit Details</button>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 p-2.5 rounded-lg border border-gray-800 text-center bg-gray-800/40">
            <p className="text-[8px] text-gray-600 font-bold uppercase">Score</p>
            <p className="text-xl font-extrabold mt-0.5" style={{ color: lead.score >= 70 ? '#10B981' : lead.score >= 40 ? '#F59E0B' : '#EF4444' }}>{lead.score}</p>
          </div>
          <div className="flex-1 p-2.5 rounded-lg border border-gray-800 text-center bg-gray-800/40">
            <p className="text-[8px] text-gray-600 font-bold uppercase">Lifecycle</p>
            <p className="text-[10px] font-bold mt-2" style={{ color: LC[lead.lc] }}>{LL[lead.lc]}</p>
          </div>
        </div>

        <SideSection title="Dojo">
          <div className="p-3 rounded-lg border border-gray-800 bg-gray-800/40 text-[11px] text-gray-400 leading-relaxed">
            Card Vol: <strong className="text-gray-200">{Number(lead.monthlyCardVolume) ? fCur(lead.monthlyCardVolume) : '-'}</strong><br />
            Provider: <strong className="text-gray-200">{lead.currentProvider || '-'}</strong><br />
            LTR: <strong className="text-emerald-400">{Number(lead.ltrAmount) ? fCur(lead.ltrAmount) : '-'}</strong><br />
            Statement: <strong className={lead.hasSwitchingStatement ? 'text-blue-400' : 'text-gray-600'}>{lead.hasSwitchingStatement ? 'Yes' : 'No'}</strong>
          </div>
        </SideSection>

        <SideSection title="Deal">
          <div className="p-3 rounded-lg border bg-gray-800/40" style={{ borderColor: `${SC[lead.deal.stage]}20` }}>
            <div className="flex justify-between mb-2"><span className="text-[11px] font-bold" style={{ color: SC[lead.deal.stage] }}>{SL[lead.deal.stage]}</span><span className="text-xs font-extrabold text-emerald-400">{fCur(lead.deal.val)}/mo</span></div>
            <div className="flex gap-0.5 mb-2">{STAGES.filter(s => s !== 'lost').map((s, i) => <div key={s} className="flex-1 h-1 rounded-full" style={{ backgroundColor: i <= STAGES.indexOf(lead.deal.stage) ? SC[lead.deal.stage] : '#333' }} />)}</div>
            <div className="flex gap-1 flex-wrap">{STAGES.filter(s => s !== lead.deal.stage).map(s => <button key={s} onClick={() => moveDeal(lead.id, s)} className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ color: SC[s], backgroundColor: `${SC[s]}08` }}>{SL[s]}</button>)}</div>
          </div>
        </SideSection>

        {(lead.tags || []).length > 0 && <SideSection title="Tags"><div className="flex gap-1.5 flex-wrap">{lead.tags.map((tag, i) => <span key={i} className="text-[9px] font-semibold px-2 py-0.5 rounded" style={{ color: GOLD, backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}20` }}>{tag}</span>)}</div></SideSection>}
      </div>

      {/* Timeline */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex border-b border-gray-800 px-4 shrink-0">
          {[['timeline', 'Timeline'], ['emails', 'Emails']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${tab === k ? 'text-amber-400 border-amber-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>{l}</button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-4">
          {tab === 'timeline' && (
            <div>
              <p className="text-sm font-bold text-white mb-3">Activity Timeline</p>
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-800" />
                {(lead.acts || []).map((a, i) => {
                  const Icon = actIcon(a.t)
                  return (
                    <div key={i} className="flex gap-3 mb-3 relative">
                      <div className="w-7 h-7 rounded-lg border border-gray-800 bg-gray-900 flex items-center justify-center shrink-0 z-10"><Icon size={11} className="text-gray-500" /></div>
                      <div className="flex-1 p-3 rounded-lg border border-gray-800 bg-gray-900/60">
                        <p className="text-[11px] text-gray-300 leading-relaxed">{a.d}</p>
                        <div className="flex gap-2 mt-1"><span className="text-[9px] text-gray-600">{fDate(a.at)} {fTime(a.at)}</span>{a.by && <span className="text-[9px] font-semibold" style={{ color: GOLD }}>by {a.by}</span>}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {tab === 'emails' && (
            <div>
              <p className="text-sm font-bold text-white mb-3">Email Activity</p>
              {(lead.acts || []).filter(a => a.t === 'email_open' || a.t === 'email_click').length === 0 && <p className="text-[11px] text-gray-600">No email activity yet</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SideSection({ title, children }) {
  return <div className="mb-3"><p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">{title}</p>{children}</div>
}
