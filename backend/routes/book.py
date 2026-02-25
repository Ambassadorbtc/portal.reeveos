"""
Run 2: Public booking API — no auth required.
Customer-facing flow: /book/:businessSlug
"""

import os
import logging
from fastapi import APIRouter, HTTPException, status, Query
from database import get_database
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, date, time, timedelta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/book", tags=["book"])


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
    """Returns available time slots for a date."""
    db = get_database()
    business = await db.businesses.find_one({"slug": business_slug})
    if not business or not business.get("claimed"):
        raise HTTPException(404, "Business not found")

    try:
        d = datetime.strptime(date_param, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format")

    bs = business.get("booking_settings") or {}
    bp = business.get("bookingPage") or {}
    bp_s = bp.get("settings") or {}
    interval = bp_s.get("bookingIntervalMinutes") or bs.get("slot_duration_minutes", 30)

    slots = []
    current = datetime.combine(d, time(9, 0))
    end_dt = datetime.combine(d, time(21, 0))

    while current < end_dt:
        slots.append({"time": current.strftime("%H:%M"), "available": True, "tablesLeft": 5})
        current += timedelta(minutes=interval)

    return {"date": date_param, "slots": slots}


@router.post("/{business_slug}/create")
async def create_booking(business_slug: str, payload: dict):
    """Creates a booking (services or restaurant)."""
    db = get_database()
    business = await db.businesses.find_one({"slug": business_slug})
    if not business or not business.get("claimed"):
        raise HTTPException(404, "Business not found")

    biz_id = str(business["_id"])
    biz_type = "restaurant" if business.get("category") == "restaurant" else "services"

    # Generate reference
    count = await db.bookings.count_documents({"businessId": biz_id}) if hasattr(db, 'bookings') else 0
    ref_num = (count % 10000) + 1
    reference = f"REZ-{ref_num:04d}"

    bp = business.get("bookingPage") or {}
    bp_s = bp.get("settings") or {}
    bs = business.get("booking_settings") or {}
    auto_confirm = bp_s.get("autoConfirm", bs.get("auto_confirm", True))
    customer = payload.get("customer", {})
    from routes.run7_clients import ensure_client_from_booking, refresh_client_stats
    client_id = await ensure_client_from_booking(db, biz_id, customer, "online", payload.get("date"))
    doc = {
        "_id": f"bkg_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{biz_id[:8]}",
        "customerId": client_id,
        "reference": reference,
        "businessId": biz_id,
        "type": biz_type,
        "status": "confirmed" if auto_confirm else "pending",
        "service": payload.get("service") or None,
        "staffId": payload.get("staffId"),
        "partySize": payload.get("partySize"),
        "date": payload.get("date"),
        "time": payload.get("time"),
        "customer": {
            "name": customer.get("name", ""),
            "phone": customer.get("phone", ""),
            "email": customer.get("email", ""),
        },
        "notes": payload.get("notes"),
        "occasion": payload.get("occasion"),
        "seatingPreference": payload.get("seatingPreference"),
        "dietaryRequirements": payload.get("dietaryRequirements", []),
        "deposit": {"enabled": False, "amount": None, "stripePaymentIntentId": payload.get("depositPaymentIntentId"), "status": None},
        "channel": "online",
        "source": "booking_link",
        "notifications": {"confirmationSent": False, "reminderScheduled": None, "reminderSent": False, "reviewRequestSent": False},
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }

    if biz_type == "services":
        svc = next((s for s in business.get("menu", []) if s.get("id") == payload.get("serviceId")), None)
        doc["service"] = {"id": payload.get("serviceId"), "name": svc.get("name") if svc else "", "duration": (svc or {}).get("duration_minutes", 60)}
        doc["endTime"] = _add_minutes(payload.get("time", "00:00"), (svc or {}).get("duration_minutes", 60))

    await db.bookings.insert_one(doc)

    if client_id:
        await refresh_client_stats(db, biz_id, client_id)

    # ── Fire email + SMS notifications (async, non-blocking) ──
    try:
        from helpers.notifications import notify_booking_created
        import asyncio
        asyncio.ensure_future(notify_booking_created(doc, business))
    except Exception as notify_err:
        logger.warning(f"Notification dispatch failed (booking still created): {notify_err}")

    # Run 3: Log to activity feed
    cust_name = (doc.get("customer") or {}).get("name", "Customer")
    svc_name = (doc.get("service") or {}).get("name", "Booking")
    await db.activity_log.insert_one({
        "businessId": biz_id,
        "type": "booking_created",
        "message": f"New booking: {cust_name} — {svc_name}, {doc.get('date')} at {doc.get('time')}",
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
            "staff": {"name": _get_staff_name(business, doc.get("staffId"))} if doc.get("staffId") else None,
            "date": doc["date"],
            "time": doc["time"],
            "customer": doc["customer"],
            "depositPaid": None,
            "calendarLinks": _calendar_links(business, doc),
        }
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
