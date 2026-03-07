"""
CRM API — Complete client relationship management endpoints.

Covers:
- Dashboard stats + KPIs
- Client timeline (immutable audit trail)
- Manual interaction logging (calls, DMs, walk-ins)
- Tasks / follow-ups
- Analytics (funnel, channel ROI, LTV)
- Health score recalculation
- Pipeline auto-assignment
"""
from fastapi import APIRouter, Depends, Body, Query, HTTPException
from datetime import datetime, timedelta
from typing import Optional
from database import get_database
from middleware.tenant_db import get_scoped_db
from middleware.tenant import verify_business_access, TenantContext
from helpers.timeline import (
    log_event, calculate_health_score, auto_assign_pipeline_stage,
    CRM_PIPELINE_STAGES, EVENT_TYPES
)

router = APIRouter(prefix="/api/crm", tags=["CRM"])


# ═══════════════════════════════════════════════════════════════
# DASHBOARD — KPIs, stats, pipeline summary
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/dashboard")
async def get_crm_dashboard(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """CRM dashboard — KPIs, pipeline summary, recent activity, health distribution."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    biz_id = tenant.business_id
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    # Total clients
    total_clients = await sdb.clients.count_documents({"businessId": biz_id, "active": {"$ne": False}})

    # New clients this week
    new_this_week = await sdb.clients.count_documents({
        "businessId": biz_id, "active": {"$ne": False},
        "createdAt": {"$gte": seven_days_ago}
    })

    # Revenue this month (from completed bookings)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    completed_this_month = await db.bookings.find({
        "businessId": biz_id, "status": "completed",
        "date": {"$gte": month_start.strftime("%Y-%m-%d")}
    }).to_list(5000)
    revenue_mtd = sum(float(b.get("price", 0) or b.get("service", {}).get("price", 0) or 0) for b in completed_this_month)

    # Pipeline stage counts
    pipeline_counts = {}
    for stage in CRM_PIPELINE_STAGES:
        cnt = await sdb.clients.count_documents({
            "businessId": biz_id, "active": {"$ne": False},
            "pipeline_stage": stage["id"]
        })
        pipeline_counts[stage["id"]] = cnt

    # At risk + lapsed count
    at_risk_count = pipeline_counts.get("at_risk", 0) + pipeline_counts.get("lapsed", 0)

    # Consultation forms expiring (within 14 days)
    forms_expiring = await sdb.consultation_submissions.count_documents({
        "business_id": biz_id,
        "expires_at": {"$lte": (now + timedelta(days=14)).isoformat(), "$gt": now.isoformat()}
    })

    # Health score distribution
    all_clients = await sdb.clients.find(
        {"businessId": biz_id, "active": {"$ne": False}},
        {"stats": 1, "tags": 1, "vip": 1, "active_package": 1, "consultation_form_status": 1,
         "lastVisit": 1, "last_visit": 1, "pipeline_stage": 1, "health_score": 1}
    ).to_list(5000)

    health_dist = {"excellent": 0, "good": 0, "fair": 0, "poor": 0, "critical": 0}
    for c in all_clients:
        hs = c.get("health_score") or calculate_health_score(c)
        if hs >= 80:
            health_dist["excellent"] += 1
        elif hs >= 60:
            health_dist["good"] += 1
        elif hs >= 40:
            health_dist["fair"] += 1
        elif hs >= 20:
            health_dist["poor"] += 1
        else:
            health_dist["critical"] += 1

    # Recent timeline events (last 20)
    recent_events = []
    async for ev in sdb.client_timeline.find(
        {"business_id": biz_id}
    ).sort("timestamp", -1).limit(20):
        recent_events.append({
            "id": str(ev.get("_id", "")),
            "event": ev.get("event", ""),
            "summary": ev.get("summary", ""),
            "client_name": ev.get("client_name", ""),
            "client_id": ev.get("client_id", ""),
            "category": ev.get("category", ""),
            "timestamp": ev.get("timestamp", "").isoformat() if hasattr(ev.get("timestamp", ""), "isoformat") else str(ev.get("timestamp", "")),
            "actor": ev.get("actor", {}),
            "revenue_impact": ev.get("revenue_impact", 0),
        })

    # Source breakdown (top acquisition channels)
    source_pipeline = [
        {"$match": {"businessId": biz_id, "active": {"$ne": False}, "source": {"$exists": True, "$ne": ""}}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    source_counts = {}
    async for s in sdb.clients.aggregate(source_pipeline):
        source_counts[s["_id"]] = s["count"]

    # Tasks due today
    tasks_due = await sdb.client_tasks.count_documents({
        "business_id": biz_id,
        "status": {"$ne": "completed"},
        "due_date": {"$lte": now.isoformat()}
    })

    return {
        "kpis": {
            "total_clients": total_clients,
            "new_this_week": new_this_week,
            "revenue_mtd": round(revenue_mtd, 2),
            "at_risk_count": at_risk_count,
            "forms_expiring": forms_expiring,
            "tasks_due": tasks_due,
        },
        "pipeline": {
            "stages": CRM_PIPELINE_STAGES,
            "counts": pipeline_counts,
        },
        "health_distribution": health_dist,
        "recent_activity": recent_events,
        "sources": source_counts,
    }


# ═══════════════════════════════════════════════════════════════
# CLIENT TIMELINE — full history for a single client
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/client/{client_id}/timeline")
async def get_client_timeline(
    business_id: str,
    client_id: str,
    category: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get full timeline for a client — every touch point, immutable."""
    sdb = get_scoped_db(tenant.business_id)
    match = {"business_id": tenant.business_id, "client_id": client_id}
    if category:
        match["category"] = category

    total = await sdb.client_timeline.count_documents(match)
    events = []
    async for ev in sdb.client_timeline.find(match).sort("timestamp", -1).skip(skip).limit(limit):
        events.append({
            "id": str(ev.get("_id", "")),
            "event": ev.get("event", ""),
            "category": ev.get("category", ""),
            "summary": ev.get("summary", ""),
            "details": ev.get("details", {}),
            "actor": ev.get("actor", {}),
            "revenue_impact": ev.get("revenue_impact", 0),
            "timestamp": ev.get("timestamp", "").isoformat() if hasattr(ev.get("timestamp", ""), "isoformat") else str(ev.get("timestamp", "")),
            "metadata": ev.get("metadata", {}),
        })

    return {"events": events, "total": total, "categories": list(set(e["category"] for e in events))}


# ═══════════════════════════════════════════════════════════════
# MANUAL INTERACTION LOGGING — calls, DMs, walk-in enquiries
# ═══════════════════════════════════════════════════════════════

INTERACTION_TYPES = ["phone_call", "walkin_enquiry", "dm_received", "whatsapp", "email", "in_person", "other"]
INTERACTION_OUTCOMES = ["booked", "interested", "not_interested", "follow_up_needed", "no_answer", "voicemail", "info_provided"]

@router.post("/business/{business_id}/client/{client_id}/interaction")
async def log_interaction(
    business_id: str,
    client_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Log a manual interaction — phone call, walk-in enquiry, DM, etc."""
    sdb = get_scoped_db(tenant.business_id)
    db = get_database()

    interaction_type = payload.get("type", "other")
    summary = payload.get("summary", "").strip()
    outcome = payload.get("outcome", "")
    follow_up_date = payload.get("follow_up_date")
    staff_name = payload.get("staff_name", "Staff")
    staff_id = payload.get("staff_id", "")

    if not summary:
        raise HTTPException(400, "Summary required")

    # Get client name
    client = await sdb.clients.find_one({"businessId": tenant.business_id, "id": client_id})
    if not client:
        from bson import ObjectId
        try:
            client = await sdb.clients.find_one({"_id": ObjectId(client_id)})
        except Exception:
            pass
    client_name = client.get("name", "Unknown") if client else "Unknown"

    # Map interaction type to timeline event
    event_map = {
        "phone_call": "comms.phone_call",
        "walkin_enquiry": "comms.walkin_enquiry",
        "dm_received": "comms.dm_received",
        "whatsapp": "comms.whatsapp",
        "email": "comms.email_sent",
        "in_person": "comms.walkin_enquiry",
        "other": "comms.phone_call",
    }

    await log_event(
        sdb, tenant.business_id, client_id,
        event=event_map.get(interaction_type, "comms.phone_call"),
        summary=summary,
        details={
            "interaction_type": interaction_type,
            "outcome": outcome,
            "follow_up_date": follow_up_date,
        },
        actor={"type": "staff", "name": staff_name, "id": staff_id},
        client_name=client_name,
    )

    # Create follow-up task if requested
    if follow_up_date and outcome == "follow_up_needed":
        task = {
            "business_id": tenant.business_id,
            "client_id": client_id,
            "client_name": client_name,
            "title": f"Follow up: {summary[:80]}",
            "description": summary,
            "assigned_to": staff_id or "",
            "assigned_name": staff_name,
            "due_date": follow_up_date,
            "status": "pending",
            "priority": "normal",
            "source_event": interaction_type,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        await sdb.client_tasks.insert_one(task)

        await log_event(
            sdb, tenant.business_id, client_id,
            event="pipeline.task_created",
            summary=f"Follow-up task: {summary[:60]}",
            details={"due_date": follow_up_date, "assigned_to": staff_name},
            actor={"type": "staff", "name": staff_name, "id": staff_id},
            client_name=client_name,
        )

    return {"status": "logged", "type": interaction_type}


# ═══════════════════════════════════════════════════════════════
# TASKS — follow-ups, to-dos linked to clients
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/tasks")
async def get_tasks(
    business_id: str,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get all CRM tasks (follow-ups, to-dos)."""
    sdb = get_scoped_db(tenant.business_id)
    match = {"business_id": tenant.business_id}
    if status:
        match["status"] = status
    if assigned_to:
        match["assigned_to"] = assigned_to

    tasks = []
    async for t in sdb.client_tasks.find(match).sort("due_date", 1).limit(100):
        tasks.append({
            "id": str(t.get("_id", "")),
            "client_id": t.get("client_id", ""),
            "client_name": t.get("client_name", ""),
            "title": t.get("title", ""),
            "description": t.get("description", ""),
            "assigned_to": t.get("assigned_to", ""),
            "assigned_name": t.get("assigned_name", ""),
            "due_date": t.get("due_date", ""),
            "status": t.get("status", "pending"),
            "priority": t.get("priority", "normal"),
            "source_event": t.get("source_event", ""),
            "created_at": t.get("created_at", "").isoformat() if hasattr(t.get("created_at", ""), "isoformat") else str(t.get("created_at", "")),
        })

    overdue = sum(1 for t in tasks if t["status"] != "completed" and t["due_date"] and t["due_date"] < datetime.utcnow().isoformat())

    return {"tasks": tasks, "total": len(tasks), "overdue": overdue}


@router.post("/business/{business_id}/tasks")
async def create_task(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Create a CRM task / follow-up."""
    sdb = get_scoped_db(tenant.business_id)

    task = {
        "business_id": tenant.business_id,
        "client_id": payload.get("client_id", ""),
        "client_name": payload.get("client_name", ""),
        "title": payload.get("title", ""),
        "description": payload.get("description", ""),
        "assigned_to": payload.get("assigned_to", ""),
        "assigned_name": payload.get("assigned_name", ""),
        "due_date": payload.get("due_date", ""),
        "status": "pending",
        "priority": payload.get("priority", "normal"),
        "source_event": payload.get("source_event", "manual"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await sdb.client_tasks.insert_one(task)

    if task["client_id"]:
        await log_event(
            sdb, tenant.business_id, task["client_id"],
            event="pipeline.task_created",
            summary=f"Task: {task['title'][:60]}",
            details={"due_date": task["due_date"], "assigned_to": task["assigned_name"]},
            actor={"type": "staff", "name": task["assigned_name"]},
            client_name=task["client_name"],
        )

    return {"status": "created", "id": str(result.inserted_id)}


@router.patch("/business/{business_id}/tasks/{task_id}")
async def update_task(
    business_id: str,
    task_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Update a task (complete, reschedule, reassign)."""
    sdb = get_scoped_db(tenant.business_id)
    from bson import ObjectId

    update = {"updated_at": datetime.utcnow()}
    for field in ["status", "due_date", "assigned_to", "assigned_name", "priority", "title", "description"]:
        if field in payload:
            update[field] = payload[field]

    try:
        result = await sdb.client_tasks.find_one_and_update(
            {"_id": ObjectId(task_id), "business_id": tenant.business_id},
            {"$set": update},
            return_document=True,
        )
    except Exception:
        raise HTTPException(404, "Task not found")

    if result and payload.get("status") == "completed" and result.get("client_id"):
        await log_event(
            sdb, tenant.business_id, result["client_id"],
            event="pipeline.task_completed",
            summary=f"Completed: {result.get('title', '')[:60]}",
            actor={"type": "staff", "name": payload.get("completed_by", "Staff")},
            client_name=result.get("client_name", ""),
        )

    return {"status": "updated"}


# ═══════════════════════════════════════════════════════════════
# PIPELINE — kanban view with auto-assignment
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/pipeline")
async def get_pipeline(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get all clients grouped by pipeline stage."""
    sdb = get_scoped_db(tenant.business_id)
    biz_id = tenant.business_id

    clients_raw = await sdb.clients.find(
        {"businessId": biz_id, "active": {"$ne": False}}
    ).to_list(2000)

    pipeline = {s["id"]: [] for s in CRM_PIPELINE_STAGES}

    for c in clients_raw:
        stage = c.get("pipeline_stage") or auto_assign_pipeline_stage(c)
        hs = c.get("health_score") or calculate_health_score(c)
        stats = c.get("stats", {})

        entry = {
            "id": c.get("id") or str(c.get("_id", "")),
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "phone": c.get("phone", ""),
            "stage": stage,
            "health_score": hs,
            "source": c.get("source", ""),
            "tags": c.get("tags", []),
            "last_visit": stats.get("lastVisit") or c.get("lastVisit", ""),
            "total_spend": stats.get("totalSpent", 0) or stats.get("spend", 0),
            "total_visits": stats.get("totalBookings", 0) or stats.get("visits", 0),
            "no_shows": stats.get("noShows", 0),
            "active_package": c.get("active_package"),
            "pipeline_value": c.get("pipeline_value", 0),
            "created_at": c.get("createdAt", "").isoformat() if hasattr(c.get("createdAt", ""), "isoformat") else str(c.get("createdAt", "")),
        }

        if stage in pipeline:
            pipeline[stage].append(entry)
        else:
            pipeline.setdefault("new_lead", []).append(entry)

    # Stage values
    stage_values = {}
    total_value = 0
    for stage_id, clients in pipeline.items():
        sv = sum(c.get("pipeline_value", 0) or c.get("total_spend", 0) for c in clients)
        stage_values[stage_id] = sv
        total_value += sv

    return {
        "stages": CRM_PIPELINE_STAGES,
        "pipeline": pipeline,
        "stage_values": stage_values,
        "total_clients": len(clients_raw),
        "total_value": round(total_value, 2),
    }


@router.patch("/business/{business_id}/pipeline/{client_id}/move")
async def move_pipeline(
    business_id: str,
    client_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Move a client to a different pipeline stage (manual override)."""
    sdb = get_scoped_db(tenant.business_id)
    from bson import ObjectId

    new_stage = payload.get("stage")
    if not new_stage:
        raise HTTPException(400, "Stage required")

    update = {"pipeline_stage": new_stage, "pipeline_manual_override": True, "updatedAt": datetime.utcnow()}
    if "value" in payload:
        update["pipeline_value"] = float(payload["value"])

    result = await sdb.clients.update_one({"id": client_id, "businessId": tenant.business_id}, {"$set": update})
    if result.matched_count == 0:
        try:
            await sdb.clients.update_one({"_id": ObjectId(client_id), "businessId": tenant.business_id}, {"$set": update})
        except Exception:
            pass

    client = await sdb.clients.find_one({"$or": [{"id": client_id}, {"_id": client_id}], "businessId": tenant.business_id})
    client_name = client.get("name", "") if client else ""

    await log_event(
        sdb, tenant.business_id, client_id,
        event="pipeline.stage_changed",
        summary=f"Moved to {new_stage}",
        details={"new_stage": new_stage, "manual": True},
        actor={"type": "staff", "name": payload.get("staff_name", "Staff")},
        client_name=client_name,
    )

    return {"status": "moved", "stage": new_stage}


# ═══════════════════════════════════════════════════════════════
# CLIENT DETAIL — enhanced data for CRM detail view
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/client/{client_id}")
async def get_client_crm_detail(
    business_id: str,
    client_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get full CRM detail for a client — profile, stats, timeline, tasks, preferences."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    biz_id = tenant.business_id

    # Find client
    client = await sdb.clients.find_one({"businessId": biz_id, "id": client_id, "active": {"$ne": False}})
    if not client:
        from bson import ObjectId
        try:
            client = await sdb.clients.find_one({"_id": ObjectId(client_id), "businessId": biz_id, "active": {"$ne": False}})
        except Exception:
            pass
    if not client:
        raise HTTPException(404, "Client not found")

    cid = client.get("id") or str(client.get("_id", ""))
    stats = client.get("stats", {})

    # Health score
    health_score = calculate_health_score(client)

    # Pipeline stage
    stage = client.get("pipeline_stage") or auto_assign_pipeline_stage(client)

    # Recent bookings
    email = (client.get("email") or "").strip().lower()
    phone = client.get("phoneNormalized") or client.get("phone", "")
    booking_match = {"businessId": biz_id, "status": {"$nin": ["cancelled"]}}
    ors = [{"customerId": cid}]
    if email:
        ors.append({"customer.email": {"$regex": email, "$options": "i"}})
    if phone and len(phone) >= 6:
        ors.append({"customer.phone": {"$regex": phone[-8:]}})
    booking_match["$or"] = ors

    bookings = await db.bookings.find(booking_match).sort("date", -1).limit(20).to_list(20)
    booking_list = [{
        "id": str(b.get("_id", "")),
        "date": b.get("date", ""),
        "time": b.get("time", ""),
        "service": b.get("service", {}).get("name", "") if isinstance(b.get("service"), dict) else str(b.get("service", "")),
        "staff": b.get("staffName", ""),
        "status": b.get("status", ""),
        "price": b.get("price", 0) or b.get("service", {}).get("price", 0) if isinstance(b.get("service"), dict) else 0,
    } for b in bookings]

    # Consultation form status
    form = await sdb.consultation_submissions.find_one(
        {"business_id": biz_id, "$or": [{"client_email": email}, {"client_phone": phone}]},
        sort=[("submitted_at", -1)]
    ) if (email or phone) else None

    form_status = None
    if form:
        expires = form.get("expires_at", "")
        if expires and expires > datetime.utcnow().isoformat():
            form_status = "valid"
        else:
            form_status = "expired"

    # Tasks for this client
    tasks = []
    async for t in sdb.client_tasks.find(
        {"business_id": biz_id, "client_id": cid, "status": {"$ne": "completed"}}
    ).sort("due_date", 1).limit(10):
        tasks.append({
            "id": str(t.get("_id", "")),
            "title": t.get("title", ""),
            "due_date": t.get("due_date", ""),
            "status": t.get("status", ""),
            "assigned_name": t.get("assigned_name", ""),
        })

    # Referral info
    referral_count = await sdb.clients.count_documents({"businessId": biz_id, "referrer_id": cid})

    # LTV breakdown (simplified — expand later)
    treatment_revenue = stats.get("totalSpent", 0) or stats.get("spend", 0) or 0
    package_revenue = client.get("package_revenue", 0)
    retail_revenue = client.get("retail_revenue", 0)

    return {
        "client": {
            "id": cid,
            "name": client.get("name", ""),
            "email": client.get("email", ""),
            "phone": client.get("phone", ""),
            "tags": client.get("tags", []),
            "vip": client.get("vip", False),
            "source": client.get("source", ""),
            "source_medium": client.get("source_medium", ""),
            "source_campaign": client.get("source_campaign", ""),
            "referrer_id": client.get("referrer_id", ""),
            "notes": client.get("notes", []),
            "created_at": client.get("createdAt", "").isoformat() if hasattr(client.get("createdAt", ""), "isoformat") else str(client.get("createdAt", "")),
        },
        "stats": {
            "total_visits": stats.get("totalBookings", 0) or stats.get("visits", 0),
            "total_spend": treatment_revenue,
            "avg_spend": stats.get("averageSpend", 0) or stats.get("avgSpend", 0),
            "no_shows": stats.get("noShows", 0),
            "cancellations": stats.get("cancellations", 0),
            "last_visit": stats.get("lastVisit", ""),
            "first_visit": stats.get("firstVisit", ""),
        },
        "health_score": health_score,
        "pipeline_stage": stage,
        "consultation_form_status": form_status,
        "bookings": booking_list,
        "tasks": tasks,
        "referral_count": referral_count,
        "ltv": {
            "treatments": round(treatment_revenue, 2),
            "packages": round(package_revenue, 2),
            "retail": round(retail_revenue, 2),
            "total": round(treatment_revenue + package_revenue + retail_revenue, 2),
        },
        "preferences": client.get("preferences", {}),
    }


# ═══════════════════════════════════════════════════════════════
# UPDATE CLIENT PREFERENCES
# ═══════════════════════════════════════════════════════════════

@router.patch("/business/{business_id}/client/{client_id}/preferences")
async def update_preferences(
    business_id: str,
    client_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Update structured client preferences (therapist, comms, time slots, sensitivities)."""
    sdb = get_scoped_db(tenant.business_id)
    from bson import ObjectId

    prefs = payload.get("preferences", {})
    update = {f"preferences.{k}": v for k, v in prefs.items()}
    update["updatedAt"] = datetime.utcnow()

    result = await sdb.clients.update_one({"id": client_id, "businessId": tenant.business_id}, {"$set": update})
    if result.matched_count == 0:
        try:
            await sdb.clients.update_one({"_id": ObjectId(client_id)}, {"$set": update})
        except Exception:
            pass

    client = await sdb.clients.find_one({"$or": [{"id": client_id}, {"_id": client_id}], "businessId": tenant.business_id})
    await log_event(
        sdb, tenant.business_id, client_id,
        event="profile.preference_updated",
        summary=f"Preferences updated: {', '.join(prefs.keys())}",
        details=prefs,
        actor={"type": "staff", "name": payload.get("staff_name", "Staff")},
        client_name=client.get("name", "") if client else "",
    )

    return {"status": "updated"}


# ═══════════════════════════════════════════════════════════════
# UPDATE CLIENT SOURCE / ACQUISITION
# ═══════════════════════════════════════════════════════════════

@router.patch("/business/{business_id}/client/{client_id}/source")
async def update_source(
    business_id: str,
    client_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Update how a client was acquired (source, medium, campaign, referrer)."""
    sdb = get_scoped_db(tenant.business_id)
    from bson import ObjectId

    update = {"updatedAt": datetime.utcnow()}
    for field in ["source", "source_medium", "source_campaign", "referrer_id", "acquisition_cost"]:
        if field in payload:
            update[field] = payload[field]

    result = await sdb.clients.update_one({"id": client_id, "businessId": tenant.business_id}, {"$set": update})
    if result.matched_count == 0:
        try:
            await sdb.clients.update_one({"_id": ObjectId(client_id)}, {"$set": update})
        except Exception:
            pass

    return {"status": "updated"}


# ═══════════════════════════════════════════════════════════════
# ANALYTICS — funnel, channel ROI, LTV, staff performance
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/analytics")
async def get_analytics(
    business_id: str,
    period_days: int = Query(30, ge=7, le=365),
    tenant: TenantContext = Depends(verify_business_access),
):
    """CRM analytics — funnel, source breakdown, staff performance."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    biz_id = tenant.business_id
    now = datetime.utcnow()
    period_start = now - timedelta(days=period_days)

    # All clients
    all_clients = await sdb.clients.find({"businessId": biz_id, "active": {"$ne": False}}).to_list(5000)

    # Funnel
    funnel = {
        "new_lead": 0, "consultation": 0, "first_treatment": 0,
        "regular": 0, "package_holder": 0, "at_risk": 0, "lapsed": 0,
    }
    for c in all_clients:
        stage = c.get("pipeline_stage") or auto_assign_pipeline_stage(c)
        if stage in funnel:
            funnel[stage] += 1

    # Source breakdown with revenue
    source_data = {}
    for c in all_clients:
        src = c.get("source", "unknown") or "unknown"
        if src not in source_data:
            source_data[src] = {"count": 0, "revenue": 0, "avg_visits": 0, "total_visits": 0}
        source_data[src]["count"] += 1
        stats = c.get("stats", {})
        source_data[src]["revenue"] += stats.get("totalSpent", 0) or stats.get("spend", 0) or 0
        source_data[src]["total_visits"] += stats.get("totalBookings", 0) or stats.get("visits", 0) or 0

    for src in source_data:
        if source_data[src]["count"] > 0:
            source_data[src]["avg_visits"] = round(source_data[src]["total_visits"] / source_data[src]["count"], 1)
            source_data[src]["ltv"] = round(source_data[src]["revenue"] / source_data[src]["count"], 2)

    # Staff performance (from completed bookings)
    completed = await db.bookings.find({
        "businessId": biz_id, "status": "completed",
        "date": {"$gte": period_start.strftime("%Y-%m-%d")}
    }).to_list(5000)

    staff_perf = {}
    for b in completed:
        staff = b.get("staffName") or b.get("staff_name", "Unassigned")
        if staff not in staff_perf:
            staff_perf[staff] = {"bookings": 0, "revenue": 0, "clients": set()}
        staff_perf[staff]["bookings"] += 1
        staff_perf[staff]["revenue"] += float(b.get("price", 0) or b.get("service", {}).get("price", 0) or 0)
        cname = b.get("customerName") or b.get("customer", {}).get("name", "")
        if cname:
            staff_perf[staff]["clients"].add(cname)

    staff_list = []
    for name, data in staff_perf.items():
        staff_list.append({
            "name": name,
            "bookings": data["bookings"],
            "revenue": round(data["revenue"], 2),
            "unique_clients": len(data["clients"]),
            "avg_revenue_per_booking": round(data["revenue"] / data["bookings"], 2) if data["bookings"] > 0 else 0,
        })
    staff_list.sort(key=lambda x: x["revenue"], reverse=True)

    # Retention rate (clients who visited in both current and previous period)
    prev_start = period_start - timedelta(days=period_days)
    current_visitors = set()
    for b in completed:
        cname = b.get("customerName") or b.get("customer", {}).get("name", "")
        if cname:
            current_visitors.add(cname)

    prev_completed = await db.bookings.find({
        "businessId": biz_id, "status": "completed",
        "date": {"$gte": prev_start.strftime("%Y-%m-%d"), "$lt": period_start.strftime("%Y-%m-%d")}
    }).to_list(5000)

    prev_visitors = set()
    for b in prev_completed:
        cname = b.get("customerName") or b.get("customer", {}).get("name", "")
        if cname:
            prev_visitors.add(cname)

    retained = current_visitors & prev_visitors
    retention_rate = round(len(retained) / len(prev_visitors) * 100, 1) if prev_visitors else 0

    return {
        "period_days": period_days,
        "funnel": funnel,
        "sources": source_data,
        "staff_performance": staff_list,
        "retention_rate": retention_rate,
        "total_clients": len(all_clients),
        "total_revenue_period": round(sum(float(b.get("price", 0) or b.get("service", {}).get("price", 0) or 0) for b in completed), 2),
    }


# ═══════════════════════════════════════════════════════════════
# HEALTH SCORE RECALCULATION — batch update
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/recalculate")
async def recalculate_health_scores(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Recalculate health scores and pipeline stages for all clients."""
    sdb = get_scoped_db(tenant.business_id)
    biz_id = tenant.business_id

    clients = await sdb.clients.find({"businessId": biz_id, "active": {"$ne": False}}).to_list(5000)
    updated = 0

    for c in clients:
        hs = calculate_health_score(c)
        stage = auto_assign_pipeline_stage(c) if not c.get("pipeline_manual_override") else c.get("pipeline_stage", "new_lead")

        await sdb.clients.update_one(
            {"_id": c["_id"]},
            {"$set": {"health_score": hs, "pipeline_stage": stage, "updatedAt": datetime.utcnow()}}
        )
        updated += 1

    return {"status": "recalculated", "updated": updated}
