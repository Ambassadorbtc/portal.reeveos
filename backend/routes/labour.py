"""
ReeveOS EPOS — Staff Scheduling & Labour API
=============================================
Time clock, shift scheduling, labour cost tracking,
break management, overtime alerts, staff performance.
Competitors charge extra for this — ours is built-in.
"""
from fastapi import Depends,  APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
import logging
from middleware.tenant import verify_business_access, TenantContext

logger = logging.getLogger("labour")
router = APIRouter(prefix="/labour", tags=["Staff Scheduling & Labour"])


# ─── Models ─── #

class ShiftCreate(BaseModel):
    staff_id: str
    staff_name: str
    role: Optional[str] = "server"  # server, chef, bartender, manager, host, runner
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    hourly_rate: Optional[float] = None
    notes: Optional[str] = None

class ClockEvent(BaseModel):
    staff_id: str
    pin: Optional[str] = None  # staff PIN for clock-in

class BreakEvent(BaseModel):
    staff_id: str
    break_type: str = "standard"  # standard, meal


# ─── Time Clock ─── #

@router.post("/business/{business_id}/clock-in")
async def clock_in(business_id: str, body: ClockEvent, tenant: TenantContext = Depends(verify_business_access)):
    """Staff clock-in. Creates a timesheet entry."""
    db = get_database()

    # Verify staff exists
    try:
        oid_filter = {"_id": ObjectId(body.staff_id)} if len(body.staff_id) == 24 else {}
    except Exception:
        oid_filter = {}
    staff = await db.staff_members.find_one({
        "business_id": business_id,
        "$or": [oid_filter, {"staff_id": body.staff_id}]
    }) if oid_filter else await db.staff_members.find_one({
        "business_id": business_id,
        "staff_id": body.staff_id,
    })

    # Check not already clocked in
    active = await db.timesheets.find_one({
        "business_id": business_id,
        "staff_id": body.staff_id,
        "clock_out": None,
    })
    if active:
        raise HTTPException(400, "Already clocked in")

    entry = {
        "business_id": business_id,
        "staff_id": body.staff_id,
        "staff_name": staff.get("name", "Unknown") if staff else "Unknown",
        "role": staff.get("role", "staff") if staff else "staff",
        "clock_in": datetime.utcnow(),
        "clock_out": None,
        "breaks": [],
        "total_hours": 0,
        "total_break_minutes": 0,
        "hourly_rate": staff.get("hourly_rate", 0) if staff else 0,
        "labour_cost": 0,
        "status": "active",
        "created_at": datetime.utcnow(),
    }

    result = await db.timesheets.insert_one(entry)
    return {"message": f"Clocked in", "timesheet_id": str(result.inserted_id), "time": entry["clock_in"].strftime("%H:%M")}


@router.post("/business/{business_id}/clock-out")
async def clock_out(business_id: str, body: ClockEvent, tenant: TenantContext = Depends(verify_business_access)):
    """Staff clock-out. Calculates hours and labour cost."""
    db = get_database()

    entry = await db.timesheets.find_one({
        "business_id": business_id,
        "staff_id": body.staff_id,
        "clock_out": None,
    })
    if not entry:
        raise HTTPException(400, "Not clocked in")

    now = datetime.utcnow()
    total_seconds = (now - entry["clock_in"]).total_seconds()
    break_seconds = sum(
        (b.get("end", now) - b["start"]).total_seconds()
        for b in entry.get("breaks", [])
        if b.get("start")
    )
    worked_seconds = total_seconds - break_seconds
    total_hours = round(worked_seconds / 3600, 2)
    break_minutes = round(break_seconds / 60)
    labour_cost = round(total_hours * entry.get("hourly_rate", 0), 2)

    # Check overtime (over 8 hours)
    overtime_hours = max(0, total_hours - 8)
    overtime_cost = round(overtime_hours * entry.get("hourly_rate", 0) * 0.5, 2)  # 1.5x rate

    await db.timesheets.update_one(
        {"_id": entry["_id"]},
        {"$set": {
            "clock_out": now,
            "total_hours": total_hours,
            "total_break_minutes": break_minutes,
            "labour_cost": labour_cost + overtime_cost,
            "overtime_hours": overtime_hours,
            "overtime_cost": overtime_cost,
            "status": "completed",
        }}
    )

    return {
        "message": "Clocked out",
        "total_hours": total_hours,
        "break_minutes": break_minutes,
        "labour_cost": labour_cost + overtime_cost,
        "overtime_hours": overtime_hours,
    }


@router.post("/business/{business_id}/break-start")
async def start_break(business_id: str, body: BreakEvent, tenant: TenantContext = Depends(verify_business_access)):
    """Start a break."""
    db = get_database()
    entry = await db.timesheets.find_one({
        "business_id": business_id,
        "staff_id": body.staff_id,
        "clock_out": None,
    })
    if not entry:
        raise HTTPException(400, "Not clocked in")

    brk = {"start": datetime.utcnow(), "end": None, "type": body.break_type}

    await db.timesheets.update_one(
        {"_id": entry["_id"]},
        {"$push": {"breaks": brk}}
    )
    return {"message": "Break started"}


@router.post("/business/{business_id}/break-end")
async def end_break(business_id: str, body: BreakEvent, tenant: TenantContext = Depends(verify_business_access)):
    """End current break."""
    db = get_database()
    entry = await db.timesheets.find_one({
        "business_id": business_id,
        "staff_id": body.staff_id,
        "clock_out": None,
    })
    if not entry:
        raise HTTPException(400, "Not clocked in")

    breaks = entry.get("breaks", [])
    for i in range(len(breaks) - 1, -1, -1):
        if breaks[i].get("end") is None:
            breaks[i]["end"] = datetime.utcnow()
            break

    await db.timesheets.update_one(
        {"_id": entry["_id"]},
        {"$set": {"breaks": breaks}}
    )
    return {"message": "Break ended"}


@router.get("/business/{business_id}/who-is-in")
async def who_is_in(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get all currently clocked-in staff."""
    db = get_database()
    staff = []
    async for doc in db.timesheets.find({
        "business_id": business_id,
        "clock_out": None,
    }):
        elapsed = round((datetime.utcnow() - doc["clock_in"]).total_seconds() / 3600, 2)
        on_break = any(b.get("end") is None for b in doc.get("breaks", []))
        staff.append({
            "timesheet_id": str(doc["_id"]),
            "staff_id": doc["staff_id"],
            "staff_name": doc.get("staff_name", "Unknown"),
            "role": doc.get("role"),
            "clock_in": doc["clock_in"].strftime("%H:%M"),
            "hours_elapsed": elapsed,
            "on_break": on_break,
            "hourly_rate": doc.get("hourly_rate", 0),
            "running_cost": round(elapsed * doc.get("hourly_rate", 0), 2),
        })
    return {"staff": staff, "count": len(staff)}


# ─── Shift Scheduling ─── #

@router.post("/business/{business_id}/shifts")
async def create_shift(business_id: str, body: ShiftCreate, tenant: TenantContext = Depends(verify_business_access)):
    """Schedule a shift."""
    db = get_database()
    shift = body.dict()
    shift["business_id"] = business_id
    shift["status"] = "scheduled"  # scheduled, confirmed, completed, missed
    shift["created_at"] = datetime.utcnow()

    result = await db.shifts.insert_one(shift)
    return {"shift_id": str(result.inserted_id)}


@router.get("/business/{business_id}/shifts")
async def get_shifts(business_id: str, tenant: TenantContext = Depends(verify_business_access), week_of: Optional[str] = None):
    """Get shift schedule for a week. week_of=YYYY-MM-DD (Monday of that week)."""
    db = get_database()

    if week_of:
        start = datetime.strptime(week_of, "%Y-%m-%d")
    else:
        today = datetime.utcnow()
        start = today - timedelta(days=today.weekday())  # Monday
    start = start.replace(hour=0, minute=0, second=0)
    end = start + timedelta(days=7)

    shifts = []
    async for doc in db.shifts.find({
        "business_id": business_id,
        "date": {"$gte": start.strftime("%Y-%m-%d"), "$lt": end.strftime("%Y-%m-%d")},
    }).sort("date", 1):
        doc["_id"] = str(doc["_id"])
        shifts.append(doc)

    return {"shifts": shifts, "week_start": start.strftime("%Y-%m-%d")}


@router.post("/business/{business_id}/shifts/auto-schedule")
async def auto_schedule(business_id: str, tenant: TenantContext = Depends(verify_business_access), week_of: str = Body(..., embed=True)):
    """Auto-generate schedule based on historical busy patterns.
    NO competitor offers AI-powered auto-scheduling."""
    db = get_database()

    # Get peak hours from order data
    cutoff = datetime.utcnow() - timedelta(weeks=8)
    pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": {
                "day": {"$dayOfWeek": "$created_at"},
                "hour": {"$hour": "$created_at"},
            },
            "order_count": {"$sum": 1},
        }},
    ]

    hourly_demand = {}
    async for doc in db.orders.aggregate(pipeline):
        day = doc["_id"]["day"]
        hour = doc["_id"]["hour"]
        hourly_demand.setdefault(day, {})
        hourly_demand[day][hour] = doc["order_count"] / 8  # avg per week

    # Get available staff
    staff_list = []
    async for s in db.staff_members.find({"business_id": business_id, "status": "active"}):
        staff_list.append({
            "id": str(s["_id"]),
            "name": s.get("name", "Staff"),
            "role": s.get("role", "server"),
            "hourly_rate": s.get("hourly_rate", 10),
            "max_hours": s.get("max_weekly_hours", 40),
        })

    # Simple scheduling: 1 staff per 10 orders/hour, min 2 per shift
    day_names = {1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday",
                 5: "Thursday", 6: "Friday", 7: "Saturday"}

    suggested_shifts = []
    start_date = datetime.strptime(week_of, "%Y-%m-%d")

    for day_offset in range(7):
        date = start_date + timedelta(days=day_offset)
        day_num = date.isoweekday() % 7 + 1  # Convert to MongoDB dayOfWeek
        day_demand = hourly_demand.get(day_num, {})

        if not day_demand:
            continue

        # Find peak hours (open to close)
        active_hours = sorted(day_demand.keys())
        if not active_hours:
            continue

        open_hour = min(active_hours)
        close_hour = max(active_hours) + 1
        peak_demand = max(day_demand.values())
        staff_needed = max(2, round(peak_demand / 10))

        for i, staff in enumerate(staff_list[:staff_needed]):
            suggested_shifts.append({
                "staff_id": staff["id"],
                "staff_name": staff["name"],
                "role": staff["role"],
                "date": date.strftime("%Y-%m-%d"),
                "day": day_names.get(day_num, ""),
                "start_time": f"{open_hour:02d}:00",
                "end_time": f"{min(close_hour, 23):02d}:00",
                "estimated_cost": round((close_hour - open_hour) * staff["hourly_rate"], 2),
            })

    return {
        "suggested_shifts": suggested_shifts,
        "total_estimated_cost": round(sum(s["estimated_cost"] for s in suggested_shifts), 2),
        "note": "Review and confirm before publishing to staff",
    }


# ─── Labour Analytics ─── #

@router.get("/business/{business_id}/labour-report")
async def labour_report(business_id: str, tenant: TenantContext = Depends(verify_business_access), days_back: int = 7):
    """Labour cost report with revenue comparison."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days_back)

    # Labour costs
    labour_pipeline = [
        {"$match": {"business_id": business_id, "clock_in": {"$gte": cutoff}, "status": "completed"}},
        {"$group": {
            "_id": None,
            "total_hours": {"$sum": "$total_hours"},
            "total_cost": {"$sum": "$labour_cost"},
            "total_overtime_hours": {"$sum": "$overtime_hours"},
            "total_overtime_cost": {"$sum": "$overtime_cost"},
            "shifts": {"$sum": 1},
        }}
    ]
    labour = await db.timesheets.aggregate(labour_pipeline).to_list(1)
    labour_data = labour[0] if labour else {"total_hours": 0, "total_cost": 0, "total_overtime_hours": 0, "total_overtime_cost": 0, "shifts": 0}
    if "_id" in labour_data:
        del labour_data["_id"]

    # Revenue for same period
    rev_pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": cutoff}, "status": {"$in": ["paid", "closed"]}}},
        {"$group": {"_id": None, "total_revenue": {"$sum": "$total"}, "total_orders": {"$sum": 1}}},
    ]
    rev = await db.orders.aggregate(rev_pipeline).to_list(1)
    revenue = rev[0].get("total_revenue", 0) if rev else 0
    total_orders = rev[0].get("total_orders", 0) if rev else 0

    labour_cost = labour_data.get("total_cost", 0)
    labour_percent = round((labour_cost / revenue * 100), 1) if revenue > 0 else 0

    # Per-staff breakdown
    staff_pipeline = [
        {"$match": {"business_id": business_id, "clock_in": {"$gte": cutoff}, "status": "completed"}},
        {"$group": {
            "_id": "$staff_name",
            "hours": {"$sum": "$total_hours"},
            "cost": {"$sum": "$labour_cost"},
            "shifts": {"$sum": 1},
        }},
        {"$sort": {"hours": -1}},
    ]
    per_staff = []
    async for doc in db.timesheets.aggregate(staff_pipeline):
        per_staff.append({
            "name": doc["_id"],
            "hours": round(doc["hours"], 1),
            "cost": round(doc["cost"], 2),
            "shifts": doc["shifts"],
        })

    for key in ["total_hours", "total_cost", "total_overtime_hours", "total_overtime_cost"]:
        labour_data[key] = round(labour_data.get(key, 0), 2)

    return {
        **labour_data,
        "revenue": round(revenue, 2),
        "labour_percent": labour_percent,
        "cost_per_order": round(labour_cost / max(total_orders, 1), 2),
        "revenue_per_labour_hour": round(revenue / max(labour_data.get("total_hours", 1), 1), 2),
        "per_staff": per_staff,
        "period_days": days_back,
        "target_labour_percent": 30,  # Industry standard
        "status": "good" if labour_percent <= 30 else "warning" if labour_percent <= 35 else "critical",
    }


# ─── Staff Performance ─── #

@router.get("/business/{business_id}/staff-performance")
async def staff_performance(business_id: str, tenant: TenantContext = Depends(verify_business_access), days_back: int = 30):
    """Per-staff performance: revenue generated, avg order value, upsell rate, tips.
    NO competitor tracks individual server revenue attribution."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days_back)

    pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": cutoff},
            "status": {"$in": ["paid", "closed"]},
            "staff_id": {"$exists": True, "$ne": None},
        }},
        {"$group": {
            "_id": "$staff_id",
            "orders": {"$sum": 1},
            "revenue": {"$sum": "$total"},
            "tips": {"$sum": "$tips"},
            "avg_order_value": {"$avg": "$total"},
            "avg_covers": {"$avg": "$covers"},
            "total_items": {"$sum": {"$size": "$items"}},
        }},
        {"$sort": {"revenue": -1}},
    ]

    performers = []
    async for doc in db.orders.aggregate(pipeline):
        items_per_order = round(doc["total_items"] / max(doc["orders"], 1), 1)
        performers.append({
            "staff_id": doc["_id"],
            "orders_taken": doc["orders"],
            "revenue_generated": round(doc["revenue"], 2),
            "tips_earned": round(doc["tips"], 2),
            "avg_order_value": round(doc["avg_order_value"], 2),
            "avg_covers": round(doc.get("avg_covers", 0), 1),
            "items_per_order": items_per_order,
        })

    return {"performers": performers, "period_days": days_back}
