"""
Run 6: Online Booking Editor API — branding, settings, share, integrations
Data stored in business.bookingPage
"""

import os
import io
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Body
from fastapi.responses import Response
from database import get_database
from middleware.tenant_db import get_scoped_db
from middleware.auth import get_current_owner
from middleware.tenant import verify_business_access, TenantContext
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/booking-page", tags=["booking-page"])

DEFAULTS = {
    "branding": {
        "logo": None,
        "coverPhoto": None,
        "description": "",
        "accentColour": "#1B4332",
    },
    "settings": {
        "advanceBookingDays": 60,
        "bookingIntervalMinutes": 30,
        "autoConfirm": True,
        "bufferMinutes": 15,
        "cancellationNoticeHours": 24,
        "depositEnabled": False,
        "depositType": None,
        "depositAmount": None,
    },
    "integrations": {
        "googleReserve": {"connected": False},
        "instagram": {"connected": False},
        "facebook": {"connected": False},
        "websiteWidget": {"enabled": False},
    },
}

UPLOADS_DIR = Path("/opt/rezvo-app/uploads/bookings")
try:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    pass


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


def _merge_defaults(bp):
    if not bp:
        return {**DEFAULTS}
    return {
        "branding": {**DEFAULTS["branding"], **(bp.get("branding") or {})},
        "settings": {**DEFAULTS["settings"], **(bp.get("settings") or {})},
        "integrations": {**DEFAULTS["integrations"], **(bp.get("integrations") or {})},
    }


def _base_url():
    return os.environ.get("REZVO_PUBLIC_URL", "https://portal.rezvo.app")


@router.get("/{business_id}")
async def get_booking_page(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    slug = business.get("slug", "your-business")
    bp = _merge_defaults(business.get("bookingPage"))
    base = _base_url()
    api_base = os.environ.get("REZVO_API_URL", "https://portal.rezvo.app/api")
    url = f"{base}/book/{slug}"
    return {
        **bp,
        "share": {
            "slug": slug,
            "url": url,
            "qrCodeUrl": f"{api_base}/booking-page/{business_id}/qr",
        },
    }


@router.put("/{business_id}")
async def update_booking_page(business_id: str, payload: dict = Body(default={}), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    current = business.get("bookingPage") or {}
    updated = {}
    if payload and "branding" in payload:
        updated["branding"] = {**current.get("branding", {}), **payload["branding"]}
    if payload and "settings" in payload:
        updated["settings"] = {**current.get("settings", {}), **payload["settings"]}
    if payload and "integrations" in payload:
        updated["integrations"] = {**current.get("integrations", {}), **payload["integrations"]}
    new_bp = {**current, **updated}
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"bookingPage": new_bp, "updated_at": datetime.utcnow()}},
    )
    slug = business.get("slug", "your-business")
    base = _base_url()
    api_base = os.environ.get("REZVO_API_URL", "https://portal.rezvo.app/api")
    return {
        **_merge_defaults(new_bp),
        "share": {"slug": slug, "url": f"{base}/book/{slug}", "qrCodeUrl": f"{api_base}/booking-page/{business_id}/qr"},
    }


def _save_upload(file: UploadFile, max_size: int, allowed: set, resize_size=None):
    content = file.file.read()
    if len(content) > max_size:
        raise HTTPException(400, f"File too large (max {max_size // (1024*1024)}MB)")
    ext = (file.filename or "").split(".")[-1].lower()
    if ext not in allowed:
        raise HTTPException(400, f"Invalid format. Allowed: {', '.join(allowed)}")
    name = f"{uuid.uuid4().hex[:12]}.{ext}"
    path = UPLOADS_DIR / name
    path.write_bytes(content)
    if resize_size and ext in ("jpg", "jpeg", "png", "webp"):
        try:
            from PIL import Image
            img = Image.open(path).convert("RGB" if ext != "png" else "RGBA")
            img.thumbnail(resize_size, Image.LANCZOS)
            img.save(path, quality=90)
        except Exception:
            pass
    return f"/static/bookings/{name}"


@router.post("/{business_id}/logo")
async def upload_logo(business_id: str, file: UploadFile = File(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    allowed = {"jpg", "jpeg", "png", "webp", "svg"}
    url = _save_upload(file, 2 * 1024 * 1024, allowed, resize_size=(200, 200))
    bp = business.get("bookingPage") or {}
    branding = bp.get("branding") or {}
    branding["logo"] = url
    new_bp = {**bp, "branding": branding}
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"bookingPage": new_bp, "updated_at": datetime.utcnow()}},
    )
    return {"url": url}


@router.post("/{business_id}/cover")
async def upload_cover(business_id: str, file: UploadFile = File(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    allowed = {"jpg", "jpeg", "png", "webp"}
    url = _save_upload(file, 5 * 1024 * 1024, allowed, resize_size=(1200, 400))
    bp = business.get("bookingPage") or {}
    branding = bp.get("branding") or {}
    branding["coverPhoto"] = url
    new_bp = {**bp, "branding": branding}
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"bookingPage": new_bp, "updated_at": datetime.utcnow()}},
    )
    return {"url": url}


@router.get("/{business_id}/qr")
async def get_qr_code(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    slug = business.get("slug", "your-business")
    url = f"https://book.rezvo.app/{slug}"
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=10, border=2)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#1B4332", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return Response(content=buf.read(), media_type="image/png")
    except ImportError:
        buf = io.BytesIO()
        buf.write(b"\x89PNG\r\n\x1a\n")
        return Response(content=buf.getvalue(), media_type="image/png")


@router.get("/{business_id}/embed")
async def get_embed_code(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    slug = business.get("slug", "your-business")
    url = f"https://book.rezvo.app/{slug}"
    accent = (business.get("bookingPage") or {}).get("branding") or {}
    accent = accent.get("accentColour", "#1B4332")
    iframe = f'<iframe src="{url}" width="100%" height="600" frameborder="0"></iframe>'
    button = f'<a href="{url}" style="background:{accent};color:#FEFBF4;padding:12px 24px;border-radius:10px;text-decoration:none;font-family:Figtree,sans-serif;">Book Now</a>'
    return {"embedCode": iframe, "buttonCode": button}
