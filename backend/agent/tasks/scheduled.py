"""
ReeveOS Scheduled Tasks — SMART GUARDS
======================================
Every task checks if there's actual work before calling AI.
Zero AI calls on empty queues. Only burns tokens when needed.
"""
import logging
import os
from datetime import datetime, timedelta
from database import get_database
from agent.runner import run_agent, MODEL_HAIKU, MODEL_SONNET

logger = logging.getLogger("agent.tasks")


# ═══════════════════════════════════════════════════════════
# TASK 1: HEALTH CHECK (every 5 minutes)
# NO AI — direct system check. Only calls AI on critical.
# ═══════════════════════════════════════════════════════════

async def health_check():
    """Direct system health check. Zero AI cost. Only calls AI if critical."""
    db = get_database()
    if db is None:
        return {"result": "No database connection", "tokens_used": 0, "duration": 0}

    start = datetime.utcnow()
    checks = {}
    status = "healthy"
    alerts = []

    # 1. MongoDB ping
    try:
        await db.command("ping")
        checks["mongodb"] = "healthy"
    except Exception as e:
        checks["mongodb"] = "down"
        status = "critical"
        alerts.append(f"MongoDB DOWN: {e}")

    # 2. System resources (try psutil, fallback to /proc)
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        checks["cpu_percent"] = round(cpu, 1)
        checks["memory_percent"] = round(mem.percent, 1)
        checks["disk_percent"] = round(disk.percent, 1)
        if cpu > 90: status = "critical"; alerts.append(f"CPU at {cpu}%")
        if mem.percent > 90: status = "critical"; alerts.append(f"Memory at {mem.percent}%")
        if disk.percent > 90: status = "critical"; alerts.append(f"Disk at {disk.percent}%")
    except ImportError:
        checks["system"] = "psutil not installed"
    except Exception:
        checks["system"] = "unavailable"

    # 3. Recent errors (last 5 min)
    try:
        cutoff = datetime.utcnow() - timedelta(minutes=5)
        error_count = await db.error_log.count_documents({"created_at": {"$gte": cutoff}})
        checks["recent_errors"] = error_count
        if error_count > 10:
            status = "warning" if status == "healthy" else status
            alerts.append(f"{error_count} errors in last 5min")
    except Exception:
        checks["recent_errors"] = 0

    duration = (datetime.utcnow() - start).total_seconds()

    snapshot = {
        "status": status, "checks": checks, "alerts": alerts,
        "result": f"Status: {status}" + (f" — {', '.join(alerts)}" if alerts else ""),
        "tokens": 0, "duration": duration, "created_at": datetime.utcnow(),
    }
    await db.health_snapshots.insert_one(snapshot)
    cutoff = datetime.utcnow() - timedelta(days=7)
    await db.health_snapshots.delete_many({"created_at": {"$lt": cutoff}})

    # ONLY call AI if something is actually wrong
    if status == "critical":
        logger.warning(f"HEALTH CRITICAL: {alerts}")
        result = await run_agent(
            task=f"CRITICAL HEALTH ALERT: {', '.join(alerts)}\nChecks: {checks}\nDiagnose root cause and recommend actions.",
            tools=["get_system_health", "get_error_logs"],
            model=MODEL_HAIKU, max_turns=3, task_type="health_check",
        )
        await db.admin_notifications.insert_one({
            "type": "security_alert", "severity": "critical",
            "title": "System Health Critical", "message": result["result"],
            "created_at": datetime.utcnow(),
        })
        return result

    return {"result": snapshot["result"], "tokens_used": 0, "duration": duration}


# ═══════════════════════════════════════════════════════════
# TASK 2: SUPPORT TICKET TRIAGE (every 15 minutes)
# GUARD: Only calls AI if there are open tickets
# ═══════════════════════════════════════════════════════════

async def triage_tickets():
    """Triage open support tickets. Only calls AI if tickets exist."""
    db = get_database()
    if db is None:
        return {"result": "No database", "tokens_used": 0, "duration": 0}

    open_count = await db.support_conversations.count_documents({
        "status": {"$in": ["open", "new", "pending"]},
        "ai_triaged": {"$ne": True},
    })
    if open_count == 0:
        return {"result": "No open tickets", "tokens_used": 0, "duration": 0, "skipped": True}

    logger.info(f"Triaging {open_count} open tickets")
    return await run_agent(
        task=f"""There are {open_count} open support tickets. For each:
1. Simple question → draft response, mark in_progress
2. Bug report → internal note with diagnosis, priority high
3. Billing issue → priority urgent, "needs human review"
4. Angry → priority high, empathetic response
Search knowledge base first. Process up to 5.""",
        tools=["get_support_tickets", "update_ticket", "search_knowledge_base"],
        model=MODEL_HAIKU, max_turns=8, task_type="ticket_triage",
    )


# ═══════════════════════════════════════════════════════════
# TASK 3: REVIEW MODERATION (every 2 hours)
# GUARD: Only calls AI if pending reviews exist
# ═══════════════════════════════════════════════════════════

async def moderate_reviews():
    """Moderate pending reviews. Only calls AI if reviews need moderation."""
    db = get_database()
    if db is None:
        return {"result": "No database", "tokens_used": 0, "duration": 0}

    pending_count = await db.reviews.count_documents({"status": "pending"})
    if pending_count == 0:
        return {"result": "No pending reviews", "tokens_used": 0, "duration": 0, "skipped": True}

    logger.info(f"Moderating {pending_count} pending reviews")
    return await run_agent(
        task=f"""{pending_count} reviews pending. APPROVE genuine, FLAG spam/profanity, REMOVE hate/threats. Process up to 10.""",
        tools=["get_reviews", "moderate_review"],
        model=MODEL_HAIKU, max_turns=6, task_type="review_moderation",
    )


# ═══════════════════════════════════════════════════════════
# TASK 4: DAILY BRIEFING (8 AM daily)
# Always runs — daily only, worth the cost
# ═══════════════════════════════════════════════════════════

async def daily_briefing():
    """Generate daily briefing for admin dashboard."""
    result = await run_agent(
        task="""Generate a daily briefing:
1. Platform metrics: businesses, signups, MRR
2. Bookings: yesterday total, busiest, cancellations
3. Support: open tickets, response time
4. Churn: at-risk businesses, inactive 7+ days
5. Outreach: leads, emails, response rate
Concise executive summary, 3-5 paragraphs.""",
        tools=["get_platform_stats", "get_booking_stats", "get_churn_overview"],
        model=MODEL_SONNET, max_turns=5, task_type="daily_briefing",
    )
    db = get_database()
    if db is not None:
        await db.daily_briefings.insert_one({
            "content": result["result"], "tokens": result["tokens_used"],
            "date": datetime.utcnow().strftime("%Y-%m-%d"), "created_at": datetime.utcnow(),
        })
    return result


# ═══════════════════════════════════════════════════════════
# TASK 5: CHURN RISK SCORING (daily, 6 AM)
# NO AI — direct DB formula scoring
# ═══════════════════════════════════════════════════════════

async def score_churn_risk():
    """Score churn risk directly from DB. Zero AI cost."""
    db = get_database()
    if db is None:
        return {"result": "No database", "tokens_used": 0, "duration": 0}

    biz_count = await db.businesses.count_documents({"owner_id": {"$exists": True}})
    if biz_count == 0:
        return {"result": "No businesses to score", "tokens_used": 0, "duration": 0, "skipped": True}

    now = datetime.utcnow()
    scored = 0
    async for biz in db.businesses.find({"owner_id": {"$exists": True}}):
        biz_id = str(biz["_id"])
        score = 0
        signals = []

        # Last login
        last_login = biz.get("last_login")
        if last_login:
            days = (now - last_login).days
            if days > 30: score += 40; signals.append(f"No login {days}d")
            elif days > 14: score += 25; signals.append(f"Last login {days}d ago")
            elif days > 7: score += 10; signals.append(f"Last login {days}d ago")
        else:
            score += 20; signals.append("Never logged in")

        # Recent bookings
        week_ago = now - timedelta(days=7)
        recent = await db.bookings.count_documents({
            "businessId": biz_id, "created_at": {"$gte": week_ago}
        })
        if recent == 0:
            score += 15; signals.append("No bookings in 7d")

        # Open support tickets
        open_tix = await db.support_conversations.count_documents({
            "business_id": biz_id, "status": {"$in": ["open", "pending"]}
        })
        if open_tix > 0:
            score += 10 * min(open_tix, 3)
            signals.append(f"{open_tix} open tickets")

        score = min(score, 100)
        risk = "high" if score >= 60 else "medium" if score >= 30 else "low"
        await db.businesses.update_one({"_id": biz["_id"]}, {"$set": {
            "churn_score": score, "churn_risk": risk,
            "churn_signals": signals, "churn_scored_at": now,
        }})
        scored += 1

    return {"result": f"Scored {scored} businesses", "tokens_used": 0, "duration": 0}


# ═══════════════════════════════════════════════════════════
# TASK 6: LEAD DISCOVERY (every 12 hours)
# NO AI — direct Google Places API
# ═══════════════════════════════════════════════════════════

async def discover_leads(city: str = "Nottingham", cuisine: str = None):
    """Discover restaurant leads via Google Places. Zero AI cost."""
    import httpx
    db = get_database()
    if db is None:
        return {"result": "No database connection"}

    from config import settings
    api_key = getattr(settings, 'google_places_api_key', None)
    if not api_key:
        return {"result": "Google Places API key not configured", "tokens_used": 0, "duration": 0, "skipped": True}

    query = f"{cuisine + ' ' if cuisine else ''}restaurants in {city}"
    leads_created = 0
    leads_skipped = 0

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/place/textsearch/json",
                params={"query": query, "key": api_key}
            )
            data = resp.json()

            for place in data.get("results", []):
                place_id = place.get("place_id")
                name = place.get("name", "Unknown")
                existing = await db.leads.find_one({"google_place_id": place_id})
                if existing:
                    leads_skipped += 1
                    continue

                detail_resp = await client.get(
                    "https://maps.googleapis.com/maps/api/place/details/json",
                    params={"place_id": place_id, "key": api_key,
                            "fields": "name,formatted_phone_number,formatted_address,website,rating,user_ratings_total,opening_hours,types"}
                )
                details = detail_resp.json().get("result", {})
                score = 50
                if details.get("website"): score += 10
                if details.get("formatted_phone_number"): score += 10
                rc = details.get("user_ratings_total") or 0
                if rc > 100: score += 15
                elif rc > 50: score += 10
                elif rc > 20: score += 5
                r = details.get("rating") or 0
                if r >= 4.5: score += 10
                elif r >= 4.0: score += 5

                await db.leads.insert_one({
                    "google_place_id": place_id, "name": name,
                    "phone": details.get("formatted_phone_number"),
                    "address": details.get("formatted_address"),
                    "website": details.get("website"),
                    "rating": details.get("rating"),
                    "review_count": details.get("user_ratings_total"),
                    "city": city, "cuisine": cuisine, "source": "google_places",
                    "status": "new", "score": min(score, 100), "created_at": datetime.utcnow(),
                })
                leads_created += 1
    except Exception as e:
        logger.error(f"Lead discovery error: {e}")
        return {"result": f"Error: {e}", "tokens_used": 0, "duration": 0}

    return {"result": f"{leads_created} new leads, {leads_skipped} existing", "tokens_used": 0, "duration": 0}


# ═══════════════════════════════════════════════════════════
# TASK 7: LEAD RESEARCH & OUTREACH (daily, 10 AM)
# GUARD: Only if unresearched leads exist
# ═══════════════════════════════════════════════════════════

async def research_and_outreach_leads():
    """Research new leads. Only calls AI if leads exist."""
    db = get_database()
    if db is None:
        return {"result": "No database", "tokens_used": 0, "duration": 0}

    new_leads = await db.leads.count_documents({"status": "new", "researched": {"$ne": True}})
    if new_leads == 0:
        return {"result": "No new leads to research", "tokens_used": 0, "duration": 0, "skipped": True}

    logger.info(f"Researching {new_leads} new leads")
    return await run_agent(
        task=f"""{new_leads} new restaurant leads to research. For each:
1. Check website for existing booking/ordering
2. Identify pain points (high commissions, no online presence)
3. Draft personalised outreach email
4. Score conversion likelihood (1-10)
Process up to 5, highest-scored first.""",
        tools=["get_leads", "update_lead", "web_search"],
        model=MODEL_HAIKU, max_turns=10, task_type="lead_research",
    )


# ═══════════════════════════════════════════════════════════
# TASK 8: DUNNING (every 4 hours)
# GUARD + NO AI — direct DB processing
# ═══════════════════════════════════════════════════════════

async def process_dunning():
    """Dunning for failed payments. Zero AI cost."""
    db = get_database()
    if db is None:
        return {"result": "No database", "tokens_used": 0, "duration": 0}

    failed_count = await db.businesses.count_documents({
        "payment_status": "failed", "subscription_status": "active",
    })
    if failed_count == 0:
        return {"result": "No failed payments", "tokens_used": 0, "duration": 0, "skipped": True}

    now = datetime.utcnow()
    processed = 0
    async for biz in db.businesses.find({"payment_status": "failed", "subscription_status": "active"}):
        last_dunned = biz.get("last_dunning_email")
        if last_dunned and (now - last_dunned).days < 3:
            continue
        dunning_count = biz.get("dunning_count", 0) + 1
        await db.businesses.update_one({"_id": biz["_id"]}, {"$set": {
            "last_dunning_email": now, "dunning_count": dunning_count,
        }})
        await db.audit_log.insert_one({
            "type": "dunning", "business_id": str(biz["_id"]),
            "business_name": biz.get("name"), "dunning_count": dunning_count,
            "detail": f"Dunning email #{dunning_count}", "created_at": now,
        })
        processed += 1

    return {"result": f"Processed {processed} dunning", "tokens_used": 0, "duration": 0}


# ═══════════════════════════════════════════════════════════
# TASK 9: SEO CONTENT (daily, 3 AM)
# GUARD: Only if cities need pages
# ═══════════════════════════════════════════════════════════

async def generate_seo_content():
    """Generate SEO pages. Only if missing city pages."""
    db = get_database()
    if db is None:
        return {"result": "No database", "tokens_used": 0, "duration": 0}

    biz_count = await db.businesses.count_documents({"type": {"$exists": True, "$ne": None}})
    if biz_count == 0:
        return {"result": "No businesses for SEO", "tokens_used": 0, "duration": 0, "skipped": True}

    cities_with_biz = await db.businesses.distinct("city")
    cities_with_pages = await db.seo_pages.distinct("city")
    missing = [c for c in cities_with_biz if c and c not in cities_with_pages]
    if not missing:
        return {"result": f"All {len(cities_with_pages)} city pages exist", "tokens_used": 0, "duration": 0, "skipped": True}

    logger.info(f"Generating SEO for {len(missing)} cities: {missing[:5]}")
    return await run_agent(
        task=f"""Generate SEO pages for: {', '.join(missing[:3])}
Each needs: title, meta description, intro, cuisine sections.""",
        tools=["create_seo_page", "get_businesses_by_city"],
        model=MODEL_HAIKU, max_turns=8, task_type="seo_content",
    )


# ═══════════════════════════════════════════════════════════
# TASK 10: ONBOARDING DRIP (every 30 minutes)
# GUARD + NO AI — direct queue processing
# ═══════════════════════════════════════════════════════════

async def process_onboarding_drip():
    """Process queued drip emails. Zero AI cost."""
    db = get_database()
    if db is None:
        return {"result": "No database", "tokens_used": 0, "duration": 0}

    now = datetime.utcnow()
    queued = await db.drip_queue.count_documents({"send_at": {"$lte": now}, "sent": {"$ne": True}})
    if queued == 0:
        return {"result": "No drip emails queued", "tokens_used": 0, "duration": 0, "skipped": True}

    processed = 0
    async for drip in db.drip_queue.find({"send_at": {"$lte": now}, "sent": {"$ne": True}}).limit(20):
        try:
            await db.drip_queue.update_one({"_id": drip["_id"]}, {"$set": {"sent": True, "sent_at": now}})
            processed += 1
        except Exception as e:
            logger.error(f"Drip send failed: {e}")

    return {"result": f"Processed {processed} drip emails", "tokens_used": 0, "duration": 0}


# ═══════════════════════════════════════════════════════════
# TASK 11: KNOWLEDGE LEARNING (daily, 2 AM)
# GUARD: Only if resolved conversations exist
# ═══════════════════════════════════════════════════════════

async def learn_from_conversations():
    """Learn from resolved chats. Only if new ones exist."""
    db = get_database()
    if db is None:
        return {"result": "No database", "tokens_used": 0, "duration": 0}

    cutoff = datetime.utcnow() - timedelta(days=1)
    resolved = await db.support_conversations.count_documents({
        "status": "resolved", "resolved_at": {"$gte": cutoff}, "learned": {"$ne": True},
    })
    if resolved == 0:
        return {"result": "No new conversations", "tokens_used": 0, "duration": 0, "skipped": True}

    logger.info(f"Learning from {resolved} resolved conversations")
    return await run_agent(
        task=f"""{resolved} resolved conversations to learn from. Extract: FAQ additions, bug patterns, feature requests, UX pain points.""",
        tools=["get_resolved_conversations", "add_to_knowledge_base"],
        model=MODEL_HAIKU, max_turns=6, task_type="knowledge_learning",
    )
