"""
Blog Engine API Routes
======================
Full blog/content management for ReeveOS website builder.
Supports CRUD, publish/unpublish, scheduling, and soft-delete.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_database
from middleware.tenant import verify_business_access, TenantContext
from middleware.auth import get_current_user
from bson import ObjectId
from datetime import datetime
from typing import Optional
import re, logging

logger = logging.getLogger("blog")
router = APIRouter(prefix="/blog", tags=["Blog"])


def _doc(d):
    """Serialize a MongoDB document, converting _id to id string."""
    if d is None:
        return None
    d["id"] = str(d.pop("_id"))
    return d


def _slugify(title: str) -> str:
    slug = title.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug or "untitled"


async def _ensure_unique_slug(db, business_id: str, slug: str, exclude_id=None) -> str:
    base_slug = slug
    counter = 1
    while True:
        query = {"business_id": business_id, "slug": slug, "deleted": {"$ne": True}}
        if exclude_id:
            query["_id"] = {"$ne": exclude_id}
        existing = await db.blog_posts.find_one(query)
        if not existing:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1
        if counter > 100:
            slug = f"{base_slug}-{ObjectId()}"
            return slug


# ─── LIST POSTS ───

@router.get("/business/{bid}/posts")
async def list_posts(
    bid: str,
    status: Optional[str] = Query(default=None),
    tc: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    query = {"business_id": bid, "deleted": {"$ne": True}}
    if status:
        query["status"] = status
    posts = await db.blog_posts.find(query).sort("created_at", -1).to_list(200)
    return {"posts": [_doc(p) for p in posts]}


# ─── GET SINGLE POST ───

@router.get("/business/{bid}/posts/{post_id}")
async def get_post(
    bid: str,
    post_id: str,
    tc: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    try:
        oid = ObjectId(post_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid post ID")
    post = await db.blog_posts.find_one({"_id": oid, "business_id": bid, "deleted": {"$ne": True}})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _doc(post)


# ─── CREATE POST ───

@router.post("/business/{bid}/posts")
async def create_post(
    bid: str,
    body: dict,
    tc: TenantContext = Depends(verify_business_access),
    user: dict = Depends(get_current_user),
):
    db = get_database()
    title = body.get("title", "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")

    slug = body.get("slug", "").strip() or _slugify(title)
    slug = await _ensure_unique_slug(db, bid, slug)

    now = datetime.utcnow()
    post = {
        "business_id": bid,
        "title": title,
        "slug": slug,
        "content": body.get("content", ""),
        "excerpt": body.get("excerpt", ""),
        "featured_image": body.get("featured_image", ""),
        "tags": body.get("tags", []),
        "meta_title": body.get("meta_title", ""),
        "meta_description": body.get("meta_description", ""),
        "status": body.get("status", "draft"),
        "author": user.get("name") or user.get("email", "Unknown"),
        "created_at": now,
        "updated_at": now,
        "deleted": False,
    }
    if post["status"] == "published":
        post["published_at"] = now

    result = await db.blog_posts.insert_one(post)
    post["_id"] = result.inserted_id
    return _doc(post)


# ─── UPDATE POST ───

@router.put("/business/{bid}/posts/{post_id}")
async def update_post(
    bid: str,
    post_id: str,
    body: dict,
    tc: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    try:
        oid = ObjectId(post_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    existing = await db.blog_posts.find_one({"_id": oid, "business_id": bid, "deleted": {"$ne": True}})
    if not existing:
        raise HTTPException(status_code=404, detail="Post not found")

    updates = {"updated_at": datetime.utcnow()}
    allowed = ["title", "content", "excerpt", "featured_image", "tags", "meta_title", "meta_description", "status"]
    for key in allowed:
        if key in body:
            updates[key] = body[key]

    if "slug" in body and body["slug"] != existing.get("slug"):
        updates["slug"] = await _ensure_unique_slug(db, bid, body["slug"], exclude_id=oid)

    if updates.get("status") == "published" and existing.get("status") != "published":
        updates["published_at"] = datetime.utcnow()

    await db.blog_posts.update_one({"_id": oid}, {"$set": updates})
    updated = await db.blog_posts.find_one({"_id": oid})
    return _doc(updated)


# ─── PUBLISH ───

@router.post("/business/{bid}/posts/{post_id}/publish")
async def publish_post(
    bid: str,
    post_id: str,
    tc: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    try:
        oid = ObjectId(post_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    result = await db.blog_posts.update_one(
        {"_id": oid, "business_id": bid, "deleted": {"$ne": True}},
        {"$set": {"status": "published", "published_at": datetime.utcnow(), "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"ok": True}


# ─── UNPUBLISH ───

@router.post("/business/{bid}/posts/{post_id}/unpublish")
async def unpublish_post(
    bid: str,
    post_id: str,
    tc: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    try:
        oid = ObjectId(post_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    result = await db.blog_posts.update_one(
        {"_id": oid, "business_id": bid, "deleted": {"$ne": True}},
        {"$set": {"status": "draft", "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"ok": True}


# ─── DELETE (soft) ───

@router.delete("/business/{bid}/posts/{post_id}")
async def delete_post(
    bid: str,
    post_id: str,
    tc: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    try:
        oid = ObjectId(post_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    result = await db.blog_posts.update_one(
        {"_id": oid, "business_id": bid, "deleted": {"$ne": True}},
        {"$set": {"deleted": True, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"ok": True}


# ─── SCHEDULE ───

@router.post("/business/{bid}/posts/{post_id}/schedule")
async def schedule_post(
    bid: str,
    post_id: str,
    body: dict,
    tc: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    try:
        oid = ObjectId(post_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    publish_at = body.get("publish_at")
    if not publish_at:
        raise HTTPException(status_code=400, detail="publish_at is required")

    try:
        if isinstance(publish_at, str):
            publish_at = datetime.fromisoformat(publish_at.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid datetime format")

    result = await db.blog_posts.update_one(
        {"_id": oid, "business_id": bid, "deleted": {"$ne": True}},
        {"$set": {"status": "scheduled", "publish_at": publish_at, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"ok": True, "publish_at": publish_at.isoformat()}
