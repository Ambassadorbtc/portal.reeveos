"""
Run 4: Services management API — CRUD, categories, reorder
Stored in business.menu + business.categories for backward compat with Run 2
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from database import get_database
from middleware.tenant_db import get_scoped_db
from middleware.auth import get_current_staff
from middleware.tenant import verify_business_access, TenantContext
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/services-v2", tags=["services-v2"])


async def _get_business(db, business_id: str, user: dict):
    try:
        b = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        b = await db.businesses.find_one({"_id": business_id})
    if not b:
        raise HTTPException(404, "Business not found")
    owner = str(b.get("owner_id", ""))
    uid = str(user.get("_id", ""))
    if owner and owner != uid and str(user.get("role", "")).lower() not in ("staff", "admin", "owner"):
        raise HTTPException(403, "Not authorized")
    return b


def _gen_id():
    return f"svc_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"


def _cat_id():
    return f"cat_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"


@router.get("/business/{business_id}")
async def get_services_grouped(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Run 4: Services grouped by category."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    menu = business.get("menu", [])
    categories_raw = business.get("categories", [])
    staff_list = business.get("staff", [])

    # Build category map
    cat_map = {c.get("id"): c for c in categories_raw}
    cat_order = sorted(categories_raw, key=lambda x: x.get("sortOrder", 0))

    # Group services by category
    by_cat = {}
    for s in menu:
        if not s.get("active", True):
            continue
        cid = s.get("categoryId") or s.get("category") or "General"
        if cid not in by_cat:
            by_cat[cid] = []
        staff_names = []
        for sid in (s.get("staffIds") or []):
            st = next((x for x in staff_list if x.get("id") == sid), None)
            if st:
                staff_names.append(st.get("name", ""))
        by_cat[cid].append({
            "id": s.get("id"),
            "name": s.get("name"),
            "description": s.get("description"),
            "duration": s.get("duration_minutes", 60),
            "price": int((s.get("price", 0) or 0) * 100),
            "staffIds": s.get("staffIds", []),
            "staffNames": staff_names,
            "online": s.get("online", True),
            "active": s.get("active", True),
            "sortOrder": s.get("sortOrder", 0),
        })

    categories = []
    for c in cat_order:
        cid = c.get("id")
        services = sorted(by_cat.get(cid, []), key=lambda x: x.get("sortOrder", 0))
        categories.append({
            "id": cid,
            "name": c.get("name"),
            "sortOrder": c.get("sortOrder", 0),
            "services": services,
        })
        by_cat.pop(cid, None)
    for cid, svcs in by_cat.items():
        categories.append({
            "id": cid,
            "name": cat_map.get(cid, {}).get("name", cid),
            "sortOrder": 999,
            "services": sorted(svcs, key=lambda x: x.get("sortOrder", 0)),
        })

    return {"categories": categories}


@router.post("/business/{business_id}")
async def create_service(business_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    name = (payload.get("name") or "").strip()
    if len(name) < 2 or len(name) > 100:
        raise HTTPException(400, "Name must be 2-100 chars")
    duration = payload.get("duration", 60)
    if duration not in [15, 30, 45, 60, 90, 120, 150, 180, 240]:
        duration = max(15, min(480, ((duration + 7) // 15) * 15))
    price_raw = float(payload.get("price", 0) or 0)
    price = max(0, int(round(price_raw * 100)))

    menu = business.get("menu", [])
    for s in menu:
        if s.get("name", "").strip().lower() == name.lower():
            raise HTTPException(400, "Service name already exists")

    cat_name = next((c.get("name") for c in business.get("categories", []) if c.get("id") == payload.get("categoryId")), "General")
    svc = {
        "id": _gen_id(),
        "name": name,
        "categoryId": payload.get("categoryId"),
        "category": cat_name,
        "description": (payload.get("description") or "")[:200],
        "duration_minutes": duration,
        "price": price / 100.0,
        "staffIds": payload.get("staffIds") or [],
        "online": payload.get("online", True),
        "active": True,
        "sortOrder": len(menu),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    menu.append(svc)
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"menu": menu, "updated_at": datetime.utcnow()}},
    )
    return svc


@router.put("/business/{business_id}/{service_id}")
async def update_service(business_id: str, service_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    menu = business.get("menu", [])
    idx = next((i for i, s in enumerate(menu) if s.get("id") == service_id), None)
    if idx is None:
        raise HTTPException(404, "Service not found")

    s = menu[idx]
    if "name" in payload:
        s["name"] = (payload["name"] or "").strip()[:100]
    if "categoryId" in payload:
        cat_name = next((c.get("name") for c in business.get("categories", []) if c.get("id") == payload["categoryId"]), "General")
        s["categoryId"] = payload["categoryId"]
        s["category"] = cat_name
    if "description" in payload:
        s["description"] = (payload["description"] or "")[:200]
    if "duration" in payload:
        s["duration_minutes"] = max(15, min(480, int(payload["duration"])))
    if "price" in payload:
        s["price"] = max(0, float(payload["price"]))
    if "staffIds" in payload:
        s["staffIds"] = payload["staffIds"]
    if "online" in payload:
        s["online"] = bool(payload["online"])
    s["updatedAt"] = datetime.utcnow()
    menu[idx] = s
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"menu": menu, "updated_at": datetime.utcnow()}},
    )
    return s


@router.delete("/business/{business_id}/{service_id}")
async def delete_service(
    business_id: str, service_id: str,
    confirm: bool = Query(False),
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    menu = business.get("menu", [])
    idx = next((i for i, s in enumerate(menu) if s.get("id") == service_id), None)
    if idx is None:
        raise HTTPException(404, "Service not found")

    future = 0
    if hasattr(db, "bookings"):
        future = await sdb.bookings.count_documents({
            "businessId": str(business["_id"]),
            "date": {"$gte": datetime.utcnow().strftime("%Y-%m-%d")},
            "status": {"$nin": ["cancelled"]},
            "$or": [{"service.id": service_id}, {"serviceId": service_id}],
        })

    if not confirm and future > 0:
        return {"warning": f"This service has {future} upcoming bookings.", "futureBookings": future}

    menu[idx]["active"] = False
    menu[idx]["updatedAt"] = datetime.utcnow()
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"menu": menu, "updated_at": datetime.utcnow()}},
    )
    return {"detail": "Service deleted"}


@router.put("/business/{business_id}/reorder")
async def reorder_services(business_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    category_id = payload.get("categoryId")
    ids = payload.get("serviceIds", [])
    menu = business.get("menu", [])
    for i, sid in enumerate(ids):
        for s in menu:
            if s.get("id") == sid:
                s["sortOrder"] = i
                if category_id:
                    s["categoryId"] = category_id
                break
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"menu": menu, "updated_at": datetime.utcnow()}},
    )
    return {"detail": "Reordered"}


@router.patch("/business/{business_id}/{service_id}/toggle")
async def toggle_online(business_id: str, service_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    menu = business.get("menu", [])
    idx = next((i for i, s in enumerate(menu) if s.get("id") == service_id), None)
    if idx is None:
        raise HTTPException(404, "Service not found")
    menu[idx]["online"] = bool(payload.get("online", not menu[idx].get("online", True)))
    menu[idx]["updatedAt"] = datetime.utcnow()
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"menu": menu, "updated_at": datetime.utcnow()}},
    )
    return {"online": menu[idx]["online"]}


# --- Categories ---

@router.get("/categories/business/{business_id}")
async def get_categories(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    return {"categories": business.get("categories", [])}


@router.post("/categories/business/{business_id}")
async def create_category(business_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    name = (payload.get("name") or "").strip()
    if len(name) < 2 or len(name) > 50:
        raise HTTPException(400, "Name must be 2-50 chars")
    cats = business.get("categories", [])
    for c in cats:
        if c.get("name", "").lower() == name.lower():
            raise HTTPException(400, "Category already exists")
    cat = {"id": _cat_id(), "name": name, "sortOrder": len(cats), "active": True}
    cats.append(cat)
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"categories": cats, "updated_at": datetime.utcnow()}},
    )
    return cat


@router.put("/categories/business/{business_id}/{category_id}")
async def update_category(business_id: str, category_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    cats = business.get("categories", [])
    idx = next((i for i, c in enumerate(cats) if c.get("id") == category_id), None)
    if idx is None:
        raise HTTPException(404, "Category not found")
    cats[idx]["name"] = (payload.get("name") or cats[idx]["name"])[:50]
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"categories": cats, "updated_at": datetime.utcnow()}},
    )
    return cats[idx]


@router.delete("/categories/business/{business_id}/{category_id}")
async def delete_category(business_id: str, category_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    menu = business.get("menu", [])
    active_in_cat = sum(1 for s in menu if (s.get("categoryId") or s.get("category")) == category_id and s.get("active", True))
    if active_in_cat > 0:
        raise HTTPException(400, f"Category has {active_in_cat} active services. Move or delete them first.")
    cats = [c for c in business.get("categories", []) if c.get("id") != category_id]
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"categories": cats, "updated_at": datetime.utcnow()}},
    )
    return {"detail": "Deleted"}
