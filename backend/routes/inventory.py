"""
ReeveOS EPOS — Inventory & Stock Management API
================================================
Track ingredients, stock levels, low-stock alerts, waste logging,
recipe costing, supplier management, and auto-reorder suggestions.
"""
from fastapi import Depends,  APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
import logging
from middleware.tenant import verify_business_access, TenantContext

logger = logging.getLogger("inventory")
router = APIRouter(prefix="/inventory", tags=["Inventory"])


# ─── Models ─── #

class IngredientCreate(BaseModel):
    name: str
    category: Optional[str] = "general"  # produce, meat, dairy, dry_goods, drinks, supplies
    unit: str  # kg, g, l, ml, units, portions
    current_stock: float = 0
    min_stock: float = 0  # low-stock alert threshold
    max_stock: Optional[float] = None  # ideal stock level
    cost_per_unit: float = 0  # purchase price per unit
    supplier_id: Optional[str] = None
    supplier_sku: Optional[str] = None
    storage_location: Optional[str] = None  # walk-in, dry_store, bar, etc.
    allergens: Optional[List[str]] = []  # gluten, dairy, nuts, etc.
    shelf_life_days: Optional[int] = None

class StockAdjustment(BaseModel):
    ingredient_id: str
    quantity: float  # positive = add, negative = remove
    reason: str  # delivery, waste, spillage, stocktake, theft, transfer
    notes: Optional[str] = None
    cost_per_unit: Optional[float] = None  # override for this delivery

class RecipeCreate(BaseModel):
    menu_item_id: str
    name: str
    ingredients: List[Dict]  # [{ingredient_id, quantity, unit}]
    prep_time_minutes: Optional[int] = None
    instructions: Optional[str] = None

class SupplierCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    delivery_days: Optional[List[str]] = []  # ["monday", "thursday"]
    lead_time_days: Optional[int] = 1
    min_order: Optional[float] = 0
    notes: Optional[str] = None

class WasteLog(BaseModel):
    ingredient_id: str
    quantity: float
    reason: str  # expired, spoiled, overproduction, dropped, prep_waste
    cost: Optional[float] = None
    notes: Optional[str] = None

class PurchaseOrder(BaseModel):
    supplier_id: str
    items: List[Dict]  # [{ingredient_id, quantity, unit_cost}]
    notes: Optional[str] = None
    expected_delivery: Optional[str] = None


# ─── Ingredients CRUD ─── #

@router.get("/business/{business_id}/ingredients")
async def list_ingredients(
    business_id: str,
    category: Optional[str] = None,
    low_stock: Optional[bool] = None,
    search: Optional[str] = None,
    tenant: TenantContext = Depends(verify_business_access),
):
    """List all ingredients with optional filters."""
    db = get_database()
    query = {"business_id": business_id}
    if category:
        query["category"] = category
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    ingredients = []
    async for doc in db.ingredients.find(query).sort("name", 1):
        doc["_id"] = str(doc["_id"])
        doc["is_low"] = doc.get("current_stock", 0) <= doc.get("min_stock", 0) and doc.get("min_stock", 0) > 0
        ingredients.append(doc)

    if low_stock:
        ingredients = [i for i in ingredients if i["is_low"]]

    return {"ingredients": ingredients, "count": len(ingredients)}


@router.post("/business/{business_id}/ingredients")
async def create_ingredient(business_id: str, body: IngredientCreate, tenant: TenantContext = Depends(verify_business_access)):
    """Add a new ingredient to inventory."""
    db = get_database()
    doc = body.dict()
    doc["business_id"] = business_id
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()
    doc["last_ordered"] = None
    doc["last_stocktake"] = None

    result = await db.ingredients.insert_one(doc)
    return {"ingredient_id": str(result.inserted_id), "name": body.name}


@router.put("/business/{business_id}/ingredients/{ingredient_id}")
async def update_ingredient(business_id: str, ingredient_id: str, tenant: TenantContext = Depends(verify_business_access), updates: dict = Body(...)):
    """Update ingredient details."""
    db = get_database()
    updates["updated_at"] = datetime.utcnow()
    await db.ingredients.update_one(
        {"_id": ObjectId(ingredient_id), "business_id": business_id},
        {"$set": updates}
    )
    return {"message": "Ingredient updated"}


@router.delete("/business/{business_id}/ingredients/{ingredient_id}")
async def delete_ingredient(business_id: str, ingredient_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    await db.ingredients.delete_one({"_id": ObjectId(ingredient_id), "business_id": business_id})
    return {"message": "Ingredient deleted"}


# ─── Stock Adjustments ─── #

@router.post("/business/{business_id}/adjust")
async def adjust_stock(business_id: str, body: StockAdjustment, tenant: TenantContext = Depends(verify_business_access)):
    """Adjust stock level (delivery, waste, stocktake, etc.)."""
    db = get_database()
    ingredient = await db.ingredients.find_one({"_id": ObjectId(body.ingredient_id), "business_id": business_id})
    if not ingredient:
        raise HTTPException(404, "Ingredient not found")

    new_stock = max(0, ingredient.get("current_stock", 0) + body.quantity)

    # Log the adjustment
    log = {
        "business_id": business_id,
        "ingredient_id": body.ingredient_id,
        "ingredient_name": ingredient["name"],
        "previous_stock": ingredient.get("current_stock", 0),
        "adjustment": body.quantity,
        "new_stock": new_stock,
        "reason": body.reason,
        "notes": body.notes,
        "cost_per_unit": body.cost_per_unit or ingredient.get("cost_per_unit", 0),
        "total_cost": abs(body.quantity) * (body.cost_per_unit or ingredient.get("cost_per_unit", 0)),
        "created_at": datetime.utcnow(),
    }
    await db.stock_adjustments.insert_one(log)

    # Update stock level
    update = {"current_stock": new_stock, "updated_at": datetime.utcnow()}
    if body.cost_per_unit:
        update["cost_per_unit"] = body.cost_per_unit
    if body.reason == "delivery":
        update["last_ordered"] = datetime.utcnow()
    elif body.reason == "stocktake":
        update["last_stocktake"] = datetime.utcnow()

    await db.ingredients.update_one(
        {"_id": ObjectId(body.ingredient_id)},
        {"$set": update}
    )

    return {
        "message": f"Stock adjusted: {ingredient['name']} → {new_stock} {ingredient.get('unit', 'units')}",
        "new_stock": new_stock,
        "is_low": new_stock <= ingredient.get("min_stock", 0) and ingredient.get("min_stock", 0) > 0,
    }


@router.post("/business/{business_id}/stocktake")
async def bulk_stocktake(business_id: str, tenant: TenantContext = Depends(verify_business_access), counts: List[Dict] = Body(...)):
    """Bulk stocktake — update multiple ingredients at once.
    Each item: {ingredient_id: str, actual_count: float}
    """
    db = get_database()
    results = []
    for item in counts:
        ing = await db.ingredients.find_one({"_id": ObjectId(item["ingredient_id"]), "business_id": business_id})
        if not ing:
            continue

        diff = item["actual_count"] - ing.get("current_stock", 0)

        # Log discrepancy
        log = {
            "business_id": business_id,
            "ingredient_id": item["ingredient_id"],
            "ingredient_name": ing["name"],
            "previous_stock": ing.get("current_stock", 0),
            "actual_count": item["actual_count"],
            "discrepancy": round(diff, 3),
            "reason": "stocktake",
            "created_at": datetime.utcnow(),
        }
        await db.stock_adjustments.insert_one(log)

        await db.ingredients.update_one(
            {"_id": ObjectId(item["ingredient_id"])},
            {"$set": {
                "current_stock": item["actual_count"],
                "last_stocktake": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }}
        )

        results.append({
            "name": ing["name"],
            "previous": ing.get("current_stock", 0),
            "actual": item["actual_count"],
            "discrepancy": round(diff, 3),
        })

    return {"stocktake_results": results, "items_counted": len(results)}


# ─── Low Stock Alerts ─── #

@router.get("/business/{business_id}/alerts")
async def get_stock_alerts(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get all low-stock and out-of-stock alerts."""
    db = get_database()
    pipeline = [
        {"$match": {"business_id": business_id, "min_stock": {"$gt": 0}}},
        {"$addFields": {"is_low": {"$lte": ["$current_stock", "$min_stock"]}}},
        {"$match": {"is_low": True}},
        {"$sort": {"current_stock": 1}},
    ]

    alerts = []
    async for doc in db.ingredients.aggregate(pipeline):
        doc["_id"] = str(doc["_id"])
        doc["severity"] = "critical" if doc["current_stock"] <= 0 else "warning"
        alerts.append(doc)

    return {"alerts": alerts, "count": len(alerts)}


# ─── Recipes / Menu Costing ─── #

@router.post("/business/{business_id}/recipes")
async def create_recipe(business_id: str, body: RecipeCreate, tenant: TenantContext = Depends(verify_business_access)):
    """Link a menu item to its ingredient recipe for cost tracking."""
    db = get_database()
    doc = body.dict()
    doc["business_id"] = business_id
    doc["created_at"] = datetime.utcnow()

    # Calculate food cost
    food_cost = 0
    for ing in body.ingredients:
        ingredient = await db.ingredients.find_one({"_id": ObjectId(ing["ingredient_id"]), "business_id": business_id})
        if ingredient:
            food_cost += ingredient.get("cost_per_unit", 0) * ing["quantity"]
    doc["food_cost"] = round(food_cost, 2)

    result = await db.recipes.insert_one(doc)
    return {"recipe_id": str(result.inserted_id), "food_cost": doc["food_cost"]}


@router.get("/business/{business_id}/recipes")
async def list_recipes(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get all recipes with food costs."""
    db = get_database()
    recipes = []
    async for doc in db.recipes.find({"business_id": business_id}):
        doc["_id"] = str(doc["_id"])
        recipes.append(doc)
    return {"recipes": recipes}


@router.get("/business/{business_id}/food-cost-report")
async def food_cost_report(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Calculate food cost % for all menu items with recipes."""
    db = get_database()
    recipes = []
    async for recipe in db.recipes.find({"business_id": business_id}):
        # Recalculate with current prices
        food_cost = 0
        for ing in recipe.get("ingredients", []):
            ingredient = await db.ingredients.find_one({"_id": ObjectId(ing["ingredient_id"])})
            if ingredient:
                food_cost += ingredient.get("cost_per_unit", 0) * ing["quantity"]

        # Get menu item selling price
        biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
        selling_price = 0
        if biz:
            for item in biz.get("menu", []):
                if str(item.get("id")) == recipe.get("menu_item_id"):
                    selling_price = item.get("price", 0)
                    break

        cost_percent = round((food_cost / selling_price * 100), 1) if selling_price > 0 else 0

        recipes.append({
            "recipe_id": str(recipe["_id"]),
            "name": recipe["name"],
            "food_cost": round(food_cost, 2),
            "selling_price": selling_price,
            "food_cost_percent": cost_percent,
            "margin": round(selling_price - food_cost, 2),
            "status": "good" if cost_percent <= 30 else "warning" if cost_percent <= 40 else "critical",
        })

    recipes.sort(key=lambda r: r["food_cost_percent"], reverse=True)
    avg_cost = round(sum(r["food_cost_percent"] for r in recipes) / max(len(recipes), 1), 1)

    return {"items": recipes, "average_food_cost_percent": avg_cost}


# ─── Waste Tracking ─── #

@router.post("/business/{business_id}/waste")
async def log_waste(business_id: str, body: WasteLog, tenant: TenantContext = Depends(verify_business_access)):
    """Log food waste — tracks cost and reason."""
    db = get_database()
    try:
        ingredient = await db.ingredients.find_one({"_id": ObjectId(body.ingredient_id), "business_id": business_id})
    except Exception:
        raise HTTPException(400, "Invalid ingredient ID format")
    if not ingredient:
        raise HTTPException(404, "Ingredient not found")

    cost = body.cost or (body.quantity * ingredient.get("cost_per_unit", 0))

    log = {
        "business_id": business_id,
        "ingredient_id": body.ingredient_id,
        "ingredient_name": ingredient["name"],
        "quantity": body.quantity,
        "unit": ingredient.get("unit", "units"),
        "reason": body.reason,
        "cost": round(cost, 2),
        "notes": body.notes,
        "created_at": datetime.utcnow(),
    }
    await db.waste_log.insert_one(log)

    # Deduct from stock
    new_stock = max(0, ingredient.get("current_stock", 0) - body.quantity)
    await db.ingredients.update_one(
        {"_id": ObjectId(body.ingredient_id)},
        {"$set": {"current_stock": new_stock, "updated_at": datetime.utcnow()}}
    )

    return {"message": f"Waste logged: {body.quantity} {ingredient.get('unit')} of {ingredient['name']} (£{cost:.2f})"}


@router.get("/business/{business_id}/waste")
async def get_waste_report(business_id: str, tenant: TenantContext = Depends(verify_business_access), days_back: int = 30):
    """Get waste report with cost breakdown."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days_back)

    # By reason
    reason_pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$reason",
            "total_cost": {"$sum": "$cost"},
            "occurrences": {"$sum": 1},
        }},
        {"$sort": {"total_cost": -1}},
    ]
    by_reason = []
    async for doc in db.waste_log.aggregate(reason_pipeline):
        by_reason.append({"reason": doc["_id"], "cost": round(doc["total_cost"], 2), "count": doc["occurrences"]})

    # By ingredient
    ingredient_pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$ingredient_name",
            "total_cost": {"$sum": "$cost"},
            "total_quantity": {"$sum": "$quantity"},
        }},
        {"$sort": {"total_cost": -1}},
        {"$limit": 20},
    ]
    by_ingredient = []
    async for doc in db.waste_log.aggregate(ingredient_pipeline):
        by_ingredient.append({
            "ingredient": doc["_id"],
            "cost": round(doc["total_cost"], 2),
            "quantity": round(doc["total_quantity"], 2),
        })

    total_cost = sum(r["cost"] for r in by_reason)

    return {
        "total_waste_cost": round(total_cost, 2),
        "by_reason": by_reason,
        "by_ingredient": by_ingredient,
        "period_days": days_back,
    }


# ─── Suppliers ─── #

@router.get("/business/{business_id}/suppliers")
async def list_suppliers(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    suppliers = []
    async for doc in db.suppliers.find({"business_id": business_id}):
        doc["_id"] = str(doc["_id"])
        suppliers.append(doc)
    return {"suppliers": suppliers}


@router.post("/business/{business_id}/suppliers")
async def create_supplier(business_id: str, body: SupplierCreate, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    doc = body.dict()
    doc["business_id"] = business_id
    doc["created_at"] = datetime.utcnow()
    result = await db.suppliers.insert_one(doc)
    return {"supplier_id": str(result.inserted_id)}


# ─── Purchase Orders ─── #

@router.post("/business/{business_id}/purchase-orders")
async def create_purchase_order(business_id: str, body: PurchaseOrder, tenant: TenantContext = Depends(verify_business_access)):
    """Create a purchase order for a supplier."""
    db = get_database()

    total = sum(item.get("quantity", 0) * item.get("unit_cost", 0) for item in body.items)

    po = {
        "business_id": business_id,
        "supplier_id": body.supplier_id,
        "items": body.items,
        "total": round(total, 2),
        "status": "draft",  # draft, sent, received, cancelled
        "notes": body.notes,
        "expected_delivery": body.expected_delivery,
        "created_at": datetime.utcnow(),
    }

    result = await db.purchase_orders.insert_one(po)
    return {"po_id": str(result.inserted_id), "total": po["total"]}


@router.get("/business/{business_id}/purchase-orders")
async def list_purchase_orders(business_id: str, tenant: TenantContext = Depends(verify_business_access), status: Optional[str] = None):
    db = get_database()
    query = {"business_id": business_id}
    if status:
        query["status"] = status
    orders = []
    async for doc in db.purchase_orders.find(query).sort("created_at", -1).limit(50):
        doc["_id"] = str(doc["_id"])
        orders.append(doc)
    return {"orders": orders}


@router.put("/business/{business_id}/purchase-orders/{po_id}/receive")
async def receive_purchase_order(business_id: str, po_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Mark PO as received and auto-adjust stock levels."""
    db = get_database()
    po = await db.purchase_orders.find_one({"_id": ObjectId(po_id), "business_id": business_id})
    if not po:
        raise HTTPException(404, "PO not found")

    # Auto-adjust stock for each item
    for item in po.get("items", []):
        await db.ingredients.update_one(
            {"_id": ObjectId(item["ingredient_id"]), "business_id": business_id},
            {
                "$inc": {"current_stock": item["quantity"]},
                "$set": {
                    "last_ordered": datetime.utcnow(),
                    "cost_per_unit": item.get("unit_cost", 0),
                    "updated_at": datetime.utcnow(),
                }
            }
        )

    await db.purchase_orders.update_one(
        {"_id": ObjectId(po_id)},
        {"$set": {"status": "received", "received_at": datetime.utcnow()}}
    )

    return {"message": f"PO received — {len(po['items'])} items stocked"}


# ─── Auto-Reorder Suggestions ─── #

@router.get("/business/{business_id}/reorder-suggestions")
async def get_reorder_suggestions(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """AI-powered reorder suggestions based on stock levels and usage patterns."""
    db = get_database()

    suggestions = []
    async for ing in db.ingredients.find({
        "business_id": business_id,
        "min_stock": {"$gt": 0},
    }):
        current = ing.get("current_stock", 0)
        min_stock = ing.get("min_stock", 0)
        max_stock = ing.get("max_stock", min_stock * 3)

        if current <= min_stock:
            order_qty = max_stock - current
            est_cost = order_qty * ing.get("cost_per_unit", 0)

            # Calculate avg daily usage from recent adjustments
            cutoff = datetime.utcnow() - timedelta(days=14)
            usage_pipeline = [
                {"$match": {
                    "ingredient_id": str(ing["_id"]),
                    "reason": {"$in": ["waste", "order_deduction"]},
                    "created_at": {"$gte": cutoff},
                }},
                {"$group": {"_id": None, "total_used": {"$sum": {"$abs": "$adjustment"}}}},
            ]
            usage = await db.stock_adjustments.aggregate(usage_pipeline).to_list(1)
            daily_usage = round((usage[0]["total_used"] / 14), 2) if usage else 0
            days_remaining = round(current / daily_usage, 1) if daily_usage > 0 else 999

            suggestions.append({
                "ingredient_id": str(ing["_id"]),
                "name": ing["name"],
                "current_stock": current,
                "min_stock": min_stock,
                "suggested_order": round(order_qty, 1),
                "unit": ing.get("unit"),
                "estimated_cost": round(est_cost, 2),
                "daily_usage": daily_usage,
                "days_remaining": days_remaining,
                "supplier_id": ing.get("supplier_id"),
                "urgency": "critical" if current <= 0 else "high" if days_remaining <= 2 else "medium",
            })

    suggestions.sort(key=lambda s: s["days_remaining"])

    return {"suggestions": suggestions, "total_estimated_cost": round(sum(s["estimated_cost"] for s in suggestions), 2)}
