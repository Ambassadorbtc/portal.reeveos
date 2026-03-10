"""
ReeveOS Ecommerce API
=====================
Product catalog, cart, checkout, order management, discount codes, gift vouchers.
Every endpoint tenant-isolated. QR codes resolve to ONE business only.

Collections:
  shop_products   — product catalog per business
  shop_carts      — active carts (session-based or client-linked)
  shop_orders     — completed orders with status tracking
  shop_discounts  — discount codes per business
  shop_vouchers   — gift vouchers per business
"""
from fastapi import APIRouter, Depends, Body, Query, HTTPException, Header
from datetime import datetime, timedelta
from typing import Optional, List
from database import get_database
from middleware.tenant import verify_business_access, TenantContext
from bson import ObjectId
import random
import string
import logging

logger = logging.getLogger("shop")
router = APIRouter(prefix="/shop", tags=["Shop / Ecommerce"])


def _gen_id(prefix="prod"):
    return f"{prefix}_{''.join(random.choices(string.ascii_lowercase + string.digits, k=10))}"


def _gen_order_number():
    return f"RZ-{''.join(random.choices(string.digits, k=6))}"


def _gen_voucher_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))


# ═══════════════════════════════════════════════════════════════
# PRODUCTS — catalog management (business owner)
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/products")
async def list_products(
    business_id: str,
    category: Optional[str] = None,
    status: Optional[str] = None,
    include_deleted: bool = False,
    tenant: TenantContext = Depends(verify_business_access),
):
    """List all products for a business."""
    db = get_database()
    match = {"business_id": tenant.business_id}
    if not include_deleted:
        match["deleted"] = {"$ne": True}
    if status:
        match["status"] = status

    if category:
        match["category"] = category

    products = []
    async for p in db.shop_products.find(match).sort("sort_order", 1):
        p["id"] = str(p.pop("_id"))
        products.append(p)

    return {"products": products, "total": len(products)}


@router.post("/business/{business_id}/products")
async def create_product(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Create a new product."""
    db = get_database()

    product = {
        "business_id": tenant.business_id,
        "product_id": _gen_id("prod"),
        "name": payload.get("name", "").strip(),
        "description": payload.get("description", ""),
        "category": payload.get("category", "general"),
        "subcategory": payload.get("subcategory", ""),
        "price": float(payload.get("price", 0)),
        "compare_at_price": float(payload.get("compare_at_price", 0)) if payload.get("compare_at_price") else None,
        "cost_price": float(payload.get("cost_price", 0)) if payload.get("cost_price") else None,
        "sku": payload.get("sku", ""),
        "barcode": payload.get("barcode", ""),
        "stock": int(payload.get("stock", 0)),
        "track_stock": payload.get("track_stock", True),
        "low_stock_threshold": int(payload.get("low_stock_threshold", 5)),
        "images": payload.get("images", []),
        "variants": payload.get("variants", []),  # [{name, options: [{value, price_adj, stock}]}]
        "tags": payload.get("tags", []),
        "status": payload.get("status", "active"),  # active, draft, archived
        "type": payload.get("type", "physical"),  # physical, digital, voucher, course, package
        "weight_g": payload.get("weight_g"),
        "shipping_required": payload.get("shipping_required", True),
        "visible_online": payload.get("visible_online", True),
        "sort_order": payload.get("sort_order", 0),
        "seo_title": payload.get("seo_title", ""),
        "seo_description": payload.get("seo_description", ""),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "deleted": False,
    }

    if not product["name"] or len(product["name"]) < 2:
        raise HTTPException(400, "Product name required (min 2 chars)")

    result = await db.shop_products.insert_one(product)
    product["id"] = str(result.inserted_id)
    return {"product": product}


@router.put("/business/{business_id}/products/{product_id}")
async def update_product(
    business_id: str,
    product_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Update a product."""
    db = get_database()

    update = {"updated_at": datetime.utcnow()}
    allowed_fields = [
        "name", "description", "category", "subcategory", "price",
        "compare_at_price", "cost_price", "sku", "barcode", "stock",
        "track_stock", "low_stock_threshold", "images", "variants",
        "tags", "status", "type", "weight_g", "shipping_required",
        "visible_online", "sort_order", "seo_title", "seo_description",
        "deleted",
    ]
    for f in allowed_fields:
        if f in payload:
            update[f] = payload[f]

    matched = False
    # Try ObjectId first
    try:
        result = await db.shop_products.update_one(
            {"_id": ObjectId(product_id), "business_id": tenant.business_id},
            {"$set": update}
        )
        if result.matched_count > 0:
            matched = True
    except Exception:
        pass

    if not matched:
        # Try by product_id string
        result = await db.shop_products.update_one(
            {"product_id": product_id, "business_id": tenant.business_id},
            {"$set": update}
        )
        if result.matched_count > 0:
            matched = True

    if not matched:
        # Try _id as plain string
        result = await db.shop_products.update_one(
            {"_id": product_id, "business_id": tenant.business_id},
            {"$set": update}
        )

    return {"status": "updated"}


@router.delete("/business/{business_id}/products/{product_id}")
async def delete_product(
    business_id: str,
    product_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Soft delete a product."""
    db = get_database()
    matched = False

    # Try ObjectId
    try:
        result = await db.shop_products.update_one(
            {"_id": ObjectId(product_id), "business_id": tenant.business_id},
            {"$set": {"deleted": True, "status": "archived", "updated_at": datetime.utcnow()}}
        )
        if result.matched_count > 0:
            matched = True
    except Exception:
        pass

    if not matched:
        # Try product_id string field
        result = await db.shop_products.update_one(
            {"product_id": product_id, "business_id": tenant.business_id},
            {"$set": {"deleted": True, "status": "archived", "updated_at": datetime.utcnow()}}
        )
        if result.matched_count > 0:
            matched = True

    if not matched:
        # Try _id as plain string
        await db.shop_products.update_one(
            {"_id": product_id, "business_id": tenant.business_id},
            {"$set": {"deleted": True, "status": "archived", "updated_at": datetime.utcnow()}}
        )

    return {"status": "deleted"}


# ═══════════════════════════════════════════════════════════════
# PUBLIC STOREFRONT — customer-facing (no auth required)
# ═══════════════════════════════════════════════════════════════

@router.get("/public/{slug}/products")
async def public_products(
    slug: str,
    category: Optional[str] = None,
):
    """Public product listing — what customers see. Scoped to ONE business by slug."""
    db = get_database()
    business = await db.businesses.find_one({"slug": slug})
    if not business:
        raise HTTPException(404, "Shop not found")

    biz_id = str(business["_id"])
    match = {"business_id": biz_id, "status": "active", "visible_online": True, "deleted": {"$ne": True}}
    if category:
        match["category"] = category

    products = []
    async for p in db.shop_products.find(match).sort("sort_order", 1):
        products.append({
            "id": str(p["_id"]),
            "name": p.get("name", ""),
            "description": p.get("description", ""),
            "category": p.get("category", ""),
            "price": p.get("price", 0),
            "compare_at_price": p.get("compare_at_price"),
            "images": p.get("images", []),
            "variants": p.get("variants", []),
            "tags": p.get("tags", []),
            "type": p.get("type", "physical"),
            "stock": p.get("stock", 0) if p.get("track_stock") else None,
            "in_stock": p.get("stock", 0) > 0 if p.get("track_stock") else True,
        })

    # Get categories
    cats = await db.shop_products.distinct("category", {"business_id": biz_id, "status": "active", "deleted": {"$ne": True}})

    return {
        "business": {"name": business.get("name", ""), "slug": slug},
        "products": products,
        "categories": cats,
        "total": len(products),
    }


@router.get("/public/{slug}/product/{product_id}")
async def public_product_detail(slug: str, product_id: str):
    """Public product detail — single product view."""
    db = get_database()
    business = await db.businesses.find_one({"slug": slug})
    if not business:
        raise HTTPException(404, "Shop not found")

    p = await db.shop_products.find_one({
        "_id": ObjectId(product_id),
        "business_id": str(business["_id"]),
        "status": "active", "deleted": {"$ne": True}
    })
    if not p:
        raise HTTPException(404, "Product not found")

    p["id"] = str(p.pop("_id"))
    return {"product": p}


# ═══════════════════════════════════════════════════════════════
# CART — session-based, tenant-isolated
# ═══════════════════════════════════════════════════════════════

@router.get("/public/{slug}/cart/{cart_id}")
async def get_cart(slug: str, cart_id: str):
    """Get cart contents."""
    db = get_database()
    business = await db.businesses.find_one({"slug": slug})
    if not business:
        raise HTTPException(404, "Shop not found")

    cart = await db.shop_carts.find_one({"cart_id": cart_id, "business_id": str(business["_id"])})
    if not cart:
        return {"cart_id": cart_id, "items": [], "subtotal": 0, "discount": 0, "total": 0}

    # Recalculate totals
    subtotal = sum(item.get("price", 0) * item.get("quantity", 1) for item in cart.get("items", []))
    discount = cart.get("discount_amount", 0)
    total = max(0, subtotal - discount)

    return {
        "cart_id": cart_id,
        "items": cart.get("items", []),
        "subtotal": round(subtotal, 2),
        "discount": round(discount, 2),
        "discount_code": cart.get("discount_code", ""),
        "total": round(total, 2),
        "item_count": sum(i.get("quantity", 1) for i in cart.get("items", [])),
    }


@router.post("/public/{slug}/cart/{cart_id}/add")
async def add_to_cart(slug: str, cart_id: str, payload: dict = Body(...)):
    """Add item to cart."""
    db = get_database()
    business = await db.businesses.find_one({"slug": slug})
    if not business:
        raise HTTPException(404, "Shop not found")
    biz_id = str(business["_id"])

    product_id = payload.get("product_id")
    quantity = int(payload.get("quantity", 1))
    variant = payload.get("variant")

    # Validate product exists and is in stock
    product = await db.shop_products.find_one({
        "_id": ObjectId(product_id), "business_id": biz_id,
        "status": "active", "deleted": {"$ne": True}
    })
    if not product:
        raise HTTPException(404, "Product not found")

    if product.get("track_stock") and product.get("stock", 0) < quantity:
        raise HTTPException(400, "Insufficient stock")

    cart_item = {
        "product_id": product_id,
        "name": product.get("name", ""),
        "price": product.get("price", 0),
        "quantity": quantity,
        "variant": variant,
        "image": (product.get("images") or [None])[0],
        "type": product.get("type", "physical"),
    }

    # Get or create cart
    cart = await db.shop_carts.find_one({"cart_id": cart_id, "business_id": biz_id})
    if cart:
        # Check if product already in cart
        items = cart.get("items", [])
        found = False
        for item in items:
            if item.get("product_id") == product_id and item.get("variant") == variant:
                item["quantity"] += quantity
                found = True
                break
        if not found:
            items.append(cart_item)
        await db.shop_carts.update_one(
            {"_id": cart["_id"]},
            {"$set": {"items": items, "updated_at": datetime.utcnow()}}
        )
    else:
        await db.shop_carts.insert_one({
            "cart_id": cart_id,
            "business_id": biz_id,
            "items": [cart_item],
            "discount_code": "",
            "discount_amount": 0,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })

    return {"status": "added", "product": product.get("name")}


@router.post("/public/{slug}/cart/{cart_id}/update")
async def update_cart_item(slug: str, cart_id: str, payload: dict = Body(...)):
    """Update item quantity in cart."""
    db = get_database()
    business = await db.businesses.find_one({"slug": slug})
    if not business:
        raise HTTPException(404, "Shop not found")
    biz_id = str(business["_id"])

    product_id = payload.get("product_id")
    quantity = int(payload.get("quantity", 0))

    cart = await db.shop_carts.find_one({"cart_id": cart_id, "business_id": biz_id})
    if not cart:
        raise HTTPException(404, "Cart not found")

    items = cart.get("items", [])
    if quantity <= 0:
        items = [i for i in items if i.get("product_id") != product_id]
    else:
        for item in items:
            if item.get("product_id") == product_id:
                item["quantity"] = quantity
                break

    await db.shop_carts.update_one(
        {"_id": cart["_id"]},
        {"$set": {"items": items, "updated_at": datetime.utcnow()}}
    )
    return {"status": "updated"}


@router.post("/public/{slug}/cart/{cart_id}/discount")
async def apply_discount(slug: str, cart_id: str, payload: dict = Body(...)):
    """Apply a discount code to cart."""
    db = get_database()
    business = await db.businesses.find_one({"slug": slug})
    if not business:
        raise HTTPException(404, "Shop not found")
    biz_id = str(business["_id"])
    code = (payload.get("code") or "").strip().upper()

    discount = await db.shop_discounts.find_one({
        "business_id": biz_id, "code": code, "status": "active",
        "$or": [{"expires_at": {"$gt": datetime.utcnow().isoformat()}}, {"expires_at": None}],
    })
    if not discount:
        raise HTTPException(400, "Invalid or expired discount code")

    # Check usage limit
    if discount.get("max_uses") and discount.get("used", 0) >= discount["max_uses"]:
        raise HTTPException(400, "Discount code usage limit reached")

    cart = await db.shop_carts.find_one({"cart_id": cart_id, "business_id": biz_id})
    if not cart:
        raise HTTPException(404, "Cart not found")

    subtotal = sum(i.get("price", 0) * i.get("quantity", 1) for i in cart.get("items", []))

    # Check minimum spend
    if discount.get("min_spend") and subtotal < discount["min_spend"]:
        raise HTTPException(400, f"Minimum spend £{discount['min_spend']} required")

    # Calculate discount
    if discount.get("type") == "percentage":
        amount = round(subtotal * discount.get("value", 0) / 100, 2)
    else:
        amount = discount.get("value", 0)

    await db.shop_carts.update_one(
        {"_id": cart["_id"]},
        {"$set": {"discount_code": code, "discount_amount": amount, "discount_id": str(discount["_id"]), "updated_at": datetime.utcnow()}}
    )
    return {"status": "applied", "code": code, "discount": amount}


# ═══════════════════════════════════════════════════════════════
# CHECKOUT — create order, process payment
# ═══════════════════════════════════════════════════════════════

@router.post("/public/{slug}/checkout")
async def checkout(slug: str, payload: dict = Body(...)):
    """Process checkout — creates order, validates stock, applies discount."""
    db = get_database()
    business = await db.businesses.find_one({"slug": slug})
    if not business:
        raise HTTPException(404, "Shop not found")
    biz_id = str(business["_id"])

    cart_id = payload.get("cart_id")
    customer = payload.get("customer", {})
    shipping = payload.get("shipping", {})
    payment_method = payload.get("payment_method", "stripe")

    if not customer.get("name") or not customer.get("email"):
        raise HTTPException(400, "Customer name and email required")

    cart = await db.shop_carts.find_one({"cart_id": cart_id, "business_id": biz_id})
    if not cart or not cart.get("items"):
        raise HTTPException(400, "Cart is empty")

    items = cart.get("items", [])

    # Validate stock for each item
    for item in items:
        product = await db.shop_products.find_one({"_id": ObjectId(item["product_id"]), "business_id": biz_id})
        if not product:
            raise HTTPException(400, f"Product '{item.get('name')}' no longer available")
        if product.get("track_stock") and product.get("stock", 0) < item.get("quantity", 1):
            raise HTTPException(400, f"'{item.get('name')}' has insufficient stock")

    subtotal = sum(i.get("price", 0) * i.get("quantity", 1) for i in items)
    discount = cart.get("discount_amount", 0)
    shipping_cost = float(payload.get("shipping_cost", 0))
    total = max(0, subtotal - discount + shipping_cost)

    order = {
        "business_id": biz_id,
        "order_number": _gen_order_number(),
        "customer": {
            "name": customer.get("name", "").strip(),
            "email": customer.get("email", "").strip().lower(),
            "phone": customer.get("phone", ""),
        },
        "items": items,
        "subtotal": round(subtotal, 2),
        "discount": round(discount, 2),
        "discount_code": cart.get("discount_code", ""),
        "shipping_cost": round(shipping_cost, 2),
        "total": round(total, 2),
        "currency": "GBP",
        "shipping_address": shipping if any(shipping.values()) else None,
        "fulfilment_method": payload.get("fulfilment_method", "shipping"),  # shipping, collection, digital
        "status": "pending",  # pending, confirmed, processing, shipped, delivered, cancelled, refunded
        "payment_status": "pending",  # pending, paid, failed, refunded
        "payment_method": payment_method,
        "stripe_payment_intent": None,
        "tracking_number": None,
        "notes": payload.get("notes", ""),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.shop_orders.insert_one(order)
    order["id"] = str(result.inserted_id)

    # Decrement stock
    for item in items:
        product = await db.shop_products.find_one({"_id": ObjectId(item["product_id"])})
        if product and product.get("track_stock"):
            await db.shop_products.update_one(
                {"_id": product["_id"]},
                {"$inc": {"stock": -item.get("quantity", 1)}}
            )

    # Increment discount usage
    if cart.get("discount_id"):
        await db.shop_discounts.update_one(
            {"_id": ObjectId(cart["discount_id"])},
            {"$inc": {"used": 1}}
        )

    # Clear cart
    await db.shop_carts.delete_one({"_id": cart["_id"]})

    # Log to timeline if client exists
    try:
        from helpers.timeline import log_event
        await log_event(
            db, biz_id, "",
            event="retail.product_purchased",
            summary=f"Order {order['order_number']} — {len(items)} items — £{total}",
            details={"order_id": order["id"], "order_number": order["order_number"], "total": total, "items": len(items)},
            actor={"type": "client", "name": customer.get("name", "")},
            client_name=customer.get("name", ""),
            revenue_impact=total,
        )
    except Exception:
        pass

    return {"order": {"id": order["id"], "order_number": order["order_number"], "total": order["total"], "status": "pending"}}


# ═══════════════════════════════════════════════════════════════
# ORDERS — management (business owner)
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/orders")
async def list_orders(
    business_id: str,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    tenant: TenantContext = Depends(verify_business_access),
):
    """List all orders for a business."""
    db = get_database()
    match = {"business_id": tenant.business_id}
    if status:
        match["status"] = status

    orders = []
    async for o in db.shop_orders.find(match).sort("created_at", -1).limit(limit):
        o["id"] = str(o.pop("_id"))
        orders.append(o)

    pending = await db.shop_orders.count_documents({"business_id": tenant.business_id, "status": "pending"})
    processing = await db.shop_orders.count_documents({"business_id": tenant.business_id, "status": "processing"})

    return {"orders": orders, "total": len(orders), "pending": pending, "processing": processing}


@router.patch("/business/{business_id}/orders/{order_id}")
async def update_order(
    business_id: str,
    order_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Update order status, tracking, notes."""
    db = get_database()
    update = {"updated_at": datetime.utcnow()}
    for f in ["status", "payment_status", "tracking_number", "notes"]:
        if f in payload:
            update[f] = payload[f]

    await db.shop_orders.update_one(
        {"_id": ObjectId(order_id), "business_id": tenant.business_id},
        {"$set": update}
    )
    return {"status": "updated"}


# ═══════════════════════════════════════════════════════════════
# DISCOUNT CODES — business owner management
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/discounts")
async def list_discounts(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """List all discount codes."""
    db = get_database()
    discounts = []
    async for d in db.shop_discounts.find({"business_id": tenant.business_id}).sort("created_at", -1):
        d["id"] = str(d.pop("_id"))
        discounts.append(d)
    return {"discounts": discounts}


@router.post("/business/{business_id}/discounts")
async def create_discount(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Create a discount code."""
    db = get_database()
    code = (payload.get("code") or _gen_voucher_code()).strip().upper()

    discount = {
        "business_id": tenant.business_id,
        "code": code,
        "type": payload.get("type", "percentage"),  # percentage, fixed
        "value": float(payload.get("value", 0)),
        "min_spend": float(payload.get("min_spend", 0)) if payload.get("min_spend") else None,
        "max_uses": int(payload.get("max_uses", 0)) if payload.get("max_uses") else None,
        "used": 0,
        "applies_to": payload.get("applies_to", "all"),  # all, category, product_ids
        "category": payload.get("category"),
        "product_ids": payload.get("product_ids", []),
        "status": payload.get("status", "active"),
        "expires_at": payload.get("expires_at"),
        "created_at": datetime.utcnow(),
    }
    result = await db.shop_discounts.insert_one(discount)
    discount["id"] = str(result.inserted_id)
    return {"discount": discount}


@router.delete("/business/{business_id}/discounts/{discount_id}")
async def delete_discount(
    business_id: str,
    discount_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    await db.shop_discounts.update_one(
        {"_id": ObjectId(discount_id), "business_id": tenant.business_id},
        {"$set": {"status": "disabled"}}
    )
    return {"status": "disabled"}


# ═══════════════════════════════════════════════════════════════
# GIFT VOUCHERS
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/vouchers")
async def list_vouchers(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """List all gift vouchers."""
    db = get_database()
    vouchers = []
    async for v in db.shop_vouchers.find({"business_id": tenant.business_id}).sort("created_at", -1):
        v["id"] = str(v.pop("_id"))
        vouchers.append(v)
    return {"vouchers": vouchers}


@router.post("/public/{slug}/vouchers/purchase")
async def purchase_voucher(slug: str, payload: dict = Body(...)):
    """Customer purchases a gift voucher."""
    db = get_database()
    business = await db.businesses.find_one({"slug": slug})
    if not business:
        raise HTTPException(404, "Shop not found")
    biz_id = str(business["_id"])

    amount = float(payload.get("amount", 0))
    if amount < 5 or amount > 500:
        raise HTTPException(400, "Voucher amount must be between £5 and £500")

    voucher = {
        "business_id": biz_id,
        "code": _gen_voucher_code(),
        "original_amount": amount,
        "remaining_amount": amount,
        "currency": "GBP",
        "purchased_by": {
            "name": payload.get("purchaser_name", ""),
            "email": payload.get("purchaser_email", ""),
        },
        "recipient": {
            "name": payload.get("recipient_name", ""),
            "email": payload.get("recipient_email", ""),
            "message": payload.get("message", ""),
        },
        "status": "active",  # active, redeemed, expired
        "payment_status": "pending",
        "expires_at": (datetime.utcnow() + timedelta(days=365)).isoformat(),
        "redeemed_at": None,
        "created_at": datetime.utcnow(),
    }
    result = await db.shop_vouchers.insert_one(voucher)
    voucher["id"] = str(result.inserted_id)

    return {"voucher": {"id": voucher["id"], "code": voucher["code"], "amount": amount}}


@router.post("/public/{slug}/vouchers/redeem")
async def redeem_voucher(slug: str, payload: dict = Body(...)):
    """Redeem a gift voucher code (apply to cart or at checkout)."""
    db = get_database()
    business = await db.businesses.find_one({"slug": slug})
    if not business:
        raise HTTPException(404, "Shop not found")
    biz_id = str(business["_id"])
    code = (payload.get("code") or "").strip().upper()

    voucher = await db.shop_vouchers.find_one({
        "business_id": biz_id, "code": code, "status": "active",
        "remaining_amount": {"$gt": 0}
    })
    if not voucher:
        raise HTTPException(400, "Invalid, expired, or already redeemed voucher")

    return {
        "valid": True,
        "code": code,
        "remaining_amount": voucher.get("remaining_amount", 0),
        "expires_at": voucher.get("expires_at"),
    }


# ═══════════════════════════════════════════════════════════════
# SHOP STATS — for dashboard
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/stats")
async def shop_stats(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Shop stats for dashboard."""
    db = get_database()
    biz_id = tenant.business_id
    now = datetime.utcnow()
    thirty_days = now - timedelta(days=30)

    total_products = await db.shop_products.count_documents({"business_id": biz_id, "status": "active", "deleted": {"$ne": True}})
    low_stock = await db.shop_products.count_documents({"business_id": biz_id, "status": "active", "deleted": {"$ne": True}, "track_stock": True, "$expr": {"$lte": ["$stock", "$low_stock_threshold"]}})
    total_orders = await db.shop_orders.count_documents({"business_id": biz_id})
    pending_orders = await db.shop_orders.count_documents({"business_id": biz_id, "status": {"$in": ["pending", "processing"]}})
    active_discounts = await db.shop_discounts.count_documents({"business_id": biz_id, "status": "active"})
    active_vouchers = await db.shop_vouchers.count_documents({"business_id": biz_id, "status": "active"})

    # Revenue from orders
    orders = await db.shop_orders.find({"business_id": biz_id, "payment_status": "paid"}).to_list(5000)
    total_revenue = sum(o.get("total", 0) for o in orders)

    return {
        "total_products": total_products,
        "low_stock": low_stock,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "active_discounts": active_discounts,
        "active_vouchers": active_vouchers,
        "total_revenue": round(total_revenue, 2),
    }
