import { useState, useEffect, useCallback } from 'react'
import { Settings, RefreshCw, Save, Key, Globe, Mail, CreditCard, Database, Shield, Bell, Palette, CheckCircle2 } from 'lucide-react'
import adminFetch from '../../utils/adminFetch'

const API = import.meta.env.VITE_API_URL || ''

const Section = ({ title, icon: Icon, color, children }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
    <div className="flex items-center gap-2 mb-4"><Icon size={16} className={`text-${color}-400`}/><h3 className="text-sm font-bold text-white">{title}</h3></div>
    <div className="space-y-3">{children}</div>
  </div>
)

const Field = ({ label, value, onChange, type = 'text', placeholder, desc }) => (
  <div>
    <label className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">{label}</label>
    {desc&&<p className="text-[10px] text-gray-600 mb-1">{desc}</p>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600"/>
  </div>
)

const Toggle = ({ label, desc, value, onChange }) => (
  <div className="flex items-center justify-between">
    <div><p className="text-xs text-gray-300">{label}</p>{desc&&<p className="text-[10px] text-gray-600">{desc}</p>}</div>
    <button onClick={()=>onChange(!value)} className={`relative w-9 h-5 rounded-full transition-colors ${value?'bg-emerald-500':'bg-gray-700'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${value?'left-[18px]':'left-0.5'}`}/></button>
  </div>
)

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    platform_name:'Reeve',
    support_email:'support@rezvo.app',
    stripe_key:'',
    stripe_secret:'',
    resend_key:'',
    resend_domain:'',
    anthropic_key:'',
    uber_client_id:'',
    uber_client_secret:'',
    google_places_key:'',
    notifications_email:true,
    notifications_slack:false,
    maintenance_mode:false,
    auto_approve_reviews:false,
    require_deposit:true,
    deposit_amount:10,
    commission_rate:5,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await adminFetch(`${API}/admin/settings`)
      if (r.ok) { const d = await r.json(); if (d.settings) setSettings(s=>({...s,...d.settings})) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await adminFetch(`${API}/admin/settings`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(settings) })
      setSaved(true); setTimeout(()=>setSaved(false), 2000)
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  const u = (key) => (val) => setSettings(s => ({...s,[key]:val}))

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-500/15 flex items-center justify-center"><Settings size={18} className="text-gray-400"/></div>
            <div><h1 className="text-lg font-bold text-white">Admin Settings</h1><p className="text-[11px] text-gray-500">Platform configuration, API keys, and integrations</p></div>
          </div>
          <button onClick={save} disabled={saving} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${saved?'bg-emerald-600 text-white':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {saved?<><CheckCircle2 size={13}/>Saved</>:saving?'Saving...':(<><Save size={13}/>Save Settings</>)}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4 max-w-3xl">
        <Section title="General" icon={Globe} color="blue">
          <Field label="Platform Name" value={settings.platform_name} onChange={u('platform_name')}/>
          <Field label="Support Email" value={settings.support_email} onChange={u('support_email')} type="email"/>
          <Toggle label="Maintenance Mode" desc="Temporarily disable public access" value={settings.maintenance_mode} onChange={u('maintenance_mode')}/>
        </Section>

        <Section title="Payments — Stripe" icon={CreditCard} color="purple">
          <Field label="Publishable Key" value={settings.stripe_key} onChange={u('stripe_key')} placeholder="pk_live_..." desc="Stripe Connect publishable key"/>
          <Field label="Secret Key" value={settings.stripe_secret} onChange={u('stripe_secret')} type="password" placeholder="sk_live_..."/>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Commission Rate (%)" value={settings.commission_rate} onChange={v=>u('commission_rate')(+v)} type="number"/>
            <Field label="Default Deposit (£)" value={settings.deposit_amount} onChange={v=>u('deposit_amount')(+v)} type="number"/>
          </div>
          <Toggle label="Require Booking Deposit" desc="Charge deposit when diners book" value={settings.require_deposit} onChange={u('require_deposit')}/>
        </Section>

        <Section title="Email — Resend" icon={Mail} color="pink">
          <Field label="Resend API Key" value={settings.resend_key} onChange={u('resend_key')} type="password" placeholder="re_..."/>
          <Field label="Sending Domain" value={settings.resend_domain} onChange={u('resend_domain')} placeholder="mail.rezvo.app"/>
        </Section>

        <Section title="AI — Anthropic" icon={Shield} color="amber">
          <Field label="Anthropic API Key" value={settings.anthropic_key} onChange={u('anthropic_key')} type="password" placeholder="sk-ant-..."/>
        </Section>

        <Section title="Delivery — Uber Direct" icon={Key} color="green">
          <Field label="Client ID" value={settings.uber_client_id} onChange={u('uber_client_id')} placeholder="..."/>
          <Field label="Client Secret" value={settings.uber_client_secret} onChange={u('uber_client_secret')} type="password"/>
        </Section>

        <Section title="Google Places" icon={Database} color="cyan">
          <Field label="API Key" value={settings.google_places_key} onChange={u('google_places_key')} type="password"/>
        </Section>

        <Section title="Notifications" icon={Bell} color="orange">
          <Toggle label="Email Notifications" desc="Get email alerts for critical events" value={settings.notifications_email} onChange={u('notifications_email')}/>
          <Toggle label="Slack Notifications" desc="Post alerts to Slack webhook" value={settings.notifications_slack} onChange={u('notifications_slack')}/>
          <Toggle label="Auto-approve Reviews" desc="Skip moderation for 4-5 star reviews" value={settings.auto_approve_reviews} onChange={u('auto_approve_reviews')}/>
        </Section>
      </div>
    </div>
  )
}
