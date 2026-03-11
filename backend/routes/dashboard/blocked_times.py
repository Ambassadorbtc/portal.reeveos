"""
2A: Block Time on Calendar
==========================
Blocked time slots per staff member — lunch breaks, meetings, training, personal time.
Supports repeat rules (none, daily, weekly).
All endpoints tenant-isolated via verify_business_access.
"""

from datetime import datetime, date, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from database import get_database
from middleware.auth import get_current_user
from middleware.tenant import verify_business_access, TenantContext
from bson import ObjectId
import uuid
import logging

logger = logging.getLogger("blocked_times")
router = APIRouter(prefix="/blocked-times", tags=["blocked-times"])

VALID_PRESETS = {"lunch", "staff_meeting", "training", "personal", "custom"}
VALID_REPEAT_RULES = {"none", "daily", "weekly"}


@router.post("/business/{business_id}")
async def create_blocked_time(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Create a blocked time slot on the calendar."""
    staff_id = (payload.get("staff_id") or "").strip()
    start_time = (payload.get("start_time") or "").strip()
    end_time = (payload.get("end_time") or "").strip()
    reason = (payload.get("reason") or "").strip()
    reason_preset = (payload.get("reason_preset") or "custom").strip().lower()
    repeat_rule = (payload.get("repeat_rule") or "none").strip().lower()
    block_date = (payload.get("date") or "").strip()

    if not start_time or not end_time:
        raise HTTPException(400, "start_time and end_time are required")
    if not block_date:
        raise HTTPException(400, "date is required")
    if reason_preset not in VALID_PRESETS:
        raise HTTPException(400, f"Invalid reason_preset. Must be one of: {', '.join(sorted(VALID_PRESETS))}")
    if repeat_rule not in VALID_REPEAT_RULES:
        raise HTTPException(400, f"Invalid repeat_rule. Must be one of: {', '.join(sorted(VALID_REPEAT_RULES))}")
    if len(reason) > 200:
        raise HTTPException(400, "Reason must be 200 characters or fewer")

    # Validate time order
    if start_time >= end_time:
        raise HTTPException(400, "end_time must be after start_time")

    db = get_database()

    doc = {
        "business_id": business_id,
        "staff_id": staff_id,
        "date": block_date,
        "start_time": start_time,
        "end_time": end_time,
        "reason": reason,
        "reason_preset": reason_preset,
        "repeat_rule": repeat_rule,
        "created_by": tenant.user_id,
        "created_at": datetime.utcnow(),
    }

    result = await db.blocked_times.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["_id"] = str(result.inserted_id)
    doc["created_at"] = doc["created_at"].isoformat()

    logger.info(f"Blocked time created: {doc['id']} business={business_id} staff={staff_id} {block_date} {start_time}-{end_time}")
    return {"ok": True, "block": doc}


@router.get("/business/{business_id}")
async def list_blocked_times(
    business_id: str,
    staff_id: str = Query(None),
    from_date: str = Query(None, alias="from"),
    to_date: str = Query(None, alias="to"),
    tenant: TenantContext = Depends(verify_business_access),
):
    """List blocked time slots, optionally filtered by staff and date range."""
    db = get_database()

    query = {"business_id": business_id}
    if staff_id:
        query["staff_id"] = staff_id

    # Date range filter: include exact matches + repeated blocks that could apply
    if from_date or to_date:
        date_filter = {}
        if from_date:
            date_filter["$gte"] = from_date
        if to_date:
            date_filter["$lte"] = to_date

        # For repeating blocks, we need blocks whose start date <= to_date
        # Non-repeating: date within range
        # Repeating: date <= to_date (they repeat forward)
        query["$or"] = [
            {"repeat_rule": "none", "date": date_filter},
            {"repeat_rule": {"$ne": "none"}, "date": {"$lte": to_date or "9999-12-31"}},
        ]

    cursor = db.blocked_times.find(query).sort("date", 1).sort("start_time", 1)
    docs = await cursor.to_list(length=500)

    blocks = []
    for d in docs:
        block = {
            "id": str(d["_id"]),
            "business_id": d.get("business_id", ""),
            "staff_id": d.get("staff_id", ""),
            "date": d.get("date", ""),
            "start_time": d.get("start_time", ""),
            "end_time": d.get("end_time", ""),
            "reason": d.get("reason", ""),
            "reason_preset": d.get("reason_preset", "custom"),
            "repeat_rule": d.get("repeat_rule", "none"),
            "created_by": d.get("created_by", ""),
            "created_at": d.get("created_at").isoformat() if d.get("created_at") else "",
        }

        # For repeating blocks within a date range, expand occurrences
        if block["repeat_rule"] != "none" and from_date and to_date:
            expanded = _expand_repeating_block(block, from_date, to_date)
            blocks.extend(expanded)
        else:
            blocks.append(block)

    return {"blocks": blocks}


def _expand_repeating_block(block: dict, from_date: str, to_date: str) -> list:
    """Expand a repeating block into individual occurrences within the date range."""
    try:
        base = date.fromisoformat(block["date"])
        start = date.fromisoformat(from_date)
        end = date.fromisoformat(to_date)
    except ValueError:
        return [block]

    if block["repeat_rule"] == "daily":
        delta = timedelta(days=1)
    elif block["repeat_rule"] == "weekly":
        delta = timedelta(weeks=1)
    else:
        return [block]

    occurrences = []
    current = base
    # Walk forward to the first date in range
    if current < start:
        steps = ((start - current) // delta)
        current = current + delta * steps
        if current < start:
            current += delta

    while current <= end:
        occ = dict(block)
        occ["date"] = current.isoformat()
        occ["_expanded_from"] = block["id"]
        occurrences.append(occ)
        current += delta

    return occurrences


@router.delete("/business/{business_id}/{block_id}")
async def delete_blocked_time(
    business_id: str,
    block_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Delete a blocked time slot."""
    db = get_database()

    result = await db.blocked_times.delete_one({
        "_id": ObjectId(block_id),
        "business_id": business_id,
    })

    if result.deleted_count == 0:
        raise HTTPException(404, "Blocked time not found")

    logger.info(f"Blocked time deleted: {block_id} business={business_id}")
    return {"ok": True}
