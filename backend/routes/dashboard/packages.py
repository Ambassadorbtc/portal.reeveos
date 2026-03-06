"""
Packages API — treatment course tracking.

'How many sessions do I have left?' — most asked question in clinic.

Collections:
  packages — {client_id, business_id, name, total_sessions, used_sessions,
               service_category, price, status, purchased_at, sessions[]}
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Body
from database import get_database
from middleware.tenant import verify_business_access, TenantContext
from bson import ObjectId
import random, string

router = APIRouter(prefix="/packages", tags=["packages"])


def _gen_id():
    return f"pkg_{''.join(random.choices(string.ascii_lowercase + string.digits, k=10))}"


# ─── GET all packages for a business ───
@router.get("/business/{business_id}")
async def list_packages(
    business_id: str,
    client_id: str = None,
    status: str = None,
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    query = {"business_id": business_id}
    if client_id:
        query["client_id"] = client_id
    if status:
        query["status"] = status

    cursor = db.packages.find(query).sort("purchased_at", -1)
    docs = await cursor.to_list(length=200)

    packages = []
    for p in docs:
        packages.append({
            "id": str(p["_id"]),
            "client_id": p.get("client_id"),
            "client_name": p.get("client_name", ""),
            "name": p.get("name", ""),
            "total_sessions": p.get("total_sessions", 0),
            "used_sessions": p.get("used_sessions", 0),
            "remaining": p.get("total_sessions", 0) - p.get("used_sessions", 0),
            "service_category": p.get("service_category", ""),
            "price": p.get("price", 0),
            "status": p.get("status", "active"),
            "purchased_at": p.get("purchased_at"),
            "sessions": p.get("sessions", []),
        })

    return {"packages": packages, "total": len(packages)}


# ─── GET packages for a specific client (used by calendar popover) ───
@router.get("/business/{business_id}/client/{client_id}")
async def get_client_packages(
    business_id: str,
    client_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    cursor = db.packages.find({
        "business_id": business_id,
        "client_id": client_id,
        "status": {"$in": ["active", "paused"]},
    }).sort("purchased_at", -1)
    docs = await cursor.to_list(length=50)

    packages = []
    for p in docs:
        total = p.get("total_sessions", 0)
        used = p.get("used_sessions", 0)
        packages.append({
            "id": str(p["_id"]),
            "name": p.get("name", ""),
            "total_sessions": total,
            "used_sessions": used,
            "remaining": total - used,
            "service_category": p.get("service_category", ""),
            "status": p.get("status", "active"),
        })

    return {"packages": packages}


# ─── CREATE a package ───
@router.post("/business/{business_id}")
async def create_package(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()

    client_id = payload.get("client_id")
    client_name = payload.get("client_name", "")
    name = payload.get("name", "").strip()
    total_sessions = int(payload.get("total_sessions", 0))
    service_category = payload.get("service_category", "")
    price = float(payload.get("price", 0))

    if not name or total_sessions < 1:
        raise HTTPException(400, "Package name and at least 1 session required")

    doc = {
        "_id": _gen_id(),
        "business_id": business_id,
        "client_id": client_id,
        "client_name": client_name,
        "name": name,
        "total_sessions": total_sessions,
        "used_sessions": 0,
        "service_category": service_category,
        "price": price,
        "status": "active",
        "purchased_at": datetime.utcnow(),
        "sessions": [],
        "created_at": datetime.utcnow(),
    }

    await db.packages.insert_one(doc)

    return {
        "id": doc["_id"],
        "name": name,
        "total_sessions": total_sessions,
        "remaining": total_sessions,
        "message": "Package created",
    }


# ─── USE a session (mark one used) ───
@router.post("/business/{business_id}/{package_id}/use")
async def use_session(
    business_id: str,
    package_id: str,
    payload: dict = Body({}),
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    pkg = await db.packages.find_one({"_id": package_id, "business_id": business_id})
    if not pkg:
        raise HTTPException(404, "Package not found")

    if pkg.get("status") != "active":
        raise HTTPException(400, "Package is not active")

    total = pkg.get("total_sessions", 0)
    used = pkg.get("used_sessions", 0)

    if used >= total:
        raise HTTPException(400, "All sessions have been used")

    session_record = {
        "date": payload.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
        "service": payload.get("service", ""),
        "staff": payload.get("staff", ""),
        "notes": payload.get("notes", ""),
        "used_at": datetime.utcnow(),
    }

    new_used = used + 1
    new_status = "completed" if new_used >= total else "active"

    await db.packages.update_one(
        {"_id": package_id},
        {
            "$inc": {"used_sessions": 1},
            "$push": {"sessions": session_record},
            "$set": {"status": new_status, "updated_at": datetime.utcnow()},
        },
    )

    return {
        "id": package_id,
        "used_sessions": new_used,
        "remaining": total - new_used,
        "status": new_status,
        "message": f"Session {new_used} of {total} recorded",
    }
