"""
Rezvo Marketing Campaigns
===========================
Campaign CRUD, audience segmentation, drip sequences, actual sending via Resend.
Used by business owners to email their customers from the dashboard.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
from middleware.auth import get_current_owner, get_current_user
from helpers.email import send_email, send_batch, render_template, wrap_html, CAMPAIGNS_FROM, log_email_event
import logging

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

    # Aggregate unique clients from bookings
    pipeline = [
        {"$match": {"business_id": business_id, "client_email": {"$exists": True, "$ne": ""}}},
        {"$group": {
            "_id": "$client_email",
            "name": {"$last": "$client_name"},
            "last_visit": {"$max": "$date"},
            "visit_count": {"$sum": 1},
            "first_visit": {"$min": "$date"},
        }},
        {"$sort": {"last_visit": -1}},
    ]

    clients = {}

    # Pull from bookings collection
    async for doc in db.bookings.aggregate(pipeline):
        email = doc["_id"].lower().strip()
        if email:
            clients[email] = {
                "email": email,
                "name": doc.get("name", ""),
                "client_name": doc.get("name", ""),
                "last_visit": str(doc.get("last_visit", "")),
                "visit_count": doc.get("visit_count", 0),
                "first_visit": str(doc.get("first_visit", "")),
            }

    # Also check reservations collection (for restaurants)
    try:
        async for doc in db.reservations.aggregate(pipeline):
            email = doc["_id"].lower().strip()
            if email and email not in clients:
                clients[email] = {
                    "email": email,
                    "name": doc.get("name", ""),
                    "client_name": doc.get("name", ""),
                    "last_visit": str(doc.get("last_visit", "")),
                    "visit_count": doc.get("visit_count", 0),
                    "first_visit": str(doc.get("first_visit", "")),
                }
    except Exception:
        pass

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
async def create_campaign(data: CampaignCreate, current_user: dict = Depends(get_current_owner)):
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
async def get_campaign(campaign_id: str, current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)

    doc = await db.campaigns.find_one({"_id": ObjectId(campaign_id), "business_id": business_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return serialize_doc(doc)


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, data: CampaignUpdate, current_user: dict = Depends(get_current_owner)):
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
async def delete_campaign(campaign_id: str, current_user: dict = Depends(get_current_owner)):
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
    booking_link = f"https://rezvo.app/book/{business.get('slug', business_id)}" if business else ""

    for r in recipients:
        r["business_name"] = business_name
        r["booking_link"] = booking_link

    # Determine from address — use business name if available
    from_addr = f"{business_name} via Rezvo <campaigns@rezvo.app>" if business_name else CAMPAIGNS_FROM

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
        "booking_link": f"https://rezvo.app/book/test",
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
async def get_campaign_stats(campaign_id: str, current_user: dict = Depends(get_current_owner)):
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
async def create_drip(data: DripCreate, current_user: dict = Depends(get_current_owner)):
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
async def list_drips(current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)
    docs = await db.drip_sequences.find({"business_id": business_id}).sort("created_at", -1).to_list(50)
    return serialize_list(docs)


@router.get("/drips/{drip_id}")
async def get_drip(drip_id: str, current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)
    doc = await db.drip_sequences.find_one({"_id": ObjectId(drip_id), "business_id": business_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Drip sequence not found")
    return serialize_doc(doc)


@router.patch("/drips/{drip_id}")
async def update_drip(drip_id: str, data: dict, current_user: dict = Depends(get_current_owner)):
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
async def delete_drip(drip_id: str, current_user: dict = Depends(get_current_owner)):
    db = get_database()
    business_id = await _get_business_id(current_user)

    result = await db.drip_sequences.delete_one({"_id": ObjectId(drip_id), "business_id": business_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Drip sequence not found")
    return {"message": "Drip sequence deleted"}


@router.post("/drips/{drip_id}/toggle")
async def toggle_drip(drip_id: str, current_user: dict = Depends(get_current_owner)):
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
            "booking_link": f"https://rezvo.app/book/{business.get('slug', enrollment['business_id'])}" if business else "",
            "email": enrollment["email"],
        }

        # Render and send
        body_html = render_template(step.get("body", "").replace("\n", "<br>"), variables)
        html = wrap_html(body_html, preheader=step.get("subject", ""))
        subject = render_template(step.get("subject", ""), variables)
        from_addr = f"{business_name} via Rezvo <campaigns@rezvo.app>" if business_name else CAMPAIGNS_FROM

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
