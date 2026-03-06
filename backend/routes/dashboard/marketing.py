"""
ReeveOS Marketing Campaigns
===========================
Campaign CRUD, audience segmentation, drip sequences, actual sending via Resend.
Used by business owners to email their customers from the dashboard.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks, Body
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
from middleware.auth import get_current_owner, get_current_user
from helpers.email import send_email, send_batch, render_template, wrap_html, CAMPAIGNS_FROM, log_email_event
import logging
from middleware.tenant import set_user_tenant_context, TenantContext

router = APIRouter(prefix="/marketing", tags=["marketing"])
logger = logging.getLogger(__name__)


# ─── Models ─── #

class CampaignCreate(BaseModel):
    name: str
    type: str = "email"  # email | sms (sms future)
    subject: Optional[str] = None
    body: str
    audience: str = "all"  # all | new | returning | inactive | recent | vip | custom
    audience_filters: Optional[Dict] = None
    scheduled_at: Optional[datetime] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    audience: Optional[str] = None
    audience_filters: Optional[Dict] = None
    scheduled_at: Optional[datetime] = None


class DripCreate(BaseModel):
    name: str
    trigger: str  # "post_booking" | "post_visit" | "new_client" | "inactive_30" | "inactive_60" | "inactive_90"
    steps: List[Dict]  # [{"delay_days": 0, "subject": "...", "body": "..."}, ...]
    audience: str = "all"
    is_active: bool = True


# ─── Helpers ─── #

def serialize_doc(doc):
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


def serialize_list(docs):
    return [serialize_doc(d) for d in docs]


async def _get_business_id(current_user: dict) -> str:
    """Get business_id from user, checking ownership."""
    business_id = current_user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business associated with this account")
    return str(business_id)


async def _get_audience_emails(business_id: str, audience: str, filters: Optional[Dict] = None) -> List[Dict]:
    """
    Build recipient list from bookings/reservations data.
    Returns list of: [{"email": "...", "name": "...", "last_visit": "...", "visit_count": N}]
    """
    db = get_database()
    now = datetime.utcnow()

    # Aggregate unique clients from bookings (handle both field naming conventions)
    pipeline = [
        {"$match": {
            "$or": [
                {"business_id": business_id, "client_email": {"$exists": True, "$ne": ""}},
                {"businessId": business_id, "customer.email": {"$exists": True, "$ne": ""}},
            ]
        }},
        {"$addFields": {
            "_email": {"$ifNull": ["$client_email", "$customer.email"]},
            "_name": {"$ifNull": ["$client_name", "$customer.name"]},
        }},
        {"$group": {
            "_id": "$_email",
            "name": {"$last": "$_name"},
            "last_visit": {"$max": "$date"},
            "visit_count": {"$sum": 1},
            "first_visit": {"$min": "$date"},
        }},
        {"$sort": {"last_visit": -1}},
    ]

    clients = {}

    # Pull from bookings collection
    async for doc in db.bookings.aggregate(pipeline):
        email = (doc["_id"] or "").lower().strip()
        if email:
            clients[email] = {
                "email": email,
                "name": doc.get("name", ""),
                "client_name": doc.get("name", ""),
                "last_visit": str(doc.get("last_visit", "")),
                "visit_count": doc.get("visit_count", 0),
                "first_visit": str(doc.get("first_visit", "")),
            }

    # Also check clients collection directly
    try:
        async for doc in db.clients.find({"business_id": business_id, "email": {"$exists": True, "$ne": ""}}):
            email = doc.get("email", "").lower().strip()
            if email and email not in clients:
                clients[email] = {
                    "email": email,
                    "name": doc.get("name", doc.get("first_name", "")),
                    "client_name": doc.get("name", doc.get("first_name", "")),
                    "last_visit": str(doc.get("last_visit", "")),
                    "visit_count": doc.get("visit_count", doc.get("total_visits", 0)),
                    "first_visit": str(doc.get("created_at", "")),
                }
    except Exception:
        pass

    # Filter by audience segment
    recipients = list(clients.values())

    # Check unsubscribes
    unsubscribed = set()
    async for doc in db.email_unsubscribes.find({"business_id": business_id}):
        unsubscribed.add(doc.get("email", "").lower())

    recipients = [r for r in recipients if r["email"] not in unsubscribed]

    if audience == "all":
        return recipients
    elif audience == "new":
        return [r for r in recipients if r.get("visit_count", 0) <= 1]
    elif audience == "returning":
        return [r for r in recipients if r.get("visit_count", 0) >= 2]
    elif audience == "vip":
        return [r for r in recipients if r.get("visit_count", 0) >= 5]
    elif audience == "inactive":
        cutoff = (now - timedelta(days=90)).isoformat()
        return [r for r in recipients if r.get("last_visit", "") < cutoff]
    elif audience == "recent":
        cutoff = (now - timedelta(days=30)).isoformat()
        return [r for r in recipients if r.get("last_visit", "") >= cutoff]
    elif audience == "custom" and filters:
        # Custom filter: {"min_visits": 3, "inactive_days": 60, ...}
        min_visits = filters.get("min_visits", 0)
        max_visits = filters.get("max_visits", 99999)
        inactive_days = filters.get("inactive_days")

        filtered = [r for r in recipients if min_visits <= r.get("visit_count", 0) <= max_visits]

        if inactive_days:
            cutoff = (now - timedelta(days=inactive_days)).isoformat()
            filtered = [r for r in filtered if r.get("last_visit", "") < cutoff]

        return filtered
    else:
        return recipients


# ─── Campaign CRUD ─── #

@router.post("/campaigns")
async def create_campaign(data: CampaignCreate, tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)

    # Get business name for template variables
    business = await db.businesses.find_one({"_id": ObjectId(business_id)}) if ObjectId.is_valid(business_id) else await db.businesses.find_one({"_id": business_id})
    business_name = business.get("name", "Your Business") if business else "Your Business"

    campaign = {
        "business_id": business_id,
        "business_name": business_name,
        "name": data.name,
        "type": data.type,
        "subject": data.subject or data.name,
        "body": data.body,
        "audience": data.audience,
        "audience_filters": data.audience_filters or {},
        "status": "draft",
        "scheduled_at": data.scheduled_at,
        "sent_at": None,
        "stats": {
            "total_recipients": 0,
            "sent": 0,
            "delivered": 0,
            "opened": 0,
            "clicked": 0,
            "bounced": 0,
            "complained": 0,
        },
        "created_by": str(current_user["_id"]),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.campaigns.insert_one(campaign)
    campaign["_id"] = result.inserted_id
    return serialize_doc(campaign)


@router.get("/campaigns")
async def list_campaigns(
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    db = get_database()
    business_id = await _get_business_id(current_user)

    query = {"business_id": business_id}
    if status:
        query["status"] = status

    docs = await db.campaigns.find(query).sort("created_at", -1).to_list(limit)
    return serialize_list(docs)


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)

    doc = await db.campaigns.find_one({"_id": ObjectId(campaign_id), "business_id": business_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return serialize_doc(doc)


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, data: CampaignUpdate, tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)

    # Only allow editing drafts
    campaign = await db.campaigns.find_one({
        "_id": ObjectId(campaign_id),
        "business_id": business_id,
        "status": "draft",
    })
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found or already sent")

    update_data = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    update_data["updated_at"] = datetime.utcnow()

    await db.campaigns.update_one({"_id": ObjectId(campaign_id)}, {"$set": update_data})

    updated = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    return serialize_doc(updated)


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)

    result = await db.campaigns.delete_one({
        "_id": ObjectId(campaign_id),
        "business_id": business_id,
        "status": "draft",
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found or already sent")
    return {"message": "Campaign deleted"}


# ─── Audience Builder ─── #

@router.get("/audience/count")
async def get_audience_count(
    audience: str = Query("all"),
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    """Preview recipient count for an audience segment."""
    business_id = await _get_business_id(current_user)
    recipients = await _get_audience_emails(business_id, audience)
    return {"count": len(recipients), "audience": audience}


@router.get("/audience/preview")
async def preview_audience(
    audience: str = Query("all"),
    limit: int = Query(20, ge=1, le=100),
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    """Preview the audience list with names and visit counts."""
    business_id = await _get_business_id(current_user)
    recipients = await _get_audience_emails(business_id, audience)

    return {
        "recipients": recipients[:limit],
        "total": len(recipients),
        "audience": audience,
    }


# ─── Send Campaign ─── #

async def _execute_campaign_send(campaign_id: str, business_id: str):
    """Background task: actually send the campaign emails via Resend."""
    db = get_database()

    campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        logger.error(f"Campaign {campaign_id} not found for sending")
        return

    recipients = await _get_audience_emails(business_id, campaign.get("audience", "all"), campaign.get("audience_filters"))

    if not recipients:
        await db.campaigns.update_one(
            {"_id": ObjectId(campaign_id)},
            {"$set": {"status": "sent", "sent_at": datetime.utcnow(), "stats.total_recipients": 0}}
        )
        return

    # Update status
    await db.campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {
            "status": "sending",
            "stats.total_recipients": len(recipients),
            "updated_at": datetime.utcnow(),
        }}
    )

    # Build HTML from body text
    body_html = campaign.get("body", "").replace("\n", "<br>")
    html_template = wrap_html(body_html, preheader=campaign.get("subject", ""))

    # Add business_name and booking_link to each recipient's variables
    business = await db.businesses.find_one({"_id": ObjectId(business_id)}) if ObjectId.is_valid(business_id) else None
    business_name = business.get("name", "") if business else campaign.get("business_name", "")
    booking_link = f"https://portal.rezvo.app/book/{business.get('slug', business_id)}" if business else ""

    for r in recipients:
        r["business_name"] = business_name
        r["booking_link"] = booking_link

    # Determine from address — use business name if available
    from_addr = f"{business_name} via ReeveOS <campaigns@reeveos.app>" if business_name else CAMPAIGNS_FROM

    # Send batch
    result = await send_batch(
        recipients=recipients,
        subject=campaign.get("subject", campaign.get("name", "Update")),
        html_template=html_template,
        from_email=from_addr,
        tags=[
            {"name": "campaign_id", "value": campaign_id},
            {"name": "business_id", "value": business_id},
        ],
    )

    # Log each send event
    for r in recipients:
        await log_email_event(
            email_id=campaign_id,
            event_type="sent",
            recipient=r["email"],
            metadata={"campaign_id": campaign_id, "business_id": business_id},
        )

    # Update campaign stats
    await db.campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {
            "status": "sent",
            "sent_at": datetime.utcnow(),
            "stats.sent": result.get("sent", 0),
            "stats.delivered": result.get("sent", 0),  # Assume delivered until webhook says otherwise
            "stats.failed": result.get("failed", 0),
            "updated_at": datetime.utcnow(),
        }}
    )

    # Save individual recipient records for tracking
    for r in recipients:
        await db.campaign_recipients.insert_one({
            "campaign_id": campaign_id,
            "business_id": business_id,
            "email": r["email"],
            "name": r.get("name", ""),
            "status": "sent",
            "sent_at": datetime.utcnow(),
            "opened_at": None,
            "clicked_at": None,
        })

    logger.info(f"Campaign {campaign_id} sent to {result.get('sent', 0)} recipients")


@router.post("/campaigns/{campaign_id}/send")
async def send_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    """Send a campaign immediately (runs in background)."""
    db = get_database()
    business_id = await _get_business_id(current_user)

    campaign = await db.campaigns.find_one({
        "_id": ObjectId(campaign_id),
        "business_id": business_id,
    })
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.get("status") not in ("draft", "scheduled"):
        raise HTTPException(status_code=400, detail=f"Cannot send campaign with status: {campaign['status']}")

    # Preview count before sending
    recipients = await _get_audience_emails(business_id, campaign.get("audience", "all"), campaign.get("audience_filters"))

    # Queue the send
    background_tasks.add_task(_execute_campaign_send, campaign_id, business_id)

    return {
        "message": f"Campaign queued for sending to {len(recipients)} recipients",
        "recipient_count": len(recipients),
        "status": "sending",
    }


@router.post("/campaigns/{campaign_id}/test")
async def send_test_email(
    campaign_id: str,
    test_email: str = Query(..., description="Email to send test to"),
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    """Send a test email for a campaign to yourself."""
    db = get_database()
    business_id = await _get_business_id(current_user)

    campaign = await db.campaigns.find_one({
        "_id": ObjectId(campaign_id),
        "business_id": business_id,
    })
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    business = await db.businesses.find_one({"_id": ObjectId(business_id)}) if ObjectId.is_valid(business_id) else None
    business_name = business.get("name", "") if business else ""

    # Render with test data
    test_vars = {
        "client_name": "Test User",
        "name": "Test User",
        "business_name": business_name,
        "booking_link": f"https://portal.rezvo.app/book/test",
        "email": test_email,
    }

    body_html = campaign.get("body", "").replace("\n", "<br>")
    rendered_body = render_template(body_html, test_vars)
    html = wrap_html(rendered_body, preheader=campaign.get("subject", ""))
    rendered_subject = render_template(campaign.get("subject", "Test"), test_vars)

    result = await send_email(
        to=test_email,
        subject=f"[TEST] {rendered_subject}",
        html=html,
        from_email=CAMPAIGNS_FROM,
    )

    return {"message": "Test email sent", "result": result}


# ─── Campaign Stats ─── #

@router.get("/campaigns/{campaign_id}/stats")
async def get_campaign_stats(campaign_id: str, tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)

    campaign = await db.campaigns.find_one({
        "_id": ObjectId(campaign_id),
        "business_id": business_id,
    })
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Get live stats from email events
    stats = campaign.get("stats", {})

    # Count from campaign_recipients for real-time accuracy
    total = await db.campaign_recipients.count_documents({"campaign_id": campaign_id})
    opened = await db.campaign_recipients.count_documents({"campaign_id": campaign_id, "opened_at": {"$ne": None}})
    clicked = await db.campaign_recipients.count_documents({"campaign_id": campaign_id, "clicked_at": {"$ne": None}})

    return {
        "campaign_id": campaign_id,
        "status": campaign.get("status"),
        "sent_at": campaign.get("sent_at"),
        "total_recipients": total or stats.get("total_recipients", 0),
        "sent": stats.get("sent", total),
        "delivered": stats.get("delivered", 0),
        "opened": opened or stats.get("opened", 0),
        "clicked": clicked or stats.get("clicked", 0),
        "bounced": stats.get("bounced", 0),
        "complained": stats.get("complained", 0),
        "open_rate": round(opened / max(total, 1) * 100, 1),
        "click_rate": round(clicked / max(total, 1) * 100, 1),
    }


# ─── Campaign Templates ─── #

TEMPLATES = [
    {
        "id": "welcome_back",
        "name": "Welcome Back",
        "category": "re-engagement",
        "audience": "inactive",
        "subject": "We miss you at {business_name}! 💛",
        "body": "Hi {client_name},\n\nIt's been a while since your last visit to {business_name} and we'd love to see you again!\n\nBook your next appointment today:\n{booking_link}\n\nWe look forward to seeing you soon!",
    },
    {
        "id": "thank_you",
        "name": "Thank You",
        "category": "post-visit",
        "audience": "recent",
        "subject": "Thanks for visiting {business_name}!",
        "body": "Hi {client_name},\n\nThank you for visiting {business_name}! We hope you had a great experience.\n\nWe'd love to hear your thoughts — your feedback helps us improve.\n\nSee you next time!",
    },
    {
        "id": "seasonal_offer",
        "name": "Seasonal Offer",
        "category": "promotion",
        "audience": "all",
        "subject": "Something special from {business_name} 🎉",
        "body": "Hi {client_name},\n\nWe've got something special for you at {business_name}!\n\n[Add your offer details here]\n\nBook now to take advantage:\n{booking_link}\n\nLimited availability — don't miss out!",
    },
    {
        "id": "loyalty_reward",
        "name": "Loyalty Reward",
        "category": "loyalty",
        "audience": "vip",
        "subject": "A special thank you for being a loyal customer ⭐",
        "body": "Hi {client_name},\n\nYou've been a loyal customer of {business_name} and we want to say thank you!\n\n[Add your reward details here]\n\nBook your next visit:\n{booking_link}\n\nThank you for your continued support!",
    },
    {
        "id": "new_service",
        "name": "New Service/Menu Item",
        "category": "announcement",
        "audience": "all",
        "subject": "Something new at {business_name}! 🆕",
        "body": "Hi {client_name},\n\nExciting news — we've added something new to {business_name}!\n\n[Describe your new service or menu item]\n\nBe one of the first to try it:\n{booking_link}\n\nWe can't wait to show you!",
    },
    {
        "id": "last_minute",
        "name": "Last-Minute Availability",
        "category": "urgency",
        "audience": "all",
        "subject": "Last-minute availability at {business_name} 🕐",
        "body": "Hi {client_name},\n\nWe've just had some cancellations and have availability today/this week!\n\n[Add specific times/dates]\n\nGrab a spot before they're gone:\n{booking_link}",
    },
]


@router.get("/templates")
async def get_templates():
    """Get pre-built campaign templates."""
    return {"templates": TEMPLATES}


# ─── Drip Sequences ─── #

@router.post("/drips")
async def create_drip(data: DripCreate, tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    """Create an automated drip sequence."""
    db = get_database()
    business_id = await _get_business_id(current_user)

    drip = {
        "business_id": business_id,
        "name": data.name,
        "trigger": data.trigger,
        "steps": data.steps,  # [{"delay_days": 0, "subject": "...", "body": "..."}, ...]
        "audience": data.audience,
        "is_active": data.is_active,
        "stats": {"enrolled": 0, "completed": 0, "unsubscribed": 0},
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.drip_sequences.insert_one(drip)
    drip["_id"] = result.inserted_id
    return serialize_doc(drip)


@router.get("/drips")
async def list_drips(tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)
    docs = await db.drip_sequences.find({"business_id": business_id}).sort("created_at", -1).to_list(50)
    return serialize_list(docs)


@router.get("/drips/{drip_id}")
async def get_drip(drip_id: str, tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)
    doc = await db.drip_sequences.find_one({"_id": ObjectId(drip_id), "business_id": business_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Drip sequence not found")
    return serialize_doc(doc)


@router.patch("/drips/{drip_id}")
async def update_drip(drip_id: str, data: dict, tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)

    allowed = {"name", "trigger", "steps", "audience", "is_active"}
    update_data = {k: v for k, v in data.items() if k in allowed}
    update_data["updated_at"] = datetime.utcnow()

    result = await db.drip_sequences.update_one(
        {"_id": ObjectId(drip_id), "business_id": business_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Drip sequence not found")

    updated = await db.drip_sequences.find_one({"_id": ObjectId(drip_id)})
    return serialize_doc(updated)


@router.delete("/drips/{drip_id}")
async def delete_drip(drip_id: str, tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)

    result = await db.drip_sequences.delete_one({"_id": ObjectId(drip_id), "business_id": business_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Drip sequence not found")
    return {"message": "Drip sequence deleted"}


@router.post("/drips/{drip_id}/toggle")
async def toggle_drip(drip_id: str, tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    """Toggle a drip sequence on/off."""
    db = get_database()
    business_id = await _get_business_id(current_user)

    drip = await db.drip_sequences.find_one({"_id": ObjectId(drip_id), "business_id": business_id})
    if not drip:
        raise HTTPException(status_code=404, detail="Drip sequence not found")

    new_state = not drip.get("is_active", False)
    await db.drip_sequences.update_one(
        {"_id": ObjectId(drip_id)},
        {"$set": {"is_active": new_state, "updated_at": datetime.utcnow()}},
    )

    return {"is_active": new_state, "message": f"Drip sequence {'activated' if new_state else 'paused'}"}


# ─── Drip Enrollment (called by booking/reservation system) ─── #

async def enroll_in_drip(business_id: str, trigger: str, client_email: str, client_name: str = ""):
    """
    Enroll a client in matching drip sequences.
    Called internally when bookings are created, completed, etc.
    """
    db = get_database()

    # Find active drips matching this trigger
    drips = await db.drip_sequences.find({
        "business_id": business_id,
        "trigger": trigger,
        "is_active": True,
    }).to_list(10)

    for drip in drips:
        # Check if already enrolled
        existing = await db.drip_enrollments.find_one({
            "drip_id": str(drip["_id"]),
            "email": client_email,
        })
        if existing:
            continue

        # Enroll
        enrollment = {
            "drip_id": str(drip["_id"]),
            "business_id": business_id,
            "email": client_email,
            "name": client_name,
            "current_step": 0,
            "status": "active",  # active | completed | unsubscribed
            "enrolled_at": datetime.utcnow(),
            "next_send_at": datetime.utcnow() + timedelta(days=drip["steps"][0].get("delay_days", 0)),
            "completed_steps": [],
        }
        await db.drip_enrollments.insert_one(enrollment)

        # Update stats
        await db.drip_sequences.update_one(
            {"_id": drip["_id"]},
            {"$inc": {"stats.enrolled": 1}},
        )

        logger.info(f"Enrolled {client_email} in drip '{drip['name']}' for business {business_id}")


async def process_drip_queue():
    """
    Process pending drip steps. Call this from a scheduled task (e.g. every 15 minutes).
    Finds enrollments where next_send_at <= now and sends the next step.
    """
    db = get_database()
    now = datetime.utcnow()

    pending = await db.drip_enrollments.find({
        "status": "active",
        "next_send_at": {"$lte": now},
    }).to_list(100)

    for enrollment in pending:
        drip = await db.drip_sequences.find_one({"_id": ObjectId(enrollment["drip_id"])})
        if not drip or not drip.get("is_active"):
            continue

        step_index = enrollment.get("current_step", 0)
        steps = drip.get("steps", [])

        if step_index >= len(steps):
            # Completed all steps
            await db.drip_enrollments.update_one(
                {"_id": enrollment["_id"]},
                {"$set": {"status": "completed"}},
            )
            await db.drip_sequences.update_one(
                {"_id": drip["_id"]},
                {"$inc": {"stats.completed": 1}},
            )
            continue

        step = steps[step_index]

        # Get business info
        business = await db.businesses.find_one({"_id": ObjectId(enrollment["business_id"])}) if ObjectId.is_valid(enrollment["business_id"]) else None
        business_name = business.get("name", "") if business else ""

        # Build variables
        variables = {
            "client_name": enrollment.get("name", "there"),
            "name": enrollment.get("name", "there"),
            "business_name": business_name,
            "booking_link": f"https://portal.rezvo.app/book/{business.get('slug', enrollment['business_id'])}" if business else "",
            "email": enrollment["email"],
        }

        # Render and send
        body_html = render_template(step.get("body", "").replace("\n", "<br>"), variables)
        html = wrap_html(body_html, preheader=step.get("subject", ""))
        subject = render_template(step.get("subject", ""), variables)
        from_addr = f"{business_name} via ReeveOS <campaigns@reeveos.app>" if business_name else CAMPAIGNS_FROM

        result = await send_email(
            to=enrollment["email"],
            subject=subject,
            html=html,
            from_email=from_addr,
        )

        # Update enrollment
        next_step = step_index + 1
        next_send = None
        if next_step < len(steps):
            next_send = now + timedelta(days=steps[next_step].get("delay_days", 1))

        await db.drip_enrollments.update_one(
            {"_id": enrollment["_id"]},
            {"$set": {
                "current_step": next_step,
                "next_send_at": next_send,
                "status": "active" if next_step < len(steps) else "completed",
            }, "$push": {
                "completed_steps": {
                    "step": step_index,
                    "sent_at": now,
                    "success": result.get("success", False),
                },
            }},
        )

        if next_step >= len(steps):
            await db.drip_sequences.update_one(
                {"_id": drip["_id"]},
                {"$inc": {"stats.completed": 1}},
            )

        await log_email_event(
            email_id=result.get("id", ""),
            event_type="sent",
            recipient=enrollment["email"],
            metadata={"drip_id": enrollment["drip_id"], "step": step_index},
        )

    return {"processed": len(pending)}


# ─── Unsubscribe ─── #

@router.post("/unsubscribe")
async def unsubscribe(email: str = Query(...), business_id: str = Query(...)):
    """Public endpoint — unsubscribe from a business's marketing emails."""
    db = get_database()

    await db.email_unsubscribes.update_one(
        {"email": email.lower(), "business_id": business_id},
        {"$set": {
            "email": email.lower(),
            "business_id": business_id,
            "unsubscribed_at": datetime.utcnow(),
        }},
        upsert=True,
    )

    # Also stop any active drip enrollments
    await db.drip_enrollments.update_many(
        {"email": email.lower(), "business_id": business_id, "status": "active"},
        {"$set": {"status": "unsubscribed"}},
    )

    return {"message": "Successfully unsubscribed"}


# ─── Email Stats Dashboard ─── #

@router.get("/stats")
async def get_marketing_stats(
    days: int = Query(30, ge=1, le=365),
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    """Overall marketing email stats for the business."""
    db = get_database()
    business_id = await _get_business_id(current_user)
    since = datetime.utcnow() - timedelta(days=days)

    # Campaign stats
    campaigns_sent = await db.campaigns.count_documents({
        "business_id": business_id,
        "status": "sent",
        "sent_at": {"$gte": since},
    })

    total_recipients = 0
    total_opened = 0
    total_clicked = 0
    async for c in db.campaigns.find({"business_id": business_id, "status": "sent", "sent_at": {"$gte": since}}):
        stats = c.get("stats", {})
        total_recipients += stats.get("total_recipients", 0)
        total_opened += stats.get("opened", 0)
        total_clicked += stats.get("clicked", 0)

    # Active drips
    active_drips = await db.drip_sequences.count_documents({
        "business_id": business_id,
        "is_active": True,
    })
    active_enrollments = await db.drip_enrollments.count_documents({
        "business_id": business_id,
        "status": "active",
    })

    # Unsubscribes
    unsub_count = await db.email_unsubscribes.count_documents({"business_id": business_id})

    return {
        "period_days": days,
        "campaigns_sent": campaigns_sent,
        "total_emails_sent": total_recipients,
        "total_opened": total_opened,
        "total_clicked": total_clicked,
        "open_rate": round(total_opened / max(total_recipients, 1) * 100, 1),
        "click_rate": round(total_clicked / max(total_recipients, 1) * 100, 1),
        "active_drips": active_drips,
        "active_drip_enrollments": active_enrollments,
        "total_unsubscribes": unsub_count,
    }


# ═══════════════════════════════════════════════════════════
# V10 — AI CAMPAIGN GENERATION
# ═══════════════════════════════════════════════════════════

AI_CAMPAIGN_PROMPTS = {
    "win_back": {
        "goal": "Re-engage inactive customers",
        "subject": "We miss you at {business_name}! Here's a little something...",
        "body": "Hi {client_name},\n\nIt's been a while since we last saw you at {business_name}, and honestly — we miss you!\n\nTo welcome you back, we'd love to offer you [OFFER]. Consider it our way of saying we'd love to see you again.\n\nYour table is always waiting.\n\nWarm regards,\n{business_name}",
        "audience": "inactive",
        "tone": "warm and personal",
    },
    "flash_sale": {
        "goal": "Drive urgent bookings",
        "subject": "⚡ {business_name} flash deal — today only!",
        "body": "Hi {client_name},\n\nThis won't last long!\n\nFor the next 24 hours only, we're offering [OFFER] at {business_name}.\n\nSpaces are limited and first come, first served. Don't sleep on this one.\n\nBook now before it's gone!",
        "audience": "all",
        "tone": "urgent and exciting",
    },
    "thank_loyal": {
        "goal": "Reward VIP customers",
        "subject": "You're one of our favourites, {client_name} ⭐",
        "body": "Hi {client_name},\n\nWe wanted to take a moment to say thank you. You've been one of our most loyal customers at {business_name}, and that means the world to us.\n\nAs a small token of our appreciation, we'd like to offer you [REWARD].\n\nYou deserve it. Thank you for choosing us, again and again.\n\nWith gratitude,\n{business_name}",
        "audience": "vip",
        "tone": "grateful and personal",
    },
    "new_launch": {
        "goal": "Announce something new",
        "subject": "Something exciting is coming to {business_name}... 🎉",
        "body": "Hi {client_name},\n\nWe've been working on something special at {business_name}, and we're finally ready to share it with you.\n\nIntroducing: [NEW THING]\n\n[DESCRIPTION]\n\nWe can't wait for you to try it. Be one of the first!",
        "audience": "all",
        "tone": "excited and exclusive",
    },
    "seasonal": {
        "goal": "Seasonal promotion",
        "subject": "This season at {business_name} — you won't want to miss this",
        "body": "Hi {client_name},\n\nThe season is changing, and so is our menu at {business_name}!\n\n[SEASONAL DETAILS]\n\nWhether you're a regular or it's been a while, now is the perfect time to visit.\n\nBook your spot today — the best tables go fast.",
        "audience": "all",
        "tone": "inviting and seasonal",
    },
    "review_ask": {
        "goal": "Get more reviews",
        "subject": "Quick favour, {client_name}? 🙏",
        "body": "Hi {client_name},\n\nThanks for your recent visit to {business_name}! We really hope you enjoyed it.\n\nIf you have 30 seconds, we'd be incredibly grateful if you could leave us a quick review. It makes a huge difference for small businesses like ours.\n\n[REVIEW LINK]\n\nThank you — it really means a lot.\n\n{business_name}",
        "audience": "recent",
        "tone": "humble and grateful",
    },
    "referral": {
        "goal": "Drive word-of-mouth",
        "subject": "Know someone who'd love {business_name}?",
        "body": "Hi {client_name},\n\nWe're so glad you enjoy {business_name}! The best compliment we could ever receive is a recommendation to someone you care about.\n\nRefer a friend and you'll both receive [INCENTIVE].\n\nJust forward this email or share the link below. Easy as that!\n\n{booking_link}",
        "audience": "returning",
        "tone": "friendly and rewarding",
    },
    "event": {
        "goal": "Promote an event",
        "subject": "You're invited: [EVENT] at {business_name}",
        "body": "Hi {client_name},\n\nYou're invited to something special at {business_name}!\n\n📅 [DATE]\n🕐 [TIME]\n📍 {business_name}\n\n[EVENT DESCRIPTION]\n\nSpaces are limited, so book early to avoid disappointment.\n\nWe'd love to see you there!",
        "audience": "all",
        "tone": "exciting and exclusive",
    },
}


@router.post("/ai/generate")
async def ai_generate_campaign(
    data: dict = Body(...),
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    """AI-generate a campaign from a prompt or template type."""
    db = get_database()
    business_id = await _get_business_id(current_user)
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    biz_name = biz.get("name", "Your Business") if biz else "Your Business"

    prompt_type = data.get("type", "")
    custom_prompt = data.get("prompt", "")
    custom_offer = data.get("offer", "")

    # Use AI template or generate from prompt
    if prompt_type in AI_CAMPAIGN_PROMPTS:
        tpl = AI_CAMPAIGN_PROMPTS[prompt_type]
        subject = tpl["subject"].replace("{business_name}", biz_name)
        body = tpl["body"].replace("{business_name}", biz_name)
        if custom_offer:
            body = body.replace("[OFFER]", custom_offer).replace("[REWARD]", custom_offer)
            body = body.replace("[NEW THING]", custom_offer).replace("[DESCRIPTION]", "")
            body = body.replace("[INCENTIVE]", custom_offer).replace("[SEASONAL DETAILS]", custom_offer)
            body = body.replace("[EVENT]", custom_offer).replace("[EVENT DESCRIPTION]", custom_offer)
            body = body.replace("[DATE]", "TBC").replace("[TIME]", "TBC")
            body = body.replace("[REVIEW LINK]", "{booking_link}")
        audience = tpl["audience"]
        goal = tpl["goal"]
    else:
        # Fallback: generate from custom prompt
        subject = f"News from {biz_name}"
        body = f"Hi {{client_name}},\n\n{custom_prompt or 'We have exciting news to share!'}\n\nVisit us at {{business_name}} to find out more.\n\n{{booking_link}}"
        audience = "all"
        goal = custom_prompt or "Custom campaign"

    # Generate A/B variant
    subject_b = subject.replace("!", " 👀").replace("⚡", "🔥") if "!" in subject else subject + " — limited time"

    return {
        "subject": subject,
        "subject_b": subject_b,
        "body": body,
        "audience": audience,
        "goal": goal,
        "type": prompt_type or "custom",
    }


# ═══════════════════════════════════════════════════════════
# V10 — AUTO-CAMPAIGNS (FIRE AND FORGET)
# ═══════════════════════════════════════════════════════════

AUTO_CAMPAIGN_TYPES = [
    {
        "type": "welcome_series",
        "name": "Welcome Series",
        "description": "3-email welcome sequence for new customers",
        "trigger": "new_client",
        "steps": [
            {"delay_days": 0, "subject": "Welcome to {business_name}! 🎉", "body": "Hi {client_name},\n\nWelcome to {business_name}! We're thrilled to have you.\n\nHere's what you can expect from us — great food, great service, and a few surprises along the way.\n\nSee you soon!\n{business_name}"},
            {"delay_days": 3, "subject": "A little something about {business_name}", "body": "Hi {client_name},\n\nHope you enjoyed your first visit to {business_name}!\n\nDid you know we also offer [feature]? We think you'd love it.\n\nBook your next visit: {booking_link}"},
            {"delay_days": 7, "subject": "How was your experience, {client_name}?", "body": "Hi {client_name},\n\nWe'd love to hear how your first experience at {business_name} went.\n\nYour feedback helps us keep improving. And if you loved it — tell a friend!\n\nBook again: {booking_link}"},
        ],
    },
    {
        "type": "post_visit_review",
        "name": "Review Request",
        "description": "Ask for a review 24h after visit",
        "trigger": "post_visit",
        "steps": [
            {"delay_days": 1, "subject": "How was {business_name}, {client_name}?", "body": "Hi {client_name},\n\nThanks for visiting {business_name} yesterday! We hope you had a wonderful time.\n\nIf you have 30 seconds, a quick review would mean the world to us. Small businesses like ours rely on word of mouth.\n\nThank you!\n{business_name}"},
        ],
    },
    {
        "type": "win_back_30",
        "name": "Win-Back (30 days)",
        "description": "Re-engage after 30 days of inactivity",
        "trigger": "inactive_30",
        "steps": [
            {"delay_days": 0, "subject": "It's been a while, {client_name}!", "body": "Hi {client_name},\n\nWe noticed it's been about a month since your last visit to {business_name}. We miss you!\n\nPop in soon — we've got some great things happening.\n\nBook now: {booking_link}"},
        ],
    },
    {
        "type": "win_back_60",
        "name": "Win-Back (60 days)",
        "description": "Escalated re-engagement with incentive",
        "trigger": "inactive_60",
        "steps": [
            {"delay_days": 0, "subject": "We really miss you, {client_name} 💛", "body": "Hi {client_name},\n\nIt's been a couple of months since we last saw you at {business_name}, and we'd love to welcome you back.\n\nAs a little incentive, here's an exclusive offer just for you: [ADD YOUR OFFER]\n\nWe hope to see you soon!\n{business_name}"},
        ],
    },
    {
        "type": "win_back_90",
        "name": "Win-Back (90 days)",
        "description": "Last-chance re-engagement",
        "trigger": "inactive_90",
        "steps": [
            {"delay_days": 0, "subject": "One last thing, {client_name}...", "body": "Hi {client_name},\n\nIt's been a while since you visited {business_name}. We don't want to bother you, but we genuinely miss having you.\n\nIf there's anything we can do better, we'd love to hear it. And if you'd like to come back, your table is always waiting.\n\nBook anytime: {booking_link}\n\nWarm regards,\n{business_name}"},
        ],
    },
    {
        "type": "booking_reminder",
        "name": "Booking Reminder",
        "description": "Automatic 24h reminder before appointment",
        "trigger": "post_booking",
        "steps": [
            {"delay_days": 0, "subject": "Booking confirmed at {business_name} ✅", "body": "Hi {client_name},\n\nYour booking at {business_name} is confirmed! We look forward to seeing you.\n\nIf you need to make any changes, you can manage your booking here: {booking_link}\n\nSee you soon!"},
        ],
    },
    {
        "type": "vip_reward",
        "name": "VIP Reward",
        "description": "Auto-reward after 5th visit",
        "trigger": "post_visit",
        "steps": [
            {"delay_days": 0, "subject": "You're a VIP at {business_name}! ⭐", "body": "Hi {client_name},\n\nWow — you've now visited {business_name} five times! That makes you one of our VIPs.\n\nAs a thank you, we'd like to offer you [VIP REWARD]. You've earned it!\n\nBook your next visit: {booking_link}\n\nThank you for your loyalty!"},
        ],
    },
    {
        "type": "referral_program",
        "name": "Referral Program",
        "description": "Ask for referrals after 3rd visit",
        "trigger": "post_visit",
        "steps": [
            {"delay_days": 1, "subject": "Share the love, {client_name} ❤️", "body": "Hi {client_name},\n\nYou've been a wonderful customer at {business_name} and we'd love your help spreading the word.\n\nRefer a friend and you'll both receive [INCENTIVE]. Just forward this email or share your booking link:\n\n{booking_link}\n\nThank you for being amazing!"},
        ],
    },
    {
        "type": "no_show_followup",
        "name": "No-Show Follow-Up",
        "description": "Gentle nudge after a missed booking",
        "trigger": "post_visit",
        "steps": [
            {"delay_days": 0, "subject": "We missed you today, {client_name}", "body": "Hi {client_name},\n\nWe noticed you weren't able to make it to {business_name} today. No worries at all — things happen!\n\nWe'd love to see you when you're ready. You can rebook at any time:\n\n{booking_link}\n\nHope to see you soon!\n{business_name}"},
        ],
    },
    {
        "type": "birthday",
        "name": "Birthday Treat",
        "description": "Auto-send birthday offer",
        "trigger": "new_client",
        "steps": [
            {"delay_days": 0, "subject": "Happy Birthday, {client_name}! 🎂", "body": "Hi {client_name},\n\nHappy Birthday from everyone at {business_name}! 🎂🎉\n\nTo celebrate your special day, we'd like to treat you to [BIRTHDAY OFFER].\n\nEnjoy your day and we hope to see you soon!\n\nWith love,\n{business_name}"},
        ],
    },
]


@router.get("/auto-campaigns")
async def list_auto_campaigns(tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    """List all auto-campaign types with their enabled/disabled status."""
    db = get_database()
    business_id = await _get_business_id(current_user)

    result = []
    for ac in AUTO_CAMPAIGN_TYPES:
        # Check if a drip sequence exists for this auto-campaign type
        existing = await db.drip_sequences.find_one({
            "business_id": business_id,
            "auto_campaign_type": ac["type"],
        })
        result.append({
            **ac,
            "enabled": existing.get("is_active", False) if existing else False,
            "drip_id": str(existing["_id"]) if existing else None,
            "enrolled": existing.get("stats", {}).get("enrolled", 0) if existing else 0,
            "sent": existing.get("stats", {}).get("total_sent", 0) if existing else 0,
        })

    return result


@router.post("/auto-campaigns/{campaign_type}/toggle")
async def toggle_auto_campaign(
    campaign_type: str,
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    """Enable or disable an auto-campaign. Creates the drip sequence if it doesn't exist."""
    db = get_database()
    business_id = await _get_business_id(current_user)

    # Find the auto-campaign definition
    ac_def = None
    for ac in AUTO_CAMPAIGN_TYPES:
        if ac["type"] == campaign_type:
            ac_def = ac
            break
    if not ac_def:
        raise HTTPException(status_code=404, detail="Auto-campaign type not found")

    # Check if drip sequence exists
    existing = await db.drip_sequences.find_one({
        "business_id": business_id,
        "auto_campaign_type": campaign_type,
    })

    if existing:
        # Toggle it
        new_state = not existing.get("is_active", False)
        await db.drip_sequences.update_one(
            {"_id": existing["_id"]},
            {"$set": {"is_active": new_state, "updated_at": datetime.utcnow()}}
        )
        return {"enabled": new_state, "drip_id": str(existing["_id"]), "action": "toggled"}
    else:
        # Create the drip sequence
        drip_doc = {
            "business_id": business_id,
            "name": ac_def["name"],
            "trigger": ac_def["trigger"],
            "auto_campaign_type": campaign_type,
            "steps": ac_def["steps"],
            "is_active": True,
            "stats": {"enrolled": 0, "total_sent": 0, "completed": 0},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = await db.drip_sequences.insert_one(drip_doc)
        return {"enabled": True, "drip_id": str(result.inserted_id), "action": "created"}


# ═══════════════════════════════════════════════════════════
# V10 — A/B TESTING
# ═══════════════════════════════════════════════════════════

@router.post("/campaigns/{campaign_id}/ab-test")
async def create_ab_test(
    campaign_id: str,
    data: dict = Body(...),
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    """Set up A/B test with variant subject line or body."""
    db = get_database()
    business_id = await _get_business_id(current_user)
    campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id), "business_id": business_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Can only A/B test draft campaigns")

    await db.campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {
            "ab_test": {
                "enabled": True,
                "variant_b": {
                    "subject": data.get("subject_b", campaign.get("subject", "")),
                    "body": data.get("body_b"),
                },
                "split_pct": data.get("split_pct", 50),
                "winner_metric": data.get("winner_metric", "open_rate"),
                "auto_send_winner": data.get("auto_send_winner", True),
                "test_duration_hours": data.get("test_duration_hours", 4),
            },
            "updated_at": datetime.utcnow(),
        }}
    )
    return {"detail": "A/B test configured", "campaign_id": campaign_id}


# ═══════════════════════════════════════════════════════════
# V10 — ENHANCED ANALYTICS
# ═══════════════════════════════════════════════════════════

@router.get("/analytics/timeline")
async def get_analytics_timeline(
    days: int = Query(30, ge=7, le=365),
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    """Daily email send/open/click counts for charting."""
    db = get_database()
    business_id = await _get_business_id(current_user)
    since = datetime.utcnow() - timedelta(days=days)

    pipeline = [
        {"$match": {"business_id": business_id, "timestamp": {"$gte": since}}},
        {"$group": {
            "_id": {
                "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                "event": "$event_type",
            },
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id.date": 1}},
    ]

    results = await db.email_events.aggregate(pipeline).to_list(length=None)

    # Build daily buckets
    daily = {}
    for r in results:
        date = r["_id"]["date"]
        event = r["_id"]["event"]
        if date not in daily:
            daily[date] = {"date": date, "sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "bounced": 0}
        if event in daily[date]:
            daily[date][event] = r["count"]

    # Fill gaps
    timeline = []
    current = since.date()
    end = datetime.utcnow().date()
    while current <= end:
        ds = current.isoformat()
        timeline.append(daily.get(ds, {"date": ds, "sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "bounced": 0}))
        current += timedelta(days=1)

    return {"timeline": timeline, "period_days": days}


@router.get("/analytics/top-campaigns")
async def get_top_campaigns(
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    """Top performing campaigns by open rate."""
    db = get_database()
    business_id = await _get_business_id(current_user)

    campaigns = await db.campaigns.find(
        {"business_id": business_id, "status": "sent"},
    ).sort("sent_at", -1).limit(20).to_list(length=20)

    result = []
    for c in campaigns:
        s = c.get("stats", {})
        total = s.get("total_recipients", 0)
        opened = s.get("opened", 0)
        clicked = s.get("clicked", 0)
        result.append({
            "id": str(c["_id"]),
            "name": c.get("name", "Untitled"),
            "subject": c.get("subject", ""),
            "sent_at": c.get("sent_at"),
            "total_recipients": total,
            "opened": opened,
            "clicked": clicked,
            "open_rate": round(opened / max(total, 1) * 100, 1),
            "click_rate": round(clicked / max(total, 1) * 100, 1),
            "revenue": s.get("revenue", 0),
        })

    return {"campaigns": sorted(result, key=lambda x: x["open_rate"], reverse=True)}


@router.get("/analytics/audience-growth")
async def get_audience_growth(
    days: int = Query(90, ge=7, le=365),
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    """Track audience growth over time based on new client bookings."""
    db = get_database()
    business_id = await _get_business_id(current_user)
    since = datetime.utcnow() - timedelta(days=days)

    pipeline = [
        {"$match": {"business_id": business_id, "created_at": {"$gte": since}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "new_contacts": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]

    results = await db.clients.aggregate(pipeline).to_list(length=None)

    # Build cumulative
    total_before = await db.clients.count_documents({
        "business_id": business_id,
        "created_at": {"$lt": since},
    })

    timeline = []
    running_total = total_before
    for r in results:
        running_total += r["new_contacts"]
        timeline.append({
            "date": r["_id"],
            "new": r["new_contacts"],
            "total": running_total,
        })

    return {"timeline": timeline, "current_total": running_total}


@router.get("/analytics/send-time-heatmap")
async def get_send_time_heatmap(
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner),
):
    """Heatmap of best open times by day-of-week and hour."""
    db = get_database()
    business_id = await _get_business_id(current_user)

    pipeline = [
        {"$match": {"business_id": business_id, "event_type": "opened"}},
        {"$group": {
            "_id": {
                "day": {"$dayOfWeek": "$timestamp"},
                "hour": {"$hour": "$timestamp"},
            },
            "count": {"$sum": 1},
        }},
    ]

    results = await db.email_events.aggregate(pipeline).to_list(length=None)

    heatmap = {}
    for r in results:
        day = r["_id"]["day"]  # 1=Sun, 7=Sat
        hour = r["_id"]["hour"]
        heatmap[f"{day}-{hour}"] = r["count"]

    # Find best time
    best = max(heatmap.items(), key=lambda x: x[1]) if heatmap else ("3-12", 0)
    day_names = {1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday", 5: "Thursday", 6: "Friday", 7: "Saturday"}
    best_day, best_hour = best[0].split("-")
    best_time_label = f"{day_names.get(int(best_day), 'Tuesday')} at {int(best_hour):02d}:00"

    return {
        "heatmap": heatmap,
        "best_time": best_time_label,
        "best_day": int(best_day),
        "best_hour": int(best_hour),
    }
