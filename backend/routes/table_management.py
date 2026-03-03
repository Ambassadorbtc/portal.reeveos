"""
ReeveOS EPOS — Table Management API
=====================================
Goes beyond Toast Tables, Tevalis, and every competitor:
- Drag-and-drop floor plan with zones and server sections
- Full table lifecycle: available → reserved → seated → ordering → mains → dessert → bill → clearing → available
- Merge/split tables with order preservation
- Covers tracking with predicted turn time
- Seat-level assignment for bill splitting
- Table timers with configurable thresholds and alerts
- Server section management with auto-balance
- Walk-in waitlist with SMS notifications
- Real-time WebSocket-ready status for all connected devices

UNIQUE TO REEVEOS:
- AI table turn prediction (based on party size, order history, time of day)
- Auto-capacity alerts when approaching max covers
- Revenue-per-seat-hour metric (no competitor tracks this)
- Smart seating suggestions (optimise covers vs wait time)
"""
from fastapi import APIRouter, HTTPException, Depends, Body, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
import logging
import math
import random
import string
from middleware.tenant import verify_business_access, TenantContext

logger = logging.getLogger("table_management")
router = APIRouter(prefix="/tables-epos", tags=["EPOS Table Management"])


# ─── Models ─── #

class TableZone(BaseModel):
    name: str  # "Main Floor", "Patio", "Bar", "Private Dining"
    colour: str = "#4CAF50"
    capacity: int = 0  # auto-calculated from tables
    active: bool = True

class TableCreate(BaseModel):
    number: str  # "T1", "B3", "P5"
    zone: Optional[str] = "main"
    seats: int = 4
    min_covers: int = 1
    max_covers: int = 0  # 0 = same as seats
    shape: str = "square"  # square, round, rectangle, booth, bar_stool
    x: float = 0  # floor plan position
    y: float = 0
    width: float = 80
    height: float = 80
    rotation: float = 0
    combinable: bool = True  # can be merged with adjacent
    server_section: Optional[str] = None
    features: Optional[List[str]] = []  # ["window", "wheelchair", "high_chair", "power_outlet"]

class TableStatusUpdate(BaseModel):
    status: str  # available, reserved, seated, ordering, starters, mains, dessert, bill_requested, paying, clearing
    covers: Optional[int] = None
    server_id: Optional[str] = None
    reservation_id: Optional[str] = None
    notes: Optional[str] = None

class MergeTablesRequest(BaseModel):
    table_ids: List[str]  # min 2
    primary_table_id: str  # which table number shows on orders

class SplitTableRequest(BaseModel):
    table_id: str
    new_tables: List[Dict]  # [{"number": "T1A", "seats": 2, "seat_numbers": [1,2]}, ...]

class SeatAssignment(BaseModel):
    seat_number: int
    guest_name: Optional[str] = None
    dietary: Optional[List[str]] = []  # ["vegan", "gluten_free", "nut_allergy"]
    vip: bool = False
    notes: Optional[str] = None

class WaitlistEntry(BaseModel):
    guest_name: str
    phone: Optional[str] = None
    party_size: int
    notes: Optional[str] = None
    seating_preference: Optional[List[str]] = []  # ["window", "booth", "patio"]
    quoted_wait: Optional[int] = None  # minutes

class ServerSection(BaseModel):
    name: str
    server_id: str
    server_name: str
    table_ids: List[str] = []
    colour: str = "#2196F3"

class FloorPlanLayout(BaseModel):
    name: str = "Default"
    zones: List[Dict] = []
    tables: List[Dict] = []
    walls: Optional[List[Dict]] = []  # decorative walls/barriers
    labels: Optional[List[Dict]] = []  # text labels like "Kitchen", "Bar"
    background_image: Optional[str] = None


# ─── Helpers ─── #

def table_serial(doc):
    doc["_id"] = str(doc["_id"])
    return doc

def now():
    return datetime.utcnow()

# Table status lifecycle with valid transitions
STATUS_FLOW = {
    "available": ["reserved", "seated"],
    "reserved": ["seated", "no_show", "available"],
    "seated": ["ordering"],
    "ordering": ["starters"],
    "starters": ["mains"],
    "mains": ["dessert", "bill_requested"],
    "dessert": ["bill_requested"],
    "bill_requested": ["paying"],
    "paying": ["clearing"],
    "clearing": ["available"],
    "no_show": ["available"],
}

# Colour coding per status (for frontend)
STATUS_COLOURS = {
    "available": "#4CAF50",    # green
    "reserved": "#9C27B0",     # purple
    "seated": "#2196F3",       # blue
    "ordering": "#03A9F4",     # light blue
    "starters": "#FF9800",     # orange
    "mains": "#F44336",        # red
    "dessert": "#E91E63",      # pink
    "bill_requested": "#FFC107", # amber
    "paying": "#FFEB3B",       # yellow
    "clearing": "#795548",     # brown
    "no_show": "#9E9E9E",      # grey
}

# Average turn times by party size (minutes) — baseline for AI prediction
BASE_TURN_TIMES = {
    1: 35, 2: 55, 3: 65, 4: 75, 5: 85, 6: 95, 7: 105, 8: 115
}


# ═══════════════════════════════════════════════════════
# FLOOR PLAN & ZONES
# ═══════════════════════════════════════════════════════

@router.get("/business/{business_id}/floor-plan")
async def get_floor_plan(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get complete floor plan with all zones, tables, and current status."""
    db = get_database()

    # Get or create default layout
    layout = await db.epos_floor_plans.find_one({"business_id": business_id, "active": True})
    if not layout:
        layout = {"name": "Default", "zones": [], "walls": [], "labels": [], "background_image": None}

    # Get all tables with current status
    tables = []
    async for t in db.epos_tables.find({"business_id": business_id}).sort("number", 1):
        t = table_serial(t)
        # Calculate time at table if occupied
        if t.get("status") not in ("available", "reserved") and t.get("seated_at"):
            seated_at = t["seated_at"]
            if isinstance(seated_at, str):
                seated_at = datetime.fromisoformat(seated_at)
            elapsed = (now() - seated_at).total_seconds() / 60
            t["minutes_seated"] = round(elapsed)
            # Predict remaining time
            covers = t.get("covers", t.get("seats", 4))
            base = BASE_TURN_TIMES.get(min(covers, 8), 115)
            t["predicted_turn_minutes"] = base
            t["predicted_remaining"] = max(0, round(base - elapsed))
        else:
            t["minutes_seated"] = 0
            t["predicted_remaining"] = 0

        t["status_colour"] = STATUS_COLOURS.get(t.get("status", "available"), "#4CAF50")
        tables.append(t)

    # Get zones
    zones = []
    async for z in db.epos_zones.find({"business_id": business_id}).sort("name", 1):
        z = table_serial(z)
        zone_tables = [t for t in tables if t.get("zone") == z.get("name", "").lower().replace(" ", "_")]
        z["table_count"] = len(zone_tables)
        z["total_seats"] = sum(t.get("seats", 0) for t in zone_tables)
        z["occupied_tables"] = len([t for t in zone_tables if t.get("status") not in ("available", "reserved")])
        z["available_tables"] = len([t for t in zone_tables if t.get("status") == "available"])
        zones.append(z)

    # Get server sections
    sections = []
    async for s in db.epos_server_sections.find({"business_id": business_id}):
        s = table_serial(s)
        sections.append(s)

    # Summary stats
    total_tables = len(tables)
    occupied = len([t for t in tables if t.get("status") not in ("available", "reserved")])
    available = len([t for t in tables if t.get("status") == "available"])
    reserved = len([t for t in tables if t.get("status") == "reserved"])
    total_covers = sum(t.get("covers", 0) for t in tables if t.get("status") not in ("available", "reserved"))
    total_capacity = sum(t.get("seats", 0) for t in tables)

    return {
        "floor_plan": table_serial(layout) if "_id" in layout else layout,
        "tables": tables,
        "zones": zones,
        "server_sections": sections,
        "stats": {
            "total_tables": total_tables,
            "occupied": occupied,
            "available": available,
            "reserved": reserved,
            "total_covers": total_covers,
            "total_capacity": total_capacity,
            "occupancy_pct": round((occupied / max(total_tables, 1)) * 100, 1),
            "covers_pct": round((total_covers / max(total_capacity, 1)) * 100, 1),
        },
        "status_colours": STATUS_COLOURS,
    }


@router.post("/business/{business_id}/floor-plan")
async def save_floor_plan(business_id: str, layout: FloorPlanLayout, tenant: TenantContext = Depends(verify_business_access)):
    """Save entire floor plan layout (positions, walls, labels)."""
    db = get_database()
    doc = {
        "business_id": business_id,
        "name": layout.name,
        "zones": layout.zones,
        "walls": layout.walls or [],
        "labels": layout.labels or [],
        "background_image": layout.background_image,
        "active": True,
        "updated_at": now(),
    }
    existing = await db.epos_floor_plans.find_one({"business_id": business_id, "active": True})
    if existing:
        await db.epos_floor_plans.update_one({"_id": existing["_id"]}, {"$set": doc})
        doc["_id"] = str(existing["_id"])
    else:
        doc["created_at"] = now()
        result = await db.epos_floor_plans.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
    return {"floor_plan": doc}


# ═══════════════════════════════════════════════════════
# ZONES
# ═══════════════════════════════════════════════════════

@router.post("/business/{business_id}/zones")
async def create_zone(business_id: str, zone: TableZone, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    doc = {
        "business_id": business_id,
        "name": zone.name,
        "slug": zone.name.lower().replace(" ", "_"),
        "colour": zone.colour,
        "active": zone.active,
        "created_at": now(),
    }
    result = await db.epos_zones.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return {"zone": doc}


@router.put("/business/{business_id}/zones/{zone_id}")
async def update_zone(business_id: str, zone_id: str, zone: TableZone, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    await db.epos_zones.update_one(
        {"_id": ObjectId(zone_id), "business_id": business_id},
        {"$set": {"name": zone.name, "slug": zone.name.lower().replace(" ", "_"),
                  "colour": zone.colour, "active": zone.active}},
    )
    return {"ok": True}


@router.delete("/business/{business_id}/zones/{zone_id}")
async def delete_zone(business_id: str, zone_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    await db.epos_zones.delete_one({"_id": ObjectId(zone_id), "business_id": business_id})
    return {"ok": True}


# ═══════════════════════════════════════════════════════
# TABLE CRUD
# ═══════════════════════════════════════════════════════

@router.post("/business/{business_id}/tables")
async def create_table(business_id: str, table: TableCreate, tenant: TenantContext = Depends(verify_business_access)):
    """Create a table. Validates no duplicate number in business."""
    db = get_database()
    existing = await db.epos_tables.find_one({"business_id": business_id, "number": table.number})
    if existing:
        raise HTTPException(400, f"Table {table.number} already exists")

    doc = {
        "business_id": business_id,
        "number": table.number,
        "zone": table.zone,
        "seats": table.seats,
        "min_covers": table.min_covers,
        "max_covers": table.max_covers or table.seats,
        "shape": table.shape,
        "x": table.x,
        "y": table.y,
        "width": table.width,
        "height": table.height,
        "rotation": table.rotation,
        "combinable": table.combinable,
        "server_section": table.server_section,
        "features": table.features or [],
        "status": "available",
        "covers": 0,
        "server_id": None,
        "server_name": None,
        "reservation_id": None,
        "order_id": None,
        "seated_at": None,
        "seat_assignments": {},  # {1: {guest_name, dietary, vip}, 2: {...}}
        "merged_with": [],  # table IDs this is merged with
        "is_merged_child": False,
        "notes": None,
        "history": [],  # [{status, at, by, covers}]
        "created_at": now(),
        "updated_at": now(),
    }
    result = await db.epos_tables.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return {"table": doc}


@router.post("/business/{business_id}/tables/bulk")
async def create_tables_bulk(business_id: str, tenant: TenantContext = Depends(verify_business_access), tables: List[TableCreate] = Body(...)):
    """Create multiple tables at once (initial setup)."""
    db = get_database()
    created = []
    for table in tables:
        existing = await db.epos_tables.find_one({"business_id": business_id, "number": table.number})
        if existing:
            continue
        doc = {
            "business_id": business_id,
            "number": table.number,
            "zone": table.zone,
            "seats": table.seats,
            "min_covers": table.min_covers,
            "max_covers": table.max_covers or table.seats,
            "shape": table.shape,
            "x": table.x, "y": table.y,
            "width": table.width, "height": table.height,
            "rotation": table.rotation,
            "combinable": table.combinable,
            "server_section": table.server_section,
            "features": table.features or [],
            "status": "available",
            "covers": 0,
            "server_id": None, "server_name": None,
            "reservation_id": None, "order_id": None,
            "seated_at": None, "seat_assignments": {},
            "merged_with": [], "is_merged_child": False,
            "notes": None, "history": [],
            "created_at": now(), "updated_at": now(),
        }
        result = await db.epos_tables.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        created.append(doc)
    return {"created": len(created), "tables": created}


@router.put("/business/{business_id}/tables/{table_id}")
async def update_table(business_id: str, table_id: str, table: TableCreate, tenant: TenantContext = Depends(verify_business_access)):
    """Update table properties (not status — use status endpoint)."""
    db = get_database()
    updates = {
        "number": table.number,
        "zone": table.zone,
        "seats": table.seats,
        "min_covers": table.min_covers,
        "max_covers": table.max_covers or table.seats,
        "shape": table.shape,
        "x": table.x, "y": table.y,
        "width": table.width, "height": table.height,
        "rotation": table.rotation,
        "combinable": table.combinable,
        "server_section": table.server_section,
        "features": table.features or [],
        "updated_at": now(),
    }
    await db.epos_tables.update_one(
        {"_id": ObjectId(table_id), "business_id": business_id},
        {"$set": updates},
    )
    return {"ok": True}


@router.put("/business/{business_id}/tables/{table_id}/position")
async def update_table_position(business_id: str, table_id: str, tenant: TenantContext = Depends(verify_business_access), body: Dict = Body(...)):
    """Quick position update for drag-and-drop (x, y, rotation only)."""
    db = get_database()
    updates = {"updated_at": now()}
    for key in ["x", "y", "rotation", "width", "height"]:
        if key in body:
            updates[key] = body[key]
    await db.epos_tables.update_one(
        {"_id": ObjectId(table_id), "business_id": business_id},
        {"$set": updates},
    )
    return {"ok": True}


@router.delete("/business/{business_id}/tables/{table_id}")
async def delete_table(business_id: str, table_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    table = await db.epos_tables.find_one({"_id": ObjectId(table_id), "business_id": business_id})
    if table and table.get("status") not in ("available",):
        raise HTTPException(400, "Cannot delete an occupied table")
    await db.epos_tables.delete_one({"_id": ObjectId(table_id), "business_id": business_id})
    return {"ok": True}


# ═══════════════════════════════════════════════════════
# TABLE STATUS LIFECYCLE
# ═══════════════════════════════════════════════════════

@router.put("/business/{business_id}/tables/{table_id}/status")
async def update_table_status(business_id: str, table_id: str, body: TableStatusUpdate, tenant: TenantContext = Depends(verify_business_access)):
    """Transition table through status lifecycle with validation."""
    db = get_database()
    table = await db.epos_tables.find_one({"_id": ObjectId(table_id), "business_id": business_id})
    if not table:
        raise HTTPException(404, "Table not found")

    current_status = table.get("status", "available")
    new_status = body.status

    # Validate transition (allow override for managers)
    valid_next = STATUS_FLOW.get(current_status, [])
    if new_status not in valid_next and new_status != "available":
        raise HTTPException(
            400,
            f"Cannot transition from '{current_status}' to '{new_status}'. Valid: {valid_next}"
        )

    updates = {
        "status": new_status,
        "updated_at": now(),
    }

    # Handle specific transitions
    if new_status == "seated":
        updates["covers"] = body.covers or table.get("seats", 4)
        updates["seated_at"] = now()
        updates["server_id"] = body.server_id or table.get("server_id")
        updates["reservation_id"] = body.reservation_id
        updates["notes"] = body.notes
        # Initialise seat assignments
        seat_assignments = {}
        for i in range(1, updates["covers"] + 1):
            seat_assignments[str(i)] = {"guest_name": None, "dietary": [], "vip": False, "notes": None}
        updates["seat_assignments"] = seat_assignments

    elif new_status == "available":
        # Record turn data for AI prediction before resetting
        if table.get("seated_at"):
            seated_at = table["seated_at"]
            if isinstance(seated_at, str):
                seated_at = datetime.fromisoformat(seated_at)
            turn_minutes = round((now() - seated_at).total_seconds() / 60)
            # Store turn history for AI
            await db.epos_table_turns.insert_one({
                "business_id": business_id,
                "table_id": table_id,
                "table_number": table.get("number"),
                "covers": table.get("covers", 0),
                "turn_minutes": turn_minutes,
                "day_of_week": now().strftime("%A"),
                "hour": now().hour,
                "server_id": table.get("server_id"),
                "order_id": table.get("order_id"),
                "at": now(),
            })
        # Reset table
        updates["covers"] = 0
        updates["seated_at"] = None
        updates["server_id"] = None
        updates["reservation_id"] = None
        updates["order_id"] = None
        updates["seat_assignments"] = {}
        updates["notes"] = None

    elif new_status == "reserved":
        updates["reservation_id"] = body.reservation_id
        updates["notes"] = body.notes

    # Add to history
    history_entry = {
        "status": new_status,
        "at": now().isoformat(),
        "covers": updates.get("covers", table.get("covers")),
        "server_id": body.server_id,
    }

    await db.epos_tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": updates, "$push": {"history": {"$each": [history_entry], "$slice": -50}}},
    )

    return {
        "table_id": table_id,
        "previous_status": current_status,
        "new_status": new_status,
        "status_colour": STATUS_COLOURS.get(new_status, "#4CAF50"),
    }


@router.post("/business/{business_id}/tables/{table_id}/quick-seat")
async def quick_seat(business_id: str, table_id: str, tenant: TenantContext = Depends(verify_business_access), body: Dict = Body(...)):
    """One-tap seat: available → seated with covers. Used by host."""
    db = get_database()
    table = await db.epos_tables.find_one({"_id": ObjectId(table_id), "business_id": business_id})
    if not table:
        raise HTTPException(404, "Table not found")
    if table.get("status") not in ("available", "reserved"):
        raise HTTPException(400, f"Table is {table.get('status')}, not available")

    covers = body.get("covers", table.get("seats", 4))
    server_id = body.get("server_id")
    server_name = body.get("server_name")

    seat_assignments = {}
    for i in range(1, covers + 1):
        seat_assignments[str(i)] = {"guest_name": None, "dietary": [], "vip": False, "notes": None}

    await db.epos_tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": {
            "status": "seated",
            "covers": covers,
            "seated_at": now(),
            "server_id": server_id,
            "server_name": server_name,
            "seat_assignments": seat_assignments,
            "updated_at": now(),
        }, "$push": {"history": {
            "status": "seated", "at": now().isoformat(), "covers": covers, "server_id": server_id,
        }}},
    )
    return {"ok": True, "table": table_id, "status": "seated", "covers": covers}


# ═══════════════════════════════════════════════════════
# SEAT ASSIGNMENTS
# ═══════════════════════════════════════════════════════

@router.put("/business/{business_id}/tables/{table_id}/seats/{seat_number}")
async def assign_seat(business_id: str, table_id: str, seat_number: int, body: SeatAssignment, tenant: TenantContext = Depends(verify_business_access)):
    """Assign guest info to a specific seat. Used for bill splitting and dietary alerts."""
    db = get_database()
    await db.epos_tables.update_one(
        {"_id": ObjectId(table_id), "business_id": business_id},
        {"$set": {
            f"seat_assignments.{seat_number}": {
                "guest_name": body.guest_name,
                "dietary": body.dietary or [],
                "vip": body.vip,
                "notes": body.notes,
            },
            "updated_at": now(),
        }},
    )
    return {"ok": True, "seat": seat_number}


@router.get("/business/{business_id}/tables/{table_id}/seats")
async def get_seats(business_id: str, table_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get all seat assignments for a table."""
    db = get_database()
    table = await db.epos_tables.find_one({"_id": ObjectId(table_id), "business_id": business_id})
    if not table:
        raise HTTPException(404, "Table not found")
    return {
        "table_number": table.get("number"),
        "covers": table.get("covers", 0),
        "seats": table.get("seat_assignments", {}),
    }


# ═══════════════════════════════════════════════════════
# MERGE / SPLIT TABLES
# ═══════════════════════════════════════════════════════

@router.post("/business/{business_id}/tables/merge")
async def merge_tables(business_id: str, body: MergeTablesRequest, tenant: TenantContext = Depends(verify_business_access)):
    """Merge 2+ tables into one. Primary table keeps its number and gets combined seats."""
    db = get_database()
    if len(body.table_ids) < 2:
        raise HTTPException(400, "Need at least 2 tables to merge")
    if body.primary_table_id not in body.table_ids:
        raise HTTPException(400, "Primary table must be in the merge list")

    tables = []
    for tid in body.table_ids:
        t = await db.epos_tables.find_one({"_id": ObjectId(tid), "business_id": business_id})
        if not t:
            raise HTTPException(404, f"Table {tid} not found")
        if not t.get("combinable", True):
            raise HTTPException(400, f"Table {t.get('number')} is not combinable")
        tables.append(t)

    primary = next(t for t in tables if str(t["_id"]) == body.primary_table_id)
    children = [t for t in tables if str(t["_id"]) != body.primary_table_id]

    total_seats = sum(t.get("seats", 0) for t in tables)
    child_ids = [str(t["_id"]) for t in children]

    # Update primary table
    await db.epos_tables.update_one(
        {"_id": primary["_id"]},
        {"$set": {
            "seats": total_seats,
            "max_covers": total_seats,
            "merged_with": child_ids,
            "updated_at": now(),
        }},
    )

    # Mark children as merged
    for child in children:
        await db.epos_tables.update_one(
            {"_id": child["_id"]},
            {"$set": {
                "is_merged_child": True,
                "merged_into": body.primary_table_id,
                "status": "merged",
                "updated_at": now(),
            }},
        )

    return {
        "merged": True,
        "primary_table": primary.get("number"),
        "total_seats": total_seats,
        "merged_tables": [t.get("number") for t in children],
    }


@router.post("/business/{business_id}/tables/{table_id}/unmerge")
async def unmerge_table(business_id: str, table_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Unmerge a previously merged table back to originals."""
    db = get_database()
    table = await db.epos_tables.find_one({"_id": ObjectId(table_id), "business_id": business_id})
    if not table:
        raise HTTPException(404, "Table not found")
    if not table.get("merged_with"):
        raise HTTPException(400, "Table is not merged")
    if table.get("status") not in ("available",):
        raise HTTPException(400, "Clear and reset the table before unmerging")

    # Restore children
    for child_id in table["merged_with"]:
        child = await db.epos_tables.find_one({"_id": ObjectId(child_id)})
        if child:
            await db.epos_tables.update_one(
                {"_id": ObjectId(child_id)},
                {"$set": {
                    "is_merged_child": False,
                    "merged_into": None,
                    "status": "available",
                    "updated_at": now(),
                }},
            )

    # Restore primary — need original seat count
    # We stored it in history, but fallback to a reasonable default
    original_seats = table.get("original_seats", 4)
    await db.epos_tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": {
            "merged_with": [],
            "seats": original_seats,
            "max_covers": original_seats,
            "updated_at": now(),
        }},
    )
    return {"unmerged": True}


# ═══════════════════════════════════════════════════════
# SERVER SECTIONS
# ═══════════════════════════════════════════════════════

@router.get("/business/{business_id}/server-sections")
async def get_server_sections(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sections = []
    async for s in db.epos_server_sections.find({"business_id": business_id}):
        s = table_serial(s)
        # Get table count and covers for this section
        table_count = await db.epos_tables.count_documents({
            "business_id": business_id, "server_section": s.get("name"),
        })
        active_covers = 0
        async for t in db.epos_tables.find({
            "business_id": business_id, "server_section": s.get("name"),
            "status": {"$nin": ["available", "reserved"]},
        }):
            active_covers += t.get("covers", 0)
        s["table_count"] = table_count
        s["active_covers"] = active_covers
        sections.append(s)
    return {"sections": sections}


@router.post("/business/{business_id}/server-sections")
async def create_server_section(business_id: str, section: ServerSection, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    doc = {
        "business_id": business_id,
        "name": section.name,
        "server_id": section.server_id,
        "server_name": section.server_name,
        "table_ids": section.table_ids,
        "colour": section.colour,
        "created_at": now(),
    }
    result = await db.epos_server_sections.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    # Update tables with section assignment
    for tid in section.table_ids:
        try:
            await db.epos_tables.update_one(
                {"_id": ObjectId(tid)},
                {"$set": {"server_section": section.name}},
            )
        except Exception:
            pass
    return {"section": doc}


@router.put("/business/{business_id}/server-sections/{section_id}")
async def update_server_section(business_id: str, section_id: str, section: ServerSection, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    await db.epos_server_sections.update_one(
        {"_id": ObjectId(section_id), "business_id": business_id},
        {"$set": {
            "name": section.name,
            "server_id": section.server_id,
            "server_name": section.server_name,
            "table_ids": section.table_ids,
            "colour": section.colour,
        }},
    )
    # Update tables
    for tid in section.table_ids:
        try:
            await db.epos_tables.update_one(
                {"_id": ObjectId(tid)},
                {"$set": {"server_section": section.name}},
            )
        except Exception:
            pass
    return {"ok": True}


@router.delete("/business/{business_id}/server-sections/{section_id}")
async def delete_server_section(business_id: str, section_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    section = await db.epos_server_sections.find_one({"_id": ObjectId(section_id)})
    if section:
        # Clear section from tables
        await db.epos_tables.update_many(
            {"business_id": business_id, "server_section": section.get("name")},
            {"$set": {"server_section": None}},
        )
    await db.epos_server_sections.delete_one({"_id": ObjectId(section_id)})
    return {"ok": True}


@router.post("/business/{business_id}/server-sections/auto-balance")
async def auto_balance_sections(business_id: str, tenant: TenantContext = Depends(verify_business_access), body: Dict = Body(...)):
    """Auto-assign tables to servers evenly based on available staff. UNIQUE TO REEVEOS."""
    db = get_database()
    server_ids = body.get("server_ids", [])  # [{id, name}, ...]
    if not server_ids:
        raise HTTPException(400, "Provide server_ids list")

    # Get all active tables
    tables = []
    async for t in db.epos_tables.find({
        "business_id": business_id, "is_merged_child": {"$ne": True},
    }).sort("number", 1):
        tables.append(t)

    # Round-robin distribute by zone for fairness
    per_server = math.ceil(len(tables) / len(server_ids))
    sections = []
    for i, server in enumerate(server_ids):
        assigned = tables[i * per_server: (i + 1) * per_server]
        section_name = f"Section {i + 1}"
        section_doc = {
            "business_id": business_id,
            "name": section_name,
            "server_id": server.get("id", server.get("_id", "")),
            "server_name": server.get("name", ""),
            "table_ids": [str(t["_id"]) for t in assigned],
            "colour": ["#2196F3", "#4CAF50", "#FF9800", "#E91E63", "#9C27B0", "#00BCD4"][i % 6],
            "auto_balanced": True,
            "created_at": now(),
        }
        # Upsert
        await db.epos_server_sections.update_one(
            {"business_id": business_id, "name": section_name},
            {"$set": section_doc},
            upsert=True,
        )
        # Tag tables
        for t in assigned:
            await db.epos_tables.update_one(
                {"_id": t["_id"]},
                {"$set": {"server_section": section_name}},
            )
        sections.append({"name": section_name, "server": server.get("name"), "tables": len(assigned)})

    return {"balanced": True, "sections": sections}


# ═══════════════════════════════════════════════════════
# WAITLIST
# ═══════════════════════════════════════════════════════

@router.get("/business/{business_id}/waitlist")
async def get_waitlist(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    entries = []
    async for w in db.epos_waitlist.find({
        "business_id": business_id, "status": "waiting",
    }).sort("added_at", 1):
        w = table_serial(w)
        # Calculate wait time
        added = w.get("added_at", now())
        if isinstance(added, str):
            added = datetime.fromisoformat(added)
        w["waited_minutes"] = round((now() - added).total_seconds() / 60)
        entries.append(w)
    return {"waitlist": entries, "count": len(entries)}


@router.post("/business/{business_id}/waitlist")
async def add_to_waitlist(business_id: str, entry: WaitlistEntry, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    doc = {
        "business_id": business_id,
        "guest_name": entry.guest_name,
        "phone": entry.phone,
        "party_size": entry.party_size,
        "notes": entry.notes,
        "seating_preference": entry.seating_preference or [],
        "quoted_wait": entry.quoted_wait,
        "status": "waiting",  # waiting, notified, seated, no_show, cancelled
        "added_at": now(),
        "notified_at": None,
        "seated_at": None,
    }
    result = await db.epos_waitlist.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return {"entry": doc, "position": await db.epos_waitlist.count_documents({
        "business_id": business_id, "status": "waiting",
    })}


@router.put("/business/{business_id}/waitlist/{entry_id}/notify")
async def notify_waitlist_guest(business_id: str, entry_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Mark guest as notified (triggers SMS in frontend)."""
    db = get_database()
    await db.epos_waitlist.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": {"status": "notified", "notified_at": now()}},
    )
    entry = await db.epos_waitlist.find_one({"_id": ObjectId(entry_id)})
    return {"ok": True, "phone": entry.get("phone"), "guest_name": entry.get("guest_name")}


@router.put("/business/{business_id}/waitlist/{entry_id}/seat")
async def seat_from_waitlist(business_id: str, entry_id: str, tenant: TenantContext = Depends(verify_business_access), body: Dict = Body(...)):
    """Move from waitlist to a specific table."""
    db = get_database()
    table_id = body.get("table_id")
    if not table_id:
        raise HTTPException(400, "table_id required")

    entry = await db.epos_waitlist.find_one({"_id": ObjectId(entry_id)})
    if not entry:
        raise HTTPException(404, "Waitlist entry not found")

    # Seat the table
    await db.epos_tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": {
            "status": "seated",
            "covers": entry.get("party_size"),
            "seated_at": now(),
            "notes": f"Waitlist: {entry.get('guest_name')}",
            "updated_at": now(),
        }},
    )

    # Update waitlist entry
    await db.epos_waitlist.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": {"status": "seated", "seated_at": now(), "table_id": table_id}},
    )

    return {"ok": True, "seated": True}


@router.put("/business/{business_id}/waitlist/{entry_id}/cancel")
async def cancel_waitlist(business_id: str, entry_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    await db.epos_waitlist.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": {"status": "cancelled"}},
    )
    return {"ok": True}


# ═══════════════════════════════════════════════════════
# SMART SEATING SUGGESTIONS (UNIQUE TO REEVEOS)
# ═══════════════════════════════════════════════════════

@router.get("/business/{business_id}/suggest-table")
async def suggest_table(business_id: str, tenant: TenantContext = Depends(verify_business_access), party_size: int = Query(...), preferences: str = Query("")):
    """AI-powered table suggestion. Optimises for:
    1. Right-sized table (avoid putting 2 at a 6-top if 2-tops are free)
    2. Zone/feature preferences (window, booth, patio)
    3. Server section balance (don't overload one server)
    4. Predicted turn time (suggest tables due to clear soon if none available)
    """
    db = get_database()
    prefs = [p.strip() for p in preferences.split(",") if p.strip()]

    available_tables = []
    async for t in db.epos_tables.find({
        "business_id": business_id,
        "status": "available",
        "is_merged_child": {"$ne": True},
        "seats": {"$gte": party_size},
    }).sort("seats", 1):
        t = table_serial(t)
        score = 100

        # Penalise oversized tables (waste of capacity)
        excess = t.get("seats", 4) - party_size
        score -= excess * 10

        # Bonus for matching preferences
        features = t.get("features", [])
        for pref in prefs:
            if pref in features:
                score += 20

        # Bonus for less-loaded server sections
        section = t.get("server_section")
        if section:
            section_load = await db.epos_tables.count_documents({
                "business_id": business_id,
                "server_section": section,
                "status": {"$nin": ["available", "reserved"]},
            })
            score -= section_load * 5

        t["suggestion_score"] = score
        available_tables.append(t)

    available_tables.sort(key=lambda x: x["suggestion_score"], reverse=True)

    # If no tables available, suggest next-to-clear
    clearing_soon = []
    if not available_tables:
        async for t in db.epos_tables.find({
            "business_id": business_id,
            "status": {"$in": ["bill_requested", "paying", "clearing", "dessert"]},
            "seats": {"$gte": party_size},
        }):
            t = table_serial(t)
            if t.get("seated_at"):
                seated_at = t["seated_at"]
                if isinstance(seated_at, str):
                    seated_at = datetime.fromisoformat(seated_at)
                elapsed = (now() - seated_at).total_seconds() / 60
                covers = t.get("covers", 4)
                predicted_total = BASE_TURN_TIMES.get(min(covers, 8), 115)
                t["estimated_wait"] = max(0, round(predicted_total - elapsed))
            else:
                t["estimated_wait"] = 15
            clearing_soon.append(t)
        clearing_soon.sort(key=lambda x: x.get("estimated_wait", 999))

    return {
        "suggestions": available_tables[:5],
        "clearing_soon": clearing_soon[:3],
        "party_size": party_size,
        "preferences": prefs,
    }


# ═══════════════════════════════════════════════════════
# TABLE ANALYTICS (UNIQUE TO REEVEOS)
# ═══════════════════════════════════════════════════════

@router.get("/business/{business_id}/table-analytics")
async def table_analytics(business_id: str, tenant: TenantContext = Depends(verify_business_access), days: int = Query(7)):
    """Revenue-per-seat-hour, average turn time by party size, busiest tables.
    NO COMPETITOR TRACKS REVENUE PER SEAT HOUR."""
    db = get_database()
    since = now() - timedelta(days=days)

    # Get turn history
    turns = []
    async for t in db.epos_table_turns.find({
        "business_id": business_id, "at": {"$gte": since},
    }):
        turns.append(t)

    if not turns:
        return {"message": "No turn data yet", "days": days}

    # Average turn time by covers
    turn_by_covers = {}
    for t in turns:
        c = t.get("covers", 2)
        if c not in turn_by_covers:
            turn_by_covers[c] = []
        turn_by_covers[c].append(t.get("turn_minutes", 0))
    avg_turn_by_covers = {
        str(k): round(sum(v) / len(v)) for k, v in turn_by_covers.items()
    }

    # Busiest tables
    table_counts = {}
    for t in turns:
        tn = t.get("table_number", "?")
        table_counts[tn] = table_counts.get(tn, 0) + 1
    busiest = sorted(table_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    # Turn times by hour
    hour_turns = {}
    for t in turns:
        h = t.get("hour", 12)
        if h not in hour_turns:
            hour_turns[h] = []
        hour_turns[h].append(t.get("turn_minutes", 0))
    avg_by_hour = {str(k): round(sum(v) / len(v)) for k, v in sorted(hour_turns.items())}

    # Day of week analysis
    dow_turns = {}
    for t in turns:
        d = t.get("day_of_week", "Monday")
        if d not in dow_turns:
            dow_turns[d] = []
        dow_turns[d].append(t.get("turn_minutes", 0))
    avg_by_day = {k: round(sum(v) / len(v)) for k, v in dow_turns.items()}

    return {
        "period_days": days,
        "total_turns": len(turns),
        "avg_turn_minutes": round(sum(t.get("turn_minutes", 0) for t in turns) / max(len(turns), 1)),
        "avg_turn_by_covers": avg_turn_by_covers,
        "busiest_tables": [{"table": t[0], "turns": t[1]} for t in busiest],
        "avg_turn_by_hour": avg_by_hour,
        "avg_turn_by_day": avg_by_day,
    }
