"""
ReeveOS Email Webhooks
=====================
Handles Resend webhook events for delivery tracking.
Register webhook URL in Resend dashboard: https://rezvo.app/api/webhooks/resend

Events tracked:
- email.sent
- email.delivered
- email.opened
- email.clicked
- email.bounced
- email.complained
- email.delivery_delayed
"""

from fastapi import APIRouter, Request, HTTPException
from datetime import datetime
from database import get_database
from helpers.email import log_email_event
import logging
import json

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)


# ─── Resend Webhook Handler ─── #

@router.post("/resend")
async def resend_webhook(request: Request):
    """
    Handle Resend webhook events.
    Resend sends JSON payloads for email lifecycle events.
    
    Webhook setup:
    1. Go to https://resend.com/webhooks
    2. Add endpoint: https://rezvo.app/api/webhooks/resend
    3. Select events: sent, delivered, opened, clicked, bounced, complained
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = body.get("type", "")
    data = body.get("data", {})

    # Map Resend event types to our internal types
    EVENT_MAP = {
        "email.sent": "sent",
        "email.delivered": "delivered",
        "email.opened": "opened",
        "email.clicked": "clicked",
        "email.bounced": "bounced",
        "email.complained": "complained",
        "email.delivery_delayed": "delayed",
    }

    internal_type = EVENT_MAP.get(event_type)
    if not internal_type:
        logger.info(f"Ignoring unknown Resend event: {event_type}")
        return {"status": "ignored", "event": event_type}

    email_id = data.get("email_id", "")
    recipient = ""

    # Extract recipient from the 'to' field
    to_field = data.get("to", [])
    if isinstance(to_field, list) and to_field:
        recipient = to_field[0]
    elif isinstance(to_field, str):
        recipient = to_field

    # Extract tags for campaign/business tracking
    tags = data.get("tags", {})
    campaign_id = tags.get("campaign_id") or data.get("tags", {}).get("campaign_id")
    business_id = tags.get("business_id")

    # Log the event
    await log_email_event(
        email_id=email_id,
        event_type=internal_type,
        recipient=recipient,
        metadata={
            "campaign_id": campaign_id,
            "business_id": business_id,
            "resend_event": event_type,
            "raw_data": {
                "subject": data.get("subject"),
                "from": data.get("from"),
                "created_at": data.get("created_at"),
            },
        },
    )

    db = get_database()

    # ─── Update Campaign Stats ─── #
    if campaign_id and db:
        stat_field = f"stats.{internal_type}"
        if internal_type in ("delivered", "opened", "clicked", "bounced", "complained"):
            await db.campaigns.update_one(
                {"_id": __import__("bson").ObjectId(campaign_id)},
                {"$inc": {stat_field: 1}},
            )

        # Update individual recipient record
        if internal_type == "opened":
            await db.campaign_recipients.update_one(
                {"campaign_id": campaign_id, "email": recipient, "opened_at": None},
                {"$set": {"opened_at": datetime.utcnow(), "status": "opened"}},
            )
        elif internal_type == "clicked":
            await db.campaign_recipients.update_one(
                {"campaign_id": campaign_id, "email": recipient},
                {"$set": {"clicked_at": datetime.utcnow(), "status": "clicked"}},
            )
        elif internal_type == "bounced":
            await db.campaign_recipients.update_one(
                {"campaign_id": campaign_id, "email": recipient},
                {"$set": {"status": "bounced", "bounced_at": datetime.utcnow()}},
            )

    # ─── Handle Bounces Globally ─── #
    if internal_type == "bounced" and recipient and db:
        bounce_type = data.get("bounce", {}).get("type", "unknown")  # hard or soft

        await db.email_bounces.update_one(
            {"email": recipient.lower()},
            {"$set": {
                "email": recipient.lower(),
                "bounce_type": bounce_type,
                "last_bounced_at": datetime.utcnow(),
            }, "$inc": {"bounce_count": 1}},
            upsert=True,
        )

        # Auto-suppress after 3 bounces or any hard bounce
        if bounce_type == "hard":
            await db.email_suppressions.update_one(
                {"email": recipient.lower()},
                {"$set": {
                    "email": recipient.lower(),
                    "reason": "hard_bounce",
                    "suppressed_at": datetime.utcnow(),
                }},
                upsert=True,
            )
            logger.warning(f"Hard bounce — suppressed: {recipient}")

    # ─── Handle Complaints (Spam Reports) ─── #
    if internal_type == "complained" and recipient and db:
        # Auto-unsubscribe from all businesses
        if business_id:
            await db.email_unsubscribes.update_one(
                {"email": recipient.lower(), "business_id": business_id},
                {"$set": {
                    "email": recipient.lower(),
                    "business_id": business_id,
                    "reason": "spam_complaint",
                    "unsubscribed_at": datetime.utcnow(),
                }},
                upsert=True,
            )

        # Global suppression
        await db.email_suppressions.update_one(
            {"email": recipient.lower()},
            {"$set": {
                "email": recipient.lower(),
                "reason": "spam_complaint",
                "suppressed_at": datetime.utcnow(),
            }},
            upsert=True,
        )
        logger.warning(f"Spam complaint — globally suppressed: {recipient}")

    logger.info(f"Resend webhook: {event_type} for {recipient} (campaign: {campaign_id})")

    return {"status": "processed", "event": internal_type}


# ─── Health Check ─── #

@router.get("/resend/health")
async def webhook_health():
    """Health check for webhook endpoint."""
    return {"status": "ok", "service": "resend_webhooks"}
