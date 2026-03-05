import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
const API = '/api'
const apiFetch = async (path, opts = {}) => {
  const token = sessionStorage.getItem('client_token')
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const res = await fetch(`${API}${path}`, { ...opts, headers })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `HTTP ${res.status}`) }
  return res.json()
}
const DEFAULT_CONTRA = {
  pregnant:{microneedling:'BLOCK',peel:'BLOCK',rf:'BLOCK',polynucleotides:'BLOCK',lymphatic:'FLAG'},
  pacemaker:{rf:'BLOCK',microneedling:'FLAG'},metalImplants:{rf:'BLOCK'},
  bloodClotting:{microneedling:'BLOCK',peel:'FLAG',rf:'FLAG',polynucleotides:'FLAG'},
  activeCancer:{microneedling:'BLOCK',peel:'BLOCK',rf:'BLOCK',polynucleotides:'BLOCK',lymphatic:'BLOCK'},
  keloid:{microneedling:'BLOCK',rf:'FLAG',peel:'FLAG',polynucleotides:'FLAG'},
  skinInfection:{microneedling:'BLOCK',peel:'BLOCK',rf:'BLOCK',polynucleotides:'BLOCK',lymphatic:'BLOCK'},
  autoimmune:{microneedling:'BLOCK',peel:'FLAG',rf:'FLAG',polynucleotides:'FLAG'},
  epilepsy:{microneedling:'FLAG',peel:'FLAG',rf:'FLAG',polynucleotides:'FLAG',lymphatic:'FLAG'},
  herpes:{microneedling:'FLAG',peel:'FLAG'},
  roaccutane:{microneedling:'BLOCK',peel:'BLOCK',rf:'BLOCK',polynucleotides:'FLAG'},
  bloodThinners:{microneedling:'BLOCK',rf:'FLAG',polynucleotides:'FLAG'},
  retinoids:{peel:'BLOCK',microneedling:'FLAG'},photosensitising:{peel:'BLOCK',microneedling:'FLAG'},
  immunosuppressants:{microneedling:'BLOCK',peel:'FLAG',rf:'FLAG',polynucleotides:'FLAG'},
  sunburn:{microneedling:'BLOCK',peel:'BLOCK',rf:'BLOCK',polynucleotides:'FLAG'},
  sunbed:{peel:'BLOCK',microneedling:'FLAG',rf:'FLAG'},
  fishAllergy:{polynucleotides:'BLOCK'},fillersRecent:{rf:'BLOCK',polynucleotides:'FLAG'},
}
const TX_LABELS = {microneedling:'Microneedling',peel:'Chemical Peels',rf:'RF Needling',polynucleotides:'Polynucleotides',lymphatic:'Lymphatic Lift'}
function getAlerts(d,matrix){
  const m=matrix||DEFAULT_CONTRA,blocks=[],flags=[]
  Object.entries(m).forEach(([k,txs])=>{if(d[k]==='yes')Object.entries(txs).forEach(([tx,lv])=>{const e={condition:k,treatment:TX_LABELS[tx]||tx};lv==='BLOCK'?blocks.push(e):flags.push(e)})})
  return {blocks,flags}
}
// Icons (SVG)
const I={
  cal:(c='currentColor',s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  form:(c='currentColor',s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>,
  user:(c='currentColor',s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  msg:(c='currentColor',s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  home:(c='currentColor',s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  bell:(c='currentColor',s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  back:(c='currentColor',s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  arr:(c='currentColor',s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  chk:(c='currentColor',s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={3} strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>,
  shield:(c='currentColor',s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  clock:(c='currentColor',s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  warn:(c='currentColor',s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  block:(c='currentColor',s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  eye:(c='currentColor',s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  lock:(c='currentColor',s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  mail:(c='currentColor',s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  phone:(c='currentColor',s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
}
// Light palette — mapped from Figma dark tokens
const L={bg:'#F1F5F9',card:'#FFFFFF',bdr:'#E2E8F0',bdr2:'#CBD5E1',h:'#111111',txt:'#334155',txtM:'#64748B',txtL:'#94A3B8',acc:'#C8A34C',ok:'#22C55E',err:'#EF4444',wrn:'#F59E0B',f:"'Figtree',-apple-system,sans-serif"}
const STEPS=['Personal','Medical','Medications','Skin','Lifestyle','Consent']
// ═══ SHARED COMPONENTS (matching Figma patterns) ═══

// Figma header bar — used on ALL pages
const Header = ({biz,desk,children}) => (
  <div style={{background:L.card,borderBottom:`1px solid ${L.bdr}`,padding:desk?'12px 40px':'12px 16px',position:'sticky',top:0,zIndex:20}}>
    <div style={{maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div style={{display:'flex',alignItems:'center',gap:16}}>
        <div style={{width:32,height:32,borderRadius:8,background:L.acc,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'#fff'}}>R</div>
        <span style={{fontSize:18,fontWeight:700,color:L.h,letterSpacing:'-0.27px'}}>{biz?.name||'Rejuvenate Skin Experts'}</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:16}}>{children}</div>
    </div>
  </div>
)

// Figma progress bar — STEP X OF Y + bar + percentage (from 2:2, 2:206, 2:381, 2:540)
const ProgressBar = ({step,total=6,title,desk}) => {
  const pct = Math.round(((step+1)/total)*100)
  return (
    <div style={{background:L.card,borderBottom:`1px solid ${L.bdr}`,padding:desk?'16px 40px 20px':'16px 16px 20px'}}>
      <div style={{maxWidth:800,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:8}}>
          <div>
            <p style={{fontSize:13,fontWeight:700,color:L.acc,margin:0,textTransform:'uppercase',letterSpacing:'0.5px'}}>Step {step+1} of {total}</p>
            <p style={{fontSize:22,fontWeight:700,color:L.h,margin:'2px 0 0'}}>{title}</p>
          </div>
          <span style={{fontSize:14,color:L.txtM}}>{pct}% Complete</span>
        </div>
        <div style={{height:8,background:L.bdr,borderRadius:4,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${pct}%`,background:L.acc,borderRadius:4,transition:'width 0.4s ease'}}/>
        </div>
      </div>
    </div>
  )
}

// Figma toggle switch (from 2:2 — pill toggle, gold=on)
const Toggle = ({value,onChange}) => {
  const on = value==='yes'
  return (
    <button type="button" onClick={()=>onChange(on?'no':'yes')} style={{width:56,height:32,borderRadius:16,background:on?L.acc:L.bdr,border:'none',cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}>
      <div style={{width:24,height:24,borderRadius:12,background:'#fff',position:'absolute',top:4,left:on?28:4,transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.15)'}}/>
    </button>
  )
}

// Figma question card (from 2:2 — bordered card with question + toggle)
const QCard = ({label,sub,name,value,onChange,detail,detailLabel,detailValue,onDetailChange}) => (
  <div style={{background:L.card,border:`1px solid ${value==='yes'?L.acc+'60':L.bdr}`,borderRadius:24,padding:25,marginBottom:16,transition:'border-color 0.2s'}}>
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16}}>
      <div style={{flex:1}}>
        <p style={{fontSize:16,fontWeight:700,color:L.h,margin:0}}>{label}</p>
        {sub&&<p style={{fontSize:14,color:L.txtM,margin:'4px 0 0',lineHeight:'22px'}}>{sub}</p>}
      </div>
      <Toggle value={value} onChange={v=>onChange(name,v)}/>
    </div>
    {value==='yes'&&detail&&(
      <div style={{marginTop:16}}>
        <p style={{fontSize:14,fontWeight:600,color:L.h,margin:'0 0 8px'}}>{detailLabel||'Treatment Details'}</p>
        <textarea placeholder="Please provide details..." value={detailValue||''} onChange={e=>onDetailChange(name+'Detail',e.target.value)}
          style={{width:'100%',minHeight:96,padding:14,borderRadius:16,border:`1px solid ${L.bdr}`,fontSize:14,outline:'none',background:L.bg,color:L.h,boxSizing:'border-box',fontFamily:L.f,resize:'vertical'}}/>
      </div>
    )}
  </div>
)

// Figma input field with icon (from 2:303 signup)
const Field = ({label,icon,type='text',value,onChange,placeholder,name}) => (
  <div style={{marginBottom:20}}>
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
      {icon&&icon}{label&&<label style={{fontSize:14,fontWeight:600,color:L.h}}>{label}</label>}
    </div>
    <input type={type} value={value||''} placeholder={placeholder} onChange={e=>onChange(name,e.target.value)}
      style={{width:'100%',padding:'14px 17px',borderRadius:16,border:`1px solid ${L.bdr}`,fontSize:14,outline:'none',background:L.bg,color:L.h,boxSizing:'border-box',fontFamily:L.f}}
      onFocus={e=>e.target.style.borderColor=L.acc} onBlur={e=>e.target.style.borderColor=L.bdr}/>
  </div>
)

// Figma consent checkbox (from 2:540)
const Consent = ({label,sub,checked,onChange}) => (
  <div style={{display:'flex',gap:16,padding:'16px 0',borderBottom:`1px solid ${L.bdr}22`}}>
    <button type="button" onClick={onChange} style={{width:24,height:24,borderRadius:8,border:checked?'none':`2px solid ${L.bdr}`,background:checked?L.acc:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,marginTop:2}}>
      {checked&&I.chk('#fff',14)}
    </button>
    <div>
      <p style={{fontSize:16,fontWeight:700,color:L.h,margin:0}}>{label}</p>
      <p style={{fontSize:14,color:L.txtM,margin:'4px 0 0',lineHeight:'22px'}}>{sub}</p>
    </div>
  </div>
)

// Figma alert banners (from 2:2 — red block + amber flag)
const Alerts = ({blocks,flags}) => {
  if(!blocks.length&&!flags.length) return null
  return (
    <div style={{marginTop:20}}>
      {blocks.length>0&&(
        <div style={{background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:24,padding:20,marginBottom:12,display:'flex',gap:16,alignItems:'flex-start'}}>
          <div style={{width:40,height:40,borderRadius:99,background:'rgba(239,68,68,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{I.block(L.err,20)}</div>
          <div>
            <p style={{fontSize:16,fontWeight:700,color:L.err,margin:'0 0 4px'}}>Treatments Blocked</p>
            {blocks.map((b,i)=><p key={i} style={{fontSize:14,color:'#B91C1C',margin:'2px 0'}}>{b.treatment} — {b.condition}</p>)}
          </div>
        </div>
      )}
      {flags.length>0&&(
        <div style={{background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:24,padding:20,display:'flex',gap:16,alignItems:'flex-start'}}>
          <div style={{width:40,height:40,borderRadius:99,background:'rgba(245,158,11,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{I.warn(L.wrn,20)}</div>
          <div>
            <p style={{fontSize:16,fontWeight:700,color:'#B45309',margin:'0 0 4px'}}>Therapist Review Required</p>
            {flags.map((f,i)=><p key={i} style={{fontSize:14,color:'#92400E',margin:'2px 0'}}>{f.treatment} — {f.condition}</p>)}
          </div>
        </div>
      )}
    </div>
  )
}

// Figma signature pad (from 2:540)
const SigPad = ({onSign}) => {
  const ref=useRef(null),dr=useRef(false)
  const s=useCallback(e=>{dr.current=true;const c=ref.current,r=c.getBoundingClientRect(),ctx=c.getContext('2d'),p=e.touches?e.touches[0]:e;ctx.beginPath();ctx.moveTo(p.clientX-r.left,p.clientY-r.top)},[])
  const d=useCallback(e=>{if(!dr.current)return;e.preventDefault();const c=ref.current,r=c.getBoundingClientRect(),ctx=c.getContext('2d'),p=e.touches?e.touches[0]:e;ctx.strokeStyle=L.h;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineTo(p.clientX-r.left,p.clientY-r.top);ctx.stroke()},[])
  const u=useCallback(()=>{dr.current=false;if(ref.current)onSign(ref.current.toDataURL())},[onSign])
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <p style={{fontSize:18,fontWeight:700,color:L.h,margin:0}}>Digital Signature</p>
        <button type="button" onClick={()=>{ref.current.getContext('2d').clearRect(0,0,600,180);onSign(null)}} style={{background:'none',border:'none',color:L.acc,fontSize:14,fontWeight:600,cursor:'pointer'}}>Clear Signature</button>
      </div>
      <div style={{border:`2px dashed ${L.bdr}`,borderRadius:24,overflow:'hidden',position:'relative'}}>
        <canvas ref={ref} width={600} height={180} style={{width:'100%',height:160,cursor:'crosshair',background:L.bg,touchAction:'none',display:'block'}}
          onMouseDown={s} onMouseMove={d} onMouseUp={u} onMouseLeave={u} onTouchStart={s} onTouchMove={d} onTouchEnd={u}/>
        <p style={{position:'absolute',bottom:12,right:20,fontSize:11,color:L.txtL,letterSpacing:'0.15em',textTransform:'uppercase',margin:0}}>Electronic Record</p>
      </div>
      <p style={{fontSize:13,color:L.txtM,marginTop:12}}>By signing above, you acknowledge that this is a legally binding electronic signature.</p>
    </div>
  )
}

// Figma footer (from all pages)
const Footer = ({biz,desk}) => (
  <div style={{borderTop:`1px solid ${L.bdr}`,padding:desk?'32px 40px':'20px 16px',marginTop:32}}>
    <div style={{maxWidth:1200,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
      <p style={{fontSize:13,color:L.txtM,margin:0}}>&copy; {new Date().getFullYear()} {biz?.name}. All rights reserved.</p>
      <div style={{display:'flex',gap:20,alignItems:'center'}}>
        {['Privacy Policy','Terms of Service','Help Center'].map(l=><button key={l} style={{background:'none',border:'none',fontSize:13,color:L.txtL,cursor:'pointer',fontFamily:L.f,padding:0}}>{l}</button>)}
        <span style={{fontSize:11,color:L.txtL}}>Powered by <b style={{color:L.acc}}>ReeveOS</b></span>
      </div>
    </div>
  </div>
)

// Figma form nav buttons (from 2:2, 2:206, 2:381, 2:540)
const FormNav = ({step,canProceed,onBack,onNext,onSubmit,loading,desk}) => (
  <div style={{borderTop:`1px solid ${L.bdr}`,padding:'24px 0',marginTop:32}}>
    <div style={{maxWidth:800,margin:'0 auto',padding:'0 24px',display:'flex',justifyContent:'space-between'}}>
      {step>0?<button onClick={onBack} style={{padding:'14px 32px',borderRadius:16,border:`1px solid ${L.bdr}`,background:L.card,fontSize:14,fontWeight:600,color:L.acc,cursor:'pointer',fontFamily:L.f,display:'flex',alignItems:'center',gap:8}}>
        {I.back(L.acc,14)} Previous Step
      </button>:<div/>}
      {onSubmit?
        <button onClick={onSubmit} disabled={!canProceed||loading} style={{padding:'14px 32px',borderRadius:16,border:'none',background:canProceed&&!loading?L.acc:L.bdr,color:canProceed?'#fff':L.txtL,fontSize:14,fontWeight:700,cursor:canProceed?'pointer':'not-allowed',fontFamily:L.f,display:'flex',alignItems:'center',gap:8}}>
          Submit Form {I.chk('#fff',14)}
        </button>
      :<button onClick={onNext} disabled={!canProceed} style={{padding:'14px 32px',borderRadius:16,border:'none',background:canProceed?L.acc:L.bdr,color:canProceed?'#fff':L.txtL,fontSize:14,fontWeight:700,cursor:canProceed?'pointer':'not-allowed',fontFamily:L.f,display:'flex',alignItems:'center',gap:8}}>
          {step===STEPS.length-2?'Continue to Final Step':'Save and Continue'} {I.arr('#fff',14)}
        </button>}
    </div>
  </div>
)

// ═══ CLIENT SIDEBAR (matching web portal style: black rail + white panel) ═══
const RAIL=64, PANEL=200
const ClientSidebar = ({biz,user,activeTab,onNav,desk,onLogout}) => {
  const [panelOpen,setPanelOpen]=useState(true)
  const tabs=[
    {id:'home',label:'Home',icon:'home'},
    {id:'bookings',label:'Bookings',icon:'cal'},
    {id:'form',label:'Consultation',icon:'form'},
    {id:'messages',label:'Messages',icon:'msg'},
    {id:'profile',label:'My Profile',icon:'user'},
  ]
  const initials=(user?.name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)
  if(!desk) return null
  return (
    <div style={{display:'flex',height:'100vh',position:'sticky',top:0,flexShrink:0,fontFamily:L.f}}>
      {/* BLACK RAIL */}
      <div style={{width:RAIL,background:'#111111',display:'flex',flexDirection:'column',zIndex:20,flexShrink:0}}>
        {/* Logo */}
        <div style={{height:64,display:'flex',alignItems:'center',justifyContent:'center',borderBottom:'1px solid rgba(255,255,255,0.08)',flexShrink:0}}>
          <div style={{width:34,height:34,borderRadius:10,background:'#D4A373',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>
            <span style={{color:'#111111',fontWeight:700,fontSize:15}}>R.</span>
          </div>
        </div>
        {/* Rail icons */}
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',paddingTop:16,gap:4}}>
          {tabs.map(t=>{
            const active=activeTab===t.id
            return (
              <button key={t.id} onClick={()=>onNav(t.id)} style={{
                width:44,height:44,borderRadius:12,border:'none',cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',position:'relative',
                background:active?'rgba(255,255,255,0.14)':'transparent',transition:'all 200ms',
              }}
                onMouseEnter={e=>{if(!active)e.currentTarget.style.background='rgba(255,255,255,0.08)'}}
                onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent'}}>
                {active&&<div style={{position:'absolute',left:0,top:8,bottom:8,width:3,borderRadius:'0 4px 4px 0',background:'#FAF7F2'}}/>}
                {I[t.icon](active?'#FAF7F2':'rgba(250,247,242,0.4)',20)}
              </button>
            )
          })}
        </div>
        {/* User avatar */}
        <div style={{borderTop:'1px solid rgba(255,255,255,0.08)',padding:'12px 0',display:'flex',justifyContent:'center',flexShrink:0}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <span style={{color:'#FAF7F2',fontWeight:600,fontSize:12}}>{initials}</span>
          </div>
        </div>
      </div>
      {/* WHITE PANEL */}
      {panelOpen&&<div style={{width:PANEL,background:'#FFFFFF',display:'flex',flexDirection:'column',borderRight:`1px solid ${L.bdr}`,overflow:'hidden'}}>
        {/* Panel header */}
        <div style={{height:64,display:'flex',alignItems:'center',padding:'0 16px',borderBottom:'1px solid #F0EDE7',flexShrink:0}}>
          <span style={{fontWeight:700,fontSize:15,color:'#111111',letterSpacing:'-0.01em'}}>{biz?.name||'Portal'}</span>
        </div>
        {/* Nav items */}
        <div style={{flex:1,padding:'12px 10px',overflowY:'auto'}}>
          <div style={{padding:'0 8px',marginBottom:10,fontSize:10,fontWeight:600,letterSpacing:'0.1em',color:'#7A776F',textTransform:'uppercase'}}>MENU</div>
          {tabs.map(t=>{
            const active=activeTab===t.id
            return (
              <button key={t.id} onClick={()=>onNav(t.id)} style={{
                width:'100%',display:'flex',alignItems:'center',gap:10,
                padding:'9px 10px',borderRadius:10,border:'none',cursor:'pointer',
                fontSize:13.5,fontWeight:active?600:500,
                color:active?'#111111':'#7A776F',
                background:active?'rgba(17,17,17,0.06)':'transparent',
                transition:'all 180ms',fontFamily:L.f,textAlign:'left',
              }}
                onMouseEnter={e=>{if(!active){e.currentTarget.style.background='rgba(232,228,221,0.5)';e.currentTarget.style.color='#2C2C2A'}}}
                onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color='#7A776F'}}}>
                {I[t.icon](active?'#111111':'#7A776F',17)}
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
        {/* User footer */}
        <div style={{flexShrink:0,borderTop:'1px solid #F0EDE7',padding:12}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:6,borderRadius:10}}>
            <div style={{width:34,height:34,borderRadius:'50%',background:'rgba(212,163,115,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{color:'#111111',fontWeight:600,fontSize:11}}>{initials}</span>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:'#2C2C2A',lineHeight:1.3}}>{user?.name||'User'}</div>
              <div style={{fontSize:11,color:'#7A776F'}}>{biz?.name}</div>
            </div>
          </div>
          <button onClick={onLogout} style={{width:'100%',marginTop:8,padding:'8px 0',borderRadius:8,border:`1px solid ${L.bdr}`,background:'transparent',fontSize:12,fontWeight:600,color:'#7A776F',cursor:'pointer',fontFamily:L.f}}>Sign Out</button>
        </div>
      </div>}
    </div>
  )
}
export default function ClientPortal() {
  const {slug}=useParams()
  const [view,setView]=useState('login'),[biz,setBiz]=useState(null),[user,setUser]=useState(null)
  const [loading,setLoading]=useState(false),[err,setErr]=useState('')
  const [authMode,setAuthMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState('')
  const [signupName,setSignupName]=useState(''),[signupPhone,setSignupPhone]=useState(''),[showPw,setShowPw]=useState(false)
  const [step,setStep]=useState(0),[fd,setFd]=useState({}),[cs,setCs]=useState(null),[myData,setMyData]=useState(null)
  const [activeTab,setActiveTab]=useState('home')
  const topRef=useRef(null)
  const isSalon=biz?.type==='salon'||biz?.type==='local_services'||biz?.category==='salon'
  const hasForm=cs?.status==='complete'||cs?.status==='submitted'
  const alerts=getAlerts(fd)
  const desk=typeof window!=='undefined'&&window.innerWidth>=768
  const set=useCallback((k,v)=>setFd(p=>({...p,[k]:v})),[])
  const upcoming=myData?.upcoming_bookings||[]

  useEffect(()=>{if(!slug)return;apiFetch(`/client/${slug}/info`).then(d=>{setBiz(d.business||d);if(sessionStorage.getItem('client_token'))loadUser()}).catch(()=>{})},[slug])
  const loadUser=async()=>{try{const p=await apiFetch('/client/auth/me');const d=await apiFetch(`/client/${slug}/my-data`);setUser(p.user||p);setCs(d.consultation||null);setMyData(d);setView('home')}catch(e){sessionStorage.removeItem('client_token')}}
  const doAuth=async()=>{setLoading(true);setErr('');try{const body=authMode==='login'?{email,password}:{name:signupName,email,phone:signupPhone,password,business_id:biz?.business_id||''};const d=await apiFetch(`/client/auth/${authMode==='login'?'login':'signup'}`,{method:'POST',body:JSON.stringify(body)});sessionStorage.setItem('client_token',d.token);await loadUser()}catch(e){setErr(e.message)}setLoading(false)}
  const logout=()=>{sessionStorage.removeItem('client_token');setUser(null);setView('login')}
  const submitForm=async()=>{setLoading(true);try{await apiFetch(`/consultation/public/${slug}/submit`,{method:'POST',body:JSON.stringify({form_data:fd,alerts})});setCs({status:'submitted'});setView('submitted')}catch(e){setErr(e.message)}setLoading(false)}
  const canProceed=()=>{if(step===0)return fd.fullName&&fd.dob&&fd.mobile&&fd.email&&fd.emergencyName&&fd.emergencyPhone&&fd.gpName;if(step===5)return fd.consent1&&fd.consent2&&fd.consent3&&fd.consent4&&fd.signed;return true}
  const goStep=(n)=>{setStep(n);topRef.current?.scrollIntoView({behavior:'smooth'})}

  if(!biz) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:L.bg,fontFamily:L.f}}><div style={{textAlign:'center'}}><div style={{width:32,height:32,border:`3px solid ${L.bdr}`,borderTopColor:L.acc,borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/><p style={{fontSize:13,color:L.txtM}}>Loading...</p></div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  // ═══════════════════════════════════════════════════════════════
  // LOGIN (Figma: 2:115) — hero banner + two-col: welcome text / login card
  // ═══════════════════════════════════════════════════════════════
  if(view==='login') return (
    <div style={{minHeight:'100vh',background:L.bg,fontFamily:L.f}}>
      <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <Header biz={biz} desk={desk}>
        {desk&&['Treatments','Products','Locations'].map(l=><button key={l} style={{background:'none',border:'none',fontSize:14,fontWeight:500,color:L.txtM,cursor:'pointer',fontFamily:L.f,textTransform:'uppercase',letterSpacing:'0.5px'}}>{l}</button>)}
      </Header>
      {/* Hero banner (Figma: 2:134) */}
      <div style={{maxWidth:1200,margin:'0 auto',padding:desk?'32px 40px':'16px 16px'}}>
        <div style={{width:'100%',height:desk?400:200,borderRadius:24,background:'linear-gradient(135deg,#E2E8F0 0%,#CBD5E1 50%,#E2E8F0 100%)',display:'flex',alignItems:'flex-end',padding:48,boxSizing:'border-box',marginBottom:desk?0:24,position:'relative',overflow:'hidden'}}>
          <p style={{fontSize:desk?40:24,fontWeight:300,color:L.txtM,margin:0,fontStyle:'italic'}}>Radiance redefined.</p>
        </div>
      </div>
      {/* Two-col: welcome + login card (Figma: 2:140) */}
      <div style={{maxWidth:1200,margin:'0 auto',padding:desk?'0 40px 40px':'0 16px 24px'}}>
        <div style={desk?{display:'flex',gap:48,alignItems:'flex-start'}:{}}>
          {/* Left: Welcome text (Figma: 2:141) */}
          {desk&&<div style={{flex:1,paddingTop:40}}>
            <h2 style={{fontSize:28,fontWeight:700,color:L.acc,margin:'0 0 24px'}}>Welcome Back</h2>
            <p style={{fontSize:16,color:L.txtM,lineHeight:'26px',margin:'0 0 24px',maxWidth:450}}>Access your personalized skincare dashboard, manage appointments, and explore exclusive member treatments designed for your unique glow.</p>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              {I.shield(L.acc,20)}
              <span style={{fontSize:14,fontWeight:700,color:L.acc,textTransform:'uppercase',letterSpacing:'0.5px'}}>Secure Luxury Gateway</span>
            </div>
          </div>}
          {/* Right: Login card (Figma: 2:151) */}
          <div style={{width:desk?480:'100%',flexShrink:0}}>
            <div style={{background:L.card,borderRadius:24,border:`1px solid ${L.bdr}`,padding:33,boxShadow:'0 10px 40px rgba(0,0,0,0.06)'}}>
              <h2 style={{fontSize:24,fontWeight:700,color:L.h,margin:'0 0 8px'}}>{authMode==='login'?'Member Login':'Create Account'}</h2>
              <p style={{fontSize:14,color:L.txtM,margin:'0 0 28px'}}>{authMode==='login'?'Please enter your credentials to continue.':'Start your journey to radiant skin today.'}</p>

              {authMode==='signup'&&<Field label="Full Name" icon={I.user(L.txtL,14)} name="signupName" value={signupName} onChange={(_,v)=>setSignupName(v)} placeholder="Enter your full name"/>}

              <Field label="Email Address" icon={I.mail(L.txtL,14)} type="email" name="email" value={email} onChange={(_,v)=>setEmail(v)} placeholder="name@example.com"/>

              {authMode==='signup'&&<Field label="Phone Number" icon={I.phone(L.txtL,14)} type="tel" name="phone" value={signupPhone} onChange={(_,v)=>setSignupPhone(v)} placeholder="+1 (555) 000-0000"/>}

              <div style={{marginBottom:20}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    {I.lock(L.txtL,14)}<label style={{fontSize:14,fontWeight:600,color:L.h}}>Password</label>
                  </div>
                  {authMode==='login'&&<button style={{background:'none',border:'none',color:L.acc,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:L.f}}>Forgot password?</button>}
                </div>
                <div style={{position:'relative'}}>
                  <input type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={authMode==='login'?'••••••••':'Create a strong password'}
                    style={{width:'100%',padding:'14px 50px 14px 17px',borderRadius:16,border:`1px solid ${L.bdr}`,fontSize:14,outline:'none',background:L.bg,color:L.h,boxSizing:'border-box',fontFamily:L.f}}/>
                  <button type="button" onClick={()=>setShowPw(!showPw)} style={{position:'absolute',right:17,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer'}}>{I.eye(L.txtL)}</button>
                </div>
              </div>

              {err&&<p style={{fontSize:13,color:L.err,margin:'0 0 16px'}}>{err}</p>}

              <button onClick={doAuth} disabled={loading} style={{width:'100%',padding:'16px 0',borderRadius:16,border:'none',background:L.acc,color:'#fff',fontSize:16,fontWeight:700,cursor:loading?'wait':'pointer',fontFamily:L.f,letterSpacing:'0.3px',opacity:loading?0.6:1,textTransform:'uppercase',marginBottom:20}}>
                {loading?'Please wait...':authMode==='login'?'Log In':'Create Account'}
              </button>

              <p style={{textAlign:'center',fontSize:14,color:L.txtM}}>
                {authMode==='login'?'Not a member yet? ':'Already have an account? '}
                <button onClick={()=>{setAuthMode(authMode==='login'?'signup':'login');setErr('')}} style={{background:'none',border:'none',color:L.acc,fontWeight:600,cursor:'pointer',fontSize:14,fontFamily:L.f}}>
                  {authMode==='login'?'Apply for Membership':'Sign In'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer biz={biz} desk={desk}/>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // HOME (Figma: 2:849 form needed / 2:674 form complete)
  // ═══════════════════════════════════════════════════════════════
  if(view==='home') {
    const qa=[
      {icon:'cal',label:'Book Visit',sub:'Schedule appointment',action:()=>window.open(`/${slug}`,'_blank'),show:true},
      {icon:'form',label:hasForm?'View Form':'Fill Form',sub:hasForm?'Review details':'Complete paperwork',action:()=>{setStep(0);setView('form')},show:isSalon},
      {icon:'user',label:'My Profile',sub:'History & settings',action:()=>{},show:true},
      {icon:'msg',label:'Message Us',sub:'Talk to experts',action:()=>{},show:true},
    ].filter(a=>a.show)
    const tabs=[{icon:'home',label:'Home',id:'home'},{icon:'cal',label:'Bookings',id:'bookings'},{icon:'msg',label:'Messages',id:'messages'},{icon:'user',label:'Profile',id:'profile'}]

    return (
      <div style={{display:'flex',minHeight:'100vh',background:L.bg,fontFamily:L.f}}>
        <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
        {/* SIDEBAR (desktop) */}
        <ClientSidebar biz={biz} user={user} activeTab={activeTab} onNav={setActiveTab} desk={desk} onLogout={logout}/>

        {/* MAIN CONTENT */}
        <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
          {/* Top bar (simpler — sidebar handles main nav) */}
          <div style={{background:L.card,borderBottom:`1px solid ${L.bdr}`,padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <div/>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <button style={{width:40,height:40,borderRadius:24,background:L.bg,border:`1px solid ${L.bdr}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative'}}>
                {I.bell(L.txtM)}<div style={{position:'absolute',top:8,right:8,width:8,height:8,borderRadius:99,background:L.acc}}/>
              </button>
              <button style={{background:L.acc,border:'none',borderRadius:24,padding:'8px 20px',cursor:'pointer'}}>
                <span style={{fontSize:14,fontWeight:700,color:'#fff'}}>Hi {(user?.name||'').split(' ')[0]}</span>
              </button>
              <div style={{width:40,height:40,borderRadius:99,border:`2px solid ${L.acc}`,background:L.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:L.acc}}>{(user?.name||'?').charAt(0)}</div>
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{flex:1,overflowY:'auto'}}>
            <div style={{maxWidth:1100,margin:'0 auto',padding:desk?'32px 32px 40px':'16px'}}>

          {/* Welcome heading (Figma 2:674) */}
          {hasForm&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
            <div>
              <h1 style={{fontSize:desk?36:24,fontWeight:700,color:L.h,margin:0}}>Welcome back, {(user?.name||'').split(' ')[0]}!</h1>
              <p style={{fontSize:16,color:L.txtM,margin:'4px 0 0'}}>Your skin health journey is progressing perfectly.</p>
            </div>
            {desk&&<button onClick={()=>window.open(`/${slug}`,'_blank')} style={{padding:'12px 28px',borderRadius:16,border:`1px solid ${L.bdr}`,background:L.card,fontSize:14,fontWeight:600,color:L.h,cursor:'pointer',fontFamily:L.f}}>Book Appointment</button>}
          </div>}

          {/* Alert card (Figma: 2:882 / 2:723) */}
          {isSalon&&(
            <div style={{background:hasForm?'rgba(34,197,94,0.04)':'rgba(200,163,76,0.06)',border:hasForm?'2px solid rgba(34,197,94,0.25)':'2px solid rgba(200,163,76,0.3)',borderRadius:24,padding:26,marginBottom:32,display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:32,boxShadow:'0 10px 15px -3px rgba(0,0,0,0.04)'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  {hasForm?I.shield(L.ok,16):I.warn(L.acc,16)}
                  <span style={{fontSize:14,fontWeight:700,color:hasForm?L.ok:L.acc,textTransform:'uppercase',letterSpacing:'0.7px'}}>{hasForm?'Status: Complete':'Action Required'}</span>
                </div>
                <h3 style={{fontSize:24,fontWeight:700,color:L.h,margin:'0 0 8px'}}>{hasForm?'Consultation Form Complete':'Consultation Form Needed'}</h3>
                <p style={{fontSize:16,color:L.txtM,margin:0,lineHeight:'24px',maxWidth:600}}>
                  {hasForm?'Thank you for providing your details. Our clinical experts have finished reviewing your profile and your personalized treatment plan is ready.'
                  :'Please complete your comprehensive skin assessment form before your next visit to ensure the best results.'}
                </p>
                <div style={{display:'flex',gap:12,marginTop:16}}>
                  <button onClick={()=>{setStep(0);setView('form')}} style={{padding:'12px 24px',borderRadius:16,border:'none',background:L.acc,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:L.f}}>{hasForm?'View Form':'Fill Form Now'}</button>
                  {hasForm&&<button style={{padding:'12px 24px',borderRadius:16,border:`1px solid ${L.acc}40`,background:'transparent',color:L.acc,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:L.f}}>Download PDF</button>}
                </div>
              </div>
              {desk&&<div style={{width:300,height:180,borderRadius:24,background:'linear-gradient(135deg,#E2E8F0,#F1F5F9)',border:`1px solid ${hasForm?'rgba(34,197,94,0.15)':'rgba(200,163,76,0.15)'}`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>{I.form(L.bdr2,48)}</div>}
            </div>
          )}

          {/* Two-column layout */}
          <div style={desk?{display:'flex',gap:32,alignItems:'flex-start'}:{}}>
            <div style={{flex:1,minWidth:0}}>
              {/* Quick Actions (Figma: 2:900) */}
              <h3 style={{fontSize:22,fontWeight:700,color:L.h,margin:'0 0 16px'}}>Quick Actions</h3>
              <div style={{display:'grid',gridTemplateColumns:desk?`repeat(${qa.length},1fr)`:'1fr 1fr',gap:16,marginBottom:32}}>
                {qa.map((a,i)=>(
                  <button key={i} onClick={a.action} style={{background:L.card,border:`1px solid ${L.bdr}`,borderRadius:24,padding:17,cursor:'pointer',textAlign:'left',transition:'border-color 0.2s',boxShadow:'0 1px 2px rgba(0,0,0,0.04)'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=L.acc+'60'} onMouseLeave={e=>e.currentTarget.style.borderColor=L.bdr}>
                    <div style={{width:48,height:48,borderRadius:16,background:'rgba(200,163,76,0.08)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>{I[a.icon](L.acc,20)}</div>
                    <p style={{fontSize:14,fontWeight:700,color:L.h,margin:0}}>{a.label}</p>
                    <p style={{fontSize:12,color:L.txtM,margin:'2px 0 0'}}>{a.sub}</p>
                  </button>
                ))}
              </div>

              {/* Upcoming (Figma: 2:940) */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <h3 style={{fontSize:22,fontWeight:700,color:L.h,margin:0}}>Upcoming Bookings</h3>
                {upcoming.length>0&&<button style={{background:'none',border:'none',color:L.acc,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:L.f}}>View All</button>}
              </div>
              {upcoming.length>0?upcoming.map((b,i)=>(
                <div key={i} style={{background:L.card,border:`1px solid ${L.bdr}`,borderRadius:24,padding:21,marginBottom:12,boxShadow:'0 1px 2px rgba(0,0,0,0.04)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',gap:20,alignItems:'center'}}>
                    <div style={{width:64,height:64,borderRadius:24,background:L.bg,border:`1px solid ${L.bdr}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{fontSize:12,fontWeight:700,color:L.txtM,textTransform:'uppercase'}}>{b.month||'TBC'}</span>
                      <span style={{fontSize:20,fontWeight:700,color:L.h,lineHeight:1}}>{b.day||'—'}</span>
                    </div>
                    <div>
                      <p style={{fontSize:18,fontWeight:700,color:L.h,margin:0}}>{b.service}</p>
                      <div style={{display:'flex',gap:16,marginTop:4}}>
                        <span style={{display:'flex',alignItems:'center',gap:4,fontSize:14,color:L.txtM}}>{I.clock(L.txtM,13)} {b.time}</span>
                        {b.staff&&<span style={{display:'flex',alignItems:'center',gap:4,fontSize:14,color:L.txtM}}>{I.user(L.txtM,11)} {b.staff}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8}}>
                    <span style={{padding:'5px 13px',borderRadius:99,fontSize:12,fontWeight:700,background:hasForm?'rgba(16,185,129,0.08)':'rgba(245,158,11,0.08)',color:hasForm?'#10B981':'#F59E0B',border:`1px solid ${hasForm?'rgba(16,185,129,0.2)':'rgba(245,158,11,0.2)'}`}}>{hasForm?'All set':'Form needed'}</span>
                    <button style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',flexDirection:'column',gap:2}}><div style={{width:4,height:4,borderRadius:2,background:L.txtL}}/><div style={{width:4,height:4,borderRadius:2,background:L.txtL}}/><div style={{width:4,height:4,borderRadius:2,background:L.txtL}}/></button>
                  </div>
                </div>
              )):(
                <div style={{background:L.card,border:`1px solid ${L.bdr}`,borderRadius:24,padding:40,textAlign:'center'}}>
                  <div style={{width:56,height:56,borderRadius:16,background:'rgba(200,163,76,0.08)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>{I.cal(L.acc,24)}</div>
                  <p style={{fontSize:14,fontWeight:600,color:L.h}}>No upcoming appointments</p>
                  <p style={{fontSize:14,color:L.txtM,margin:'4px 0 16px'}}>Book your first treatment to get started</p>
                  <button onClick={()=>window.open(`/${slug}`,'_blank')} style={{padding:'10px 24px',borderRadius:16,border:'none',background:L.acc,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:L.f}}>Book Appointment</button>
                </div>
              )}

              {/* Treatment History (Figma: 2:794) */}
              {myData?.past_bookings?.length>0&&(
                <div style={{marginTop:24}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <h3 style={{fontSize:22,fontWeight:700,color:L.h,margin:0}}>Treatment History</h3>
                    <button style={{background:'none',border:'none',color:L.acc,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:L.f}}>View All</button>
                  </div>
                  {myData.past_bookings.slice(0,5).map((b,i)=>(
                    <div key={i} style={{background:L.card,border:`1px solid ${L.bdr}`,borderRadius:24,padding:'17px 21px',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div style={{display:'flex',gap:16,alignItems:'center'}}>
                        <div style={{width:48,height:48,borderRadius:16,background:L.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{I.shield(L.txtL,20)}</div>
                        <div>
                          <p style={{fontSize:15,fontWeight:600,color:L.h,margin:0}}>{b.service}</p>
                          <p style={{fontSize:13,color:L.txtM,margin:'2px 0 0'}}>{b.staff?`${b.staff} · `:''}{ b.date}</p>
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <span style={{fontSize:12,fontWeight:700,color:L.ok,textTransform:'uppercase'}}>Completed</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right sidebar (Figma: 2:1001) — desktop */}
            {desk&&(
              <div style={{width:363,flexShrink:0,display:'flex',flexDirection:'column',gap:24}}>
                {/* Membership (Figma: 2:1002) */}
                <div style={{background:L.card,border:`1px solid ${L.bdr}`,borderRadius:24,padding:25,position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',top:-16,right:-16,width:96,height:96,borderRadius:99,background:'rgba(200,163,76,0.12)',filter:'blur(32px)',pointerEvents:'none'}}/>
                  <div style={{position:'relative'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                      <div style={{width:48,height:48,borderRadius:99,border:`2px solid ${L.acc}`,background:L.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,color:L.acc}}>{(user?.name||'?').charAt(0)}</div>
                      <div><p style={{fontSize:16,fontWeight:700,color:L.h,margin:0}}>{(user?.name||'').split(' ')[0]}</p><p style={{fontSize:14,fontWeight:500,color:L.acc,margin:0}}>Premium Member</p></div>
                    </div>
                    <div style={{height:1,background:L.bdr,marginBottom:16}}/>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div><p style={{fontSize:12,fontWeight:700,color:L.txtM,textTransform:'uppercase',letterSpacing:'-0.3px',margin:0}}>Reward Points</p><p style={{fontSize:24,fontWeight:700,color:L.h,margin:'2px 0 0'}}>2,450</p></div>
                      <button style={{background:'rgba(200,163,76,0.08)',border:'1px solid rgba(200,163,76,0.2)',borderRadius:16,padding:'7px 17px',cursor:'pointer'}}><span style={{fontSize:12,fontWeight:700,color:L.acc}}>Redeem</span></button>
                    </div>
                  </div>
                </div>
                {/* Skin Tip (Figma: 2:1021) */}
                <div style={{background:L.card,border:`1px solid ${L.bdr}`,borderRadius:24,padding:25}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>{I.shield(L.acc,16)}<p style={{fontSize:16,fontWeight:700,color:L.h,margin:0}}>Skin Tip of the Week</p></div>
                  <div style={{width:'100%',aspectRatio:'16/9',borderRadius:16,background:'linear-gradient(135deg,#E2E8F0,#CBD5E1)',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'center'}}>{I.shield(L.bdr2,32)}</div>
                  <p style={{fontSize:14,color:L.txtM,lineHeight:'20px',margin:'0 0 12px'}}>"Consistency is key! Hydrate daily and never skip your SPF, even on cloudy days."</p>
                  <button style={{width:'100%',padding:'9px 0',borderRadius:16,border:`1px solid ${L.bdr}`,background:'transparent',cursor:'pointer'}}><span style={{fontSize:12,fontWeight:700,color:L.txtM}}>More Tips</span></button>
                </div>
              </div>
            )}
          </div>
        </div>

            </div>{/* close maxWidth */}
          </div>{/* close scrollable */}
          {desk&&<Footer biz={biz} desk={desk}/>}
        </div>{/* close main content column */}

        {/* Mobile bottom nav */}
        {!desk&&<div style={{position:'fixed',bottom:0,left:0,right:0,background:L.card,borderTop:`1px solid ${L.bdr}`,padding:'8px 0 12px',zIndex:30,display:'flex',justifyContent:'space-around'}}>
          {tabs.map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} style={{background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'4px 8px'}}>{I[t.icon](activeTab===t.id?L.acc:L.txtL,20)}<span style={{fontSize:10,fontWeight:activeTab===t.id?700:500,color:activeTab===t.id?L.acc:L.txtL}}>{t.label}</span></button>)}
        </div>}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // SUBMITTED
  // ═══════════════════════════════════════════════════════════════
  if(view==='submitted') return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,background:L.bg,fontFamily:L.f}}>
      <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{background:L.card,border:`1px solid ${L.bdr}`,borderRadius:24,maxWidth:480,width:'100%',textAlign:'center',padding:40,boxShadow:'0 10px 40px rgba(0,0,0,0.06)'}}>
        <div style={{width:64,height:64,borderRadius:99,background:'rgba(34,197,94,0.08)',border:'2px solid rgba(34,197,94,0.2)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px'}}>{I.chk(L.ok,28)}</div>
        <h2 style={{fontSize:24,fontWeight:700,color:L.h,marginBottom:8}}>Form Submitted</h2>
        <p style={{fontSize:16,color:L.txtM,marginBottom:24}}>Thank you, {fd.fullName}. Your consultation form has been received by {biz?.name}.</p>
        {(alerts.blocks.length>0||alerts.flags.length>0)&&<div style={{textAlign:'left',marginBottom:24}}><Alerts blocks={alerts.blocks} flags={alerts.flags}/></div>}
        <p style={{fontSize:14,color:L.txtL,marginBottom:24}}>Your therapist will review before your appointment.</p>
        <button onClick={()=>setView('home')} style={{width:'100%',padding:'16px 0',borderRadius:16,border:'none',background:L.acc,color:'#fff',fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:L.f}}>Back to Home</button>
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // CONSULTATION FORM — all 6 steps (Figma: 2:2, 2:206, 2:381, 2:540)
  // ═══════════════════════════════════════════════════════════════
  if(view==='form') return (
    <div style={{minHeight:'100vh',background:L.bg,fontFamily:L.f}}>
      <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div ref={topRef}/>

      {/* Header (same as other pages) */}
      <Header biz={biz} desk={desk}>
        {desk&&['Home','Treatments','Shop','Contact'].map(l=><button key={l} style={{background:'none',border:'none',fontSize:14,fontWeight:500,color:L.txtM,cursor:'pointer',fontFamily:L.f}}>{l}</button>)}
        <div style={{width:40,height:40,borderRadius:99,background:L.bg,border:`1px solid ${L.bdr}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:L.acc}}>{(user?.name||'?').charAt(0)}</div>
      </Header>

      {/* Progress bar (Figma: sub-header with STEP X OF Y + bar) */}
      <ProgressBar step={step} total={6} title={STEPS[step]} desk={desk}/>

      {/* Form content */}
      <div style={{maxWidth:800,margin:'0 auto',padding:desk?'40px 24px 0':'20px 16px 0'}}>

        {/* Step 0: Personal (Figma structure) */}
        {step===0&&(<div>
          <h2 style={{fontSize:desk?36:24,fontWeight:700,color:L.h,margin:'0 0 8px'}}>Personal Details</h2>
          <p style={{fontSize:16,color:L.txtM,margin:'0 0 32px',lineHeight:'26px'}}>Used for your treatment records and emergency contact information.</p>
          <Field label="Full Name" icon={I.user(L.txtL,14)} name="fullName" value={fd.fullName} onChange={set} placeholder="Your full name"/>
          <div style={{display:'grid',gridTemplateColumns:desk?'1fr 1fr':'1fr',gap:16}}>
            <Field label="Date of Birth" type="date" name="dob" value={fd.dob} onChange={set}/>
            <Field label="Address" name="address" value={fd.address} onChange={set} placeholder="Full address"/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <Field label="Mobile" icon={I.phone(L.txtL,14)} type="tel" name="mobile" value={fd.mobile} onChange={set} placeholder="07..."/>
            <Field label="Email" icon={I.mail(L.txtL,14)} type="email" name="email" value={fd.email} onChange={set} placeholder="you@email.com"/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <Field label="Emergency Contact" name="emergencyName" value={fd.emergencyName} onChange={set} placeholder="Contact name"/>
            <Field label="Their Number" type="tel" name="emergencyPhone" value={fd.emergencyPhone} onChange={set} placeholder="07..."/>
          </div>
          <Field label="GP Name" name="gpName" value={fd.gpName} onChange={set} placeholder="Dr..."/>
          <Field label="GP Surgery (optional)" name="gpAddress" value={fd.gpAddress} onChange={set} placeholder="Surgery name and address"/>
          <div style={{marginBottom:20}}>
            <label style={{display:'block',fontSize:14,fontWeight:600,color:L.h,marginBottom:6}}>How did you hear about us?</label>
            <select value={fd.referral||''} onChange={e=>set('referral',e.target.value)} style={{width:'100%',padding:'14px 17px',borderRadius:16,border:`1px solid ${L.bdr}`,fontSize:14,background:L.bg,color:L.h,boxSizing:'border-box',fontFamily:L.f}}>
              <option value="">Select...</option>
              {['Instagram','TikTok','Google','Friend / Referral','Returning Client','Other'].map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{background:L.card,borderRadius:24,padding:24,border:`1px solid ${L.bdr}`}}>
            <p style={{fontSize:16,fontWeight:700,color:L.acc,margin:'0 0 12px'}}>Photo Consent</p>
            <Consent label="Treatment records" sub="Clinical use only — for monitoring your treatment progress." checked={fd.photoRecords} onChange={()=>set('photoRecords',!fd.photoRecords)}/>
            <Consent label="Training purposes" sub="Used for educational training of our clinical team." checked={fd.photoTraining} onChange={()=>set('photoTraining',!fd.photoTraining)}/>
            <Consent label="Marketing & social media" sub="May be shared on our social channels (anonymised)." checked={fd.photoMarketing} onChange={()=>set('photoMarketing',!fd.photoMarketing)}/>
          </div>
        </div>)}

        {/* Step 1: Medical (Figma: 2:2) */}
        {step===1&&(<div>
          <h2 style={{fontSize:desk?36:24,fontWeight:700,color:L.h,margin:'0 0 8px'}}>General Health Questionnaire</h2>
          <p style={{fontSize:16,color:L.txtM,margin:'0 0 32px',lineHeight:'26px'}}>Your safety is our priority. Please provide accurate details regarding your medical history.</p>
          <QCard label="Pregnant, breastfeeding, or trying to conceive?" sub="Some treatments are not suitable during pregnancy." name="pregnant" value={fd.pregnant} onChange={set}/>
          <QCard label="Do you have a heart pacemaker?" sub="Electronic implants can interfere with certain aesthetic technologies." name="pacemaker" value={fd.pacemaker} onChange={set}/>
          <QCard label="Heart condition or high blood pressure?" name="heartCondition" value={fd.heartCondition} onChange={set} detail detailLabel="Controlled or uncontrolled?" detailValue={fd.heartConditionDetail} onDetailChange={set}/>
          <QCard label="Metal implants, plates, or screws?" name="metalImplants" value={fd.metalImplants} onChange={set} detail detailLabel="Location of implants" detailValue={fd.metalImplantsDetail} onDetailChange={set}/>
          <QCard label="Diabetes?" sub="May affect wound healing and treatment safety." name="diabetes" value={fd.diabetes} onChange={set} detail detailLabel="Type 1/2? Controlled?" detailValue={fd.diabetesDetail} onDetailChange={set}/>
          <QCard label="History of epilepsy or seizures?" sub="Light-based therapies may require specific precautions." name="epilepsy" value={fd.epilepsy} onChange={set}/>
          <QCard label="Autoimmune disorders?" sub="Conditions like Lupus or Scleroderma may affect healing." name="autoimmune" value={fd.autoimmune} onChange={set} detail detailLabel="Please specify condition" detailValue={fd.autoimmuneDetail} onDetailChange={set}/>
          <QCard label="Blood clotting disorder?" name="bloodClotting" value={fd.bloodClotting} onChange={set}/>
          <QCard label="Cancer history?" name="activeCancer" value={fd.activeCancer} onChange={set} detail detailLabel="Type, when diagnosed, current status" detailValue={fd.activeCancerDetail} onDetailChange={set}/>
          <QCard label="HIV/AIDS or hepatitis?" name="hivHepatitis" value={fd.hivHepatitis} onChange={set}/>
          <QCard label="Liver or kidney disease?" name="liverKidney" value={fd.liverKidney} onChange={set}/>
          <QCard label="History of cold sores (herpes simplex)?" name="herpes" value={fd.herpes} onChange={set}/>
          <QCard label="History of keloid or raised scarring?" name="keloid" value={fd.keloid} onChange={set}/>
          <Alerts blocks={alerts.blocks} flags={alerts.flags}/>
        </div>)}

        {/* Step 2: Medications (Figma: 2:206) */}
        {step===2&&(<div>
          <h2 style={{fontSize:desk?36:24,fontWeight:700,color:L.h,margin:'0 0 8px'}}>Medication History</h2>
          <p style={{fontSize:16,color:L.txtM,margin:'0 0 8px',lineHeight:'26px',fontStyle:'italic'}}>"Your safety is our priority. Please be as detailed as possible."</p>
          <div style={{height:1,background:L.bdr,margin:'16px 0 32px'}}/>
          <QCard label="Roaccutane / Accutane" sub="Have you taken Roaccutane or any Isotretinoin medication in the last 6 months?" name="roaccutane" value={fd.roaccutane} onChange={set} detail detailLabel="Please specify your dosage and the exact date you stopped the treatment..." detailValue={fd.roaccutaneDetail} onDetailChange={set}/>
          <QCard label="Blood Thinning Medication" sub="Are you currently taking any blood thinners (e.g., Warfarin, Aspirin, Clopidogrel)?" name="bloodThinners" value={fd.bloodThinners} onChange={set} detail detailLabel="Which medication?" detailValue={fd.bloodThinnersDetail} onDetailChange={set}/>
          <QCard label="Medication Allergies" sub="Do you have any known allergies to medications, specifically antibiotics or topical creams?" name="photosensitising" value={fd.photosensitising} onChange={set} detail detailLabel="Which medications?" detailValue={fd.photosensitivesDetail} onDetailChange={set}/>
          <QCard label="Topical retinoids?" sub="Retin-A, Tretinoin, Differin, Epiduo — used in last 7 days?" name="retinoids" value={fd.retinoids} onChange={set} detail detailLabel="Product and last used date" detailValue={fd.retinoidsDetail} onDetailChange={set}/>
          <QCard label="Steroids (oral or topical)?" name="steroids" value={fd.steroids} onChange={set} detail detailLabel="Which?" detailValue={fd.steroidsDetail} onDetailChange={set}/>
          <QCard label="Immunosuppressants?" name="immunosuppressants" value={fd.immunosuppressants} onChange={set}/>
          <QCard label="Herbal supplements?" sub="Garlic, ginkgo, fish oils affect bleeding risk." name="herbalSupps" value={fd.herbalSupps} onChange={set} detail detailLabel="Which supplements?" detailValue={fd.herbalSuppsDetail} onDetailChange={set}/>
          <QCard label="Fish or salmon allergy?" sub="Important for polynucleotide treatments (salmon DNA derived)." name="fishAllergy" value={fd.fishAllergy} onChange={set}/>
          <Alerts blocks={alerts.blocks} flags={alerts.flags}/>
        </div>)}

        {/* Step 3: Skin History (Figma: 2:381) */}
        {step===3&&(<div>
          <h2 style={{fontSize:desk?36:24,fontWeight:700,color:L.h,margin:'0 0 8px'}}>Skin History</h2>
          <p style={{fontSize:16,color:L.txtM,margin:'0 0 32px',lineHeight:'26px'}}>Tell us about your natural skin type and specific concerns to help us personalize your treatment plan.</p>

          {/* Fitzpatrick (Figma: 2:421) */}
          <div style={{marginBottom:32}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>{I.shield(L.acc,18)}<p style={{fontSize:18,fontWeight:700,color:L.h,margin:0}}>Fitzpatrick Skin Type</p></div>
            <p style={{fontSize:14,color:L.txtM,margin:'0 0 16px'}}>Select the tone that most closely matches your natural reaction to sun exposure.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:desk?16:8}}>
              {[{v:'I',bg:'#FDEBD0',x:'Always Burns'},{v:'II',bg:'#F5CBA7',x:'Usually Burns'},{v:'III',bg:'#E0B88A',x:'Sometimes Burns'},{v:'IV',bg:'#C4956A',x:'Rarely Burns'},{v:'V',bg:'#8B6914',x:'Very Rarely'},{v:'VI',bg:'#5C4033',x:'Never Burns'}].map(t=>(
                <button key={t.v} type="button" onClick={()=>set('fitzpatrick',t.v)}
                  style={{padding:desk?16:8,borderRadius:16,border:fd.fitzpatrick===t.v?`2px solid ${L.acc}`:`2px solid ${L.bdr}`,background:L.card,cursor:'pointer',textAlign:'center',transition:'all 0.2s'}}>
                  <div style={{width:desk?64:40,height:desk?64:40,borderRadius:99,margin:'0 auto 8px',background:t.bg,border:fd.fitzpatrick===t.v?`3px solid ${L.acc}`:'3px solid transparent'}}/>
                  <p style={{fontSize:desk?14:11,fontWeight:700,color:L.h,margin:0}}>Type {t.v}</p>
                  <p style={{fontSize:desk?11:9,color:L.txtM,margin:'2px 0 0',textTransform:'uppercase'}}>{t.x}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Skin Concerns (Figma: 2:479) */}
          <div style={{marginBottom:32}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>{I.warn(L.acc,18)}<p style={{fontSize:18,fontWeight:700,color:L.h,margin:0}}>Main Skin Concerns</p></div>
            <p style={{fontSize:14,color:L.txtM,margin:'0 0 16px'}}>Select all that apply to you. We'll prioritize these in your routine.</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
              {['Acne & Breakouts','Scarring','Hyperpigmentation','Fine Lines & Wrinkles','Rosacea & Redness','Dryness & Flaking','Oiliness','Large Pores','Sun Damage','Texture & Dullness'].map(c=>(
                <button key={c} type="button" onClick={()=>{const x=fd.concerns||[];set('concerns',x.includes(c)?x.filter(z=>z!==c):[...x,c])}}
                  style={{padding:'10px 25px',borderRadius:99,fontSize:14,fontWeight:600,border:(fd.concerns||[]).includes(c)?`2px solid ${L.acc}`:`2px solid ${L.bdr}`,background:(fd.concerns||[]).includes(c)?'rgba(200,163,76,0.08)':L.card,color:(fd.concerns||[]).includes(c)?L.acc:L.txtM,cursor:'pointer'}}>{c}</button>
              ))}
            </div>
          </div>

          {/* Additional Details (Figma: 2:509) */}
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>{I.form(L.acc,18)}<p style={{fontSize:18,fontWeight:700,color:L.h,margin:0}}>Additional Details</p></div>
            <textarea placeholder="Tell us anything else about your skin history (e.g. allergies, previous treatments, current products)..." value={fd.skinNotes||''} onChange={e=>set('skinNotes',e.target.value)}
              style={{width:'100%',minHeight:120,padding:17,borderRadius:16,border:`1px solid ${L.bdr}`,fontSize:14,outline:'none',background:L.bg,color:L.h,boxSizing:'border-box',fontFamily:L.f,resize:'vertical'}}/>
          </div>

          <QCard label="Active skin infection?" name="skinInfection" value={fd.skinInfection} onChange={set}/>
          <QCard label="Tattoos or permanent makeup in treatment area?" name="tattoos" value={fd.tattoos} onChange={set}/>
          <QCard label="Previous adverse reactions to skin treatments?" name="adverseReactions" value={fd.adverseReactions} onChange={set} detail detailLabel="What happened?" detailValue={fd.adverseReactionsDetail} onDetailChange={set}/>
          <Alerts blocks={alerts.blocks} flags={alerts.flags}/>
        </div>)}

        {/* Step 4: Lifestyle */}
        {step===4&&(<div>
          <h2 style={{fontSize:desk?36:24,fontWeight:700,color:L.h,margin:'0 0 8px'}}>Lifestyle</h2>
          <p style={{fontSize:16,color:L.txtM,margin:'0 0 32px',lineHeight:'26px'}}>Sun exposure and lifestyle factors affect treatment safety and results.</p>
          <QCard label="Significant sun exposure in the last 2 weeks?" sub="Including sunburn, prolonged outdoor activity." name="sunburn" value={fd.sunburn} onChange={set}/>
          <QCard label="Sunbed use in the last 4 weeks?" name="sunbed" value={fd.sunbed} onChange={set}/>
          <QCard label="Currently have a tan (natural or self-tan)?" name="tan" value={fd.tan} onChange={set}/>
          <QCard label="Planned sun exposure in the next 4 weeks?" sub="Holiday, outdoor event, etc." name="plannedSun" value={fd.plannedSun} onChange={set}/>
          <QCard label="Do you smoke?" sub="Smoking can affect wound healing and treatment outcomes." name="smoker" value={fd.smoker} onChange={set}/>
          <Alerts blocks={alerts.blocks} flags={alerts.flags}/>
        </div>)}

        {/* Step 5: Consent & Signature (Figma: 2:540) */}
        {step===5&&(<div>
          <h2 style={{fontSize:desk?36:24,fontWeight:700,color:L.h,margin:'0 0 8px'}}>Legal Consent & Signature</h2>
          <p style={{fontSize:16,color:L.txtM,margin:'0 0 32px',lineHeight:'26px'}}>Please carefully review the following terms and conditions regarding your skin treatment and provide your digital signature below to proceed.</p>
          {alerts.blocks.length>0&&<Alerts blocks={alerts.blocks} flags={alerts.flags}/>}

          {/* Terms of Service card (Figma: 2:571) */}
          <div style={{background:L.card,border:`1px solid ${L.bdr}`,borderRadius:24,padding:33,marginBottom:32}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>{I.shield(L.acc,18)}<p style={{fontSize:20,fontWeight:700,color:L.h,margin:0}}>Terms of Service</p></div>
            <Consent label="Information Accuracy" sub="I confirm that all the information provided in the previous steps is accurate and complete to the best of my knowledge." checked={fd.consent1} onChange={()=>set('consent1',!fd.consent1)}/>
            <Consent label="Medical Disclosure" sub="I have disclosed all known allergies, medical conditions, and medications I am currently taking. I understand that withholding information may lead to adverse reactions." checked={fd.consent2} onChange={()=>set('consent2',!fd.consent2)}/>
            <Consent label="Treatment Consent" sub="I authorize Rejuvenate Skin Experts to perform the recommended cosmetic procedures. I understand that results may vary and are not guaranteed." checked={fd.consent3} onChange={()=>set('consent3',!fd.consent3)}/>
            <Consent label="Privacy Policy" sub="I agree to the privacy policy and consent to the storage of my personal and medical data for the purpose of treatment and follow-up." checked={fd.consent4} onChange={()=>set('consent4',!fd.consent4)}/>
          </div>

          {/* Signature pad (Figma: 2:610) */}
          <SigPad onSign={s=>set('signed',s)}/>

          <p style={{fontSize:14,color:L.txtM,marginTop:24,textAlign:'center'}}>Need help? Contact our support at <span style={{color:L.acc,fontWeight:600}}>support@rejuvenate.com</span></p>
        </div>)}
      </div>

      {/* Form navigation buttons (Figma: bottom buttons) */}
      <FormNav step={step} canProceed={canProceed()} onBack={()=>goStep(step-1)} onNext={()=>canProceed()&&goStep(step+1)} onSubmit={step===5?submitForm:undefined} loading={loading} desk={desk}/>

      {/* Form footer */}
      <div style={{borderTop:`1px solid ${L.bdr}`,padding:'20px 24px',textAlign:'center'}}>
        <div style={{maxWidth:800,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>{I.lock(L.txtL,14)}<span style={{fontSize:13,fontWeight:600,color:L.txtL,textTransform:'uppercase',letterSpacing:'0.5px'}}>Secure HIPAA Compliant Form</span></div>
          <div style={{display:'flex',gap:16}}>{['Privacy Policy','Terms of Service','Help Center'].map(l=><button key={l} style={{background:'none',border:'none',fontSize:13,color:L.txtL,cursor:'pointer',fontFamily:L.f}}>{l}</button>)}</div>
        </div>
      </div>
    </div>
  )

  return null
}
