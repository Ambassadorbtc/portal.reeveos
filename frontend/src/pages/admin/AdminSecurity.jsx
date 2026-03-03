import { useState, useEffect, useCallback } from 'react'
import { Shield, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Lock, Users, Database, FileWarning, Clock, ShieldCheck, ShieldAlert, Scan, Eye } from 'lucide-react'
import adminFetch from '../../utils/adminFetch'

const API = import.meta.env.VITE_API_URL || ''
const SEV_C = { ok:'#10B981', warning:'#F59E0B', critical:'#EF4444' }
const getToken = () => localStorage.getItem('admin_token')

export default function AdminSecurity() {
  const [report, setReport] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [tenantAudit, setTenantAudit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [tab, setTab] = useState('overview')

  const headers = { 'Authorization': `Bearer ${getToken()}` }

  const load = useCallback(async () => {
    try {
      const [repR, notR, auditR] = await Promise.all([
        adminFetch(`${API}/admin/security/report`, { headers }),
        adminFetch(`${API}/admin/security/notifications?limit=50`, { headers }),
        adminFetch(`${API}/admin/security/tenant-audit`, { headers }),
      ])
      if (repR.ok) { const d = await repR.json(); setReport(d.report) }
      if (notR.ok) { const d = await notR.json(); setNotifications(d.notifications || []) }
      if (auditR.ok) { const d = await auditR.json(); setTenantAudit(d.audit) }
    } catch(e) { console.error('Security load error:', e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const runScanNow = async () => {
    setScanning(true)
    try {
      const r = await adminFetch(`${API}/admin/security/scan-now`, { method:'POST', headers })
      if (r.ok) { const d = await r.json(); setReport(d.report); await load() }
    } catch(e) { console.error('Scan error:', e) }
    setScanning(false)
  }

  const ta = tenantAudit || {}
  const r = report || {}
  
  // GDPR compliance is specifically about tenant isolation + violations
  const gdprCompliant = ta.pass && (r.cross_tenant_violations?.violations_found ?? 0) === 0
  // Overall severity factors in data issues too
  const hasDataIssues = (r.data_integrity?.issues_found ?? 0) > 0 || (r.auth_anomalies?.anomalies_found ?? 0) > 0
  const hasViolations = (r.cross_tenant_violations?.violations_found ?? 0) > 0
  const severity = hasViolations ? 'critical' : !ta.pass && ta.coverage_percent !== undefined ? 'critical' : hasDataIssues ? 'warning' : 'ok'
  const SevIcon = severity === 'ok' ? ShieldCheck : severity === 'warning' ? ShieldAlert : ShieldAlert

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              severity === 'critical' ? 'bg-red-500/15' : severity === 'warning' ? 'bg-amber-500/15' : 'bg-emerald-500/15'
            }`}>
              <Shield size={18} className={severity === 'critical' ? 'text-red-400' : severity === 'warning' ? 'text-amber-400' : 'text-emerald-400'} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Security & Compliance</h1>
              <p className="text-[11px] text-gray-500">Tenant isolation · ICO GDPR Article 32 · Real-time monitoring</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={runScanNow} disabled={scanning} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 disabled:opacity-50">
              <Scan size={12} className={scanning ? 'animate-spin' : ''} />{scanning ? 'Scanning...' : 'Scan Now'}
            </button>
            <button onClick={load} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><RefreshCw size={14}/></button>
          </div>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label:'Compliance Status', value: severity === 'ok' ? 'PASS' : severity === 'warning' ? 'WARNING' : 'FAIL', icon: SevIcon, color: SEV_C[severity] || '#6B7280' },
            { label:'Tenant Coverage', value: ta.coverage_percent !== undefined ? `${ta.coverage_percent}%` : '—', icon: Lock, color: ta.pass ? '#10B981' : ta.coverage_percent !== undefined ? '#EF4444' : '#6B7280' },
            { label:'Violations (24h)', value: r.cross_tenant_violations?.violations_found ?? '0', icon: Eye, color: (r.cross_tenant_violations?.violations_found || 0) > 0 ? '#EF4444' : '#10B981' },
            { label:'Data Issues', value: r.data_integrity?.issues_found ?? (r.auth_anomalies?.anomalies_found ?? '0'), icon: Database, color: (r.data_integrity?.issues_found || 0) > 0 || (r.auth_anomalies?.anomalies_found || 0) > 0 ? '#F59E0B' : '#10B981' },
          ].map((s,i)=>(
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2"><s.icon size={14} style={{color:s.color}}/><span className="text-[10px] text-gray-500 uppercase font-semibold">{s.label}</span></div>
              <p className="text-lg font-bold" style={{color:s.color}}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {['overview','tenant','violations','auth','notifications'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium capitalize ${tab===t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20"><RefreshCw size={20} className="animate-spin text-gray-500"/></div>
        ) : tab === 'overview' ? (
          <>
            {/* ICO Compliance Banner */}
            <div className={`rounded-xl p-4 border ${gdprCompliant ? 'bg-emerald-500/5 border-emerald-500/20' : hasViolations ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
              <div className="flex items-start gap-3">
                {gdprCompliant ? <CheckCircle2 size={18} className="text-emerald-400 mt-0.5"/> : hasViolations ? <XCircle size={18} className="text-red-400 mt-0.5"/> : <AlertTriangle size={18} className="text-amber-400 mt-0.5"/>}
                <div>
                  <h3 className={`text-sm font-bold ${gdprCompliant ? 'text-emerald-400' : hasViolations ? 'text-red-400' : 'text-amber-400'}`}>
                    {gdprCompliant ? 'UK GDPR Article 32 — Compliant' : hasViolations ? 'UK GDPR Article 32 — Breach Detected' : 'UK GDPR Article 32 — Compliance Gap'}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {gdprCompliant
                      ? `Tenant isolation at ${ta.coverage_percent ?? 100}%. All business-scoped API routes have isolation guards. Zero cross-tenant violations. Data leakage is structurally prevented.`
                      : hasViolations
                        ? `${r.cross_tenant_violations?.violations_found ?? 0} cross-tenant access attempts detected in the last ${r.cross_tenant_violations?.hours_checked ?? 24} hours. ICO fines in 2025 averaged £2.8M.`
                        : `Tenant isolation coverage: ${ta.coverage_percent ?? '?'}%. ${ta.unguarded_routes ?? '?'} routes across ${ta.unguarded_files ?? '?'} files are unprotected.`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* AI Watchdog Status */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Shield size={14} className="text-blue-400"/> AI Security Watchdog</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name:'Realtime Guard', freq:'Every 5 min', cost:'Zero (DB only)', desc:'Cross-tenant violations, duplicate accounts' },
                  { name:'Security Watchdog', freq:'Every 30 min', cost:'Haiku', desc:'AI-powered audit log analysis, auth anomalies' },
                  { name:'Full Compliance Audit', freq:'Daily 5 AM', cost:'Sonnet', desc:'Code-level tenant scan, data integrity, ICO report' },
                ].map((w,i)=>(
                  <div key={i} className="p-3 rounded-lg bg-gray-800/40">
                    <div className="flex items-center gap-2 mb-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/><span className="text-xs text-gray-200 font-medium">{w.name}</span></div>
                    <p className="text-[10px] text-gray-500 mb-1">{w.freq} · {w.cost}</p>
                    <p className="text-[10px] text-gray-400">{w.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Summary */}
            {r.generated_at && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-2">Latest Report</h3>
                <p className="text-[10px] text-gray-500 mb-3">Generated: {new Date(r.generated_at).toLocaleString('en-GB')}</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:'Tenant Isolation', pass: r.tenant_isolation?.pass, detail: `${r.tenant_isolation?.coverage_percent ?? '?'}% coverage · ${r.tenant_isolation?.guarded_files ?? '?'} files guarded` },
                    { label:'Cross-Tenant Violations', pass: (r.cross_tenant_violations?.violations_found ?? 0) === 0, detail: `${r.cross_tenant_violations?.violations_found ?? 0} violations in ${r.cross_tenant_violations?.hours_checked ?? 24}h` },
                    { label:'Auth Integrity', pass: (r.auth_anomalies?.anomalies_found ?? 0) === 0, detail: `${r.auth_anomalies?.anomalies_found ?? 0} anomalies detected` },
                    { label:'Data Integrity', pass: (r.data_integrity?.issues_found ?? 0) === 0, detail: `${r.data_integrity?.issues_found ?? 0} issues found` },
                  ].map((s,i)=>(
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/40">
                      {s.pass ? <CheckCircle2 size={14} className="text-emerald-400"/> : <AlertTriangle size={14} className="text-amber-400"/>}
                      <div><p className="text-xs text-gray-200 font-medium">{s.label}</p><p className="text-[10px] text-gray-500">{s.detail}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : tab === 'tenant' ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-1">Tenant Isolation Audit</h3>
            <p className="text-[10px] text-gray-500 mb-4">Scans all API route files for verify_business_access or set_user_tenant_context guards</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-gray-800/40 text-center"><p className="text-2xl font-bold" style={{color: ta.pass ? '#10B981' : '#EF4444'}}>{ta.coverage_percent ?? '?'}%</p><p className="text-[10px] text-gray-500">Coverage</p></div>
              <div className="p-3 rounded-lg bg-gray-800/40 text-center"><p className="text-2xl font-bold text-emerald-400">{ta.guarded_routes ?? '?'}</p><p className="text-[10px] text-gray-500">Protected Routes</p></div>
              <div className="p-3 rounded-lg bg-gray-800/40 text-center"><p className="text-2xl font-bold" style={{color: (ta.unguarded_routes||0) > 0 ? '#EF4444' : '#10B981'}}>{ta.unguarded_routes ?? 0}</p><p className="text-[10px] text-gray-500">Unprotected Routes</p></div>
            </div>
            {(ta.unguarded_details || []).length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1"><XCircle size={12}/> Unguarded Files</h4>
                <div className="space-y-1">
                  {ta.unguarded_details.map((f,i)=>(
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                      <FileWarning size={12} className="text-red-400"/>
                      <span className="text-xs text-gray-200 font-mono flex-1">{f.file}</span>
                      <span className="text-[10px] text-red-400 font-semibold">{f.routes} routes exposed</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ta.pass && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <CheckCircle2 size={14} className="text-emerald-400"/>
                <span className="text-xs text-emerald-400 font-medium">All {ta.guarded_files} business-scoped files have tenant guards — {ta.exempt_files} public/admin files correctly exempt</span>
              </div>
            )}
          </div>
        ) : tab === 'violations' ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-1">Cross-Tenant Violations</h3>
            <p className="text-[10px] text-gray-500 mb-4">Logged when a user attempts to access a business they don't own</p>
            {(r.cross_tenant_violations?.violations_found ?? 0) === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <CheckCircle2 size={14} className="text-emerald-400"/>
                <span className="text-xs text-emerald-400 font-medium">No cross-tenant violations in the last {r.cross_tenant_violations?.hours_checked ?? 24} hours</span>
              </div>
            ) : (
              <div className="space-y-2">
                {(r.cross_tenant_violations?.audit_violations || []).map((v,i)=>(
                  <div key={i} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                    <div className="flex items-center gap-2 mb-1"><XCircle size={12} className="text-red-400"/><span className="text-xs text-red-400 font-semibold">VIOLATION</span><span className="text-[10px] text-gray-500">{v.timestamp}</span></div>
                    <p className="text-[11px] text-gray-300">User: {v.user_email || v.user_id} attempted access to business {v.business_id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === 'auth' ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-1">Auth Anomalies</h3>
            <p className="text-[10px] text-gray-500 mb-4">Duplicate accounts, role mismatches, orphaned records</p>
            {(r.auth_anomalies?.anomalies || []).length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <CheckCircle2 size={14} className="text-emerald-400"/>
                <span className="text-xs text-emerald-400 font-medium">No auth anomalies detected</span>
              </div>
            ) : (
              <div className="space-y-2">
                {(r.auth_anomalies?.anomalies || []).map((a,i)=>(
                  <div key={i} className={`p-3 rounded-lg border ${a.severity === 'critical' ? 'bg-red-500/5 border-red-500/10' : 'bg-amber-500/5 border-amber-500/10'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={12} className={a.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}/>
                      <span className={`text-[10px] font-semibold uppercase ${a.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>{a.type.replace(/_/g,' ')}</span>
                    </div>
                    <p className="text-[11px] text-gray-300">{a.detail}</p>
                    {a.email && <p className="text-[10px] text-gray-500 mt-0.5">Account: {a.email}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === 'notifications' ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-3">Security Alerts</h3>
            {notifications.length === 0 ? (
              <p className="text-xs text-gray-500">No security alerts yet. The AI watchdog will create alerts here when it detects issues.</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((n,i)=>(
                  <div key={i} className={`p-3 rounded-lg border ${n.severity === 'critical' ? 'bg-red-500/5 border-red-500/10' : 'bg-amber-500/5 border-amber-500/10'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {n.severity === 'critical' ? <XCircle size={12} className="text-red-400"/> : <AlertTriangle size={12} className="text-amber-400"/>}
                      <span className="text-xs text-gray-200 font-medium">{n.title}</span>
                      <span className="text-[10px] text-gray-500 ml-auto">{n.created_at ? new Date(n.created_at).toLocaleString('en-GB') : ''}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-3">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
