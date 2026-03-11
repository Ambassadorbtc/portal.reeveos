"""
Treatment Consumable Tracking
==============================
8A: Stock management for treatment consumables — link to services,
auto-deduct on appointment completion, low-stock alerts, usage reports.

Collections:
  consumables      — { business_id, name, category, unit, current_stock, low_stock_threshold,
                       cost_per_unit, supplier, status, created_at }
  consumable_links — { business_id, service_name, items: [{consumable_id, quantity_per_treatment}] }
  consumable_log   — { business_id, consumable_id, change, reason, booking_id, service_name,
                       stock_before, stock_after, created_at }
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from database import get_database
from middleware.tenant import verify_business_access, TenantContext
from bson import ObjectId
import logging

logger = logging.getLogger("consumables")
router = APIRouter(prefix="/consumables", tags=["consumables"])

VALID_UNITS = {"ml", "pieces", "packs", "g", "units"}
VALID_ADJUST_REASONS = {"stock_take", "damaged", "donation", "correction", "received"}


@router.post("/business/{business_id}")
async def add_consumable(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Add a consumable item to inventory."""
    name = (payload.get("name") or "").strip()
    category = (payload.get("category") or "").strip()
    unit = (payload.get("unit") or "pieces").strip()
    current_stock = payload.get("current_stock", 0)
    low_stock_threshold = payload.get("low_stock_threshold", 5)
    cost_per_unit = payload.get("cost_per_unit", 0)
    supplier = (payload.get("supplier") or "").strip()

    if not name:
        raise HTTPException(400, "Consumable name is required")
    if unit not in VALID_UNITS:
        raise HTTPException(400, f"Invalid unit. Must be one of: {', '.join(sorted(VALID_UNITS))}")
    if not isinstance(current_stock, (int, float)) or current_stock < 0:
        raise HTTPException(400, "current_stock must be non-negative")
    if not isinstance(low_stock_threshold, (int, float)) or low_stock_threshold < 0:
        raise HTTPException(400, "low_stock_threshold must be non-negative")
    if not isinstance(cost_per_unit, (int, float)) or cost_per_unit < 0:
        raise HTTPException(400, "cost_per_unit must be non-negative")

    db = get_database()
    now = datetime.utcnow()

    doc = {
        "business_id": business_id,
        "name": name,
        "category": category,
        "unit": unit,
        "current_stock": float(current_stock),
        "low_stock_threshold": float(low_stock_threshold),
        "cost_per_unit": float(cost_per_unit),
        "supplier": supplier,
        "status": "active",
        "active": True,
        "created_at": now,
        "updated_at": now,
        "created_by": tenant.user_id,
    }

    result = await db.consumables.insert_one(doc)
    item_id = str(result.inserted_id)

    logger.info(f"Consumable added: {item_id} name={name} stock={current_stock} business={business_id}")
    return {
        "ok": True,
        "item_id": item_id,
        "name": name,
        "current_stock": float(current_stock),
        "unit": unit,
    }


@router.get("/business/{business_id}")
async def list_consumables(
    business_id: str,
    category: str = Query(None),
    low_stock_only: bool = Query(False),
    include_inactive: bool = Query(False),
    limit: int = Query(200, ge=1, le=500),
    skip: int = Query(0, ge=0),
    tenant: TenantContext = Depends(verify_business_access),
):
    """List consumable items with optional filters."""
    db = get_database()
    query = {"business_id": business_id}
    if not include_inactive:
        query["active"] = True
    if category:
        query["category"] = category
    if low_stock_only:
        query["$expr"] = {"$lte": ["$current_stock", "$low_stock_threshold"]}

    total = await db.consumables.count_documents(query)
    cursor = db.consumables.find(query).sort("name", 1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    items = []
    for d in docs:
        stock = d.get("current_stock", 0)
        threshold = d.get("low_stock_threshold", 0)
        items.append({
            "id": str(d["_id"]),
            "name": d.get("name", ""),
            "category": d.get("category", ""),
            "unit": d.get("unit", "pieces"),
            "current_stock": stock,
            "low_stock_threshold": threshold,
            "is_low_stock": stock <= threshold,
            "cost_per_unit": d.get("cost_per_unit", 0),
            "supplier": d.get("supplier", ""),
            "status": d.get("status", "active"),
            "created_at": d["created_at"].isoformat() if d.get("created_at") else "",
        })

    return {"items": items, "total": total}


@router.patch("/business/{business_id}/{item_id}")
async def adjust_stock(
    business_id: str,
    item_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Adjust stock manually with a reason."""
    db = get_database()

    item = await db.consumables.find_one({
        "_id": ObjectId(item_id), "business_id": business_id, "active": True,
    })
    if not item:
        raise HTTPException(404, "Consumable not found")

    # Allow general field updates
    field_updates = {}
    for field in ("name", "category", "unit", "low_stock_threshold", "cost_per_unit", "supplier", "status"):
        if field in payload:
            field_updates[field] = payload[field]

    # Stock adjustment
    new_stock = payload.get("current_stock")
    reason = (payload.get("reason") or "").strip()

    if new_stock is not None:
        if not isinstance(new_stock, (int, float)) or new_stock < 0:
            raise HTTPException(400, "current_stock must be non-negative")
        if not reason:
            raise HTTPException(400, "reason is required for stock adjustment")
        if reason not in VALID_ADJUST_REASONS:
            raise HTTPException(400, f"Invalid reason. Must be one of: {', '.join(sorted(VALID_ADJUST_REASONS))}")

        stock_before = item.get("current_stock", 0)
        change = float(new_stock) - stock_before
        field_updates["current_stock"] = float(new_stock)

        # Log the adjustment
        now = datetime.utcnow()
        await db.consumable_log.insert_one({
            "business_id": business_id,
            "consumable_id": item_id,
            "consumable_name": item.get("name", ""),
            "change": change,
            "reason": reason,
            "booking_id": None,
            "service_name": None,
            "stock_before": stock_before,
            "stock_after": float(new_stock),
            "adjusted_by": tenant.user_id,
            "created_at": now,
        })

    if not field_updates:
        raise HTTPException(400, "No valid fields to update")

    field_updates["updated_at"] = datetime.utcnow()

    await db.consumables.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": field_updates},
    )

    logger.info(f"Consumable updated: {item_id} fields={list(field_updates.keys())} business={business_id}")
    result = {"ok": True, "updated": list(field_updates.keys())}
    if new_stock is not None:
        result["current_stock"] = float(new_stock)
    return result


@router.delete("/business/{business_id}/{item_id}")
async def delete_consumable(
    business_id: str,
    item_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Soft-delete a consumable item."""
    db = get_database()

    result = await db.consumables.update_one(
        {"_id": ObjectId(item_id), "business_id": business_id, "active": True},
        {"$set": {"active": False, "status": "discontinued", "deleted_at": datetime.utcnow(), "deleted_by": tenant.user_id}},
    )

    if result.matched_count == 0:
        raise HTTPException(404, "Consumable not found or already deleted")

    logger.info(f"Consumable soft-deleted: {item_id} business={business_id}")
    return {"ok": True, "deleted": True}


@router.post("/business/{business_id}/service-link")
async def link_consumables_to_service(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Link consumable items to a service with quantity per treatment."""
    service_name = (payload.get("service_name") or "").strip()
    items = payload.get("items", [])

    if not service_name:
        raise HTTPException(400, "service_name is required")
    if not isinstance(items, list) or len(items) == 0:
        raise HTTPException(400, "items must be a non-empty list")

    db = get_database()

    # Validate each item
    for i, item in enumerate(items):
        cid = item.get("consumable_id", "")
        qty = item.get("quantity_per_treatment", 0)
        if not cid:
            raise HTTPException(400, f"items[{i}] missing consumable_id")
        if not isinstance(qty, (int, float)) or qty <= 0:
            raise HTTPException(400, f"items[{i}] quantity_per_treatment must be positive")
        # Verify consumable exists
        exists = await db.consumables.find_one({
            "_id": ObjectId(cid), "business_id": business_id, "active": True,
        })
        if not exists:
            raise HTTPException(404, f"Consumable {cid} not found")

    now = datetime.utcnow()

    # Upsert link
    await db.consumable_links.update_one(
        {"business_id": business_id, "service_name": service_name},
        {"$set": {
            "items": items,
            "updated_at": now,
            "updated_by": tenant.user_id,
        }, "$setOnInsert": {
            "business_id": business_id,
            "service_name": service_name,
            "created_at": now,
        }},
        upsert=True,
    )

    logger.info(f"Service-link set: service={service_name} items={len(items)} business={business_id}")
    return {"ok": True, "service_name": service_name, "linked_items": len(items)}


@router.post("/business/{business_id}/auto-deduct")
async def auto_deduct(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Deduct linked consumables when appointment completed."""
    booking_id = (payload.get("booking_id") or "").strip()
    service_name = (payload.get("service_name") or "").strip()

    if not service_name:
        raise HTTPException(400, "service_name is required")

    db = get_database()
    now = datetime.utcnow()

    # Find linked consumables for this service
    link = await db.consumable_links.find_one({
        "business_id": business_id, "service_name": service_name,
    })
    if not link:
        return {"deducted": [], "low_stock_warnings": [], "message": "No consumables linked to this service"}

    deducted = []
    low_stock_warnings = []

    for item_link in link.get("items", []):
        cid = item_link.get("consumable_id", "")
        qty = item_link.get("quantity_per_treatment", 0)
        if not cid or qty <= 0:
            continue

        consumable = await db.consumables.find_one({
            "_id": ObjectId(cid), "business_id": business_id, "active": True,
        })
        if not consumable:
            continue

        stock_before = consumable.get("current_stock", 0)
        stock_after = max(0, stock_before - qty)

        # Update stock
        await db.consumables.update_one(
            {"_id": ObjectId(cid)},
            {"$set": {"current_stock": stock_after, "updated_at": now}},
        )

        # Log deduction
        await db.consumable_log.insert_one({
            "business_id": business_id,
            "consumable_id": cid,
            "consumable_name": consumable.get("name", ""),
            "change": -qty,
            "reason": "auto_deduct",
            "booking_id": booking_id,
            "service_name": service_name,
            "stock_before": stock_before,
            "stock_after": stock_after,
            "created_at": now,
        })

        deducted.append({
            "name": consumable.get("name", ""),
            "quantity": qty,
            "remaining": stock_after,
            "unit": consumable.get("unit", "pieces"),
        })

        # Check low stock
        threshold = consumable.get("low_stock_threshold", 0)
        if stock_after <= threshold:
            low_stock_warnings.append({
                "name": consumable.get("name", ""),
                "remaining": stock_after,
                "threshold": threshold,
                "unit": consumable.get("unit", "pieces"),
            })

    logger.info(f"Auto-deduct: service={service_name} deducted={len(deducted)} warnings={len(low_stock_warnings)} business={business_id}")
    return {"deducted": deducted, "low_stock_warnings": low_stock_warnings}


@router.get("/business/{business_id}/alerts")
async def get_low_stock_alerts(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Items below their low-stock threshold."""
    db = get_database()

    cursor = db.consumables.find({
        "business_id": business_id,
        "active": True,
        "$expr": {"$lte": ["$current_stock", "$low_stock_threshold"]},
    }).sort("current_stock", 1)
    docs = await cursor.to_list(length=200)

    alerts = []
    for d in docs:
        stock = d.get("current_stock", 0)
        threshold = d.get("low_stock_threshold", 0)
        alerts.append({
            "id": str(d["_id"]),
            "name": d.get("name", ""),
            "category": d.get("category", ""),
            "unit": d.get("unit", "pieces"),
            "current_stock": stock,
            "low_stock_threshold": threshold,
            "deficit": threshold - stock,
            "supplier": d.get("supplier", ""),
            "cost_per_unit": d.get("cost_per_unit", 0),
        })

    return {"alerts": alerts, "total": len(alerts)}


@router.get("/business/{business_id}/usage-report")
async def get_usage_report(
    business_id: str,
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Consumption report grouped by service over a date range."""
    try:
        start_dt = datetime.strptime(start, "%Y-%m-%d")
        end_dt = datetime.strptime(end, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD.")

    if (end_dt - start_dt).days > 365:
        raise HTTPException(400, "Date range cannot exceed 365 days")

    db = get_database()

    # Aggregate consumption by service
    pipeline = [
        {"$match": {
            "business_id": business_id,
            "reason": "auto_deduct",
            "created_at": {"$gte": start_dt, "$lte": end_dt},
        }},
        {"$group": {
            "_id": {"service": "$service_name", "consumable": "$consumable_name"},
            "total_used": {"$sum": {"$abs": "$change"}},
            "deductions": {"$sum": 1},
        }},
        {"$sort": {"total_used": -1}},
    ]
    agg = await db.consumable_log.aggregate(pipeline).to_list(500)

    # Group by service
    by_service = {}
    for row in agg:
        svc = row["_id"]["service"] or "unknown"
        if svc not in by_service:
            by_service[svc] = {"service_name": svc, "items": [], "total_deductions": 0}
        by_service[svc]["items"].append({
            "consumable_name": row["_id"]["consumable"],
            "total_used": row["total_used"],
            "deductions": row["deductions"],
        })
        by_service[svc]["total_deductions"] += row["deductions"]

    # Also compute total cost
    cost_pipeline = [
        {"$match": {
            "business_id": business_id,
            "reason": "auto_deduct",
            "created_at": {"$gte": start_dt, "$lte": end_dt},
        }},
        {"$lookup": {
            "from": "consumables",
            "let": {"cid": {"$toObjectId": "$consumable_id"}},
            "pipeline": [{"$match": {"$expr": {"$eq": ["$_id", "$$cid"]}}}],
            "as": "item",
        }},
        {"$unwind": {"path": "$item", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": None,
            "total_cost": {"$sum": {"$multiply": [{"$abs": "$change"}, {"$ifNull": ["$item.cost_per_unit", 0]}]}},
            "total_units": {"$sum": {"$abs": "$change"}},
        }},
    ]
    cost_agg = await db.consumable_log.aggregate(cost_pipeline).to_list(1)
    totals = cost_agg[0] if cost_agg else {"total_cost": 0, "total_units": 0}

    return {
        "by_service": list(by_service.values()),
        "total_cost": round(totals.get("total_cost", 0), 2),
        "total_units_consumed": totals.get("total_units", 0),
        "period": {"start": start, "end": end},
    }
