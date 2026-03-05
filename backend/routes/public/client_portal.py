"""
Consumer Portal — auth + profile for end customers.
Separate collection (consumer_accounts) from business users.

Routes:
  POST /client/auth/signup     — create consumer account + link to business
  POST /client/auth/login      — consumer login → JWT
  GET  /client/auth/me         — consumer profile + linked businesses
  PUT  /client/auth/me         — update name/phone/avatar
  GET  /client/{slug}/info     — public business info for portal branding
  GET  /client/{slug}/my-data  — consumer's forms, bookings, packages at this business
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Body
from database import get_database
from bson import ObjectId
import bcrypt
import re
import jwt
import os

router = APIRouter(prefix="/client", tags=["Consumer Portal"])

JWT_SECRET = os.environ.get("JWT_SECRET_KEY", os.environ.get("jwt_secret_key", "fallback-secret"))
JWT_ALGORITHM = "HS256"


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), h.encode("utf-8"))
    except Exception:
        return False


def _create_token(user_id: str, role: str = "diner") -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=30),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


async def get_current_consumer(authorization: str = None):
    """Extract consumer from JWT. Used as dependency."""
    from fastapi import Header
    # This gets overridden below with proper header extraction
    pass


from fastapi import Header


async def _get_consumer(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    token = authorization.split(" ", 1)[1]
    payload = _decode_token(token)
    db = get_database()
    user = await db.consumer_accounts.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(401, "Account not found")
    return user


# ═══════════════════════════════════════════════════════════════
# PUBLIC — business info for portal branding
# ═══════════════════════════════════════════════════════════════

@router.get("/{slug}/info")
async def get_business_info(slug: str):
    """Public — business branding for consumer portal screens."""
    db = get_database()
    biz = await db.businesses.find_one({"slug": slug})
    if not biz:
        raise HTTPException(404, "Business not found")

    branding = biz.get("portal_branding", {})

    return {
        "business_id": str(biz["_id"]),
        "name": biz.get("name", ""),
        "slug": slug,
        "type": biz.get("type", ""),
        "category": biz.get("category", ""),
        "address": biz.get("address", ""),
        "logo_url": branding.get("logo_url") or biz.get("logo_url", ""),
        "banner_url": branding.get("banner_url") or biz.get("banner_url", ""),
        "accent_color": branding.get("accent_color", "#C9A84C"),
        "bg_color": branding.get("bg_color", "#111111"),
        "subtitle": branding.get("subtitle", ""),
    }


# ═══════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════

@router.post("/auth/signup")
async def consumer_signup(data: dict = Body(...)):
    """Create consumer account, link to business, return JWT."""
    db = get_database()

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    password = data.get("password", "")
    business_id = data.get("business_id", "")

    if not name or not email or not password:
        raise HTTPException(400, "Name, email, and password are required")
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if not business_id:
        raise HTTPException(400, "business_id is required")

    # Verify business
    try:
        biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        raise HTTPException(404, "Business not found")

    # Check existing
    existing = await db.consumer_accounts.find_one({"email": email})
    if existing:
        raise HTTPException(409, "Account already exists. Please log in.")

    now = datetime.utcnow()
    account = {
        "name": name,
        "email": email,
        "phone": phone,
        "password_hash": _hash(password),
        "role": "diner",
        "business_ids": [business_id],
        "avatar_url": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.consumer_accounts.insert_one(account)
    user_id = str(result.inserted_id)

    # Also create/link a client record for this business
    client = await db.clients.find_one({"email": email, "business_id": business_id})
    if not client:
        await db.clients.insert_one({
            "name": name,
            "email": email,
            "phone": phone,
            "business_id": business_id,
            "consumer_account_id": user_id,
            "tags": ["new"],
            "consultation_status": None,
            "consultation_expires": None,
            "first_visit": None,
            "last_visit": None,
            "total_spend": 0,
            "visit_count": 0,
            "created_at": now,
            "updated_at": now,
        })
    else:
        # Link existing client record
        await db.clients.update_one(
            {"_id": client["_id"]},
            {"$set": {"consumer_account_id": user_id, "updated_at": now}},
        )

    token = _create_token(user_id)

    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": name,
            "email": email,
            "phone": phone,
            "business_ids": [business_id],
        },
    }


@router.post("/auth/login")
async def consumer_login(data: dict = Body(...)):
    """Consumer login — returns JWT."""
    db = get_database()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        raise HTTPException(400, "Email and password required")

    account = await db.consumer_accounts.find_one({"email": email})
    if not account or not _verify(password, account.get("password_hash", "")):
        raise HTTPException(401, "Invalid email or password")

    user_id = str(account["_id"])
    token = _create_token(user_id)

    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": account.get("name", ""),
            "email": email,
            "phone": account.get("phone", ""),
            "business_ids": [str(b) for b in account.get("business_ids", [])],
        },
    }


# ═══════════════════════════════════════════════════════════════
# PROFILE
# ═══════════════════════════════════════════════════════════════

@router.get("/auth/me")
async def get_profile(user=Depends(_get_consumer)):
    """Get consumer profile."""
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "phone": user.get("phone", ""),
        "avatar_url": user.get("avatar_url"),
        "business_ids": [str(b) for b in user.get("business_ids", [])],
        "created_at": user.get("created_at", ""),
    }


@router.put("/auth/me")
async def update_profile(data: dict = Body(...), user=Depends(_get_consumer)):
    """Update consumer name/phone."""
    db = get_database()
    updates = {"updated_at": datetime.utcnow()}
    if "name" in data:
        updates["name"] = data["name"].strip()
    if "phone" in data:
        updates["phone"] = data["phone"].strip()

    await db.consumer_accounts.update_one({"_id": user["_id"]}, {"$set": updates})
    return {"updated": True}


# ═══════════════════════════════════════════════════════════════
# MY DATA — consumer's data at a specific business
# ═══════════════════════════════════════════════════════════════

@router.get("/{slug}/my-data")
async def get_my_data(slug: str, user=Depends(_get_consumer)):
    """Get consumer's consultation forms, bookings, packages at this business."""
    db = get_database()
    biz = await db.businesses.find_one({"slug": slug})
    if not biz:
        raise HTTPException(404, "Business not found")

    biz_id = str(biz["_id"])
    email = user.get("email", "")
    now = datetime.utcnow()

    # Consultation form status
    latest_form = await db.consultation_submissions.find_one(
        {"business_id": biz_id, "client_email": email},
        sort=[("submitted_at", -1)],
    )

    form_status = None
    if latest_form:
        is_expired = latest_form.get("expires_at", now) < now
        form_status = {
            "submission_id": str(latest_form["_id"]),
            "status": "expired" if is_expired else latest_form.get("status", "clear"),
            "submitted_at": latest_form["submitted_at"].isoformat(),
            "expires_at": latest_form.get("expires_at", "").isoformat() if latest_form.get("expires_at") else None,
            "alerts": latest_form.get("alerts", {"blocks": [], "flags": []}),
        }

    # Upcoming bookings
    bookings = []
    cursor = db.bookings.find({
        "businessId": biz_id,
        "customer.email": email,
        "status": {"$nin": ["cancelled"]},
        "date": {"$gte": now.strftime("%Y-%m-%d")},
    }).sort("date", 1).limit(5)
    async for bkg in cursor:
        bkg["_id"] = str(bkg["_id"])
        # Parse month/day from date
        month, day = "", ""
        try:
            d = datetime.strptime(bkg.get("date", ""), "%Y-%m-%d")
            month = d.strftime("%b").upper()
            day = d.strftime("%-d")
        except Exception:
            pass
        bookings.append({
            "id": bkg["_id"],
            "service": bkg.get("service", ""),
            "date": bkg.get("date", ""),
            "time": bkg.get("time", ""),
            "status": bkg.get("status", ""),
            "staff": bkg.get("staff_name", ""),
            "month": month,
            "day": day,
            "price": bkg.get("price"),
        })

    # Past bookings (last 20)
    past_bookings = []
    cursor = db.bookings.find({
        "businessId": biz_id,
        "customer.email": email,
        "status": {"$nin": ["cancelled"]},
        "date": {"$lt": now.strftime("%Y-%m-%d")},
    }).sort("date", -1).limit(20)
    async for bkg in cursor:
        bkg["_id"] = str(bkg["_id"])
        past_bookings.append({
            "id": bkg["_id"],
            "service": bkg.get("service", ""),
            "date": bkg.get("date", ""),
            "time": bkg.get("time", ""),
            "staff": bkg.get("staff_name", ""),
            "price": bkg.get("price"),
        })

    return {
        "business": {
            "name": biz.get("name", ""),
            "slug": slug,
        },
        "consultation": form_status,
        "upcoming_bookings": bookings,
        "past_bookings": past_bookings,
    }


# ═══════════════════════════════════════════════════════════════
# MESSAGES — consumer ↔ business ticketing
# ═══════════════════════════════════════════════════════════════

@router.get("/{slug}/messages")
async def get_messages(slug: str, user=Depends(_get_consumer)):
    """Get messages between consumer and business."""
    db = get_database()
    biz = await db.businesses.find_one({"slug": slug})
    if not biz:
        raise HTTPException(404, "Business not found")

    biz_id = str(biz["_id"])
    consumer_id = str(user["_id"])

    messages = []
    cursor = db.client_messages.find({
        "business_id": biz_id,
        "consumer_id": consumer_id,
    }).sort("created_at", 1).limit(100)
    async for msg in cursor:
        messages.append({
            "id": str(msg["_id"]),
            "from": msg.get("from", "client"),  # "client" or "business"
            "text": msg.get("text", ""),
            "staff_name": msg.get("staff_name"),
            "read": msg.get("read", False),
            "created_at": msg.get("created_at", "").isoformat() if msg.get("created_at") else "",
        })

    # Mark unread business messages as read
    await db.client_messages.update_many(
        {"business_id": biz_id, "consumer_id": consumer_id, "from": "business", "read": False},
        {"$set": {"read": True, "read_at": datetime.utcnow()}},
    )

    return {"messages": messages}


@router.post("/{slug}/messages")
async def send_message(slug: str, data: dict = Body(...), user=Depends(_get_consumer)):
    """Consumer sends a message to business."""
    db = get_database()
    biz = await db.businesses.find_one({"slug": slug})
    if not biz:
        raise HTTPException(404, "Business not found")

    text = (data.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "Message text required")

    biz_id = str(biz["_id"])
    consumer_id = str(user["_id"])
    now = datetime.utcnow()

    msg = {
        "business_id": biz_id,
        "consumer_id": consumer_id,
        "consumer_name": user.get("name", ""),
        "consumer_email": user.get("email", ""),
        "from": "client",
        "text": text,
        "read": False,
        "created_at": now,
    }
    result = await db.client_messages.insert_one(msg)

    return {
        "id": str(result.inserted_id),
        "from": "client",
        "text": text,
        "created_at": now.isoformat(),
    }


# ═══════════════════════════════════════════════════════════════
# SERVICES — list business services for booking
# ═══════════════════════════════════════════════════════════════

@router.get("/{slug}/services")
async def get_services(slug: str):
    """Public — list business services for consumer booking."""
    db = get_database()
    biz = await db.businesses.find_one({"slug": slug})
    if not biz:
        raise HTTPException(404, "Business not found")

    biz_id = str(biz["_id"])
    services = []
    # Try both field naming conventions (businessId vs business_id)
    cursor = db.services.find({"$or": [{"business_id": biz_id}, {"businessId": biz_id}], "active": {"$ne": False}}).sort("name", 1)
    async for svc in cursor:
        services.append({
            "id": str(svc["_id"]),
            "name": svc.get("name", ""),
            "category": svc.get("category", ""),
            "duration": svc.get("duration", 60),
            "price": svc.get("price", 0),
            "description": svc.get("description", ""),
        })

    return {"services": services}


# ═══════════════════════════════════════════════════════════════
# AVAILABLE SLOTS — for a given service + date
# ═══════════════════════════════════════════════════════════════

@router.get("/{slug}/slots")
async def get_available_slots(slug: str, service_id: str = "", date: str = ""):
    """Get available time slots for a service on a specific date."""
    db = get_database()
    biz = await db.businesses.find_one({"slug": slug})
    if not biz:
        raise HTTPException(404, "Business not found")

    if not date:
        raise HTTPException(400, "date parameter required (YYYY-MM-DD)")

    biz_id = str(biz["_id"])

    # Get service duration
    duration = 60
    if service_id:
        try:
            svc = await db.services.find_one({"_id": ObjectId(service_id), "$or": [{"business_id": biz_id}, {"businessId": biz_id}]})
            if svc:
                duration = svc.get("duration", 60)
        except Exception:
            pass

    # Get staff — check dedicated collection + embedded in business doc
    staff = []
    # Try staff collection
    cursor = db.staff.find({"$or": [{"business_id": biz_id}, {"businessId": biz_id}], "active": {"$ne": False}})
    async for s in cursor:
        staff.append({"id": str(s["_id"]), "name": s.get("name", "")})
    # Try staff_members collection
    if not staff:
        cursor = db.staff_members.find({"$or": [{"business_id": biz_id}, {"businessId": biz_id}], "status": "active"})
        async for s in cursor:
            staff.append({"id": str(s["_id"]), "name": s.get("name", "")})
    # Try embedded staff in business doc
    if not staff:
        embedded_staff = biz.get("staff", [])
        for s in embedded_staff:
            sid = s.get("id", s.get("_id", ""))
            staff.append({"id": str(sid), "name": s.get("name", "")})

    # Get existing bookings for that date
    existing = []
    cursor = db.bookings.find({
        "businessId": biz_id,
        "date": date,
        "status": {"$nin": ["cancelled"]},
    })
    async for bkg in cursor:
        existing.append(bkg.get("time", ""))

    # Get business hours (default 9-17)
    hours = biz.get("opening_hours", {})
    from datetime import datetime as dt
    try:
        day_name = dt.strptime(date, "%Y-%m-%d").strftime("%A").lower()
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")

    day_hours = hours.get(day_name, {"open": "09:00", "close": "17:00", "closed": False})
    if day_hours.get("closed"):
        return {"slots": [], "staff": staff}

    open_time = day_hours.get("open", "09:00")
    close_time = day_hours.get("close", "17:00")

    # Generate slots
    slots = []
    try:
        current = dt.strptime(open_time, "%H:%M")
        end = dt.strptime(close_time, "%H:%M")
        while current + timedelta(minutes=duration) <= end:
            time_str = current.strftime("%H:%M")
            if time_str not in existing:
                slots.append(time_str)
            current += timedelta(minutes=30)  # 30-min intervals
    except ValueError:
        pass

    return {"slots": slots, "staff": staff, "duration": duration}


# ═══════════════════════════════════════════════════════════════
# BOOK APPOINTMENT — consumer creates a booking
# ═══════════════════════════════════════════════════════════════

@router.post("/{slug}/book")
async def create_booking(slug: str, data: dict = Body(...), user=Depends(_get_consumer)):
    """Consumer creates a booking."""
    db = get_database()
    biz = await db.businesses.find_one({"slug": slug})
    if not biz:
        raise HTTPException(404, "Business not found")

    service_id = data.get("service_id", "")
    date = data.get("date", "")
    time = data.get("time", "")
    staff_id = data.get("staff_id")
    notes = data.get("notes", "")

    if not service_id or not date or not time:
        raise HTTPException(400, "service_id, date, and time are required")

    biz_id = str(biz["_id"])
    now = datetime.utcnow()

    # Get service
    try:
        svc = await db.services.find_one({"_id": ObjectId(service_id), "$or": [{"business_id": biz_id}, {"businessId": biz_id}]})
    except Exception:
        svc = None
    if not svc:
        raise HTTPException(404, "Service not found")

    # Get staff name
    staff_name = ""
    if staff_id:
        try:
            s = await db.staff.find_one({"_id": ObjectId(staff_id)})
            if s:
                staff_name = s.get("name", "")
        except Exception:
            pass

    # Check slot available
    clash = await db.bookings.find_one({
        "businessId": biz_id,
        "date": date,
        "time": time,
        "status": {"$nin": ["cancelled"]},
    })
    if clash:
        raise HTTPException(409, "This time slot is already booked")

    booking = {
        "businessId": biz_id,
        "service": svc.get("name", ""),
        "service_id": service_id,
        "date": date,
        "time": time,
        "duration": svc.get("duration", 60),
        "price": svc.get("price", 0),
        "status": "confirmed",
        "staff_id": staff_id or "",
        "staff_name": staff_name,
        "customer": {
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
        },
        "consumer_id": str(user["_id"]),
        "notes": notes,
        "source": "client_portal",
        "created_at": now,
        "updated_at": now,
    }
    result = await db.bookings.insert_one(booking)

    return {
        "booking_id": str(result.inserted_id),
        "service": svc.get("name", ""),
        "date": date,
        "time": time,
        "staff": staff_name,
        "status": "confirmed",
    }


# ═══════════════════════════════════════════════════════════════
# NOTIFICATION PREFERENCES
# ═══════════════════════════════════════════════════════════════

@router.get("/auth/notifications")
async def get_notification_prefs(user=Depends(_get_consumer)):
    """Get consumer notification preferences."""
    prefs = user.get("notification_prefs", {
        "appointment_reminders": True,
        "aftercare": True,
        "promotions": False,
        "booking_confirmations": True,
    })
    return {"prefs": prefs}


@router.put("/auth/notifications")
async def update_notification_prefs(data: dict = Body(...), user=Depends(_get_consumer)):
    """Update consumer notification preferences."""
    db = get_database()
    prefs = data.get("prefs", {})
    allowed = {"appointment_reminders", "aftercare", "promotions", "booking_confirmations"}
    clean = {k: bool(v) for k, v in prefs.items() if k in allowed}
    await db.consumer_accounts.update_one(
        {"_id": user["_id"]},
        {"$set": {"notification_prefs": clean, "updated_at": datetime.utcnow()}},
    )
    return {"updated": True, "prefs": clean}


# ═══════════════════════════════════════════════════════════════
# BUSINESS-SIDE: Messages management (for dashboard)
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/messages")
async def get_business_messages(business_id: str, authorization: str = Header(None)):
    """Business owner reads all client message threads."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    token = authorization.split(" ", 1)[1]
    payload = _decode_token(token)

    db = get_database()

    # Get unique consumer threads
    pipeline = [
        {"$match": {"business_id": business_id}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$consumer_id",
            "consumer_name": {"$first": "$consumer_name"},
            "consumer_email": {"$first": "$consumer_email"},
            "last_message": {"$first": "$text"},
            "last_from": {"$first": "$from"},
            "last_at": {"$first": "$created_at"},
            "unread": {"$sum": {"$cond": [{"$and": [{"$eq": ["$from", "client"]}, {"$eq": ["$read", False]}]}, 1, 0]}},
            "total": {"$sum": 1},
        }},
        {"$sort": {"last_at": -1}},
    ]
    threads = []
    async for t in db.client_messages.aggregate(pipeline):
        threads.append({
            "consumer_id": t["_id"],
            "consumer_name": t.get("consumer_name", ""),
            "consumer_email": t.get("consumer_email", ""),
            "last_message": t.get("last_message", ""),
            "last_from": t.get("last_from", ""),
            "last_at": t.get("last_at", "").isoformat() if t.get("last_at") else "",
            "unread": t.get("unread", 0),
            "total": t.get("total", 0),
        })

    return {"threads": threads}


@router.get("/business/{business_id}/messages/{consumer_id}")
async def get_thread_messages(business_id: str, consumer_id: str, authorization: str = Header(None)):
    """Business reads a specific message thread."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")

    db = get_database()
    messages = []
    cursor = db.client_messages.find({
        "business_id": business_id,
        "consumer_id": consumer_id,
    }).sort("created_at", 1).limit(100)
    async for msg in cursor:
        messages.append({
            "id": str(msg["_id"]),
            "from": msg.get("from", "client"),
            "text": msg.get("text", ""),
            "staff_name": msg.get("staff_name"),
            "created_at": msg.get("created_at", "").isoformat() if msg.get("created_at") else "",
        })

    # Mark client messages as read
    await db.client_messages.update_many(
        {"business_id": business_id, "consumer_id": consumer_id, "from": "client", "read": False},
        {"$set": {"read": True, "read_at": datetime.utcnow()}},
    )

    return {"messages": messages}


@router.post("/business/{business_id}/messages/{consumer_id}")
async def business_reply(business_id: str, consumer_id: str, data: dict = Body(...), authorization: str = Header(None)):
    """Business sends a reply to a client."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    token = authorization.split(" ", 1)[1]
    payload = _decode_token(token)

    db = get_database()
    text = (data.get("text") or "").strip()
    staff_name = data.get("staff_name", "")
    if not text:
        raise HTTPException(400, "Message text required")

    now = datetime.utcnow()
    msg = {
        "business_id": business_id,
        "consumer_id": consumer_id,
        "from": "business",
        "text": text,
        "staff_name": staff_name,
        "read": False,
        "created_at": now,
    }
    result = await db.client_messages.insert_one(msg)

    return {
        "id": str(result.inserted_id),
        "from": "business",
        "text": text,
        "staff_name": staff_name,
        "created_at": now.isoformat(),
    }


# ═══════════════════════════════════════════════════════════════
# BUSINESS-SIDE: Portal client list + detail
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/portal-clients")
async def list_portal_clients(business_id: str, authorization: str = Header(None)):
    """List all consumer accounts linked to this business."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Auth required")

    db = get_database()
    clients = []
    cursor = db.consumer_accounts.find({"business_ids": business_id}).sort("created_at", -1)
    async for c in cursor:
        # Get linked client record for stats
        cl = await db.clients.find_one({"email": c.get("email"), "business_id": business_id})
        clients.append({
            "id": str(c["_id"]),
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "phone": c.get("phone", ""),
            "created_at": c.get("created_at", "").isoformat() if c.get("created_at") else "",
            "consultation_status": cl.get("consultation_status") if cl else None,
            "visit_count": cl.get("visit_count", 0) if cl else 0,
            "total_spend": cl.get("total_spend", 0) if cl else 0,
        })
    return {"clients": clients}


@router.get("/business/{business_id}/portal-clients/{consumer_id}")
async def get_portal_client_detail(business_id: str, consumer_id: str, authorization: str = Header(None)):
    """Full client profile — bookings, forms, stats."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Auth required")

    db = get_database()
    consumer = await db.consumer_accounts.find_one({"_id": ObjectId(consumer_id)})
    if not consumer:
        raise HTTPException(404, "Client not found")

    email = consumer.get("email", "")
    now = datetime.utcnow()

    # Client record
    cl = await db.clients.find_one({"email": email, "business_id": business_id})

    # Bookings
    bookings = []
    cursor = db.bookings.find({
        "$or": [{"businessId": business_id}, {"business_id": business_id}],
        "customer.email": email,
    }).sort("date", -1).limit(20)
    async for b in cursor:
        bookings.append({
            "service": b.get("service", ""),
            "date": b.get("date", ""),
            "time": b.get("time", ""),
            "staff": b.get("staff_name", ""),
            "price": b.get("price"),
            "status": b.get("status", ""),
        })

    # Consultation
    form = await db.consultation_submissions.find_one(
        {"business_id": business_id, "client_email": email},
        sort=[("submitted_at", -1)],
    )
    consultation = None
    if form:
        consultation = {
            "status": form.get("status", "submitted"),
            "submitted_at": form.get("submitted_at", "").isoformat() if form.get("submitted_at") else "",
            "alerts": form.get("alerts", {"blocks": [], "flags": []}),
        }

    return {
        "name": consumer.get("name", ""),
        "email": email,
        "phone": consumer.get("phone", ""),
        "created_at": consumer.get("created_at", "").isoformat() if consumer.get("created_at") else "",
        "visit_count": cl.get("visit_count", 0) if cl else len(bookings),
        "total_spend": cl.get("total_spend", 0) if cl else sum(float(b.get("price", 0) or 0) for b in bookings),
        "consultation_status": cl.get("consultation_status") if cl else (consultation["status"] if consultation else None),
        "consultation": consultation,
        "bookings": bookings,
    }


# ═══════════════════════════════════════════════════════════════
# BUSINESS-SIDE: Email management
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/send-email")
async def send_client_email(business_id: str, data: dict = Body(...), authorization: str = Header(None)):
    """Send email to selected portal clients."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Auth required")

    db = get_database()
    client_ids = data.get("client_ids", [])
    subject = data.get("subject", "")
    body = data.get("body", "")

    if not subject or not body or not client_ids:
        raise HTTPException(400, "subject, body, and client_ids required")

    # Get emails
    recipients = []
    for cid in client_ids:
        try:
            c = await db.consumer_accounts.find_one({"_id": ObjectId(cid)})
            if c:
                recipients.append({"email": c["email"], "name": c.get("name", "")})
        except Exception:
            pass

    # Log the email send
    now = datetime.utcnow()
    await db.client_email_log.insert_one({
        "business_id": business_id,
        "subject": subject,
        "body": body,
        "recipient_count": len(recipients),
        "recipients": [r["email"] for r in recipients],
        "sent_at": now,
    })

    # TODO: Actually send via Resend/Sendly when configured
    return {"sent": True, "recipient_count": len(recipients)}


@router.get("/business/{business_id}/email-history")
async def get_email_history(business_id: str, authorization: str = Header(None)):
    """Get email send history."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Auth required")

    db = get_database()
    emails = []
    cursor = db.client_email_log.find({"business_id": business_id}).sort("sent_at", -1).limit(20)
    async for e in cursor:
        emails.append({
            "subject": e.get("subject", ""),
            "recipient_count": e.get("recipient_count", 0),
            "sent_at": e.get("sent_at", "").isoformat() if e.get("sent_at") else "",
        })
    return {"emails": emails}


# ═══════════════════════════════════════════════════════════════
# BUSINESS-SIDE: Push notifications
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/send-push")
async def send_push_notification(business_id: str, data: dict = Body(...), authorization: str = Header(None)):
    """Send push notification to portal clients (stored in DB, shown in portal)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Auth required")

    db = get_database()
    ntype = data.get("type", "announcement")
    title = data.get("title", "")
    message = data.get("message", "")
    target = data.get("target", "all")
    client_ids = data.get("client_ids", [])

    if not title or not message:
        raise HTTPException(400, "title and message required")

    now = datetime.utcnow()

    # Get recipient list
    if target == "all":
        recipients = []
        async for c in db.consumer_accounts.find({"business_ids": business_id}, {"_id": 1}):
            recipients.append(str(c["_id"]))
    else:
        recipients = client_ids

    # Create notification for each recipient
    for rid in recipients:
        await db.client_notifications.insert_one({
            "business_id": business_id,
            "consumer_id": rid,
            "type": ntype,
            "title": title,
            "message": message,
            "read": False,
            "created_at": now,
        })

    # Log
    await db.client_push_log.insert_one({
        "business_id": business_id,
        "type": ntype,
        "title": title,
        "message": message,
        "target": target,
        "recipient_count": len(recipients),
        "sent_at": now,
    })

    return {"sent": True, "recipient_count": len(recipients)}


@router.get("/business/{business_id}/push-history")
async def get_push_history(business_id: str, authorization: str = Header(None)):
    """Get push notification history."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Auth required")

    db = get_database()
    notifications = []
    cursor = db.client_push_log.find({"business_id": business_id}).sort("sent_at", -1).limit(20)
    async for n in cursor:
        notifications.append({
            "type": n.get("type", ""),
            "title": n.get("title", ""),
            "recipient_count": n.get("recipient_count", 0),
            "sent_at": n.get("sent_at", "").isoformat() if n.get("sent_at") else "",
        })
    return {"notifications": notifications}
