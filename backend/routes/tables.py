from fastapi import APIRouter, HTTPException, status, Depends
from database import get_database
from middleware.auth import get_current_owner
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

router = APIRouter(prefix="/tables", tags=["tables"])


class FloorPlanUpdate(BaseModel):
    """
    New format uses 'floors' — a list of floor objects each containing elements.
    Elements can be tables (with seats, status) or fixtures (windows, bar, stairs, etc).
    Legacy 'tables' field still accepted for backward compat.
    """
    floors: Optional[List[Dict[str, Any]]] = None
    tables: Optional[List[Dict[str, Any]]] = None  # Legacy
    width: float = 1000
    height: float = 800


@router.get("/business/{business_id}/floor-plan")
async def get_floor_plan(
    business_id: str,
    current_user: dict = Depends(get_current_owner)
):
    db = get_database()
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if business["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    floor_plan = business.get("floor_plan", {"floors": [], "width": 1000, "height": 800})

    # Migrate legacy format
    if "tables" in floor_plan and "floors" not in floor_plan:
        legacy_tables = floor_plan.get("tables", [])
        floor_plan = {
            "floors": [{"id": "main", "name": "Main Floor", "elements": [{**t, "type": "table"} for t in legacy_tables]}],
            "width": floor_plan.get("width", 1000),
            "height": floor_plan.get("height", 800),
        }
    return floor_plan


@router.put("/business/{business_id}/floor-plan")
async def update_floor_plan(
    business_id: str,
    floor_plan_data: FloorPlanUpdate,
    current_user: dict = Depends(get_current_owner)
):
    db = get_database()
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if business["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    data = floor_plan_data.model_dump(exclude_none=True)
    if "tables" in data and "floors" not in data:
        data["floors"] = [{"id": "main", "name": "Main Floor", "elements": [{**t, "type": "table"} for t in data.pop("tables")]}]
    elif "tables" in data:
        del data["tables"]

    await db.businesses.update_one(
        {"_id": business_id},
        {"$set": {"floor_plan": data, "updated_at": datetime.utcnow()}}
    )
    return data


@router.post("/business/{business_id}/floor-plan")
async def save_floor_plan(
    business_id: str,
    floor_plan_data: FloorPlanUpdate,
    current_user: dict = Depends(get_current_owner)
):
    return await update_floor_plan(business_id, floor_plan_data, current_user)


@router.delete("/business/{business_id}/tables/{table_id}")
async def delete_table(
    business_id: str,
    table_id: str,
    current_user: dict = Depends(get_current_owner)
):
    db = get_database()
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if business["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    floor_plan = business.get("floor_plan", {"floors": []})
    for floor in floor_plan.get("floors", []):
        floor["elements"] = [e for e in floor.get("elements", []) if e.get("id") != table_id]
    if "tables" in floor_plan:
        floor_plan["tables"] = [t for t in floor_plan["tables"] if t.get("id") != table_id]

    await db.businesses.update_one(
        {"_id": business_id},
        {"$set": {"floor_plan": floor_plan, "updated_at": datetime.utcnow()}}
    )
    return {"detail": "Table deleted successfully"}
