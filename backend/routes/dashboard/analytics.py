"""
Analytics API - Full analytics for Payments/Analytics dashboard.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from database import get_database
from middleware.tenant import verify_business_access, TenantContext
from datetime import datetime, date, timedelta
from typing import Optional
from bson import ObjectId

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _bid_values(business_id):
    vals = [business_id]
    if ObjectId.is_valid(business_id):
        vals.append(ObjectId(business_id))
    return vals


def _fmt_trend(pct):
    if pct > 0:
        return "+%.1f%%" % pct
    elif pct < 0:
        return "%.1f%%" % pct
    return "\u2014"


def _day_label(d):
    return d.strftime("%b %d").replace(" 0", " ")


SOURCE_LABELS = {
    "reeveos": "Online Booking",
    "phone": "Phone",
    "walk_in": "Direct / Walk-in",
    "google": "Google Reserve",
    "instagram": "Instagram",
    "referral": "Referral",
}

CHANNEL_COLORS = {
    "Online Booking": "linear-gradient(to right, #2563EB, #3B82F6)",
    "Direct / Walk-in": "linear-gradient(to right, #111111, #1a1a1a)",
    "Phone": "linear-gradient(to right, #7C3AED, #A78BFA)",
    "Google Reserve": "linear-gradient(to right, #D97706, #F59E0B)",
    "Instagram": "linear-gradient(to right, #EC4899, #F472B6)",
    "Referral": "linear-gradient(to right, #059669, #34D399)",
}


def _get_price(b):
    p = b.get("price")
    if p is not None:
        try:
            return float(p)
        except (ValueError, TypeError):
            pass
    svc = b.get("service")
    if isinstance(svc, dict):
        try:
            return float(svc.get("price", 0))
        except (ValueError, TypeError):
            pass
    return 0.0


@router.get("/business/{business_id}")
async def get_full_analytics(
    business_id: str,
    days: int = Query(30, ge=7, le=180),
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    bid = tenant.business_id
    bids = _bid_values(bid)

    business = None
    for candidate_id in bids:
        business = await db.businesses.find_one({"_id": candidate_id})
        if business:
            break
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    today = date.today()
    period_start = today - timedelta(days=days)
    prev_start = period_start - timedelta(days=days)
    start_str = period_start.isoformat()
    prev_str = prev_start.isoformat()
    end_str = today.isoformat()

    all_bookings = await db.bookings.find({
        "$or": [{"businessId": {"$in": bids}}, {"business_id": {"$in": bids}}],
        "date": {"$gte": prev_str, "$lte": end_str},
    }).to_list(length=50000)

    current_bookings = [b for b in all_bookings if (b.get("date") or "") >= start_str]
    prev_bookings = [b for b in all_bookings if (b.get("date") or "") < start_str]
    active_statuses = {"confirmed", "completed", "checked_in"}

    total_bookings = len(current_bookings)
    prev_total = len(prev_bookings)
    bookings_trend_pct = round(((total_bookings - prev_total) / prev_total * 100) if prev_total > 0 else 0, 1)

    current_revenue = sum(_get_price(b) for b in current_bookings if b.get("status") in active_statuses)
    prev_revenue = sum(_get_price(b) for b in prev_bookings if b.get("status") in active_statuses)
    revenue_trend_pct = round(((current_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0, 1)

    no_shows = len([b for b in current_bookings if b.get("status") == "no_show"])
    no_show_rate = round((no_shows / total_bookings * 100) if total_bookings > 0 else 0, 1)
    prev_no_shows = len([b for b in prev_bookings if b.get("status") == "no_show"])
    prev_no_show_rate = round((prev_no_shows / prev_total * 100) if prev_total > 0 else 0, 1)
    no_show_trend_pct = round(no_show_rate - prev_no_show_rate, 1)

    tables = business.get("tables", [])
    num_tables = len(tables) if tables else 12
    slots_per_day = 12
    max_daily_covers = num_tables * slots_per_day
    active_days = max((today - period_start).days, 1)
    total_covers = sum((b.get("partySize") or b.get("guests") or 1) for b in current_bookings if b.get("status") in active_statuses)
    occupancy_rate = min(round((total_covers / (max_daily_covers * active_days)) * 100), 100) if max_daily_covers > 0 else 0
    prev_covers = sum((b.get("partySize") or b.get("guests") or 1) for b in prev_bookings if b.get("status") in active_statuses)
    prev_occ = min(round((prev_covers / (max_daily_covers * active_days)) * 100), 100) if max_daily_covers > 0 else 0
    occupancy_trend_pct = round(occupancy_rate - prev_occ, 1)

    daily_map = {}
    for d_offset in range(days):
        d = period_start + timedelta(days=d_offset)
        daily_map[d.isoformat()] = {"day": _day_label(d), "revenue": 0, "bookings": 0}
    for b in current_bookings:
        d = b.get("date", "")
        if d in daily_map and b.get("status") in active_statuses:
            daily_map[d]["revenue"] = round(daily_map[d]["revenue"] + _get_price(b), 2)
            daily_map[d]["bookings"] += 1
    daily_revenue = list(daily_map.values())

    all_bid_strings = list(set([bid] + [str(v) for v in bids]))
    orders = await db.orders.find({"business_id": {"$in": all_bid_strings}, "status": "closed"}).to_list(length=50000)
    current_orders = []
    for o in orders:
        order_date = o.get("created_at") or o.get("opened_at")
        if order_date:
            od = order_date.date().isoformat() if isinstance(order_date, datetime) else str(order_date)[:10]
            if od >= start_str:
                current_orders.append(o)

    item_stats = {}
    for o in current_orders:
        for item in o.get("items", []):
            name = item.get("name", "Unknown")
            qty = item.get("quantity", 1)
            line = item.get("line_total") or (item.get("unit_price", 0) * qty)
            if name not in item_stats:
                item_stats[name] = {"name": name, "count": 0, "revenue": 0}
            item_stats[name]["count"] += qty
            item_stats[name]["revenue"] = round(item_stats[name]["revenue"] + float(line), 2)
    top_items = sorted(item_stats.values(), key=lambda x: x["revenue"], reverse=True)[:10]

    staff_list = business.get("staff", [])
    staff_name_map = {s.get("id"): s.get("name", "Unknown") for s in staff_list}
    staff_rev = {}
    for b in current_bookings:
        if b.get("status") not in active_statuses:
            continue
        sid = b.get("staffId") or b.get("staff_id") or ""
        if not sid:
            continue
        name = staff_name_map.get(sid, sid)
        staff_rev[name] = staff_rev.get(name, 0) + _get_price(b)
    staff_sorted = sorted(staff_rev.items(), key=lambda x: x[1], reverse=True)
    max_staff_rev = staff_sorted[0][1] if staff_sorted else 1
    staff_performance = [
        {"name": name, "revenue": round(rev, 2), "pct": round((rev / max_staff_rev) * 100) if max_staff_rev > 0 else 0}
        for name, rev in staff_sorted
    ]

    source_counts = {}
    for b in current_bookings:
        raw_source = (b.get("source") or "walk_in").lower()
        label = SOURCE_LABELS.get(raw_source, raw_source.replace("_", " ").title())
        source_counts[label] = source_counts.get(label, 0) + 1
    total_sourced = sum(source_counts.values()) or 1
    booking_channels = sorted(
        [{"name": name, "pct": round((count / total_sourced) * 100), "color": CHANNEL_COLORS.get(name, "linear-gradient(to right, #9CA3AF, #D1D5DB)")} for name, count in source_counts.items()],
        key=lambda x: x["pct"], reverse=True,
    )

    total_collected = sum(float(o.get("grand_total") or o.get("total") or 0) for o in current_orders)
    total_tips = sum(float(o.get("tips") or 0) for o in current_orders)

    return {
        "total_revenue": round(current_revenue, 2),
        "revenue_trend": _fmt_trend(revenue_trend_pct),
        "revenue_trend_pct": revenue_trend_pct,
        "occupancy_rate": occupancy_rate,
        "occupancy_trend": _fmt_trend(occupancy_trend_pct),
        "occupancy_trend_pct": occupancy_trend_pct,
        "total_bookings": total_bookings,
        "bookings_trend": _fmt_trend(bookings_trend_pct),
        "bookings_trend_pct": bookings_trend_pct,
        "no_show_rate": no_show_rate,
        "no_show_trend": _fmt_trend(no_show_trend_pct),
        "no_show_trend_pct": no_show_trend_pct,
        "daily_revenue": daily_revenue,
        "top_items": top_items,
        "staff_performance": staff_performance,
        "booking_channels": booking_channels,
        "total_collected": round(total_collected, 2),
        "total_tips": round(total_tips, 2),
        "total_orders": len(current_orders),
    }


@router.get("/business/{business_id}/transactions")
async def get_transactions(
    business_id: str,
    limit: int = Query(50, ge=1, le=200),
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    bid = tenant.business_id
    bids = _bid_values(bid)
    all_bid_strings = list(set([bid] + [str(v) for v in bids]))
    orders = await db.orders.find({"business_id": {"$in": all_bid_strings}}).sort("created_at", -1).to_list(length=limit)
    transactions = []
    for o in orders:
        created = o.get("created_at") or o.get("opened_at")
        date_str = ""
        if isinstance(created, datetime):
            date_str = created.strftime("%d %b %Y")
        elif created:
            date_str = str(created)[:10]
        total = float(o.get("grand_total") or o.get("total") or 0)
        payment_method = ""
        if o.get("payments") and len(o["payments"]) > 0:
            payment_method = o["payments"][0].get("method", "card")
        desc_str = "Order " + str(o.get("order_number", "")) + " \xb7 " + payment_method
        transactions.append({
            "id": str(o.get("_id", "")),
            "date": date_str,
            "client": o.get("customer_name", "Guest"),
            "type": "Payment",
            "desc": desc_str,
            "amount": total,
            "status": "completed" if o.get("status") == "closed" else "pending",
        })
    completed_tx = [t for t in transactions if t["status"] == "completed"]
    pending_tx = [t for t in transactions if t["status"] == "pending"]
    return {
        "transactions": transactions,
        "summary": {
            "total_collected": round(sum(t["amount"] for t in completed_tx), 2),
            "pending": round(sum(t["amount"] for t in pending_tx), 2),
            "refunds": 0,
            "count": len(transactions),
        },
    }


@router.get("/business/{business_id}/overview")
async def get_analytics_overview(
    business_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    bid = tenant.business_id
    bids = _bid_values(bid)
    business = None
    for candidate_id in bids:
        business = await db.businesses.find_one({"_id": candidate_id})
        if business:
            break
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    if not start_date:
        start_date = date.today() - timedelta(days=30)
    if not end_date:
        end_date = date.today()
    bookings = await db.bookings.find({
        "$or": [{"businessId": {"$in": bids}}, {"business_id": {"$in": bids}}],
        "date": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()},
    }).to_list(length=50000)
    total_bookings = len(bookings)
    confirmed = len([b for b in bookings if b.get("status") in ("confirmed", "completed", "checked_in")])
    cancelled = len([b for b in bookings if b.get("status") == "cancelled"])
    no_shows_count = len([b for b in bookings if b.get("status") == "no_show"])
    return {
        "period": {"start_date": start_date, "end_date": end_date},
        "bookings": {
            "total": total_bookings, "confirmed": confirmed, "cancelled": cancelled, "no_shows": no_shows_count,
            "cancellation_rate": round((cancelled / total_bookings * 100) if total_bookings > 0 else 0, 2),
            "no_show_rate": round((no_shows_count / total_bookings * 100) if total_bookings > 0 else 0, 2),
        },
        "reviews": {
            "total": await db.reviews.count_documents({"$or": [{"business_id": {"$in": bids}}, {"businessId": {"$in": bids}}]}),
            "average_rating": business.get("rating", 0),
        },
    }


@router.get("/business/{business_id}/bookings-by-day")
async def get_bookings_by_day(
    business_id: str,
    start_date: date = Query(...),
    end_date: date = Query(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    bids = _bid_values(tenant.business_id)
    pipeline = [
        {"$match": {"$or": [{"businessId": {"$in": bids}}, {"business_id": {"$in": bids}}], "date": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    return await db.bookings.aggregate(pipeline).to_list(length=None)


@router.get("/business/{business_id}/revenue")
async def get_revenue_analytics(
    business_id: str,
    start_date: date = Query(...),
    end_date: date = Query(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    bids = _bid_values(tenant.business_id)
    pipeline = [
        {"$match": {"$or": [{"businessId": {"$in": bids}}, {"business_id": {"$in": bids}}], "date": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}, "status": {"$in": ["confirmed", "completed", "checked_in"]}}},
        {"$group": {"_id": None, "total_revenue": {"$sum": {"$ifNull": ["$price", {"$ifNull": ["$service.price", 0]}]}}, "count": {"$sum": 1}}},
    ]
    results = await db.bookings.aggregate(pipeline).to_list(length=None)
    if results and results[0].get("count", 0) > 0:
        tot = results[0].get("total_revenue", 0) or 0
        cnt = results[0].get("count", 0)
        return {"total_revenue": tot, "total_transactions": cnt, "average_transaction": round(tot / cnt, 2) if cnt else 0}
    return {"total_revenue": 0, "total_transactions": 0, "average_transaction": 0}


@router.get("/business/{business_id}/popular-times")
async def get_popular_times(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    bids = _bid_values(tenant.business_id)
    pipeline = [
        {"$match": {"$or": [{"businessId": {"$in": bids}}, {"business_id": {"$in": bids}}], "date": {"$gte": (date.today() - timedelta(days=90)).isoformat()}, "status": {"$in": ["confirmed", "completed", "checked_in"]}}},
        {"$addFields": {"hour": {"$toInt": {"$substr": [{"$ifNull": ["$time", "00:00"]}, 0, 2]}}}},
        {"$group": {"_id": "$hour", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    return await db.bookings.aggregate(pipeline).to_list(length=None)
