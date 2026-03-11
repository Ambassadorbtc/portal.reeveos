"""
Treatment Add-ons & Product Upsells
====================================
5A: Tiered add-on pricing per service (unique differentiator)
5B: Linked product recommendations with purchase history dedup
All endpoints tenant-isolated via verify_business_access.
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from database import get_database
from middleware.tenant import verify_business_access, TenantContext
from bson import ObjectId
import logging

logger = logging.getLogger("addons")
router = APIRouter(prefix="/addons", tags=["addons"])


async def _get_biz(db, business_id: str):
    try:
        biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        raise HTTPException(404, "Business not found")
    return biz


def _find_service(menu: list, service_id: str) -> tuple:
    """Find a service in the business menu. Returns (index, service_dict) or raises 404."""
    for i, item in enumerate(menu):
        if item.get("id") == service_id or str(item.get("_id", "")) == service_id:
            return i, item
        for j, sub in enumerate(item.get("services", [])):
            if sub.get("id") == service_id or str(sub.get("_id", "")) == service_id:
                return (i, j), sub
    raise HTTPException(404, "Service not found")


# ═══════════════════════════════════════════════════════════════
# 5A: TREATMENT ENHANCER ADD-ONS WITH TIERED PRICING
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/service/{service_id}/configure")
async def configure_addons(
    business_id: str,
    service_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Set add-ons and tier pricing for a service.
    Tiers reward clients for selecting multiple add-ons (e.g. 1 for £45, 2 for £80, 3 for £100).
    """
    add_ons = payload.get("add_ons", [])
    add_on_tiers = payload.get("add_on_tiers", [])

    # Validate add-ons
    if not isinstance(add_ons, list):
        raise HTTPException(400, "add_ons must be a list")
    for i, addon in enumerate(add_ons):
        if not addon.get("name"):
            raise HTTPException(400, f"Add-on {i} missing name")
        if not isinstance(addon.get("price", 0), (int, float)) or addon.get("price", 0) < 0:
            raise HTTPException(400, f"Add-on '{addon.get('name')}' has invalid price")
        if not isinstance(addon.get("duration_minutes", 0), (int, float)) or addon.get("duration_minutes", 0) < 0:
            raise HTTPException(400, f"Add-on '{addon.get('name')}' has invalid duration")
        # Ensure each add-on has an id
        if not addon.get("id"):
            addon["id"] = f"ao_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{i}"

    # Validate tiers
    if not isinstance(add_on_tiers, list):
        raise HTTPException(400, "add_on_tiers must be a list")
    for tier in add_on_tiers:
        if not isinstance(tier.get("count", 0), int) or tier["count"] < 1:
            raise HTTPException(400, f"Tier count must be a positive integer")
        if not isinstance(tier.get("price", 0), (int, float)) or tier["price"] < 0:
            raise HTTPException(400, f"Tier price must be non-negative")

    # Sort tiers by count
    add_on_tiers.sort(key=lambda t: t["count"])

    db = get_database()
    biz = await _get_biz(db, business_id)
    menu = biz.get("menu", [])
    idx, svc = _find_service(menu, service_id)

    # Build update path based on whether service is nested or flat
    if isinstance(idx, tuple):
        parent_idx, sub_idx = idx
        prefix = f"menu.{parent_idx}.services.{sub_idx}"
    else:
        prefix = f"menu.{idx}"

    await db.businesses.update_one(
        {"_id": biz["_id"]},
        {"$set": {
            f"{prefix}.add_ons": add_ons,
            f"{prefix}.add_on_tiers": add_on_tiers,
        }},
    )

    logger.info(f"Add-ons configured: service={service_id} addons={len(add_ons)} tiers={len(add_on_tiers)} business={business_id}")
    return {
        "ok": True,
        "service_id": service_id,
        "add_ons": add_ons,
        "add_on_tiers": add_on_tiers,
    }


@router.get("/business/{business_id}/service/{service_id}")
async def get_addons(
    business_id: str,
    service_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get add-ons and tier pricing for a service."""
    db = get_database()
    biz = await _get_biz(db, business_id)
    menu = biz.get("menu", [])
    _, svc = _find_service(menu, service_id)

    return {
        "service_id": service_id,
        "service_name": svc.get("name", ""),
        "base_price": svc.get("price", 0),
        "base_duration": svc.get("duration_minutes") or svc.get("duration", 60),
        "add_ons": svc.get("add_ons", []),
        "add_on_tiers": svc.get("add_on_tiers", []),
    }


@router.post("/business/{business_id}/calculate")
async def calculate_addon_price(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Calculate total price with tiered add-on pricing.
    Returns base price, tier discount, total, and savings vs individual pricing.
    """
    service_id = payload.get("service_id")
    selected_addon_ids = payload.get("selected_addon_ids", [])

    if not service_id:
        raise HTTPException(400, "service_id is required")
    if not isinstance(selected_addon_ids, list):
        raise HTTPException(400, "selected_addon_ids must be a list")

    db = get_database()
    biz = await _get_biz(db, business_id)
    menu = biz.get("menu", [])
    _, svc = _find_service(menu, service_id)

    base_price = svc.get("price", 0)
    base_duration = svc.get("duration_minutes") or svc.get("duration", 60)
    all_addons = svc.get("add_ons", [])
    tiers = svc.get("add_on_tiers", [])

    # Match selected add-ons
    selected = [a for a in all_addons if a.get("id") in selected_addon_ids]
    addon_count = len(selected)
    individual_total = sum(a.get("price", 0) for a in selected)
    total_addon_duration = sum(a.get("duration_minutes", 0) for a in selected)

    # Find applicable tier
    tier_price = None
    if tiers and addon_count > 0:
        # Find the tier that matches exactly or the highest tier <= addon_count
        applicable = [t for t in tiers if t["count"] <= addon_count]
        if applicable:
            best_tier = max(applicable, key=lambda t: t["count"])
            if best_tier["count"] == addon_count:
                tier_price = best_tier["price"]
            else:
                # Partial: use tier price for matched count + individual for remainder
                remainder_count = addon_count - best_tier["count"]
                # Sort selected by price descending, assign cheapest ones as remainder
                sorted_selected = sorted(selected, key=lambda a: a.get("price", 0), reverse=True)
                remainder_price = sum(a.get("price", 0) for a in sorted_selected[best_tier["count"]:])
                tier_price = best_tier["price"] + remainder_price

    addon_price = tier_price if tier_price is not None else individual_total
    savings = individual_total - addon_price if tier_price is not None else 0

    return {
        "service_id": service_id,
        "service_name": svc.get("name", ""),
        "base_price": base_price,
        "addon_count": addon_count,
        "selected_addons": [{"id": a["id"], "name": a["name"], "individual_price": a.get("price", 0)} for a in selected],
        "individual_addon_total": individual_total,
        "tier_price": tier_price,
        "addon_price": addon_price,
        "total_price": base_price + addon_price,
        "total_duration": base_duration + total_addon_duration,
        "savings_vs_individual": savings,
    }


# ═══════════════════════════════════════════════════════════════
# 5B: PRODUCT UPSELL — linked products per service
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/service/{service_id}/linked-products")
async def set_linked_products(
    business_id: str,
    service_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Set linked products for a service (shown as upsell recommendations)."""
    linked_products = payload.get("linked_products", [])
    if not isinstance(linked_products, list):
        raise HTTPException(400, "linked_products must be a list")

    for i, lp in enumerate(linked_products):
        if not lp.get("product_id") and not lp.get("name"):
            raise HTTPException(400, f"Linked product {i} requires product_id or name")

    db = get_database()
    biz = await _get_biz(db, business_id)
    menu = biz.get("menu", [])
    idx, svc = _find_service(menu, service_id)

    if isinstance(idx, tuple):
        parent_idx, sub_idx = idx
        prefix = f"menu.{parent_idx}.services.{sub_idx}"
    else:
        prefix = f"menu.{idx}"

    await db.businesses.update_one(
        {"_id": biz["_id"]},
        {"$set": {f"{prefix}.linked_products": linked_products}},
    )

    logger.info(f"Linked products set: service={service_id} products={len(linked_products)} business={business_id}")
    return {"ok": True, "linked_products": linked_products}


@router.get("/business/{business_id}/service/{service_id}/recommendations")
async def get_product_recommendations(
    business_id: str,
    service_id: str,
    client_id: str = Query(None),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Get product recommendations for a service.
    Excludes products the client has purchased recently (last 60 days).
    """
    db = get_database()
    biz = await _get_biz(db, business_id)
    menu = biz.get("menu", [])
    _, svc = _find_service(menu, service_id)

    linked = svc.get("linked_products", [])
    if not linked:
        return {"recommendations": [], "total": 0}

    # If client_id provided, filter out recently purchased products
    recently_purchased = set()
    if client_id:
        cutoff = datetime.utcnow() - timedelta(days=60)
        orders = await db.shop_orders.find({
            "businessId": business_id,
            "client_id": client_id,
            "created_at": {"$gte": cutoff},
            "status": {"$in": ["completed", "delivered", "paid"]},
        }).to_list(100)

        for order in orders:
            for item in order.get("items", []):
                pid = item.get("product_id") or item.get("id") or ""
                if pid:
                    recently_purchased.add(pid)

    recommendations = []
    for lp in linked:
        pid = lp.get("product_id", "")
        if pid in recently_purchased:
            continue

        rec = {
            "product_id": pid,
            "name": lp.get("name", ""),
            "price": lp.get("price", 0),
            "reason": lp.get("reason", "Recommended with this treatment"),
            "recently_purchased": False,
        }

        # Enrich with full product details from shop_products if available
        if pid:
            product = await db.shop_products.find_one({
                "businessId": business_id,
                "$or": [{"_id": ObjectId(pid) if ObjectId.is_valid(pid) else pid}, {"id": pid}],
            })
            if product:
                rec["name"] = rec["name"] or product.get("name", "")
                rec["price"] = rec["price"] or product.get("price", 0)
                rec["image_url"] = product.get("image_url") or product.get("images", [None])[0] if product.get("images") else None
                rec["in_stock"] = product.get("stock", 1) > 0

        recommendations.append(rec)

    return {"recommendations": recommendations, "total": len(recommendations)}
