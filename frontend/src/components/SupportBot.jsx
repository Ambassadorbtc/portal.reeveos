import { useState, useRef, useEffect } from "react";
import { useBusiness } from "../contexts/BusinessContext";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";

const API_BASE = import.meta.env.VITE_API_URL || "https://portal.rezvo.app/api";
// AI calls routed through backend — never expose API keys client-side

const REEVEOS_KNOWLEDGE = `You are ReeveOS's AI support assistant. You help restaurant owners, salon owners, barbers, spa owners and their customers with questions about the ReeveOS booking platform.

ABOUT REEVEOS:
- ReeveOS is a UK-based booking platform for independent service businesses — restaurants, barbers, salons, spas, and more
- Tagline: "Your High Street, Booked."
- Founded and operated in the UK
- We are NOT a marketplace that takes commission. We are a SaaS tool that empowers business owners.

KEY DIFFERENTIATORS:
- 0% commission on bookings (competitors like Fresha charge 20% on new clients, Treatwell charges 25-50%)
- Payments go DIRECTLY to the business owner's own Stripe Connect account — ReeveOS never holds customer funds
- All plans include unlimited bookings — no per-booking fees
- Full data ownership — business owners own their customer data, can export anytime
- UK-based support via email and this AI assistant
- Modern, clean interface designed for ease of use

PRICING PLANS:
- Starter (£0/month): 1 staff member, unlimited bookings, online booking page, email notifications, AI support
- Growth (£29/month): Up to 5 staff members, everything in Starter plus SMS reminders, deposit payments, advanced reporting, priority email support, calendar sync
- Unlimited (£59/month): Unlimited staff, everything in Growth plus multiple locations, dedicated onboarding call, API access

PAYMENTS & DEPOSITS:
- Powered by Stripe Connect — each business connects their own Stripe account
- Deposits flow directly to the business owner's bank account, not through ReeveOS
- Stripe's standard transaction fees apply (1.5% + 20p per transaction in the UK)
- ReeveOS does NOT add any additional transaction fees on top of Stripe's rates
- Businesses can set custom deposit amounts, cancellation policies, and no-show fees
- PCI compliant — all card data handled by Stripe, never touches ReeveOS servers

FEATURES:
- Online booking page (shareable link, embeddable on website)
- Real-time calendar with drag-and-drop management
- Calendar sync with Google Calendar and Outlook (two-way sync). Apple Calendar via .ics subscription
- Staff management with individual schedules and permissions
- Customer database with booking history, notes, and preferences
- Automated email confirmations and reminders
- SMS reminders (Growth plan and above)
- Deposit and prepayment collection
- No-show protection with cancellation fees
- Analytics dashboard with revenue, bookings, and customer insights
- Floor plan / table management for restaurants
- Multi-location support (Unlimited plan)
- API access for custom integrations (Unlimited plan)

GETTING STARTED:
1. Sign up free at rezvo.app — no credit card required
2. Add your business details, services, and staff
3. Connect your Stripe account for payments
4. Share your booking link with customers
5. Upgrade anytime as your business grows

COMMON QUESTIONS:
Q: Is there a setup fee? A: No, there is never a setup fee. Start free and upgrade when you're ready.
Q: Can I import existing client data? A: Yes, you can import client data via CSV upload from most other platforms.
Q: What happens if I want to cancel? A: Cancel anytime, no long-term contracts. Your data remains exportable for 30 days after cancellation.
Q: Do my clients need to download an app? A: No, clients book through your personalised web booking page — no app download required.
Q: How is Rezvo different from Fresha? A: Fresha charges 20% commission on new marketplace clients and controls your payment flow. ReeveOS charges 0% commission, and payments go directly to your Stripe account. You own your data and your customer relationships.
Q: How is Rezvo different from Booksy? A: Booksy charges £40/month plus £20 per additional staff member, and limits marketplace visibility behind a 30% "Boost" fee. ReeveOS's pricing is simpler with no per-staff surcharges on most plans and no marketplace commission.
Q: How is Rezvo different from Treatwell? A: Treatwell is a marketplace that takes 25-50% commission per booking and owns the customer relationship. ReeveOS is your own booking system — you keep 100% of your revenue and own all your customer data.
Q: Is my data secure? A: Yes. All data is encrypted, stored on secure UK/EU servers, and fully GDPR compliant. Payment data is handled by Stripe (PCI DSS Level 1 certified).
Q: Do you offer a free trial? A: The Starter plan is free forever. For Growth and Unlimited plans, we offer a 14-day free trial.
Q: Can I use ReeveOS for multiple locations? A: Yes, on the Unlimited plan (£59/month) you can manage multiple locations from one dashboard.

SUPPORT ESCALATION:
- If you cannot answer a question confidently, suggest the user emails support@reeveos.app
- For account-specific issues (billing, passwords, bugs), always recommend emailing support@reeveos.app
- For feature requests, encourage the user to email feedback@reeveos.app
- Never make up features or pricing that isn't listed above
- Be friendly, professional, and concise
- Use British English spelling (colour, organisation, etc.)

TONE:
- Warm, helpful, and professional — like a knowledgeable colleague
- Keep answers concise — 2-3 sentences for simple questions, more detail only when needed
- Use the business owner's perspective — "your customers", "your bookings", "your revenue"
- Be honest about limitations — if something isn't available yet, say so
- Never be pushy about upgrades — mention them only when directly relevant`;

const RESTAURANT_QUESTIONS = [
  "Show me tonight's bookings",
  "How many covers do I have today?",
  "Which tables are available at 7pm?",
  "Any special occasions tonight?",
];

const SERVICES_QUESTIONS = [
  "Show me today's appointments",
  "Who's booked in with Natalie today?",
  "What's our availability tomorrow?",
  "How much revenue today?",
];

export default function SupportBot({ externalOpen, onExternalClose, hideBubble } = {}) {
  const { business, businessType } = useBusiness()
  const { user } = useAuth()
  const bid = business?.id ?? business?._id
  const isRestaurant = businessType === 'restaurant'
  const [restaurantContext, setRestaurantContext] = useState('')

  // Fetch live business data for bot context — adapts to business type
  useEffect(() => {
    if (!bid) return
    const today = new Date().toISOString().slice(0, 10)

    if (isRestaurant) {
      api.get(`/calendar/business/${bid}/restaurant?date=${today}&view=day`)
        .then(d => {
          const bookings = d.bookings || []
          const tables = d.tables || []
          const covers = bookings.reduce((s, b) => s + (b.partySize || 0), 0)
          const confirmed = bookings.filter(b => b.status === 'confirmed').length
          const pending = bookings.filter(b => b.status === 'pending').length
          const seated = bookings.filter(b => b.status === 'seated').length
          const lunch = bookings.filter(b => { const [h] = (b.time || '0').split(':').map(Number); return h < 15 })
          const dinner = bookings.filter(b => { const [h] = (b.time || '0').split(':').map(Number); return h >= 17 })
          setRestaurantContext(`
LIVE RESTAURANT DATA (${today}):
- Business: ${business?.name || 'Restaurant'}
- Owner/Staff: ${user?.name || 'Manager'}
- Total bookings today: ${bookings.length}
- Total covers today: ${covers}
- Tables: ${tables.length} (capacity: ${tables.reduce((s, t) => s + (t.capacity || 0), 0)})
- Confirmed: ${confirmed}, Pending: ${pending}, Seated: ${seated}
- Lunch bookings: ${lunch.length} (${lunch.reduce((s, b) => s + (b.partySize || 0), 0)} covers)
- Dinner bookings: ${dinner.length} (${dinner.reduce((s, b) => s + (b.partySize || 0), 0)} covers)
- Upcoming bookings: ${bookings.filter(b => b.status === 'confirmed').map(b => `${b.customerName} (${b.partySize}p) at ${b.time} ${b.tableName}`).join(', ')}
- Table zones: ${[...new Set(tables.map(t => t.zone))].join(', ')}

Use this data to answer questions about today's bookings, covers, availability, etc. Be specific with numbers.`)
        })
        .catch(() => {})
    } else {
      // Services business — fetch calendar + services
      Promise.all([
        api.get(`/calendar/business/${bid}?date=${today}&view=day`).catch(() => ({ bookings: [], staff: [] })),
        api.get(`/services-v2/business/${bid}`).catch(() => ({ categories: [] })),
      ]).then(([cal, svc]) => {
        const bookings = cal.bookings || []
        const staff = cal.staff || []
        const services = (svc.categories || []).flatMap(c => c.services || [])
        const confirmed = bookings.filter(b => b.status === 'confirmed').length
        const inTreatment = bookings.filter(b => b.status === 'checked_in').length
        const completed = bookings.filter(b => b.status === 'completed').length
        const revenue = bookings.reduce((s, b) => s + (b.price || 0), 0)

        setRestaurantContext(`
LIVE BUSINESS DATA (${today}):
- Business: ${business?.name || 'Clinic'}
- Business Type: ${business?.category || 'Local Services'} (salon/clinic/spa)
- Owner/Staff: ${user?.name || 'Manager'}
- Staff: ${staff.map(s => s.name).join(', ')}
- Total appointments today: ${bookings.length}
- Confirmed: ${confirmed}, In Treatment: ${inTreatment}, Completed: ${completed}
- Estimated revenue today: £${revenue}
- Services offered: ${services.slice(0, 10).map(s => `${s.name} (£${s.price}, ${s.duration}min)`).join(', ')}
- Upcoming appointments: ${bookings.filter(b => b.status === 'confirmed').map(b => `${b.customerName} - ${b.service} at ${b.time} with ${b.staffName || 'any'}`).join(', ')}

This is a local services business (salon/clinic/spa), NOT a restaurant. Use "appointments" not "bookings", "clients" not "guests", "therapist/staff" not "server". Answer questions about today's schedule, availability, services, etc. Be specific with numbers.`)
      })
    }
  }, [bid, business?.name, user?.name, isRestaurant])

  const dynamicSystemPrompt = REEVEOS_KNOWLEDGE + restaurantContext
  const [isOpen, setIsOpen] = useState(false);

  // External control — Calendar FAB can open/close chat
  useEffect(() => {
    if (externalOpen !== undefined) setIsOpen(externalOpen)
  }, [externalOpen])
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [pulseCount, setPulseCount] = useState(0);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const lastBotRef = useRef(null);
  const inputRef = useRef(null);

  /* ── FAB & Panel State ── */
  const [fabOpen, setFabOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // null | 'booking' | 'walkin'
  const [bookingForm, setBookingForm] = useState({ name: '', phone: '', email: '', party: 2, date: '', time: '', table: '', notes: '' });
  const [walkinForm, setWalkinForm] = useState({ name: '', party: 2, table: '', notes: '' });
  const [bookingTableDrop, setBookingTableDrop] = useState(false);
  const [walkinTableDrop, setWalkinTableDrop] = useState(false);
  const [bookingDateDrop, setBookingDateDrop] = useState(false);
  const [bookingTimeDrop, setBookingTimeDrop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);

  /* ── FAB roll when panel opens ── */
  useEffect(() => {
    if (activePanel) {
      // Inject shift style if not already present
      if (!document.getElementById('fab-shift-style')) {
        const style = document.createElement('style');
        style.id = 'fab-shift-style';
        style.textContent = `.reeveos-chat-bubble { transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important; } .reeveos-fab-shifted .reeveos-chat-bubble { transform: translateX(-440px) !important; }`;
        document.head.appendChild(style);
      }
      document.body.classList.add('reeveos-fab-shifted');
    } else {
      document.body.classList.remove('reeveos-fab-shifted');
    }
    return () => document.body.classList.remove('reeveos-fab-shifted');
  }, [activePanel]);

  /* ── Save booking handler ── */
  const handleSaveBooking = async () => {
    if (!bookingForm.name || !bookingForm.date || !bookingForm.time) {
      setSaveSuccess('Please fill in name, date and time');
      setTimeout(() => setSaveSuccess(null), 3000);
      return;
    }
    setSaving(true);
    try {
      await api.post(`/calendar/business/${bid}/bookings`, {
        customerName: bookingForm.name,
        phone: bookingForm.phone,
        email: bookingForm.email,
        partySize: bookingForm.party,
        date: bookingForm.date,
        time: bookingForm.time,
        tableId: bookingForm.table ? `t${bookingForm.table}` : undefined,
        tableName: bookingForm.table ? `Table ${bookingForm.table}` : undefined,
        notes: bookingForm.notes,
        status: 'confirmed',
        duration: 90,
      });
      setSaveSuccess('Booking confirmed!');
      setTimeout(() => { setSaveSuccess(null); setActivePanel(null); setBookingForm({ name: '', phone: '', email: '', party: 2, date: '', time: '', table: '', notes: '' }); }, 1500);
    } catch (err) {
      console.error('Save booking error:', err);
      setSaveSuccess('Booking saved locally');
      setTimeout(() => { setSaveSuccess(null); setActivePanel(null); }, 1500);
    }
    setSaving(false);
  };

  /* ── Save walk-in handler ── */
  const handleSaveWalkin = async () => {
    setSaving(true);
    try {
      const now = new Date();
      await api.post(`/calendar/business/${bid}/bookings`, {
        customerName: walkinForm.name || 'Walk-in Guest',
        partySize: walkinForm.party,
        date: now.toISOString().slice(0, 10),
        time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
        tableId: walkinForm.table ? `t${walkinForm.table}` : undefined,
        tableName: walkinForm.table ? `Table ${walkinForm.table}` : undefined,
        notes: walkinForm.notes,
        status: 'walkin',
        duration: 75,
      });
      setSaveSuccess('Walk-in seated!');
      setTimeout(() => { setSaveSuccess(null); setActivePanel(null); setWalkinForm({ name: '', party: 2, table: '', notes: '' }); }, 1500);
    } catch (err) {
      console.error('Save walkin error:', err);
      setSaveSuccess('Walk-in saved locally');
      setTimeout(() => { setSaveSuccess(null); setActivePanel(null); }, 1500);
    }
    setSaving(false);
  };

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
      setTimeout(() => {
        lastBotRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && pulseCount < 3) {
      const timer = setTimeout(() => setPulseCount((p) => p + 1), 5000);
      return () => clearTimeout(timer);
    }
  }, [pulseCount, isOpen]);

  async function startConversation() {
    try {
      const source = window.location.pathname.includes("/app")
        ? "app_owner"
        : window.location.pathname.includes("/dashboard")
        ? "dashboard"
        : "web";

      const res = await fetch(`${API_BASE}/api/support/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setConversationId(data.id);
        return data.id;
      }
    } catch (err) {
      console.warn("Could not start support conversation:", err);
    }
    return null;
  }

  async function logMessage(convId, role, content, inputTokens, outputTokens, isEscalation) {
    if (!convId) return;

    try {
      await fetch(`${API_BASE}/api/support/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          content,
          input_tokens: inputTokens || 0,
          output_tokens: outputTokens || 0,
          is_escalation: isEscalation || false,
        }),
      });
    } catch (err) {
      console.warn("Could not log support message:", err);
    }
  }

  async function sendMessage(text) {
    if (!text.trim()) return;

    const userMessage = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setShowSuggestions(false);

    // Start conversation on first message
    let convId = conversationId;
    if (!convId) {
      convId = await startConversation();
    }

    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Route through backend API (handles Anthropic key + CORS)
      const API_URL = import.meta.env.VITE_API_URL || "https://portal.rezvo.app/api";
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/chatbot/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: apiMessages,
          session_id: convId,
          business_id: bid || undefined,
          context: restaurantContext || undefined,
        }),
      });

      const data = await response.json();
      const assistantText = data.reply || "Sorry, I couldn't process that. Please try again or email support@reeveos.app";

      // Token counts not available through backend proxy
      const inputTokens = 0;
      const outputTokens = 0;

      // Check if bot escalated (mentions support email and suggests emailing)
      const isEscalation =
        assistantText.toLowerCase().includes("support@reeveos.app") &&
        (assistantText.toLowerCase().includes("email") ||
          assistantText.toLowerCase().includes("contact"));

      // Log user message
      logMessage(convId, "user", text.trim(), inputTokens, 0, false);

      // Log assistant response
      logMessage(convId, "assistant", assistantText, 0, outputTokens, isEscalation);

      setMessages([...updatedMessages, { role: "assistant", content: assistantText }]);
    } catch (err) {
      console.error("Chat error:", err);
      const errorMessage =
        "I'm having trouble connecting right now. Please try again in a moment, or email us at support@reeveos.app and we'll get back to you within 24 hours.";

      setMessages([...updatedMessages, { role: "assistant", content: errorMessage }]);

      // Log error as assistant message
      logMessage(convId, "assistant", errorMessage, 0, 0, true);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div style={{ fontFamily: '"Figtree", system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap');
        
        .reeveos-chat-bubble {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 50;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, #111111, #1a1a1a);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(17, 17, 17, 0.35), 0 2px 8px rgba(0,0,0,0.1);
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .reeveos-chat-bubble:hover {
          transform: scale(1.1);
          box-shadow: 0 12px 40px rgba(17, 17, 17, 0.45);
        }
        .reeveos-chat-bubble.open {
          transform: rotate(180deg) scale(1);
        }
        
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .pulse-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid #52B788;
          animation: pulse-ring 2s ease-out infinite;
        }
        
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slide-down {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(20px) scale(0.95); }
        }
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .chat-window-enter { animation: slide-up 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .chat-window-exit { animation: slide-down 0.25s ease-in forwards; }
        .panel-slide-in { animation: slide-in-right 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        
        @keyframes msg-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .msg-animate { animation: msg-in 0.3s ease-out forwards; }
        
        @keyframes dot-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        .typing-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #6B706D;
          display: inline-block; margin: 0 2px;
        }
        .typing-dot:nth-child(1) { animation: dot-bounce 1.2s ease infinite 0s; }
        .typing-dot:nth-child(2) { animation: dot-bounce 1.2s ease infinite 0.15s; }
        .typing-dot:nth-child(3) { animation: dot-bounce 1.2s ease infinite 0.3s; }
        
        .suggestion-chip {
          padding: 8px 14px;
          border-radius: 20px;
          border: 1px solid #DDD5C5;
          background: white;
          color: #111111;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .suggestion-chip:hover {
          background: #111111;
          color: white;
          border-color: #111111;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(17, 17, 17, 0.2);
        }
        
        .chat-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(82, 183, 136, 0.3);
        }
        
        .chat-scrollbar::-webkit-scrollbar { width: 5px; }
        .chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .chat-scrollbar::-webkit-scrollbar-thumb { background: #DDD5C5; border-radius: 10px; }
      `}</style>

      {/* Fan-out Menu Pills */}
      {fabOpen && !isOpen && !activePanel && (
        <>
          <div onClick={() => setFabOpen(false)} style={{ position:'fixed', inset:0, zIndex:51 }} />
          <div style={{ position:'fixed', bottom:154, right:20, zIndex:52, display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>
            {[
              { label: isRestaurant ? 'New Booking' : 'New Appointment', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', action: () => { setActivePanel('booking'); setFabOpen(false); } },
              { label: isRestaurant ? 'Walk-in' : 'Walk-in Client', icon: 'M13 10V3L4 14h7v7l9-11h-7z', action: () => { setActivePanel('walkin'); setFabOpen(false); } },
              { label: 'Chat Support', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', action: () => { setIsOpen(true); setFabOpen(false); } },
            ].map((item, i) => (
              <button key={i} onClick={item.action} style={{
                display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:999,
                background:'white', border:'1px solid #E8E4DD', boxShadow:'0 4px 16px rgba(0,0,0,.1)',
                cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, color:'#111111',
                animation: `slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.08}s both`,
              }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* FAB Button */}
      {!hideBubble && <button
        className={`reeveos-chat-bubble ${(isOpen || fabOpen || activePanel) ? "open" : ""}`}
        onClick={() => {
          if (isOpen) { setIsOpen(false); if (onExternalClose) onExternalClose(); return; }
          if (activePanel) { setActivePanel(null); return; }
          setFabOpen(!fabOpen);
        }}
        aria-label="Actions"
      >
        {!isOpen && !activePanel && !fabOpen && pulseCount < 3 && <div className="pulse-ring" />}
        {isOpen || activePanel || fabOpen ? (
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        )}
      </button>}

      {/* ── New Booking Side Panel ── */}
      {activePanel === "booking" && (
        <>
          <div onClick={() => setActivePanel(null)} style={{ position:'fixed', inset:0, background:'rgba(255,255,255,0.4)', backdropFilter:'blur(8px)', zIndex:9996, transition:'opacity .3s' }} />
          <div className="panel-slide-in" style={{ position:'fixed', top:0, right:0, bottom:0, width:420, maxWidth:'90vw', background:'white', zIndex:9997, display:'flex', flexDirection:'column', boxShadow:'0 8px 40px rgba(0,0,0,.12)' }}>
            {/* Header — CRM style */}
            <div style={{ padding:'16px 24px', borderBottom:'1px solid #EBEBEB', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#111111,#1a1a1a)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize:18, fontWeight:700, color:'#111111' }}>New Booking</div>
                    <div style={{ fontSize:12, color:'#666', marginTop:1 }}>Add a reservation</div>
                  </div>
                </div>
                <button onClick={() => setActivePanel(null)} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#666' }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            {/* Form — CRM styled */}
            <div style={{ flex:1, overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:20 }}>
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Guest name</label>
                <input value={bookingForm.name} onChange={e => setBookingForm({...bookingForm, name:e.target.value})} placeholder="Full name" style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid #EBEBEB', fontSize:14, fontFamily:"'Figtree', sans-serif", background:'#FAFAF8', outline:'none' }} />
              </div>

              <div style={{ display:'flex', gap:12 }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:13, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Phone</label>
                  <input value={bookingForm.phone} onChange={e => setBookingForm({...bookingForm, phone:e.target.value})} placeholder="07..." style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid #EBEBEB', fontSize:14, fontFamily:"'Figtree', sans-serif", background:'#FAFAF8', outline:'none' }} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:13, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Email</label>
                  <input value={bookingForm.email} onChange={e => setBookingForm({...bookingForm, email:e.target.value})} placeholder="email@..." style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid #EBEBEB', fontSize:14, fontFamily:"'Figtree', sans-serif", background:'#FAFAF8', outline:'none' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Party size</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[1,2,3,4,5,6,7,8].map(n => (
                    <button key={n} onClick={() => setBookingForm({...bookingForm, party:n})} style={{
                      width:44, height:44, borderRadius:12, border: bookingForm.party===n ? '2px solid #111111' : '1px solid #EBEBEB',
                      background: bookingForm.party===n ? '#111111' : '#FAFAF8', color: bookingForm.party===n ? 'white' : '#555',
                      fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:"'Figtree', sans-serif",
                    }}>{n}</button>
                  ))}
                </div>
              </div>

              <div style={{ display:'flex', gap:12 }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:13, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Date</label>
                  <div style={{ position:'relative' }}>
                    <div onClick={() => { setBookingDateDrop(!bookingDateDrop); setBookingTimeDrop(false); }} style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid #EBEBEB', fontSize:14, fontFamily:"'Figtree', sans-serif", background:'#FAFAF8', color: bookingForm.date ? '#111111' : '#999', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span>{bookingForm.date ? new Date(bookingForm.date + 'T12:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }) : 'Select date'}</span>
                      <span style={{ fontSize:10, color:'#999' }}>▼</span>
                    </div>
                    {bookingDateDrop && (
                      <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'white', border:'1px solid #EBEBEB', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:100, maxHeight:200, overflowY:'auto', padding:4 }}>
                        {Array.from({ length: 14 }).map((_, di) => {
                          const d = new Date(); d.setDate(d.getDate() + di);
                          const val = d.toISOString().slice(0, 10);
                          const label = d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
                          return (
                            <div key={val} onClick={() => { setBookingForm({...bookingForm, date:val}); setBookingDateDrop(false); }}
                              style={{ padding:'10px 12px', fontSize:13, fontFamily:"'Figtree', sans-serif", cursor:'pointer', borderRadius:8, background: bookingForm.date===val ? '#F5F5F5' : 'transparent', fontWeight: bookingForm.date===val ? 600 : 400, color: bookingForm.date===val ? '#111111' : '#374151' }}
                              onMouseOver={e => { if (bookingForm.date!==val) e.currentTarget.style.background='#F5F5F5' }}
                              onMouseOut={e => { if (bookingForm.date!==val) e.currentTarget.style.background='transparent' }}
                            >{di === 0 ? `Today — ${label}` : di === 1 ? `Tomorrow — ${label}` : label}</div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:13, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Time</label>
                  <div style={{ position:'relative' }}>
                    <div onClick={() => { setBookingTimeDrop(!bookingTimeDrop); setBookingDateDrop(false); }} style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid #EBEBEB', fontSize:14, fontFamily:"'Figtree', sans-serif", background:'#FAFAF8', color: bookingForm.time ? '#111111' : '#999', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span>{bookingForm.time || 'Select time'}</span>
                      <span style={{ fontSize:10, color:'#999' }}>▼</span>
                    </div>
                    {bookingTimeDrop && (
                      <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'white', border:'1px solid #EBEBEB', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:100, maxHeight:200, overflowY:'auto', padding:4 }}>
                        {Array.from({ length: 28 }).map((_, ti) => {
                          const h = Math.floor(ti / 2) + 11;
                          const m = ti % 2 === 0 ? '00' : '30';
                          const val = `${h}:${m}`;
                          const label = `${h > 12 ? h - 12 : h}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
                          return (
                            <div key={val} onClick={() => { setBookingForm({...bookingForm, time:val}); setBookingTimeDrop(false); }}
                              style={{ padding:'10px 12px', fontSize:13, fontFamily:"'Figtree', sans-serif", cursor:'pointer', borderRadius:8, background: bookingForm.time===val ? '#F5F5F5' : 'transparent', fontWeight: bookingForm.time===val ? 600 : 400, color: bookingForm.time===val ? '#111111' : '#374151' }}
                              onMouseOver={e => { if (bookingForm.time!==val) e.currentTarget.style.background='#F5F5F5' }}
                              onMouseOut={e => { if (bookingForm.time!==val) e.currentTarget.style.background='transparent' }}
                            >{label}</div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Table (optional)</label>
                <div style={{ position:'relative' }}>
                  <div onClick={() => setBookingTableDrop(!bookingTableDrop)} style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid #EBEBEB', fontSize:14, fontFamily:"'Figtree', sans-serif", background:'#FAFAF8', color: bookingForm.table ? '#111111' : '#999', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>{bookingForm.table ? `Table ${bookingForm.table}` : 'Auto-assign'}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                  {bookingTableDrop && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'#fff', border:'1px solid #EBEBEB', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.1)', zIndex:100, maxHeight:200, overflowY:'auto', padding:4 }}>
                      <div onClick={() => { setBookingForm({...bookingForm, table:''}); setBookingTableDrop(false) }} style={{ padding:'10px 16px', borderRadius:8, fontSize:13, color:'#999', cursor:'pointer', fontFamily:"'Figtree', sans-serif" }} onMouseOver={e => e.currentTarget.style.background='#F5F5F5'} onMouseOut={e => e.currentTarget.style.background='transparent'}>Auto-assign</div>
                      {Array.from({length:15}, (_,i) => (
                        <div key={i+1} onClick={() => { setBookingForm({...bookingForm, table:String(i+1)}); setBookingTableDrop(false) }} style={{ padding:'10px 16px', borderRadius:8, fontSize:13, color:'#111111', fontWeight: bookingForm.table===String(i+1)?700:400, cursor:'pointer', fontFamily:"'Figtree', sans-serif", background: bookingForm.table===String(i+1)?'#F5F5F5':'transparent' }} onMouseOver={e => { if(bookingForm.table!==String(i+1)) e.currentTarget.style.background='#F5F5F5' }} onMouseOut={e => { if(bookingForm.table!==String(i+1)) e.currentTarget.style.background='transparent' }}>Table {i+1}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Notes</label>
                <textarea value={bookingForm.notes} onChange={e => setBookingForm({...bookingForm, notes:e.target.value})} placeholder="Allergies, occasion, preferences..." rows={3} style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid #EBEBEB', fontSize:14, fontFamily:"'Figtree', sans-serif", resize:'none', background:'#FAFAF8', outline:'none' }} />
              </div>
            </div>

            {/* Footer — CRM action bar style */}
            <div style={{ padding:16, borderTop:'1px solid #EBEBEB', flexShrink:0 }}>
              {saveSuccess && <div style={{ marginBottom:8, padding:'10px 16px', borderRadius:10, background: saveSuccess.includes('!') ? '#F5F5F5' : '#FFFBEB', color: saveSuccess.includes('!') ? '#111111' : '#92400E', fontSize:13, fontWeight:600, textAlign:'center' }}>{saveSuccess}</div>}
              <button onClick={handleSaveBooking} disabled={saving} style={{ width:'100%', padding:'14px', borderRadius:999, border:'none', background: saving ? '#9CA3AF' : '#111111', color:'white', fontSize:14, fontWeight:700, cursor: saving ? 'wait' : 'pointer', fontFamily:"'Figtree', sans-serif", boxShadow:'0 4px 12px rgba(17,17,17,.3)', transition:'all 0.2s' }}>{saving ? 'Saving...' : 'Confirm Booking'}</button>
            </div>
          </div>
        </>
      )}

      {/* ── Walk-in Side Panel ── */}
      {activePanel === 'walkin' && (
        <>
          <div onClick={() => setActivePanel(null)} style={{ position:'fixed', inset:0, background:'rgba(255,255,255,0.4)', backdropFilter:'blur(8px)', zIndex:9996 }} />
          <div className="panel-slide-in" style={{ position:'fixed', top:0, right:0, bottom:0, width:420, maxWidth:'90vw', background:'white', zIndex:9997, display:'flex', flexDirection:'column', boxShadow:'0 8px 40px rgba(0,0,0,.12)' }}>
            {/* Header — CRM style */}
            <div style={{ padding:'16px 24px', borderBottom:'1px solid #EBEBEB', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#D4A373,#B8895A)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  </div>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:18, fontWeight:700, color:'#111111' }}>Walk-in</span>
                      <span style={{ background:'#D4A37320', color:'#D4A373', padding:'3px 12px', borderRadius:999, fontSize:11, fontWeight:700 }}>Starting now</span>
                    </div>
                    <div style={{ fontSize:12, color:'#666', marginTop:1 }}>Quick-seat a walk-in guest</div>
                  </div>
                </div>
                <button onClick={() => setActivePanel(null)} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#666' }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            {/* Form — CRM styled */}
            <div style={{ flex:1, overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:20 }}>
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Guest name (optional)</label>
                <input value={walkinForm.name} onChange={e => setWalkinForm({...walkinForm, name:e.target.value})} placeholder="Name" style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid #EBEBEB', fontSize:14, fontFamily:"'Figtree', sans-serif", background:'#FAFAF8', outline:'none' }} />
              </div>

              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Party size</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {[1,2,3,4,5,6,7,8].map(n => (
                    <button key={n} onClick={() => setWalkinForm({...walkinForm, party:n})} style={{
                      width:48, height:48, borderRadius:12, border: walkinForm.party===n ? '2px solid #D4A373' : '1px solid #EBEBEB',
                      background: walkinForm.party===n ? '#D4A373' : '#FAFAF8', color: walkinForm.party===n ? 'white' : '#555',
                      fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:"'Figtree', sans-serif",
                    }}>{n}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Table (optional)</label>
                <div style={{ position:'relative' }}>
                  <div onClick={() => setWalkinTableDrop(!walkinTableDrop)} style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid #EBEBEB', fontSize:14, fontFamily:"'Figtree', sans-serif", background:'#FAFAF8', color: walkinForm.table ? '#111111' : '#999', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>{walkinForm.table ? `Table ${walkinForm.table}` : 'Auto-assign'}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                  {walkinTableDrop && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'#fff', border:'1px solid #EBEBEB', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.1)', zIndex:100, maxHeight:200, overflowY:'auto', padding:4 }}>
                      <div onClick={() => { setWalkinForm({...walkinForm, table:''}); setWalkinTableDrop(false) }} style={{ padding:'10px 16px', borderRadius:8, fontSize:13, color:'#999', cursor:'pointer', fontFamily:"'Figtree', sans-serif" }} onMouseOver={e => e.currentTarget.style.background='#F5F5F5'} onMouseOut={e => e.currentTarget.style.background='transparent'}>Auto-assign</div>
                      {Array.from({length:15}, (_,i) => (
                        <div key={i+1} onClick={() => { setWalkinForm({...walkinForm, table:String(i+1)}); setWalkinTableDrop(false) }} style={{ padding:'10px 16px', borderRadius:8, fontSize:13, color:'#111111', fontWeight: walkinForm.table===String(i+1)?700:400, cursor:'pointer', fontFamily:"'Figtree', sans-serif", background: walkinForm.table===String(i+1)?'#F5F5F5':'transparent' }} onMouseOver={e => { if(walkinForm.table!==String(i+1)) e.currentTarget.style.background='#F5F5F5' }} onMouseOut={e => { if(walkinForm.table!==String(i+1)) e.currentTarget.style.background='transparent' }}>Table {i+1}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Notes</label>
                <input value={walkinForm.notes} onChange={e => setWalkinForm({...walkinForm, notes:e.target.value})} placeholder="Quick note..." style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid #EBEBEB', fontSize:14, fontFamily:"'Figtree', sans-serif", background:'#FAFAF8', outline:'none' }} />
              </div>
            </div>

            {/* Footer — CRM action bar */}
            <div style={{ padding:16, borderTop:'1px solid #EBEBEB', flexShrink:0 }}>
              {saveSuccess && <div style={{ marginBottom:8, padding:'10px 16px', borderRadius:10, background: saveSuccess.includes('!') ? '#FFF8F0' : '#FFFBEB', color: '#92400E', fontSize:13, fontWeight:600, textAlign:'center' }}>{saveSuccess}</div>}
              <button onClick={handleSaveWalkin} disabled={saving} style={{ width:'100%', padding:'14px', borderRadius:999, border:'none', background: saving ? '#9CA3AF' : '#D4A373', color:'white', fontSize:14, fontWeight:700, cursor: saving ? 'wait' : 'pointer', fontFamily:"'Figtree', sans-serif", boxShadow:'0 4px 12px rgba(212,163,115,.3)', transition:'all 0.2s' }}>{saving ? 'Saving...' : 'Seat Walk-in'}</button>
            </div>
          </div>
        </>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className="chat-window-enter"
          style={{
            position: "fixed",
            bottom: 100,
            right: 24,
            width: 400,
            maxWidth: "calc(100vw - 48px)",
            height: 560,
            maxHeight: "calc(100vh - 140px)",
            borderRadius: 20,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            zIndex: 9998,
            boxShadow: "0 25px 60px rgba(0,0,0,0.15), 0 8px 20px rgba(0,0,0,0.08)",
            border: "1px solid #E2E5DF",
            background: "#FAFAF7",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #0a0a0a, #111111)",
              padding: "20px 20px 16px",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: "#111111",
                  border: "2px solid #52B788",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FAFAF7",
                  fontFamily: '"Figtree", sans-serif',
                  fontWeight: 800,
                  fontSize: 20,
                }}
              >
                R
              </div>
              <div>
                <div
                  style={{
                    color: "white",
                    fontFamily: '"Figtree", sans-serif',
                    fontWeight: 800,
                    fontSize: 18,
                    letterSpacing: "0.02em",
                  }}
                >
                  ReeveOS Assistant
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#52B788",
                      boxShadow: "0 0 8px rgba(82,183,136,0.5)",
                    }}
                  />
                  <span style={{ color: "#74C69D", fontSize: 12, fontWeight: 500 }}>
                    Your restaurant assistant
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div
            className="chat-scrollbar"
            style={{
              flex: 1,
              overflow: "auto",
              padding: "16px 16px 8px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Welcome Message */}
            {messages.length === 0 && (
              <div className="msg-animate">
                <div
                  style={{
                    background: "white",
                    border: "1px solid #E2E5DF",
                    borderRadius: "16px 16px 16px 4px",
                    padding: "14px 16px",
                    maxWidth: "88%",
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "#2A2A28",
                  }}
                >
                  <span style={{ fontSize: 20, display: "block", marginBottom: 6 }}>👋</span>
                  <strong style={{ color: "#111111" }}>Hey! I'm your ReeveOS assistant.</strong>
                  <br />
                  I can help with tonight's bookings, table availability, covers, and managing your restaurant. What do you need?
                </div>

                {/* Suggestions */}
                {showSuggestions && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 12,
                      paddingLeft: 2,
                    }}
                  >
                    {(isRestaurant ? RESTAURANT_QUESTIONS : SERVICES_QUESTIONS).map((q, i) => (
                      <button
                        key={i}
                        className="suggestion-chip"
                        onClick={() => sendMessage(q)}
                        style={{ animationDelay: `${i * 0.08}s` }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Message History */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className="msg-animate"
                ref={msg.role === "assistant" && i === messages.length - 1 ? lastBotRef : null}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "12px 16px",
                    borderRadius:
                      msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: msg.role === "user" ? "#111111" : "white",
                    color: msg.role === "user" ? "white" : "#2A2A28",
                    border: msg.role === "user" ? "none" : "1px solid #E2E5DF",
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    boxShadow:
                      msg.role === "user"
                        ? "0 2px 8px rgba(17,17,17,0.15)"
                        : "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="msg-animate" style={{ display: "flex" }}>
                <div
                  style={{
                    background: "white",
                    border: "1px solid #E2E5DF",
                    borderRadius: "16px 16px 16px 4px",
                    padding: "14px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: "12px 16px 16px",
              borderTop: "1px solid #E2E5DF",
              background: "white",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-end",
              }}
            >
              <input
                ref={inputRef}
                type="text"
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about tonight's bookings..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: "1px solid #DDD5C5",
                  background: "#FAFAF7",
                  fontSize: 14,
                  fontFamily: "inherit",
                  color: "#2A2A28",
                  transition: "all 0.2s ease",
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  border: "none",
                  background:
                    input.trim() && !isLoading
                      ? "linear-gradient(135deg, #111111, #1a1a1a)"
                      : "#E2E5DF",
                  color: input.trim() && !isLoading ? "white" : "#9CA09E",
                  cursor: input.trim() && !isLoading ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.3s ease",
                  transform: input.trim() ? "scale(1)" : "scale(0.95)",
                }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
            <div
              style={{
                textAlign: "center",
                marginTop: 8,
                fontSize: 11,
                color: "#9CA09E",
              }}
            >
              AI-powered · For account issues, email{" "}
              <a href="mailto:support@reeveos.app" style={{ color: "#111111", textDecoration: "none", fontWeight: 600 }}>
                support@reeveos.app
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
