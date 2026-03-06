"""
Run 5: Staff Management API — working hours, time off, permissions, invites
Staff stored in business.staff (extended schema)
"""

from fastapi import APIRouter, HTTPException, Depends, Body, Query, UploadFile, File
from database import get_database
from middleware.tenant_db import get_scoped_db
from middleware.auth import get_current_owner
from middleware.tenant import verify_business_access, TenantContext
from datetime import datetime, date
from bson import ObjectId
from pathlib import Path
import uuid

router = APIRouter(prefix="/staff-v2", tags=["staff-v2"])

TIER_LIMITS = {"free": 1, "starter": 3, "growth": 5, "scale": 999}
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
WEEKDAY_MAP = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


async def _get_business(db, business_id: str, user: dict):
    try:
        b = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        b = await db.businesses.find_one({"_id": business_id})
    if not b:
        raise HTTPException(404, "Business not found")
    owner_id = str(b.get("owner_id", ""))
    uid = str(user.get("_id", ""))
    role = str(user.get("role", "")).lower()
    # Admin roles always pass
    if role in ("platform_admin", "super_admin", "business_owner"):
        return b
    # Owner match
    if owner_id and owner_id == uid:
        return b
    # If user has business_id/business_ids fields, check those
    user_biz = str(user.get("business_id", ""))
    user_biz_list = [str(x) for x in user.get("business_ids", [])]
    if user_biz == business_id or business_id in user_biz_list:
        return b
    # If called from tenant context (only _id and role), look up user's business_id
    if uid:
        real_user = await db.users.find_one({"_id": ObjectId(uid)}) if len(uid) == 24 else None
        if real_user:
            ru_biz = str(real_user.get("business_id", ""))
            ru_biz_list = [str(x) for x in real_user.get("business_ids", [])]
            if ru_biz == business_id or business_id in ru_biz_list:
                return b
    raise HTTPException(403, "Not authorized")


def _staff_limit(tier):
    t = (tier or "free").lower()
    return TIER_LIMITS.get(t, TIER_LIMITS["free"])


def _is_working_today(staff):
    wh = staff.get("workingHours") or {}
    today = datetime.utcnow().strftime("%a").lower()[:3]
    day_key = {"mon": "mon", "tue": "tue", "wed": "wed", "thu": "thu", "fri": "fri", "sat": "sat", "sun": "sun"}.get(today, "mon")
    d = wh.get(day_key, {})
    if not d.get("active", True):
        return False, None
    return True, {"start": d.get("start", "09:00"), "end": d.get("end", "17:00")}


def _is_on_holiday(staff):
    today = date.today().isoformat()
    for to in staff.get("timeOff") or []:
        if to.get("approved", True) and to.get("startDate", "") <= today <= to.get("endDate", "9999"):
            return True
    return False


@router.get("/business/{business_id}")
async def list_staff(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    staff_list = business.get("staff", [])
    today_str = date.today().isoformat()

    result = []
    for s in staff_list:
        if not s.get("active", True):
            continue
        working, hours = _is_working_today(s)
        on_holiday = _is_on_holiday(s)
        if on_holiday:
            status = "holiday"
        elif working:
            status = "active"
        else:
            status = "off"

        bookings_today = 0
        try:
            bookings_today = await sdb.bookings.count_documents({
                "businessId": str(business["_id"]),
                "date": today_str,
                "staffId": s.get("id"),
                "status": {"$nin": ["cancelled"]},
            })
        except Exception:
            pass

        result.append({
            "id": s.get("id"),
            "status": status,
            "name": s.get("name"),
            "email": s.get("email"),
            "phone": s.get("phone"),
            "role": s.get("role", "Staff"),
            "avatar": s.get("avatar"),
            "permissions": s.get("permissions", "staff"),
            "active": s.get("active", True),
            "inviteStatus": s.get("inviteStatus", "accepted"),
            "isWorkingToday": working and not on_holiday,
            "todayHours": hours,
            "bookingsToday": bookings_today,
            "serviceCount": len(s.get("serviceIds") or []),
            "rating": s.get("rating"),
            "workingHours": s.get("workingHours", {}),
            "timeOff": s.get("timeOff", []),
            "serviceIds": s.get("serviceIds", []),
        })

    return {"staff": result}


@router.post("/business/{business_id}")
async def create_staff(business_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    staff_list = [s for s in business.get("staff", []) if s.get("active", True)]
    limit = _staff_limit(business.get("tier") or business.get("rezvo_tier"))
    if len(staff_list) >= limit:
        raise HTTPException(400, f"Your plan allows {limit} staff members. Upgrade to add more.")

    name = (payload.get("name") or "").strip()
    if len(name) < 2 or len(name) > 100:
        raise HTTPException(400, "Name must be 2-100 chars")
    email = (payload.get("email") or "").strip()
    if not email or "@" not in email:
        raise HTTPException(400, "Valid email required")
    for s in staff_list:
        if (s.get("email") or "").lower() == email.lower():
            raise HTTPException(400, "Email already in use")

    wh = payload.get("workingHours") or {}
    if not any((wh.get(d) or {}).get("active", False) for d in DAYS):
        wh = {d: {"active": True, "start": "09:00", "end": "17:00"} for d in DAYS[:5]}
        wh["sat"] = wh["sun"] = {"active": False}

    staff_id = f"staff_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    new_staff = {
        "id": staff_id,
        "name": name,
        "email": email,
        "phone": payload.get("phone", ""),
        "role": payload.get("role", "Staff"),
        "avatar": payload.get("avatar"),
        "permissions": payload.get("permissions", "staff"),
        "serviceIds": payload.get("serviceIds", []),
        "workingHours": wh,
        "timeOff": [],
        "active": True,
        "inviteStatus": "pending" if payload.get("sendInvite", True) else "accepted",
        "invitedAt": datetime.utcnow() if payload.get("sendInvite", True) else None,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }

    staff_list = business.get("staff", [])
    staff_list.append(new_staff)
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"staff": staff_list, "updated_at": datetime.utcnow()}},
    )
    return new_staff


@router.put("/business/{business_id}/{staff_id}")
async def update_staff(business_id: str, staff_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    staff_list = business.get("staff", [])
    idx = next((i for i, s in enumerate(staff_list) if s.get("id") == staff_id), None)
    if idx is None:
        raise HTTPException(404, "Staff not found")

    s = staff_list[idx]
    for key in ["name", "phone", "role", "permissions", "serviceIds", "workingHours", "avatar"]:
        if key in payload:
            s[key] = payload[key]
    s["updatedAt"] = datetime.utcnow()
    if "email" in payload and s.get("inviteStatus") != "accepted":
        s["email"] = payload["email"]
    staff_list[idx] = s
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"staff": staff_list, "updated_at": datetime.utcnow()}},
    )
    return s


@router.delete("/business/{business_id}/{staff_id}")
async def delete_staff(business_id: str, staff_id: str, confirm: bool = Query(False), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    if staff_list[idx].get("permissions") == "owner":
        raise HTTPException(400, "Cannot delete the owner")

    staff_list = business.get("staff", [])
    idx = next((i for i, s in enumerate(staff_list) if s.get("id") == staff_id), None)
    if idx is None:
        raise HTTPException(404, "Staff not found")

    today = date.today().isoformat()
    future = 0
    try:
        future = await sdb.bookings.count_documents({
            "businessId": str(business["_id"]),
            "staffId": staff_id,
            "date": {"$gte": today},
            "status": {"$nin": ["cancelled"]},
        })
    except Exception:
        pass

    if not confirm and future > 0:
        return {"warning": f"This staff member has {future} upcoming bookings.", "futureBookings": future}

    staff_list[idx]["active"] = False
    staff_list[idx]["updatedAt"] = datetime.utcnow()
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"staff": staff_list, "updated_at": datetime.utcnow()}},
    )
    return {"detail": "Staff removed"}


@router.patch("/business/{business_id}/{staff_id}/hours")
async def update_hours(business_id: str, staff_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    staff_list = business.get("staff", [])
    idx = next((i for i, s in enumerate(staff_list) if s.get("id") == staff_id), None)
    if idx is None:
        raise HTTPException(404, "Staff not found")

    wh = staff_list[idx].get("workingHours") or {}
    wh.update(payload.get("workingHours", {}))
    staff_list[idx]["workingHours"] = wh
    staff_list[idx]["updatedAt"] = datetime.utcnow()
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"staff": staff_list, "updated_at": datetime.utcnow()}},
    )
    return staff_list[idx]


@router.post("/business/{business_id}/{staff_id}/time-off")
async def add_time_off(business_id: str, staff_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    staff_list = business.get("staff", [])
    idx = next((i for i, s in enumerate(staff_list) if s.get("id") == staff_id), None)
    if idx is None:
        raise HTTPException(404, "Staff not found")

    start_date = payload.get("startDate")
    end_date = payload.get("endDate")
    if not start_date or not end_date:
        raise HTTPException(400, "startDate and endDate required")
    if end_date < start_date:
        raise HTTPException(400, "endDate must be >= startDate")
    if start_date < date.today().isoformat():
        raise HTTPException(400, "startDate must be today or future")

    to_id = f"to_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    entry = {
        "id": to_id,
        "startDate": start_date,
        "endDate": end_date,
        "reason": payload.get("reason", ""),
        "approved": True,
    }

    conflict_count = 0
    try:
        conflict_count = await sdb.bookings.count_documents({
            "businessId": str(business["_id"]),
            "staffId": staff_id,
            "date": {"$gte": start_date, "$lte": end_date},
            "status": {"$nin": ["cancelled"]},
        })
    except Exception:
        pass

    time_off = staff_list[idx].get("timeOff") or []
    time_off.append(entry)
    staff_list[idx]["timeOff"] = time_off
    staff_list[idx]["updatedAt"] = datetime.utcnow()
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"staff": staff_list, "updated_at": datetime.utcnow()}},
    )

    result = staff_list[idx].copy()
    if conflict_count > 0:
        result["warning"] = f"This staff member has {conflict_count} bookings during this period."
        result["conflictCount"] = conflict_count
    return result


@router.delete("/business/{business_id}/{staff_id}/time-off/{time_off_id}")
async def remove_time_off(business_id: str, staff_id: str, time_off_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    staff_list = business.get("staff", [])
    idx = next((i for i, s in enumerate(staff_list) if s.get("id") == staff_id), None)
    if idx is None:
        raise HTTPException(404, "Staff not found")

    time_off = [t for t in (staff_list[idx].get("timeOff") or []) if t.get("id") != time_off_id]
    staff_list[idx]["timeOff"] = time_off
    staff_list[idx]["updatedAt"] = datetime.utcnow()
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"staff": staff_list, "updated_at": datetime.utcnow()}},
    )
    return staff_list[idx]


@router.post("/business/{business_id}/{staff_id}/reinvite")
async def reinvite_staff(business_id: str, staff_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Resend invite email to pending staff member."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    staff_list = business.get("staff", [])
    idx = next((i for i, s in enumerate(staff_list) if s.get("id") == staff_id), None)
    if idx is None:
        raise HTTPException(404, "Staff not found")
    if staff_list[idx].get("inviteStatus") != "pending":
        raise HTTPException(400, "Only pending invites can be resent")
    staff_list[idx]["invitedAt"] = datetime.utcnow()
    staff_list[idx]["updatedAt"] = datetime.utcnow()
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"staff": staff_list, "updated_at": datetime.utcnow()}},
    )
    return {"detail": "Invite resent", "staff": staff_list[idx]}


UPLOADS_DIR = Path("/opt/rezvo-app/uploads/staff")
try:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    pass


@router.post("/business/{business_id}/{staff_id}/avatar")
async def upload_staff_avatar(
    business_id: str,
    staff_id: str,
    file: UploadFile = File(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Upload staff avatar photo."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})

    # Validate file — check MIME type AND magic bytes
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(400, f"File type {file.content_type} not allowed")

    data = await file.read()
    if len(data) > 3 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 3MB)")

    # Validate actual file content (magic bytes) — don't trust content_type alone
    magic_sigs = {
        b'\xff\xd8\xff': 'jpg',
        b'\x89PNG': 'png',
        b'RIFF': 'webp',
        b'GIF8': 'gif',
    }
    detected_ext = None
    for sig, ext in magic_sigs.items():
        if data[:len(sig)] == sig:
            detected_ext = ext
            break
    if not detected_ext:
        raise HTTPException(400, "File content does not match a valid image format")

    # Save file with validated extension
    ext = detected_ext
    name = f"{uuid.uuid4().hex[:12]}.{ext}"
    path = UPLOADS_DIR / name
    path.write_bytes(data)

    url = f"/api/static/staff/{name}"

    # Update staff avatar in business doc
    staff_list = business.get("staff", [])
    idx = next((i for i, s in enumerate(staff_list) if s.get("id") == staff_id), None)
    if idx is None:
        raise HTTPException(404, "Staff not found")

    staff_list[idx]["avatar"] = url
    staff_list[idx]["updatedAt"] = datetime.utcnow()
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"staff": staff_list, "updated_at": datetime.utcnow()}},
    )

    return {"url": url, "staff": staff_list[idx]}
