"""
Website Builder API Routes
==========================
Comprehensive website builder backend for ReeveOS businesses.
Handles pages (CRUD + publish/rollback), settings, images, templates,
AI page generation, custom domains, redirects, analytics, and maintenance mode.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, Query
from database import get_database
from middleware.tenant import verify_business_access, TenantContext
from middleware.auth import get_current_user, get_current_admin
from middleware.rate_limit import limiter
from bson import ObjectId
from datetime import datetime, timedelta
from typing import Optional, List
from pathlib import Path
from collections import defaultdict
import os, re, uuid, json, logging, socket, time, io, hashlib
import qrcode

logger = logging.getLogger("website_builder")
router = APIRouter(prefix="/website", tags=["Website Builder"])

UPLOAD_BASE = Path("/opt/rezvo-app/uploads")
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/svg+xml"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
SLUG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9\-]{0,98}[a-z0-9]$|^[a-z0-9]$")
SUBDOMAIN_PATTERN = re.compile(r"^[a-z0-9]([a-z0-9\-]{1,61}[a-z0-9])?$")
DOMAIN_PATTERN = re.compile(
    r"^(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$"
)


def _doc(d):
    """Serialize a MongoDB document, converting _id to id string."""
    if d is None:
        return None
    d["id"] = str(d.pop("_id"))
    return d


async def ensure_website_indexes():
    """Create all required indexes for website builder collections."""
    db = get_database()
    await db.website_pages.create_index([("business_id", 1), ("slug", 1)], unique=True)
    await db.website_settings.create_index("business_id", unique=True)
    await db.website_settings.create_index("subdomain", unique=True, sparse=True)
    await db.website_images.create_index("business_id")
    await db.website_domains.create_index([("business_id", 1), ("domain", 1)], unique=True)
    await db.website_redirects.create_index("business_id")
    # TTL index: auto-delete analytics after 90 days
    await db.website_analytics.create_index("created_at", expireAfterSeconds=90 * 24 * 3600)
    await db.website_analytics.create_index([("business_id", 1), ("page_slug", 1)])
    await db.website_analytics.create_index([("business_id", 1), ("created_at", -1)])
    await db.website_analytics.create_index("session_id")
    # AI usage rate tracking
    await db.ai_usage.create_index([("business_id", 1), ("date", 1)])
    await db.website_templates.create_index("industry")


# ─────────────────────────────────────────────────────
# AI CREDITS & RATE LIMITING HELPERS
# ─────────────────────────────────────────────────────

# In-memory rate limiter for AI generation (per-business, hourly)
_ai_rate_cache = defaultdict(list)  # business_id -> [timestamps]

CREDIT_PACKAGES = {
    "50": {"credits": 50, "price": 4.99},
    "150": {"credits": 150, "price": 9.99},
    "500": {"credits": 500, "price": 24.99},
}

AI_SYSTEM_PROMPT = (
    "You are a website designer. Generate a complete website page using these Puck component types: "
    "HeroSection, Heading, TextBlock, ImageBlock, ButtonBlock, ServiceCard, TeamMember, Testimonial, "
    "OpeningHours, ContactForm, FAQAccordion, Section, Columns, Spacer. "
    "Output ONLY valid JSON matching Puck data format: "
    '{ "content": [{ "type": "ComponentName", "props": {...} }], "root": { "props": {} } }. '
    "Use professional copy. Include booking CTAs where appropriate. "
    "Do NOT wrap in markdown code fences. Output raw JSON only."
)


async def _check_ai_rate_limit(business_id: str):
    """Enforce max 10 AI generations/hour, 50/day per business."""
    db = get_database()
    now = datetime.utcnow()
    today = now.strftime("%Y-%m-%d")
    hour = now.strftime("%Y-%m-%d-%H")

    # Check daily limit
    daily = await db.ai_usage.find_one({"business_id": business_id, "date": today})
    daily_count = daily["count"] if daily else 0
    if daily_count >= 50:
        raise HTTPException(429, "Daily AI generation limit reached (50/day). Try again tomorrow.")

    # Check hourly limit (in-memory for speed)
    now_ts = time.time()
    _ai_rate_cache[business_id] = [
        ts for ts in _ai_rate_cache[business_id] if now_ts - ts < 3600
    ]
    if len(_ai_rate_cache[business_id]) >= 10:
        raise HTTPException(429, "Hourly AI generation limit reached (10/hour). Try again later.")


async def _record_ai_usage(business_id: str):
    """Record an AI generation for rate limiting."""
    db = get_database()
    today = datetime.utcnow().strftime("%Y-%m-%d")
    await db.ai_usage.update_one(
        {"business_id": business_id, "date": today},
        {"$inc": {"count": 1}},
        upsert=True,
    )
    _ai_rate_cache[business_id].append(time.time())


async def _check_and_deduct_credit(business_id: str) -> int:
    """Check business has AI credits and deduct 1. Returns remaining credits.
    Raises 402 if no credits."""
    db = get_database()
    now = datetime.utcnow()

    # Auto-reset monthly credits if past reset date
    biz = await db.businesses.find_one(
        {"_id": ObjectId(business_id)},
        {"ai_credits": 1, "ai_credits_monthly_allowance": 1, "ai_credits_reset_date": 1},
    )
    if not biz:
        raise HTTPException(404, "Business not found")

    credits = biz.get("ai_credits", 0)
    reset_date = biz.get("ai_credits_reset_date")
    monthly = biz.get("ai_credits_monthly_allowance", 0)

    # Reset monthly credits if due
    if reset_date and now >= reset_date:
        next_reset = datetime(now.year, now.month, 1) + timedelta(days=32)
        next_reset = datetime(next_reset.year, next_reset.month, 1)
        credits = monthly
        await db.businesses.update_one(
            {"_id": ObjectId(business_id)},
            {"$set": {
                "ai_credits": monthly,
                "ai_credits_reset_date": next_reset,
            }},
        )

    if credits <= 0:
        raise HTTPException(402, "No AI credits remaining. Purchase AI Builder add-on.")

    # Atomic deduct
    result = await db.businesses.update_one(
        {"_id": ObjectId(business_id), "ai_credits": {"$gt": 0}},
        {"$inc": {"ai_credits": -1}},
    )
    if result.modified_count == 0:
        raise HTTPException(402, "No AI credits remaining. Purchase AI Builder add-on.")

    return credits - 1


async def _refund_credit(business_id: str):
    """Refund 1 AI credit on generation failure."""
    db = get_database()
    await db.businesses.update_one(
        {"_id": ObjectId(business_id)},
        {"$inc": {"ai_credits": 1}},
    )


def _parse_ai_json(text: str) -> dict:
    """Parse JSON from AI response, handling markdown fences."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)


def _validate_puck_data(data: dict) -> bool:
    """Validate basic Puck data structure."""
    if not isinstance(data, dict):
        return False
    content = data.get("content")
    if not isinstance(content, list):
        return False
    for item in content:
        if not isinstance(item, dict) or "type" not in item:
            return False
    return True


def _default_settings(business_id: str) -> dict:
    """Return default website settings for a new business."""
    now = datetime.utcnow()
    return {
        "business_id": business_id,
        "subdomain": None,
        "custom_domain": None,
        "custom_domain_verified": False,
        "custom_domain_ssl_status": "pending",
        "brand": {
            "primary_color": "#111111",
            "secondary_color": "#F5F0E8",
            "accent_color": "#C4A882",
            "font_heading": "Cormorant Garamond",
            "font_body": "DM Sans",
            "logo_url": None,
            "favicon_url": None,
            "button_style": "rounded",
        },
        "navigation": [],
        "footer": {
            "business_name": "",
            "tagline": "",
            "address": "",
            "phone": "",
            "email": "",
            "links": [],
            "social": {},
        },
        "integrations": {},
        "cookie_consent": {
            "enabled": False,
            "text": "We use cookies to improve your experience.",
            "policy_url": None,
            "auto_detect": True,
        },
        "announcement_bar": {
            "enabled": False,
            "text": "",
            "link": None,
            "bg_color": "#111111",
            "text_color": "#FFFFFF",
        },
        "seo_defaults": {
            "title_suffix": "",
            "default_og_image": None,
        },
        "booking_integration": {
            "enabled": False,
            "booking_url": None,
            "button_text": "Book Now",
        },
        "maintenance_mode": {
            "enabled": False,
            "message": "We'll be back soon.",
            "password_bypass": None,
            "scheduled_start": None,
            "scheduled_end": None,
        },
        "created_at": now,
        "updated_at": now,
    }


# ─────────────────────────────────────────────────────
# PAGES CRUD
# ─────────────────────────────────────────────────────

@router.get("/business/{business_id}/pages")
async def list_pages(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """List all pages for a business (excludes puck_data for performance)."""
    db = get_database()
    cursor = db.website_pages.find(
        {"business_id": business_id, "deleted": {"$ne": True}},
        {
            "puck_data": 0,
            "versions_history": 0,
        },
    ).sort("updated_at", -1)
    pages = await cursor.to_list(500)
    return [_doc(p) for p in pages]


@router.get("/business/{business_id}/pages/{slug}")
async def get_page(
    business_id: str,
    slug: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get a single page with full puck_data."""
    db = get_database()
    page = await db.website_pages.find_one(
        {"business_id": business_id, "slug": slug, "deleted": {"$ne": True}}
    )
    if not page:
        raise HTTPException(404, "Page not found")
    return _doc(page)


@router.post("/business/{business_id}/pages", status_code=201)
async def create_page(
    business_id: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Create a new draft page."""
    db = get_database()
    slug = body.get("slug", "").strip().lower()

    if not slug or not SLUG_PATTERN.match(slug):
        raise HTTPException(
            400,
            "Invalid slug: must be 1-100 chars, lowercase alphanumeric and hyphens only.",
        )

    # Check uniqueness within business
    existing = await db.website_pages.find_one(
        {"business_id": business_id, "slug": slug, "deleted": {"$ne": True}}
    )
    if existing:
        raise HTTPException(400, f"Page with slug '{slug}' already exists for this business.")

    now = datetime.utcnow()
    doc = {
        "business_id": business_id,
        "slug": slug,
        "title": body.get("title", slug.replace("-", " ").title()),
        "meta_description": body.get("meta_description", ""),
        "og_image": body.get("og_image"),
        "puck_data": {},
        "status": "draft",
        "version": 1,
        "versions_history": [],
        "published_at": None,
        "created_at": now,
        "updated_at": now,
        "created_by": tenant.user_id,
        "deleted": False,
    }
    result = await db.website_pages.insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("Page created: business=%s slug=%s", business_id, slug)
    return _doc(doc)


@router.put("/business/{business_id}/pages/{slug}")
async def update_page(
    business_id: str,
    slug: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Update a draft page. Does NOT change version or status."""
    db = get_database()
    update_fields = {"updated_at": datetime.utcnow()}

    for field in ("puck_data", "title", "meta_description", "og_image"):
        if field in body:
            update_fields[field] = body[field]

    result = await db.website_pages.find_one_and_update(
        {"business_id": business_id, "slug": slug, "deleted": {"$ne": True}},
        {"$set": update_fields},
        return_document=True,
    )
    if not result:
        raise HTTPException(404, "Page not found")
    return _doc(result)


@router.post("/business/{business_id}/pages/{slug}/publish")
async def publish_page(
    business_id: str,
    slug: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Publish a page: set status=published, increment version, snapshot to history."""
    db = get_database()
    page = await db.website_pages.find_one(
        {"business_id": business_id, "slug": slug, "deleted": {"$ne": True}}
    )
    if not page:
        raise HTTPException(404, "Page not found")

    now = datetime.utcnow()
    new_version = page.get("version", 1) + 1

    version_snapshot = {
        "version": new_version,
        "puck_data": page.get("puck_data", {}),
        "published_at": now,
        "published_by": tenant.user_id,
    }

    result = await db.website_pages.find_one_and_update(
        {"_id": page["_id"]},
        {
            "$set": {
                "status": "published",
                "version": new_version,
                "published_at": now,
                "updated_at": now,
            },
            "$push": {"versions_history": version_snapshot},
        },
        return_document=True,
    )
    logger.info("Page published: business=%s slug=%s version=%d", business_id, slug, new_version)
    return _doc(result)


@router.post("/business/{business_id}/pages/{slug}/unpublish")
async def unpublish_page(
    business_id: str,
    slug: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Unpublish a page: set status=draft, clear published_at."""
    db = get_database()
    result = await db.website_pages.find_one_and_update(
        {"business_id": business_id, "slug": slug, "deleted": {"$ne": True}},
        {"$set": {"status": "draft", "published_at": None, "updated_at": datetime.utcnow()}},
        return_document=True,
    )
    if not result:
        raise HTTPException(404, "Page not found")
    return _doc(result)


@router.post("/business/{business_id}/pages/{slug}/rollback")
async def rollback_page(
    business_id: str,
    slug: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Rollback a page to a specific version from history."""
    db = get_database()
    target_version = body.get("version")
    if target_version is None:
        raise HTTPException(400, "version is required")

    page = await db.website_pages.find_one(
        {"business_id": business_id, "slug": slug, "deleted": {"$ne": True}}
    )
    if not page:
        raise HTTPException(404, "Page not found")

    # Find the requested version in history
    history = page.get("versions_history", [])
    version_entry = next((v for v in history if v.get("version") == target_version), None)
    if not version_entry:
        raise HTTPException(404, f"Version {target_version} not found in history")

    result = await db.website_pages.find_one_and_update(
        {"_id": page["_id"]},
        {
            "$set": {
                "puck_data": version_entry["puck_data"],
                "status": "draft",
                "updated_at": datetime.utcnow(),
            }
        },
        return_document=True,
    )
    logger.info("Page rolled back: business=%s slug=%s to version=%d", business_id, slug, target_version)
    return _doc(result)


@router.post("/business/{business_id}/pages/{slug}/duplicate", status_code=201)
async def duplicate_page(
    business_id: str,
    slug: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Duplicate a page as a new draft with a -copy suffix."""
    db = get_database()
    page = await db.website_pages.find_one(
        {"business_id": business_id, "slug": slug, "deleted": {"$ne": True}}
    )
    if not page:
        raise HTTPException(404, "Page not found")

    # Generate unique copy slug
    new_slug = f"{slug}-copy"
    counter = 2
    while await db.website_pages.find_one(
        {"business_id": business_id, "slug": new_slug, "deleted": {"$ne": True}}
    ):
        new_slug = f"{slug}-copy-{counter}"
        counter += 1

    now = datetime.utcnow()
    new_page = {
        "business_id": business_id,
        "slug": new_slug,
        "title": f"{page.get('title', '')} (Copy)",
        "meta_description": page.get("meta_description", ""),
        "og_image": page.get("og_image"),
        "puck_data": page.get("puck_data", {}),
        "status": "draft",
        "version": 1,
        "versions_history": [],
        "published_at": None,
        "created_at": now,
        "updated_at": now,
        "created_by": tenant.user_id,
        "deleted": False,
    }
    result = await db.website_pages.insert_one(new_page)
    new_page["_id"] = result.inserted_id
    logger.info("Page duplicated: business=%s from=%s to=%s", business_id, slug, new_slug)
    return _doc(new_page)


@router.delete("/business/{business_id}/pages/{slug}")
async def delete_page(
    business_id: str,
    slug: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Soft delete a page."""
    db = get_database()
    result = await db.website_pages.find_one_and_update(
        {"business_id": business_id, "slug": slug, "deleted": {"$ne": True}},
        {"$set": {"deleted": True, "deleted_at": datetime.utcnow()}},
    )
    if not result:
        raise HTTPException(404, "Page not found")
    logger.info("Page deleted: business=%s slug=%s", business_id, slug)
    return {"detail": "Page deleted"}


# ─────────────────────────────────────────────────────
# SETTINGS
# ─────────────────────────────────────────────────────

@router.get("/business/{business_id}/settings")
async def get_settings(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Return website settings. Creates default if none exist."""
    db = get_database()
    settings = await db.website_settings.find_one({"business_id": business_id})
    if not settings:
        settings = _default_settings(business_id)
        result = await db.website_settings.insert_one(settings)
        settings["_id"] = result.inserted_id
    return _doc(settings)


@router.put("/business/{business_id}/settings")
async def update_settings(
    business_id: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Partial update of website settings."""
    db = get_database()

    # Ensure settings doc exists
    existing = await db.website_settings.find_one({"business_id": business_id})
    if not existing:
        settings = _default_settings(business_id)
        await db.website_settings.insert_one(settings)

    # Remove fields that should not be overwritten directly
    body.pop("_id", None)
    body.pop("id", None)
    body.pop("business_id", None)
    body.pop("created_at", None)
    body["updated_at"] = datetime.utcnow()

    # Subdomain cannot be changed once set
    if "subdomain" in body and existing and existing.get("subdomain"):
        if body["subdomain"] != existing["subdomain"]:
            raise HTTPException(400, "Subdomain cannot be changed once set")

    # Flatten nested dicts for dot-notation $set
    set_fields = {}
    for key, value in body.items():
        if isinstance(value, dict) and key in (
            "brand", "footer", "cookie_consent", "announcement_bar",
            "seo_defaults", "booking_integration", "maintenance_mode", "integrations",
        ):
            for sub_key, sub_value in value.items():
                set_fields[f"{key}.{sub_key}"] = sub_value
        else:
            set_fields[key] = value

    result = await db.website_settings.find_one_and_update(
        {"business_id": business_id},
        {"$set": set_fields},
        return_document=True,
    )
    return _doc(result)


@router.post("/business/{business_id}/settings/check-subdomain")
async def check_subdomain(
    business_id: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Check if a subdomain is available."""
    db = get_database()
    subdomain = body.get("subdomain", "").strip().lower()

    if not subdomain or not SUBDOMAIN_PATTERN.match(subdomain):
        raise HTTPException(
            400,
            "Invalid subdomain: 3-63 chars, lowercase alphanumeric and hyphens, "
            "cannot start or end with a hyphen.",
        )

    existing = await db.website_settings.find_one(
        {"subdomain": subdomain, "business_id": {"$ne": business_id}}
    )
    return {"available": existing is None, "subdomain": subdomain}


# ─────────────────────────────────────────────────────
# IMAGES
# ─────────────────────────────────────────────────────

@router.post("/business/{business_id}/images/upload", status_code=201)
async def upload_image(
    business_id: str,
    file: UploadFile = File(...),
    alt_text: str = Form(""),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Upload an image for the website builder. Max 5MB, jpg/png/webp/svg only."""
    db = get_database()

    # Validate MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, f"File type '{file.content_type}' not allowed. Use jpg, png, webp, or svg.")

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB.")

    # Generate filename
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".svg"):
        ext = ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"

    # Create directory
    upload_dir = UPLOAD_BASE / business_id / "website"
    upload_dir.mkdir(parents=True, exist_ok=True)

    is_svg = file.content_type == "image/svg+xml"

    # Strip EXIF and generate thumbnail
    try:
        from PIL import Image
        import io

        if not is_svg:
            # Strip EXIF by re-saving
            img = Image.open(io.BytesIO(contents))
            clean = Image.new(img.mode, img.size)
            clean.putdata(list(img.getdata()))

            # Save original (no EXIF)
            buf = io.BytesIO()
            save_format = {"webp": "WEBP", "png": "PNG"}.get(ext.lstrip("."), "JPEG")
            clean.save(buf, format=save_format, quality=90)
            contents = buf.getvalue()

            # Generate thumbnail (200px wide)
            ratio = 200 / clean.width
            thumb_size = (200, int(clean.height * ratio))
            thumb = clean.resize(thumb_size, Image.LANCZOS)
            thumb_buf = io.BytesIO()
            thumb.save(thumb_buf, format=save_format, quality=80)
            thumb_contents = thumb_buf.getvalue()
            thumb_filename = f"thumb_{filename}"
            (upload_dir / thumb_filename).write_bytes(thumb_contents)
        else:
            thumb_filename = None
    except ImportError:
        logger.warning("Pillow not available — saving without EXIF stripping or thumbnail")
        thumb_filename = None

    # Save original file
    (upload_dir / filename).write_bytes(contents)

    # Create DB record
    now = datetime.utcnow()
    image_doc = {
        "business_id": business_id,
        "filename": filename,
        "original_filename": file.filename,
        "url": f"/static/{business_id}/website/{filename}",
        "thumbnail_url": f"/static/{business_id}/website/{thumb_filename}" if thumb_filename else None,
        "alt_text": alt_text,
        "content_type": file.content_type,
        "file_size": len(contents),
        "uploaded_by": tenant.user_id,
        "created_at": now,
    }
    result = await db.website_images.insert_one(image_doc)
    image_doc["_id"] = result.inserted_id
    logger.info("Image uploaded: business=%s file=%s", business_id, filename)
    return _doc(image_doc)


@router.get("/business/{business_id}/images")
async def list_images(
    business_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tenant: TenantContext = Depends(verify_business_access),
):
    """List all images for a business with pagination."""
    db = get_database()
    cursor = db.website_images.find(
        {"business_id": business_id}
    ).sort("created_at", -1).skip(skip).limit(limit)
    images = await cursor.to_list(limit)
    total = await db.website_images.count_documents({"business_id": business_id})
    return {"images": [_doc(img) for img in images], "total": total, "skip": skip, "limit": limit}


@router.patch("/business/{business_id}/images/{image_id}")
async def update_image(
    business_id: str,
    image_id: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Update image alt text."""
    db = get_database()
    if not ObjectId.is_valid(image_id):
        raise HTTPException(400, "Invalid image ID")

    alt_text = body.get("alt_text")
    if alt_text is None:
        raise HTTPException(400, "alt_text is required")

    result = await db.website_images.find_one_and_update(
        {"_id": ObjectId(image_id), "business_id": business_id},
        {"$set": {"alt_text": alt_text}},
        return_document=True,
    )
    if not result:
        raise HTTPException(404, "Image not found")
    return _doc(result)


@router.delete("/business/{business_id}/images/{image_id}")
async def delete_image(
    business_id: str,
    image_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Delete an image from disk and database."""
    db = get_database()
    if not ObjectId.is_valid(image_id):
        raise HTTPException(400, "Invalid image ID")

    image = await db.website_images.find_one(
        {"_id": ObjectId(image_id), "business_id": business_id}
    )
    if not image:
        raise HTTPException(404, "Image not found")

    # Delete files from disk
    upload_dir = UPLOAD_BASE / business_id / "website"
    try:
        filepath = upload_dir / image["filename"]
        if filepath.exists():
            filepath.unlink()
        # Delete thumbnail if it exists
        thumb_path = upload_dir / f"thumb_{image['filename']}"
        if thumb_path.exists():
            thumb_path.unlink()
    except OSError as e:
        logger.warning("Failed to delete image file: %s", e)

    await db.website_images.delete_one({"_id": ObjectId(image_id)})
    logger.info("Image deleted: business=%s image=%s", business_id, image_id)
    return {"detail": "Image deleted"}


# ─────────────────────────────────────────────────────
# TEMPLATES (public + auth)
# ─────────────────────────────────────────────────────

@router.get("/templates")
async def list_templates(
    industry: Optional[str] = Query(None),
):
    """Public: list all website templates, optionally filtered by industry."""
    db = get_database()
    query = {}
    if industry:
        query["industry"] = industry
    cursor = db.website_templates.find(
        query,
        {"name": 1, "industry": 1, "preview_image": 1, "description": 1, "page_count": 1},
    ).sort("name", 1)
    templates = await cursor.to_list(200)
    return [_doc(t) for t in templates]


@router.get("/templates/{template_id}/preview")
async def preview_template(template_id: str):
    """Public: get full template data including pages and default brand."""
    db = get_database()
    if not ObjectId.is_valid(template_id):
        raise HTTPException(400, "Invalid template ID")

    template = await db.website_templates.find_one({"_id": ObjectId(template_id)})
    if not template:
        raise HTTPException(404, "Template not found")
    return _doc(template)


@router.post("/business/{business_id}/apply-template", status_code=201)
async def apply_template(
    business_id: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Apply a template: copy its pages as drafts and optionally set brand settings."""
    db = get_database()
    template_id = body.get("template_id")
    if not template_id or not ObjectId.is_valid(template_id):
        raise HTTPException(400, "Valid template_id is required")

    template = await db.website_templates.find_one({"_id": ObjectId(template_id)})
    if not template:
        raise HTTPException(404, "Template not found")

    now = datetime.utcnow()
    created_slugs = []

    # Copy template pages — overwrite existing drafts with same slugs
    for page_def in template.get("pages", []):
        slug = page_def.get("slug", "")
        if not slug:
            continue

        page_doc = {
            "business_id": business_id,
            "slug": slug,
            "title": page_def.get("title", slug.replace("-", " ").title()),
            "meta_description": page_def.get("meta_description", ""),
            "og_image": page_def.get("og_image"),
            "puck_data": page_def.get("puck_data", {}),
            "status": "draft",
            "version": 1,
            "versions_history": [],
            "published_at": None,
            "created_at": now,
            "updated_at": now,
            "created_by": tenant.user_id,
            "deleted": False,
            "template_source": template_id,
        }
        await db.website_pages.update_one(
            {"business_id": business_id, "slug": slug},
            {"$set": page_doc},
            upsert=True,
        )
        created_slugs.append(slug)

    # Apply brand defaults if present
    default_brand = template.get("default_brand")
    if default_brand:
        existing_settings = await db.website_settings.find_one({"business_id": business_id})
        if existing_settings:
            await db.website_settings.update_one(
                {"business_id": business_id},
                {"$set": {"brand": default_brand, "updated_at": now}},
            )
        else:
            settings = _default_settings(business_id)
            settings["brand"] = default_brand
            await db.website_settings.insert_one(settings)

    logger.info("Template applied: business=%s template=%s pages=%s", business_id, template_id, created_slugs)
    return {"pages_created": created_slugs}


# ─────────────────────────────────────────────────────
# AI BUILD
# ─────────────────────────────────────────────────────

@router.post("/business/{business_id}/ai-build")
async def ai_build(
    business_id: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Generate a full website (5 pages) using AI. Costs 1 credit per page generated."""
    db = get_database()

    business_name = body.get("business_name", "")
    industry = body.get("industry", "")
    services = body.get("services", [])
    description = body.get("description", "")
    brand_colors = body.get("brand_colors", {})

    if not business_name or not industry:
        raise HTTPException(400, "business_name and industry are required")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(503, "AI service is not configured")

    # Check rate limits
    await _check_ai_rate_limit(business_id)

    # Check credits upfront (need at least 1 — deduct per page)
    biz = await db.businesses.find_one(
        {"_id": ObjectId(business_id)}, {"ai_credits": 1}
    )
    if not biz or biz.get("ai_credits", 0) <= 0:
        raise HTTPException(402, "No AI credits remaining. Purchase AI Builder add-on.")

    import anthropic

    client = anthropic.Anthropic(api_key=api_key)

    pages_to_generate = ["home", "about", "services", "contact", "gallery"]
    created_slugs = []
    errors = []

    primary = brand_colors.get("primary", "#111111")
    secondary = brand_colors.get("secondary", "#F5F0E8")
    accent = brand_colors.get("accent", "#C4A882")
    services_str = ", ".join(services) if services else "various services"

    for page_slug in pages_to_generate:
        try:
            # Skip if page already exists
            existing = await db.website_pages.find_one(
                {"business_id": business_id, "slug": page_slug, "deleted": {"$ne": True}}
            )
            if existing:
                errors.append({"page": page_slug, "error": "Page already exists, skipped"})
                continue

            # Deduct 1 credit per page
            credits_remaining = await _check_and_deduct_credit(business_id)

            try:
                response = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=4096,
                    system=AI_SYSTEM_PROMPT,
                    messages=[
                        {
                            "role": "user",
                            "content": (
                                f"Create the {page_slug} page for a {industry} website called "
                                f"'{business_name}'. Services: {services_str}. "
                                f"Description: {description}. "
                                f"Brand colours: primary {primary}, secondary {secondary}, accent {accent}. "
                                f"Include booking CTAs. Make the copy professional and specific to {industry}."
                            ),
                        }
                    ],
                )

                puck_data = _parse_ai_json(response.content[0].text)

                if not _validate_puck_data(puck_data):
                    await _refund_credit(business_id)
                    errors.append({"page": page_slug, "error": "AI returned invalid page structure"})
                    continue

            except json.JSONDecodeError as e:
                await _refund_credit(business_id)
                logger.warning("AI JSON parse error for %s: %s", page_slug, e)
                errors.append({"page": page_slug, "error": f"Failed to parse AI response: {str(e)}"})
                continue
            except Exception as e:
                await _refund_credit(business_id)
                logger.warning("AI build error for %s: %s", page_slug, e)
                errors.append({"page": page_slug, "error": str(e)})
                continue

            # Save as draft page
            now = datetime.utcnow()
            await db.website_pages.insert_one(
                {
                    "business_id": business_id,
                    "slug": page_slug,
                    "title": page_slug.replace("-", " ").title(),
                    "meta_description": f"{business_name} - {page_slug.title()} page",
                    "og_image": None,
                    "puck_data": puck_data,
                    "status": "draft",
                    "version": 1,
                    "versions_history": [],
                    "published_at": None,
                    "created_at": now,
                    "updated_at": now,
                    "created_by": tenant.user_id,
                    "ai_generated": True,
                    "deleted": False,
                }
            )
            created_slugs.append(page_slug)
            await _record_ai_usage(business_id)
            logger.info("AI page generated: business=%s slug=%s", business_id, page_slug)

        except HTTPException:
            raise
        except Exception as e:
            logger.warning("AI build error for %s: %s", page_slug, e)
            errors.append({"page": page_slug, "error": str(e)})

    # Get final credit balance
    biz = await db.businesses.find_one(
        {"_id": ObjectId(business_id)}, {"ai_credits": 1}
    )
    return {
        "pages_created": created_slugs,
        "credits_remaining": biz.get("ai_credits", 0) if biz else 0,
        "errors": errors,
    }


@router.post("/business/{business_id}/ai-generate-content")
async def ai_generate_content(
    business_id: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Generate a single Puck component using AI. Costs 1 credit."""
    prompt = body.get("prompt", "")
    component_type = body.get("component_type", "TextBlock")
    context = body.get("context", "")

    if not prompt:
        raise HTTPException(400, "prompt is required")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(503, "AI service is not configured")

    await _check_ai_rate_limit(business_id)
    credits_remaining = await _check_and_deduct_credit(business_id)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=(
                "You are a website content generator. Output ONLY valid JSON for a single Puck component. "
                f'Format: {{ "type": "{component_type}", "props": {{...}} }}. '
                "Do NOT wrap in markdown fences. Output raw JSON only."
            ),
            messages=[
                {
                    "role": "user",
                    "content": f"{prompt}\n\nContext: {context}" if context else prompt,
                }
            ],
        )

        component = _parse_ai_json(response.content[0].text)
        if not isinstance(component, dict) or "type" not in component:
            await _refund_credit(business_id)
            raise HTTPException(500, "AI returned invalid component structure")

        await _record_ai_usage(business_id)
        return {"puck_component": component, "credits_remaining": credits_remaining}

    except HTTPException:
        raise
    except json.JSONDecodeError:
        await _refund_credit(business_id)
        raise HTTPException(500, "Failed to parse AI response as JSON")
    except Exception as e:
        await _refund_credit(business_id)
        logger.warning("AI content generation error: %s", e)
        raise HTTPException(500, "AI generation failed. Credit refunded.")


@router.post("/business/{business_id}/ai-blog-post")
async def ai_blog_post(
    business_id: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Generate a blog post with title, excerpt, body HTML, meta description.
    Costs 1 credit."""
    topic = body.get("topic", "")
    tone = body.get("tone", "professional")
    length = body.get("length", "medium")

    if not topic:
        raise HTTPException(400, "topic is required")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(503, "AI service is not configured")

    await _check_ai_rate_limit(business_id)
    credits_remaining = await _check_and_deduct_credit(business_id)

    # Get business info for context
    db = get_database()
    biz = await db.businesses.find_one(
        {"_id": ObjectId(business_id)}, {"name": 1, "industry": 1}
    )
    biz_name = biz.get("name", "") if biz else ""
    biz_industry = biz.get("industry", "") if biz else ""

    word_target = {"short": "300-500", "medium": "600-900", "long": "1000-1500"}.get(length, "600-900")

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=(
                "You are a professional blog writer. Output ONLY valid JSON with these fields: "
                '"title" (string), "excerpt" (string, 1-2 sentences), '
                '"body_html" (string, HTML with <h2>, <p>, <ul>, <li> tags), '
                '"meta_description" (string, max 160 chars for SEO), '
                '"image_suggestion" (string, a search term for finding a relevant stock photo). '
                "Do NOT wrap in markdown fences. Output raw JSON only."
            ),
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Write a {tone} blog post about: {topic}. "
                        f"Target length: {word_target} words. "
                        f"Business: {biz_name} ({biz_industry}). "
                        f"Make it engaging, SEO-friendly, and relevant to the industry."
                    ),
                }
            ],
        )

        result = _parse_ai_json(response.content[0].text)
        required_fields = {"title", "excerpt", "body_html", "meta_description", "image_suggestion"}
        if not isinstance(result, dict) or not required_fields.issubset(result.keys()):
            await _refund_credit(business_id)
            raise HTTPException(500, "AI returned incomplete blog post structure")

        await _record_ai_usage(business_id)
        result["credits_remaining"] = credits_remaining
        return result

    except HTTPException:
        raise
    except json.JSONDecodeError:
        await _refund_credit(business_id)
        raise HTTPException(500, "Failed to parse AI response as JSON")
    except Exception as e:
        await _refund_credit(business_id)
        logger.warning("AI blog post generation error: %s", e)
        raise HTTPException(500, "AI generation failed. Credit refunded.")


# ─────────────────────────────────────────────────────
# CREDITS SYSTEM
# ─────────────────────────────────────────────────────

@router.get("/business/{business_id}/credits")
async def get_credits(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Return AI credit balance and metadata for a business."""
    db = get_database()
    biz = await db.businesses.find_one(
        {"_id": ObjectId(business_id)},
        {"ai_credits": 1, "ai_credits_monthly_allowance": 1, "ai_credits_reset_date": 1, "ai_addon_active": 1},
    )
    if not biz:
        raise HTTPException(404, "Business not found")

    now = datetime.utcnow()
    credits = biz.get("ai_credits", 0)
    monthly = biz.get("ai_credits_monthly_allowance", 0)
    reset_date = biz.get("ai_credits_reset_date")
    addon = biz.get("ai_addon_active", False)

    # Auto-reset if due
    if reset_date and now >= reset_date:
        next_reset = datetime(now.year, now.month, 1) + timedelta(days=32)
        next_reset = datetime(next_reset.year, next_reset.month, 1)
        credits = monthly
        await db.businesses.update_one(
            {"_id": ObjectId(business_id)},
            {"$set": {
                "ai_credits": monthly,
                "ai_credits_reset_date": next_reset,
            }},
        )
        reset_date = next_reset

    return {
        "credits_remaining": credits,
        "monthly_allowance": monthly,
        "reset_date": reset_date.isoformat() if reset_date else None,
        "addon_active": addon,
    }


@router.post("/business/{business_id}/credits/purchase")
async def purchase_credits(
    business_id: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Purchase AI credits. Packages: 50 (£4.99), 150 (£9.99), 500 (£24.99).
    For now, credits are added directly (Stripe integration later)."""
    db = get_database()
    package = str(body.get("package", ""))

    if package not in CREDIT_PACKAGES:
        raise HTTPException(400, f"Invalid package. Choose from: {', '.join(CREDIT_PACKAGES.keys())}")

    pkg = CREDIT_PACKAGES[package]
    credits_to_add = pkg["credits"]

    result = await db.businesses.find_one_and_update(
        {"_id": ObjectId(business_id)},
        {"$inc": {"ai_credits": credits_to_add}},
        return_document=True,
        projection={"ai_credits": 1},
    )
    if not result:
        raise HTTPException(404, "Business not found")

    logger.info(
        "Credits purchased: business=%s package=%s credits=%d",
        business_id, package, credits_to_add,
    )
    return {
        "credits_added": credits_to_add,
        "new_balance": result.get("ai_credits", credits_to_add),
        "price": pkg["price"],
    }


# ─────────────────────────────────────────────────────
# DOMAINS
# ─────────────────────────────────────────────────────

@router.post("/business/{business_id}/domains", status_code=201)
async def add_domain(
    business_id: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Add a custom domain for the business website. Max 3 per business."""
    db = get_database()
    domain = body.get("domain", "").strip().lower()

    if not domain or not DOMAIN_PATTERN.match(domain):
        raise HTTPException(400, "Invalid domain format")

    # Enforce max 3 domains per business
    domain_count = await db.website_domains.count_documents({"business_id": business_id})
    if domain_count >= 3:
        raise HTTPException(400, "Maximum 3 custom domains allowed per business")

    # Check uniqueness
    existing = await db.website_domains.find_one(
        {"business_id": business_id, "domain": domain}
    )
    if existing:
        raise HTTPException(400, "Domain already added for this business")

    # Check domain not claimed by another business
    global_existing = await db.website_domains.find_one({"domain": domain})
    if global_existing:
        raise HTTPException(400, "This domain is already in use")

    SERVER_IP = os.getenv("SERVER_IP", "34.89.0.1")
    dns_records = [
        {"type": "A", "name": "@", "value": SERVER_IP},
        {"type": "CNAME", "name": "www", "value": "sites.reevenow.com"},
    ]

    now = datetime.utcnow()
    doc = {
        "business_id": business_id,
        "domain": domain,
        "status": "pending_dns",
        "dns_records_required": dns_records,
        "created_at": now,
        "updated_at": now,
        "created_by": tenant.user_id,
    }
    result = await db.website_domains.insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("Domain added: business=%s domain=%s", business_id, domain)
    return _doc(doc)


@router.get("/business/{business_id}/domains")
async def list_domains(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """List all custom domains for a business."""
    db = get_database()
    cursor = db.website_domains.find({"business_id": business_id}).sort("created_at", -1)
    domains = await cursor.to_list(50)
    return [_doc(d) for d in domains]


@router.post("/business/{business_id}/domains/{domain_id}/verify")
async def verify_domain(
    business_id: str,
    domain_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Verify DNS configuration for a custom domain (A record + CNAME)."""
    db = get_database()
    if not ObjectId.is_valid(domain_id):
        raise HTTPException(400, "Invalid domain ID")

    domain_doc = await db.website_domains.find_one(
        {"_id": ObjectId(domain_id), "business_id": business_id}
    )
    if not domain_doc:
        raise HTTPException(404, "Domain not found")

    domain = domain_doc["domain"]
    SERVER_IP = os.getenv("SERVER_IP", "34.89.0.1")
    checks = {"a_record": False, "cname_record": False}
    found_values = {"a_record": None, "cname_record": None}

    # Check A record via socket
    try:
        answers = socket.getaddrinfo(domain, None, socket.AF_INET)
        ips = list({a[4][0] for a in answers})
        found_values["a_record"] = ips
        if SERVER_IP in ips:
            checks["a_record"] = True
    except (socket.gaierror, OSError):
        pass

    # Check CNAME for www subdomain via dnspython if available
    try:
        import dns.resolver
        try:
            cname_answers = dns.resolver.resolve(f"www.{domain}", "CNAME")
            cnames = [str(r.target).rstrip(".") for r in cname_answers]
            found_values["cname_record"] = cnames
            if "sites.reevenow.com" in cnames:
                checks["cname_record"] = True
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers):
            pass
    except ImportError:
        # dnspython not installed — skip CNAME check, only require A record
        checks["cname_record"] = True

    all_passed = checks["a_record"] and checks["cname_record"]
    status = "dns_verified" if all_passed else "pending_dns"

    await db.website_domains.update_one(
        {"_id": ObjectId(domain_id)},
        {"$set": {"status": status, "updated_at": datetime.utcnow(), "last_check": checks}},
    )

    logger.info("Domain verify: business=%s domain=%s status=%s", business_id, domain, status)
    return {
        "verified": all_passed,
        "status": status,
        "checks": checks,
        "found": found_values,
        "expected": {"a_record": SERVER_IP, "cname_record": "sites.reevenow.com"},
    }


@router.delete("/business/{business_id}/domains/{domain_id}")
async def delete_domain(
    business_id: str,
    domain_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Delete a custom domain."""
    db = get_database()
    if not ObjectId.is_valid(domain_id):
        raise HTTPException(400, "Invalid domain ID")

    result = await db.website_domains.delete_one(
        {"_id": ObjectId(domain_id), "business_id": business_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Domain not found")
    logger.info("Domain deleted: business=%s domain_id=%s", business_id, domain_id)
    return {"detail": "Domain deleted"}


# ─────────────────────────────────────────────────────
# REDIRECTS
# ─────────────────────────────────────────────────────

@router.post("/business/{business_id}/redirects", status_code=201)
async def create_redirect(
    business_id: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Create a URL redirect rule."""
    db = get_database()
    from_path = body.get("from_path", "").strip()
    to_path = body.get("to_path", "").strip()
    redirect_type = body.get("type", "301")

    if not from_path or not from_path.startswith("/"):
        raise HTTPException(400, "from_path must start with /")
    if not to_path:
        raise HTTPException(400, "to_path is required")
    if redirect_type not in ("301", "302"):
        raise HTTPException(400, "type must be '301' or '302'")

    now = datetime.utcnow()
    doc = {
        "business_id": business_id,
        "from_path": from_path,
        "to_path": to_path,
        "type": redirect_type,
        "created_at": now,
        "created_by": tenant.user_id,
    }
    result = await db.website_redirects.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc(doc)


@router.get("/business/{business_id}/redirects")
async def list_redirects(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """List all redirect rules for a business."""
    db = get_database()
    cursor = db.website_redirects.find({"business_id": business_id}).sort("created_at", -1)
    redirects = await cursor.to_list(200)
    return [_doc(r) for r in redirects]


@router.delete("/business/{business_id}/redirects/{redirect_id}")
async def delete_redirect(
    business_id: str,
    redirect_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Delete a redirect rule."""
    db = get_database()
    if not ObjectId.is_valid(redirect_id):
        raise HTTPException(400, "Invalid redirect ID")

    result = await db.website_redirects.delete_one(
        {"_id": ObjectId(redirect_id), "business_id": business_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Redirect not found")
    return {"detail": "Redirect deleted"}


# ─────────────────────────────────────────────────────
# ANALYTICS
# ─────────────────────────────────────────────────────

@router.post("/public/track", status_code=204)
@limiter.limit("100/minute")
async def track_analytics(
    request: Request,
    body: dict,
):
    """Public: track page view and interaction events. Rate limited to 100/min.
    No auth required. Never stores IP addresses (GDPR). Returns 204 No Content."""
    db = get_database()

    business_id = body.get("business_id")
    page_slug = body.get("page_slug")
    session_id = body.get("session_id")
    events = body.get("events", [])

    if not session_id:
        raise HTTPException(400, "session_id is required")
    if not business_id:
        raise HTTPException(400, "business_id is required")

    # Validate events: max 100 per request, must be valid types
    VALID_EVENT_TYPES = {"pageview", "click", "scroll", "time_on_page"}
    events = events[:100]
    events = [e for e in events if isinstance(e, dict) and e.get("type") in VALID_EVENT_TYPES]

    # Verify business exists
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)}, {"_id": 1})
    if not biz:
        raise HTTPException(400, "Invalid business_id")

    # IP geolocation for country only, then DISCARD IP — never stored
    country = "unknown"
    try:
        client_ip = request.client.host if request.client else None
        if client_ip and client_ip not in ("127.0.0.1", "::1", "unknown"):
            import httpx
            resp = await httpx.AsyncClient().get(
                f"http://ip-api.com/json/{client_ip}?fields=country",
                timeout=2.0,
            )
            if resp.status_code == 200:
                country = resp.json().get("country", "unknown")
    except Exception:
        pass
    # IP is NOT stored — only country name

    now = datetime.utcnow()
    doc = {
        "business_id": business_id,
        "page_slug": page_slug,
        "session_id": session_id,
        "events": events,
        "referrer": body.get("referrer"),
        "utm_source": body.get("utm_source"),
        "utm_medium": body.get("utm_medium"),
        "utm_campaign": body.get("utm_campaign"),
        "device": body.get("device"),
        "country": country,
        "created_at": now,
    }
    await db.website_analytics.insert_one(doc)


@router.get("/business/{business_id}/analytics/overview")
async def analytics_overview(
    business_id: str,
    period: Optional[str] = Query("30d"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Aggregated analytics overview for a business website.
    Supports ?period=7d|30d|90d or explicit from_date/to_date.
    Returns data matching the frontend expected field names."""
    db = get_database()

    now = datetime.utcnow()
    try:
        if from_date:
            dt_from = datetime.fromisoformat(from_date)
            dt_to = datetime.fromisoformat(to_date) if to_date else now
        else:
            days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
            dt_from = now - timedelta(days=days)
            dt_to = now
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use ISO format (YYYY-MM-DD).")

    match_stage = {
        "business_id": business_id,
        "created_at": {"$gte": dt_from, "$lte": dt_to},
    }

    # Previous period for trend comparison
    period_days = (dt_to - dt_from).days or 1
    prev_from = dt_from - timedelta(days=period_days)
    prev_to = dt_from
    prev_match = {
        "business_id": business_id,
        "created_at": {"$gte": prev_from, "$lte": prev_to},
    }

    # Total pageviews (count pageview events)
    pipeline_pageviews = [
        {"$match": match_stage},
        {"$unwind": "$events"},
        {"$match": {"events.type": "pageview"}},
        {"$count": "total"},
    ]
    pv_result = await db.website_analytics.aggregate(pipeline_pageviews).to_list(1)
    total_views = pv_result[0]["total"] if pv_result else 0

    # Previous period pageviews for trend
    prev_pv = await db.website_analytics.aggregate([
        {"$match": prev_match}, {"$unwind": "$events"},
        {"$match": {"events.type": "pageview"}}, {"$count": "total"},
    ]).to_list(1)
    prev_views = prev_pv[0]["total"] if prev_pv else 0

    # Unique visitors (distinct session_ids)
    pipeline_visitors = [
        {"$match": match_stage},
        {"$group": {"_id": "$session_id"}},
        {"$count": "total"},
    ]
    uv_result = await db.website_analytics.aggregate(pipeline_visitors).to_list(1)
    unique_visitors = uv_result[0]["total"] if uv_result else 0

    prev_uv = await db.website_analytics.aggregate([
        {"$match": prev_match}, {"$group": {"_id": "$session_id"}}, {"$count": "total"},
    ]).to_list(1)
    prev_visitors = prev_uv[0]["total"] if prev_uv else 0

    # Bounce rate: sessions with only 1 pageview / total sessions
    pipeline_bounce = [
        {"$match": match_stage},
        {"$group": {
            "_id": "$session_id",
            "pv_count": {"$sum": {
                "$size": {"$filter": {"input": "$events", "cond": {"$eq": ["$$this.type", "pageview"]}}}
            }},
        }},
        {"$group": {
            "_id": None,
            "total_sessions": {"$sum": 1},
            "single_pv_sessions": {"$sum": {"$cond": [{"$lte": ["$pv_count", 1]}, 1, 0]}},
        }},
    ]
    bounce_result = await db.website_analytics.aggregate(pipeline_bounce).to_list(1)
    if bounce_result and bounce_result[0]["total_sessions"] > 0:
        bounce_rate = round((bounce_result[0]["single_pv_sessions"] / bounce_result[0]["total_sessions"]) * 100, 1)
    else:
        bounce_rate = 0

    prev_bounce = await db.website_analytics.aggregate([
        {"$match": prev_match},
        {"$group": {
            "_id": "$session_id",
            "pv_count": {"$sum": {
                "$size": {"$filter": {"input": "$events", "cond": {"$eq": ["$$this.type", "pageview"]}}}
            }},
        }},
        {"$group": {
            "_id": None,
            "total_sessions": {"$sum": 1},
            "single_pv_sessions": {"$sum": {"$cond": [{"$lte": ["$pv_count", 1]}, 1, 0]}},
        }},
    ]).to_list(1)
    prev_bounce_rate = round((prev_bounce[0]["single_pv_sessions"] / prev_bounce[0]["total_sessions"]) * 100, 1) if prev_bounce and prev_bounce[0]["total_sessions"] > 0 else 0

    # Average time on page from time_on_page events
    pipeline_time = [
        {"$match": match_stage},
        {"$unwind": "$events"},
        {"$match": {"events.type": "time_on_page", "events.seconds": {"$exists": True}}},
        {"$group": {"_id": None, "avg_time": {"$avg": "$events.seconds"}}},
    ]
    time_result = await db.website_analytics.aggregate(pipeline_time).to_list(1)
    avg_time_seconds = round(time_result[0]["avg_time"], 1) if time_result else 0

    prev_time = await db.website_analytics.aggregate([
        {"$match": prev_match}, {"$unwind": "$events"},
        {"$match": {"events.type": "time_on_page", "events.seconds": {"$exists": True}}},
        {"$group": {"_id": None, "avg_time": {"$avg": "$events.seconds"}}},
    ]).to_list(1)
    prev_avg_time = round(prev_time[0]["avg_time"], 1) if prev_time else 0

    # Trend % calculations
    def pct_change(current, previous):
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 1)

    # Daily visitors for bar chart
    pipeline_daily = [
        {"$match": match_stage},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "sessions": {"$addToSet": "$session_id"},
        }},
        {"$project": {"_id": 1, "count": {"$size": "$sessions"}}},
        {"$sort": {"_id": 1}},
    ]
    daily_raw = await db.website_analytics.aggregate(pipeline_daily).to_list(366)
    daily_visitors = [{"date": d["_id"], "count": d["count"]} for d in daily_raw]

    # Top pages with title lookup
    pipeline_pages = [
        {"$match": match_stage},
        {"$unwind": "$events"},
        {"$match": {"events.type": "pageview"}},
        {"$group": {"_id": "$page_slug", "views": {"$sum": 1}}},
        {"$sort": {"views": -1}},
        {"$limit": 10},
    ]
    top_pages_raw = await db.website_analytics.aggregate(pipeline_pages).to_list(10)
    # Look up page titles
    top_page_slugs = [p["_id"] for p in top_pages_raw if p["_id"]]
    page_titles = {}
    if top_page_slugs:
        pages_cursor = db.website_pages.find(
            {"business_id": business_id, "slug": {"$in": top_page_slugs}},
            {"slug": 1, "title": 1},
        )
        async for pg in pages_cursor:
            page_titles[pg["slug"]] = pg.get("title", "")
    top_pages = [
        {"slug": p["_id"] or "/", "title": page_titles.get(p["_id"], p["_id"] or "Home"), "views": p["views"]}
        for p in top_pages_raw
    ]

    # Device breakdown as object {desktop, tablet, mobile}
    pipeline_devices = [
        {"$match": {**match_stage, "device": {"$ne": None}}},
        {"$group": {"_id": "$device", "count": {"$sum": 1}}},
    ]
    device_raw = await db.website_analytics.aggregate(pipeline_devices).to_list(10)
    devices = {"desktop": 0, "tablet": 0, "mobile": 0}
    for d in device_raw:
        if d["_id"] in devices:
            devices[d["_id"]] = d["count"]

    # Referrer breakdown (extract domain, format as {source, count})
    pipeline_referrers = [
        {"$match": {**match_stage, "referrer": {"$nin": [None, ""]}}},
        {"$group": {"_id": "$referrer", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    ref_raw = await db.website_analytics.aggregate(pipeline_referrers).to_list(10)
    referrers = [{"source": r["_id"] or "Direct", "count": r["count"]} for r in ref_raw]

    return {
        "from_date": dt_from.isoformat(),
        "to_date": dt_to.isoformat(),
        "total_views": total_views,
        "unique_visitors": unique_visitors,
        "bounce_rate": bounce_rate,
        "avg_time_seconds": avg_time_seconds,
        "views_change": pct_change(total_views, prev_views),
        "visitors_change": pct_change(unique_visitors, prev_visitors),
        "bounce_change": pct_change(bounce_rate, prev_bounce_rate),
        "time_change": pct_change(avg_time_seconds, prev_avg_time),
        "daily_visitors": daily_visitors,
        "top_pages": top_pages,
        "devices": devices,
        "referrers": referrers,
    }


@router.get("/business/{business_id}/analytics/page/{slug}")
async def analytics_page(
    business_id: str,
    slug: str,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Per-page analytics: views, unique visitors, avg time, scroll depth,
    entry rate, exit rate, bounce rate."""
    db = get_database()

    now = datetime.utcnow()
    try:
        dt_from = datetime.fromisoformat(from_date) if from_date else now - timedelta(days=30)
        dt_to = datetime.fromisoformat(to_date) if to_date else now
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use ISO format (YYYY-MM-DD).")

    match_stage = {
        "business_id": business_id,
        "page_slug": slug,
        "created_at": {"$gte": dt_from, "$lte": dt_to},
    }
    biz_match = {
        "business_id": business_id,
        "created_at": {"$gte": dt_from, "$lte": dt_to},
    }

    # Total pageview events for this page
    pipeline_views = [
        {"$match": match_stage},
        {"$unwind": "$events"},
        {"$match": {"events.type": "pageview"}},
        {"$count": "total"},
    ]
    pv_result = await db.website_analytics.aggregate(pipeline_views).to_list(1)
    views = pv_result[0]["total"] if pv_result else 0

    # Unique visitors
    pipeline_unique = [
        {"$match": match_stage},
        {"$group": {"_id": "$session_id"}},
        {"$count": "total"},
    ]
    uv_result = await db.website_analytics.aggregate(pipeline_unique).to_list(1)
    unique_visitors = uv_result[0]["total"] if uv_result else 0

    # Average time on page
    pipeline_time = [
        {"$match": match_stage},
        {"$unwind": "$events"},
        {"$match": {"events.type": "time_on_page", "events.seconds": {"$exists": True}}},
        {"$group": {"_id": None, "avg_time": {"$avg": "$events.seconds"}}},
    ]
    time_result = await db.website_analytics.aggregate(pipeline_time).to_list(1)
    avg_time = round(time_result[0]["avg_time"], 1) if time_result else 0

    # Scroll depth: % of sessions reaching each threshold (25/50/75/100)
    pipeline_scroll = [
        {"$match": match_stage},
        {"$unwind": "$events"},
        {"$match": {"events.type": "scroll", "events.scroll_depth": {"$exists": True}}},
        {"$group": {
            "_id": "$session_id",
            "max_depth": {"$max": "$events.scroll_depth"},
        }},
    ]
    scroll_sessions = await db.website_analytics.aggregate(pipeline_scroll).to_list(100000)
    total_scroll_sessions = max(unique_visitors, 1)
    scroll_depth = {}
    for threshold in [25, 50, 75, 100]:
        reached = sum(1 for s in scroll_sessions if s["max_depth"] >= threshold)
        scroll_depth[threshold] = round((reached / total_scroll_sessions) * 100, 1)

    # Bounce rate for this page
    pipeline_bounce = [
        {"$match": match_stage},
        {"$group": {
            "_id": "$session_id",
            "pv_count": {"$sum": {
                "$size": {"$filter": {"input": "$events", "cond": {"$eq": ["$$this.type", "pageview"]}}}
            }},
        }},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "bounces": {"$sum": {"$cond": [{"$lte": ["$pv_count", 1]}, 1, 0]}},
        }},
    ]
    bounce_result = await db.website_analytics.aggregate(pipeline_bounce).to_list(1)
    bounce_rate = round((bounce_result[0]["bounces"] / bounce_result[0]["total"]) * 100, 1) if bounce_result and bounce_result[0]["total"] > 0 else 0

    # Entry rate: % of sessions where this was the first page visited
    pipeline_entry = [
        {"$match": biz_match},
        {"$sort": {"created_at": 1}},
        {"$group": {"_id": "$session_id", "first_page": {"$first": "$page_slug"}}},
        {"$group": {
            "_id": None,
            "total_sessions": {"$sum": 1},
            "entries": {"$sum": {"$cond": [{"$eq": ["$first_page", slug]}, 1, 0]}},
        }},
    ]
    entry_result = await db.website_analytics.aggregate(pipeline_entry).to_list(1)
    entry_rate = round((entry_result[0]["entries"] / entry_result[0]["total_sessions"]) * 100, 1) if entry_result and entry_result[0]["total_sessions"] > 0 else 0

    # Exit rate: % of sessions where this was the last page visited
    pipeline_exit = [
        {"$match": biz_match},
        {"$sort": {"created_at": -1}},
        {"$group": {"_id": "$session_id", "last_page": {"$first": "$page_slug"}}},
        {"$group": {
            "_id": None,
            "total_sessions": {"$sum": 1},
            "exits": {"$sum": {"$cond": [{"$eq": ["$last_page", slug]}, 1, 0]}},
        }},
    ]
    exit_result = await db.website_analytics.aggregate(pipeline_exit).to_list(1)
    exit_rate = round((exit_result[0]["exits"] / exit_result[0]["total_sessions"]) * 100, 1) if exit_result and exit_result[0]["total_sessions"] > 0 else 0

    return {
        "page_slug": slug,
        "from_date": dt_from.isoformat(),
        "to_date": dt_to.isoformat(),
        "views": views,
        "unique_visitors": unique_visitors,
        "avg_time": avg_time,
        "bounce_rate": bounce_rate,
        "scroll_depth": scroll_depth,
        "entry_rate": entry_rate,
        "exit_rate": exit_rate,
    }


@router.get("/business/{business_id}/analytics/page/{slug}/heatmap")
async def analytics_heatmap(
    business_id: str,
    slug: str,
    device: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Heatmap data: aggregate click events into 50x50 grid zones.
    Normalises x/y to percentage of viewport (0-100).
    Optional device filter: desktop, tablet, mobile."""
    db = get_database()

    now = datetime.utcnow()
    try:
        dt_from = datetime.fromisoformat(from_date) if from_date else now - timedelta(days=30)
        dt_to = datetime.fromisoformat(to_date) if to_date else now
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use ISO format (YYYY-MM-DD).")

    match_stage = {
        "business_id": business_id,
        "page_slug": slug,
        "created_at": {"$gte": dt_from, "$lte": dt_to},
    }
    if device and device in ("desktop", "tablet", "mobile"):
        match_stage["device"] = device

    # Get average viewport dimensions for this device/page
    pipeline_viewport = [
        {"$match": match_stage},
        {"$unwind": "$events"},
        {"$match": {"events.type": "pageview", "events.viewport_width": {"$gt": 0}}},
        {"$group": {
            "_id": None,
            "avg_w": {"$avg": "$events.viewport_width"},
            "avg_h": {"$avg": "$events.viewport_height"},
        }},
    ]
    vp_result = await db.website_analytics.aggregate(pipeline_viewport).to_list(1)
    viewport_width_avg = round(vp_result[0]["avg_w"]) if vp_result else 1440
    viewport_height_avg = round(vp_result[0]["avg_h"]) if vp_result else 900

    # Aggregate click events into 50x50 grid, normalised to % of viewport
    # Grid: divide page into 50 columns x 50 rows based on viewport percentage
    grid_size = 50
    pipeline = [
        {"$match": match_stage},
        {"$unwind": "$events"},
        {"$match": {"events.type": "click", "events.x": {"$exists": True}, "events.y": {"$exists": True}}},
        {"$project": {
            # Normalise x to percentage (0-100), then bucket into grid
            "grid_x": {"$min": [
                {"$floor": {"$multiply": [{"$divide": [{"$max": ["$events.x", 0]}, viewport_width_avg]}, grid_size]}},
                grid_size - 1,
            ]},
            "grid_y": {"$min": [
                {"$floor": {"$multiply": [{"$divide": [{"$max": ["$events.y", 0]}, viewport_height_avg]}, grid_size]}},
                grid_size - 1,
            ]},
        }},
        {"$group": {
            "_id": {"x": "$grid_x", "y": "$grid_y"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 500},
    ]
    results = await db.website_analytics.aggregate(pipeline).to_list(500)
    total_clicks = sum(r["count"] for r in results)

    zones = []
    for r in results:
        percentage = round((r["count"] / total_clicks) * 100, 2) if total_clicks > 0 else 0
        zones.append({
            "grid_x": int(r["_id"]["x"]),
            "grid_y": int(r["_id"]["y"]),
            "count": r["count"],
            "percentage": percentage,
        })

    return {
        "page_slug": slug,
        "grid_size": grid_size,
        "total_clicks": total_clicks,
        "viewport_width_avg": viewport_width_avg,
        "viewport_height_avg": viewport_height_avg,
        "zones": zones,
    }


# ─────────────────────────────────────────────────────
# MAINTENANCE MODE
# ─────────────────────────────────────────────────────

@router.post("/business/{business_id}/maintenance/enable")
async def enable_maintenance(
    business_id: str,
    body: dict,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Enable maintenance mode for the business website."""
    db = get_database()

    # Ensure settings exist
    existing = await db.website_settings.find_one({"business_id": business_id})
    if not existing:
        settings = _default_settings(business_id)
        await db.website_settings.insert_one(settings)

    update = {
        "maintenance_mode.enabled": True,
        "updated_at": datetime.utcnow(),
    }
    if "message" in body:
        update["maintenance_mode.message"] = body["message"]
    if "password_bypass" in body:
        update["maintenance_mode.password_bypass"] = body["password_bypass"]
    if "scheduled_end" in body:
        update["maintenance_mode.scheduled_end"] = body["scheduled_end"]

    result = await db.website_settings.find_one_and_update(
        {"business_id": business_id},
        {"$set": update},
        return_document=True,
    )
    logger.info("Maintenance enabled: business=%s", business_id)
    return _doc(result)


@router.post("/business/{business_id}/maintenance/disable")
async def disable_maintenance(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Disable maintenance mode for the business website."""
    db = get_database()

    result = await db.website_settings.find_one_and_update(
        {"business_id": business_id},
        {"$set": {"maintenance_mode.enabled": False, "updated_at": datetime.utcnow()}},
        return_document=True,
    )
    if not result:
        raise HTTPException(404, "Settings not found")
    logger.info("Maintenance disabled: business=%s", business_id)
    return _doc(result)


# ─────────────────────────────────────────────────────
# TEMPLATE SEED (Admin only)
# ─────────────────────────────────────────────────────

def _make_page(slug, title, meta, components):
    """Helper to build a Puck page definition for a template."""
    return {
        "slug": slug,
        "title": title,
        "meta_description": meta,
        "og_image": None,
        "puck_data": {"content": components, "root": {"props": {}}},
    }


def _hero(headline, subtitle, cta="Book Now", bg="#111111", text="#FFFFFF", accent="#C9A84C"):
    return {"type": "HeroSection", "props": {
        "headline": headline, "subtitle": subtitle, "ctaText": cta,
        "backgroundColor": bg, "textColor": text, "accentColor": accent,
        "overlayOpacity": 0.4, "minHeight": "500px",
    }}


def _heading(text, level="H2"):
    return {"type": "Heading", "props": {"text": text, "level": level}}


def _text(text):
    return {"type": "TextBlock", "props": {"text": text}}


def _section(children, bg="#FFFFFF", py="lg"):
    return {"type": "Section", "props": {"paddingY": py, "backgroundColor": bg}, "content": children}


def _cols(n, children):
    return {"type": "Columns", "props": {"columns": n}, "content": children}


def _service(name, price, desc):
    return {"type": "ServiceCard", "props": {"name": name, "price": price, "description": desc}}


def _testimonial(quote, author, role="Client"):
    return {"type": "Testimonial", "props": {"quote": quote, "author": author, "role": role}}


def _team(name, role, bio=""):
    return {"type": "TeamMember", "props": {"name": name, "role": role, "bio": bio}}


def _hours(items):
    return {"type": "OpeningHours", "props": {"items": items}}


def _contact():
    return {"type": "ContactForm", "props": {"heading": "Get In Touch", "submitText": "Send Message"}}


def _faq(items):
    return {"type": "FAQAccordion", "props": {"items": items}}


def _cta(heading, text, btn="Book Now"):
    return {"type": "ButtonBlock", "props": {"heading": heading, "text": text, "buttonText": btn}}


def _spacer(size="md"):
    return {"type": "Spacer", "props": {"size": size}}


def _make_template(name, industry, desc, brand, pages):
    """Build a full template document."""
    return {
        "name": name,
        "industry": industry,
        "description": desc,
        "preview_image": None,
        "page_count": len(pages),
        "pages": pages,
        "default_brand": brand,
        "created_at": datetime.utcnow(),
    }


def _generate_all_templates():
    """Generate 27 templates (3 per industry x 9 industries)."""
    templates = []

    # ── AESTHETICS ──
    aesth_services = [
        _service("Microneedling", "From £120", "Advanced collagen induction therapy for skin rejuvenation"),
        _service("Chemical Peel", "From £85", "Professional-grade exfoliation for radiant, even-toned skin"),
        _service("Dermal Fillers", "From £250", "Natural-looking volume restoration and contouring"),
        _service("Anti-Wrinkle Injections", "From £200", "Smooth fine lines and prevent new ones forming"),
        _service("LED Therapy", "From £65", "Light-based treatment to target acne, ageing, and inflammation"),
        _service("HydraFacial", "From £95", "Deep cleansing, hydrating facial with instant glow results"),
    ]
    aesth_testimonials = [
        _testimonial("The results are incredible. My skin has never looked better.", "Sarah M."),
        _testimonial("Professional, knowledgeable, and the clinic is beautiful.", "Emma T."),
        _testimonial("I feel so much more confident after my treatments here.", "Claire D."),
    ]
    aesth_faq = [
        {"q": "Is microneedling painful?", "a": "Most clients describe it as mild tingling. We use topical numbing cream for comfort."},
        {"q": "How long do fillers last?", "a": "Results typically last 6-18 months depending on the area treated and product used."},
        {"q": "What is the downtime?", "a": "Most treatments have minimal downtime. We'll discuss this during your consultation."},
    ]
    aesth_hours = [
        {"day": "Monday - Friday", "hours": "9:00 AM - 7:00 PM"},
        {"day": "Saturday", "hours": "9:00 AM - 5:00 PM"},
        {"day": "Sunday", "hours": "Closed"},
    ]

    # 1. Clean Minimal
    templates.append(_make_template(
        "Clean Minimal", "aesthetics",
        "Cream background, lots of whitespace, serif headings, muted tones",
        {"primary_color": "#F5F0E8", "secondary_color": "#2C2C2C", "accent_color": "#C4A882"},
        [
            _make_page("home", "Home", "Premium aesthetic treatments", [
                _hero("Elevate Your Natural Beauty", "Bespoke aesthetic treatments in a tranquil setting", "Book Consultation", "#F5F0E8", "#2C2C2C", "#C4A882"),
                _section([_heading("Our Treatments"), _spacer(), _cols(3, aesth_services[:3])], "#FFFFFF"),
                _section(aesth_testimonials + [_spacer()], "#F9F7F3"),
                _cta("Ready to Begin?", "Book your complimentary consultation today", "Book Now"),
            ]),
            _make_page("about", "About", "Our story and team", [
                _hero("Our Story", "Where science meets artistry", "Meet The Team", "#F5F0E8", "#2C2C2C"),
                _section([_text("Founded with a passion for natural-looking results, our clinic combines medical expertise with an artistic eye. Every treatment is tailored to enhance your unique features.")]),
                _section([_heading("Our Team"), _cols(2, [_team("Dr. Sarah Williams", "Medical Director", "15 years in aesthetic medicine"), _team("Emily Chen", "Senior Aesthetician", "Specialist in advanced skincare")])], "#F9F7F3"),
            ]),
            _make_page("services", "Treatments", "Browse our treatments", [
                _hero("Our Treatments", "Expert care for every concern", bg="#F5F0E8", text="#2C2C2C"),
                _section([_cols(3, aesth_services)]),
                _section([_faq(aesth_faq)], "#F9F7F3"),
            ]),
            _make_page("contact", "Contact", "Get in touch", [
                _hero("Get In Touch", "We'd love to hear from you", bg="#F5F0E8", text="#2C2C2C"),
                _section([_cols(2, [_contact(), _hours(aesth_hours)])]),
            ]),
            _make_page("gallery", "Results", "Before and after gallery", [
                _hero("Our Results", "See the transformations", bg="#F5F0E8", text="#2C2C2C"),
                _section([_text("Browse our gallery of real client results. All photos shared with consent.")]),
            ]),
        ],
    ))

    # 2. Luxury Premium
    templates.append(_make_template(
        "Luxury Premium", "aesthetics",
        "Dark backgrounds, gold accents, editorial layout",
        {"primary_color": "#1A1A1A", "secondary_color": "#F5F0E8", "accent_color": "#D4AF37"},
        [
            _make_page("home", "Home", "Luxury aesthetic clinic", [
                _hero("The Art of Aesthetics", "Exceptional results in an exclusive setting", "Reserve Your Consultation", "#1A1A1A", "#F5F0E8", "#D4AF37"),
                _section([_heading("Signature Treatments"), _cols(3, aesth_services[:3])], "#111111"),
                _section(aesth_testimonials, "#1A1A1A"),
                _cta("Experience Excellence", "Your transformation begins here", "Book Private Consultation"),
            ]),
            _make_page("about", "About", "Our philosophy", [
                _hero("Our Philosophy", "Precision. Artistry. Confidence.", bg="#1A1A1A", text="#F5F0E8"),
                _section([_text("We believe in enhancing natural beauty through meticulous technique and the finest products available.")], "#111111"),
                _section([_heading("The Team"), _cols(2, [_team("Dr. James Chen", "Founder & Lead Practitioner"), _team("Victoria Hart", "Clinic Director")])], "#1A1A1A"),
            ]),
            _make_page("services", "Treatments", "Our treatments", [
                _hero("Our Treatments", "Curated for exceptional results", bg="#1A1A1A", text="#F5F0E8"),
                _section([_cols(2, aesth_services)], "#111111"),
            ]),
            _make_page("contact", "Contact", "Book with us", [
                _hero("Contact", "Begin your journey", bg="#1A1A1A", text="#F5F0E8"),
                _section([_cols(2, [_contact(), _hours(aesth_hours)])], "#111111"),
            ]),
            _make_page("gallery", "Gallery", "Results gallery", [
                _hero("Results Gallery", "Real results, real confidence", bg="#1A1A1A", text="#F5F0E8"),
                _section([_text("Our curated gallery showcases the transformative results our clients achieve.")], "#111111"),
            ]),
        ],
    ))

    # 3. Warm Natural
    templates.append(_make_template(
        "Warm Natural", "aesthetics",
        "Earthy tones, soft greens, organic feel",
        {"primary_color": "#4A6741", "secondary_color": "#FAF7F2", "accent_color": "#C4A882"},
        [
            _make_page("home", "Home", "Natural aesthetic treatments", [
                _hero("Beauty, Naturally", "Holistic aesthetic care rooted in science", "Discover More", "#4A6741", "#FAF7F2", "#C4A882"),
                _section([_heading("Treatments"), _cols(3, aesth_services[:3])], "#FAF7F2"),
                _section(aesth_testimonials, "#F0EDE6"),
                _cta("Start Your Journey", "Consultations tailored to you", "Book Today"),
            ]),
            _make_page("about", "About", "About us", [
                _hero("Our Approach", "Where nature meets innovation", bg="#4A6741", text="#FAF7F2"),
                _section([_text("We take a holistic approach to aesthetics, working with your skin's natural biology to achieve lasting, beautiful results.")]),
            ]),
            _make_page("services", "Treatments", "All treatments", [
                _hero("Our Treatments", "Gentle, effective, natural-looking", bg="#4A6741", text="#FAF7F2"),
                _section([_cols(3, aesth_services)], "#FAF7F2"),
            ]),
            _make_page("contact", "Contact", "Contact us", [
                _hero("Contact Us", "We're here to help", bg="#4A6741", text="#FAF7F2"),
                _section([_cols(2, [_contact(), _hours(aesth_hours)])]),
            ]),
            _make_page("gallery", "Gallery", "Results", [
                _hero("Our Results", "Natural transformations", bg="#4A6741", text="#FAF7F2"),
                _section([_text("See how our gentle approach delivers stunning, natural-looking results.")]),
            ]),
        ],
    ))

    # ── RESTAURANT ──
    rest_services = [
        _service("Tasting Menu", "£75pp", "Seven courses of seasonal British dishes"),
        _service("Sunday Roast", "From £18", "Slow-roasted meats with all the trimmings"),
        _service("Private Dining", "From £500", "Exclusive hire for up to 16 guests"),
    ]
    rest_testimonials = [
        _testimonial("The tasting menu was phenomenal. Every course was a work of art.", "James R."),
        _testimonial("Our favourite local restaurant. The Sunday roast is legendary.", "Kate & Tom"),
    ]
    rest_hours = [
        {"day": "Tuesday - Thursday", "hours": "12:00 PM - 9:30 PM"},
        {"day": "Friday - Saturday", "hours": "12:00 PM - 10:30 PM"},
        {"day": "Sunday", "hours": "12:00 PM - 6:00 PM"},
        {"day": "Monday", "hours": "Closed"},
    ]

    # 4. Modern Bistro
    templates.append(_make_template(
        "Modern Bistro", "restaurant",
        "Clean, food photography focused",
        {"primary_color": "#2C3E2D", "secondary_color": "#FAF8F5", "accent_color": "#D4A853"},
        [
            _make_page("home", "Home", "Modern British bistro", [
                _hero("Seasonal. Local. Honest.", "Modern British cooking in the heart of the city", "Reserve a Table", "#2C3E2D", "#FAF8F5", "#D4A853"),
                _section([_heading("This Week's Specials"), _cols(3, rest_services)], "#FAF8F5"),
                _section(rest_testimonials, "#F5F2ED"),
                _cta("Join Us", "Reserve your table today", "Book a Table"),
            ]),
            _make_page("menu", "Menu", "Our menu", [
                _hero("Our Menu", "Seasonal ingredients, bold flavours", bg="#2C3E2D", text="#FAF8F5"),
                _section([_text("Our menu changes with the seasons. Visit us to discover what's fresh this week.")]),
            ]),
            _make_page("about", "About", "Our story", [
                _hero("Our Story", "Farm to fork since 2018", bg="#2C3E2D", text="#FAF8F5"),
                _section([_text("What started as a pop-up has grown into one of the city's most beloved dining destinations.")]),
                _section([_heading("The Team"), _cols(2, [_team("Chef Marcus Cole", "Head Chef"), _team("Sarah Cole", "Front of House")])], "#F5F2ED"),
            ]),
            _make_page("gallery", "Gallery", "Our space", [
                _hero("Gallery", "A taste of what awaits", bg="#2C3E2D", text="#FAF8F5"),
                _section([_text("Browse photos of our dishes, interior, and events.")]),
            ]),
            _make_page("contact", "Contact", "Find us", [
                _hero("Find Us", "We'd love to see you", bg="#2C3E2D", text="#FAF8F5"),
                _section([_cols(2, [_contact(), _hours(rest_hours)])]),
            ]),
        ],
    ))

    # 5. Traditional Restaurant
    templates.append(_make_template(
        "Traditional", "restaurant",
        "Warm wood tones, classic feel",
        {"primary_color": "#5C3D2E", "secondary_color": "#FFF8F0", "accent_color": "#C9884C"},
        [
            _make_page("home", "Home", "Traditional dining", [
                _hero("A Warm Welcome Awaits", "Classic British dining with a modern twist", "Book Your Table", "#5C3D2E", "#FFF8F0", "#C9884C"),
                _section([_heading("Highlights"), _cols(3, rest_services)], "#FFF8F0"),
                _section(rest_testimonials, "#F5EDE3"),
            ]),
            _make_page("menu", "Menu", "Our menu", [
                _hero("The Menu", "Hearty classics, done properly", bg="#5C3D2E", text="#FFF8F0"),
                _section([_text("From our famous pies to seasonal specials, there's something for everyone.")]),
            ]),
            _make_page("about", "About", "About us", [
                _hero("About Us", "A family affair since 1995", bg="#5C3D2E", text="#FFF8F0"),
                _section([_text("Three generations of the Mitchell family have served this community with pride.")]),
            ]),
            _make_page("gallery", "Gallery", "Gallery", [
                _hero("Gallery", "Moments from our kitchen", bg="#5C3D2E", text="#FFF8F0"),
            ]),
            _make_page("contact", "Contact", "Contact", [
                _hero("Contact", "Drop in or get in touch", bg="#5C3D2E", text="#FFF8F0"),
                _section([_cols(2, [_contact(), _hours(rest_hours)])]),
            ]),
        ],
    ))

    # 6. Fast Casual
    templates.append(_make_template(
        "Fast Casual", "restaurant",
        "Bold colours, energetic, order-focused",
        {"primary_color": "#FF5733", "secondary_color": "#1A1A1A", "accent_color": "#FFD700"},
        [
            _make_page("home", "Home", "Fast casual dining", [
                _hero("Fresh. Fast. Flavourful.", "Made-to-order meals with the finest ingredients", "Order Now", "#1A1A1A", "#FFFFFF", "#FF5733"),
                _section([_heading("The Menu"), _cols(3, rest_services)], "#FFFFFF"),
                _cta("Hungry?", "Order for collection or delivery", "Order Now"),
            ]),
            _make_page("menu", "Menu", "Menu", [
                _hero("The Menu", "Bold flavours, fresh ingredients", bg="#1A1A1A", text="#FFFFFF"),
                _section([_text("Everything made fresh daily. Customise your order just how you like it.")]),
            ]),
            _make_page("about", "About", "About", [
                _hero("Our Story", "Born from a love of real food", bg="#1A1A1A", text="#FFFFFF"),
                _section([_text("We started with one simple idea: fast food doesn't have to be junk food.")]),
            ]),
            _make_page("gallery", "Gallery", "Gallery", [
                _hero("Gallery", "See what's cooking", bg="#1A1A1A", text="#FFFFFF"),
            ]),
            _make_page("contact", "Contact", "Contact", [
                _hero("Find Us", "Multiple locations across the city", bg="#1A1A1A", text="#FFFFFF"),
                _section([_cols(2, [_contact(), _hours(rest_hours)])]),
            ]),
        ],
    ))

    # ── BARBER ──
    barber_services = [
        _service("Classic Cut", "£25", "Traditional scissor or clipper cut with hot towel finish"),
        _service("Beard Trim", "£15", "Shape and tidy your beard to perfection"),
        _service("Cut & Beard", "£35", "The full package — haircut plus beard grooming"),
        _service("Hot Towel Shave", "£20", "Old-school straight razor shave with premium products"),
    ]
    barber_testimonials = [
        _testimonial("Best barber in town. Always leave looking and feeling sharp.", "Dan K."),
        _testimonial("The hot towel shave is an experience every man should have.", "Mike J."),
    ]
    barber_hours = [
        {"day": "Tuesday - Friday", "hours": "9:00 AM - 7:00 PM"},
        {"day": "Saturday", "hours": "8:00 AM - 5:00 PM"},
        {"day": "Sunday - Monday", "hours": "Closed"},
    ]

    # 7. Urban Edge
    templates.append(_make_template(
        "Urban Edge", "barber",
        "Dark, bold, masculine",
        {"primary_color": "#1A1A1A", "secondary_color": "#E5E5E5", "accent_color": "#FF4444"},
        [
            _make_page("home", "Home", "Urban barbershop", [
                _hero("Sharp Cuts. Clean Lines.", "The modern barbershop experience", "Book Now", "#1A1A1A", "#FFFFFF", "#FF4444"),
                _section([_heading("Services"), _cols(2, barber_services)], "#111111"),
                _section(barber_testimonials, "#1A1A1A"),
                _cta("Get Booked In", "Walk-ins welcome. Appointments guaranteed.", "Book Your Slot"),
            ]),
            _make_page("about", "About", "About us", [
                _hero("The Shop", "Est. 2019. No nonsense.", bg="#1A1A1A", text="#FFFFFF"),
                _section([_text("We built this shop for men who want a proper cut, a cold beer, and zero fuss.")], "#111111"),
            ]),
            _make_page("services", "Services", "What we do", [
                _hero("What We Do", "Every cut is a craft", bg="#1A1A1A", text="#FFFFFF"),
                _section([_cols(2, barber_services)], "#111111"),
            ]),
            _make_page("gallery", "Gallery", "Our work", [
                _hero("Our Work", "Fresh cuts from the chair", bg="#1A1A1A", text="#FFFFFF"),
            ]),
            _make_page("contact", "Contact", "Find us", [
                _hero("Find Us", "Walk-ins and bookings welcome", bg="#1A1A1A", text="#FFFFFF"),
                _section([_cols(2, [_contact(), _hours(barber_hours)])], "#111111"),
            ]),
        ],
    ))

    # 8. Classic Gentleman
    templates.append(_make_template(
        "Classic Gentleman", "barber",
        "Traditional, warm wood tones",
        {"primary_color": "#3C2415", "secondary_color": "#FAF5EF", "accent_color": "#C9884C"},
        [
            _make_page("home", "Home", "Classic barbershop", [
                _hero("The Gentleman's Barber", "Traditional grooming, timeless style", "Book Appointment", "#3C2415", "#FAF5EF", "#C9884C"),
                _section([_heading("Our Services"), _cols(2, barber_services)], "#FAF5EF"),
                _section(barber_testimonials, "#F5EDE3"),
            ]),
            _make_page("about", "About", "About", [_hero("Our Heritage", "Three generations of master barbers", bg="#3C2415", text="#FAF5EF"), _section([_text("Since 1962, the Thompson family has been keeping gentlemen looking their finest.")])]),
            _make_page("services", "Services", "Services", [_hero("Services", "The art of grooming", bg="#3C2415", text="#FAF5EF"), _section([_cols(2, barber_services)])]),
            _make_page("gallery", "Gallery", "Gallery", [_hero("Gallery", "The shop & the craft", bg="#3C2415", text="#FAF5EF")]),
            _make_page("contact", "Contact", "Contact", [_hero("Visit Us", "Step in for a trim", bg="#3C2415", text="#FAF5EF"), _section([_cols(2, [_contact(), _hours(barber_hours)])])]),
        ],
    ))

    # 9. Modern Clean Barber
    templates.append(_make_template(
        "Modern Clean", "barber",
        "Minimal, light",
        {"primary_color": "#FFFFFF", "secondary_color": "#111111", "accent_color": "#2563EB"},
        [
            _make_page("home", "Home", "Modern barbershop", [
                _hero("Precision Cuts", "Modern barbering for the modern man", "Book Now", "#FFFFFF", "#111111", "#2563EB"),
                _section([_heading("Services"), _cols(2, barber_services)]),
                _cta("Book Your Cut", "Online booking, zero hassle", "Book Now"),
            ]),
            _make_page("about", "About", "About", [_hero("About", "Clean. Precise. Consistent.", bg="#FFFFFF", text="#111111"), _section([_text("We believe in clean spaces, sharp skills, and a perfect cut every time.")])]),
            _make_page("services", "Services", "Services", [_hero("Services & Pricing", "Transparent pricing, premium quality", bg="#FFFFFF", text="#111111"), _section([_cols(2, barber_services)])]),
            _make_page("gallery", "Gallery", "Gallery", [_hero("Gallery", "Our work speaks for itself", bg="#FFFFFF", text="#111111")]),
            _make_page("contact", "Contact", "Contact", [_hero("Contact", "Book online or walk in", bg="#FFFFFF", text="#111111"), _section([_cols(2, [_contact(), _hours(barber_hours)])])]),
        ],
    ))

    # ── HAIR SALON ──
    salon_services = [
        _service("Cut & Blow Dry", "From £45", "Precision cut with a beautiful finish"),
        _service("Full Colour", "From £95", "Root to tip colour transformation"),
        _service("Balayage", "From £150", "Hand-painted highlights for a natural, sun-kissed look"),
        _service("Keratin Treatment", "From £180", "Smoothing treatment for frizz-free, glossy hair"),
    ]
    salon_hours = [{"day": "Tuesday - Saturday", "hours": "9:00 AM - 6:00 PM"}, {"day": "Thursday", "hours": "9:00 AM - 8:00 PM (late night)"}, {"day": "Sunday - Monday", "hours": "Closed"}]

    # 10-12. Hair Salon templates
    for name, desc, brand in [
        ("Chic", "Fashion-forward, editorial", {"primary_color": "#1A1A1A", "secondary_color": "#F5F5F5", "accent_color": "#E91E63"}),
        ("Friendly", "Warm, welcoming, community", {"primary_color": "#E8B4B8", "secondary_color": "#FFF5F5", "accent_color": "#8B4513"}),
        ("Luxury Salon", "Premium, gold accents", {"primary_color": "#2C2C2C", "secondary_color": "#FBF7F0", "accent_color": "#D4AF37"}),
    ]:
        templates.append(_make_template(name, "salon", desc, brand, [
            _make_page("home", "Home", f"{name} hair salon", [
                _hero("Your Hair, Perfected", "Expert styling in a beautiful setting", "Book Now", brand["primary_color"], "#FFFFFF", brand["accent_color"]),
                _section([_heading("Our Services"), _cols(2, salon_services)]),
                _cta("Book Your Appointment", "New clients welcome", "Book Now"),
            ]),
            _make_page("about", "About", "About our salon", [_hero("About Us", "Where passion meets expertise", bg=brand["primary_color"], text="#FFFFFF"), _section([_text("Our team of expert stylists brings years of experience and a passion for creating beautiful hair.")])]),
            _make_page("services", "Services", "Hair services", [_hero("Services & Pricing", "Something for everyone", bg=brand["primary_color"], text="#FFFFFF"), _section([_cols(2, salon_services)])]),
            _make_page("gallery", "Gallery", "Our work", [_hero("Gallery", "Styles that inspire", bg=brand["primary_color"], text="#FFFFFF")]),
            _make_page("contact", "Contact", "Contact", [_hero("Contact", "We'd love to see you", bg=brand["primary_color"], text="#FFFFFF"), _section([_cols(2, [_contact(), _hours(salon_hours)])])]),
        ]))

    # ── SPA ──
    spa_services = [
        _service("Deep Tissue Massage", "From £75", "Intensive massage targeting deep muscle tension"),
        _service("Hot Stone Therapy", "From £85", "Heated basalt stones melt away stress"),
        _service("Aromatherapy Facial", "From £65", "Luxurious facial with essential oil blends"),
        _service("Spa Day Package", "From £150", "Full day of treatments including lunch"),
    ]
    spa_hours = [{"day": "Monday - Sunday", "hours": "9:00 AM - 8:00 PM"}]

    for name, desc, brand in [
        ("Zen", "Minimal, nature imagery, calm colours", {"primary_color": "#5C7A6B", "secondary_color": "#F5F5F0", "accent_color": "#B8A88A"}),
        ("Resort", "Luxury, expansive imagery", {"primary_color": "#1A2A3A", "secondary_color": "#F8F6F3", "accent_color": "#C9A84C"}),
        ("Holistic", "Earthy, natural, warm", {"primary_color": "#8B6F47", "secondary_color": "#FFF8F0", "accent_color": "#6B8E6B"}),
    ]:
        templates.append(_make_template(name, "spa", desc, brand, [
            _make_page("home", "Home", f"{name} spa", [
                _hero("Restore. Renew. Relax.", "A sanctuary for body and mind", "Book Your Escape", brand["primary_color"], "#FFFFFF", brand["accent_color"]),
                _section([_heading("Treatments"), _cols(2, spa_services)]),
                _cta("Escape the Everyday", "Gift vouchers available", "Book Now"),
            ]),
            _make_page("about", "About", "About", [_hero("Our Sanctuary", "Dedicated to your wellbeing", bg=brand["primary_color"], text="#FFFFFF"), _section([_text("Step through our doors and leave the world behind. Our spa is designed as a haven of tranquillity.")])]),
            _make_page("services", "Treatments", "Treatments", [_hero("Treatments", "Tailored to your needs", bg=brand["primary_color"], text="#FFFFFF"), _section([_cols(2, spa_services)])]),
            _make_page("gallery", "Gallery", "Gallery", [_hero("Gallery", "Your peaceful retreat", bg=brand["primary_color"], text="#FFFFFF")]),
            _make_page("contact", "Contact", "Contact", [_hero("Contact", "Begin your journey", bg=brand["primary_color"], text="#FFFFFF"), _section([_cols(2, [_contact(), _hours(spa_hours)])])]),
        ]))

    # ── NAIL TECH ──
    nail_services = [
        _service("Gel Manicure", "From £30", "Long-lasting gel polish with a flawless finish"),
        _service("Acrylic Full Set", "From £40", "Custom sculpted acrylic nail extensions"),
        _service("Nail Art", "From £5/nail", "Bespoke designs from subtle to statement"),
        _service("Gel Pedicure", "From £35", "Pamper your feet with a luxurious gel pedicure"),
    ]
    nail_hours = [{"day": "Monday - Saturday", "hours": "9:00 AM - 6:00 PM"}, {"day": "Sunday", "hours": "10:00 AM - 4:00 PM"}]

    for name, desc, brand in [
        ("Glam", "Pink/rose gold, glamorous", {"primary_color": "#E8B4B8", "secondary_color": "#FFF5F5", "accent_color": "#D4A574"}),
        ("Minimal Nails", "Clean, modern", {"primary_color": "#FFFFFF", "secondary_color": "#F5F5F5", "accent_color": "#111111"}),
        ("Creative", "Bold colours, artistic", {"primary_color": "#7B2D8E", "secondary_color": "#FFF0FF", "accent_color": "#FF6B6B"}),
    ]:
        templates.append(_make_template(name, "nails", desc, brand, [
            _make_page("home", "Home", f"{name} nail studio", [
                _hero("Nails That Turn Heads", "Expert nail artistry for every occasion", "Book Now", brand["primary_color"], "#FFFFFF", brand["accent_color"]),
                _section([_heading("Services"), _cols(2, nail_services)]),
                _cta("Treat Yourself", "Online booking available", "Book Now"),
            ]),
            _make_page("about", "About", "About", [_hero("About", "Creativity at our fingertips", bg=brand["primary_color"], text="#FFFFFF")]),
            _make_page("services", "Services", "Services", [_hero("Services", "From classic to creative", bg=brand["primary_color"], text="#FFFFFF"), _section([_cols(2, nail_services)])]),
            _make_page("gallery", "Gallery", "Gallery", [_hero("Gallery", "Our latest designs", bg=brand["primary_color"], text="#FFFFFF")]),
            _make_page("contact", "Contact", "Contact", [_hero("Contact", "Book your appointment", bg=brand["primary_color"], text="#FFFFFF"), _section([_cols(2, [_contact(), _hours(nail_hours)])])]),
        ]))

    # ── TATTOO ──
    tattoo_services = [
        _service("Small Tattoo", "From £80", "Up to 2 inches, black or colour"),
        _service("Medium Tattoo", "From £200", "3-5 inches, detailed work"),
        _service("Large Piece", "By Consultation", "Half sleeves, back pieces, custom projects"),
        _service("Cover-Up", "From £150", "Transform old ink into something new"),
    ]
    tattoo_hours = [{"day": "Tuesday - Saturday", "hours": "11:00 AM - 7:00 PM"}, {"day": "Sunday - Monday", "hours": "Closed"}]

    for name, desc, brand in [
        ("Dark Portfolio", "Black background, portfolio focused", {"primary_color": "#0A0A0A", "secondary_color": "#E5E5E5", "accent_color": "#FF4444"}),
        ("Clean Studio", "Light, professional, approachable", {"primary_color": "#FFFFFF", "secondary_color": "#1A1A1A", "accent_color": "#2563EB"}),
        ("Artistic", "Creative layout, gallery heavy", {"primary_color": "#1A1A2E", "secondary_color": "#F0F0F0", "accent_color": "#E94560"}),
    ]:
        templates.append(_make_template(name, "tattoo", desc, brand, [
            _make_page("home", "Home", f"{name} tattoo studio", [
                _hero("Ink With Intent", "Custom tattoos crafted with care", "Book Consultation", brand["primary_color"], "#FFFFFF", brand["accent_color"]),
                _section([_heading("Services"), _cols(2, tattoo_services)]),
                _cta("Your Story, Your Skin", "Every piece tells a story", "Get Started"),
            ]),
            _make_page("about", "About", "About", [_hero("The Studio", "Art. Craft. Commitment.", bg=brand["primary_color"], text="#FFFFFF")]),
            _make_page("services", "Services", "Services", [_hero("Services & Pricing", "Quality ink, fair prices", bg=brand["primary_color"], text="#FFFFFF"), _section([_cols(2, tattoo_services)])]),
            _make_page("gallery", "Portfolio", "Portfolio", [_hero("Portfolio", "Browse our work", bg=brand["primary_color"], text="#FFFFFF")]),
            _make_page("contact", "Contact", "Contact", [_hero("Contact", "Consultations are free", bg=brand["primary_color"], text="#FFFFFF"), _section([_cols(2, [_contact(), _hours(tattoo_hours)])])]),
        ]))

    # ── PERSONAL TRAINER ──
    pt_services = [
        _service("1-to-1 Training", "From £50/session", "Personalised training plan and expert coaching"),
        _service("Online Coaching", "From £120/month", "Custom programme, nutrition guidance, weekly check-ins"),
        _service("Group Sessions", "£15/class", "High-energy group workouts for all fitness levels"),
        _service("Nutrition Plan", "From £80", "Bespoke meal plans aligned with your goals"),
    ]
    pt_hours = [{"day": "Monday - Friday", "hours": "6:00 AM - 9:00 PM"}, {"day": "Saturday", "hours": "7:00 AM - 2:00 PM"}, {"day": "Sunday", "hours": "By appointment"}]

    for name, desc, brand in [
        ("High Energy", "Bold, dynamic, transformation focused", {"primary_color": "#FF4500", "secondary_color": "#1A1A1A", "accent_color": "#FFD700"}),
        ("Wellness", "Calm, holistic approach", {"primary_color": "#4A7C59", "secondary_color": "#F5FAF7", "accent_color": "#C9A84C"}),
        ("Performance", "Data-driven, professional", {"primary_color": "#1A1A2E", "secondary_color": "#F0F4FF", "accent_color": "#3B82F6"}),
    ]:
        templates.append(_make_template(name, "personal_trainer", desc, brand, [
            _make_page("home", "Home", f"{name} personal training", [
                _hero("Transform Your Body", "Expert personal training that delivers results", "Start Today", brand["primary_color"], "#FFFFFF", brand["accent_color"]),
                _section([_heading("Services"), _cols(2, pt_services)]),
                _cta("Ready to Start?", "Free consultation for new clients", "Book Free Consultation"),
            ]),
            _make_page("about", "About", "About", [_hero("About Me", "Certified, experienced, passionate", bg=brand["primary_color"], text="#FFFFFF")]),
            _make_page("services", "Services", "Services", [_hero("Services", "Programmes for every goal", bg=brand["primary_color"], text="#FFFFFF"), _section([_cols(2, pt_services)])]),
            _make_page("gallery", "Transformations", "Results", [_hero("Transformations", "Real clients, real results", bg=brand["primary_color"], text="#FFFFFF")]),
            _make_page("contact", "Contact", "Contact", [_hero("Get Started", "Your journey begins here", bg=brand["primary_color"], text="#FFFFFF"), _section([_cols(2, [_contact(), _hours(pt_hours)])])]),
        ]))

    # ── GENERIC ──
    generic_services = [
        _service("Service One", "Contact us", "Our flagship offering tailored to your needs"),
        _service("Service Two", "Contact us", "A complementary service for complete solutions"),
        _service("Service Three", "Contact us", "Additional support to help you succeed"),
    ]
    generic_hours = [{"day": "Monday - Friday", "hours": "9:00 AM - 5:30 PM"}, {"day": "Saturday", "hours": "By appointment"}, {"day": "Sunday", "hours": "Closed"}]

    for name, desc, brand in [
        ("Professional", "Clean business template", {"primary_color": "#1E3A5F", "secondary_color": "#F5F7FA", "accent_color": "#2563EB"}),
        ("Creative Portfolio", "Artistic, portfolio style", {"primary_color": "#1A1A1A", "secondary_color": "#FFFFFF", "accent_color": "#E91E63"}),
        ("Community", "Warm, local business feel", {"primary_color": "#5C4033", "secondary_color": "#FFF8F0", "accent_color": "#E8A87C"}),
    ]:
        templates.append(_make_template(name, "generic", desc, brand, [
            _make_page("home", "Home", f"{name} business website", [
                _hero("Welcome to Our Business", "Professional services you can trust", "Get Started", brand["primary_color"], "#FFFFFF", brand["accent_color"]),
                _section([_heading("What We Offer"), _cols(3, generic_services)]),
                _cta("Let's Work Together", "Get in touch to discuss your needs", "Contact Us"),
            ]),
            _make_page("about", "About", "About us", [_hero("About Us", "Our story and values", bg=brand["primary_color"], text="#FFFFFF"), _section([_text("We're passionate about what we do and committed to delivering the best results for our clients.")])]),
            _make_page("services", "Services", "Our services", [_hero("Our Services", "Solutions for every need", bg=brand["primary_color"], text="#FFFFFF"), _section([_cols(3, generic_services)])]),
            _make_page("gallery", "Gallery", "Our work", [_hero("Our Work", "See what we've done", bg=brand["primary_color"], text="#FFFFFF")]),
            _make_page("contact", "Contact", "Contact us", [_hero("Contact Us", "We'd love to hear from you", bg=brand["primary_color"], text="#FFFFFF"), _section([_cols(2, [_contact(), _hours(generic_hours)])])]),
        ]))

    return templates


@router.post("/admin/templates/seed")
async def seed_templates(
    admin: dict = Depends(get_current_admin),
):
    """Admin only: seed the template library with all industry templates.
    Clears existing templates and inserts fresh set."""
    db = get_database()

    templates = _generate_all_templates()

    # Clear existing templates
    await db.website_templates.delete_many({})

    # Insert all
    if templates:
        await db.website_templates.insert_many(templates)

    logger.info("Templates seeded: %d templates by admin=%s", len(templates), admin.get("email", "unknown"))
    return {"templates_seeded": len(templates), "industries": list(set(t["industry"] for t in templates))}


# ─────────────────────────────────────────────────────
# QR CODE GENERATOR
# ─────────────────────────────────────────────────────

@router.get("/business/{bid}/qr/{slug}")
async def generate_qr_code(
    bid: str,
    slug: str,
    size: int = Query(default=300, ge=100, le=1000),
    color: str = Query(default="000000", regex=r"^[0-9a-fA-F]{6}$"),
    tc: TenantContext = Depends(verify_business_access),
):
    """Generate a QR code PNG for a published page URL."""
    from fastapi.responses import Response as RawResponse

    db = get_database()
    settings = await db.website_settings.find_one({"business_id": bid})
    subdomain = (settings or {}).get("subdomain")
    if not subdomain:
        raise HTTPException(status_code=400, detail="No subdomain configured — publish your website first")

    url = f"https://{subdomain}.reevenow.com/{slug}" if slug != "home" else f"https://{subdomain}.reevenow.com"

    # Cache key based on url + size + color
    cache_key = hashlib.md5(f"{url}:{size}:{color}".encode()).hexdigest()
    cache_dir = UPLOAD_BASE / "qr"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / f"{cache_key}.png"

    if not cache_path.exists():
        fill_color = f"#{color}"
        qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color=fill_color, back_color="white").resize((size, size))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        cache_path.write_bytes(buf.getvalue())

    return RawResponse(content=cache_path.read_bytes(), media_type="image/png", headers={
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": f'inline; filename="qr-{slug}.png"',
    })
