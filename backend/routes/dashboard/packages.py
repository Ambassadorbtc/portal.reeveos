"""
Packages API — Treatment course templates, purchase & session tracking.

6A: Package Configuration (templates)
6B: Package Purchase & Session Tracking (client_packages)
6C: Package Progress & Alerts (expiry, renewal prompts)

Collections:
  package_templates — { business_id, name, description, type, allowed_services,
                        total_sessions, validity_days, price, force_book_all_upfront, rules, ... }
  client_packages   — { business_id, client_id, package_id, package_name, type,
                        total_sessions, sessions_used, sessions[], purchased_at, expires_at, status }
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from database import get_database
from middleware.tenant import verify_business_access, TenantContext
from bson import ObjectId
import logging

logger = logging.getLogger("packages")
router = APIRouter(prefix="/packages", tags=["packages"])

VALID_TYPES = {"time_limited", "commitment"}


# ═══════════════════════════════════════════════════════════════
# 6A: PACKAGE CONFIGURATION (Templates)
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/create")
async def create_package_template(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Create a package template (e.g. '30-Day Reset', 'Skin Commitment')."""
    name = (payload.get("name") or "").strip()
    description = (payload.get("description") or "").strip()
    pkg_type = (payload.get("type") or "").strip()
    allowed_services = payload.get("allowed_services", [])
    total_sessions = payload.get("total_sessions", 0)
    validity_days = payload.get("validity_days", 0)
    price = payload.get("price", 0)
    force_book_all_upfront = payload.get("force_book_all_upfront", False)
    rules = payload.get("rules", {})

    if not name:
        raise HTTPException(400, "Package name is required")
    if pkg_type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid type. Must be one of: {', '.join(sorted(VALID_TYPES))}")
    if not isinstance(total_sessions, int) or total_sessions < 1:
        raise HTTPException(400, "total_sessions must be a positive integer")
    if not isinstance(validity_days, int) or validity_days < 1:
        raise HTTPException(400, "validity_days must be a positive integer")
    if not isinstance(price, (int, float)) or price < 0:
        raise HTTPException(400, "price must be non-negative")
    if not isinstance(allowed_services, list) or len(allowed_services) == 0:
        raise HTTPException(400, "allowed_services must be a non-empty list")

    db = get_database()
    now = datetime.utcnow()

    doc = {
        "business_id": business_id,
        "name": name,
        "description": description,
        "type": pkg_type,
        "allowed_services": allowed_services,
        "total_sessions": total_sessions,
        "validity_days": validity_days,
        "price": price,
        "force_book_all_upfront": bool(force_book_all_upfront),
        "rules": rules if isinstance(rules, dict) else {},
        "active": True,
        "created_at": now,
        "updated_at": now,
        "created_by": tenant.user_id,
    }

    result = await db.package_templates.insert_one(doc)
    template_id = str(result.inserted_id)

    logger.info(f"Package template created: {template_id} name={name} type={pkg_type} business={business_id}")
    return {
        "ok": True,
        "template_id": template_id,
        "name": name,
        "type": pkg_type,
        "total_sessions": total_sessions,
        "validity_days": validity_days,
        "price": price,
    }


@router.get("/business/{business_id}")
async def list_package_templates(
    business_id: str,
    include_inactive: bool = Query(False),
    tenant: TenantContext = Depends(verify_business_access),
):
    """List all package templates for a business."""
    db = get_database()
    query = {"business_id": business_id}
    if not include_inactive:
        query["active"] = True

    cursor = db.package_templates.find(query).sort("created_at", -1)
    docs = await cursor.to_list(length=200)

    templates = []
    for d in docs:
        templates.append({
            "id": str(d["_id"]),
            "name": d.get("name", ""),
            "description": d.get("description", ""),
            "type": d.get("type", ""),
            "allowed_services": d.get("allowed_services", []),
            "total_sessions": d.get("total_sessions", 0),
            "validity_days": d.get("validity_days", 0),
            "price": d.get("price", 0),
            "force_book_all_upfront": d.get("force_book_all_upfront", False),
            "rules": d.get("rules", {}),
            "active": d.get("active", True),
            "created_at": d["created_at"].isoformat() if d.get("created_at") else "",
        })

    return {"templates": templates, "total": len(templates)}


@router.patch("/business/{business_id}/{package_id}")
async def update_package_template(
    business_id: str,
    package_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Update a package template."""
    db = get_database()

    existing = await db.package_templates.find_one({
        "_id": ObjectId(package_id), "business_id": business_id,
    })
    if not existing:
        raise HTTPException(404, "Package template not found")

    allowed_fields = {
        "name", "description", "type", "allowed_services", "total_sessions",
        "validity_days", "price", "force_book_all_upfront", "rules",
    }
    updates = {}
    for key in allowed_fields:
        if key in payload:
            updates[key] = payload[key]

    # Validate changed fields
    if "type" in updates and updates["type"] not in VALID_TYPES:
        raise HTTPException(400, f"Invalid type. Must be one of: {', '.join(sorted(VALID_TYPES))}")
    if "total_sessions" in updates:
        if not isinstance(updates["total_sessions"], int) or updates["total_sessions"] < 1:
            raise HTTPException(400, "total_sessions must be a positive integer")
    if "validity_days" in updates:
        if not isinstance(updates["validity_days"], int) or updates["validity_days"] < 1:
            raise HTTPException(400, "validity_days must be a positive integer")
    if "price" in updates:
        if not isinstance(updates["price"], (int, float)) or updates["price"] < 0:
            raise HTTPException(400, "price must be non-negative")
    if "allowed_services" in updates:
        if not isinstance(updates["allowed_services"], list) or len(updates["allowed_services"]) == 0:
            raise HTTPException(400, "allowed_services must be a non-empty list")

    if not updates:
        raise HTTPException(400, "No valid fields to update")

    updates["updated_at"] = datetime.utcnow()

    await db.package_templates.update_one(
        {"_id": ObjectId(package_id)},
        {"$set": updates},
    )

    logger.info(f"Package template updated: {package_id} fields={list(updates.keys())} business={business_id}")
    return {"ok": True, "updated": list(updates.keys())}


@router.delete("/business/{business_id}/{package_id}")
async def delete_package_template(
    business_id: str,
    package_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Soft-delete a package template."""
    db = get_database()

    result = await db.package_templates.update_one(
        {"_id": ObjectId(package_id), "business_id": business_id, "active": True},
        {"$set": {"active": False, "deleted_at": datetime.utcnow(), "deleted_by": tenant.user_id}},
    )

    if result.matched_count == 0:
        raise HTTPException(404, "Package template not found or already deleted")

    logger.info(f"Package template soft-deleted: {package_id} business={business_id}")
    return {"ok": True, "deleted": True}


# ═══════════════════════════════════════════════════════════════
# 6B: PACKAGE PURCHASE & SESSION TRACKING
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/purchase")
async def purchase_package(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Purchase a package for a client. Creates a client_packages record."""
    client_id = (payload.get("client_id") or "").strip()
    package_id = (payload.get("package_id") or "").strip()
    booked_sessions = payload.get("booked_sessions", [])

    if not client_id:
        raise HTTPException(400, "client_id is required")
    if not package_id:
        raise HTTPException(400, "package_id is required")

    db = get_database()

    # Load template
    template = await db.package_templates.find_one({
        "_id": ObjectId(package_id), "business_id": business_id, "active": True,
    })
    if not template:
        raise HTTPException(404, "Package template not found")

    # Validate force_book_all_upfront
    if template.get("force_book_all_upfront"):
        if not isinstance(booked_sessions, list) or len(booked_sessions) < template["total_sessions"]:
            raise HTTPException(
                400,
                f"This package requires all {template['total_sessions']} sessions booked upfront. "
                f"Provide booked_sessions with {template['total_sessions']} entries.",
            )
        # Validate each booked session
        for i, s in enumerate(booked_sessions):
            if not s.get("service_name"):
                raise HTTPException(400, f"booked_sessions[{i}] missing service_name")
            if not s.get("date"):
                raise HTTPException(400, f"booked_sessions[{i}] missing date")
            if not s.get("time"):
                raise HTTPException(400, f"booked_sessions[{i}] missing time")
            # Validate service is allowed
            if s["service_name"] not in template["allowed_services"]:
                raise HTTPException(400, {
                    "error": "service_not_allowed",
                    "message": f"Service '{s['service_name']}' is not in this package",
                    "allowed": template["allowed_services"],
                })

    now = datetime.utcnow()
    expires_at = now + timedelta(days=template["validity_days"])

    # Build sessions array
    sessions = []
    for s in booked_sessions:
        sessions.append({
            "booking_id": s.get("booking_id", ""),
            "service": s["service_name"],
            "date": s["date"],
            "time": s.get("time", ""),
            "status": "booked",
        })

    client_pkg = {
        "business_id": business_id,
        "client_id": client_id,
        "package_id": package_id,
        "package_name": template["name"],
        "type": template["type"],
        "allowed_services": template["allowed_services"],
        "total_sessions": template["total_sessions"],
        "sessions_used": 0,
        "sessions": sessions,
        "price": template["price"],
        "purchased_at": now,
        "expires_at": expires_at,
        "status": "active",
        "created_by": tenant.user_id,
    }

    result = await db.client_packages.insert_one(client_pkg)
    cp_id = str(result.inserted_id)

    logger.info(f"Package purchased: {cp_id} template={template['name']} client={client_id} business={business_id}")
    return {
        "ok": True,
        "client_package_id": cp_id,
        "package_name": template["name"],
        "type": template["type"],
        "total_sessions": template["total_sessions"],
        "sessions_booked": len(sessions),
        "expires_at": expires_at.isoformat(),
    }


@router.post("/business/{business_id}/client/{client_id}/redeem")
async def redeem_session(
    business_id: str,
    client_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Redeem a session from a purchased package."""
    client_package_id = (payload.get("client_package_id") or "").strip()
    service_name = (payload.get("service_name") or "").strip()
    booking_id = (payload.get("booking_id") or "").strip()

    if not client_package_id:
        raise HTTPException(400, "client_package_id is required")
    if not service_name:
        raise HTTPException(400, "service_name is required")

    db = get_database()

    # Load client package
    cp = await db.client_packages.find_one({
        "_id": ObjectId(client_package_id),
        "business_id": business_id,
        "client_id": client_id,
    })
    if not cp:
        raise HTTPException(404, "Client package not found")

    # Check expiry
    now = datetime.utcnow()
    if cp.get("expires_at") and now > cp["expires_at"]:
        # Mark as expired
        await db.client_packages.update_one(
            {"_id": cp["_id"]}, {"$set": {"status": "expired"}},
        )
        raise HTTPException(400, {"error": "package_expired", "expires_at": cp["expires_at"].isoformat()})

    if cp.get("status") != "active":
        raise HTTPException(400, f"Package is {cp.get('status', 'not active')}")

    # Check sessions remaining
    total = cp.get("total_sessions", 0)
    used = cp.get("sessions_used", 0)
    if used >= total:
        raise HTTPException(400, "All sessions have been used")

    # Check service is allowed
    allowed = cp.get("allowed_services", [])
    if allowed and service_name not in allowed:
        raise HTTPException(400, {
            "error": "service_not_allowed",
            "message": f"Service '{service_name}' is not in this package",
            "allowed": allowed,
        })

    # Record session
    session_record = {
        "booking_id": booking_id,
        "service": service_name,
        "date": now.strftime("%Y-%m-%d"),
        "status": "completed",
        "redeemed_at": now.isoformat(),
    }

    new_used = used + 1
    new_status = "completed" if new_used >= total else "active"

    update_set = {"sessions_used": new_used, "status": new_status, "updated_at": now}

    await db.client_packages.update_one(
        {"_id": cp["_id"]},
        {"$set": update_set, "$push": {"sessions": session_record}},
    )

    # Renewal prompt when 1 session remaining
    renewal_prompt = False
    renewal_message = None
    if new_used == total - 1:
        renewal_prompt = True
        renewal_message = "One session remaining — time to renew?"

    logger.info(f"Session redeemed: pkg={client_package_id} service={service_name} {new_used}/{total} business={business_id}")
    result = {
        "ok": True,
        "sessions_used": new_used,
        "total_sessions": total,
        "remaining": total - new_used,
        "status": new_status,
    }
    if renewal_prompt:
        result["renewal_prompt"] = True
        result["renewal_message"] = renewal_message

    return result


# ═══════════════════════════════════════════════════════════════
# 6C: PACKAGE PROGRESS & ALERTS
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/client/{client_id}/packages")
async def get_client_active_packages(
    business_id: str,
    client_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Active packages with progress info and renewal prompts."""
    db = get_database()
    now = datetime.utcnow()

    cursor = db.client_packages.find({
        "business_id": business_id,
        "client_id": client_id,
        "status": "active",
    }).sort("purchased_at", -1)
    docs = await cursor.to_list(length=50)

    packages = []
    for p in docs:
        total = p.get("total_sessions", 0)
        used = p.get("sessions_used", 0)
        remaining = total - used
        percent = round(used / total * 100, 1) if total else 0
        expires_at = p.get("expires_at")
        days_remaining = (expires_at - now).days if expires_at else None

        # Auto-expire if past expiry
        if expires_at and now > expires_at:
            await db.client_packages.update_one(
                {"_id": p["_id"]}, {"$set": {"status": "expired"}},
            )
            continue

        pkg = {
            "id": str(p["_id"]),
            "package_name": p.get("package_name", ""),
            "type": p.get("type", ""),
            "sessions_used": used,
            "total_sessions": total,
            "remaining": remaining,
            "percent_complete": percent,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "days_remaining": days_remaining,
            "sessions": p.get("sessions", []),
            "price": p.get("price", 0),
            "purchased_at": p["purchased_at"].isoformat() if p.get("purchased_at") else "",
        }

        # Renewal prompt
        if used == total - 1:
            pkg["renewal_prompt"] = True
            pkg["renewal_message"] = "One session remaining — time to renew?"

        packages.append(pkg)

    return {"packages": packages, "total": len(packages)}


@router.get("/business/{business_id}/expiring")
async def get_expiring_packages(
    business_id: str,
    days: int = Query(30, ge=1, le=180),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Packages expiring within N days."""
    db = get_database()
    now = datetime.utcnow()
    cutoff = now + timedelta(days=days)

    cursor = db.client_packages.find({
        "business_id": business_id,
        "status": "active",
        "expires_at": {"$lte": cutoff, "$gt": now},
    }).sort("expires_at", 1)
    docs = await cursor.to_list(length=200)

    expiring = []
    for p in docs:
        total = p.get("total_sessions", 0)
        used = p.get("sessions_used", 0)
        expires_at = p.get("expires_at")
        days_remaining = (expires_at - now).days if expires_at else 0

        expiring.append({
            "id": str(p["_id"]),
            "client_id": p.get("client_id", ""),
            "package_name": p.get("package_name", ""),
            "type": p.get("type", ""),
            "sessions_used": used,
            "total_sessions": total,
            "remaining": total - used,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "days_remaining": days_remaining,
            "purchased_at": p["purchased_at"].isoformat() if p.get("purchased_at") else "",
        })

    return {"expiring": expiring, "total": len(expiring), "within_days": days}


@router.get("/business/{business_id}/client/{client_id}/package-history")
async def get_package_history(
    business_id: str,
    client_id: str,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    tenant: TenantContext = Depends(verify_business_access),
):
    """All packages including completed and expired."""
    db = get_database()

    query = {"business_id": business_id, "client_id": client_id}
    total = await db.client_packages.count_documents(query)

    cursor = db.client_packages.find(query).sort("purchased_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    packages = []
    for p in docs:
        total_s = p.get("total_sessions", 0)
        used = p.get("sessions_used", 0)
        expires_at = p.get("expires_at")

        packages.append({
            "id": str(p["_id"]),
            "package_name": p.get("package_name", ""),
            "type": p.get("type", ""),
            "sessions_used": used,
            "total_sessions": total_s,
            "remaining": total_s - used,
            "percent_complete": round(used / total_s * 100, 1) if total_s else 0,
            "price": p.get("price", 0),
            "status": p.get("status", ""),
            "purchased_at": p["purchased_at"].isoformat() if p.get("purchased_at") else "",
            "expires_at": expires_at.isoformat() if expires_at else None,
            "sessions": p.get("sessions", []),
        })

    return {"packages": packages, "total": total}
