from fastapi import APIRouter, HTTPException, status, Depends, Query, Body
from database import get_database
from middleware.tenant_db import get_scoped_db
from models.reservation import (
    ReservationCreate, ReservationUpdate, ReservationResponse,
    ReservationStatus, DepositStatus
)
from middleware.auth import get_current_user, get_current_staff
from middleware.tenant import verify_business_access, TenantContext
from datetime import datetime, date, time, timedelta
from typing import List, Optional
from models.normalize import normalize_booking, booking_to_list_item, booking_to_detail
import logging

logger = logging.getLogger("bookings")
router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("/", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    reservation_data: ReservationCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    business = await db.businesses.find_one({"_id": reservation_data.business_id})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    if not business.get("claimed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business does not accept online bookings"
        )
    
    reservation_dict = reservation_data.model_dump()
    reservation_dict.update({
        "businessId": reservation_data.business_id,  # Canonical field name (matches book.py)
        "user_id": str(current_user["_id"]),
        "status": ReservationStatus.PENDING.value,
        "deposit_amount": None,
        "deposit_status": DepositStatus.NOT_REQUIRED.value,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    booking_settings = business.get("booking_settings", {})
    if booking_settings.get("auto_confirm", True):
        reservation_dict["status"] = ReservationStatus.CONFIRMED.value
    
    result = await db.bookings.insert_one(reservation_dict)
    reservation_id = str(result.inserted_id)
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"booking_history": reservation_id}}
    )
    
    reservation_dict["_id"] = reservation_id
    
    return ReservationResponse(
        id=reservation_id,
        business_id=reservation_dict.get("businessId") or reservation_dict.get("business_id", ""),
        user_id=reservation_dict["user_id"],
        date=reservation_dict["date"],
        time=reservation_dict["time"],
        duration_minutes=reservation_dict["duration_minutes"],
        party_size=reservation_dict["party_size"],
        table_id=reservation_dict.get("table_id"),
        staff_id=reservation_dict.get("staff_id"),
        status=ReservationStatus(reservation_dict["status"]),
        deposit_amount=reservation_dict["deposit_amount"],
        deposit_status=DepositStatus(reservation_dict["deposit_status"]),
        notes=reservation_dict.get("notes"),
        created_at=reservation_dict["created_at"]
    )


@router.get("/{reservation_id}", response_model=ReservationResponse)
async def get_reservation(
    reservation_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    reservation = await db.bookings.find_one({"_id": reservation_id})
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found"
        )
    
    biz_id = reservation.get("businessId") or reservation.get("business_id")
    business = await db.businesses.find_one({"_id": biz_id})
    
    if (reservation["user_id"] != str(current_user["_id"]) and 
        business.get("owner_id") != str(current_user["_id"]) and
        current_user.get("role") not in ["staff", "business_owner", "platform_admin", "super_admin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this reservation"
        )
    
    return ReservationResponse(
        id=str(reservation["_id"]),
        business_id=biz_id,
        user_id=reservation["user_id"],
        date=reservation["date"],
        time=reservation["time"],
        duration_minutes=reservation["duration_minutes"],
        party_size=reservation["party_size"],
        table_id=reservation.get("table_id"),
        staff_id=reservation.get("staff_id"),
        status=ReservationStatus(reservation["status"]),
        deposit_amount=reservation.get("deposit_amount"),
        deposit_status=DepositStatus(reservation["deposit_status"]),
        notes=reservation.get("notes"),
        created_at=reservation["created_at"]
    )


@router.patch("/{reservation_id}", response_model=ReservationResponse)
async def update_reservation(
    reservation_id: str,
    reservation_update: ReservationUpdate,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    reservation = await db.bookings.find_one({"_id": reservation_id})
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found"
        )
    
    biz_id = reservation.get("businessId") or reservation.get("business_id")
    business = await db.businesses.find_one({"_id": biz_id})
    
    if (reservation["user_id"] != str(current_user["_id"]) and 
        business.get("owner_id") != str(current_user["_id"]) and
        current_user.get("role") not in ["staff", "business_owner", "platform_admin", "super_admin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this reservation"
        )
    
    update_data = reservation_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.bookings.update_one(
        {"_id": reservation_id},
        {"$set": update_data}
    )
    
    updated_reservation = await db.bookings.find_one({"_id": reservation_id})
    
    return ReservationResponse(
        id=str(updated_reservation["_id"]),
        business_id=updated_reservation.get("businessId") or updated_reservation.get("business_id", ""),
        user_id=updated_reservation["user_id"],
        date=updated_reservation["date"],
        time=updated_reservation["time"],
        duration_minutes=updated_reservation["duration_minutes"],
        party_size=updated_reservation["party_size"],
        table_id=updated_reservation.get("table_id"),
        staff_id=updated_reservation.get("staff_id"),
        status=ReservationStatus(updated_reservation["status"]),
        deposit_amount=updated_reservation.get("deposit_amount"),
        deposit_status=DepositStatus(updated_reservation["deposit_status"]),
        notes=updated_reservation.get("notes"),
        created_at=updated_reservation["created_at"]
    )


@router.delete("/{reservation_id}")
async def cancel_reservation(
    reservation_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    reservation = await db.bookings.find_one({"_id": reservation_id})
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found"
        )
    
    if reservation.get("user_id") != str(current_user["_id"]) and current_user.get("role") not in ("business_owner", "platform_admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this reservation"
        )
    
    await db.bookings.update_one(
        {"_id": reservation_id},
        {
            "$set": {
                "status": ReservationStatus.CANCELLED.value,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"detail": "Reservation cancelled successfully"}


# --- Run 3: Owner bookings (from bookings collection) ---

@router.get("/business/{business_id}")
async def list_bookings(
    business_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query("all"),
    search: str = Query(""),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    sort: str = Query("date_desc"),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Run 3: Paginated bookings list with filters."""
    from bson import ObjectId
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    try:
        business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")

    # TenantScopedDB auto-injects businessId filter on every query
    match = {}
    if status != "all":
        match["status"] = status
    if from_date:
        match.setdefault("date", {})["$gte"] = from_date
    if to_date:
        match.setdefault("date", {})["$lte"] = to_date
    if search:
        search_or = [
            {"customer.name": {"$regex": search, "$options": "i"}},
            {"reference": {"$regex": search, "$options": "i"}},
            {"customer.phone": {"$regex": search, "$options": "i"}},
            {"customer.email": {"$regex": search, "$options": "i"}},
        ]
        match = {"$and": [match, {"$or": search_or}]} if match else {"$or": search_or}

    total = await sdb.bookings.count_documents(match)
    sort_dir = -1 if sort == "date_desc" else 1
    cursor = sdb.bookings.find(match).sort("date", sort_dir).sort("time", sort_dir).skip((page - 1) * limit).limit(limit)
    docs = await cursor.to_list(length=None)

    staff_map = {st.get("id"): st for st in business.get("staff", [])}

    bookings = [booking_to_list_item(d, staff_map) for d in docs]

    # Count bookings (TenantScopedDB auto-filters by businessId)
    counts = {}
    for s in ["all", "confirmed", "pending", "checked_in", "completed", "cancelled", "no_show"]:
        m = {} if s == "all" else {"status": s}
        counts[s] = await sdb.bookings.count_documents(m)

    return {
        "bookings": bookings,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit or 1},
        "counts": counts,
    }


@router.get("/business/{business_id}/detail/{booking_id}")
async def get_booking_detail(
    business_id: str,
    booking_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Run 3: Full booking detail for side panel."""
    from bson import ObjectId
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    try:
        business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")

    # TenantScopedDB ensures we only see this business's bookings
    b = await sdb.bookings.find_one({"_id": booking_id})
    if not b:
        try:
            b = await sdb.bookings.find_one({"_id": ObjectId(booking_id)})
        except Exception:
            pass
    if not b:
        raise HTTPException(404, "Booking not found")

    staff_map = {st.get("id"): st for st in business.get("staff", [])}

    return {"booking": booking_to_detail(b, staff_map)}


@router.patch("/business/{business_id}/detail/{booking_id}/status")
async def update_booking_status(
    business_id: str,
    booking_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Run 3: Update booking status (confirm, check-in, complete, cancel, no-show)."""
    from bson import ObjectId
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    try:
        business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")

    # TenantScopedDB ensures we only access this business's bookings
    b = await sdb.bookings.find_one({"_id": booking_id})
    doc_id = booking_id
    if not b:
        try:
            b = await sdb.bookings.find_one({"_id": ObjectId(booking_id)})
            if b:
                doc_id = ObjectId(booking_id)
        except Exception:
            pass
    if not b:
        raise HTTPException(404, "Booking not found")

    new_status = payload.get("status")
    valid = {"pending", "confirmed", "checked_in", "completed", "cancelled", "no_show"}
    if new_status not in valid:
        raise HTTPException(400, f"Invalid status. Use one of: {valid}")

    old_status = b.get("status", "unknown")
    await sdb.bookings.update_one(
        {"_id": doc_id},
        {"$set": {"status": new_status, "updatedAt": datetime.utcnow()}},
    )

    # Audit trail — immutable, cannot be deleted by staff
    nb = normalize_booking(b)
    audit_entry = {
        "type": "status_change",
        "booking_id": str(doc_id),
        "booking_ref": nb.get("reference", ""),
        "customer_name": nb["customer"]["name"] or "Customer",
        "old_value": old_status,
        "new_value": new_status,
        "changed_by": tenant.user_email or tenant.user_id,
        "changed_by_role": tenant.role,
        "timestamp": datetime.utcnow(),
        "immutable": True,
    }
    await sdb.booking_audit.insert_one(audit_entry)

    # Also log to activity (existing)
    await sdb.activity_log.insert_one({
        "type": f"booking_{new_status}" if new_status != "cancelled" else "booking_cancelled",
        "message": f"Booking {nb['reference']} {old_status} → {new_status}: {nb['customer']['name'] or 'Customer'} (by {tenant.user_email})",
        "bookingId": str(doc_id),
        "timestamp": datetime.utcnow(),
    })

    # ── AFTERCARE AUTO-EMAIL — triggered on completion ──
    if new_status == "completed":
        try:
            svc = b.get("service", {})
            svc_name = svc.get("name", "") if isinstance(svc, dict) else str(svc)
            cust_email = nb["customer"].get("email")
            if cust_email and svc_name:
                treatment_lower = svc_name.lower()
                aftercare_type = None
                if "microneedling" in treatment_lower or "needling" in treatment_lower:
                    aftercare_type = "microneedling"
                elif "peel" in treatment_lower or "biorep" in treatment_lower:
                    aftercare_type = "peel"
                elif "rf" in treatment_lower or "radio" in treatment_lower:
                    aftercare_type = "rf"
                elif "polynuc" in treatment_lower:
                    aftercare_type = "polynucleotides"
                elif "lymph" in treatment_lower or "lift" in treatment_lower:
                    aftercare_type = "lymphatic"
                elif "derma" in treatment_lower:
                    aftercare_type = "dermaplaning"

                if aftercare_type:
                    # Schedule aftercare email (15-30 min delay)
                    await db.aftercare_queue.insert_one({
                        "business_id": tenant.business_id,
                        "booking_id": str(doc_id),
                        "client_email": cust_email,
                        "client_name": nb["customer"]["name"],
                        "treatment_type": aftercare_type,
                        "treatment_name": svc_name,
                        "staff_name": nb.get("staffName", ""),
                        "send_after": datetime.utcnow() + timedelta(minutes=20),
                        "sent": False,
                        "created_at": datetime.utcnow(),
                    })
        except Exception as e:
            logger.warning(f"Aftercare queue error: {e}")

    # ── PATCH TEST CHECK — block check-in if patch test not done ──
    if new_status == "checked_in":
        svc = b.get("service", {})
        svc_name = (svc.get("name", "") if isinstance(svc, dict) else str(svc)).lower()
        needs_patch = "microneedling" in svc_name or "peel" in svc_name or "needling" in svc_name
        if needs_patch and b.get("firstVisit"):
            # Check if patch test exists for this client
            cust_phone = nb["customer"].get("phone")
            cust_email = nb["customer"].get("email")
            patch_query = {"business_id": tenant.business_id, "type": "patch_test", "status": "completed"}
            if cust_phone:
                patch_query["client_phone"] = cust_phone
            elif cust_email:
                patch_query["client_email"] = cust_email
            patch_done = await db.bookings.find_one(patch_query) if (cust_phone or cust_email) else None
            if not patch_done:
                # Don't block — but flag on the booking
                await sdb.bookings.update_one(
                    {"_id": doc_id},
                    {"$set": {"patchTestWarning": True}}
                )

    updated = await sdb.bookings.find_one({"_id": doc_id})
    staff_map = {st.get("id"): st for st in business.get("staff", [])}
    return booking_to_list_item(updated, staff_map)


@router.get("/business/{business_id}/availability")
async def check_availability(
    business_id: str,
    date_param: date = Query(..., alias="date"),
    party_size: int = Query(2, ge=1)
):
    db = get_database()
    
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    booking_settings = business.get("booking_settings", {})
    slot_duration = booking_settings.get("slot_duration_minutes", 15)
    
    start_time = time(9, 0)
    end_time = time(21, 0)
    
    slots = []
    current_time = datetime.combine(date_param, start_time)
    end_datetime = datetime.combine(date_param, end_time)
    
    while current_time < end_datetime:
        slots.append({
            "time": current_time.time().isoformat(),
            "available": True
        })
        current_time += timedelta(minutes=slot_duration)
    
    return {"date": date_param, "slots": slots}


@router.get("/business/{business_id}/calendar")
async def get_business_calendar(
    business_id: str,
    start_date: date = Query(...),
    end_date: date = Query(...),
    tenant: TenantContext = Depends(verify_business_access)
):
    db = get_database()
    
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    if business.get("owner_id") != tenant.user_id and tenant.role not in ("business_owner", "platform_admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this calendar"
        )
    
    start_str = start_date.isoformat() if hasattr(start_date, "isoformat") else str(start_date)
    end_str = end_date.isoformat() if hasattr(end_date, "isoformat") else str(end_date)
    bookings = await db.bookings.find({
        "businessId": business_id,
        "date": {"$gte": start_str, "$lte": end_str}
    }).sort("date", 1).sort("time", 1).to_list(length=None)
    return bookings


@router.patch("/business/{business_id}/detail/{booking_id}/move")
async def move_booking(
    business_id: str,
    booking_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Calendar drag-drop: update time, duration, staffId, tableId."""
    from bson import ObjectId
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    try:
        business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")

    # TenantScopedDB handles all businessId matching automatically
    b = await sdb.bookings.find_one({"_id": booking_id})
    if not b:
        try:
            b = await sdb.bookings.find_one({"_id": ObjectId(booking_id)})
        except Exception:
            pass
    if not b:
        raise HTTPException(404, "Booking not found")

    update = {"updatedAt": datetime.utcnow()}
    if "time" in payload:
        update["time"] = payload["time"]
    if "duration" in payload:
        update["duration"] = payload["duration"]
        if "service" in b and isinstance(b["service"], dict):
            update["service"] = {**b["service"], "duration": payload["duration"]}
    if "staffId" in payload:
        update["staffId"] = payload["staffId"]
    if "tableId" in payload:
        update["tableId"] = payload["tableId"]

    await sdb.bookings.update_one({"_id": b["_id"]}, {"$set": update})

    # Audit trail — immutable record of every move/reschedule
    nb_move = normalize_booking(b)
    changes = []
    if "time" in payload and payload["time"] != b.get("time"):
        changes.append(f"time: {b.get('time', '?')} → {payload['time']}")
    if "staffId" in payload and payload["staffId"] != b.get("staffId"):
        changes.append(f"staff changed")
    if "duration" in payload and payload["duration"] != b.get("duration"):
        changes.append(f"duration: {b.get('duration', 60)}min → {payload['duration']}min")
    if changes:
        await sdb.booking_audit.insert_one({
            "type": "booking_moved",
            "booking_id": str(b["_id"]),
            "booking_ref": nb_move.get("reference", ""),
            "customer_name": nb_move["customer"]["name"] or "Customer",
            "changes": changes,
            "changed_by": tenant.user_email or tenant.user_id,
            "changed_by_role": tenant.role,
            "timestamp": datetime.utcnow(),
            "immutable": True,
        })

    updated = await sdb.bookings.find_one({"_id": b["_id"]})
    return {
        "id": str(updated.get("_id")),
        "time": updated.get("time"),
        "duration": (updated.get("service") or {}).get("duration", updated.get("duration", 60)),
        "staffId": updated.get("staffId"),
        "tableId": updated.get("tableId"),
        "status": updated.get("status"),
    }


@router.patch("/business/{business_id}/detail/{booking_id}/edit")
async def edit_booking_details(
    business_id: str,
    booking_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Calendar edit mode: update customer details, notes, party size, tags, etc."""
    from bson import ObjectId
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    try:
        business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")

    b = await sdb.bookings.find_one({"_id": booking_id})
    if not b:
        try:
            b = await sdb.bookings.find_one({"_id": ObjectId(booking_id)})
        except Exception:
            pass
    if not b:
        raise HTTPException(404, "Booking not found")

    # Allowed fields for edit (accept both legacy and canonical names)
    update = {"updatedAt": datetime.utcnow()}
    audit_changes = []
    for k, v in payload.items():
        if k == "customerName":
            old = (b.get("customer") or {}).get("name", "")
            if v != old:
                audit_changes.append(f"name: {old} → {v}")
            update["customer.name"] = v
        elif k == "phone":
            update["customer.phone"] = v
        elif k == "email":
            update["customer.email"] = v
        elif k == "serviceId":
            # SERVICE SWAP — Natalie's #1 request
            svc_doc = None
            for cat in (business.get("menu") or []):
                if not cat.get("active", True):
                    continue
                for svc in (cat.get("services") or []):
                    if svc.get("id") == v or str(svc.get("_id", "")) == v:
                        svc_doc = svc
                        break
            if svc_doc:
                old_svc = b.get("service", {})
                old_name = old_svc.get("name", "Unknown") if isinstance(old_svc, dict) else str(old_svc)
                new_svc = {"name": svc_doc["name"], "duration": svc_doc.get("duration", 60), "price": svc_doc.get("price", 0)}
                update["service"] = new_svc
                update["duration"] = svc_doc.get("duration", 60)
                audit_changes.append(f"service: {old_name} → {svc_doc['name']}")
        elif k == "staffId":
            old_staff = b.get("staffId", "")
            if v != old_staff:
                audit_changes.append(f"therapist changed")
            update["staffId"] = v
        elif k in {"notes", "partySize", "tags", "tableId", "tableName",
                    "time", "date", "duration", "specialRequests",
                    "dietaryRequirements", "occasion"}:
            if k == "time" and v != b.get("time"):
                audit_changes.append(f"time: {b.get('time', '?')} → {v}")
            if k == "date" and v != b.get("date"):
                audit_changes.append(f"date: {b.get('date', '?')} → {v}")
            update[k] = v

    await sdb.bookings.update_one({"_id": b["_id"]}, {"$set": update})

    # Audit trail for edits
    if audit_changes:
        nb_edit = normalize_booking(b)
        await sdb.booking_audit.insert_one({
            "type": "booking_edited",
            "booking_id": str(b["_id"]),
            "booking_ref": nb_edit.get("reference", ""),
            "customer_name": nb_edit["customer"]["name"] or "Customer",
            "changes": audit_changes,
            "changed_by": tenant.user_email or tenant.user_id,
            "changed_by_role": tenant.role,
            "timestamp": datetime.utcnow(),
            "immutable": True,
        })

    updated = await sdb.bookings.find_one({"_id": b["_id"]})
    staff_map = {st.get("id"): st for st in (await sdb.db.businesses.find_one({"_id": tenant.business_id}) or {}).get("staff", [])}
    return {"detail": "Booking updated", "booking": booking_to_detail(updated, staff_map)}


# ═══════════════════════════════════════════════════════════════
# BOOKING AUDIT TRAIL — immutable history, owner-only access
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/audit")
async def get_booking_audit(
    business_id: str,
    booking_id: str = None,
    limit: int = 100,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get immutable audit trail for bookings. Cannot be deleted by staff."""
    sdb = get_scoped_db(tenant.business_id)

    query = {}
    if booking_id:
        query["booking_id"] = booking_id

    cursor = sdb.booking_audit.find(query).sort("timestamp", -1).limit(limit)
    docs = await cursor.to_list(length=limit)

    entries = []
    for d in docs:
        entries.append({
            "id": str(d.get("_id", "")),
            "type": d.get("type", ""),
            "booking_id": d.get("booking_id", ""),
            "booking_ref": d.get("booking_ref", ""),
            "customer_name": d.get("customer_name", ""),
            "old_value": d.get("old_value"),
            "new_value": d.get("new_value"),
            "changes": d.get("changes", []),
            "changed_by": d.get("changed_by", ""),
            "changed_by_role": d.get("changed_by_role", ""),
            "timestamp": d.get("timestamp"),
        })

    return {"audit": entries, "total": len(entries)}
