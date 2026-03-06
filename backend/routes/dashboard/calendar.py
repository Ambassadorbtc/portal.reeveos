"""
Calendar API — queries both appointments (services) and bookings (restaurants)
Uses normalize_booking() for consistent field access regardless of storage format.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from database import get_database
from middleware.tenant_db import get_scoped_db
from middleware.auth import get_current_staff
from middleware.tenant import verify_business_access, TenantContext
from models.normalize import normalize_booking
from middleware.encryption import TenantEncryption
from datetime import datetime, timedelta
from bson import ObjectId

router = APIRouter(prefix="/calendar", tags=["calendar"])

STATUS_COLOURS = {
    "confirmed": "#22C55E",
    "checked_in": "#3B82F6",
    "completed": "#6B7280",
    "cancelled": "#EF4444",
    "no_show": "#991B1B",
    "pending": "#F59E0B",
}


async def _get_business(db, business_id: str, user: dict):
    try:
        b = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        b = await db.businesses.find_one({"_id": business_id})
    if not b:
        raise HTTPException(404, "Business not found")
    owner = str(b.get("owner_id", ""))
    uid = str(user.get("_id", ""))
    if owner and owner != uid and str(user.get("role", "")).lower() not in ("staff", "business_owner", "platform_admin", "super_admin"):
        raise HTTPException(403, "Not authorized")
    return b


def _safe_str(val):
    return str(val) if val else ""


def _mins_to_time(m: int) -> str:
    """Convert minutes since midnight to 'HH:MM'."""
    return f"{(m // 60) % 24:02d}:{m % 60:02d}"


async def _query_both_collections(db, business_id, bid_str, date_param, collection_names):
    """Query multiple collections with multiple field name patterns."""
    all_raw = []
    bid_values = list(set([v for v in [business_id, bid_str] if v]))
    # Also try ObjectId versions for seed data compatibility
    bid_oid_values = []
    for v in bid_values:
        try:
            bid_oid_values.append(ObjectId(v))
        except Exception:
            pass
    all_bid_values = bid_values + bid_oid_values

    for coll_name in collection_names:
        coll = db[coll_name]
        for bid_field in ["business_id", "businessId"]:
            try:
                cursor = coll.find({
                    bid_field: {"$in": all_bid_values},
                    "date": date_param,
                    "status": {"$nin": ["cancelled"]},
                })
                docs = await cursor.to_list(length=200)
                all_raw.extend(docs)
            except Exception:
                pass

    # Deduplicate by _id
    seen = set()
    result = []
    for doc in all_raw:
        doc_id = str(doc.get("_id", ""))
        if doc_id and doc_id not in seen:
            seen.add(doc_id)
            result.append(doc)
    return result


@router.get("/business/{business_id}")
async def get_calendar(
    business_id: str,
    date_param: str = Query(..., alias="date"),
    view: str = Query("day"),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Calendar data for service businesses (salons, spas, etc.)."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    # Access already verified by verify_business_access — just load business
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    bid_str = _safe_str(business.get("_id"))

    try:
        datetime.strptime(date_param, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date")

    staff_list = [st for st in business.get("staff", []) if st.get("active", True)]
    if not staff_list:
        staff_list = [{"id": "default", "name": "All", "avatar": None}]

    bookings_raw = await _query_both_collections(
        db, business_id, bid_str, date_param,
        ["appointments", "bookings"]
    )

    bookings = []
    for b in bookings_raw:
        nb = normalize_booking(b)

        service_name = "Booking"
        if isinstance(nb["service"], dict):
            service_name = nb["service"].get("name", "Booking")

        svc_duration = nb["duration"]
        if isinstance(nb["service"], dict):
            svc_duration = nb["service"].get("duration", nb["duration"])

        price = 0
        if isinstance(nb["service"], dict):
            price = nb["service"].get("price", 0)

        bookings.append({
            "id": nb["id"],
            "staffId": nb["staffId"] or "default",
            "staffName": b.get("staff_name") or b.get("staffName", ""),
            "time": nb["time"] or "09:00",
            "endTime": nb["endTime"],
            "duration": svc_duration,
            "customerName": nb["customer"]["name"],
            "customerId": nb.get("customerId") or b.get("customerId", ""),
            "service": service_name,
            "status": nb["status"],
            "colour": STATUS_COLOURS.get(nb["status"], "#22C55E"),
            "isNewClient": b.get("is_new_client", False),
            "price": price,
            "notes": nb["notes"],
            "source": nb["source"],
        })

    bookings.sort(key=lambda x: x.get("time", ""))

    return {
        "date": date_param,
        "view": view,
        "openingHours": {"open": "09:00", "close": "20:00"},
        "staff": [{"id": _safe_str(st.get("id")), "name": st.get("name"), "avatar": st.get("avatar")} for st in staff_list],
        "bookings": bookings,
    }


@router.get("/business/{business_id}/restaurant")
async def get_calendar_restaurant(
    business_id: str,
    date_param: str = Query(..., alias="date"),
    view: str = Query("day"),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Calendar for restaurant businesses."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    bid_str = _safe_str(business.get("_id"))

    try:
        datetime.strptime(date_param, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date")

    bookings_raw = await _query_both_collections(
        db, business_id, bid_str, date_param,
        ["bookings"]
    )

    tables = business.get("tables", [])
    if not tables:
        try:
            tables_cursor = sdb.tables.find({
                "$or": [
                    {"business_id": business_id},
                    {"businessId": business_id},
                    {"business_id": bid_str},
                ]
            })
            tables = await tables_cursor.to_list(length=50)
        except Exception:
            tables = []

    # ── Smart Table Assignment Algorithm ──
    # Phase 1: Build time-occupation map for pre-assigned bookings
    # Phase 2: Assign unassigned bookings to best available table
    
    def _parse_time(t_str):
        """Convert 'HH:MM' to minutes since midnight."""
        try:
            parts = (t_str or "0:00").split(":")
            return int(parts[0]) * 60 + int(parts[1])
        except (ValueError, IndexError):
            return 0

    # First pass: collect all bookings with their data
    booking_list = []
    for b in bookings_raw:
        nb = normalize_booking(b)

        start_min = _parse_time(nb["time"] or "12:00")
        end_min = start_min + (nb["duration"] or 90)

        booking_list.append({
            "raw": b,
            "customer_name": nb["customer"]["name"],
            "table_id": nb["tableId"],
            "party": nb["partySize"],
            "time_str": nb["time"] or "12:00",
            "duration": nb["duration"] or 90,
            "start_min": start_min,
            "end_min": end_min,
        })

    # Build occupation map: table_id → list of (start_min, end_min)
    table_slots = {}
    for bl in booking_list:
        if bl["table_id"]:
            tid = bl["table_id"]
            table_slots.setdefault(tid, []).append((bl["start_min"], bl["end_min"]))

    def _table_available(tid, start, end):
        """Check if a table is free during the given time window."""
        for (s, e) in table_slots.get(tid, []):
            if start < e and end > s:  # overlap
                return False
        return True

    # Sort tables by capacity for efficient assignment
    tables_sorted = sorted(tables, key=lambda t: t.get("capacity", 4))
    table_id_map = {_safe_str(t.get("_id", t.get("id", ""))): t for t in tables}

    # Second pass: assign unassigned bookings (VIP first, then by party size desc)
    unassigned = [bl for bl in booking_list if not bl["table_id"]]
    unassigned.sort(key=lambda bl: (
        0 if bl["raw"].get("is_vip") or bl["raw"].get("isVip") else 1,
        -bl["party"],  # larger parties first
    ))

    for bl in unassigned:
        best_table = None
        for t in tables_sorted:
            tid = _safe_str(t.get("_id", t.get("id", "")))
            cap = t.get("capacity", 4)
            if cap >= bl["party"] and _table_available(tid, bl["start_min"], bl["end_min"]):
                best_table = tid
                break
        if best_table:
            bl["table_id"] = best_table
            table_slots.setdefault(best_table, []).append((bl["start_min"], bl["end_min"]))

    # Build final bookings list
    bookings = []
    for bl in booking_list:
        b = bl["raw"]
        bookings.append({
            "id": _safe_str(b.get("_id")),
            "time": bl["time_str"],
            "endTime": normalize_booking(b)["endTime"] or _mins_to_time(bl["start_min"] + bl["duration"]),
            "partySize": bl["party"],
            "customerName": bl["customer_name"],
            "tableId": bl["table_id"],
            "tableName": normalize_booking(b)["tableName"] or table_id_map.get(bl["table_id"], {}).get("name", ""),
            "status": normalize_booking(b)["status"],
            "occasion": normalize_booking(b)["occasion"],
            "isVip": normalize_booking(b)["isVip"],
            "notes": normalize_booking(b)["notes"],
            "duration": bl["duration"],
            "allergens": b.get("allergens", []),
            "deposit": b.get("deposit", {}),
            "source": b.get("source", b.get("channel", "online")),
            "seatingPreference": b.get("seatingPreference"),
        })

    bookings.sort(key=lambda x: x.get("time", ""))

    lunch_count = sum(1 for b in bookings if "11:00" <= (b.get("time") or "") < "15:00")
    dinner_count = sum(1 for b in bookings if (b.get("time") or "") >= "17:00")

    return {
        "date": date_param,
        "servicePeriods": [
            {"name": "Lunch", "start": "12:00", "end": "14:30"},
            {"name": "Dinner", "start": "18:00", "end": "22:00"},
        ],
        "bookings": bookings,
        "tables": [{"id": _safe_str(t.get("_id", t.get("id", ""))), "name": t.get("name", ""), "capacity": t.get("capacity", 4), "zone": t.get("zone", "")} for t in tables],
        "covers": {
            "lunch": lunch_count,
            "dinner": dinner_count,
            "total": len(bookings),
            "capacity": sum(t.get("capacity", 4) for t in tables) if tables else 86,
        },
    }


# debug-bookings endpoint REMOVED — security audit VULN-010


# ═══════════════════════════════════════════════════════════════
# STAFF ADD BOOKING — from calendar modal
# ═══════════════════════════════════════════════════════════════

from fastapi import Body

def _mins_to_end(start_time: str, duration: int) -> str:
    """Calculate end time from start time + duration in minutes."""
    h, m = map(int, start_time.split(":"))
    total = h * 60 + m + duration
    return f"{(total // 60) % 24:02d}:{total % 60:02d}"


@router.post("/business/{business_id}/booking")
async def staff_create_booking(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Staff creates a booking from the calendar. Minimal required fields."""
    db = get_database()
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        try:
            business = await db.businesses.find_one({"_id": ObjectId(business_id)})
        except Exception:
            pass
    if not business:
        raise HTTPException(404, "Business not found")

    biz_id = str(business["_id"])

    # Required fields
    customer_name = (payload.get("customerName") or "").strip()
    customer_phone = (payload.get("customerPhone") or "").strip()
    customer_email = (payload.get("customerEmail") or "").strip()
    booking_date = payload.get("date")
    booking_time = payload.get("time")
    staff_id = payload.get("staffId")
    service = payload.get("service")  # {id, name, duration, price}
    notes = (payload.get("notes") or "").strip()

    if not customer_name or not booking_date or not booking_time:
        raise HTTPException(400, "Customer name, date, and time are required")

    duration = 60
    service_doc = None
    if service:
        duration = service.get("duration", 60)
        service_doc = {
            "id": service.get("id"),
            "name": service.get("name", "Treatment"),
            "duration": duration,
            "price": service.get("price", 0),
        }

    end_time = _mins_to_end(booking_time, duration)

    # Generate reference
    import random, string
    ref = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

    doc = {
        "_id": f"bkg_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{biz_id[:8]}",
        "reference": ref,
        "businessId": biz_id,
        "type": "services",
        "status": "confirmed",
        "service": service_doc,
        "staffId": staff_id,
        "date": booking_date,
        "time": booking_time,
        "duration": duration,
        "endTime": end_time,
        "customer": {
            "name": customer_name,
            "phone": customer_phone,
            "email": customer_email,
        },
        "notes": notes[:500] if notes else "",
        "source": "staff",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }

    await db.bookings.insert_one(doc)

    return {
        "id": doc["_id"],
        "reference": ref,
        "status": "confirmed",
        "message": "Booking created",
    }
