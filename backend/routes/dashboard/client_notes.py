"""
Notes System — Staff Alerts, Appointment Notes, Client Booking Notes
====================================================================
Three note types, all tenant-isolated via verify_business_access.

1A: Staff Alert Notes — persistent per client, displayed as gold warnings
1B: Per-Appointment Notes — one-off, attached to a single booking
1C: Client Booking Notes — submitted by client during online booking
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Body
from database import get_database
from middleware.auth import get_current_user
from middleware.tenant import verify_business_access, TenantContext
from bson import ObjectId
import uuid
import logging

logger = logging.getLogger("client_notes")
router = APIRouter(prefix="/notes", tags=["notes"])

VALID_ALERT_CATEGORIES = {"preference", "medical", "operational"}


# ─── 1A: Staff Alert Notes (persistent per client) ───

@router.post("/business/{business_id}/client/{client_id}/alert")
async def create_staff_alert(
    business_id: str,
    client_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Create a staff alert note on a client record."""
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "Alert text is required")
    if len(text) > 500:
        raise HTTPException(400, "Alert text must be 500 characters or fewer")

    category = (payload.get("category") or "operational").strip().lower()
    if category not in VALID_ALERT_CATEGORIES:
        raise HTTPException(400, f"Invalid category. Must be one of: {', '.join(sorted(VALID_ALERT_CATEGORIES))}")

    db = get_database()

    # Verify client exists and belongs to this business
    client = await db.clients.find_one({
        "_id": ObjectId(client_id),
        "businessId": business_id,
    })
    if not client:
        raise HTTPException(404, "Client not found")

    alert = {
        "id": str(uuid.uuid4()),
        "text": text,
        "category": category,
        "created_by": tenant.user_id,
        "created_at": datetime.utcnow().isoformat(),
        "active": True,
    }

    await db.clients.update_one(
        {"_id": ObjectId(client_id), "businessId": business_id},
        {"$push": {"staff_alerts": alert}},
    )

    logger.info(f"Staff alert created: client={client_id} business={business_id} category={category}")
    return {"ok": True, "alert": alert}


@router.get("/business/{business_id}/client/{client_id}/alerts")
async def get_staff_alerts(
    business_id: str,
    client_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get all staff alert notes for a client."""
    db = get_database()

    client = await db.clients.find_one(
        {"_id": ObjectId(client_id), "businessId": business_id},
        {"staff_alerts": 1},
    )
    if not client:
        raise HTTPException(404, "Client not found")

    alerts = client.get("staff_alerts", [])
    return {"alerts": alerts}


@router.delete("/business/{business_id}/client/{client_id}/alert/{alert_id}")
async def delete_staff_alert(
    business_id: str,
    client_id: str,
    alert_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Delete (remove) a staff alert note from a client."""
    db = get_database()

    result = await db.clients.update_one(
        {"_id": ObjectId(client_id), "businessId": business_id},
        {"$pull": {"staff_alerts": {"id": alert_id}}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Client not found")
    if result.modified_count == 0:
        raise HTTPException(404, "Alert not found")

    logger.info(f"Staff alert deleted: alert={alert_id} client={client_id} business={business_id}")
    return {"ok": True}


# ─── 1B: Per-Appointment Notes (one-off, this session only) ───

@router.patch("/business/{business_id}/booking/{booking_id}/appointment-note")
async def set_appointment_note(
    business_id: str,
    booking_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Set or update a per-appointment note (staff-facing, single session)."""
    text = (payload.get("text") or "").strip()
    if len(text) > 1000:
        raise HTTPException(400, "Appointment note must be 1000 characters or fewer")

    db = get_database()

    booking = await db.bookings.find_one({
        "_id": ObjectId(booking_id),
        "businessId": business_id,
    })
    if not booking:
        raise HTTPException(404, "Booking not found")

    if text:
        note = {
            "text": text,
            "created_by": tenant.user_id,
            "created_at": datetime.utcnow().isoformat(),
        }
        update = {"$set": {"appointment_note": note}}
    else:
        # Empty text = clear the note
        update = {"$unset": {"appointment_note": ""}}

    await db.bookings.update_one(
        {"_id": ObjectId(booking_id), "businessId": business_id},
        update,
    )

    logger.info(f"Appointment note {'set' if text else 'cleared'}: booking={booking_id} business={business_id}")
    return {"ok": True}


# ─── 1C: Client Booking Notes (client-facing, submitted during booking) ───

@router.patch("/business/{business_id}/booking/{booking_id}/client-note")
async def set_client_note(
    business_id: str,
    booking_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Set a client-submitted note on a booking (added during online booking)."""
    text = (payload.get("text") or "").strip()
    if len(text) > 500:
        raise HTTPException(400, "Client note must be 500 characters or fewer")

    db = get_database()

    booking = await db.bookings.find_one({
        "_id": ObjectId(booking_id),
        "businessId": business_id,
    })
    if not booking:
        raise HTTPException(404, "Booking not found")

    if text:
        note = {
            "text": text,
            "submitted_at": datetime.utcnow().isoformat(),
        }
        update = {"$set": {"client_note": note}}
    else:
        update = {"$unset": {"client_note": ""}}

    await db.bookings.update_one(
        {"_id": ObjectId(booking_id), "businessId": business_id},
        update,
    )

    logger.info(f"Client note {'set' if text else 'cleared'}: booking={booking_id} business={business_id}")
    return {"ok": True}
