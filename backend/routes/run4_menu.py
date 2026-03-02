"""
Run 4: Menu items API (restaurants) — CRUD, categories, 86 toggle
Stored in business.menu + business.categories
"""

from fastapi import APIRouter, HTTPException, Depends, Body
from database import get_database
from middleware.tenant_db import get_scoped_db
from middleware.auth import get_current_staff
from middleware.tenant import verify_business_access, TenantContext
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/menu", tags=["menu"])

DIETARY = ["v", "ve", "gf", "df", "nf", "h"]


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
    return f"menu_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"


@router.get("/business/{business_id}")
async def get_menu_grouped(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    menu = business.get("menu", [])
    categories_raw = business.get("categories", [])

    by_cat = {}
    for m in menu:
        if not m.get("active", True):
            continue
        cid = m.get("categoryId") or m.get("category") or "General"
        if cid not in by_cat:
            by_cat[cid] = []
        by_cat[cid].append({
            "id": m.get("id"),
            "name": m.get("name"),
            "description": m.get("description"),
            "price": int((m.get("price", 0) or 0) * 100),
            "image": m.get("image"),
            "dietary": m.get("dietary", []),
            "prepTime": m.get("prepTime", 15),
            "available": not m.get("is86d", False),
            "is86d": m.get("is86d", False),
            "sortOrder": m.get("sortOrder", 0),
        })

    cat_map = {c.get("id"): c for c in categories_raw}
    cat_order = sorted(categories_raw, key=lambda x: x.get("sortOrder", 0))
    categories = []
    for c in cat_order:
        cid = c.get("id")
        items = sorted(by_cat.get(cid, []), key=lambda x: x.get("sortOrder", 0))
        categories.append({"id": cid, "name": c.get("name"), "sortOrder": c.get("sortOrder", 0), "items": items})
        by_cat.pop(cid, None)
    for cid, items in by_cat.items():
        categories.append({"id": cid, "name": cat_map.get(cid, {}).get("name", cid), "sortOrder": 999, "items": sorted(items, key=lambda x: x.get("sortOrder", 0))})

    return {"categories": categories}


@router.post("/business/{business_id}")
async def create_menu_item(business_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    name = (payload.get("name") or "").strip()
    if len(name) < 2 or len(name) > 100:
        raise HTTPException(400, "Name must be 2-100 chars")
    price = int((payload.get("price", 0) or 0) * 100)
    price = max(0, price)

    menu = business.get("menu", [])
    cat_name = next((c.get("name") for c in business.get("categories", []) if c.get("id") == payload.get("categoryId")), "General")
    item = {
        "id": _gen_id(),
        "name": name,
        "categoryId": payload.get("categoryId"),
        "category": cat_name,
        "description": (payload.get("description") or "")[:200],
        "price": price / 100,
        "image": payload.get("image"),
        "dietary": [d for d in (payload.get("dietary") or []) if d in DIETARY],
        "prepTime": payload.get("prepTime", 15) or 15,
        "available": True,
        "is86d": False,
        "active": True,
        "sortOrder": len(menu),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    menu.append(item)
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"menu": menu, "updated_at": datetime.utcnow()}},
    )
    item["price"] = price
    return item


@router.put("/business/{business_id}/{item_id}")
async def update_menu_item(business_id: str, item_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    menu = business.get("menu", [])
    idx = next((i for i, m in enumerate(menu) if m.get("id") == item_id), None)
    if idx is None:
        raise HTTPException(404, "Menu item not found")

    m = menu[idx]
    if "name" in payload:
        m["name"] = (payload["name"] or "").strip()[:100]
    if "categoryId" in payload:
        cat_name = next((c.get("name") for c in business.get("categories", []) if c.get("id") == payload["categoryId"]), "General")
        m["categoryId"] = payload["categoryId"]
        m["category"] = cat_name
    if "description" in payload:
        m["description"] = (payload["description"] or "")[:200]
    if "price" in payload:
        m["price"] = max(0, float(payload["price"]))
    if "image" in payload:
        m["image"] = payload["image"]
    if "dietary" in payload:
        m["dietary"] = [d for d in payload["dietary"] if d in DIETARY]
    if "prepTime" in payload:
        m["prepTime"] = max(5, min(30, int(payload["prepTime"]) or 15))
    m["updatedAt"] = datetime.utcnow()
    menu[idx] = m
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"menu": menu, "updated_at": datetime.utcnow()}},
    )
    return m


@router.delete("/business/{business_id}/{item_id}")
async def delete_menu_item(business_id: str, item_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    menu = business.get("menu", [])
    idx = next((i for i, m in enumerate(menu) if m.get("id") == item_id), None)
    if idx is None:
        raise HTTPException(404, "Menu item not found")
    menu[idx]["active"] = False
    menu[idx]["updatedAt"] = datetime.utcnow()
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"menu": menu, "updated_at": datetime.utcnow()}},
    )
    return {"detail": "Deleted"}


@router.patch("/business/{business_id}/{item_id}/86")
async def toggle_86(business_id: str, item_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    """One-tap 86 toggle — critical for kitchen."""
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    menu = business.get("menu", [])
    idx = next((i for i, m in enumerate(menu) if m.get("id") == item_id), None)
    if idx is None:
        raise HTTPException(404, "Menu item not found")
    menu[idx]["is86d"] = bool(payload.get("is86d", not menu[idx].get("is86d", False)))
    menu[idx]["available"] = not menu[idx]["is86d"]
    menu[idx]["updatedAt"] = datetime.utcnow()
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"menu": menu, "updated_at": datetime.utcnow()}},
    )
    return {"is86d": menu[idx]["is86d"]}


@router.put("/business/{business_id}/reorder")
async def reorder_menu(business_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    category_id = payload.get("categoryId")
    ids = payload.get("serviceIds", []) or payload.get("itemIds", [])
    menu = business.get("menu", [])
    for i, sid in enumerate(ids):
        for m in menu:
            if m.get("id") == sid:
                m["sortOrder"] = i
                if category_id:
                    m["categoryId"] = category_id
                    m["category"] = category_id
                break
    await db.businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {"menu": menu, "updated_at": datetime.utcnow()}},
    )
    return {"detail": "Reordered"}
