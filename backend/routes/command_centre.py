"""
Command Centre API — Project board for founder admin panel.
MongoDB collection: project_features
Full CRUD + stage moves + checklist toggles + notes thread + history log.
"""
from fastapi import APIRouter, Query, Body, HTTPException
from pydantic import BaseModel, Field
from database import get_database as get_db, safe_object_id
from datetime import datetime
from bson import ObjectId
from typing import Optional, List

router = APIRouter(prefix="/admin/command-centre", tags=["command-centre"])


# ─── Helpers ──────────────────────────────────────────
def _ser(doc):
    """Convert MongoDB doc to JSON-safe dict."""
    if doc is None:
        return None
    d = dict(doc)
    for k, v in d.items():
        if isinstance(v, ObjectId):
            d[k] = str(v)
        elif isinstance(v, datetime):
            d[k] = v.isoformat()
        elif isinstance(v, list):
            d[k] = [_ser(i) if isinstance(i, dict) else (str(i) if isinstance(i, ObjectId) else (i.isoformat() if isinstance(i, datetime) else i)) for i in v]
        elif isinstance(v, dict):
            d[k] = _ser(v)
    return d


# ─── Models ───────────────────────────────────────────
class CheckItem(BaseModel):
    t: str
    d: bool = False

class NoteInput(BaseModel):
    text: str
    author: str = "Founder"

class FeatureCreate(BaseModel):
    name: str
    desc: str = ""
    cat: str = "Platform"
    pri: str = "P2"
    stage: str = "backlog"
    comp: List[str] = []
    effort: str = "Medium"
    rev: str = "Medium"
    checks: List[CheckItem] = []
    assignee: str = ""
    target_date: str = ""

class FeatureUpdate(BaseModel):
    name: Optional[str] = None
    desc: Optional[str] = None
    cat: Optional[str] = None
    pri: Optional[str] = None
    stage: Optional[str] = None
    comp: Optional[List[str]] = None
    effort: Optional[str] = None
    rev: Optional[str] = None
    assignee: Optional[str] = None
    target_date: Optional[str] = None

class StageMove(BaseModel):
    stage: str
    moved_by: str = "Founder"

class CheckToggle(BaseModel):
    index: int
    done: bool


# ─── CRUD ─────────────────────────────────────────────

@router.get("/features")
async def list_features(
    stage: str = Query("", description="Filter by stage"),
    pri: str = Query("", description="Filter by priority"),
    cat: str = Query("", description="Filter by category"),
    search: str = Query("", description="Search name/desc"),
):
    """List all features with optional filters."""
    db = get_db()
    query = {}
    if stage:
        query["stage"] = stage
    if pri:
        query["pri"] = pri
    if cat:
        query["cat"] = cat
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"desc": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.project_features.find(query).sort([("pri", 1), ("created_at", -1)])
    features = []
    async for doc in cursor:
        features.append(_ser(doc))

    # Stage counts for summary
    stage_counts = {}
    for s in ["backlog", "in_dev", "testing", "staging", "live"]:
        stage_counts[s] = await db.project_features.count_documents({"stage": s})

    # Priority counts
    pri_counts = {}
    for p in ["P0", "P1", "P2", "P3"]:
        pri_counts[p] = await db.project_features.count_documents({"pri": p})

    # Category counts
    cat_counts = {}
    all_cats = await db.project_features.distinct("cat")
    for c in all_cats:
        cat_counts[c] = await db.project_features.count_documents({"cat": c})

    total = await db.project_features.count_documents({})
    total_checks = 0
    done_checks = 0
    async for doc in db.project_features.find({}, {"checks": 1}):
        for ch in doc.get("checks", []):
            total_checks += 1
            if ch.get("d"):
                done_checks += 1

    return {
        "features": features,
        "total": total,
        "stage_counts": stage_counts,
        "pri_counts": pri_counts,
        "cat_counts": cat_counts,
        "progress": {
            "total_checks": total_checks,
            "done_checks": done_checks,
            "pct": round((done_checks / total_checks * 100) if total_checks > 0 else 0, 1),
        },
    }


@router.get("/features/{feature_id}")
async def get_feature(feature_id: str):
    """Get single feature with full details."""
    db = get_db()
    doc = await db.project_features.find_one({"_id": safe_object_id(feature_id, "feature")})
    if not doc:
        raise HTTPException(404, "Feature not found")
    return _ser(doc)


@router.post("/features")
async def create_feature(data: FeatureCreate):
    """Create a new feature card."""
    db = get_db()
    now = datetime.utcnow()
    doc = {
        "name": data.name,
        "desc": data.desc,
        "cat": data.cat,
        "pri": data.pri,
        "stage": data.stage,
        "comp": data.comp,
        "effort": data.effort,
        "rev": data.rev,
        "checks": [{"t": c.t, "d": c.d} for c in data.checks],
        "notes": [],
        "history": [{"action": "created", "stage": data.stage, "at": now, "by": "Founder"}],
        "assignee": data.assignee,
        "target_date": data.target_date,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.project_features.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _ser(doc)


@router.put("/features/{feature_id}")
async def update_feature(feature_id: str, data: FeatureUpdate):
    """Update feature fields (not stage — use move endpoint for that)."""
    db = get_db()
    oid = safe_object_id(feature_id, "feature")
    existing = await db.project_features.find_one({"_id": oid})
    if not existing:
        raise HTTPException(404, "Feature not found")

    updates = {"updated_at": datetime.utcnow()}
    for field in ["name", "desc", "cat", "pri", "comp", "effort", "rev", "assignee", "target_date"]:
        val = getattr(data, field, None)
        if val is not None:
            updates[field] = val

    # If stage changed via this endpoint, log it
    if data.stage and data.stage != existing.get("stage"):
        updates["stage"] = data.stage
        history_entry = {
            "action": "moved",
            "from": existing.get("stage"),
            "to": data.stage,
            "at": datetime.utcnow(),
            "by": "Founder",
        }
        await db.project_features.update_one(
            {"_id": oid}, {"$push": {"history": history_entry}}
        )

    await db.project_features.update_one({"_id": oid}, {"$set": updates})
    updated = await db.project_features.find_one({"_id": oid})
    return _ser(updated)


@router.delete("/features/{feature_id}")
async def delete_feature(feature_id: str):
    """Delete a feature."""
    db = get_db()
    result = await db.project_features.delete_one(
        {"_id": safe_object_id(feature_id, "feature")}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Feature not found")
    return {"deleted": True}


# ─── Stage Move ───────────────────────────────────────

@router.post("/features/{feature_id}/move")
async def move_stage(feature_id: str, data: StageMove):
    """Move a feature to a new stage. Logs history automatically."""
    db = get_db()
    oid = safe_object_id(feature_id, "feature")
    existing = await db.project_features.find_one({"_id": oid})
    if not existing:
        raise HTTPException(404, "Feature not found")

    old_stage = existing.get("stage", "backlog")
    if old_stage == data.stage:
        return _ser(existing)  # No change

    now = datetime.utcnow()
    history_entry = {
        "action": "moved",
        "from": old_stage,
        "to": data.stage,
        "at": now,
        "by": data.moved_by,
    }

    await db.project_features.update_one(
        {"_id": oid},
        {
            "$set": {"stage": data.stage, "updated_at": now},
            "$push": {"history": history_entry},
        },
    )
    updated = await db.project_features.find_one({"_id": oid})
    return _ser(updated)


# ─── Checklist Toggle ─────────────────────────────────

@router.post("/features/{feature_id}/check")
async def toggle_check(feature_id: str, data: CheckToggle):
    """Toggle a checklist item's done status."""
    db = get_db()
    oid = safe_object_id(feature_id, "feature")
    existing = await db.project_features.find_one({"_id": oid})
    if not existing:
        raise HTTPException(404, "Feature not found")

    checks = existing.get("checks", [])
    if data.index < 0 or data.index >= len(checks):
        raise HTTPException(400, f"Invalid check index {data.index}")

    checks[data.index]["d"] = data.done
    now = datetime.utcnow()
    await db.project_features.update_one(
        {"_id": oid},
        {"$set": {"checks": checks, "updated_at": now}},
    )
    updated = await db.project_features.find_one({"_id": oid})
    return _ser(updated)


# ─── Add Checklist Item ───────────────────────────────

@router.post("/features/{feature_id}/check/add")
async def add_check(feature_id: str, item: CheckItem):
    """Add a new checklist item to a feature."""
    db = get_db()
    oid = safe_object_id(feature_id, "feature")
    existing = await db.project_features.find_one({"_id": oid})
    if not existing:
        raise HTTPException(404, "Feature not found")

    now = datetime.utcnow()
    await db.project_features.update_one(
        {"_id": oid},
        {
            "$push": {"checks": {"t": item.t, "d": item.d}},
            "$set": {"updated_at": now},
        },
    )
    updated = await db.project_features.find_one({"_id": oid})
    return _ser(updated)


# ─── Delete Checklist Item ────────────────────────────

@router.delete("/features/{feature_id}/check/{index}")
async def delete_check(feature_id: str, index: int):
    """Remove a checklist item by index."""
    db = get_db()
    oid = safe_object_id(feature_id, "feature")
    existing = await db.project_features.find_one({"_id": oid})
    if not existing:
        raise HTTPException(404, "Feature not found")

    checks = existing.get("checks", [])
    if index < 0 or index >= len(checks):
        raise HTTPException(400, f"Invalid check index {index}")

    checks.pop(index)
    now = datetime.utcnow()
    await db.project_features.update_one(
        {"_id": oid},
        {"$set": {"checks": checks, "updated_at": now}},
    )
    updated = await db.project_features.find_one({"_id": oid})
    return _ser(updated)


# ─── Notes Thread ─────────────────────────────────────

@router.post("/features/{feature_id}/notes")
async def add_note(feature_id: str, note: NoteInput):
    """Add a timestamped note to a feature."""
    db = get_db()
    oid = safe_object_id(feature_id, "feature")
    existing = await db.project_features.find_one({"_id": oid})
    if not existing:
        raise HTTPException(404, "Feature not found")

    now = datetime.utcnow()
    note_doc = {
        "text": note.text,
        "author": note.author,
        "at": now,
    }
    await db.project_features.update_one(
        {"_id": oid},
        {
            "$push": {"notes": note_doc},
            "$set": {"updated_at": now},
        },
    )
    updated = await db.project_features.find_one({"_id": oid})
    return _ser(updated)


# ─── Bulk Reorder (for drag-and-drop) ─────────────────

class BulkReorder(BaseModel):
    feature_ids: List[str]
    stage: str

@router.post("/reorder")
async def bulk_reorder(data: BulkReorder):
    """Update order of features within a stage column."""
    db = get_db()
    for i, fid in enumerate(data.feature_ids):
        await db.project_features.update_one(
            {"_id": safe_object_id(fid, "feature")},
            {"$set": {"sort_order": i, "stage": data.stage}},
        )
    return {"reordered": len(data.feature_ids)}


# ─── Summary for Claude queries ───────────────────────

@router.get("/summary")
async def project_summary():
    """Quick summary endpoint — designed for Claude to query and report back."""
    db = get_db()
    total = await db.project_features.count_documents({})

    stages = {}
    for s in ["backlog", "in_dev", "testing", "staging", "live"]:
        stages[s] = await db.project_features.count_documents({"stage": s})

    # P0 blockers
    p0_cursor = db.project_features.find({"pri": "P0"}, {"name": 1, "stage": 1, "checks": 1})
    p0_items = []
    async for doc in p0_cursor:
        checks = doc.get("checks", [])
        done = sum(1 for c in checks if c.get("d"))
        p0_items.append({
            "name": doc["name"],
            "stage": doc["stage"],
            "progress": f"{done}/{len(checks)}",
        })

    # Recently updated
    recent_cursor = db.project_features.find({}).sort("updated_at", -1).limit(5)
    recent = []
    async for doc in recent_cursor:
        recent.append({
            "name": doc["name"],
            "stage": doc["stage"],
            "updated": doc.get("updated_at", "").isoformat() if isinstance(doc.get("updated_at"), datetime) else str(doc.get("updated_at", "")),
        })

    # Overall progress
    total_checks = 0
    done_checks = 0
    async for doc in db.project_features.find({}, {"checks": 1}):
        for ch in doc.get("checks", []):
            total_checks += 1
            if ch.get("d"):
                done_checks += 1

    return {
        "total_features": total,
        "stages": stages,
        "p0_blockers": p0_items,
        "recently_updated": recent,
        "overall_progress": {
            "total_tasks": total_checks,
            "completed": done_checks,
            "pct": round((done_checks / total_checks * 100) if total_checks > 0 else 0, 1),
        },
    }


# ─── Seed data (all 35 features from audits) ─────────

@router.post("/seed")
async def seed_features():
    """Seed the project board with all 35 features from competitor audits.
    Only runs if collection is empty. Safe to call multiple times."""
    db = get_db()
    count = await db.project_features.count_documents({})
    if count > 0:
        return {"message": f"Already seeded ({count} features exist)", "seeded": False}

    now = datetime.utcnow()
    features = [
        # ═══ P0 — LAUNCH BLOCKERS ═══
        {"name":"Online food ordering flow","desc":"Full menu→cart→checkout→kitchen pipeline. Burg Burgers demo requirement.","cat":"E-Commerce","pri":"P0","stage":"backlog","comp":["Toast","Square","SevenRooms","Shopify"],"effort":"High","rev":"Very High","checks":[
            {"t":"Consumer menu page with categories","d":False},{"t":"Item detail modal + dietary badges","d":False},{"t":"Modifier groups in item view","d":False},{"t":"Cart drawer with running total","d":False},{"t":"Stripe checkout + Apple Pay","d":False},{"t":"Order→kitchen API endpoint","d":False},{"t":"Order confirmation page + email","d":False},{"t":"Restaurant order acceptance dash","d":False},{"t":"Real-time order status updates","d":False},{"t":"Mobile responsive end-to-end","d":False}
        ]},
        {"name":"Uber Direct delivery dispatch","desc":"On-demand delivery via Uber fleet. Burg Burgers paying 48% to Deliveroo.","cat":"E-Commerce","pri":"P0","stage":"backlog","comp":["Toast","Square","SevenRooms"],"effort":"Medium","rev":"Very High","checks":[
            {"t":"Uber Direct API auth + keys","d":False},{"t":"Delivery zone polygon editor","d":False},{"t":"Auto-dispatch on order accept","d":False},{"t":"Consumer live tracking widget","d":False},{"t":"Delivery fee calculation engine","d":False},{"t":"Driver status webhook handler","d":False},{"t":"Failed delivery fallback flow","d":False}
        ]},
        {"name":"Sunmi terminal order PWA","desc":"Android PWA for Sunmi V2 Pro. Order accept/reject, thermal print, delivery status.","cat":"E-Commerce","pri":"P0","stage":"backlog","comp":["Toast","Square"],"effort":"Medium","rev":"Very High","checks":[
            {"t":"PWA shell + service worker","d":False},{"t":"Order queue accept/reject UI","d":False},{"t":"Sunmi SDK thermal printer","d":False},{"t":"Push notifications new orders","d":False},{"t":"Kiosk mode auto-lock","d":False},{"t":"Offline queue + sync","d":False}
        ]},
        {"name":"Reserve with Google","desc":"Book from Google Maps/Search. All 5 booking competitors have it.","cat":"SEO","pri":"P0","stage":"backlog","comp":["OpenTable","Resy","SevenRooms","ResDiary","Quandoo"],"effort":"Medium","rev":"Very High","checks":[
            {"t":"Google Actions Center application","d":False},{"t":"Booking API endpoint (Google spec)","d":False},{"t":"Real-time availability sync","d":False},{"t":"Confirm + cancel flow","d":False},{"t":"Google sandbox testing","d":False}
        ]},

        # ═══ P1 — QUICK WINS ═══
        {"name":"Post-visit review request","desc":"Auto-email post-dining. Smart routing: 4-5★→Google, 1-3★→internal.","cat":"Reviews","pri":"P1","stage":"backlog","comp":["SevenRooms","OpenTable","Birdeye","Podium"],"effort":"Low","rev":"High","checks":[
            {"t":"Email template with star rating UI","d":False},{"t":"Auto-trigger after reservation end","d":False},{"t":"Smart routing logic","d":False},{"t":"Unsubscribe handling","d":False}
        ]},
        {"name":"Post-visit internal survey","desc":"Catch negative feedback BEFORE Google. Star + comment form, owner alert.","cat":"Reviews","pri":"P1","stage":"backlog","comp":["SevenRooms","OpenTable"],"effort":"Low","rev":"Medium","checks":[
            {"t":"Rating + comment landing page","d":False},{"t":"Store in guest profile","d":False},{"t":"Instant owner alert on <3 stars","d":False},{"t":"Dashboard feedback list view","d":False}
        ]},
        {"name":"Discount codes & coupons","desc":"Stripe Coupon API. % or £ off, usage limits, expiry dates.","cat":"E-Commerce","pri":"P1","stage":"backlog","comp":["Shopify","Square","Toast","Wix"],"effort":"Low","rev":"Medium","checks":[
            {"t":"Admin create/manage codes","d":False},{"t":"Stripe coupon sync","d":False},{"t":"Apply at checkout","d":False},{"t":"Usage limits + expiry","d":False},{"t":"Usage analytics","d":False}
        ]},
        {"name":"86 / sold-out toggle (live)","desc":"Real-time sold-out during service. Already designed — needs WebSocket push.","cat":"E-Commerce","pri":"P1","stage":"backlog","comp":["Toast","SevenRooms","Square"],"effort":"Low","rev":"Medium","checks":[
            {"t":"WebSocket broadcast channel","d":False},{"t":"Ordering page instant update","d":False},{"t":"SOLD OUT visual overlay","d":False},{"t":"One-tap restock/undo","d":False}
        ]},
        {"name":"Modifier groups","desc":"Required/optional add-ons with pricing (add bacon +£2). Critical for food ordering.","cat":"E-Commerce","pri":"P1","stage":"backlog","comp":["Toast","Square","SevenRooms","Shopify"],"effort":"Medium","rev":"High","checks":[
            {"t":"Modifier group CRUD","d":False},{"t":"Required vs optional rules","d":False},{"t":"Min/max selection limits","d":False},{"t":"Price adjustments in cart","d":False},{"t":"Consumer ordering display","d":False}
        ]},
        {"name":"QR code dine-in ordering","desc":"Scan table QR→menu→order→pay. Reduces staff load during service.","cat":"E-Commerce","pri":"P1","stage":"backlog","comp":["SevenRooms","Toast","Square"],"effort":"Medium","rev":"High","checks":[
            {"t":"QR code generator per table","d":False},{"t":"Table-linked ordering session","d":False},{"t":"Order routes to kitchen with table #","d":False},{"t":"Pay-at-table via Stripe","d":False}
        ]},
        {"name":"Order notifications (email+SMS)","desc":"Order confirmation, prep updates, ready-for-pickup, out-for-delivery.","cat":"E-Commerce","pri":"P1","stage":"backlog","comp":["Toast","Square","Shopify"],"effort":"Low","rev":"Medium","checks":[
            {"t":"Order confirmation email","d":False},{"t":"Status change email triggers","d":False},{"t":"SMS via Twilio/SNS","d":False},{"t":"Delivery tracking link","d":False}
        ]},

        # ═══ P2 — GROWTH FEATURES ═══
        {"name":"Google review reply from dashboard","desc":"Reply to Google reviews without leaving Reeve. GBP API integration.","cat":"Reviews","pri":"P2","stage":"backlog","comp":["SevenRooms","OpenTable","Birdeye","Podium","Yext","BrightLocal"],"effort":"Medium","rev":"High","checks":[
            {"t":"Google Business API auth","d":False},{"t":"Fetch reviews into dashboard","d":False},{"t":"Reply compose + submit","d":False},{"t":"Review thread view","d":False}
        ]},
        {"name":"Centralised review inbox","desc":"Google + TripAdvisor + Facebook reviews in one place.","cat":"Reviews","pri":"P2","stage":"backlog","comp":["Birdeye","Podium","BrightLocal"],"effort":"Medium","rev":"High","checks":[
            {"t":"Google Reviews API","d":False},{"t":"Facebook Reviews API","d":False},{"t":"TripAdvisor integration","d":False},{"t":"Unified inbox UI","d":False},{"t":"Reply from dashboard","d":False}
        ]},
        {"name":"Digital gift cards (e-gift)","desc":"Email/SMS gift cards. Stripe handles payment, we handle branding.","cat":"E-Commerce","pri":"P2","stage":"backlog","comp":["Toast","Square","Shopify","Wix"],"effort":"Medium","rev":"High","checks":[
            {"t":"Gift card purchase flow","d":False},{"t":"Email delivery branded design","d":False},{"t":"Unique redemption code","d":False},{"t":"Balance tracking","d":False},{"t":"POS redemption (ReeveOS)","d":False}
        ]},
        {"name":"Loyalty programme (points)","desc":"Square includes free. Toast charges £50/mo. We include on Growth tier.","cat":"E-Commerce","pri":"P2","stage":"backlog","comp":["Square","Toast"],"effort":"Medium","rev":"High","checks":[
            {"t":"Points earning rules","d":False},{"t":"Rewards catalog","d":False},{"t":"Customer loyalty card view","d":False},{"t":"Admin manage programme","d":False},{"t":"POS integration","d":False}
        ]},
        {"name":"Guest tags & VIP flagging","desc":"Manual tags first, auto-tags later. SevenRooms has unlimited auto-tags.","cat":"CRM","pri":"P2","stage":"backlog","comp":["SevenRooms","OpenTable","Resy"],"effort":"Low","rev":"Medium","checks":[
            {"t":"Tag CRUD on guest profiles","d":False},{"t":"VIP badge system","d":False},{"t":"Filter guests by tag","d":False},{"t":"Auto-tag rules (future)","d":False}
        ]},
        {"name":"Dietary preferences in profiles","desc":"Capture during booking, display to staff during service.","cat":"CRM","pri":"P2","stage":"backlog","comp":["SevenRooms","OpenTable","Resy"],"effort":"Low","rev":"Medium","checks":[
            {"t":"Dietary fields in booking form","d":False},{"t":"Store on guest profile","d":False},{"t":"Display in floor plan / service view","d":False}
        ]},
        {"name":"Daily review summary email","desc":"Morning digest — new reviews, star trend, response rate.","cat":"Reviews","pri":"P2","stage":"backlog","comp":["SevenRooms","OpenTable","Birdeye","Podium"],"effort":"Low","rev":"Medium","checks":[
            {"t":"Aggregate daily review data","d":False},{"t":"Email template","d":False},{"t":"Scheduled cron job","d":False}
        ]},
        {"name":"Smart review routing","desc":"Positive→Google review link. Negative→internal form. Protects reputation.","cat":"Reviews","pri":"P2","stage":"backlog","comp":["SevenRooms","Birdeye"],"effort":"Medium","rev":"High","checks":[
            {"t":"Rating threshold logic","d":False},{"t":"Google review deep link","d":False},{"t":"Internal feedback form","d":False},{"t":"Owner alert on negative","d":False}
        ]},
        {"name":"QR code → review link generator","desc":"Print QR on receipt/table tent → Google review page.","cat":"Reviews","pri":"P2","stage":"backlog","comp":["Birdeye","Podium"],"effort":"Low","rev":"Medium","checks":[
            {"t":"QR code generator","d":False},{"t":"Custom landing page","d":False},{"t":"Printable template","d":False}
        ]},
        {"name":"GBP listing management","desc":"Keep hours, photos, menu accurate on Google from dashboard.","cat":"SEO","pri":"P2","stage":"backlog","comp":["BrightLocal","Yext","Birdeye","Semrush"],"effort":"Medium","rev":"High","checks":[
            {"t":"Google Business API integration","d":False},{"t":"Hours/info update from dashboard","d":False},{"t":"Photo upload to GBP","d":False},{"t":"Post scheduling","d":False}
        ]},
        {"name":"Win-back campaigns (lapsed guests)","desc":"Auto 'We miss you — 10% off' for guests not seen in 30/60/90 days.","cat":"CRM","pri":"P2","stage":"backlog","comp":["SevenRooms"],"effort":"Medium","rev":"High","checks":[
            {"t":"Lapsed guest detection rule","d":False},{"t":"Email template with offer","d":False},{"t":"Auto-trigger scheduler","d":False},{"t":"Track redemptions","d":False}
        ]},
        {"name":"Spend history in guest profiles","desc":"Itemised spend per visit from ReeveOS POS integration.","cat":"CRM","pri":"P2","stage":"backlog","comp":["SevenRooms","Toast","Square"],"effort":"Medium","rev":"Medium","checks":[
            {"t":"POS → CRM data sync","d":False},{"t":"Spend display on profile","d":False},{"t":"Total lifetime spend calc","d":False}
        ]},

        # ═══ P3 — COMPETITIVE MOAT ═══
        {"name":"Auto-tagging (rules-based CRM)","desc":"Auto-tag 'big spender', 'wine lover' from POS+booking+review data. SevenRooms' moat.","cat":"CRM","pri":"P3","stage":"backlog","comp":["SevenRooms"],"effort":"High","rev":"High","checks":[
            {"t":"Rule engine architecture","d":False},{"t":"POS data triggers","d":False},{"t":"Booking data triggers","d":False},{"t":"Review sentiment triggers","d":False},{"t":"Tag assignment logic","d":False}
        ]},
        {"name":"AI review response suggestions","desc":"AI drafts reply, owner approves with one click.","cat":"Reviews","pri":"P3","stage":"backlog","comp":["Birdeye","Podium"],"effort":"Medium","rev":"Medium","checks":[
            {"t":"AI prompt engineering","d":False},{"t":"One-click approve/edit UI","d":False},{"t":"Tone/brand customisation","d":False}
        ]},
        {"name":"Email campaign builder","desc":"Drag-and-drop email builder. Replaces Mailchimp for restaurants.","cat":"CRM","pri":"P3","stage":"backlog","comp":["Mailchimp","Campaign Monitor","Brevo"],"effort":"High","rev":"High","checks":[
            {"t":"Drag-and-drop email editor","d":False},{"t":"Template library","d":False},{"t":"Audience segmentation","d":False},{"t":"A/B testing","d":False},{"t":"Send + analytics","d":False}
        ]},
        {"name":"SMS marketing campaigns","desc":"98% open rate. Podium built their business on this.","cat":"CRM","pri":"P3","stage":"backlog","comp":["Podium","Square","Toast"],"effort":"High","rev":"High","checks":[
            {"t":"Twilio/SNS integration","d":False},{"t":"Campaign builder UI","d":False},{"t":"Opt-in/opt-out compliance","d":False},{"t":"Delivery + click analytics","d":False}
        ]},
        {"name":"Abandoned cart recovery","desc":"Email/SMS when customer adds items but doesn't complete checkout.","cat":"E-Commerce","pri":"P3","stage":"backlog","comp":["Shopify","Square","Wix"],"effort":"Medium","rev":"Medium","checks":[
            {"t":"Cart persistence (30 min)","d":False},{"t":"Trigger email/SMS after X mins","d":False},{"t":"Recovery link back to cart","d":False},{"t":"Analytics on recovery rate","d":False}
        ]},
        {"name":"Sentiment analysis (AI)","desc":"Analyse review text for topics and sentiment trends over time.","cat":"Reviews","pri":"P3","stage":"backlog","comp":["Birdeye","Podium","OpenTable"],"effort":"High","rev":"Medium","checks":[
            {"t":"NLP pipeline (food, service, ambiance)","d":False},{"t":"Trend dashboard","d":False},{"t":"Alert on negative spikes","d":False}
        ]},
        {"name":"Product merchandise store","desc":"Sell sauces, merch, meal kits alongside food ordering.","cat":"E-Commerce","pri":"P3","stage":"backlog","comp":["Shopify","Square"],"effort":"High","rev":"Low","checks":[
            {"t":"Product catalog CRUD","d":False},{"t":"Shopping cart (separate from food)","d":False},{"t":"Shipping/fulfillment","d":False},{"t":"Inventory management","d":False}
        ]},
        {"name":"Schema markup / structured data","desc":"Auto-generate LocalBusiness + Restaurant schema for SEO.","cat":"SEO","pri":"P3","stage":"backlog","comp":["Yext","BrightLocal"],"effort":"Low","rev":"Medium","checks":[
            {"t":"JSON-LD generator","d":False},{"t":"Auto-inject on directory pages","d":False},{"t":"Menu + opening hours schema","d":False}
        ]},
        {"name":"GBP post scheduling","desc":"Schedule Google Business Profile posts from dashboard.","cat":"SEO","pri":"P3","stage":"backlog","comp":["BrightLocal","Birdeye","Semrush"],"effort":"Medium","rev":"Medium","checks":[
            {"t":"Post composer UI","d":False},{"t":"Image upload","d":False},{"t":"Schedule + publish via API","d":False},{"t":"Post performance analytics","d":False}
        ]},
        {"name":"Customer lifetime value (CLV)","desc":"Calculate + display CLV per guest from booking + spend data.","cat":"CRM","pri":"P3","stage":"backlog","comp":["SevenRooms","Toast"],"effort":"Medium","rev":"Medium","checks":[
            {"t":"CLV calculation formula","d":False},{"t":"Display on guest profile","d":False},{"t":"Segment by CLV tier","d":False},{"t":"CLV trend dashboard","d":False}
        ]},

        # ═══ ALREADY BUILT (mark as live) ═══
        {"name":"Booking system + Stripe deposits","desc":"Full booking flow with deposits/prepayment via Stripe Connect.","cat":"Platform","pri":"P0","stage":"live","comp":["OpenTable","Resy","SevenRooms","ResDiary"],"effort":"High","rev":"Very High","checks":[
            {"t":"Booking flow UI","d":True},{"t":"Stripe Connect integration","d":True},{"t":"Deposit/prepay logic","d":True},{"t":"Confirmation emails","d":True},{"t":"Booking management page","d":True}
        ]},
        {"name":"Floor plan management","desc":"Drag-and-drop table layout with live status during service.","cat":"Platform","pri":"P1","stage":"live","comp":["SevenRooms","OpenTable","ResDiary"],"effort":"High","rev":"High","checks":[
            {"t":"Drag-and-drop table editor","d":True},{"t":"Live status updates","d":True},{"t":"Table assignment on booking","d":True}
        ]},
        {"name":"Pre-populated directory","desc":"Google Places API populates restaurant directory. Our SEO moat.","cat":"SEO","pri":"P0","stage":"live","comp":[],"effort":"Medium","rev":"Very High","checks":[
            {"t":"Google Places API integration","d":True},{"t":"Directory search + filter","d":True},{"t":"SEO-optimised listing pages","d":True},{"t":"rezvo.co.uk consumer site","d":True}
        ]},
        {"name":"Proof-of-demand emails","desc":"When diners request bookings at unregistered restaurants, auto-email owners.","cat":"Platform","pri":"P0","stage":"live","comp":[],"effort":"Medium","rev":"Very High","checks":[
            {"t":"Interest tracking system","d":True},{"t":"Threshold-based auto-email","d":True},{"t":"Owner onboarding link","d":True}
        ]},
        {"name":"Menu management system","desc":"Categories, items, dietary badges, images, prep time, descriptions.","cat":"E-Commerce","pri":"P1","stage":"live","comp":["Toast","Square","SevenRooms"],"effort":"Medium","rev":"High","checks":[
            {"t":"Category CRUD","d":True},{"t":"Item CRUD with images","d":True},{"t":"Dietary badges (V, VE, GF, DF, NF, H)","d":True},{"t":"Prep time per item","d":True}
        ]},
    ]

    for f in features:
        f["notes"] = []
        f["history"] = [{"action": "created", "stage": f["stage"], "at": now, "by": "System (seed)"}]
        f["assignee"] = ""
        f["target_date"] = ""
        f["sort_order"] = 0
        f["created_at"] = now
        f["updated_at"] = now

    result = await db.project_features.insert_many(features)
    
    # Create indexes
    await db.project_features.create_index("stage")
    await db.project_features.create_index("pri")
    await db.project_features.create_index("cat")
    await db.project_features.create_index("updated_at")
    await db.project_features.create_index([("name", "text"), ("desc", "text")])

    return {"message": f"Seeded {len(result.inserted_ids)} features", "seeded": True}
