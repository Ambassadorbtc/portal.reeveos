import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
const API='/api'
const IMG={login:'/portal-assets/hero-login.png',appt:'/portal-assets/appointment-card.png',hero:'/portal-assets/consultation-hero.png',form:'/portal-assets/form-complete.jpg'}
const apiFetch=async(path,opts={})=>{const token=sessionStorage.getItem('client_token');const headers={'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})};const res=await fetch(`${API}${path}`,{...opts,headers});if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.detail||`HTTP ${res.status}`)}return res.json()}
const DC={pregnant:{microneedling:'BLOCK',peel:'BLOCK',rf:'BLOCK',polynucleotides:'BLOCK',lymphatic:'FLAG'},pacemaker:{rf:'BLOCK',microneedling:'FLAG'},metalImplants:{rf:'BLOCK'},bloodClotting:{microneedling:'BLOCK',peel:'FLAG',rf:'FLAG',polynucleotides:'FLAG'},activeCancer:{microneedling:'BLOCK',peel:'BLOCK',rf:'BLOCK',polynucleotides:'BLOCK',lymphatic:'BLOCK'},keloid:{microneedling:'BLOCK',rf:'FLAG',peel:'FLAG',polynucleotides:'FLAG'},skinInfection:{microneedling:'BLOCK',peel:'BLOCK',rf:'BLOCK',polynucleotides:'BLOCK',lymphatic:'BLOCK'},autoimmune:{microneedling:'BLOCK',peel:'FLAG',rf:'FLAG',polynucleotides:'FLAG'},epilepsy:{microneedling:'FLAG',peel:'FLAG',rf:'FLAG',polynucleotides:'FLAG',lymphatic:'FLAG'},herpes:{microneedling:'FLAG',peel:'FLAG'},roaccutane:{microneedling:'BLOCK',peel:'BLOCK',rf:'BLOCK',polynucleotides:'FLAG'},bloodThinners:{microneedling:'BLOCK',rf:'FLAG',polynucleotides:'FLAG'},retinoids:{peel:'BLOCK',microneedling:'FLAG'},photosensitising:{peel:'BLOCK',microneedling:'FLAG'},immunosuppressants:{microneedling:'BLOCK',peel:'FLAG',rf:'FLAG',polynucleotides:'FLAG'},sunburn:{microneedling:'BLOCK',peel:'BLOCK',rf:'BLOCK',polynucleotides:'FLAG'},sunbed:{peel:'BLOCK',microneedling:'FLAG',rf:'FLAG'},fishAllergy:{polynucleotides:'BLOCK'},fillersRecent:{rf:'BLOCK',polynucleotides:'FLAG'}}
const TL={microneedling:'Microneedling',peel:'Chemical Peels',rf:'RF Needling',polynucleotides:'Polynucleotides',lymphatic:'Lymphatic Lift'}
function getAlerts(d){const blocks=[],flags=[];Object.entries(DC).forEach(([k,txs])=>{if(d[k]==='yes')Object.entries(txs).forEach(([tx,lv])=>{const e={condition:k,treatment:TL[tx]||tx};lv==='BLOCK'?blocks.push(e):flags.push(e)})});return{blocks,flags}}

const I={
  cal:(c='currentColor',s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  form:(c='currentColor',s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
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
  gear:(c='currentColor',s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
}

const $={bg:'#F4F5F7',card:'#FFFFFF',bdr:'#E5E7EB',bdr2:'#D1D5DB',h:'#111111',txt:'#374151',txtM:'#6B7280',txtL:'#9CA3AF',acc:'#C9A84C',ok:'#22C55E',err:'#EF4444',wrn:'#F59E0B',f:"'Figtree',-apple-system,sans-serif"}
const STEPS=['Personal','Medical','Medications','Skin','Lifestyle','Consent']
const GCSS=<style>{`
.client-sidebar{display:flex}
.client-mobnav{display:flex}
@media screen and (max-width:767px){.client-sidebar{display:none!important;width:0!important;min-width:0!important;overflow:hidden!important;visibility:hidden!important;position:absolute!important;left:-99999px!important}}
@media screen and (min-width:768px){.client-mobnav{display:none!important}}
@keyframes spin{to{transform:rotate(360deg)}}
`}</style>
const FONT=<><link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>{GCSS}</>

// ═══ REUSABLE COMPONENTS ═══
const Toggle=({value,onChange,d})=>{const on=value==='yes';const w=d?48:56,h=d?26:32,k=d?20:26;return <button type="button" onClick={()=>onChange(on?'no':'yes')} style={{width:w,height:h,borderRadius:h/2,background:on?$.acc:$.bdr,border:'none',cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}><div style={{width:k,height:k,borderRadius:k/2,background:'#fff',position:'absolute',top:(h-k)/2,left:on?w-k-(h-k)/2:(h-k)/2,transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/></button>}

const Q=({label,sub,name,value,onChange,detail,dLabel,dVal,dChange,d})=>(
  <div style={{background:$.card,border:`1px solid ${value==='yes'?$.acc+'50':$.bdr}`,borderRadius:d?12:16,padding:d?'12px 16px':'16px 20px',marginBottom:d?10:14}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
      <div style={{flex:1}}><p style={{fontSize:d?13:16,fontWeight:600,color:$.h,margin:0,lineHeight:1.4}}>{label}</p>{sub&&<p style={{fontSize:d?12:14,color:$.txtM,margin:d?'2px 0 0':'4px 0 0',lineHeight:1.5}}>{sub}</p>}</div>
      <Toggle value={value} onChange={v=>onChange(name,v)} d={d}/>
    </div>
    {value==='yes'&&detail&&<div style={{marginTop:10}}><p style={{fontSize:d?12:14,fontWeight:600,color:$.txt,margin:'0 0 4px'}}>{dLabel||'Details'}</p><textarea placeholder="Please provide details..." value={dVal||''} onChange={e=>dChange(name+'Detail',e.target.value)} style={{width:'100%',minHeight:72,padding:d?'8px 12px':'12px 16px',borderRadius:d?8:12,border:`1px solid ${$.bdr}`,fontSize:d?12:15,outline:'none',background:$.card,color:$.h,boxSizing:'border-box',fontFamily:$.f,resize:'vertical'}}/></div>}
  </div>
)

const F=({label,icon,type='text',value,onChange,placeholder,name,d=true})=>(
  <div style={{marginBottom:d?14:18}}><div style={{display:'flex',alignItems:'center',gap:5,marginBottom:d?4:6}}>{icon}{label&&<label style={{fontSize:d?12:15,fontWeight:600,color:$.txt}}>{label}</label>}</div><input type={type} value={value||''} placeholder={placeholder} onChange={e=>onChange(name,e.target.value)} style={{width:'100%',padding:d?'9px 12px':'14px 16px',borderRadius:d?8:12,border:`1px solid ${$.bdr}`,fontSize:d?12:16,height:d?'auto':48,outline:'none',background:$.card,color:$.h,boxSizing:'border-box',fontFamily:$.f,WebkitAppearance:'none',lineHeight:'1.4'}} onFocus={e=>e.target.style.borderColor=$.acc} onBlur={e=>e.target.style.borderColor=$.bdr}/></div>
)

const CK=({label,sub,checked,onChange,d=true})=>(
  <div style={{display:'flex',gap:d?10:14,padding:d?'10px 0':'14px 0',borderBottom:`1px solid ${$.bdr}18`}}>
    <button type="button" onClick={onChange} style={{width:d?20:26,height:d?20:26,borderRadius:d?5:7,border:checked?'none':`2px solid ${$.bdr}`,background:checked?$.acc:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,marginTop:1}}>{checked&&I.chk('#fff',10)}</button>
    <div><p style={{fontSize:d?13:16,fontWeight:600,color:$.h,margin:0}}>{label}</p>{sub&&<p style={{fontSize:d?12:14,color:$.txtM,margin:d?'2px 0 0':'4px 0 0',lineHeight:1.5}}>{sub}</p>}</div>
  </div>
)

const Alerts=({blocks,flags})=>{if(!blocks.length&&!flags.length)return null;return(
  <div style={{marginTop:12}}>
    {blocks.length>0&&<div style={{background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.15)',borderRadius:10,padding:14,marginBottom:8,display:'flex',gap:10,alignItems:'flex-start'}}><div style={{width:32,height:32,borderRadius:99,background:'rgba(239,68,68,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{I.block($.err,14)}</div><div><p style={{fontSize:13,fontWeight:700,color:$.err,margin:'0 0 2px'}}>Treatments Blocked</p>{blocks.map((b,i)=><p key={i} style={{fontSize:12,color:'#B91C1C',margin:'1px 0'}}>{b.treatment} — {b.condition}</p>)}</div></div>}
    {flags.length>0&&<div style={{background:'rgba(245,158,11,0.05)',border:'1px solid rgba(245,158,11,0.15)',borderRadius:10,padding:14,display:'flex',gap:10,alignItems:'flex-start'}}><div style={{width:32,height:32,borderRadius:99,background:'rgba(245,158,11,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{I.warn($.wrn,14)}</div><div><p style={{fontSize:13,fontWeight:700,color:'#B45309',margin:'0 0 2px'}}>Therapist Review Required</p>{flags.map((f,i)=><p key={i} style={{fontSize:12,color:'#92400E',margin:'1px 0'}}>{f.treatment} — {f.condition}</p>)}</div></div>}
  </div>
)}

const SigPad=({onSign,desk:dk})=>{const ref=useRef(null),dr=useRef(false);const s=useCallback(e=>{dr.current=true;const c=ref.current,r=c.getBoundingClientRect(),ctx=c.getContext('2d'),p=e.touches?e.touches[0]:e;ctx.beginPath();ctx.moveTo(p.clientX-r.left,p.clientY-r.top)},[]);const d=useCallback(e=>{if(!dr.current)return;e.preventDefault();const c=ref.current,r=c.getBoundingClientRect(),ctx=c.getContext('2d'),p=e.touches?e.touches[0]:e;ctx.strokeStyle=$.h;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineTo(p.clientX-r.left,p.clientY-r.top);ctx.stroke()},[]);const u=useCallback(()=>{dr.current=false;if(ref.current)onSign(ref.current.toDataURL())},[onSign]);return(
  <div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><p style={{fontSize:dk?14:18,fontWeight:700,color:$.h,margin:0}}>Digital Signature</p><button type="button" onClick={()=>{ref.current.getContext('2d').clearRect(0,0,600,180);onSign(null)}} style={{background:'none',border:'none',color:$.acc,fontSize:12,fontWeight:600,cursor:'pointer'}}>Clear</button></div><canvas ref={ref} width={600} height={180} style={{width:'100%',height:140,border:`2px dashed ${$.bdr}`,borderRadius:10,cursor:'crosshair',background:$.card,touchAction:'none',display:'block'}} onMouseDown={s} onMouseMove={d} onMouseUp={u} onMouseLeave={u} onTouchStart={s} onTouchMove={d} onTouchEnd={u}/><p style={{fontSize:11,color:$.txtL,marginTop:8}}>By signing above, you acknowledge this is a legally binding electronic signature.</p></div>
)}

// ═══ SIDEBAR (logged-in pages only) ═══
const RAIL=56,PANEL=192
const Sidebar=({biz,user,activeTab,onNav,onLogout})=>{
  const tabs=[{id:'home',label:'Home',icon:'home'},{id:'bookings',label:'Bookings',icon:'cal'},{id:'form',label:'Consultation',icon:'form'},{id:'messages',label:'Messages',icon:'msg'},{id:'profile',label:'My Profile',icon:'user'}]
  const ini=(user?.name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)
  return(
    <div className="client-sidebar" style={{height:'100vh',position:'sticky',top:0,flexShrink:0,fontFamily:$.f}}>
      <div style={{width:RAIL,background:'#111',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{height:56,display:'flex',alignItems:'center',justifyContent:'center',borderBottom:'1px solid rgba(255,255,255,0.08)'}}><div style={{width:30,height:30,borderRadius:8,background:$.acc,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:'#111',fontWeight:700,fontSize:13}}>R.</span></div></div>
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',paddingTop:12,gap:2}}>
          {tabs.map(t=>{const a=activeTab===t.id;return<button key={t.id} onClick={()=>onNav(t.id)} style={{width:40,height:40,borderRadius:10,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',background:a?'rgba(255,255,255,0.12)':'transparent'}} onMouseEnter={e=>{if(!a)e.currentTarget.style.background='rgba(255,255,255,0.06)'}} onMouseLeave={e=>{if(!a)e.currentTarget.style.background='transparent'}}>{a&&<div style={{position:'absolute',left:0,top:8,bottom:8,width:3,borderRadius:'0 3px 3px 0',background:'#FAF7F2'}}/>}{I[t.icon](a?'#FAF7F2':'rgba(250,247,242,0.35)',18)}</button>})}
        </div>
        <div style={{borderTop:'1px solid rgba(255,255,255,0.08)',padding:'10px 0',display:'flex',justifyContent:'center'}}><div style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:'#FAF7F2',fontWeight:600,fontSize:11}}>{ini}</span></div></div>
      </div>
      <div style={{width:PANEL,background:'#fff',borderRight:`1px solid ${$.bdr}`,display:'flex',flexDirection:'column'}}>
        <div style={{height:56,display:'flex',alignItems:'center',padding:'0 14px',borderBottom:`1px solid ${$.bdr}`}}><span style={{fontWeight:700,fontSize:14,color:'#111'}}>{biz?.name||'Portal'}</span></div>
        <div style={{flex:1,padding:'10px 8px'}}>
          <div style={{padding:'0 6px',marginBottom:8,fontSize:9,fontWeight:600,letterSpacing:'0.1em',color:'#7A776F',textTransform:'uppercase'}}>MENU</div>
          {tabs.map(t=>{const a=activeTab===t.id;return<button key={t.id} onClick={()=>onNav(t.id)} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'7px 8px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:a?600:500,color:a?'#111':'#7A776F',background:a?'rgba(17,17,17,0.05)':'transparent',fontFamily:$.f,textAlign:'left'}} onMouseEnter={e=>{if(!a){e.currentTarget.style.background='rgba(232,228,221,0.5)';e.currentTarget.style.color='#2C2C2A'}}} onMouseLeave={e=>{if(!a){e.currentTarget.style.background='transparent';e.currentTarget.style.color='#7A776F'}}}>{I[t.icon](a?'#111':'#7A776F',15)}<span>{t.label}</span></button>})}
        </div>
        <div style={{borderTop:`1px solid ${$.bdr}`,padding:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:4}}>
            <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(212,163,115,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{color:'#111',fontWeight:600,fontSize:10}}>{ini}</span></div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:'#2C2C2A'}}>{user?.name||'User'}</div><div style={{fontSize:10,color:'#7A776F'}}>{biz?.name}</div></div>
          </div>
          <button onClick={onLogout} style={{width:'100%',marginTop:6,padding:'6px 0',borderRadius:6,border:`1px solid ${$.bdr}`,background:'transparent',fontSize:11,fontWeight:600,color:'#7A776F',cursor:'pointer',fontFamily:$.f}}>Sign Out</button>
        </div>
      </div>
    </div>
  )
}

// ═══ MAIN ═══
export default function ClientPortal(){
  const{slug}=useParams()
  const[view,setView]=useState('login'),[biz,setBiz]=useState(null),[user,setUser]=useState(null)
  const[loading,setLoading]=useState(false),[err,setErr]=useState('')
  const[authMode,setAuthMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState('')
  const[signupName,setSignupName]=useState(''),[signupPhone,setSignupPhone]=useState(''),[showPw,setShowPw]=useState(false)
  const[step,setStep]=useState(0),[fd,setFd]=useState({}),[cs,setCs]=useState(null),[myData,setMyData]=useState(null)
  const[activeTab,setActiveTab]=useState('home')
  const topRef=useRef(null)
  const isSalon=biz?.type==='salon'||biz?.type==='local_services'||biz?.category==='salon'
  const hasForm=cs?.status==='complete'||cs?.status==='submitted'
  const alerts=getAlerts(fd)
  const[desk,setDesk]=useState(false)
  useEffect(()=>{const h=()=>setDesk(window.innerWidth>=768);h();window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h)},[])
  const set=useCallback((k,v)=>setFd(p=>({...p,[k]:v})),[])
  const upcoming=myData?.upcoming_bookings||[]

  useEffect(()=>{if(!slug)return;apiFetch(`/client/${slug}/info`).then(d=>{setBiz(d.business||d);if(sessionStorage.getItem('client_token'))loadUser()}).catch(()=>{})},[slug])
  const loadUser=async()=>{try{const p=await apiFetch('/client/auth/me');const d=await apiFetch(`/client/${slug}/my-data`);setUser(p.user||p);setCs(d.consultation||null);setMyData(d);setView('home')}catch(e){sessionStorage.removeItem('client_token')}}
  const doAuth=async()=>{setLoading(true);setErr('');try{const body=authMode==='login'?{email,password}:{name:signupName,email,phone:signupPhone,password,business_id:biz?.business_id||''};const d=await apiFetch(`/client/auth/${authMode==='login'?'login':'signup'}`,{method:'POST',body:JSON.stringify(body)});sessionStorage.setItem('client_token',d.token);await loadUser()}catch(e){setErr(e.message)}setLoading(false)}
  const logout=()=>{sessionStorage.removeItem('client_token');setUser(null);setView('login')}
  const submitForm=async()=>{setLoading(true);try{await apiFetch(`/consultation/public/${slug}/submit`,{method:'POST',body:JSON.stringify({form_data:fd,alerts})});setCs({status:'submitted'});setView('submitted')}catch(e){setErr(e.message)}setLoading(false)}
  const canProceed=()=>{if(step===0)return fd.fullName&&fd.dob&&fd.mobile&&fd.email&&fd.emergencyName&&fd.emergencyPhone&&fd.gpName;if(step===5)return fd.consent1&&fd.consent2&&fd.consent3&&fd.consent4&&fd.signed;return true}
  const goStep=n=>{setStep(n);topRef.current?.scrollIntoView({behavior:'smooth'})}
  const[msgTab,setMsgTab]=useState('chat'),[msgs,setMsgs]=useState([]),[msgText,setMsgText]=useState('')
  const[services,setServices]=useState([]),[slots,setSlots]=useState([]),[slotStaff,setSlotStaff]=useState([])
  const[bookSvc,setBookSvc]=useState(null),[bookDate,setBookDate]=useState(new Date().toISOString().split('T')[0]),[bookTime,setBookTime]=useState(''),[bookStaff,setBookStaff]=useState(''),[bookStep,setBookStep]=useState('list'),[bookLoading,setBookLoading]=useState(false)
  const[notifPrefs,setNotifPrefs]=useState({appointment_reminders:true,aftercare:true,promotions:false,booking_confirmations:true})
  const navTo=t=>{setActiveTab(t);if(t==='home')setView('home');else if(t==='form'){setStep(0);setView('form')}else{setView(t);if(t==='messages')loadMsgs();if(t==='bookings'){loadServices();setBookStep('list')}if(t==='profile')loadNotifPrefs()}}
  const loadMsgs=async()=>{try{const d=await apiFetch(`/client/${slug}/messages`);setMsgs((d.messages||[]).map(m=>({from:m.from==='client'?'me':'them',text:m.text,time:m.created_at?new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'',staff:m.staff_name})))}catch(e){}}
  const sendMsg=async()=>{if(!msgText.trim())return;const text=msgText;setMsgText('');setMsgs(p=>[...p,{from:'me',text,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}]);try{await apiFetch(`/client/${slug}/messages`,{method:'POST',body:JSON.stringify({text})})}catch(e){}}
  const loadServices=async()=>{try{const d=await apiFetch(`/client/${slug}/services`);setServices(d.services||[])}catch(e){}}
  const loadSlots=async(svcId,date)=>{try{const d=await apiFetch(`/client/${slug}/slots?service_id=${svcId}&date=${date}`);setSlots(d.slots||[]);setSlotStaff(d.staff||[])}catch(e){setSlots([])}}
  const doBook=async()=>{if(!bookSvc||!bookDate||!bookTime)return;setBookLoading(true);try{await apiFetch(`/client/${slug}/book`,{method:'POST',body:JSON.stringify({service_id:bookSvc.id,date:bookDate,time:bookTime,staff_id:bookStaff||undefined})});setBookStep('done');await loadUser()}catch(e){setErr(e.message)}setBookLoading(false)}
  const toggleNotif=async(key)=>{const nw={...notifPrefs,[key]:!notifPrefs[key]};setNotifPrefs(nw);try{await apiFetch('/client/auth/notifications',{method:'PUT',body:JSON.stringify({prefs:nw})})}catch(e){}}
  const loadNotifPrefs=async()=>{try{const d=await apiFetch('/client/auth/notifications');if(d.prefs)setNotifPrefs(d.prefs)}catch(e){}}
  const pastBookings=myData?.past_bookings||[]

  // Shared: page shell for logged-in views (sidebar + main)
  const Shell=({tab,children})=>(
    <div style={{display:'flex',minHeight:'100vh',background:$.bg,fontFamily:$.f}}>
      {FONT}

      <Sidebar biz={biz} user={user} activeTab={tab||activeTab} onNav={navTo} onLogout={logout}/>
      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>{children}</div>
      <div className="client-mobnav" style={{position:'fixed',bottom:0,left:0,right:0,background:'#111111',padding:'10px 0 16px',zIndex:30,display:'flex',justifyContent:'space-around'}}>
        {[{id:'home',icon:'home',label:'Home'},{id:'bookings',icon:'cal',label:'Bookings'},{id:'form',icon:'form',label:'Forms'},{id:'messages',icon:'msg',label:'Messages'},{id:'profile',icon:'user',label:'Profile'}].map(t=><button key={t.id} onClick={()=>navTo(t.id)} style={{background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'2px 6px'}}>{I[t.icon](activeTab===t.id?$.acc:'rgba(255,255,255,0.45)',22)}<span style={{fontSize:11,fontWeight:activeTab===t.id?700:500,color:activeTab===t.id?$.acc:'rgba(255,255,255,0.45)'}}>{t.label}</span></button>)}
      </div>
    </div>
  )

  // Shared: top bar for logged-in views
  const TopBar=()=>(
    <div style={{background:'linear-gradient(135deg,#111111 0%,#1a1708 100%)',padding:desk?'12px 24px':'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:32,height:32,borderRadius:10,background:$.acc,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:13,fontWeight:800,color:'#111'}}>R.</span></div>
        <span style={{fontSize:desk?15:14,fontWeight:700,color:'#FAF7F2',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{biz?.name||'Portal'}</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <button style={{width:34,height:34,borderRadius:99,background:'rgba(255,255,255,0.08)',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative',flexShrink:0}}>{I.bell('rgba(250,247,242,0.6)',16)}<div style={{position:'absolute',top:7,right:7,width:7,height:7,borderRadius:99,background:$.acc}}/></button>
        <div style={{width:34,height:34,borderRadius:99,border:`2px solid ${$.acc}`,background:'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:$.acc,flexShrink:0}}>{(user?.name||'?').charAt(0)}</div>
      </div>
    </div>
  )

  if(!biz)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:$.bg,fontFamily:$.f}}>{FONT}<div style={{textAlign:'center'}}><div style={{width:28,height:28,border:`3px solid ${$.bdr}`,borderTopColor:$.acc,borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 10px'}}/><p style={{fontSize:12,color:$.txtM}}>Loading...</p></div></div>

  // ═══════════════════════════════════════════════════════════════
  // LOGIN (Figma 2:115) — NO sidebar, full-width header+hero+two-col
  // ═══════════════════════════════════════════════════════════════
  if(view==='login')return(
    <div style={{minHeight:'100vh',background:$.bg,fontFamily:$.f}}>
      {FONT}
      {/* Desktop header */}
      {desk&&<div style={{background:$.card,borderBottom:`1px solid ${$.bdr}`,padding:'10px 32px'}}>
        <div style={{maxWidth:1100,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:32,height:32,borderRadius:10,background:$.acc,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:13,fontWeight:800,color:'#111'}}>R.</span></div><span style={{fontSize:15,fontWeight:700,color:$.h}}>{biz?.name||'Rejuvenate Skin Experts'}</span></div>
          <div style={{display:'flex',gap:28}}>{['Treatments','Products','Locations'].map(l=><button key={l} style={{background:'none',border:'none',fontSize:12,fontWeight:500,color:$.txtM,cursor:'pointer',fontFamily:$.f,textTransform:'uppercase',letterSpacing:'0.5px'}}>{l}</button>)}</div>
        </div>
      </div>}
      {/* Hero — mobile: full image with gradient + centered branding; desktop: banner */}
      {!desk?<div style={{position:'relative',width:'100%',height:340,overflow:'hidden'}}>
        <img src={IMG.login} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(244,245,247,0) 20%,rgba(244,245,247,0.6) 60%,#F4F5F7 100%)'}}/>
        <div style={{position:'absolute',bottom:40,left:0,right:0,textAlign:'center'}}>
          <div style={{width:64,height:64,borderRadius:99,border:`2px solid ${$.acc}40`,background:'rgba(255,255,255,0.9)',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:8}}><span style={{fontSize:30,fontWeight:700,color:$.acc}}>R</span></div>
          <p style={{fontSize:28,fontWeight:700,color:$.acc,margin:'0 0 2px',letterSpacing:'-0.5px'}}>{biz?.name?.split(' ')[0]||'Rejuvenate'}</p>
          <p style={{fontSize:10,fontWeight:600,color:$.txtM,textTransform:'uppercase',letterSpacing:2,margin:0}}>{biz?.name?.includes(' ')?biz.name.split(' ').slice(1).join(' '):'Skin Experts'}</p>
        </div>
      </div>:<div style={{maxWidth:1100,margin:'0 auto',padding:'20px 32px'}}>
        <div style={{width:'100%',height:320,borderRadius:12,overflow:'hidden',position:'relative'}}>
          <img src={IMG.login} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to right,rgba(244,245,247,0.7),rgba(244,245,247,0.2))'}}/>
          <p style={{position:'absolute',bottom:40,left:40,fontSize:32,fontWeight:300,color:$.txtM,margin:0,fontStyle:'italic'}}>Radiance redefined.</p>
        </div>
      </div>}
      <div style={{maxWidth:1100,margin:'0 auto',padding:desk?'0 32px 32px':'0 12px 20px'}}>
        <div style={desk?{display:'flex',gap:40,alignItems:'flex-start'}:{}}>
          {desk&&<div style={{flex:1,paddingTop:28}}><h2 style={{fontSize:22,fontWeight:700,color:$.acc,margin:'0 0 16px'}}>Welcome Back</h2><p style={{fontSize:13,color:$.txtM,lineHeight:'22px',margin:'0 0 16px',maxWidth:380}}>Access your personalized skincare dashboard, manage appointments, and explore exclusive member treatments designed for your unique glow.</p><div style={{display:'flex',alignItems:'center',gap:8}}>{I.shield($.acc,14)}<span style={{fontSize:11,fontWeight:700,color:$.acc,textTransform:'uppercase',letterSpacing:'0.5px'}}>Secure Luxury Gateway</span></div></div>}
          <div style={{width:desk?440:'100%',flexShrink:0}}>
            <div style={{background:$.card,borderRadius:12,border:`1px solid ${$.bdr}`,padding:desk?24:20,boxShadow:'0 8px 32px rgba(0,0,0,0.05)'}}>
              <h2 style={{fontSize:desk?17:20,fontWeight:700,color:$.h,margin:desk?'0 0 4px':'0 0 6px'}}>{authMode==='login'?'Member Login':'Create Account'}</h2>
              <p style={{fontSize:desk?12:15,color:$.txtM,margin:desk?'0 0 20px':'0 0 24px'}}>{authMode==='login'?'Please enter your credentials to continue.':'Start your journey to radiant skin today.'}</p>
              {authMode==='signup'&&<F label="Full Name" icon={I.user($.txtL,12)} name="sn" value={signupName} onChange={(_,v)=>setSignupName(v)} placeholder="Your full name" d={desk}/>}
              <F label="Email Address" icon={I.mail($.txtL,12)} type="email" name="em" value={email} onChange={(_,v)=>setEmail(v)} placeholder="name@example.com" d={desk}/>
              {authMode==='signup'&&<F label="Phone Number" icon={I.phone($.txtL,12)} type="tel" name="ph" value={signupPhone} onChange={(_,v)=>setSignupPhone(v)} placeholder="07..." d={desk}/>}
              <div style={{marginBottom:desk?14:18}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:desk?4:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>{I.lock($.txtL,desk?12:14)}<label style={{fontSize:desk?12:15,fontWeight:600,color:$.txt}}>Password</label></div>
                  {authMode==='login'&&<button style={{background:'none',border:'none',color:$.acc,fontSize:desk?11:13,fontWeight:500,cursor:'pointer',fontFamily:$.f}}>Forgot password?</button>}
                </div>
                <div style={{position:'relative'}}><input type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={authMode==='login'?'••••••••':'Create a strong password'} style={{width:'100%',padding:desk?'9px 40px 9px 12px':'14px 48px 14px 16px',borderRadius:desk?8:12,border:`1px solid ${$.bdr}`,fontSize:desk?12:16,outline:'none',background:$.card,color:$.h,boxSizing:'border-box',fontFamily:$.f}}/><button type="button" onClick={()=>setShowPw(!showPw)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer'}}>{I.eye($.txtL,14)}</button></div>
              </div>
              {err&&<p style={{fontSize:11,color:$.err,margin:'0 0 10px'}}>{err}</p>}
              <button onClick={doAuth} disabled={loading} style={{width:'100%',padding:desk?'9px 0':'12px 0',borderRadius:99,border:'none',background:$.acc,color:'#fff',fontSize:desk?13:15,fontWeight:700,cursor:loading?'wait':'pointer',fontFamily:$.f,opacity:loading?0.6:1,textTransform:'uppercase',marginBottom:14}}>{loading?'Please wait...':authMode==='login'?'Log In':'Create Account'}</button>
              <p style={{textAlign:'center',fontSize:desk?12:15,color:$.txtM,margin:0}}>{authMode==='login'?'Not a member yet? ':'Already have an account? '}<button onClick={()=>{setAuthMode(authMode==='login'?'signup':'login');setErr('')}} style={{background:'none',border:'none',color:$.acc,fontWeight:600,cursor:'pointer',fontSize:12,fontFamily:$.f}}>{authMode==='login'?'Apply for Membership':'Sign In'}</button></p>
            </div>
          </div>
        </div>
      </div>
      <div style={{borderTop:`1px solid ${$.bdr}`,padding:'16px 32px'}}>
        <div style={{maxWidth:1100,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <p style={{fontSize:11,color:$.txtM,margin:0}}>&copy; {new Date().getFullYear()} {biz?.name}. All rights reserved.</p><div style={{display:'flex',gap:16}}>{['Privacy Policy','Terms of Service'].map(l=><button key={l} style={{background:'none',border:'none',fontSize:11,color:$.txtL,cursor:'pointer',fontFamily:$.f,padding:0}}>{l}</button>)}</div>
          <span style={{fontSize:10,color:$.txtL}}>Powered by <b style={{color:$.acc}}>ReeveOS</b></span>
        </div>
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // HOME (Figma 2:849 / 2:674) — sidebar + main
  // ═══════════════════════════════════════════════════════════════
  if(view==='home'){
    const qa=[{icon:'cal',label:'Book Visit',sub:'Past & upcoming',action:()=>navTo('bookings'),show:true},{icon:'form',label:hasForm?'View Form':'Fill Form',sub:hasForm?'Review details':'Complete paperwork',action:()=>{setStep(0);setView('form')},show:isSalon},{icon:'user',label:'My Profile',sub:'History & settings',action:()=>navTo('profile'),show:true},{icon:'msg',label:'Message Us',sub:'Talk to experts',action:()=>navTo('messages'),show:true}].filter(a=>a.show)
    return(
      <Shell tab="home">
        <TopBar/>
        <div style={{flex:1,overflowY:'auto',paddingBottom:desk?0:80}}>
          <div style={{maxWidth:1000,margin:'0 auto',padding:desk?'24px 24px 32px':'16px 12px'}}>
            {hasForm&&<div style={{marginBottom:20}}><h1 style={{fontSize:desk?24:26,fontWeight:700,color:$.h,margin:0}}>Welcome back, {(user?.name||'').split(' ')[0]}!</h1><p style={{fontSize:desk?13:16,color:$.txtM,margin:'2px 0 0'}}>Your skin health journey is progressing perfectly.</p></div>}
            {isSalon&&<div style={{background:hasForm?'rgba(74,222,128,0.06)':'rgba(239,68,68,0.04)',border:`2px solid ${hasForm?'rgba(74,222,128,0.35)':'rgba(239,68,68,0.18)'}`,borderRadius:12,padding:desk?22:16,marginBottom:20,display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:24}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>{hasForm?I.chk('#22C55E',16):I.warn('#DC2626',16)}<span style={{fontSize:desk?12:14,fontWeight:700,color:hasForm?'#22C55E':'#DC2626',textTransform:'uppercase',letterSpacing:'0.5px'}}>{hasForm?'Status: Complete':'Action Required'}</span></div>
                <h3 style={{fontSize:desk?18:20,fontWeight:700,color:$.h,margin:'0 0 4px'}}>{hasForm?'Consultation Form Complete':'Consultation Form Needed'}</h3>
                <p style={{fontSize:desk?13:15,color:$.txtM,margin:0,lineHeight:desk?'20px':'24px',maxWidth:500}}>{hasForm?'Our clinical experts have reviewed your profile and your treatment plan is ready.':'Please complete your skin assessment form before your next visit.'}</p>
                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <button onClick={()=>{setStep(0);setView('form')}} style={{padding:desk?'8px 18px':'10px 22px',borderRadius:99,border:'none',background:$.acc,color:'#fff',fontSize:desk?12:14,fontWeight:700,cursor:'pointer',fontFamily:$.f}}>{hasForm?'View Form':'Fill Form Now'}</button>
                  {hasForm&&<button style={{padding:desk?'8px 18px':'10px 22px',borderRadius:99,border:`1px solid ${$.acc}40`,background:'transparent',color:$.acc,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:$.f}}>Download PDF</button>}
                </div>
              </div>
              <div style={{width:desk?240:64,height:desk?140:64,borderRadius:desk?10:12,overflow:'hidden',flexShrink:0}}><img src={IMG.form} alt="" style={{width:'100%',height:'100%',objectFit:'cover',opacity:0.85}}/></div>
            </div>}
            <div style={desk?{display:'flex',gap:24,alignItems:'flex-start'}:{}}>
              <div style={{flex:1,minWidth:0}}>
                <h3 style={{fontSize:15,fontWeight:700,color:$.h,margin:'0 0 10px'}}>Quick Actions</h3>
                <div style={{display:'grid',gridTemplateColumns:desk?`repeat(${qa.length},1fr)`:'1fr 1fr',gap:10,marginBottom:20}}>
                  {qa.map((a,i)=><button key={i} onClick={a.action} style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:desk?10:14,padding:desk?14:18,cursor:'pointer',textAlign:'left',transition:'border-color 0.15s'}} onMouseEnter={e=>e.currentTarget.style.borderColor=$.acc+'50'} onMouseLeave={e=>e.currentTarget.style.borderColor=$.bdr}><div style={{width:36,height:36,borderRadius:8,background:'rgba(200,163,76,0.08)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8}}>{I[a.icon]($.acc,16)}</div><p style={{fontSize:desk?13:16,fontWeight:600,color:$.h,margin:0}}>{a.label}</p><p style={{fontSize:desk?11:14,color:$.txtM,margin:'2px 0 0'}}>{a.sub}</p></button>)}
                </div>
                
                {/* Next Appointment Card with Image */}
                {upcoming.length>0&&<div style={{borderRadius:16,overflow:'hidden',border:`1px solid ${$.bdr}`,marginBottom:16,background:$.card}}>
                  <div style={{position:'relative',height:desk?160:120,overflow:'hidden'}}>
                    <img src={IMG.appt} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.5),transparent)'}}/>
                    <div style={{position:'absolute',bottom:10,left:14,display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:8,height:8,borderRadius:99,background:$.ok}}/><span style={{fontSize:11,fontWeight:700,color:$.ok,textTransform:'uppercase',letterSpacing:1}}>Ready</span>
                    </div>
                  </div>
                  <div style={{padding:'14px 16px'}}>
                    <p style={{fontSize:11,fontWeight:600,color:$.acc,textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 2px'}}>{upcoming[0].date} {upcoming[0].time&&`• ${upcoming[0].time}`}</p>
                    <p style={{fontSize:desk?18:17,fontWeight:700,color:$.h,margin:'0 0 2px'}}>Next Appointment</p>
                    <p style={{fontSize:desk?13:14,color:$.txtM,margin:'0 0 1px'}}>{upcoming[0].service}{upcoming[0].staff?` with ${upcoming[0].staff}`:''}</p>
                    <p style={{fontSize:12,color:$.txtL,margin:0}}>Ready for your session</p>
                  </div>
                </div>}

                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><h3 style={{fontSize:15,fontWeight:700,color:$.h,margin:0}}>Upcoming Bookings</h3>{upcoming.length>0&&<button style={{background:'none',border:'none',color:$.acc,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:$.f}}>View All</button>}</div>
                {upcoming.length>0?upcoming.map((b,i)=><div key={i} style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:10,padding:14,marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',gap:14,alignItems:'center'}}><div style={{width:48,height:48,borderRadius:10,background:$.bg,border:`1px solid ${$.bdr}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:10,fontWeight:700,color:$.txtM,textTransform:'uppercase'}}>{b.month||'TBC'}</span><span style={{fontSize:17,fontWeight:700,color:$.h,lineHeight:1}}>{b.day||'—'}</span></div><div><p style={{fontSize:desk?14:17,fontWeight:600,color:$.h,margin:0}}>{b.service}</p><div style={{display:'flex',gap:12,marginTop:2}}><span style={{display:'flex',alignItems:'center',gap:3,fontSize:12,color:$.txtM}}>{I.clock($.txtM,11)} {b.time}</span>{b.staff&&<span style={{display:'flex',alignItems:'center',gap:3,fontSize:12,color:$.txtM}}>{I.user($.txtM,11)} {b.staff}</span>}</div></div></div><span style={{padding:'3px 8px',borderRadius:99,fontSize:10,fontWeight:700,background:hasForm?'rgba(16,185,129,0.08)':'rgba(245,158,11,0.08)',color:hasForm?'#10B981':'#F59E0B',border:`1px solid ${hasForm?'rgba(16,185,129,0.15)':'rgba(245,158,11,0.15)'}`}}>{hasForm?'All set':'Form needed'}</span></div>):<div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:10,padding:28,textAlign:'center'}}><div style={{width:40,height:40,borderRadius:10,background:'rgba(200,163,76,0.08)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 10px'}}>{I.cal($.acc,20)}</div><p style={{fontSize:desk?13:17,fontWeight:600,color:$.h}}>No upcoming appointments</p><p style={{fontSize:desk?12:15,color:$.txtM,margin:desk?'3px 0 12px':'6px 0 16px'}}>Book your first treatment to get started</p><button onClick={()=>navTo('bookings')} style={{padding:desk?'7px 18px':'10px 22px',borderRadius:99,border:'none',background:$.acc,color:'#fff',fontSize:desk?12:14,fontWeight:700,cursor:'pointer',fontFamily:$.f}}>Book Appointment</button></div>}
                {myData?.past_bookings?.length>0&&<div style={{marginTop:16}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><h3 style={{fontSize:15,fontWeight:700,color:$.h,margin:0}}>Treatment History</h3><button style={{background:'none',border:'none',color:$.acc,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:$.f}}>View All</button></div>{myData.past_bookings.slice(0,4).map((b,i)=><div key={i} style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:10,padding:'10px 14px',marginBottom:6,display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',gap:10,alignItems:'center'}}><div style={{width:36,height:36,borderRadius:8,background:$.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{I.shield($.txtL,16)}</div><div><p style={{fontSize:13,fontWeight:600,color:$.h,margin:0}}>{b.service}</p><p style={{fontSize:11,color:$.txtM,margin:'1px 0 0'}}>{b.staff?`${b.staff} · `:''}{ b.date}</p></div></div><span style={{fontSize:10,fontWeight:700,color:$.ok,textTransform:'uppercase'}}>Completed</span></div>)}</div>}
              </div>
              {desk&&<div style={{width:320,flexShrink:0,display:'flex',flexDirection:'column',gap:16}}>
                <div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:10,padding:18,position:'relative',overflow:'hidden'}}><div style={{position:'absolute',top:-12,right:-12,width:80,height:80,borderRadius:99,background:'rgba(200,163,76,0.1)',filter:'blur(28px)',pointerEvents:'none'}}/><div style={{position:'relative'}}><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}><div style={{width:40,height:40,borderRadius:99,border:`2px solid ${$.acc}`,background:$.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:$.acc}}>{(user?.name||'?').charAt(0)}</div><div><p style={{fontSize:14,fontWeight:700,color:$.h,margin:0}}>{(user?.name||'').split(' ')[0]}</p><p style={{fontSize:12,fontWeight:500,color:$.acc,margin:0}}>Premium Member</p></div></div><div style={{height:1,background:$.bdr,marginBottom:12}}/><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><p style={{fontSize:10,fontWeight:700,color:$.txtM,textTransform:'uppercase',margin:0}}>Reward Points</p><p style={{fontSize:20,fontWeight:700,color:$.h,margin:'1px 0 0'}}>2,450</p></div><button style={{background:'rgba(200,163,76,0.08)',border:'1px solid rgba(200,163,76,0.15)',borderRadius:10,padding:'5px 12px',cursor:'pointer'}}><span style={{fontSize:11,fontWeight:700,color:$.acc}}>Redeem</span></button></div></div></div>
                <div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:10,padding:18}}><div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>{I.shield($.acc,14)}<p style={{fontSize:14,fontWeight:700,color:$.h,margin:0}}>Skin Tip of the Week</p></div><div style={{width:'100%',aspectRatio:'16/9',borderRadius:8,background:$.bg,marginBottom:10,display:'flex',alignItems:'center',justifyContent:'center'}}>{I.shield($.bdr2,28)}</div><p style={{fontSize:12,color:$.txtM,lineHeight:'18px',margin:'0 0 10px'}}>"Consistency is key! Hydrate daily and never skip your SPF, even on cloudy days."</p><button style={{width:'100%',padding:'7px 0',borderRadius:8,border:`1px solid ${$.bdr}`,background:'transparent',cursor:'pointer'}}><span style={{fontSize:11,fontWeight:700,color:$.txtM}}>More Tips</span></button></div>
              </div>}
            </div>
          </div>
        </div>
      </Shell>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // SUBMITTED — sidebar
  // ═══════════════════════════════════════════════════════════════
  if(view==='submitted')return(
    <Shell tab="form">
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:12,maxWidth:400,width:'100%',textAlign:'center',padding:32}}>
          <div style={{width:48,height:48,borderRadius:99,background:'rgba(34,197,94,0.08)',border:'2px solid rgba(34,197,94,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>{I.chk($.ok,24)}</div>
          <h2 style={{fontSize:18,fontWeight:700,color:$.h,marginBottom:6}}>Form Submitted</h2>
          <p style={{fontSize:13,color:$.txtM,marginBottom:20}}>Thank you, {fd.fullName}. Your consultation form has been received by {biz?.name}.</p>
          {(alerts.blocks.length>0||alerts.flags.length>0)&&<div style={{textAlign:'left',marginBottom:20}}><Alerts blocks={alerts.blocks} flags={alerts.flags}/></div>}
          <button onClick={()=>setView('home')} style={{width:'100%',padding:'10px 0',borderRadius:99,border:'none',background:$.acc,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:$.f}}>Back to Home</button>
        </div>
      </div>
    </Shell>
  )

  // ═══════════════════════════════════════════════════════════════
  // FORM (Figma 2:2, 2:206, 2:381, 2:540) — sidebar + progress + steps
  // ═══════════════════════════════════════════════════════════════
  if(view==='form')return(
    <Shell tab="form">
      <div ref={topRef}/>
      {/* Progress */}
      <div style={{background:$.card,borderBottom:`1px solid ${$.bdr}`,padding:'12px 20px 16px'}}>
        <div style={{maxWidth:680,margin:'0 auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:6}}>
            <div><p style={{fontSize:desk?11:13,fontWeight:700,color:$.acc,margin:0,textTransform:'uppercase',letterSpacing:'0.5px'}}>Step {step+1} of 6</p><p style={{fontSize:desk?16:20,fontWeight:700,color:$.h,margin:'1px 0 0'}}>{STEPS[step]}</p></div>
            <span style={{fontSize:12,color:$.txtM}}>{Math.round(((step+1)/6)*100)}%</span>
          </div>
          <div style={{height:6,background:$.bdr,borderRadius:3}}><div style={{height:'100%',width:`${((step+1)/6)*100}%`,background:$.acc,borderRadius:3,transition:'width 0.3s'}}/></div>
        </div>
      </div>
      {/* Steps */}
      <div style={{flex:1,overflowY:'auto',paddingBottom:desk?0:80}}>
        <div style={{maxWidth:680,margin:'0 auto',padding:desk?'24px 20px 0':'16px 12px 0'}}>

          {step===0&&<div>
            <h2 style={{fontSize:desk?22:24,fontWeight:700,color:$.h,margin:desk?'0 0 4px':'0 0 8px'}}>Personal Details</h2>
            <p style={{fontSize:desk?13:16,color:$.txtM,margin:desk?'0 0 20px':'0 0 24px'}}>Used for your treatment records and emergency contact information.</p>
            <F label="Full Name" icon={I.user($.txtL,12)} name="fullName" value={fd.fullName} onChange={set} d={desk} placeholder="Your full name"/>
            <F label="Date of Birth" type="date" name="dob" value={fd.dob} onChange={set} d={desk}/>
            <F label="Address" name="address" value={fd.address} onChange={set} d={desk} placeholder="Full address"/>
            <div style={{display:'grid',gridTemplateColumns:desk?'1fr 1fr':'1fr',gap:desk?12:0}}><F label="Mobile" icon={I.phone($.txtL,12)} type="tel" name="mobile" value={fd.mobile} onChange={set} d={desk} placeholder="07..."/><F label="Email" icon={I.mail($.txtL,12)} type="email" name="email" value={fd.email} onChange={set} d={desk} placeholder="you@email.com"/></div>
            <div style={{display:'grid',gridTemplateColumns:desk?'1fr 1fr':'1fr',gap:desk?12:0}}><F label="Emergency Contact" name="emergencyName" value={fd.emergencyName} onChange={set} d={desk} placeholder="Contact name"/><F label="Their Number" type="tel" name="emergencyPhone" value={fd.emergencyPhone} onChange={set} d={desk} placeholder="07..."/></div>
            <F label="GP Name" name="gpName" value={fd.gpName} onChange={set} d={desk} placeholder="Dr..."/>
            <F label="GP Surgery (optional)" name="gpAddress" value={fd.gpAddress} onChange={set} d={desk} placeholder="Surgery name"/>
            <div style={{marginBottom:14}}><label style={{display:'block',fontSize:12,fontWeight:600,color:$.txt,marginBottom:4}}>How did you hear about us?</label><select value={fd.referral||''} onChange={e=>set('referral',e.target.value)} style={{width:'100%',padding:desk?'9px 12px':'14px 16px',borderRadius:desk?8:12,border:`1px solid ${$.bdr}`,fontSize:desk?12:16,background:$.card,color:$.h,boxSizing:'border-box',fontFamily:$.f}}><option value="">Select...</option>{['Instagram','TikTok','Google','Friend / Referral','Returning Client','Other'].map(o=><option key={o}>{o}</option>)}</select></div>
            <div style={{background:$.card,borderRadius:10,padding:14,border:`1px solid ${$.bdr}`}}>
              <p style={{fontSize:desk?13:16,fontWeight:700,color:$.acc,margin:desk?'0 0 8px':'0 0 12px'}}>Photo Consent</p>
              <CK label="Treatment records" sub="Clinical use only." checked={fd.photoRecords} onChange={()=>set('photoRecords',!fd.photoRecords)} d={desk}/>
              <CK label="Training purposes" sub="Educational use." checked={fd.photoTraining} onChange={()=>set('photoTraining',!fd.photoTraining)} d={desk}/>
              <CK label="Marketing & social media" sub="May be shared anonymised." checked={fd.photoMarketing} onChange={()=>set('photoMarketing',!fd.photoMarketing)} d={desk}/>
            </div>
          </div>}

          {step===1&&<div>
            <h2 style={{fontSize:desk?22:24,fontWeight:700,color:$.h,margin:desk?'0 0 4px':'0 0 8px'}}>General Health Questionnaire</h2>
            <p style={{fontSize:desk?13:16,color:$.txtM,margin:desk?'0 0 20px':'0 0 24px'}}>Your safety is our priority. Please provide accurate details.</p>
            <Q label="Pregnant, breastfeeding, or trying to conceive?" sub="Some treatments are not suitable during pregnancy." name="pregnant" value={fd.pregnant} onChange={set} d={desk}/>
            <Q label="Do you have a heart pacemaker?" sub="Electronic implants can interfere with certain technologies." name="pacemaker" value={fd.pacemaker} onChange={set} d={desk}/>
            <Q label="Heart condition or high blood pressure?" name="heartCondition" value={fd.heartCondition} onChange={set} detail dLabel="Controlled or uncontrolled?" dVal={fd.heartConditionDetail} dChange={set} d={desk}/>
            <Q label="Metal implants, plates, or screws?" name="metalImplants" value={fd.metalImplants} onChange={set} detail dLabel="Location" dVal={fd.metalImplantsDetail} dChange={set} d={desk}/>
            <Q label="Diabetes?" sub="May affect wound healing." name="diabetes" value={fd.diabetes} onChange={set} detail dLabel="Type 1/2? Controlled?" dVal={fd.diabetesDetail} dChange={set} d={desk}/>
            <Q label="History of epilepsy or seizures?" sub="Light therapies may require precautions." name="epilepsy" value={fd.epilepsy} onChange={set} d={desk}/>
            <Q label="Autoimmune disorders?" sub="Conditions like Lupus may affect healing." name="autoimmune" value={fd.autoimmune} onChange={set} detail dLabel="Condition" dVal={fd.autoimmuneDetail} dChange={set} d={desk}/>
            <Q label="Blood clotting disorder?" name="bloodClotting" value={fd.bloodClotting} onChange={set} d={desk}/>
            <Q label="Cancer history?" name="activeCancer" value={fd.activeCancer} onChange={set} detail dLabel="Type, when, status" dVal={fd.activeCancerDetail} dChange={set} d={desk}/>
            <Q label="HIV/AIDS or hepatitis?" name="hivHepatitis" value={fd.hivHepatitis} onChange={set} d={desk}/>
            <Q label="Liver or kidney disease?" name="liverKidney" value={fd.liverKidney} onChange={set} d={desk}/>
            <Q label="History of cold sores (herpes simplex)?" name="herpes" value={fd.herpes} onChange={set} d={desk}/>
            <Q label="History of keloid or raised scarring?" name="keloid" value={fd.keloid} onChange={set} d={desk}/>
            <Alerts blocks={alerts.blocks} flags={alerts.flags}/>
          </div>}

          {step===2&&<div>
            <h2 style={{fontSize:desk?22:24,fontWeight:700,color:$.h,margin:desk?'0 0 4px':'0 0 8px'}}>Medication History</h2>
            <p style={{fontSize:13,color:$.txtM,margin:'0 0 4px',fontStyle:'italic'}}>"Your safety is our priority. Please be as detailed as possible."</p>
            <div style={{height:1,background:$.bdr,margin:'12px 0 20px'}}/>
            <Q label="Roaccutane / Accutane" sub="Have you taken Isotretinoin in the last 6 months?" name="roaccutane" value={fd.roaccutane} onChange={set} detail dLabel="Dosage and stop date" dVal={fd.roaccutaneDetail} dChange={set} d={desk}/>
            <Q label="Blood Thinning Medication" sub="Warfarin, Aspirin, Clopidogrel etc." name="bloodThinners" value={fd.bloodThinners} onChange={set} detail dLabel="Which medication?" dVal={fd.bloodThinnersDetail} dChange={set} d={desk}/>
            <Q label="Photosensitising medications?" sub="Tetracyclines, doxycycline, St John's Wort" name="photosensitising" value={fd.photosensitising} onChange={set} detail dLabel="Which?" dVal={fd.photosensitivesDetail} dChange={set} d={desk}/>
            <Q label="Topical retinoids?" sub="Retin-A, Tretinoin, Differin, Epiduo" name="retinoids" value={fd.retinoids} onChange={set} detail dLabel="Product and last used" dVal={fd.retinoidsDetail} dChange={set} d={desk}/>
            <Q label="Steroids (oral or topical)?" name="steroids" value={fd.steroids} onChange={set} detail dLabel="Which?" dVal={fd.steroidsDetail} dChange={set} d={desk}/>
            <Q label="Immunosuppressants?" name="immunosuppressants" value={fd.immunosuppressants} onChange={set} d={desk}/>
            <Q label="Herbal supplements?" sub="Garlic, ginkgo, fish oils affect bleeding." name="herbalSupps" value={fd.herbalSupps} onChange={set} detail dLabel="Which?" dVal={fd.herbalSuppsDetail} dChange={set} d={desk}/>
            <Q label="Fish or salmon allergy?" sub="Important for polynucleotide treatments." name="fishAllergy" value={fd.fishAllergy} onChange={set} d={desk}/>
            <Alerts blocks={alerts.blocks} flags={alerts.flags}/>
          </div>}

          {step===3&&<div>
            <h2 style={{fontSize:desk?22:24,fontWeight:700,color:$.h,margin:desk?'0 0 4px':'0 0 8px'}}>Skin History</h2>
            <p style={{fontSize:desk?13:16,color:$.txtM,margin:desk?'0 0 20px':'0 0 24px'}}>Tell us about your skin type and concerns to personalise your treatment plan.</p>
            <div style={{marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>{I.shield($.acc,14)}<p style={{fontSize:desk?14:18,fontWeight:700,color:$.h,margin:0}}>Fitzpatrick Skin Type</p></div>
              <p style={{fontSize:12,color:$.txtM,margin:'0 0 12px'}}>Select the tone matching your reaction to sun exposure.</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:desk?10:6}}>
                {[{v:'I',bg:'#FDEBD0',x:'Always Burns'},{v:'II',bg:'#F5CBA7',x:'Usually Burns'},{v:'III',bg:'#E0B88A',x:'Sometimes'},{v:'IV',bg:'#C4956A',x:'Rarely Burns'},{v:'V',bg:'#8B6914',x:'Very Rarely'},{v:'VI',bg:'#5C4033',x:'Never Burns'}].map(t=><button key={t.v} type="button" onClick={()=>set('fitzpatrick',t.v)} style={{padding:desk?10:6,borderRadius:8,border:fd.fitzpatrick===t.v?`2px solid ${$.acc}`:`2px solid ${$.bdr}`,background:$.card,cursor:'pointer',textAlign:'center'}}><div style={{width:desk?44:28,height:desk?44:28,borderRadius:99,margin:'0 auto 4px',background:t.bg}}/><p style={{fontSize:desk?12:10,fontWeight:700,color:$.h,margin:0}}>Type {t.v}</p>{desk&&<p style={{fontSize:9,color:$.txtM,margin:'1px 0 0',textTransform:'uppercase'}}>{t.x}</p>}</button>)}
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>{I.warn($.acc,14)}<p style={{fontSize:desk?14:18,fontWeight:700,color:$.h,margin:0}}>Main Skin Concerns</p></div>
              <p style={{fontSize:12,color:$.txtM,margin:'0 0 10px'}}>Select all that apply.</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {['Acne & Breakouts','Scarring','Hyperpigmentation','Fine Lines & Wrinkles','Rosacea & Redness','Dryness & Flaking','Oiliness','Large Pores','Sun Damage','Texture & Dullness'].map(c=><button key={c} type="button" onClick={()=>{const x=fd.concerns||[];set('concerns',x.includes(c)?x.filter(z=>z!==c):[...x,c])}} style={{padding:desk?'6px 14px':'10px 20px',borderRadius:99,fontSize:desk?12:15,fontWeight:600,border:(fd.concerns||[]).includes(c)?`2px solid ${$.acc}`:`2px solid ${$.bdr}`,background:(fd.concerns||[]).includes(c)?'rgba(200,163,76,0.08)':$.card,color:(fd.concerns||[]).includes(c)?$.acc:$.txtM,cursor:'pointer'}}>{c}</button>)}
              </div>
            </div>
            <Q label="Active skin infection?" name="skinInfection" value={fd.skinInfection} onChange={set} d={desk}/>
            <Q label="Tattoos or permanent makeup in treatment area?" name="tattoos" value={fd.tattoos} onChange={set} d={desk}/>
            <Q label="Previous adverse reactions to skin treatments?" name="adverseReactions" value={fd.adverseReactions} onChange={set} detail dLabel="What happened?" dVal={fd.adverseReactionsDetail} dChange={set} d={desk}/>
            <Alerts blocks={alerts.blocks} flags={alerts.flags}/>
          </div>}

          {step===4&&<div>
            <h2 style={{fontSize:desk?22:24,fontWeight:700,color:$.h,margin:desk?'0 0 4px':'0 0 8px'}}>Lifestyle</h2>
            <p style={{fontSize:desk?13:16,color:$.txtM,margin:desk?'0 0 20px':'0 0 24px'}}>Sun exposure and lifestyle factors affect treatment safety.</p>
            <Q label="Significant sun exposure in the last 2 weeks?" name="sunburn" value={fd.sunburn} onChange={set} d={desk}/>
            <Q label="Sunbed use in the last 4 weeks?" name="sunbed" value={fd.sunbed} onChange={set} d={desk}/>
            <Q label="Currently have a tan (natural or self-tan)?" name="tan" value={fd.tan} onChange={set} d={desk}/>
            <Q label="Planned sun exposure in next 4 weeks?" sub="Holiday, outdoor event etc." name="plannedSun" value={fd.plannedSun} onChange={set} d={desk}/>
            <Q label="Do you smoke?" sub="Affects wound healing." name="smoker" value={fd.smoker} onChange={set} d={desk}/>
            <Alerts blocks={alerts.blocks} flags={alerts.flags}/>
          </div>}

          {step===5&&<div>
            <h2 style={{fontSize:desk?22:24,fontWeight:700,color:$.h,margin:desk?'0 0 4px':'0 0 8px'}}>Legal Consent & Signature</h2>
            <p style={{fontSize:desk?13:16,color:$.txtM,margin:desk?'0 0 20px':'0 0 24px'}}>Please review each statement and provide your digital signature.</p>
            {alerts.blocks.length>0&&<Alerts blocks={alerts.blocks} flags={alerts.flags}/>}
            <div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:10,padding:20,marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:14}}>{I.shield($.acc,14)}<p style={{fontSize:desk?14:18,fontWeight:700,color:$.h,margin:0}}>Terms of Service</p></div>
              <CK label="Information Accuracy" sub="I confirm all information provided is accurate and complete." checked={fd.consent1} onChange={()=>set('consent1',!fd.consent1)} d={desk}/>
              <CK label="Medical Disclosure" sub="I have disclosed all allergies, conditions, and medications. Withholding info may lead to adverse reactions." checked={fd.consent2} onChange={()=>set('consent2',!fd.consent2)} d={desk}/>
              <CK label="Treatment Consent" sub="I authorize the recommended procedures. Results may vary and are not guaranteed." checked={fd.consent3} onChange={()=>set('consent3',!fd.consent3)} d={desk}/>
              <CK label="Privacy Policy" sub="I consent to storage of my personal and medical data for treatment purposes." checked={fd.consent4} onChange={()=>set('consent4',!fd.consent4)} d={desk}/>
            </div>
            <SigPad onSign={s=>set('signed',s)} desk={desk}/>
          </div>}
        </div>
      </div>
      {/* Nav buttons */}
      <div style={{borderTop:`1px solid ${$.bdr}`,padding:'16px 20px',flexShrink:0}}>
        <div style={{maxWidth:680,margin:'0 auto',display:'flex',justifyContent:'space-between'}}>
          {step>0?<button onClick={()=>goStep(step-1)} style={{padding:desk?'8px 20px':'12px 24px',borderRadius:99,border:`1px solid ${$.bdr}`,background:$.card,fontSize:desk?12:15,fontWeight:600,color:$.acc,cursor:'pointer',fontFamily:$.f,display:'flex',alignItems:'center',gap:5}}>{I.back($.acc,12)} Previous</button>:<div/>}
          {step<5?<button onClick={()=>canProceed()&&goStep(step+1)} disabled={!canProceed()} style={{padding:desk?'8px 24px':'12px 28px',borderRadius:99,border:'none',background:canProceed()?$.acc:$.bdr,color:canProceed()?'#fff':$.txtL,fontSize:desk?12:15,fontWeight:700,cursor:canProceed()?'pointer':'not-allowed',fontFamily:$.f,display:'flex',alignItems:'center',gap:5}}>Continue {I.arr('#fff',12)}</button>
          :<button onClick={()=>canProceed()&&submitForm()} disabled={!canProceed()||loading} style={{padding:desk?'8px 24px':'12px 28px',borderRadius:99,border:'none',background:canProceed()&&!loading?$.acc:$.bdr,color:canProceed()?'#fff':$.txtL,fontSize:desk?12:15,fontWeight:700,cursor:canProceed()?'pointer':'not-allowed',fontFamily:$.f}}>{loading?'Submitting...':'Submit Form'}</button>}
        </div>
      </div>
    </Shell>
  )

  // ═══════════════════════════════════════════════════════════════
  // BOOKINGS — past visits + upcoming + book again
  // ═══════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════
  // BOOKINGS — calendar + service/staff picker + history
  // ═══════════════════════════════════════════════════════════════
  if(view==='bookings'){
    // Calendar helper
    const today=new Date()
    const calMonth=bookDate?new Date(bookDate+'T00:00:00'):today
    const y=calMonth.getFullYear(),m=calMonth.getMonth()
    const firstDay=new Date(y,m,1).getDay()||7 // Mon=1
    const daysInMonth=new Date(y,m+1,0).getDate()
    const monthName=calMonth.toLocaleDateString('en-GB',{month:'long',year:'numeric'})
    const calDays=[]
    for(let i=1;i<firstDay;i++)calDays.push(null)
    for(let d=1;d<=daysInMonth;d++)calDays.push(d)
    const todayStr=today.toISOString().split('T')[0]
    const selDay=bookDate?parseInt(bookDate.split('-')[2]):null
    const shiftMonth=(dir)=>{const nd=new Date(y,m+dir,1);setBookDate(nd.toISOString().split('T')[0].slice(0,8)+'01');setBookTime('');setSlots([])}
    const pickDay=(d)=>{const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;setBookDate(ds);setBookTime('');if(bookSvc)loadSlots(bookSvc.id,ds)}

    return(
      <Shell tab="bookings">
        <TopBar/>
        <div style={{flex:1,overflowY:'auto',paddingBottom:desk?0:80}}>
          <div style={{maxWidth:1000,margin:'0 auto',padding:desk?'24px 24px 32px':'16px 12px'}}>
            <h1 style={{fontSize:desk?24:22,fontWeight:700,color:$.h,margin:'0 0 4px'}}>My Bookings</h1>
            <p style={{fontSize:desk?13:15,color:$.txtM,margin:'0 0 20px'}}>Book treatments, view upcoming and past appointments.</p>

            {bookStep==='done'?(
              <div style={{textAlign:'center',padding:32,background:$.card,borderRadius:12,border:`1px solid ${$.bdr}`,marginBottom:24}}>
                <div style={{width:48,height:48,borderRadius:99,background:'rgba(34,197,94,0.08)',border:'2px solid rgba(34,197,94,0.2)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>{I.chk($.ok,24)}</div>
                <h3 style={{fontSize:desk?18:20,fontWeight:700,color:$.h,margin:'0 0 6px'}}>Booking Confirmed!</h3>
                <p style={{fontSize:desk?13:15,color:$.txtM,margin:'0 0 20px'}}>Your appointment for {bookSvc?.name} on {bookDate} at {bookTime} has been confirmed.</p>
                <button onClick={()=>{setBookStep('list');setBookSvc(null);setBookDate(todayStr);setBookTime('')}} style={{padding:desk?'8px 24px':'12px 28px',borderRadius:99,border:'none',background:$.acc,color:'#fff',fontSize:desk?13:15,fontWeight:700,cursor:'pointer',fontFamily:$.f}}>Done</button>
              </div>
            ):(
              <div style={desk?{display:'flex',gap:24,alignItems:'flex-start',marginBottom:24}:{marginBottom:24}}>
                {/* Left: Service + Staff + Confirm */}
                <div style={{flex:desk?'0 0 320px':'auto',marginBottom:desk?0:16}}>
                  <h3 style={{fontSize:desk?14:16,fontWeight:700,color:$.h,margin:'0 0 8px'}}>1. Choose Treatment</h3>
                  {services.length===0?<p style={{fontSize:desk?12:14,color:$.txtM}}>Loading services...</p>:(
                    <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
                      {services.map(s=>(
                        <button key={s.id} onClick={()=>{setBookSvc(s);setBookTime('');if(bookDate)loadSlots(s.id,bookDate)}} style={{textAlign:'left',background:bookSvc?.id===s.id?'rgba(200,163,76,0.08)':$.card,border:bookSvc?.id===s.id?`2px solid ${$.acc}`:`1px solid ${$.bdr}`,borderRadius:10,padding:desk?'10px 12px':'12px 14px',cursor:'pointer',fontFamily:$.f}}>
                          <p style={{fontSize:desk?13:15,fontWeight:600,color:$.h,margin:0}}>{s.name}</p>
                          <div style={{display:'flex',gap:8,marginTop:2}}><span style={{fontSize:desk?11:12,color:$.txtM}}>{s.duration}min</span><span style={{fontSize:desk?11:12,fontWeight:600,color:$.acc}}>£{s.price}</span></div>
                        </button>
                      ))}
                    </div>
                  )}

                  {bookSvc&&slotStaff.length>0&&<div style={{marginBottom:16}}>
                    <h3 style={{fontSize:desk?14:16,fontWeight:700,color:$.h,margin:'0 0 8px'}}>2. Practitioner</h3>
                    <select value={bookStaff} onChange={e=>setBookStaff(e.target.value)} style={{width:'100%',padding:desk?'8px 12px':'12px 14px',borderRadius:10,border:`1px solid ${$.bdr}`,fontSize:desk?12:15,background:$.card,color:$.h,fontFamily:$.f}}>
                      <option value="">Any available</option>
                      {slotStaff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>}

                  {bookSvc&&bookDate&&bookTime&&(
                    <div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:10,padding:desk?14:16,marginBottom:8}}>
                      <p style={{fontSize:desk?12:14,fontWeight:700,color:$.h,margin:'0 0 6px'}}>Booking Summary</p>
                      <p style={{fontSize:desk?12:13,color:$.txtM,margin:'2px 0'}}>{bookSvc.name} — {bookSvc.duration}min</p>
                      <p style={{fontSize:desk?12:13,color:$.txtM,margin:'2px 0'}}>{bookDate} at {bookTime}</p>
                      <p style={{fontSize:desk?13:15,fontWeight:700,color:$.acc,margin:'4px 0 0'}}>£{bookSvc.price}</p>
                      {err&&<p style={{fontSize:11,color:$.err,marginTop:6}}>{err}</p>}
                      <button onClick={doBook} disabled={bookLoading} style={{width:'100%',marginTop:10,padding:desk?'9px 0':'12px 0',borderRadius:99,border:'none',background:$.acc,color:'#fff',fontSize:desk?13:15,fontWeight:700,cursor:bookLoading?'wait':'pointer',fontFamily:$.f,opacity:bookLoading?0.6:1}}>{bookLoading?'Booking...':'Confirm Booking'}</button>
                    </div>
                  )}
                </div>

                {/* Right: Calendar + Time slots */}
                <div style={{flex:1,minWidth:0}}>
                  <h3 style={{fontSize:desk?14:16,fontWeight:700,color:$.h,margin:'0 0 8px'}}>{bookSvc?'3. Pick Date & Time':'Select a treatment first'}</h3>
                  {/* Month nav */}
                  <div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:12,overflow:'hidden'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:desk?'10px 14px':'12px 14px',borderBottom:`1px solid ${$.bdr}`}}>
                      <button onClick={()=>shiftMonth(-1)} style={{background:'none',border:'none',cursor:'pointer',padding:4}}>{I.back($.txtM,16)}</button>
                      <span style={{fontSize:desk?14:16,fontWeight:700,color:$.h}}>{monthName}</span>
                      <button onClick={()=>shiftMonth(1)} style={{background:'none',border:'none',cursor:'pointer',padding:4}}>{I.arr($.txtM,16)}</button>
                    </div>
                    {/* Day headers */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',textAlign:'center',padding:'6px 8px'}}>
                      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><span key={d} style={{fontSize:desk?10:11,fontWeight:600,color:$.txtL,padding:'4px 0'}}>{d}</span>)}
                    </div>
                    {/* Days grid */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,padding:'0 8px 10px'}}>
                      {calDays.map((d,i)=>{
                        if(!d)return<div key={i}/>
                        const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                        const isPast=ds<todayStr
                        const isSel=selDay===d&&bookDate?.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)
                        const isToday=ds===todayStr
                        return<button key={i} disabled={isPast||!bookSvc} onClick={()=>pickDay(d)} style={{
                          width:'100%',aspectRatio:'1',borderRadius:99,border:isSel?`2px solid ${$.acc}`:isToday?`1px solid ${$.acc}40`:'1px solid transparent',
                          background:isSel?$.acc:isToday?'rgba(200,163,76,0.06)':'transparent',
                          color:isSel?'#fff':isPast?$.txtL:$.h,fontSize:desk?12:14,fontWeight:isSel||isToday?700:500,
                          cursor:isPast||!bookSvc?'default':'pointer',opacity:isPast?0.4:1,fontFamily:$.f,
                        }}>{d}</button>
                      })}
                    </div>
                  </div>

                  {/* Time slots */}
                  {bookDate&&bookSvc&&(
                    <div style={{marginTop:12}}>
                      <p style={{fontSize:desk?13:15,fontWeight:600,color:$.h,margin:'0 0 8px'}}>Available Times</p>
                      {slots.length===0?<p style={{fontSize:desk?12:14,color:$.txtM}}>No slots available on this date.</p>:(
                        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                          {slots.map(s=><button key={s} onClick={()=>setBookTime(s)} style={{
                            padding:desk?'7px 14px':'9px 18px',borderRadius:99,
                            border:bookTime===s?`2px solid ${$.acc}`:`1px solid ${$.bdr}`,
                            background:bookTime===s?'rgba(200,163,76,0.08)':$.card,
                            color:bookTime===s?$.acc:$.h,fontSize:desk?12:14,fontWeight:600,cursor:'pointer',fontFamily:$.f
                          }}>{s}</button>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Upcoming */}
            <h3 style={{fontSize:desk?15:17,fontWeight:700,color:$.h,margin:'0 0 10px'}}>Upcoming</h3>
            {upcoming.length>0?upcoming.map((b,i)=>(
              <div key={i} style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:12,padding:desk?16:14,marginBottom:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',gap:14,alignItems:'center'}}>
                  <div style={{width:48,height:48,borderRadius:10,background:$.bg,border:`1px solid ${$.bdr}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:10,fontWeight:700,color:$.txtM,textTransform:'uppercase'}}>{b.month||'TBC'}</span>
                    <span style={{fontSize:17,fontWeight:700,color:$.h,lineHeight:1}}>{b.day||'—'}</span>
                  </div>
                  <div>
                    <p style={{fontSize:desk?14:16,fontWeight:600,color:$.h,margin:0}}>{b.service}</p>
                    <div style={{display:'flex',gap:10,marginTop:2}}>
                      <span style={{fontSize:desk?12:13,color:$.txtM,display:'flex',alignItems:'center',gap:3}}>{I.clock($.txtM,11)} {b.time}</span>
                      {b.staff&&<span style={{fontSize:desk?12:13,color:$.txtM,display:'flex',alignItems:'center',gap:3}}>{I.user($.txtM,11)} {b.staff}</span>}
                    </div>
                  </div>
                </div>
                <span style={{padding:'3px 8px',borderRadius:99,fontSize:10,fontWeight:700,background:'rgba(16,185,129,0.08)',color:'#10B981',border:'1px solid rgba(16,185,129,0.15)'}}>Confirmed</span>
              </div>
            )):(
              <div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:12,padding:desk?20:16,textAlign:'center',marginBottom:16}}>
                <p style={{fontSize:desk?13:15,color:$.txtM,margin:0}}>No upcoming appointments. Use the calendar above to book.</p>
              </div>
            )}

            {/* History */}
            <h3 style={{fontSize:desk?15:17,fontWeight:700,color:$.h,margin:'16px 0 10px'}}>Treatment History</h3>
            {pastBookings.length>0?pastBookings.map((b,i)=>(
              <div key={i} style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:12,padding:'12px 16px',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <p style={{fontSize:desk?14:15,fontWeight:600,color:$.h,margin:0}}>{b.service}</p>
                  <p style={{fontSize:desk?12:13,color:$.txtM,margin:'2px 0 0'}}>{b.date}{b.staff?` · ${b.staff}`:''}</p>
                </div>
                <div style={{textAlign:'right'}}>
                  {b.price&&<p style={{fontSize:desk?14:15,fontWeight:700,color:$.h,margin:0}}>£{b.price}</p>}
                  <span style={{fontSize:10,fontWeight:700,color:$.ok,textTransform:'uppercase'}}>Completed</span>
                </div>
              </div>
            )):(
              <div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:12,padding:16,textAlign:'center'}}>
                <p style={{fontSize:desk?13:15,color:$.txtM,margin:0}}>No past appointments yet.</p>
              </div>
            )}
          </div>
        </div>
      </Shell>
    )
  }

  // MESSAGES — ticketing + AI support
  // ═══════════════════════════════════════════════════════════════
  if(view==='messages')return(
    <Shell tab="messages">
      <TopBar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',paddingBottom:desk?0:80}}>
        {/* Tab bar: Chat / AI Support */}
        <div style={{display:'flex',borderBottom:`1px solid ${$.bdr}`,background:$.card,flexShrink:0}}>
          {[{id:'chat',label:'Messages'},{id:'ai',label:'AI Support'}].map(t=>(
            <button key={t.id} onClick={()=>setMsgTab(t.id)} style={{flex:1,padding:desk?'10px 0':'12px 0',border:'none',borderBottom:msgTab===t.id?`2px solid ${$.acc}`:'2px solid transparent',background:'none',fontSize:desk?13:15,fontWeight:msgTab===t.id?700:500,color:msgTab===t.id?$.h:$.txtM,cursor:'pointer',fontFamily:$.f}}>{t.label}</button>
          ))}
        </div>

        {msgTab==='chat'?(
          <div style={{flex:1,display:'flex',flexDirection:'column'}}>
            {/* Messages list */}
            <div style={{flex:1,overflowY:'auto',padding:desk?'16px 24px':'12px'}}>
              {msgs.length===0?(
                <div style={{textAlign:'center',paddingTop:48}}>
                  <div style={{width:48,height:48,borderRadius:12,background:'rgba(200,163,76,0.08)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>{I.msg($.acc,22)}</div>
                  <p style={{fontSize:desk?14:16,fontWeight:600,color:$.h}}>No messages yet</p>
                  <p style={{fontSize:desk?12:14,color:$.txtM,margin:'4px 0 0'}}>Send a message to {biz?.name} and they'll reply here.</p>
                </div>
              ):msgs.map((m,i)=>(
                <div key={i} style={{display:'flex',justifyContent:m.from==='me'?'flex-end':'flex-start',marginBottom:8}}>
                  <div style={{maxWidth:'75%',background:m.from==='me'?$.acc:'rgba(200,163,76,0.08)',color:m.from==='me'?'#fff':$.h,padding:desk?'10px 14px':'12px 16px',borderRadius:m.from==='me'?'16px 16px 4px 16px':'16px 16px 16px 4px'}}>
                    <p style={{fontSize:desk?13:15,margin:0,lineHeight:1.5}}>{m.text}</p>
                    <p style={{fontSize:10,margin:'4px 0 0',opacity:0.7,textAlign:'right'}}>{m.time}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Input */}
            <div style={{borderTop:`1px solid ${$.bdr}`,background:$.card,padding:desk?'12px 24px':'10px 12px',display:'flex',gap:8,flexShrink:0}}>
              <input value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} placeholder="Type a message..." style={{flex:1,padding:desk?'10px 14px':'12px 16px',borderRadius:99,border:`1px solid ${$.bdr}`,fontSize:desk?13:15,outline:'none',background:$.bg,color:$.h,fontFamily:$.f}}/>
              <button onClick={sendMsg} style={{width:desk?40:44,height:desk?40:44,borderRadius:99,border:'none',background:$.acc,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>{I.arr('#fff',16)}</button>
            </div>
          </div>
        ):(
          <div style={{flex:1,overflowY:'auto',padding:desk?'24px':'16px 12px'}}>
            <div style={{maxWidth:600,margin:'0 auto',textAlign:'center',paddingTop:32}}>
              <div style={{width:56,height:56,borderRadius:14,background:'rgba(200,163,76,0.08)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>{I.shield($.acc,28)}</div>
              <h2 style={{fontSize:desk?20:22,fontWeight:700,color:$.h,margin:'0 0 8px'}}>AI Support</h2>
              <p style={{fontSize:desk?13:15,color:$.txtM,lineHeight:1.6,margin:'0 0 20px'}}>Get instant answers about treatments, aftercare, booking policies, and more. Our AI assistant is trained specifically for {biz?.name}.</p>
              <div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:12,padding:desk?20:16,textAlign:'left'}}>
                <p style={{fontSize:desk?13:15,fontWeight:600,color:$.h,margin:'0 0 10px'}}>Common questions:</p>
                {['What should I do before my appointment?','How do I reschedule a booking?','What are the aftercare instructions?','What treatments do you offer?'].map((q,i)=>(
                  <button key={i} style={{display:'block',width:'100%',textAlign:'left',padding:desk?'8px 0':'10px 0',border:'none',borderBottom:i<3?`1px solid ${$.bdr}`:'none',background:'none',fontSize:desk?12:14,color:$.acc,cursor:'pointer',fontFamily:$.f,fontWeight:500}}>{q}</button>
                ))}
              </div>
              <p style={{fontSize:11,color:$.txtL,marginTop:16}}>AI responses are based on {biz?.name}'s services and policies.</p>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )

  // ═══════════════════════════════════════════════════════════════
  // PROFILE — history, spend, treatments, settings
  // ═══════════════════════════════════════════════════════════════
  if(view==='profile')return(
    <Shell tab="profile">
      <TopBar/>
      <div style={{flex:1,overflowY:'auto',paddingBottom:desk?0:80}}>
        <div style={{maxWidth:800,margin:'0 auto',padding:desk?'24px 24px 32px':'16px 12px'}}>
          {/* Profile header */}
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24}}>
            <div style={{width:desk?64:56,height:desk?64:56,borderRadius:99,border:`3px solid ${$.acc}`,background:$.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:desk?24:20,fontWeight:700,color:$.acc,flexShrink:0}}>{(user?.name||'?').charAt(0)}</div>
            <div>
              <h1 style={{fontSize:desk?22:20,fontWeight:700,color:$.h,margin:0}}>{user?.name||'User'}</h1>
              <p style={{fontSize:desk?13:14,color:$.txtM,margin:'2px 0 0'}}>{user?.email||''}</p>
              {user?.phone&&<p style={{fontSize:desk?12:13,color:$.txtM,margin:'1px 0 0'}}>{user.phone}</p>}
            </div>
          </div>

          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:desk?12:8,marginBottom:24}}>
            {[
              {label:'Total Visits',value:pastBookings.length},
              {label:'Upcoming',value:upcoming.length},
              {label:'Total Spent',value:pastBookings.reduce((s,b)=>s+(parseFloat(b.price)||0),0).toFixed(2),prefix:'£'},
            ].map((s,i)=>(
              <div key={i} style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:12,padding:desk?16:12,textAlign:'center'}}>
                <p style={{fontSize:desk?22:20,fontWeight:700,color:$.h,margin:0}}>{s.prefix||''}{s.value}</p>
                <p style={{fontSize:desk?11:12,color:$.txtM,margin:'2px 0 0'}}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* My details */}
          <h3 style={{fontSize:desk?15:17,fontWeight:700,color:$.h,margin:'0 0 12px'}}>My Details</h3>
          <div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:12,marginBottom:24}}>
            {[
              {label:'Full Name',value:user?.name},
              {label:'Email',value:user?.email},
              {label:'Phone',value:user?.phone||'Not set'},
            ].map((d,i)=>(
              <div key={i} style={{padding:desk?'14px 16px':'14px 16px',borderBottom:i<2?`1px solid ${$.bdr}`:'none'}}>
                <p style={{fontSize:desk?11:12,color:$.txtM,margin:'0 0 2px'}}>{d.label}</p>
                <p style={{fontSize:desk?14:16,fontWeight:500,color:$.h,margin:0}}>{d.value||'—'}</p>
              </div>
            ))}
          </div>

          {/* Recent treatments */}
          <h3 style={{fontSize:desk?15:17,fontWeight:700,color:$.h,margin:'0 0 12px'}}>Recent Treatments</h3>
          {pastBookings.length>0?pastBookings.slice(0,5).map((b,i)=>(
            <div key={i} style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:12,padding:'12px 16px',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <p style={{fontSize:desk?14:15,fontWeight:600,color:$.h,margin:0}}>{b.service}</p>
                <p style={{fontSize:desk?12:13,color:$.txtM,margin:'2px 0 0'}}>{b.date}{b.staff?` · ${b.staff}`:''}</p>
              </div>
              {b.price&&<span style={{fontSize:desk?14:15,fontWeight:700,color:$.h}}>£{b.price}</span>}
            </div>
          )):(
            <div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:12,padding:20,textAlign:'center'}}>
              <p style={{fontSize:desk?13:15,color:$.txtM,margin:0}}>No treatments yet.</p>
            </div>
          )}

          {/* Notification settings */}
          <h3 style={{fontSize:desk?15:17,fontWeight:700,color:$.h,margin:'24px 0 12px'}}>Notification Settings</h3>
          <div style={{background:$.card,border:`1px solid ${$.bdr}`,borderRadius:12}}>
            {[{k:'appointment_reminders',label:'Appointment reminders'},{k:'aftercare',label:'Treatment aftercare'},{k:'promotions',label:'Promotional offers'},{k:'booking_confirmations',label:'Booking confirmations'}].map((n,i)=>(
              <div key={i} style={{padding:'12px 16px',borderBottom:i<3?`1px solid ${$.bdr}`:'none',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:desk?13:15,color:$.h}}>{n.label}</span>
                <Toggle value={notifPrefs[n.k]?'yes':'no'} onChange={()=>toggleNotif(n.k)} d={desk}/>
              </div>
            ))}
          </div>

          {/* Sign out */}
          <button onClick={logout} style={{width:'100%',marginTop:24,padding:desk?'10px 0':'14px 0',borderRadius:99,border:`1px solid ${$.bdr}`,background:'transparent',fontSize:desk?13:16,fontWeight:600,color:$.txtM,cursor:'pointer',fontFamily:$.f}}>Sign Out</button>
          <p style={{textAlign:'center',fontSize:11,color:$.txtL,marginTop:12}}>Powered by <b style={{color:$.acc}}>ReeveOS</b></p>
        </div>
      </div>
    </Shell>
  )

  return null
}
