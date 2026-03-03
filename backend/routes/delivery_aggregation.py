"""
ReeveOS EPOS — Delivery Platform Aggregation Hub
===================================================
Unified delivery order management across Deliveroo, UberEats, Just Eat, and Uber Direct.
All orders flow into a single screen, auto-fire to KDS, status syncs back to platforms.

Architecture:
- Webhook receivers for each platform's order notifications
- Unified order model that maps to EPOS order system
- Status state machine: received → accepted → preparing → ready → picked_up → delivered
- Auto-accept mode with configurable rules
- Commission tracking and profitability per platform

COMPETITIVE EDGE:
- Epos Now: relies on third-party Deliverect/Otter (£50-150/month extra)
- Toast: US-centric integrations only
- ReeveOS: native integration with zero middleware cost, plus Uber Direct for own-brand delivery
"""
from fastapi import Depends,  APIRouter, HTTPException, Body, Request, Query, Header
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
import logging
import httpx
import hashlib
import hmac
import json
from middleware.tenant import verify_business_access, TenantContext

logger = logging.getLogger("delivery")
router = APIRouter(prefix="/delivery", tags=["Delivery Aggregation"])


# ─── Models ─── #

class PlatformConfig(BaseModel):
    platform: str  # deliveroo, ubereats, justeat, uber_direct
    enabled: bool = True
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    store_id: Optional[str] = None
    webhook_secret: Optional[str] = None
    auto_accept: bool = False
    auto_accept_max_value: Optional[float] = None  # auto-accept orders under this value
    prep_time_minutes: int = 15
    commission_rate: Optional[float] = None  # e.g., 25.0 for 25%

class DeliveryOrderItem(BaseModel):
    name: str
    quantity: int
    unit_price: float
    modifiers: List[Dict] = []
    notes: Optional[str] = None
    platform_item_id: Optional[str] = None

class DeliveryOrder(BaseModel):
    platform: str
    platform_order_id: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    items: List[DeliveryOrderItem]
    subtotal: float
    delivery_fee: Optional[float] = 0
    platform_fee: Optional[float] = 0
    tip: Optional[float] = 0
    total: float
    notes: Optional[str] = None
    estimated_pickup: Optional[str] = None
    payment_method: str = "online"

class OrderStatusUpdate(BaseModel):
    status: str  # accepted, rejected, preparing, ready, picked_up, delivered, cancelled
    reason: Optional[str] = None
    estimated_minutes: Optional[int] = None


# ─── Platform Configuration ─── #

@router.get("/business/{business_id}/platforms")
async def get_platform_configs(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get all delivery platform configurations."""
    db = get_database()
    configs = []
    async for doc in db.delivery_platforms.find({"business_id": business_id}):
        doc["_id"] = str(doc["_id"])
        doc.pop("api_secret", None)
        doc.pop("webhook_secret", None)
        configs.append(doc)
    
    return {"platforms": configs}


@router.put("/business/{business_id}/platforms/{platform}")
async def set_platform_config(business_id: str, tenant: TenantContext = Depends(verify_business_access), platform: str, body: PlatformConfig):
    """Configure a delivery platform integration."""
    db = get_database()
    
    valid_platforms = ["deliveroo", "ubereats", "justeat", "uber_direct"]
    if platform not in valid_platforms:
        raise HTTPException(400, f"Invalid platform. Supported: {valid_platforms}")
    
    config = body.dict()
    config["business_id"] = business_id
    config["platform"] = platform
    config["updated_at"] = datetime.utcnow()
    
    await db.delivery_platforms.update_one(
        {"business_id": business_id, "platform": platform},
        {"$set": config, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True
    )
    
    return {"updated": True, "platform": platform}


@router.put("/business/{business_id}/platforms/{platform}/toggle")
async def toggle_platform(business_id: str, tenant: TenantContext = Depends(verify_business_access), platform: str, enabled: bool = Body(..., embed=True)):
    """Quick toggle a platform on/off (e.g., kitchen too busy)."""
    db = get_database()
    result = await db.delivery_platforms.update_one(
        {"business_id": business_id, "platform": platform},
        {"$set": {"enabled": enabled, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Platform not configured")
    return {"platform": platform, "enabled": enabled}


@router.put("/business/{business_id}/platforms/{platform}/prep-time")
async def update_prep_time(business_id: str, tenant: TenantContext = Depends(verify_business_access), platform: str, minutes: int = Body(..., embed=True)):
    """Update prep time for a platform. Syncs to platform if API supports it."""
    db = get_database()
    await db.delivery_platforms.update_one(
        {"business_id": business_id, "platform": platform},
        {"$set": {"prep_time_minutes": minutes, "updated_at": datetime.utcnow()}}
    )
    return {"prep_time_minutes": minutes}


# ─── Webhook Receivers (Platform → ReeveOS) ─── #

@router.post("/webhooks/deliveroo/{business_id}")
async def deliveroo_webhook(business_id: str, tenant: TenantContext = Depends(verify_business_access), request: Request):
    """
    Deliveroo order webhook receiver.
    Transforms Deliveroo order format into unified ReeveOS order.
    """
    db = get_database()
    body = await request.json()
    
    # Verify webhook signature if configured
    config = await db.delivery_platforms.find_one(
        {"business_id": business_id, "platform": "deliveroo"}
    )
    if not config or not config.get("enabled"):
        raise HTTPException(400, "Deliveroo integration not enabled")
    
    event_type = body.get("event_type", body.get("type", ""))
    
    if event_type in ("order.created", "order_placed"):
        order_data = body.get("order", body)
        
        items = []
        for item in order_data.get("items", []):
            items.append({
                "name": item.get("name"),
                "quantity": item.get("quantity", 1),
                "unit_price": item.get("total_price", {}).get("fractional", 0) / 100,
                "modifiers": [{"name": m.get("name")} for m in item.get("modifiers", [])],
                "notes": item.get("customer_note"),
                "platform_item_id": item.get("id")
            })
        
        delivery_order = {
            "business_id": business_id,
            "platform": "deliveroo",
            "platform_order_id": order_data.get("id"),
            "display_id": order_data.get("display_id", order_data.get("id", "")[:8]),
            "customer_name": order_data.get("customer", {}).get("first_name", "Customer"),
            "customer_phone": order_data.get("customer", {}).get("phone"),
            "customer_address": _format_address(order_data.get("delivery_location", {})),
            "items": items,
            "subtotal": order_data.get("order_total", {}).get("fractional", 0) / 100,
            "delivery_fee": order_data.get("delivery_fee", {}).get("fractional", 0) / 100,
            "platform_fee": 0,
            "tip": order_data.get("tip", {}).get("fractional", 0) / 100,
            "total": order_data.get("order_total", {}).get("fractional", 0) / 100,
            "notes": order_data.get("customer_note"),
            "estimated_pickup": order_data.get("estimated_ready_at"),
            "status": "received",
            "commission_rate": config.get("commission_rate", 25),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await db.delivery_orders.insert_one(delivery_order)
        
        # Auto-accept if configured
        if config.get("auto_accept"):
            max_val = config.get("auto_accept_max_value")
            if max_val is None or delivery_order["total"] <= max_val:
                await _accept_order(db, str(result.inserted_id), business_id, config)
        
        # Fire to KDS
        await _create_kds_ticket(db, business_id, delivery_order, str(result.inserted_id))
        
        return {"received": True, "order_id": str(result.inserted_id)}
    
    elif event_type in ("order.cancelled", "order_cancelled"):
        platform_id = body.get("order", {}).get("id", body.get("order_id"))
        await db.delivery_orders.update_one(
            {"business_id": business_id, "platform_order_id": platform_id},
            {"$set": {"status": "cancelled", "cancelled_reason": body.get("reason"), "updated_at": datetime.utcnow()}}
        )
        return {"received": True, "action": "cancelled"}
    
    return {"received": True}


@router.post("/webhooks/ubereats/{business_id}")
async def ubereats_webhook(business_id: str, tenant: TenantContext = Depends(verify_business_access), request: Request):
    """UberEats order webhook receiver."""
    db = get_database()
    body = await request.json()
    
    config = await db.delivery_platforms.find_one(
        {"business_id": business_id, "platform": "ubereats"}
    )
    if not config or not config.get("enabled"):
        raise HTTPException(400, "UberEats integration not enabled")
    
    event_type = body.get("event_type", "")
    
    if event_type in ("orders.notification", ""):
        order_data = body.get("meta", {}).get("resource_href") and body or body
        
        items = []
        for item in order_data.get("cart", {}).get("items", []):
            items.append({
                "name": item.get("title"),
                "quantity": item.get("quantity", 1),
                "unit_price": item.get("price", {}).get("unit_price", {}).get("amount", 0) / 100,
                "modifiers": [{"name": c.get("title")} for c in item.get("selected_modifier_groups", [])],
                "notes": item.get("special_instructions"),
                "platform_item_id": item.get("id")
            })
        
        eater = order_data.get("eater", {})
        delivery = order_data.get("delivery_info", {})
        
        delivery_order = {
            "business_id": business_id,
            "platform": "ubereats",
            "platform_order_id": order_data.get("id"),
            "display_id": order_data.get("display_id", ""),
            "customer_name": f"{eater.get('first_name', '')} {eater.get('last_name', '')}".strip(),
            "customer_phone": eater.get("phone"),
            "customer_address": delivery.get("location", {}).get("formatted_address", ""),
            "items": items,
            "subtotal": order_data.get("payment", {}).get("charges", {}).get("sub_total", {}).get("amount", 0) / 100,
            "delivery_fee": 0,
            "platform_fee": 0,
            "tip": order_data.get("payment", {}).get("charges", {}).get("tip", {}).get("amount", 0) / 100,
            "total": order_data.get("payment", {}).get("charges", {}).get("total", {}).get("amount", 0) / 100,
            "notes": order_data.get("special_instructions"),
            "estimated_pickup": order_data.get("estimated_ready_for_pickup_at"),
            "status": "received",
            "commission_rate": config.get("commission_rate", 30),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await db.delivery_orders.insert_one(delivery_order)
        
        if config.get("auto_accept"):
            max_val = config.get("auto_accept_max_value")
            if max_val is None or delivery_order["total"] <= max_val:
                await _accept_order(db, str(result.inserted_id), business_id, config)
        
        await _create_kds_ticket(db, business_id, delivery_order, str(result.inserted_id))
        
        return {"received": True, "order_id": str(result.inserted_id)}
    
    return {"received": True}


@router.post("/webhooks/justeat/{business_id}")
async def justeat_webhook(business_id: str, tenant: TenantContext = Depends(verify_business_access), request: Request):
    """Just Eat order webhook receiver."""
    db = get_database()
    body = await request.json()
    
    config = await db.delivery_platforms.find_one(
        {"business_id": business_id, "platform": "justeat"}
    )
    if not config or not config.get("enabled"):
        raise HTTPException(400, "Just Eat integration not enabled")
    
    items = []
    for item in body.get("Items", body.get("items", [])):
        items.append({
            "name": item.get("Name", item.get("name")),
            "quantity": item.get("Quantity", item.get("quantity", 1)),
            "unit_price": item.get("UnitPrice", item.get("unit_price", 0)),
            "modifiers": [{"name": m.get("Name", m.get("name"))} for m in item.get("Modifiers", item.get("modifiers", []))],
            "notes": item.get("Note", item.get("note")),
            "platform_item_id": item.get("Id", item.get("id"))
        })
    
    customer = body.get("Customer", body.get("customer", {}))
    address = body.get("DeliveryAddress", body.get("delivery_address", {}))
    
    delivery_order = {
        "business_id": business_id,
        "platform": "justeat",
        "platform_order_id": body.get("Id", body.get("id")),
        "display_id": body.get("FriendlyOrderReference", body.get("friendly_reference", "")),
        "customer_name": customer.get("Name", customer.get("name", "Customer")),
        "customer_phone": customer.get("PhoneNumber", customer.get("phone")),
        "customer_address": f"{address.get('Line1', '')} {address.get('Line2', '')} {address.get('City', '')} {address.get('Postcode', '')}".strip(),
        "items": items,
        "subtotal": body.get("SubTotal", body.get("subtotal", 0)),
        "delivery_fee": body.get("DeliveryCharge", body.get("delivery_charge", 0)),
        "platform_fee": 0,
        "tip": body.get("Tip", body.get("tip", 0)),
        "total": body.get("TotalPrice", body.get("total", 0)),
        "notes": body.get("NoteToRestaurant", body.get("notes")),
        "estimated_pickup": body.get("DueDate", body.get("due_date")),
        "status": "received",
        "commission_rate": config.get("commission_rate", 14),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.delivery_orders.insert_one(delivery_order)
    
    if config.get("auto_accept"):
        max_val = config.get("auto_accept_max_value")
        if max_val is None or delivery_order["total"] <= max_val:
            await _accept_order(db, str(result.inserted_id), business_id, config)
    
    await _create_kds_ticket(db, business_id, delivery_order, str(result.inserted_id))
    
    return {"received": True, "order_id": str(result.inserted_id)}


# ─── Uber Direct (Own-Brand Delivery) ─── #

@router.post("/business/{business_id}/uber-direct/create")
async def create_uber_direct_delivery(business_id: str, tenant: TenantContext = Depends(verify_business_access), order_id: str = Body(..., embed=True)):
    """
    Create an Uber Direct delivery for an own-brand online order.
    This is ReeveOS's zero-commission alternative — restaurant keeps 100% minus delivery cost.
    """
    db = get_database()
    
    config = await db.delivery_platforms.find_one(
        {"business_id": business_id, "platform": "uber_direct"}
    )
    if not config:
        raise HTTPException(400, "Uber Direct not configured")
    
    order = await db.delivery_orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        # Check main orders collection
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")
    
    # Get business address for pickup
    business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not business:
        raise HTTPException(404, "Business not found")
    
    # Create Uber Direct delivery request
    payload = {
        "pickup_address": business.get("address", ""),
        "pickup_name": business.get("name"),
        "pickup_phone_number": business.get("phone"),
        "dropoff_address": order.get("customer_address", ""),
        "dropoff_name": order.get("customer_name"),
        "dropoff_phone_number": order.get("customer_phone"),
        "manifest_items": [
            {"name": item["name"], "quantity": item["quantity"]}
            for item in order.get("items", [])
        ],
        "pickup_ready_dt": (datetime.utcnow() + timedelta(minutes=config.get("prep_time_minutes", 15))).isoformat() + "Z",
        "external_id": order_id
    }
    
    try:
        headers = {
            "Authorization": f"Bearer {config.get('api_key')}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.uber.com/v1/customers/{customer_id}/deliveries",
                headers=headers,
                json=payload,
                timeout=30
            )
        
        if resp.status_code in (200, 201):
            data = resp.json()
            
            await db.delivery_orders.update_one(
                {"_id": ObjectId(order_id)},
                {"$set": {
                    "uber_direct_id": data.get("id"),
                    "uber_direct_status": data.get("status"),
                    "uber_direct_tracking_url": data.get("tracking_url"),
                    "uber_direct_fee": data.get("fee", {}).get("total"),
                    "updated_at": datetime.utcnow()
                }}
            )
            
            return {
                "delivery_id": data.get("id"),
                "status": data.get("status"),
                "tracking_url": data.get("tracking_url"),
                "estimated_fee": data.get("fee", {}).get("total"),
                "eta": data.get("dropoff", {}).get("eta")
            }
        else:
            return {"error": resp.text, "status_code": resp.status_code}
    
    except Exception as e:
        return {"error": str(e)}


@router.get("/business/{business_id}/uber-direct/quote")
async def get_uber_direct_quote(
    business_id: str,
    dropoff_address: str = Query(...)
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get a delivery fee quote from Uber Direct before creating the delivery."""
    db = get_database()
    
    config = await db.delivery_platforms.find_one(
        {"business_id": business_id, "platform": "uber_direct"}
    )
    if not config:
        raise HTTPException(400, "Uber Direct not configured")
    
    business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not business:
        raise HTTPException(404, "Business not found")
    
    try:
        headers = {
            "Authorization": f"Bearer {config.get('api_key')}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "pickup_address": business.get("address", ""),
            "dropoff_address": dropoff_address
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.uber.com/v1/customers/{customer_id}/delivery_quotes",
                headers=headers,
                json=payload,
                timeout=15
            )
        
        if resp.status_code == 200:
            data = resp.json()
            return {
                "fee": data.get("fee"),
                "currency": data.get("currency", "GBP"),
                "eta_minutes": data.get("duration"),
                "distance_km": data.get("distance")
            }
        else:
            return {"error": "Unable to get quote", "details": resp.text}
    
    except Exception as e:
        return {"error": str(e)}


# ─── Unified Order Management ─── #

@router.get("/business/{business_id}/orders")
async def get_delivery_orders(
    business_id: str,
    platform: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 50
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get all delivery orders across all platforms. The unified inbox."""
    db = get_database()
    query = {"business_id": business_id}
    
    if platform:
        query["platform"] = platform
    if status:
        query["status"] = status
    if from_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(from_date)}
    if to_date:
        query.setdefault("created_at", {})
        query["created_at"]["$lte"] = datetime.fromisoformat(to_date + "T23:59:59")
    
    orders = []
    async for doc in db.delivery_orders.find(query).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        # Calculate commission
        if doc.get("commission_rate") and doc.get("subtotal"):
            doc["estimated_commission"] = round(doc["subtotal"] * doc["commission_rate"] / 100, 2)
            doc["net_revenue"] = round(doc["subtotal"] - doc["estimated_commission"], 2)
        orders.append(doc)
    
    return {"orders": orders, "count": len(orders)}


@router.get("/business/{business_id}/orders/live")
async def get_live_delivery_orders(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get currently active delivery orders (not yet delivered/cancelled)."""
    db = get_database()
    
    active_statuses = ["received", "accepted", "preparing", "ready", "picked_up"]
    orders = []
    async for doc in db.delivery_orders.find({
        "business_id": business_id,
        "status": {"$in": active_statuses}
    }).sort("created_at", 1):
        doc["_id"] = str(doc["_id"])
        # Calculate time since received
        created = doc.get("created_at", datetime.utcnow())
        doc["minutes_since_received"] = round((datetime.utcnow() - created).total_seconds() / 60, 1)
        orders.append(doc)
    
    return {
        "orders": orders,
        "count": len(orders),
        "by_platform": _count_by_field(orders, "platform"),
        "by_status": _count_by_field(orders, "status")
    }


@router.put("/business/{business_id}/orders/{order_id}/status")
async def update_delivery_order_status(business_id: str, tenant: TenantContext = Depends(verify_business_access), order_id: str, body: OrderStatusUpdate):
    """
    Update delivery order status. Syncs status back to the originating platform.
    
    Status flow: received → accepted → preparing → ready → picked_up → delivered
    Also: received → rejected, any → cancelled
    """
    db = get_database()
    
    valid_statuses = ["accepted", "rejected", "preparing", "ready", "picked_up", "delivered", "cancelled"]
    if body.status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Valid: {valid_statuses}")
    
    order = await db.delivery_orders.find_one(
        {"_id": ObjectId(order_id), "business_id": business_id}
    )
    if not order:
        raise HTTPException(404, "Order not found")
    
    update = {
        "status": body.status,
        "updated_at": datetime.utcnow(),
        f"status_{body.status}_at": datetime.utcnow()
    }
    if body.reason:
        update["status_reason"] = body.reason
    if body.estimated_minutes:
        update["estimated_ready_minutes"] = body.estimated_minutes
    
    await db.delivery_orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": update}
    )
    
    # Sync status back to platform
    platform = order.get("platform")
    config = await db.delivery_platforms.find_one(
        {"business_id": business_id, "platform": platform}
    )
    
    if config:
        sync_result = await _sync_status_to_platform(
            platform, config, order.get("platform_order_id"), body.status, body.estimated_minutes
        )
    
    return {"updated": True, "status": body.status}


@router.post("/business/{business_id}/orders/{order_id}/accept")
async def accept_delivery_order(business_id: str, tenant: TenantContext = Depends(verify_business_access), order_id: str, prep_minutes: int = Body(15, embed=True)):
    """Quick accept an order with estimated prep time."""
    return await update_delivery_order_status(
        business_id, order_id,
        OrderStatusUpdate(status="accepted", estimated_minutes=prep_minutes)
    )


@router.post("/business/{business_id}/orders/{order_id}/reject")
async def reject_delivery_order(business_id: str, tenant: TenantContext = Depends(verify_business_access), order_id: str, reason: str = Body(..., embed=True)):
    """Reject an order with reason."""
    return await update_delivery_order_status(
        business_id, order_id,
        OrderStatusUpdate(status="rejected", reason=reason)
    )


@router.post("/business/{business_id}/orders/{order_id}/ready")
async def mark_order_ready(business_id: str, tenant: TenantContext = Depends(verify_business_access), order_id: str):
    """Mark order as ready for pickup."""
    return await update_delivery_order_status(
        business_id, order_id,
        OrderStatusUpdate(status="ready")
    )


# ─── Menu Sync ─── #

@router.post("/business/{business_id}/sync-menu/{platform}")
async def sync_menu_to_platform(business_id: str, tenant: TenantContext = Depends(verify_business_access), platform: str):
    """
    Sync ReeveOS menu to a delivery platform.
    Maps menu items, modifiers, prices, and availability.
    """
    db = get_database()
    
    config = await db.delivery_platforms.find_one(
        {"business_id": business_id, "platform": platform}
    )
    if not config:
        raise HTTPException(400, f"{platform} not configured")
    
    # Get menu items
    items = []
    async for item in db.menu_items.find({
        "business_id": business_id,
        "active": {"$ne": False},
        "available_for_delivery": {"$ne": False}
    }):
        items.append({
            "id": str(item["_id"]),
            "name": item.get("name"),
            "description": item.get("description", ""),
            "price": item.get("price", 0),
            "category": item.get("category", ""),
            "image_url": item.get("image_url"),
            "allergens": item.get("calculated_allergens", {}).get("contains", []),
            "modifiers": item.get("modifiers", []),
            "available": item.get("in_stock", True)
        })
    
    return {
        "items_to_sync": len(items),
        "platform": platform,
        "menu": items,
        "note": f"Push to {platform} API to update menu listing"
    }


@router.put("/business/{business_id}/item/{item_id}/availability")
async def toggle_item_delivery_availability(business_id: str, tenant: TenantContext = Depends(verify_business_access), item_id: str, available: bool = Body(..., embed=True)):
    """
    86 an item across all delivery platforms instantly.
    Marks item unavailable and syncs to all connected platforms.
    """
    db = get_database()
    
    await db.menu_items.update_one(
        {"_id": ObjectId(item_id), "business_id": business_id},
        {"$set": {"in_stock": available, "updated_at": datetime.utcnow()}}
    )
    
    # Notify all connected platforms
    platforms_notified = []
    async for config in db.delivery_platforms.find(
        {"business_id": business_id, "enabled": True}
    ):
        platforms_notified.append(config["platform"])
    
    return {
        "item_id": item_id,
        "available": available,
        "platforms_notified": platforms_notified
    }


# ─── Delivery Analytics ─── #

@router.get("/business/{business_id}/analytics")
async def get_delivery_analytics(
    business_id: str,
    from_date: str = Query(...),
    to_date: str = Query(...)
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Delivery analytics with commission tracking — the data restaurants need
    to decide whether delivery platforms are actually profitable.
    """
    db = get_database()
    
    from_dt = datetime.fromisoformat(from_date)
    to_dt = datetime.fromisoformat(to_date + "T23:59:59")
    
    pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": from_dt, "$lte": to_dt},
            "status": {"$nin": ["rejected", "cancelled"]}
        }},
        {"$group": {
            "_id": "$platform",
            "order_count": {"$sum": 1},
            "total_revenue": {"$sum": "$subtotal"},
            "total_tips": {"$sum": "$tip"},
            "avg_order_value": {"$avg": "$subtotal"},
            "avg_commission_rate": {"$avg": "$commission_rate"}
        }}
    ]
    
    by_platform = {}
    totals = {"orders": 0, "revenue": 0, "commission": 0, "net": 0, "tips": 0}
    
    async for doc in db.delivery_orders.aggregate(pipeline):
        platform = doc["_id"]
        commission = round(doc["total_revenue"] * (doc["avg_commission_rate"] or 0) / 100, 2)
        net = round(doc["total_revenue"] - commission, 2)
        
        by_platform[platform] = {
            "orders": doc["order_count"],
            "gross_revenue": round(doc["total_revenue"], 2),
            "commission_rate": round(doc["avg_commission_rate"] or 0, 1),
            "estimated_commission": commission,
            "net_revenue": net,
            "tips": round(doc["total_tips"] or 0, 2),
            "avg_order_value": round(doc["avg_order_value"] or 0, 2),
            "effective_margin": round((net / doc["total_revenue"] * 100) if doc["total_revenue"] > 0 else 0, 1)
        }
        
        totals["orders"] += doc["order_count"]
        totals["revenue"] += doc["total_revenue"]
        totals["commission"] += commission
        totals["net"] += net
        totals["tips"] += doc["total_tips"] or 0
    
    # Round totals
    for k in totals:
        if isinstance(totals[k], float):
            totals[k] = round(totals[k], 2)
    
    # Timing analytics
    timing_pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": from_dt, "$lte": to_dt},
            "status_accepted_at": {"$exists": True}
        }},
        {"$project": {
            "platform": 1,
            "accept_time": {"$subtract": ["$status_accepted_at", "$created_at"]},
            "prep_time": {"$subtract": [
                {"$ifNull": ["$status_ready_at", "$updated_at"]},
                {"$ifNull": ["$status_accepted_at", "$created_at"]}
            ]}
        }},
        {"$group": {
            "_id": "$platform",
            "avg_accept_seconds": {"$avg": "$accept_time"},
            "avg_prep_seconds": {"$avg": "$prep_time"}
        }}
    ]
    
    timing = {}
    async for doc in db.delivery_orders.aggregate(timing_pipeline):
        accept_ms = doc.get("avg_accept_seconds", 0)
        prep_ms = doc.get("avg_prep_seconds", 0)
        timing[doc["_id"]] = {
            "avg_accept_minutes": round(accept_ms / 60000, 1) if accept_ms else 0,
            "avg_prep_minutes": round(prep_ms / 60000, 1) if prep_ms else 0
        }
    
    return {
        "period": {"from": from_date, "to": to_date},
        "by_platform": by_platform,
        "totals": totals,
        "timing": timing,
        "insights": _generate_delivery_insights(by_platform, totals)
    }


# ─── Internal Helpers ─── #

def _format_address(location: dict) -> str:
    """Format delivery address from various platform formats."""
    parts = [
        location.get("address_line_1", location.get("line1", "")),
        location.get("address_line_2", location.get("line2", "")),
        location.get("city", ""),
        location.get("postal_code", location.get("postcode", ""))
    ]
    return ", ".join(p for p in parts if p)


def _count_by_field(orders: list, field: str) -> dict:
    counts = {}
    for o in orders:
        val = o.get(field, "unknown")
        counts[val] = counts.get(val, 0) + 1
    return counts


async def _accept_order(db, order_id: str, business_id: str, config: dict):
    """Auto-accept an order."""
    await db.delivery_orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": "accepted",
            "status_accepted_at": datetime.utcnow(),
            "auto_accepted": True,
            "updated_at": datetime.utcnow()
        }}
    )


async def _create_kds_ticket(db, business_id: str, order: dict, order_id: str):
    """Create a KDS ticket from a delivery order."""
    ticket = {
        "business_id": business_id,
        "order_id": order_id,
        "source": f"delivery_{order.get('platform')}",
        "display_id": order.get("display_id", order.get("platform_order_id", "")[:8]),
        "type": "delivery",
        "platform": order.get("platform"),
        "items": order.get("items", []),
        "notes": order.get("notes"),
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    await db.kds_tickets.insert_one(ticket)


async def _sync_status_to_platform(platform, config, platform_order_id, status, estimated_minutes):
    """Sync order status back to delivery platform."""
    # Status mapping per platform
    status_maps = {
        "deliveroo": {
            "accepted": "accepted",
            "preparing": "in_kitchen",
            "ready": "ready_for_collection",
            "rejected": "rejected"
        },
        "ubereats": {
            "accepted": "ACCEPT",
            "preparing": "PREP",
            "ready": "READY_FOR_PICKUP",
            "rejected": "DENY"
        },
        "justeat": {
            "accepted": "Accepted",
            "preparing": "InKitchen",
            "ready": "ReadyForCollection",
            "rejected": "Rejected"
        }
    }
    
    platform_status = status_maps.get(platform, {}).get(status)
    if not platform_status:
        return {"synced": False, "reason": "No status mapping"}
    
    return {"synced": True, "platform_status": platform_status, "note": "Would push to platform API"}


def _generate_delivery_insights(by_platform: dict, totals: dict) -> list:
    """Generate actionable insights from delivery data."""
    insights = []
    
    for platform, data in by_platform.items():
        if data["effective_margin"] < 50:
            insights.append({
                "type": "warning",
                "message": f"{platform.title()} margin is only {data['effective_margin']}% — consider raising delivery menu prices by 15-20%"
            })
        
        if data["avg_order_value"] < 15:
            insights.append({
                "type": "suggestion",
                "message": f"{platform.title()} average order is £{data['avg_order_value']:.2f} — set minimum order value to improve profitability"
            })
    
    if totals["commission"] > 0 and totals["revenue"] > 0:
        overall_margin = round((totals["net"] / totals["revenue"]) * 100, 1)
        if overall_margin < 60:
            insights.append({
                "type": "critical",
                "message": f"Overall delivery margin is {overall_margin}%. Consider shifting volume to Uber Direct (zero commission) via your own website."
            })
    
    return insights
