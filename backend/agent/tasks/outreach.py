"""
Rezvo Outreach Engine — Scheduled Agent Tasks
===============================================
Tasks that run on cron schedules to power the outreach engine:
- Warmup cycle (every 2h during warming)
- Daily warmup advance (midnight)
- Campaign send processing (every 30min during send window)
- Health scoring (every 6h)
- Reply processing & classification (every 15min)
- Campaign status checker (every 1h)
"""
import logging
from datetime import datetime, timedelta
from database import get_database

logger = logging.getLogger("outreach.tasks")


# ═══════════════════════════════════════════════════════════
# TASK: WARMUP CYCLE (every 2 hours while domains are warming)
# ═══════════════════════════════════════════════════════════

async def outreach_warmup_cycle():
    """Send warmup emails from warming accounts to seed pool."""
    from agent.services.outreach import run_warmup_cycle
    try:
        result = await run_warmup_cycle()
        logger.info(f"Warmup cycle: {result.get('total_sent', 0)} emails sent")
        return result
    except Exception as e:
        logger.error(f"Warmup cycle failed: {e}")
        return {"error": str(e)}


# ═══════════════════════════════════════════════════════════
# TASK: DAILY WARMUP ADVANCE (midnight)
# ═══════════════════════════════════════════════════════════

async def outreach_daily_advance():
    """Advance warmup day, reset daily counters, check warmup completion."""
    from agent.services.outreach import advance_warmup_day
    try:
        result = await advance_warmup_day()
        logger.info("Daily warmup advance complete")
        return result
    except Exception as e:
        logger.error(f"Daily advance failed: {e}")
        return {"error": str(e)}


# ═══════════════════════════════════════════════════════════
# TASK: CAMPAIGN SEND PROCESSING (every 30min, 10:00-15:00 Tue-Thu)
# ═══════════════════════════════════════════════════════════

async def outreach_process_campaigns():
    """Process all active campaigns — send queued emails and follow-ups."""
    from agent.services.outreach import process_campaign_sends
    try:
        result = await process_campaign_sends()
        logger.info(f"Campaign processing: {result.get('campaigns_processed', 0)} campaigns processed")
        return result
    except Exception as e:
        logger.error(f"Campaign processing failed: {e}")
        return {"error": str(e)}


# ═══════════════════════════════════════════════════════════
# TASK: HEALTH SCORING (every 6 hours)
# ═══════════════════════════════════════════════════════════

async def outreach_health_scoring():
    """Recalculate health scores for all accounts and domains."""
    from agent.services.outreach import update_account_health, update_domain_health
    db = get_database()
    if db is None:
        return {"error": "No database"}

    accounts_scored = 0
    domains_scored = 0

    # Score all accounts
    async for account in db.outreach_accounts.find({"status": {"$in": ["active", "warming"]}}):
        try:
            await update_account_health(account["email"])
            accounts_scored += 1
        except Exception as e:
            logger.error(f"Health scoring failed for {account['email']}: {e}")

    # Score all domains
    async for domain in db.outreach_domains.find():
        try:
            await update_domain_health(domain["domain"])
            domains_scored += 1
        except Exception as e:
            logger.error(f"Health scoring failed for {domain['domain']}: {e}")

    logger.info(f"Health scoring: {accounts_scored} accounts, {domains_scored} domains")
    return {"accounts_scored": accounts_scored, "domains_scored": domains_scored}


# ═══════════════════════════════════════════════════════════
# TASK: CAMPAIGN STATUS CHECKER (every 1 hour)
# ═══════════════════════════════════════════════════════════

async def outreach_campaign_status_check():
    """
    Check campaign statuses:
    - Warming campaigns: move to active if domains are ready
    - Active campaigns: mark complete if all leads contacted
    - Auto-pause if bounce rate exceeds threshold
    """
    db = get_database()
    if db is None:
        return {"error": "No database"}

    results = []

    # Check warming campaigns — promote to active if domains ready
    async for campaign in db.outreach_campaigns.find({"status": "warming"}):
        assigned = campaign.get("assigned_domains", [])
        if assigned:
            warming_count = await db.outreach_domains.count_documents({
                "domain": {"$in": assigned}, "status": "warming"
            })
        else:
            warming_count = await db.outreach_domains.count_documents({"status": "warming"})

        if warming_count == 0:
            await db.outreach_campaigns.update_one(
                {"_id": campaign["_id"]},
                {"$set": {"status": "active", "started_at": datetime.utcnow(), "updated_at": datetime.utcnow()}}
            )
            results.append({"campaign": campaign["name"], "action": "promoted to active"})

    # Check active campaigns — mark complete if fully sent
    async for campaign in db.outreach_campaigns.find({"status": "active"}):
        total_leads = campaign.get("total_leads", 0)
        leads_contacted = campaign.get("leads_contacted", 0)

        if total_leads > 0 and leads_contacted >= total_leads:
            # Check all follow-ups are sent too
            steps = campaign.get("steps", [])
            max_step = max((s.get("step_number", 1) for s in steps), default=1)
            last_step_sends = await db.outreach_sends.count_documents({
                "campaign_id": str(campaign["_id"]),
                "step_number": max_step,
            })
            if last_step_sends >= total_leads:
                await db.outreach_campaigns.update_one(
                    {"_id": campaign["_id"]},
                    {"$set": {"status": "complete", "completed_at": datetime.utcnow(), "updated_at": datetime.utcnow()}}
                )
                results.append({"campaign": campaign["name"], "action": "marked complete"})

        # Auto-pause if bounce rate > 5%
        if campaign.get("bounce_rate", 0) > 0.05 and campaign.get("total_sent", 0) > 20:
            await db.outreach_campaigns.update_one(
                {"_id": campaign["_id"]},
                {"$set": {"status": "paused", "updated_at": datetime.utcnow()}}
            )
            results.append({
                "campaign": campaign["name"],
                "action": f"auto-paused (bounce rate {campaign['bounce_rate']:.1%})"
            })

    return {"checks": len(results), "results": results}


# ═══════════════════════════════════════════════════════════
# ALL OUTREACH TASKS — for scheduler registration
# ═══════════════════════════════════════════════════════════

OUTREACH_TASKS = {
    "outreach_warmup_cycle": {
        "func": outreach_warmup_cycle,
        "cron": "0 */2 * * *",  # Every 2 hours
        "description": "Send warmup emails from warming accounts",
    },
    "outreach_daily_advance": {
        "func": outreach_daily_advance,
        "cron": "0 0 * * *",  # Midnight
        "description": "Advance warmup day, reset counters",
    },
    "outreach_process_campaigns": {
        "func": outreach_process_campaigns,
        "cron": "*/30 10-14 * * 1-4",  # Every 30min, 10-15h, Mon-Thu
        "description": "Process active campaign sends",
    },
    "outreach_health_scoring": {
        "func": outreach_health_scoring,
        "cron": "0 */6 * * *",  # Every 6 hours
        "description": "Recalculate account and domain health scores",
    },
    "outreach_campaign_status": {
        "func": outreach_campaign_status_check,
        "cron": "0 * * * *",  # Every hour
        "description": "Check campaign statuses, promote/pause/complete",
    },
}
