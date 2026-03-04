"""
Run 2: Public booking API — no auth required.
Customer-facing flow: /book/:businessSlug
"""

import os
import logging
from fastapi import APIRouter, HTTPException, status, Query, Request
from database import get_database
from middleware.rate_limit import limiter
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, date, time, timedelta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/book", tags=["book"])

# ═══════════════ UK 14 MAIN ALLERGENS ═══════════════
UK_ALLERGENS = [
    "celery", "gluten", "crustaceans", "eggs", "fish", "lupin",
    "milk", "molluscs", "mustard", "nuts", "peanuts", "sesame",
    "soya", "sulphites",
]

DEFAULT_TURN_TIME = 90  # minutes — restaurant default booking duration


# ═══════════════ TABLE ASSIGNMENT HELPERS ═══════════════

def _time_to_mins(t: str) -> int:
    """Convert 'HH:MM' to minutes since midnight."""
    try:
        parts = str(t).split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return 720  # noon fallback


def _mins_to_time(m: int) -> str:
    """Convert minutes since midnight to 'HH:MM'."""
    return f"{(m // 60) % 24:02d}:{m % 60:02d}"


def _times_overlap(start1: int, end1: int, start2: int, end2: int) -> bool:
    """Check if two time ranges overlap."""
    return start1 < end2 and start2 < end1


async def _get_tables(db, business):
    """Get tables from business doc or tables collection."""
    tables = business.get("tables", [])
    if tables:
        return tables
    # Try floor plan elements
    fp = business.get("floor_plan", {})
    if fp.get("elements"):
        return [e for e in fp["elements"] if e.get("type") != "fixture"]
    # Try separate tables collection
    biz_id = str(business["_id"])
    try:
        from bson import ObjectId
        cursor = db.tables.find({
            "$or": [
                {"business_id": biz_id},
                {"businessId": biz_id},
                {"business_id": ObjectId(biz_id)},
            ]
        })
        return await cursor.to_list(length=100)
    except Exception:
        return []


async def _get_day_bookings(db, biz_id: str, date_str: str):
    """Get all non-cancelled bookings for a business on a date."""
    return await db.bookings.find({
        "businessId": biz_id,
        "date": date_str,
        "status": {"$nin": ["cancelled", "no_show"]},
    }).to_list(length=500)


async def _find_best_table(db, business, date_str: str, time_str: str, party_size: int, duration: int = DEFAULT_TURN_TIME, preference: str = None):
    """
    Find the best available table for a booking.
    Returns (table_id, table_name) or (None, None) if no table fits.
    
    Strategy:
    - Get all tables, filter by capacity >= party_size
    - Get existing bookings for the day
    - Check each table for time conflicts
    - Pick the smallest available table that fits (efficient seating)
    - Apply seating preference if specified (window, booth, terrace, etc.)
    """
    biz_id = str(business["_id"])
    tables = await _get_tables(db, business)
    if not tables:
        return None, None

    day_bookings = await _get_day_bookings(db, biz_id, date_str)
    req_start = _time_to_mins(time_str)
    req_end = req_start + duration

    # Build occupation map: table_id -> list of (start_min, end_min)
    occupied = {}
    for b in day_bookings:
        tid = b.get("tableId") or b.get("table_id")
        if not tid:
            continue
        b_start = _time_to_mins(b.get("time", "12:00"))
        b_dur = b.get("duration") or DEFAULT_TURN_TIME
        b_end = b_start + b_dur
        occupied.setdefault(tid, []).append((b_start, b_end))

    # Filter and rank candidate tables
    candidates = []
    for t in tables:
        tid = t.get("id") or t.get("_id") or t.get("name")
        seats = t.get("seats") or t.get("capacity") or 4
        if seats < party_size:
            continue

        # Check time conflicts
        conflicts = occupied.get(tid, [])
        has_conflict = any(_times_overlap(req_start, req_end, s, e) for s, e in conflicts)
        if has_conflict:
            continue

        # Score: prefer smallest table that fits + seating preference match
        score = seats * 10  # lower = better (smallest table)
        zone = t.get("zone", "main")
        shape = t.get("shape", "")

        if preference:
            pref_lower = preference.lower()
            if pref_lower in ("window",) and zone == "main":
                score -= 5
            elif pref_lower in ("terrace", "outside") and zone in ("terrace", "outside"):
                score -= 15
            elif pref_lower in ("booth",) and shape == "booth":
                score -= 15
            elif pref_lower in ("quiet", "private") and zone in ("upstairs", "basement"):
                score -= 10

        candidates.append((score, tid, t.get("name") or tid))

    if not candidates:
        return None, None

    candidates.sort(key=lambda x: x[0])
    _, best_id, best_name = candidates[0]
    return best_id, best_name


async def _check_double_booking(db, biz_id: str, table_id: str, date_str: str, time_str: str, duration: int = DEFAULT_TURN_TIME, exclude_booking_id: str = None):
    """Check if a specific table has a conflict at the given time. Returns conflicting booking or None."""
    if not table_id:
        return None
    day_bookings = await _get_day_bookings(db, biz_id, date_str)
    req_start = _time_to_mins(time_str)
    req_end = req_start + duration

    for b in day_bookings:
        if exclude_booking_id and (b.get("_id") == exclude_booking_id):
            continue
        btid = b.get("tableId") or b.get("table_id")
        if btid != table_id:
            continue
        b_start = _time_to_mins(b.get("time", "12:00"))
        b_dur = b.get("duration") or DEFAULT_TURN_TIME
        b_end = b_start + b_dur
        if _times_overlap(req_start, req_end, b_start, b_end):
            return b  # conflict found
    return None


def _get_address_str(business):
    """Extract address as string from either string or dict format."""
    raw = business.get("address", "")
    if isinstance(raw, dict):
        return f"{raw.get('line1', '')}, {raw.get('city', '')} {raw.get('postcode', '')}".strip(", ")
    return raw


# --- Request/Response models ---

class CustomerInfo(BaseModel):
    name: str
    phone: str
    email: EmailStr


class BookingCreateServices(BaseModel):
    serviceId: str
    staffId: Optional[str] = None
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    customer: CustomerInfo
    notes: Optional[str] = None


class BookingCreateRestaurant(BaseModel):
    partySize: int
    date: str
    time: str
    customer: CustomerInfo
    occasion: Optional[str] = None
    seatingPreference: Optional[str] = None
    dietaryRequirements: Optional[List[str]] = None
    notes: Optional[str] = None
    depositPaymentIntentId: Optional[str] = None


# --- Public booking endpoints ---

# ═══ Fixed routes MUST come before {business_slug} routes ═══

@router.get("/allergens")
async def get_allergens():
    """Returns the 14 main UK allergens for booking forms."""
    return {
        "allergens": UK_ALLERGENS,
        "labels": {
            "celery": "Celery", "gluten": "Cereals (Gluten)", "crustaceans": "Crustaceans",
            "eggs": "Eggs", "fish": "Fish", "lupin": "Lupin", "milk": "Milk",
            "molluscs": "Molluscs", "mustard": "Mustard", "nuts": "Tree Nuts",
            "peanuts": "Peanuts", "sesame": "Sesame", "soya": "Soya", "sulphites": "Sulphites",
        }
    }


@router.get("/{business_slug}")
async def get_booking_page(business_slug: str):
    """Returns business public profile, services/staff, settings for booking page."""
    db = get_database()
    business = await db.businesses.find_one({"slug": business_slug})
    if not business or not business.get("claimed"):
        raise HTTPException(status_code=404, detail="Business not found")

    # Map category to Run 2 type
    cat = business.get("category", "salon")
    biz_type = "restaurant" if cat == "restaurant" else "services"

    # Services (from menu) - for services type
    menu = business.get("menu", [])
    services = []
    for s in menu:
        if s.get("active", True):
            services.append({
                "id": s.get("id", str(s.get("_id", ""))),
                "name": s.get("name", ""),
                "category": s.get("category", "General"),
                "duration": s.get("duration_minutes", 60),
                "price": int((s.get("price", 0) or 0) * 100),
                "description": s.get("description", ""),
                "staffIds": [st.get("id") for st in business.get("staff", []) if st.get("id")],
                "online": s.get("active", True),
            })

    # Staff
    staff_list = []
    for st in business.get("staff", []):
        if st.get("active", True):
            staff_list.append({
                "id": st.get("id", ""),
                "name": st.get("name", ""),
                "role": st.get("role", "Staff"),
                "avatar": st.get("avatar"),
                "rating": st.get("rating"),
            })

    categories = ["All"] + list(dict.fromkeys(s.get("category", "General") for s in services if s.get("category")))

    def _img_url(path):
        if not path or not isinstance(path, str):
            return path
        if path.startswith("http"):
            return path
        # On production, REZVO_API_URL should be set to the public API URL
        # Fallback: use /api prefix which works with nginx proxy
        base = os.environ.get("REZVO_API_URL", "")
        if base:
            return f"{base.rstrip('/')}{path}" if path.startswith("/") else path
        # No base URL set — return relative path with /api prefix for nginx
        return f"/api{path}" if path.startswith("/") else path

    bp = business.get("bookingPage") or {}
    branding = bp.get("branding") or {}
    bs = business.get("booking_settings") or {}
    bp_settings = bp.get("settings") or {}
    settings = {
        "bookingIntervalMinutes": bp_settings.get("bookingIntervalMinutes") or bs.get("slot_duration_minutes", 30),
        "advanceBookingDays": bp_settings.get("advanceBookingDays") or bs.get("advance_booking_days", 60),
        "cancellationNoticeHours": bp_settings.get("cancellationNoticeHours") or bs.get("cancellation_hours", 24),
        "autoConfirm": bp_settings.get("autoConfirm", bs.get("auto_confirm", True)),
        "bufferMinutes": bp_settings.get("bufferMinutes", 15),
        "depositEnabled": bp_settings.get("depositEnabled", bs.get("require_deposit", False)),
        "depositType": bp_settings.get("depositType") or ("per_person" if biz_type == "restaurant" else None),
        "depositAmount": bp_settings.get("depositAmount") or int((bs.get("deposit_amount") or 0) * 100) if bs.get("deposit_amount") else None,
    }

    if biz_type == "restaurant":
        settings["maxPartySize"] = bs.get("max_party_size", 12)
        settings["largePartyThreshold"] = 7
        # Service periods from booking_settings or defaults
        sp = bs.get("service_periods")
        if sp:
            settings["servicePeriods"] = sp
        else:
            settings["servicePeriods"] = [
                {"name": "Lunch", "start": "12:00", "end": "14:30"},
                {"name": "Dinner", "start": "18:00", "end": "22:00"},
            ]

    # Pass opening hours so booking page can generate correct time slots
    oh = business.get("openingHours") or business.get("opening_hours") or {}
    day_map = {"monday": "mon", "tuesday": "tue", "wednesday": "wed", "thursday": "thu", "friday": "fri", "saturday": "sat", "sunday": "sun"}
    hours = {}
    for full_name, short in day_map.items():
        h = oh.get(short) or oh.get(full_name)
        if isinstance(h, dict):
            is_open = h.get("open", True)
            if isinstance(is_open, str):
                # Legacy format: open="12:00", close="23:00"
                hours[full_name] = {"open": is_open, "close": h.get("close", "23:00")}
            elif h.get("closed") or not is_open:
                hours[full_name] = {"closed": True}
            else:
                hours[full_name] = {"open": h.get("start", "09:00"), "close": h.get("end", "17:00")}
    settings["hours"] = hours

    # Calculate if currently open based on real hours
    from datetime import datetime as dt
    now = dt.utcnow()
    day_keys_full = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
    today_key = day_keys_full[now.weekday()]
    today_hours = hours.get(today_key, {})
    is_open = False
    if today_hours and not today_hours.get("closed"):
        open_time = today_hours.get("open", "00:00")
        close_time = today_hours.get("close", "23:59")
        now_str = now.strftime("%H:%M")
        is_open = open_time <= now_str <= close_time

    return {
        "business": {
            "id": str(business["_id"]),
            "name": business.get("name", ""),
            "slug": business.get("slug", ""),
            "type": biz_type,
            "logo": _img_url(branding.get("logo")),
            "coverPhoto": _img_url(branding.get("coverPhoto")) or (business.get("custom_photos") or business.get("photo_refs") or [None])[0],
            "description": branding.get("description", ""),
            "accentColour": branding.get("accentColour", "#1B4332"),
            "rating": business.get("rating"),
            "reviewCount": business.get("review_count", 0),
            "address": _get_address_str(business),
            "phone": business.get("phone", ""),
            "website": business.get("website", ""),
            "isOpen": is_open,
            "currency": "GBP",
        },
        "services": services,
        "staff": staff_list,
        "categories": categories,
        "settings": settings,
    }


@router.get("/{business_slug}/dates")
async def get_available_dates(
    business_slug: str,
    serviceId: Optional[str] = Query(None),
    partySize: int = Query(2, ge=1),
    days: int = Query(60, ge=1, le=90),
):
    """Returns which dates have availability."""
    db = get_database()
    business = await db.businesses.find_one({"slug": business_slug})
    if not business or not business.get("claimed"):
        raise HTTPException(404, "Business not found")

    dates = {}
    start = date.today()
    for i in range(days):
        d = start + timedelta(days=i)
        dates[d.isoformat()] = True  # Simplified: all dates available for now

    return {"dates": dates}


@router.get("/{business_slug}/availability")
async def get_availability(
    business_slug: str,
    date_param: str = Query(..., alias="date"),
    serviceId: Optional[str] = Query(None),
    staffId: Optional[str] = Query(None),
    partySize: int = Query(2, ge=1),
):
    """Returns available time slots for a date with REAL table availability."""
    db = get_database()
    business = await db.businesses.find_one({"slug": business_slug})
    if not business or not business.get("claimed"):
        raise HTTPException(404, "Business not found")

    try:
        d = datetime.strptime(date_param, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format")

    biz_id = str(business["_id"])
    bs = business.get("booking_settings") or {}
    bp = business.get("bookingPage") or {}
    bp_s = bp.get("settings") or {}
    interval = bp_s.get("bookingIntervalMinutes") or bs.get("slot_duration_minutes", 30)
    turn_time = bp_s.get("turnTimeMinutes") or bs.get("turn_time_minutes") or DEFAULT_TURN_TIME

    # Get tables and existing bookings
    tables = await _get_tables(db, business)
    day_bookings = await _get_day_bookings(db, biz_id, date_param)

    # Build occupation map
    occupied = {}  # table_id -> [(start, end), ...]
    for b in day_bookings:
        tid = b.get("tableId") or b.get("table_id")
        if not tid:
            continue
        b_start = _time_to_mins(b.get("time", "12:00"))
        b_dur = b.get("duration") or turn_time
        occupied.setdefault(tid, []).append((b_start, b_start + b_dur))

    # Filter tables that can fit the party
    fitting_tables = [t for t in tables if (t.get("seats") or t.get("capacity") or 4) >= partySize]

    # Opening hours
    open_time = _time_to_mins(bp_s.get("openTime") or bs.get("open_time") or "09:00")
    close_time = _time_to_mins(bp_s.get("closeTime") or bs.get("close_time") or "21:00")
    last_booking = close_time - turn_time  # Can't book if it won't finish before close

    slots = []
    current_mins = open_time
    while current_mins <= last_booking:
        slot_end = current_mins + turn_time
        # Count how many fitting tables are free at this time
        free_count = 0
        for t in fitting_tables:
            tid = t.get("id") or t.get("_id") or t.get("name")
            table_slots = occupied.get(tid, [])
            conflict = any(_times_overlap(current_mins, slot_end, s, e) for s, e in table_slots)
            if not conflict:
                free_count += 1

        slots.append({
            "time": _mins_to_time(current_mins),
            "available": free_count > 0,
            "tablesLeft": free_count,
        })
        current_mins += interval

    return {"date": date_param, "slots": slots, "turnTime": turn_time}


@router.post("/{business_slug}/create")
@limiter.limit("10/minute")
async def create_booking(request: Request, business_slug: str, payload: dict):
    """Creates a booking with auto table assignment, double-booking prevention, allergens, deposits."""
    db = get_database()
    business = await db.businesses.find_one({"slug": business_slug})
    if not business or not business.get("claimed"):
        raise HTTPException(404, "Business not found")

    biz_id = str(business["_id"])
    biz_type = "restaurant" if business.get("category") == "restaurant" else "services"

    # Generate reference
    # Atomic reference counter — prevents collisions under concurrent bookings
    counter_doc = await db.counters.find_one_and_update(
        {"_id": f"booking_ref_{biz_id}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    ref_num = counter_doc.get("seq", 1)
    reference = f"REZ-{ref_num:04d}"

    bp = business.get("bookingPage") or {}
    bp_s = bp.get("settings") or {}
    bs = business.get("booking_settings") or {}
    auto_confirm = bp_s.get("autoConfirm", bs.get("auto_confirm", True))
    customer = payload.get("customer", {})

    # ── Input validation ──
    from middleware.validation import sanitise_text, validate_party_size
    cust_name = sanitise_text(customer.get("name", ""), 100)
    cust_email = customer.get("email", "").strip().lower()[:254]
    cust_phone = customer.get("phone", "").strip()[:20]
    if not cust_name:
        raise HTTPException(400, "Customer name is required")

    # ── Duration (restaurants) ──
    turn_time = bp_s.get("turnTimeMinutes") or bs.get("turn_time_minutes") or DEFAULT_TURN_TIME
    duration = payload.get("duration") or turn_time
    booking_time = payload.get("time", "12:00")
    end_time = _add_minutes(booking_time, duration)

    # ── Party size ──
    party_size = payload.get("partySize") or 2
    party_size = validate_party_size(int(party_size))

    # ── Allergens (validate against UK 14) ──
    raw_allergens = payload.get("allergens", [])
    allergens = [a.lower().strip() for a in raw_allergens if a.lower().strip() in UK_ALLERGENS]
    # Also keep free-text dietary requirements
    dietary_reqs = payload.get("dietaryRequirements", [])

    # ── Auto table assignment (restaurants only) ──
    table_id = None
    table_name = None
    if biz_type == "restaurant":
        requested_table = payload.get("tableId")
        if requested_table:
            # Check double-booking on requested table
            conflict = await _check_double_booking(
                db, biz_id, requested_table,
                payload.get("date", ""), booking_time, duration
            )
            if conflict:
                conflict_name = conflict.get("customer", {}).get("name", "another booking")
                conflict_time = conflict.get("time", "")
                raise HTTPException(
                    409,
                    f"Table {requested_table} is already booked at {conflict_time} by {conflict_name}. Please choose a different time or table."
                )
            table_id = requested_table
            table_name = requested_table
        else:
            # Auto-assign best available table
            table_id, table_name = await _find_best_table(
                db, business,
                payload.get("date", ""),
                booking_time,
                party_size,
                duration,
                payload.get("seatingPreference"),
            )
            # No table = venue is full at that time
            if not table_id:
                # Still create booking (unassigned) — staff can assign manually
                logger.info(f"No table auto-assigned for {reference} — all tables occupied or none configured")

    # ── Deposit logic ──
    deposit_settings = bp_s.get("deposit") or bs.get("deposit") or {}
    deposit_threshold = deposit_settings.get("minPartySize", 6)  # Default: 6+ guests
    deposit_amount = deposit_settings.get("amount")  # e.g. 10.00 per person or flat
    deposit_type = deposit_settings.get("type", "per_person")  # per_person or flat
    deposit_enabled = deposit_settings.get("enabled", True) and party_size >= deposit_threshold
    cancellation_hours = deposit_settings.get("cancellationHours", 24)

    deposit_total = None
    if deposit_enabled and deposit_amount:
        if deposit_type == "per_person":
            deposit_total = round(deposit_amount * party_size, 2)
        else:
            deposit_total = round(deposit_amount, 2)

    # ── CRM: ensure client record ──
    from routes.dashboard.clients import ensure_client_from_booking, refresh_client_stats
    client_id = await ensure_client_from_booking(db, biz_id, customer, "online", payload.get("date"))

    # ── Build booking document ──
    doc = {
        "_id": f"bkg_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{biz_id[:8]}",
        "customerId": client_id,
        "reference": reference,
        "businessId": biz_id,
        "type": biz_type,
        "status": "confirmed" if auto_confirm else "pending",
        "service": payload.get("service") or None,
        "staffId": payload.get("staffId"),
        "partySize": party_size,
        "date": payload.get("date"),
        "time": booking_time,
        "duration": duration,
        "endTime": end_time,
        "tableId": table_id,
        "tableName": table_name,
        "customer": {
            "name": cust_name,
            "phone": cust_phone,
            "email": cust_email,
        },
        "notes": sanitise_text(payload.get("notes") or "", 500),
        "occasion": payload.get("occasion"),
        "seatingPreference": payload.get("seatingPreference"),
        "allergens": allergens,
        "dietaryRequirements": dietary_reqs,
        "deposit": {
            "enabled": deposit_enabled,
            "amount": deposit_total,
            "threshold": deposit_threshold,
            "cancellationHours": cancellation_hours,
            "stripePaymentIntentId": payload.get("depositPaymentIntentId"),
            "status": "paid" if payload.get("depositPaymentIntentId") else ("required" if deposit_enabled else None),
        },
        "source": "online",
        "notifications": {"confirmationSent": False, "reminderScheduled": None, "reminderSent": False, "reviewRequestSent": False},
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }

    # Services-specific fields
    if biz_type == "services":
        svc = next((s for s in business.get("menu", []) if s.get("id") == payload.get("serviceId")), None)
        doc["service"] = {"id": payload.get("serviceId"), "name": svc.get("name") if svc else "", "duration": (svc or {}).get("duration_minutes", 60)}
        doc["endTime"] = _add_minutes(booking_time, (svc or {}).get("duration_minutes", 60))
        doc["duration"] = (svc or {}).get("duration_minutes", 60)

    await db.bookings.insert_one(doc)

    if client_id:
        await refresh_client_stats(db, biz_id, client_id)

    # ── Notifications ──
    try:
        from helpers.notifications import notify_booking_created
        import asyncio
        asyncio.ensure_future(notify_booking_created(doc, business))
    except Exception as notify_err:
        logger.warning(f"Notification dispatch failed (booking still created): {notify_err}")

    # ── Activity log ──
    cust_name = (doc.get("customer") or {}).get("name", "Customer")
    table_info = f", table {table_name}" if table_name else ""
    allergen_info = f", allergens: {', '.join(allergens)}" if allergens else ""
    await db.activity_log.insert_one({
        "businessId": biz_id,
        "type": "booking_created",
        "message": f"New booking: {cust_name} — party of {party_size}, {doc.get('date')} at {booking_time}–{end_time}{table_info}{allergen_info}",
        "bookingId": doc["_id"],
        "timestamp": datetime.utcnow(),
    })

    return {
        "booking": {
            "id": doc["_id"],
            "reference": reference,
            "status": doc["status"],
            "business": {"name": business.get("name"), "address": _get_address_str(business)},
            "service": doc.get("service"),
            "date": doc.get("date"),
            "time": booking_time,
            "endTime": end_time,
            "duration": duration,
            "partySize": party_size,
            "tableId": table_id,
            "tableName": table_name,
            "allergens": allergens,
            "deposit": doc["deposit"],
            "customer": doc["customer"],
            "notes": doc.get("notes"),
            "calendarLinks": {
                "google": f"https://calendar.google.com/calendar/render?action=TEMPLATE&text=Booking at {business.get('name')}&dates={doc.get('date','').replace('-','')}T{booking_time.replace(':','')}00/{doc.get('date','').replace('-','')}T{end_time.replace(':','')}00&location={_get_address_str(business)}",
            },
        },
    }


def _add_minutes(tstr: str, mins: int) -> str:
    try:
        h, m = map(int, tstr.split(":"))
        m += mins
        h += m // 60
        m %= 60
        return f"{h:02d}:{m:02d}"
    except Exception:
        return tstr


def _get_staff_name(business, staff_id):
    if not staff_id:
        return None
    for st in business.get("staff", []):
        if st.get("id") == staff_id:
            return st.get("name")
    return None


def _calendar_links(business, doc):
    addr = _get_address_str(business)
    name = business.get("name", "")
    dt = f"{doc['date']}T{doc['time']}:00"
    return {
        "google": f"https://calendar.google.com/calendar/render?action=TEMPLATE&text=Booking at {name}&dates={dt.replace('-', '').replace(':', '')}/{dt.replace('-', '').replace(':', '')}&location={addr}",
        "apple": f"data:text/calendar;charset=utf8,BEGIN:VCALENDAR...",
    }


# ═══════════════ WALK-IN QUICK ADD ═══════════════

@router.post("/{business_slug}/walkin")
async def create_walkin(business_slug: str, payload: dict):
    """Quick walk-in: name, party size, table — done. No email/phone required."""
    db = get_database()
    business = await db.businesses.find_one({"slug": business_slug})
    if not business or not business.get("claimed"):
        raise HTTPException(404, "Business not found")

    biz_id = str(business["_id"])
    name = payload.get("name", "Walk-in")
    party_size = payload.get("partySize", 2)
    table_id = payload.get("tableId")
    table_name = payload.get("tableName") or table_id
    notes = payload.get("notes", "")
    now = datetime.utcnow()
    today_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M")

    turn_time = (business.get("bookingPage") or {}).get("settings", {}).get("turnTimeMinutes") or DEFAULT_TURN_TIME
    duration = payload.get("duration") or turn_time

    # Double-booking check if table specified
    if table_id:
        conflict = await _check_double_booking(db, biz_id, table_id, today_str, time_str, duration)
        if conflict:
            conflict_name = conflict.get("customer", {}).get("name", "someone")
            raise HTTPException(409, f"Table {table_id} occupied by {conflict_name} until {_add_minutes(conflict.get('time',''), conflict.get('duration', duration))}")

    # Auto-assign if no table given
    if not table_id:
        table_id, table_name = await _find_best_table(db, business, today_str, time_str, party_size, duration)

    counter_doc = await db.counters.find_one_and_update(
        {"_id": f"walkin_ref_{biz_id}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    reference = f"WLK-{counter_doc.get('seq', 1):04d}"

    doc = {
        "_id": f"wlk_{now.strftime('%Y%m%d%H%M%S')}_{biz_id[:8]}",
        "reference": reference,
        "businessId": biz_id,
        "type": "restaurant",
        "status": "seated",  # Walk-ins are immediately seated
        "partySize": party_size,
        "date": today_str,
        "time": time_str,
        "duration": duration,
        "endTime": _add_minutes(time_str, duration),
        "tableId": table_id,
        "tableName": table_name,
        "customer": {"name": name, "phone": "", "email": ""},
        "notes": notes,
        "allergens": [a.lower() for a in payload.get("allergens", []) if a.lower() in UK_ALLERGENS],
        "source": "walkin",
        "deposit": {"enabled": False},
        "createdAt": now,
        "updatedAt": now,
    }

    await db.bookings.insert_one(doc)

    await db.activity_log.insert_one({
        "businessId": biz_id,
        "type": "walkin",
        "message": f"Walk-in: {name}, party of {party_size}" + (f", table {table_name}" if table_name else ""),
        "bookingId": doc["_id"],
        "timestamp": now,
    })

    return {
        "booking": {
            "id": doc["_id"],
            "reference": reference,
            "status": "seated",
            "name": name,
            "partySize": party_size,
            "tableId": table_id,
            "tableName": table_name,
            "time": time_str,
            "endTime": doc["endTime"],
        }
    }


@router.get("/{business_slug}/booking/{booking_id}")
async def get_booking(business_slug: str, booking_id: str):
    """Returns booking details for confirmation/manage pages."""
    db = get_database()
    business = await db.businesses.find_one({"slug": business_slug})
    if not business:
        raise HTTPException(404, "Business not found")

    bkg = await db.bookings.find_one({"_id": booking_id, "businessId": str(business["_id"])})
    if not bkg:
        raise HTTPException(404, "Booking not found")

    return _format_booking(bkg, business)


@router.put("/{business_slug}/booking/{booking_id}")
async def update_booking(business_slug: str, booking_id: str, payload: dict):
    db = get_database()
    business = await db.businesses.find_one({"slug": business_slug})
    if not business:
        raise HTTPException(404, "Business not found")

    bkg = await db.bookings.find_one({"_id": booking_id, "businessId": str(business["_id"])})
    if not bkg:
        raise HTTPException(404, "Booking not found")
    if bkg.get("status") == "cancelled":
        raise HTTPException(400, "Cannot modify cancelled booking")

    update = {"updatedAt": datetime.utcnow()}
    if "date" in payload:
        update["date"] = payload["date"]
    if "time" in payload:
        update["time"] = payload["time"]

    await db.bookings.update_one({"_id": booking_id}, {"$set": update})
    updated = await db.bookings.find_one({"_id": booking_id})
    return _format_booking(updated, business)


@router.delete("/{business_slug}/booking/{booking_id}")
async def cancel_booking(business_slug: str, booking_id: str):
    db = get_database()
    business = await db.businesses.find_one({"slug": business_slug})
    if not business:
        raise HTTPException(404, "Business not found")

    bkg = await db.bookings.find_one({"_id": booking_id, "businessId": str(business["_id"])})
    if not bkg:
        raise HTTPException(404, "Booking not found")

    await db.bookings.update_one(
        {"_id": booking_id},
        {"$set": {"status": "cancelled", "cancelledAt": datetime.utcnow(), "updatedAt": datetime.utcnow()}},
    )

    # Fire cancellation notifications
    try:
        from helpers.notifications import notify_booking_cancelled
        import asyncio
        asyncio.ensure_future(notify_booking_cancelled(bkg, business, cancelled_by="customer"))
    except Exception as notify_err:
        logger.warning(f"Cancel notification failed: {notify_err}")

    return {"detail": "Booking cancelled"}


def _format_booking(bkg, business):
    addr = _get_address_str(business)
    name = business.get("name", "")
    dt = f"{bkg.get('date', '')}T{bkg.get('time', '00:00')}:00"
    return {
        "id": bkg["_id"],
        "reference": bkg.get("reference"),
        "status": bkg.get("status"),
        "business": {"name": name, "address": addr},
        "service": bkg.get("service"),
        "staff": {"name": _get_staff_name(business, bkg.get("staffId"))} if bkg.get("staffId") else None,
        "date": bkg.get("date"),
        "time": bkg.get("time"),
        "customer": bkg.get("customer"),
        "partySize": bkg.get("partySize"),
        "notes": bkg.get("notes"),
        "calendarLinks": {
            "google": f"https://calendar.google.com/calendar/render?action=TEMPLATE&text=Booking at {name}&dates={dt.replace('-', '').replace(':', '')}00/{dt.replace('-', '').replace(':', '')}00&location={addr}",
        },
    }
