/**
 * ReeveNow Site Analytics Tracker
 * GDPR compliant — NO cookies, NO localStorage, sessionStorage only, NO PII.
 */
(function(){
  "use strict";
  var sc=document.currentScript;
  if(!sc)return;
  var BID=sc.getAttribute("data-business")||"";
  var PAGE=sc.getAttribute("data-page")||"";
  if(!BID)return;

  var SID=sessionStorage.getItem("rn_sid");
  if(!SID){
    SID="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){
      var r=Math.random()*16|0;return(c==="x"?r:(r&0x3|0x8)).toString(16);
    });
    sessionStorage.setItem("rn_sid",SID);
  }

  var events=[];
  var MAX_EVENTS=500;
  var MAX_CLICKS=200;
  var FLUSH_MS=5000;
  var ENDPOINT="/website/public/track";
  var scrollThresholds={25:false,50:false,75:false,100:false};
  var vw=window.innerWidth||0;
  var vh=window.innerHeight||0;
  var flushing=false;
  var clickCount=0;
  var pageStart=Date.now();
  var lastFlush=0;

  function push(evt){
    if(events.length>=MAX_EVENTS)return;
    evt.timestamp=Date.now();
    events.push(evt);
  }

  function cssSelector(el){
    if(!el||!el.tagName)return"";
    var tag=el.tagName.toLowerCase();
    if(el.id)return tag+"#"+el.id;
    if(el.className&&typeof el.className==="string"){
      var cls=el.className.trim().split(/\s+/).slice(0,2).join(".");
      if(cls)return tag+"."+cls;
    }
    return tag;
  }

  function flush(){
    if(events.length===0||flushing)return;
    var now=Date.now();
    if(now-lastFlush<FLUSH_MS&&document.visibilityState!=="hidden")return;
    lastFlush=now;
    var payload=JSON.stringify({
      business_id:BID,
      page_slug:PAGE,
      session_id:SID,
      events:events.splice(0),
      referrer:document.referrer||null,
      device:vw<768?"mobile":vw<1024?"tablet":"desktop",
      utm_source:getParam("utm_source"),
      utm_medium:getParam("utm_medium"),
      utm_campaign:getParam("utm_campaign")
    });
    if(navigator.sendBeacon){
      navigator.sendBeacon(ENDPOINT,new Blob([payload],{type:"application/json"}));
    }else{
      flushing=true;
      var xhr=new XMLHttpRequest();
      xhr.open("POST",ENDPOINT);
      xhr.setRequestHeader("Content-Type","application/json");
      xhr.onloadend=function(){flushing=false;};
      xhr.send(payload);
    }
  }

  function getParam(k){
    try{return new URL(location.href).searchParams.get(k)||null;}catch(e){return null;}
  }

  // Track pageview
  push({type:"pageview",viewport_width:vw,viewport_height:vh});

  // Track clicks (max 200 per session)
  document.addEventListener("click",function(e){
    if(clickCount>=MAX_CLICKS)return;
    clickCount++;
    push({type:"click",x:e.pageX,y:e.pageY,element:cssSelector(e.target)});
  },true);

  // Track scroll depth
  function checkScroll(){
    var docH=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
    var scrolled=window.scrollY+vh;
    var pct=docH>0?Math.round((scrolled/docH)*100):0;
    [25,50,75,100].forEach(function(t){
      if(pct>=t&&!scrollThresholds[t]){
        scrollThresholds[t]=true;
        push({type:"scroll",scroll_depth:t});
      }
    });
  }
  var scrollTimer;
  window.addEventListener("scroll",function(){
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(checkScroll,150);
  },{passive:true});

  // Time on page — record on unload
  function sendTimeOnPage(){
    var seconds=Math.round((Date.now()-pageStart)/1000);
    if(seconds>0&&seconds<86400){
      push({type:"time_on_page",seconds:seconds});
    }
    flush();
  }

  // Periodic flush
  setInterval(function(){
    if(events.length>0)flush();
  },FLUSH_MS);

  // Flush on page unload
  window.addEventListener("visibilitychange",function(){
    if(document.visibilityState==="hidden")sendTimeOnPage();
  });
  window.addEventListener("pagehide",sendTimeOnPage);
})();
