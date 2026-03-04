"""
ReeveOS AI Chatbot — Claude-powered with REAL database access
"""
from fastapi import APIRouter, HTTPException, Request as FastAPIRequest
from pydantic import BaseModel
from typing import List, Optional
import httpx
import logging
import traceback
from datetime import datetime, timedelta
from middleware.rate_limit import limiter
from config import Settings

router = APIRouter(prefix="/chatbot", tags=["chatbot"])
logger = logging.getLogger(__name__)
settings = Settings()


async def build_business_snapshot(business_id: str) -> str:
    """Query MongoDB and build a data snapshot for the AI."""
    try:
        from database import get_database
        db = get_database()
    except Exception as e:
        return f"[Database import error: {e}]"

    if db is None:
        return "[Database not connected — data unavailable]"

    try:
        from bson import ObjectId
    except ImportError:
        ObjectId = None

    try:
        biz = None
        # Try string ID
        biz = await db.businesses.find_one({"_id": business_id})
        # Try ObjectId
        if not biz and ObjectId:
            try:
                biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
            except Exception:
                pass
        # Try slug
        if not biz:
            biz = await db.businesses.find_one({"slug": business_id})

        if not biz:
            return f"[Business '{business_id}' not found in database. The owner's data will load once they're linked to a business.]"

        biz_name = biz.get("name", "Unknown")
        biz_id = str(biz["_id"])

        # ── Date setup ──
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_str = today.strftime("%Y-%m-%d")

        # ── Today's bookings (handle both field naming conventions) ──
        biz_match = {"$or": [{"businessId": biz_id}, {"business_id": biz_id}]}
        today_bookings = await db.bookings.find({**biz_match, "date": today_str}).to_list(500)

        def covers(b):
            return b.get("partySize", b.get("party_size", b.get("covers", b.get("guests", 2))))

        def guest_name(b):
            c = b.get("customer") or {}
            return c.get("name", b.get("guest_name", b.get("customerName", "Guest")))

        total_covers = sum(covers(b) for b in today_bookings)

        # Status breakdown
        statuses = {}
        for b in today_bookings:
            st = b.get("status", "unknown")
            statuses[st] = statuses.get(st, 0) + 1

        # Lunch vs dinner
        lunch_c = dinner_c = 0
        for b in today_bookings:
            try:
                hour = int(str(b.get("time", "18:00")).split(":")[0])
            except Exception:
                hour = 18
            if hour < 15:
                lunch_c += covers(b)
            else:
                dinner_c += covers(b)

        # ── This week ──
        week_start = today - timedelta(days=today.weekday())
        week_dates = [(week_start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        week_bookings = await db.bookings.find({**biz_match, "date": {"$in": week_dates}}).to_list(2000)
        week_covers = sum(covers(b) for b in week_bookings)

        # ── All time stats ──
        total_alltime = await db.bookings.count_documents(biz_match)

        all_bookings = await db.bookings.find(
            biz_match,
            {"partySize": 1, "party_size": 1, "status": 1, "customerId": 1, "user_id": 1, "customer": 1, "covers": 1, "guests": 1}
        ).to_list(10000)

        covers_alltime = sum(covers(b) for b in all_bookings)

        # Unique customers
        cust_ids = set()
        for b in all_bookings:
            uid = b.get("customerId") or b.get("user_id") or (b.get("customer") or {}).get("email")
            if uid:
                cust_ids.add(str(uid))
        total_customers = len(cust_ids) if cust_ids else total_alltime

        # No-show & cancellation
        ok_count = sum(1 for b in all_bookings if b.get("status") in ("completed", "seated", "confirmed"))
        ns_count = sum(1 for b in all_bookings if b.get("status") == "no_show")
        cx_count = sum(1 for b in all_bookings if b.get("status") == "cancelled")
        ns_pct = f"{(ns_count / max(ok_count + ns_count, 1)) * 100:.0f}%"

        # Tables
        tables = biz.get("tables", [])
        if not isinstance(tables, list):
            tables = biz.get("floor_plan", {}).get("tables", [])
            if not isinstance(tables, list):
                tables = []
        num_tables = len(tables)
        total_seats = sum(t.get("seats", t.get("capacity", 4)) for t in tables) if tables else 0

        # Upcoming
        upcoming = sorted(
            [b for b in today_bookings if b.get("status") in ("confirmed", "pending")],
            key=lambda b: str(b.get("time", ""))
        )
        up_lines = []
        for b in upcoming[:6]:
            up_lines.append(f"  - {b.get('time','?')}: {guest_name(b)} (party of {covers(b)}) [{b.get('status','?')}] table {b.get('table_name', b.get('tableId','TBC'))}")

        now = datetime.utcnow()

        return f"""
LIVE DATABASE — {biz_name}
Queried: {now.strftime('%H:%M %d/%m/%Y')} UTC

TODAY ({today.strftime('%A %d %B %Y')}):
  Bookings: {len(today_bookings)}
  Covers: {total_covers} (lunch: {lunch_c}, dinner: {dinner_c})
  Status: {', '.join(f'{v} {k}' for k, v in statuses.items()) if statuses else 'no bookings today'}

THIS WEEK:
  Bookings: {len(week_bookings)} | Covers: {week_covers}

ALL TIME:
  Total bookings: {total_alltime}
  Total covers: {covers_alltime}
  Unique customers: {total_customers}
  No-show rate: {ns_pct} ({ns_count} no-shows)
  Cancellations: {cx_count}

VENUE:
  Tables: {num_tables} | Seats: {total_seats}

NEXT UP TODAY:
{chr(10).join(up_lines) if up_lines else '  No upcoming bookings'}

These are REAL numbers. Quote them exactly. If 0, say 0. NEVER invent data.
"""

    except Exception as e:
        logger.error(f"Snapshot error: {traceback.format_exc()}")
        return f"[Database error: {e}. Tell the user you couldn't pull live data and suggest checking the dashboard.]"


SYSTEM_PROMPT = """You are ReeveOS's AI assistant for restaurant owners, embedded in their dashboard. You have REAL business data below from the live database.

PERSONALITY: Friendly, warm, British, concise. 2-3 short paragraphs max.

RULES:
1. ONLY quote numbers from the LIVE DATABASE section. NEVER invent numbers.
2. If data shows 0, say so honestly.
3. If asked something not in the data, say you can see bookings but they'd need the dashboard for that detail.
4. Keep it SHORT. Use **bold** for key numbers. British English.

REEVEOS BASICS:
- Zero commission platform, flat monthly fee
- Pricing: Free (£0), Starter (£8.99), Growth (£29), Scale (£59), Enterprise (custom)
- Delivery via Uber Direct at 5-8% (vs Deliveroo 25-35%)
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


@router.get("/health")
async def health():
    """Debug endpoint to check chatbot + DB status."""
    try:
        from database import get_database
        db = get_database()
        if db is None:
            return {"status": "db_null", "chatbot": "ok"}
        count = await db.bookings.count_documents({})
        biz_count = await db.businesses.count_documents({})
        sample = await db.businesses.find_one({}, {"name": 1, "_id": 1, "slug": 1})
        return {
            "status": "ok",
            "bookings_count": count,
            "businesses_count": biz_count,
            "sample_business": {"id": str(sample["_id"]), "name": sample.get("name"), "slug": sample.get("slug")} if sample else None
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(http_request: FastAPIRequest, request: ChatRequest):
    """AI chat with real database access."""

    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="AI chat not configured")

    # Build live data context
    data_context = ""
    if request.business_id:
        try:
            data_context = await build_business_snapshot(request.business_id)
        except Exception as e:
            logger.error(f"Snapshot call failed: {traceback.format_exc()}")
            data_context = f"[Could not load business data: {e}]"

    full_system = SYSTEM_PROMPT
    if data_context:
        full_system += "\n" + data_context
    # NOTE: request.context removed — user-supplied text must never enter system prompt

    # Validate message roles — only allow user/assistant to prevent role injection
    allowed_roles = {"user", "assistant"}
    api_messages = [
        {"role": m.role, "content": m.content}
        for m in request.messages[-20:]
        if m.role in allowed_roles
    ]

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
        logger.error(f"Chat error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
