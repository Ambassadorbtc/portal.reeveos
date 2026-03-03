"""
ReeveOS EPOS — Tax Reporting, Multi-Site & Cash Drawer API
==========================================================
HMRC-ready VAT reports, cash drawer management, multi-site
overview, and end-of-day reconciliation.
"""
from fastapi import Depends,  APIRouter, HTTPException, Body
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
import logging
from middleware.tenant import verify_business_access, TenantContext

logger = logging.getLogger("tax_multisite")
router = APIRouter(prefix="/ops", tags=["Tax, Cash Drawer & Multi-Site"])


# ═══════════════════════════════════════════════════════════════
# VAT / TAX REPORTING — HMRC-ready
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/vat-report")
async def vat_report(business_id: str, tenant: TenantContext = Depends(verify_business_access), month: Optional[str] = None):
    """Generate HMRC-ready VAT report.
    month format: YYYY-MM (defaults to current month).
    UK standard: 20% VAT included in prices."""
    db = get_database()

    if month:
        year, m = month.split("-")
        start = datetime(int(year), int(m), 1)
        if int(m) == 12:
            end = datetime(int(year) + 1, 1, 1)
        else:
            end = datetime(int(year), int(m) + 1, 1)
    else:
        now = datetime.utcnow()
        start = now.replace(day=1, hour=0, minute=0, second=0)
        if now.month == 12:
            end = datetime(now.year + 1, 1, 1)
        else:
            end = datetime(now.year, now.month + 1, 1)

    # Sales by VAT rate
    pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": start, "$lt": end},
            "status": {"$in": ["paid", "closed"]},
        }},
        {"$group": {
            "_id": None,
            "gross_sales": {"$sum": "$total"},
            "total_vat": {"$sum": "$vat_amount"},
            "total_tips": {"$sum": "$tips"},
            "total_service_charge": {"$sum": "$service_charge"},
            "total_discounts": {"$sum": "$discount_total"},
            "order_count": {"$sum": 1},
        }}
    ]

    result = await db.orders.aggregate(pipeline).to_list(1)
    data = result[0] if result else {}
    if "_id" in data:
        del data["_id"]

    gross = data.get("gross_sales", 0)
    vat = data.get("total_vat", 0)
    net_sales = round(gross - vat, 2)

    # By order type
    type_pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": start, "$lt": end},
            "status": {"$in": ["paid", "closed"]},
        }},
        {"$group": {
            "_id": "$order_type",
            "gross": {"$sum": "$total"},
            "vat": {"$sum": "$vat_amount"},
            "count": {"$sum": 1},
        }},
    ]
    by_type = {}
    async for doc in db.orders.aggregate(type_pipeline):
        by_type[doc["_id"]] = {
            "gross": round(doc["gross"], 2),
            "vat": round(doc["vat"], 2),
            "net": round(doc["gross"] - doc["vat"], 2),
            "orders": doc["count"],
        }

    # Refunds
    refund_pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": start, "$lt": end}, "refunds": {"$exists": True}}},
        {"$unwind": "$refunds"},
        {"$group": {"_id": None, "total": {"$sum": "$refunds.amount"}, "count": {"$sum": 1}}},
    ]
    refund_result = await db.orders.aggregate(refund_pipeline).to_list(1)
    refunds = refund_result[0] if refund_result else {"total": 0, "count": 0}

    return {
        "period": month or start.strftime("%Y-%m"),
        "gross_sales": round(gross, 2),
        "net_sales": net_sales,
        "vat_collected": round(vat, 2),
        "vat_rate": "20%",
        "tips": round(data.get("total_tips", 0), 2),
        "service_charges": round(data.get("total_service_charge", 0), 2),
        "discounts_given": round(data.get("total_discounts", 0), 2),
        "refunds": round(refunds.get("total", 0), 2),
        "refund_count": refunds.get("count", 0),
        "net_vat_due": round(vat - (refunds.get("total", 0) * 0.2 / 1.2), 2),
        "order_count": data.get("order_count", 0),
        "by_order_type": by_type,
    }


@router.get("/business/{business_id}/vat-quarterly")
async def vat_quarterly(business_id: str, tenant: TenantContext = Depends(verify_business_access), quarter: str):
    """Quarterly VAT summary for HMRC submission.
    quarter format: 2025-Q1, 2025-Q2, etc."""
    year, q = quarter.split("-Q")
    q = int(q)
    month_starts = {1: 1, 2: 4, 3: 7, 4: 10}
    start_month = month_starts[q]
    start = datetime(int(year), start_month, 1)
    if start_month + 3 > 12:
        end = datetime(int(year) + 1, (start_month + 3) - 12, 1)
    else:
        end = datetime(int(year), start_month + 3, 1)

    db = get_database()
    pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": start, "$lt": end},
            "status": {"$in": ["paid", "closed"]},
        }},
        {"$group": {
            "_id": {"$month": "$created_at"},
            "gross": {"$sum": "$total"},
            "vat": {"$sum": "$vat_amount"},
            "orders": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]

    months = []
    total_gross = 0
    total_vat = 0
    async for doc in db.orders.aggregate(pipeline):
        months.append({
            "month": doc["_id"],
            "gross": round(doc["gross"], 2),
            "vat": round(doc["vat"], 2),
            "net": round(doc["gross"] - doc["vat"], 2),
            "orders": doc["orders"],
        })
        total_gross += doc["gross"]
        total_vat += doc["vat"]

    return {
        "quarter": quarter,
        "months": months,
        "total_gross": round(total_gross, 2),
        "total_vat": round(total_vat, 2),
        "total_net": round(total_gross - total_vat, 2),
        "vat_due_to_hmrc": round(total_vat, 2),
    }


# ═══════════════════════════════════════════════════════════════
# CASH DRAWER MANAGEMENT
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/cash/open")
async def open_cash_drawer(
    business_id: str,
    opening_float: float = Body(...),
    staff_id: Optional[str] = Body(None),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Open cash drawer session with float amount."""
    db = get_database()

    # Check no open session
    active = await db.cash_sessions.find_one({
        "business_id": business_id,
        "status": "open",
    })
    if active:
        raise HTTPException(400, "Cash drawer already open. Close current session first.")

    session = {
        "business_id": business_id,
        "opening_float": opening_float,
        "staff_id": staff_id,
        "status": "open",
        "cash_in": [],  # manual additions
        "cash_out": [],  # petty cash, paid outs
        "opened_at": datetime.utcnow(),
        "closed_at": None,
    }

    result = await db.cash_sessions.insert_one(session)
    return {"session_id": str(result.inserted_id), "opening_float": opening_float}


@router.post("/business/{business_id}/cash/add")
async def cash_in(business_id: str, tenant: TenantContext = Depends(verify_business_access), amount: float = Body(...), reason: str = Body("manual")):
    """Add cash to drawer (e.g. manual addition)."""
    db = get_database()
    session = await db.cash_sessions.find_one({"business_id": business_id, "status": "open"})
    if not session:
        raise HTTPException(400, "No open cash session")

    entry = {"amount": amount, "reason": reason, "time": datetime.utcnow()}
    await db.cash_sessions.update_one(
        {"_id": session["_id"]},
        {"$push": {"cash_in": entry}}
    )
    return {"message": f"£{amount:.2f} added to drawer"}


@router.post("/business/{business_id}/cash/remove")
async def cash_out(business_id: str, tenant: TenantContext = Depends(verify_business_access), amount: float = Body(...), reason: str = Body("paid_out")):
    """Remove cash from drawer (petty cash, paid out)."""
    db = get_database()
    session = await db.cash_sessions.find_one({"business_id": business_id, "status": "open"})
    if not session:
        raise HTTPException(400, "No open cash session")

    entry = {"amount": amount, "reason": reason, "time": datetime.utcnow()}
    await db.cash_sessions.update_one(
        {"_id": session["_id"]},
        {"$push": {"cash_out": entry}}
    )
    return {"message": f"£{amount:.2f} removed from drawer"}


@router.post("/business/{business_id}/cash/close")
async def close_cash_drawer(
    business_id: str,
    counted_amount: float = Body(...),
    staff_id: Optional[str] = Body(None),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Close cash drawer and reconcile."""
    db = get_database()
    session = await db.cash_sessions.find_one({"business_id": business_id, "status": "open"})
    if not session:
        raise HTTPException(400, "No open cash session")

    # Calculate expected
    opening = session.get("opening_float", 0)
    total_in = sum(e["amount"] for e in session.get("cash_in", []))
    total_out = sum(e["amount"] for e in session.get("cash_out", []))

    # Get cash payments during this session
    cash_pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": session["opened_at"]},
            "status": {"$in": ["paid", "closed"]},
        }},
        {"$unwind": "$payments"},
        {"$match": {"payments.method": "cash"}},
        {"$group": {"_id": None, "total": {"$sum": "$payments.amount"}}},
    ]
    cash_result = await db.orders.aggregate(cash_pipeline).to_list(1)
    cash_sales = cash_result[0]["total"] if cash_result else 0

    expected = opening + cash_sales + total_in - total_out
    discrepancy = round(counted_amount - expected, 2)

    await db.cash_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "status": "closed",
            "closed_at": datetime.utcnow(),
            "closed_by": staff_id,
            "counted_amount": counted_amount,
            "expected_amount": round(expected, 2),
            "cash_sales": round(cash_sales, 2),
            "total_cash_in": round(total_in, 2),
            "total_cash_out": round(total_out, 2),
            "discrepancy": discrepancy,
        }}
    )

    return {
        "opening_float": opening,
        "cash_sales": round(cash_sales, 2),
        "cash_in": round(total_in, 2),
        "cash_out": round(total_out, 2),
        "expected": round(expected, 2),
        "counted": counted_amount,
        "discrepancy": discrepancy,
        "status": "balanced" if abs(discrepancy) < 1 else "over" if discrepancy > 0 else "short",
    }


# ═══════════════════════════════════════════════════════════════
# MULTI-SITE MANAGEMENT — Cross-location overview
# ═══════════════════════════════════════════════════════════════

@router.get("/multi-site/{owner_id}/overview")
async def multi_site_overview(owner_id: str):
    """Cross-location dashboard for multi-site operators.
    NO competitor gives real-time multi-site comparison free."""
    db = get_database()

    # Get all businesses owned by this user
    businesses = []
    async for biz in db.businesses.find({"owner_id": owner_id}):
        bid = str(biz["_id"])
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0)

        # Today's revenue
        rev_pipeline = [
            {"$match": {"business_id": bid, "created_at": {"$gte": today_start}, "status": {"$in": ["paid", "closed"]}}},
            {"$group": {"_id": None, "revenue": {"$sum": "$total"}, "orders": {"$sum": 1}}},
        ]
        rev = await db.orders.aggregate(rev_pipeline).to_list(1)
        today_rev = rev[0] if rev else {"revenue": 0, "orders": 0}

        # Currently open orders
        open_orders = await db.orders.count_documents({
            "business_id": bid,
            "status": {"$in": ["open", "fired", "partially_paid"]},
        })

        # Staff clocked in
        staff_in = await db.timesheets.count_documents({
            "business_id": bid,
            "clock_out": None,
        })

        # Low stock alerts
        low_stock = 0
        async for ing in db.ingredients.find({"business_id": bid, "min_stock": {"$gt": 0}}):
            if ing.get("current_stock", 0) <= ing.get("min_stock", 0):
                low_stock += 1

        businesses.append({
            "business_id": bid,
            "name": biz.get("name"),
            "address": biz.get("address"),
            "today_revenue": round(today_rev.get("revenue", 0), 2),
            "today_orders": today_rev.get("orders", 0),
            "open_orders": open_orders,
            "staff_clocked_in": staff_in,
            "low_stock_alerts": low_stock,
        })

    total_revenue = sum(b["today_revenue"] for b in businesses)
    total_orders = sum(b["today_orders"] for b in businesses)

    return {
        "sites": businesses,
        "site_count": len(businesses),
        "total_today_revenue": round(total_revenue, 2),
        "total_today_orders": total_orders,
    }


@router.get("/multi-site/{owner_id}/compare")
async def multi_site_compare(owner_id: str, days_back: int = 30):
    """Compare performance across all locations."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days_back)

    sites = []
    async for biz in db.businesses.find({"owner_id": owner_id}):
        bid = str(biz["_id"])

        pipeline = [
            {"$match": {"business_id": bid, "created_at": {"$gte": cutoff}, "status": {"$in": ["paid", "closed"]}}},
            {"$group": {
                "_id": None,
                "revenue": {"$sum": "$total"},
                "orders": {"$sum": 1},
                "avg_order": {"$avg": "$total"},
                "covers": {"$sum": "$covers"},
            }},
        ]
        result = await db.orders.aggregate(pipeline).to_list(1)
        data = result[0] if result else {}

        sites.append({
            "business_id": bid,
            "name": biz.get("name"),
            "revenue": round(data.get("revenue", 0), 2),
            "orders": data.get("orders", 0),
            "avg_order_value": round(data.get("avg_order", 0), 2),
            "covers": data.get("covers", 0),
            "revenue_per_day": round(data.get("revenue", 0) / max(days_back, 1), 2),
        })

    sites.sort(key=lambda s: s["revenue"], reverse=True)

    return {"sites": sites, "period_days": days_back}
