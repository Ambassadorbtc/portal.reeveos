"""
Clinical Workflow — Check-in, Completion/Treatment Record, Therapist Preference
================================================================================
All medical data encrypted via TenantEncryption.
All access logged via medical_audit.
All endpoints tenant-isolated via verify_business_access.
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from database import get_database
from middleware.auth import get_current_user
from middleware.tenant import verify_business_access, TenantContext
from middleware.tenant_db import get_scoped_db
from middleware.encryption import TenantEncryption
from middleware.medical_audit import log_medical_access
from bson import ObjectId
import logging

logger = logging.getLogger("clinical_workflow")
router = APIRouter(prefix="/clinical", tags=["clinical-workflow"])

VALID_SERVICE_TYPES = {
    "microneedling", "chemical_peel", "lymphatic",
    "rf_needling", "dermaplaning", "other",
}

VALID_AREAS = {"forehead", "cheeks", "chin", "under_eye", "neck", "jawline", "decolletage", "full_face"}


# ═══════════════════════════════════════════════════════════════
# 3A: CHECK-IN FLOW
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/booking/{booking_id}/check-in")
async def check_in_booking(
    business_id: str,
    booking_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Check in a client for their appointment.
    Validates consultation form, records medical changes, updates booking status.
    """
    medical_changes = payload.get("medical_changes", False)
    medical_notes = (payload.get("medical_notes") or "").strip()
    verbal_confirmation = payload.get("verbal_confirmation", False)
    checked_in_by = (payload.get("checked_in_by") or "").strip()

    if not checked_in_by:
        raise HTTPException(400, "checked_in_by (staff name) is required")

    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    enc = TenantEncryption(tenant.business_id)

    # Find the booking
    booking = await sdb.bookings.find_one({"_id": booking_id})
    if not booking:
        try:
            booking = await sdb.bookings.find_one({"_id": ObjectId(booking_id)})
        except Exception:
            pass
    if not booking:
        raise HTTPException(404, "Booking not found")

    doc_id = booking["_id"]
    current_status = booking.get("status", "")
    if current_status == "checked_in":
        raise HTTPException(400, "Booking is already checked in")
    if current_status in ("completed", "cancelled", "no_show"):
        raise HTTPException(400, f"Cannot check in a {current_status} booking")

    # Get client info for consultation form check
    cust = booking.get("customer", {})
    cust_email = (cust.get("email") or "").strip().lower() if isinstance(cust, dict) else ""
    cust_phone = (cust.get("phone") or "").strip() if isinstance(cust, dict) else ""
    customer_id = booking.get("customerId") or booking.get("user_id") or ""

    # Check consultation form status
    warnings = []
    form_query = {"business_id": business_id}
    if cust_email:
        form_query["client_email"] = cust_email
    elif cust_phone:
        form_query["client_phone"] = cust_phone
    elif customer_id:
        form_query["client_id"] = customer_id

    has_form_filter = len(form_query) > 1  # more than just business_id
    latest_form = None
    if has_form_filter:
        latest_form = await db.consultation_submissions.find_one(
            form_query, sort=[("submitted_at", -1)]
        )

    if not latest_form and has_form_filter:
        warnings.append({
            "warning": "no_consultation_form",
            "message": "No consultation form on file for this client",
        })
    elif latest_form:
        expires_at = latest_form.get("expires_at")
        if expires_at and isinstance(expires_at, datetime) and expires_at < datetime.utcnow():
            warnings.append({
                "warning": "consultation_form_expired",
                "message": "Form expired, please resend",
            })

    # If medical changes reported, store abbreviated health update on client record
    if medical_changes and medical_notes:
        encrypted_notes = enc.encrypt(medical_notes) if enc.enabled else medical_notes
        health_update = {
            "date": datetime.utcnow().isoformat(),
            "notes": encrypted_notes,
            "recorded_by": checked_in_by,
            "booking_id": str(doc_id),
        }

        # Update client record — try by customerId first, then by email
        client_updated = False
        if customer_id:
            try:
                result = await db.clients.update_one(
                    {"_id": ObjectId(customer_id), "businessId": business_id},
                    {"$push": {"health_updates": health_update}},
                )
                client_updated = result.modified_count > 0
            except Exception:
                pass

        if not client_updated and cust_email:
            await db.clients.update_one(
                {"businessId": business_id, "email": cust_email},
                {"$push": {"health_updates": health_update}},
            )

        # Log medical data access
        await log_medical_access(
            event_type="health_update_recorded",
            business_id=business_id,
            accessed_by=tenant.user_id,
            accessor_role=tenant.role,
            accessor_email=tenant.user_email,
            client_email=cust_email,
            details=f"Medical changes recorded at check-in by {checked_in_by}",
        )

    # Update booking status to checked_in
    now = datetime.utcnow()
    check_in_record = {
        "checked_in_at": now.isoformat(),
        "checked_in_by": checked_in_by,
        "medical_changes": medical_changes,
        "verbal_confirmation": verbal_confirmation,
    }

    await sdb.bookings.update_one(
        {"_id": doc_id},
        {"$set": {
            "status": "checked_in",
            "check_in": check_in_record,
            "updatedAt": now,
        }},
    )

    # Audit trail
    from models.normalize import normalize_booking
    nb = normalize_booking(booking)
    await sdb.booking_audit.insert_one({
        "type": "check_in",
        "booking_id": str(doc_id),
        "booking_ref": nb.get("reference", ""),
        "customer_name": nb["customer"]["name"] or "Customer",
        "checked_in_by": checked_in_by,
        "medical_changes": medical_changes,
        "verbal_confirmation": verbal_confirmation,
        "changed_by": tenant.user_email or tenant.user_id,
        "changed_by_role": tenant.role,
        "timestamp": now,
        "immutable": True,
    })

    logger.info(
        f"Check-in: booking={booking_id} by={checked_in_by} "
        f"medical_changes={medical_changes} business={business_id}"
    )

    return {
        "ok": True,
        "status": "checked_in",
        "check_in": check_in_record,
        "warnings": warnings,
    }


# ═══════════════════════════════════════════════════════════════
# 3B: CHECKOUT / COMPLETION FORM
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/booking/{booking_id}/complete")
async def complete_booking(
    business_id: str,
    booking_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Complete a booking with treatment record. Encrypts treatment data at rest.
    """
    treatment_record = payload.get("treatment_record")
    if not treatment_record or not isinstance(treatment_record, dict):
        raise HTTPException(400, "treatment_record is required")

    service_type = (treatment_record.get("service_type") or "").strip().lower()
    if service_type not in VALID_SERVICE_TYPES:
        raise HTTPException(400, f"Invalid service_type. Must be one of: {', '.join(sorted(VALID_SERVICE_TYPES))}")

    fields = treatment_record.get("fields", {})
    notes = (treatment_record.get("notes") or "").strip()

    # Validate fields
    if fields.get("comfort_level") is not None:
        cl = fields["comfort_level"]
        if not isinstance(cl, (int, float)) or cl < 1 or cl > 5:
            raise HTTPException(400, "comfort_level must be 1-5")

    if fields.get("skin_reaction") is not None:
        sr = fields["skin_reaction"]
        if not isinstance(sr, (int, float)) or sr < 1 or sr > 5:
            raise HTTPException(400, "skin_reaction must be 1-5")

    if fields.get("areas_treated"):
        invalid_areas = set(fields["areas_treated"]) - VALID_AREAS
        if invalid_areas:
            raise HTTPException(400, f"Invalid areas: {', '.join(invalid_areas)}. Valid: {', '.join(sorted(VALID_AREAS))}")

    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    enc = TenantEncryption(tenant.business_id)

    # Find the booking
    booking = await sdb.bookings.find_one({"_id": booking_id})
    if not booking:
        try:
            booking = await sdb.bookings.find_one({"_id": ObjectId(booking_id)})
        except Exception:
            pass
    if not booking:
        raise HTTPException(404, "Booking not found")

    doc_id = booking["_id"]
    current_status = booking.get("status", "")
    if current_status == "completed":
        raise HTTPException(400, "Booking is already completed")
    if current_status in ("cancelled", "no_show"):
        raise HTTPException(400, f"Cannot complete a {current_status} booking")

    # Build treatment record with encryption
    now = datetime.utcnow()
    encrypted_notes = enc.encrypt(notes) if enc.enabled and notes else notes

    record = {
        "service_type": service_type,
        "fields": fields,
        "notes": encrypted_notes,
        "completed_by": tenant.user_id,
        "completed_by_email": tenant.user_email,
        "completed_at": now.isoformat(),
        "encrypted": enc.enabled,
    }

    # Update booking
    await sdb.bookings.update_one(
        {"_id": doc_id},
        {"$set": {
            "status": "completed",
            "treatment_record": record,
            "updatedAt": now,
        }},
    )

    # Log medical data access
    cust = booking.get("customer", {})
    cust_email = (cust.get("email") or "").strip().lower() if isinstance(cust, dict) else ""
    await log_medical_access(
        event_type="treatment_record_created",
        business_id=business_id,
        accessed_by=tenant.user_id,
        accessor_role=tenant.role,
        accessor_email=tenant.user_email,
        client_email=cust_email,
        submission_id=str(doc_id),
        details=f"Treatment record: {service_type}",
    )

    # Audit trail
    from models.normalize import normalize_booking
    nb = normalize_booking(booking)
    await sdb.booking_audit.insert_one({
        "type": "completion",
        "booking_id": str(doc_id),
        "booking_ref": nb.get("reference", ""),
        "customer_name": nb["customer"]["name"] or "Customer",
        "service_type": service_type,
        "changed_by": tenant.user_email or tenant.user_id,
        "changed_by_role": tenant.role,
        "timestamp": now,
        "immutable": True,
    })

    logger.info(f"Booking completed: {booking_id} service_type={service_type} business={business_id}")

    # Return the completed booking with treatment record (notes decrypted for response)
    response_record = dict(record)
    response_record["notes"] = notes  # Return plaintext in response

    return {
        "ok": True,
        "status": "completed",
        "treatment_record": response_record,
    }


@router.get("/business/{business_id}/client/{client_id}/treatment-history")
async def get_treatment_history(
    business_id: str,
    client_id: str,
    limit: int = Query(50, ge=1, le=200),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Get all treatment records for a client across their bookings.
    Decrypts notes for display.
    """
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)
    enc = TenantEncryption(tenant.business_id)

    # Verify client belongs to this business
    try:
        client = await db.clients.find_one({"_id": ObjectId(client_id), "businessId": business_id})
    except Exception:
        client = None
    if not client:
        raise HTTPException(404, "Client not found")

    client_email = (client.get("email") or "").strip().lower()

    # Find bookings with treatment records for this client
    match_or = [{"customerId": client_id}]
    if client_email:
        match_or.append({"customer.email": client_email})

    cursor = sdb.bookings.find({
        "$or": match_or,
        "treatment_record": {"$exists": True},
    }).sort("date", -1).limit(limit)
    docs = await cursor.to_list(length=limit)

    # Log medical data access
    await log_medical_access(
        event_type="treatment_history_viewed",
        business_id=business_id,
        accessed_by=tenant.user_id,
        accessor_role=tenant.role,
        accessor_email=tenant.user_email,
        client_email=client_email,
        details=f"Viewed {len(docs)} treatment records",
    )

    records = []
    for d in docs:
        tr = d.get("treatment_record", {})
        # Decrypt notes
        decrypted_notes = enc.decrypt(tr.get("notes", "")) if tr.get("encrypted") else tr.get("notes", "")

        svc = d.get("service", {})
        svc_name = svc.get("name", "") if isinstance(svc, dict) else str(svc)

        records.append({
            "booking_id": str(d["_id"]),
            "date": d.get("date", ""),
            "time": d.get("time", ""),
            "service_name": svc_name,
            "service_type": tr.get("service_type", ""),
            "fields": tr.get("fields", {}),
            "notes": decrypted_notes,
            "completed_by": tr.get("completed_by_email", tr.get("completed_by", "")),
            "completed_at": tr.get("completed_at", ""),
        })

    return {"records": records, "total": len(records)}


# ═══════════════════════════════════════════════════════════════
# 3C: THERAPIST PREFERENCE
# ═══════════════════════════════════════════════════════════════

@router.patch("/business/{business_id}/client/{client_id}/therapist-preference")
async def set_therapist_preference(
    business_id: str,
    client_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Set or clear a client's preferred therapist.
    preference_type: "preferred" (soft) or "exclusive" (hard — warns on mismatch).
    """
    preferred_id = (payload.get("preferred_therapist_id") or "").strip() or None
    pref_type = (payload.get("preference_type") or "preferred").strip().lower()

    if pref_type not in ("preferred", "exclusive"):
        raise HTTPException(400, "preference_type must be 'preferred' or 'exclusive'")

    db = get_database()

    # Verify client exists
    try:
        client = await db.clients.find_one({"_id": ObjectId(client_id), "businessId": business_id})
    except Exception:
        client = None
    if not client:
        raise HTTPException(404, "Client not found")

    if preferred_id is None:
        # Clear preference
        await db.clients.update_one(
            {"_id": ObjectId(client_id), "businessId": business_id},
            {"$unset": {"preferred_therapist": ""}},
        )
        logger.info(f"Therapist preference cleared: client={client_id} business={business_id}")
        return {"ok": True, "preferred_therapist": None}

    # Look up staff name from business document
    try:
        biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        biz = await db.businesses.find_one({"_id": business_id})

    staff_name = ""
    if biz:
        for st in biz.get("staff", []):
            if st.get("id") == preferred_id or str(st.get("_id", "")) == preferred_id:
                staff_name = st.get("name", "")
                break

    # Also check operators collection
    if not staff_name:
        op = await db.operators.find_one({
            "business_id": business_id,
            "$or": [{"_id": ObjectId(preferred_id) if ObjectId.is_valid(preferred_id) else preferred_id}, {"user_id": preferred_id}],
        })
        if op:
            staff_name = op.get("name", op.get("display_name", ""))

    pref = {
        "id": preferred_id,
        "name": staff_name,
        "type": pref_type,
        "set_at": datetime.utcnow().isoformat(),
        "set_by": tenant.user_id,
    }

    await db.clients.update_one(
        {"_id": ObjectId(client_id), "businessId": business_id},
        {"$set": {"preferred_therapist": pref}},
    )

    logger.info(
        f"Therapist preference set: client={client_id} therapist={preferred_id} "
        f"type={pref_type} business={business_id}"
    )
    return {"ok": True, "preferred_therapist": pref}


@router.get("/business/{business_id}/loyalty-clients")
async def get_loyalty_clients(
    business_id: str,
    staff_id: str = Query(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Returns clients who have this staff member as preferred/exclusive therapist
    AND have upcoming bookings. Used for sick-day rebooking.
    """
    db = get_database()
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    # Find clients with this staff as preferred therapist
    client_cursor = db.clients.find(
        {
            "businessId": business_id,
            "preferred_therapist.id": staff_id,
        },
        {"_id": 1, "name": 1, "email": 1, "phone": 1, "preferred_therapist": 1},
    )
    clients = await client_cursor.to_list(length=500)

    if not clients:
        return {"clients": [], "total": 0}

    # For each client, check if they have upcoming bookings with this staff
    results = []
    client_ids = [str(c["_id"]) for c in clients]
    client_emails = [(c.get("email") or "").strip().lower() for c in clients if c.get("email")]

    # Batch query upcoming bookings for these clients with this staff
    booking_or = []
    if client_ids:
        booking_or.append({"customerId": {"$in": client_ids}})
    if client_emails:
        booking_or.append({"customer.email": {"$in": client_emails}})

    if not booking_or:
        return {"clients": [], "total": 0}

    upcoming_bookings = await db.bookings.find({
        "businessId": business_id,
        "staffId": staff_id,
        "date": {"$gte": today_str},
        "status": {"$in": ["confirmed", "pending"]},
        "$or": booking_or,
    }).to_list(length=500)

    # Map bookings to clients
    booking_by_client = {}
    for bk in upcoming_bookings:
        cid = bk.get("customerId", "")
        cemail = ""
        cust = bk.get("customer", {})
        if isinstance(cust, dict):
            cemail = (cust.get("email") or "").strip().lower()
        key = cid or cemail
        if key:
            booking_by_client.setdefault(key, []).append({
                "booking_id": str(bk["_id"]),
                "date": bk.get("date", ""),
                "time": bk.get("time", ""),
                "service": (bk.get("service", {}).get("name", "Booking") if isinstance(bk.get("service"), dict) else str(bk.get("service", "Booking"))),
            })

    for c in clients:
        cid = str(c["_id"])
        cemail = (c.get("email") or "").strip().lower()
        upcoming = booking_by_client.get(cid) or booking_by_client.get(cemail) or []
        if upcoming:
            pref = c.get("preferred_therapist", {})
            results.append({
                "client_id": cid,
                "name": c.get("name", ""),
                "email": cemail,
                "phone": c.get("phone", ""),
                "preference_type": pref.get("type", "preferred"),
                "upcoming_bookings": upcoming,
            })

    return {"clients": results, "total": len(results)}


@router.get("/business/{business_id}/booking/{booking_id}/therapist-check")
async def check_therapist_preference(
    business_id: str,
    booking_id: str,
    staff_id: str = Query(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Check if assigning a different staff member conflicts with client's
    exclusive therapist preference. Called when creating/editing a booking.
    """
    db = get_database()
    sdb = get_scoped_db(tenant.business_id)

    booking = await sdb.bookings.find_one({"_id": booking_id})
    if not booking:
        try:
            booking = await sdb.bookings.find_one({"_id": ObjectId(booking_id)})
        except Exception:
            pass
    if not booking:
        raise HTTPException(404, "Booking not found")

    customer_id = booking.get("customerId") or booking.get("user_id") or ""
    cust = booking.get("customer", {})
    cust_email = (cust.get("email") or "").strip().lower() if isinstance(cust, dict) else ""

    # Find the client record
    client = None
    if customer_id:
        try:
            client = await db.clients.find_one({"_id": ObjectId(customer_id), "businessId": business_id})
        except Exception:
            pass
    if not client and cust_email:
        client = await db.clients.find_one({"businessId": business_id, "email": cust_email})

    if not client:
        return {"conflict": False, "message": "No client record found"}

    pref = client.get("preferred_therapist")
    if not pref:
        return {"conflict": False, "message": "No therapist preference set"}

    pref_id = pref.get("id", "")
    pref_type = pref.get("type", "preferred")
    pref_name = pref.get("name", "")

    if pref_id == staff_id:
        return {"conflict": False, "message": f"Matches preferred therapist ({pref_name})"}

    if pref_type == "exclusive":
        return {
            "conflict": True,
            "severity": "exclusive",
            "message": f"Client has EXCLUSIVE preference for {pref_name}. Assigning {staff_id} may cause dissatisfaction.",
            "preferred_therapist": pref,
        }

    return {
        "conflict": True,
        "severity": "soft",
        "message": f"Client prefers {pref_name} but it is not exclusive.",
        "preferred_therapist": pref,
    }
