"""
Rezvo Outreach Engine — Service Layer
======================================
Core business logic: warmup, sender rotation, campaign execution,
AI personalisation via Claude Haiku, health scoring, reply processing.
"""
import logging
import random
import math
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from bson import ObjectId
from database import get_database
from config import settings

logger = logging.getLogger("outreach.service")


# ═══════════════════════════════════════════════════════════
# WARMUP ENGINE
# ═══════════════════════════════════════════════════════════

# 14-day warmup ramp: (day, emails_per_account)
WARMUP_SCHEDULE = [
    (1, 2), (2, 4), (3, 6), (4, 8), (5, 10),
    (6, 12), (7, 15), (8, 18), (9, 20), (10, 22),
    (11, 24), (12, 26), (13, 28), (14, 30),
]

# Warmup seed contacts — these are accounts that open + reply to warmup emails
# In production, use a warmup provider like Warmup Inbox, Instantly, or Lemwarm
WARMUP_SEED_POOL = [
    "warmup-a@rezvo-seeds.co.uk",
    "warmup-b@rezvo-seeds.co.uk",
    "warmup-c@rezvo-seeds.co.uk",
    "warmup-d@rezvo-seeds.co.uk",
    "warmup-e@rezvo-seeds.co.uk",
]

WARMUP_SUBJECTS = [
    "Quick sync on the project timeline",
    "Coffee meeting next week?",
    "Re: Updated document attached",
    "Following up on our call",
    "Notes from today's meeting",
    "Schedule change for Thursday",
    "Re: Budget review",
    "Question about the report",
    "Lunch plans this week?",
    "Updated brief attached",
]

WARMUP_BODIES = [
    "Hi, just wanted to follow up on what we discussed. Let me know your thoughts when you get a chance.",
    "Thanks for sending that over. I'll take a look and get back to you by end of day.",
    "Great meeting today. I've attached the updated notes. Let me know if I missed anything.",
    "Hey, are you free for a quick call tomorrow? I have a few questions about the project.",
    "Just checking in — did you get a chance to review the document I sent last week?",
    "Perfect, that works for me. I'll block out the time on my calendar.",
    "Thanks for the heads up. I'll adjust the schedule on my end.",
    "Sounds good! I'll prepare the presentation and share it before the meeting.",
]


async def get_warmup_target(day: int) -> int:
    """Get target sends per account for a given warmup day."""
    for d, count in WARMUP_SCHEDULE:
        if d == day:
            return count
    return 30  # Post-warmup default


async def run_warmup_cycle():
    """
    Run one warmup cycle. Called by scheduler every 2 hours during warmup.
    Sends warmup emails from warming accounts to seed pool.
    """
    db = get_database()
    if db is None:
        return {"error": "No database connection"}

    # Find all warming accounts
    warming_accounts = []
    async for acc in db.outreach_accounts.find({"status": "warming"}):
        warming_accounts.append(acc)

    if not warming_accounts:
        return {"message": "No accounts warming", "sent": 0}

    total_sent = 0
    results = []

    for account in warming_accounts:
        day = account.get("warmup_day", 1)
        target = await get_warmup_target(day)

        # How many more can we send today?
        already_sent = account.get("sent_today", 0)
        remaining = max(0, target - already_sent)

        # Spread across warmup cycles (assume 4 cycles/day)
        batch_size = math.ceil(remaining / 3)
        batch_size = min(batch_size, remaining)

        if batch_size <= 0:
            continue

        for i in range(batch_size):
            seed = random.choice(WARMUP_SEED_POOL)
            subject = random.choice(WARMUP_SUBJECTS)
            body = random.choice(WARMUP_BODIES)

            try:
                msg_id = await send_email_via_resend(
                    from_email=account["email"],
                    from_name=account.get("display_name", "Team"),
                    to_email=seed,
                    subject=subject,
                    body_html=f"<p>{body}</p>",
                    body_text=body,
                    tags=["warmup"],
                )
                if msg_id:
                    total_sent += 1
                    # Log warmup send
                    await db.outreach_warmup_log.insert_one({
                        "account_email": account["email"],
                        "domain": account["domain"],
                        "day_number": day,
                        "date": datetime.utcnow(),
                        "type": "send",
                        "to": seed,
                        "subject": subject,
                        "resend_message_id": msg_id,
                        "created_at": datetime.utcnow(),
                    })
            except Exception as e:
                logger.error(f"Warmup send failed for {account['email']}: {e}")

        # Update account sent count
        await db.outreach_accounts.update_one(
            {"_id": account["_id"]},
            {"$inc": {"sent_today": batch_size}, "$set": {"updated_at": datetime.utcnow()}}
        )
        results.append({"account": account["email"], "sent": batch_size, "day": day})

    return {"message": f"Warmup cycle complete", "total_sent": total_sent, "details": results}


async def advance_warmup_day():
    """
    Called once daily at midnight. Advance warmup day for all warming accounts,
    reset daily counters, check if warmup is complete.
    """
    db = get_database()
    if db is None:
        return

    # Reset all daily send counts
    await db.outreach_accounts.update_many(
        {},
        {"$set": {"sent_today": 0, "last_sent_reset": datetime.utcnow()}}
    )
    await db.outreach_domains.update_many(
        {},
        {"$set": {"sent_today": 0, "last_sent_reset": datetime.utcnow()}}
    )

    # Advance warming accounts
    async for account in db.outreach_accounts.find({"status": "warming"}):
        new_day = account.get("warmup_day", 0) + 1
        new_limit = await get_warmup_target(min(new_day, 14))

        update = {
            "warmup_day": new_day,
            "daily_limit": new_limit,
            "updated_at": datetime.utcnow(),
        }

        if new_day >= 14:
            update["status"] = "active"
            update["warmup_complete"] = True
            logger.info(f"Account {account['email']} warmup complete — now active")

        await db.outreach_accounts.update_one({"_id": account["_id"]}, {"$set": update})

    # Check if all accounts in a domain are warmed → domain is active
    async for domain in db.outreach_domains.find({"status": "warming"}):
        warming_count = await db.outreach_accounts.count_documents({
            "domain": domain["domain"], "status": "warming"
        })
        if warming_count == 0:
            new_limit = domain.get("max_daily_limit", 150)
            await db.outreach_domains.update_one(
                {"_id": domain["_id"]},
                {"$set": {
                    "status": "active",
                    "warmup_complete": True,
                    "daily_limit": new_limit,
                    "warmup_day": 14,
                    "updated_at": datetime.utcnow(),
                }}
            )
            logger.info(f"Domain {domain['domain']} fully warmed — now active")

    return {"message": "Warmup day advanced"}


# ═══════════════════════════════════════════════════════════
# SENDER ROTATION
# ═══════════════════════════════════════════════════════════

async def pick_sender(campaign: dict) -> Optional[dict]:
    """
    Pick the next sending account using round-robin rotation.
    Returns account dict or None if all maxed out.
    """
    db = get_database()
    assigned_domains = campaign.get("assigned_domains", [])

    if not assigned_domains:
        # Use all active domains
        assigned_domains = []
        async for d in db.outreach_domains.find({"status": "active"}):
            assigned_domains.append(d["domain"])

    if not assigned_domains:
        return None

    # Get all active accounts across assigned domains, sorted by least sent today
    accounts = []
    async for acc in db.outreach_accounts.find({
        "domain": {"$in": assigned_domains},
        "status": "active",
    }).sort("sent_today", 1):
        if acc["sent_today"] < acc.get("daily_limit", 30):
            accounts.append(acc)

    if not accounts:
        return None

    rotation = campaign.get("sender_rotation", "round_robin")

    if rotation == "round_robin":
        # Pick account with fewest sends today
        return accounts[0]
    elif rotation == "random":
        return random.choice(accounts)
    else:
        return accounts[0]


async def increment_sender_count(account_email: str, domain: str):
    """Increment daily send count for account and domain."""
    db = get_database()
    await db.outreach_accounts.update_one(
        {"email": account_email},
        {"$inc": {"sent_today": 1}, "$set": {"updated_at": datetime.utcnow()}}
    )
    await db.outreach_domains.update_one(
        {"domain": domain},
        {"$inc": {"sent_today": 1}, "$set": {"updated_at": datetime.utcnow()}}
    )


# ═══════════════════════════════════════════════════════════
# EMAIL SENDING (Resend)
# ═══════════════════════════════════════════════════════════

async def send_email_via_resend(
    from_email: str,
    from_name: str,
    to_email: str,
    subject: str,
    body_html: str,
    body_text: str = "",
    reply_to: str = "",
    tags: List[str] = None,
) -> Optional[str]:
    """
    Send an email via Resend API.
    Returns the Resend message ID or None on failure.
    """
    import httpx

    api_key = settings.resend_api_key
    if not api_key:
        logger.warning("No Resend API key configured")
        return None

    payload = {
        "from": f"{from_name} <{from_email}>",
        "to": [to_email],
        "subject": subject,
        "html": body_html,
    }
    if body_text:
        payload["text"] = body_text
    if reply_to:
        payload["reply_to"] = reply_to
    if tags:
        payload["tags"] = [{"name": t, "value": "true"} for t in tags[:5]]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=15.0,
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                return data.get("id")
            else:
                logger.error(f"Resend error {resp.status_code}: {resp.text}")
                return None
    except Exception as e:
        logger.error(f"Resend send failed: {e}")
        return None


# ═══════════════════════════════════════════════════════════
# AI PERSONALISATION
# ═══════════════════════════════════════════════════════════

async def personalise_email(
    template_subject: str,
    template_body: str,
    lead: dict,
    angle: str,
) -> Tuple[str, str, int]:
    """
    Use Claude Haiku to personalise an email template for a specific lead.
    Returns (personalised_subject, personalised_body, tokens_used).
    """
    import httpx

    api_key = settings.anthropic_api_key
    if not api_key:
        # Fallback: simple variable replacement
        subject, body = simple_personalise(template_subject, template_body, lead)
        return subject, body, 0

    restaurant_name = lead.get("name", lead.get("restaurant_name", "your restaurant"))
    first_name = lead.get("contact_name", lead.get("owner_name", ""))
    city = lead.get("city", "Nottingham")
    cuisine = lead.get("cuisine", "")
    rating = lead.get("rating", "")
    review_count = lead.get("review_count", "")
    website = lead.get("website", "")
    current_platform = lead.get("current_platform", "Deliveroo")

    # Estimate savings
    est_weekly_cost = lead.get("estimated_weekly_commission", "300+")
    est_monthly_savings = lead.get("estimated_monthly_savings", "800+")

    prompt = f"""You are writing a cold outreach email for Rezvo, a restaurant booking and delivery platform.
Personalise this email template for the specific restaurant below.

RESTAURANT DATA:
- Name: {restaurant_name}
- Owner/Contact: {first_name}
- City: {city}
- Cuisine: {cuisine}
- Google Rating: {rating} stars ({review_count} reviews)
- Website: {website}
- Currently on: {current_platform}
- Estimated weekly commission cost: £{est_weekly_cost}
- Estimated monthly savings with Rezvo: £{est_monthly_savings}

OUTREACH ANGLE: {angle}

TEMPLATE SUBJECT: {template_subject}
TEMPLATE BODY: {template_body}

RULES:
- Replace all {{variable}} placeholders with actual data
- Add ONE personalised sentence that references something specific about this restaurant (their reviews, cuisine, location, etc.)
- Keep it under 120 words total
- Sound human, not corporate. Think friendly local business owner.
- British English spelling
- No emojis, no "I hope this finds you well"

Return ONLY valid JSON:
{{"subject": "...", "body": "..."}}"""

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 500,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=20.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                text = data["content"][0]["text"]
                tokens = data.get("usage", {}).get("input_tokens", 0) + data.get("usage", {}).get("output_tokens", 0)

                # Parse JSON response
                import json
                # Strip markdown code fences if present
                text = text.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
                if text.startswith("json"):
                    text = text[4:].strip()

                result = json.loads(text)
                return result["subject"], result["body"], tokens
            else:
                logger.error(f"Anthropic API error: {resp.status_code}")
                subject, body = simple_personalise(template_subject, template_body, lead)
                return subject, body, 0
    except Exception as e:
        logger.error(f"Personalisation failed: {e}")
        subject, body = simple_personalise(template_subject, template_body, lead)
        return subject, body, 0


def simple_personalise(subject: str, body: str, lead: dict) -> Tuple[str, str]:
    """Fallback: basic variable replacement without AI."""
    replacements = {
        "{restaurant_name}": lead.get("name", lead.get("restaurant_name", "your restaurant")),
        "{first_name}": lead.get("contact_name", lead.get("owner_name", "there")),
        "{city}": lead.get("city", "Nottingham"),
        "{cuisine}": lead.get("cuisine", "restaurant"),
        "{rating}": str(lead.get("rating", "4.5")),
        "{review_count}": str(lead.get("review_count", "100+")),
        "{current_platform}": lead.get("current_platform", "Deliveroo"),
        "{estimated_weekly_cost}": str(lead.get("estimated_weekly_commission", "300+")),
        "{estimated_monthly_savings}": str(lead.get("estimated_monthly_savings", "800+")),
        "{sender_name}": "Alex",
        "{personalised_compliment}": "Your menu looks fantastic",
    }
    for key, value in replacements.items():
        subject = subject.replace(key, value)
        body = body.replace(key, value)
    return subject, body


# ═══════════════════════════════════════════════════════════
# CAMPAIGN EXECUTION ENGINE
# ═══════════════════════════════════════════════════════════

async def process_campaign_sends():
    """
    Main campaign processing loop. Called by scheduler every 30 minutes
    during send windows (10:00-15:00 Tue-Thu).
    Processes all active campaigns, sends queued emails.
    """
    db = get_database()
    if db is None:
        return {"error": "No database"}

    now = datetime.utcnow()
    results = []

    # Get active campaigns
    async for campaign in db.outreach_campaigns.find({"status": "active"}):
        schedule = campaign.get("schedule", {})
        send_days = schedule.get("send_days", [1, 2, 3])  # Tue, Wed, Thu
        window_start = schedule.get("window_start_hour", 10)
        window_end = schedule.get("window_end_hour", 15)

        # Check if within send window (approximate — should use timezone-aware check)
        current_hour = now.hour
        current_weekday = now.weekday()
        if current_weekday not in send_days:
            continue
        if current_hour < window_start or current_hour >= window_end:
            continue

        campaign_result = await process_single_campaign(campaign)
        results.append(campaign_result)

    return {"campaigns_processed": len(results), "results": results}


async def process_single_campaign(campaign: dict) -> dict:
    """Process sends for a single campaign."""
    db = get_database()
    campaign_id = str(campaign["_id"])
    steps = campaign.get("steps", [])

    if not steps:
        return {"campaign": campaign["name"], "error": "No steps configured"}

    total_sent = 0
    max_per_run = campaign.get("schedule", {}).get("max_sends_per_day", 50)

    # Step 1: Find leads that haven't been sent step 1 yet
    for step in steps:
        step_num = step.get("step_number", 1)
        delay_days = step.get("delay_days", 0)

        if step_num == 1:
            # Find leads not yet contacted in this campaign
            contacted_lead_ids = set()
            async for send in db.outreach_sends.find(
                {"campaign_id": campaign_id, "step_number": 1},
                {"lead_id": 1}
            ):
                contacted_lead_ids.add(send["lead_id"])

            # Get leads for this campaign's targeting
            lead_query = {"city": {"$regex": campaign.get("city", ""), "$options": "i"}}
            if campaign.get("cuisine"):
                lead_query["cuisine"] = {"$regex": campaign["cuisine"], "$options": "i"}

            async for lead in db.sales_leads.find(lead_query).limit(max_per_run * 2):
                if total_sent >= max_per_run:
                    break
                lead_id = str(lead["_id"])
                if lead_id in contacted_lead_ids:
                    continue
                if not lead.get("email"):
                    continue

                # Pick a sender
                sender = await pick_sender(campaign)
                if not sender:
                    break  # All senders maxed

                # Personalise email
                template_subject = step.get("subject", "")
                template_body = step.get("body", "")

                if campaign.get("ai_personalisation", True):
                    subject, body, tokens = await personalise_email(
                        template_subject, template_body, lead,
                        campaign.get("angle", "commission_pain")
                    )
                else:
                    subject, body = simple_personalise(template_subject, template_body, lead)
                    tokens = 0

                # Send email
                body_html = body.replace("\n", "<br>") if "<" not in body else body
                msg_id = await send_email_via_resend(
                    from_email=sender["email"],
                    from_name=sender.get("display_name", "Rezvo Team"),
                    to_email=lead["email"],
                    subject=subject,
                    body_html=f"<div style='font-family:sans-serif;font-size:14px;color:#333;line-height:1.6'>{body_html}</div>",
                    body_text=body.replace("<br>", "\n").replace("<p>", "").replace("</p>", "\n"),
                    tags=["outreach", campaign_id],
                )

                # Record the send
                send_doc = {
                    "campaign_id": campaign_id,
                    "lead_id": lead_id,
                    "account_email": sender["email"],
                    "domain": sender["domain"],
                    "to_email": lead["email"],
                    "to_name": lead.get("contact_name", lead.get("name", "")),
                    "restaurant_name": lead.get("name", lead.get("restaurant_name", "")),
                    "subject": subject,
                    "body_html": body_html,
                    "body_text": body,
                    "step_number": step_num,
                    "variant": step.get("variant", "A"),
                    "status": "sent" if msg_id else "failed",
                    "resend_message_id": msg_id,
                    "queued_at": datetime.utcnow(),
                    "sent_at": datetime.utcnow() if msg_id else None,
                    "personalisation_tokens_used": tokens,
                    "personalisation_data": {
                        "restaurant": lead.get("name", ""),
                        "city": lead.get("city", ""),
                        "cuisine": lead.get("cuisine", ""),
                    },
                    "created_at": datetime.utcnow(),
                }
                await db.outreach_sends.insert_one(send_doc)

                if msg_id:
                    total_sent += 1
                    await increment_sender_count(sender["email"], sender["domain"])

        else:
            # Follow-up steps: find leads where step N-1 was sent X days ago and no reply
            cutoff = datetime.utcnow() - timedelta(days=delay_days)

            async for prev_send in db.outreach_sends.find({
                "campaign_id": campaign_id,
                "step_number": step_num - 1,
                "status": {"$in": ["sent", "delivered", "opened"]},
                "sent_at": {"$lte": cutoff},
            }):
                if total_sent >= max_per_run:
                    break

                # Check no reply and no step N already sent
                has_reply = await db.outreach_replies.count_documents({
                    "send_id": str(prev_send["_id"]),
                }) > 0
                if has_reply:
                    continue

                already_sent = await db.outreach_sends.count_documents({
                    "campaign_id": campaign_id,
                    "lead_id": prev_send["lead_id"],
                    "step_number": step_num,
                }) > 0
                if already_sent:
                    continue

                # Get lead data
                try:
                    lead = await db.sales_leads.find_one({"_id": ObjectId(prev_send["lead_id"])})
                except:
                    continue
                if not lead:
                    continue

                sender = await pick_sender(campaign)
                if not sender:
                    break

                template_subject = step.get("subject", "")
                template_body = step.get("body", "")

                if campaign.get("ai_personalisation", True):
                    subject, body, tokens = await personalise_email(
                        template_subject, template_body, lead,
                        campaign.get("angle", "commission_pain")
                    )
                else:
                    subject, body = simple_personalise(template_subject, template_body, lead)
                    tokens = 0

                body_html = body.replace("\n", "<br>") if "<" not in body else body
                msg_id = await send_email_via_resend(
                    from_email=sender["email"],
                    from_name=sender.get("display_name", "Rezvo Team"),
                    to_email=lead["email"],
                    subject=subject,
                    body_html=f"<div style='font-family:sans-serif;font-size:14px;color:#333;line-height:1.6'>{body_html}</div>",
                    body_text=body,
                    tags=["outreach", "followup", campaign_id],
                )

                send_doc = {
                    "campaign_id": campaign_id,
                    "lead_id": prev_send["lead_id"],
                    "account_email": sender["email"],
                    "domain": sender["domain"],
                    "to_email": lead["email"],
                    "to_name": lead.get("contact_name", ""),
                    "restaurant_name": lead.get("name", ""),
                    "subject": subject,
                    "body_html": body_html,
                    "body_text": body,
                    "step_number": step_num,
                    "variant": step.get("variant", "A"),
                    "status": "sent" if msg_id else "failed",
                    "resend_message_id": msg_id,
                    "queued_at": datetime.utcnow(),
                    "sent_at": datetime.utcnow() if msg_id else None,
                    "personalisation_tokens_used": tokens,
                    "created_at": datetime.utcnow(),
                }
                await db.outreach_sends.insert_one(send_doc)

                if msg_id:
                    total_sent += 1
                    await increment_sender_count(sender["email"], sender["domain"])

    # Update campaign stats
    await update_campaign_stats(campaign_id)

    return {"campaign": campaign["name"], "sent": total_sent}


# ═══════════════════════════════════════════════════════════
# REPLY CLASSIFICATION
# ═══════════════════════════════════════════════════════════

async def classify_reply(reply_text: str, original_subject: str = "") -> Tuple[str, float, str]:
    """
    Use Claude Haiku to classify an inbound reply.
    Returns (classification, confidence, reasoning).
    """
    import httpx

    api_key = settings.anthropic_api_key
    if not api_key:
        return rule_based_classify(reply_text)

    prompt = f"""Classify this email reply to a cold outreach from Rezvo (a restaurant booking/delivery platform).

ORIGINAL SUBJECT: {original_subject}
REPLY TEXT: {reply_text}

Classify as EXACTLY ONE of:
- interested: They want to learn more, see a demo, or sign up
- question: They're asking a specific question before deciding
- not_interested: Explicit rejection or "no thanks"
- out_of_office: Auto-reply, OOO, or vacation message
- unsubscribe: Asking to be removed from the list
- bounce: Delivery failure, invalid address

Return ONLY valid JSON:
{{"classification": "...", "confidence": 0.0-1.0, "reasoning": "one sentence"}}"""

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 200,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=15.0,
            )
            if resp.status_code == 200:
                import json
                data = resp.json()
                text = data["content"][0]["text"].strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
                if text.startswith("json"):
                    text = text[4:].strip()

                result = json.loads(text)
                return (
                    result.get("classification", "unknown"),
                    result.get("confidence", 0.5),
                    result.get("reasoning", ""),
                )
    except Exception as e:
        logger.error(f"Reply classification failed: {e}")

    return rule_based_classify(reply_text)


def rule_based_classify(text: str) -> Tuple[str, float, str]:
    """Simple rule-based fallback for reply classification."""
    text_lower = text.lower()

    if any(w in text_lower for w in ["out of office", "ooo", "vacation", "annual leave", "auto-reply", "automatic reply"]):
        return "out_of_office", 0.95, "Contains OOO keywords"
    if any(w in text_lower for w in ["unsubscribe", "remove me", "stop emailing", "opt out", "take me off"]):
        return "unsubscribe", 0.90, "Contains unsubscribe keywords"
    if any(w in text_lower for w in ["not interested", "no thanks", "no thank", "don't contact", "please don't"]):
        return "not_interested", 0.85, "Contains rejection keywords"
    if any(w in text_lower for w in ["sounds good", "interested", "tell me more", "demo", "sign up", "let's chat", "give me a call"]):
        return "interested", 0.80, "Contains interest keywords"
    if "?" in text:
        return "question", 0.70, "Contains question mark"

    return "unknown", 0.30, "No clear signal"


# ═══════════════════════════════════════════════════════════
# HEALTH SCORING
# ═══════════════════════════════════════════════════════════

async def update_account_health(account_email: str):
    """Recalculate health score for an account based on last 7 days of sends."""
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=7)

    pipeline = [
        {"$match": {"account_email": account_email, "created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "delivered": {"$sum": {"$cond": [{"$in": ["$status", ["delivered", "opened", "clicked", "replied"]]}, 1, 0]}},
            "bounced": {"$sum": {"$cond": [{"$eq": ["$status", "bounced"]}, 1, 0]}},
            "complained": {"$sum": {"$cond": [{"$eq": ["$status", "complained"]}, 1, 0]}},
            "opened": {"$sum": {"$cond": [{"$in": ["$status", ["opened", "clicked", "replied"]]}, 1, 0]}},
        }}
    ]

    result = await db.outreach_sends.aggregate(pipeline).to_list(1)
    if not result:
        return

    stats = result[0]
    total = max(stats["total"], 1)
    delivery_rate = stats["delivered"] / total
    bounce_rate = stats["bounced"] / total
    spam_rate = stats["complained"] / total
    open_rate = stats["opened"] / total if stats["delivered"] > 0 else 0

    # Health score: weighted combination
    # Delivery > 97% = good, Bounce < 2% = good, Spam < 0.1% = good
    health = 100
    if delivery_rate < 0.97:
        health -= (0.97 - delivery_rate) * 200  # -20 for each 10% below 97%
    if bounce_rate > 0.02:
        health -= (bounce_rate - 0.02) * 500  # -50 for each 10% above 2%
    if spam_rate > 0.001:
        health -= (spam_rate - 0.001) * 2000  # Heavy penalty for spam
    health = max(0, min(100, int(health)))

    await db.outreach_accounts.update_one(
        {"email": account_email},
        {"$set": {
            "health_score": health,
            "delivery_rate": round(delivery_rate, 4),
            "bounce_rate": round(bounce_rate, 4),
            "spam_rate": round(spam_rate, 4),
            "updated_at": datetime.utcnow(),
        }}
    )

    # Auto-pause if health is critical
    if health < 50 or bounce_rate > 0.05 or spam_rate > 0.005:
        await db.outreach_accounts.update_one(
            {"email": account_email},
            {"$set": {"status": "paused"}}
        )
        logger.warning(f"Auto-paused {account_email} — health: {health}, bounce: {bounce_rate:.2%}, spam: {spam_rate:.2%}")

    return health


async def update_domain_health(domain: str):
    """Recalculate health score for a domain (average of its accounts)."""
    db = get_database()
    accounts = []
    async for acc in db.outreach_accounts.find({"domain": domain}):
        accounts.append(acc)

    if not accounts:
        return

    avg_health = sum(a.get("health_score", 50) for a in accounts) / len(accounts)
    avg_delivery = sum(a.get("delivery_rate", 0) for a in accounts) / len(accounts)
    avg_bounce = sum(a.get("bounce_rate", 0) for a in accounts) / len(accounts)
    avg_spam = sum(a.get("spam_rate", 0) for a in accounts) / len(accounts)
    total_sent = sum(a.get("sent_today", 0) for a in accounts)

    await db.outreach_domains.update_one(
        {"domain": domain},
        {"$set": {
            "health_score": int(avg_health),
            "delivery_rate": round(avg_delivery, 4),
            "bounce_rate": round(avg_bounce, 4),
            "spam_rate": round(avg_spam, 4),
            "sent_today": total_sent,
            "updated_at": datetime.utcnow(),
        }}
    )

    # Auto-pause domain if critical
    if avg_health < 40:
        await db.outreach_domains.update_one(
            {"domain": domain},
            {"$set": {"status": "paused"}}
        )
        logger.warning(f"Auto-paused domain {domain} — health: {avg_health:.0f}")


async def update_campaign_stats(campaign_id: str):
    """Recalculate campaign aggregate stats."""
    db = get_database()
    pipeline = [
        {"$match": {"campaign_id": campaign_id}},
        {"$group": {
            "_id": None,
            "total_sent": {"$sum": 1},
            "delivered": {"$sum": {"$cond": [{"$in": ["$status", ["delivered", "opened", "clicked", "replied"]]}, 1, 0]}},
            "opened": {"$sum": {"$cond": [{"$in": ["$status", ["opened", "clicked", "replied"]]}, 1, 0]}},
            "clicked": {"$sum": {"$cond": [{"$in": ["$status", ["clicked", "replied"]]}, 1, 0]}},
            "replied": {"$sum": {"$cond": [{"$eq": ["$status", "replied"]}, 1, 0]}},
            "bounced": {"$sum": {"$cond": [{"$eq": ["$status", "bounced"]}, 1, 0]}},
        }}
    ]

    result = await db.outreach_sends.aggregate(pipeline).to_list(1)
    if not result:
        return

    stats = result[0]
    total = max(stats["total_sent"], 1)

    # Count interested replies
    interested = await db.outreach_replies.count_documents({
        "campaign_id": campaign_id,
        "classification": "interested",
    })

    await db.outreach_campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {
            "total_sent": stats["total_sent"],
            "total_delivered": stats["delivered"],
            "total_opened": stats["opened"],
            "total_clicked": stats["clicked"],
            "total_replied": stats["replied"],
            "total_bounced": stats["bounced"],
            "total_interested": interested,
            "open_rate": round(stats["opened"] / total, 4),
            "reply_rate": round(stats["replied"] / total, 4),
            "bounce_rate": round(stats["bounced"] / total, 4),
            "updated_at": datetime.utcnow(),
        }}
    )
