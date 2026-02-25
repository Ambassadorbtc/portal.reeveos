from fastapi import APIRouter, HTTPException, status, Depends
from database import get_database
from middleware.auth import get_current_owner
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

router = APIRouter(prefix="/tables", tags=["tables"])


class TableCreate(BaseModel):
    name: str
    capacity: int
    x: float
    y: float
    width: float
    height: float
    shape: str = "rectangle"


class TableUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    shape: Optional[str] = None


class FloorPlanUpdate(BaseModel):
    tables: List[Dict[str, Any]]
    width: float
    height: float


@router.post("/business/{business_id}/tables")
async def add_table(
    business_id: str,
    table_data: TableCreate,
    current_user: dict = Depends(get_current_owner)
):
    db = get_database()
    
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    if business["owner_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    if business.get("tier") != "venue":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Table management only available for venue tier"
        )
    
    table_dict = table_data.model_dump()
    table_dict["id"] = f"table_{datetime.utcnow().timestamp()}"
    table_dict["created_at"] = datetime.utcnow()
    
    floor_plan = business.get("floor_plan", {"tables": [], "width": 1000, "height": 800})
    floor_plan["tables"].append(table_dict)
    
    await db.businesses.update_one(
        {"_id": business_id},
        {"$set": {"floor_plan": floor_plan, "updated_at": datetime.utcnow()}}
    )
    
    return table_dict


@router.get("/business/{business_id}/floor-plan")
async def get_floor_plan(
    business_id: str,
    current_user: dict = Depends(get_current_owner)
):
    db = get_database()
    
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    if business["owner_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    floor_plan = business.get("floor_plan", {"tables": [], "width": 1000, "height": 800})
    
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    if business["owner_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    floor_plan = floor_plan_data.model_dump()
    
    await db.businesses.update_one(
        {"_id": business_id},
        {"$set": {"floor_plan": floor_plan, "updated_at": datetime.utcnow()}}
    )
    
    return floor_plan


@router.post("/business/{business_id}/floor-plan")
async def save_floor_plan(
    business_id: str,
    floor_plan_data: FloorPlanUpdate,
    current_user: dict = Depends(get_current_owner)
):
    """POST alias for floor plan save (same as PUT)"""
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    if business["owner_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    floor_plan = business.get("floor_plan", {"tables": []})
    floor_plan["tables"] = [t for t in floor_plan["tables"] if t.get("id") != table_id]
    
    await db.businesses.update_one(
        {"_id": business_id},
        {"$set": {"floor_plan": floor_plan, "updated_at": datetime.utcnow()}}
    )
    
    return {"detail": "Table deleted successfully"}
