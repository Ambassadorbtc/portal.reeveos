"""
Run 3: Calendar APIs — day/week/month views
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from database import get_database
from middleware.auth import get_current_staff
from datetime import datetime, date, timedelta
from middleware.tenant import verify_business_access, TenantContext

router = APIRouter(prefix="/calendar", tags=["calendar"])

STATUS_COLOURS = {
    "confirmed": "#22C55E",
    "pending": "#F59E0B",
    "checked_in": "#3B82F6",
    "completed": "#6B7280",
    "cancelled": "#EF4444",
    "no_show": "#991B1B",
}


@router.get("/{business_id}")
async def get_calendar(
    business_id: str,
    date_param: str = Query(..., alias="date"),
    view: str = Query("day"),
    current_user: dict = Depends(get_current_staff),
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")
    owner_id = str(business.get("owner_id", ""))
    if owner_id != str(current_user.get("_id", "")) and current_user.get("role") not in ["staff", "admin"]:
        raise HTTPException(403, "Not authorized")

    try:
        d = datetime.strptime(date_param, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date")

    staff_list = []
    for st in business.get("staff", []):
        if st.get("active", True):
            staff_list.append({
                "id": st.get("id", ""),
                "name": st.get("name", ""),
                "avatar": st.get("avatar"),
            })

    # Query bookings for the range
    if view == "day":
        start_d = d
        end_d = d
    elif view == "week":
        start_d = d - timedelta(days=d.weekday())
        end_d = start_d + timedelta(days=6)
    else:
        start_d = date(d.year, d.month, 1)
        if d.month == 12:
            end_d = date(d.year, 12, 31)
        else:
            end_d = date(d.year, d.month + 1, 1) - timedelta(days=1)

    cursor = db.bookings.find({
        "businessId": business_id,
        "date": {"$gte": start_d.isoformat(), "$lte": end_d.isoformat()},
        "status": {"$nin": ["cancelled"]},
    }).sort("date", 1).sort("time", 1)

    docs = await cursor.to_list(length=None)

    opening = business.get("settings", {}).get("openingHours", {}) or {}
    mon = opening.get("mon") or opening.get("monday") or {}
    open_t = mon.get("open") or "09:00"
    close_t = mon.get("close") or "17:00"

    bookings = []
    for b in docs:
        svc = b.get("service") or {}
        bookings.append({
            "id": b.get("_id"),
            "staffId": b.get("staffId"),
            "time": b.get("time", "00:00"),
            "endTime": b.get("endTime", ""),
            "duration": svc.get("duration", 60),
            "customerName": (b.get("customer") or {}).get("name", ""),
            "service": svc.get("name", "Booking"),
            "status": b.get("status", "confirmed"),
            "colour": STATUS_COLOURS.get(b.get("status", "confirmed"), "#22C55E"),
        })

    return {
        "date": date_param,
        "view": view,
        "openingHours": {"open": open_t, "close": close_t},
        "staff": staff_list,
        "bookings": bookings,
    }
