"""
Rezvo AI Chatbot — Claude-powered with REAL database access
============================================================
Queries MongoDB bookings collection before every response so
Claude answers with actual numbers, not hallucinated ones.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import httpx
import logging
from datetime import datetime, timedelta
from database import get_database
from config import Settings

router = APIRouter(prefix="/chatbot", tags=["chatbot"])
logger = logging.getLogger(__name__)
settings = Settings()


async def build_business_snapshot(business_id: str) -> str:
    """Query MongoDB and build a data snapshot for the AI."""
    db = get_database()
    if not db:
        return "[Database not connected]"

    try:
        from bson import ObjectId

        # Find business (try string ID first, then ObjectId)
        biz = None
        for bid_val in [business_id]:
            biz = await db.businesses.find_one({"_id": bid_val})
            if biz:
                break
            try:
                biz = await db.businesses.find_one({"_id": ObjectId(bid_val)})
                if biz:
                    break
            except Exception:
                pass
        if not biz:
            return "[Business not found in database]"

        biz_name = biz.get("name", "Unknown")
        biz_id = str(biz["_id"])

        # ── Date setup ──
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_str = today.strftime("%Y-%m-%d")
        tomorrow_str = (today + timedelta(days=1)).strftime("%Y-%m-%d")

        # ── Today's bookings ──
        # Seed data uses: collection=bookings, field=businessId, date as string "YYYY-MM-DD"
        today_bookings = await db.bookings.find({
            "businessId": biz_id,
            "date": today_str
        }).to_list(length=500)

        # Fallback: try reservations collection with snake_case
        if not today_bookings:
            today_bookings = await db.reservations.find({
                "business_id": biz_id,
                "date": today_str
            }).to_list(length=500)

        # ── Helper for party size (handles both camelCase and snake_case) ──
        def covers(b):
            return b.get("partySize", b.get("party_size", b.get("covers", b.get("guests", 2))))

        def guest_name(b):
            c = b.get("customer", {})
            return c.get("name", b.get("guest_name", b.get("customer_name", b.get("customerName", "Guest"))))

        total_covers = sum(covers(b) for b in today_bookings)

        # Status breakdown
        statuses = {}
        for b in today_bookings:
            st = b.get("status", "unknown")
            statuses[st] = statuses.get(st, 0) + 1

        # Lunch vs dinner
        lunch = dinner = 0
        for b in today_bookings:
            t = b.get("time", "18:00")
            try:
                hour = int(str(t).split(":")[0])
            except Exception:
                hour = 18
            if hour < 15:
                lunch += covers(b)
            else:
                dinner += covers(b)

        # ── This week ──
        week_start = today - timedelta(days=today.weekday())
        week_dates = [(week_start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        week_bookings = await db.bookings.find({
            "businessId": biz_id,
            "date": {"$in": week_dates}
        }).to_list(length=2000)

        if not week_bookings:
            week_bookings = await db.reservations.find({
                "business_id": biz_id,
                "date": {"$in": week_dates}
            }).to_list(length=2000)

        week_covers = sum(covers(b) for b in week_bookings)

        # ── All time ──
        total_alltime = await db.bookings.count_documents({"businessId": biz_id})
        if total_alltime == 0:
            total_alltime = await db.reservations.count_documents({"business_id": biz_id})

        # All bookings for stats
        all_bookings = await db.bookings.find(
            {"businessId": biz_id},
            {"partySize": 1, "party_size": 1, "covers": 1, "status": 1, "customerId": 1, "user_id": 1, "customer": 1}
        ).to_list(length=10000)

        if not all_bookings:
            all_bookings = await db.reservations.find(
                {"business_id": biz_id},
                {"party_size": 1, "partySize": 1, "covers": 1, "status": 1, "user_id": 1}
            ).to_list(length=10000)

        covers_alltime = sum(covers(b) for b in all_bookings)

        # Unique customers
        customer_ids = set()
        for b in all_bookings:
            uid = b.get("customerId") or b.get("user_id") or (b.get("customer", {}) or {}).get("email")
            if uid:
                customer_ids.add(str(uid))
        total_customers = len(customer_ids) if customer_ids else total_alltime

        # No-show rate
        completed_count = sum(1 for b in all_bookings if b.get("status") in ("completed", "seated", "confirmed"))
        noshow_count = sum(1 for b in all_bookings if b.get("status") == "no_show")
        noshow_pct = f"{(noshow_count / max(completed_count + noshow_count, 1)) * 100:.0f}%"

        # Cancellation count
        cancelled_count = sum(1 for b in all_bookings if b.get("status") == "cancelled")

        # ── Tables from business doc ──
        tables = biz.get("tables", biz.get("floor_plan", {}).get("tables", []))
        if isinstance(tables, list):
            num_tables = len(tables)
            total_seats = sum(t.get("seats", t.get("capacity", 4)) for t in tables)
        else:
            num_tables = 0
            total_seats = 0

        # ── Upcoming bookings today ──
        upcoming = sorted(
            [b for b in today_bookings if b.get("status") in ("confirmed", "pending")],
            key=lambda b: str(b.get("time", ""))
        )
        upcoming_lines = []
        for b in upcoming[:6]:
            name = guest_name(b)
            t = b.get("time", "?")
            ps = covers(b)
            st = b.get("status", "?")
            tbl = b.get("table_name", b.get("tableId", "TBC"))
            occasion = b.get("occasion", "")
            notes = b.get("notes", "")
            extras = []
            if occasion and occasion != "none":
                extras.append(f"occasion: {occasion}")
            if notes:
                extras.append(f"note: {notes}")
            extra_str = f" ({', '.join(extras)})" if extras else ""
            upcoming_lines.append(f"  - {t}: {name} (party of {ps}) [{st}] table {tbl}{extra_str}")

        # ── Revenue estimate (if available) ──
        avg_spend = biz.get("avg_spend_per_head", biz.get("averageSpend", 0))
        revenue_est = ""
        if avg_spend and total_covers > 0:
            revenue_est = f"\n  Estimated revenue today: £{total_covers * avg_spend:.0f} (at £{avg_spend:.0f}/head)"

        now = datetime.utcnow()

        return f"""
═══════════════════════════════════════════
LIVE DATABASE — {biz_name}
Queried: {now.strftime('%H:%M %d/%m/%Y')} UTC
═══════════════════════════════════════════

TODAY ({today.strftime('%A %d %B %Y')}):
  Bookings: {len(today_bookings)}
  Covers: {total_covers} (lunch: {lunch}, dinner: {dinner}){revenue_est}
  Status: {', '.join(f'{v} {k}' for k, v in statuses.items()) if statuses else 'no bookings today'}

THIS WEEK:
  Bookings: {len(week_bookings)} | Covers: {week_covers}

ALL TIME:
  Total bookings: {total_alltime}
  Total covers served: {covers_alltime}
  Unique customers: {total_customers}
  No-show rate: {noshow_pct} ({noshow_count} no-shows)
  Cancellations: {cancelled_count}

VENUE:
  Tables: {num_tables} | Total seats: {total_seats}

NEXT UP TODAY:
{chr(10).join(upcoming_lines) if upcoming_lines else '  No upcoming bookings remaining today'}

RULES: These are REAL numbers from the database. Quote them exactly. If 0, say 0. NEVER invent data.
If asked about something not here (e.g. revenue breakdown, specific menu items, staff schedules), say you can see booking data but they'd need to check that section of the dashboard.
"""

    except Exception as e:
        logger.error(f"Snapshot error: {e}", exc_info=True)
        return f"[Database query error: {e}. Tell the user you couldn't pull live data right now and suggest checking the dashboard.]"


# ─── System Prompt ─── #
SYSTEM_PROMPT = """You are Rezvo's AI assistant for restaurant owners, embedded in their dashboard. You have REAL business data injected below from the live database.

PERSONALITY: Friendly, warm, British, concise. Like a sharp floor manager who knows the numbers cold. 2-3 short paragraphs max.

CRITICAL RULES:
1. ONLY quote numbers from the LIVE DATABASE section. NEVER invent or estimate numbers.
2. If data shows 0 bookings, say "looks quiet today" — don't make up figures.
3. If asked something outside the data snapshot, say "I can pull your booking data but for [X] you'd want to check that section of the dashboard."
4. Keep it SHORT. Chat widget, not essay.
5. Use **bold** for key numbers.
6. British English always.
7. When listing upcoming bookings, format them clearly with time, name, party size.
8. If someone asks "how many customers" — give the unique customer count, not booking count.

REZVO PLATFORM (for general questions):
- Zero commission booking/ordering platform for UK restaurants
- Pricing: Free (£0), Starter (£8.99/mo), Growth (£29/mo), Scale (£59/mo), Enterprise (custom)
- Delivery via Uber Direct at 5-8% (vs Deliveroo 25-35%)
- Features: Floor plan, CRM, bookings, online ordering, analytics
- Contact: hello@rezvo.app
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


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """AI chat with real database access."""

    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="AI chat not configured — set ANTHROPIC_API_KEY")

    # Build live data context
    data_context = ""
    if request.business_id:
        data_context = await build_business_snapshot(request.business_id)

    full_system = SYSTEM_PROMPT
    if data_context:
        full_system += "\n" + data_context
    if request.context:
        full_system += "\n\nADDITIONAL CONTEXT:\n" + request.context

    api_messages = [{"role": m.role, "content": m.content} for m in request.messages[-20:]]

    try:
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

        if response.status_code != 200:
            logger.error(f"Anthropic API error: {response.status_code} — {response.text}")
            raise HTTPException(status_code=502, detail="AI service temporarily unavailable")

        data = response.json()
        reply = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")

        if not reply:
            reply = "Hmm, gone blank for a sec! Try again or check the dashboard directly."

        return ChatResponse(reply=reply, session_id=request.session_id)

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI thinking too hard — try again!")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Something went wrong")
