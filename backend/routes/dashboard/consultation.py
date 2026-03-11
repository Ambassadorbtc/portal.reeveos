"""
Consultation Forms API — templates, submissions, contraindication engine.

Collections:
  consultation_templates   — form config per business (branding, contra matrix, custom sections)
  consultation_submissions — completed forms with auto-flagging, expiry tracking
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Body, Query, Request
from database import get_database
from middleware.auth import get_current_owner, get_current_user
from middleware.tenant import verify_business_access, TenantContext
from middleware.encryption import TenantEncryption, is_encryption_enabled
from middleware.medical_audit import log_medical_access
from bson import ObjectId

router = APIRouter(prefix="/consultation", tags=["Consultation Forms"])


# ═══════════════════════════════════════════════════════════════
# CONTRAINDICATION ENGINE
# ═══════════════════════════════════════════════════════════════

DEFAULT_CONTRA_MATRIX = {
    "pregnant":           {"microneedling": "BLOCK", "peel": "BLOCK", "rf": "BLOCK", "polynucleotides": "BLOCK", "lymphatic": "FLAG"},
    "pacemaker":          {"rf": "BLOCK", "microneedling": "FLAG"},
    "metalImplants":      {"rf": "BLOCK"},
    "bloodClotting":      {"microneedling": "BLOCK", "peel": "FLAG", "rf": "FLAG", "polynucleotides": "FLAG"},
    "activeCancer":       {"microneedling": "BLOCK", "peel": "BLOCK", "rf": "BLOCK", "polynucleotides": "BLOCK", "lymphatic": "BLOCK"},
    "keloid":             {"microneedling": "BLOCK", "rf": "FLAG", "peel": "FLAG", "polynucleotides": "FLAG"},
    "skinInfection":      {"microneedling": "BLOCK", "peel": "BLOCK", "rf": "BLOCK", "polynucleotides": "BLOCK", "lymphatic": "BLOCK"},
    "autoimmune":         {"microneedling": "BLOCK", "peel": "FLAG", "rf": "FLAG", "polynucleotides": "FLAG"},
    "epilepsy":           {"microneedling": "FLAG", "peel": "FLAG", "rf": "FLAG", "polynucleotides": "FLAG", "lymphatic": "FLAG"},
    "herpes":             {"microneedling": "FLAG", "peel": "FLAG"},
    "roaccutane":         {"microneedling": "BLOCK", "peel": "BLOCK", "rf": "BLOCK", "polynucleotides": "FLAG"},
    "bloodThinners":      {"microneedling": "BLOCK", "rf": "FLAG", "polynucleotides": "FLAG"},
    "retinoids":          {"peel": "BLOCK", "microneedling": "FLAG"},
    "photosensitising":   {"peel": "BLOCK", "microneedling": "FLAG"},
    "immunosuppressants": {"microneedling": "BLOCK", "peel": "FLAG", "rf": "FLAG", "polynucleotides": "FLAG"},
    "sunburn":            {"microneedling": "BLOCK", "peel": "BLOCK", "rf": "BLOCK", "polynucleotides": "FLAG"},
    "sunbed":             {"peel": "BLOCK", "microneedling": "FLAG", "rf": "FLAG"},
    "fishAllergy":        {"polynucleotides": "BLOCK"},
    "fillersRecent":      {"rf": "BLOCK", "polynucleotides": "FLAG"},
    "uncontrolledDiabetes": {"microneedling": "FLAG", "peel": "FLAG", "rf": "FLAG", "polynucleotides": "FLAG"},
}

TREATMENT_LABELS = {
    "microneedling": "Microneedling",
    "peel": "Chemical Peels",
    "rf": "RF Needling",
    "polynucleotides": "Polynucleotides",
    "lymphatic": "Lymphatic Lift",
    "laser": "Laser",
}


def run_contraindication_check(form_data: dict, matrix: dict = None) -> dict:
    m = matrix or DEFAULT_CONTRA_MATRIX
    blocks, flags = [], []
    for condition_key, treatment_rules in m.items():
        if form_data.get(condition_key) == "yes":
            for tx_key, level in treatment_rules.items():
                entry = {"condition": condition_key, "treatment": tx_key, "label": TREATMENT_LABELS.get(tx_key, tx_key)}
                if level == "BLOCK":
                    blocks.append(entry)
                elif level == "FLAG":
                    flags.append(entry)
    return {"blocks": blocks, "flags": flags}


def compute_status(alerts: dict) -> str:
    if alerts["blocks"]:
        return "blocked"
    if alerts["flags"]:
        return "flagged"
    return "clear"


def _default_branding():
    return {
        "logo_url": None,
        "banner_url": None,
        "accent_color": "#C9A84C",
        "bg_color": "#111111",
        "subtitle": "",
    }


# ═══════════════════════════════════════════════════════════════
# TEMPLATE — get/update form config per business
# ═══════════════════════════════════════════════════════════════

@router.get("/business/{business_id}/template")
async def get_template(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    template = await db.consultation_templates.find_one({"business_id": business_id})
    if not template:
        return {
            "business_id": business_id,
            "is_default": True,
            "contra_matrix": DEFAULT_CONTRA_MATRIX,
            "treatment_labels": TREATMENT_LABELS,
            "branding": _default_branding(),
            "validity_months": 6,
            "sections_enabled": {
                "personal": True, "medical": True, "medications": True,
                "skin": True, "lifestyle": True, "consent": True,
            },
        }
    template["_id"] = str(template["_id"])
    return template


@router.put("/business/{business_id}/template")
async def update_template(business_id: str, data: dict = Body(...), tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    now = datetime.utcnow()

    update_fields = {"updated_at": now, "business_id": business_id}

    if "contra_matrix" in data:
        update_fields["contra_matrix"] = data["contra_matrix"]
    if "treatment_labels" in data:
        update_fields["treatment_labels"] = data["treatment_labels"]
    if "branding" in data:
        update_fields["branding"] = data["branding"]
    if "validity_months" in data:
        update_fields["validity_months"] = int(data["validity_months"])
    if "sections_enabled" in data:
        update_fields["sections_enabled"] = data["sections_enabled"]

    result = await db.consultation_templates.update_one(
        {"business_id": business_id},
        {"$set": update_fields, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"updated": True, "matched": result.matched_count, "upserted": result.upserted_id is not None}


# ═══════════════════════════════════════════════════════════════
# PUBLIC — load form config (no auth — client-facing)
# ═══════════════════════════════════════════════════════════════

@router.get("/public/{slug}/form-config")
async def get_public_form_config(slug: str):
    """Public endpoint — returns form config + branding for client-facing form."""
    db = get_database()
    biz = await db.businesses.find_one({"slug": slug})
    if not biz:
        raise HTTPException(404, "Business not found")

    biz_id = str(biz["_id"])
    template = await db.consultation_templates.find_one({"business_id": biz_id})

    branding_src = template.get("branding", {}) if template else {}
    portal_branding = biz.get("portal_branding", {})

    return {
        "business_id": biz_id,
        "business_name": biz.get("name", ""),
        "slug": slug,
        "branding": {
            "logo_url": branding_src.get("logo_url") or portal_branding.get("logo_url") or biz.get("logo_url"),
            "banner_url": branding_src.get("banner_url") or portal_branding.get("banner_url") or biz.get("banner_url"),
            "accent_color": branding_src.get("accent_color") or portal_branding.get("accent_color", "#C9A84C"),
            "bg_color": branding_src.get("bg_color") or portal_branding.get("bg_color", "#111111"),
            "subtitle": branding_src.get("subtitle") or portal_branding.get("subtitle", ""),
            "location": biz.get("address", ""),
        },
        "contra_matrix": (template or {}).get("contra_matrix", DEFAULT_CONTRA_MATRIX),
        "treatment_labels": (template or {}).get("treatment_labels", TREATMENT_LABELS),
        "validity_months": (template or {}).get("validity_months", 6),
        "sections_enabled": (template or {}).get("sections_enabled", {
            "personal": True, "medical": True, "medications": True,
            "skin": True, "lifestyle": True, "consent": True,
        }),
    }


# ═══════════════════════════════════════════════════════════════
# SUBMISSIONS — create (public + authenticated), list, review
# ═══════════════════════════════════════════════════════════════

@router.post("/public/{slug}/submit")
async def submit_form_public(slug: str, data: dict = Body(...)):
    """
    Public submission — client fills form via link/QR/SMS.
    Creates or updates client record in clients collection.
    Runs contraindication check. Stores full submission.
    """
    db = get_database()
    biz = await db.businesses.find_one({"slug": slug})
    if not biz:
        raise HTTPException(404, "Business not found")

    biz_id = str(biz["_id"])
    form_data = data.get("form_data", {})
    client_name = form_data.get("fullName", "").strip()
    client_email = (form_data.get("email") or "").strip().lower()
    client_phone = form_data.get("mobile", "")

    if not client_name or not client_email:
        raise HTTPException(400, "Name and email are required")

    # Load template for contra matrix
    template = await db.consultation_templates.find_one({"business_id": biz_id})
    matrix = (template or {}).get("contra_matrix", DEFAULT_CONTRA_MATRIX)
    validity_months = (template or {}).get("validity_months", 6)

    # Run contraindication engine
    alerts = run_contraindication_check(form_data, matrix)
    status = compute_status(alerts)

    now = datetime.utcnow()
    expires_at = now + timedelta(days=validity_months * 30)

    # Encryption for PII
    enc = TenantEncryption(biz_id)

    # Upsert client record — search both encrypted and plaintext email
    enc_email = enc.encrypt_deterministic(client_email) if enc.enabled else client_email
    client = await db.clients.find_one({"email": enc_email, "business_id": biz_id})
    if not client and enc.enabled:
        client = await db.clients.find_one({"email": client_email, "business_id": biz_id})

    # Encrypt PII for storage
    store_name = enc.encrypt(client_name) if enc.enabled else client_name
    store_email = enc_email
    store_phone = enc.encrypt(client_phone) if enc.enabled else client_phone

    if client:
        client_id = str(client["_id"])
        await db.clients.update_one(
            {"_id": client["_id"]},
            {"$set": {
                "name": store_name,
                "phone": store_phone,
                "consultation_status": status,
                "consultation_expires": expires_at,
                "updated_at": now,
                "encrypted": enc.enabled,
            }}
        )
    else:
        result = await db.clients.insert_one({
            "name": store_name,
            "email": store_email,
            "phone": store_phone,
            "business_id": biz_id,
            "tags": ["new"],
            "consultation_status": status,
            "consultation_expires": expires_at,
            "first_visit": None,
            "last_visit": None,
            "total_spend": 0,
            "visit_count": 0,
            "created_at": now,
            "updated_at": now,
            "encrypted": enc.enabled,
        })
        client_id = str(result.inserted_id)

    # Encrypt PII fields in form_data before storing
    encrypted_form_data = dict(form_data)
    if enc.enabled:
        for pii_field in ["fullName", "address", "mobile", "emergencyContactName", "emergencyContactNumber", "gpName", "gpAddress"]:
            if encrypted_form_data.get(pii_field):
                encrypted_form_data[pii_field] = enc.encrypt(encrypted_form_data[pii_field])
        if encrypted_form_data.get("email"):
            encrypted_form_data["email"] = enc.encrypt_deterministic(encrypted_form_data["email"])

    # Store submission with encrypted form data
    submission = {
        "business_id": biz_id,
        "client_id": client_id,
        "client_name": enc.encrypt(client_name) if enc.enabled else client_name,
        "client_email": enc.encrypt_deterministic(client_email) if enc.enabled else client_email,
        "form_data": encrypted_form_data,
        "alerts": alerts,
        "status": status,
        "submitted_at": now,
        "expires_at": expires_at,
        "reviewed": False,
        "reviewed_by": None,
        "reviewed_at": None,
        "therapist_notes": None,
        "signature_captured": bool(form_data.get("signed")),
        "ip_address": data.get("ip_address"),
        "user_agent": data.get("user_agent"),
        "encrypted": enc.enabled,
    }

    result = await db.consultation_submissions.insert_one(submission)

    # Audit log: form submitted
    await log_medical_access(
        event_type="form_submitted",
        business_id=biz_id,
        accessed_by="client",
        accessor_role="client",
        client_email=client_email,
        client_name=client_name,
        submission_id=str(result.inserted_id),
        ip_address=data.get("ip_address", ""),
    )

    # G8: Notify staff when form is submitted (especially if flagged/blocked)
    try:
        from helpers.email import send_staff_form_notification
        # Get business owner email
        owner = await db.users.find_one({"business_id": biz_id, "role": {"$in": ["business_owner", "owner"]}})
        if owner and owner.get("email"):
            import asyncio
            asyncio.ensure_future(send_staff_form_notification(
                to=owner["email"],
                staff_name=owner.get("name", "").split()[0] if owner.get("name") else "there",
                client_name=client_name,
                client_email=client_email,
                form_status=status,
                business_name=biz.get("name", ""),
                flags=alerts.get("flags", []),
                blocks=alerts.get("blocks", []),
            ))
    except Exception as notify_err:
        import logging
        logging.getLogger(__name__).warning(f"Staff form notification failed: {notify_err}")

    return {
        "submission_id": str(result.inserted_id),
        "client_id": client_id,
        "status": status,
        "alerts": alerts,
        "expires_at": expires_at.isoformat(),
    }


@router.get("/public/{slug}/quickcheck")
async def handle_medical_quickcheck(
    slug: str,
    quickcheck: str = Query(..., description="Booking ID"),
    response: str = Query(..., description="yes or no"),
):
    """
    G5: Client responds to 'Any medical changes?' email.
    If yes → flag booking, redirect to portal form.
    If no → acknowledge, no action.
    """
    db = get_database()
    biz = await db.businesses.find_one({"slug": slug})
    if not biz:
        raise HTTPException(404, "Business not found")

    booking = await db.bookings.find_one({"_id": quickcheck})
    if not booking:
        # Try as string ID match
        bookings_list = await db.bookings.find({"_id": {"$regex": quickcheck}}).to_list(1)
        booking = bookings_list[0] if bookings_list else None

    if not booking:
        return {"status": "not_found", "message": "Booking not found"}

    now = datetime.utcnow()

    if response == "yes":
        # Flag the booking — therapist needs to check
        await db.bookings.update_one(
            {"_id": booking["_id"]},
            {"$set": {
                "medical_update_flagged": True,
                "medical_update_flagged_at": now,
                "medical_update_response": "changes_reported",
            }}
        )
        # Redirect to portal consultation form
        return {
            "status": "flagged",
            "message": "Thank you. Your therapist will review before your appointment. Please update your consultation form.",
            "redirect": f"/client/{slug}?view=form",
        }
    else:
        # No changes — acknowledge
        await db.bookings.update_one(
            {"_id": booking["_id"]},
            {"$set": {
                "medical_update_flagged": False,
                "medical_update_response": "no_changes",
                "medical_update_responded_at": now,
            }}
        )
        return {
            "status": "confirmed",
            "message": "Thank you for confirming. See you at your appointment!",
        }


@router.get("/business/{business_id}/submissions")
async def list_submissions(
    business_id: str,
    status: str = Query(None),
    limit: int = Query(50, le=200),
    skip: int = Query(0),
    tenant: TenantContext = Depends(verify_business_access),
):
    """List all consultation form submissions for a business."""
    db = get_database()
    enc = TenantEncryption(business_id)
    query = {"business_id": business_id}
    if status:
        query["status"] = status

    cursor = db.consultation_submissions.find(query).sort("submitted_at", -1).skip(skip).limit(limit)
    submissions = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        # Decrypt PII for display
        if doc.get("encrypted") and enc.enabled:
            doc["client_name"] = enc.decrypt(doc.get("client_name", ""))
            doc["client_email"] = enc.decrypt(doc.get("client_email", ""))
        submissions.append(doc)

    # Audit: listing submissions (bulk view)
    await log_medical_access(
        event_type="submissions_listed",
        business_id=business_id,
        accessed_by=tenant.user_id,
        accessor_role=tenant.role,
        accessor_email=tenant.user_email,
        details=f"Listed {len(submissions)} submissions (skip={skip}, limit={limit})",
    )

    total = await db.consultation_submissions.count_documents({"business_id": business_id})
    pending = await db.consultation_submissions.count_documents({"business_id": business_id, "reviewed": False, "status": {"$in": ["flagged", "blocked"]}})
    expiring_soon = await db.consultation_submissions.count_documents({
        "business_id": business_id,
        "expires_at": {"$lte": datetime.utcnow() + timedelta(days=30), "$gte": datetime.utcnow()},
    })

    return {
        "submissions": submissions,
        "total": total,
        "pending_review": pending,
        "expiring_soon": expiring_soon,
    }


@router.get("/business/{business_id}/submissions/{submission_id}")
async def get_submission(
    business_id: str, submission_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get a single submission with full form data."""
    db = get_database()
    enc = TenantEncryption(business_id)
    doc = await db.consultation_submissions.find_one({"_id": ObjectId(submission_id), "business_id": business_id})
    if not doc:
        raise HTTPException(404, "Submission not found")
    doc["_id"] = str(doc["_id"])

    # Decrypt PII for display
    if doc.get("encrypted") and enc.enabled:
        doc["client_name"] = enc.decrypt(doc.get("client_name", ""))
        doc["client_email"] = enc.decrypt(doc.get("client_email", ""))
        fd = doc.get("form_data", {})
        for field in ["fullName", "address", "mobile", "emergencyContactName", "emergencyContactNumber", "gpName", "gpAddress"]:
            if fd.get(field):
                fd[field] = enc.decrypt(fd[field])
        if fd.get("email"):
            fd["email"] = enc.decrypt(fd["email"])

    # Audit: viewing individual submission with full medical data
    await log_medical_access(
        event_type="form_viewed",
        business_id=business_id,
        accessed_by=tenant.user_id,
        accessor_role=tenant.role,
        accessor_email=tenant.user_email,
        client_email=doc.get("client_email", ""),
        client_name=doc.get("client_name", ""),
        submission_id=submission_id,
    )

    return doc


@router.put("/business/{business_id}/submissions/{submission_id}/review")
async def review_submission(
    business_id: str, submission_id: str,
    data: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Therapist reviews a submission — adds notes, marks as reviewed."""
    db = get_database()
    now = datetime.utcnow()

    update = {
        "reviewed": True,
        "reviewed_at": now,
        "reviewed_by": data.get("reviewed_by", "therapist"),
        "therapist_notes": data.get("notes", ""),
    }

    # Allow manual override of flags (therapist approves despite flag)
    if "override_status" in data and data["override_status"] in ("clear", "flagged", "blocked"):
        update["status"] = data["override_status"]
        update["override_reason"] = data.get("override_reason", "")

    result = await db.consultation_submissions.update_one(
        {"_id": ObjectId(submission_id), "business_id": business_id},
        {"$set": update},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Submission not found")

    # Audit: form reviewed
    await log_medical_access(
        event_type="form_reviewed",
        business_id=business_id,
        accessed_by=tenant.user_id,
        accessor_role=tenant.role,
        accessor_email=tenant.user_email,
        submission_id=submission_id,
        details=f"reviewed_by={data.get('reviewed_by','therapist')}, override={data.get('override_status','none')}",
    )

    return {"reviewed": True}


@router.get("/business/{business_id}/stats")
async def get_stats(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Dashboard stats for consultation forms."""
    db = get_database()
    now = datetime.utcnow()

    total = await db.consultation_submissions.count_documents({"business_id": business_id})
    pending = await db.consultation_submissions.count_documents({"business_id": business_id, "reviewed": False, "status": {"$in": ["flagged", "blocked"]}})
    blocked_total = await db.consultation_submissions.count_documents({"business_id": business_id, "status": "blocked"})
    expiring = await db.consultation_submissions.count_documents({
        "business_id": business_id,
        "expires_at": {"$lte": now + timedelta(days=30), "$gte": now},
    })

    # This week's submissions
    week_ago = now - timedelta(days=7)
    this_week = await db.consultation_submissions.count_documents({"business_id": business_id, "submitted_at": {"$gte": week_ago}})

    return {
        "total_submissions": total,
        "pending_review": pending,
        "blocked_treatments": blocked_total,
        "expiring_soon": expiring,
        "this_week": this_week,
    }


# ═══════════════════════════════════════════════════════════════
# CLIENT CHECK — does this client have a valid consultation form?
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/check-form")
async def check_client_form_status(
    business_id: str, data: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Check if a client has a valid (non-expired) consultation form.
    Used by booking flow to enforce form-before-booking.
    Email sent in POST body — never in URL (GDPR: no PII in URLs).
    """
    db = get_database()
    enc = TenantEncryption(business_id)
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(400, "Email required")
    now = datetime.utcnow()

    # Search both encrypted and plaintext (backward compat with pre-encryption data)
    search_email = enc.encrypt_deterministic(email) if enc.enabled else email
    latest = await db.consultation_submissions.find_one(
        {"business_id": business_id, "client_email": search_email, "expires_at": {"$gte": now}},
        sort=[("submitted_at", -1)],
    )
    # Fallback: try plaintext if encrypted search found nothing (pre-encryption records)
    if not latest and enc.enabled:
        latest = await db.consultation_submissions.find_one(
            {"business_id": business_id, "client_email": email, "expires_at": {"$gte": now}},
            sort=[("submitted_at", -1)],
        )

    if not latest:
        # Check if there's an EXPIRED form
        expired = await db.consultation_submissions.find_one(
            {"business_id": business_id, "client_email": {"$in": [search_email, email]}, "expires_at": {"$lt": now}},
            sort=[("submitted_at", -1)],
        )
        if expired:
            return {
                "has_valid_form": False,
                "form_status": "red",
                "status": "expired",
                "expires_at": expired["expires_at"].isoformat(),
                "submitted_at": expired["submitted_at"].isoformat(),
                "message": "Consultation form has expired. Client must complete a new form before booking.",
                "has_unreviewed_update": expired.get("has_unreviewed_update", False),
            }
        return {"has_valid_form": False, "form_status": "none", "status": None, "expires_at": None, "message": "No consultation form on file."}

    # Calculate green / amber / red
    expires_at = latest["expires_at"]
    days_until_expiry = (expires_at - now).days
    if days_until_expiry <= 0:
        form_status = "red"
    elif days_until_expiry <= 30:
        form_status = "amber"
    else:
        form_status = "green"

    return {
        "has_valid_form": True,
        "form_status": form_status,
        "days_until_expiry": days_until_expiry,
        "status": latest.get("status", "clear"),
        "submitted_at": latest["submitted_at"].isoformat(),
        "expires_at": expires_at.isoformat(),
        "alerts": latest.get("alerts", {"blocks": [], "flags": []}),
        "submission_id": str(latest["_id"]),
        "has_unreviewed_update": latest.get("has_unreviewed_update", False),
    }


# ═══════════════════════════════════════════════════════════════
# MEDICAL QUICK-UPDATE — "Any changes since last visit?"
# ═══════════════════════════════════════════════════════════════

@router.post("/business/{business_id}/quick-update")
async def submit_medical_quick_update(
    business_id: str,
    data: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Staff or client submits a medical quick-update instead of full form redo.
    Flags upcoming bookings so therapist knows to check."""
    db = get_database()

    client_id = data.get("client_id") or data.get("clientId")
    client_email = data.get("email")
    client_phone = data.get("phone")
    has_changes = data.get("has_changes", False)
    description = (data.get("description") or "").strip()
    conditions = data.get("conditions", [])  # list of condition keys e.g. ["pregnant", "coldSore"]

    if not client_id and not client_email and not client_phone:
        raise HTTPException(400, "Client identifier required (client_id, email, or phone)")

    # Find the client's latest consultation submission
    query = {"business_id": business_id}
    if client_id:
        query["client_id"] = client_id
    elif client_email:
        query["client_email"] = client_email
    elif client_phone:
        query["client_phone"] = client_phone

    latest = await db.consultation_submissions.find_one(
        query, sort=[("submitted_at", -1)]
    )

    now = datetime.utcnow()
    update_doc = {
        "date": now,
        "has_changes": has_changes,
        "description": description,
        "conditions": conditions,
        "submitted_by": tenant.user_email or tenant.user_id,
        "reviewed": False,
    }

    # Run contraindication check on flagged conditions
    alerts = {"blocks": [], "flags": []}
    if has_changes and conditions:
        template = await db.consultation_templates.find_one({"business_id": business_id})
        matrix = (template or {}).get("contraindication_matrix") or DEFAULT_CONTRA_MATRIX
        for cond in conditions:
            if cond in matrix:
                for treatment, level in matrix[cond].items():
                    entry = {"condition": cond, "treatment": treatment}
                    if level == "BLOCK":
                        alerts["blocks"].append(entry)
                    elif level == "FLAG":
                        alerts["flags"].append(entry)
        update_doc["alerts"] = alerts

    if latest:
        # Append to existing submission
        await db.consultation_submissions.update_one(
            {"_id": latest["_id"]},
            {
                "$push": {"medical_updates": update_doc},
                "$set": {
                    "has_unreviewed_update": has_changes,
                    "last_update_at": now,
                    "updatedAt": now,
                }
            }
        )
    else:
        # No submission yet — create a minimal record
        await db.consultation_submissions.insert_one({
            "business_id": business_id,
            "client_id": client_id,
            "client_email": client_email,
            "client_phone": client_phone,
            "medical_updates": [update_doc],
            "has_unreviewed_update": has_changes,
            "last_update_at": now,
            "submitted_at": now,
            "status": "update_only",
        })

    # Flag upcoming bookings for this client
    if has_changes:
        biz_match = {"$or": [{"businessId": business_id}, {"business_id": business_id}]}
        client_match = {}
        if client_phone:
            client_match["customer.phone"] = client_phone
        elif client_email:
            client_match["customer.email"] = client_email
        elif client_id:
            client_match["customerId"] = client_id

        if client_match:
            today = now.strftime("%Y-%m-%d")
            await db.bookings.update_many(
                {**biz_match, **client_match, "date": {"$gte": today}, "status": {"$in": ["confirmed", "pending"]}},
                {"$set": {
                    "medicalAlert": True,
                    "medicalAlertDesc": description[:200] if description else "Medical update flagged",
                    "medicalAlertBlocks": alerts.get("blocks", []),
                }}
            )

    return {
        "status": "updated",
        "has_changes": has_changes,
        "alerts": alerts,
        "message": "Medical update recorded" + (f" — {len(alerts['blocks'])} treatment blocks detected" if alerts["blocks"] else ""),
    }


@router.post("/public/{slug}/quick-update")
async def public_medical_quick_update(slug: str, data: dict = Body(...)):
    """Public endpoint for clients to submit medical updates via email link."""
    db = get_database()
    biz = await db.businesses.find_one({"slug": slug})
    if not biz:
        raise HTTPException(404, "Business not found")

    business_id = str(biz["_id"])
    has_changes = data.get("has_changes", False)
    description = (data.get("description") or "").strip()
    conditions = data.get("conditions", [])
    client_email = data.get("email")
    client_phone = data.get("phone")
    token = data.get("token")  # verification token from email link

    if not client_email and not client_phone:
        raise HTTPException(400, "Email or phone required")

    now = datetime.utcnow()
    update_doc = {
        "date": now,
        "has_changes": has_changes,
        "description": description,
        "conditions": conditions,
        "submitted_by": "client",
        "reviewed": False,
    }

    # Run contraindication check
    alerts = {"blocks": [], "flags": []}
    if has_changes and conditions:
        template = await db.consultation_templates.find_one({"business_id": business_id})
        matrix = (template or {}).get("contraindication_matrix") or DEFAULT_CONTRA_MATRIX
        for cond in conditions:
            if cond in matrix:
                for treatment, level in matrix[cond].items():
                    entry = {"condition": cond, "treatment": treatment}
                    if level == "BLOCK":
                        alerts["blocks"].append(entry)
                    elif level == "FLAG":
                        alerts["flags"].append(entry)
        update_doc["alerts"] = alerts

    # Find or create submission
    query = {"business_id": business_id}
    if client_email:
        query["client_email"] = client_email
    else:
        query["client_phone"] = client_phone

    latest = await db.consultation_submissions.find_one(query, sort=[("submitted_at", -1)])

    if latest:
        await db.consultation_submissions.update_one(
            {"_id": latest["_id"]},
            {"$push": {"medical_updates": update_doc}, "$set": {"has_unreviewed_update": has_changes, "last_update_at": now}}
        )
    else:
        await db.consultation_submissions.insert_one({
            "business_id": business_id,
            "client_email": client_email, "client_phone": client_phone,
            "medical_updates": [update_doc],
            "has_unreviewed_update": has_changes, "last_update_at": now,
            "submitted_at": now, "status": "update_only",
        })

    # Flag upcoming bookings
    if has_changes:
        biz_match = {"$or": [{"businessId": business_id}, {"business_id": business_id}]}
        client_match = {"customer.phone": client_phone} if client_phone else {"customer.email": client_email}
        today = now.strftime("%Y-%m-%d")
        await db.bookings.update_many(
            {**biz_match, **client_match, "date": {"$gte": today}, "status": {"$in": ["confirmed", "pending"]}},
            {"$set": {"medicalAlert": True, "medicalAlertDesc": description[:200] or "Medical update flagged", "medicalAlertBlocks": alerts.get("blocks", [])}}
        )

    return {
        "status": "updated",
        "has_changes": has_changes,
        "alerts": alerts,
        "blocks_detected": len(alerts.get("blocks", [])),
    }


# ═══════════════════════════════════════════════════════════════
# TREATMENT CONSENT FORMS (2A-2D)
# Per-treatment consent — signed before each new treatment/course
# ═══════════════════════════════════════════════════════════════

DEFAULT_CONSENT_TEMPLATES = {
    "microneedling": {
        "id": "2A", "name": "Microneedling Consent",
        "covers": ["Microneedling Facial", "Microneedling Hands", "RF Microneedling"],
        "fields": [
            {"id": "areas", "label": "Treatment area(s)", "type": "multi_checkbox", "options": ["Face", "Neck", "Décolletage", "Hands", "Body"], "required": True},
            {"id": "needle_depth", "label": "Needle depth explained and acknowledged", "type": "checkbox", "required": True},
            {"id": "patch_test", "label": "Patch test completed?", "type": "yes_no_date", "required": True, "block_if_no": True},
            {"id": "side_effects", "label": "Expected side effects acknowledged (redness 24-48hrs, mild swelling, pinpoint bleeding, skin tightness, peeling days 3-5)", "type": "checkbox", "required": True},
            {"id": "complications", "label": "Rare complications acknowledged (infection, prolonged redness, hyperpigmentation, scarring, cold sore reactivation)", "type": "checkbox", "required": True},
            {"id": "pre_care", "label": "Pre-care confirmed (no retinoids 7 days, no sun 2 weeks, no blood thinners, clean skin)", "type": "checkbox", "required": True},
            {"id": "post_care", "label": "Post-care understood (no makeup 48hrs, SPF 50, no actives 7 days, no picking)", "type": "checkbox", "required": True},
            {"id": "sessions", "label": "Number of sessions in course", "type": "dropdown", "options": ["Single", "3", "6", "8"], "required": False},
            {"id": "interval", "label": "Treatment interval acknowledged (min 2 weeks, typically 4-6 weeks)", "type": "checkbox", "required": False},
        ],
    },
    "peel": {
        "id": "2B", "name": "Chemical Peel Consent",
        "covers": ["BioRePeelCI3", "Pro Power Peel", "Power Eye Peel", "MelanoPro Peel"],
        "fields": [
            {"id": "peel_type", "label": "Peel type", "type": "dropdown", "options": ["BioRePeelCI3", "Pro Power Peel", "Power Eye Peel", "MelanoPro Peel"], "required": True},
            {"id": "fitzpatrick", "label": "Fitzpatrick skin type confirmed", "type": "display", "required": True},
            {"id": "patch_test", "label": "Patch test completed?", "type": "yes_no_date", "required": True, "block_if_no": True},
            {"id": "reactions", "label": "Expected reactions acknowledged (tingling, redness 1-3 days, peeling 3-7 days, sensitivity)", "type": "checkbox", "required": True},
            {"id": "complications", "label": "Rare complications acknowledged (blistering, burns, hyperpigmentation, scarring)", "type": "checkbox", "required": True},
            {"id": "pre_care", "label": "Pre-care confirmed (no retinoids 5-7 days, no waxing 7 days, no peels 2 weeks, no laser 3 months)", "type": "checkbox", "required": True},
            {"id": "post_care", "label": "Post-care understood (no makeup same day, SPF 50 daily, no exfoliating 2 weeks, avoid heat 24-48hrs)", "type": "checkbox", "required": True},
        ],
    },
    "rf": {
        "id": "2C", "name": "RF Needling Consent",
        "covers": ["RF Microneedling Body", "RF Microneedling Neck"],
        "fields": [
            {"id": "areas", "label": "Treatment area", "type": "multi_checkbox", "options": ["Neck", "Jawline", "Body"], "required": True},
            {"id": "pacemaker_no", "label": "Confirmed NO pacemaker/electronic implant", "type": "checkbox", "required": True, "block_if_unchecked": True},
            {"id": "metal_no", "label": "Confirmed NO metal in treatment area", "type": "checkbox", "required": True, "block_if_unchecked": True},
            {"id": "fillers", "label": "Fillers in last 6 months?", "type": "yes_no_date", "required": True},
            {"id": "side_effects", "label": "Expected side effects acknowledged (redness, warmth, mild swelling 24-48hrs, grid marks)", "type": "checkbox", "required": True},
            {"id": "complications", "label": "Rare complications acknowledged (burns, blistering, nerve damage, fat atrophy, scarring)", "type": "checkbox", "required": True},
            {"id": "post_care", "label": "Post-care understood (keep hydrated, no hot baths 48hrs, SPF 50, no makeup 24hrs)", "type": "checkbox", "required": True},
        ],
    },
    "polynucleotides": {
        "id": "2D", "name": "Polynucleotide Consent",
        "covers": ["Full face skin booster injections"],
        "fields": [
            {"id": "fish_allergy", "label": "Allergy to fish/salmon products?", "type": "yes_no", "required": True, "block_if_yes": True},
            {"id": "areas", "label": "Treatment area", "type": "multi_checkbox", "options": ["Under-eye", "Full face", "Neck"], "required": True},
            {"id": "filler_reactions", "label": "Previous filler/injectable reactions?", "type": "yes_no_detail", "required": True},
            {"id": "blood_thinners", "label": "Blood thinners confirmed? (from consultation)", "type": "display", "required": True},
            {"id": "side_effects", "label": "Expected side effects acknowledged (redness, swelling, bruising, tenderness 24-72hrs)", "type": "checkbox", "required": True},
            {"id": "post_care", "label": "Post-care understood (no makeup 12hrs, no exercise 24hrs, no alcohol 24hrs, no saunas 48hrs)", "type": "checkbox", "required": True},
        ],
    },
}


@router.get("/business/{business_id}/consent-templates")
async def get_consent_templates(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get consent form templates — default + any business customisations."""
    db = get_database()
    custom = await db.consent_templates.find_one({"business_id": business_id})
    templates = dict(DEFAULT_CONSENT_TEMPLATES)
    if custom and custom.get("overrides"):
        templates.update(custom["overrides"])
    return {"templates": templates}


@router.post("/business/{business_id}/consent/submit")
async def submit_consent_form(
    business_id: str,
    data: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """Staff submits a treatment consent form for a client."""
    db = get_database()
    now = datetime.utcnow()

    treatment_type = data.get("treatment_type")  # microneedling, peel, rf, polynucleotides
    client_id = data.get("client_id")
    client_email = data.get("client_email")
    client_phone = data.get("client_phone")
    client_name = data.get("client_name", "")
    responses = data.get("responses", {})  # {field_id: value}
    signature = data.get("signature")  # base64 or null
    booking_id = data.get("booking_id")  # link to specific booking

    if not treatment_type:
        raise HTTPException(400, "Treatment type required")
    if not client_email and not client_phone and not client_id:
        raise HTTPException(400, "Client identifier required")

    # Check for blocking fields
    template = DEFAULT_CONSENT_TEMPLATES.get(treatment_type, {})
    blocks = []
    for field in template.get("fields", []):
        fid = field["id"]
        val = responses.get(fid)
        if field.get("block_if_yes") and val == True:
            blocks.append({"field": fid, "label": field["label"], "reason": "Cannot proceed — contraindication"})
        if field.get("block_if_no") and val == False:
            blocks.append({"field": fid, "label": field["label"], "reason": "Required before treatment"})
        if field.get("block_if_unchecked") and not val:
            blocks.append({"field": fid, "label": field["label"], "reason": "Must be confirmed before treatment"})

    doc = {
        "business_id": business_id,
        "treatment_type": treatment_type,
        "template_id": template.get("id", treatment_type),
        "client_id": client_id,
        "client_email": client_email,
        "client_phone": client_phone,
        "client_name": client_name,
        "responses": responses,
        "signature": True if signature else False,
        "booking_id": booking_id,
        "blocks": blocks,
        "status": "blocked" if blocks else "signed",
        "submitted_at": now,
        "submitted_by": tenant.user_email or tenant.user_id,
    }

    result = await db.consent_submissions.insert_one(doc)

    # If linked to a booking, flag it
    if booking_id and not blocks:
        await db.bookings.update_one(
            {"_id": booking_id},
            {"$set": {f"consent_{treatment_type}": True, "consent_signed_at": now}}
        )

    return {
        "id": str(result.inserted_id),
        "status": doc["status"],
        "blocks": blocks,
        "message": f"Consent form {'blocked — cannot proceed' if blocks else 'signed successfully'}",
    }


@router.get("/business/{business_id}/consent/client")
async def get_client_consents(
    business_id: str,
    client_id: str = None,
    email: str = None,
    phone: str = None,
    tenant: TenantContext = Depends(verify_business_access),
):
    """Get all consent forms for a client."""
    db = get_database()
    query = {"business_id": business_id}
    if client_id:
        query["client_id"] = client_id
    elif email:
        query["client_email"] = email
    elif phone:
        query["client_phone"] = phone
    else:
        raise HTTPException(400, "Client identifier required")

    docs = await db.consent_submissions.find(query).sort("submitted_at", -1).to_list(50)

    return {"consents": [{
        "id": str(d["_id"]),
        "treatment_type": d.get("treatment_type"),
        "template_id": d.get("template_id"),
        "status": d.get("status"),
        "submitted_at": d["submitted_at"].isoformat(),
        "submitted_by": d.get("submitted_by"),
        "blocks": d.get("blocks", []),
        "booking_id": d.get("booking_id"),
    } for d in docs]}


@router.post("/public/{slug}/consent/submit")
async def public_submit_consent(slug: str, data: dict = Body(...)):
    """Public endpoint — client signs consent form via booking flow."""
    db = get_database()
    biz = await db.businesses.find_one({"slug": slug})
    if not biz:
        raise HTTPException(404, "Business not found")

    business_id = str(biz["_id"])
    now = datetime.utcnow()

    treatment_type = data.get("treatment_type")
    client_email = data.get("email")
    client_phone = data.get("phone")
    client_name = data.get("name", "")
    responses = data.get("responses", {})
    signature = data.get("signature")
    booking_id = data.get("booking_id")

    if not treatment_type:
        raise HTTPException(400, "Treatment type required")

    template = DEFAULT_CONSENT_TEMPLATES.get(treatment_type, {})
    blocks = []
    for field in template.get("fields", []):
        fid = field["id"]
        val = responses.get(fid)
        if field.get("block_if_yes") and val == True:
            blocks.append({"field": fid, "label": field["label"]})
        if field.get("block_if_no") and val == False:
            blocks.append({"field": fid, "label": field["label"]})
        if field.get("block_if_unchecked") and not val:
            blocks.append({"field": fid, "label": field["label"]})

    doc = {
        "business_id": business_id,
        "treatment_type": treatment_type,
        "template_id": template.get("id", treatment_type),
        "client_email": client_email,
        "client_phone": client_phone,
        "client_name": client_name,
        "responses": responses,
        "signature": True if signature else False,
        "booking_id": booking_id,
        "blocks": blocks,
        "status": "blocked" if blocks else "signed",
        "submitted_at": now,
        "submitted_by": "client",
    }

    await db.consent_submissions.insert_one(doc)

    if booking_id and not blocks:
        await db.bookings.update_one(
            {"_id": booking_id},
            {"$set": {f"consent_{treatment_type}": True, "consent_signed_at": now}}
        )

    return {
        "status": doc["status"],
        "blocks": blocks,
        "treatment": template.get("name", treatment_type),
    }


# ═══════════════════════════════════════════════════════════════
# 4A: FORM VALIDITY PERIOD — per-client status with days remaining
# ═══════════════════════════════════════════════════════════════

VALIDITY_PERIOD_MAP = {
    "6_months": 180,
    "12_months": 365,
    "never_expires": 36500,  # 100 years ≈ never
}


@router.get("/business/{business_id}/client/{client_id}/form-status")
async def get_client_form_status(
    business_id: str,
    client_id: str,
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Check if a specific client has a valid consultation form.
    Returns detailed status with days remaining, expiry, and renewal flag.
    """
    db = get_database()
    now = datetime.utcnow()

    # Verify client belongs to this business
    try:
        client = await db.clients.find_one({"_id": ObjectId(client_id), "businessId": business_id})
    except Exception:
        client = None
    # Also check business_id (snake_case variant from consultation form submission)
    if not client:
        try:
            client = await db.clients.find_one({"_id": ObjectId(client_id), "business_id": business_id})
        except Exception:
            pass
    if not client:
        raise HTTPException(404, "Client not found")

    client_email = (client.get("email") or "").strip().lower()

    # Find latest consultation submission for this client
    query = {"business_id": business_id}
    or_clauses = [{"client_id": client_id}]
    if client_email:
        or_clauses.append({"client_email": client_email})
        # Also search with encrypted email
        enc = TenantEncryption(business_id)
        if enc.enabled:
            or_clauses.append({"client_email": enc.encrypt_deterministic(client_email)})
    query["$or"] = or_clauses

    latest = await db.consultation_submissions.find_one(
        query, sort=[("submitted_at", -1)]
    )

    if not latest:
        return {
            "completed": False,
            "valid": False,
            "expires_at": None,
            "days_remaining": 0,
            "needs_renewal": True,
            "action": "send_form",
        }

    expires_at = latest.get("expires_at")
    submitted_at = latest.get("submitted_at")

    if not expires_at:
        return {
            "completed": True,
            "valid": False,
            "expires_at": None,
            "days_remaining": 0,
            "needs_renewal": True,
            "action": "resend_form",
            "submitted_at": submitted_at.isoformat() if submitted_at else None,
        }

    if isinstance(expires_at, str):
        try:
            expires_at = datetime.fromisoformat(expires_at)
        except (ValueError, TypeError):
            expires_at = now

    days_remaining = max(0, (expires_at - now).days)
    is_valid = expires_at > now
    needs_renewal = days_remaining <= 30

    result = {
        "completed": True,
        "valid": is_valid,
        "expires_at": expires_at.isoformat(),
        "days_remaining": days_remaining,
        "needs_renewal": needs_renewal,
        "submitted_at": submitted_at.isoformat() if submitted_at else None,
        "status": latest.get("status", "clear"),
        "submission_id": str(latest["_id"]),
    }

    if not is_valid:
        result["action"] = "resend_form"
    elif needs_renewal:
        result["action"] = "renewal_recommended"

    return result


# ═══════════════════════════════════════════════════════════════
# 4B: HEALTH CHANGE QUICK PROMPT — fast check-in health screen
# ═══════════════════════════════════════════════════════════════

HEALTH_CHECK_FIELDS = {
    "pregnant", "new_medication", "skin_conditions",
    "allergies", "recent_surgery",
}


@router.post("/business/{business_id}/client/{client_id}/health-check")
async def health_check_prompt(
    business_id: str,
    client_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Quick health check at check-in.
    If no changes confirmed: extends form validity by 6 months.
    If any flag: requires therapist review.
    """
    db = get_database()
    enc = TenantEncryption(business_id)
    now = datetime.utcnow()

    # Verify client
    try:
        client = await db.clients.find_one({"_id": ObjectId(client_id), "businessId": business_id})
    except Exception:
        client = None
    if not client:
        try:
            client = await db.clients.find_one({"_id": ObjectId(client_id), "business_id": business_id})
        except Exception:
            pass
    if not client:
        raise HTTPException(404, "Client not found")

    no_changes_confirmed = payload.get("no_changes_confirmed", False)

    # Check which flags are raised
    raised_flags = []
    for field in HEALTH_CHECK_FIELDS:
        if payload.get(field, False):
            raised_flags.append(field)

    # Build health check record
    check_record = {
        "timestamp": now.isoformat(),
        "recorded_by": tenant.user_email or tenant.user_id,
        "no_changes_confirmed": no_changes_confirmed,
        "flags": raised_flags,
    }

    # Store on client record
    await db.clients.update_one(
        {"_id": ObjectId(client_id)},
        {"$push": {"health_checks": check_record}},
    )

    if not raised_flags and no_changes_confirmed:
        # No changes — extend form validity by 6 months
        client_email = (client.get("email") or "").strip().lower()
        new_expiry = now + timedelta(days=180)

        # Find and extend latest consultation submission
        query = {"business_id": business_id}
        or_clauses = [{"client_id": client_id}]
        if client_email:
            or_clauses.append({"client_email": client_email})
            if enc.enabled:
                or_clauses.append({"client_email": enc.encrypt_deterministic(client_email)})
        query["$or"] = or_clauses

        latest = await db.consultation_submissions.find_one(
            query, sort=[("submitted_at", -1)]
        )

        extended = False
        if latest:
            await db.consultation_submissions.update_one(
                {"_id": latest["_id"]},
                {"$set": {"expires_at": new_expiry, "validity_extended_at": now, "validity_extended_by": tenant.user_id}},
            )
            # Also update client record
            await db.clients.update_one(
                {"_id": ObjectId(client_id)},
                {"$set": {"consultation_expires": new_expiry}},
            )
            extended = True

        # Log medical data access
        await log_medical_access(
            event_type="health_check_no_changes",
            business_id=business_id,
            accessed_by=tenant.user_id,
            accessor_role=tenant.role,
            accessor_email=tenant.user_email,
            client_email=client_email,
            details=f"No changes confirmed. Form validity extended to {new_expiry.isoformat()}" if extended else "No changes confirmed, no form to extend",
        )

        return {
            "flagged": False,
            "flags": [],
            "action": "no_action",
            "message": "No health changes confirmed",
            "form_extended": extended,
            "new_expiry": new_expiry.isoformat() if extended else None,
        }

    # Flags raised — require therapist review
    # Log medical data access
    await log_medical_access(
        event_type="health_check_flagged",
        business_id=business_id,
        accessed_by=tenant.user_id,
        accessor_role=tenant.role,
        accessor_email=tenant.user_email,
        client_email=(client.get("email") or "").strip().lower(),
        details=f"Health flags raised: {', '.join(raised_flags)}",
    )

    return {
        "flagged": True,
        "flags": raised_flags,
        "action": "therapist_review_required",
        "message": f"{len(raised_flags)} health change(s) reported — therapist review required before treatment",
    }


# ═══════════════════════════════════════════════════════════════
# 4C: CONTRAINDICATION RULES — custom per-business overrides
# ═══════════════════════════════════════════════════════════════

CONDITION_LABELS = {
    "pregnant": "Pregnant / Breastfeeding",
    "pacemaker": "Pacemaker / Electronic Implant",
    "metalImplants": "Metal Implants in Treatment Area",
    "bloodClotting": "Blood Clotting Disorder",
    "activeCancer": "Active Cancer / Undergoing Treatment",
    "keloid": "History of Keloid Scarring",
    "skinInfection": "Active Skin Infection",
    "autoimmune": "Autoimmune Disease",
    "epilepsy": "Epilepsy",
    "herpes": "Active Herpes / Cold Sore",
    "roaccutane": "Roaccutane (last 6 months)",
    "bloodThinners": "Blood Thinning Medication",
    "retinoids": "Topical Retinoids (last 7 days)",
    "photosensitising": "Photosensitising Medication",
    "immunosuppressants": "Immunosuppressant Medication",
    "sunburn": "Active Sunburn",
    "sunbed": "Sunbed Use (last 2 weeks)",
    "fishAllergy": "Fish / Salmon Allergy",
    "fillersRecent": "Dermal Fillers (last 6 months)",
    "uncontrolledDiabetes": "Uncontrolled Diabetes",
}


@router.post("/business/{business_id}/contraindication-rules")
async def set_contraindication_rules(
    business_id: str,
    payload: dict = Body(...),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Owner sets custom BLOCK/FLAG/OK per condition per treatment.
    Overrides the default matrix for this business.
    """
    rules = payload.get("rules")
    if not rules or not isinstance(rules, dict):
        raise HTTPException(400, "rules is required (dict of condition → {treatment: BLOCK|FLAG|OK})")

    # Validate structure
    valid_levels = {"BLOCK", "FLAG", "OK"}
    valid_treatments = set(TREATMENT_LABELS.keys())

    for condition, treatment_rules in rules.items():
        if not isinstance(treatment_rules, dict):
            raise HTTPException(400, f"Invalid rule format for '{condition}' — must be {{treatment: level}}")
        for treatment, level in treatment_rules.items():
            if treatment not in valid_treatments:
                raise HTTPException(400, f"Invalid treatment '{treatment}'. Valid: {', '.join(sorted(valid_treatments))}")
            if level not in valid_levels:
                raise HTTPException(400, f"Invalid level '{level}' for {condition}/{treatment}. Must be BLOCK, FLAG, or OK")

    db = get_database()
    now = datetime.utcnow()

    # Store as custom contra_matrix on the consultation template
    await db.consultation_templates.update_one(
        {"business_id": business_id},
        {
            "$set": {
                "contra_matrix": rules,
                "contra_matrix_updated_at": now,
                "contra_matrix_updated_by": tenant.user_id,
            },
            "$setOnInsert": {"created_at": now, "business_id": business_id},
        },
        upsert=True,
    )

    return {
        "ok": True,
        "message": f"Custom contraindication rules saved ({len(rules)} conditions)",
        "conditions_count": len(rules),
    }


@router.get("/business/{business_id}/contraindication-check")
async def check_contraindications(
    business_id: str,
    client_id: str = Query(...),
    service_id: str = Query(None),
    service_name: str = Query(None),
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Check a client's health data against the business's contraindication rules
    for a specific service. Returns OK/FLAG/BLOCK with alternatives.
    """
    db = get_database()
    enc = TenantEncryption(business_id)

    # Verify client
    try:
        client = await db.clients.find_one({"_id": ObjectId(client_id), "businessId": business_id})
    except Exception:
        client = None
    if not client:
        try:
            client = await db.clients.find_one({"_id": ObjectId(client_id), "business_id": business_id})
        except Exception:
            pass
    if not client:
        raise HTTPException(404, "Client not found")

    client_email = (client.get("email") or "").strip().lower()

    # Get client's latest consultation form data
    query = {"business_id": business_id}
    or_clauses = [{"client_id": client_id}]
    if client_email:
        or_clauses.append({"client_email": client_email})
        if enc.enabled:
            or_clauses.append({"client_email": enc.encrypt_deterministic(client_email)})
    query["$or"] = or_clauses

    latest = await db.consultation_submissions.find_one(
        query, sort=[("submitted_at", -1)]
    )

    if not latest:
        return {
            "result": "OK",
            "message": "No consultation form on file — cannot check contraindications",
            "flags": [],
            "blocked_reason": None,
            "alternative_services": [],
            "has_form": False,
        }

    form_data = latest.get("form_data", {})

    # Also factor in recent health checks
    health_checks = client.get("health_checks", [])
    latest_check = health_checks[-1] if health_checks else None
    if latest_check and latest_check.get("flags"):
        # Map health check flags to form_data keys
        check_to_form = {
            "pregnant": "pregnant",
            "new_medication": None,  # Generic — can't map to specific condition
            "skin_conditions": "skinInfection",
            "allergies": None,
            "recent_surgery": None,
        }
        for flag in latest_check["flags"]:
            mapped = check_to_form.get(flag)
            if mapped:
                form_data[mapped] = "yes"

    # Get business's custom matrix or default
    template = await db.consultation_templates.find_one({"business_id": business_id})
    matrix = (template or {}).get("contra_matrix", DEFAULT_CONTRA_MATRIX)

    # Determine treatment key from service_id or service_name
    treatment_key = None
    svc_text = ""

    if service_id:
        # Look up service in business menu
        try:
            biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
        except Exception:
            biz = await db.businesses.find_one({"_id": business_id})
        if biz:
            for item in biz.get("menu", []):
                if item.get("id") == service_id or str(item.get("_id", "")) == service_id:
                    svc_text = (item.get("name", "") + " " + (item.get("category") or "")).lower()
                    break
                for sub in item.get("services", []):
                    if sub.get("id") == service_id or str(sub.get("_id", "")) == service_id:
                        svc_text = (sub.get("name", "") + " " + (sub.get("category") or "")).lower()
                        break
                if svc_text:
                    break
        # Also check services collection
        if not svc_text:
            svc_doc = await db.services.find_one({"_id": ObjectId(service_id) if ObjectId.is_valid(service_id) else service_id, "business_id": business_id})
            if svc_doc:
                svc_text = (svc_doc.get("name", "") + " " + (svc_doc.get("category") or "")).lower()

    if service_name:
        svc_text = service_name.lower()

    # Map service text to treatment key
    if svc_text:
        if "microneedling" in svc_text and "rf" not in svc_text:
            treatment_key = "microneedling"
        elif "rf" in svc_text or "radio frequency" in svc_text or "radiofrequency" in svc_text:
            treatment_key = "rf"
        elif "peel" in svc_text or "chemical" in svc_text or "biorep" in svc_text:
            treatment_key = "peel"
        elif "polynuc" in svc_text:
            treatment_key = "polynucleotides"
        elif "lymph" in svc_text or "lift" in svc_text:
            treatment_key = "lymphatic"
        elif "derma" in svc_text:
            treatment_key = "dermaplaning"
        elif "laser" in svc_text:
            treatment_key = "laser"

    # Run contraindication check
    all_alerts = run_contraindication_check(form_data, matrix)

    if treatment_key:
        # Filter to only this treatment
        blocks = [a for a in all_alerts["blocks"] if a["treatment"] == treatment_key]
        flags = [a for a in all_alerts["flags"] if a["treatment"] == treatment_key]
    else:
        # No specific treatment matched — return all
        blocks = all_alerts["blocks"]
        flags = all_alerts["flags"]

    # Determine result
    if blocks:
        blocked_conditions = [CONDITION_LABELS.get(b["condition"], b["condition"]) for b in blocks]
        blocked_reason = f"Contraindicated due to: {', '.join(blocked_conditions)}"

        # Find alternative services that are NOT blocked
        all_treatments = set(TREATMENT_LABELS.keys())
        blocked_treatments = set()
        for b in all_alerts["blocks"]:
            blocked_treatments.add(b["treatment"])
        safe_treatments = all_treatments - blocked_treatments
        alternatives = [{"key": t, "name": TREATMENT_LABELS.get(t, t)} for t in sorted(safe_treatments)]

        result = {
            "result": "BLOCK",
            "message": blocked_reason,
            "flags": [{"condition": b["condition"], "condition_label": CONDITION_LABELS.get(b["condition"], b["condition"]), "treatment": b["treatment"]} for b in blocks],
            "blocked_reason": blocked_reason,
            "alternative_services": alternatives,
            "has_form": True,
        }
    elif flags:
        result = {
            "result": "FLAG",
            "message": "Requires practitioner review before proceeding",
            "flags": [{"condition": f["condition"], "condition_label": CONDITION_LABELS.get(f["condition"], f["condition"]), "treatment": f["treatment"]} for f in flags],
            "blocked_reason": None,
            "alternative_services": [],
            "has_form": True,
        }
    else:
        result = {
            "result": "OK",
            "message": "No contraindications found",
            "flags": [],
            "blocked_reason": None,
            "alternative_services": [],
            "has_form": True,
        }

    # Log medical data access
    await log_medical_access(
        event_type="contraindication_check",
        business_id=business_id,
        accessed_by=tenant.user_id,
        accessor_role=tenant.role,
        accessor_email=tenant.user_email,
        client_email=client_email,
        details=f"Check for service={service_name or service_id or 'all'} result={result['result']}",
    )

    return result
