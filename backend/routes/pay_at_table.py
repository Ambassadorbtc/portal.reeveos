"""
ReeveOS EPOS — Pay-at-Table & QR Ordering API
===============================================
Customers scan a QR code at their table to:
- View menu on their phone
- Order directly (fires to KDS)
- Pay their bill (split or full)
- Leave a tip and review

NO competitor includes this natively — Epos Now charges extra,
Toast requires add-on, SumUp doesn't have it.
"""
from fastapi import Depends,  APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
import secrets
import logging
from middleware.tenant import verify_business_access, TenantContext

logger = logging.getLogger("pay_at_table")
router = APIRouter(prefix="/table-service", tags=["Pay at Table"])


# ─── QR Code / Table Token Generation ─── #

@router.post("/business/{business_id}/generate-qr-tokens")
async def generate_table_tokens(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Generate unique QR tokens for each table. 
    Each token maps to a table and can be used to create QR codes.
    """
    db = get_database()
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not biz:
        raise HTTPException(404, "Business not found")

    floor_plan = biz.get("floor_plan", {})
    tables = floor_plan.get("tables", [])

    tokens = []
    for table in tables:
        token = secrets.token_urlsafe(16)
        tokens.append({
            "table_id": table.get("id"),
            "table_number": table.get("label", table.get("number")),
            "token": token,
            "qr_url": f"https://reeve.now/t/{token}",
            "created_at": datetime.utcnow(),
        })

    # Store tokens
    await db.businesses.update_one(
        {"_id": ObjectId(business_id)},
        {"$set": {"table_tokens": tokens}}
    )

    return {"tokens": tokens, "count": len(tokens)}


@router.get("/scan/{token}")
async def scan_table_qr(token: str):
    """Customer scans QR code — returns table info and menu.
    This is the entry point for customer self-service.
    """
    db = get_database()

    # Find business with this token
    biz = await db.businesses.find_one({"table_tokens.token": token})
    if not biz:
        raise HTTPException(404, "Invalid QR code")

    # Find which table
    table_info = None
    for t in biz.get("table_tokens", []):
        if t["token"] == token:
            table_info = t
            break

    if not table_info:
        raise HTTPException(404, "Table not found")

    # Check for existing open order on this table
    open_order = await db.orders.find_one({
        "business_id": str(biz["_id"]),
        "table_id": table_info["table_id"],
        "status": {"$in": ["open", "fired", "partially_paid"]},
    })

    # Build menu (exclude 86'd items)
    categories = {}
    for item in biz.get("menu", []):
        if item.get("status") == "86":
            continue
        cat = item.get("category", "Other")
        categories.setdefault(cat, [])
        categories[cat].append({
            "id": item.get("id"),
            "name": item.get("name"),
            "description": item.get("description", ""),
            "price": item.get("price", 0),
            "image": item.get("image"),
            "dietary": item.get("dietary", []),
            "allergens": item.get("allergens", []),
            "modifiers": item.get("modifiers", []),
            "popular": item.get("popular", False),
            "calories": item.get("calories"),
        })

    return {
        "business_id": str(biz["_id"]),
        "business_name": biz.get("name"),
        "logo": biz.get("logo"),
        "table_id": table_info["table_id"],
        "table_number": table_info["table_number"],
        "has_open_order": bool(open_order),
        "order_id": str(open_order["_id"]) if open_order else None,
        "order_total": open_order.get("total", 0) if open_order else 0,
        "categories": categories,
        "service_charge_percent": biz.get("default_service_charge", 0),
        "accepts_tips": True,
    }


# ─── Customer Orders from Phone ─── #

@router.post("/order/{token}")
async def customer_place_order(
    token: str,
    items: List[Dict] = Body(...),
    customer_name: Optional[str] = Body(None),
):
    """Customer places an order from their phone via QR scan.
    Creates order (or adds to existing) and fires to KDS.
    """
    db = get_database()

    biz = await db.businesses.find_one({"table_tokens.token": token})
    if not biz:
        raise HTTPException(404, "Invalid table token")

    table_info = next((t for t in biz.get("table_tokens", []) if t["token"] == token), None)
    business_id = str(biz["_id"])

    # Check for existing open order
    open_order = await db.orders.find_one({
        "business_id": business_id,
        "table_id": table_info["table_id"],
        "status": {"$in": ["open", "fired"]},
    })

    now = datetime.utcnow()
    new_items = []
    for item in items:
        new_items.append({
            "menu_item_id": item.get("id", ""),
            "name": item["name"],
            "quantity": item.get("quantity", 1),
            "unit_price": item["price"],
            "modifiers": item.get("modifiers", []),
            "notes": item.get("notes"),
            "course": item.get("course", 1),
            "fired": False,
            "source": "customer_qr",
        })

    if open_order:
        # Add to existing order
        open_order["items"].extend(new_items)
        from routes.orders import calc_order_totals
        totals = calc_order_totals(open_order)

        await db.orders.update_one(
            {"_id": open_order["_id"]},
            {"$push": {"items": {"$each": new_items}},
             "$set": {**totals, "updated_at": now}}
        )
        order_id = str(open_order["_id"])
        order_number = open_order.get("order_number", "")
    else:
        # Create new order
        from routes.orders import _next_order_number, calc_order_totals
        order_number = await _next_order_number(db, business_id)

        order = {
            "business_id": business_id,
            "order_type": "dine_in",
            "order_number": order_number,
            "table_id": table_info["table_id"],
            "table_number": table_info["table_number"],
            "covers": 1,
            "items": new_items,
            "discounts": [],
            "payments": [],
            "splits": None,
            "status": "open",
            "customer_name": customer_name,
            "source": "qr_order",
            "service_charge_percent": biz.get("default_service_charge", 0),
            "opened_at": now,
            "created_at": now,
            "updated_at": now,
        }
        totals = calc_order_totals(order)
        order.update(totals)
        result = await db.orders.insert_one(order)
        order_id = str(result.inserted_id)

    # Fire new items to KDS
    kds_items = [
        {
            "name": item["name"],
            "quantity": item["quantity"],
            "modifiers": item.get("modifiers", []),
            "notes": item.get("notes"),
            "course": item.get("course", 1),
        }
        for item in new_items
    ]

    ticket = {
        "order_id": order_id,
        "order_number": order_number,
        "business_id": business_id,
        "order_type": "dine_in",
        "table_number": table_info["table_number"],
        "items": kds_items,
        "status": "new",
        "priority": "normal",
        "source": "customer_qr",
        "created_at": now,
    }
    ticket_result = await db.kds_tickets.insert_one(ticket)

    # Mark items as fired
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "items.$[elem].fired": True,
            "items.$[elem].fired_at": now,
            "status": "fired",
        }},
        array_filters=[{"elem.fired": False}]
    )

    return {
        "order_id": order_id,
        "order_number": order_number,
        "items_added": len(new_items),
        "ticket_id": str(ticket_result.inserted_id),
        "message": "Order sent to kitchen!",
    }


# ─── View Bill ─── #

@router.get("/bill/{token}")
async def view_bill(token: str):
    """Customer views their current bill from phone."""
    db = get_database()
    biz = await db.businesses.find_one({"table_tokens.token": token})
    if not biz:
        raise HTTPException(404, "Invalid table token")

    table_info = next((t for t in biz.get("table_tokens", []) if t["token"] == token), None)

    order = await db.orders.find_one({
        "business_id": str(biz["_id"]),
        "table_id": table_info["table_id"],
        "status": {"$in": ["open", "fired", "partially_paid"]},
    })

    if not order:
        return {"message": "No open order on this table", "items": [], "total": 0}

    from routes.orders import calc_order_totals
    totals = calc_order_totals(order)

    items = [
        {
            "name": item["name"],
            "qty": item["quantity"],
            "price": item["unit_price"],
            "modifiers": [m.get("name") for m in item.get("modifiers", [])],
            "line_total": item.get("line_total", item["unit_price"] * item["quantity"]),
        }
        for item in order.get("items", [])
    ]

    return {
        "order_id": str(order["_id"]),
        "items": items,
        **totals,
        "business_name": biz.get("name"),
    }


# ─── Pay from Phone ─── #

@router.post("/pay/{token}")
async def customer_pay(
    token: str,
    amount: float = Body(...),
    tip: float = Body(0),
    payment_method: str = Body("card"),
    payment_reference: Optional[str] = Body(None),
    split_type: Optional[str] = Body(None),  # None = pay full, "equal_2", "equal_3", "custom"
):
    """Customer pays their bill from their phone.
    Supports full payment, split bills, and tips.
    """
    db = get_database()
    biz = await db.businesses.find_one({"table_tokens.token": token})
    if not biz:
        raise HTTPException(404, "Invalid table token")

    table_info = next((t for t in biz.get("table_tokens", []) if t["token"] == token), None)

    order = await db.orders.find_one({
        "business_id": str(biz["_id"]),
        "table_id": table_info["table_id"],
        "status": {"$in": ["open", "fired", "partially_paid"]},
    })

    if not order:
        raise HTTPException(404, "No open order to pay")

    payment = {
        "method": payment_method,
        "amount": amount,
        "tip": tip,
        "reference": payment_reference,
        "source": "customer_phone",
        "processed_at": datetime.utcnow(),
    }

    order["payments"].append(payment)

    from routes.orders import calc_order_totals
    totals = calc_order_totals(order)

    new_status = "partially_paid"
    if totals["amount_due"] <= 0.01:
        new_status = "paid"

    await db.orders.update_one(
        {"_id": order["_id"]},
        {
            "$push": {"payments": payment},
            "$set": {**totals, "status": new_status, "updated_at": datetime.utcnow()},
        }
    )

    # Free table if fully paid
    if new_status == "paid" and table_info.get("table_id"):
        await db.businesses.update_one(
            {"_id": biz["_id"], "floor_plan.tables.id": table_info["table_id"]},
            {"$set": {
                "floor_plan.tables.$.status": "available",
                "floor_plan.tables.$.current_order_id": None,
            }}
        )

    return {
        "message": "Payment successful" if new_status == "paid" else "Partial payment recorded",
        "paid": new_status == "paid",
        "amount_paid": amount,
        "tip": tip,
        "remaining": max(0, totals["amount_due"]),
    }


# ─── Post-Payment Review ─── #

@router.post("/review/{token}")
async def leave_review(
    token: str,
    rating: int = Body(...),
    comment: Optional[str] = Body(None),
    customer_name: Optional[str] = Body(None),
):
    """Customer leaves a quick review after paying."""
    db = get_database()
    biz = await db.businesses.find_one({"table_tokens.token": token})
    if not biz:
        raise HTTPException(404, "Invalid table token")

    review = {
        "business_id": str(biz["_id"]),
        "rating": min(5, max(1, rating)),
        "comment": comment,
        "customer_name": customer_name,
        "source": "pay_at_table",
        "created_at": datetime.utcnow(),
    }
    await db.reviews.insert_one(review)

    return {"message": "Thank you for your review!"}


# ─── Call Waiter ─── #

@router.post("/call-waiter/{token}")
async def call_waiter(token: str, message: Optional[str] = Body("Attention needed")):
    """Customer requests waiter attention from their phone."""
    db = get_database()
    biz = await db.businesses.find_one({"table_tokens.token": token})
    if not biz:
        raise HTTPException(404, "Invalid table token")

    table_info = next((t for t in biz.get("table_tokens", []) if t["token"] == token), None)

    alert = {
        "business_id": str(biz["_id"]),
        "table_id": table_info["table_id"],
        "table_number": table_info["table_number"],
        "type": "waiter_call",
        "message": message,
        "status": "pending",
        "created_at": datetime.utcnow(),
    }
    await db.table_alerts.insert_one(alert)

    return {"message": "Waiter has been notified"}


@router.get("/business/{business_id}/alerts")
async def get_table_alerts(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get pending table alerts (waiter calls, bill requests)."""
    db = get_database()
    alerts = []
    async for doc in db.table_alerts.find({
        "business_id": business_id,
        "status": "pending",
    }).sort("created_at", 1):
        doc["_id"] = str(doc["_id"])
        elapsed = round((datetime.utcnow() - doc["created_at"]).total_seconds() / 60, 1)
        doc["elapsed_minutes"] = elapsed
        alerts.append(doc)
    return {"alerts": alerts}


@router.put("/business/{business_id}/alerts/{alert_id}/dismiss")
async def dismiss_alert(business_id: str, tenant: TenantContext = Depends(verify_business_access), alert_id: str):
    db = get_database()
    await db.table_alerts.update_one(
        {"_id": ObjectId(alert_id)},
        {"$set": {"status": "dismissed", "dismissed_at": datetime.utcnow()}}
    )
    return {"message": "Alert dismissed"}
