/**
 * Rezvo AI Chat Widget v3 — Claude-powered
 * Calls /api/chatbot/chat for real AI, falls back to keywords if offline.
 * Session persistence, follow-up suggestions, scroll-to-top.
 */
(function () {
  'use strict';
  if (window.__rezvoChat) return;
  window.__rezvoChat = true;

  var FOREST = '#1B4332';
  var MINT = '#52B788';
  var API_URL = '/api/chatbot/chat';
  var STORE_KEY = 'rezvo_chat_v3';

  /* ─── Keyword Fallback (offline mode) ─── */
  var FALLBACK_KB = [
    {k:['price','pricing','cost','plan','free','subscription'],a:"**Rezvo Pricing:**\n\n• **Free** — £0/mo · 1 staff, 100 bookings\n• **Starter** — £8.99/mo · 3 staff, reminders\n• **Growth** — £29/mo · 5 staff, deposits, CRM\n• **Scale** — £59/mo · Unlimited, floor plans, white-label\n• **Enterprise** — Custom\n\nAll plans: zero commission. 30-day free trial."},
    {k:['commission','zero commission','fees'],a:"**Zero commission, always.** Rezvo charges a flat monthly fee. 100% of your revenue stays yours. Payments go directly to your bank via Stripe Connect."},
    {k:['restaurant','table','floor plan','covers','dining'],a:"**Restaurant features:** Floor plan view, covers tracking, service periods, online booking widget, kitchen orders board, delivery via Uber Direct, analytics."},
    {k:['delivery','uber','deliveroo','just eat','ordering','takeaway'],a:"**Zero-commission delivery via Uber Direct.** Customers order from YOUR branded page. Payments go to YOUR Stripe. No 25-35% marketplace commission."},
    {k:['booking','calendar','appointment','reserve'],a:"**Smart booking:** Online 24/7, drag-and-drop calendar, deposits, SMS/email reminders, walk-in management, multi-staff columns."},
    {k:['stripe','payment','pay','card','deposit','refund'],a:"**Stripe Connect:** Each business connects their own Stripe. Payments go directly to the business. Rezvo never holds your money. Apple Pay, Google Pay supported."},
    {k:['start','get started','sign up','trial','register'],a:"**Getting started:** Sign up free at rezvo.app (no card needed), set up your profile, go live. 30-day free trial on all plans!"},
    {k:['contact','support','help','email','speak','human'],a:"**Contact us:** Email hello@rezvo.app or visit rezvo.app/contact.html. We typically reply within a few hours. UK-based team."},
    {k:['launch','when','live','ready','available'],a:"We're building toward launch starting with **Nottingham**! No confirmed date yet, but sign up and you'll be first to know. We're working hard on it! 🚀"},
    {k:['opentable','resdiary','thefork','competitor','compare','vs','switch'],a:"**vs OpenTable:** £1-3 per diner + monthly fees. Rezvo: flat fee, zero per-cover.\n**vs Deliveroo:** 25-35% commission. Rezvo + Uber Direct: fraction of the cost.\n**vs ResDiary:** No ordering or delivery. Rezvo includes both."},
    {k:['salon','barber','spa','hair','beauty','trainer','tattoo'],a:"Rezvo works for salons, barbers, spas, personal trainers, tattoo studios, physios, dog groomers, music teachers, and more. Tailored booking flows for each."},
    {k:['directory','find','search','browse','diner'],a:"**rezvo.co.uk** — browse and book local businesses. Even unregistered restaurants appear. Request notifications when your favourite spot joins!"},
    {k:['feature','what can','what do','include','offer'],a:"Online booking, drag-and-drop calendar, floor plans, Stripe payments, CRM, analytics, SMS/email reminders, staff management, online ordering, Uber Direct delivery, white-label branding."},
    {k:['hello','hi','hey','yo','sup','morning','afternoon'],a:"Hey! 👋 I'm the Rezvo AI — the smart one! Ask me anything about the platform, pricing, features, how it works, or anything else. I'm all yours."},
    {k:['who are you','what are you','bot','robot','ai'],a:"I'm Rezvo's AI assistant — I know pretty much everything about the platform. Ask me about pricing, features, how delivery works, competitor comparisons, getting started — whatever's on your mind! 🧠"},
    {k:['joke','funny','bored','laugh'],a:"Why did the restaurant dump Deliveroo? Because 30% commission was no laughing matter! 🥁 ...But seriously, ask me anything about Rezvo!"},
    {k:['thank','thanks','cheers','ta'],a:"You're welcome! 😊 If you need anything else, I'm here. No holidays, no sleep schedule. Living the dream."},
    {k:['bye','goodbye','see you','later'],a:"See ya! 👋 I'll be here whenever you need me. Have a great one!"}
  ];

  function fallbackAnswer(msg) {
    var low = msg.toLowerCase();
    var best = null, bestScore = 0;
    for (var i = 0; i < FALLBACK_KB.length; i++) {
      var score = 0;
      for (var j = 0; j < FALLBACK_KB[i].k.length; j++) {
        if (low.indexOf(FALLBACK_KB[i].k[j]) !== -1) score += FALLBACK_KB[i].k[j].split(' ').length;
      }
      if (score > bestScore) { bestScore = score; best = FALLBACK_KB[i]; }
    }
    return best ? best.a : "I'd love to help with that! For the best answer, drop us a line at **hello@rezvo.app** — the team will get back to you quickly. Or ask me about pricing, features, delivery, or getting started! 😊";
  }

  /* ─── Quick Buttons ─── */
  var QUICK = [
    {e:'💰',l:'Pricing',q:'What are your pricing plans and what do I get on each tier?'},
    {e:'🍽️',l:'Restaurants',q:'What restaurant-specific features does Rezvo offer?'},
    {e:'🚚',l:'Delivery',q:'How does zero-commission delivery work with Uber Direct?'},
    {e:'🚀',l:'Get Started',q:'How do I get started with Rezvo?'},
    {e:'⚔️',l:'vs Competitors',q:'How does Rezvo compare to OpenTable, Deliveroo, and ResDiary?'},
    {e:'📧',l:'Contact',q:'How can I get in touch with the Rezvo team?'}
  ];

  function formatMsg(t) {
    return t
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n• /g, '<br>• ')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n(\d+)\./g, '<br>$1.')
      .replace(/\n/g, '<br>');
  }

  /* ─── Storage ─── */
  function save(history) {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({m:history,ts:Date.now()})); } catch(e){}
  }
  function load() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (Date.now() - d.ts > 60*60*1000) { sessionStorage.removeItem(STORE_KEY); return null; } // 1hr expiry
      return d.m;
    } catch(e) { return null; }
  }

  /* ─── Styles ─── */
  var style = document.createElement('style');
  style.textContent = [
    '#rezvo-chat-fab{position:fixed;bottom:24px;right:24px;z-index:9999;width:60px;height:60px;border-radius:50%;background:'+FOREST+';color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(27,67,50,0.4);transition:all .3s cubic-bezier(.22,1,.36,1)}',
    '#rezvo-chat-fab:hover{transform:scale(1.08);box-shadow:0 8px 32px rgba(27,67,50,0.5)}',
    '#rezvo-chat-fab svg{width:28px;height:28px;transition:transform .3s ease}',
    '#rezvo-chat-fab.open svg.chat-icon{display:none}',
    '#rezvo-chat-fab.open svg.close-icon{display:block}',
    '#rezvo-chat-fab svg.close-icon{display:none}',
    '#rezvo-chat-badge{position:absolute;top:-2px;right:-2px;width:18px;height:18px;border-radius:50%;background:#EF4444;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;animation:rcBounce 2s ease-in-out infinite}',
    '@keyframes rcBounce{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}',
    '#rezvo-chat-panel{position:fixed;bottom:96px;right:24px;z-index:9998;width:400px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 140px);border-radius:20px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,0.2),0 0 0 1px rgba(0,0,0,0.05);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(20px) scale(0.95);pointer-events:none;transition:all .3s cubic-bezier(.22,1,.36,1)}',
    '#rezvo-chat-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}',
    '.rc-header{background:'+FOREST+';padding:16px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0}',
    '.rc-header-avatar{width:40px;height:40px;border-radius:12px;background:'+MINT+';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:'+FOREST+'}',
    '.rc-header-info{flex:1}',
    '.rc-header-info h3{color:#fff;font-size:15px;font-weight:700;margin:0;font-family:"Figtree",system-ui,sans-serif}',
    '.rc-header-info p{color:'+MINT+';font-size:11px;font-weight:600;margin:2px 0 0;opacity:.9}',
    '.rc-header-clear{background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:11px;font-family:"Figtree",system-ui,sans-serif;padding:4px 8px;border-radius:6px;transition:all .2s}',
    '.rc-header-clear:hover{color:#fff;background:rgba(255,255,255,0.1)}',
    '.rc-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#f9fafb}',
    '.rc-messages::-webkit-scrollbar{width:4px}',
    '.rc-messages::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px}',
    '.rc-msg{max-width:85%;padding:12px 16px;border-radius:16px;font-size:13px;line-height:1.6;font-family:"Figtree",system-ui,sans-serif;word-wrap:break-word}',
    '.rc-msg.bot{background:#fff;color:#333;border:1px solid #e5e7eb;border-bottom-left-radius:4px;align-self:flex-start;box-shadow:0 1px 3px rgba(0,0,0,0.04)}',
    '.rc-msg.bot strong{color:'+FOREST+';font-weight:700}',
    '.rc-msg.user{background:'+FOREST+';color:#fff;border-bottom-right-radius:4px;align-self:flex-end}',
    '.rc-msg.typing{background:#fff;border:1px solid #e5e7eb;border-bottom-left-radius:4px;align-self:flex-start;padding:14px 20px}',
    '.rc-msg.followup{background:transparent;border:none;box-shadow:none;padding:8px 0;align-self:flex-start;max-width:100%;font-size:12px;color:#999}',
    '.rc-msg.system{background:transparent;border:none;box-shadow:none;padding:2px 0;align-self:center;font-size:10px;color:#bbb;text-align:center;max-width:100%}',
    '.rc-dots{display:flex;gap:4px}',
    '.rc-dots span{width:7px;height:7px;border-radius:50%;background:#bbb;animation:rcDot 1.4s ease-in-out infinite}',
    '.rc-dots span:nth-child(2){animation-delay:.2s}',
    '.rc-dots span:nth-child(3){animation-delay:.4s}',
    '@keyframes rcDot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}',
    '.rc-inline-quick{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}',
    '.rc-inline-quick button{padding:4px 12px;border-radius:16px;border:1.5px solid #e5e7eb;background:#fff;font-size:10px;font-weight:600;color:'+FOREST+';cursor:pointer;font-family:"Figtree",system-ui,sans-serif;transition:all .2s;white-space:nowrap}',
    '.rc-inline-quick button:hover{border-color:'+MINT+';background:rgba(82,183,136,0.08)}',
    '.rc-input-area{padding:12px 16px;border-top:1px solid #e5e7eb;background:#fff;display:flex;gap:8px;align-items:center;flex-shrink:0}',
    '.rc-input{flex:1;border:1.5px solid #e5e7eb;border-radius:12px;padding:10px 14px;font-size:13px;font-family:"Figtree",system-ui,sans-serif;outline:none;color:#333;transition:border-color .2s}',
    '.rc-input:focus{border-color:'+MINT+'}',
    '.rc-input::placeholder{color:#aaa}',
    '.rc-send{width:38px;height:38px;border-radius:10px;border:none;background:'+FOREST+';color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}',
    '.rc-send:hover{background:'+MINT+';color:'+FOREST+'}',
    '.rc-send:disabled{opacity:.4;cursor:default}',
    '.rc-quick-btns{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 12px;background:#f9fafb}',
    '.rc-quick{padding:6px 14px;border-radius:20px;border:1.5px solid #e5e7eb;background:#fff;font-size:11px;font-weight:600;color:'+FOREST+';cursor:pointer;font-family:"Figtree",system-ui,sans-serif;transition:all .2s;white-space:nowrap}',
    '.rc-quick:hover{border-color:'+MINT+';background:rgba(82,183,136,0.08)}',
    '.rc-powered{text-align:center;padding:6px;font-size:9px;color:#bbb;font-family:"Figtree",system-ui,sans-serif;background:#fff;border-top:1px solid #f0f0f0}'
  ].join('\n');
  document.head.appendChild(style);

  /* ─── DOM ─── */
  var fab = document.createElement('button');
  fab.id = 'rezvo-chat-fab';
  fab.innerHTML = '<svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><div id="rezvo-chat-badge">1</div>';
  document.body.appendChild(fab);

  var panel = document.createElement('div');
  panel.id = 'rezvo-chat-panel';

  var quickHTML = QUICK.map(function(b) {
    return '<button class="rc-quick" data-q="' + b.q + '">' + b.e + ' ' + b.l + '</button>';
  }).join('');

  panel.innerHTML = '<div class="rc-header"><div class="rc-header-avatar">R</div><div class="rc-header-info"><h3>Rezvo AI</h3><p>● Online — powered by AI</p></div><button class="rc-header-clear" id="rc-clear" title="Start new chat">🗑️ New</button></div><div class="rc-messages" id="rc-messages"></div><div class="rc-quick-btns" id="rc-quick-btns">' + quickHTML + '</div><div class="rc-input-area"><input class="rc-input" id="rc-input" placeholder="Ask me anything about Rezvo..." autocomplete="off"><button class="rc-send" id="rc-send"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div><div class="rc-powered">Powered by Rezvo AI ✨</div>';
  document.body.appendChild(panel);

  /* ─── State ─── */
  var isOpen = false, hasOpened = false;
  var chatHistory = []; // {role, content, ts}
  var messagesEl = document.getElementById('rc-messages');
  var inputEl = document.getElementById('rc-input');
  var sendBtn = document.getElementById('rc-send');
  var quickBtns = document.getElementById('rc-quick-btns');
  var badge = document.getElementById('rezvo-chat-badge');
  var clearBtn = document.getElementById('rc-clear');

  var GREETING = "Hey! 👋 I'm the Rezvo AI — I know pretty much everything about the platform. Ask me about pricing, features, how delivery works, competitor comparisons, getting started, or literally anything else. Fire away!";

  function addMsg(text, role, doSave) {
    if (doSave !== false) {
      chatHistory.push({role: role === 'bot' ? 'assistant' : 'user', content: text, ts: Date.now()});
      save(chatHistory);
    }
    var div = document.createElement('div');
    div.className = 'rc-msg ' + (role === 'bot' || role === 'assistant' ? 'bot' : 'user');
    div.innerHTML = (role === 'bot' || role === 'assistant') ? formatMsg(text) : text.replace(/</g, '&lt;');
    messagesEl.appendChild(div);
    return div;
  }

  function addFollowUp() {
    var w = document.createElement('div');
    w.className = 'rc-msg followup';
    var t = document.createElement('div');
    t.textContent = 'Want to know more? Pick a topic or ask me anything 👇';
    t.style.marginBottom = '6px';
    w.appendChild(t);
    var bd = document.createElement('div');
    bd.className = 'rc-inline-quick';
    QUICK.forEach(function(b) {
      var btn = document.createElement('button');
      btn.textContent = b.e + ' ' + b.l;
      btn.addEventListener('click', function() { w.remove(); sendMessage(b.q); });
      bd.appendChild(btn);
    });
    w.appendChild(bd);
    messagesEl.appendChild(w);
    scrollTo(w);
  }

  function scrollTo(el) {
    requestAnimationFrame(function() {
      el.scrollIntoView({behavior:'smooth', block:'start'});
    });
  }

  function showTyping() {
    var d = document.createElement('div');
    d.className = 'rc-msg typing'; d.id = 'rc-typing';
    d.innerHTML = '<div class="rc-dots"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(d);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function hideTyping() { var t = document.getElementById('rc-typing'); if(t)t.remove(); }
  function removeFollowUps() { messagesEl.querySelectorAll('.rc-msg.followup').forEach(function(e){e.remove();}); }

  /* ─── API Call ─── */
  function callAI(messages, callback) {
    // Build API messages (only user/assistant, no greeting)
    var apiMsgs = [];
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (m.role === 'user' || m.role === 'assistant') {
        apiMsgs.push({role: m.role, content: m.content});
      }
    }

    fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({messages: apiMsgs})
    })
    .then(function(res) {
      if (!res.ok) throw new Error('API ' + res.status);
      return res.json();
    })
    .then(function(data) {
      callback(null, data.reply);
    })
    .catch(function(err) {
      callback(err, null);
    });
  }

  function sendMessage(text) {
    if (!text.trim()) return;
    removeFollowUps();

    var userMsg = addMsg(text, 'user');
    inputEl.value = '';
    inputEl.disabled = true;
    sendBtn.disabled = true;
    if (quickBtns) quickBtns.style.display = 'none';

    showTyping();

    // Try AI API first, fall back to keywords
    callAI(chatHistory, function(err, reply) {
      hideTyping();

      if (err) {
        // Offline fallback
        reply = fallbackAnswer(text);
        var notice = document.createElement('div');
        notice.className = 'rc-msg system';
        notice.textContent = '⚡ Using quick answers (AI temporarily offline)';
        messagesEl.appendChild(notice);
      }

      var botMsg = addMsg(reply, 'bot');
      scrollTo(userMsg);

      setTimeout(function() { addFollowUp(); }, 300);

      inputEl.disabled = false;
      sendBtn.disabled = false;
      inputEl.focus();
    });
  }

  /* ─── Restore ─── */
  function restoreChat() {
    var saved = load();
    if (saved && saved.length > 0) {
      var first = saved[0];
      var when = new Date(first.ts);
      var timeStr = when.toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'});
      var dateStr = when.toLocaleDateString('en-GB', {day:'numeric',month:'short'});

      var ts = document.createElement('div');
      ts.className = 'rc-msg system';
      ts.textContent = '💬 Chat from ' + dateStr + ' at ' + timeStr;
      messagesEl.appendChild(ts);

      saved.forEach(function(item) {
        addMsg(item.content, item.role, false);
      });
      chatHistory = saved;
      if (quickBtns) quickBtns.style.display = 'none';
      addFollowUp();
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return true;
    }
    return false;
  }

  function clearChat() {
    sessionStorage.removeItem(STORE_KEY);
    chatHistory = [];
    messagesEl.innerHTML = '';
    if (quickBtns) quickBtns.style.display = '';
    hasOpened = false;
    setTimeout(function() { addMsg(GREETING, 'bot'); }, 200);
  }

  /* ─── Events ─── */
  fab.addEventListener('click', function() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    fab.classList.toggle('open', isOpen);
    if (badge) badge.style.display = 'none';
    if (isOpen && !hasOpened) {
      hasOpened = true;
      if (!restoreChat()) setTimeout(function() { addMsg(GREETING, 'bot'); }, 400);
    }
    if (isOpen) setTimeout(function() { inputEl.focus(); }, 350);
  });

  sendBtn.addEventListener('click', function() { sendMessage(inputEl.value); });
  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputEl.value); }
  });

  document.querySelectorAll('.rc-quick').forEach(function(btn) {
    btn.addEventListener('click', function() { sendMessage(btn.getAttribute('data-q')); });
  });

  clearBtn.addEventListener('click', function() { clearChat(); });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isOpen) { isOpen = false; panel.classList.remove('open'); fab.classList.remove('open'); }
  });

})();
