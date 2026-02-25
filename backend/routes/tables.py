from fastapi import APIRouter, HTTPException, status, Depends
from database import get_database
from middleware.auth import get_current_owner
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

router = APIRouter(prefix="/tables", tags=["tables"])


class FloorPlanUpdate(BaseModel):
    """Supports both legacy 'tables' and new 'elements' (tables + fixtures)."""
    elements: Optional[List[Dict[str, Any]]] = None
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

    floor_plan = business.get("floor_plan", {"elements": [], "width": 1000, "height": 800})

    # Migrate legacy format: if only 'tables', convert to 'elements'
    if "tables" in floor_plan and "elements" not in floor_plan:
        floor_plan["elements"] = [{**t, "type": "table"} for t in floor_plan.get("tables", [])]

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

    # If legacy 'tables' sent without 'elements', migrate
    if "tables" in data and "elements" not in data:
        data["elements"] = [{**t, "type": "table"} for t in data.pop("tables")]
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

    floor_plan = business.get("floor_plan", {"elements": []})
    floor_plan["elements"] = [e for e in floor_plan.get("elements", []) if e.get("id") != table_id]
    # Legacy support
    if "tables" in floor_plan:
        floor_plan["tables"] = [t for t in floor_plan["tables"] if t.get("id") != table_id]

    await db.businesses.update_one(
        {"_id": business_id},
        {"$set": {"floor_plan": floor_plan, "updated_at": datetime.utcnow()}}
    )
    return {"detail": "Element deleted successfully"}
