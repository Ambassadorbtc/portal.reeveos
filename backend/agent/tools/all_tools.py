"""
Rezvo Agent Tools — Complete tool registry
==========================================
All tools the agent can call via Claude tool-use.
Each tool is a simple async function + schema.
Registered at import time via register_all_tools().
"""
import logging
import psutil
from datetime import datetime, timedelta
from typing import Optional, List
from database import get_database
from config import settings

logger = logging.getLogger("agent.tools")


def register_all_tools():
    # ═══ Security Monitoring Tools ═══
    from agent.tools.security import register_security_tools
    register_security_tools()

    """Register every tool with the agent runner."""
    from agent.runner import register_tool

    # ═══════════════════════════════════════
    # BOOKING TOOLS (auto-approve / reads)
    # ═══════════════════════════════════════

    register_tool(
        "get_bookings",
        "Get recent bookings with optional filters. Returns list of bookings.",
        {"type": "object", "properties": {
            "status": {"type": "string", "description": "Filter: confirmed, pending, cancelled, completed"},
            "business_id": {"type": "string", "description": "Filter by business"},
            "days_back": {"type": "integer", "description": "How many days back to look (default 7)"},
            "limit": {"type": "integer", "description": "Max results (default 20)"},
        }},
        _get_bookings, tier="auto"
    )

    register_tool(
        "get_booking_stats",
        "Get booking statistics — total, by status, revenue, busiest times.",
        {"type": "object", "properties": {
            "days_back": {"type": "integer", "description": "Period to analyse (default 30)"},
        }},
        _get_booking_stats, tier="auto"
    )

    # ═══════════════════════════════════════
    # SUPPORT TOOLS
    # ═══════════════════════════════════════

    register_tool(
        "get_support_tickets",
        "Get support tickets. Returns open tickets sorted by priority.",
        {"type": "object", "properties": {
            "status": {"type": "string", "description": "open, in_progress, resolved, closed"},
            "limit": {"type": "integer", "description": "Max results (default 20)"},
        }},
        _get_support_tickets, tier="auto"
    )

    register_tool(
        "update_ticket",
        "Update a support ticket — change status, add response, assign priority.",
        {"type": "object", "properties": {
            "ticket_id": {"type": "string", "description": "Ticket ID"},
            "status": {"type": "string", "description": "New status"},
            "response": {"type": "string", "description": "Response to send to customer"},
            "priority": {"type": "string", "description": "low, medium, high, urgent"},
            "internal_note": {"type": "string", "description": "Internal note (not sent to customer)"},
        }, "required": ["ticket_id"]},
        _update_ticket, tier="review"
    )

    # ═══════════════════════════════════════
    # REVIEW MODERATION
    # ═══════════════════════════════════════

    register_tool(
        "get_reviews",
        "Get reviews pending moderation or recent reviews.",
        {"type": "object", "properties": {
            "status": {"type": "string", "description": "pending, approved, flagged, removed"},
            "limit": {"type": "integer", "description": "Max results"},
        }},
        _get_reviews, tier="auto"
    )

    register_tool(
        "moderate_review",
        "Approve or flag a review. Can add moderation note.",
        {"type": "object", "properties": {
            "review_id": {"type": "string", "description": "Review ID"},
            "action": {"type": "string", "description": "approve, flag, remove"},
            "reason": {"type": "string", "description": "Reason for moderation action"},
        }, "required": ["review_id", "action"]},
        _moderate_review, tier="review"
    )

    # ═══════════════════════════════════════
    # STRIPE / REVENUE TOOLS
    # ═══════════════════════════════════════

    register_tool(
        "get_stripe_balance",
        "Get current Stripe balance and recent payouts.",
        {"type": "object", "properties": {}},
        _get_stripe_balance, tier="auto"
    )

    register_tool(
        "get_mrr",
        "Get current MRR, subscriber counts, plan breakdown.",
        {"type": "object", "properties": {}},
        _get_mrr, tier="auto"
    )

    register_tool(
        "get_churn_scores",
        "Get businesses at risk of churning, sorted by risk score.",
        {"type": "object", "properties": {
            "min_score": {"type": "integer", "description": "Minimum churn risk score (0-100, default 40)"},
            "limit": {"type": "integer", "description": "Max results"},
        }},
        _get_churn_scores, tier="auto"
    )

    register_tool(
        "trigger_dunning_email",
        "Send a payment failure recovery email to a customer.",
        {"type": "object", "properties": {
            "business_id": {"type": "string", "description": "Business with failed payment"},
            "attempt_number": {"type": "integer", "description": "Which dunning attempt (1-4)"},
        }, "required": ["business_id"]},
        _trigger_dunning_email, tier="review"
    )

    register_tool(
        "send_upgrade_nudge",
        "Send an upgrade suggestion to a business approaching plan limits.",
        {"type": "object", "properties": {
            "business_id": {"type": "string", "description": "Business ID"},
            "reason": {"type": "string", "description": "Why they should upgrade"},
            "current_plan": {"type": "string", "description": "Their current plan"},
            "suggested_plan": {"type": "string", "description": "Suggested plan"},
        }, "required": ["business_id", "reason"]},
        _send_upgrade_nudge, tier="review"
    )

    # ═══════════════════════════════════════
    # EMAIL TOOLS
    # ═══════════════════════════════════════

    register_tool(
        "send_email",
        "Send an email via Resend. For transactional or outreach emails.",
        {"type": "object", "properties": {
            "to": {"type": "string", "description": "Recipient email"},
            "subject": {"type": "string", "description": "Email subject"},
            "body_html": {"type": "string", "description": "HTML email body"},
            "from_name": {"type": "string", "description": "Sender name (default: Rezvo)"},
            "reply_to": {"type": "string", "description": "Reply-to address"},
        }, "required": ["to", "subject", "body_html"]},
        _send_email, tier="review"
    )

    register_tool(
        "get_email_stats",
        "Get email sending stats — sent, opened, clicked, bounced.",
        {"type": "object", "properties": {
            "days_back": {"type": "integer", "description": "Period (default 30)"},
        }},
        _get_email_stats, tier="auto"
    )

    # ═══════════════════════════════════════
    # SYSTEM HEALTH TOOLS
    # ═══════════════════════════════════════

    register_tool(
        "get_system_health",
        "Get system health — CPU, RAM, disk, MongoDB status, API uptime.",
        {"type": "object", "properties": {}},
        _get_system_health, tier="auto"
    )

    register_tool(
        "get_error_logs",
        "Get recent error logs from the platform.",
        {"type": "object", "properties": {
            "severity": {"type": "string", "description": "error, warning, critical"},
            "hours_back": {"type": "integer", "description": "How many hours back (default 6)"},
            "limit": {"type": "integer", "description": "Max results (default 20)"},
        }},
        _get_error_logs, tier="auto"
    )

    # ═══════════════════════════════════════
    # RESTAURANT / LEAD TOOLS
    # ═══════════════════════════════════════

    register_tool(
        "get_active_restaurants",
        "Get list of active restaurants on the platform.",
        {"type": "object", "properties": {
            "limit": {"type": "integer", "description": "Max results"},
        }},
        _get_active_restaurants, tier="auto"
    )

    register_tool(
        "get_leads",
        "Get sales leads from the pipeline with optional status filter.",
        {"type": "object", "properties": {
            "status": {"type": "string", "description": "new, researched, contacted, engaged, converted, dead"},
            "min_score": {"type": "integer", "description": "Minimum lead score"},
            "limit": {"type": "integer", "description": "Max results"},
        }},
        _get_leads, tier="auto"
    )

    register_tool(
        "create_lead",
        "Create a new sales lead from Google Places data.",
        {"type": "object", "properties": {
            "name": {"type": "string", "description": "Restaurant name"},
            "address": {"type": "string", "description": "Full address"},
            "phone": {"type": "string", "description": "Phone number"},
            "google_place_id": {"type": "string", "description": "Google Place ID"},
            "rating": {"type": "number", "description": "Google rating"},
            "review_count": {"type": "integer", "description": "Number of Google reviews"},
            "website": {"type": "string", "description": "Website URL"},
            "email": {"type": "string", "description": "Contact email if found"},
        }, "required": ["name", "google_place_id"]},
        _create_lead, tier="review"
    )

    register_tool(
        "update_lead",
        "Update a lead's status, score, or notes.",
        {"type": "object", "properties": {
            "lead_id": {"type": "string", "description": "Lead ID"},
            "status": {"type": "string", "description": "New status"},
            "score": {"type": "integer", "description": "Lead score 0-100"},
            "notes": {"type": "string", "description": "Add notes"},
            "pain_points": {"type": "array", "items": {"type": "string"}, "description": "Identified pain points"},
            "personalisation_hooks": {"type": "array", "items": {"type": "string"}, "description": "Personalisation hooks for outreach"},
        }, "required": ["lead_id"]},
        _update_lead, tier="review"
    )

    # ═══════════════════════════════════════
    # KNOWLEDGE BASE TOOLS
    # ═══════════════════════════════════════

    register_tool(
        "search_knowledge_base",
        "Search the RAG knowledge base for relevant information.",
        {"type": "object", "properties": {
            "query": {"type": "string", "description": "Search query"},
            "limit": {"type": "integer", "description": "Max results (default 5)"},
        }, "required": ["query"]},
        _search_knowledge_base, tier="auto"
    )

    register_tool(
        "index_knowledge",
        "Add a new document/FAQ to the knowledge base.",
        {"type": "object", "properties": {
            "title": {"type": "string", "description": "Document title"},
            "content": {"type": "string", "description": "Document content"},
            "category": {"type": "string", "description": "Category: faq, guide, policy, troubleshooting"},
            "tags": {"type": "array", "items": {"type": "string"}, "description": "Tags for filtering"},
        }, "required": ["title", "content"]},
        _index_knowledge, tier="review"
    )

    # ═══════════════════════════════════════
    # AGENT SELF-TOOLS
    # ═══════════════════════════════════════

    register_tool(
        "get_agent_stats",
        "Get agent's own run statistics — tasks completed, tokens used, errors.",
        {"type": "object", "properties": {
            "days_back": {"type": "integer", "description": "Period (default 7)"},
        }},
        _get_agent_stats, tier="auto"
    )

    register_tool(
        "get_pending_approvals",
        "Get actions pending human approval.",
        {"type": "object", "properties": {}},
        _get_pending_approvals, tier="auto"
    )

    logger.info(f"Registered {len(TOOL_REGISTRY)} agent tools")
    # need to import here to avoid circular
    from agent.runner import TOOL_REGISTRY
    return len(TOOL_REGISTRY)


# ═══════════════════════════════════════════════════════════════
# TOOL IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════

async def _get_bookings(status=None, business_id=None, days_back=7, limit=20):
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    if business_id:
        query["business_id"] = business_id
    cutoff = datetime.utcnow() - timedelta(days=days_back)
    query["created_at"] = {"$gte": cutoff}
    
    bookings = []
    async for doc in db.bookings.find(query).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        bookings.append(doc)
    return {"bookings": bookings, "count": len(bookings)}


async def _get_booking_stats(days_back=30):
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days_back)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
        }}
    ]
    status_counts = {}
    async for doc in db.bookings.aggregate(pipeline):
        status_counts[doc["_id"] or "unknown"] = doc["count"]
    
    total = sum(status_counts.values())
    return {"total": total, "by_status": status_counts, "period_days": days_back}


async def _get_support_tickets(status=None, limit=20):
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    
    tickets = []
    async for doc in db.support_tickets.find(query).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        tickets.append(doc)
    return {"tickets": tickets, "count": len(tickets)}


async def _update_ticket(ticket_id, status=None, response=None, priority=None, internal_note=None):
    from bson import ObjectId
    db = get_database()
    update = {"updated_at": datetime.utcnow()}
    if status:
        update["status"] = status
    if priority:
        update["priority"] = priority
    if response:
        update["$push"] = {"responses": {"text": response, "from": "agent", "at": datetime.utcnow()}}
    if internal_note:
        update.setdefault("$push", {})["internal_notes"] = {"text": internal_note, "at": datetime.utcnow()}
    
    set_fields = {k: v for k, v in update.items() if not k.startswith("$")}
    push_fields = update.get("$push", {})
    
    update_doc = {}
    if set_fields:
        update_doc["$set"] = set_fields
    if push_fields:
        update_doc["$push"] = push_fields
    
    await db.support_tickets.update_one({"_id": ObjectId(ticket_id)}, update_doc)
    return {"status": "updated", "ticket_id": ticket_id}


async def _get_reviews(status=None, limit=20):
    db = get_database()
    query = {}
    if status:
        query["moderation_status"] = status
    
    reviews = []
    async for doc in db.reviews.find(query).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        reviews.append(doc)
    return {"reviews": reviews, "count": len(reviews)}


async def _moderate_review(review_id, action, reason=None):
    from bson import ObjectId
    db = get_database()
    status_map = {"approve": "approved", "flag": "flagged", "remove": "removed"}
    await db.reviews.update_one(
        {"_id": ObjectId(review_id)},
        {"$set": {
            "moderation_status": status_map.get(action, action),
            "moderation_reason": reason,
            "moderated_at": datetime.utcnow(),
            "moderated_by": "agent",
        }}
    )
    return {"status": "moderated", "action": action, "review_id": review_id}


async def _get_stripe_balance():
    try:
        import stripe
        stripe.api_key = settings.stripe_secret_key
        balance = stripe.Balance.retrieve()
        available = sum(b.amount for b in balance.available) / 100
        pending = sum(b.amount for b in balance.pending) / 100
        return {"available_gbp": available, "pending_gbp": pending, "currency": "GBP"}
    except Exception as e:
        return {"error": str(e)}


async def _get_mrr():
    db = get_database()
    # Aggregate from businesses with active subscriptions
    pipeline = [
        {"$match": {"subscription_status": "active"}},
        {"$group": {
            "_id": "$plan",
            "count": {"$sum": 1},
        }}
    ]
    plan_prices = {"free": 0, "starter": 8.99, "growth": 29, "scale": 59, "enterprise": 199}
    plan_counts = {}
    mrr = 0
    async for doc in db.businesses.aggregate(pipeline):
        plan = doc["_id"] or "free"
        plan_counts[plan] = doc["count"]
        mrr += doc["count"] * plan_prices.get(plan, 0)
    
    total_businesses = await db.businesses.count_documents({})
    active = await db.businesses.count_documents({"subscription_status": "active"})
    
    return {
        "mrr_gbp": round(mrr, 2),
        "arr_gbp": round(mrr * 12, 2),
        "total_businesses": total_businesses,
        "active_subscribers": active,
        "by_plan": plan_counts,
    }


async def _get_churn_scores(min_score=40, limit=20):
    db = get_database()
    scores = []
    async for doc in db.churn_scores.find({"score": {"$gte": min_score}}).sort("score", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        scores.append(doc)
    return {"at_risk": scores, "count": len(scores)}


async def _trigger_dunning_email(business_id, attempt_number=1):
    from bson import ObjectId
    db = get_database()
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not biz:
        return {"error": "Business not found"}
    
    email = biz.get("email") or biz.get("owner_email")
    if not email:
        return {"error": "No email found for business"}
    
    subjects = {
        1: "Quick heads up — your payment didn't go through",
        2: "Your Rezvo subscription needs attention",
        3: "Action needed — update your payment method",
        4: "Final notice — your account will be paused",
    }
    
    subject = subjects.get(attempt_number, subjects[1])
    name = biz.get("name", "there")
    
    body = f"""<p>Hi {name},</p>
<p>We tried to process your Rezvo subscription payment but it didn't go through.</p>
<p>This usually happens when a card expires or there's a temporary issue with your bank.</p>
<p><a href="https://rezvo.app/dashboard/payments" style="background:#1B4332;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Update Payment Method</a></p>
<p>If you need any help, just reply to this email.</p>
<p>Cheers,<br>The Rezvo Team</p>"""
    
    result = await _send_email(to=email, subject=subject, body_html=body)
    
    await db.dunning_log.insert_one({
        "business_id": business_id,
        "attempt": attempt_number,
        "email": email,
        "sent_at": datetime.utcnow(),
    })
    
    return {"status": "sent", "attempt": attempt_number, "to": email}


async def _send_upgrade_nudge(business_id, reason, current_plan=None, suggested_plan=None):
    from bson import ObjectId
    db = get_database()
    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not biz:
        return {"error": "Business not found"}
    
    email = biz.get("email") or biz.get("owner_email")
    if not email:
        return {"error": "No email"}
    
    body = f"""<p>Hi {biz.get('name', 'there')},</p>
<p>{reason}</p>
<p>Your current {current_plan or 'plan'} has been working well — upgrading to {suggested_plan or 'the next tier'} would unlock everything you need to keep growing.</p>
<p><a href="https://rezvo.app/dashboard/settings" style="background:#1B4332;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">View Plans</a></p>
<p>Cheers,<br>The Rezvo Team</p>"""
    
    return await _send_email(to=email, subject="You're outgrowing your plan 🚀", body_html=body)


async def _send_email(to, subject, body_html, from_name="Rezvo", reply_to=None):
    try:
        import resend
        resend.api_key = settings.resend_api_key
        params = {
            "from": f"{from_name} <hello@rezvo.app>",
            "to": [to] if isinstance(to, str) else to,
            "subject": subject,
            "html": body_html,
        }
        if reply_to:
            params["reply_to"] = reply_to
        result = resend.Emails.send(params)
        
        db = get_database()
        await db.email_log.insert_one({
            "to": to, "subject": subject, "resend_id": result.get("id"),
            "sent_by": "agent", "sent_at": datetime.utcnow(),
        })
        return {"status": "sent", "resend_id": result.get("id")}
    except Exception as e:
        return {"error": str(e)}


async def _get_email_stats(days_back=30):
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days_back)
    sent = await db.email_log.count_documents({"sent_at": {"$gte": cutoff}})
    opened = await db.email_log.count_documents({"sent_at": {"$gte": cutoff}, "opened_at": {"$exists": True}})
    clicked = await db.email_log.count_documents({"sent_at": {"$gte": cutoff}, "clicked_at": {"$exists": True}})
    bounced = await db.email_log.count_documents({"sent_at": {"$gte": cutoff}, "bounced": True})
    return {"sent": sent, "opened": opened, "clicked": clicked, "bounced": bounced, "period_days": days_back}


async def _get_system_health():
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    
    # Check MongoDB
    db = get_database()
    mongo_ok = False
    try:
        await db.command("ping")
        mongo_ok = True
    except Exception:
        pass
    
    return {
        "cpu_percent": cpu,
        "memory_percent": mem.percent,
        "memory_used_gb": round(mem.used / (1024**3), 2),
        "memory_total_gb": round(mem.total / (1024**3), 2),
        "disk_percent": disk.percent,
        "disk_free_gb": round(disk.free / (1024**3), 2),
        "mongodb_connected": mongo_ok,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def _get_error_logs(severity=None, hours_back=6, limit=20):
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(hours=hours_back)
    query = {"created_at": {"$gte": cutoff}}
    if severity:
        query["severity"] = severity
    
    errors = []
    async for doc in db.error_logs.find(query).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        errors.append(doc)
    return {"errors": errors, "count": len(errors)}


async def _get_active_restaurants(limit=50):
    db = get_database()
    restaurants = []
    async for doc in db.businesses.find({"status": {"$ne": "suspended"}}).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        restaurants.append({
            "id": doc["_id"],
            "name": doc.get("name"),
            "plan": doc.get("plan", "free"),
            "city": doc.get("city"),
            "created_at": doc.get("created_at", "").isoformat() if hasattr(doc.get("created_at", ""), "isoformat") else "",
        })
    return {"restaurants": restaurants, "count": len(restaurants)}


async def _get_leads(status=None, min_score=None, limit=30):
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    if min_score:
        query["score"] = {"$gte": min_score}
    
    leads = []
    async for doc in db.sales_leads.find(query).sort("score", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        leads.append(doc)
    return {"leads": leads, "count": len(leads)}


async def _create_lead(name, google_place_id, address=None, phone=None, rating=None, review_count=None, website=None, email=None):
    db = get_database()
    # Deduplicate
    existing = await db.sales_leads.find_one({"google_place_id": google_place_id})
    if existing:
        return {"status": "duplicate", "lead_id": str(existing["_id"])}
    
    lead = {
        "name": name,
        "google_place_id": google_place_id,
        "address": address,
        "phone": phone,
        "rating": rating,
        "review_count": review_count,
        "website": website,
        "email": email,
        "status": "new",
        "score": 0,
        "drip_step": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await db.sales_leads.insert_one(lead)
    return {"status": "created", "lead_id": str(result.inserted_id)}


async def _update_lead(lead_id, status=None, score=None, notes=None, pain_points=None, personalisation_hooks=None):
    from bson import ObjectId
    db = get_database()
    update = {"updated_at": datetime.utcnow()}
    if status:
        update["status"] = status
    if score is not None:
        update["score"] = score
    if pain_points:
        update["pain_points"] = pain_points
    if personalisation_hooks:
        update["personalisation_hooks"] = personalisation_hooks
    
    update_doc = {"$set": update}
    if notes:
        update_doc["$push"] = {"notes": {"text": notes, "at": datetime.utcnow()}}
    
    await db.sales_leads.update_one({"_id": ObjectId(lead_id)}, update_doc)
    return {"status": "updated", "lead_id": lead_id}


async def _search_knowledge_base(query, limit=5):
    db = get_database()
    # Text search fallback (vector search requires Atlas or v7+ with mongot)
    try:
        results = []
        async for doc in db.knowledge_base.find(
            {"$text": {"$search": query}},
            {"score": {"$meta": "textScore"}}
        ).sort([("score", {"$meta": "textScore"})]).limit(limit):
            doc["_id"] = str(doc["_id"])
            results.append(doc)
        return {"results": results, "count": len(results)}
    except Exception:
        # Fallback to regex search if text index not set up
        import re
        regex = re.compile(re.escape(query), re.IGNORECASE)
        results = []
        async for doc in db.knowledge_base.find(
            {"$or": [{"title": regex}, {"content": regex}, {"tags": regex}]}
        ).limit(limit):
            doc["_id"] = str(doc["_id"])
            results.append(doc)
        return {"results": results, "count": len(results)}


async def _index_knowledge(title, content, category=None, tags=None):
    db = get_database()
    doc = {
        "title": title,
        "content": content,
        "category": category or "general",
        "tags": tags or [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await db.knowledge_base.insert_one(doc)
    return {"status": "indexed", "id": str(result.inserted_id)}


async def _get_agent_stats(days_back=7):
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days_back)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$task_type",
            "count": {"$sum": 1},
            "total_tokens": {"$sum": "$tokens_used"},
            "avg_duration": {"$avg": "$duration_seconds"},
        }}
    ]
    stats = {}
    async for doc in db.agent_audit.aggregate(pipeline):
        stats[doc["_id"] or "unknown"] = {
            "runs": doc["count"],
            "tokens": doc["total_tokens"],
            "avg_duration_sec": round(doc["avg_duration"] or 0, 2),
        }
    
    total_runs = sum(s["runs"] for s in stats.values())
    total_tokens = sum(s["tokens"] for s in stats.values())
    
    # Estimate cost (Haiku pricing)
    est_cost = (total_tokens / 1_000_000) * 0.75  # rough avg of input/output
    
    return {
        "by_task": stats,
        "total_runs": total_runs,
        "total_tokens": total_tokens,
        "estimated_cost_usd": round(est_cost, 4),
        "period_days": days_back,
    }


async def _get_pending_approvals():
    db = get_database()
    approvals = []
    async for doc in db.agent_approvals.find({"status": "pending"}).sort("created_at", -1).limit(20):
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        approvals.append(doc)
    return {"pending": approvals, "count": len(approvals)}
