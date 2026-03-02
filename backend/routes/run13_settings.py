"""
Run 13: Settings — business details, opening hours, notifications, integrations, subscription
"""

import io
import re
import csv
import zipfile
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Body, Query
from fastapi.responses import StreamingResponse
from database import get_database
from middleware.tenant_db import get_scoped_db
from middleware.auth import get_current_owner
from middleware.tenant import verify_business_access, TenantContext
from bson import ObjectId

router = APIRouter(prefix="/settings-v2", tags=["settings-v2"])

PLANS = {
    "free": {"name": "Free", "price": 0, "interval": "month"},
    "starter": {"name": "Starter", "price": 8.99, "interval": "month"},
    "pro": {"name": "Growth", "price": 29, "interval": "month"},
    "premium": {"name": "Scale", "price": 59, "interval": "month"},
    "enterprise": {"name": "Enterprise", "price": None, "interval": None},
}

BUSINESS_TYPES = [
    "Salon", "Barber", "Spa", "Beauty Clinic", "Restaurant", "Café",
    "Nail Bar", "Lash Bar", "Wax Specialist", "Other"
]

DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
DAY_NAMES = {"mon": "Monday", "tue": "Tuesday", "wed": "Wednesday", "thu": "Thursday", "fri": "Friday", "sat": "Saturday", "sun": "Sunday"}

# Map legacy opening_hours keys (monday, tuesday, etc) to mon, tue, ...
LEGACY_DAY_MAP = {
    "monday": "mon", "tuesday": "tue", "wednesday": "wed", "thursday": "thu",
    "friday": "fri", "saturday": "sat", "sunday": "sun",
}

DEFAULT_HOURS = {d: {"open": True, "start": "09:00", "end": "17:00"} for d in DAYS[:5]}
DEFAULT_HOURS["sat"] = {"open": True, "start": "09:00", "end": "17:00"}
DEFAULT_HOURS["sun"] = {"open": False}

DEFAULT_NOTIFICATIONS = {
    "newBooking": {"email": True, "push": True, "sms": False},
    "bookingCancelled": {"email": True, "push": True, "sms": False},
    "bookingModified": {"email": True, "push": True, "sms": False},
    "newReview": {"email": True, "push": True, "sms": False},
    "paymentReceived": {"email": True, "push": False, "sms": False},
    "noShow": {"email": True, "push": True, "sms": False},
    "dailySummary": {"enabled": True, "time": "07:00"},
    "newOrder": {"email": False, "push": True, "sms": True},
}


async def _get_business(db, business_id: str, user: dict):
    try:
        b = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        b = await db.businesses.find_one({"_id": business_id})
    if not b:
        raise HTTPException(404, "Business not found")
    if str(b.get("owner_id", "")) != str(user.get("_id", "")):
        raise HTTPException(403, "Not authorized")
    return b


def _slug_valid(slug):
    return slug and re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", slug)


def _build_settings_response(business: dict) -> dict:
    """Build full settings payload from business document."""
    bp = business.get("bookingPage") or {}
    branding = bp.get("branding") or {}
    oh = business.get("openingHours") or business.get("opening_hours") or {}
    hours = {}
    for d in DAYS:
        legacy = oh.get(d)
        if legacy is None:
            for leg_key, leg_val in LEGACY_DAY_MAP.items():
                if leg_val == d:
                    legacy = oh.get(leg_key)
                    break
        if isinstance(legacy, dict):
            # Handle both formats:
            # New format: { open: true, start: "16:00", end: "23:00" }
            # Legacy seed format: { open: "12:00", close: "23:00" }
            is_open = legacy.get("open", True)
            if isinstance(is_open, str):
                # Legacy: "open" field is actually the start time string
                hours[d] = {"open": True, "start": str(is_open)[:5], "end": str(legacy.get("close", "23:00"))[:5]}
            elif legacy.get("closed"):
                hours[d] = {"open": False, "start": "00:00", "end": "00:00"}
            else:
                hours[d] = {"open": bool(is_open), "start": str(legacy.get("start", "09:00"))[:5], "end": str(legacy.get("end", "17:00"))[:5]}
        else:
            hours[d] = {**DEFAULT_HOURS.get(d, {"open": False})}
        hours[d].setdefault("open", True)
        hours[d].setdefault("start", "09:00")
        hours[d].setdefault("end", "17:00")
    return {
        "business": {
            "name": business.get("name", ""),
            "businessType": business.get("businessType") or _category_to_type(business.get("category", "salon")),
            "description": branding.get("description", "") or business.get("description", ""),
            "phone": business.get("phone", ""),
            "email": business.get("email", ""),
            "address": business.get("address", ""),
            "addressLine1": business.get("addressLine1", ""),
            "addressLine2": business.get("addressLine2", ""),
            "city": business.get("city", ""),
            "postcode": business.get("postcode", ""),
            "logo": branding.get("logo"),
            "coverPhoto": branding.get("coverPhoto"),
            "currency": "GBP",
            "timezone": "Europe/London",
            "slug": business.get("slug", "your-business"),
        },
        "openingHours": hours,
        "specialHours": business.get("specialHours", []),
        "notifications": {**DEFAULT_NOTIFICATIONS, **(business.get("notifications") or {})},
        "integrations": {
            "stripe": {"connected": bool(business.get("stripe_account_id")), "accountId": business.get("stripe_account_id")},
            "googleBusiness": {"connected": False},
            "customEmailDomain": {"connected": False},
            "uberDirect": {"connected": False},
            "zapier": {"connected": False},
            "googleAnalytics": {"connected": False},
        },
    }


@router.get("/business/{business_id}")
async def get_settings(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Returns all settings for Run 13 Settings page."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    return _build_settings_response(business)


def _category_to_type(cat):
    m = {"restaurant": "Restaurant", "barber": "Barber", "salon": "Salon", "spa": "Spa"}
    return m.get(str(cat).lower(), "Salon")


@router.put("/business/{business_id}")
async def update_settings(business_id: str, payload: dict = Body(default={}), tenant: TenantContext = Depends(verify_business_access)):
    """Partial update of business settings."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})

    updates = {"updated_at": datetime.utcnow()}
    biz = payload.get("business", {})
    if biz:
        if "name" in biz and biz["name"]:
            updates["name"] = str(biz["name"])[:200]
        if "businessType" in biz:
            updates["businessType"] = biz["businessType"]
        if "phone" in biz:
            updates["phone"] = str(biz.get("phone", ""))[:30]
        if "email" in biz:
            updates["email"] = str(biz.get("email", ""))[:100]
        if "address" in biz:
            updates["address"] = str(biz.get("address", ""))[:300]
        if "addressLine1" in biz:
            updates["addressLine1"] = str(biz.get("addressLine1", ""))[:200]
        if "addressLine2" in biz:
            updates["addressLine2"] = str(biz.get("addressLine2", ""))[:200]
        if "city" in biz:
            updates["city"] = str(biz.get("city", ""))[:100]
        if "postcode" in biz:
            updates["postcode"] = str(biz.get("postcode", ""))[:20]
        if "slug" in biz and biz["slug"]:
            slug = str(biz["slug"]).strip().lower().replace(" ", "-")
            if not _slug_valid(slug):
                raise HTTPException(400, "Slug must be alphanumeric with hyphens only")
            existing = await db.businesses.find_one({"slug": slug})
            if existing and str(existing.get("_id")) != str(business["_id"]):
                raise HTTPException(400, "This booking URL is already taken")
            updates["slug"] = slug

    if "notifications" in payload:
        updates["notifications"] = {**DEFAULT_NOTIFICATIONS, **(business.get("notifications") or {}), **payload["notifications"]}

    bp = dict(business.get("bookingPage") or {})
    bp_branding = dict(bp.get("branding") or {})
    if "business" in payload:
        biz = payload["business"]
        if "logo" in biz:
            bp_branding["logo"] = biz["logo"]
        if "coverPhoto" in biz:
            bp_branding["coverPhoto"] = biz["coverPhoto"]
        if "description" in biz:
            bp_branding["description"] = str(biz.get("description", ""))[:500]
    bp["branding"] = bp_branding
    updates["bookingPage"] = bp

    set_data = {"updated_at": updates["updated_at"], "bookingPage": bp}
    for k in ("name", "businessType", "phone", "email", "address", "addressLine1", "addressLine2", "city", "postcode", "slug", "notifications"):
        if k in updates:
            set_data[k] = updates[k]

    await db.businesses.update_one({"_id": business["_id"]}, {"$set": set_data})
    updated = await db.businesses.find_one({"_id": business["_id"]})
    return _build_settings_response(updated)


@router.put("/business/{business_id}/hours")
async def update_hours(business_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    """Update opening hours."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    hours = payload.get("openingHours") or payload
    if not isinstance(hours, dict):
        raise HTTPException(400, "openingHours required")
    current = business.get("openingHours") or {}
    valid = {}
    for d in DAYS:
        if d in hours:
            h = hours[d]
            valid[d] = {
                "open": bool(h.get("open", True)),
                "start": str(h.get("start", "09:00"))[:5],
                "end": str(h.get("end", "17:00"))[:5],
            }
        elif d in current:
            valid[d] = dict(current[d])
        else:
            valid[d] = {**DEFAULT_HOURS.get(d, {"open": False})}
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"openingHours": valid, "updated_at": datetime.utcnow()}},
    )
    return {"openingHours": valid}


@router.post("/business/{business_id}/special-hours")
async def add_special_hours(business_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    """Add special hours entry."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    date = payload.get("date")
    if not date:
        raise HTTPException(400, "date required")
    entry = {
        "id": f"sh_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        "date": date,
        "open": payload.get("open", True),
        "start": payload.get("start", "09:00"),
        "end": payload.get("end", "17:00"),
        "label": str(payload.get("label", ""))[:100],
    }
    special = business.get("specialHours", []) + [entry]
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"specialHours": special, "updated_at": datetime.utcnow()}},
    )
    return entry


@router.delete("/business/{business_id}/special-hours/{entry_id}")
async def delete_special_hours(business_id: str, entry_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Remove special hours entry."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    special = [s for s in business.get("specialHours", []) if s.get("id") != entry_id]
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"specialHours": special, "updated_at": datetime.utcnow()}},
    )
    return {"detail": "Removed"}


@router.put("/business/{business_id}/notifications")
async def update_notifications(business_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    """Update notification preferences."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    current = business.get("notifications") or {}
    merged = {**DEFAULT_NOTIFICATIONS, **current, **payload}
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"notifications": merged, "updated_at": datetime.utcnow()}},
    )
    return merged


# --- Subscription ---
@router.get("/subscription/{business_id}")
async def get_subscription(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Current plan details."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    tier = business.get("rezvo_tier", "free")
    plan = PLANS.get(tier, PLANS["free"])
    return {
        "plan": plan["name"],
        "tier": tier,
        "price": plan.get("price"),
        "interval": plan.get("interval"),
        "nextBillingDate": (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d"),
        "paymentMethod": "Visa •••• 4242",
        "cancelAtPeriodEnd": business.get("subscription_cancel_at_period_end", False),
    }


PLAN_TO_TIER = {"Free": "free", "Starter": "starter", "Growth": "pro", "Scale": "premium", "Enterprise": "enterprise"}


@router.post("/subscription/{business_id}/change")
async def change_subscription(business_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    """Upgrade/downgrade plan."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    tier = payload.get("tier") or PLAN_TO_TIER.get(payload.get("plan", "")) or payload.get("plan")
    if tier not in PLANS:
        raise HTTPException(400, f"Invalid tier. Use: {list(PLANS.keys())}")
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"rezvo_tier": tier, "updated_at": datetime.utcnow()}},
    )
    return {"detail": f"Plan changed to {PLANS[tier]['name']}"}


@router.post("/subscription/{business_id}/cancel")
async def cancel_subscription(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Cancel at end of billing period."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"subscription_cancel_at_period_end": True, "updated_at": datetime.utcnow()}},
    )
    return {"detail": "Subscription will cancel at end of billing period"}


@router.get("/subscription/{business_id}/portal")
async def get_customer_portal(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Stripe Customer Portal URL for payment method / invoices."""
    try:
        import stripe
        from config import settings
        stripe.api_key = settings.stripe_secret_key
        cust_id = user.get("stripe_customer_id")
        if cust_id:
            session = stripe.billing_portal.Session.create(
                customer=cust_id,
                return_url=f"{settings.frontend_url}/dashboard/settings",
            )
            return {"url": session.url}
    except Exception:
        pass
    return {"url": None}


# --- Integrations ---
@router.post("/business/{business_id}/integrations/{integration_type}/connect")
async def connect_integration(business_id: str, integration_type: str, tenant: TenantContext = Depends(verify_business_access)):
    """Start connect flow for integration. For Stripe, returns onboarding URL."""
    if integration_type == "stripe":
        try:
            import stripe
            from config import settings
            stripe.api_key = settings.stripe_secret_key
        except ImportError:
            raise HTTPException(500, "Stripe not configured")
        db = get_database()
        sdb = get_scoped_db(tenant.business_id)
        business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
        try:
            account = stripe.Account.create(
                type="standard",
                country="GB",
                email=user.get("email", ""),
                capabilities={"card_payments": {"requested": True}, "transfers": {"requested": True}},
            )
            link = stripe.AccountLink.create(
                account=account.id,
                refresh_url=f"{settings.frontend_url}/dashboard/settings",
                return_url=f"{settings.frontend_url}/dashboard/settings?stripe=success",
                type="account_onboarding",
            )
            await db.businesses.update_one(
                {"_id": business["_id"]},
                {"$set": {"stripe_account_id": account.id, "updated_at": datetime.utcnow()}},
            )
            return {"url": link.url}
        except Exception as e:
            raise HTTPException(400, str(e))
    raise HTTPException(400, f"Unknown integration: {integration_type}")


@router.delete("/business/{business_id}/integrations/{integration_type}/disconnect")
async def disconnect_integration(business_id: str, integration_type: str, tenant: TenantContext = Depends(verify_business_access)):
    """Disconnect integration."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    if integration_type == "stripe":
        await db.businesses.update_one(
            {"_id": business["_id"]},
            {"$unset": {"stripe_account_id": ""}, "$set": {"updated_at": datetime.utcnow()}},
        )
        return {"detail": "Stripe disconnected"}
    raise HTTPException(400, f"Unknown integration: {integration_type}")


# --- Export & Delete ---
@router.get("/business/{business_id}/export")
async def export_business_data(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Export all business data as ZIP of CSVs."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    bid = business["_id"]

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Clients (businessId per run7_clients)
        biz_id_str = str(bid)
        clients = await sdb.clients.find({"businessId": biz_id_str}).to_list(length=10000)
        if clients:
            out = io.StringIO()
            w = csv.writer(out)
            w.writerow(["id", "name", "email", "phone"])
            for c in clients:
                w.writerow([str(c.get("_id")), c.get("name",""), c.get("email",""), c.get("phone","")])
            zf.writestr("clients.csv", out.getvalue())

        # Bookings (businessId per book.py, bookings.py)
        bookings = await sdb.bookings.find({"businessId": biz_id_str}).to_list(length=10000)
        if bookings:
            out = io.StringIO()
            w = csv.writer(out)
            w.writerow(["id", "client_id", "service_id", "start", "status"])
            for b in bookings:
                w.writerow([str(b.get("_id")), b.get("client_id",""), b.get("service_id",""), str(b.get("start","")), b.get("status","")])
            zf.writestr("bookings.csv", out.getvalue())

        # Services (businessId per run4_services)
        services = await sdb.services.find({"businessId": biz_id_str}).to_list(length=1000)
        if services:
            out = io.StringIO()
            w = csv.writer(out)
            w.writerow(["id", "name", "duration", "price"])
            for s in services:
                w.writerow([str(s.get("_id")), s.get("name",""), s.get("duration_minutes",""), s.get("price","")])
            zf.writestr("services.csv", out.getvalue())

        # Business info
        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(["id", "name", "slug", "address", "phone"])
        w.writerow([str(business.get("_id")), business.get("name",""), business.get("slug",""), business.get("address",""), business.get("phone","")])
        zf.writestr("business.csv", out.getvalue())

    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": "attachment; filename=rezvo-export.zip"})


@router.delete("/business/{business_id}")
async def delete_business_soft(
    business_id: str,
    confirm_name: str = Query(None, alias="confirmName"),
    payload: dict = Body(default={}),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Soft-delete business. Requires typing business name to confirm."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    name_to_check = (confirm_name or payload.get("confirmName") or payload.get("confirm_name") or "").strip()
    if name_to_check != business.get("name", ""):
        raise HTTPException(400, "Business name must match to confirm deletion")
    deleted_at = datetime.utcnow()
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"deleted_at": deleted_at, "deleted": True, "updated_at": deleted_at}},
    )
    return {"detail": "Business scheduled for deletion. 30-day grace period."}
