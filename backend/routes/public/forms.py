"""
Public Contact Form Submissions
================================
Handles contact form submissions from published ReeveOS websites.
Rate-limited, with optional email notification to business owner.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from database import get_database
from middleware.tenant import verify_business_access, TenantContext
from middleware.auth import get_current_user
from middleware.rate_limit import limiter
from bson import ObjectId
from datetime import datetime
from typing import Optional
import re, logging

logger = logging.getLogger("forms")
router = APIRouter(prefix="/forms", tags=["Forms"])

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def _doc(d):
    if d is None:
        return None
    d["id"] = str(d.pop("_id"))
    return d


# ─── PUBLIC: Submit contact form ───

@router.post("/{business_id}/contact")
@limiter.limit("5/minute")
async def submit_contact_form(
    request: Request,
    business_id: str,
    body: dict,
):
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip()
    message = (body.get("message") or "").strip()
    phone = (body.get("phone") or "").strip()
    page_slug = (body.get("page_slug") or "").strip()

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not email or not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Valid email is required")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    db = get_database()

    # Verify business exists
    business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not business:
        raise HTTPException(status_code=404, detail="Not found")

    submission = {
        "business_id": business_id,
        "name": name,
        "email": email,
        "phone": phone,
        "message": message,
        "page_slug": page_slug,
        "ip": request.client.host if request.client else "",
        "created_at": datetime.utcnow(),
        "read": False,
    }
    await db.form_submissions.insert_one(submission)

    # Try to send email notification
    try:
        from helpers.email import send_email, wrap_html
        settings = await db.website_settings.find_one({"business_id": business_id})
        notify_email = None
        if settings:
            integrations = settings.get("integrations", {})
            notify_email = integrations.get("notification_email") or integrations.get("email")
        if not notify_email:
            notify_email = business.get("email") or business.get("owner_email")

        if notify_email:
            html = wrap_html(f"""
                <h2>New Contact Form Submission</h2>
                <p><strong>Name:</strong> {name}</p>
                <p><strong>Email:</strong> {email}</p>
                {f'<p><strong>Phone:</strong> {phone}</p>' if phone else ''}
                <p><strong>Message:</strong></p>
                <p>{message}</p>
                {f'<p style="color:#999;font-size:12px">From page: /{page_slug}</p>' if page_slug else ''}
            """)
            await send_email(
                to=notify_email,
                subject=f"New contact form submission from {name}",
                html=html,
            )
    except Exception as e:
        logger.warning("Failed to send form notification email: %s", e)

    return {"ok": True, "message": "Message sent successfully"}


# ─── DASHBOARD: List submissions ───

@router.get("/business/{bid}/submissions")
async def list_submissions(
    bid: str,
    read: Optional[str] = None,
    tc: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    query = {"business_id": bid}
    if read == "true":
        query["read"] = True
    elif read == "false":
        query["read"] = False
    submissions = await db.form_submissions.find(query).sort("created_at", -1).to_list(500)
    return {"submissions": [_doc(s) for s in submissions]}


# ─── DASHBOARD: Mark as read ───

@router.put("/business/{bid}/submissions/{sub_id}/read")
async def mark_submission_read(
    bid: str,
    sub_id: str,
    tc: TenantContext = Depends(verify_business_access),
):
    db = get_database()
    try:
        oid = ObjectId(sub_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid submission ID")

    result = await db.form_submissions.update_one(
        {"_id": oid, "business_id": bid},
        {"$set": {"read": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {"ok": True}
