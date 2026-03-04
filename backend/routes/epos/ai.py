"""
ReeveOS EPOS — AI Features + Loyalty + Kiosk API
=================================================
Features NO competitor offers:
- AI menu optimizer (margin + popularity analysis)
- Predictive prep alerts (rush forecasting)
- Smart upsell suggestions per order
- AI waste predictor
- Real-time food cost per order

Plus standard: Loyalty programme, Kiosk self-ordering
"""
from fastapi import Depends,  APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
import logging
from middleware.tenant import verify_business_access, TenantContext
from middleware.auth import get_current_user

logger = logging.getLogger("epos_ai")
router = APIRouter(prefix="/epos", tags=["EPOS AI + Loyalty + Kiosk"])


# ═══════════════════════════════════════════════════════════════
# AI MENU OPTIMIZER — What to promote, what to drop
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/ai/menu-optimizer")
async def ai_menu_optimizer(business_id: str, tenant: TenantContext = Depends(verify_business_access), days_back: int = 30):
    """Analyse every menu item by profitability × popularity.
    Quadrant: Star (high margin + popular), Puzzle (high margin + low sales),
    Plowhouse (low margin + popular), Dog (low margin + low sales).
    NO competitor does this automatically.
    """
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days_back)

    # Get sales data per item
    sales_pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": cutoff}, "status": {"$in": ["paid", "closed"]}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.name",
            "total_sold": {"$sum": "$items.quantity"},
            "total_revenue": {"$sum": "$items.line_total"},
            "avg_price": {"$avg": "$items.unit_price"},
        }},
    ]

    item_sales = {}
    async for doc in db.orders.aggregate(sales_pipeline):
        item_sales[doc["_id"]] = doc

    # Get food costs from recipes
    recipes = {}
    async for recipe in db.recipes.find({"business_id": business_id}):
        recipes[recipe.get("name")] = recipe.get("food_cost", 0)

    # Classify items
    items = []
    total_sold = sum(s.get("total_sold", 0) for s in item_sales.values())
    avg_sold = total_sold / max(len(item_sales), 1)

    for name, sales in item_sales.items():
        food_cost = recipes.get(name, 0)
        selling_price = sales.get("avg_price", 0)
        margin = selling_price - food_cost
        margin_percent = (margin / selling_price * 100) if selling_price > 0 else 0
        popularity = sales["total_sold"]

        # Quadrant classification
        high_margin = margin_percent >= 65  # industry standard: 65%+ is good
        high_popularity = popularity >= avg_sold

        if high_margin and high_popularity:
            quadrant = "star"
        elif high_margin and not high_popularity:
            quadrant = "puzzle"
        elif not high_margin and high_popularity:
            quadrant = "plowhouse"
        else:
            quadrant = "dog"

        # AI recommendation
        if quadrant == "star":
            recommendation = "Keep prominent. Feature on specials board."
        elif quadrant == "puzzle":
            recommendation = "Good margin but low sales. Try repositioning on menu or bundling as a special."
        elif quadrant == "plowhouse":
            recommendation = "Popular but low margin. Consider raising price by 5-10% or reducing portion/ingredient cost."
        else:
            recommendation = "Low margin and unpopular. Consider removing or completely reworking this dish."

        items.append({
            "name": name,
            "sold": popularity,
            "revenue": round(sales["total_revenue"], 2),
            "avg_price": round(selling_price, 2),
            "food_cost": round(food_cost, 2),
            "margin": round(margin, 2),
            "margin_percent": round(margin_percent, 1),
            "quadrant": quadrant,
            "recommendation": recommendation,
        })

    items.sort(key=lambda x: x["revenue"], reverse=True)

    return {
        "items": items,
        "summary": {
            "stars": len([i for i in items if i["quadrant"] == "star"]),
            "puzzles": len([i for i in items if i["quadrant"] == "puzzle"]),
            "plowhorses": len([i for i in items if i["quadrant"] == "plowhouse"]),
            "dogs": len([i for i in items if i["quadrant"] == "dog"]),
        },
        "period_days": days_back,
    }


# ═══════════════════════════════════════════════════════════════
# PREDICTIVE PREP ALERTS — "It's Friday 5pm, prep 40 burgers"
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/ai/prep-forecast")
async def predictive_prep(business_id: str, tenant: TenantContext = Depends(verify_business_access), hours_ahead: int = 3):
    """Predict what items will be ordered in the next N hours.
    Based on same day/time patterns from last 8 weeks.
    NO EPOS competitor does this.
    """
    db = get_database()
    now = datetime.utcnow()
    current_hour = now.hour
    current_day = now.strftime("%A").lower()

    # Look at same day + time window from past 8 weeks
    predictions = {}
    for weeks_back in range(1, 9):
        target_date = now - timedelta(weeks=weeks_back)
        window_start = target_date.replace(hour=current_hour, minute=0, second=0)
        window_end = window_start + timedelta(hours=hours_ahead)

        pipeline = [
            {"$match": {
                "business_id": business_id,
                "created_at": {"$gte": window_start, "$lte": window_end},
                "status": {"$in": ["paid", "closed"]},
            }},
            {"$unwind": "$items"},
            {"$group": {
                "_id": "$items.name",
                "quantity": {"$sum": "$items.quantity"},
            }},
        ]

        async for doc in db.orders.aggregate(pipeline):
            name = doc["_id"]
            predictions.setdefault(name, [])
            predictions[name].append(doc["quantity"])

    # Calculate weighted average (more recent weeks = more weight)
    forecast = []
    for name, quantities in predictions.items():
        if not quantities:
            continue
        # Simple weighted average (most recent gets most weight)
        weights = list(range(1, len(quantities) + 1))
        weighted_sum = sum(q * w for q, w in zip(quantities, weights))
        total_weight = sum(weights)
        predicted = round(weighted_sum / total_weight)

        forecast.append({
            "item": name,
            "predicted_quantity": predicted,
            "confidence": min(len(quantities) / 8 * 100, 100),  # % of weeks with data
            "historical_range": [min(quantities), max(quantities)],
        })

    forecast.sort(key=lambda x: x["predicted_quantity"], reverse=True)

    return {
        "forecast": forecast[:30],
        "window": f"Next {hours_ahead} hours ({current_day})",
        "based_on_weeks": 8,
    }


# ═══════════════════════════════════════════════════════════════
# SMART UPSELL ENGINE — Suggest add-ons per order
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/ai/upsell/{order_id}")
async def smart_upsell(business_id: str, order_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Suggest upsell items based on what's currently in the order.
    Uses association rules from past orders.
    NO competitor has real-time AI upsell during order entry.
    """
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    current_items = [item["name"] for item in order.get("items", [])]
    if not current_items:
        return {"suggestions": []}

    # Find orders that contained the same items and see what else was ordered
    pipeline = [
        {"$match": {
            "business_id": business_id,
            "status": {"$in": ["paid", "closed"]},
            "items.name": {"$in": current_items},
        }},
        {"$unwind": "$items"},
        {"$match": {"items.name": {"$nin": current_items}}},  # exclude what's already ordered
        {"$group": {
            "_id": "$items.name",
            "frequency": {"$sum": 1},
            "avg_price": {"$avg": "$items.unit_price"},
        }},
        {"$sort": {"frequency": -1}},
        {"$limit": 5},
    ]

    suggestions = []
    async for doc in db.orders.aggregate(pipeline):
        suggestions.append({
            "item": doc["_id"],
            "frequency": doc["frequency"],
            "price": round(doc["avg_price"], 2),
            "pitch": f"Customers who ordered {current_items[0]} also loved {doc['_id']}",
        })

    return {"suggestions": suggestions}


# ═══════════════════════════════════════════════════════════════
# AI WASTE PREDICTOR — Forecast waste before it happens
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/ai/waste-prediction")
async def predict_waste(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Predict which ingredients are at risk of waste based on
    shelf life, current stock, and usage rate.
    """
    db = get_database()

    at_risk = []
    async for ing in db.ingredients.find({
        "business_id": business_id,
        "shelf_life_days": {"$exists": True, "$gt": 0},
        "current_stock": {"$gt": 0},
    }):
        # Estimate daily usage from last 14 days
        cutoff = datetime.utcnow() - timedelta(days=14)
        usage_pipeline = [
            {"$match": {
                "ingredient_id": str(ing["_id"]),
                "adjustment": {"$lt": 0},
                "created_at": {"$gte": cutoff},
            }},
            {"$group": {"_id": None, "total_used": {"$sum": {"$abs": "$adjustment"}}}},
        ]
        usage = await db.stock_adjustments.aggregate(usage_pipeline).to_list(1)
        daily_usage = (usage[0]["total_used"] / 14) if usage else 0

        shelf_life = ing.get("shelf_life_days", 999)
        current_stock = ing.get("current_stock", 0)

        # Days to use up current stock at current rate
        days_to_deplete = (current_stock / daily_usage) if daily_usage > 0 else 999

        # If stock will outlast shelf life, waste is likely
        if days_to_deplete > shelf_life:
            waste_qty = current_stock - (daily_usage * shelf_life)
            waste_cost = waste_qty * ing.get("cost_per_unit", 0)

            at_risk.append({
                "ingredient_id": str(ing["_id"]),
                "name": ing["name"],
                "current_stock": round(current_stock, 1),
                "unit": ing.get("unit"),
                "shelf_life_days": shelf_life,
                "daily_usage": round(daily_usage, 2),
                "days_to_deplete": round(days_to_deplete, 1),
                "predicted_waste": round(waste_qty, 1),
                "predicted_waste_cost": round(waste_cost, 2),
                "suggestion": f"Use {round(waste_qty, 1)} {ing.get('unit', 'units')} in specials or staff meals before expiry.",
            })

    at_risk.sort(key=lambda x: x["predicted_waste_cost"], reverse=True)
    total_risk = sum(r["predicted_waste_cost"] for r in at_risk)

    return {
        "at_risk_items": at_risk,
        "total_predicted_waste_cost": round(total_risk, 2),
    }


# ═══════════════════════════════════════════════════════════════
# REAL-TIME FOOD COST PER ORDER
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/ai/order-cost/{order_id}")
async def real_time_order_cost(business_id: str, order_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Calculate real food cost for a specific order using recipes.
    Shows actual GP% per order in real time.
    """
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    item_costs = []
    total_food_cost = 0
    total_revenue = 0

    for item in order.get("items", []):
        recipe = await db.recipes.find_one({"business_id": business_id, "name": item["name"]})
        food_cost = 0

        if recipe:
            for ing in recipe.get("ingredients", []):
                ingredient = await db.ingredients.find_one({"_id": ObjectId(ing["ingredient_id"])})
                if ingredient:
                    food_cost += ingredient.get("cost_per_unit", 0) * ing["quantity"]

        food_cost *= item["quantity"]
        line_total = item.get("line_total", item["unit_price"] * item["quantity"])
        margin = line_total - food_cost
        gp_percent = (margin / line_total * 100) if line_total > 0 else 0

        total_food_cost += food_cost
        total_revenue += line_total

        item_costs.append({
            "name": item["name"],
            "qty": item["quantity"],
            "revenue": round(line_total, 2),
            "food_cost": round(food_cost, 2),
            "margin": round(margin, 2),
            "gp_percent": round(gp_percent, 1),
        })

    total_margin = total_revenue - total_food_cost
    total_gp = (total_margin / total_revenue * 100) if total_revenue > 0 else 0

    return {
        "items": item_costs,
        "total_revenue": round(total_revenue, 2),
        "total_food_cost": round(total_food_cost, 2),
        "total_margin": round(total_margin, 2),
        "gp_percent": round(total_gp, 1),
    }


# ═══════════════════════════════════════════════════════════════
# PEAK TIME HEATMAP — When are you busiest?
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/ai/peak-heatmap")
async def peak_time_heatmap(business_id: str, tenant: TenantContext = Depends(verify_business_access), weeks_back: int = 8):
    """Generate day × hour heatmap of order volume."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(weeks=weeks_back)

    pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": {
                "day": {"$dayOfWeek": "$created_at"},  # 1=Sun, 7=Sat
                "hour": {"$hour": "$created_at"},
            },
            "count": {"$sum": 1},
            "revenue": {"$sum": "$total"},
        }},
    ]

    day_names = {1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday", 5: "Thursday", 6: "Friday", 7: "Saturday"}
    heatmap = {}

    async for doc in db.orders.aggregate(pipeline):
        day = day_names.get(doc["_id"]["day"], "Unknown")
        hour = doc["_id"]["hour"]
        heatmap.setdefault(day, {})
        heatmap[day][hour] = {
            "orders": doc["count"],
            "avg_orders_per_week": round(doc["count"] / weeks_back, 1),
            "revenue": round(doc["revenue"], 2),
        }

    return {"heatmap": heatmap, "weeks_analysed": weeks_back}


# ═══════════════════════════════════════════════════════════════
# LOYALTY PROGRAMME
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/loyalty/config")
async def get_loyalty_config(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get loyalty programme settings."""
    db = get_database()
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    config = biz.get("loyalty_config", {
        "enabled": False,
        "points_per_pound": 1,  # earn 1 point per £1
        "redemption_rate": 100,  # 100 points = £1 off
        "welcome_bonus": 50,
        "birthday_bonus": 200,
        "referral_bonus": 100,
        "tiers": [
            {"name": "Bronze", "min_points": 0, "multiplier": 1.0},
            {"name": "Silver", "min_points": 500, "multiplier": 1.25},
            {"name": "Gold", "min_points": 2000, "multiplier": 1.5},
            {"name": "Platinum", "min_points": 5000, "multiplier": 2.0},
        ],
    }) if biz else {}

    return config


@router.put("/business/{business_id}/loyalty/config")
async def update_loyalty_config(business_id: str, tenant: TenantContext = Depends(verify_business_access), config: dict = Body(...)):
    """Update loyalty settings."""
    db = get_database()
    await db.businesses.update_one(
        {"_id": ObjectId(business_id)},
        {"$set": {"loyalty_config": config, "updated_at": datetime.utcnow()}}
    )
    return {"message": "Loyalty config updated"}


@router.get("/loyalty/customer/{customer_id}")
async def get_customer_loyalty(customer_id: str, user: dict = Depends(get_current_user)):
    """Get customer loyalty balance and history."""
    db = get_database()
    customer = await db.clients.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(404, "Customer not found")

    points = customer.get("loyalty_points", 0)
    lifetime = customer.get("loyalty_lifetime_points", 0)

    # Determine tier
    tier = "Bronze"
    for t in [{"name": "Platinum", "min": 5000}, {"name": "Gold", "min": 2000}, {"name": "Silver", "min": 500}]:
        if lifetime >= t["min"]:
            tier = t["name"]
            break

    # Recent transactions
    history = []
    async for doc in db.loyalty_transactions.find({"customer_id": customer_id}).sort("created_at", -1).limit(20):
        doc["_id"] = str(doc["_id"])
        history.append(doc)

    return {
        "customer_id": customer_id,
        "points": points,
        "lifetime_points": lifetime,
        "tier": tier,
        "history": history,
    }


@router.post("/loyalty/earn")
async def earn_points(
    customer_id: str = Body(...),
    business_id: str = Body(...),
    order_id: str = Body(...),
    amount: float = Body(...),
    user: dict = Depends(get_current_user),
):
    """Award loyalty points for a purchase."""
    db = get_database()
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    config = biz.get("loyalty_config", {}) if biz else {}
    if not config.get("enabled"):
        return {"message": "Loyalty not enabled"}

    ppp = config.get("points_per_pound", 1)

    # Check tier multiplier
    customer = await db.clients.find_one({"_id": ObjectId(customer_id)})
    multiplier = 1.0
    if customer:
        lifetime = customer.get("loyalty_lifetime_points", 0)
        for t in config.get("tiers", []):
            if lifetime >= t.get("min_points", 0):
                multiplier = t.get("multiplier", 1.0)

    points = round(amount * ppp * multiplier)

    await db.clients.update_one(
        {"_id": ObjectId(customer_id)},
        {"$inc": {"loyalty_points": points, "loyalty_lifetime_points": points}}
    )

    await db.loyalty_transactions.insert_one({
        "customer_id": customer_id,
        "business_id": business_id,
        "order_id": order_id,
        "type": "earn",
        "points": points,
        "amount_spent": amount,
        "multiplier": multiplier,
        "created_at": datetime.utcnow(),
    })

    return {"points_earned": points, "multiplier": multiplier}


@router.post("/loyalty/redeem")
async def redeem_points(
    customer_id: str = Body(...),
    business_id: str = Body(...),
    points: int = Body(...),
    user: dict = Depends(get_current_user),
):
    """Redeem points for a discount."""
    db = get_database()
    customer = await db.clients.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(404, "Customer not found")

    current = customer.get("loyalty_points", 0)
    if current < points:
        raise HTTPException(400, f"Insufficient points. Balance: {current}")

    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    config = biz.get("loyalty_config", {}) if biz else {}
    rate = config.get("redemption_rate", 100)
    discount_value = round(points / rate, 2)

    await db.clients.update_one(
        {"_id": ObjectId(customer_id)},
        {"$inc": {"loyalty_points": -points}}
    )

    await db.loyalty_transactions.insert_one({
        "customer_id": customer_id,
        "business_id": business_id,
        "type": "redeem",
        "points": -points,
        "discount_value": discount_value,
        "created_at": datetime.utcnow(),
    })

    return {"points_redeemed": points, "discount_value": discount_value}


# ═══════════════════════════════════════════════════════════════
# KIOSK / SELF-SERVICE ORDERING
# ═══════════════════════════════════════════════════════════════

@router.get("/kiosk/{business_id}/menu")
async def kiosk_menu(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get menu formatted for kiosk display (grouped by category, images, modifiers)."""
    db = get_database()
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not biz:
        raise HTTPException(404, "Business not found")

    categories = {}
    for item in biz.get("menu", []):
        if item.get("status") == "86":  # out of stock
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
        "categories": categories,
        "service_charge_percent": biz.get("default_service_charge", 0),
    }


@router.post("/kiosk/{business_id}/order")
async def kiosk_place_order(
    business_id: str,
    items: List[Dict] = Body(...),
    order_type: str = Body("dine_in"),
    table_number: Optional[str] = Body(None),
    customer_name: Optional[str] = Body(None),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Place order from kiosk — creates order and fires to KDS."""
    from routes.epos.orders import create_order, fire_order, CreateOrder, OrderItem

    order_items = [
        OrderItem(
            menu_item_id=item.get("id", ""),
            name=item["name"],
            quantity=item.get("quantity", 1),
            unit_price=item["price"],
            modifiers=item.get("modifiers", []),
            notes=item.get("notes"),
        )
        for item in items
    ]

    body = CreateOrder(
        business_id=business_id,
        order_type=order_type,
        table_number=table_number,
        customer_name=customer_name,
        items=order_items,
    )

    result = await create_order(body)

    # Auto-fire to kitchen
    fire_result = await fire_order(result["order_id"])

    return {
        "order_id": result["order_id"],
        "order_number": result["order_number"],
        "totals": result["totals"],
        "fired": True,
        "ticket_id": fire_result.get("ticket_id"),
    }
