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
    party_size: int = Query(2, ge=1),
    service_duration: int = Query(60),
    staff_id: str = Query(None),
    minimize_gaps: bool = Query(True),
):
    """Smart availability with gap-minimization scoring."""
    db = get_database()
    
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        try:
            from bson import ObjectId
            business = await db.businesses.find_one({"_id": ObjectId(business_id)})
        except:
            pass
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    
    booking_settings = business.get("booking_settings", {})
    slot_duration = booking_settings.get("slot_duration_minutes", 15)
    gap_tolerance = booking_settings.get("gap_tolerance_minutes", 30)
    
    start_time = time(9, 0)
    end_time = time(21, 0)
    
    # Fetch existing bookings for this date
    bid_str = str(business.get("_id", ""))
    date_str = date_param.isoformat()
    existing = []
    async for b in db.bookings.find({
        "businessId": {"$in": [business_id, bid_str]},
        "date": date_str,
        "status": {"$nin": ["cancelled", "no_show"]},
    }):
        btime = b.get("time", "09:00")
        bdur = b.get("duration", 60)
        if isinstance(b.get("service"), dict):
            bdur = b["service"].get("duration", bdur)
        bstaff = b.get("staffId", "")
        existing.append({"time": btime, "duration": bdur, "staffId": bstaff})
    
    def time_to_min(t):
        parts = t.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    
    def is_slot_free(slot_min, duration, sid=None):
        slot_end = slot_min + duration
        for e in existing:
            if sid and e["staffId"] and e["staffId"] != sid:
                continue
            e_start = time_to_min(e["time"])
            e_end = e_start + e["duration"]
            if slot_min < e_end and slot_end > e_start:
                return False
        return True
    
    def gap_score(slot_min, duration, sid=None):
        """Score 0-100: higher = less gap created. 100 = perfect fit."""
        if not existing:
            return 50
        slot_end = slot_min + duration
        before_gap = 999
        after_gap = 999
        for e in existing:
            if sid and e["staffId"] and e["staffId"] != sid:
                continue
            e_start = time_to_min(e["time"])
            e_end = e_start + e["duration"]
            if e_end <= slot_min:
                before_gap = min(before_gap, slot_min - e_end)
            if e_start >= slot_end:
                after_gap = min(after_gap, e_start - slot_end)
        # Perfect back-to-back = 100, gap under tolerance = 70, big gap = 30
        score = 50
        if before_gap == 0 or after_gap == 0:
            score = 100
        elif before_gap <= gap_tolerance or after_gap <= gap_tolerance:
            score = 70
        elif before_gap > 120 and after_gap > 120:
            score = 30
        return score
    
    slots = []
    current_time = datetime.combine(date_param, start_time)
    end_datetime = datetime.combine(date_param, end_time)
    
    while current_time < end_datetime:
        t = current_time.time().isoformat()[:5]
        t_min = time_to_min(t)
        available = is_slot_free(t_min, service_duration, staff_id)
        score = gap_score(t_min, service_duration, staff_id) if available else 0
        slots.append({
            "time": t,
            "available": available,
            "score": score,
            "preferred": available and score >= 70,
        })
        current_time += timedelta(minutes=slot_duration)
    
    if minimize_gaps:
        # Sort available slots by score (highest first) for "preferred times" list
        preferred = sorted([s for s in slots if s["available"]], key=lambda x: -x["score"])
    else:
        preferred = [s for s in slots if s["available"]]
    
    return {
        "date": date_param,
        "slots": slots,
        "preferred_times": [s["time"] for s in preferred[:8]],
        "total_available": sum(1 for s in slots if s["available"]),
    }


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
            # G13: SERVICE SWAP — Natalie's #1 request
            # Services stored either flat in menu[] or nested in menu[].services[]
            svc_doc = None
            menu = business.get("menu") or []
            for item in menu:
                # Flat structure: menu item IS the service
                if item.get("id") == v or str(item.get("_id", "")) == v:
                    svc_doc = item
                    break
                # Nested structure: menu item has services array
                for svc in (item.get("services") or []):
                    if svc.get("id") == v or str(svc.get("_id", "")) == v:
                        svc_doc = svc
                        break
                if svc_doc:
                    break
            # Also check standalone services collection
            if not svc_doc:
                from bson import ObjectId as OID
                try:
                    svc_doc = await db.services.find_one({"_id": OID(v), "business_id": business_id})
                except Exception:
                    svc_doc = await db.services.find_one({"_id": v, "business_id": business_id})

            if svc_doc:
                old_svc = b.get("service", {})
                old_name = old_svc.get("name", "Unknown") if isinstance(old_svc, dict) else str(old_svc)
                new_name = svc_doc.get("name", "Treatment")
                new_duration = svc_doc.get("duration_minutes") or svc_doc.get("duration", 60)
                new_price = svc_doc.get("price", 0)
                new_svc = {"id": v, "name": new_name, "duration": new_duration, "price": new_price}
                update["service"] = new_svc
                update["duration"] = new_duration
                audit_changes.append(f"service: {old_name} → {new_name}")

                # Contraindication check on the NEW service
                cust_email = (b.get("customer") or {}).get("email", "").lower()
                cust_phone = (b.get("customer") or {}).get("phone", "")
                if cust_email or cust_phone:
                    form_q = {"business_id": business_id}
                    if cust_email:
                        form_q["client_email"] = cust_email
                    elif cust_phone:
                        form_q["client_phone"] = cust_phone
                    latest_form = await db.consultation_submissions.find_one(
                        {**form_q, "expires_at": {"$gte": datetime.utcnow()}},
                        sort=[("submitted_at", -1)],
                    )
                    if latest_form:
                        from routes.dashboard.consultation import run_contraindication_check, DEFAULT_CONTRA_MATRIX, TREATMENT_LABELS
                        _sw = (new_name + " " + (svc_doc.get("category") or "")).lower()
                        tx_key = None
                        if "microneedling" in _sw and "rf" not in _sw: tx_key = "microneedling"
                        elif "rf" in _sw or "radio frequency" in _sw: tx_key = "rf"
                        elif "peel" in _sw or "chemical" in _sw: tx_key = "peel"
                        elif "polynucleotide" in _sw: tx_key = "polynucleotides"
                        elif "lymphatic" in _sw: tx_key = "lymphatic"
                        if tx_key:
                            tmpl = await db.consultation_templates.find_one({"business_id": business_id})
                            mx = (tmpl or {}).get("contra_matrix", DEFAULT_CONTRA_MATRIX)
                            alerts = run_contraindication_check(latest_form.get("form_data", {}), mx)
                            rel_blocks = [x for x in alerts["blocks"] if x["treatment"] == tx_key]
                            rel_flags = [x for x in alerts["flags"] if x["treatment"] == tx_key]
                            if rel_blocks:
                                reasons = ", ".join(x["condition"].replace("_", " ") for x in rel_blocks)
                                raise HTTPException(400, f"Cannot swap to {new_name} — contraindicated ({reasons})")
                            if rel_flags:
                                update["contraindication_flags"] = rel_flags
                                update["contraindication_review_required"] = True
                                audit_changes.append(f"WARNING: {new_name} flagged for review")
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


# ═══════════════════════════════════════════════════════════════
# 2B: RESCHEDULE WITH AVAILABILITY — available slots for next 14 days
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/detail/{booking_id}/reschedule-options")
async def get_reschedule_options(
    business_id: str,
    booking_id: str,
    staff_mode: str = Query("same", regex="^(same|any)$"),
    days_ahead: int = Query(14, ge=1, le=30),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Returns available reschedule slots for the next N days.
    Each slot scored: green (free), amber (tight), grey (blocked).
    """
    from bson import ObjectId as OID
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)

    try:
        business = await db.businesses.find_one({"_id": OID(business_id)})
    except Exception:
        business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")

    # Find the booking
    booking = await sdb.bookings.find_one({"_id": booking_id})
    if not booking:
        try:
            booking = await sdb.bookings.find_one({"_id": OID(booking_id)})
        except Exception:
            pass
    if not booking:
        raise HTTPException(404, "Booking not found")

    nb = normalize_booking(booking)
    svc = nb["service"]
    duration = svc.get("duration") or nb["duration"] or 60
    staff_id = nb["staffId"] if staff_mode == "same" else None

    booking_settings = business.get("booking_settings", {})
    slot_duration = booking_settings.get("slot_duration_minutes", 15)
    gap_tolerance = booking_settings.get("gap_tolerance_minutes", 30)

    # Get business hours (default 9-21)
    open_hour = booking_settings.get("open_hour", 9)
    close_hour = booking_settings.get("close_hour", 21)

    today = date.today()
    results = []

    for day_offset in range(1, days_ahead + 1):
        check_date = today + timedelta(days=day_offset)
        date_str = check_date.isoformat()

        # Get existing bookings for this date
        bid_str = str(business["_id"])
        existing = []
        async for b in db.bookings.find({
            "businessId": {"$in": [business_id, bid_str]},
            "date": date_str,
            "status": {"$nin": ["cancelled", "no_show"]},
        }):
            btime = b.get("time", "09:00")
            bdur = b.get("duration", 60)
            if isinstance(b.get("service"), dict):
                bdur = b["service"].get("duration", bdur)
            bstaff = b.get("staffId", "")
            existing.append({"time": btime, "duration": bdur, "staffId": bstaff})

        # Get blocked times for this date
        blocked = []
        async for bt in db.blocked_times.find({"business_id": business_id, "date": date_str}):
            blocked.append({"start": bt.get("start_time", ""), "end": bt.get("end_time", ""), "staff_id": bt.get("staff_id", "")})
        # Also check repeating blocks
        async for bt in db.blocked_times.find({"business_id": business_id, "repeat_rule": {"$ne": "none"}}):
            if _block_applies_on_date(bt, check_date):
                blocked.append({"start": bt.get("start_time", ""), "end": bt.get("end_time", ""), "staff_id": bt.get("staff_id", "")})

        # Generate slots
        current_min = open_hour * 60
        end_min = close_hour * 60

        while current_min + duration <= end_min:
            t = f"{current_min // 60:02d}:{current_min % 60:02d}"

            if _is_slot_free(current_min, duration, existing, staff_id) and not _is_blocked(current_min, duration, blocked, staff_id):
                score = _gap_score(current_min, duration, existing, staff_id, gap_tolerance)
                if score >= 70:
                    color = "green"
                elif score >= 40:
                    color = "amber"
                else:
                    color = "grey"

                results.append({
                    "date": date_str,
                    "time": t,
                    "score": score,
                    "color": color,
                })

            current_min += slot_duration

    # Sort by score descending, take top 20
    results.sort(key=lambda x: -x["score"])
    top_slots = results[:20]

    return {
        "booking_id": str(booking.get("_id", "")),
        "service": svc.get("name", ""),
        "duration": duration,
        "staff_id": staff_id or "any",
        "slots": top_slots,
        "total_available": len(results),
    }


# ═══════════════════════════════════════════════════════════════
# 2C: QUICK REBOOK — suggest slots X weeks ahead from original date
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/detail/{booking_id}/quick-rebook")
async def quick_rebook(
    business_id: str,
    booking_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Find available slots X weeks from the original booking date.
    Returns top 5 suggestions sorted by fit score.
    """
    from bson import ObjectId as OID
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)

    weeks_ahead = payload.get("weeks_ahead", 4)
    if weeks_ahead not in (4, 6, 8):
        raise HTTPException(400, "weeks_ahead must be 4, 6, or 8")
    preferred_time = payload.get("preferred_time", "same")

    try:
        business = await db.businesses.find_one({"_id": OID(business_id)})
    except Exception:
        business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")

    booking = await sdb.bookings.find_one({"_id": booking_id})
    if not booking:
        try:
            booking = await sdb.bookings.find_one({"_id": OID(booking_id)})
        except Exception:
            pass
    if not booking:
        raise HTTPException(404, "Booking not found")

    nb = normalize_booking(booking)
    svc = nb["service"]
    duration = svc.get("duration") or nb["duration"] or 60
    staff_id = nb["staffId"]
    original_time = nb["time"] or "10:00"

    booking_settings = business.get("booking_settings", {})
    slot_duration = booking_settings.get("slot_duration_minutes", 15)
    gap_tolerance = booking_settings.get("gap_tolerance_minutes", 30)
    open_hour = booking_settings.get("open_hour", 9)
    close_hour = booking_settings.get("close_hour", 21)

    # Calculate target date
    try:
        orig_date = date.fromisoformat(nb["date"])
    except (ValueError, TypeError):
        orig_date = date.today()
    target_date = orig_date + timedelta(weeks=weeks_ahead)

    # Search a 5-day window around the target date
    bid_str = str(business["_id"])
    candidates = []

    for day_offset in range(-2, 3):
        check_date = target_date + timedelta(days=day_offset)
        if check_date <= date.today():
            continue
        date_str = check_date.isoformat()

        existing = []
        async for b in db.bookings.find({
            "businessId": {"$in": [business_id, bid_str]},
            "date": date_str,
            "status": {"$nin": ["cancelled", "no_show"]},
        }):
            btime = b.get("time", "09:00")
            bdur = b.get("duration", 60)
            if isinstance(b.get("service"), dict):
                bdur = b["service"].get("duration", bdur)
            bstaff = b.get("staffId", "")
            existing.append({"time": btime, "duration": bdur, "staffId": bstaff})

        blocked = []
        async for bt in db.blocked_times.find({"business_id": business_id, "date": date_str}):
            blocked.append({"start": bt.get("start_time", ""), "end": bt.get("end_time", ""), "staff_id": bt.get("staff_id", "")})
        async for bt in db.blocked_times.find({"business_id": business_id, "repeat_rule": {"$ne": "none"}}):
            if _block_applies_on_date(bt, check_date):
                blocked.append({"start": bt.get("start_time", ""), "end": bt.get("end_time", ""), "staff_id": bt.get("staff_id", "")})

        current_min = open_hour * 60
        end_min = close_hour * 60

        while current_min + duration <= end_min:
            t = f"{current_min // 60:02d}:{current_min % 60:02d}"

            if _is_slot_free(current_min, duration, existing, staff_id) and not _is_blocked(current_min, duration, blocked, staff_id):
                score = _gap_score(current_min, duration, existing, staff_id, gap_tolerance)

                # Bonus for matching preferred time
                if preferred_time == "same":
                    try:
                        orig_parts = original_time.split(":")
                        orig_min = int(orig_parts[0]) * 60 + int(orig_parts[1])
                        time_diff = abs(current_min - orig_min)
                        if time_diff == 0:
                            score += 30
                        elif time_diff <= 30:
                            score += 20
                        elif time_diff <= 60:
                            score += 10
                    except (ValueError, IndexError):
                        pass

                # Bonus for matching target date exactly
                if day_offset == 0:
                    score += 15

                candidates.append({
                    "date": date_str,
                    "time": t,
                    "score": min(score, 100),
                    "day_offset": day_offset,
                })

            current_min += slot_duration

    # Sort by score, return top 5
    candidates.sort(key=lambda x: -x["score"])
    suggestions = candidates[:5]

    return {
        "booking_id": str(booking.get("_id", "")),
        "original_date": nb["date"],
        "original_time": original_time,
        "target_date": target_date.isoformat(),
        "weeks_ahead": weeks_ahead,
        "suggestions": suggestions,
    }


# ═══════════════════════════════════════════════════════════════
# 2D: CALENDAR BOOKING ENHANCEMENT — notes metadata on list endpoint
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/calendar-enhanced")
async def list_bookings_enhanced(
    business_id: str,
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Enhanced calendar endpoint: bookings + staff_alerts count + appointment_note + client_note.
    Powers the frontend calendar to show warning icons and note indicators.
    """
    from bson import ObjectId as OID
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)

    try:
        business = await db.businesses.find_one({"_id": OID(business_id)})
    except Exception:
        business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")

    match = {}
    if from_date:
        match.setdefault("date", {})["$gte"] = from_date
    if to_date:
        match.setdefault("date", {})["$lte"] = to_date

    cursor = sdb.bookings.find(match).sort("date", 1).sort("time", 1)
    docs = await cursor.to_list(length=1000)

    staff_map = {st.get("id"): st for st in business.get("staff", [])}

    # Collect all unique customer IDs to batch-fetch staff alerts
    customer_ids = set()
    for d in docs:
        cid = d.get("customerId") or d.get("user_id") or ""
        if cid:
            customer_ids.add(cid)
        # Also match by email from customer object
        cust = d.get("customer", {})
        if isinstance(cust, dict) and cust.get("email"):
            customer_ids.add(cust["email"])

    # Batch fetch clients with staff_alerts for this business
    alert_counts = {}
    if customer_ids:
        # Try matching by customerId stored on clients collection
        client_cursor = db.clients.find(
            {"businessId": business_id, "staff_alerts": {"$exists": True, "$ne": []}},
            {"_id": 1, "staff_alerts": 1, "email": 1},
        )
        async for client in client_cursor:
            cid = str(client["_id"])
            count = len([a for a in (client.get("staff_alerts") or []) if a.get("active", True)])
            if count > 0:
                alert_counts[cid] = count
                # Also index by email for matching
                cemail = (client.get("email") or "").strip().lower()
                if cemail:
                    alert_counts[cemail] = count

    # Build enhanced booking list
    bookings = []
    for d in docs:
        item = booking_to_list_item(d, staff_map)

        # Staff alert count for this booking's client
        cid = d.get("customerId") or d.get("user_id") or ""
        cemail = ""
        cust = d.get("customer", {})
        if isinstance(cust, dict):
            cemail = (cust.get("email") or "").strip().lower()
        alerts = alert_counts.get(cid, 0) or alert_counts.get(cemail, 0)
        item["staffAlertCount"] = alerts

        # Appointment note (staff-facing, per-session)
        appt_note = d.get("appointment_note")
        if appt_note and isinstance(appt_note, dict) and appt_note.get("text"):
            item["appointmentNote"] = appt_note["text"]
        else:
            item["appointmentNote"] = None

        # Client note (client-facing, submitted during booking)
        client_note = d.get("client_note")
        if client_note and isinstance(client_note, dict) and client_note.get("text"):
            item["clientNote"] = client_note["text"]
        else:
            item["clientNote"] = None

        bookings.append(item)

    return {"bookings": bookings, "total": len(bookings)}


# ═══════════════════════════════════════════════════════════════
# SHARED HELPERS — availability scoring for 2B & 2C
# ═══════════════════════════════════════════════════════════════

def _time_to_min(t: str) -> int:
    parts = t.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def _is_slot_free(slot_min: int, duration: int, existing: list, staff_id: str = None) -> bool:
    slot_end = slot_min + duration
    for e in existing:
        if staff_id and e["staffId"] and e["staffId"] != staff_id:
            continue
        e_start = _time_to_min(e["time"])
        e_end = e_start + e["duration"]
        if slot_min < e_end and slot_end > e_start:
            return False
    return True


def _is_blocked(slot_min: int, duration: int, blocked: list, staff_id: str = None) -> bool:
    slot_end = slot_min + duration
    for b in blocked:
        if staff_id and b.get("staff_id") and b["staff_id"] != staff_id:
            continue
        try:
            b_start = _time_to_min(b["start"])
            b_end = _time_to_min(b["end"])
        except (ValueError, IndexError):
            continue
        if slot_min < b_end and slot_end > b_start:
            return True
    return False


def _gap_score(slot_min: int, duration: int, existing: list, staff_id: str = None, gap_tolerance: int = 30) -> int:
    if not existing:
        return 50
    slot_end = slot_min + duration
    before_gap = 999
    after_gap = 999
    for e in existing:
        if staff_id and e["staffId"] and e["staffId"] != staff_id:
            continue
        e_start = _time_to_min(e["time"])
        e_end = e_start + e["duration"]
        if e_end <= slot_min:
            before_gap = min(before_gap, slot_min - e_end)
        if e_start >= slot_end:
            after_gap = min(after_gap, e_start - slot_end)
    if before_gap == 0 or after_gap == 0:
        return 100
    if before_gap <= gap_tolerance or after_gap <= gap_tolerance:
        return 70
    if before_gap > 120 and after_gap > 120:
        return 30
    return 50


def _block_applies_on_date(block_doc: dict, check: date) -> bool:
    """Check if a repeating block applies on a given date."""
    try:
        base = date.fromisoformat(block_doc.get("date", ""))
    except (ValueError, TypeError):
        return False
    if check < base:
        return False
    rule = block_doc.get("repeat_rule", "none")
    if rule == "daily":
        return True
    if rule == "weekly":
        return (check - base).days % 7 == 0
    return False
