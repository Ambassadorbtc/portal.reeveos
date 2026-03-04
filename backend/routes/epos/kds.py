"""
ReeveOS EPOS — Kitchen Display System (KDS) API
================================================
Real-time kitchen ticket management with station routing,
course firing, prep timers, and fulfillment tracking.
"""
from fastapi import Depends, APIRouter, HTTPException, Body, Query
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
import logging
from middleware.tenant import verify_business_access, TenantContext

logger = logging.getLogger("kds")
router = APIRouter(prefix="/kds", tags=["Kitchen Display"])


# ─── Station Config ─── #

@router.get("/business/{business_id}/stations")
async def get_stations(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get KDS station configuration for a business."""
    db = get_database()
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    stations = biz.get("kds_stations", []) if biz else []
    if not stations:
        # Default stations
        stations = [
            {"id": "main", "name": "Main Kitchen", "type": "prep", "categories": [], "color": "#22c55e"},
            {"id": "bar", "name": "Bar", "type": "prep", "categories": ["drinks", "cocktails"], "color": "#3b82f6"},
            {"id": "expo", "name": "Expo / Pass", "type": "expediter", "categories": [], "color": "#f97316"},
        ]
    return {"stations": stations}


@router.put("/business/{business_id}/stations")
async def update_stations(business_id: str, tenant: TenantContext = Depends(verify_business_access), stations: List[dict] = Body(...)):
    """Update KDS station config (which categories route where)."""
    db = get_database()
    await db.businesses.update_one(
        {"_id": ObjectId(business_id)},
        {"$set": {"kds_stations": stations, "updated_at": datetime.utcnow()}}
    )
    return {"message": f"Updated {len(stations)} stations"}


# ─── Live Tickets ─── #

@router.get("/business/{business_id}/tickets")
async def get_live_tickets(
    business_id: str,
    station: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get live KDS tickets for a business/station."""
    db = get_database()
    query = {
        "business_id": business_id,
        "status": {"$in": ["new", "in_progress"]} if not status else status,
    }

    tickets = []
    async for doc in db.kds_tickets.find(query).sort("created_at", 1).limit(limit):
        doc["_id"] = str(doc["_id"])
        # Calculate elapsed time
        elapsed = round((datetime.utcnow() - doc["created_at"]).total_seconds() / 60, 1)
        doc["elapsed_minutes"] = elapsed
        # Color coding by age
        if elapsed > 15:
            doc["urgency"] = "critical"  # red
        elif elapsed > 10:
            doc["urgency"] = "warning"  # amber
        elif elapsed > 5:
            doc["urgency"] = "attention"  # yellow
        else:
            doc["urgency"] = "normal"  # green
        tickets.append(doc)

    return {"tickets": tickets, "count": len(tickets)}


@router.get("/business/{business_id}/tickets/all-day")
async def get_all_day_view(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """All-day summary — item counts needed across all open tickets."""
    db = get_database()
    pipeline = [
        {"$match": {
            "business_id": business_id,
            "status": {"$in": ["new", "in_progress"]},
        }},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.name",
            "total_quantity": {"$sum": "$items.quantity"},
            "tickets": {"$sum": 1},
        }},
        {"$sort": {"total_quantity": -1}},
    ]

    items = []
    async for doc in db.kds_tickets.aggregate(pipeline):
        items.append({
            "item": doc["_id"],
            "quantity": doc["total_quantity"],
            "tickets": doc["tickets"],
        })

    return {"all_day": items}


# ─── Ticket Actions ─── #

@router.put("/business/{business_id}/tickets/{ticket_id}/start")
async def start_ticket(ticket_id: str, business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Mark ticket as in progress (chef started working)."""
    db = get_database()
    result = await db.kds_tickets.update_one(
        {"_id": ObjectId(ticket_id), "business_id": business_id, "status": "new"},
        {"$set": {"status": "in_progress", "started_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Ticket not found or already started")
    return {"message": "Ticket started"}


@router.put("/business/{business_id}/tickets/{ticket_id}/item/{item_index}/done")
async def mark_item_done(ticket_id: str, item_index: int, business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Mark individual item as prepared."""
    db = get_database()
    ticket = await db.kds_tickets.find_one({"_id": ObjectId(ticket_id), "business_id": business_id})
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    if item_index >= len(ticket["items"]):
        raise HTTPException(400, "Invalid item index")

    ticket["items"][item_index]["done"] = True
    ticket["items"][item_index]["done_at"] = datetime.utcnow()

    # Check if all items done
    all_done = all(item.get("done") for item in ticket["items"])

    update = {"items": ticket["items"]}
    if all_done:
        update["status"] = "ready"
        update["completed_at"] = datetime.utcnow()

    await db.kds_tickets.update_one(
        {"_id": ObjectId(ticket_id)},
        {"$set": update}
    )

    return {"message": "Item marked done", "all_done": all_done}


@router.put("/business/{business_id}/tickets/{ticket_id}/ready")
async def mark_ticket_ready(ticket_id: str, business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Bump ticket — mark entire ticket as ready for service."""
    db = get_database()
    now = datetime.utcnow()
    ticket = await db.kds_tickets.find_one({"_id": ObjectId(ticket_id), "business_id": business_id})
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    # Mark all items done
    for item in ticket["items"]:
        if not item.get("done"):
            item["done"] = True
            item["done_at"] = now

    # Calculate prep time
    prep_time = None
    if ticket.get("started_at"):
        prep_time = round((now - ticket["started_at"]).total_seconds() / 60, 1)
    elif ticket.get("created_at"):
        prep_time = round((now - ticket["created_at"]).total_seconds() / 60, 1)

    await db.kds_tickets.update_one(
        {"_id": ObjectId(ticket_id)},
        {"$set": {
            "status": "ready",
            "items": ticket["items"],
            "completed_at": now,
            "prep_time_minutes": prep_time,
        }}
    )

    return {"message": "Ticket ready", "prep_time_minutes": prep_time}


@router.put("/business/{business_id}/tickets/{ticket_id}/served")
async def mark_ticket_served(ticket_id: str, business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Mark ticket as served to customer (removes from KDS)."""
    db = get_database()
    await db.kds_tickets.update_one(
        {"_id": ObjectId(ticket_id), "business_id": business_id},
        {"$set": {"status": "served", "served_at": datetime.utcnow()}}
    )
    return {"message": "Ticket served"}


@router.put("/business/{business_id}/tickets/{ticket_id}/recall")
async def recall_ticket(ticket_id: str, business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Recall last bumped ticket back to screen."""
    db = get_database()
    result = await db.kds_tickets.update_one(
        {"_id": ObjectId(ticket_id), "business_id": business_id, "status": {"$in": ["ready", "served"]}},
        {"$set": {"status": "in_progress", "recalled_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Ticket not found or cannot be recalled")
    return {"message": "Ticket recalled"}


@router.put("/business/{business_id}/tickets/{ticket_id}/priority")
async def set_priority(ticket_id: str, business_id: str, tenant: TenantContext = Depends(verify_business_access), priority: str = Body(..., embed=True)):
    """Set ticket priority (normal, rush, vip)."""
    db = get_database()
    if priority not in ("normal", "rush", "vip"):
        raise HTTPException(400, "Priority must be normal, rush, or vip")
    await db.kds_tickets.update_one(
        {"_id": ObjectId(ticket_id), "business_id": business_id},
        {"$set": {"priority": priority}}
    )
    return {"message": f"Priority set to {priority}"}


# ─── Recently Fulfilled ─── #

@router.get("/business/{business_id}/recent")
async def get_recent_tickets(business_id: str, tenant: TenantContext = Depends(verify_business_access), limit: int = 10):
    """Get recently completed tickets."""
    db = get_database()
    tickets = []
    async for doc in db.kds_tickets.find({
        "business_id": business_id,
        "status": {"$in": ["ready", "served"]},
    }).sort("completed_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        tickets.append(doc)
    return {"tickets": tickets}


# ─── KDS Analytics ─── #

@router.get("/business/{business_id}/analytics")
async def kds_analytics(business_id: str, tenant: TenantContext = Depends(verify_business_access), hours_back: int = 8):
    """KDS performance stats — avg prep times, throughput, bottlenecks."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(hours=hours_back)

    # Average prep time
    pipeline = [
        {"$match": {
            "business_id": business_id,
            "completed_at": {"$gte": cutoff},
            "prep_time_minutes": {"$exists": True},
        }},
        {"$group": {
            "_id": None,
            "avg_prep_time": {"$avg": "$prep_time_minutes"},
            "max_prep_time": {"$max": "$prep_time_minutes"},
            "min_prep_time": {"$min": "$prep_time_minutes"},
            "total_tickets": {"$sum": 1},
        }}
    ]
    result = await db.kds_tickets.aggregate(pipeline).to_list(1)
    stats = result[0] if result else {"avg_prep_time": 0, "max_prep_time": 0, "min_prep_time": 0, "total_tickets": 0}
    if "_id" in stats:
        del stats["_id"]

    # Tickets over target (>12 min)
    over_target = await db.kds_tickets.count_documents({
        "business_id": business_id,
        "completed_at": {"$gte": cutoff},
        "prep_time_minutes": {"$gt": 12},
    })

    # Items per hour
    per_item_pipeline = [
        {"$match": {"business_id": business_id, "completed_at": {"$gte": cutoff}}},
        {"$unwind": "$items"},
        {"$group": {"_id": None, "total_items": {"$sum": "$items.quantity"}}},
    ]
    item_result = await db.kds_tickets.aggregate(per_item_pipeline).to_list(1)
    total_items = item_result[0]["total_items"] if item_result else 0
    items_per_hour = round(total_items / max(hours_back, 1), 1)

    # Currently waiting
    waiting = await db.kds_tickets.count_documents({
        "business_id": business_id,
        "status": {"$in": ["new", "in_progress"]},
    })

    for key in ["avg_prep_time", "max_prep_time", "min_prep_time"]:
        stats[key] = round(stats.get(key, 0), 1)

    return {
        **stats,
        "tickets_over_target": over_target,
        "items_prepared": total_items,
        "items_per_hour": items_per_hour,
        "currently_waiting": waiting,
        "period_hours": hours_back,
    }
