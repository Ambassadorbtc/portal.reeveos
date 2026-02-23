/**
 * Rezvo AI Support Chat Widget v1
 * Self-contained chatbot with Rezvo knowledge base
 * Drop onto any page with: <script src="/js/rezvo-chat.js"></script>
 */
(function () {
  'use strict';
  if (window.__rezvoChat) return;
  window.__rezvoChat = true;

  /* ─── Brand ─── */
  const FOREST = '#1B4332';
  const MINT = '#52B788';
  const CREAM = '#FEFBF4';

  /* ─── Knowledge Base ─── */
  const KB = {
    greeting: "Hi! 👋 I'm Rezvo's AI assistant. I can help with pricing, features, getting started, or any questions about our platform. What would you like to know?",
    fallback: "Great question! I want to make sure you get the best answer. You can reach our team directly at hello@rezvo.app or use our contact page. Is there anything else I can help with?",
    topics: [
      {
        keys: ['price', 'pricing', 'cost', 'how much', 'plan', 'plans', 'subscription', 'free', 'tier'],
        answer: "**Rezvo Pricing:**\n\n• **Free** — £0/mo · 1 staff, 100 bookings, basic features\n• **Starter** — £8.99/mo · 3 staff, reminders, customisation\n• **Growth** — £29/mo · 5 staff, deposits, CRM, analytics\n• **Scale** — £59/mo · Unlimited staff, floor plans, white-label\n• **Enterprise** — Custom pricing\n\nAll plans include zero commission. No contracts, cancel anytime. Start with a 30-day free trial — no credit card needed!"
      },
      {
        keys: ['commission', 'zero commission', 'no commission', 'fees', 'percentage', 'take'],
        answer: "**Zero commission, always.** Unlike platforms that take 15-30% of every booking, Rezvo charges a simple flat monthly subscription. 100% of your revenue stays yours. Payments go directly to your bank account via Stripe Connect — we never touch your money."
      },
      {
        keys: ['restaurant', 'table', 'floor plan', 'covers', 'seating', 'dine', 'dining'],
        answer: "**Rezvo for Restaurants includes:**\n\n• **Floor Plan View** — Real-time table status with colour coding (green = available, amber = occupied, blue = reserved)\n• **Covers Tracking** — Manage by party size, not confusing appointment slots\n• **Service Periods** — Separate lunch, dinner, and late-night with different capacities\n• **Online Booking Widget** — Guests book directly from your website\n• **Orders Board** — Kitchen display for dine-in orders\n• **Analytics** — Cover trends, peak times, revenue tracking\n\nWant me to explain any of these in detail?"
      },
      {
        keys: ['delivery', 'uber', 'uber direct', 'deliveroo', 'just eat', 'justeat', 'takeaway', 'order', 'ordering'],
        answer: "**Zero-Commission Delivery via Uber Direct:**\n\nRezvo integrates with Uber Direct for delivery fulfillment. Here's how it works:\n\n• Customers order from YOUR branded page (not a marketplace)\n• Payments go directly to YOUR Stripe account\n• Uber Direct handles the driver — you pay only the delivery fee\n• No 25-30% commission like Deliveroo or JustEat\n• Your branding, your customers, your data\n\nRestaurants keep full control while offering professional delivery."
      },
      {
        keys: ['booking', 'book', 'appointment', 'reserve', 'reservation', 'calendar'],
        answer: "**Smart Booking System:**\n\n• **Online Booking** — Customers book 24/7 from your website or the Rezvo directory\n• **Calendar View** — Drag-and-drop calendar with staff columns and colour coding\n• **Deposit Collection** — Reduce no-shows with card-on-file deposits\n• **Automated Reminders** — SMS and email confirmations and reminders\n• **Walk-in Management** — Quick-add walk-ins to your calendar\n• **Multi-staff Support** — Each team member gets their own column\n\nWorks for restaurants (tables/covers) and service businesses (time slots)."
      },
      {
        keys: ['salon', 'barber', 'spa', 'hair', 'beauty', 'nail', 'massage', 'service business'],
        answer: "**Rezvo works brilliantly for service businesses:**\n\n• Salons & Spas\n• Barbers\n• Personal Trainers\n• Physiotherapists\n• Tattoo Studios\n• Music Teachers\n• Dog Groomers\n• And many more!\n\nEach gets a tailored booking flow, staff calendar, CRM, and online presence. All with zero commission on bookings."
      },
      {
        keys: ['opentable', 'open table', 'resdiary', 'thefork', 'the fork', 'competitor', 'compare', 'vs', 'versus', 'alternative', 'switch', 'better'],
        answer: "**Why restaurants choose Rezvo over the competition:**\n\n**vs OpenTable:** OpenTable charges £1-3 per seated diner plus monthly fees. Rezvo charges a flat monthly rate with zero per-cover fees. You also keep your customer data.\n\n**vs ResDiary:** Similar feature set but Rezvo includes zero-commission online ordering and delivery integration — ResDiary doesn't.\n\n**vs TheFork:** TheFork takes commission on every booking and promotes discounting. Rezvo protects your margins.\n\nPlus, Rezvo works for ALL business types, not just restaurants."
      },
      {
        keys: ['payment', 'stripe', 'pay', 'card', 'deposit', 'refund', 'money'],
        answer: "**Payments via Stripe Connect:**\n\n• Each business connects their own Stripe account\n• Customer payments and deposits go directly to the business\n• Rezvo never holds your money\n• Supports card payments, Apple Pay, Google Pay\n• Automatic deposit collection for no-show protection\n• Full refund management from your dashboard\n\nStripe is trusted by millions of businesses worldwide and is fully PCA-compliant."
      },
      {
        keys: ['start', 'get started', 'sign up', 'signup', 'register', 'trial', 'begin', 'join'],
        answer: "**Getting started is easy:**\n\n1. **Sign up free** at rezvo.app — no credit card needed\n2. **Set up your profile** — add your business details, services, and staff\n3. **Go live** — start accepting bookings immediately\n\nYou get a full 30-day free trial on any plan. Our team can help with setup if you need it — just reach out at hello@rezvo.app"
      },
      {
        keys: ['contact', 'support', 'help', 'email', 'phone', 'speak', 'talk', 'human', 'person', 'team'],
        answer: "**Get in touch:**\n\n• **Email:** hello@rezvo.app\n• **Contact page:** rezvo.app/contact.html\n• **Response time:** We typically reply within a few hours\n\nOur team is based in the UK and we're always happy to help with setup, migration, or any questions!"
      },
      {
        keys: ['nottingham', 'launch', 'city', 'available', 'location', 'where', 'area', 'uk'],
        answer: "Rezvo is launching city by city across the UK, starting with **Nottingham**. The platform is available nationwide for any UK business to sign up and use — our directory and featured placement launches are rolling out by city to ensure the best local experience for diners and customers."
      },
      {
        keys: ['directory', 'find', 'discover', 'search', 'browse', 'diner', 'customer', 'consumer'],
        answer: "**The Rezvo Directory (rezvo.co.uk):**\n\nDiners and customers can browse and book local businesses directly. Even restaurants that haven't signed up yet appear in the directory — customers can request notifications when their favourite spot joins. This creates a natural demand signal that helps restaurants see the value of joining Rezvo."
      },
      {
        keys: ['feature', 'what do', 'what can', 'include', 'offer', 'do you'],
        answer: "**Rezvo's key features:**\n\n• Online booking with zero commission\n• Smart drag-and-drop calendar\n• Floor plan management (restaurants)\n• Stripe Connect payments & deposits\n• Customer CRM & analytics\n• Automated SMS/email reminders\n• Staff management & scheduling\n• Zero-commission online ordering\n• Uber Direct delivery integration\n• White-label branding options\n• Business directory listing\n\nAnything specific you'd like to know more about?"
      },
      {
        keys: ['crm', 'customer data', 'database', 'analytics', 'insight', 'report', 'data'],
        answer: "**CRM & Analytics:**\n\n• Full customer database — names, visit history, preferences, spend\n• Unlike third-party platforms, YOU own your customer data\n• Booking trends and peak time analysis\n• Revenue tracking and forecasting\n• Staff performance metrics\n• No-show rate monitoring\n• Available on Growth plan (£29/mo) and above"
      },
      {
        keys: ['no show', 'no-show', 'cancel', 'cancellation', 'deposit'],
        answer: "**No-show Protection:**\n\n• Collect card-on-file deposits when customers book\n• Set custom deposit amounts per service or time slot\n• Automatic reminders reduce no-shows by up to 70%\n• Easy cancellation policy management\n• Charge no-show fees automatically\n\nAvailable on Growth plan and above."
      },
      {
        keys: ['mobile', 'app', 'phone', 'tablet', 'ipad'],
        answer: "**Rezvo works on every device:**\n\n• **Diner App** — Book and manage reservations on the go\n• **Owner App** — Quick daily operations from your phone\n• **Tablet View** — Optimised floor plan for host stand iPad\n• **Web Dashboard** — Full management from any browser\n\nNo downloads needed for the web dashboard — works in any modern browser."
      },
      {
        keys: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'yo', 'sup'],
        answer: "Hey there! 👋 Welcome to Rezvo. I'm here to help with anything you need — pricing, features, getting started, or just learning more about the platform. What can I help you with?"
      },
      {
        keys: ['thank', 'thanks', 'cheers', 'ta', 'appreciate'],
        answer: "You're welcome! 😊 If you have any other questions, I'm here. You can also reach our team at hello@rezvo.app anytime. Have a great day!"
      },
      {
        keys: ['bye', 'goodbye', 'see you', 'later', 'that\'s all', 'nothing else'],
        answer: "Thanks for chatting! If you need anything else, I'm always here. Have a great day! 👋"
      }
    ]
  };

  function findAnswer(msg) {
    const lower = msg.toLowerCase().trim();
    if (lower.length < 2) return KB.greeting;

    let best = null, bestScore = 0;
    for (const topic of KB.topics) {
      let score = 0;
      for (const key of topic.keys) {
        if (lower.includes(key)) {
          score += key.split(' ').length; // multi-word matches score higher
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = topic;
      }
    }
    return best ? best.answer : KB.fallback;
  }

  function formatMsg(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n• /g, '<br>• ')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n(\d+)\./g, '<br>$1.')
      .replace(/\n/g, '<br>');
  }

  /* ─── Inject Styles ─── */
  const style = document.createElement('style');
  style.textContent = `
    #rezvo-chat-fab{position:fixed;bottom:24px;right:24px;z-index:9999;width:60px;height:60px;border-radius:50%;background:${FOREST};color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(27,67,50,0.4);transition:all .3s cubic-bezier(.22,1,.36,1)}
    #rezvo-chat-fab:hover{transform:scale(1.08);box-shadow:0 8px 32px rgba(27,67,50,0.5)}
    #rezvo-chat-fab.open{transform:rotate(0)}
    #rezvo-chat-fab svg{width:28px;height:28px;transition:transform .3s ease}
    #rezvo-chat-fab.open svg.chat-icon{display:none}
    #rezvo-chat-fab.open svg.close-icon{display:block}
    #rezvo-chat-fab svg.close-icon{display:none}
    #rezvo-chat-badge{position:absolute;top:-2px;right:-2px;width:18px;height:18px;border-radius:50%;background:#EF4444;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;animation:rcBounce 2s ease-in-out infinite}
    @keyframes rcBounce{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
    #rezvo-chat-panel{position:fixed;bottom:96px;right:24px;z-index:9998;width:380px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 140px);border-radius:20px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,0.2),0 0 0 1px rgba(0,0,0,0.05);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(20px) scale(0.95);pointer-events:none;transition:all .3s cubic-bezier(.22,1,.36,1)}
    #rezvo-chat-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}
    .rc-header{background:${FOREST};padding:18px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0}
    .rc-header-avatar{width:40px;height:40px;border-radius:12px;background:${MINT};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:${FOREST}}
    .rc-header-info h3{color:#fff;font-size:15px;font-weight:700;margin:0;font-family:'Figtree',system-ui,sans-serif}
    .rc-header-info p{color:${MINT};font-size:11px;font-weight:600;margin:2px 0 0;opacity:.9}
    .rc-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#f9fafb}
    .rc-messages::-webkit-scrollbar{width:4px}
    .rc-messages::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px}
    .rc-msg{max-width:85%;padding:12px 16px;border-radius:16px;font-size:13px;line-height:1.6;font-family:'Figtree',system-ui,sans-serif;word-wrap:break-word}
    .rc-msg.bot{background:#fff;color:#333;border:1px solid #e5e7eb;border-bottom-left-radius:4px;align-self:flex-start;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
    .rc-msg.bot strong{color:${FOREST};font-weight:700}
    .rc-msg.user{background:${FOREST};color:#fff;border-bottom-right-radius:4px;align-self:flex-end}
    .rc-msg.typing{background:#fff;border:1px solid #e5e7eb;border-bottom-left-radius:4px;align-self:flex-start;padding:14px 20px}
    .rc-dots{display:flex;gap:4px}
    .rc-dots span{width:7px;height:7px;border-radius:50%;background:#bbb;animation:rcDot 1.4s ease-in-out infinite}
    .rc-dots span:nth-child(2){animation-delay:.2s}
    .rc-dots span:nth-child(3){animation-delay:.4s}
    @keyframes rcDot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
    .rc-input-area{padding:12px 16px;border-top:1px solid #e5e7eb;background:#fff;display:flex;gap:8px;align-items:center;flex-shrink:0}
    .rc-input{flex:1;border:1.5px solid #e5e7eb;border-radius:12px;padding:10px 14px;font-size:13px;font-family:'Figtree',system-ui,sans-serif;outline:none;color:#333;transition:border-color .2s}
    .rc-input:focus{border-color:${MINT}}
    .rc-input::placeholder{color:#aaa}
    .rc-send{width:38px;height:38px;border-radius:10px;border:none;background:${FOREST};color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
    .rc-send:hover{background:${MINT};color:${FOREST}}
    .rc-send:disabled{opacity:.4;cursor:default}
    .rc-quick-btns{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 12px;background:#f9fafb}
    .rc-quick{padding:6px 14px;border-radius:20px;border:1.5px solid #e5e7eb;background:#fff;font-size:11px;font-weight:600;color:${FOREST};cursor:pointer;font-family:'Figtree',system-ui,sans-serif;transition:all .2s;white-space:nowrap}
    .rc-quick:hover{border-color:${MINT};background:${MINT}15;color:${FOREST}}
    .rc-powered{text-align:center;padding:6px;font-size:9px;color:#bbb;font-family:'Figtree',system-ui,sans-serif;background:#fff;border-top:1px solid #f0f0f0}
  `;
  document.head.appendChild(style);

  /* ─── Create DOM ─── */
  // FAB
  const fab = document.createElement('button');
  fab.id = 'rezvo-chat-fab';
  fab.innerHTML = `
    <svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    <div id="rezvo-chat-badge">1</div>
  `;
  document.body.appendChild(fab);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'rezvo-chat-panel';
  panel.innerHTML = `
    <div class="rc-header">
      <div class="rc-header-avatar">R</div>
      <div class="rc-header-info">
        <h3>Rezvo Support</h3>
        <p>● Online — typically replies instantly</p>
      </div>
    </div>
    <div class="rc-messages" id="rc-messages"></div>
    <div class="rc-quick-btns" id="rc-quick-btns">
      <button class="rc-quick" data-q="What are your pricing plans?">💰 Pricing</button>
      <button class="rc-quick" data-q="Tell me about restaurant features">🍽️ Restaurants</button>
      <button class="rc-quick" data-q="How does zero commission work?">🚫 Zero Commission</button>
      <button class="rc-quick" data-q="How do I get started?">🚀 Get Started</button>
      <button class="rc-quick" data-q="What features do you offer?">✨ Features</button>
      <button class="rc-quick" data-q="How can I contact your team?">📧 Contact</button>
    </div>
    <div class="rc-input-area">
      <input class="rc-input" id="rc-input" placeholder="Ask anything about Rezvo..." autocomplete="off">
      <button class="rc-send" id="rc-send">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
    <div class="rc-powered">Powered by Rezvo AI</div>
  `;
  document.body.appendChild(panel);

  /* ─── State ─── */
  let isOpen = false;
  let hasOpened = false;
  const messagesEl = document.getElementById('rc-messages');
  const inputEl = document.getElementById('rc-input');
  const sendBtn = document.getElementById('rc-send');
  const quickBtns = document.getElementById('rc-quick-btns');
  const badge = document.getElementById('rezvo-chat-badge');

  function addMsg(text, sender) {
    const div = document.createElement('div');
    div.className = 'rc-msg ' + sender;
    div.innerHTML = sender === 'bot' ? formatMsg(text) : text.replace(/</g, '&lt;');
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'rc-msg typing';
    div.id = 'rc-typing';
    div.innerHTML = '<div class="rc-dots"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const t = document.getElementById('rc-typing');
    if (t) t.remove();
  }

  function sendMessage(text) {
    if (!text.trim()) return;
    addMsg(text, 'user');
    inputEl.value = '';
    inputEl.disabled = true;
    sendBtn.disabled = true;

    // Hide quick buttons after first message
    if (quickBtns) quickBtns.style.display = 'none';

    showTyping();

    // Simulate AI thinking delay (300-900ms)
    const delay = 300 + Math.random() * 600;
    setTimeout(() => {
      hideTyping();
      const answer = findAnswer(text);
      addMsg(answer, 'bot');
      inputEl.disabled = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }, delay);
  }

  /* ─── Events ─── */
  fab.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    fab.classList.toggle('open', isOpen);
    if (badge) badge.style.display = 'none';

    if (isOpen && !hasOpened) {
      hasOpened = true;
      setTimeout(() => addMsg(KB.greeting, 'bot'), 400);
    }
    if (isOpen) setTimeout(() => inputEl.focus(), 350);
  });

  sendBtn.addEventListener('click', () => sendMessage(inputEl.value));
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputEl.value);
    }
  });

  // Quick buttons
  document.querySelectorAll('.rc-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      sendMessage(btn.getAttribute('data-q'));
    });
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
      panel.classList.remove('open');
      fab.classList.remove('open');
    }
  });

})();
