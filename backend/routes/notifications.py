"""
Notifications — real-time notification system.
Creates notifications from system events (bookings, orders, reviews, system).
Stores in MongoDB, serves via API, supports read/dismiss.
"""
from fastapi import Depends,  APIRouter, HTTPException, Body
from database import get_database
from datetime import datetime, timedelta
from typing import Optional, List
from bson import ObjectId
from middleware.tenant import verify_business_access, TenantContext

router = APIRouter(prefix="/notifications", tags=["notifications"])


def serialise(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


@router.get("/business/{business_id}")
async def get_notifications(
    business_id: str,
    unread_only: bool = False,
    category: Optional[str] = None,
    limit: int = 50,
    hours_back: int = 168,  # 7 days default,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get notifications for a business."""
    db = get_database()
    query = {
        "business_id": business_id,
        "created_at": {"$gte": datetime.utcnow() - timedelta(hours=hours_back)},
    }
    if unread_only:
        query["read"] = False
    if category:
        query["category"] = category

    notifs = []
    async for doc in db.notifications.find(query).sort("created_at", -1).limit(limit):
        notifs.append(serialise(doc))

    unread_count = await db.notifications.count_documents({
        "business_id": business_id,
        "read": False,
    })

    return {"notifications": notifs, "unread_count": unread_count, "count": len(notifs)}


@router.post("/business/{business_id}")
async def create_notification(business_id: str, tenant: TenantContext = Depends(verify_business_access), body: dict = Body(...)):
    """Create a notification (used internally or by admin)."""
    db = get_database()
    notif = {
        "business_id": business_id,
        "title": body.get("title", "Notification"),
        "body": body.get("body", ""),
        "category": body.get("category", "system"),  # bookings, orders, reviews, system, payments, waitlist
        "priority": body.get("priority", "normal"),   # low, normal, urgent
        "read": False,
        "dismissed": False,
        "link": body.get("link"),         # optional deep link e.g. /dashboard/bookings
        "data": body.get("data", {}),      # arbitrary metadata
        "created_at": datetime.utcnow(),
    }
    result = await db.notifications.insert_one(notif)
    notif["_id"] = str(result.inserted_id)
    return {"notification_id": str(result.inserted_id), "notification": notif}


@router.put("/{notification_id}/read")
async def mark_read(notification_id: str):
    """Mark a single notification as read."""
    db = get_database()
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"read": True, "read_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"detail": "Marked as read"}


@router.put("/business/{business_id}/read-all")
async def mark_all_read(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Mark all notifications as read for a business."""
    db = get_database()
    result = await db.notifications.update_many(
        {"business_id": business_id, "read": False},
        {"$set": {"read": True, "read_at": datetime.utcnow()}}
    )
    return {"detail": f"Marked {result.modified_count} as read"}


@router.put("/{notification_id}/dismiss")
async def dismiss_notification(notification_id: str):
    """Dismiss a notification (soft delete)."""
    db = get_database()
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"dismissed": True, "dismissed_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"detail": "Dismissed"}


@router.delete("/business/{business_id}/clear")
async def clear_old_notifications(business_id: str, tenant: TenantContext = Depends(verify_business_access), days_old: int = 30):
    """Delete notifications older than N days."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days_old)
    result = await db.notifications.delete_many({
        "business_id": business_id,
        "created_at": {"$lt": cutoff},
    })
    return {"detail": f"Cleared {result.deleted_count} old notifications"}


@router.get("/business/{business_id}/counts")
async def get_counts(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get notification counts by category."""
    db = get_database()
    pipeline = [
        {"$match": {"business_id": business_id, "read": False}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]
    results = await db.notifications.aggregate(pipeline).to_list(length=None)
    counts = {r["_id"]: r["count"] for r in results}
    counts["total"] = sum(counts.values())
    return counts
