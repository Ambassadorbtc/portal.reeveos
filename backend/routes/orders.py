"""
ReeveOS EPOS — Orders API
==========================
Complete order lifecycle: create, modify, fire, split, pay, refund.
Handles dine-in, takeaway, delivery, and kiosk orders.
Integrates with KDS, floor plan, and payments.
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
from decimal import Decimal
import logging
from middleware.tenant import verify_business_access, set_user_tenant_context, TenantContext

logger = logging.getLogger("orders")
router = APIRouter(prefix="/orders", tags=["EPOS Orders"])


# ─── Models ─── #

class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    quantity: int = 1
    unit_price: float
    modifiers: Optional[List[Dict]] = []  # [{name, price, group}]
    notes: Optional[str] = None
    course: Optional[int] = 1  # 1=starter, 2=main, 3=dessert
    seat_number: Optional[int] = None
    fired: bool = False

class CreateOrder(BaseModel):
    business_id: str
    order_type: str  # dine_in, takeaway, delivery, kiosk
    table_id: Optional[str] = None
    table_number: Optional[str] = None
    covers: Optional[int] = 1
    items: List[OrderItem] = []
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    delivery_address: Optional[Dict] = None
    staff_id: Optional[str] = None
    notes: Optional[str] = None

class AddItems(BaseModel):
    items: List[OrderItem]

class ApplyDiscount(BaseModel):
    discount_type: str  # percent, fixed, item_percent, item_fixed, comp
    value: float
    reason: Optional[str] = None
    item_index: Optional[int] = None  # None = whole order
    authorised_by: Optional[str] = None

class SplitBillRequest(BaseModel):
    split_type: str  # equal, by_seat, by_item, custom
    num_splits: Optional[int] = None
    custom_splits: Optional[List[Dict]] = None  # [{items: [idx], amount: float}]

class PaymentRequest(BaseModel):
    method: str  # card, cash, split
    amount: float
    tip: Optional[float] = 0
    reference: Optional[str] = None  # card auth ref
    split_index: Optional[int] = None  # for split payments
    cash_tendered: Optional[float] = None  # for cash change calculation

class RefundRequest(BaseModel):
    items: Optional[List[int]] = None  # item indices, None = full refund
    reason: str
    amount: Optional[float] = None  # override amount
    authorised_by: Optional[str] = None


# ─── Helpers ─── #

def calc_order_totals(order: dict) -> dict:
    """Recalculate order subtotal, tax, discounts, total."""
    items = order.get("items", [])
    subtotal = 0
    for item in items:
        item_total = item["unit_price"] * item["quantity"]
        for mod in item.get("modifiers", []):
            item_total += mod.get("price", 0) * item["quantity"]
        # Item-level discount
        if item.get("discount"):
            d = item["discount"]
            if d["type"] == "item_percent":
                item_total *= (1 - d["value"] / 100)
            elif d["type"] == "item_fixed":
                item_total -= d["value"]
        item["line_total"] = round(item_total, 2)
        subtotal += item_total

    subtotal = round(subtotal, 2)

    # Order-level discounts
    discount_total = 0
    for d in order.get("discounts", []):
        if d["type"] == "percent":
            discount_total += subtotal * (d["value"] / 100)
        elif d["type"] == "fixed":
            discount_total += d["value"]
        elif d["type"] == "comp":
            discount_total = subtotal  # full comp

    discount_total = round(min(discount_total, subtotal), 2)
    net = round(subtotal - discount_total, 2)

    # UK VAT (20% included in price, so net = gross/1.2, vat = gross - net)
    vat = round(net - (net / 1.2), 2)

    # Service charge (if applicable)
    service_charge = 0
    if order.get("service_charge_percent"):
        service_charge = round(net * order["service_charge_percent"] / 100, 2)

    total = round(net + service_charge, 2)
    tips = sum(p.get("tip", 0) for p in order.get("payments", []))

    return {
        "subtotal": subtotal,
        "discount_total": discount_total,
        "vat_amount": vat,
        "net_amount": net,
        "service_charge": service_charge,
        "total": total,
        "tips": round(tips, 2),
        "grand_total": round(total + tips, 2),
        "amount_paid": round(sum(p.get("amount", 0) + p.get("tip", 0) for p in order.get("payments", [])), 2),
        "amount_due": round(total - sum(p.get("amount", 0) for p in order.get("payments", [])), 2),
    }


def serialise(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# ─── Create Order ─── #

@router.post("/")
async def create_order(body: CreateOrder, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Create a new order (dine-in, takeaway, delivery, kiosk)."""
    db = get_database()

    order = {
        "business_id": body.business_id,
        "order_type": body.order_type,
        "order_number": await _next_order_number(db, body.business_id),
        "table_id": body.table_id,
        "table_number": body.table_number,
        "covers": body.covers,
        "items": [item.dict() for item in body.items],
        "discounts": [],
        "payments": [],
        "splits": None,
        "status": "open",  # open, fired, partially_paid, paid, closed, voided, refunded
        "customer_name": body.customer_name,
        "customer_phone": body.customer_phone,
        "customer_email": body.customer_email,
        "delivery_address": body.delivery_address,
        "staff_id": body.staff_id,
        "notes": body.notes,
        "service_charge_percent": 0,
        "opened_at": datetime.utcnow(),
        "fired_at": None,
        "closed_at": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    # Calculate totals
    totals = calc_order_totals(order)
    order.update(totals)

    result = await db.orders.insert_one(order)
    order["_id"] = str(result.inserted_id)

    # Update table status if dine-in
    if body.order_type == "dine_in" and body.table_id:
        await db.businesses.update_one(
            {"_id": ObjectId(body.business_id), "floor_plan.tables.id": body.table_id},
            {"$set": {
                "floor_plan.tables.$.status": "occupied",
                "floor_plan.tables.$.current_order_id": str(result.inserted_id),
                "floor_plan.tables.$.seated_at": datetime.utcnow(),
            }}
        )

    return {"order_id": str(result.inserted_id), "order_number": order["order_number"], "totals": totals}


@router.get("/{order_id}")
async def get_order(order_id: str, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Get full order details."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")
    return serialise(order)


@router.get("/business/{business_id}")
async def list_orders(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
    status: Optional[str] = None,
    order_type: Optional[str] = None,
    hours_back: int = 24,
    limit: int = 50
):
    """List orders for a business."""
    db = get_database()
    query = {
        "business_id": business_id,
        "created_at": {"$gte": datetime.utcnow() - timedelta(hours=hours_back)},
    }
    if status:
        query["status"] = status
    if order_type:
        query["order_type"] = order_type

    orders = []
    async for doc in db.orders.find(query).sort("created_at", -1).limit(limit):
        orders.append(serialise(doc))

    return {"orders": orders, "count": len(orders)}


@router.get("/business/{business_id}/open")
async def get_open_orders(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get all currently open orders (active service)."""
    db = get_database()
    orders = []
    async for doc in db.orders.find({
        "business_id": business_id,
        "status": {"$in": ["open", "fired", "partially_paid"]}
    }).sort("opened_at", 1):
        orders.append(serialise(doc))
    return {"orders": orders, "count": len(orders)}


# ─── Modify Order ─── #

@router.post("/{order_id}/items")
async def add_items_to_order(order_id: str, body: AddItems, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Add items to an open order."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["status"] in ("paid", "closed", "voided", "refunded"):
        raise HTTPException(400, "Cannot modify a closed order")

    new_items = [item.dict() for item in body.items]
    order["items"].extend(new_items)
    totals = calc_order_totals(order)

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$push": {"items": {"$each": new_items}},
         "$set": {**totals, "updated_at": datetime.utcnow()}}
    )

    return {"message": f"Added {len(new_items)} items", "totals": totals}


@router.delete("/{order_id}/items/{item_index}")
async def remove_item(order_id: str, item_index: int, tenant: TenantContext = Depends(set_user_tenant_context), reason: str = "removed"):
    """Remove an item from order (void line)."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")
    if item_index >= len(order["items"]):
        raise HTTPException(400, "Invalid item index")

    voided_item = order["items"].pop(item_index)
    totals = calc_order_totals(order)

    # Log void
    void_log = {
        "item": voided_item,
        "reason": reason,
        "voided_at": datetime.utcnow(),
    }

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"items": order["items"], **totals, "updated_at": datetime.utcnow()},
         "$push": {"void_log": void_log}}
    )

    return {"message": "Item removed", "voided": voided_item["name"], "totals": totals}


@router.put("/{order_id}/items/{item_index}")
async def update_item(order_id: str, item_index: int, tenant: TenantContext = Depends(set_user_tenant_context), updates: dict = Body(...)):
    """Update item quantity, modifiers, notes, course, seat."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")
    if item_index >= len(order["items"]):
        raise HTTPException(400, "Invalid item index")

    for key in ["quantity", "modifiers", "notes", "course", "seat_number"]:
        if key in updates:
            order["items"][item_index][key] = updates[key]

    totals = calc_order_totals(order)

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"items": order["items"], **totals, "updated_at": datetime.utcnow()}}
    )

    return {"message": "Item updated", "totals": totals}


# ─── Fire to Kitchen ─── #

@router.post("/{order_id}/fire")
async def fire_order(order_id: str, tenant: TenantContext = Depends(set_user_tenant_context), course: Optional[int] = None):
    """Fire order (or specific course) to KDS."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    now = datetime.utcnow()
    fired_items = []

    for i, item in enumerate(order["items"]):
        if not item.get("fired"):
            if course is None or item.get("course") == course:
                order["items"][i]["fired"] = True
                order["items"][i]["fired_at"] = now
                fired_items.append(item["name"])

    if not fired_items:
        return {"message": "No items to fire"}

    # Create KDS ticket
    ticket = {
        "order_id": order_id,
        "order_number": order.get("order_number"),
        "business_id": order["business_id"],
        "order_type": order["order_type"],
        "table_number": order.get("table_number"),
        "items": [
            {
                "name": item["name"],
                "quantity": item["quantity"],
                "modifiers": item.get("modifiers", []),
                "notes": item.get("notes"),
                "course": item.get("course", 1),
                "seat_number": item.get("seat_number"),
                "allergens": item.get("allergens", []),
            }
            for item in order["items"]
            if item.get("fired") and item.get("fired_at") == now
        ],
        "status": "new",  # new, in_progress, ready, served
        "priority": "normal",
        "created_at": now,
        "started_at": None,
        "completed_at": None,
    }
    ticket_result = await db.kds_tickets.insert_one(ticket)

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "items": order["items"],
            "status": "fired",
            "fired_at": now,
            "updated_at": now,
        }}
    )

    return {
        "message": f"Fired {len(fired_items)} items to kitchen",
        "ticket_id": str(ticket_result.inserted_id),
        "items": fired_items,
    }


# ─── Discounts ─── #

@router.post("/{order_id}/discount")
async def apply_discount(order_id: str, body: ApplyDiscount, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Apply discount to order or specific item."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    if body.item_index is not None:
        # Item-level discount
        if body.item_index >= len(order["items"]):
            raise HTTPException(400, "Invalid item index")
        order["items"][body.item_index]["discount"] = {
            "type": body.discount_type,
            "value": body.value,
            "reason": body.reason,
        }
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {"items": order["items"], "updated_at": datetime.utcnow()}}
        )
    else:
        # Order-level discount
        discount = {
            "type": body.discount_type,
            "value": body.value,
            "reason": body.reason,
            "authorised_by": body.authorised_by,
            "applied_at": datetime.utcnow(),
        }
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$push": {"discounts": discount}, "$set": {"updated_at": datetime.utcnow()}}
        )
        order["discounts"].append(discount)

    totals = calc_order_totals(order)
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": totals})

    return {"message": "Discount applied", "totals": totals}


# ─── Service Charge ─── #

@router.put("/{order_id}/service-charge")
async def set_service_charge(order_id: str, tenant: TenantContext = Depends(set_user_tenant_context), percent: float = Body(..., embed=True)):
    """Set service charge percentage (0 to remove)."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    order["service_charge_percent"] = percent
    totals = calc_order_totals(order)

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"service_charge_percent": percent, **totals, "updated_at": datetime.utcnow()}}
    )

    return {"message": f"Service charge set to {percent}%", "totals": totals}


# ─── Split Bill ─── #

@router.post("/{order_id}/split")
async def split_bill(order_id: str, body: SplitBillRequest, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Split the bill equally, by seat, by item, or custom."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    totals = calc_order_totals(order)
    total = totals["total"]
    splits = []

    if body.split_type == "equal":
        n = body.num_splits or 2
        per_person = round(total / n, 2)
        remainder = round(total - (per_person * n), 2)
        for i in range(n):
            amount = per_person + (remainder if i == 0 else 0)
            splits.append({"index": i, "amount": round(amount, 2), "paid": False, "items": []})

    elif body.split_type == "by_seat":
        seat_totals = {}
        for idx, item in enumerate(order["items"]):
            seat = item.get("seat_number", 1)
            seat_totals.setdefault(seat, {"amount": 0, "items": []})
            seat_totals[seat]["amount"] += item.get("line_total", item["unit_price"] * item["quantity"])
            seat_totals[seat]["items"].append(idx)
        for i, (seat, data) in enumerate(sorted(seat_totals.items())):
            splits.append({"index": i, "seat": seat, "amount": round(data["amount"], 2), "paid": False, "items": data["items"]})

    elif body.split_type == "by_item":
        for idx, item in enumerate(order["items"]):
            splits.append({
                "index": idx,
                "amount": round(item.get("line_total", item["unit_price"] * item["quantity"]), 2),
                "paid": False,
                "items": [idx],
                "label": item["name"],
            })

    elif body.split_type == "custom" and body.custom_splits:
        for i, s in enumerate(body.custom_splits):
            splits.append({"index": i, "amount": round(s.get("amount", 0), 2), "paid": False, "items": s.get("items", [])})

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"splits": splits, "updated_at": datetime.utcnow()}}
    )

    return {"splits": splits, "total": total}


# ─── Payments ─── #

@router.post("/{order_id}/pay")
async def process_payment(order_id: str, body: PaymentRequest, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Process a payment against the order."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["status"] in ("paid", "closed", "voided"):
        raise HTTPException(400, "Order already settled")

    payment = {
        "method": body.method,
        "amount": body.amount,
        "tip": body.tip or 0,
        "reference": body.reference,
        "split_index": body.split_index,
        "cash_tendered": body.cash_tendered,
        "change_due": round(body.cash_tendered - body.amount - (body.tip or 0), 2) if body.cash_tendered else 0,
        "processed_at": datetime.utcnow(),
    }

    order["payments"].append(payment)
    totals = calc_order_totals(order)

    # Update split if applicable
    if body.split_index is not None and order.get("splits"):
        for s in order["splits"]:
            if s["index"] == body.split_index:
                s["paid"] = True
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {"splits": order["splits"]}}
        )

    # Check if fully paid
    new_status = order["status"]
    if totals["amount_due"] <= 0.01:
        new_status = "paid"
    elif totals["amount_paid"] > 0:
        new_status = "partially_paid"

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$push": {"payments": payment},
         "$set": {**totals, "status": new_status, "updated_at": datetime.utcnow()}}
    )

    # Free table if fully paid dine-in
    if new_status == "paid" and order["order_type"] == "dine_in" and order.get("table_id"):
        await db.businesses.update_one(
            {"_id": ObjectId(order["business_id"]), "floor_plan.tables.id": order["table_id"]},
            {"$set": {
                "floor_plan.tables.$.status": "available",
                "floor_plan.tables.$.current_order_id": None,
                "floor_plan.tables.$.seated_at": None,
            }}
        )

    return {
        "message": "Payment processed",
        "status": new_status,
        "change_due": payment.get("change_due", 0),
        "totals": totals,
    }


# ─── Close / Void ─── #

@router.post("/{order_id}/close")
async def close_order(order_id: str, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Close a paid order (end of transaction)."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    now = datetime.utcnow()
    duration_mins = round((now - order["opened_at"]).total_seconds() / 60, 1) if order.get("opened_at") else 0

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": "closed",
            "closed_at": now,
            "duration_minutes": duration_mins,
            "updated_at": now,
        }}
    )

    return {"message": "Order closed", "duration_minutes": duration_mins}


@router.post("/{order_id}/void")
async def void_order(order_id: str, tenant: TenantContext = Depends(set_user_tenant_context), reason: str = Body(..., embed=True)):
    """Void entire order (manager action)."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": "voided",
            "void_reason": reason,
            "voided_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }}
    )

    # Free table
    if order.get("table_id"):
        await db.businesses.update_one(
            {"_id": ObjectId(order["business_id"]), "floor_plan.tables.id": order["table_id"]},
            {"$set": {
                "floor_plan.tables.$.status": "available",
                "floor_plan.tables.$.current_order_id": None,
            }}
        )

    return {"message": "Order voided", "reason": reason}


# ─── Refunds ─── #

@router.post("/{order_id}/refund")
async def refund_order(order_id: str, body: RefundRequest, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Refund full or partial order."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    if body.items:
        # Partial refund — specific items
        refund_amount = 0
        refunded_items = []
        for idx in body.items:
            if idx < len(order["items"]):
                item = order["items"][idx]
                refund_amount += item.get("line_total", item["unit_price"] * item["quantity"])
                refunded_items.append(item["name"])
    elif body.amount:
        refund_amount = body.amount
        refunded_items = ["Custom amount"]
    else:
        # Full refund
        refund_amount = sum(p["amount"] for p in order.get("payments", []))
        refunded_items = [item["name"] for item in order["items"]]

    refund = {
        "amount": round(refund_amount, 2),
        "reason": body.reason,
        "items": refunded_items,
        "authorised_by": body.authorised_by,
        "processed_at": datetime.utcnow(),
    }

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$push": {"refunds": refund},
         "$set": {"status": "refunded", "updated_at": datetime.utcnow()}}
    )

    return {"message": f"Refund of £{refund_amount:.2f} processed", "refund": refund}


# ─── Receipt ─── #

@router.get("/{order_id}/receipt")
async def get_receipt(order_id: str, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Generate receipt data for printing or digital delivery."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    biz = await db.businesses.find_one({"_id": ObjectId(order["business_id"])})
    biz_name = biz.get("name", "Restaurant") if biz else "Restaurant"
    biz_address = biz.get("address", "") if biz else ""
    biz_phone = biz.get("phone", "") if biz else ""
    vat_number = biz.get("vat_number", "") if biz else ""

    totals = calc_order_totals(order)

    receipt = {
        "business_name": biz_name,
        "business_address": biz_address,
        "business_phone": biz_phone,
        "vat_number": vat_number,
        "order_number": order.get("order_number"),
        "order_type": order["order_type"],
        "table_number": order.get("table_number"),
        "covers": order.get("covers"),
        "date": order["created_at"].strftime("%d/%m/%Y"),
        "time": order["created_at"].strftime("%H:%M"),
        "items": [
            {
                "name": item["name"],
                "qty": item["quantity"],
                "unit_price": item["unit_price"],
                "modifiers": [m["name"] for m in item.get("modifiers", [])],
                "line_total": item.get("line_total", item["unit_price"] * item["quantity"]),
            }
            for item in order["items"]
        ],
        "subtotal": totals["subtotal"],
        "discounts": order.get("discounts", []),
        "discount_total": totals["discount_total"],
        "vat_amount": totals["vat_amount"],
        "service_charge": totals["service_charge"],
        "total": totals["total"],
        "tips": totals["tips"],
        "grand_total": totals["grand_total"],
        "payments": order.get("payments", []),
        "staff_name": order.get("staff_id"),
        "footer": "Thank you for dining with us!",
    }

    return receipt


# ─── Table Time Tracking ─── #

@router.get("/business/{business_id}/table-times")
async def get_table_times(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get time-at-table for all occupied tables (live service view)."""
    db = get_database()
    open_orders = []
    async for doc in db.orders.find({
        "business_id": business_id,
        "order_type": "dine_in",
        "status": {"$in": ["open", "fired", "partially_paid"]},
    }):
        elapsed = round((datetime.utcnow() - doc["opened_at"]).total_seconds() / 60, 1) if doc.get("opened_at") else 0
        open_orders.append({
            "order_id": str(doc["_id"]),
            "table_number": doc.get("table_number"),
            "table_id": doc.get("table_id"),
            "covers": doc.get("covers"),
            "elapsed_minutes": elapsed,
            "status": doc["status"],
            "total": doc.get("total", 0),
            "items_count": len(doc.get("items", [])),
        })

    return {"tables": open_orders}


# ─── Shift / End of Day Reports ─── #

@router.get("/business/{business_id}/shift-report")
async def shift_report(business_id: str, tenant: TenantContext = Depends(verify_business_access), hours_back: int = 8):
    """Generate shift report (X report)."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(hours=hours_back)

    pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": cutoff}, "status": {"$in": ["paid", "closed"]}}},
        {"$group": {
            "_id": None,
            "total_orders": {"$sum": 1},
            "total_revenue": {"$sum": "$total"},
            "total_tips": {"$sum": "$tips"},
            "total_covers": {"$sum": "$covers"},
            "avg_order_value": {"$avg": "$total"},
            "total_discounts": {"$sum": "$discount_total"},
            "total_vat": {"$sum": "$vat_amount"},
            "total_service_charge": {"$sum": "$service_charge"},
        }}
    ]

    result = await db.orders.aggregate(pipeline).to_list(1)
    summary = result[0] if result else {
        "total_orders": 0, "total_revenue": 0, "total_tips": 0,
        "total_covers": 0, "avg_order_value": 0, "total_discounts": 0,
        "total_vat": 0, "total_service_charge": 0,
    }
    if "_id" in summary:
        del summary["_id"]

    # Payment method breakdown
    pay_pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": cutoff}, "status": {"$in": ["paid", "closed"]}}},
        {"$unwind": "$payments"},
        {"$group": {"_id": "$payments.method", "total": {"$sum": "$payments.amount"}, "count": {"$sum": 1}}},
    ]
    payment_breakdown = {}
    async for doc in db.orders.aggregate(pay_pipeline):
        payment_breakdown[doc["_id"]] = {"total": round(doc["total"], 2), "count": doc["count"]}

    # Voids
    voids = await db.orders.count_documents({
        "business_id": business_id, "created_at": {"$gte": cutoff}, "status": "voided"
    })

    # Refunds
    refund_pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": cutoff}, "refunds": {"$exists": True}}},
        {"$unwind": "$refunds"},
        {"$group": {"_id": None, "total": {"$sum": "$refunds.amount"}, "count": {"$sum": 1}}},
    ]
    refund_result = await db.orders.aggregate(refund_pipeline).to_list(1)
    refund_data = refund_result[0] if refund_result else {"total": 0, "count": 0}

    # Order type breakdown
    type_pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": cutoff}, "status": {"$in": ["paid", "closed"]}}},
        {"$group": {"_id": "$order_type", "count": {"$sum": 1}, "revenue": {"$sum": "$total"}}},
    ]
    type_breakdown = {}
    async for doc in db.orders.aggregate(type_pipeline):
        type_breakdown[doc["_id"]] = {"count": doc["count"], "revenue": round(doc["revenue"], 2)}

    # Round values
    for key in ["total_revenue", "total_tips", "avg_order_value", "total_discounts", "total_vat", "total_service_charge"]:
        if key in summary:
            summary[key] = round(summary[key], 2)

    return {
        "period_hours": hours_back,
        "generated_at": datetime.utcnow().isoformat(),
        **summary,
        "payment_breakdown": payment_breakdown,
        "order_type_breakdown": type_breakdown,
        "voids": voids,
        "refunds": {"total": round(refund_data.get("total", 0), 2), "count": refund_data.get("count", 0)},
    }


@router.get("/business/{business_id}/z-report")
async def z_report(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Generate Z report (end of day) — full day summary."""
    # Z report is just a shift report for the full day
    return await shift_report(business_id, hours_back=24)


# ─── Order Number Generator ─── #

async def _next_order_number(db, business_id: str) -> str:
    """Generate sequential order number per business per day."""
    today = datetime.utcnow().strftime("%Y%m%d")
    counter_id = f"{business_id}_{today}"

    result = await db.order_counters.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = result["seq"]
    return f"#{seq:03d}"


class UpdateOrderStatus(BaseModel):
    status: str

@router.patch("/{order_id}/status")
async def update_order_status(order_id: str, body: UpdateOrderStatus, tenant: TenantContext = Depends(set_user_tenant_context)):
    db = get_database()
    valid = ["confirmed", "preparing", "ready", "collected", "delivered", "cancelled"]
    if body.status not in valid:
        raise HTTPException(400, f"Invalid status")
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")
    update = {"status": body.status, "updated_at": datetime.utcnow()}
    if body.status in ("collected", "delivered"):
        update["closed_at"] = datetime.utcnow()
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": update})
    kds_map = {"preparing": "in_progress", "ready": "ready", "collected": "completed", "delivered": "completed"}
    if body.status in kds_map:
        await db.kds_tickets.update_many({"order_id": order_id}, {"$set": {"status": kds_map[body.status]}})
    return {"ok": True, "status": body.status}
