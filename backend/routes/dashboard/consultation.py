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

    # Upsert client record
    client = await db.clients.find_one({"email": client_email, "business_id": biz_id})
    if client:
        client_id = str(client["_id"])
        await db.clients.update_one(
            {"_id": client["_id"]},
            {"$set": {
                "name": client_name,
                "phone": client_phone,
                "consultation_status": status,
                "consultation_expires": expires_at,
                "updated_at": now,
            }}
        )
    else:
        result = await db.clients.insert_one({
            "name": client_name,
            "email": client_email,
            "phone": client_phone,
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
        })
        client_id = str(result.inserted_id)

    # Encrypt PII fields before storing
    enc = TenantEncryption(biz_id)
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

    return {
        "submission_id": str(result.inserted_id),
        "client_id": client_id,
        "status": status,
        "alerts": alerts,
        "expires_at": expires_at.isoformat(),
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
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(400, "Email required")
    now = datetime.utcnow()

    latest = await db.consultation_submissions.find_one(
        {"business_id": business_id, "client_email": email, "expires_at": {"$gte": now}},
        sort=[("submitted_at", -1)],
    )

    if not latest:
        return {"has_valid_form": False, "status": None, "expires_at": None}

    return {
        "has_valid_form": True,
        "status": latest.get("status", "clear"),
        "submitted_at": latest["submitted_at"].isoformat(),
        "expires_at": latest["expires_at"].isoformat(),
        "alerts": latest.get("alerts", {"blocks": [], "flags": []}),
        "submission_id": str(latest["_id"]),
    }
