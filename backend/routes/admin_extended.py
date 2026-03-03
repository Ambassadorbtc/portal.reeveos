"""
Admin Extended API — Endpoints for all admin dashboard pages.
Covers: Pipeline, Support, Reviews, Churn, Email Marketing, SEO, Content,
Analytics, Health, Audit, Errors, Settings.
"""
from fastapi import APIRouter, Query, HTTPException, Depends
from pydantic import BaseModel
from database import get_database as get_db, safe_object_id
from datetime import datetime
from bson import ObjectId
from typing import Optional, List
from middleware.auth import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin-extended"], dependencies=[Depends(get_current_admin)])


def _ser(doc):
    if doc is None: return None
    d = dict(doc)
    for k, v in d.items():
        if isinstance(v, ObjectId): d[k] = str(v)
        elif isinstance(v, datetime): d[k] = v.isoformat()
        elif isinstance(v, list): d[k] = [_ser(i) if isinstance(i, dict) else (str(i) if isinstance(i, ObjectId) else (i.isoformat() if isinstance(i, datetime) else i)) for i in v]
        elif isinstance(v, dict): d[k] = _ser(v)
    return d


# ═══════════════════════════════════════════════════════
# PIPELINE
# ═══════════════════════════════════════════════════════

class LeadCreate(BaseModel):
    name: str; email: str = ""; phone: str = ""; city: str = "Nottingham"
    source: str = "Outreach"; stage: str = "cold"; est_value: int = 0; score: int = 50

class LeadMove(BaseModel):
    stage: str

class LeadNote(BaseModel):
    text: str; author: str = "Founder"

@router.get("/pipeline/leads")
async def list_leads(stage: str = "", search: str = ""):
    db = get_db()
    q = {}
    if stage: q["stage"] = stage
    if search: q["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}}]
    cursor = db.pipeline_leads.find(q).sort("updated_at", -1)
    leads = [_ser(doc) async for doc in cursor]
    return {"leads": leads}

@router.post("/pipeline/leads")
async def create_lead(data: LeadCreate):
    db = get_db()
    now = datetime.utcnow()
    doc = {**data.dict(), "notes": [], "created_at": now, "updated_at": now}
    result = await db.pipeline_leads.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _ser(doc)

@router.post("/pipeline/leads/{lead_id}/move")
async def move_lead(lead_id: str, data: LeadMove):
    db = get_db()
    oid = safe_object_id(lead_id, "lead")
    await db.pipeline_leads.update_one({"_id": oid}, {"$set": {"stage": data.stage, "updated_at": datetime.utcnow()}})
    return _ser(await db.pipeline_leads.find_one({"_id": oid}))

@router.post("/pipeline/leads/{lead_id}/notes")
async def add_lead_note(lead_id: str, note: LeadNote):
    db = get_db()
    oid = safe_object_id(lead_id, "lead")
    now = datetime.utcnow()
    await db.pipeline_leads.update_one({"_id": oid}, {"$push": {"notes": {"text": note.text, "author": note.author, "at": now}}, "$set": {"updated_at": now}})
    return _ser(await db.pipeline_leads.find_one({"_id": oid}))


# ═══════════════════════════════════════════════════════
# SUPPORT TICKETS
# ═══════════════════════════════════════════════════════

class TicketStatus(BaseModel):
    status: str

class TicketReply(BaseModel):
    text: str; author: str = "Support"

@router.get("/support/tickets")
async def list_tickets():
    db = get_db()
    cursor = db.support_tickets.find().sort("created_at", -1)
    tickets = [_ser(doc) async for doc in cursor]
    return {"tickets": tickets}

@router.post("/support/tickets/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, data: TicketStatus):
    db = get_db()
    await db.support_tickets.update_one({"_id": safe_object_id(ticket_id, "ticket")}, {"$set": {"status": data.status, "updated_at": datetime.utcnow()}})
    return {"updated": True}

@router.post("/support/tickets/{ticket_id}/reply")
async def reply_ticket(ticket_id: str, data: TicketReply):
    db = get_db()
    now = datetime.utcnow()
    await db.support_tickets.update_one({"_id": safe_object_id(ticket_id, "ticket")}, {"$push": {"messages": {"text": data.text, "author": data.author, "from": "support", "at": now}}, "$set": {"updated_at": now}})
    return {"replied": True}


# ═══════════════════════════════════════════════════════
# REVIEWS
# ═══════════════════════════════════════════════════════

class ModerateAction(BaseModel):
    action: str  # approved, flagged, hidden

@router.get("/reviews")
async def list_reviews(status: str = ""):
    db = get_db()
    q = {"status": status} if status else {}
    cursor = db.reviews.find(q).sort("created_at", -1)
    reviews = [_ser(doc) async for doc in cursor]
    total = len(reviews)
    avg = sum(r.get("rating", 0) for r in reviews) / total if total else 0
    pending = sum(1 for r in reviews if r.get("status") == "pending")
    return {"reviews": reviews, "stats": {"total": total, "avg": avg, "pending": pending}}

@router.post("/reviews/{review_id}/moderate")
async def moderate_review(review_id: str, data: ModerateAction):
    db = get_db()
    await db.reviews.update_one({"_id": safe_object_id(review_id, "review")}, {"$set": {"status": data.action, "moderated_at": datetime.utcnow()}})
    return {"moderated": True}


# ═══════════════════════════════════════════════════════
# CHURN RISK
# ═══════════════════════════════════════════════════════

@router.get("/churn/overview")
async def churn_overview():
    db = get_db()
    cursor = db.businesses.find({}, {"name": 1, "plan": 1, "created_at": 1, "last_login": 1})
    businesses = []
    async for biz in cursor:
        b = _ser(biz)
        bookings = await db.bookings.count_documents({"business_id": str(biz["_id"])})
        last_booking = None
        last_b = await db.bookings.find_one({"business_id": str(biz["_id"])}, sort=[("created_at", -1)])
        if last_b: last_booking = last_b.get("created_at")
        score = 0
        if bookings == 0: score += 40
        if not b.get("last_login"): score += 30
        b["churn_score"] = min(score, 100)
        b["last_booking"] = last_booking.isoformat() if isinstance(last_booking, datetime) else last_booking
        b["booking_count"] = bookings
        businesses.append(b)
    at_risk = sum(1 for b in businesses if b.get("churn_score", 0) >= 40)
    healthy = sum(1 for b in businesses if b.get("churn_score", 0) < 40)
    return {"businesses": businesses, "stats": {"total": len(businesses), "at_risk": at_risk, "healthy": healthy}}


# ═══════════════════════════════════════════════════════
# EMAIL MARKETING
# ═══════════════════════════════════════════════════════

class CampaignCreate(BaseModel):
    name: str; subject: str = ""; type: str = "newsletter"; audience: str = "all"

@router.get("/email-marketing/overview")
async def email_marketing_overview():
    db = get_db()
    cursor = db.email_campaigns.find().sort("created_at", -1)
    campaigns = [_ser(doc) async for doc in cursor]
    sub_count = await db.subscribers.count_documents({})
    active = await db.subscribers.count_documents({"status": "active"})
    unsub = await db.subscribers.count_documents({"status": "unsubscribed"})
    return {"campaigns": campaigns, "subscribers": {"total": sub_count, "active": active, "unsubscribed": unsub}}

@router.post("/email-marketing/campaigns")
async def create_campaign(data: CampaignCreate):
    db = get_db()
    now = datetime.utcnow()
    doc = {**data.dict(), "status": "draft", "sent": 0, "opened": 0, "clicked": 0, "created_at": now}
    result = await db.email_campaigns.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _ser(doc)


# ═══════════════════════════════════════════════════════
# SEO PAGES
# ═══════════════════════════════════════════════════════

@router.get("/seo/pages")
async def list_seo_pages():
    db = get_db()
    cursor = db.seo_pages.find().sort("created_at", -1)
    pages = [_ser(doc) async for doc in cursor]
    indexed = sum(1 for p in pages if p.get("status") == "indexed")
    pending = sum(1 for p in pages if p.get("status") == "pending")
    return {"pages": pages, "stats": {"total": len(pages), "indexed": indexed, "pending": pending}}

@router.post("/seo/generate")
async def generate_seo_pages(data: dict):
    db = get_db()
    city = data.get("city", "Nottingham")
    cuisines = [c.strip() for c in data.get("cuisines", "").split(",") if c.strip()]
    now = datetime.utcnow()
    created = []
    for cuisine in cuisines:
        slug = f"/{city.lower()}/{cuisine.lower().replace(' ', '-')}-restaurants"
        existing = await db.seo_pages.find_one({"slug": slug})
        if not existing:
            doc = {"city": city, "cuisine": cuisine, "slug": slug, "title": f"Best {cuisine} Restaurants in {city}", "status": "draft", "created_at": now}
            await db.seo_pages.insert_one(doc)
            created.append(slug)
    return {"created": len(created), "slugs": created}

@router.post("/seo/pages/{page_id}/index")
async def request_index(page_id: str):
    db = get_db()
    await db.seo_pages.update_one({"_id": safe_object_id(page_id, "seo_page")}, {"$set": {"status": "pending", "index_requested_at": datetime.utcnow()}})
    return {"requested": True}


# ═══════════════════════════════════════════════════════
# CONTENT ENGINE
# ═══════════════════════════════════════════════════════

@router.get("/content/posts")
async def list_posts():
    db = get_db()
    cursor = db.content_posts.find().sort("created_at", -1)
    posts = [_ser(doc) async for doc in cursor]
    return {"posts": posts}

@router.post("/content/posts")
async def create_post(data: dict):
    db = get_db()
    now = datetime.utcnow()
    doc = {**data, "created_at": now, "updated_at": now}
    result = await db.content_posts.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _ser(doc)

@router.delete("/content/posts/{post_id}")
async def delete_post(post_id: str):
    db = get_db()
    await db.content_posts.delete_one({"_id": safe_object_id(post_id, "post")})
    return {"deleted": True}


# ═══════════════════════════════════════════════════════
# PLATFORM ANALYTICS
# ═══════════════════════════════════════════════════════

@router.get("/analytics/platform")
async def platform_analytics(period: str = "7d"):
    db = get_db()
    biz_count = await db.businesses.count_documents({})
    user_count = await db.users.count_documents({})
    booking_count = await db.bookings.count_documents({})
    return {
        "mrr": "£0", "mrr_change": "+£0",
        "businesses": biz_count, "biz_change": f"+0",
        "users": user_count, "user_change": f"+0",
        "bookings": booking_count, "booking_change": f"+0",
        "page_views": 0, "avg_session": "0s",
    }


# ═══════════════════════════════════════════════════════
# SYSTEM HEALTH
# ═══════════════════════════════════════════════════════

@router.get("/health/check")
async def health_check():
    import psutil, time
    db = get_db()
    start = time.time()

    # MongoDB
    try:
        await db.command("ping")
        mongo_ok = True
        mongo_latency = round((time.time() - start) * 1000, 1)
    except Exception:
        mongo_ok = False
        mongo_latency = 0

    # System resources
    try:
        cpu = psutil.cpu_percent(interval=0.3)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        cpu_pct = round(cpu, 1)
        mem_pct = round(mem.percent, 1)
        disk_pct = round(disk.percent, 1)
        mem_used = f"{round(mem.used / (1024**3), 1)}GB / {round(mem.total / (1024**3), 1)}GB"
        disk_used = f"{round(disk.used / (1024**3), 1)}GB / {round(disk.total / (1024**3), 1)}GB"
    except Exception:
        cpu_pct = mem_pct = disk_pct = 0
        mem_used = disk_used = "unavailable"

    # Error rate (last hour)
    from datetime import datetime, timedelta
    try:
        hour_ago = datetime.utcnow() - timedelta(hours=1)
        error_count = await db.error_log.count_documents({"created_at": {"$gte": hour_ago}})
        error_rate = f"{error_count}/hr"
    except Exception:
        error_rate = "0/hr"

    # Process uptime
    try:
        boot = datetime.utcfromtimestamp(psutil.boot_time())
        uptime_delta = datetime.utcnow() - boot
        days = uptime_delta.days
        hours = uptime_delta.seconds // 3600
        uptime_str = f"{days}d {hours}h" if days > 0 else f"{hours}h {(uptime_delta.seconds % 3600) // 60}m"
    except Exception:
        uptime_str = "—"

    status = "healthy"
    if not mongo_ok:
        status = "down"
    elif cpu_pct > 90 or mem_pct > 90 or disk_pct > 90:
        status = "critical"
    elif cpu_pct > 75 or mem_pct > 75 or disk_pct > 80:
        status = "degraded"

    return {
        "status": status,
        "uptime": uptime_str,
        "error_rate": error_rate,
        "cpu": f"{cpu_pct}%",
        "cpu_pct": cpu_pct,
        "memory": mem_used,
        "mem_pct": mem_pct,
        "disk": disk_used,
        "disk_pct": disk_pct,
        "services": [
            {"name": "FastAPI Backend", "status": "healthy", "latency": f"{round((time.time() - start) * 1000)}ms"},
            {"name": "MongoDB", "status": "healthy" if mongo_ok else "down", "latency": f"{mongo_latency}ms"},
            {"name": "Nginx Proxy", "status": "healthy", "latency": "<1ms"},
        ],
    }


# ═══════════════════════════════════════════════════════
# AUDIT LOG
# ═══════════════════════════════════════════════════════

@router.get("/audit/logs")
async def list_audit_logs(type: str = "", search: str = "", page: int = 1, limit: int = 50):
    db = get_db()
    q = {}
    if type:
        q["$or"] = [{"type": type}, {"action": type}]
    if search:
        q["$or"] = q.get("$or", []) + [
            {"message": {"$regex": search, "$options": "i"}},
            {"request.endpoint": {"$regex": search, "$options": "i"}},
            {"actor.email": {"$regex": search, "$options": "i"}},
        ] if not type else [
            {"message": {"$regex": search, "$options": "i"}},
            {"request.endpoint": {"$regex": search, "$options": "i"}},
            {"actor.email": {"$regex": search, "$options": "i"}},
        ]
    total = await db.audit_log.count_documents(q)
    # Sort by timestamp (audit middleware) or created_at (older entries)
    cursor = db.audit_log.find(q).sort([("timestamp", -1), ("created_at", -1)]).skip((page - 1) * limit).limit(limit)
    logs = []
    async for doc in cursor:
        entry = _ser(doc)
        # Normalize: ensure 'type' and 'created_at' exist for frontend
        if "action" in entry and "type" not in entry:
            entry["type"] = entry["action"]
        if "timestamp" in entry and "created_at" not in entry:
            entry["created_at"] = entry["timestamp"]
        if "actor" in entry:
            entry["user_email"] = entry["actor"].get("email", "")
            entry["user_id"] = entry["actor"].get("user_id", "")
            entry["ip"] = entry["actor"].get("ip", "")
        if "request" in entry:
            entry["endpoint"] = entry["request"].get("endpoint", "")
            entry["method"] = entry["request"].get("method", "")
        logs.append(entry)
    return {"logs": logs, "total": total}


# ═══════════════════════════════════════════════════════
# ERROR LOGS
# ═══════════════════════════════════════════════════════

class ErrorStatus(BaseModel):
    status: str

@router.get("/errors")
async def list_errors(severity: str = ""):
    db = get_db()
    q = {"severity": severity} if severity else {}
    cursor = db.error_log.find(q).sort("created_at", -1)
    errors = [_ser(doc) async for doc in cursor]
    return {"errors": errors}

@router.post("/errors/{error_id}/status")
async def update_error_status(error_id: str, data: ErrorStatus):
    db = get_db()
    await db.error_log.update_one({"_id": safe_object_id(error_id, "error")}, {"$set": {"status": data.status, "updated_at": datetime.utcnow()}})
    return {"updated": True}


# ═══════════════════════════════════════════════════════
# SETTINGS
# ═══════════════════════════════════════════════════════

@router.get("/settings")
async def get_settings():
    db = get_db()
    doc = await db.admin_settings.find_one({"_id": "global"})
    return {"settings": _ser(doc) if doc else {}}

@router.put("/settings")
async def save_settings(data: dict):
    db = get_db()
    data["updated_at"] = datetime.utcnow()
    await db.admin_settings.update_one({"_id": "global"}, {"$set": data}, upsert=True)
    return {"saved": True}


# ═══════════════════════════════════════════════════════
# SECURITY MONITORING
# ═══════════════════════════════════════════════════════

@router.get("/security/report")
async def get_latest_security_report():
    """Get the most recent security report."""
    db = get_db()
    report = await db.security_reports.find_one(sort=[("created_at", -1)])
    if report:
        report["_id"] = str(report["_id"])
        if "created_at" in report:
            report["created_at"] = report["created_at"].isoformat()
    return {"report": _ser(report) if report else None}

@router.get("/security/reports")
async def get_security_reports(limit: int = 30):
    """Get security report history."""
    db = get_db()
    reports = []
    async for doc in db.security_daily_reports.find().sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        reports.append(doc)
    return {"reports": reports}

@router.post("/security/scan-now")
async def run_security_scan_now():
    """Trigger an immediate security scan (on-demand)."""
    from agent.tools.security import get_security_report
    report = await get_security_report()
    return {"report": report}

@router.get("/security/tenant-audit")
async def run_tenant_audit():
    """Run tenant isolation audit and return results."""
    from agent.tools.security import scan_tenant_isolation
    result = await scan_tenant_isolation()
    return {"audit": result}

@router.get("/security/notifications")
async def get_security_notifications(limit: int = 50):
    """Get security alert notifications."""
    db = get_db()
    notifications = []
    async for doc in db.admin_notifications.find(
        {"type": {"$in": ["security_alert", "security_audit", "realtime_security"]}}
    ).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        notifications.append(doc)
    return {"notifications": notifications}
