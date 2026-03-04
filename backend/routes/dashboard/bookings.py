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
    
    if reservation["user_id"] != str(current_user["_id"]):
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
            {"client_name": {"$regex": search, "$options": "i"}},
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

    bookings = []
    for d in docs:
        staff = staff_map.get(d.get("staffId") or d.get("server_id"), {})
        svc = d.get("service") or {}
        # Normalize customer name from ALL formats (seeded, API-created, legacy)
        if d.get("customer") and isinstance(d["customer"], dict):
            cust_name = d["customer"].get("name", "")
            cust_phone = d["customer"].get("phone", "")
            cust_email = d["customer"].get("email", "")
        else:
            cust_name = d.get("customerName") or d.get("client_name") or d.get("guest_name") or ""
            cust_phone = d.get("customerPhone") or d.get("client_phone") or d.get("phone") or ""
            cust_email = d.get("customerEmail") or d.get("client_email") or d.get("email") or ""
        bookings.append({
            "id": str(d.get("_id", "")),
            "reference": d.get("reference", ""),
            "customerName": cust_name,
            "customerPhone": cust_phone,
            "customerEmail": cust_email,
            "service": svc.get("name") or d.get("service_period") or "Booking",
            "staff": staff.get("name", ""),
            "date": d.get("date"),
            "time": d.get("time") or d.get("start_time", ""),
            "partySize": d.get("partySize") or d.get("party_size"),
            "duration": svc.get("duration") or d.get("duration") or d.get("turn_time") or 60,
            "status": d.get("status", "confirmed"),
            "source": d.get("source") or d.get("channel") or "online",
            "occasion": d.get("occasion"),
            "tableName": d.get("table_name", ""),
            "isVip": d.get("is_vip") or d.get("isVip", False),
            "depositPaid": (d.get("deposit") or {}).get("status") == "paid" or d.get("deposit_paid", False),
            "createdAt": d.get("createdAt") or d.get("created_at"),
        })

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

    staff = next((st for st in business.get("staff", []) if st.get("id") in [b.get("staffId"), b.get("server_id")]), {})
    svc = b.get("service") or {}

    # Normalize customer from ALL formats (seeded, API-created, legacy)
    if b.get("customer") and isinstance(b["customer"], dict):
        cust = b["customer"]
    else:
        cust = {
            "name": b.get("customerName") or b.get("client_name") or b.get("guest_name") or "",
            "phone": b.get("customerPhone") or b.get("client_phone") or b.get("phone") or "",
            "email": b.get("customerEmail") or b.get("client_email") or b.get("email") or "",
        }

    return {
        "booking": {
            "id": str(b.get("_id", "")),
            "reference": b.get("reference", ""),
            "status": b.get("status"),
            "type": b.get("type", "restaurant" if b.get("table_id") or b.get("tableId") else "services"),
            "customer": {
                "name": cust.get("name", ""),
                "phone": cust.get("phone", ""),
                "email": cust.get("email", ""),
                "isNew": b.get("is_new_client", True),
                "totalBookings": 1,
            },
            "service": {"name": svc.get("name") or b.get("service_period"), "duration": svc.get("duration") or b.get("turn_time", 60), "price": svc.get("price")},
            "staff": {"id": b.get("staffId") or b.get("server_id"), "name": staff.get("name", "")},
            "date": b.get("date"),
            "time": b.get("time") or b.get("start_time"),
            "endTime": b.get("endTime") or b.get("end_time"),
            "partySize": b.get("partySize") or b.get("party_size"),
            "tableName": b.get("table_name", ""),
            "occasion": b.get("occasion"),
            "isVip": b.get("is_vip") or b.get("isVip", False),
            "notes": b.get("notes"),
            "source": b.get("source") or b.get("channel", "online"),
            "deposit": b.get("deposit", {}),
            "history": [{"action": "created", "timestamp": b.get("createdAt") or b.get("created_at"), "by": "customer"}],
        }
    }


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

    await sdb.bookings.update_one(
        {"_id": doc_id},
        {"$set": {"status": new_status, "updatedAt": datetime.utcnow()}},
    )

    # Log to activity
    cust_name = ""
    if b.get("customer") and isinstance(b["customer"], dict):
        cust_name = b["customer"].get("name", "Customer")
    else:
        cust_name = b.get("client_name", "Customer")
    await sdb.activity_log.insert_one({
        "type": f"booking_{new_status}" if new_status != "cancelled" else "booking_cancelled",
        "message": f"Booking {b.get('reference', '')} {new_status}: {cust_name}",
        "bookingId": str(doc_id),
        "timestamp": datetime.utcnow(),
    })

    updated = await sdb.bookings.find_one({"_id": doc_id})
    staff = next((st for st in business.get("staff", []) if st.get("id") == updated.get("staffId")), {})
    svc = updated.get("service") or {}
    return {
        "id": updated.get("_id"),
        "reference": updated.get("reference"),
        "status": updated.get("status"),
        "customerName": (updated.get("customer") or {}).get("name"),
        "service": svc.get("name"),
        "staff": staff.get("name"),
        "date": updated.get("date"),
        "time": updated.get("time"),
    }


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
    
    if business.get("owner_id") != tenant.user_id and tenant.role not in ("platform_admin", "super_admin"):
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

    # Allowed fields for edit
    allowed = {
        "customerName", "phone", "email", "notes", "partySize",
        "tags", "tableId", "time", "date", "duration", "specialRequests",
        "dietaryRequirements", "occasion",
    }
    update = {"updatedAt": datetime.utcnow()}
    for k, v in payload.items():
        if k in allowed:
            update[k] = v

    await sdb.bookings.update_one({"_id": b["_id"]}, {"$set": update})

    updated = await sdb.bookings.find_one({"_id": b["_id"]})
    if updated and "_id" in updated:
        updated["_id"] = str(updated["_id"])
    return {"detail": "Booking updated", "booking": updated}
