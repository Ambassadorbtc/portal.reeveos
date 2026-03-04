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
        bookings.append({
            "id": bkg["_id"],
            "service": bkg.get("service", ""),
            "date": bkg.get("date", ""),
            "time": bkg.get("time", ""),
            "status": bkg.get("status", ""),
            "staff": bkg.get("staff_name", ""),
        })

    # Past bookings (last 10)
    past_bookings = []
    cursor = db.bookings.find({
        "businessId": biz_id,
        "customer.email": email,
        "status": {"$nin": ["cancelled"]},
        "date": {"$lt": now.strftime("%Y-%m-%d")},
    }).sort("date", -1).limit(10)
    async for bkg in cursor:
        bkg["_id"] = str(bkg["_id"])
        past_bookings.append({
            "id": bkg["_id"],
            "service": bkg.get("service", ""),
            "date": bkg.get("date", ""),
            "time": bkg.get("time", ""),
            "staff": bkg.get("staff_name", ""),
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
