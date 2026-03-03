"""
Rezvo Security Watchdog
========================
Scheduled tasks that use the AI agent to actively monitor
and police the platform's security posture.

Runs at two frequencies:
- security_watchdog: Every 30 minutes — quick scan for violations
- security_full_audit: Daily at 5 AM — complete security report

Reports are stored in MongoDB security_reports collection
and flagged as notifications for the admin dashboard.
"""
import logging
from datetime import datetime
from database import get_database
from agent.runner import run_agent, MODEL_HAIKU, MODEL_SONNET

logger = logging.getLogger("agent.tasks.security")


async def security_watchdog():
    """
    Quick security scan every 30 minutes.
    Checks for cross-tenant violations and auth anomalies.
    Uses Haiku for speed and cost.
    """
    result = await run_agent(
        task="""Run a quick security check:

1. Use scan_cross_tenant_violations to check for any cross-tenant access attempts in the last hour
2. Use scan_auth_anomalies to check for suspicious authentication patterns

If you find ANY cross-tenant violations, this is CRITICAL — a potential UK GDPR breach.
Report exactly what happened: which user, which business they tried to access, when.

If you find auth anomalies (duplicate emails, role mismatches), report them with severity.

If everything is clean, just say "Security check passed — no violations detected."

Be concise. This runs every 30 minutes.""",
        tools=[
            "scan_cross_tenant_violations",
            "scan_auth_anomalies",
        ],
        model=MODEL_HAIKU,
        max_turns=4,
        task_type="security_watchdog",
    )

    # If violations found, create admin notification
    if any(word in result["result"].lower() for word in ["critical", "violation", "breach"]):
        db = get_database()
        if db is not None:
            await db.admin_notifications.insert_one({
                "type": "security_alert",
                "severity": "critical",
                "title": "Security Violation Detected",
                "message": result["result"],
                "read": False,
                "created_at": datetime.utcnow(),
            })
            logger.critical(f"SECURITY ALERT: {result['result'][:200]}")

    return result


async def security_full_audit():
    """
    Complete security audit — runs daily at 5 AM.
    Covers tenant isolation code scan, violations, auth, data integrity.
    Uses Sonnet for deeper analysis.
    """
    result = await run_agent(
        task="""Run a COMPLETE security audit of the Rezvo platform. This is the daily compliance check.

1. Use scan_tenant_isolation to check code-level tenant guard coverage across all API routes
2. Use scan_cross_tenant_violations with 24 hours lookback
3. Use scan_auth_anomalies with 24 hours lookback  
4. Use scan_data_integrity to check for orphaned records and dangling references

Generate a security report with these sections:

TENANT ISOLATION: What percentage of routes are protected? List any unguarded files.
VIOLATIONS: Were there any cross-tenant access attempts in the last 24 hours?
AUTH HEALTH: Any duplicate accounts, role mismatches, or orphaned users?
DATA INTEGRITY: Any broken references between users, businesses, and records?

Rate overall compliance: PASS, WARNING, or FAIL.

If tenant isolation is below 100%, rate as FAIL and note this is a UK GDPR Article 32 
compliance gap. The ICO fined companies an average of 2.8M GBP in 2025 for security failures.

If there are cross-tenant violations, rate as FAIL — this is a reportable data breach.

Be specific with numbers and file names. This report may be reviewed by the business owner.""",
        tools=[
            "scan_tenant_isolation",
            "scan_cross_tenant_violations",
            "scan_auth_anomalies",
            "scan_data_integrity",
            "get_security_report",
        ],
        model=MODEL_SONNET,
        max_turns=8,
        task_type="security_full_audit",
    )

    # Always store the daily report
    db = get_database()
    if db is not None:
        await db.security_daily_reports.insert_one({
            "report": result["result"],
            "tokens_used": result["tokens_used"],
            "duration": result["duration"],
            "tool_calls": len(result["tool_calls"]),
            "created_at": datetime.utcnow(),
        })

        # Create notification based on result
        severity = "ok"
        if "fail" in result["result"].lower():
            severity = "critical"
        elif "warning" in result["result"].lower():
            severity = "warning"

        if severity != "ok":
            await db.admin_notifications.insert_one({
                "type": "security_audit",
                "severity": severity,
                "title": f"Daily Security Audit: {severity.upper()}",
                "message": result["result"][:2000],
                "read": False,
                "created_at": datetime.utcnow(),
            })

    return result


async def security_realtime_guard():
    """
    Lightweight check that runs every 5 minutes alongside health_check.
    No AI call — just direct DB queries for speed and zero cost.
    Flags critical issues instantly.
    """
    db = get_database()
    if db is None:
        return {"result": "DB not available"}

    alerts = []
    now = datetime.utcnow()

    # Check for tenant violations in last 5 minutes
    from datetime import timedelta
    cutoff = now - timedelta(minutes=5)

    violation_count = await db.audit_log.count_documents({
        "event_type": "tenant_violation",
        "timestamp": {"$gte": cutoff},
    })

    if violation_count > 0:
        alerts.append(f"CRITICAL: {violation_count} cross-tenant violation(s) in last 5 minutes")

    # Check for duplicate user emails (data corruption indicator)
    pipeline = [
        {"$group": {"_id": "$email", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
    ]
    dupes = await db.users.aggregate(pipeline).to_list(10)
    if dupes:
        for d in dupes:
            alerts.append(f"WARNING: Duplicate email '{d['_id']}' ({d['count']} accounts)")

    # Log alerts
    if alerts:
        for alert in alerts:
            logger.warning(f"REALTIME GUARD: {alert}")
            if "CRITICAL" in alert:
                await db.admin_notifications.insert_one({
                    "type": "realtime_security",
                    "severity": "critical",
                    "title": "Real-time Security Alert",
                    "message": alert,
                    "read": False,
                    "created_at": now,
                })

    return {
        "result": f"{len(alerts)} alert(s)" if alerts else "All clear",
        "alerts": alerts,
        "checked_at": now.isoformat(),
    }
