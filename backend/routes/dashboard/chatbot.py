"""
ReeveOS AI Chatbot — Claude-powered with REAL database access + bulletproof fallback
Never shows errors to users. If API fails, falls back to local knowledge.
"""
from fastapi import APIRouter, HTTPException, Request as FastAPIRequest, Depends
from pydantic import BaseModel
from typing import List, Optional
import httpx
import logging
import traceback
import re
from datetime import datetime, timedelta
from middleware.rate_limit import limiter
from middleware.auth import get_current_user
from config import Settings
from models.normalize import normalize_booking

router = APIRouter(prefix="/chatbot", tags=["chatbot"])
logger = logging.getLogger(__name__)
settings = Settings()


# ═══════════════════════════════════════════════════════════
# LOCAL KNOWLEDGE BASE — always works, no API needed
# ═══════════════════════════════════════════════════════════

KNOWLEDGE_BASE = {
    "pricing": "ReeveOS has 5 plans: **Free** (£0/mo, 1 staff, 100 bookings), **Starter** (£8.99/mo, 3 staff), **Growth** (£29/mo, 5 staff, deposits, CRM), **Scale** (£59/mo, unlimited staff, floor plan, white-label), and **Enterprise** (custom). No commission on any plan — just the flat fee.",
    "commission": "ReeveOS charges **zero commission** on bookings. Unlike Deliveroo (25-35%) or UberEats (30%+), you keep 100% of your revenue. We charge a flat monthly fee instead.",
    "delivery": "ReeveOS uses **Uber Direct** for delivery at 5-8% commission — compared to 25-35% on Deliveroo/JustEat. Your restaurant keeps the customer relationship and most of the margin.",
    "payments": "Payments go directly to your **Stripe Connect** account. ReeveOS never holds your money. Stripe fees apply (1.4% + 20p for UK cards). Payouts hit your bank account on Stripe's standard schedule.",
    "deposits": "Deposits are available on the **Growth plan** (£29/mo) and above. You set the deposit amount per booking. Money goes straight to your Stripe account — we never touch it.",
    "booking": "Your booking page is live at **book.rezvo.app/{your-slug}**. Share it on social media, add it to your website, or use the QR code from your dashboard. Customers can book 24/7.",
    "staff": "Manage your team under **People → Staff**. Add staff members, set their roles and permissions, assign services they can perform, and manage their working hours and rota.",
    "support": "For account issues, email **support@reeveos.app**. For urgent help, use this chat — I can answer questions about your bookings, covers, and platform features.",
    "cancel": "No contracts, cancel anytime. Go to **Settings → Subscription** to manage your plan. Your data stays available for 30 days after cancellation.",
    "allergens": "ReeveOS includes full **allergen compliance** for UK restaurants. Tag menu items with the 14 major allergens. This is a legal requirement under UK food law.",
    "tipping": "ReeveOS supports the **Employment (Allocation of Tips) Act 2023** with built-in tronc administration. Tips go fairly to your staff with full transparency.",
    "floor_plan": "Floor plan management is available on the **Scale plan** (£59/mo). Drag-and-drop table layout, assign bookings to specific tables, and see real-time table status.",
    "marketing": "The built-in **Email Marketing Suite** lets you create campaigns, set up automated sequences, and track engagement — all from your dashboard. No need for Mailchimp.",
    "reviews": "Connect your **Google Business Profile** to see reviews in your dashboard. Respond to reviews and track your rating over time.",
    "hours": "Set your opening hours in **Settings → Business Details**. You can set different hours for each day, add break periods, and set special holiday hours.",
    "hello": "Hey there! I'm your ReeveOS assistant. I can help with your bookings, covers, platform features, or any questions about your account. What would you like to know?",
    "help": "I can help you with: **bookings & covers** (today's numbers, upcoming reservations), **platform features** (pricing, payments, delivery, staff), or **account settings** (hours, booking rules, plans). Just ask!",
}

# Pattern matching for local knowledge
PATTERNS = [
    (r"\b(pric|cost|plan|subscription|how much|tier)\b", "pricing"),
    (r"\b(commission|fee|percent|margin)\b", "commission"),
    (r"\b(deliver|uber|deliveroo|just.?eat)\b", "delivery"),
    (r"\b(pay|stripe|payout|bank)\b", "payments"),
    (r"\b(deposit)\b", "deposits"),
    (r"\b(book|link|url|qr|widget)\b", "booking"),
    (r"\b(staff|team|employee|rota|schedule)\b", "staff"),
    (r"\b(support|contact|email|help me|issue|problem)\b", "support"),
    (r"\b(cancel|leave|stop|quit)\b", "cancel"),
    (r"\b(allergen|allergy|dietary)\b", "allergens"),
    (r"\b(tip|tronc|gratuity|service charge)\b", "tipping"),
    (r"\b(floor.?plan|table|layout|seat)\b", "floor_plan"),
    (r"\b(market|campaign|email blast|newsletter)\b", "marketing"),
    (r"\b(review|rating|google business|reputation)\b", "reviews"),
    (r"\b(hour|open|close|schedule|holiday)\b", "hours"),
    (r"^(hi|hey|hello|hiya|morning|afternoon|evening)\b", "hello"),
    (r"\b(help|what can you|how do i)\b", "help"),
]


def match_local_knowledge(message: str) -> Optional[str]:
    """Try to answer from local knowledge base. Returns None if no match."""
    msg = message.lower().strip()
    for pattern, key in PATTERNS:
        if re.search(pattern, msg, re.IGNORECASE):
            return KNOWLEDGE_BASE.get(key)
    return None


def build_local_reply(message: str, snapshot: str) -> str:
    """Build a reply using local knowledge + DB snapshot. No API needed."""
    msg = message.lower().strip()
    
    # Check for data questions first
    data_keywords = ["cover", "booking", "today", "tonight", "week", "reservation",
                     "no-show", "no show", "cancel", "customer", "guest", "how many",
                     "upcoming", "next", "table"]
    
    is_data_question = any(kw in msg for kw in data_keywords)
    
    if is_data_question and snapshot and "[" not in snapshot[:5]:
        # Extract key numbers from snapshot
        lines = snapshot.strip().split("\n")
        today_section = []
        week_section = []
        alltime_section = []
        upcoming_section = []
        current = None
        
        for line in lines:
            if "TODAY" in line: current = "today"
            elif "THIS WEEK" in line: current = "week"
            elif "ALL TIME" in line: current = "alltime"
            elif "NEXT UP" in line: current = "upcoming"
            elif current == "today": today_section.append(line.strip())
            elif current == "week": week_section.append(line.strip())
            elif current == "alltime": alltime_section.append(line.strip())
            elif current == "upcoming": upcoming_section.append(line.strip())
        
        parts = []
        
        if any(kw in msg for kw in ["today", "tonight", "cover", "how many"]):
            for line in today_section:
                if "Bookings:" in line: parts.append(f"**{line}**")
                elif "Covers:" in line: parts.append(f"**{line}**")
                elif "Status:" in line: parts.append(line)
        
        if any(kw in msg for kw in ["week", "this week"]):
            for line in week_section:
                if line: parts.append(f"**{line}**")
        
        if any(kw in msg for kw in ["upcoming", "next", "reservation"]):
            if upcoming_section:
                parts.append("**Upcoming today:**")
                parts.extend(upcoming_section[:5])
            else:
                parts.append("No upcoming bookings for today.")
        
        if any(kw in msg for kw in ["no-show", "no show", "cancel", "customer", "all time", "total"]):
            for line in alltime_section:
                if line: parts.append(line)
        
        if parts:
            return "\n".join(parts)
    
    # Try knowledge base
    kb_answer = match_local_knowledge(message)
    if kb_answer:
        return kb_answer
    
    # Generic fallback — always friendly, never an error
    return "I can help with your **bookings and covers** (ask about today's numbers), **platform features** (pricing, payments, delivery), or **account settings**. What would you like to know?"


# ═══════════════════════════════════════════════════════════
# DATABASE SNAPSHOT (same as before)
# ═══════════════════════════════════════════════════════════

async def build_business_snapshot(business_id: str) -> str:
    """Query MongoDB and build a data snapshot for the AI."""
    try:
        from database import get_database
        db = get_database()
    except Exception as e:
        return f"[Database error: {e}]"

    if db is None:
        return "[Database not connected]"

    try:
        from bson import ObjectId
    except ImportError:
        ObjectId = None

    try:
        biz = None
        biz = await db.businesses.find_one({"_id": business_id})
        if not biz and ObjectId:
            try:
                biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
            except Exception:
                pass
        if not biz:
            biz = await db.businesses.find_one({"slug": business_id})

        if not biz:
            return f"[Business not found]"

        biz_name = biz.get("name", "Unknown")
        biz_id = str(biz["_id"])
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_str = today.strftime("%Y-%m-%d")

        biz_match = {"$or": [{"businessId": biz_id}, {"business_id": biz_id}]}
        today_bookings_raw = await db.bookings.find({**biz_match, "date": today_str}).to_list(500)
        today_bookings = [normalize_booking(b) for b in today_bookings_raw]

        statuses = {}
        for b in today_bookings:
            st = b["status"]
            statuses[st] = statuses.get(st, 0) + 1

        week_start = today - timedelta(days=today.weekday())
        week_dates = [(week_start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        week_bookings_raw = await db.bookings.find({**biz_match, "date": {"$in": week_dates}}).to_list(2000)
        week_bookings = [normalize_booking(b) for b in week_bookings_raw]

        total_alltime = await db.bookings.count_documents(biz_match)
        all_bookings_raw = await db.bookings.find(
            biz_match,
            {"partySize": 1, "party_size": 1, "status": 1, "customerId": 1, "user_id": 1, "customer": 1, "covers": 1, "guests": 1, "customerName": 1}
        ).to_list(10000)
        all_bookings = [normalize_booking(b) for b in all_bookings_raw]

        cust_ids = set()
        for b in all_bookings:
            uid = b["customerId"]
            if not uid:
                uid = b["customer"].get("email")
            if uid:
                cust_ids.add(str(uid))
        total_customers = len(cust_ids) if cust_ids else total_alltime

        ns_count = sum(1 for b in all_bookings if b["status"] == "no_show")
        ok_count = sum(1 for b in all_bookings if b["status"] in ("completed", "seated", "confirmed"))
        cx_count = sum(1 for b in all_bookings if b["status"] == "cancelled")
        ns_pct = f"{(ns_count / max(ok_count + ns_count, 1)) * 100:.0f}%"

        biz_type = biz.get("type", "services")
        is_restaurant = biz_type == "restaurant"

        tables = biz.get("tables", [])
        if not isinstance(tables, list):
            tables = biz.get("floor_plan", {}).get("tables", [])
            if not isinstance(tables, list):
                tables = []
        num_tables = len(tables)
        total_seats = sum(t.get("seats", t.get("capacity", 4)) for t in tables) if tables else 0

        # Staff list
        staff_list = [s.get("name", "") for s in biz.get("staff", []) if s.get("active", True)]

        # Services/menu
        menu = biz.get("menu", [])
        active_services = [s for s in menu if s.get("active", True)]

        upcoming = sorted(
            [b for b in today_bookings if b["status"] in ("confirmed", "pending")],
            key=lambda b: str(b["time"] or "")
        )

        now = datetime.utcnow()

        if is_restaurant:
            total_covers = sum(b["partySize"] for b in today_bookings)
            week_covers = sum(b["partySize"] for b in week_bookings)
            lunch_c = dinner_c = 0
            for b in today_bookings:
                try:
                    hour = int(str(b["time"] or "18:00").split(":")[0])
                except Exception:
                    hour = 18
                if hour < 15:
                    lunch_c += b["partySize"]
                else:
                    dinner_c += b["partySize"]

            up_lines = []
            for b in upcoming[:6]:
                up_lines.append(f"  - {b['time'] or '?'}: {b['customer']['name'] or 'Guest'} (party of {b['partySize']}) [{b['status']}]")

            return f"""
LIVE DATABASE — {biz_name} (Restaurant)
Queried: {now.strftime('%H:%M %d/%m/%Y')} UTC

TODAY ({today.strftime('%A %d %B %Y')}):
  Bookings: {len(today_bookings)}
  Covers: {total_covers} (lunch: {lunch_c}, dinner: {dinner_c})
  Status: {', '.join(f'{v} {k}' for k, v in statuses.items()) if statuses else 'no bookings today'}

THIS WEEK:
  Bookings: {len(week_bookings)} | Covers: {week_covers}

ALL TIME:
  Total bookings: {total_alltime}
  Unique customers: {total_customers}
  No-show rate: {ns_pct} ({ns_count} no-shows)
  Cancellations: {cx_count}

VENUE:
  Tables: {num_tables} | Seats: {total_seats}

NEXT UP TODAY:
{chr(10).join(up_lines) if up_lines else '  No upcoming bookings'}

These are REAL numbers. Quote them exactly. If 0, say 0. NEVER invent data.
"""
        else:
            # Services business — revenue, treatments, therapists
            total_revenue = sum(
                (b.get("service", {}).get("price", 0) if isinstance(b.get("service"), dict) else 0)
                for b in today_bookings_raw
            )
            week_revenue = sum(
                (b.get("service", {}).get("price", 0) if isinstance(b.get("service"), dict) else 0)
                for b in week_bookings_raw
            )

            up_lines = []
            for b in upcoming[:8]:
                svc_name = b.get("service", {}).get("name", "Treatment") if isinstance(b.get("service"), dict) else "Treatment"
                staff_name = b.get("staffName") or ""
                up_lines.append(f"  - {b['time'] or '?'}: {b['customer']['name'] or 'Client'} — {svc_name}{' with ' + staff_name if staff_name else ''} [{b['status']}]")

            svc_summary = ", ".join(s.get("name", "") for s in active_services[:12]) if active_services else "None loaded"

            return f"""
LIVE DATABASE — {biz_name} ({biz.get('category', 'Local Services')})
Queried: {now.strftime('%H:%M %d/%m/%Y')} UTC

TODAY ({today.strftime('%A %d %B %Y')}):
  Appointments: {len(today_bookings)}
  Revenue today: £{total_revenue}
  Status: {', '.join(f'{v} {k}' for k, v in statuses.items()) if statuses else 'no appointments today'}

THIS WEEK:
  Appointments: {len(week_bookings)} | Revenue: £{week_revenue}

ALL TIME:
  Total appointments: {total_alltime}
  Unique clients: {total_customers}
  No-show rate: {ns_pct} ({ns_count} no-shows)
  Cancellations: {cx_count}

TEAM:
  Staff: {', '.join(staff_list) if staff_list else 'Not loaded'}

TREATMENTS OFFERED:
  {svc_summary}

NEXT UP TODAY:
{chr(10).join(up_lines) if up_lines else '  No upcoming appointments'}

This is a {biz.get('category', 'local services')} business. Use "appointments" not "bookings", "clients" not "guests", "therapist" not "server". These are REAL numbers. Quote them exactly. If 0, say 0. NEVER invent data.
"""

    except Exception as e:
        logger.error(f"Snapshot error: {traceback.format_exc()}")
        return f"[Database error: {e}]"


SYSTEM_PROMPT = """You are ReeveOS's AI assistant, embedded in a business owner's dashboard. You have REAL business data below from the live database.

PERSONALITY: Friendly, warm, British, concise. 2-3 short paragraphs max.

RULES:
1. ONLY quote numbers from the LIVE DATABASE section. NEVER invent numbers.
2. If data shows 0, say so honestly.
3. If asked something not in the data, say you can see the data but they'd need the dashboard for that detail.
4. Keep it SHORT. Use **bold** for key numbers. British English.
5. Adapt your language to the business type — for salons/clinics use "appointments", "clients", "therapists". For restaurants use "bookings", "guests", "covers".

REEVEOS BASICS:
- Zero commission platform, flat monthly fee
- Pricing: Free (£0), Starter (£8.99), Growth (£29), Scale (£59), Enterprise (custom)
- Contact: support@reeveos.app
"""


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    session_id: Optional[str] = None
    business_id: Optional[str] = None
    context: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    session_id: Optional[str] = None


@router.get("/health")
async def health():
    """Debug endpoint to check chatbot + DB status."""
    has_key = bool(settings.anthropic_api_key)
    try:
        from database import get_database
        db = get_database()
        if db is None:
            return {"status": "db_null", "ai_mode": "local", "api_key": has_key}
        count = await db.bookings.count_documents({})
        return {"status": "ok", "ai_mode": "claude" if has_key else "local", "api_key": has_key, "bookings": count}
    except Exception as e:
        return {"status": "error", "error": str(e), "ai_mode": "local"}


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(request: FastAPIRequest, chat_request: ChatRequest, user: dict = Depends(get_current_user)):
    """AI chat — Claude if available, local fallback if not. NEVER fails.
    
    SECURITY: Business data is STRICTLY isolated. Regular users can ONLY
    see their own business data. The business_id is derived server-side
    from the authenticated user's business_ids — NEVER trusted from client.
    """

    # ── STRICT BUSINESS ISOLATION ──
    # For business_owner/staff: ALWAYS use their own business, ignore client request
    # For admins: allow querying specific business if provided
    user_role = user.get("role", "")
    user_biz_ids = [str(b) for b in user.get("business_ids", [])]
    
    if user_role in ("super_admin", "platform_admin"):
        # Admins can query any business
        effective_biz_id = chat_request.business_id or (user_biz_ids[0] if user_biz_ids else None)
    else:
        # Regular users: ALWAYS their own business, client request is IGNORED
        effective_biz_id = user_biz_ids[0] if user_biz_ids else None
        if chat_request.business_id and chat_request.business_id not in user_biz_ids:
            logger.warning(f"SECURITY: User {user.get('email')} tried to access business {chat_request.business_id} — BLOCKED")
            raise HTTPException(403, "Access denied to this business")

    # Build DB snapshot — ONLY for the authenticated user's business
    snapshot = ""
    if effective_biz_id:
        try:
            snapshot = await build_business_snapshot(effective_biz_id)
        except Exception as e:
            logger.error(f"Snapshot error: {traceback.format_exc()}")
            snapshot = ""

    last_message = chat_request.messages[-1].content if chat_request.messages else ""

    # ─── Try Claude API first (if key is configured) ───
    if settings.anthropic_api_key:
        try:
            full_system = SYSTEM_PROMPT
            if snapshot:
                full_system += "\n" + snapshot

            allowed_roles = {"user", "assistant"}
            api_messages = [
                {"role": m.role, "content": m.content}
                for m in chat_request.messages[-20:]
                if m.role in allowed_roles
            ]

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": settings.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-sonnet-4-20250514",
                        "max_tokens": 1024,
                        "system": full_system,
                        "messages": api_messages,
                    }
                )

            if response.status_code == 200:
                data = response.json()
                reply = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
                if reply:
                    return ChatResponse(reply=reply, session_id=chat_request.session_id)

            # API returned non-200 — fall through to local
            logger.warning(f"Claude API {response.status_code}: {response.text[:200]}")

        except httpx.TimeoutException:
            logger.warning("Claude API timeout — falling back to local")
        except Exception as e:
            logger.warning(f"Claude API error: {e} — falling back to local")

    # ─── Local fallback — always works ───
    reply = build_local_reply(last_message, snapshot)
    return ChatResponse(reply=reply, session_id=chat_request.session_id)
