"""
ReeveOS Data Normalisation Layer
═══════════════════════════════════════════════════════════

THE source of truth for field names across the entire platform.

CANONICAL FIELD NAMES (camelCase — matches frontend):
  Bookings:  businessId, customer.name, customer.phone, customer.email,
             partySize, tableId, tableName, staffId, status, date, time,
             endTime, duration, notes, occasion, source, reference,
             createdAt, updatedAt

  Businesses: type (not category), businessId

  Users: role (business_owner, platform_admin, super_admin, staff, diner)

LEGACY ALIASES (never write these — only read them for backwards compat):
  business_id → businessId
  customerName/client_name/guest_name → customer.name
  party_size/guests/covers → partySize
  table_id/table → tableId
  table_name → tableName
  staff_id/server_id → staffId
  start_time → time
  end_time → endTime
  duration_minutes/turn_time → duration
  created_at → createdAt
  updated_at → updatedAt
  channel → source
  client_phone → customer.phone
  client_email → customer.email
  service_period → service.name

Every route MUST use normalize_booking() when reading from DB.
Every route MUST use canonical field names when writing to DB.
"""
from datetime import datetime
from typing import Optional


def normalize_booking(doc: dict) -> dict:
    """
    Normalize a raw MongoDB booking document into canonical shape.
    Handles ALL legacy field name variants. Safe to call multiple times.
    Returns a new dict — does not mutate the original.
    """
    if not doc:
        return doc

    d = dict(doc)  # shallow copy

    # ── _id → string ──
    _id = d.get("_id", "")
    if hasattr(_id, "__str__") and not isinstance(_id, str):
        _id = str(_id)

    # ── businessId ──
    biz_id = d.get("businessId") or d.get("business_id") or ""

    # ── Customer (3 possible shapes) ──
    if d.get("customer") and isinstance(d["customer"], dict):
        cust = d["customer"]
        cust_name = cust.get("name", "")
        cust_phone = cust.get("phone", "")
        cust_email = cust.get("email", "")
    else:
        cust_name = (
            d.get("customerName")
            or d.get("client_name")
            or d.get("guest_name")
            or ""
        )
        cust_phone = (
            d.get("customerPhone")
            or d.get("client_phone")
            or d.get("phone")
            or ""
        )
        cust_email = (
            d.get("customerEmail")
            or d.get("client_email")
            or d.get("email")
            or ""
        )

    # ── Party size ──
    party_size = d.get("partySize") or d.get("party_size") or d.get("guests") or d.get("covers") or 2
    if isinstance(party_size, str):
        try:
            party_size = int(party_size)
        except ValueError:
            party_size = 2

    # ── Table ──
    table_id = d.get("tableId") or d.get("table_id") or d.get("table") or ""
    table_name = d.get("tableName") or d.get("table_name") or ""

    # ── Staff ──
    staff_id = d.get("staffId") or d.get("staff_id") or d.get("server_id") or ""

    # ── Time ──
    time_val = d.get("time") or d.get("start_time") or ""
    end_time = d.get("endTime") or d.get("end_time") or ""
    duration = d.get("duration") or d.get("duration_minutes") or d.get("turn_time") or 60

    # ── Source ──
    source = d.get("source") or d.get("channel") or "online"

    # ── Timestamps ──
    created = d.get("createdAt") or d.get("created_at")
    updated = d.get("updatedAt") or d.get("updated_at")

    # ── Service ──
    svc = d.get("service")
    if svc and isinstance(svc, dict):
        service = svc
    elif svc and isinstance(svc, str):
        service = {"name": svc}
    else:
        service_name = d.get("service_period") or "Booking"
        service = {"name": service_name}

    return {
        "id": str(_id),
        "_id": _id,
        "businessId": str(biz_id) if biz_id else "",
        "reference": d.get("reference", ""),
        "status": d.get("status", "confirmed"),
        "type": d.get("type", "restaurant"),
        "customer": {
            "name": cust_name,
            "phone": cust_phone,
            "email": cust_email,
        },
        "customerId": d.get("customerId") or d.get("user_id") or "",
        "partySize": party_size,
        "tableId": table_id,
        "tableName": table_name,
        "staffId": staff_id,
        "service": service,
        "date": d.get("date", ""),
        "time": time_val,
        "endTime": end_time,
        "duration": duration,
        "notes": d.get("notes") or "",
        "occasion": d.get("occasion") or "",
        "source": source,
        "isVip": d.get("is_vip") or d.get("isVip") or False,
        "deposit": d.get("deposit") or {},
        "allergens": d.get("allergens") or [],
        "seatingPreference": d.get("seatingPreference") or "",
        "tags": d.get("tags") or [],
        "createdAt": created,
        "updatedAt": updated,
    }


def booking_to_list_item(doc: dict, staff_map: dict = None) -> dict:
    """
    Convert a raw MongoDB booking into the shape the frontend list expects.
    Replaces the ad-hoc mapping in bookings.py routes.
    """
    b = normalize_booking(doc)
    staff_map = staff_map or {}
    staff = staff_map.get(b["staffId"], {})

    return {
        "id": b["id"],
        "reference": b["reference"],
        "customerName": b["customer"]["name"],
        "customerPhone": b["customer"]["phone"],
        "customerEmail": b["customer"]["email"],
        "service": b["service"].get("name") or "Booking",
        "staff": staff.get("name", ""),
        "date": b["date"],
        "time": b["time"],
        "partySize": b["partySize"],
        "duration": b["duration"],
        "status": b["status"],
        "source": b["source"],
        "occasion": b["occasion"],
        "tableName": b["tableName"],
        "isVip": b["isVip"],
        "depositPaid": (b["deposit"] or {}).get("status") == "paid",
        "createdAt": b["createdAt"],
    }


def booking_to_detail(doc: dict, staff_map: dict = None) -> dict:
    """
    Convert a raw MongoDB booking into the shape the frontend detail panel expects.
    Replaces the ad-hoc mapping in bookings.py detail route.
    """
    b = normalize_booking(doc)
    staff_map = staff_map or {}
    staff = staff_map.get(b["staffId"], {})

    return {
        "id": b["id"],
        "reference": b["reference"],
        "status": b["status"],
        "type": b["type"],
        "customer": {
            "name": b["customer"]["name"],
            "phone": b["customer"]["phone"],
            "email": b["customer"]["email"],
            "isNew": doc.get("is_new_client", True),
            "totalBookings": 1,
        },
        "service": {
            "name": b["service"].get("name"),
            "duration": b["service"].get("duration") or b["duration"],
            "price": b["service"].get("price"),
        },
        "staff": {"id": b["staffId"], "name": staff.get("name", "")},
        "date": b["date"],
        "time": b["time"],
        "endTime": b["endTime"],
        "partySize": b["partySize"],
        "tableName": b["tableName"],
        "occasion": b["occasion"],
        "isVip": b["isVip"],
        "notes": b["notes"],
        "source": b["source"],
        "deposit": b["deposit"],
        "allergens": b["allergens"],
        "seatingPreference": b["seatingPreference"],
        "history": [{"action": "created", "timestamp": b["createdAt"], "by": "customer"}],
    }


def normalize_business(doc: dict) -> dict:
    """Normalize a business document. Ensures 'type' is always set."""
    if not doc:
        return doc
    d = dict(doc)
    # Ensure type is set (copy from category if missing)
    if not d.get("type") and d.get("category"):
        d["type"] = d["category"]
    return d


def normalize_user(doc: dict) -> dict:
    """Normalize a user document. Fixes legacy roles."""
    if not doc:
        return doc
    d = dict(doc)
    role = d.get("role", "diner")
    ROLE_FIXES = {"owner": "business_owner", "admin": "platform_admin"}
    if role in ROLE_FIXES:
        d["role"] = ROLE_FIXES[role]
    return d
