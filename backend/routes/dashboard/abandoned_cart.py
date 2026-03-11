"""
Abandoned Cart Tracking
=======================
5C: Track incomplete bookings, compute recovery stats, log recovery triggers.
All endpoints tenant-isolated via verify_business_access.
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from database import get_database
from middleware.tenant import verify_business_access, TenantContext
from bson import ObjectId
import logging

logger = logging.getLogger("abandoned_cart")
router = APIRouter(prefix="/abandoned-cart", tags=["abandoned-cart"])

VALID_STAGES = {"service_selected", "addons_selected", "payment_started"}
VALID_TRIGGERS = {"1hr_email", "24hr_sms", "72hr_email"}


@router.post("/business/{business_id}/log")
async def log_abandoned_cart(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Log an abandoned cart when booking flow is not completed."""
    client_id = (payload.get("client_id") or "").strip()
    client_email = (payload.get("client_email") or "").strip().lower()
    service_id = (payload.get("service_id") or "").strip()
    service_name = (payload.get("service_name") or "").strip()
    addons = payload.get("addons", [])
    total_price = payload.get("total_price", 0)
    stage = (payload.get("stage") or "service_selected").strip()

    if not service_id and not service_name:
        raise HTTPException(400, "service_id or service_name is required")
    if stage not in VALID_STAGES:
        raise HTTPException(400, f"Invalid stage. Must be one of: {', '.join(sorted(VALID_STAGES))}")

    db = get_database()
    now = datetime.utcnow()

    doc = {
        "businessId": business_id,
        "client_id": client_id,
        "client_email": client_email,
        "service_id": service_id,
        "service_name": service_name,
        "addons": addons,
        "total_price": total_price,
        "stage": stage,
        "status": "abandoned",
        "created_at": now,
        "abandoned_at": now,
        "recovery_triggers": [],
        "recovered": False,
        "recovered_at": None,
    }

    result = await db.abandoned_carts.insert_one(doc)
    cart_id = str(result.inserted_id)

    logger.info(f"Abandoned cart logged: {cart_id} stage={stage} service={service_name or service_id} business={business_id}")
    return {"ok": True, "cart_id": cart_id, "stage": stage}


@router.get("/business/{business_id}")
async def list_abandoned_carts(
    business_id: str,
    days: int = Query(30, ge=1, le=90),
    stage: str = Query(None),
    status: str = Query("abandoned"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    tenant: TenantContext = Depends(verify_business_access),
):
    """List abandoned carts for the last N days."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days)

    query = {
        "businessId": business_id,
        "created_at": {"$gte": cutoff},
    }
    if stage:
        query["stage"] = stage
    if status:
        query["status"] = status

    total = await db.abandoned_carts.count_documents(query)
    cursor = db.abandoned_carts.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    carts = []
    for d in docs:
        carts.append({
            "id": str(d["_id"]),
            "client_id": d.get("client_id", ""),
            "client_email": d.get("client_email", ""),
            "service_id": d.get("service_id", ""),
            "service_name": d.get("service_name", ""),
            "addons": d.get("addons", []),
            "total_price": d.get("total_price", 0),
            "stage": d.get("stage", ""),
            "status": d.get("status", "abandoned"),
            "created_at": d["created_at"].isoformat() if d.get("created_at") else "",
            "recovered": d.get("recovered", False),
            "recovered_at": d["recovered_at"].isoformat() if d.get("recovered_at") else None,
            "recovery_triggers": d.get("recovery_triggers", []),
        })

    return {"carts": carts, "total": total, "days": days}


@router.get("/business/{business_id}/stats")
async def get_abandoned_cart_stats(
    business_id: str,
    days: int = Query(30, ge=1, le=90),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Recovery rate, total lost revenue, average cart value."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days)

    query = {"businessId": business_id, "created_at": {"$gte": cutoff}}

    total_carts = await db.abandoned_carts.count_documents(query)
    if total_carts == 0:
        return {
            "total_abandoned": 0,
            "total_recovered": 0,
            "recovery_rate": 0,
            "total_lost_revenue": 0,
            "total_recovered_revenue": 0,
            "average_cart_value": 0,
            "by_stage": {},
            "days": days,
        }

    recovered_carts = await db.abandoned_carts.count_documents({**query, "recovered": True})

    # Aggregate revenue
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total_value": {"$sum": "$total_price"},
            "recovered_value": {"$sum": {"$cond": ["$recovered", "$total_price", 0]}},
        }},
    ]
    agg = await db.abandoned_carts.aggregate(pipeline).to_list(1)
    totals = agg[0] if agg else {"total_value": 0, "recovered_value": 0}

    total_value = totals["total_value"]
    recovered_value = totals["recovered_value"]
    lost_revenue = total_value - recovered_value

    # Breakdown by stage
    stage_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$stage",
            "count": {"$sum": 1},
            "value": {"$sum": "$total_price"},
            "recovered": {"$sum": {"$cond": ["$recovered", 1, 0]}},
        }},
    ]
    stage_agg = await db.abandoned_carts.aggregate(stage_pipeline).to_list(10)
    by_stage = {}
    for s in stage_agg:
        by_stage[s["_id"]] = {
            "count": s["count"],
            "value": s["value"],
            "recovered": s["recovered"],
        }

    return {
        "total_abandoned": total_carts,
        "total_recovered": recovered_carts,
        "recovery_rate": round(recovered_carts / total_carts * 100, 1) if total_carts else 0,
        "total_lost_revenue": round(lost_revenue, 2),
        "total_recovered_revenue": round(recovered_value, 2),
        "average_cart_value": round(total_value / total_carts, 2) if total_carts else 0,
        "by_stage": by_stage,
        "days": days,
    }


@router.post("/business/{business_id}/{cart_id}/recover")
async def recover_cart(
    business_id: str,
    cart_id: str,
    payload: dict = Body({}),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Mark an abandoned cart as recovered when client completes booking."""
    db = get_database()
    now = datetime.utcnow()

    result = await db.abandoned_carts.update_one(
        {"_id": ObjectId(cart_id), "businessId": business_id, "recovered": False},
        {"$set": {
            "recovered": True,
            "recovered_at": now,
            "status": "recovered",
            "recovered_by": tenant.user_id,
            "booking_id": payload.get("booking_id", ""),
        }},
    )

    if result.matched_count == 0:
        raise HTTPException(404, "Cart not found or already recovered")

    logger.info(f"Cart recovered: {cart_id} business={business_id}")
    return {"ok": True, "recovered_at": now.isoformat()}


@router.post("/business/{business_id}/{cart_id}/trigger")
async def log_recovery_trigger(
    business_id: str,
    cart_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Log a recovery trigger (email/SMS sent to recover an abandoned cart)."""
    trigger = (payload.get("trigger") or "").strip()
    if trigger not in VALID_TRIGGERS:
        raise HTTPException(400, f"Invalid trigger. Must be one of: {', '.join(sorted(VALID_TRIGGERS))}")

    db = get_database()
    now = datetime.utcnow()

    trigger_doc = {
        "trigger": trigger,
        "sent_at": now.isoformat(),
        "recovered": False,
    }

    result = await db.abandoned_carts.update_one(
        {"_id": ObjectId(cart_id), "businessId": business_id},
        {"$push": {"recovery_triggers": trigger_doc}},
    )

    if result.matched_count == 0:
        raise HTTPException(404, "Cart not found")

    logger.info(f"Recovery trigger logged: {trigger} cart={cart_id} business={business_id}")
    return {"ok": True, "trigger": trigger_doc}
