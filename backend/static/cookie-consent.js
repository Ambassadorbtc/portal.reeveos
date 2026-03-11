/**
 * ReeveNow Cookie Consent Banner
 * Only shown when third-party scripts (GA4, Meta Pixel, TikTok Pixel) are configured.
 * If only our tracker is active, no banner is needed (we use no cookies).
 * Consent stored in sessionStorage only — resets each visit for maximum privacy.
 */
(function(){
  "use strict";
  var sc=document.currentScript;
  if(!sc)return;

  // Only show if third-party pixels are configured
  var ga4=sc.getAttribute("data-ga4")||"";
  var meta=sc.getAttribute("data-meta")||"";
  var tiktok=sc.getAttribute("data-tiktok")||"";
  if(!ga4&&!meta&&!tiktok)return;

  // Check if consent already given this session
  var consent=sessionStorage.getItem("rn_consent");
  if(consent==="true"){loadThirdParty();return;}
  if(consent==="false")return;

  // Build banner
  var banner=document.createElement("div");
  banner.id="rn-cookie-banner";
  banner.setAttribute("role","dialog");
  banner.setAttribute("aria-label","Cookie consent");
  banner.style.cssText="position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #ddd;padding:1rem 1.5rem;z-index:9999;font-family:var(--font-body,sans-serif);font-size:0.9rem;box-shadow:0 -2px 10px rgba(0,0,0,0.08)";

  var inner=document.createElement("div");
  inner.style.cssText="max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem";

  var text=document.createElement("p");
  text.style.cssText="margin:0;color:#333;flex:1;min-width:200px";
  text.textContent="We use cookies to improve your experience.";

  var btnWrap=document.createElement("div");
  btnWrap.style.cssText="display:flex;gap:0.5rem;flex-shrink:0";

  function makeBtn(label,primary,accepted){
    var btn=document.createElement("button");
    btn.textContent=label;
    btn.style.cssText="padding:0.5rem 1rem;border-radius:4px;cursor:pointer;font-family:var(--font-body,sans-serif);font-size:0.875rem;font-weight:600;transition:opacity 0.15s";
    if(primary){
      btn.style.border="none";
      btn.style.background="var(--brand-accent,#C9A84C)";
      btn.style.color="#fff";
    }else{
      btn.style.border="1px solid #ccc";
      btn.style.background="#fff";
      btn.style.color="#333";
    }
    btn.addEventListener("click",function(){
      sessionStorage.setItem("rn_consent",accepted?"true":"false");
      banner.remove();
      if(accepted)loadThirdParty();
    });
    return btn;
  }

  btnWrap.appendChild(makeBtn("Reject All",false,false));
  btnWrap.appendChild(makeBtn("Accept All",true,true));
  inner.appendChild(text);
  inner.appendChild(btnWrap);
  banner.appendChild(inner);
  document.body.appendChild(banner);

  function loadThirdParty(){
    if(ga4){
      var gs=document.createElement("script");
      gs.src="https://www.googletagmanager.com/gtag/js?id="+ga4;
      gs.async=true;
      document.head.appendChild(gs);
      window.dataLayer=window.dataLayer||[];
      function gtag(){window.dataLayer.push(arguments)}
      gtag("js",new Date());gtag("config",ga4);
    }
    if(meta){
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
      fbq("init",meta);fbq("track","PageView");
    }
    if(tiktok){
      !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e+\"_\"+n]=1;var o=d.createElement(\"script\");o.type=\"text/javascript\";o.async=!0;o.src=i+\"?sdkid=\"+e+\"&lib=\"+t;var a=d.getElementsByTagName(\"script\")[0];a.parentNode.insertBefore(o,a)};}(window,document,"ttq");
      ttq.load(tiktok);ttq.page();
    }
  }
})();
