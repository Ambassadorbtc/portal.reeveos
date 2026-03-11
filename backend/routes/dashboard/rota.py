"""
Staff Rota — 4-week rotating schedule, overrides, availability.

7A: Rota templates (4-week cycles)
7B: Assign rota to staff + resolved schedule
7C: Per-day overrides (sick, holiday, swapped, custom)
7D: Available-staff lookup for booking flow

Collections:
  rota_templates — { business_id, name, weeks: {"1": {"mon": {start,end,off}, ...}, ...},
                     cycle_length, status, created_at }
  staff_rotas    — { business_id, staff_id, template_id, start_date, overrides: {"2026-03-20": {...}} }
"""

from datetime import datetime, timedelta, date as date_type
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from database import get_database
from middleware.tenant import verify_business_access, TenantContext
from bson import ObjectId
import logging

logger = logging.getLogger("rota")
router = APIRouter(prefix="/rota", tags=["rota"])

DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
VALID_OVERRIDE_REASONS = {"sick", "holiday", "swapped", "custom"}


def _parse_date(s: str) -> date_type:
    """Parse YYYY-MM-DD string to date object."""
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise HTTPException(400, f"Invalid date format: {s}. Use YYYY-MM-DD.")


def _validate_day_entry(day: dict, label: str):
    """Validate a single day entry has valid start/end or off flag."""
    if day.get("off"):
        return
    start = day.get("start", "")
    end = day.get("end", "")
    if not start or not end:
        raise HTTPException(400, f"{label}: start and end required when not off")


def _validate_weeks(weeks: dict, cycle_length: int):
    """Validate weeks structure matches cycle_length."""
    if not isinstance(weeks, dict):
        raise HTTPException(400, "weeks must be an object")
    for wk_num in range(1, cycle_length + 1):
        wk_key = str(wk_num)
        if wk_key not in weeks:
            raise HTTPException(400, f"Missing week {wk_key} in weeks")
        wk = weeks[wk_key]
        if not isinstance(wk, dict):
            raise HTTPException(400, f"Week {wk_key} must be an object")
        for day_name in DAYS:
            if day_name not in wk:
                raise HTTPException(400, f"Week {wk_key} missing day: {day_name}")
            _validate_day_entry(wk[day_name], f"Week {wk_key} {day_name}")


# ═══════════════════════════════════════════════════════════════
# 7A: ROTA TEMPLATES
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/template")
async def create_rota_template(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Create a 4-week rotating rota template."""
    name = (payload.get("name") or "").strip()
    weeks = payload.get("weeks", {})
    cycle_length = payload.get("cycle_length", 4)
    status = payload.get("status", "draft")

    if not name:
        raise HTTPException(400, "Template name is required")
    if not isinstance(cycle_length, int) or cycle_length < 1 or cycle_length > 8:
        raise HTTPException(400, "cycle_length must be between 1 and 8")
    if status not in ("active", "draft"):
        raise HTTPException(400, "status must be 'active' or 'draft'")

    _validate_weeks(weeks, cycle_length)

    db = get_database()
    now = datetime.utcnow()

    doc = {
        "business_id": business_id,
        "name": name,
        "weeks": weeks,
        "cycle_length": cycle_length,
        "status": status,
        "active": True,
        "created_at": now,
        "updated_at": now,
        "created_by": tenant.user_id,
    }

    result = await db.rota_templates.insert_one(doc)
    template_id = str(result.inserted_id)

    logger.info(f"Rota template created: {template_id} name={name} cycle={cycle_length} business={business_id}")
    return {
        "ok": True,
        "template_id": template_id,
        "name": name,
        "cycle_length": cycle_length,
        "status": status,
    }


@router.get("/business/{business_id}/templates")
async def list_rota_templates(
    business_id: str,
    include_inactive: bool = Query(False),
    tenant: TenantContext = Depends(verify_business_access),
):
    """List all rota templates."""
    db = get_database()
    query = {"business_id": business_id}
    if not include_inactive:
        query["active"] = True

    cursor = db.rota_templates.find(query).sort("created_at", -1)
    docs = await cursor.to_list(length=100)

    templates = []
    for d in docs:
        templates.append({
            "id": str(d["_id"]),
            "name": d.get("name", ""),
            "cycle_length": d.get("cycle_length", 4),
            "weeks": d.get("weeks", {}),
            "status": d.get("status", "draft"),
            "active": d.get("active", True),
            "created_at": d["created_at"].isoformat() if d.get("created_at") else "",
        })

    return {"templates": templates, "total": len(templates)}


@router.patch("/business/{business_id}/template/{template_id}")
async def update_rota_template(
    business_id: str,
    template_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Update a rota template."""
    db = get_database()

    existing = await db.rota_templates.find_one({
        "_id": ObjectId(template_id), "business_id": business_id,
    })
    if not existing:
        raise HTTPException(404, "Rota template not found")

    updates = {}
    if "name" in payload:
        name = (payload["name"] or "").strip()
        if not name:
            raise HTTPException(400, "Template name cannot be empty")
        updates["name"] = name
    if "status" in payload:
        if payload["status"] not in ("active", "draft"):
            raise HTTPException(400, "status must be 'active' or 'draft'")
        updates["status"] = payload["status"]
    if "weeks" in payload:
        cycle_length = payload.get("cycle_length", existing.get("cycle_length", 4))
        _validate_weeks(payload["weeks"], cycle_length)
        updates["weeks"] = payload["weeks"]
        if "cycle_length" in payload:
            updates["cycle_length"] = cycle_length
    elif "cycle_length" in payload:
        raise HTTPException(400, "Cannot change cycle_length without providing weeks")

    if not updates:
        raise HTTPException(400, "No valid fields to update")

    updates["updated_at"] = datetime.utcnow()

    await db.rota_templates.update_one(
        {"_id": ObjectId(template_id)},
        {"$set": updates},
    )

    logger.info(f"Rota template updated: {template_id} fields={list(updates.keys())} business={business_id}")
    return {"ok": True, "updated": list(updates.keys())}


@router.delete("/business/{business_id}/template/{template_id}")
async def delete_rota_template(
    business_id: str,
    template_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Soft-delete a rota template."""
    db = get_database()

    result = await db.rota_templates.update_one(
        {"_id": ObjectId(template_id), "business_id": business_id, "active": True},
        {"$set": {"active": False, "deleted_at": datetime.utcnow(), "deleted_by": tenant.user_id}},
    )

    if result.matched_count == 0:
        raise HTTPException(404, "Rota template not found or already deleted")

    logger.info(f"Rota template soft-deleted: {template_id} business={business_id}")
    return {"ok": True, "deleted": True}


# ═══════════════════════════════════════════════════════════════
# 7B: ASSIGN ROTA TO STAFF + RESOLVED SCHEDULE
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/assign")
async def assign_rota(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Assign a rota template to a staff member. start_date must be a Monday."""
    staff_id = (payload.get("staff_id") or "").strip()
    template_id = (payload.get("template_id") or "").strip()
    start_date_str = (payload.get("start_date") or "").strip()

    if not staff_id:
        raise HTTPException(400, "staff_id is required")
    if not template_id:
        raise HTTPException(400, "template_id is required")
    if not start_date_str:
        raise HTTPException(400, "start_date is required")

    start_date = _parse_date(start_date_str)
    if start_date.weekday() != 0:
        raise HTTPException(400, "start_date must be a Monday")

    db = get_database()

    # Verify template exists
    template = await db.rota_templates.find_one({
        "_id": ObjectId(template_id), "business_id": business_id, "active": True,
    })
    if not template:
        raise HTTPException(404, "Rota template not found")

    now = datetime.utcnow()

    # Upsert: one active rota per staff member per business
    existing = await db.staff_rotas.find_one({
        "business_id": business_id, "staff_id": staff_id,
    })

    if existing:
        await db.staff_rotas.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "template_id": template_id,
                "start_date": start_date_str,
                "updated_at": now,
            }},
        )
        rota_id = str(existing["_id"])
        logger.info(f"Rota reassigned: {rota_id} staff={staff_id} template={template['name']} business={business_id}")
    else:
        doc = {
            "business_id": business_id,
            "staff_id": staff_id,
            "template_id": template_id,
            "start_date": start_date_str,
            "overrides": {},
            "created_at": now,
            "updated_at": now,
        }
        result = await db.staff_rotas.insert_one(doc)
        rota_id = str(result.inserted_id)
        logger.info(f"Rota assigned: {rota_id} staff={staff_id} template={template['name']} business={business_id}")

    return {
        "ok": True,
        "rota_id": rota_id,
        "staff_id": staff_id,
        "template_name": template["name"],
        "start_date": start_date_str,
        "cycle_length": template["cycle_length"],
    }


def _resolve_schedule(template: dict, start_date_str: str, overrides: dict,
                      range_start: date_type, range_end: date_type) -> list:
    """Resolve daily schedule for a date range from template + overrides."""
    weeks = template.get("weeks", {})
    cycle_length = template.get("cycle_length", 4)
    rota_start = _parse_date(start_date_str)

    schedule = []
    current = range_start
    while current <= range_end:
        date_str = current.strftime("%Y-%m-%d")
        day_name = DAYS[current.weekday()]

        # Calculate which rota week applies
        days_since_start = (current - rota_start).days
        if days_since_start < 0:
            # Before rota start — no schedule
            schedule.append({
                "date": date_str,
                "week_number": None,
                "start": None,
                "end": None,
                "off": True,
                "is_override": False,
                "override_reason": None,
            })
            current += timedelta(days=1)
            continue

        week_number = (days_since_start // 7) % cycle_length + 1
        week_key = str(week_number)

        # Check override first
        if date_str in overrides:
            ov = overrides[date_str]
            schedule.append({
                "date": date_str,
                "week_number": week_number,
                "start": ov.get("start"),
                "end": ov.get("end"),
                "off": ov.get("off", False),
                "is_override": True,
                "override_reason": ov.get("reason", "custom"),
            })
        else:
            # Use template
            wk = weeks.get(week_key, {})
            day_entry = wk.get(day_name, {"off": True})
            schedule.append({
                "date": date_str,
                "week_number": week_number,
                "start": day_entry.get("start"),
                "end": day_entry.get("end"),
                "off": day_entry.get("off", False),
                "is_override": False,
                "override_reason": None,
            })

        current += timedelta(days=1)

    return schedule


@router.get("/business/{business_id}/staff/{staff_id}/schedule")
async def get_staff_schedule(
    business_id: str,
    staff_id: str,
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Resolved schedule for a staff member over a date range."""
    range_start = _parse_date(start)
    range_end = _parse_date(end)

    if range_end < range_start:
        raise HTTPException(400, "end must be >= start")
    if (range_end - range_start).days > 90:
        raise HTTPException(400, "Date range cannot exceed 90 days")

    db = get_database()

    staff_rota = await db.staff_rotas.find_one({
        "business_id": business_id, "staff_id": staff_id,
    })
    if not staff_rota:
        raise HTTPException(404, "No rota assigned to this staff member")

    template = await db.rota_templates.find_one({
        "_id": ObjectId(staff_rota["template_id"]),
    })
    if not template:
        raise HTTPException(404, "Rota template not found")

    overrides = staff_rota.get("overrides", {})
    schedule = _resolve_schedule(template, staff_rota["start_date"], overrides, range_start, range_end)

    return {
        "staff_id": staff_id,
        "template_name": template["name"],
        "cycle_length": template["cycle_length"],
        "start_date": staff_rota["start_date"],
        "schedule": schedule,
    }


# ═══════════════════════════════════════════════════════════════
# 7C: ROTA OVERRIDES
# ═══════════════════════════════════════════════════════════════

@router.patch("/business/{business_id}/staff/{staff_id}/override")
async def override_day(
    business_id: str,
    staff_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Override a single day without breaking the rotation pattern."""
    date_str = (payload.get("date") or "").strip()
    start = (payload.get("start") or "").strip()
    end = (payload.get("end") or "").strip()
    off = payload.get("off", False)
    reason = (payload.get("reason") or "custom").strip()

    if not date_str:
        raise HTTPException(400, "date is required (YYYY-MM-DD)")
    _parse_date(date_str)  # validate format

    if reason not in VALID_OVERRIDE_REASONS:
        raise HTTPException(400, f"Invalid reason. Must be one of: {', '.join(sorted(VALID_OVERRIDE_REASONS))}")

    if not off and (not start or not end):
        raise HTTPException(400, "start and end required when not marking as off")

    db = get_database()

    staff_rota = await db.staff_rotas.find_one({
        "business_id": business_id, "staff_id": staff_id,
    })
    if not staff_rota:
        raise HTTPException(404, "No rota assigned to this staff member")

    override_entry = {"off": bool(off), "reason": reason}
    if not off:
        override_entry["start"] = start
        override_entry["end"] = end

    await db.staff_rotas.update_one(
        {"_id": staff_rota["_id"]},
        {"$set": {
            f"overrides.{date_str}": override_entry,
            "updated_at": datetime.utcnow(),
        }},
    )

    logger.info(f"Rota override: staff={staff_id} date={date_str} reason={reason} off={off} business={business_id}")
    return {"ok": True, "date": date_str, "override": override_entry}


# ═══════════════════════════════════════════════════════════════
# 7D: AVAILABILITY INTEGRATION
# ═══════════════════════════════════════════════════════════════

def _time_to_minutes(t: str) -> int:
    """Convert HH:MM to minutes since midnight."""
    try:
        parts = t.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return -1


@router.get("/business/{business_id}/available-staff")
async def get_available_staff(
    business_id: str,
    date: str = Query(..., description="Date YYYY-MM-DD"),
    time: str = Query(..., description="Time HH:MM"),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Return staff who are working on a given date at a given time."""
    target_date = _parse_date(date)
    target_minutes = _time_to_minutes(time)
    if target_minutes < 0:
        raise HTTPException(400, "Invalid time format. Use HH:MM.")

    db = get_database()

    # Load all staff rotas for this business
    cursor = db.staff_rotas.find({"business_id": business_id})
    all_rotas = await cursor.to_list(length=500)

    if not all_rotas:
        return {"available": [], "date": date, "time": time, "total": 0}

    # Load all referenced templates in one query
    template_ids = list({ObjectId(r["template_id"]) for r in all_rotas})
    templates_cursor = db.rota_templates.find({"_id": {"$in": template_ids}})
    templates_list = await templates_cursor.to_list(length=100)
    templates_map = {str(t["_id"]): t for t in templates_list}

    available = []
    for rota in all_rotas:
        template = templates_map.get(rota["template_id"])
        if not template:
            continue

        overrides = rota.get("overrides", {})
        # Resolve just this one day
        schedule = _resolve_schedule(template, rota["start_date"], overrides, target_date, target_date)
        if not schedule:
            continue

        day = schedule[0]
        if day.get("off"):
            continue

        day_start = _time_to_minutes(day.get("start") or "")
        day_end = _time_to_minutes(day.get("end") or "")
        if day_start < 0 or day_end < 0:
            continue

        if day_start <= target_minutes < day_end:
            available.append({
                "staff_id": rota["staff_id"],
                "start": day.get("start"),
                "end": day.get("end"),
                "is_override": day.get("is_override", False),
            })

    # Enrich with staff names
    if available:
        staff_ids = [a["staff_id"] for a in available]
        # Try ObjectId first, fallback to string
        oid_ids = []
        for sid in staff_ids:
            try:
                oid_ids.append(ObjectId(sid))
            except Exception:
                pass
        staff_query = {"businessId": business_id, "$or": [{"_id": {"$in": oid_ids}}, {"id": {"$in": staff_ids}}]}
        staff_cursor = db.staff.find(staff_query)
        staff_docs = await staff_cursor.to_list(length=500)
        staff_name_map = {}
        for s in staff_docs:
            staff_name_map[str(s["_id"])] = s.get("name", "")
            if s.get("id"):
                staff_name_map[s["id"]] = s.get("name", "")

        for a in available:
            a["staff_name"] = staff_name_map.get(a["staff_id"], "")

    return {"available": available, "date": date, "time": time, "total": len(available)}
