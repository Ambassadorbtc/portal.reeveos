"""
Run 7: Clients CRM — client list, profiles, tags, notes, import/export
Data in clients collection. Stats computed from bookings.
"""

import csv
import io
import re
from datetime import datetime, date, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query, Body, UploadFile, File
from fastapi.responses import StreamingResponse
from database import get_database
from middleware.tenant_db import get_scoped_db
from middleware.auth import get_current_owner
from middleware.tenant import verify_business_access, TenantContext
from bson import ObjectId

router = APIRouter(prefix="/clients-v2", tags=["clients-v2"])


async def _get_business(db, business_id: str, user: dict):
    try:
        b = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        b = await db.businesses.find_one({"_id": business_id})
    if not b:
        raise HTTPException(404, "Business not found")
    if str(b.get("owner_id", "")) != str(user.get("_id", "")) and str(user.get("role", "")).lower() not in ("admin",):
        raise HTTPException(403, "Not authorized")
    return b


def _normalize_email(e):
    return (e or "").strip().lower() if e else ""


def _normalize_phone(p):
    return re.sub(r"\D", "", str(p or ""))[-10:] if p else ""


def _client_id():
    return f"cli_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"


async def _get_client_stats(db, biz_id: str, client_id: str, client: dict = None):
    match = {"businessId": biz_id, "status": {"$nin": ["cancelled"]}}
    if client_id:
        email = (client.get("email") or "").strip().lower() if client else ""
        phone = _normalize_phone(client.get("phone")) if client else ""
        ors = [{"customerId": client_id}]
        if email:
            ors.append({"customer.email": {"$regex": re.escape(email), "$options": "i"}})
        if phone:
            dig = phone[-10:] if len(phone) >= 10 else phone
            ors.append({"customer.phone": {"$regex": r"[0-9]*" + re.escape(dig) + r"[0-9]*"}})
        if len(ors) > 1:
            match["$or"] = ors
        else:
            match["customerId"] = client_id
    cursor = db.bookings.find(match).sort("date", -1).sort("time", -1)
    bookings = await cursor.to_list(length=500)
    completed = [b for b in bookings if b.get("status") == "completed"]
    no_shows = [b for b in bookings if b.get("status") == "no_show"]
    canc_match = {"businessId": biz_id, "status": "cancelled"}
    if client_id and client:
        ors = [{"customerId": client_id}]
        if (client.get("email") or "").strip():
            ors.append({"customer.email": {"$regex": re.escape((client.get("email") or "").strip().lower()), "$options": "i"}})
        if _normalize_phone(client.get("phone")):
            dig = _normalize_phone(client.get("phone"))[-10:]
            ors.append({"customer.phone": {"$regex": dig}})
        canc_match["$or"] = ors
    elif client_id:
        canc_match["customerId"] = client_id
    cancelled = [b for b in await db.bookings.find(canc_match).to_list(length=100)]
    total_spent = 0
    for b in completed:
        svc = b.get("service") or {}
        p = svc.get("price", 0)
        if isinstance(p, (int, float)):
            total_spent += int(p) if p >= 100 or p == 0 else int(p * 100)
    dates = [b.get("date") for b in bookings if b.get("date")]
    last_visit = max(dates) if dates else None
    first_visit = min(dates) if dates else None
    return {
        "totalBookings": len(completed),
        "totalSpent": total_spent,
        "lastVisit": last_visit,
        "firstVisit": first_visit,
        "noShows": len(no_shows),
        "cancellations": len(cancelled),
        "averageSpend": total_spent // len(completed) if completed else 0,
    }


def _segment_filter(segment: str, now: date):
    if segment == "new":
        cutoff = (now - timedelta(days=30)).isoformat()
        return {"stats.firstVisit": {"$gte": cutoff}}
    if segment == "returning":
        return {"stats.totalBookings": {"$gte": 2}}
    if segment == "inactive":
        cutoff_60 = (now - timedelta(days=60)).isoformat()
        cutoff_90 = (now - timedelta(days=90)).isoformat()
        return {"stats.lastVisit": {"$gte": cutoff_90, "$lt": cutoff_60}}
    if segment == "at_risk":
        cutoff = (now - timedelta(days=90)).isoformat()
        return {"$or": [{"stats.lastVisit": {"$lt": cutoff}}, {"stats.lastVisit": None}]}
    return {}


@router.get("/business/{business_id}")
async def list_clients(
    business_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    tag: str = Query(""),
    sort: str = Query("last_visit_desc"),
    segment: str = Query("all"),
    tenant: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    biz_id = str(business["_id"])

    match = {"businessId": biz_id, "active": {"$ne": False}}
    if tag:
        match["tags"] = tag
    if search:
        s = search.strip()
        if s:
            match["$or"] = [
                {"name": {"$regex": s, "$options": "i"}},
                {"email": {"$regex": s, "$options": "i"}},
                {"phone": {"$regex": re.escape(s)}},
            ]

    if segment != "all":
        seg_f = _segment_filter(segment, date.today())
        if seg_f:
            match.update(seg_f)

    sort_map = {
        "last_visit_desc": [("stats.lastVisit", -1)],
        "last_visit_asc": [("stats.lastVisit", 1)],
        "name_asc": [("name", 1)],
        "name_desc": [("name", -1)],
        "total_spent_desc": [("stats.totalSpent", -1)],
        "bookings_desc": [("stats.totalBookings", -1)],
    }
    sort_spec = sort_map.get(sort, sort_map["last_visit_desc"])

    total = await sdb.clients.count_documents(match)
    skip = (page - 1) * limit
    cursor = sdb.clients.find(match).sort(sort_spec).skip(skip).limit(limit)
    rows = await cursor.to_list(length=limit)

    clients = []
    for c in rows:
        stats = c.get("stats", {})
        clients.append({
            "id": c.get("id") or str(c.get("_id", "")),
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "phone": c.get("phone", ""),
            "avatar": c.get("avatar"),
            "tags": c.get("tags", []),
            "totalBookings": stats.get("totalBookings", 0),
            "totalSpent": stats.get("totalSpent", 0),
            "lastVisit": stats.get("lastVisit"),
            "source": c.get("source", "manual"),
        })

    now = date.today()
    segments = {"all": await sdb.clients.count_documents({"businessId": biz_id, "active": {"$ne": False}})}
    for seg in ["new", "returning", "inactive", "at_risk"]:
        m = {"businessId": biz_id, "active": {"$ne": False}}
        m.update(_segment_filter(seg, now))
        segments[seg] = await sdb.clients.count_documents(m)

    return {
        "clients": clients,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit if total else 0},
        "segments": segments,
    }


@router.get("/business/{business_id}/{client_id}")
async def get_client(business_id: str, client_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    biz_id = str(business["_id"])
    staff_map = {s.get("id"): s.get("name", "") for s in business.get("staff", [])}

    c = await sdb.clients.find_one({"businessId": biz_id, "id": client_id, "active": {"$ne": False}})
    if not c:
        c = await sdb.clients.find_one({"businessId": biz_id, "_id": client_id, "active": {"$ne": False}})
    if not c:
        raise HTTPException(404, "Client not found")

    stats = await _get_client_stats(db, biz_id, c.get("id") or str(c.get("_id", "")), c)
    await sdb.clients.update_one(
        {"_id": c["_id"]},
        {"$set": {"stats": stats, "updatedAt": datetime.utcnow()}},
    )
    c["stats"] = stats

    cid = c.get("id") or str(c.get("_id", ""))
    email = (c.get("email") or "").strip().lower()
    phone = _normalize_phone(c.get("phone"))
    match = {"businessId": biz_id, "$or": [{"customerId": cid}]}
    if email or phone:
        ors = [{"customerId": cid}]
        if email:
            ors.append({"customer.email": {"$regex": re.escape(email), "$options": "i"}})
        if phone:
            ors.append({"customer.phone": {"$regex": phone[-10:] if len(phone) >= 10 else phone}})
        match = {"businessId": biz_id, "$or": ors}
    cursor = sdb.bookings.find(match).sort("date", -1).sort("time", -1).limit(50)
    bkg_list = await cursor.to_list(length=50)

    bookings = []
    for b in bkg_list:
        svc = b.get("service") or {}
        price = svc.get("price")
        if isinstance(price, (int, float)):
            amt = int(price) if price >= 100 else int(price * 100)
        else:
            amt = 0
        bookings.append({
            "id": b.get("_id"),
            "date": b.get("date"),
            "time": b.get("time"),
            "service": svc.get("name", "Booking"),
            "staff": staff_map.get(b.get("staffId", ""), ""),
            "status": b.get("status", ""),
            "amount": amt,
        })

    notes = []
    for n in c.get("notes", []):
        notes.append({
            "id": n.get("id"),
            "text": n.get("text", ""),
            "createdBy": n.get("createdByName", n.get("createdBy", "")),
            "createdAt": n.get("createdAt"),
        })

    return {
        "client": {
            "id": c.get("id") or str(c.get("_id", "")),
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "phone": c.get("phone", ""),
            "tags": c.get("tags", []),
            "notes": notes,
            "stats": stats,
            "bookings": bookings,
            "source": c.get("source", "manual"),
            "createdAt": c.get("createdAt"),
        },
    }


@router.post("/business/{business_id}")
async def create_client(business_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    biz_id = str(business["_id"])

    name = (payload.get("name") or "").strip()
    if len(name) < 2 or len(name) > 100:
        raise HTTPException(400, "Name must be 2-100 chars")
    email = _normalize_email(payload.get("email"))
    phone = _normalize_phone(payload.get("phone"))
    if not email and not phone:
        raise HTTPException(400, "At least one of email or phone required")

    existing = None
    if email:
        existing = await sdb.clients.find_one({"businessId": biz_id, "email": email, "active": {"$ne": False}})
    if not existing and phone:
        existing = await sdb.clients.find_one({"businessId": biz_id, "phone": phone, "active": {"$ne": False}})
    if existing:
        return {
            "warning": "A client with this email or phone already exists.",
            "existingId": existing.get("id"),
            "client": None,
        }

    client_id = _client_id()
    notes = []
    if payload.get("notes"):
        notes.append({
            "id": f"note_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "text": str(payload.get("notes", ""))[:2000],
            "createdBy": str(user.get("_id", "")),
            "createdByName": user.get("name", "Staff"),
            "createdAt": datetime.utcnow(),
        })

    doc = {
        "id": client_id,
        "businessId": biz_id,
        "name": name,
        "email": email or "",
        "phone": payload.get("phone", "") or "",
        "phoneNormalized": phone or "",
        "tags": list(dict.fromkeys(payload.get("tags") or [])),
        "notes": notes,
        "stats": {"totalBookings": 0, "totalSpent": 0, "lastVisit": None, "firstVisit": None, "noShows": 0, "cancellations": 0, "averageSpend": 0},
        "source": "manual",
        "active": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    await sdb.clients.insert_one(doc)
    return {"client": doc}


@router.put("/business/{business_id}/{client_id}")
async def update_client(business_id: str, client_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    biz_id = str(business["_id"])

    c = await sdb.clients.find_one({"businessId": biz_id, "id": client_id})
    if not c:
        c = await sdb.clients.find_one({"businessId": biz_id, "_id": client_id})
    if not c:
        raise HTTPException(404, "Client not found")

    updates = {"updatedAt": datetime.utcnow()}
    for key in ["name", "email", "phone", "tags"]:
        if key in payload:
            updates[key] = payload[key]
    if "name" in updates and (len(updates["name"]) < 2 or len(updates["name"]) > 100):
        raise HTTPException(400, "Name must be 2-100 chars")

    await sdb.clients.update_one({"_id": c["_id"]}, {"$set": updates})
    updated = await sdb.clients.find_one({"_id": c["_id"]})
    return updated


@router.delete("/business/{business_id}/{client_id}")
async def delete_client(business_id: str, client_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    biz_id = str(business["_id"])

    c = await sdb.clients.find_one({"businessId": biz_id, "id": client_id})
    if not c:
        c = await sdb.clients.find_one({"businessId": biz_id, "_id": client_id})
    if not c:
        raise HTTPException(404, "Client not found")

    await sdb.clients.update_one(
        {"_id": c["_id"]},
        {"$set": {"active": False, "updatedAt": datetime.utcnow()}},
    )
    return {"detail": "Client removed"}


@router.post("/business/{business_id}/{client_id}/tags")
async def add_tags(business_id: str, client_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    biz_id = str(business["_id"])

    c = await sdb.clients.find_one({"businessId": biz_id, "id": client_id})
    if not c:
        c = await sdb.clients.find_one({"businessId": biz_id, "_id": client_id})
    if not c:
        raise HTTPException(404, "Client not found")

    new_tags = payload.get("tags", [])
    existing = set(c.get("tags", []))
    for t in new_tags:
        if t:
            existing.add(str(t).strip())
    await sdb.clients.update_one(
        {"_id": c["_id"]},
        {"$set": {"tags": list(existing), "updatedAt": datetime.utcnow()}},
    )
    updated = await sdb.clients.find_one({"_id": c["_id"]})
    return updated


@router.delete("/business/{business_id}/{client_id}/tags/{tag}")
async def remove_tag(business_id: str, client_id: str, tag: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    biz_id = str(business["_id"])

    c = await sdb.clients.find_one({"businessId": biz_id, "id": client_id})
    if not c:
        c = await sdb.clients.find_one({"businessId": biz_id, "_id": client_id})
    if not c:
        raise HTTPException(404, "Client not found")

    tags = [t for t in c.get("tags", []) if t != tag]
    await sdb.clients.update_one(
        {"_id": c["_id"]},
        {"$set": {"tags": tags, "updatedAt": datetime.utcnow()}},
    )
    return await sdb.clients.find_one({"_id": c["_id"]})


@router.post("/business/{business_id}/{client_id}/notes")
async def add_note(business_id: str, client_id: str, payload: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    biz_id = str(business["_id"])

    c = await sdb.clients.find_one({"businessId": biz_id, "id": client_id})
    if not c:
        c = await sdb.clients.find_one({"businessId": biz_id, "_id": client_id})
    if not c:
        raise HTTPException(404, "Client not found")

    text = (payload.get("text") or "").strip()[:2000]
    if not text:
        raise HTTPException(400, "Note text required")

    note = {
        "id": f"note_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        "text": text,
        "createdBy": str(user.get("_id", "")),
        "createdByName": user.get("name", "Staff"),
        "createdAt": datetime.utcnow(),
    }
    notes = c.get("notes", []) + [note]
    await sdb.clients.update_one(
        {"_id": c["_id"]},
        {"$set": {"notes": notes, "updatedAt": datetime.utcnow()}},
    )
    return await sdb.clients.find_one({"_id": c["_id"]})


@router.delete("/business/{business_id}/{client_id}/notes/{note_id}")
async def delete_note(business_id: str, client_id: str, note_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    biz_id = str(business["_id"])

    c = await sdb.clients.find_one({"businessId": biz_id, "id": client_id})
    if not c:
        c = await sdb.clients.find_one({"businessId": biz_id, "_id": client_id})
    if not c:
        raise HTTPException(404, "Client not found")

    notes = [n for n in c.get("notes", []) if n.get("id") != note_id]
    await sdb.clients.update_one(
        {"_id": c["_id"]},
        {"$set": {"notes": notes, "updatedAt": datetime.utcnow()}},
    )
    return await sdb.clients.find_one({"_id": c["_id"]})


@router.get("/business/{business_id}/export")
async def export_clients(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    biz_id = str(business["_id"])

    cursor = sdb.clients.find({"businessId": biz_id, "active": {"$ne": False}})
    rows = await cursor.to_list(length=10000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "Email", "Phone", "Total Bookings", "Total Spent", "Last Visit", "Tags", "Source"])
    for c in rows:
        stats = c.get("stats", {})
        writer.writerow([
            c.get("name", ""),
            c.get("email", ""),
            c.get("phone", ""),
            stats.get("totalBookings", 0),
            stats.get("totalSpent", 0),
            stats.get("lastVisit", ""),
            ",".join(c.get("tags", [])),
            c.get("source", "manual"),
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=clients.csv"},
    )


@router.post("/business/{business_id}/import")
async def import_clients(business_id: str, file: UploadFile = File(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    business = await _get_business(db, business_id, {"_id": tenant.user_id, "role": tenant.role})
    biz_id = str(business["_id"])

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except Exception:
        text = content.decode("latin-1")
    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    duplicates = 0
    errors = 0

    for row in reader:
        name = (row.get("Name") or row.get("name") or "").strip()
        if len(name) < 2:
            errors += 1
            continue
        email = _normalize_email(row.get("Email") or row.get("email"))
        phone_raw = (row.get("Phone") or row.get("phone") or "").strip()
        phone = _normalize_phone(phone_raw)
        if not email and not phone:
            errors += 1
            continue
        tags = [t.strip() for t in (row.get("Tags") or row.get("tags") or "").split(",") if t.strip()]

        existing = await sdb.clients.find_one({"businessId": biz_id, "email": email, "active": {"$ne": False}}) if email else None
        if not existing and phone:
            existing = await sdb.clients.find_one({"businessId": biz_id, "phoneNormalized": phone, "active": {"$ne": False}})
        if existing:
            duplicates += 1
            continue

        doc = {
            "id": _client_id(),
            "businessId": biz_id,
            "name": name,
            "email": email or "",
            "phone": phone_raw or "",
            "phoneNormalized": phone or "",
            "tags": tags,
            "notes": [],
            "stats": {"totalBookings": 0, "totalSpent": 0, "lastVisit": None, "firstVisit": None, "noShows": 0, "cancellations": 0, "averageSpend": 0},
            "source": "import",
            "active": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }
        await sdb.clients.insert_one(doc)
        imported += 1

    return {"imported": imported, "duplicates": duplicates, "errors": errors}


async def ensure_client_from_booking(db, biz_id: str, customer: dict, source: str = "online", booking_date: str = None):
    """Create or update client from booking customer details. Returns client_id."""
    email = _normalize_email(customer.get("email"))
    phone = _normalize_phone(customer.get("phone"))
    name = (customer.get("name") or "").strip() or "Customer"
    if not email and not phone:
        return None

    existing = None
    if email:
        existing = await db.clients.find_one({"businessId": biz_id, "email": email, "active": {"$ne": False}})
    if not existing and phone:
        existing = await db.clients.find_one({"businessId": biz_id, "phoneNormalized": phone, "active": {"$ne": False}})
    if not existing and phone:
        for c in await db.clients.find({"businessId": biz_id, "active": {"$ne": False}}).to_list(length=1000):
            if _normalize_phone(c.get("phone")) == phone:
                existing = c
                break
    if existing:
        await db.clients.update_one(
            {"_id": existing["_id"]},
            {"$set": {"updatedAt": datetime.utcnow(), "name": name or existing.get("name")}},
        )
        return existing.get("id")

    doc = {
        "id": _client_id(),
        "businessId": biz_id,
        "name": name,
        "email": email or "",
        "phone": customer.get("phone", "") or "",
        "phoneNormalized": phone or "",
        "tags": [],
        "notes": [],
        "stats": {"totalBookings": 0, "totalSpent": 0, "lastVisit": booking_date, "firstVisit": booking_date, "noShows": 0, "cancellations": 0, "averageSpend": 0},
        "source": source,
        "active": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    await db.clients.insert_one(doc)
    return doc["id"]


async def refresh_client_stats(db, biz_id: str, client_id: str):
    """Recompute and store stats for a client from bookings."""
    c = await db.clients.find_one({"businessId": biz_id, "id": client_id})
    if not c:
        c = await db.clients.find_one({"businessId": biz_id, "_id": client_id})
    if not c:
        return
    stats = await _get_client_stats(db, biz_id, client_id, c)
    await db.clients.update_one(
        {"_id": c["_id"]},
        {"$set": {"stats": stats, "updatedAt": datetime.utcnow()}},
    )
