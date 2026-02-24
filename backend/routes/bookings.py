from fastapi import APIRouter, HTTPException, status, Depends, Query, Body
from database import get_database
from models.reservation import (
    ReservationCreate, ReservationUpdate, ReservationResponse,
    ReservationStatus, DepositStatus
)
from middleware.auth import get_current_user, get_current_staff
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
    
    result = await db.reservations.insert_one(reservation_dict)
    reservation_id = str(result.inserted_id)
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"booking_history": reservation_id}}
    )
    
    reservation_dict["_id"] = reservation_id
    
    return ReservationResponse(
        id=reservation_id,
        business_id=reservation_dict["business_id"],
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
    
    reservation = await db.reservations.find_one({"_id": reservation_id})
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found"
        )
    
    business = await db.businesses.find_one({"_id": reservation["business_id"]})
    
    if (reservation["user_id"] != str(current_user["_id"]) and 
        business.get("owner_id") != str(current_user["_id"]) and
        current_user.get("role") not in ["staff", "admin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this reservation"
        )
    
    return ReservationResponse(
        id=str(reservation["_id"]),
        business_id=reservation["business_id"],
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
    
    reservation = await db.reservations.find_one({"_id": reservation_id})
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found"
        )
    
    business = await db.businesses.find_one({"_id": reservation["business_id"]})
    
    if (reservation["user_id"] != str(current_user["_id"]) and 
        business.get("owner_id") != str(current_user["_id"]) and
        current_user.get("role") not in ["staff", "admin"]):
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
    
    await db.reservations.update_one(
        {"_id": reservation_id},
        {"$set": update_data}
    )
    
    updated_reservation = await db.reservations.find_one({"_id": reservation_id})
    
    return ReservationResponse(
        id=str(updated_reservation["_id"]),
        business_id=updated_reservation["business_id"],
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
    
    reservation = await db.reservations.find_one({"_id": reservation_id})
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
    
    await db.reservations.update_one(
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
    current_user: dict = Depends(get_current_staff),
):
    """Run 3: Paginated bookings list with filters."""
    from bson import ObjectId
    db = get_database()
    try:
        business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")
    if str(business.get("owner_id")) != str(current_user.get("_id")) and current_user.get("role") not in ["staff", "admin"]:
        raise HTTPException(403, "Not authorized")

    match = {"businessId": business_id}
    if status != "all":
        match["status"] = status
    if from_date:
        match.setdefault("date", {})["$gte"] = from_date
    if to_date:
        match.setdefault("date", {})["$lte"] = to_date
    if search:
        # Search customer name, reference, phone, email
        match["$or"] = [
            {"customer.name": {"$regex": search, "$options": "i"}},
            {"reference": {"$regex": search, "$options": "i"}},
            {"customer.phone": {"$regex": search, "$options": "i"}},
            {"customer.email": {"$regex": search, "$options": "i"}},
        ]

    total = await db.bookings.count_documents(match)
    sort_dir = -1 if sort == "date_desc" else 1
    cursor = db.bookings.find(match).sort("date", sort_dir).sort("time", sort_dir).skip((page - 1) * limit).limit(limit)
    docs = await cursor.to_list(length=None)

    staff_map = {st.get("id"): st for st in business.get("staff", [])}

    bookings = []
    for d in docs:
        staff = staff_map.get(d.get("staffId"), {})
        svc = d.get("service") or {}
        bookings.append({
            "id": d.get("_id"),
            "reference": d.get("reference"),
            "customerName": (d.get("customer") or {}).get("name", ""),
            "customerPhone": (d.get("customer") or {}).get("phone", ""),
            "customerEmail": (d.get("customer") or {}).get("email", ""),
            "service": svc.get("name", "Booking"),
            "staff": staff.get("name", ""),
            "date": d.get("date"),
            "time": d.get("time"),
            "duration": svc.get("duration", 60),
            "status": d.get("status", "confirmed"),
            "source": d.get("source", "online"),
            "depositPaid": (d.get("deposit") or {}).get("status") == "paid",
            "createdAt": d.get("createdAt"),
        })

    counts = {}
    for s in ["all", "confirmed", "pending", "checked_in", "completed", "cancelled", "no_show"]:
        m = {"businessId": business_id}
        if s != "all":
            m["status"] = s
        counts[s] = await db.bookings.count_documents(m)

    return {
        "bookings": bookings,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit or 1},
        "counts": counts,
    }


@router.get("/business/{business_id}/detail/{booking_id}")
async def get_booking_detail(
    business_id: str,
    booking_id: str,
    current_user: dict = Depends(get_current_staff),
):
    """Run 3: Full booking detail for side panel."""
    db = get_database()
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")
    if str(business.get("owner_id")) != str(current_user.get("_id")) and current_user.get("role") not in ["staff", "admin"]:
        raise HTTPException(403, "Not authorized")

    b = await db.bookings.find_one({"_id": booking_id, "businessId": business_id})
    if not b:
        raise HTTPException(404, "Booking not found")

    staff = next((st for st in business.get("staff", []) if st.get("id") == b.get("staffId")), {})
    svc = b.get("service") or {}

    return {
        "booking": {
            "id": b.get("_id"),
            "reference": b.get("reference"),
            "status": b.get("status"),
            "type": b.get("type", "services"),
            "customer": {
                "name": (b.get("customer") or {}).get("name", ""),
                "phone": (b.get("customer") or {}).get("phone", ""),
                "email": (b.get("customer") or {}).get("email", ""),
                "isNew": True,
                "totalBookings": 1,
            },
            "service": {"name": svc.get("name"), "duration": svc.get("duration", 60), "price": svc.get("price")},
            "staff": {"id": b.get("staffId"), "name": staff.get("name", "")},
            "date": b.get("date"),
            "time": b.get("time"),
            "endTime": b.get("endTime"),
            "notes": b.get("notes"),
            "source": b.get("source", "online"),
            "deposit": b.get("deposit", {}),
            "history": [{"action": "created", "timestamp": b.get("createdAt"), "by": "customer"}],
        }
    }


@router.patch("/business/{business_id}/detail/{booking_id}/status")
async def update_booking_status(
    business_id: str,
    booking_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_staff),
):
    """Run 3: Update booking status (confirm, check-in, complete, cancel, no-show)."""
    db = get_database()
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")
    if str(business.get("owner_id")) != str(current_user.get("_id")) and current_user.get("role") not in ["staff", "admin"]:
        raise HTTPException(403, "Not authorized")

    b = await db.bookings.find_one({"_id": booking_id, "businessId": business_id})
    if not b:
        raise HTTPException(404, "Booking not found")

    new_status = payload.get("status")
    valid = {"pending", "confirmed", "checked_in", "completed", "cancelled", "no_show"}
    if new_status not in valid:
        raise HTTPException(400, f"Invalid status. Use one of: {valid}")

    await db.bookings.update_one(
        {"_id": booking_id},
        {"$set": {"status": new_status, "updatedAt": datetime.utcnow()}},
    )

    # Log to activity
    cust = (b.get("customer") or {}).get("name", "Customer")
    await db.activity_log.insert_one({
        "businessId": business_id,
        "type": f"booking_{new_status}" if new_status != "cancelled" else "booking_cancelled",
        "message": f"Booking {b.get('reference', '')} {new_status}: {cust}",
        "bookingId": booking_id,
        "timestamp": datetime.utcnow(),
    })

    updated = await db.bookings.find_one({"_id": booking_id})
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
    current_user: dict = Depends(get_current_staff)
):
    db = get_database()
    
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    if business.get("owner_id") != str(current_user["_id"]) and current_user.get("role") != "admin":
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
    current_user: dict = Depends(get_current_staff),
):
    """Calendar drag-drop: update time, duration, staffId, tableId."""
    from bson import ObjectId
    db = get_database()
    try:
        business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(404, "Business not found")
    if str(business.get("owner_id")) != str(current_user.get("_id")) and current_user.get("role") not in ["staff", "admin"]:
        raise HTTPException(403, "Not authorized")

    bid_str = str(business.get("_id"))
    b = await db.bookings.find_one({"_id": booking_id, "businessId": business_id})
    if not b:
        try:
            b = await db.bookings.find_one({"_id": ObjectId(booking_id), "businessId": business_id})
        except Exception:
            pass
    if not b:
        b = await db.bookings.find_one({"_id": booking_id, "businessId": bid_str})
    if not b:
        try:
            b = await db.bookings.find_one({"_id": ObjectId(booking_id), "businessId": bid_str})
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

    await db.bookings.update_one({"_id": b["_id"]}, {"$set": update})

    updated = await db.bookings.find_one({"_id": b["_id"]})
    return {
        "id": str(updated.get("_id")),
        "time": updated.get("time"),
        "duration": (updated.get("service") or {}).get("duration", updated.get("duration", 60)),
        "staffId": updated.get("staffId"),
        "tableId": updated.get("tableId"),
        "status": updated.get("status"),
    }
