"""
MongoDB Index Setup for Agent Collections
==========================================
Call ensure_agent_indexes() on app startup.
Creates indexes for all agent-related collections.
"""
import logging
from database import get_database

logger = logging.getLogger("agent.indexes")


async def ensure_agent_indexes():
    """Create all indexes needed by the agent. Idempotent — safe to call on every startup."""
    db = get_database()
    if db is None:
        logger.warning("No database — skipping agent index creation")
        return

    try:
        # Audit log
        await db.agent_audit.create_index([("created_at", -1)])
        await db.agent_audit.create_index("task_type")

        # Approval queue
        await db.agent_approvals.create_index("status")
        await db.agent_approvals.create_index([("created_at", -1)])

        # Health snapshots
        await db.health_snapshots.create_index([("created_at", -1)])

        # Error logs
        await db.error_logs.create_index([("created_at", -1)])
        await db.error_logs.create_index("severity")

        # Sales leads
        await db.sales_leads.create_index("google_place_id", unique=True, sparse=True)
        await db.sales_leads.create_index("status")
        await db.sales_leads.create_index([("score", -1)])
        await db.sales_leads.create_index("city")

        # Churn scores
        await db.churn_scores.create_index("business_id", unique=True)
        await db.churn_scores.create_index([("score", -1)])

        # Dunning log
        await db.dunning_log.create_index("business_id")
        await db.dunning_log.create_index([("sent_at", -1)])

        # Email log (agent)
        await db.email_log.create_index([("sent_at", -1)])
        await db.email_log.create_index("sent_by")

        # SEO pages
        await db.seo_pages.create_index("slug", unique=True)
        await db.seo_pages.create_index("status")

        # Knowledge base — text index for search
        await db.knowledge_base.create_index([
            ("title", "text"),
            ("content", "text"),
            ("tags", "text"),
        ])
        await db.knowledge_base.create_index("category")

        # Chat conversations (for learning)
        await db.chat_conversations.create_index("feedback")
        await db.chat_conversations.create_index("indexed")

        # LinkedIn posts (from linkedin.py)
        await db.linkedin_posts.create_index("status")
        await db.linkedin_posts.create_index([("created_at", -1)])

        # ═══ Outreach Engine Indexes ═══

        # Outreach domains
        await db.outreach_domains.create_index("domain", unique=True)
        await db.outreach_domains.create_index("status")

        # Outreach accounts
        await db.outreach_accounts.create_index("email", unique=True)
        await db.outreach_accounts.create_index("domain")
        await db.outreach_accounts.create_index("status")

        # Outreach campaigns
        await db.outreach_campaigns.create_index("status")
        await db.outreach_campaigns.create_index([("city", 1), ("cuisine", 1)])
        await db.outreach_campaigns.create_index([("created_at", -1)])

        # Outreach sends — high-traffic collection, needs good indexes
        await db.outreach_sends.create_index([("campaign_id", 1), ("step_number", 1)])
        await db.outreach_sends.create_index("lead_id")
        await db.outreach_sends.create_index("status")
        await db.outreach_sends.create_index("resend_message_id")
        await db.outreach_sends.create_index([("account_email", 1), ("created_at", -1)])
        await db.outreach_sends.create_index("queued_at")
        await db.outreach_sends.create_index([("to_email", 1), ("created_at", -1)])

        # Outreach replies
        await db.outreach_replies.create_index("campaign_id")
        await db.outreach_replies.create_index("classification")
        await db.outreach_replies.create_index("is_read")
        await db.outreach_replies.create_index([("received_at", -1)])

        # Outreach warmup log
        await db.outreach_warmup_log.create_index([("account_email", 1), ("date", -1)])
        await db.outreach_warmup_log.create_index([("domain", 1), ("day_number", 1)])

        # Outreach templates
        await db.outreach_templates.create_index([("angle", 1), ("step_number", 1)])
        await db.outreach_templates.create_index("category")

        logger.info("Agent indexes created successfully (including outreach engine)")

    except Exception as e:
        logger.error(f"Index creation error: {e}")
