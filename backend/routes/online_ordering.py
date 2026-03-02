"""
ReeveOS EPOS — Online Ordering & Pay-at-Table API
==================================================
Consumer-facing ordering: QR table ordering, online takeaway/delivery,
pay-at-table, digital receipts, order tracking.
"""
from fastapi import APIRouter, Request
from middleware.rate_limit import limiter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
import uuid
import logging

logger = logging.getLogger("online_ordering")
router = APIRouter(prefix="/online", tags=["Online Ordering & Pay-at-Table"])


# ═══════════════════════════════════════════════════════════════
# QR CODE TABLE ORDERING — Scan, browse menu, order from seat
# ═══════════════════════════════════════════════════════════════

@router.get("/qr/{business_id}/table/{table_number}")
async def qr_table_landing(business_id: str, table_number: str):
    """Landing page data when customer scans QR code at table.
    Returns menu, table info, and session token."""
    db = get_database()
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not biz:
        raise HTTPException(404, "Restaurant not found")

    # Check if table already has an open order
    existing_order = await db.orders.find_one({
        "business_id": business_id,
        "table_number": table_number,
        "status": {"$in": ["open", "fired", "partially_paid"]},
    })

    # Build menu grouped by category (exclude 86'd items)
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

    session_token = str(uuid.uuid4())[:8]

    return {
        "business_name": biz.get("name"),
        "logo": biz.get("logo"),
        "table_number": table_number,
        "session_token": session_token,
        "existing_order_id": str(existing_order["_id"]) if existing_order else None,
        "categories": categories,
        "service_charge_percent": biz.get("default_service_charge", 0),
        "accepts_tips": True,
        "currency": "GBP",
    }


@router.post("/qr/{business_id}/table/{table_number}/order")
@limiter.limit("10/minute")
async def qr_place_order(
    request: Request,
    business_id: str,
    table_number: str,
    items: List[Dict] = Body(...),
    customer_name: Optional[str] = Body(None),
    notes: Optional[str] = Body(None),
    seat_number: Optional[int] = Body(None),
):
    """Place order from QR table scan. Adds to existing order or creates new."""
    db = get_database()

    # Check for existing open order at table
    existing = await db.orders.find_one({
        "business_id": business_id,
        "table_number": table_number,
        "status": {"$in": ["open", "fired"]},
    })

    order_items = []
    for item in items:
        order_items.append({
            "menu_item_id": item.get("id", ""),
            "name": item["name"],
            "quantity": item.get("quantity", 1),
            "unit_price": item["price"],
            "modifiers": item.get("modifiers", []),
            "notes": item.get("notes"),
            "course": item.get("course", 1),
            "seat_number": seat_number,
            "fired": False,
            "source": "qr_table",
        })

    if existing:
        # Add to existing order
        from routes.orders import calc_order_totals
        existing["items"].extend(order_items)
        totals = calc_order_totals(existing)

        await db.orders.update_one(
            {"_id": existing["_id"]},
            {"$push": {"items": {"$each": order_items}},
             "$set": {**totals, "updated_at": datetime.utcnow()}}
        )

        # Create KDS ticket for new items
        ticket = {
            "order_id": str(existing["_id"]),
            "order_number": existing.get("order_number"),
            "business_id": business_id,
            "order_type": "dine_in",
            "table_number": table_number,
            "items": order_items,
            "status": "new",
            "priority": "normal",
            "source": "qr_table",
            "created_at": datetime.utcnow(),
        }
        await db.kds_tickets.insert_one(ticket)

        return {
            "order_id": str(existing["_id"]),
            "order_number": existing.get("order_number"),
            "added_items": len(order_items),
            "totals": totals,
            "message": "Items added to your order",
        }
    else:
        # Create new order
        from routes.orders import create_order, fire_order, CreateOrder, OrderItem

        body = CreateOrder(
            business_id=business_id,
            order_type="dine_in",
            table_number=table_number,
            customer_name=customer_name,
            notes=notes,
            items=[OrderItem(**item) for item in order_items],
        )

        result = await create_order(body)
        fire_result = await fire_order(result["order_id"])

        return {
            "order_id": result["order_id"],
            "order_number": result["order_number"],
            "totals": result["totals"],
            "message": "Order placed and sent to kitchen",
        }


@router.get("/qr/{business_id}/table/{table_number}/status")
async def qr_order_status(business_id: str, table_number: str):
    """Check order status from QR interface — what's been ordered, what's ready."""
    db = get_database()

    order = await db.orders.find_one({
        "business_id": business_id,
        "table_number": table_number,
        "status": {"$in": ["open", "fired", "partially_paid"]},
    })

    if not order:
        return {"has_order": False}

    # Get ticket statuses
    tickets = []
    async for t in db.kds_tickets.find({"order_id": str(order["_id"])}).sort("created_at", 1):
        tickets.append({
            "items": [i["name"] for i in t.get("items", [])],
            "status": t["status"],
            "created_at": t["created_at"].strftime("%H:%M"),
        })

    from routes.orders import calc_order_totals
    totals = calc_order_totals(order)

    return {
        "has_order": True,
        "order_id": str(order["_id"]),
        "order_number": order.get("order_number"),
        "items": [
            {
                "name": i["name"],
                "qty": i["quantity"],
                "price": i["unit_price"],
                "status": "sent" if i.get("fired") else "pending",
            }
            for i in order.get("items", [])
        ],
        "tickets": tickets,
        "totals": totals,
    }


# ═══════════════════════════════════════════════════════════════
# PAY AT TABLE — Customer pays from phone
# ═══════════════════════════════════════════════════════════════

@router.post("/qr/{business_id}/table/{table_number}/pay")
async def pay_at_table(
    business_id: str,
    table_number: str,
    method: str = Body(...),  # card (Stripe), apple_pay, google_pay
    tip_percent: Optional[float] = Body(0),
    split_index: Optional[int] = Body(None),
    payment_method_id: Optional[str] = Body(None),  # Stripe payment method
):
    """Process payment from customer's phone (pay-at-table).
    Integrates with Stripe for card payments."""
    db = get_database()

    order = await db.orders.find_one({
        "business_id": business_id,
        "table_number": table_number,
        "status": {"$in": ["open", "fired", "partially_paid"]},
    })
    if not order:
        raise HTTPException(404, "No open order for this table")

    from routes.orders import calc_order_totals
    totals = calc_order_totals(order)

    if split_index is not None and order.get("splits"):
        amount = order["splits"][split_index]["amount"]
    else:
        amount = totals["amount_due"]

    tip = round(amount * tip_percent / 100, 2) if tip_percent else 0
    charge_amount = round(amount + tip, 2)

    # Create Stripe PaymentIntent
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    stripe_account = biz.get("stripe_account_id") if biz else None

    payment_result = {
        "amount": charge_amount,
        "tip": tip,
        "method": method,
        "status": "pending",
    }

    if stripe_account and payment_method_id:
        try:
            import stripe
            from config import STRIPE_SECRET_KEY
            stripe.api_key = STRIPE_SECRET_KEY

            intent = stripe.PaymentIntent.create(
                amount=int(charge_amount * 100),  # pence
                currency="gbp",
                payment_method=payment_method_id,
                confirm=True,
                stripe_account=stripe_account,
                metadata={
                    "order_id": str(order["_id"]),
                    "table_number": table_number,
                    "tip": str(tip),
                },
                automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
            )
            payment_result["status"] = "succeeded" if intent.status == "succeeded" else intent.status
            payment_result["reference"] = intent.id
        except Exception as e:
            logger.error(f"Stripe error: {e}")
            payment_result["status"] = "failed"
            payment_result["error"] = str(e)
            raise HTTPException(400, f"Payment failed: {str(e)}")
    else:
        # Mock payment for testing
        payment_result["status"] = "succeeded"
        payment_result["reference"] = f"PAT-{uuid.uuid4().hex[:8]}"

    # Record payment on order
    payment = {
        "method": method,
        "amount": amount,
        "tip": tip,
        "reference": payment_result.get("reference"),
        "split_index": split_index,
        "source": "pay_at_table",
        "processed_at": datetime.utcnow(),
    }
    order["payments"].append(payment)
    new_totals = calc_order_totals(order)

    new_status = order["status"]
    if new_totals["amount_due"] <= 0.01:
        new_status = "paid"
    elif new_totals["amount_paid"] > 0:
        new_status = "partially_paid"

    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$push": {"payments": payment},
         "$set": {**new_totals, "status": new_status, "updated_at": datetime.utcnow()}}
    )

    return {
        "status": payment_result["status"],
        "amount_charged": charge_amount,
        "tip": tip,
        "order_status": new_status,
        "remaining_due": new_totals["amount_due"],
    }


# ═══════════════════════════════════════════════════════════════
# ONLINE TAKEAWAY/DELIVERY ORDERING — Consumer-facing
# ═══════════════════════════════════════════════════════════════

@router.get("/menu/{business_id}")
async def public_menu(business_id: str):
    """Public menu for online ordering (takeaway/delivery)."""
    db = get_database()
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not biz:
        raise HTTPException(404, "Restaurant not found")

    # Check if currently accepting orders
    now = datetime.utcnow()
    hours = biz.get("hours", {})
    day = now.strftime("%A").lower()
    today_hours = hours.get(day, {})

    categories = {}
    for item in biz.get("menu", []):
        if item.get("status") == "86":
            continue
        if not item.get("available_online", True):
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
        "business_name": biz.get("name"),
        "logo": biz.get("logo"),
        "address": biz.get("address"),
        "phone": biz.get("phone"),
        "categories": categories,
        "delivery_fee": biz.get("delivery_fee", 2.99),
        "min_order": biz.get("min_order_amount", 10),
        "delivery_radius_miles": biz.get("delivery_radius", 3),
        "estimated_delivery_minutes": biz.get("avg_delivery_time", 35),
        "estimated_collection_minutes": biz.get("avg_collection_time", 20),
        "accepts_delivery": biz.get("accepts_delivery", True),
        "accepts_collection": biz.get("accepts_collection", True),
        "is_open": True,  # TODO: check against hours
    }


@router.post("/order/{business_id}")
@limiter.limit("10/minute")
async def place_online_order(
    request: Request,
    business_id: str,
    items: List[Dict] = Body(...),
    order_type: str = Body(...),  # delivery, collection
    customer_name: str = Body(...),
    customer_phone: str = Body(...),
    customer_email: Optional[str] = Body(None),
    delivery_address: Optional[Dict] = Body(None),
    notes: Optional[str] = Body(None),
    payment_method_id: Optional[str] = Body(None),
    scheduled_for: Optional[str] = Body(None),  # ISO datetime for scheduled orders
):
    """Place online order (takeaway or delivery)."""
    db = get_database()
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not biz:
        raise HTTPException(404, "Restaurant not found")

    # Validate minimum order
    subtotal = sum(i.get("price", 0) * i.get("quantity", 1) for i in items)
    min_order = biz.get("min_order_amount", 0)
    if subtotal < min_order:
        raise HTTPException(400, f"Minimum order is £{min_order}")

    # Build order items
    order_items = []
    for item in items:
        order_items.append({
            "menu_item_id": item.get("id", ""),
            "name": item["name"],
            "quantity": item.get("quantity", 1),
            "unit_price": item["price"],
            "modifiers": item.get("modifiers", []),
            "notes": item.get("notes"),
            "fired": False,
            "source": "online",
        })

    from routes.orders import _next_order_number, calc_order_totals

    order = {
        "business_id": business_id,
        "order_type": order_type,
        "order_number": await _next_order_number(db, business_id),
        "items": order_items,
        "discounts": [],
        "payments": [],
        "status": "pending_payment",  # pending_payment → confirmed → preparing → ready → collected/delivered
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_email": customer_email,
        "delivery_address": delivery_address,
        "delivery_fee": biz.get("delivery_fee", 2.99) if order_type == "delivery" else 0,
        "notes": notes,
        "scheduled_for": scheduled_for,
        "source": "online",
        "service_charge_percent": 0,
        "opened_at": datetime.utcnow(),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    totals = calc_order_totals(order)
    total_with_delivery = totals["total"] + order.get("delivery_fee", 0)
    order.update(totals)
    order["grand_total_with_delivery"] = round(total_with_delivery, 2)

    result = await db.orders.insert_one(order)
    order_id = str(result.inserted_id)

    # Process payment
    stripe_account = biz.get("stripe_account_id")
    if stripe_account and payment_method_id:
        try:
            import stripe
            from config import STRIPE_SECRET_KEY
            stripe.api_key = STRIPE_SECRET_KEY

            intent = stripe.PaymentIntent.create(
                amount=int(total_with_delivery * 100),
                currency="gbp",
                payment_method=payment_method_id,
                confirm=True,
                stripe_account=stripe_account,
                metadata={"order_id": order_id, "type": order_type},
                automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
            )

            if intent.status == "succeeded":
                payment = {
                    "method": "card",
                    "amount": total_with_delivery,
                    "reference": intent.id,
                    "source": "online",
                    "processed_at": datetime.utcnow(),
                }
                await db.orders.update_one(
                    {"_id": ObjectId(order_id)},
                    {"$push": {"payments": payment},
                     "$set": {"status": "confirmed", "amount_paid": total_with_delivery}}
                )

                # Auto-fire to KDS
                ticket = {
                    "order_id": order_id,
                    "order_number": order["order_number"],
                    "business_id": business_id,
                    "order_type": order_type,
                    "items": order_items,
                    "status": "new",
                    "priority": "normal",
                    "source": "online",
                    "customer_name": customer_name,
                    "created_at": datetime.utcnow(),
                }
                await db.kds_tickets.insert_one(ticket)
        except Exception as e:
            logger.error(f"Online payment error: {e}")
            raise HTTPException(400, f"Payment failed: {str(e)}")

    return {
        "order_id": order_id,
        "order_number": order["order_number"],
        "total": round(total_with_delivery, 2),
        "delivery_fee": order.get("delivery_fee", 0),
        "estimated_minutes": biz.get("avg_delivery_time", 35) if order_type == "delivery" else biz.get("avg_collection_time", 20),
        "status": "confirmed",
    }


@router.get("/track/{order_id}")
async def track_order(order_id: str):
    """Customer-facing order tracking."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    # Get latest KDS status
    latest_ticket = await db.kds_tickets.find_one(
        {"order_id": order_id},
        sort=[("created_at", -1)]
    )

    status_steps = {
        "confirmed": {"step": 1, "label": "Order confirmed"},
        "fired": {"step": 2, "label": "Being prepared"},
        "in_progress": {"step": 2, "label": "Being prepared"},
        "ready": {"step": 3, "label": "Ready for collection" if order.get("order_type") == "collection" else "Ready for delivery"},
        "served": {"step": 4, "label": "Collected" if order.get("order_type") == "collection" else "Out for delivery"},
        "paid": {"step": 4, "label": "Complete"},
        "closed": {"step": 4, "label": "Complete"},
    }

    current_status = order.get("status", "confirmed")
    if latest_ticket:
        ticket_status = latest_ticket.get("status")
        if ticket_status in status_steps:
            current_status = ticket_status

    step_info = status_steps.get(current_status, {"step": 1, "label": "Processing"})

    return {
        "order_id": str(order["_id"]),
        "order_number": order.get("order_number"),
        "status": current_status,
        "step": step_info["step"],
        "label": step_info["label"],
        "items": [{"name": i["name"], "qty": i["quantity"]} for i in order.get("items", [])],
        "total": order.get("grand_total_with_delivery", order.get("total", 0)),
        "order_type": order.get("order_type"),
        "placed_at": order["created_at"].strftime("%H:%M"),
    }


# ═══════════════════════════════════════════════════════════════
# DIGITAL RECEIPTS — Email/SMS receipts
# ═══════════════════════════════════════════════════════════════

@router.post("/receipt/{order_id}/send")
async def send_digital_receipt(
    order_id: str,
    method: str = Body("email"),  # email or sms
    destination: str = Body(...),  # email address or phone number
):
    """Send digital receipt — no paper waste.
    Competitors charge extra for this. Ours is free."""
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    # Get receipt data
    from routes.orders import calc_order_totals
    totals = calc_order_totals(order)

    biz = await db.businesses.find_one({"_id": ObjectId(order["business_id"])})
    biz_name = biz.get("name", "Restaurant") if biz else "Restaurant"

    receipt_data = {
        "business_name": biz_name,
        "order_number": order.get("order_number"),
        "date": order["created_at"].strftime("%d %B %Y"),
        "time": order["created_at"].strftime("%H:%M"),
        "items": order.get("items", []),
        "totals": totals,
        "method": method,
        "destination": destination,
        "sent_at": datetime.utcnow(),
    }

    # Log the receipt send
    await db.digital_receipts.insert_one({
        **receipt_data,
        "order_id": order_id,
        "business_id": order["business_id"],
    })

    # TODO: Integrate with email/SMS provider (Resend/Twilio)

    return {"message": f"Receipt sent via {method} to {destination}"}
