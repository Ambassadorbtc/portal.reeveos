"""
ReeveOS Outreach Engine — API Routes
====================================
Full CRUD for outreach domains, accounts, campaigns, templates,
unified inbox, analytics, Resend webhooks.
Prefix: /outreach
"""
from fastapi import Depends, APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
import logging
from middleware.tenant import set_user_tenant_context, TenantContext
from middleware.auth import get_current_admin

logger = logging.getLogger("outreach.routes")

router = APIRouter(prefix="/outreach", tags=["Email Outreach"], dependencies=[Depends(get_current_admin)])

# Separate public router for webhooks (Resend calls these — no auth)
webhook_router = APIRouter(prefix="/outreach", tags=["Outreach Webhooks"])


# ═══ Request Models ═══

class DomainCreate(BaseModel):
    domain: str
    max_daily_limit: int = 150

class AccountCreate(BaseModel):
    email: str
    domain: str
    display_name: str = ""
    persona: str = "founder"

class CampaignCreate(BaseModel):
    name: str
    city: str = "Nottingham"
    cuisine: Optional[str] = None
    angle: str = "commission_pain"
    steps: List[Dict[str, Any]] = []
    schedule: Dict[str, Any] = {}
    ai_personalisation: bool = True
    assigned_domains: List[str] = []

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    steps: Optional[List[Dict[str, Any]]] = None
    schedule: Optional[Dict[str, Any]] = None
    ai_personalisation: Optional[bool] = None
    assigned_domains: Optional[List[str]] = None

class TemplateCreate(BaseModel):
    name: str
    category: str = "cold_outreach"
    angle: Optional[str] = None
    step_number: int = 1
    subject: str
    body_html: str = ""
    body_text: str = ""
    variables: List[str] = []

class ReplyCompose(BaseModel):
    body: str
    from_account: str  # Which account to reply from

class LeadImport(BaseModel):
    leads: List[Dict[str, Any]]
    campaign_id: Optional[str] = None


# ═══ Helpers ═══

def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB doc to JSON-safe dict."""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    for key, val in doc.items():
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
        elif isinstance(val, ObjectId):
            doc[key] = str(val)
    return doc


# ═══════════════════════════════════════════════════════════
# DASHBOARD OVERVIEW STATS
# ═══════════════════════════════════════════════════════════

@router.get("/stats")
async def get_outreach_stats():
    """Get comprehensive outreach dashboard stats."""
    db = get_database()
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)

    # Today's sends
    sent_today = await db.outreach_sends.count_documents({
        "sent_at": {"$gte": today_start}, "status": {"$ne": "failed"}
    })
    yesterday_start = today_start - timedelta(days=1)
    sent_yesterday = await db.outreach_sends.count_documents({
        "sent_at": {"$gte": yesterday_start, "$lt": today_start}, "status": {"$ne": "failed"}
    })

    # Delivery rate (7-day)
    week_pipeline = [
        {"$match": {"created_at": {"$gte": week_start}, "status": {"$ne": "failed"}}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "delivered": {"$sum": {"$cond": [{"$in": ["$status", ["delivered", "opened", "clicked", "replied"]]}, 1, 0]}},
            "opened": {"$sum": {"$cond": [{"$in": ["$status", ["opened", "clicked", "replied"]]}, 1, 0]}},
            "replied": {"$sum": {"$cond": [{"$eq": ["$status", "replied"]}, 1, 0]}},
            "bounced": {"$sum": {"$cond": [{"$eq": ["$status", "bounced"]}, 1, 0]}},
        }}
    ]
    week_stats = await db.outreach_sends.aggregate(week_pipeline).to_list(1)
    ws = week_stats[0] if week_stats else {"total": 0, "delivered": 0, "opened": 0, "replied": 0, "bounced": 0}
    total_week = max(ws["total"], 1)

    # Warm leads this week
    warm_leads = await db.outreach_replies.count_documents({
        "classification": "interested",
        "received_at": {"$gte": week_start},
    })

    # Monthly stats
    month_pipeline = [
        {"$match": {"created_at": {"$gte": month_start}, "status": {"$ne": "failed"}}},
        {"$group": {"_id": None, "total": {"$sum": 1}}}
    ]
    month_result = await db.outreach_sends.aggregate(month_pipeline).to_list(1)
    monthly_sent = month_result[0]["total"] if month_result else 0

    # Unique leads contacted this month
    unique_leads_pipeline = [
        {"$match": {"created_at": {"$gte": month_start}}},
        {"$group": {"_id": "$lead_id"}},
        {"$count": "total"}
    ]
    unique_result = await db.outreach_sends.aggregate(unique_leads_pipeline).to_list(1)
    unique_leads = unique_result[0]["total"] if unique_result else 0

    # Positive replies this month
    positive_replies = await db.outreach_replies.count_documents({
        "classification": "interested",
        "received_at": {"$gte": month_start},
    })

    # Active campaigns
    active_campaigns = await db.outreach_campaigns.count_documents({"status": "active"})
    warming_campaigns = await db.outreach_campaigns.count_documents({"status": "warming"})

    # Warming accounts
    warming_accounts = await db.outreach_accounts.count_documents({"status": "warming"})

    # Unread replies
    unread_replies = await db.outreach_replies.count_documents({"is_read": False})

    return {
        "sent_today": sent_today,
        "sent_yesterday": sent_yesterday,
        "delivery_rate": round(ws["delivered"] / total_week, 4),
        "open_rate": round(ws["opened"] / total_week, 4),
        "reply_rate": round(ws["replied"] / total_week, 4),
        "bounce_rate": round(ws["bounced"] / total_week, 4),
        "warm_leads_this_week": warm_leads,
        "monthly_sent": monthly_sent,
        "unique_leads_contacted": unique_leads,
        "positive_replies": positive_replies,
        "active_campaigns": active_campaigns,
        "warming_campaigns": warming_campaigns,
        "warming_accounts": warming_accounts,
        "unread_replies": unread_replies,
    }


# ═══════════════════════════════════════════════════════════
# DOMAINS
# ═══════════════════════════════════════════════════════════

@router.get("/domains")
async def list_domains():
    db = get_database()
    domains = []
    async for doc in db.outreach_domains.find().sort("created_at", -1):
        # Get accounts for this domain
        accounts = []
        async for acc in db.outreach_accounts.find({"domain": doc["domain"]}):
            accounts.append(serialize_doc(acc))
        doc = serialize_doc(doc)
        doc["accounts"] = accounts
        domains.append(doc)
    return {"domains": domains, "count": len(domains)}


@router.post("/domains")
async def create_domain(body: DomainCreate):
    db = get_database()
    existing = await db.outreach_domains.find_one({"domain": body.domain})
    if existing:
        raise HTTPException(400, "Domain already exists")

    doc = {
        "domain": body.domain,
        "status": "warming",
        "provider": "resend",
        "spf_verified": False,
        "dkim_verified": False,
        "dmarc_verified": False,
        "dmarc_policy": "none",
        "warmup_started_at": datetime.utcnow(),
        "warmup_day": 0,
        "warmup_complete": False,
        "health_score": 50,
        "delivery_rate": 0.0,
        "bounce_rate": 0.0,
        "spam_rate": 0.0,
        "open_rate": 0.0,
        "daily_limit": 10,  # 2/account * 5 accounts on day 1
        "max_daily_limit": body.max_daily_limit,
        "sent_today": 0,
        "registered_at": datetime.utcnow(),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await db.outreach_domains.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return {"domain": doc, "message": "Domain created — add DNS records and accounts next"}


@router.put("/domains/{domain}/verify-dns")
async def verify_domain_dns(domain: str, spf: bool = False, dkim: bool = False, dmarc: bool = False, dmarc_policy: str = "none"):
    """Mark DNS records as verified (called after manual DNS setup)."""
    db = get_database()
    update = {"updated_at": datetime.utcnow()}
    if spf:
        update["spf_verified"] = True
    if dkim:
        update["dkim_verified"] = True
    if dmarc:
        update["dmarc_verified"] = True
        update["dmarc_policy"] = dmarc_policy

    result = await db.outreach_domains.update_one({"domain": domain}, {"$set": update})
    if result.modified_count == 0:
        raise HTTPException(404, "Domain not found")
    return {"message": f"DNS updated for {domain}"}


@router.post("/domains/{domain}/start-warmup")
async def start_domain_warmup(domain: str):
    """Begin warmup for all accounts under this domain."""
    db = get_database()
    domain_doc = await db.outreach_domains.find_one({"domain": domain})
    if not domain_doc:
        raise HTTPException(404, "Domain not found")

    await db.outreach_domains.update_one(
        {"domain": domain},
        {"$set": {"status": "warming", "warmup_started_at": datetime.utcnow(), "warmup_day": 1, "updated_at": datetime.utcnow()}}
    )
    await db.outreach_accounts.update_many(
        {"domain": domain},
        {"$set": {"status": "warming", "warmup_day": 1, "daily_limit": 2, "updated_at": datetime.utcnow()}}
    )
    return {"message": f"Warmup started for {domain}"}


# ═══════════════════════════════════════════════════════════
# ACCOUNTS
# ═══════════════════════════════════════════════════════════

@router.post("/accounts")
async def create_account(body: AccountCreate):
    db = get_database()
    existing = await db.outreach_accounts.find_one({"email": body.email})
    if existing:
        raise HTTPException(400, "Account already exists")

    # Check domain exists
    domain = await db.outreach_domains.find_one({"domain": body.domain})
    if not domain:
        raise HTTPException(400, f"Domain {body.domain} not found — create it first")

    doc = {
        "email": body.email,
        "domain": body.domain,
        "display_name": body.display_name or body.email.split("@")[0].title() + " from ReeveOS",
        "persona": body.persona,
        "status": "warming",
        "health_score": 50,
        "delivery_rate": 0.0,
        "bounce_rate": 0.0,
        "spam_rate": 0.0,
        "daily_limit": 2,
        "sent_today": 0,
        "warmup_day": 0,
        "warmup_complete": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await db.outreach_accounts.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return {"account": doc}


@router.post("/accounts/bulk")
async def create_accounts_bulk(domain: str):
    """Create standard 5-account set for a domain."""
    db = get_database()
    domain_doc = await db.outreach_domains.find_one({"domain": domain})
    if not domain_doc:
        raise HTTPException(404, "Domain not found")

    personas = [
        ("alex", "founder", "Alex from ReeveOS"),
        ("team", "team", "ReeveOS Team"),
        ("hello", "hello", "Hello from ReeveOS"),
        ("support", "support", "ReeveOS Support"),
        ("founders", "founder", "The ReeveOS Founders"),
    ]
    created = []
    for prefix, persona, display_name in personas:
        email = f"{prefix}@{domain}"
        existing = await db.outreach_accounts.find_one({"email": email})
        if existing:
            continue
        doc = {
            "email": email,
            "domain": domain,
            "display_name": display_name,
            "persona": persona,
            "status": "warming",
            "health_score": 50,
            "delivery_rate": 0.0,
            "bounce_rate": 0.0,
            "spam_rate": 0.0,
            "daily_limit": 2,
            "sent_today": 0,
            "warmup_day": 0,
            "warmup_complete": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        await db.outreach_accounts.insert_one(doc)
        created.append(email)

    return {"created": created, "count": len(created)}


@router.put("/accounts/{email}/pause")
async def pause_account(email: str):
    db = get_database()
    result = await db.outreach_accounts.update_one(
        {"email": email}, {"$set": {"status": "paused", "updated_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Account not found")
    return {"message": f"Paused {email}"}


@router.put("/accounts/{email}/activate")
async def activate_account(email: str):
    db = get_database()
    result = await db.outreach_accounts.update_one(
        {"email": email}, {"$set": {"status": "active", "daily_limit": 30, "updated_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Account not found")
    return {"message": f"Activated {email}"}


# ═══════════════════════════════════════════════════════════
# CAMPAIGNS
# ═══════════════════════════════════════════════════════════

@router.get("/campaigns")
async def list_campaigns(status: Optional[str] = None, limit: int = 50):
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    campaigns = []
    async for doc in db.outreach_campaigns.find(query).sort("created_at", -1).limit(limit):
        campaigns.append(serialize_doc(doc))
    return {"campaigns": campaigns, "count": len(campaigns)}


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str):
    db = get_database()
    doc = await db.outreach_campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not doc:
        raise HTTPException(404, "Campaign not found")
    return {"campaign": serialize_doc(doc)}


@router.post("/campaigns")
async def create_campaign(body: CampaignCreate):
    db = get_database()

    # Count available leads for targeting
    lead_query = {"city": {"$regex": body.city, "$options": "i"}}
    if body.cuisine:
        lead_query["cuisine"] = {"$regex": body.cuisine, "$options": "i"}
    total_leads = await db.sales_leads.count_documents(lead_query)

    # Build steps from templates if not provided
    steps = body.steps
    if not steps:
        # Load default templates for this angle
        templates = []
        async for t in db.outreach_templates.find({"angle": body.angle}).sort("step_number", 1):
            templates.append(t)
        steps = [
            {
                "step_number": t.get("step_number", i + 1),
                "template_id": str(t["_id"]),
                "subject": t["subject"],
                "body": t.get("body_text", t.get("body_html", "")),
                "delay_days": 0 if i == 0 else 3,
                "variant": "A",
            }
            for i, t in enumerate(templates)
        ]

    doc = {
        "name": body.name,
        "status": "draft",
        "city": body.city,
        "cuisine": body.cuisine,
        "angle": body.angle,
        "lead_source": "google_places",
        "steps": steps,
        "schedule": body.schedule or {
            "send_days": [1, 2, 3],
            "window_start_hour": 10,
            "window_end_hour": 15,
            "timezone": "Europe/London",
            "max_sends_per_day": 50,
        },
        "ai_personalisation": body.ai_personalisation,
        "personalisation_model": "claude-haiku-4-5-20251001",
        "assigned_domains": body.assigned_domains,
        "sender_rotation": "round_robin",
        "total_leads": total_leads,
        "leads_contacted": 0,
        "leads_remaining": total_leads,
        "total_sent": 0,
        "total_delivered": 0,
        "total_opened": 0,
        "total_clicked": 0,
        "total_replied": 0,
        "total_bounced": 0,
        "total_interested": 0,
        "open_rate": 0.0,
        "reply_rate": 0.0,
        "bounce_rate": 0.0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await db.outreach_campaigns.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return {"campaign": doc, "available_leads": total_leads}


@router.put("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, body: CampaignUpdate):
    db = get_database()
    update = {"updated_at": datetime.utcnow()}
    for field, value in body.dict(exclude_none=True).items():
        update[field] = value

    result = await db.outreach_campaigns.update_one(
        {"_id": ObjectId(campaign_id)}, {"$set": update}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Campaign not found or no changes")
    return {"message": "Campaign updated"}


@router.post("/campaigns/{campaign_id}/launch")
async def launch_campaign(campaign_id: str):
    """Move campaign from draft → active (or warming if domains are still warming)."""
    db = get_database()
    campaign = await db.outreach_campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    if campaign["status"] not in ("draft", "paused"):
        raise HTTPException(400, f"Cannot launch from status '{campaign['status']}'")

    # Check if assigned domains are active
    assigned = campaign.get("assigned_domains", [])
    if assigned:
        warming = await db.outreach_domains.count_documents({
            "domain": {"$in": assigned}, "status": "warming"
        })
        new_status = "warming" if warming > 0 else "active"
    else:
        # Check any active domain exists
        active_domains = await db.outreach_domains.count_documents({"status": "active"})
        new_status = "active" if active_domains > 0 else "warming"

    await db.outreach_campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {
            "status": new_status,
            "started_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }}
    )
    return {"status": new_status, "message": f"Campaign {'launched' if new_status == 'active' else 'queued — domains still warming'}"}


@router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(campaign_id: str):
    db = get_database()
    await db.outreach_campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {"status": "paused", "updated_at": datetime.utcnow()}}
    )
    return {"message": "Campaign paused"}


@router.post("/campaigns/{campaign_id}/resume")
async def resume_campaign(campaign_id: str):
    db = get_database()
    await db.outreach_campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {"status": "active", "updated_at": datetime.utcnow()}}
    )
    return {"message": "Campaign resumed"}


# ═══════════════════════════════════════════════════════════
# SENDS
# ═══════════════════════════════════════════════════════════

@router.get("/sends")
async def list_sends(
    campaign_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
):
    db = get_database()
    query = {}
    if campaign_id:
        query["campaign_id"] = campaign_id
    if status:
        query["status"] = status
    sends = []
    async for doc in db.outreach_sends.find(query).sort("created_at", -1).skip(skip).limit(limit):
        sends.append(serialize_doc(doc))
    total = await db.outreach_sends.count_documents(query)
    return {"sends": sends, "total": total}


# ═══════════════════════════════════════════════════════════
# INBOX (REPLIES)
# ═══════════════════════════════════════════════════════════

@router.get("/inbox")
async def get_inbox(
    classification: Optional[str] = None,
    is_read: Optional[bool] = None,
    campaign_id: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
):
    db = get_database()
    query = {}
    if classification:
        query["classification"] = classification
    if is_read is not None:
        query["is_read"] = is_read
    if campaign_id:
        query["campaign_id"] = campaign_id

    replies = []
    async for doc in db.outreach_replies.find(query).sort("received_at", -1).skip(skip).limit(limit):
        replies.append(serialize_doc(doc))
    total = await db.outreach_replies.count_documents(query)
    unread = await db.outreach_replies.count_documents({"is_read": False})
    return {"replies": replies, "total": total, "unread": unread}


@router.get("/inbox/{reply_id}")
async def get_reply_thread(reply_id: str):
    """Get full conversation thread for a reply."""
    db = get_database()
    reply = await db.outreach_replies.find_one({"_id": ObjectId(reply_id)})
    if not reply:
        raise HTTPException(404, "Reply not found")

    # Mark as read
    await db.outreach_replies.update_one({"_id": ObjectId(reply_id)}, {"$set": {"is_read": True}})

    # Get all sends to this lead in this campaign
    sends = []
    async for s in db.outreach_sends.find({
        "campaign_id": reply["campaign_id"],
        "lead_id": reply["lead_id"],
    }).sort("created_at", 1):
        sends.append(serialize_doc(s))

    # Get all replies from this lead
    replies = []
    async for r in db.outreach_replies.find({
        "campaign_id": reply["campaign_id"],
        "lead_id": reply["lead_id"],
    }).sort("received_at", 1):
        replies.append(serialize_doc(r))

    return {
        "reply": serialize_doc(reply),
        "thread_sends": sends,
        "thread_replies": replies,
    }


@router.post("/inbox/{reply_id}/reply")
async def send_reply(reply_id: str, body: ReplyCompose):
    """Reply to a lead from the inbox."""
    db = get_database()
    original = await db.outreach_replies.find_one({"_id": ObjectId(reply_id)})
    if not original:
        raise HTTPException(404, "Reply not found")

    # Get the original send for subject line
    original_send = await db.outreach_sends.find_one({"_id": ObjectId(original["send_id"])})
    subject = f"Re: {original_send['subject']}" if original_send else f"Re: {original.get('subject', '')}"

    # Get sender account
    account = await db.outreach_accounts.find_one({"email": body.from_account})
    if not account:
        raise HTTPException(400, f"Account {body.from_account} not found")

    from agent.services.outreach import send_email_via_resend
    msg_id = await send_email_via_resend(
        from_email=account["email"],
        from_name=account.get("display_name", "ReeveOS"),
        to_email=original["from_email"],
        subject=subject,
        body_html=f"<div style='font-family:sans-serif;font-size:14px;color:#333;line-height:1.6'>{body.body}</div>",
        body_text=body.body,
        tags=["outreach_reply"],
    )

    if msg_id:
        await db.outreach_replies.update_one(
            {"_id": ObjectId(reply_id)},
            {"$set": {
                "our_reply": body.body,
                "our_reply_sent_at": datetime.utcnow(),
                "is_actioned": True,
            }}
        )
        return {"message": "Reply sent", "resend_message_id": msg_id}
    else:
        raise HTTPException(500, "Failed to send reply")


@router.post("/inbox/{reply_id}/move-to-pipeline")
async def move_to_pipeline(reply_id: str):
    """Promote a lead from outreach reply to sales pipeline."""
    db = get_database()
    reply = await db.outreach_replies.find_one({"_id": ObjectId(reply_id)})
    if not reply:
        raise HTTPException(404, "Reply not found")

    # Update lead status in sales_leads
    await db.sales_leads.update_one(
        {"_id": ObjectId(reply["lead_id"])},
        {"$set": {
            "status": "warm",
            "source": "outreach_reply",
            "outreach_campaign_id": reply["campaign_id"],
            "updated_at": datetime.utcnow(),
        }}
    )
    await db.outreach_replies.update_one(
        {"_id": ObjectId(reply_id)},
        {"$set": {"moved_to_pipeline": True}}
    )
    return {"message": "Lead moved to sales pipeline"}


# ═══════════════════════════════════════════════════════════
# TEMPLATES
# ═══════════════════════════════════════════════════════════

@router.get("/templates")
async def list_templates(category: Optional[str] = None, angle: Optional[str] = None):
    db = get_database()
    query = {}
    if category:
        query["category"] = category
    if angle:
        query["angle"] = angle
    templates = []
    async for doc in db.outreach_templates.find(query).sort("step_number", 1):
        templates.append(serialize_doc(doc))
    return {"templates": templates, "count": len(templates)}


@router.post("/templates")
async def create_template(body: TemplateCreate):
    db = get_database()
    doc = body.dict()
    doc["times_used"] = 0
    doc["total_opens"] = 0
    doc["total_replies"] = 0
    doc["open_rate"] = 0.0
    doc["reply_rate"] = 0.0
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()
    result = await db.outreach_templates.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return {"template": doc}


@router.put("/templates/{template_id}")
async def update_template(template_id: str, body: TemplateCreate):
    db = get_database()
    update = body.dict()
    update["updated_at"] = datetime.utcnow()
    result = await db.outreach_templates.update_one(
        {"_id": ObjectId(template_id)}, {"$set": update}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Template not found")
    return {"message": "Template updated"}


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    db = get_database()
    result = await db.outreach_templates.delete_one({"_id": ObjectId(template_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Template not found")
    return {"message": "Template deleted"}


# ═══════════════════════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════════════════════

@router.get("/analytics/funnel")
async def get_funnel(days: int = 30):
    """Get outreach funnel data."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days)

    total_leads = await db.sales_leads.count_documents({"created_at": {"$gte": cutoff}})
    total_sent = await db.outreach_sends.count_documents({"created_at": {"$gte": cutoff}, "status": {"$ne": "failed"}})

    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}, "status": {"$ne": "failed"}}},
        {"$group": {
            "_id": None,
            "delivered": {"$sum": {"$cond": [{"$in": ["$status", ["delivered", "opened", "clicked", "replied"]]}, 1, 0]}},
            "opened": {"$sum": {"$cond": [{"$in": ["$status", ["opened", "clicked", "replied"]]}, 1, 0]}},
            "replied": {"$sum": {"$cond": [{"$eq": ["$status", "replied"]}, 1, 0]}},
        }}
    ]
    result = await db.outreach_sends.aggregate(pipeline).to_list(1)
    stats = result[0] if result else {"delivered": 0, "opened": 0, "replied": 0}

    interested = await db.outreach_replies.count_documents({
        "classification": "interested", "received_at": {"$gte": cutoff}
    })
    # Demos and conversions from sales_leads
    demos = await db.sales_leads.count_documents({
        "status": {"$in": ["demo_booked", "demo_completed"]},
        "source": "outreach_reply",
        "updated_at": {"$gte": cutoff},
    })
    converted = await db.sales_leads.count_documents({
        "status": "converted",
        "source": "outreach_reply",
        "updated_at": {"$gte": cutoff},
    })

    return {
        "funnel": [
            {"stage": "Leads Discovered", "count": total_leads},
            {"stage": "Emails Sent", "count": total_sent},
            {"stage": "Delivered", "count": stats["delivered"]},
            {"stage": "Opened", "count": stats["opened"]},
            {"stage": "Replied", "count": stats["replied"]},
            {"stage": "Interested", "count": interested},
            {"stage": "Demo Booked", "count": demos},
            {"stage": "Converted", "count": converted},
        ],
        "period_days": days,
    }


@router.get("/analytics/daily")
async def get_daily_analytics(days: int = 14):
    """Get daily send/open/reply breakdown."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days)

    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}, "status": {"$ne": "failed"}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "sent": {"$sum": 1},
            "delivered": {"$sum": {"$cond": [{"$in": ["$status", ["delivered", "opened", "clicked", "replied"]]}, 1, 0]}},
            "opened": {"$sum": {"$cond": [{"$in": ["$status", ["opened", "clicked", "replied"]]}, 1, 0]}},
            "replied": {"$sum": {"$cond": [{"$eq": ["$status", "replied"]}, 1, 0]}},
            "bounced": {"$sum": {"$cond": [{"$eq": ["$status", "bounced"]}, 1, 0]}},
        }},
        {"$sort": {"_id": 1}}
    ]

    daily = []
    async for doc in db.outreach_sends.aggregate(pipeline):
        daily.append({
            "date": doc["_id"],
            "sent": doc["sent"],
            "delivered": doc["delivered"],
            "opened": doc["opened"],
            "replied": doc["replied"],
            "bounced": doc["bounced"],
        })
    return {"daily": daily, "period_days": days}


@router.get("/analytics/sentiment")
async def get_sentiment_breakdown(days: int = 30):
    """Get reply sentiment breakdown."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days)

    pipeline = [
        {"$match": {"received_at": {"$gte": cutoff}}},
        {"$group": {"_id": "$classification", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]

    sentiment = {}
    async for doc in db.outreach_replies.aggregate(pipeline):
        sentiment[doc["_id"]] = doc["count"]

    total = sum(sentiment.values()) or 1
    return {
        "sentiment": sentiment,
        "total_replies": sum(sentiment.values()),
        "percentages": {k: round(v / total * 100, 1) for k, v in sentiment.items()},
    }


# ═══════════════════════════════════════════════════════════
# RESEND WEBHOOKS
# ═══════════════════════════════════════════════════════════

@webhook_router.post("/webhooks/resend")
async def resend_webhook(request: Request):
    """
    Handle Resend webhook events: delivered, opened, clicked, bounced, complained.
    Configure at: https://resend.com/webhooks
    """
    db = get_database()
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    event_type = payload.get("type", "")
    data = payload.get("data", {})
    email_id = data.get("email_id", "")

    if not email_id:
        return {"received": True, "skipped": "no email_id"}

    # Find the send record
    send = await db.outreach_sends.find_one({"resend_message_id": email_id})
    if not send:
        return {"received": True, "skipped": "send not found"}

    status_map = {
        "email.delivered": "delivered",
        "email.opened": "opened",
        "email.clicked": "clicked",
        "email.bounced": "bounced",
        "email.complained": "complained",
    }

    new_status = status_map.get(event_type)
    if not new_status:
        return {"received": True, "skipped": f"unhandled event: {event_type}"}

    # Only upgrade status (delivered < opened < clicked < replied)
    status_order = {"queued": 0, "sent": 1, "delivered": 2, "opened": 3, "clicked": 4, "replied": 5, "bounced": 6, "complained": 7}
    current_order = status_order.get(send.get("status", "sent"), 0)
    new_order = status_order.get(new_status, 0)

    if new_order > current_order or new_status in ("bounced", "complained"):
        update = {"status": new_status, f"{new_status}_at": datetime.utcnow()}
        await db.outreach_sends.update_one({"_id": send["_id"]}, {"$set": update})

        # Update campaign stats
        from agent.services.outreach import update_campaign_stats, update_account_health
        await update_campaign_stats(send["campaign_id"])
        await update_account_health(send["account_email"])

        # If bounced/complained, auto-pause account if threshold breached
        if new_status in ("bounced", "complained"):
            logger.warning(f"Email {new_status}: {email_id} from {send['account_email']}")

    return {"received": True, "event": event_type, "send_id": str(send["_id"])}


@webhook_router.post("/webhooks/resend/inbound")
async def resend_inbound_webhook(request: Request):
    """
    Handle inbound email (reply detection) via Resend inbound webhook.
    This catches replies to our outreach emails.
    """
    db = get_database()
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    data = payload.get("data", payload)
    from_email = data.get("from", "")
    to_email = data.get("to", [""])[0] if isinstance(data.get("to"), list) else data.get("to", "")
    subject = data.get("subject", "")
    body_text = data.get("text", "")
    body_html = data.get("html", "")

    # Find the original send by matching to_email (their email) and our sending account
    send = await db.outreach_sends.find_one({
        "to_email": from_email,
    }, sort=[("created_at", -1)])

    if not send:
        logger.info(f"Inbound email from {from_email} — no matching outreach send found")
        return {"received": True, "matched": False}

    # Classify the reply
    from agent.services.outreach import classify_reply
    classification, confidence, reasoning = await classify_reply(body_text, subject)

    # Store reply
    reply_doc = {
        "send_id": str(send["_id"]),
        "campaign_id": send["campaign_id"],
        "lead_id": send["lead_id"],
        "from_email": from_email,
        "from_name": data.get("from_name", ""),
        "restaurant_name": send.get("restaurant_name", ""),
        "subject": subject,
        "body_text": body_text,
        "body_html": body_html,
        "classification": classification,
        "classification_confidence": confidence,
        "classification_reasoning": reasoning,
        "is_read": False,
        "is_actioned": False,
        "moved_to_pipeline": False,
        "received_at": datetime.utcnow(),
        "created_at": datetime.utcnow(),
    }
    await db.outreach_replies.insert_one(reply_doc)

    # Update send status to replied
    await db.outreach_sends.update_one(
        {"_id": send["_id"]},
        {"$set": {"status": "replied", "replied_at": datetime.utcnow()}}
    )

    # Update campaign stats
    from agent.services.outreach import update_campaign_stats
    await update_campaign_stats(send["campaign_id"])

    # If interested, auto-flag the lead
    if classification == "interested":
        await db.sales_leads.update_one(
            {"_id": ObjectId(send["lead_id"])},
            {"$set": {"status": "warm", "updated_at": datetime.utcnow()}}
        )

    # If unsubscribe, mark lead
    if classification == "unsubscribe":
        await db.sales_leads.update_one(
            {"_id": ObjectId(send["lead_id"])},
            {"$set": {"status": "unsubscribed", "do_not_contact": True, "updated_at": datetime.utcnow()}}
        )

    logger.info(f"Reply from {from_email} classified as {classification} (confidence: {confidence:.0%})")
    return {"received": True, "matched": True, "classification": classification}


# ═══════════════════════════════════════════════════════════
# WARMUP STATUS
# ═══════════════════════════════════════════════════════════

@router.get("/warmup/status")
async def get_warmup_status():
    """Get warmup status for all domains and accounts."""
    db = get_database()
    domains = []
    async for d in db.outreach_domains.find({"status": "warming"}):
        accounts = []
        async for a in db.outreach_accounts.find({"domain": d["domain"]}):
            # Get today's warmup log
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            log = await db.outreach_warmup_log.find_one(
                {"account_email": a["email"], "date": {"$gte": today_start}},
                sort=[("date", -1)]
            )
            accounts.append({
                **serialize_doc(a),
                "today_log": serialize_doc(log) if log else None,
            })
        domains.append({
            **serialize_doc(d),
            "accounts": accounts,
        })
    return {"warming_domains": domains}


@router.post("/warmup/run")
async def trigger_warmup():
    """Manually trigger a warmup cycle."""
    from agent.services.outreach import run_warmup_cycle
    result = await run_warmup_cycle()
    return result


# ═══════════════════════════════════════════════════════════
# MANUAL CAMPAIGN PROCESS TRIGGER
# ═══════════════════════════════════════════════════════════

@router.post("/process")
async def trigger_campaign_processing():
    """Manually trigger campaign send processing."""
    from agent.services.outreach import process_campaign_sends
    result = await process_campaign_sends()
    return result


# ═══════════════════════════════════════════════════════════
# SEED TEMPLATES
# ═══════════════════════════════════════════════════════════

@router.post("/seed-templates")
async def seed_default_templates():
    """Seed the database with default outreach templates."""
    db = get_database()

    templates = [
        {
            "name": "Commission Pain — Opener",
            "category": "cold_outreach",
            "angle": "commission_pain",
            "step_number": 1,
            "subject": "Quick question about {restaurant_name}'s delivery costs",
            "body_text": """Hi {first_name},

I noticed {restaurant_name} is on {current_platform} for deliveries. Most {cuisine} restaurants in {city} are paying 25-35% commission on every order — which on a busy week probably costs you £{estimated_weekly_cost}.

We built ReeveOS specifically to fix this. Our restaurants keep 92-95% of every order.

I put together a quick breakdown of what {restaurant_name} could save. Want me to send it over?

Best,
{sender_name}""",
            "body_html": "",
            "variables": ["restaurant_name", "first_name", "current_platform", "cuisine", "city", "estimated_weekly_cost", "sender_name"],
        },
        {
            "name": "Commission Pain — Follow-up",
            "category": "cold_outreach",
            "angle": "commission_pain",
            "step_number": 2,
            "subject": "Re: Quick question about {restaurant_name}'s delivery costs",
            "body_text": """Hi {first_name},

Just bumping this up — I know restaurant owners are flat out midweek so totally understand if this got buried.

The short version: we can probably save {restaurant_name} £{estimated_monthly_savings}/month on delivery commissions alone.

Happy to send the breakdown if useful. No sales pitch, just the numbers.

{sender_name}""",
            "body_html": "",
            "variables": ["restaurant_name", "first_name", "estimated_monthly_savings", "sender_name"],
        },
        {
            "name": "Booking Pain — Opener",
            "category": "cold_outreach",
            "angle": "booking_friction",
            "step_number": 1,
            "subject": "How {restaurant_name} could fill 20+ more covers a week",
            "body_text": """Hi {first_name},

I was looking at {restaurant_name}'s Google profile — {rating} stars across {review_count} reviews is brilliant. {personalised_compliment}.

One thing I noticed: there's no direct booking option on your listing. Every diner who wants to book has to call — and 60% of under-35s won't call.

We built a free booking page for {restaurant_name}. Takes 2 minutes to set up.

Want me to send you the link?

{sender_name}""",
            "body_html": "",
            "variables": ["restaurant_name", "first_name", "rating", "review_count", "personalised_compliment", "sender_name"],
        },
        {
            "name": "Booking Pain — Follow-up",
            "category": "cold_outreach",
            "angle": "booking_friction",
            "step_number": 2,
            "subject": "Re: How {restaurant_name} could fill 20+ more covers a week",
            "body_text": """Hi {first_name},

Quick follow-up on this — your free ReeveOS booking page for {restaurant_name} is ready to go. No cost, no contract, takes about 2 minutes.

It goes live on Google within 48 hours and diners can book directly without calling.

Shall I send the setup link?

{sender_name}""",
            "body_html": "",
            "variables": ["restaurant_name", "first_name", "sender_name"],
        },
        {
            "name": "ReeveOS Restaurant Minute — Newsletter",
            "category": "newsletter",
            "angle": None,
            "step_number": 1,
            "subject": "ReeveOS Restaurant Minute #{issue}: {hook}",
            "body_text": """\"{opening_quote}\"

{tactical_nugget_200_words}

{cta_text}

— The ReeveOS Team

PS: {ps_statement}""",
            "body_html": "",
            "variables": ["issue", "hook", "opening_quote", "tactical_nugget_200_words", "cta_text", "ps_statement"],
        },
    ]

    created = 0
    for t in templates:
        existing = await db.outreach_templates.find_one({"name": t["name"]})
        if not existing:
            t["times_used"] = 0
            t["total_opens"] = 0
            t["total_replies"] = 0
            t["open_rate"] = 0.0
            t["reply_rate"] = 0.0
            t["created_at"] = datetime.utcnow()
            t["updated_at"] = datetime.utcnow()
            await db.outreach_templates.insert_one(t)
            created += 1

    return {"message": f"Seeded {created} templates", "total": len(templates)}
