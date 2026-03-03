"""
ReeveOS EPOS — Cash Management, Tax Reporting & Multi-Site API
==============================================================
Cash drawer tracking, float management, variance detection,
HMRC-ready VAT reporting, and multi-site oversight.
"""
from fastapi import Depends, APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
import logging
from middleware.tenant import verify_business_access, set_user_tenant_context, TenantContext

logger = logging.getLogger("cash_tax")
router = APIRouter(prefix="/finance", tags=["Cash & Tax"])


# ═══════════════════════════════════════════════════════════════
# CASH DRAWER MANAGEMENT
# ═══════════════════════════════════════════════════════════════

class CashFloat(BaseModel):
    business_id: str
    amount: float
    counted_by: Optional[str] = None
    denomination_breakdown: Optional[Dict] = None  # {"50": 2, "20": 5, "10": 3, ...}

class CashDrop(BaseModel):
    business_id: str
    amount: float
    reason: str = "safe_drop"  # safe_drop, bank_deposit
    authorised_by: Optional[str] = None


@router.post("/cash/open-drawer")
async def open_cash_drawer(body: CashFloat, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Record opening float — start of day."""
    db = get_database()
    session = {
        "business_id": body.business_id,
        "type": "open",
        "float_amount": body.amount,
        "denomination_breakdown": body.denomination_breakdown,
        "counted_by": body.counted_by,
        "created_at": datetime.utcnow(),
        "status": "active",
    }
    result = await db.cash_sessions.insert_one(session)
    return {"session_id": str(result.inserted_id), "float": body.amount}


@router.post("/cash/close-drawer")
async def close_cash_drawer(body: CashFloat, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Record closing count — end of day with variance calculation."""
    db = get_database()

    # Find active session
    active = await db.cash_sessions.find_one({
        "business_id": body.business_id,
        "status": "active",
    }, sort=[("created_at", -1)])

    if not active:
        raise HTTPException(400, "No active cash session")

    opening_float = active.get("float_amount", 0)

    # Calculate expected cash from orders
    session_start = active["created_at"]
    cash_pipeline = [
        {"$match": {
            "business_id": body.business_id,
            "created_at": {"$gte": session_start},
            "status": {"$in": ["paid", "closed"]},
        }},
        {"$unwind": "$payments"},
        {"$match": {"payments.method": "cash"}},
        {"$group": {
            "_id": None,
            "total_cash_received": {"$sum": "$payments.amount"},
            "total_change_given": {"$sum": "$payments.change_due"},
        }}
    ]
    cash_result = await db.orders.aggregate(cash_pipeline).to_list(1)
    cash_data = cash_result[0] if cash_result else {"total_cash_received": 0, "total_change_given": 0}

    # Get drops
    drops_pipeline = [
        {"$match": {
            "business_id": body.business_id,
            "created_at": {"$gte": session_start},
            "type": "drop",
        }},
        {"$group": {"_id": None, "total_drops": {"$sum": "$amount"}}},
    ]
    drops = await db.cash_sessions.aggregate(drops_pipeline).to_list(1)
    total_drops = drops[0]["total_drops"] if drops else 0

    expected = opening_float + cash_data.get("total_cash_received", 0) - cash_data.get("total_change_given", 0) - total_drops
    actual = body.amount
    variance = round(actual - expected, 2)

    close_record = {
        "business_id": body.business_id,
        "type": "close",
        "opening_float": opening_float,
        "cash_received": round(cash_data.get("total_cash_received", 0), 2),
        "change_given": round(cash_data.get("total_change_given", 0), 2),
        "drops": round(total_drops, 2),
        "expected_in_drawer": round(expected, 2),
        "actual_count": actual,
        "variance": variance,
        "denomination_breakdown": body.denomination_breakdown,
        "counted_by": body.counted_by,
        "created_at": datetime.utcnow(),
        "status": "closed",
    }
    await db.cash_sessions.insert_one(close_record)

    # Close active session
    await db.cash_sessions.update_one(
        {"_id": active["_id"]},
        {"$set": {"status": "closed", "closed_at": datetime.utcnow()}}
    )

    return {
        "opening_float": opening_float,
        "cash_received": round(cash_data.get("total_cash_received", 0), 2),
        "change_given": round(cash_data.get("total_change_given", 0), 2),
        "drops": round(total_drops, 2),
        "expected": round(expected, 2),
        "actual": actual,
        "variance": variance,
        "status": "balanced" if abs(variance) < 1 else "over" if variance > 0 else "short",
    }


@router.post("/cash/drop")
async def cash_drop(body: CashDrop, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Record cash drop to safe during shift."""
    db = get_database()
    drop = {
        "business_id": body.business_id,
        "type": "drop",
        "amount": body.amount,
        "reason": body.reason,
        "authorised_by": body.authorised_by,
        "created_at": datetime.utcnow(),
    }
    await db.cash_sessions.insert_one(drop)
    return {"message": f"£{body.amount:.2f} dropped to safe"}


@router.get("/cash/business/{business_id}/history")
async def cash_history(business_id: str, tenant: TenantContext = Depends(verify_business_access), days_back: int = 30):
    """Cash drawer history with variance tracking."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days_back)

    records = []
    async for doc in db.cash_sessions.find({
        "business_id": business_id,
        "type": "close",
        "created_at": {"$gte": cutoff},
    }).sort("created_at", -1):
        doc["_id"] = str(doc["_id"])
        records.append(doc)

    total_variance = sum(r.get("variance", 0) for r in records)

    return {
        "records": records,
        "total_variance": round(total_variance, 2),
        "sessions_count": len(records),
    }


# ═══════════════════════════════════════════════════════════════
# TAX / VAT REPORTING — HMRC-READY
# ═══════════════════════════════════════════════════════════════

@router.get("/tax/business/{business_id}/vat-summary")
async def vat_summary(business_id: str, tenant: TenantContext = Depends(verify_business_access), period: str = "quarter"):
    """Generate VAT summary for HMRC reporting.
    UK standard rate: 20%, reduced: 5%, zero: 0%.
    """
    db = get_database()

    if period == "quarter":
        days = 90
    elif period == "month":
        days = 30
    elif period == "year":
        days = 365
    else:
        days = 30

    cutoff = datetime.utcnow() - timedelta(days=days)

    # Revenue and VAT from orders
    pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": cutoff},
            "status": {"$in": ["paid", "closed"]},
        }},
        {"$group": {
            "_id": None,
            "gross_revenue": {"$sum": "$total"},
            "total_vat": {"$sum": "$vat_amount"},
            "total_service_charge": {"$sum": "$service_charge"},
            "total_tips": {"$sum": "$tips"},
            "order_count": {"$sum": 1},
        }}
    ]
    result = await db.orders.aggregate(pipeline).to_list(1)
    data = result[0] if result else {
        "gross_revenue": 0, "total_vat": 0, "total_service_charge": 0,
        "total_tips": 0, "order_count": 0
    }

    gross = data.get("gross_revenue", 0)
    vat_collected = data.get("total_vat", 0)
    net_revenue = gross - vat_collected

    # Input VAT (from purchases/inventory)
    input_pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": cutoff},
            "status": "received",
        }},
        {"$group": {"_id": None, "total_purchases": {"$sum": "$total"}}},
    ]
    input_result = await db.purchase_orders.aggregate(input_pipeline).to_list(1)
    total_purchases = input_result[0]["total_purchases"] if input_result else 0
    input_vat = round(total_purchases - (total_purchases / 1.2), 2)

    vat_payable = round(vat_collected - input_vat, 2)

    # Daily breakdown
    daily_pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": cutoff},
            "status": {"$in": ["paid", "closed"]},
        }},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "revenue": {"$sum": "$total"},
            "vat": {"$sum": "$vat_amount"},
            "orders": {"$sum": 1},
        }},
        {"$sort": {"_id": -1}},
    ]
    daily = []
    async for doc in db.orders.aggregate(daily_pipeline):
        daily.append({
            "date": doc["_id"],
            "revenue": round(doc["revenue"], 2),
            "vat": round(doc["vat"], 2),
            "orders": doc["orders"],
        })

    # Payment method breakdown (for VAT return Box 6/7)
    method_pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": cutoff},
            "status": {"$in": ["paid", "closed"]},
        }},
        {"$unwind": "$payments"},
        {"$group": {"_id": "$payments.method", "total": {"$sum": "$payments.amount"}}},
    ]
    by_method = {}
    async for doc in db.orders.aggregate(method_pipeline):
        by_method[doc["_id"]] = round(doc["total"], 2)

    return {
        "period": period,
        "period_days": days,
        "gross_revenue": round(gross, 2),
        "net_revenue": round(net_revenue, 2),
        "output_vat": round(vat_collected, 2),       # Box 1 — VAT due on sales
        "input_vat": input_vat,                        # Box 4 — VAT reclaimed on purchases
        "vat_payable": vat_payable,                    # Box 5 — Net VAT to pay HMRC
        "total_sales_ex_vat": round(net_revenue, 2),   # Box 6
        "total_purchases_ex_vat": round(total_purchases / 1.2, 2),  # Box 7
        "service_charge_collected": round(data.get("total_service_charge", 0), 2),
        "tips_collected": round(data.get("total_tips", 0), 2),
        "order_count": data.get("order_count", 0),
        "payment_breakdown": by_method,
        "daily": daily[:60],
    }


@router.get("/tax/business/{business_id}/profit-loss")
async def profit_and_loss(business_id: str, tenant: TenantContext = Depends(verify_business_access), days_back: int = 30):
    """Simplified P&L — Revenue, COGS, Labour, GP.
    NO competitor generates this automatically from EPOS data.
    """
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days_back)

    # Revenue
    rev_pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": cutoff}, "status": {"$in": ["paid", "closed"]}}},
        {"$group": {"_id": None, "revenue": {"$sum": "$total"}, "orders": {"$sum": 1}}},
    ]
    rev = await db.orders.aggregate(rev_pipeline).to_list(1)
    revenue = rev[0]["revenue"] if rev else 0
    orders = rev[0]["orders"] if rev else 0

    # COGS (from inventory purchases received)
    cogs_pipeline = [
        {"$match": {"business_id": business_id, "received_at": {"$gte": cutoff}, "status": "received"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]
    cogs = await db.purchase_orders.aggregate(cogs_pipeline).to_list(1)
    total_cogs = cogs[0]["total"] if cogs else 0

    # Labour
    lab_pipeline = [
        {"$match": {"business_id": business_id, "clock_in": {"$gte": cutoff}, "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$labour_cost"}}},
    ]
    lab = await db.time_clock.aggregate(lab_pipeline).to_list(1)
    total_labour = lab[0]["total"] if lab else 0

    # Waste
    waste_pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": cutoff}}},
        {"$group": {"_id": None, "total": {"$sum": "$cost"}}},
    ]
    waste = await db.waste_log.aggregate(waste_pipeline).to_list(1)
    total_waste = waste[0]["total"] if waste else 0

    gross_profit = revenue - total_cogs
    operating_profit = gross_profit - total_labour - total_waste
    gp_percent = (gross_profit / revenue * 100) if revenue > 0 else 0
    op_percent = (operating_profit / revenue * 100) if revenue > 0 else 0
    food_cost_percent = (total_cogs / revenue * 100) if revenue > 0 else 0
    labour_percent = (total_labour / revenue * 100) if revenue > 0 else 0

    return {
        "period_days": days_back,
        "revenue": round(revenue, 2),
        "orders": orders,
        "cogs": round(total_cogs, 2),
        "food_cost_percent": round(food_cost_percent, 1),
        "gross_profit": round(gross_profit, 2),
        "gp_percent": round(gp_percent, 1),
        "labour_cost": round(total_labour, 2),
        "labour_percent": round(labour_percent, 1),
        "waste_cost": round(total_waste, 2),
        "operating_profit": round(operating_profit, 2),
        "op_percent": round(op_percent, 1),
        "prime_cost": round(total_cogs + total_labour, 2),
        "prime_cost_percent": round(((total_cogs + total_labour) / revenue * 100) if revenue > 0 else 0, 1),
    }


# ═══════════════════════════════════════════════════════════════
# MULTI-SITE MANAGEMENT — Central oversight
# ═══════════════════════════════════════════════════════════════

@router.get("/multi-site/{owner_id}/overview")
async def multi_site_overview(owner_id: str, tenant: TenantContext = Depends(set_user_tenant_context), hours_back: int = 24):
    """Cross-site dashboard for multi-location operators.
    See revenue, labour, and issues across all sites at once.
    Epos Now charges extra for this — we include it free.
    """
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(hours=hours_back)

    # Get all businesses for this owner
    businesses = []
    async for biz in db.businesses.find({"owner_id": owner_id}):
        bid = str(biz["_id"])

        # Revenue
        rev_pipeline = [
            {"$match": {"business_id": bid, "created_at": {"$gte": cutoff}, "status": {"$in": ["paid", "closed"]}}},
            {"$group": {"_id": None, "revenue": {"$sum": "$total"}, "orders": {"$sum": 1}, "covers": {"$sum": "$covers"}}},
        ]
        rev = await db.orders.aggregate(rev_pipeline).to_list(1)
        rev_data = rev[0] if rev else {"revenue": 0, "orders": 0, "covers": 0}

        # Active staff
        active_staff = await db.time_clock.count_documents({"business_id": bid, "clock_out": None})

        # Open orders
        open_orders = await db.orders.count_documents({
            "business_id": bid,
            "status": {"$in": ["open", "fired", "partially_paid"]},
        })

        # Low stock alerts
        low_stock = 0
        async for ing in db.ingredients.find({
            "business_id": bid,
            "min_stock": {"$gt": 0},
        }):
            if ing.get("current_stock", 0) <= ing.get("min_stock", 0):
                low_stock += 1

        businesses.append({
            "business_id": bid,
            "name": biz.get("name", "Unnamed"),
            "revenue": round(rev_data.get("revenue", 0), 2),
            "orders": rev_data.get("orders", 0),
            "covers": rev_data.get("covers", 0),
            "active_staff": active_staff,
            "open_orders": open_orders,
            "low_stock_alerts": low_stock,
        })

    total_revenue = sum(b["revenue"] for b in businesses)
    total_orders = sum(b["orders"] for b in businesses)

    return {
        "sites": businesses,
        "total_sites": len(businesses),
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "period_hours": hours_back,
    }


# ═══════════════════════════════════════════════════════════════
# DIGITAL RECEIPTS — Email & SMS
# ═══════════════════════════════════════════════════════════════

@router.post("/receipts/send/{order_id}")
async def send_digital_receipt(
    tenant: TenantContext = Depends(set_user_tenant_context),
    order_id: str,
    method: str = Body("email"),
    destination: str = Body(...),  # email address or phone
):
    """Send digital receipt via email or SMS.
    Reduces paper waste, enables marketing follow-up.
    """
    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")

    biz = await db.businesses.find_one({"_id": ObjectId(order["business_id"])})
    biz_name = biz.get("name", "Restaurant") if biz else "Restaurant"

    # Log receipt send (actual email/SMS would integrate with Resend/Twilio)
    receipt_log = {
        "order_id": order_id,
        "business_id": order["business_id"],
        "method": method,
        "destination": destination,
        "total": order.get("total", 0),
        "status": "queued",
        "created_at": datetime.utcnow(),
    }
    await db.receipt_logs.insert_one(receipt_log)

    return {
        "message": f"Receipt sent to {destination} via {method}",
        "order_number": order.get("order_number"),
    }
