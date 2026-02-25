from fastapi import APIRouter, HTTPException, status, Depends
from database import get_database
from middleware.auth import get_current_owner
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId


async def find_business(db, business_id: str, owner_id: str):
    """Find business by ID (handles both string and ObjectId), verify ownership."""
    biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        try:
            biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
        except Exception:
            pass
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    if biz.get("owner_id") != owner_id and str(biz.get("owner_id")) != owner_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return biz

router = APIRouter(prefix="/tables", tags=["tables"])


class FloorPlanUpdate(BaseModel):
    elements: Optional[List[Dict[str, Any]]] = None
    tables: Optional[List[Dict[str, Any]]] = None
    floors: Optional[List[Dict[str, Any]]] = None
    width: Optional[float] = 1000
    height: Optional[float] = 800


class AutoArrangeRequest(BaseModel):
    elements: List[Dict[str, Any]]
    width: float = 1000
    height: float = 800
    zone: Optional[str] = None
    style: str = "balanced"  # balanced, dense, spacious, grid


class ValidateRequest(BaseModel):
    elements: List[Dict[str, Any]]
    width: float = 1000
    height: float = 800
    min_gap: float = 60


class GenerateRequest(BaseModel):
    description: Dict[str, Any]  # Structured layout description
    width: float = 1000
    height: float = 800
    zone: str = "main"


class TextGenerateRequest(BaseModel):
    prompt: str  # Natural language: "12 tables, bar on the left..."
    width: float = 1000
    height: float = 800
    zone: str = "main"


@router.get("/business/{business_id}/floor-plan")
async def get_floor_plan(
    business_id: str,
    current_user: dict = Depends(get_current_owner)
):
    db = get_database()
    business = await find_business(db, business_id, str(current_user["_id"]))

    fp = business.get("floor_plan") or {}

    # Already has elements? Return as-is
    if "elements" in fp and fp["elements"]:
        return {"elements": fp["elements"], "width": fp.get("width", 1000), "height": fp.get("height", 800)}

    # Migrate from legacy 'tables' format
    if "tables" in fp and fp["tables"]:
        return {"elements": [{**t, "type": "table"} for t in fp["tables"]], "width": fp.get("width", 1000), "height": fp.get("height", 800)}

    # Migrate from 'floors' format (from the reverted rebuild)
    if "floors" in fp and fp["floors"]:
        all_elements = []
        for floor in fp["floors"]:
            zone_id = floor.get("id", "main")
            for el in floor.get("elements", []):
                all_elements.append({**el, "zone": zone_id, "type": el.get("type", "table")})
        return {"elements": all_elements, "width": fp.get("width", 1000), "height": fp.get("height", 800)}

    # Empty
    return {"elements": [], "width": 1000, "height": 800}


@router.put("/business/{business_id}/floor-plan")
async def update_floor_plan(
    business_id: str,
    floor_plan_data: FloorPlanUpdate,
    current_user: dict = Depends(get_current_owner)
):
    db = get_database()
    business = await find_business(db, business_id, str(current_user["_id"]))

    data = floor_plan_data.model_dump(exclude_none=True)

    # Normalise: always store as {elements, width, height}
    if "tables" in data and "elements" not in data:
        data["elements"] = [{**t, "type": "table"} for t in data.pop("tables")]
    if "tables" in data:
        del data["tables"]
    if "floors" in data:
        del data["floors"]

    store = {"elements": data.get("elements", []), "width": data.get("width", 1000), "height": data.get("height", 800)}

    await db.businesses.update_one(
        {"_id": business_id},
        {"$set": {"floor_plan": store, "updated_at": datetime.utcnow()}}
    )
    return store


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
    business = await find_business(db, business_id, str(current_user["_id"]))

    fp = business.get("floor_plan") or {}
    if "elements" in fp:
        fp["elements"] = [e for e in fp["elements"] if e.get("id") != table_id]
    if "tables" in fp:
        fp["tables"] = [t for t in fp["tables"] if t.get("id") != table_id]

    await db.businesses.update_one(
        {"_id": business_id},
        {"$set": {"floor_plan": fp, "updated_at": datetime.utcnow()}}
    )
    return {"detail": "Element deleted"}


# ═══════════════ AI FLOOR PLAN SOLVER ENDPOINTS ═══════════════

from services.floor_plan_solver import auto_arrange, validate_layout, generate_from_description


@router.post("/business/{business_id}/auto-arrange")
async def auto_arrange_floor_plan(
    business_id: str,
    request: AutoArrangeRequest,
    current_user: dict = Depends(get_current_owner)
):
    """
    AI auto-arrange: uses LLM spatial reasoning (Claude/Grok/GPT-4o) to
    read the room and place tables like a real designer, then enforces
    physics constraints. Falls back to rule-based solver if no API key.
    """
    db = get_database()
    business = await find_business(db, business_id, str(current_user["_id"]))

    try:
        # Try AI-powered arrange first
        from services.ai_floor_plan import ai_auto_arrange, has_ai_key
        if has_ai_key():
            result = await ai_auto_arrange(
                request.elements,
                canvas_w=request.width,
                canvas_h=request.height,
                zone=request.zone,
                style=request.style,
            )
            return {
                "elements": result["elements"],
                "validation": result["validation"],
                "width": request.width,
                "height": request.height,
                "ai": True,
                "provider": result.get("provider"),
                "model": result.get("model"),
            }
    except Exception as ai_err:
        import traceback
        traceback.print_exc()
        print(f"[FloorPlan] AI arrange failed ({ai_err}), falling back to rule-based solver")

    # Fallback: rule-based solver
    try:
        arranged = auto_arrange(
            request.elements,
            canvas_w=request.width,
            canvas_h=request.height,
            zone=request.zone,
            style=request.style
        )

        validation = validate_layout(arranged, request.width, request.height)

        return {
            "elements": arranged,
            "validation": validation,
            "width": request.width,
            "height": request.height,
            "ai": False,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Auto-arrange failed: {str(e)}")


@router.post("/business/{business_id}/validate-layout")
async def validate_floor_plan(
    business_id: str,
    request: ValidateRequest,
    current_user: dict = Depends(get_current_owner)
):
    """
    Validate current layout: check for overlaps, spacing violations,
    ADA compliance issues, and return actionable feedback.
    """
    db = get_database()
    business = await find_business(db, business_id, str(current_user["_id"]))

    result = validate_layout(
        request.elements,
        canvas_w=request.width,
        canvas_h=request.height,
        min_gap=request.min_gap
    )
    return result


@router.post("/business/{business_id}/generate-layout")
async def generate_floor_plan(
    business_id: str,
    request: GenerateRequest,
    current_user: dict = Depends(get_current_owner)
):
    """
    Generate a complete floor plan from a structured description.

    Input:
    {
        "description": {
            "tables": [{"shape": "round", "seats": 4, "count": 6}],
            "fixtures": [{"type": "bar", "position": "left"}],
            "style": "balanced"
        }
    }
    """
    db = get_database()
    business = await find_business(db, business_id, str(current_user["_id"]))

    elements = generate_from_description(
        request.description,
        canvas_w=request.width,
        canvas_h=request.height,
        zone=request.zone
    )

    validation = validate_layout(elements, request.width, request.height)

    return {
        "elements": elements,
        "validation": validation,
        "width": request.width,
        "height": request.height
    }
